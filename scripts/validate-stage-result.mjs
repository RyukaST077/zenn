#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { contractFor, metadataError } from "./stage-result-contract.mjs";

const [resultFile, allowedPrefix, markerFile, stage] = process.argv.slice(2);
const fail = (message, code = 2) => { console.error(message); process.exit(code); };
try { contractFor(stage); }
catch (error) { fail(error.message); }
let result;
try { result = JSON.parse(fs.readFileSync(resultFile, "utf8")); }
catch (error) { fail(`invalid stage result JSON: ${error.message}`); }

const exact = (object, keys) => object && typeof object === "object" && !Array.isArray(object)
  && Object.keys(object).sort().join("|") === [...keys].sort().join("|");
if (!exact(result, ["status", "artifact", "reason", "metadata"])) fail("stage result has invalid top-level fields");
if (!exact(result.metadata, ["verdict", "slug", "pr_metadata"])) fail("stage result has invalid metadata fields");
if (!["ok", "abort"].includes(result.status)) fail("stage result has invalid status");
if (typeof result.artifact !== "string" || typeof result.reason !== "string") fail("stage result string fields are invalid");
if (![null, "pass", "fix", "blocker"].includes(result.metadata.verdict)) fail("invalid verdict");
for (const key of ["slug", "pr_metadata"])
  if (result.metadata[key] !== null && typeof result.metadata[key] !== "string") fail(`invalid metadata.${key}`);
if (result.status === "abort") {
  if (result.artifact !== "" || result.reason === "") fail("aborted stage must have an empty artifact and non-empty reason");
  if (Object.values(result.metadata).some((value) => value !== null)) fail("aborted stage must leave all metadata values null");
  fail(`stage aborted: ${result.reason}`, 4);
}
if (result.reason !== "") fail("successful stage result must have an empty reason");
if (!result.artifact || path.isAbsolute(result.artifact) || result.artifact.includes("..")) fail("artifact must be a safe repository-relative path");
if (!(result.artifact === allowedPrefix || result.artifact.startsWith(`${allowedPrefix}/`))) fail(`artifact is outside allowed path: ${result.artifact}`);

const root = process.cwd();
const absolute = path.resolve(root, result.artifact);
if (!absolute.startsWith(`${root}${path.sep}`) || !fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) fail("artifact does not exist as a regular file");
const marker = fs.statSync(markerFile).mtimeMs;
if (fs.statSync(absolute).mtimeMs < marker) fail("artifact was not created or updated by this stage");

const stageMetadataError = metadataError(stage, result.metadata, result.artifact);
if (stageMetadataError) fail(stageMetadataError);

process.stdout.write(result.artifact);
