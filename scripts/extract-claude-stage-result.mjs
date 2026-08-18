#!/usr/bin/env node

import fs from "node:fs";

const [inputFile, outputFile] = process.argv.slice(2);

function fail(message) {
  console.error(message);
  process.exit(2);
}

if (!inputFile || !outputFile) {
  fail("usage: extract-claude-stage-result.mjs INPUT OUTPUT");
}

let envelope;
try {
  envelope = JSON.parse(fs.readFileSync(inputFile, "utf8"));
} catch (error) {
  fail(`invalid Claude JSON output: ${error.message}`);
}

const isStageResult = (value) => value && typeof value === "object" && !Array.isArray(value)
  && ["status", "artifact", "reason", "metadata"].every((key) => key in value);

const parsePossibleJson = (value) => {
  if (isStageResult(value)) return value;
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return isStageResult(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const candidates = [
  envelope,
  envelope?.structured_output,
  envelope?.structuredOutput,
  envelope?.result?.structured_output,
  envelope?.result?.structuredOutput,
  envelope?.result,
].map(parsePossibleJson);

const result = candidates.find(Boolean);
if (!result) fail("Claude output does not contain a structured stage result");

const temporary = `${outputFile}.tmp-${process.pid}`;
fs.writeFileSync(temporary, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
fs.renameSync(temporary, outputFile);
