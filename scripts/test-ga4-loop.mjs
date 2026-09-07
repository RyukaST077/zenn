#!/usr/bin/env node
//
// Tests for the GA4 half of the topic-improvement loop:
//   ga4-client.mjs (JWT signing) / collect-ga4-metrics.mjs (windowing + funnel)
//
// No network: the GA4 report is supplied as a fixture, which is why the fetch
// step and the merge step are separate scripts.

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { signAssertion } from "./analytics/ga4-client.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const collect = path.join(here, "analytics/collect-ga4-metrics.mjs");
const NOW = "2026-09-05T00:00:00.000Z";
let passed = 0;

const test = (name, body) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ga4-loop-test-"));
  try {
    body(dir);
    passed += 1;
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`FAIL - ${name}`);
    throw error;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

const run = (args, dir, env = {}) => spawnSync("node", [collect, ...args, "--root", dir], {
  encoding: "utf8",
  env: { ...process.env, ...env },
});
const ok = (result, label) => {
  assert.equal(result.status, 0, `${label} failed (${result.status})\n${result.stdout}\n${result.stderr}`);
  return result;
};

const ledgerFile = (dir) => path.join(dir, "analytics/article-ledger.jsonl");
const overlayFile = (dir) => path.join(dir, "analytics/private/ga4-ledger.jsonl");

const writeLedger = (dir, entries) => {
  fs.mkdirSync(path.dirname(ledgerFile(dir)), { recursive: true });
  fs.writeFileSync(ledgerFile(dir), entries.map((item) => JSON.stringify(item)).join("\n") + "\n");
};
const readJsonl = (file) => fs.readFileSync(file, "utf8")
  .split("\n").filter(Boolean).map((line) => JSON.parse(line));
/** The GA4 overlay, keyed by slug. Deliberately NOT the committed ledger. */
const readOverlay = (dir) => readJsonl(overlayFile(dir));

/** One (date, pagePath) row shaped like the Data API returns it. */
const dailyRow = (date, slug, views, users = 1, engagement = 60) => ({
  dimensionValues: [{ value: date.replace(/-/g, "") }, { value: `/clopy/articles/${slug}` }],
  metricValues: [{ value: String(views) }, { value: String(users) }, { value: String(engagement) }],
});

/**
 * A report as fetch-ga4-metrics.mjs writes it. `from`/`to` are what was
 * REQUESTED; coverage is the narrower range GA4 can actually answer for, and is
 * what the collector must obey.
 */
const writeReport = (dir, {
  from,
  to,
  rows,
  sourceRows = [],
  retention = "FOURTEEN_MONTHS",
  timeZone = "Asia/Tokyo",
  trackingStartDate = from,
  completeThrough = to,
  dataQuality = {},
  coverage,
}) => {
  const file = "ga4-report.json";
  const requested = { from, to };
  const maxDate = (a, b) => (a > b ? a : b);
  const minDate = (a, b) => (a < b ? a : b);
  fs.writeFileSync(path.join(dir, file), JSON.stringify({
    collectedAt: NOW,
    propertyId: "123456789",
    measurementId: "G-HVE1W77CWV",
    pathPrefix: "/clopy/articles/",
    range: { from, to, resolved: requested },
    coverage: coverage ?? {
      from: maxDate(from, trackingStartDate),
      to: minDate(to, completeThrough),
      requested,
      trackingStartDate,
      trackingStartSource: "config",
      completeThrough,
      completeLagDays: 2,
    },
    dataQuality,
    retention,
    timeZone,
    daily: { rows },
    bySource: { rows: sourceRows },
  }));
  return file;
};

const entry = (slug, publishedAt, likes, extra = {}) => ({
  slug,
  title: slug,
  publishedAt,
  topics: ["claudecode"],
  primaryTopic: "claudecode",
  classification: { source: "heuristic", arm: "historical-control", valueArchetype: "asset" },
  observations: {
    d7: { likes, bookmarks: 0, comments: 0, basis: "measured-on-time", observedAt: NOW },
    d30: { likes, bookmarks: 0, comments: 0, basis: "measured-on-time", observedAt: NOW },
  },
  relative: {},
  ...extra,
});

// ------------------------------------------------------------------- signing

