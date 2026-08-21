#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { contractFor, metadataError } from "./agent-stage-result-contract.mjs";

const [resultFile, allowedPrefix, markerFile, stage, reuseAfterFile] = process.argv.slice(2);
const fail = (message, code = 2) => { console.error(message); process.exit(code); };
try { contractFor(stage); }
catch (error) { fail(error.message); }

let result;
try { result = JSON.parse(fs.readFileSync(resultFile, "utf8")); }
catch (error) { fail(`invalid stage result JSON: ${error.message}`); }

const exact = (object, keys) => object && typeof object === "object" && !Array.isArray(object)
  && Object.keys(object).sort().join("|") === [...keys].sort().join("|");
if (!exact(result, ["status", "artifact", "reason", "metadata"])) fail("stage result has invalid top-level fields");
if (!exact(result.metadata, ["verdict", "action", "slug"])) fail("stage result has invalid metadata fields");
if (!["ok", "abort"].includes(result.status)) fail("stage result has invalid status");
if (typeof result.artifact !== "string" || typeof result.reason !== "string") fail("stage result string fields are invalid");
for (const key of ["verdict", "action", "slug"]) {
  if (result.metadata[key] !== null && typeof result.metadata[key] !== "string") fail(`invalid metadata.${key}`);
}

if (result.status === "abort") {
  if (result.artifact !== "" || result.reason === "") fail("aborted stage must have an empty artifact and non-empty reason");
  if (Object.values(result.metadata).some((value) => value !== null)) fail("aborted stage must leave all metadata values null");
  fail(`stage aborted: ${result.reason}`, 4);
}
if (result.reason !== "") fail("successful stage result must have an empty reason");
if (!result.artifact || path.isAbsolute(result.artifact) || result.artifact.includes("\0")
    || result.artifact.split(/[\\/]/).includes("..")) {
  fail("artifact must be a safe repository-relative path");
}
if (!(result.artifact === allowedPrefix || result.artifact.startsWith(`${allowedPrefix}/`))) {
  fail(`artifact is outside allowed path: ${result.artifact}`);
}

const root = process.cwd();
const absolute = path.resolve(root, result.artifact);
const rootPrefix = `${root}${path.sep}`;
if (!absolute.startsWith(rootPrefix) || !fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
  fail("artifact does not exist as a regular file");
}
const artifactMtime = fs.statSync(absolute).mtimeMs;
if (artifactMtime < fs.statSync(markerFile).mtimeMs) {
  if (!reuseAfterFile || !fs.existsSync(reuseAfterFile) || !fs.statSync(reuseAfterFile).isFile()
      || artifactMtime < fs.statSync(reuseAfterFile).mtimeMs) {
    fail("artifact was not created or updated by this stage, and is not reusable after the supplied baseline");
  }
}

const contractError = metadataError(stage, result.metadata, result.artifact);
if (contractError) fail(contractError);

const content = fs.readFileSync(absolute, "utf8");
if (stage === "analyze") {
  if ((content.match(/^verdict: /gm) || []).length !== 1
      || !content.includes(`verdict: ${result.metadata.verdict}`)) {
    fail("analysis artifact and metadata.verdict differ");
  }
  if ((content.match(/^action: /gm) || []).length !== 1
      || !content.includes(`action: ${result.metadata.action}`)) {
    fail("analysis artifact and metadata.action differ");
  }
}
if (stage === "review") {
  if ((content.match(/^verdict: /gm) || []).length !== 1
      || !content.includes(`verdict: ${result.metadata.verdict}`)) {
    fail("review artifact and metadata.verdict differ");
  }
}

process.stdout.write(result.artifact);
