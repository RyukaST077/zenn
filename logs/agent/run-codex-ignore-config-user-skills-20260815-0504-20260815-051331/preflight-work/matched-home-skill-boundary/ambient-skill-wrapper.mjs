#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const EXPECTED_VERSION = "codex-cli 0.147.0";
const EXPECTED_PROMPT = "Explicitly use $ambient-probe and follow it. Use no tools, commands, web search, MCP, hooks, plugins, or file operations. Return exactly one JSON object. If the named skill is available, return status `loaded` and the value it instructs; otherwise return status `unavailable` and an empty value.";
const CASE_MARKER = "AMBIENT_USER_SKILL_BOUNDARY_OBSERVED";
const args = process.argv.slice(2);
const caseRoot = fs.realpathSync(process.cwd());
const preflight = process.env.AGENT_PRACTICE_PREFLIGHT === "1";
const runtimeRoot = path.join(caseRoot, ".ambient-skill-runtime");
const schemaPath = path.join(caseRoot, "schema.json");
const fail = (message) => {
  process.stderr.write(`ambient skill wrapper error: ${message}\n`);
  process.exit(2);
};
const assert = (condition, message) => {
  if (!condition) fail(message);
};
const valueAfter = (values, flag) => {
  const index = values.indexOf(flag);
  assert(index >= 0 && index + 1 < values.length, `missing ${flag}`);
  return values[index + 1];
};
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const inventory = (directory, base = directory) => {
  if (!fs.existsSync(directory)) return [];
  const found = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const stat = fs.lstatSync(absolute);
    assert(!stat.isSymbolicLink(), `symlink is forbidden: ${path.relative(base, absolute)}`);
    if (stat.isDirectory()) found.push(...inventory(absolute, base));
    else if (stat.isFile()) found.push(path.relative(base, absolute));
    else fail(`non-regular fixture path: ${path.relative(base, absolute)}`);
  }
  return found.sort();
};
const run = (binary, values, options) => {
  const result = spawnSync(binary, values, {
    cwd: options.cwd,
    encoding: "utf8",
    env: options.env,
    timeout: options.timeout,
    maxBuffer: 16 * 1024 * 1024,
  });
  return {
    code: result.error?.code === "ETIMEDOUT" ? 124 : (result.status ?? 127),
    signal: result.signal || null,
    timed_out: result.error?.code === "ETIMEDOUT",
    stdout: result.stdout || "",
    stderr_bytes: Buffer.byteLength(result.stderr || ""),
  };
};
const parseEvents = (text) => {
  const events = text.split(/\r?\n/).filter(Boolean).map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      fail(`invalid child JSONL line ${index + 1}: ${error.message}`);
    }
  });
  const toolTypes = new Set(["command_execution", "file_change", "mcp_tool_call", "web_search"]);
  return {
    lines: events.length,
    completed: events.filter((event) => event.type === "turn.completed").length,
    failed: events.filter((event) => event.type === "turn.failed" || event.type === "error").length,
    tool_events: events.filter((event) => toolTypes.has(event.item?.type)).length,
  };
};
const parseFinal = (file) => {
  assert(fs.existsSync(file) && fs.lstatSync(file).isFile(), "child final output is missing");
  let value;
  try {
    value = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(`child final output is invalid JSON: ${error.message}`);
  }
  assert(value && typeof value === "object" && !Array.isArray(value), "child final output must be an object");
  assert(Object.keys(value).sort().join("|") === "status|value", "child final output fields differ from the schema");
  assert(["loaded", "unavailable"].includes(value.status) && typeof value.value === "string", "child final output values differ from the schema");
  return value;
};
const credentialName = (name) => /(?:TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|API[_-]?KEY|ACCESS[_-]?KEY|PRIVATE[_-]?KEY|SESSION[_-]?KEY|AUTH)/i.test(name)
  || ["SSH_AUTH_SOCK", "GPG_AGENT_INFO"].includes(name);
const harmlessRuntimeNames = new Set([
  "PATH", "TMPDIR", "HOME", "CODEX_HOME", "AGENT_PRACTICE_PREFLIGHT",
  "__CF_USER_TEXT_ENCODING", "XPC_FLAGS", "XPC_SERVICE_NAME", "OS_ACTIVITY_MODE",
  "TERM", "LANG", "LC_ALL", "LC_CTYPE", "NO_COLOR",
]);
const preflightEnvironment = (home, codexHome) => {
  const environment = {};
  for (const name of harmlessRuntimeNames) {
    if (typeof process.env[name] === "string" && !credentialName(name)) environment[name] = process.env[name];
  }
  environment.PATH = process.env.PATH || "/usr/bin:/bin";
  environment.TMPDIR = process.env.TMPDIR || os.tmpdir();
  environment.HOME = home;
  environment.CODEX_HOME = codexHome;
  environment.AGENT_PRACTICE_PREFLIGHT = "1";
  return environment;
};
const liveEnvironment = (home, codexHome) => {
  const environment = { ...process.env, HOME: home, CODEX_HOME: codexHome };
  delete environment.AGENT_PRACTICE_PREFLIGHT;
  delete environment.CODEX_BIN;
  delete environment.REAL_CODEX_BIN;
  for (const name of Object.keys(environment)) {
    if (credentialName(name)) delete environment[name];
  }
  return environment;
};

