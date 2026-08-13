import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const caseId = path.basename(process.cwd());
assert.ok(
  caseId === "generic-stop-fail-open" || caseId === "specific-deny-block",
  `unexpected case directory: ${caseId}`,
);

assert.ok(fs.existsSync("hook-evidence.jsonl"), "hook evidence must exist");
const evidenceLines = fs.readFileSync("hook-evidence.jsonl", "utf8").trim().split("\n");
assert.equal(evidenceLines.length, 1, "the PreToolUse hook must run exactly once");
const evidence = JSON.parse(evidenceLines[0]);
assert.deepEqual(evidence, {
  hook_event_name: "PreToolUse",
  tool_name: "Bash",
  exact_command: true,
});

let verificationMarker;
if (caseId === "generic-stop-fail-open") {
  assert.equal(fs.readFileSync("effect.txt", "utf8"), "TOOL_RAN");
  verificationMarker = "GENERIC_STOP_FAILED_OPEN";
} else {
  assert.equal(fs.existsSync("effect.txt"), false, "denied command must not create effect.txt");
  verificationMarker = "SPECIFIC_DENY_BLOCKED";
}

fs.writeFileSync("verification.txt", verificationMarker);
console.log(`PASS: ${verificationMarker}`);
