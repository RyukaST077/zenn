#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

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
const credentialName = (name) => /(?:TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|API[_-]?KEY|ACCESS[_-]?KEY|PRIVATE[_-]?KEY|SESSION[_-]?KEY|AUTH)/i.test(name)
  || ["SSH_AUTH_SOCK", "GPG_AGENT_INFO"].includes(name);
const allowedEnvironment = new Set([
  "AGENT_PRACTICE_PREFLIGHT", "PATH", "TMPDIR", "HOME", "CODEX_HOME",
  "__CF_USER_TEXT_ENCODING", "XPC_FLAGS", "XPC_SERVICE_NAME", "OS_ACTIVITY_MODE",
  "TERM", "LANG", "LC_ALL", "LC_CTYPE", "NO_COLOR",
]);

assert(process.env.AGENT_PRACTICE_PREFLIGHT === "1", "preflight flag is required");
assert(Object.keys(process.env).every((name) => !credentialName(name)), "credential-bearing environment name is forbidden");
assert(Object.keys(process.env).every((name) => allowedEnvironment.has(name)), "unexpected environment name");
assert(typeof process.env.HOME === "string" && path.isAbsolute(process.env.HOME), "absolute disposable HOME is required");
assert(typeof process.env.CODEX_HOME === "string" && path.isAbsolute(process.env.CODEX_HOME), "absolute fake CODEX_HOME is required");
assert(!args.includes("--model"), "model override is forbidden in preflight");
assert(!args.some((value) => value.startsWith("model_reasoning_effort=")), "effort override is forbidden in preflight");

if (args.length === 1 && args[0] === "--version") {
  process.stdout.write("codex-cli 0.147.0\n");
  process.exit(0);
}

assert(args.filter((value) => value === "exec").length === 1, "only one exec command is supported");
for (const required of ["--ephemeral", "--ignore-user-config", "--ignore-rules", "--skip-git-repo-check", "--json", "--output-schema"]) {
  assert(args.includes(required), `missing ${required}`);
}
assert(valueAfter("-a") === "never", "approval policy never is required");
assert(valueAfter("--sandbox") === "read-only", "read-only sandbox is required");
assert(args.includes("sandbox_workspace_write.network_access=false"), "network false is required");
const output = path.resolve(valueAfter("-o"));
const skill = path.join(process.env.HOME, ".agents", "skills", "ambient-probe", "SKILL.md");
let final;
if (fs.existsSync(skill)) {
  const skillText = fs.readFileSync(skill, "utf8");
  const marker = skillText.match(/AMBIENT_PROBE_[0-9a-f]{48}/)?.[0];
  assert(marker, "treatment skill marker is missing");
  final = { status: "loaded", value: marker };
} else {
  final = { status: "unavailable", value: "" };
}
const text = JSON.stringify(final);
fs.writeFileSync(output, `${text}\n`, { flag: "wx", mode: 0o600 });
process.stdout.write(`${JSON.stringify({ type: "item.completed", item: { type: "agent_message", text } })}\n`);
process.stdout.write(`${JSON.stringify({ type: "turn.completed", usage: { input_tokens: 0, output_tokens: 0 } })}\n`);
