#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const EXPECTED_MARKER = "PARENT_CAP_CHILD_USAGE_OBSERVED";
const fail = (message) => {
  process.stderr.write(`verification failed: ${message}\n`);
  process.exit(1);
};
const assert = (condition, message) => {
  if (!condition) fail(message);
};

const caseRoot = fs.realpathSync(process.cwd());
assert(path.basename(caseRoot) === "parent-one-turn-child-one-turn", "unexpected case ID");
let result;
try {
  result = JSON.parse(fs.readFileSync("case-result.json", "utf8"));
} catch (error) {
  fail(`cannot read case-result.json: ${error.message}`);
}

assert(result.version === 1, "unexpected result version");
assert(result.case_id === "parent-one-turn-child-one-turn", "case ID mismatch");
assert(result.cli.expected_version === "2.1.227", "CLI version was not pinned");
assert(result.cli.resolved_binary_basename === (result.preflight ? "offline-preflight-cli" : "2.1.227"), "resolved CLI mismatch");
assert(/^[a-f0-9]{64}$/.test(result.cli.resolved_binary_sha256), "CLI digest is missing");

assert(result.launch.runner_args_verified === true, "runner arguments were not verified");
assert(result.launch.top_level_max_turns === 1, "top-level max turns mismatch");
assert(result.launch.child_max_turns === 1, "child max turns mismatch");
assert(result.launch.max_budget_usd === 0.20, "budget cap mismatch");
assert(JSON.stringify(result.launch.parent_tools) === JSON.stringify(["Agent"]), "parent tool surface mismatch");
assert(Array.isArray(result.launch.child_tools) && result.launch.child_tools.length === 0, "child tool surface is not empty");
assert(result.launch.model === "sonnet" && result.launch.effort === "low", "model settings mismatch");
assert(JSON.stringify(result.launch.setting_sources) === JSON.stringify(["project"]), "setting source mismatch");
assert(result.launch.session_persistence === false, "session persistence was enabled");
assert(result.launch.forward_subagent_text === true, "child events were not forwarded");
assert(result.launch.builtin_agents_disabled === true, "built-in agents were not disabled");

const expectedRunnerEnvironment = [
  "CLAUDE_BIN",
  "PATH",
  "REAL_CLAUDE_BIN",
  "TMPDIR",
];
if (result.preflight) expectedRunnerEnvironment.push("AGENT_PRACTICE_PREFLIGHT");
for (const harmless of ["MallocNanoZone", "__CF_USER_TEXT_ENCODING"]) {
  if (result.safety.runner_environment_names.includes(harmless)) expectedRunnerEnvironment.push(harmless);
}
expectedRunnerEnvironment.sort();
assert(JSON.stringify(result.safety.runner_environment_names) === JSON.stringify(expectedRunnerEnvironment), "runner environment allowlist mismatch");
assert(Array.isArray(result.safety.credential_environment_names) && result.safety.credential_environment_names.length === 0, "credential-bearing child environment name was passed");
assert(result.safety.preflight_home_is_case_child === (result.preflight ? true : null), "preflight HOME boundary mismatch");
assert(result.safety.preflight_uses_offline_fake_cli === result.preflight, "preflight CLI classification mismatch");
assert(result.safety.raw_stdout_retained_in_fixture === false && result.safety.raw_stderr_retained_in_fixture === false, "raw CLI output was retained in the fixture");

assert(result.process.timed_out === false, "CLI timed out");
assert(result.process.exit_code !== 0, "inner Claude run did not return the max-turn error status");
assert(result.process.authentication_failure_observed === false, "authentication failure made the case inconclusive");
assert(result.process.service_failure_observed === false, "service failure made the case inconclusive");
assert(result.observations.malformed_nonempty_lines === 0, "CLI emitted malformed nonempty stream lines");
assert(result.observations.parent_agent_call_count === 1, "expected exactly one parent Agent call");
assert(result.observations.parent_agent_requested_agent === "one-shot-probe", "parent called a different agent");
assert(result.observations.forwarded_child_event_count >= 1, "no forwarded child event matched the Agent call ID");
assert(result.observations.forwarded_child_marker_observed === true, "forwarded child marker was missing");
assert(result.observations.final_result_count === 1, "expected exactly one final result event");
assert(result.observations.final_subtype === "error_max_turns", "final subtype was not error_max_turns");
assert(result.observations.final_is_error === true, "final result was not an error");
assert(result.observations.final_num_turns === 1, "final num_turns did not equal the parent cap");
assert(typeof result.observations.total_cost_usd === "number" && result.observations.total_cost_usd > 0, "total cost was not recorded");
assert(result.observations.total_cost_usd <= result.launch.max_budget_usd, "total cost exceeded the declared cap");
assert(Number.isFinite(result.observations.parent_usage.output_tokens), "parent-only output usage was missing");
assert(result.observations.whole_tree_usage.model_count >= 1, "whole-tree modelUsage was missing");
assert(result.observations.whole_tree_usage.output_tokens > result.observations.parent_usage.output_tokens, "whole-tree output usage did not exceed parent-only output usage");
assert(result.observations.whole_tree_usage.cost_usd > 0, "whole-tree cost was not recorded");

fs.writeFileSync("verification.txt", `${EXPECTED_MARKER}\n`, { flag: "wx", mode: 0o600 });
process.stdout.write(`${EXPECTED_MARKER}\n`);

