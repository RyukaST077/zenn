#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "../..");
const manifestPath = process.argv[2];
const fail = (message) => {
  console.error(`manifest error: ${message}`);
  process.exit(2);
};
const exactKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).sort().join("|") === [...keys].sort().join("|");
const isSafeRelative = (value) => typeof value === "string" && value.length > 0
  && !path.isAbsolute(value) && !value.includes("\0")
  && !value.split(/[\\/]/).includes("..");
const resolveInside = (relative, prefix) => {
  if (!isSafeRelative(relative)) fail(`unsafe path: ${relative}`);
  const absolute = path.resolve(root, relative);
  const allowed = path.resolve(root, prefix);
  if (absolute !== allowed && !absolute.startsWith(`${allowed}${path.sep}`)) {
    fail(`${relative} is outside ${prefix}`);
  }
  if (!fs.existsSync(absolute)) fail(`path does not exist: ${relative}`);
  return absolute;
};

if (!manifestPath) fail("usage: validate-manifest.mjs <manifest.json>");
let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
} catch (error) {
  fail(`cannot read JSON: ${error.message}`);
}

const topKeys = [
  "version", "id", "topic", "claim", "mode", "source_report", "plan", "fixture",
  "prompt", "timeout_seconds", "network", "cases", "verification",
];
if (!exactKeys(manifest, topKeys)) fail("top-level fields do not match the contract");
if (manifest.version !== 1) fail("version must be 1");
if (!/^[a-z0-9][a-z0-9-]{2,63}$/.test(manifest.id || "")) fail("id must be 3-64 lowercase hyphen characters");
for (const key of ["topic", "claim", "prompt"]) {
  if (typeof manifest[key] !== "string" || manifest[key].trim() === "") fail(`${key} must be a non-empty string`);
}
const modes = new Set(["smoke", "recipe", "ablation", "boundary", "workflow", "failure", "comparison"]);
if (!modes.has(manifest.mode)) fail("unsupported mode");
resolveInside(manifest.source_report, "research/agent");
resolveInside(manifest.plan, "practice/agent");
const fixture = resolveInside(manifest.fixture, "fixtures/agent-practice");
if (!fs.statSync(fixture).isDirectory()) fail("fixture must be a directory");
if (!Number.isInteger(manifest.timeout_seconds) || manifest.timeout_seconds < 10 || manifest.timeout_seconds > 1800) {
  fail("timeout_seconds must be an integer from 10 to 1800");
}
if (typeof manifest.network !== "boolean") fail("network must be boolean");
if (!Array.isArray(manifest.cases) || manifest.cases.length < 1 || manifest.cases.length > 8) {
  fail("cases must contain 1-8 entries");
}

const caseKeys = ["id", "provider", "guidance", "model", "effort", "expected_marker"];
const ids = new Set();
const efforts = new Set(["low", "medium", "high", "xhigh", "max", "ultra"]);
for (const item of manifest.cases) {
  if (!exactKeys(item, caseKeys)) fail("case fields do not match the contract");
  if (!/^[a-z0-9][a-z0-9-]{1,47}$/.test(item.id || "")) fail(`invalid case id: ${item.id}`);
  if (ids.has(item.id)) fail(`duplicate case id: ${item.id}`);
  ids.add(item.id);
  if (!["claude", "codex"].includes(item.provider)) fail(`unsupported provider in ${item.id}`);
  if (item.guidance !== null) {
    resolveInside(item.guidance, "fixtures/agent-practice/guidance");
    const expectedName = item.provider === "claude" ? "CLAUDE.md" : "AGENTS.md";
    if (path.basename(item.guidance) !== expectedName) fail(`${item.id} guidance must end in ${expectedName}`);
  }
  if (item.model !== null && (typeof item.model !== "string" || !/^[A-Za-z0-9._:\[\]-]+$/.test(item.model))) {
    fail(`invalid model in ${item.id}`);
  }
  if (item.effort !== null && !efforts.has(item.effort)) fail(`invalid effort in ${item.id}`);
  if (item.expected_marker !== null && (typeof item.expected_marker !== "string" || item.expected_marker.length > 200)) {
    fail(`invalid expected_marker in ${item.id}`);
  }
}

const verificationKeys = ["command", "marker_file", "protected_paths", "allowed_changes"];
if (!exactKeys(manifest.verification, verificationKeys)) fail("verification fields do not match the contract");
if (!Array.isArray(manifest.verification.command) || manifest.verification.command.length === 0
    || manifest.verification.command.some((part) => typeof part !== "string" || part === "")) {
  fail("verification.command must be a non-empty string array");
}
if (!isSafeRelative(manifest.verification.marker_file)) fail("verification.marker_file must be a safe relative path");
for (const key of ["protected_paths", "allowed_changes"]) {
  const values = manifest.verification[key];
  if (!Array.isArray(values) || values.some((value) => !isSafeRelative(value))) {
    fail(`verification.${key} must be an array of safe relative paths`);
  }
}

process.stdout.write(`${path.relative(root, path.resolve(manifestPath))}\n`);
