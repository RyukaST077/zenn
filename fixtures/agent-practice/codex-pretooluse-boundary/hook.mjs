import fs from "node:fs";
import path from "node:path";

let rawInput = "";
for await (const chunk of process.stdin) rawInput += chunk;
const input = JSON.parse(rawInput);

const evidence = {
  hook_event_name: input.hook_event_name ?? null,
  tool_name: input.tool_name ?? null,
  exact_command: input.tool_input?.command === "node write-marker.mjs",
};
fs.appendFileSync("hook-evidence.jsonl", `${JSON.stringify(evidence)}\n`);

const caseId = path.basename(process.cwd());
if (caseId === "generic-stop-fail-open") {
  process.stdout.write(JSON.stringify({
    continue: false,
    stopReason: "fixture block",
  }));
} else if (caseId === "specific-deny-block") {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "fixture block",
    },
  }));
} else {
  throw new Error(`unsupported fixture case: ${caseId}`);
}