test("the JWT assertion is signed so Google can verify it with the public key", () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const key = {
    client_email: "loop@example.iam.gserviceaccount.com",
    private_key: privateKey.export({ type: "pkcs8", format: "pem" }),
  };

  const assertion = signAssertion(key, 1_800_000_000);
  const [header, claims, signature] = assertion.split(".");
  assert.ok(header && claims && signature, "assertion must have three segments");

  const decode = (segment) => JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
  assert.deepEqual(decode(header), { alg: "RS256", typ: "JWT" });
  const payload = decode(claims);
  assert.equal(payload.iss, key.client_email);
  assert.equal(payload.aud, "https://oauth2.googleapis.com/token");
  assert.equal(payload.scope, "https://www.googleapis.com/auth/analytics.readonly");
  assert.equal(payload.exp - payload.iat, 3600);

  assert.ok(
    crypto.verify(
      "RSA-SHA256",
      Buffer.from(`${header}.${claims}`),
      publicKey,
      Buffer.from(signature, "base64url"),
    ),
    "the signature must verify against the matching public key",
  );

  assert.throws(() => signAssertion({ client_email: "x" }), /client_email and private_key/);
});

// ------------------------------------------------------------------ windowing

test("D7 and D30 reach are summed over the exact window, not the whole range", (dir) => {
  writeLedger(dir, [entry("post", "2026-08-01T10:00:00.000+09:00", 2)]);
  const report = writeReport(dir, {
    from: "2026-07-01",
    to: "2026-09-05",
    rows: [
      dailyRow("2026-08-01", "post", 100),  // day 0  -> in d7, in d30
      dailyRow("2026-08-07", "post", 10),   // day 6  -> in d7, in d30
      dailyRow("2026-08-08", "post", 5),    // day 7  -> out of d7, in d30
      dailyRow("2026-08-30", "post", 3),    // day 29 -> in d30
      dailyRow("2026-08-31", "post", 999),  // day 30 -> out of d30
      dailyRow("2026-07-20", "post", 777),  // before publication -> never counted
    ],
  });
  ok(run(["--report-json", report, "--now", NOW], dir), "collect");

  const [row] = readOverlay(dir);
  assert.equal(row.windows.d7.basis, "measured");
  assert.equal(row.windows.d7.views, 110, "d7 covers days 0-6 only");
  assert.equal(row.windows.d30.views, 118, "d30 covers days 0-29 only");
  assert.deepEqual(row.windows.d7.window, { from: "2026-08-01", to: "2026-08-07", days: 7 });
  assert.equal(row.observations.d7.reach.views, 110);
  assert.equal(row.observations.d30.reach.views, 118);
});

test("a window outside tracking coverage is unknown, never zero", (dir) => {
  writeLedger(dir, [
    entry("ancient", "2026-01-01T00:00:00.000+09:00", 1),
    entry("recent", "2026-09-01T00:00:00.000+09:00", 0),
  ]);
  // Coverage starts in July, so the January article's windows are unknowable and
  // the September article's D30 window has not closed yet.
  const report = writeReport(dir, {
    from: "2026-07-08",
    to: "2026-09-05",
    completeThrough: "2026-09-03",
    rows: [dailyRow("2026-09-02", "recent", 40)],
    retention: "TWO_MONTHS",
  });
  const result = ok(run(["--report-json", report, "--now", NOW], dir), "collect");

  const rows = readOverlay(dir);
  const ancient = rows.find((item) => item.slug === "ancient");
  assert.equal(ancient.windows.d7.basis, "outside-tracking-coverage");
  assert.equal(ancient.windows.d7.views, null, "unknown must not be reported as 0 views");
  assert.equal(ancient.windows.d30.basis, "outside-tracking-coverage");
  assert.equal(ancient.observations.d30, undefined, "no reach is attached when unknown");

  const recent = rows.find((item) => item.slug === "recent");
  assert.equal(recent.windows.d7.basis, "window-not-closed");
  assert.equal(recent.windows.d30.basis, "window-not-closed");

  assert.match(result.stdout, /predates coverage: 1/);
  assert.match(result.stdout, /D30 window is not closed yet: 1/);
});

test("a covered day with no rows counts as zero views, which is a real measurement", (dir) => {
  writeLedger(dir, [entry("quiet", "2026-08-01T00:00:00.000+09:00", 0)]);
  const report = writeReport(dir, { from: "2026-07-01", to: "2026-09-05", rows: [] });
  ok(run(["--report-json", report, "--now", NOW], dir), "collect");

  const [row] = readOverlay(dir);
  assert.equal(row.windows.d30.basis, "measured");
  assert.equal(row.windows.d30.views, 0, "covered but unvisited is a measured zero");
});

