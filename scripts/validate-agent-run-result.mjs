#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const [stdoutFile, manifestRelative, markerFile] = process.argv.slice(2);
const fail = (message) => {
  console.error(message);
  process.exit(2);
};

if (!stdoutFile || !manifestRelative || !markerFile) {
  fail("usage: validate-agent-run-result.mjs <stdout-file> <manifest> <marker-file>");
}

const root = process.cwd();
const safeRelative = (value) => typeof value === "string"
  && value !== ""
  && !path.isAbsolute(value)
  && !value.includes("\0")
  && !value.includes("\\")
  && !value.split("/").includes("..");

if (!safeRelative(manifestRelative)
    || !manifestRelative.startsWith("practice/agent/")
    || !manifestRelative.endsWith(".json")) {
  fail("manifest must be a safe practice/agent repository-relative JSON path");
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(path.resolve(root, manifestRelative), "utf8"));
} catch (error) {
  fail(`cannot read experiment manifest: ${error.message}`);
}
if (!/^[a-z0-9][a-z0-9-]{2,63}$/.test(manifest.id || "")) {
  fail("experiment manifest has an invalid id");
}

let raw;
try {
  raw = fs.readFileSync(stdoutFile, "utf8");
} catch (error) {
  fail(`cannot read experiment runner stdout: ${error.message}`);
}
const artifact = raw.endsWith("\n") ? raw.slice(0, -1) : raw;
if (artifact === "" || artifact.includes("\n") || artifact.includes("\r")
    || (raw !== artifact && raw !== `${artifact}\n`)) {
  fail("experiment runner must output exactly one artifact path");
}
if (!safeRelative(artifact)) fail("experiment artifact must be a safe repository-relative path");

const expectedArtifact = new RegExp(
  `^logs/agent/run-${manifest.id}-[0-9]{8}-[0-9]{6}/execution-log\\.md$`,
);
if (!expectedArtifact.test(artifact)) {
  fail("experiment artifact path does not match the manifest run directory");
}

const absolute = path.resolve(root, artifact);
const rootPrefix = `${root}${path.sep}`;
if (!absolute.startsWith(rootPrefix)) fail("experiment artifact escapes the repository");
let artifactStat;
try {
  artifactStat = fs.lstatSync(absolute);
} catch {
  fail("experiment artifact does not exist");
}
if (!artifactStat.isFile() || artifactStat.isSymbolicLink()) {
  fail("experiment artifact must be a regular non-symlink file");
}
let markerStat;
try {
  markerStat = fs.statSync(markerFile);
} catch {
  fail("direct run stage marker does not exist");
}
if (artifactStat.mtimeMs < markerStat.mtimeMs) {
  fail("experiment artifact predates the direct run stage");
}

const content = fs.readFileSync(absolute, "utf8");
const manifestDeclaration = `- Manifest: \`${manifestRelative}\``;
if ((content.split(manifestDeclaration).length - 1) !== 1) {
  fail("execution log does not declare the requested manifest exactly once");
}
if (!content.startsWith("# AI coding-agent practice execution log\n")) {
  fail("experiment artifact is not an execution log");
}

const summaryFile = path.join(path.dirname(absolute), "summary.json");
let summaryStat;
try {
  summaryStat = fs.lstatSync(summaryFile);
} catch {
  fail("experiment summary does not exist");
}
if (!summaryStat.isFile() || summaryStat.isSymbolicLink()) {
  fail("experiment summary must be a regular non-symlink file");
}
if (summaryStat.mtimeMs < markerStat.mtimeMs) fail("experiment summary predates the direct run stage");
let summary;
try {
  summary = JSON.parse(fs.readFileSync(summaryFile, "utf8"));
} catch (error) {
  fail(`experiment summary is invalid JSON: ${error.message}`);
}
if (summary.manifest !== manifestRelative || !Array.isArray(summary.cases)) {
  fail("experiment summary does not match the requested manifest");
}

process.stdout.write(artifact);
