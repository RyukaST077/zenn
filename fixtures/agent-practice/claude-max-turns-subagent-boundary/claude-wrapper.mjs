#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const EXPECTED_VERSION = "2.1.227";
const MODEL = "sonnet";
const EFFORT = "low";
const MARKER = "CHILD_LOOP_COMPLETED";
const MAX_BUDGET_USD = 0.20;
const PROMPT = "Use the Agent tool exactly once. Delegate only to the inline custom agent named `one-shot-probe` and ask it to return exactly `CHILD_LOOP_COMPLETED`. Do not answer directly, use any other agent, use any other tool, access files, or access external data.";
const AGENTS = {
  "one-shot-probe": {
    description: "Return one fixed harmless marker without using tools.",
    prompt: "Return exactly CHILD_LOOP_COMPLETED and nothing else. Do not use tools or access external data.",
    tools: [],
    model: MODEL,
    effort: EFFORT,
    maxTurns: 1,
  },
};

const fail = (message) => {
  process.stderr.write(`claude wrapper error: ${message}\n`);
  process.exit(2);
};
const invariant = (condition, message) => {
  if (!condition) fail(message);
};
const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const credentialName = /(?:TOKEN|SECRET|PASSWORD|PASSWD|API[_-]?KEY|AUTHORIZATION|CREDENTIAL|COOKIE)/i;
const runnerEnvironmentAllowlist = new Set([
  "AGENT_PRACTICE_PREFLIGHT",
  "CLAUDE_BIN",
  "PATH",
  "REAL_CLAUDE_BIN",
  "TMPDIR",
  "MallocNanoZone",
  "__CF_USER_TEXT_ENCODING",
]);
const runnerEnvironmentNames = Object.keys(process.env).sort();
invariant(!runnerEnvironmentNames.some((name) => credentialName.test(name)), "credential-bearing runner environment name was present");
invariant(runnerEnvironmentNames.every((name) => runnerEnvironmentAllowlist.has(name)), "runner environment exceeded the fixture allowlist");

const isPreflight = process.env.AGENT_PRACTICE_PREFLIGHT === "1";
const caseRoot = fs.realpathSync(process.cwd());
const caseId = path.basename(caseRoot);
invariant(caseId === "parent-one-turn-child-one-turn", `unsupported case directory: ${caseId}`);

const runnerArgs = process.argv.slice(2);
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
invariant(JSON.stringify(runnerArgs) === JSON.stringify(expectedRunnerArgs), "runner arguments differ from the manifest contract");

const requestedBinary = process.env.REAL_CLAUDE_BIN;
invariant(typeof requestedBinary === "string" && path.isAbsolute(requestedBinary), "REAL_CLAUDE_BIN must be absolute");
const realBinary = fs.realpathSync(requestedBinary);
const binaryStat = fs.statSync(realBinary);
invariant(binaryStat.isFile() && (binaryStat.mode & 0o111) !== 0, "REAL_CLAUDE_BIN is not executable");
if (!isPreflight) invariant(path.basename(realBinary) === EXPECTED_VERSION, `Claude binary is not pinned to ${EXPECTED_VERSION}`);

const exactArgs = [
  "-p", PROMPT,
  "--max-turns", "1",
  "--max-budget-usd", MAX_BUDGET_USD.toFixed(2),
  "--output-format", "stream-json",
  "--verbose",
  "--forward-subagent-text",
  "--no-session-persistence",
  "--setting-sources", "project",
  "--permission-mode", "bypassPermissions",
  "--tools", "Agent",
  "--model", MODEL,
  "--effort", EFFORT,
  "--agents", JSON.stringify(AGENTS),
];

const preflightHome = path.join(caseRoot, ".preflight-home");
if (isPreflight) {
  invariant(!fs.existsSync(preflightHome), "preflight HOME already exists");
  fs.mkdirSync(preflightHome, { mode: 0o700 });
}
const userInfo = isPreflight ? { username: "fixture" } : os.userInfo();
const childEnv = {
  CI: "1",
  CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS: "1",
  CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY: "1",
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
  DISABLE_AUTOUPDATER: "1",
  DISABLE_ERROR_REPORTING: "1",
  DISABLE_TELEMETRY: "1",
  HOME: isPreflight ? preflightHome : os.homedir(),
  LANG: "C",
  LC_ALL: "C",
  LOGNAME: userInfo.username,
  NO_COLOR: "1",
  PATH: process.env.PATH || "/usr/bin:/bin",
  SHELL: "/bin/zsh",
  TERM: "dumb",
  TMPDIR: process.env.TMPDIR || os.tmpdir(),
  USER: userInfo.username,
};
invariant(!Object.keys(childEnv).some((name) => credentialName.test(name)), "credential-bearing child environment name was constructed");

const started = Date.now();
const inner = spawnSync(realBinary, exactArgs, {
  cwd: caseRoot,
  encoding: "utf8",
  env: childEnv,
  timeout: 180_000,
  maxBuffer: 16 * 1024 * 1024,
});
const timedOut = inner.error?.code === "ETIMEDOUT";
const innerExitCode = timedOut ? 124 : (inner.status ?? (inner.error ? 127 : 0));
const stdout = inner.stdout || "";
const stderr = inner.stderr || (inner.error ? String(inner.error.message) : "");