// ------------------------------------------------------- coverage is not range

test("a window reaching into the still-processing tail is not a measurement", (dir) => {
  // Regression: coverage used to be the REQUESTED range, so a request ending at
  // `today` made a window ending today "measured" even though GA4 was still
  // processing those days -- reporting a partial count as a final one.
  writeLedger(dir, [entry("fresh", "2026-08-30T00:00:00.000+09:00", 0)]);
  const report = writeReport(dir, {
    from: "2026-07-01",
    to: "2026-09-05",              // requested through today
    completeThrough: "2026-09-03", // but only complete through the 3rd
    rows: [dailyRow("2026-08-31", "fresh", 12), dailyRow("2026-09-05", "fresh", 3)],
  });
  ok(run(["--report-json", report, "--now", NOW], dir), "collect");

  const [row] = readOverlay(dir);
  // d7 = 2026-08-30 .. 2026-09-05, which runs past completeThrough.
  assert.equal(row.windows.d7.basis, "window-not-closed");
  assert.equal(row.windows.d7.views, null, "a partially-processed window must not report a total");
});

test("a window before the tag was installed is unknown, not a measured zero", (dir) => {
  // Regression: GA4 returns no rows for days before the tag existed, which is
  // indistinguishable from "nobody visited" unless the tracking start is known.
  writeLedger(dir, [entry("pre-tag", "2026-07-02T00:00:00.000+09:00", 0)]);
  const report = writeReport(dir, {
    from: "2026-07-01",              // requested from before the tag
    trackingStartDate: "2026-08-01", // tag actually went live in August
    to: "2026-09-05",
    completeThrough: "2026-09-03",
    rows: [],
  });
  ok(run(["--report-json", report, "--now", NOW], dir), "collect");

  const [row] = readOverlay(dir);
  assert.equal(row.windows.d7.basis, "outside-tracking-coverage");
  assert.equal(row.windows.d30.basis, "outside-tracking-coverage");
  assert.equal(row.windows.d30.views, null, "zero rows before the tag is not zero traffic");
});

test("a report with withheld or collapsed rows yields no measurements", (dir) => {
  // GA4 folds rows into "(other)" past a cardinality limit and suppresses rows
  // under thresholding. Per-article totals are then silently incomplete, and an
  // incomplete total is not a measurement.
  writeLedger(dir, [entry("post", "2026-08-01T00:00:00.000+09:00", 1)]);
  const report = writeReport(dir, {
    from: "2026-07-01",
    to: "2026-09-05",
    completeThrough: "2026-09-03",
    rows: [dailyRow("2026-08-02", "post", 200)],
    dataQuality: { dataLossFromOtherRow: true, subjectToThresholding: false },
  });
  const result = ok(run(["--report-json", report, "--now", NOW], dir), "collect");

  const [row] = readOverlay(dir);
  assert.equal(row.windows.d30.basis, "report-data-loss");
  assert.equal(row.windows.d30.views, null);
  assert.match(result.stdout, /withheld\/collapsed rows/);
});

// --------------------------------------------------------------------- funnel

test("the like rate is withheld until enough people actually arrived", (dir) => {
  writeLedger(dir, [
    entry("thin", "2026-08-01T00:00:00.000+09:00", 1),
    entry("solid", "2026-08-01T00:00:00.000+09:00", 3),
  ]);
  const report = writeReport(dir, {
    from: "2026-07-01",
    to: "2026-09-05",
    completeThrough: "2026-09-03",
    rows: [
      dailyRow("2026-08-02", "thin", 3),     // 1 like / 3 views is not a 33% rate
      dailyRow("2026-08-02", "solid", 200),
    ],
  });
  ok(run(["--report-json", report, "--now", NOW], dir), "collect");

  const rows = readOverlay(dir);
  const thin = rows.find((item) => item.slug === "thin");
  assert.equal(thin.observations.d30.likeRate, null);
  assert.match(thin.observations.d30.likeRateBasis, /too-few-views/);

  const solid = rows.find((item) => item.slug === "solid");
  assert.equal(solid.observations.d30.likeRate, 0.015, "3 likes / 200 views");
  assert.equal(solid.observations.d30.likeRateBasis, "measured");
});

