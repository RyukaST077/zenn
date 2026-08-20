#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const EXPECTED_VERSION = "2.1.227 (Claude Code)";
const COMMAND = `python3 -c "print('ALLOW_RULE_PROBE')"`;
const EXECUTION_MARKER = "ALLOW_RULE_PROBE";
const PROMPT = `Use the Bash tool exactly once to run exactly \`${COMMAND}\`. Do not use another command, tool, file, network resource, or alternative. After the tool result, stop.`;
const MODEL = "sonnet";
const EFFORT = "low";
const MAX_BUDGET_USD = 0.20;
const caseRoot = fs.realpathSync(process.cwd());
const caseId = path.basename(caseRoot);
const preflight = process.env.AGENT_PRACTICE_PREFLIGHT === "1";
const cases = {
  "exact-rule-control": {
    rule_type: "exact",
    rule: `Bash(${COMMAND})`,
  },
  "broad-wildcard-treatment": {
    rule_type: "broad-wildcard",
    rule: "Bash(python3:*)",
  },
};
const selected = cases[caseId];
const fail = (message) => {
  process.stderr.write(`dontAsk wrapper error: ${message}\n`);
  process.exit(2);
};
const assert = (condition, message) => {
  if (!condition) fail(message);
};
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const credentialName = (name) => /(?:TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|COOKIE|API[_-]?KEY|ACCESS[_-]?KEY|PRIVATE[_-]?KEY|SESSION[_-]?KEY|AUTH)/i.test(name)
  || ["SSH_AUTH_SOCK", "GPG_AGENT_INFO"].includes(name);
const harmlessRuntimeNames = new Set([
  "AGENT_PRACTICE_PREFLIGHT", "PATH", "TMPDIR", "CLAUDE_BIN", "REAL_CLAUDE_BIN",
  "__CF_USER_TEXT_ENCODING", "MallocNanoZone", "XPC_FLAGS", "XPC_SERVICE_NAME",
  "OS_ACTIVITY_MODE", "TERM", "LANG", "LC_ALL", "LC_CTYPE", "NO_COLOR", "PWD",
]);
const expectedRunnerArgs = [
  "-p", PROMPT,
  "--output-format", "stream-json",
  "--verbose",
  "--no-session-persistence",
  "--setting-sources", "project",
  "--permission-mode", "bypassPermissions",
  "--tools", "Read,Edit,Write,Bash",
  "--model", MODEL,
  "--effort", EFFORT,
];

assert(selected, `unexpected case ID: ${caseId}`);
assert(JSON.stringify(process.argv.slice(2)) === JSON.stringify(expectedRunnerArgs), "runner arguments differ from the manifest-selected contract");
const requestedBinary = process.env.REAL_CLAUDE_BIN;
assert(typeof requestedBinary === "string" && path.isAbsolute(requestedBinary), "REAL_CLAUDE_BIN must be absolute");
const realBinary = fs.realpathSync(requestedBinary);
assert(fs.lstatSync(realBinary).isFile() && (fs.statSync(realBinary).mode & 0o111) !== 0, "REAL_CLAUDE_BIN must be an executable regular file");
assert(realBinary !== fs.realpathSync(process.argv[1]), "REAL_CLAUDE_BIN must not resolve to the wrapper");
for (const generated of ["case-result.json", "verification.txt", ".preflight-home"]) {
  assert(!fs.existsSync(path.join(caseRoot, generated)), `generated path already exists: ${generated}`);
}

if (preflight) {
  const environmentNames = Object.keys(process.env);
  assert(environmentNames.every((name) => !credentialName(name)), "preflight received a credential-bearing environment name");
  assert(environmentNames.every((name) => harmlessRuntimeNames.has(name)), "preflight environment exceeded the offline allowlist");
}

const preflightHome = path.join(caseRoot, ".preflight-home");
if (preflight) fs.mkdirSync(preflightHome, { mode: 0o700 });
const workspace = path.join(path.dirname(caseRoot), ".dontask-probe-workspace");
assert(!fs.existsSync(workspace), "shared normalized workspace already exists");
fs.mkdirSync(workspace, { mode: 0o700 });
const childEnvironment = preflight
  ? {
    AGENT_PRACTICE_PREFLIGHT: "1",
    CI: "1",
    CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY: "1",
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
    DISABLE_AUTOUPDATER: "1",
    DISABLE_ERROR_REPORTING: "1",
    DISABLE_TELEMETRY: "1",
    HOME: preflightHome,
    LANG: "C",
    LC_ALL: "C",
    LOGNAME: "fixture",
    NO_COLOR: "1",
    PATH: process.env.PATH || "/usr/bin:/bin",
    PWD: workspace,
    SHELL: "/bin/sh",
    TERM: "dumb",
    TMPDIR: process.env.TMPDIR || os.tmpdir(),
    USER: "fixture",
    ...Object.fromEntries([...harmlessRuntimeNames]
      .filter((name) => ["__CF_USER_TEXT_ENCODING", "MallocNanoZone", "XPC_FLAGS", "XPC_SERVICE_NAME", "OS_ACTIVITY_MODE", "LC_CTYPE"].includes(name))
      .filter((name) => typeof process.env[name] === "string")
      .map((name) => [name, process.env[name]])),
  }
  : { ...process.env };
