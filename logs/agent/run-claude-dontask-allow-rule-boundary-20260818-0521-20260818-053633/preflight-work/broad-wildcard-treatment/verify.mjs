#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const COMMAND = `python3 -c "print('ALLOW_RULE_PROBE')"`;
const cases = {
  "exact-rule-control": {
    rule_type: "exact",
    rule: `Bash(${COMMAND})`,
    observations: ["exact-executed"],
    marker: "EXACT_ALLOW_CONTROL_COMPLETED",
  },
  "broad-wildcard-treatment": {
    rule_type: "broad-wildcard",
    rule: "Bash(python3:*)",
    observations: ["broad-denied-silent", "broad-denied-diagnostic", "broad-executed"],
    marker: "BROAD_ALLOW_BOUNDARY_COMPLETED",
  },
};
const fail = (message) => {
  process.stderr.write(`verification failed: ${message}\n`);
  process.exit(1);
};
const assert = (condition, message) => {
  if (!condition) fail(message);
};
const caseRoot = fs.realpathSync(process.cwd());
const caseId = path.basename(caseRoot);
const expected = cases[caseId];
assert(expected, `unexpected case ID: ${caseId}`);
let result;
try {
  result = JSON.parse(fs.readFileSync("case-result.json", "utf8"));
} catch (error) {
  fail(`cannot read case-result.json: ${error.message}`);
}

assert(result.schema_version === 1 && result.case_id === caseId, "result identity mismatch");
assert(result.cli_version === "2.1.227 (Claude Code)", "Claude version mismatch");
assert(result.rule_type === expected.rule_type && result.allow_rule === expected.rule, "allow rule mismatch");
assert(/^[a-f0-9]{64}$/.test(result.settings_sha256) && /^[a-f0-9]{64}$/.test(result.prompt_sha256), "input digests are missing");
assert(result.launch.runner_args_verified === true, "runner arguments were not verified");
assert(result.launch.permission_mode === "dontAsk", "permission mode mismatch");
assert(JSON.stringify(result.launch.tools) === JSON.stringify(["Bash"]), "tool surface mismatch");
assert(Array.isArray(result.launch.setting_sources) && result.launch.setting_sources.length === 0, "setting sources were not empty");
assert(result.launch.strict_mcp_config === true && result.launch.mcp_servers === 0, "MCP boundary mismatch");
assert(result.launch.slash_commands_disabled === true && result.launch.chrome_disabled === true, "optional integrations were enabled");
assert(result.launch.session_persistence === false && result.launch.max_turns === 2, "session or turn controls mismatch");
assert(result.launch.max_budget_usd === (result.preflight ? null : 0.20), "budget boundary mismatch");
assert(result.launch.model === (result.preflight ? null : "sonnet"), "model boundary mismatch");
assert(result.launch.effort === (result.preflight ? null : "low"), "effort boundary mismatch");

assert(result.safety.preflight_offline_fake_cli === result.preflight, "preflight CLI classification mismatch");
assert(result.safety.preflight_home_is_case_child === (result.preflight ? true : null), "preflight HOME boundary mismatch");
assert(Array.isArray(result.safety.credential_environment_names_forwarded) && result.safety.credential_environment_names_forwarded.length === 0, "credential-bearing environment name was forwarded");
assert(result.safety.live_model_calls === (result.preflight ? 0 : 1), "model-call count mismatch");
assert(result.safety.network_or_paid_request_possible_in_preflight === false, "preflight was not offline");
assert(result.safety.raw_stream_forwarded_to_runner_evidence === true, "raw stream was not forwarded to runner evidence");
assert(result.safety.normalized_workspace_was_empty === true, "fixed Bash task changed the normalized workspace");

assert(result.process.timed_out === false && result.process.signal === null, "Claude process did not complete within the boundary");
assert(result.process.exit_code === 0, "Claude process did not exit cleanly");
assert(result.process.authentication_failure_observed === false, "authentication failure made the case inconclusive");
assert(result.process.service_failure_observed === false, "service failure made the case inconclusive");
assert(result.observations.malformed_nonempty_lines === 0, "stream contained malformed lines");
assert(result.observations.init_event_count === 1, "expected one init event");
assert(result.observations.init_permission_mode === "dontAsk", "init did not report dontAsk");
assert(JSON.stringify(result.observations.init_tools) === JSON.stringify(["Bash"]), "init tool surface mismatch");
assert(result.observations.tool_use_count === 1 && result.observations.bash_tool_use_count === 1, "expected exactly one Bash request and no other tool");
assert(result.observations.bash_command === COMMAND, "Bash command mismatch");
assert(result.observations.matching_tool_result_count === 1, "expected one matched Bash result");
assert(result.observations.final_result_count === 1, "expected one final result");
assert(typeof result.observations.total_cost_usd === "number" && result.observations.total_cost_usd >= 0, "cost evidence is missing");
assert(result.observations.total_cost_usd <= (result.preflight ? 0 : 0.20), "cost exceeded the registered cap");
assert(expected.observations.includes(result.observation), "outcome was not pre-registered");

if (caseId === "exact-rule-control") {
  assert(result.observations.successful_tool_result === true, "exact rule did not produce a successful tool result");
  assert(result.observations.execution_marker_in_tool_result === true, "exact result lacked the execution marker");
  assert(result.observations.permission_denial_observed === false, "exact rule was denied");
  assert(result.observations.rule_validation_warning_observed === false, "exact rule produced a validation warning");
} else if (result.observation === "broad-executed") {
  assert(result.observations.successful_tool_result === true && result.observations.execution_marker_in_tool_result === true, "broad execution was not proven by its tool result");
  assert(result.observations.permission_denial_observed === false, "broad execution also reported denial");
} else {
  assert(result.observations.successful_tool_result === false && result.observations.execution_marker_in_tool_result === false, "denied broad rule contained an execution marker");
  assert(result.observations.permission_denial_observed === true && result.observations.denial_evidence_present === true, "broad denial evidence is missing");
  assert(result.observations.rule_validation_warning_observed === (result.observation === "broad-denied-diagnostic"), "broad diagnostic classification mismatch");
}

fs.writeFileSync("verification.txt", `${expected.marker}\n`, { flag: "wx", mode: 0o600 });
process.stdout.write(`${expected.marker}\n`);
