#!/usr/bin/env node

import fs from "node:fs";

const args = process.argv.slice(2);
if (args[0] === "login" && args[1] === "status") {
  process.stdout.write("fixture preflight authenticated\n");
  process.exit(0);
}
if (args.length === 1 && args[0] === "--version") {
  process.stdout.write("codex-cli 0.147.0\n");
  process.exit(0);
}

const outputIndex = args.indexOf("-o");
if (outputIndex < 0 || outputIndex + 1 >= args.length) {
  process.stderr.write("preflight fake: missing -o\n");
  process.exit(2);
}

const messages = [
  '{"message":"alpha will be read"}',
  '{"message":"beta will be read after alpha"}',
  '{"message":"ALPHA_READY + BETA_READY"}',
];
const events = [
  { type: "item.completed", item: { type: "agent_message", text: messages[0] } },
  {
    type: "item.completed",
    item: {
      type: "command_execution",
      command: "/bin/zsh -lc 'head -n 1 alpha.txt'",
      aggregated_output: "ALPHA_READY\n",
      exit_code: 0,
      status: "completed",
    },
  },
  { type: "item.completed", item: { type: "agent_message", text: messages[1] } },
  {
    type: "item.completed",
    item: {
      type: "command_execution",
      command: "/bin/zsh -lc 'head -n 1 beta.txt'",
      aggregated_output: "BETA_READY\n",
      exit_code: 0,
      status: "completed",
    },
  },
  { type: "item.completed", item: { type: "agent_message", text: messages[2] } },
  { type: "turn.completed", usage: { input_tokens: 0, output_tokens: 0 } },
];

fs.writeFileSync(args[outputIndex + 1], `${messages[2]}\n`);
for (const event of events) process.stdout.write(`${JSON.stringify(event)}\n`);
