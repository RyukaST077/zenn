#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const EXPECTED_VERSION = "2.1.227";
const PROMPT = "Offline startup probe only. Do not use tools, access files, or answer the prompt.";
const CASES = new Map([
  ["scrub-unset-control", false],
  ["scrub-enabled-treatment", true],
]);
const args = process.argv.slice(2);
// Node adds __CF_USER_TEXT_ENCODING on macOS even when spawn receives an exact env object.
const runnerEnvironmentAllowlist = new Set([
  "CLAUDE_BIN",
  "AGENT_PRACTICE_PREFLIGHT",
  "PATH",
  "REAL_CLAUDE_BIN",
  "TMPDIR",
  "__CF_USER_TEXT_ENCODING",
]);
if (Object.keys(process.env).some((name) => !runnerEnvironmentAllowlist.has(name))) {
  process.stderr.write("probe wrapper error: runner environment is not the required empty allowlist\n");
  process.exit(2);
}

if (args.length === 2 && args[0] === "auth" && args[1] === "status") {
  process.stdout.write("fixture offline mode: authentication is intentionally unused\n");
  process.exit(0);
}
if (args.length === 1 && args[0] === "--version") {
  process.stdout.write(`${EXPECTED_VERSION} (Claude Code; fixture-pinned offline wrapper)\n`);
  process.exit(0);
}

const fail = (message) => {
  process.stderr.write(`probe wrapper error: ${message}\n`);
  process.exit(2);
};
const invariant = (condition, message) => {
  if (!condition) fail(message);
};
const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const quoteSandbox = (value) => value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');

const caseRoot = fs.realpathSync(process.cwd());
const caseId = path.basename(caseRoot);
const isPreflight = process.env.AGENT_PRACTICE_PREFLIGHT === "1";
invariant(CASES.has(caseId), `unsupported case directory: ${caseId}`);
invariant(args[0] === "-p" && args[1] === PROMPT, "runner prompt differs from the manifest");
for (const required of ["--output-format", "stream-json", "--no-session-persistence", "--setting-sources", "project"]) {
  invariant(args.includes(required), `runner argument is missing: ${required}`);
}

const requestedBinary = process.env.REAL_CLAUDE_BIN;
invariant(typeof requestedBinary === "string" && path.isAbsolute(requestedBinary), "REAL_CLAUDE_BIN must be absolute");
const realBinary = fs.realpathSync(requestedBinary);
const binaryStat = fs.statSync(realBinary);
invariant(binaryStat.isFile() && (binaryStat.mode & 0o111) !== 0, "REAL_CLAUDE_BIN is not executable");
invariant(path.basename(realBinary) === EXPECTED_VERSION, `Claude binary is not pinned to ${EXPECTED_VERSION}`);
invariant(fs.existsSync("/usr/bin/sandbox-exec"), "macOS sandbox-exec is unavailable");

const runtimeRoot = path.join(caseRoot, ".startup-probe-runtime");
const fakeHome = path.join(runtimeRoot, "home");
const projectDir = path.join(fakeHome, "proj");
const tempDir = path.join(fakeHome, "tmp");
invariant(path.dirname(runtimeRoot) === caseRoot, "runtime root escaped the case directory");
invariant(!fs.existsSync(runtimeRoot), "runtime root already exists");
fs.mkdirSync(projectDir, { recursive: true, mode: 0o700 });
fs.mkdirSync(tempDir, { recursive: true, mode: 0o700 });

const profilePath = path.join(fakeHome, ".profile");
const bashProfilePath = path.join(fakeHome, ".bash_profile");
fs.writeFileSync(profilePath, "export FIXTURE_PROFILE_MARKER=loaded\n", { mode: 0o600 });

const statRecord = (file) => {
  const stat = fs.statSync(file, { bigint: true });
  return {
    size: Number(stat.size),
    mode: Number(stat.mode & 0o777n),
    mtime_ns: stat.mtimeNs.toString(),
    sha256: sha256(file),
  };
};
const inventory = (directory, base = directory) => {
  const entries = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) entries.push(...inventory(absolute, base));
    else if (entry.isFile()) entries.push({ path: path.relative(base, absolute), ...statRecord(absolute) });
    else entries.push({ path: path.relative(base, absolute), type: "non-regular" });
  }
  return entries.sort((left, right) => left.path.localeCompare(right.path));
};
const loginMarkerVisible = () => {
  const result = spawnSync("/usr/bin/env", [
    "-i",
    `HOME=${fakeHome}`,
    "PATH=/usr/bin:/bin",
    "/bin/bash",
    "-lc",
    'test "${FIXTURE_PROFILE_MARKER-}" = loaded',
  ], { cwd: projectDir, encoding: "utf8", timeout: 5_000 });
  return result.status === 0 && !result.error;
};

const before = {
  inventory: inventory(fakeHome),
  profile: statRecord(profilePath),
  bash_profile: fs.existsSync(bashProfilePath) ? "present" : "absent",
  login_marker_visible: loginMarkerVisible(),
};