const parsed = [];
let malformedNonemptyLines = 0;
for (const line of stdout.split(/\r?\n/)) {
  if (line.trim() === "") continue;
  try {
    parsed.push(JSON.parse(line));
  } catch {
    malformedNonemptyLines += 1;
  }
}
const textBlocks = (event) => Array.isArray(event?.message?.content)
  ? event.message.content.filter((part) => part?.type === "text" && typeof part.text === "string").map((part) => part.text)
  : [];
const toolBlocks = (event) => Array.isArray(event?.message?.content)
  ? event.message.content.filter((part) => part?.type === "tool_use")
  : [];
const parentAgentCalls = parsed.flatMap((event) => (
  event?.type === "assistant" && (event.parent_tool_use_id === null || event.parent_tool_use_id === undefined)
    ? toolBlocks(event).filter((part) => part.name === "Agent").map((part) => ({
      id: part.id,
      requested_agent: part.input?.subagent_type ?? part.input?.agent ?? part.input?.name ?? null,
    }))
    : []
));
const parentAgentCallId = parentAgentCalls.length === 1 ? parentAgentCalls[0].id : null;
const forwardedChildEvents = parsed.filter((event) => (
  parentAgentCallId !== null && event?.parent_tool_use_id === parentAgentCallId
));
const forwardedMarkerObserved = forwardedChildEvents.some((event) => textBlocks(event).some((text) => text.includes(MARKER)));
const finalResults = parsed.filter((event) => event?.type === "result");
const finalResult = finalResults.at(-1) || null;
const parentUsage = finalResult?.usage && typeof finalResult.usage === "object" ? finalResult.usage : {};
const modelUsage = finalResult?.modelUsage && typeof finalResult.modelUsage === "object" ? finalResult.modelUsage : {};
const sumModelField = (field) => Object.values(modelUsage).reduce((total, item) => (
  total + (typeof item?.[field] === "number" ? item[field] : 0)
), 0);

const result = {
  version: 1,
  case_id: caseId,
  preflight: isPreflight,
  cli: {
    expected_version: EXPECTED_VERSION,
    resolved_binary_basename: isPreflight ? "offline-preflight-cli" : path.basename(realBinary),
    resolved_binary_sha256: sha256(realBinary),
  },
  launch: {
    runner_args_verified: true,
    top_level_max_turns: 1,
    child_max_turns: AGENTS["one-shot-probe"].maxTurns,
    max_budget_usd: MAX_BUDGET_USD,
    parent_tools: ["Agent"],
    child_tools: AGENTS["one-shot-probe"].tools,
    model: MODEL,
    effort: EFFORT,
    setting_sources: ["project"],
    session_persistence: false,
    forward_subagent_text: true,
    builtin_agents_disabled: childEnv.CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS === "1",
  },
  safety: {
    runner_environment_names: runnerEnvironmentNames,
    child_environment_names: Object.keys(childEnv).sort(),
    credential_environment_names: Object.keys(childEnv).filter((name) => credentialName.test(name)),
    preflight_home_is_case_child: isPreflight ? preflightHome.startsWith(`${caseRoot}${path.sep}`) : null,
    preflight_uses_offline_fake_cli: isPreflight,
    raw_stdout_retained_in_fixture: false,
    raw_stderr_retained_in_fixture: false,
  },
  process: {
    exit_code: innerExitCode,
    signal: inner.signal || null,
    timed_out: timedOut,
    duration_ms: Date.now() - started,
    authentication_failure_observed: /auth(?:entication)? (?:failed|required)|not authenticated|please log in/i.test(stderr),
    service_failure_observed: /overloaded|service unavailable|rate limit|connection (?:failed|refused)|network error/i.test(stderr),
  },
  observations: {
    parsed_json_lines: parsed.length,
    malformed_nonempty_lines: malformedNonemptyLines,
    parent_agent_call_count: parentAgentCalls.length,
    parent_agent_requested_agent: parentAgentCalls.length === 1 ? parentAgentCalls[0].requested_agent : null,
    forwarded_child_event_count: forwardedChildEvents.length,
    forwarded_child_marker_observed: forwardedMarkerObserved,
    final_result_count: finalResults.length,
    final_subtype: finalResult?.subtype ?? null,
    final_is_error: finalResult?.is_error ?? null,
    final_num_turns: finalResult?.num_turns ?? null,
    total_cost_usd: finalResult?.total_cost_usd ?? null,
    parent_usage: {
      input_tokens: parentUsage.input_tokens ?? null,
      output_tokens: parentUsage.output_tokens ?? null,
      cache_read_input_tokens: parentUsage.cache_read_input_tokens ?? null,
      cache_creation_input_tokens: parentUsage.cache_creation_input_tokens ?? null,
    },
    whole_tree_usage: {
      model_count: Object.keys(modelUsage).length,
      input_tokens: sumModelField("inputTokens"),
      output_tokens: sumModelField("outputTokens"),
      cache_read_input_tokens: sumModelField("cacheReadInputTokens"),
      cache_creation_input_tokens: sumModelField("cacheCreationInputTokens"),
      cost_usd: sumModelField("costUSD"),
    },
  },
};

if (isPreflight) fs.rmSync(preflightHome, { recursive: true, force: false });
fs.writeFileSync("case-result.json", `${JSON.stringify(result, null, 2)}\n`, { flag: "wx", mode: 0o600 });
process.stdout.write(`${JSON.stringify({
  type: "result",
  subtype: "success",
  is_error: false,
  result: "max-turns subagent boundary evidence recorded",
})}\n`);

