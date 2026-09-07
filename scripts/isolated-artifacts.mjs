#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ALLOWED_ROOTS = new Set([
  // `analytics` and `strategy` carry the topic-improvement loop's memory. Without
  // them a contract registered inside an isolated worktree is lost on the way
  // back, and the published article silently degrades to a heuristic label.
  "analytics", "articles", "experiments", "fixtures", "images", "knowledge",
  "logs", "practice", "research", "strategy",
]);
const EXCLUDED_COMPONENTS = new Set(["node_modules", "npm-cache", "work", "workspace"]);
const EXCLUDED_PREFIXES = [
  "logs/agent/launchd/", "logs/launchd/", "logs/daily-status/", "logs/agent/daily-status/",
  "analytics/raw/",
  // GA4-derived per-article traffic. Never synced out of the shared tree, so it
  // cannot ride a worktree branch into a PR on a public repository.
  "analytics/private/",
];
// Derived state owned by the daily improvement loop, which rewrites all three in
// the shared checkout every morning. A pipeline run can outlive that hour -- a
// usage-limit wait alone is five hours -- and exporting a whole file both sides
// edited is a collision, which discards the entire run's artifacts. So these
// never travel worktree -> shared. They must still travel shared -> worktree:
// the committed copies are only as fresh as the last time someone committed
// analytics/, and the search stage reads the observation report. Registrations
// ride back in analytics/contracts/, one immutable file per slug, and
// `collect-zenn-metrics.mjs` rebuilds these three from those files plus the API.
const EXPORT_ONLY_EXCLUDED_PREFIXES = [
  "analytics/article-ledger.jsonl",
  "analytics/market-index.json",
  "analytics/topic-feedback.md",
];

const die = (message) => {
  console.error(`[isolated-artifacts] ERROR: ${message}`);
  process.exit(2);
};

const normalizeRelative = (value) => value.split(path.sep).join("/");
const isAllowed = (relative, direction = "export") => {
  const normalized = normalizeRelative(relative);
  const [root] = normalized.split("/");
  if (!ALLOWED_ROOTS.has(root)) return false;
  if (EXCLUDED_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return false;
  if (direction === "export"
    && EXPORT_ONLY_EXCLUDED_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return false;
  return !normalized.split("/").some((part) => EXCLUDED_COMPONENTS.has(part));
};

const hashFile = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

const inventory = (root, direction = "export", roots = ALLOWED_ROOTS) => {
  const result = {};
  const visit = (absolute, relative) => {
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) die(`symbolic links are not supported: ${normalizeRelative(relative)}`);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(absolute).sort()) {
        const childRelative = relative ? path.join(relative, name) : name;
        if (isAllowed(childRelative, direction) || !childRelative.includes(path.sep)) {
          visit(path.join(absolute, name), childRelative);
        }
      }
      return;
    }
    if (!stat.isFile() || !isAllowed(relative, direction)) return;
    result[normalizeRelative(relative)] = { hash: hashFile(absolute), mode: stat.mode & 0o777 };
  };

  for (const rootName of [...roots].sort()) {
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

const changesSince = (sourceRoot, snapshotFile) => {
  const before = JSON.parse(fs.readFileSync(snapshotFile, "utf8"));
  const after = inventory(sourceRoot);
  const changed = Object.entries(after)
    .filter(([relative, metadata]) => before[relative]?.hash !== metadata.hash);
  return { before, changed };
};

const findCollisions = (destinationRoot, before, changed) => {
  const collisions = [];
  for (const [relative, metadata] of changed) {
    const destinationFile = path.join(destinationRoot, relative);
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
  return collisions;
};

const reportCollisions = (collisions) => {
  for (const relative of collisions) console.error(`[isolated-artifacts] COLLISION: ${relative}`);
};

const [command, ...args] = process.argv.slice(2);
if (command === "snapshot") {
  const [root, output] = args;
  if (!root || !output) die("usage: snapshot <root> <output.json>");
  fs.writeFileSync(output, `${JSON.stringify(inventory(path.resolve(root)), null, 2)}\n`);
} else if (command === "import") {
  const [sourceRoot, destinationRoot] = args;
  if (!sourceRoot || !destinationRoot) die("usage: import <source-root> <destination-root>");
  const files = inventory(path.resolve(sourceRoot), "import");
  for (const [relative, metadata] of Object.entries(files)) {
    copyFile(path.resolve(sourceRoot), path.resolve(destinationRoot), relative, metadata.mode);
  }
  console.error(`[isolated-artifacts] imported ${Object.keys(files).length} artifact files for resume`);
} else if (command === "import-analytics") {
  // The loop's inputs, handed to every run and not just a resumed one. The
  // committed ledger and observation report are only as fresh as the last
  // commit of analytics/, while the shared checkout is refreshed every morning.
  const [sourceRoot, destinationRoot] = args;
  if (!sourceRoot || !destinationRoot) die("usage: import-analytics <source-root> <destination-root>");
  const files = inventory(path.resolve(sourceRoot), "import", new Set(["analytics"]));
  for (const [relative, metadata] of Object.entries(files)) {
    copyFile(path.resolve(sourceRoot), path.resolve(destinationRoot), relative, metadata.mode);
  }
  console.error(`[isolated-artifacts] imported ${Object.keys(files).length} loop input files`);
} else if (command === "check-sync" || command === "sync") {
  const [sourceRoot, destinationRoot, snapshotFile] = args;
  if (!sourceRoot || !destinationRoot || !snapshotFile) {
    die(`usage: ${command} <source-root> <destination-root> <snapshot.json>`);
  }
  const source = path.resolve(sourceRoot);
  const destination = path.resolve(destinationRoot);
  const { before, changed } = changesSince(source, snapshotFile);
  const collisions = findCollisions(destination, before, changed);
  if (collisions.length > 0) {
    reportCollisions(collisions);
    process.exit(3);
  }
  if (command === "check-sync") {
    console.error(`[isolated-artifacts] export precheck passed for ${changed.length} changed artifact files`);
    process.exit(0);
  }
  for (const [relative, metadata] of changed) copyFile(source, destination, relative, metadata.mode);
  console.error(`[isolated-artifacts] exported ${changed.length} changed artifact files`);
} else {
  die("usage: isolated-artifacts.mjs <snapshot|import|check-sync|sync> ...");
}
