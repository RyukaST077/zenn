#!/usr/bin/env node

import fs from "node:fs";

const [resultFile, reportFile] = process.argv.slice(2);

function fail(message) {
  console.error(message);
  process.exit(2);
}

if (!resultFile || !reportFile) {
  fail("usage: validate-claude-review-result.mjs RESULT REPORT");
}

let result;
try {
  result = JSON.parse(fs.readFileSync(resultFile, "utf8"));
} catch (error) {
  fail(`invalid review result JSON: ${error.message}`);
}

const verdict = result?.metadata?.verdict;
const labels = { pass: "公開可", fix: "要修正", blocker: "公開不可" };
if (!(verdict in labels)) fail("review result has an invalid verdict");

const report = fs.readFileSync(reportFile, "utf8");
const matches = [...report.matchAll(/^\*\*判定:\s*(公開可|要修正|公開不可)\*\*$/gm)];
if (matches.length !== 1) {
  fail(`review report must contain exactly one canonical verdict line; found ${matches.length}`);
}
if (matches[0][1] !== labels[verdict]) {
  fail(`review result verdict ${verdict} conflicts with report verdict ${matches[0][1]}`);
}
if (verdict === "pass"
    && !/blocker:\s*0\s*件\s*\/\s*warning:\s*0\s*件/.test(report)) {
  fail("passing review must declare blocker and warning counts as zero");
}

process.stdout.write(verdict);