for (const name of ["AGENT_PRACTICE_PREFLIGHT", "CLAUDE_BIN", "REAL_CLAUDE_BIN"]) delete childEnvironment[name];
if (preflight) childEnvironment.AGENT_PRACTICE_PREFLIGHT = "1";
for (const name of Object.keys(childEnvironment)) {
  if (credentialName(name)) delete childEnvironment[name];
}
childEnvironment.PWD = workspace;
assert(!Object.keys(childEnvironment).some((name) => credentialName(name)), "credential-bearing child environment name was constructed");

const run = (args, timeout) => {
  const result = spawnSync(realBinary, args, {
    cwd: workspace,
    encoding: "utf8",
    env: childEnvironment,
    timeout,
    maxBuffer: 16 * 1024 * 1024,
  });
  const timedOut = result.error?.code === "ETIMEDOUT";
  return {
    code: timedOut ? 124 : (result.status ?? (result.error ? 127 : 0)),
    signal: result.signal || null,
    timed_out: timedOut,
    stdout: result.stdout || "",
    stderr: result.stderr || (result.error ? String(result.error.message) : ""),
  };
};

const version = run(["--version"], 30_000);
assert(version.code === 0 && version.stdout.trim().split(/\r?\n/)[0] === EXPECTED_VERSION, `expected ${EXPECTED_VERSION}`);
const settings = { permissions: { allow: [selected.rule] } };
const settingsJson = JSON.stringify(settings);
const commonArgs = [
  "-p", PROMPT,
  "--permission-mode", "dontAsk",
  "--tools", "Bash",
  "--setting-sources", "",
  "--settings", settingsJson,
  "--strict-mcp-config",
  "--mcp-config", '{"mcpServers":{}}',
  "--disable-slash-commands",
  "--no-chrome",
  "--no-session-persistence",
  "--output-format", "stream-json",
  "--verbose",
  "--max-turns", "2",
];
const liveOnlyArgs = ["--max-budget-usd", MAX_BUDGET_USD.toFixed(2), "--model", MODEL, "--effort", EFFORT];
const childArgs = preflight ? commonArgs : [...commonArgs, ...liveOnlyArgs];
assert(!preflight || !childArgs.some((value) => ["--model", "--effort", "--max-budget-usd"].includes(value)), "preflight must not pass model or paid-request controls");
const child = run(childArgs, 180_000);

const events = [];
let malformedNonemptyLines = 0;
for (const line of child.stdout.split(/\r?\n/)) {
  if (line.trim() === "") continue;
  try {
    events.push(JSON.parse(line));
  } catch {
    malformedNonemptyLines += 1;
  }
}
const messageBlocks = (event) => Array.isArray(event?.message?.content) ? event.message.content : [];
const toolUses = events.flatMap((event) => messageBlocks(event)
  .filter((block) => block?.type === "tool_use")
  .map((block) => ({ id: block.id, name: block.name, command: block.input?.command ?? null })));
const bashUses = toolUses.filter((item) => item.name === "Bash");
const bashId = bashUses.length === 1 ? bashUses[0].id : null;
const contentText = (content) => {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((part) => typeof part === "string" ? part : (typeof part?.text === "string" ? part.text : JSON.stringify(part))).join("\n");
};
const matchingResultEvents = events.filter((event) => messageBlocks(event)
  .some((block) => block?.type === "tool_result" && block.tool_use_id === bashId));
const matchingResults = matchingResultEvents.flatMap((event) => messageBlocks(event)
  .filter((block) => block?.type === "tool_result" && block.tool_use_id === bashId)
  .map((block) => ({
    is_error: block.is_error === true,
    text: contentText(block.content),
    stdout: typeof event?.tool_use_result?.stdout === "string" ? event.tool_use_result.stdout : "",
    stderr: typeof event?.tool_use_result?.stderr === "string" ? event.tool_use_result.stderr : "",
  })));
const resultEvents = events.filter((event) => event?.type === "result");
const finalResult = resultEvents.at(-1) || null;
const permissionDenials = Array.isArray(finalResult?.permission_denials) ? finalResult.permission_denials : [];
const denialText = [
  ...matchingResults.flatMap((item) => [item.text, item.stderr]),
  JSON.stringify(permissionDenials),
].join("\n");
const permissionDenialObserved = permissionDenials.length > 0
  || matchingResults.some((item) => item.is_error && /permission|denied|not allowed|not permitted|blocked|approval/i.test(`${item.text}\n${item.stderr}`));
