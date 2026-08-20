#!/usr/bin/env node

// Offline fake CLI used only by the runner's preflight. It imports no network
// module and performs no provider, authentication, model, or paid request. It
// rehearses the registered "connected" branch by running the fixture probe
// against the adapter's own loopback listener, so the adapter, the probe, the
// changed-path boundary, and the verifier are all exercised before any
// authenticated case is allowed to start.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const EXPECTED_VERSION = "2.1.236 (Claude Code)";
const COMMAND = "node probe.mjs";
const ALLOW_RULE = `Bash(${COMMAND})`;
const WORKSPACE_NAME = ".loopback-probe-workspace";
const PREFLIGHT_HOME_NAME = ".preflight-home";
const REGISTERED_PROFILES = new Set(["control-nosandbox", "sandbox-deny-empty", "sandbox-allow-loopback"]);
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

// Names are inspected; values of unclassified names are never read or printed.
const credentialName = (name) => /(?:TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|COOKIE|API[_-]?KEY|ACCESS[_-]?KEY|PRIVATE[_-]?KEY|SESSION[_-]?KEY|AUTH)/i.test(name)
  || ["SSH_AUTH_SOCK", "GPG_AGENT_INFO", "GOOGLE_APPLICATION_CREDENTIALS"].includes(name);
const allowedEnvironmentNames = new Set([
  "AGENT_PRACTICE_PREFLIGHT", "CI", "DISABLE_AUTOUPDATER", "DISABLE_ERROR_REPORTING",
  "DISABLE_TELEMETRY", "HOME", "LANG", "LC_ALL", "LC_CTYPE", "LOGNAME", "NO_COLOR",
  "PATH", "PWD", "SHELL", "TERM", "TMPDIR", "USER",
]);
// Harmless variables the platform runtime injects on its own. macOS adds
// __CF_USER_TEXT_ENCODING and MallocNanoZone to spawned processes even when the
// parent passes a minimal environment, so tolerating them is required; they
// carry no credential material.
const harmlessRuntimePattern = /^(?:__CF[A-Za-z_]*|MallocNanoZone|XPC_[A-Z_]+|OS_ACTIVITY_MODE|COMMAND_MODE|SHLVL|_|LC_[A-Z_]+)$/;

const environmentNames = Object.keys(process.env);
const credentialNames = environmentNames.filter((name) => credentialName(name));
assert(credentialNames.length === 0, `credential-bearing environment name is forbidden: ${credentialNames.length} rejected`);
const unclassified = environmentNames
  .filter((name) => !allowedEnvironmentNames.has(name))
  .filter((name) => !harmlessRuntimePattern.test(name));
assert(unclassified.length === 0, `environment exceeded the offline allowlist: ${unclassified.sort().join(", ")}`);

assert(process.env.AGENT_PRACTICE_PREFLIGHT === "1", "preflight flag is required");
assert(typeof process.env.HOME === "string" && path.isAbsolute(process.env.HOME), "absolute disposable HOME is required");
const home = fs.realpathSync(process.env.HOME);
assert(path.basename(home) === PREFLIGHT_HOME_NAME, "preflight HOME is not the fixture-owned directory");
const workspace = fs.realpathSync(process.cwd());
assert(path.basename(workspace) === WORKSPACE_NAME, "preflight did not run in the normalized fixture workspace");
assert(path.dirname(home) === workspace, "preflight HOME is not a child of the normalized workspace");
assert(
  !args.includes("--model") && !args.includes("--effort") && !args.includes("--max-budget-usd"),
  "model, effort, and paid-request controls are forbidden in preflight",
);

if (args.length === 1 && args[0] === "--version") {
  process.stdout.write(`${EXPECTED_VERSION}\n`);
  process.exit(0);
}

for (const required of [
  "-p", "--permission-mode", "--tools", "--setting-sources", "--settings",
  "--strict-mcp-config", "--mcp-config", "--disable-slash-commands", "--no-chrome",
  "--no-session-persistence", "--output-format", "--verbose", "--max-turns",
]) assert(args.includes(required), `missing ${required}`);
assert(valueAfter("--permission-mode") === "dontAsk", "permission mode mismatch");
assert(valueAfter("--tools") === "Bash", "tool surface mismatch");
assert(valueAfter("--setting-sources") === "", "setting sources must be empty");
assert(valueAfter("--mcp-config") === '{"mcpServers":{}}', "MCP config must be empty");
assert(valueAfter("--output-format") === "stream-json", "stream format mismatch");
assert(valueAfter("--max-turns") === "4", "turn cap mismatch");
assert(valueAfter("-p").includes(`\`${COMMAND}\``), "prompt does not pin the registered command");

let settings;
try {
  settings = JSON.parse(valueAfter("--settings"));
} catch (error) {
  fail(`settings are invalid JSON: ${error.message}`);
}
const allow = settings?.permissions?.allow;
assert(Array.isArray(allow) && allow.length === 1 && allow[0] === ALLOW_RULE, "settings must contain exactly the registered allow rule");
const sandbox = settings?.sandbox;
assert(sandbox && typeof sandbox === "object", "settings must contain a sandbox section");
const profile = sandbox.enabled === false
  ? "control-nosandbox"
  : (Array.isArray(sandbox.network?.allowedDomains) && sandbox.network.allowedDomains.length === 0
    ? "sandbox-deny-empty"
    : "sandbox-allow-loopback");
assert(REGISTERED_PROFILES.has(profile), "unregistered sandbox profile");
if (sandbox.enabled === true) {
  assert(sandbox.allowUnsandboxedCommands === false, "the sandbox escape hatch must be closed");
  assert(sandbox.network?.strictAllowlist === true, "strict allowlist must be requested");
  assert(sandbox.filesystem?.disabled === true, "filesystem isolation must be disabled so only the network layer varies");
}

// The rehearsal runs the fixture probe itself. Its only transport is a TCP
// connection to the adapter's own 127.0.0.1 ephemeral listener; the probe
// refuses any non-loopback target, so no external host can be reached.
const probe = spawnSync(process.execPath, ["probe.mjs"], {
  cwd: workspace, encoding: "utf8", timeout: 30_000, env: process.env,
});
assert(probe.status === 0, `fixture probe did not complete: ${(probe.stderr || "").trim()}`);
const probeStdout = probe.stdout || "";

const toolId = "toolu_fixture_loopback_1";
const events = [
  {
    type: "system",
    subtype: "init",
    tools: ["Bash"],
    permissionMode: "dontAsk",
    claude_code_version: EXPECTED_VERSION.split(" ")[0],
    mcp_servers: [],
  },
  {
    type: "assistant",
    message: { role: "assistant", content: [{ type: "tool_use", id: toolId, name: "Bash", input: { command: COMMAND } }] },
    parent_tool_use_id: null,
  },
  {
    type: "user",
    message: { role: "user", content: [{ type: "tool_result", tool_use_id: toolId, content: probeStdout.trimEnd(), is_error: false }] },
    tool_use_result: { stdout: probeStdout, stderr: "", interrupted: false },
  },
  {
    type: "result",
    subtype: "success",
    is_error: false,
    result: `offline rehearsal of ${profile} completed`,
    total_cost_usd: 0,
    permission_denials: [],
  },
];
for (const event of events) process.stdout.write(`${JSON.stringify(event)}\n`);
