#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";

const result = JSON.parse(fs.readFileSync("probe-result.json", "utf8"));
assert.equal(result.schema_version, 1);
assert.equal(result.codex_version, "codex-cli 0.147.0");
assert.match(result.session_id, /^[0-9a-f]{8}-[0-9a-f-]{27}$/);
assert.ok(result.target_relative_path.startsWith("sessions/"));
assert.deepEqual(result.runner_controls, {
  approval: "never",
  sandbox: "read-only",
  network: false,
  ignore_user_config: true,
  ignore_rules: true,
  model_override: null,
});

for (const invocation of [result.baseline, result.resume]) {
  assert.equal(invocation.code, 0);
  assert.equal(invocation.signal, null);
  assert.equal(invocation.timed_out, false);
  assert.equal(invocation.completed, 1);
  assert.equal(invocation.failed, 0);
  assert.equal(invocation.tool_events, 0);
  assert.deepEqual(invocation.thread_ids, [result.session_id]);
}
assert.ok(result.before.baseline_marker_count >= 1);
assert.equal(result.before.resume_marker_count, 0);
assert.ok(["claim-supported", "not-reproduced"].includes(result.observation));

if (result.observation === "claim-supported") {
  assert.notEqual(result.after.sha256, result.before.sha256);
  assert.ok(result.after.bytes > result.before.bytes);
  assert.ok(result.after.lines >= result.before.lines);
  assert.equal(result.delta.prefix_unchanged, true);
  assert.ok(result.delta.appended_resume_marker_count >= 1);
  assert.ok(result.after.resume_marker_count >= 1);
} else {
  assert.equal(result.after.sha256, result.before.sha256);
  assert.equal(result.after.bytes, result.before.bytes);
  assert.equal(result.after.lines, result.before.lines);
  assert.equal(result.after.resume_marker_count, 0);
  assert.equal(result.delta.bytes, 0);
  assert.equal(result.delta.lines, 0);
  assert.equal(result.delta.appended_resume_marker_count, 0);
}

fs.writeFileSync("verification.txt", "RESUME_PERSISTENCE_BOUNDARY_OBSERVED\n", { flag: "wx", mode: 0o600 });
process.stdout.write(`${result.observation}\n`);
