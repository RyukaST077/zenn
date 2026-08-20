#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const result = readJson("probe-result.json");
const schemaText = fs.readFileSync("schema.json", "utf8");

assert.equal(result.schema_version, 1);
assert.equal(result.codex_version, "codex-cli 0.147.0");
assert.equal(result.case_marker, "AMBIENT_USER_SKILL_BOUNDARY_OBSERVED");
assert.match(result.hidden_marker, /^AMBIENT_PROBE_[0-9a-f]{48}$/);
assert.equal(result.hidden_marker_sha256, sha256(result.hidden_marker));
assert.equal(result.schema_sha256, sha256(schemaText));
assert.equal(schemaText.includes(result.hidden_marker), false);
assert.deepEqual(result.runner_controls, {
  approval: "never",
  sandbox: "read-only",
  network: false,
  ignore_user_config: true,
  ignore_rules: true,
  ephemeral: true,
  model_override: null,
  effort_override: null,
  live_model_calls: result.preflight ? 0 : 2,
});

const inspectProbe = (id, expectedSkill) => {
  const probe = result[id];
  assert.equal(probe.id, id);
  assert.equal(probe.skill_present, expectedSkill);
  assert.equal(probe.process.code, 0);
  assert.equal(probe.process.signal, null);
  assert.equal(probe.process.timed_out, false);
  assert.equal(probe.events.completed, 1);
  assert.equal(probe.events.failed, 0);
  assert.equal(probe.events.tool_events, 0);
  assert.deepEqual(probe.workspace_inventory, []);
  assert.deepEqual(probe.home_inventory, expectedSkill ? [".agents/skills/ambient-probe/SKILL.md"] : []);
  assert.equal(probe.skill_sha256 === null, !expectedSkill);
  const events = fs.readFileSync(`${id}-events.jsonl`, "utf8");
  const final = readJson(`${id}-final.json`);
  assert.deepEqual(final, probe.final);
  assert.equal(events.split(/\r?\n/).filter(Boolean).length, probe.events.lines);
  return { probe, events, final };
};

const control = inspectProbe("control", false);
const treatment = inspectProbe("treatment", true);
assert.deepEqual(control.final, { status: "unavailable", value: "" });
assert.equal(control.events.includes(result.hidden_marker), false);
assert.equal(control.probe.marker_occurrences, 0);
assert.ok(["claim-supported", "not-reproduced"].includes(result.observation));

if (result.observation === "claim-supported") {
  assert.deepEqual(treatment.final, { status: "loaded", value: result.hidden_marker });
  assert.ok(treatment.events.includes(result.hidden_marker));
  assert.ok(treatment.probe.marker_occurrences >= 2);
} else {
  assert.deepEqual(treatment.final, { status: "unavailable", value: "" });
  assert.equal(treatment.events.includes(result.hidden_marker), false);
  assert.equal(treatment.probe.marker_occurrences, 0);
}

fs.writeFileSync("verification.txt", "AMBIENT_USER_SKILL_BOUNDARY_OBSERVED\n", { flag: "wx", mode: 0o600 });
process.stdout.write(`${result.observation}\n`);
