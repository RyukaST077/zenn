#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { redactJsonLines, redactText } from "./redact.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "../..");
const input = process.argv[2];
const fail = (message) => { console.error(message); process.exit(2); };
if (!input || path.isAbsolute(input) || input.includes("\0") || input.split(/[\\/]/).includes("..")) {
  fail("usage: redact-evidence.mjs logs/agent/run-...");
}
if (!/^logs\/agent\/run-[a-z0-9-]+$/.test(input)) fail("run path is outside the supported prefix");
const runDir = path.resolve(root, input);
if (!runDir.startsWith(`${path.join(root, "logs/agent")}${path.sep}`)
    || !fs.existsSync(runDir) || !fs.statSync(runDir).isDirectory()) {
  fail("run directory does not exist");
}

const tempWorkspace = /\/(?:private\/)?var\/folders\/[^/\s"'`]+\/[^/\s"'`]+\/T\/zenn-agent-[^/\s"'`]+/g;
const textNames = new Set([
  "events.jsonl", "stderr.log", "result.txt", "verify.log", "diff.patch", "command.json", "metrics.json",
]);
const updated = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute);
    else if (entry.isFile() && textNames.has(entry.name)) {
      const before = fs.readFileSync(absolute, "utf8");
      const redacted = entry.name === "events.jsonl" ? redactJsonLines(before) : redactText(before);
      const after = redacted.replace(tempWorkspace, "$RUN_WORKSPACE");
      if (after !== before) {
        fs.writeFileSync(absolute, after);
        updated.push(path.relative(root, absolute));
      }
    }
  }
}

walk(runDir);
process.stdout.write(`${updated.join("\n")}${updated.length ? "\n" : ""}`);
