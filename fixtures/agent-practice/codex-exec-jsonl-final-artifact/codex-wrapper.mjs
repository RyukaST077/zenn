#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const EXPECTED_VERSION = "codex-cli 0.147.0";
const args = process.argv.slice(2);
const fail = (message) => {
  process.stderr.write(`codex wrapper error: ${message}\n`);
  process.exit(2);
};
const assert = (condition, message) => {
  if (!condition) fail(message);
};
const indexWithValue = (values, flag) => {
  const index = values.indexOf(flag);
  assert(index >= 0 && index + 1 < values.length, `missing ${flag}`);
  return index;
};
const run = (binary, values, options = {}) => spawnSync(binary, values, {
  cwd: options.cwd,
  encoding: "utf8",
  env: process.env,
  maxBuffer: 16 * 1024 * 1024,
});

const requestedBinary = process.env.REAL_CODEX_BIN;
assert(typeof requestedBinary === "string" && path.isAbsolute(requestedBinary), "REAL_CODEX_BIN must be an absolute path");
const realBinary = fs.realpathSync(requestedBinary);
assert(fs.statSync(realBinary).isFile(), "REAL_CODEX_BIN must resolve to a file");
assert(realBinary !== fs.realpathSync(process.argv[1]), "REAL_CODEX_BIN must not resolve to this wrapper");

if ((args[0] === "login" && args[1] === "status") || (args.length === 1 && args[0] === "--version")) {
  const delegated = run(realBinary, args, { cwd: process.cwd() });
  process.stdout.write(delegated.stdout || "");
  process.stderr.write(delegated.stderr || "");
  process.exit(delegated.status ?? 127);
}

const version = run(realBinary, ["--version"], { cwd: process.cwd() });
assert(version.status === 0, "real Codex version check failed");
assert((version.stdout || version.stderr).trim().split(/\r?\n/)[0] === EXPECTED_VERSION, `expected ${EXPECTED_VERSION}`);

assert(args.filter((value) => value === "exec").length === 1, "expected exactly one exec subcommand");
assert(args.includes("--ephemeral"), "runner omitted --ephemeral");
assert(args.includes("--ignore-user-config"), "runner omitted --ignore-user-config");
assert(args.includes("--ignore-rules"), "runner omitted --ignore-rules");
assert(args.includes("--skip-git-repo-check"), "runner omitted --skip-git-repo-check");
assert(args.includes("--json"), "runner omitted --json");
assert(args.includes("never") && args.includes("-a"), "runner omitted approval policy never");
assert(args.includes("sandbox_workspace_write.network_access=false"), "runner did not request network false");

const caseIndex = indexWithValue(args, "-C");
const caseRoot = fs.realpathSync(args[caseIndex + 1]);
assert(caseRoot === fs.realpathSync(process.cwd()), "runner case root and working directory differ");
const outputIndex = indexWithValue(args, "-o");
const outputFile = path.resolve(args[outputIndex + 1]);
const sandboxIndex = indexWithValue(args, "--sandbox");
assert(args[sandboxIndex + 1] === "workspace-write", "unexpected runner sandbox mode");

for (const required of ["alpha.txt", "beta.txt", "schema.json", "verify.mjs"]) {
  const absolute = path.join(caseRoot, required);
  assert(fs.existsSync(absolute) && fs.statSync(absolute).isFile(), `missing fixture file: ${required}`);
}
for (const generated of ["agent-events.jsonl", "agent-final.json", "agent-process.json", "verification.txt"]) {
  assert(!fs.existsSync(path.join(caseRoot, generated)), `generated path already exists: ${generated}`);
}

const actualArgs = [...args];
actualArgs[sandboxIndex + 1] = "read-only";
actualArgs.splice(actualArgs.length - 1, 0, "--output-schema", path.join(caseRoot, "schema.json"));
const agent = run(realBinary, actualArgs, { cwd: caseRoot });
const exitCode = agent.status ?? 127;

fs.writeFileSync(path.join(caseRoot, "agent-events.jsonl"), agent.stdout || "", { flag: "wx", mode: 0o600 });
fs.writeFileSync(path.join(caseRoot, "agent-process.json"), `${JSON.stringify({
  exit_code: exitCode,
  signal: agent.signal || null,
  stderr_empty: (agent.stderr || "").length === 0,
})}\n`, { flag: "wx", mode: 0o600 });
if (fs.existsSync(outputFile) && fs.statSync(outputFile).isFile()) {
  fs.copyFileSync(outputFile, path.join(caseRoot, "agent-final.json"), fs.constants.COPYFILE_EXCL);
}

process.stdout.write(agent.stdout || "");
process.stderr.write(agent.stderr || "");
process.exit(exitCode);
