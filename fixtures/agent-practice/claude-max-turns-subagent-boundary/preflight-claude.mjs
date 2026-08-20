#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const MARKER = "CHILD_LOOP_COMPLETED";
const PROMPT = "Use the Agent tool exactly once. Delegate only to the inline custom agent named `one-shot-probe` and ask it to return exactly `CHILD_LOOP_COMPLETED`. Do not answer directly, use any other agent, use any other tool, access files, or access external data.";
const credentialName = /(?:TOKEN|SECRET|PASSWORD|PASSWD|API[_-]?KEY|AUTHORIZATION|CREDENTIAL|COOKIE)/i;
const allowedEnvironmentNames = new Set([
  "CI",
  "CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS",
  "CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY",
  "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC",
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
  "MallocNanoZone",
  "__CF_USER_TEXT_ENCODING",
]);
const fail = (message) => {
  process.stderr.write(`offline preflight CLI error: ${message}\n`);
  process.exit(2);
};
const environmentNames = Object.keys(process.env);
if (environmentNames.some((name) => credentialName.test(name))) fail("credential-bearing environment name was present");
if (environmentNames.some((name) => !allowedEnvironmentNames.has(name))) fail("environment exceeded the offline allowlist");
if (process.env.CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS !== "1") fail("built-in agents were not disabled");

const args = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};
if (valueAfter("-p") !== PROMPT) fail("prompt mismatch");
if (valueAfter("--max-turns") !== "1") fail("top-level max turns mismatch");
if (valueAfter("--max-budget-usd") !== "0.20") fail("budget mismatch");
if (valueAfter("--output-format") !== "stream-json" || !args.includes("--verbose")) fail("stream settings mismatch");
if (!args.includes("--forward-subagent-text")) fail("subagent forwarding is disabled");
if (valueAfter("--setting-sources") !== "project") fail("setting sources mismatch");
if (valueAfter("--tools") !== "Agent") fail("parent tool surface mismatch");
if (valueAfter("--model") !== "sonnet" || valueAfter("--effort") !== "low") fail("model settings mismatch");
let agents;
try {
  agents = JSON.parse(valueAfter("--agents"));
} catch (error) {
  fail(`invalid inline agent JSON: ${error.message}`);
}
const agent = agents?.["one-shot-probe"];
if (!agent || agent.maxTurns !== 1 || agent.model !== "sonnet" || agent.effort !== "low") fail("inline agent settings mismatch");
if (!Array.isArray(agent.tools) || agent.tools.length !== 0) fail("inline agent unexpectedly has tools");

const caseRoot = fs.realpathSync(process.cwd());
const expectedHome = path.join(caseRoot, ".preflight-home");
if (fs.realpathSync(process.env.HOME) !== fs.realpathSync(expectedHome)) fail("preflight HOME escaped the case root");

const agentCallId = "toolu_fixture_agent_1";
const events = [
  {
    type: "assistant",
    message: {
      role: "assistant",
      content: [{
        type: "tool_use",
        id: agentCallId,
        name: "Agent",
        input: { subagent_type: "one-shot-probe", prompt: `Return exactly ${MARKER}` },
      }],
    },
    parent_tool_use_id: null,
  },
  {
    type: "assistant",
    message: { role: "assistant", content: [{ type: "text", text: MARKER }] },
    parent_tool_use_id: agentCallId,
  },
  {
    type: "result",
    subtype: "error_max_turns",
    is_error: true,
    num_turns: 1,
    total_cost_usd: 0.03,
    usage: {
      input_tokens: 2,
      output_tokens: 20,
      cache_read_input_tokens: 100,
      cache_creation_input_tokens: 50,
    },
    modelUsage: {
      "claude-sonnet-fixture": {
        inputTokens: 4,
        outputTokens: 27,
        cacheReadInputTokens: 200,
        cacheCreationInputTokens: 75,
        costUSD: 0.03,
      },
    },
  },
];
for (const event of events) process.stdout.write(`${JSON.stringify(event)}\n`);
process.exit(1);

