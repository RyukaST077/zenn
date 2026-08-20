#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const [markerFile, manifestPath, rootArgument] = process.argv.slice(2);
if (!markerFile || !manifestPath) {
  console.error("usage: find-agent-run-log.mjs MARKER_FILE MANIFEST_PATH [ROOT]");
  process.exit(2);
}

const root = path.resolve(rootArgument || process.cwd());
const marker = path.resolve(root, markerFile);
let markerTime;
try {
  markerTime = fs.statSync(marker).mtimeMs;
} catch (error) {
  console.error(`cannot read stage marker: ${error.message}`);
  process.exit(2);
}

const logsRoot = path.join(root, "logs", "agent");
const matches = [];
if (fs.existsSync(logsRoot)) {
  for (const entry of fs.readdirSync(logsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith("run-")) continue;
    const candidate = path.join(logsRoot, entry.name, "execution-log.md");
    if (!fs.existsSync(candidate) || fs.statSync(candidate).mtimeMs < markerTime) continue;
    const text = fs.readFileSync(candidate, "utf8");
    if (text.includes(`- Manifest: \`${manifestPath}\``)) {
      matches.push(path.relative(root, candidate));
    }
  }
}

if (matches.length === 0) process.exit(1);
if (matches.length > 1) {
  console.error(`multiple fresh execution logs match ${manifestPath}: ${matches.join(", ")}`);
  process.exit(2);
}
process.stdout.write(matches[0]);