const sandboxProfile = [
  "(version 1)",
  "(allow default)",
  "(deny network*)",
  "(deny file-write*)",
  `(allow file-write* (subpath "${quoteSandbox(caseRoot)}"))`,
  '(allow file-write* (literal "/dev/null"))',
  '(deny mach-lookup (global-name "com.apple.securityd"))',
  '(deny mach-lookup (global-name "com.apple.security.agent"))',
].join("\n");

const childEnv = {
  ANTHROPIC_API_KEY: "sk-ant-fixture-invalid-not-a-secret",
  ANTHROPIC_BASE_URL: "http://127.0.0.1:9",
  CI: "1",
  CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY: "1",
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
  DISABLE_AUTOUPDATER: "1",
  DISABLE_ERROR_REPORTING: "1",
  DISABLE_TELEMETRY: "1",
  HOME: fakeHome,
  LANG: "C",
  LC_ALL: "C",
  LOGNAME: "fixture",
  NO_COLOR: "1",
  PATH: "/usr/bin:/bin",
  SHELL: "/bin/bash",
  TERM: "dumb",
  TMPDIR: tempDir,
  USER: "fixture",
};
if (CASES.get(caseId)) childEnv.CLAUDE_CODE_SUBPROCESS_ENV_SCRUB = "1";

const started = Date.now();
const inner = spawnSync(isPreflight ? realBinary : "/usr/bin/sandbox-exec", isPreflight ? [
  "--fixture-preflight",
  caseId,
] : [
  "-p", sandboxProfile,
  realBinary,
  "-p", PROMPT,
  "--max-turns", "1",
  "--output-format", "stream-json",
  "--verbose",
  "--no-session-persistence",
  "--setting-sources", "project",
], {
  cwd: projectDir,
  encoding: "utf8",
  env: childEnv,
  timeout: 30_000,
  maxBuffer: 8 * 1024 * 1024,
});

const stdout = inner.stdout || "";
const stderr = inner.stderr || (inner.error ? String(inner.error.message) : "");
const diagnosticText = `${stdout}\n${stderr}`;
let modelResponseObserved = false;
for (const line of stdout.split(/\r?\n/)) {
  try {
    const event = JSON.parse(line);
    if (event.type === "assistant" || (event.type === "result" && event.is_error === false)) {
      modelResponseObserved = true;
    }
  } catch {
    // Non-JSON diagnostics are classified below without being retained.
  }
}

const after = {
  inventory: inventory(fakeHome),
  profile: statRecord(profilePath),
  bash_profile: fs.existsSync(bashProfilePath)
    ? { state: fs.statSync(bashProfilePath).size === 0 ? "empty" : "non-empty", ...statRecord(bashProfilePath) }
    : { state: "absent" },
  login_marker_visible: loginMarkerVisible(),
};
const profileUnchanged = JSON.stringify(before.profile) === JSON.stringify(after.profile);
const hostHome = process.env.HOME ? path.resolve(process.env.HOME) : null;
const result = {
  version: 1,
  case_id: caseId,
  scrub_enabled: CASES.get(caseId),
  cli: {
    expected_version: EXPECTED_VERSION,
    resolved_binary_basename: path.basename(realBinary),
    resolved_binary_sha256: sha256(realBinary),
  },
  safety: {
    fake_home_is_case_child: fakeHome.startsWith(`${caseRoot}${path.sep}`),
    fake_home_differs_from_host_home: hostHome === null || path.resolve(fakeHome) !== hostHome,
    preflight: isPreflight,
    inherited_environment_forwarded: false,
    runner_environment_names: Object.keys(process.env).sort(),
    passed_environment_names: Object.keys(childEnv).sort(),
    network_enforcement: isPreflight ? "offline fixture preflight CLI" : "sandbox-exec deny network*",
    write_enforcement: isPreflight ? "fixture preflight case root" : "sandbox-exec deny file-write* except case root and /dev/null",
    credential_service_enforcement: isPreflight ? "not applicable to offline fixture preflight" : "sandbox-exec denies securityd and security.agent lookup",
  },
  process: {
    exit_code: inner.error?.code === "ETIMEDOUT" ? 124 : (inner.status ?? 127),
    signal: inner.signal || null,
    timed_out: inner.error?.code === "ETIMEDOUT",
    duration_ms: Date.now() - started,
    offline_api_failure_observed: /connect|network|fetch|ECONN|ENET|unable to reach|api error/i.test(diagnosticText),
    sandbox_setup_error_observed: /sandbox-exec:.*(?:invalid|profile|compile)|sandbox compilation failed/i.test(diagnosticText),
    login_or_keychain_prompt_observed: /(?:log in|login required|keychain|open a browser)/i.test(diagnosticText),
    model_response_observed: modelResponseObserved,
  },
  before,
  after,
  profile_unchanged: profileUnchanged,
};

fs.rmSync(runtimeRoot, { recursive: true, force: false });
fs.writeFileSync(path.join(caseRoot, "case-result.json"), `${JSON.stringify(result, null, 2)}\n`, { flag: "wx", mode: 0o600 });
process.stdout.write(`${JSON.stringify({
  type: "result",
  subtype: "success",
  is_error: false,
  result: "offline startup probe evidence recorded",
})}\n`);
