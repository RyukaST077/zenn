#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const CASES = {
  "scrub-unset-control": {
    scrub_enabled: false,
    marker: "CONTROL_HOME_STARTUP_PRESERVED",
    bash_profile_state: "absent",
    login_marker_visible: true,
    files: [".profile"],
  },
  "scrub-enabled-treatment": {
    scrub_enabled: true,
    marker: "TREATMENT_EMPTY_BASH_PROFILE_SHADOWED_PROFILE",
    bash_profile_state: "empty",
    login_marker_visible: false,
    files: [".bash_profile", ".profile"],
  },
};
const fail = (message) => {
  process.stderr.write(`verification failed: ${message}\n`);
  process.exit(1);
};
const assert = (condition, message) => {
  if (!condition) fail(message);
};

const caseId = path.basename(fs.realpathSync(process.cwd()));
const expected = CASES[caseId];
assert(expected, `unsupported case: ${caseId}`);

let result;
try {
  result = JSON.parse(fs.readFileSync("case-result.json", "utf8"));
} catch (error) {
  fail(`cannot read case-result.json: ${error.message}`);
}

assert(result.version === 1, "unexpected result version");
assert(result.case_id === caseId, "case ID mismatch");
assert(result.scrub_enabled === expected.scrub_enabled, "scrub treatment mismatch");
assert(result.cli.expected_version === "2.1.227", "CLI version was not pinned");
assert(result.cli.resolved_binary_basename === "2.1.227", "resolved binary version mismatch");
assert(/^[a-f0-9]{64}$/.test(result.cli.resolved_binary_sha256), "CLI digest is missing");

assert(result.safety.fake_home_is_case_child === true, "fake HOME escaped the case root");
assert(result.safety.fake_home_differs_from_host_home === true, "host HOME was targeted");
assert(result.safety.inherited_environment_forwarded === false, "host environment was forwarded");
const expectedRunnerEnvironment = [
  "CLAUDE_BIN",
  "PATH",
  "REAL_CLAUDE_BIN",
  "TMPDIR",
  "__CF_USER_TEXT_ENCODING",
];
if (result.safety.preflight === true) expectedRunnerEnvironment.push("AGENT_PRACTICE_PREFLIGHT");
expectedRunnerEnvironment.sort();
assert(JSON.stringify(result.safety.runner_environment_names) === JSON.stringify(expectedRunnerEnvironment), "runner environment allowlist mismatch");
assert(result.safety.network_enforcement === (result.safety.preflight
  ? "offline fixture preflight CLI"
  : "sandbox-exec deny network*"), "network boundary was not declared");
assert(result.safety.write_enforcement === (result.safety.preflight
  ? "fixture preflight case root"
  : "sandbox-exec deny file-write* except case root and /dev/null"), "write boundary was not declared");
assert(result.safety.credential_service_enforcement === (result.safety.preflight
  ? "not applicable to offline fixture preflight"
  : "sandbox-exec denies securityd and security.agent lookup"), "credential service boundary was not declared");
const allowedEnvironmentNames = [
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_BASE_URL",
  "CI",
  "CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY",
  "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC",
  ...(expected.scrub_enabled ? ["CLAUDE_CODE_SUBPROCESS_ENV_SCRUB"] : []),
  "DISABLE_AUTOUPDATER",
  "DISABLE_ERROR_REPORTING",
  "DISABLE_TELEMETRY",
  "HOME",
  "LANG",
  "LC_ALL",
  "LOGNAME",
  "NO_COLOR",
  "PATH",
  "SHELL",
  "TERM",
  "TMPDIR",
  "USER",
].sort();
assert(JSON.stringify(result.safety.passed_environment_names) === JSON.stringify(allowedEnvironmentNames), "child environment allowlist mismatch");

assert(result.process.timed_out === false, "Claude startup timed out");
assert(result.process.exit_code !== 0, "offline Claude startup unexpectedly succeeded");
assert(result.process.offline_api_failure_observed === true, "unavailable API boundary was not observed");
assert(result.process.sandbox_setup_error_observed === false, "sandbox setup failed");
assert(result.process.login_or_keychain_prompt_observed === false, "login or credential prompt was observed");
assert(result.process.model_response_observed === false, "a model response was observed");

assert(result.before.bash_profile === "absent", ".bash_profile existed at baseline");
assert(result.before.login_marker_visible === true, ".profile marker was not visible at baseline");
assert(result.profile_unchanged === true, ".profile bytes or metadata changed");
assert(result.after.bash_profile.state === expected.bash_profile_state, `unexpected .bash_profile state: ${result.after.bash_profile.state}`);
if (expected.bash_profile_state === "empty") {
  assert(result.after.bash_profile.size === 0, ".bash_profile is not zero bytes");
  assert(result.after.bash_profile.sha256 === "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", "empty .bash_profile digest mismatch");
}
assert(result.after.login_marker_visible === expected.login_marker_visible, "post-run login marker mismatch");
assert(JSON.stringify(result.before.inventory.map((item) => item.path)) === JSON.stringify([".profile"]), "baseline HOME inventory is not minimal");
assert(JSON.stringify(result.after.inventory.map((item) => item.path)) === JSON.stringify(expected.files), "unexpected HOME file change");
assert(result.after.inventory.every((item) => item.type !== "non-regular"), "non-regular HOME entry observed");

fs.writeFileSync("verification.txt", `${expected.marker}\n`, { flag: "wx", mode: 0o600 });
process.stdout.write(`${expected.marker}\n`);