test("a like count from a different age than the reach window makes no rate", (dir) => {
  // Regression: the back catalogue's d30 observations are `current-upper-bound`,
  // i.e. TODAY's cumulative likes. Dividing those by the first 30 days of reach
  // inflates the rate without bound. Reach is still reported -- only the rate
  // is withheld -- because "did anyone arrive" is answerable and "what fraction
  // liked it" is not.
  writeLedger(dir, [
    entry("legacy", "2026-08-01T00:00:00.000+09:00", 9, {
      observations: {
        d30: { likes: 9, basis: "current-upper-bound", observedAt: NOW, ageDays: 35 },
      },
    }),
    entry("late", "2026-08-01T00:00:00.000+09:00", 4, {
      observations: {
        d30: { likes: 4, basis: "late-measured", observedAt: NOW, ageDays: 44 },
      },
    }),
  ]);
  const report = writeReport(dir, {
    from: "2026-07-01",
    to: "2026-09-05",
    completeThrough: "2026-09-03",
    rows: [dailyRow("2026-08-02", "legacy", 300), dailyRow("2026-08-02", "late", 300)],
  });
  const result = ok(run(["--report-json", report, "--now", NOW], dir), "collect");

  const rows = readOverlay(dir);
  for (const slug of ["legacy", "late"]) {
    const row = rows.find((item) => item.slug === slug);
    assert.equal(row.windows.d30.basis, "measured", `${slug}: reach is still measured`);
    assert.equal(row.observations.d30.reach.views, 300, `${slug}: reach is still reported`);
    assert.equal(row.observations.d30.likeRate, null, `${slug}: rate must be withheld`);
    assert.match(row.observations.d30.likeRateBasis, /numerator-not-aligned/);
  }
  // The numerator's provenance is recorded so the mismatch is auditable.
  const legacy = rows.find((item) => item.slug === "legacy");
  assert.equal(legacy.observations.d30.numerator.basis, "current-upper-bound");
  assert.equal(legacy.observations.d30.numerator.ageDays, 35);
  assert.deepEqual(legacy.observations.d30.reach.denominatorWindow, {
    from: "2026-08-01", to: "2026-08-30", days: 30,
  });
  assert.match(result.stdout, /D30 like rate .*: 0/);
});

test("summed daily users are labelled user-days, not unique users", (dir) => {
  // GA4 de-duplicates `totalUsers` within a row only, so summing it across days
  // counts a returning visitor once per day.
  writeLedger(dir, [entry("post", "2026-08-01T00:00:00.000+09:00", 1)]);
  const report = writeReport(dir, {
    from: "2026-07-01",
    to: "2026-09-05",
    completeThrough: "2026-09-03",
    rows: [
      dailyRow("2026-08-01", "post", 40, 10, 400),
      dailyRow("2026-08-02", "post", 60, 12, 600),
    ],
  });
  ok(run(["--report-json", report, "--now", NOW], dir), "collect");

  const [row] = readOverlay(dir);
  assert.equal(row.windows.d30.userDays, 22, "10 + 12 user-days");
  assert.equal(row.windows.d30.users, undefined, "must not claim a unique-user count");
  assert.equal(row.windows.d30.engagementSecondsPerView, 10, "1000s over 100 views");
  assert.equal(row.windows.d30.engagementPerUser, undefined, "a per-user average on user-days is biased");
});

test("entry points are attributed per article and labelled as whole-range", (dir) => {
  writeLedger(dir, [entry("post", "2026-08-01T00:00:00.000+09:00", 1)]);
  const report = writeReport(dir, {
    from: "2026-07-01",
    to: "2026-09-05",
    completeThrough: "2026-09-03",
    rows: [dailyRow("2026-08-02", "post", 50)],
    sourceRows: [
      {
        dimensionValues: [{ value: "/clopy/articles/post" }, { value: "google / organic" }],
        metricValues: [{ value: "30" }, { value: "35" }],
      },
      {
        dimensionValues: [{ value: "/clopy/articles/post" }, { value: "zenn.dev / referral" }],
        metricValues: [{ value: "12" }, { value: "15" }],
      },
      {
        dimensionValues: [{ value: "/clopy/articles/post?utm=x" }, { value: "google / organic" }],
        metricValues: [{ value: "2" }, { value: "2" }],
      },
    ],
  });
  ok(run(["--report-json", report, "--now", NOW], dir), "collect");

  const [row] = readOverlay(dir);
  // The query-string variant must fold into the same slug rather than be dropped.
  assert.equal(row.sourceMediumWholeRange["google / organic"], 32);
  assert.equal(row.sourceMediumWholeRange["zenn.dev / referral"], 12);
  // The source report has no date dimension, so it cannot be a D7/D30 figure.
  assert.deepEqual(row.sourceMediumRange, { from: "2026-07-01", to: "2026-09-05" });
  assert.equal(row.sourceMedium, undefined, "the un-windowed name must not survive");
});

