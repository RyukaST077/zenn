#!/usr/bin/env node
//
// Turn a GA4 report into the per-article reach overlay.
//
//   node scripts/analytics/collect-ga4-metrics.mjs --report-json <file> [--now <iso>]
//
// This is the piece that splits a zero-like article in two:
//
//   reach    = page views in the article's first N days  -> did anyone arrive?
//   response = likes / page views                        -> did they care?
//
// Both were unmeasurable from the Zenn API alone, so the rest of the loop had to
// fall back on the market-percentile workaround. Keeping the network out of this
// script is what makes the windowing logic testable with fixtures.
//
// Because GA4 returns a per-day breakdown, the D7/D30 windows are computed
// exactly and RETROACTIVELY -- the whole back catalogue gets real D7/D30 reach,
// not just articles published from today onwards.
//
// TWO THINGS THIS SCRIPT REFUSES TO DO
//
// 1. Call an unknowable window "measured". A window is only measured if it sits
//    entirely inside `coverage` (the request clamped to the tracking start and
//    to the last fully-processed day) and GA4 did not withhold rows. Everything
//    else is null with a reason, never zero.
//
// 2. Write GA4 numbers into the committed ledger. This repository is public;
//    per-article traffic is not. The overlay goes to analytics/private/, which
//    is git-ignored and excluded from worktree sync, and only bucketed
//    aggregates reach the committed report.

import fs from "node:fs";
import path from "node:path";

import {
  fail,
  isRateAlignedBasis,
  parseArgs,
  parseInstant,
  readJson,
  readLedger,
} from "./zenn-metrics-lib.mjs";

const { options } = parseArgs(process.argv.slice(2));
const root = path.resolve(options.root || process.cwd());
const now = options.now ? parseInstant(options.now, "--now") : new Date();

if (!options["report-json"]) fail("--report-json is required");
const report = readJson(path.resolve(root, options["report-json"]), "ga4 report");
const ledgerPath = path.resolve(root, options.ledger || "analytics/article-ledger.jsonl");
const overlayPath = path.resolve(
  root,
  options.overlay || "analytics/private/ga4-ledger.jsonl",
);

// `range.resolved` is only what was asked for. Using it as coverage is what let
// a window ending today -- still being processed -- count as a measurement, and
// let a window from before the tag was installed read as zero views.
const covered = report.coverage ?? null;
if (!covered?.from || !covered?.to) {
  fail("report has no usable `coverage` block; re-run scripts/analytics/fetch-ga4-metrics.mjs");
}
if (covered.to < covered.from) {
  fail(`coverage is empty (${covered.from} .. ${covered.to}); nothing can be measured from this report`);
}

// A property whose reporting timezone is not Asia/Tokyo buckets days on a
// different boundary than Zenn's +09:00 publication stamps. fetch already fails
// closed on this; re-check here because a report file can outlive its config.
const timeZone = report.timeZone ?? null;
if (timeZone !== "Asia/Tokyo" && !options["allow-timezone"]) {
  fail(`report timezone is ${timeZone ?? "unknown"}, not Asia/Tokyo; D7/D30 day boundaries would be shifted. Pass --allow-timezone to accept the shift.`);
}

// When GA4 collapses rows into "(other)" or withholds them for thresholding, the
// per-article totals are silently incomplete. An incomplete total is not a
// measurement, so the whole report is downgraded rather than quietly trusted.
const dataLoss = Boolean(report.dataQuality?.dataLossFromOtherRow)
  || Boolean(report.dataQuality?.subjectToThresholding);

const WINDOWS = [
  { key: "d7", days: 7 },
  { key: "d30", days: 30 },
];

const slugOf = (pagePath) => {
  // "/clopy/articles/<slug>" (GA4 pagePath excludes the query string, but strip
  // defensively in case a redirect or a custom definition includes one).
  const clean = String(pagePath).split("?")[0].replace(/\/+$/, "");
  const match = clean.match(/\/articles\/([^/]+)$/);
  return match ? match[1] : null;
};

const numeric = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

