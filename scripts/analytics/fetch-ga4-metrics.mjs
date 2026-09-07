#!/usr/bin/env node
//
// Pull per-article page views from the GA4 Data API, then hand the raw report to
// collect-ga4-metrics.mjs.
//
//   node scripts/analytics/fetch-ga4-metrics.mjs [--from YYYY-MM-DD] [--probe]
//
// `--probe` only reports what the credentials can see (properties, the resolved
// property id, retention, and whether any article rows exist) and writes
// nothing. Run it first: it answers how far back a backfill can reach.
//
// Config: config/ga4.json
//   {
//     "keyFile": "~/.config/zenn-ga4/service-account.json",  // OUTSIDE the repo
//     "measurementId": "G-XXXXXXXXXX",                // or "propertyId": "123456789"
//     "pathPrefix": "/clopy/articles/",
//     "trackingStartDate": "2026-07-01",  // when the GA tag actually went live
//     "completeLagDays": 2                // days to treat as still-processing
//   }
//
// `trackingStartDate` and `completeLagDays` exist because the date range this
// script ASKS for is not the range GA4 can actually answer for. A window before
// the tag was installed comes back as zero rows, which is indistinguishable from
// "nobody visited" unless the tracking start is known; and today's numbers are
// still being processed. Both ends are clamped here so the collector never calls
// an unknowable window "measured".
//
// Exit codes: 0 ok / 2 misconfiguration or API failure

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  accessToken,
  accountSummaries,
  dataRetention,
  dataStreams,
  propertyDetails,
  runReport,
} from "./ga4-client.mjs";
import { dayStamp, fail, parseArgs, readJson, writeJson } from "./zenn-metrics-lib.mjs";

const { options } = parseArgs(process.argv.slice(2));
const root = path.resolve(options.root || process.cwd());
const configPath = path.resolve(root, options.config || "config/ga4.json");
const probe = options.probe === true;

if (!fs.existsSync(configPath)) {
  console.error(`ERROR: ${path.relative(root, configPath)} not found.`);
  console.error("Create it from the template in docs/analytics-feedback-loop.md (GA4 の接続) first.");
  process.exit(2);
}
const config = readJson(configPath, "ga4 config");

// `~` is expanded so the key can live outside the repository. A private key
// inside a git tree that other agents also read is one `git add -A` away from
// being published; keeping it in ~/.config removes that failure mode entirely.
const expandHome = (value) => (
  value.startsWith("~/") ? path.join(os.homedir(), value.slice(2)) : value
);
const keyPath = path.resolve(root, expandHome(config.keyFile || "config/ga4-service-account.json"));
if (!fs.existsSync(keyPath)) {
  console.error(`ERROR: service account key not found: ${keyPath}`);
  process.exit(2);
}
// A key readable by group or other is a finding in its own right.
const keyMode = fs.statSync(keyPath).mode & 0o077;
if (keyMode !== 0) {
  console.error(`WARN: ${keyPath} is readable beyond its owner. Run: chmod 600 "${keyPath}"`);
}
if (path.resolve(keyPath).startsWith(`${root}${path.sep}`)) {
  console.error("WARN: the service account key lives inside the repository.");
  console.error("      It is git-ignored, but moving it to ~/.config/zenn-ga4/ is safer.");
}
const key = readJson(keyPath, "service account key");
const pathPrefix = config.pathPrefix || "/articles/";

