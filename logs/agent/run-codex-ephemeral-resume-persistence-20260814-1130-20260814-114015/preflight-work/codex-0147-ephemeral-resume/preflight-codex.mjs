#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const fail = (message) => {
  process.stderr.write(`offline preflight CLI error: ${message}\n`);
  process.exit(2);
};
const assert = (condition, message) => {
  if (!condition) fail(message);
};
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  assert(index >= 0 && index + 1 < args.length, `missing ${flag}`);
  return args[index + 1];
};

assert(process.env.AGENT_PRACTICE_PREFLIGHT === "1", "preflight flag is required");
const allowedEnvironment = new Set(["AGENT_PRACTICE_PREFLIGHT", "CODEX_HOME", "PATH", "TMPDIR"]);
assert(Object.keys(process.env).every((name) => allowedEnvironment.has(name)), "unexpected environment name");
assert(typeof process.env.CODEX_HOME === "string" && path.isAbsolute(process.env.CODEX_HOME), "case-local CODEX_HOME is required");
assert(!args.includes("--model"), "model override is forbidden in preflight");

if (args.length === 1 && args[0] === "--version") {
  process.stdout.write("codex-cli 0.147.0\n");
  process.exit(0);
}

assert(args.includes("exec"), "only exec is supported");
assert(args.includes("--json"), "JSONL mode is required");
assert(args.includes("--sandbox") && valueAfter("--sandbox") === "read-only", "read-only sandbox is required");
assert(args.includes("sandbox_workspace_write.network_access=false"), "network false is required");
assert(valueAfter("-a") === "never", "approval policy never is required");
const output = path.resolve(valueAfter("-o"));
const sessionId = "11111111-2222-4333-8444-555555555555";
const sessions = path.join(process.env.CODEX_HOME, "sessions", "2026", "08", "14");
const rollout = path.join(sessions, `rollout-2026-08-14T00-00-00-${sessionId}.jsonl`);
const resumeIndex = args.indexOf("resume");

if (resumeIndex < 0) {
  assert(!args.includes("--ephemeral"), "baseline must be persisted");
  fs.mkdirSync(sessions, { recursive: true });
  assert(!fs.existsSync(rollout), "fake rollout already exists");
  const prompt = args.at(-1);
  fs.writeFileSync(rollout, `${JSON.stringify({ type: "session_meta", id: sessionId })}\n${JSON.stringify({ type: "user", text: prompt })}\n`, { flag: "wx", mode: 0o600 });
  fs.writeFileSync(output, "BASELINE_RESUME_PERSISTENCE_MARKER_20260814\n", { flag: "wx", mode: 0o600 });
} else {
  assert(args.includes("--ephemeral"), "resume must request ephemeral mode");
  assert(args[resumeIndex + 1] === sessionId, "resume session ID mismatch");
  assert(fs.existsSync(rollout), "fake baseline rollout is missing");
  fs.appendFileSync(rollout, `${JSON.stringify({ type: "user", text: args.at(-1) })}\n`);
  fs.writeFileSync(output, "EPHEMERAL_RESUME_PERSISTENCE_MARKER_20260814\n", { flag: "wx", mode: 0o600 });
}

process.stdout.write(`${JSON.stringify({ type: "thread.started", thread_id: sessionId })}\n`);
process.stdout.write(`${JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: args.at(-1) } })}\n`);
process.stdout.write(`${JSON.stringify({ type: "turn.completed", usage: { input_tokens: 0, output_tokens: 0 } })}\n`);