test("window boundaries do not move with the runner's timezone", (dir) => {
  // Regression: computing the window end via the local-offset day stamp turned
  // day 6 into 2026-08-06 under TZ=America/New_York, silently shifting every
  // D7/D30 window by a day on any runner behind UTC.
  const report = writeReport(dir, {
    from: "2026-07-01",
    to: "2026-09-05",
    completeThrough: "2026-09-03",
    rows: [
      dailyRow("2026-08-01", "post", 100),  // day 0 -> in d7
      dailyRow("2026-08-07", "post", 10),   // day 6 -> in d7 (the boundary)
      dailyRow("2026-08-08", "post", 5),    // day 7 -> out of d7
    ],
  });

  const seen = new Set();
  for (const timeZone of ["Asia/Tokyo", "UTC", "America/New_York", "Pacific/Kiritimati"]) {
    writeLedger(dir, [entry("post", "2026-08-01T10:00:00.000+09:00", 2)]);
    ok(run(["--report-json", report, "--now", NOW], dir, { TZ: timeZone }), `collect in ${timeZone}`);
    const [row] = readOverlay(dir);
    seen.add(`${row.windows.d7.views}/${row.windows.d30.views}`);
  }
  assert.deepEqual([...seen], ["110/115"], `windows drifted across timezones: ${[...seen].join(", ")}`);
});

// --------------------------------------------------------------- fail closed

test("collect refuses a report with no coverage block", (dir) => {
  writeLedger(dir, [entry("post", "2026-08-01T00:00:00.000+09:00", 1)]);
  const file = "bad.json";
  fs.writeFileSync(path.join(dir, file), JSON.stringify({
    propertyId: "1",
    timeZone: "Asia/Tokyo",
    range: { from: "62daysAgo", to: "today", resolved: { from: "2026-07-05", to: "2026-09-05" } },
    daily: { rows: [] },
  }));
  const result = run(["--report-json", file, "--now", NOW], dir);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /coverage/);
});

test("collect refuses a property whose reporting timezone shifts the day boundary", (dir) => {
  // GA4 buckets `date` in the property's timezone; Zenn stamps publication at
  // +09:00. Any disagreement shifts every window by a day, and this runs
  // unattended, so it must fail rather than warn.
  writeLedger(dir, [entry("post", "2026-08-01T00:00:00.000+09:00", 1)]);
  const report = writeReport(dir, {
    from: "2026-07-01",
    to: "2026-09-05",
    completeThrough: "2026-09-03",
    rows: [],
    timeZone: "America/Los_Angeles",
  });
  const result = run(["--report-json", report, "--now", NOW], dir);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /America\/Los_Angeles/);
  ok(
    run(["--report-json", report, "--now", NOW, "--allow-timezone"], dir),
    "explicit opt-in must still work",
  );
});

// ------------------------------------------------------------------ leak path

test("GA4 traffic never enters the committed ledger", (dir) => {
  // This repository is public. Per-article page views are not, so the overlay is
  // a separate git-ignored file rather than a field on the committed ledger.
  writeLedger(dir, [entry("post", "2026-08-01T00:00:00.000+09:00", 1)]);
  const before = fs.readFileSync(ledgerFile(dir), "utf8");
  const report = writeReport(dir, {
    from: "2026-07-01",
    to: "2026-09-05",
    completeThrough: "2026-09-03",
    rows: [dailyRow("2026-08-02", "post", 1234)],
  });
  const result = ok(run(["--report-json", report, "--now", NOW], dir), "collect");

  assert.equal(fs.readFileSync(ledgerFile(dir), "utf8"), before, "the ledger must be untouched");
  assert.ok(!before.includes("1234"));
  assert.match(result.stdout, /git-ignored/);

  const overlay = fs.readFileSync(overlayFile(dir), "utf8");
  assert.ok(overlay.includes("1234"), "the overlay is where the numbers go");

  // And the path it lands on must be the one .gitignore covers.
  const ignore = fs.readFileSync(path.join(here, "../.gitignore"), "utf8");
  assert.ok(
    ignore.split("\n").some((line) => line.trim() === "analytics/private/"),
    ".gitignore must cover analytics/private/",
  );
});

console.log(`\n${passed} ga4-loop tests passed`);
