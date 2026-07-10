#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const [metadataPath, pipelineDir] = process.argv.slice(2);
const fail = (message) => { console.error(message); process.exit(2); };
let value;
try { value = JSON.parse(fs.readFileSync(metadataPath, "utf8")); }
catch (error) { fail(`invalid PR metadata: ${error.message}`); }
if (!value || Object.keys(value).sort().join("|") !== "body_file|title") fail("PR metadata must contain only title and body_file");
if (typeof value.title !== "string" || !value.title.trim()) fail("PR title is empty");
if (typeof value.body_file !== "string" || path.isAbsolute(value.body_file) || value.body_file.includes("..")) fail("invalid PR body_file");
const root = process.cwd();
const pipeline = path.resolve(root, pipelineDir);
const body = path.resolve(root, value.body_file);
if (!(body === pipeline || body.startsWith(`${pipeline}${path.sep}`))) fail("PR body_file is outside the pipeline directory");
if (!fs.existsSync(body) || !fs.statSync(body).isFile()) fail("PR body_file does not exist");
process.stdout.write(`${value.title}\n${value.body_file}\n`);
