#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const COMMAND = `python3 -c "print('ALLOW_RULE_PROBE')"`;
const MARKER = "ALLOW_RULE_PROBE";
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
const credentialName = (name) => /(?:TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|COOKIE|API[_-]?KEY|ACCESS[_-]?KEY|PRIVATE[_-]?KEY|SESSION[_-]?KEY|AUTH)/i.test(name)
  || ["SSH_AUTH_SOCK", "GPG_AGENT_INFO"].includes(name);
const allowedEnvironmentNames = new Set([
  "AGENT_PRACTICE_PREFLIGHT", "CI", "CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY",
  "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC", "DISABLE_AUTOUPDATER",
  "DISABLE_ERROR_REPORTING", "DISABLE_TELEMETRY", "HOME", "LANG", "LC_ALL",
  "LC_CTYPE", "LOGNAME", "NO_COLOR", "PATH", "SHELL", "TERM", "TMPDIR", "USER",
  "PWD",
  "MallocNanoZone", "__CF_USER_TEXT_ENCODING", "XPC_FLAGS", "XPC_SERVICE_NAME",
  "OS_ACTIVITY_MODE",
]);

assert(process.env.AGENT_PRACTICE_PREFLIGHT === "1", "preflight flag is required");
assert(Object.keys(process.env).every((name) => !credentialName(name)), "credential-bearing environment name is forbidden");
assert(Object.keys(process.env).every((name) => allowedEnvironmentNames.has(name)), "environment exceeded the offline allowlist");
assert(typeof process.env.HOME === "string" && path.isAbsolute(process.env.HOME), "absolute disposable HOME is required");
assert(path.basename(fs.realpathSync(process.env.HOME)) === ".preflight-home", "preflight HOME is not the fixture-owned directory");
assert(["exact-rule-control", "broad-wildcard-treatment"].includes(path.basename(path.dirname(fs.realpathSync(process.env.HOME)))), "preflight HOME parent is not a registered case");
assert(!args.includes("--model") && !args.includes("--effort") && !args.includes("--max-budget-usd"), "model, effort, and paid-request controls are forbidden in preflight");

if (args.length === 1 && args[0] === "--version") {
  process.stdout.write("2.1.227 (Claude Code)\n");
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
assert(valueAfter("--output-format") === "stream-json" && args.includes("--verbose"), "stream settings mismatch");
assert(valueAfter("--max-turns") === "2", "turn cap mismatch");
let settings;
try {
  settings = JSON.parse(valueAfter("--settings"));
} catch (error) {
  fail(`settings are invalid JSON: ${error.message}`);
}
const allow = settings?.permissions?.allow;
assert(Array.isArray(allow) && allow.length === 1, "settings must contain one allow rule");
const exactRule = `Bash(${COMMAND})`;
assert([exactRule, "Bash(python3:*)"].includes(allow[0]), "unregistered allow rule");
const exactCase = allow[0] === exactRule;

const toolId = "toolu_fixture_bash_1";
const events = [
  {
    type: "system",
    subtype: "init",
    tools: ["Bash"],
    permissionMode: "dontAsk",
    claude_code_version: "2.1.227",
    mcp_servers: [],
  },
  {
    type: "assistant",
    message: {
      role: "assistant",
      content: [{ type: "tool_use", id: toolId, name: "Bash", input: { command: COMMAND } }],
    },
    parent_tool_use_id: null,
  },
];
if (exactCase) {
  events.push({
    type: "user",
    message: { role: "user", content: [{ type: "tool_result", tool_use_id: toolId, content: MARKER, is_error: false }] },
    tool_use_result: { stdout: MARKER, stderr: "", interrupted: false },
  });
  events.push({ type: "result", subtype: "success", is_error: false, result: "probe completed", total_cost_usd: 0, permission_denials: [] });
} else {
  events.push({
    type: "user",
    message: { role: "user", content: [{ type: "tool_result", tool_use_id: toolId, content: "Permission denied: Bash command is not allowed in dontAsk mode", is_error: true }] },
    tool_use_result: { stdout: "", stderr: "Permission denied", interrupted: false },
  });
  events.push({
    type: "result",
    subtype: "success",
    is_error: false,
    result: "requested command was denied",
    total_cost_usd: 0,
    permission_denials: [{ tool_name: "Bash", tool_use_id: toolId, tool_input: { command: COMMAND } }],
  });
}
for (const event of events) process.stdout.write(`${JSON.stringify(event)}\n`);