// slug -> date (YYYY-MM-DD) -> totals
const daily = new Map();
let unmatchedRows = 0;
for (const row of report.daily?.rows ?? []) {
  const date = row.dimensionValues?.[0]?.value;
  const slug = slugOf(row.dimensionValues?.[1]?.value ?? "");
  if (!slug || !/^\d{8}$/.test(String(date))) {
    unmatchedRows += 1;
    continue;
  }
  const iso = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
  if (!daily.has(slug)) daily.set(slug, new Map());
  const byDate = daily.get(slug);
  const previous = byDate.get(iso) ?? { views: 0, userDays: 0, engagementSeconds: 0 };
  byDate.set(iso, {
    views: previous.views + numeric(row.metricValues?.[0]?.value),
    // GA4's `totalUsers` is de-duplicated WITHIN a row, so summing it across
    // days counts a returning visitor once per day. The sum is therefore
    // user-days, not unique users, and is named accordingly -- a real D30
    // unique-user count needs its own report with a 30-day range per article.
    userDays: previous.userDays + numeric(row.metricValues?.[1]?.value),
    engagementSeconds: previous.engagementSeconds + numeric(row.metricValues?.[2]?.value),
  });
}

// slug -> source/medium -> sessions, over the WHOLE requested range. This is not
// a D7/D30 attribution: the source report has no date dimension, so it cannot be
// windowed. Named to stop it being read as one.
const sources = new Map();
for (const row of report.bySource?.rows ?? []) {
  const slug = slugOf(row.dimensionValues?.[0]?.value ?? "");
  if (!slug) continue;
  const source = row.dimensionValues?.[1]?.value ?? "(unknown)";
  if (!sources.has(slug)) sources.set(slug, {});
  const bucket = sources.get(slug);
  bucket[source] = (bucket[source] ?? 0) + numeric(row.metricValues?.[0]?.value);
}

const ledger = readLedger(ledgerPath);
if (ledger.length === 0) {
  fail(`ledger is empty: ${path.relative(root, ledgerPath)}. Run fetch-zenn-metrics.sh first.`);
}

/**
 * Add whole days to a YYYY-MM-DD string using UTC arithmetic only.
 *
 * Deliberately does NOT go through `dayStamp`, which converts via the machine's
 * local offset: doing that shifted every window by a day whenever the runner's
 * timezone was behind UTC (verified: TZ=America/New_York turned day 6 into
 * 2026-08-06). Both endpoints here are calendar dates in the GA4 property's
 * reporting timezone, so they must be manipulated as dates, not instants.
 */
