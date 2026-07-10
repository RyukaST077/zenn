#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const [resultFile, allowedPrefix, markerFile, stage] = process.argv.slice(2);
const fail = (message, code = 2) => { console.error(message); process.exit(code); };
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

if (stage === "review" && !["pass", "fix", "blocker"].includes(result.metadata.verdict)) fail("review result requires a verdict");
if (stage !== "review" && result.metadata.verdict !== null) fail("only review may set metadata.verdict");
if (["search", "plan", "run"].includes(stage) && result.metadata.slug !== null) fail(`${stage} must leave metadata.slug null`);
if (["draft", "review", "revise", "prepare_publish"].includes(stage) && !/^[a-z0-9-]{12,50}$/.test(result.metadata.slug || "")) fail(`${stage} requires a valid slug`);
if (["draft", "revise", "prepare_publish"].includes(stage) && path.basename(result.artifact, ".md") !== result.metadata.slug) fail("artifact filename and metadata.slug differ");
if (stage === "prepare_publish" && typeof result.metadata.pr_metadata !== "string") fail("prepare_publish requires metadata.pr_metadata");
if (stage !== "prepare_publish" && result.metadata.pr_metadata !== null) fail("only prepare_publish may set metadata.pr_metadata");

process.stdout.write(result.artifact);