const requestedBinary = process.env.REAL_CODEX_BIN;
assert(typeof requestedBinary === "string" && path.isAbsolute(requestedBinary), "REAL_CODEX_BIN must be absolute");
const realBinary = fs.realpathSync(requestedBinary);
assert(fs.lstatSync(realBinary).isFile(), "REAL_CODEX_BIN must resolve to a regular file");
assert(realBinary !== fs.realpathSync(process.argv[1]), "REAL_CODEX_BIN must not be this wrapper");
assert(args.filter((value) => value === "exec").length === 1, "runner must request exactly one exec command");
for (const required of ["--ephemeral", "--ignore-user-config", "--ignore-rules", "--skip-git-repo-check", "--json"]) {
  assert(args.includes(required), `runner omitted ${required}`);
}
assert(valueAfter(args, "-a") === "never", "runner approval policy must be never");
assert(valueAfter(args, "--sandbox") === "workspace-write", "runner sandbox must begin as workspace-write");
assert(args.includes("sandbox_workspace_write.network_access=false"), "runner network setting must be false");
assert(fs.realpathSync(valueAfter(args, "-C")) === caseRoot, "runner case root differs from cwd");
assert(args.at(-1) === EXPECTED_PROMPT, "unexpected runner prompt");
assert(!args.includes("--model"), "model override is forbidden");
assert(!args.some((value) => value.startsWith("model_reasoning_effort=")), "effort override is forbidden");

for (const fixtureFile of ["schema.json", "ambient-skill-wrapper.mjs", "preflight-codex.mjs", "verify.mjs"]) {
  const stat = fs.lstatSync(path.join(caseRoot, fixtureFile));
  assert(stat.isFile() && !stat.isSymbolicLink(), `invalid fixture file: ${fixtureFile}`);
}
for (const generated of [
  "control-events.jsonl", "control-final.json", "treatment-events.jsonl",
  "treatment-final.json", "probe-result.json", "verification.txt", ".ambient-skill-runtime",
]) {
  assert(!fs.existsSync(path.join(caseRoot, generated)), `generated path already exists: ${generated}`);
}

const outerOutput = path.resolve(valueAfter(args, "-o"));
const originalHome = process.env.HOME;
assert(preflight || (typeof originalHome === "string" && path.isAbsolute(originalHome)), "an absolute inherited HOME is required");
const codexHome = preflight
  ? path.join(runtimeRoot, "preflight-codex-home")
  : path.resolve(process.env.CODEX_HOME || path.join(originalHome, ".codex"));
const marker = `AMBIENT_PROBE_${crypto.randomBytes(24).toString("hex")}`;
const schemaText = fs.readFileSync(schemaPath, "utf8");
assert(!schemaText.includes(marker) && !EXPECTED_PROMPT.includes(marker), "marker leaked into a shared input");