const main = async () => {
  const token = await accessToken(key);

  // Resolve the numeric property id. The measurement id on the page (G-...) is
  // a data-stream identifier; the Data API addresses properties by number.
  let propertyId = config.propertyId ? String(config.propertyId) : null;
  const summaries = await accountSummaries(token);
  const visible = summaries.flatMap((summary) => (summary.propertySummaries ?? []).map((item) => ({
    account: summary.displayName,
    property: item.displayName,
    // "properties/123456789"
    id: String(item.property ?? "").split("/")[1],
  })));

  if (visible.length === 0) {
    console.error("ERROR: this service account can see no GA4 property.");
    console.error(`Grant ${key.client_email} the Viewer role on the property (GA4 admin > property access management).`);
    process.exit(2);
  }

  if (!propertyId && config.measurementId) {
    for (const candidate of visible) {
      const streams = await dataStreams(token, candidate.id);
      const match = streams.find((stream) => (
        stream.webStreamData?.measurementId === config.measurementId
      ));
      if (match) {
        propertyId = candidate.id;
        break;
      }
    }
    if (!propertyId) {
      console.error(`ERROR: measurementId ${config.measurementId} is not in any property this service account can read.`);
      console.error("Visible properties:");
      visible.forEach((item) => console.error(`  - ${item.account} / ${item.property} (propertyId ${item.id})`));
      process.exit(2);
    }
  }
  if (!propertyId) propertyId = visible[0].id;

  const retention = await dataRetention(token, propertyId);
  const details = await propertyDetails(token, propertyId);
  const timeZone = details.timeZone ?? null;

  console.log(`property: ${propertyId}`);
  console.log(`visible properties: ${visible.map((item) => `${item.property}(${item.id})`).join(", ")}`);
  console.log(`event data retention: ${retention.eventDataRetention ?? retention.error ?? "unknown"}`);
  console.log(`reporting timezone: ${timeZone ?? "unknown"}`);

  // Fail closed rather than warn. GA4 buckets the `date` dimension in the
  // property's reporting timezone while Zenn timestamps publication at +09:00,
  // so any disagreement shifts every D7/D30 window by a day -- and this runs
  // unattended from launchd, where a warning on stdout is a warning nobody
  // reads. `allowTimeZone` is the deliberate opt-out.
  const expectedZone = config.allowTimeZone || "Asia/Tokyo";
  if (timeZone !== expectedZone) {
    console.error(`ERROR: the property reports in ${timeZone ?? "an unknown timezone"}, not ${expectedZone}.`);
    console.error("Zenn publishes at +09:00, so day buckets would be shifted and every D7/D30 window off by a day.");
    console.error(`Either set the property's reporting timezone to Asia/Tokyo, or set "allowTimeZone": "${timeZone}" in config/ga4.json to accept the shift.`);
    process.exit(2);
  }

  // Calendar dates must be produced in the PROPERTY's timezone, not the
  // runner's: a launchd job on a UTC host would otherwise clamp coverage to
  // yesterday's date in the wrong zone.
  const dayInZone = (date) => new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);

  // A day-by-day breakdown is what makes an exact D7/D30 window possible, and
  // lets the whole back catalogue be reconstructed rather than only measured
  // forward from today.
  const from = options.from
    || config.from
    || (retention.eventDataRetention === "FOURTEEN_MONTHS" ? "425daysAgo" : "62daysAgo");
  const to = options.to || "today";

  const request = {
    dateRanges: [{ startDate: from, endDate: to }],
    dimensions: [{ name: "date" }, { name: "pagePath" }],
    metrics: [
      { name: "screenPageViews" },
      { name: "totalUsers" },
      { name: "userEngagementDuration" },
    ],
    dimensionFilter: {
      filter: {
        fieldName: "pagePath",
        stringFilter: { matchType: "BEGINS_WITH", value: pathPrefix, caseSensitive: false },
      },
    },
    keepEmptyRows: false,
  };

  // GA4 does not echo which absolute dates a relative range resolved to, but the
  // collector needs them: without the covered window it cannot tell "0 views"
  // apart from "outside retention, unknown".
  const resolveRelative = (value) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    if (value === "today") return dayInZone(new Date());
    if (value === "yesterday") return dayInZone(new Date(Date.now() - 86400000));
    const days = value.match(/^(\d+)daysAgo$/);
    if (days) return dayInZone(new Date(Date.now() - Number(days[1]) * 86400000));
    return null;
  };

  const daily = await runReport(token, propertyId, request);
  console.log(`daily rows: ${daily.rows.length} (range ${from} .. ${to}, prefix ${pathPrefix})`);
  if (daily.metadata?.dataLossFromOtherRow) {
    console.log("WARN: GA4 collapsed some rows into (other) -- cardinality limit reached");
  }
  if (daily.rows.length === 0) {
    console.log("WARN: no rows. Check pathPrefix against the real page paths, and that the range is inside retention.");
  }

  // Entry points, so "nobody arrived" can be told apart from "arrived from the
  // wrong place", and the demand assumption can be checked against real search
  // traffic rather than inferred from other people's like counts.
  const bySource = await runReport(token, propertyId, {
    dateRanges: [{ startDate: from, endDate: to }],
    dimensions: [{ name: "pagePath" }, { name: "sessionSourceMedium" }],
    metrics: [{ name: "sessions" }, { name: "screenPageViews" }],
    dimensionFilter: request.dimensionFilter,
    keepEmptyRows: false,
  });
  console.log(`source rows: ${bySource.rows.length}`);

  // ------------------------------------------------------------- coverage
  // What GA4 can actually answer for, as opposed to what was asked for.
  const requested = { from: resolveRelative(from), to: resolveRelative(to) };
  const lagDays = Number.isFinite(Number(config.completeLagDays))
    ? Number(config.completeLagDays)
    : 2;
  const completeThrough = dayInZone(new Date(Date.now() - lagDays * 86400000));

  // Tracking start: explicit config wins. Otherwise fall back to the earliest
  // date that has any row at all -- a conservative lower bound, since a window
  // that ends before the tag existed must never be read as "zero views".
  const rowDates = daily.rows
    .map((row) => row.dimensionValues?.[0]?.value)
    .filter((value) => /^\d{8}$/.test(String(value)))
    .map((value) => `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`)
    .sort();
  const earliestRow = rowDates[0] ?? null;
  const trackingStartDate = config.trackingStartDate ?? earliestRow;
  const trackingStartSource = config.trackingStartDate
    ? "config"
    : (earliestRow ? "inferred-from-earliest-row" : "unknown");

  const maxDate = (a, b) => (!a ? b : !b ? a : (a > b ? a : b));
  const minDate = (a, b) => (!a ? b : !b ? a : (a < b ? a : b));

  const dataQuality = {
    dataLossFromOtherRow: Boolean(daily.metadata?.dataLossFromOtherRow)
      || Boolean(bySource.metadata?.dataLossFromOtherRow),
    subjectToThresholding: Boolean(daily.metadata?.subjectToThresholding)
      || Boolean(bySource.metadata?.subjectToThresholding),
  };

  const coverage = {
    from: maxDate(requested.from, trackingStartDate),
    to: minDate(requested.to, completeThrough),
    requested,
    trackingStartDate,
    trackingStartSource,
    completeThrough,
    completeLagDays: lagDays,
  };

  console.log(`coverage: ${coverage.from} .. ${coverage.to}`);
  console.log(`  requested: ${requested.from} .. ${requested.to}`);
  console.log(`  tracking start: ${trackingStartDate ?? "unknown"} (${trackingStartSource})`);
  console.log(`  complete through: ${completeThrough} (lag ${lagDays}d)`);
  if (trackingStartSource !== "config") {
    console.log('  NOTE: set "trackingStartDate" in config/ga4.json to pin this rather than infer it.');
  }
  if (dataQuality.dataLossFromOtherRow || dataQuality.subjectToThresholding) {
    console.log("WARN: GA4 withheld or collapsed rows in this report; the collector will not mark windows as measured.");
  }

  const payload = {
    collectedAt: new Date().toISOString(),
    propertyId,
    measurementId: config.measurementId ?? null,
    pathPrefix,
    // `range.resolved` is kept for compatibility, but it is the REQUESTED range.
    // Correctness depends on `coverage`, which is the intersection of the
    // request with what GA4 can answer.
    range: { from, to, resolved: requested },
    coverage,
    dataQuality,
    retention: retention.eventDataRetention ?? null,
    timeZone,
    daily,
    bySource,
  };

  if (probe) {
    const paths = new Set(daily.rows.map((row) => row.dimensionValues?.[1]?.value));
    console.log(`distinct article paths with data: ${paths.size}`);
    console.log(`earliest date with data: ${earliestRow ?? "none"}`);
    console.log(`latest date with data: ${rowDates[rowDates.length - 1] ?? "none"}`);
    console.log("(probe mode: nothing written)");
    return;
  }

  const out = path.resolve(root, `analytics/raw/ga4/${dayStamp(new Date())}.json`);
  writeJson(out, payload);
  console.log(`wrote ${path.relative(root, out)}`);
  console.log(`next: node scripts/analytics/collect-ga4-metrics.mjs --report-json ${path.relative(root, out)}`);
};

main().catch((error) => fail(error.message));
