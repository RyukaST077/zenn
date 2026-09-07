#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const fail = (message) => {
  console.error(`[agent-generated-paths] ${message}`);
  process.exit(2);
};
const normalize = (value) => value.split(path.sep).join("/");
const hashBuffer = (value) => crypto.createHash("sha256").update(value).digest("hex");
const hashFile = (file) => hashBuffer(fs.readFileSync(file));

const [manifestArgument, snapshotArgument] = process.argv.slice(2);
if (!manifestArgument || !snapshotArgument) {
  fail("usage: validate-agent-generated-paths.mjs <manifest.json> <shared-artifacts.json>");
}

const rootResult = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" });
if (rootResult.status !== 0) fail("current directory is not inside a Git worktree");
const root = fs.realpathSync(rootResult.stdout.trim());

let manifest;
let shared;
try {
  manifest = JSON.parse(fs.readFileSync(path.resolve(manifestArgument), "utf8"));
  shared = JSON.parse(fs.readFileSync(path.resolve(snapshotArgument), "utf8"));
} catch (error) {
  fail(`cannot read input JSON: ${error.message}`);
}
if (!manifest || typeof manifest.id !== "string" || typeof manifest.fixture !== "string") {
  fail("manifest must declare string id and fixture fields");
}
if (!shared || typeof shared !== "object" || Array.isArray(shared)) {
  fail("shared artifact snapshot must be an object");
}

const fixture = normalize(manifest.fixture).replace(/\/$/, "");
if (!fixture.startsWith("fixtures/agent-practice/") || fixture.includes("..")) {
  fail(`unsafe fixture path: ${manifest.fixture}`);
}
const fixtureRoot = path.resolve(root, fixture);
const allowedRoot = path.resolve(root, "fixtures/agent-practice");
if (!fixtureRoot.startsWith(`${allowedRoot}${path.sep}`) || !fs.existsSync(fixtureRoot)) {
  fail(`fixture is missing or outside fixtures/agent-practice: ${fixture}`);
}

const fixturePrefix = `${fixture}/`;
const sharedFixtureFiles = Object.keys(shared).filter((relative) => relative.startsWith(fixturePrefix));
const trackedResult = spawnSync("git", ["ls-files", "--", fixture], { cwd: root, encoding: "utf8" });
if (trackedResult.status !== 0) fail(`could not inspect tracked fixture files: ${fixture}`);
const trackedFiles = trackedResult.stdout.split("\n").filter(Boolean).map(normalize).sort();

const validateGuidancePaths = () => {
  const guidancePaths = [...new Set((Array.isArray(manifest.cases) ? manifest.cases : [])
    .map((item) => item?.guidance)
    .filter((value) => typeof value === "string"))];
  for (const relativeValue of guidancePaths) {
    const relative = normalize(relativeValue);
    const requiredPrefix = `fixtures/agent-practice/guidance/${manifest.id}/`;
    if (!relative.startsWith("fixtures/agent-practice/guidance/") || relative.includes("..")) {
      fail(`unsafe guidance path: ${relative}`);
    }
    const absolute = path.resolve(root, relative);
    if (!fs.existsSync(absolute) || !fs.lstatSync(absolute).isFile() || fs.lstatSync(absolute).isSymbolicLink()) {
      fail(`guidance must be a regular non-symlink file: ${relative}`);
    }
    const guidanceTracked = spawnSync("git", ["ls-files", "--", relative], { cwd: root, encoding: "utf8" });
    if (guidanceTracked.status !== 0) fail(`could not inspect tracked guidance: ${relative}`);
    if (guidanceTracked.stdout.trim() === "") {
      if (shared[relative]) {
        fail(`artifact path collision: ${relative} already exists in the shared checkout; choose guidance under ${requiredPrefix}`);
      }
      if (!relative.startsWith(requiredPrefix)) {
        fail(`new guidance must be namespaced under ${requiredPrefix}`);
      }
      continue;
    }
    const head = spawnSync("git", ["show", `HEAD:${relative}`], { cwd: root, encoding: null });
    if (head.status !== 0 || hashBuffer(head.stdout) !== hashFile(absolute)) {
      fail(`origin-tracked guidance was modified: ${relative}`);
    }
    if (shared[relative] && shared[relative].hash !== hashFile(absolute)) {
      fail(`shared checkout guidance differs from the origin-tracked file: ${relative}`);
    }
  }
};

if (trackedFiles.length === 0) {
  if (sharedFixtureFiles.length > 0) {
    fail(`artifact path collision: ${fixture} already exists in the shared checkout; choose a new manifest id and fixture directory before running an authenticated experiment`);
  }
  const basename = path.posix.basename(fixture);
  if (basename !== manifest.id) {
    fail(`new fixture basename must equal manifest id: expected ${manifest.id}, got ${basename}`);
  }
  if (!/-\d{8}-\d{4}$/.test(manifest.id)) {
    fail("new manifest id and fixture basename must end in -YYYYMMDD-HHMM");
  }
  validateGuidancePaths();
  process.stdout.write(`${fixture}\n`);
  process.exit(0);
}

const currentFiles = [];
const visit = (absolute, relative) => {
  const stat = fs.lstatSync(absolute);
  if (stat.isSymbolicLink()) fail(`tracked fixture contains a symbolic link: ${relative}`);
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(absolute).sort()) {
      visit(path.join(absolute, name), `${relative}/${name}`);
    }
    return;
  }
  if (!stat.isFile()) fail(`tracked fixture contains a non-file entry: ${relative}`);
  currentFiles.push(normalize(relative));
};
visit(fixtureRoot, fixture);
currentFiles.sort();
if (currentFiles.join("\n") !== trackedFiles.join("\n")) {
  fail(`origin-tracked fixture has added or missing files: ${fixture}`);
}
for (const relative of trackedFiles) {
  const head = spawnSync("git", ["show", `HEAD:${relative}`], { cwd: root, encoding: null });
  if (head.status !== 0) fail(`could not read tracked fixture from HEAD: ${relative}`);
  if (hashBuffer(head.stdout) !== hashFile(path.join(root, relative))) {
    fail(`origin-tracked fixture was modified: ${relative}`);
  }
}

if (sharedFixtureFiles.length > 0) {
  if (sharedFixtureFiles.sort().join("\n") !== trackedFiles.join("\n")) {
    fail(`shared checkout fixture differs from the origin-tracked fixture file set: ${fixture}`);
  }
  for (const relative of trackedFiles) {
    if (shared[relative]?.hash !== hashFile(path.join(root, relative))) {
      fail(`shared checkout fixture differs from the origin-tracked fixture: ${relative}`);
    }
  }
}

validateGuidancePaths();
process.stdout.write(`${fixture}\n`);