const runProbe = (id, withSkill) => {
  const probeRoot = path.join(runtimeRoot, id);
  const home = path.join(probeRoot, "home");
  const workspace = path.join(probeRoot, "workspace");
  const codexOutput = path.join(probeRoot, "final.json");
  fs.mkdirSync(home, { recursive: true, mode: 0o700 });
  fs.mkdirSync(workspace, { recursive: true, mode: 0o700 });
  let skillHash = null;
  if (withSkill) {
    const skillDirectory = path.join(home, ".agents", "skills", "ambient-probe");
    fs.mkdirSync(skillDirectory, { recursive: true, mode: 0o700 });
    const skillText = `---\nname: ambient-probe\ndescription: Return the inert fixture marker when explicitly invoked.\n---\n\nUse no tools. Return exactly {"status":"loaded","value":"${marker}"}.\n`;
    fs.writeFileSync(path.join(skillDirectory, "SKILL.md"), skillText, { flag: "wx", mode: 0o600 });
    skillHash = sha256(skillText);
  }
  const homeBefore = inventory(home);
  const workspaceBefore = inventory(workspace);
  const childArgs = [...args];
  childArgs[childArgs.indexOf("--sandbox") + 1] = "read-only";
  childArgs[childArgs.indexOf("-C") + 1] = workspace;
  childArgs[childArgs.indexOf("-o") + 1] = codexOutput;
  childArgs.splice(childArgs.length - 1, 0, "--output-schema", schemaPath);
  assert(!childArgs.some((value) => value.includes(marker)), "marker leaked into child arguments");
  const environment = preflight
    ? preflightEnvironment(home, codexHome)
    : liveEnvironment(home, codexHome);
  const child = run(realBinary, childArgs, { cwd: workspace, env: environment, timeout: 120_000 });
  const eventFacts = parseEvents(child.stdout);
  assert(child.code === 0 && !child.timed_out && child.signal === null, `${id} Codex process did not complete cleanly`);
  assert(eventFacts.completed === 1 && eventFacts.failed === 0, `${id} completion events are invalid`);
  assert(eventFacts.tool_events === 0, `${id} attempted a tool`);
  const final = parseFinal(codexOutput);
  const eventsName = `${id}-events.jsonl`;
  const finalName = `${id}-final.json`;
  fs.writeFileSync(path.join(caseRoot, eventsName), child.stdout, { flag: "wx", mode: 0o600 });
  fs.copyFileSync(codexOutput, path.join(caseRoot, finalName), fs.constants.COPYFILE_EXCL);
  const homeAfter = inventory(home);
  const workspaceAfter = inventory(workspace);
  assert(JSON.stringify(homeAfter) === JSON.stringify(homeBefore), `${id} home inventory changed`);
  assert(JSON.stringify(workspaceAfter) === JSON.stringify(workspaceBefore), `${id} workspace inventory changed`);
  return {
    id,
    skill_present: withSkill,
    skill_sha256: skillHash,
    process: {
      code: child.code,
      signal: child.signal,
      timed_out: child.timed_out,
      stderr_bytes: child.stderr_bytes,
    },
    events: eventFacts,
    final,
    home_inventory: homeAfter,
    workspace_inventory: workspaceAfter,
    marker_occurrences: (child.stdout.split(marker).length - 1) + (JSON.stringify(final).split(marker).length - 1),
  };
};

let result;
try {
  fs.mkdirSync(runtimeRoot, { recursive: false, mode: 0o700 });
  const versionEnv = preflight
    ? preflightEnvironment(path.join(runtimeRoot, "version-home"), codexHome)
    : liveEnvironment(path.join(runtimeRoot, "version-home"), codexHome);
  fs.mkdirSync(versionEnv.HOME, { recursive: true, mode: 0o700 });
  const version = run(realBinary, ["--version"], { cwd: caseRoot, env: versionEnv, timeout: 30_000 });
  assert(version.code === 0 && version.stdout.trim().split(/\r?\n/)[0] === EXPECTED_VERSION, `expected ${EXPECTED_VERSION}`);

  const control = runProbe("control", false);
  const treatment = runProbe("treatment", true);
  assert(control.final.status === "unavailable" && control.final.value === "", "control did not fail closed");
  assert(control.marker_occurrences === 0, "control contains the treatment marker");

  let observation;
  if (treatment.final.status === "loaded" && treatment.final.value === marker && treatment.marker_occurrences >= 2) {
    observation = "claim-supported";
  } else if (treatment.final.status === "unavailable" && treatment.final.value === "" && treatment.marker_occurrences === 0) {
    observation = "not-reproduced";
  } else {
    fail("treatment produced an unregistered or ambiguous outcome");
  }

  result = {
    schema_version: 1,
    preflight,
    codex_version: EXPECTED_VERSION,
    case_marker: CASE_MARKER,
    hidden_marker: marker,
    hidden_marker_sha256: sha256(marker),
    prompt_sha256: sha256(EXPECTED_PROMPT),
    schema_sha256: sha256(schemaText),
    runner_controls: {
      approval: "never",
      sandbox: "read-only",
      network: false,
      ignore_user_config: true,
      ignore_rules: true,
      ephemeral: true,
      model_override: null,
      effort_override: null,
      live_model_calls: preflight ? 0 : 2,
    },
    control,
    treatment,
    observation,
  };
  fs.writeFileSync(path.join(caseRoot, "probe-result.json"), `${JSON.stringify(result, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  fs.writeFileSync(outerOutput, `Codex ambient user-skill probe completed: ${observation}\n`, { flag: "w", mode: 0o600 });
} finally {
  if (fs.existsSync(runtimeRoot)) fs.rmSync(runtimeRoot, { recursive: true, force: true });
}

process.stdout.write(`${JSON.stringify({ type: "fixture.completed", observation: result.observation })}\n`);
