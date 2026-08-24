#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ALLOWED_ROOTS = new Set([
  "articles", "fixtures", "images", "knowledge", "logs", "practice", "research",
]);
const EXCLUDED_COMPONENTS = new Set(["node_modules", "npm-cache", "work", "workspace"]);
const EXCLUDED_PREFIXES = ["logs/agent/launchd/", "logs/launchd/", "logs/daily-status/", "logs/agent/daily-status/"];

const die = (message) => {
  console.error(`[isolated-artifacts] ERROR: ${message}`);
  process.exit(2);
};

const normalizeRelative = (value) => value.split(path.sep).join("/");
const isAllowed = (relative) => {
  const normalized = normalizeRelative(relative);
  const [root] = normalized.split("/");
  if (!ALLOWED_ROOTS.has(root)) return false;
  if (EXCLUDED_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return false;
  return !normalized.split("/").some((part) => EXCLUDED_COMPONENTS.has(part));
};

const hashFile = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

const inventory = (root) => {
  const result = {};
  const visit = (absolute, relative) => {
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) die(`symbolic links are not supported: ${normalizeRelative(relative)}`);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(absolute).sort()) {
        const childRelative = relative ? path.join(relative, name) : name;
        if (isAllowed(childRelative) || !childRelative.includes(path.sep)) {
          visit(path.join(absolute, name), childRelative);
        }
      }
      return;
    }
    if (!stat.isFile() || !isAllowed(relative)) return;
    result[normalizeRelative(relative)] = { hash: hashFile(absolute), mode: stat.mode & 0o777 };
  };

  for (const rootName of [...ALLOWED_ROOTS].sort()) {
    const absolute = path.join(root, rootName);
    if (fs.existsSync(absolute)) visit(absolute, rootName);
  }
  return result;
};

const copyFile = (sourceRoot, destinationRoot, relative, mode) => {
  const source = path.join(sourceRoot, relative);
  const destination = path.join(destinationRoot, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  fs.chmodSync(destination, mode);
};

const [command, ...args] = process.argv.slice(2);
if (command === "snapshot") {
  const [root, output] = args;
  if (!root || !output) die("usage: snapshot <root> <output.json>");
  fs.writeFileSync(output, `${JSON.stringify(inventory(path.resolve(root)), null, 2)}\n`);
} else if (command === "import") {
  const [sourceRoot, destinationRoot] = args;
  if (!sourceRoot || !destinationRoot) die("usage: import <source-root> <destination-root>");
  const files = inventory(path.resolve(sourceRoot));
  for (const [relative, metadata] of Object.entries(files)) {
    copyFile(path.resolve(sourceRoot), path.resolve(destinationRoot), relative, metadata.mode);
  }
  console.error(`[isolated-artifacts] imported ${Object.keys(files).length} artifact files for resume`);
} else if (command === "sync") {
  const [sourceRoot, destinationRoot, snapshotFile] = args;
  if (!sourceRoot || !destinationRoot || !snapshotFile) {
    die("usage: sync <source-root> <destination-root> <snapshot.json>");
  }
  const source = path.resolve(sourceRoot);
  const destination = path.resolve(destinationRoot);
  const before = JSON.parse(fs.readFileSync(snapshotFile, "utf8"));
  const after = inventory(source);
  const changed = Object.entries(after).filter(([relative, metadata]) => before[relative]?.hash !== metadata.hash);
  const collisions = [];
  for (const [relative, metadata] of changed) {
    const destinationFile = path.join(destination, relative);
    if (!fs.existsSync(destinationFile) && before[relative]) {
      collisions.push(relative);
    } else if (fs.existsSync(destinationFile)) {
      const stat = fs.lstatSync(destinationFile);
      const destinationHash = stat.isFile() && !stat.isSymbolicLink() ? hashFile(destinationFile) : null;
      const unchangedSinceSnapshot = before[relative]?.hash === destinationHash;
      if (!unchangedSinceSnapshot && destinationHash !== metadata.hash) {
        collisions.push(relative);
      }
    }
  }
  if (collisions.length > 0) {
    for (const relative of collisions) console.error(`[isolated-artifacts] COLLISION: ${relative}`);
    process.exit(3);
  }
  for (const [relative, metadata] of changed) copyFile(source, destination, relative, metadata.mode);
  console.error(`[isolated-artifacts] exported ${changed.length} changed artifact files`);
} else {
  die("usage: isolated-artifacts.mjs <snapshot|import|sync> ...");
}