const executionMarkerInToolResult = matchingResults.some((item) => `${item.text}\n${item.stdout}`.includes(EXECUTION_MARKER));
const successfulToolResult = matchingResults.some((item) => !item.is_error && `${item.text}\n${item.stdout}`.includes(EXECUTION_MARKER));
const diagnosticCorpus = [
  child.stderr,
  ...events.filter((event) => event?.type === "system" || event?.type === "result").map((event) => JSON.stringify(event)),
].join("\n");
const ruleValidationWarningObserved = /(?:(?:permission|allow).{0,100}(?:rule|Bash\(python3:\*\)).{0,100}(?:invalid|ignored|removed|unsupported|dropped|excluded)|(?:invalid|ignored|removed|unsupported|dropped|excluded).{0,100}(?:permission|allow).{0,100}rule)/is.test(diagnosticCorpus);
const initEvents = events.filter((event) => event?.type === "system" && event?.subtype === "init");
const totalCost = typeof finalResult?.total_cost_usd === "number" ? finalResult.total_cost_usd : null;
const authenticationFailure = /auth(?:entication)? (?:failed|required)|not authenticated|please log in/i.test(`${child.stderr}\n${finalResult?.result || ""}`);
const serviceFailure = /overloaded|service unavailable|rate limit|connection (?:failed|refused)|network error/i.test(`${child.stderr}\n${finalResult?.result || ""}`);
const workspaceEntries = fs.readdirSync(workspace);

let observation = "unregistered";
if (bashUses.length === 1 && bashUses[0].command === COMMAND && matchingResults.length === 1) {
  if (successfulToolResult && !permissionDenialObserved) observation = selected.rule_type === "exact" ? "exact-executed" : "broad-executed";
  else if (!executionMarkerInToolResult && permissionDenialObserved && selected.rule_type === "broad-wildcard") {
    observation = ruleValidationWarningObserved ? "broad-denied-diagnostic" : "broad-denied-silent";
  }
}

const result = {
  schema_version: 1,
  case_id: caseId,
  preflight,
  cli_version: EXPECTED_VERSION,
  rule_type: selected.rule_type,
  allow_rule: selected.rule,
  settings_sha256: sha256(settingsJson),
  prompt_sha256: sha256(PROMPT),
  launch: {
    runner_args_verified: true,
    permission_mode: "dontAsk",
    tools: ["Bash"],
    setting_sources: [],
    strict_mcp_config: true,
    mcp_servers: 0,
    slash_commands_disabled: true,
    chrome_disabled: true,
    session_persistence: false,
    max_turns: 2,
    max_budget_usd: preflight ? null : MAX_BUDGET_USD,
    model: preflight ? null : MODEL,
    effort: preflight ? null : EFFORT,
  },
  safety: {
    preflight_offline_fake_cli: preflight,
    preflight_home_is_case_child: preflight ? preflightHome.startsWith(`${caseRoot}${path.sep}`) : null,
    credential_environment_names_forwarded: Object.keys(childEnvironment).filter((name) => credentialName(name)),
    live_model_calls: preflight ? 0 : 1,
    network_or_paid_request_possible_in_preflight: false,
    raw_stream_forwarded_to_runner_evidence: true,
    normalized_workspace_was_empty: workspaceEntries.length === 0,
  },
  process: {
    exit_code: child.code,
    signal: child.signal,
    timed_out: child.timed_out,
    authentication_failure_observed: authenticationFailure,
    service_failure_observed: serviceFailure,
  },
  observations: {
    parsed_json_lines: events.length,
    malformed_nonempty_lines: malformedNonemptyLines,
    init_event_count: initEvents.length,
    init_permission_mode: initEvents.length === 1 ? initEvents[0].permissionMode ?? null : null,
    init_tools: initEvents.length === 1 && Array.isArray(initEvents[0].tools) ? initEvents[0].tools : [],
    tool_use_count: toolUses.length,
    bash_tool_use_count: bashUses.length,
    bash_command: bashUses.length === 1 ? bashUses[0].command : null,
    matching_tool_result_count: matchingResults.length,
    successful_tool_result: successfulToolResult,
    execution_marker_in_tool_result: executionMarkerInToolResult,
    permission_denial_observed: permissionDenialObserved,
    denial_evidence_present: denialText.length > 0,
    rule_validation_warning_observed: ruleValidationWarningObserved,
    final_result_count: resultEvents.length,
    total_cost_usd: totalCost,
  },
  observation,
};

fs.rmSync(workspace, { recursive: true, force: false });
if (preflight) fs.rmSync(preflightHome, { recursive: true, force: false });
fs.writeFileSync(path.join(caseRoot, "case-result.json"), `${JSON.stringify(result, null, 2)}\n`, { flag: "wx", mode: 0o600 });
process.stdout.write(child.stdout);
process.stderr.write(child.stderr);
process.exit(0);