const addDays = (iso, days) => {
  const base = new Date(`${iso}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
};

// A like rate needs enough arrivals to mean anything: 1 like out of 3 views is
// not a 33% like rate. This is a DISPLAY floor, not a verdict about reach.
const LIKE_RATE_MIN_VIEWS = 30;

const overlay = [];
let withData = 0;
let notClosed = 0;
let beforeCoverage = 0;

for (const entry of ledger) {
  if (!entry.publishedAt) continue;
  // Publication is timestamped +09:00 and the property reports in Asia/Tokyo
  // (enforced above), so the leading 10 characters are the right calendar day.
  const publishedDay = String(entry.publishedAt).slice(0, 10);
  const byDate = daily.get(entry.slug);

  const record = {
    slug: entry.slug,
    observedAt: now.toISOString(),
    propertyId: report.propertyId ?? null,
    timeZone,
    coverage: {
      from: covered.from,
      to: covered.to,
      trackingStartDate: covered.trackingStartDate ?? null,
      trackingStartSource: covered.trackingStartSource ?? null,
      completeThrough: covered.completeThrough ?? null,
    },
    windows: {},
    // Whole-range entry points. Useful for "did anyone arrive from search at
    // all", useless as a per-window attribution.
    sourceMediumWholeRange: sources.get(entry.slug) ?? null,
    sourceMediumRange: report.range?.resolved ?? null,
    observations: {},
  };

  for (const window of WINDOWS) {
    const start = publishedDay;
    const end = addDays(publishedDay, window.days - 1);
    const windowRange = { from: start, to: end, days: window.days };

    // Coverage is decided by the report's coverage block, not by whether rows
    // exist: an article can legitimately have zero views on a covered day.
    let basis = "measured";
    if (start < covered.from) {
      // Either before the tag was installed or before retention -- either way
      // the zero rows carry no information.
      basis = "outside-tracking-coverage";
    } else if (end > covered.to) {
      // Includes the still-processing tail, not only genuinely future days.
      basis = "window-not-closed";
    } else if (dataLoss) {
      basis = "report-data-loss";
    }

    if (basis !== "measured") {
      record.windows[window.key] = {
        basis,
        window: windowRange,
        views: null,
        userDays: null,
        engagementSeconds: null,
        coveredRange: { from: covered.from, to: covered.to },
      };
      continue;
    }

    let views = 0;
    let userDays = 0;
    let engagementSeconds = 0;
    if (byDate) {
      for (const [date, totals] of byDate) {
        if (date < start || date > end) continue;
        views += totals.views;
        userDays += totals.userDays;
        engagementSeconds += totals.engagementSeconds;
      }
    }
    record.windows[window.key] = {
      basis,
      window: windowRange,
      views,
      userDays,
      engagementSeconds,
      // Per-view rather than per-user: `userDays` over-counts returning
      // visitors, so a per-user average built on it would be biased low.
      engagementSecondsPerView: views > 0
        ? Number((engagementSeconds / views).toFixed(1))
        : null,
    };
  }

  if (byDate) {
    let views = 0;
    let userDays = 0;
    for (const totals of byDate.values()) {
      views += totals.views;
      userDays += totals.userDays;
    }
    record.lifetime = { views, userDays, sinceCovered: covered.from, throughCovered: covered.to };
  } else {
    record.lifetime = { views: 0, userDays: 0, sinceCovered: covered.from, throughCovered: covered.to };
  }

  // ------------------------------------------------------------------ the funnel
  // Reach comes from GA4, response from the Zenn API -- so a rate is only honest
  // if the two were captured over matching periods.
  //
  // `observations.d30.likes` can carry three very different things:
  //   measured-on-time     likes at ~day 30            -> aligned with D30 reach
  //   late-measured        likes at up to day 45        -> numerator runs long
  //   current-upper-bound  likes as of today (any age)  -> numerator runs way long
  //
  // Dividing today's cumulative likes by the first 30 days of reach inflates the
  // rate without bound, and the back catalogue is almost entirely
  // `current-upper-bound`. So the rate is withheld unless the numerator is
  // on-time, and the numerator's provenance is recorded either way. Reach itself
  // is still reported for every article: the back catalogue can answer "did
  // anyone arrive", just not "what fraction of them liked it".
  for (const window of WINDOWS) {
    const observation = entry.observations?.[window.key];
    const reach = record.windows[window.key];
    if (!observation || reach.basis !== "measured") continue;

    const aligned = isRateAlignedBasis(observation.basis);
    const enoughViews = reach.views >= LIKE_RATE_MIN_VIEWS;
    record.observations[window.key] = {
      reach: {
        views: reach.views,
        userDays: reach.userDays,
        basis: reach.basis,
        denominatorWindow: reach.window,
      },
      numerator: {
        likes: observation.likes,
        basis: observation.basis ?? null,
        observedAt: observation.observedAt ?? null,
        ageDays: observation.ageDays ?? null,
      },
      likeRate: aligned && enoughViews
        ? Number((observation.likes / reach.views).toFixed(4))
        : null,
      likeRateBasis: !aligned
        ? `numerator-not-aligned (${observation.basis ?? "unknown"})`
        : (enoughViews ? "measured" : `too-few-views (<${LIKE_RATE_MIN_VIEWS})`),
    };
  }

  const d30 = record.windows.d30;
  if (d30.basis === "measured") withData += 1;
  else if (d30.basis === "window-not-closed") notClosed += 1;
  else beforeCoverage += 1;

  overlay.push(record);
}

fs.mkdirSync(path.dirname(overlayPath), { recursive: true });
fs.writeFileSync(
  overlayPath,
  `${overlay.map((record) => JSON.stringify(record)).join("\n")}\n`,
);

const aligned = overlay.filter((record) => record.observations?.d30?.likeRate !== null
  && record.observations?.d30?.likeRate !== undefined).length;

console.log(`ga4 coverage: ${covered.from} .. ${covered.to} (requested ${covered.requested?.from ?? "?"} .. ${covered.requested?.to ?? "?"}, retention ${report.retention ?? "unknown"})`);
console.log(`tracking start: ${covered.trackingStartDate ?? "unknown"} (${covered.trackingStartSource ?? "unknown"}); complete through ${covered.completeThrough ?? "unknown"}`);
if (dataLoss) console.log("report carried withheld/collapsed rows: no window marked measured");
console.log(`articles with a measured D30 reach: ${withData}`);
console.log(`articles whose D30 window is not closed yet: ${notClosed}`);
console.log(`articles whose D30 window predates coverage: ${beforeCoverage}`);
console.log(`articles with a D30 like rate (aligned numerator + >=${LIKE_RATE_MIN_VIEWS} views): ${aligned}`);
if (unmatchedRows > 0) console.log(`rows whose path did not look like an article: ${unmatchedRows}`);
console.log(`overlay: ${path.relative(root, overlayPath)} (git-ignored; not committed)`);
