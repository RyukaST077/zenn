#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const EXPECTED_VERSION = "codex-cli 0.147.0";
const EXPECTED_PROMPT = "Run the fixture's bounded Codex resume-persistence probe exactly once. Do not perform any additional task.";
const args = process.argv.slice(2);
const caseRoot = fs.realpathSync(process.cwd());
const preflight = process.env.AGENT_PRACTICE_PREFLIGHT === "1";
const runtimeRoot = path.join(caseRoot, ".resume-probe-runtime");
const fail = (message) => {
  process.stderr.write(`resume wrapper error: ${message}\n`);
  process.exit(2);
};
const assert = (condition, message) => {
  if (!condition) fail(message);
};
const flagValue = (values, flag) => {
  const index = values.indexOf(flag);
  assert(index >= 0 && index + 1 < values.length, `missing ${flag}`);
  return values[index + 1];
};
const countLiteral = (text, marker) => text.split(marker).length - 1;
const lineCount = (buffer) => {
  if (buffer.length === 0) return 0;
  let count = 0;
  for (const byte of buffer) if (byte === 10) count += 1;
  return count + (buffer.at(-1) === 10 ? 0 : 1);
};
const snapshot = (file, markers) => {
  const buffer = fs.readFileSync(file);
  const text = buffer.toString("utf8");
  return {
    sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
    bytes: buffer.length,
    lines: lineCount(buffer),
    baseline_marker_count: countLiteral(text, markers.baseline),
    resume_marker_count: countLiteral(text, markers.resume),
    buffer,
  };
};
const safeFacts = ({ buffer, ...facts }) => facts;
const parseEvents = (stdout) => {
  const events = stdout.split(/\r?\n/).filter(Boolean).map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      fail(`child JSONL line ${index + 1} is invalid: ${error.message}`);
    }
  });
  const threadIds = [...new Set(events.map((event) => event.thread_id).filter((value) => typeof value === "string"))];
  const toolTypes = new Set(["command_execution", "mcp_tool_call", "web_search", "file_change"]);
  return {
    thread_ids: threadIds,
    completed: events.filter((event) => event.type === "turn.completed").length,
    failed: events.filter((event) => event.type === "turn.failed" || event.type === "error").length,
    tool_events: events.filter((event) => toolTypes.has(event.item?.type)).length,
  };
};
const run = (binary, values, options) => {
  const result = spawnSync(binary, values, {
    cwd: caseRoot,
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
  };
};
const findRollouts = (directory, sessionId) => {
  const matches = [];
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      const stat = fs.lstatSync(absolute);
      assert(!stat.isSymbolicLink(), "session tree contains a symlink");
      if (stat.isDirectory()) visit(absolute);
      else if (stat.isFile() && entry.name.includes(sessionId) && entry.name.endsWith(".jsonl")) matches.push(absolute);
    }
  };
  visit(directory);
  return matches;
};

const requestedBinary = process.env.REAL_CODEX_BIN;
assert(typeof requestedBinary === "string" && path.isAbsolute(requestedBinary), "REAL_CODEX_BIN must be absolute");
const realBinary = fs.realpathSync(requestedBinary);
assert(fs.statSync(realBinary).isFile(), "REAL_CODEX_BIN must resolve to a file");
assert(realBinary !== fs.realpathSync(process.argv[1]), "REAL_CODEX_BIN must not be this wrapper");
assert(args.filter((value) => value === "exec").length === 1, "runner must request one exec command");
for (const required of ["--ephemeral", "--ignore-user-config", "--ignore-rules", "--skip-git-repo-check", "--json"]) {
  assert(args.includes(required), `runner omitted ${required}`);
}
assert(flagValue(args, "-a") === "never", "runner approval policy must be never");
assert(flagValue(args, "--sandbox") === "workspace-write", "runner sandbox must be workspace-write");
assert(args.includes("sandbox_workspace_write.network_access=false"), "runner network setting must be false");
assert(fs.realpathSync(flagValue(args, "-C")) === caseRoot, "runner case root differs from cwd");
assert(args.at(-1) === EXPECTED_PROMPT, "unexpected runner prompt");
assert(!args.includes("--model"), "model override is not allowed");

for (const fixtureFile of ["markers.json", "verify.mjs", "codex-resume-wrapper.mjs", "preflight-codex.mjs"]) {
  const stat = fs.lstatSync(path.join(caseRoot, fixtureFile));
  assert(stat.isFile() && !stat.isSymbolicLink(), `invalid fixture file: ${fixtureFile}`);
}
for (const generated of ["probe-result.json", "verification.txt", ".resume-probe-runtime"]) {
  assert(!fs.existsSync(path.join(caseRoot, generated)), `generated path already exists: ${generated}`);
}

const markers = JSON.parse(fs.readFileSync(path.join(caseRoot, "markers.json"), "utf8"));
assert(typeof markers.baseline === "string" && typeof markers.resume === "string" && markers.baseline !== markers.resume, "invalid markers");
const outputFile = path.resolve(flagValue(args, "-o"));
const fakeHome = path.join(runtimeRoot, "fake-codex-home");
const codexHome = preflight ? fakeHome : path.resolve(process.env.CODEX_HOME || path.join(os.homedir(), ".codex"));
const sessionsRoot = path.join(codexHome, "sessions");
const baselineFinal = path.join(runtimeRoot, "baseline-final.txt");
const resumeFinal = path.join(runtimeRoot, "resume-final.txt");

const preflightEnv = {
  PATH: process.env.PATH || "/usr/bin:/bin",
  TMPDIR: process.env.TMPDIR || os.tmpdir(),
  CODEX_HOME: fakeHome,
  AGENT_PRACTICE_PREFLIGHT: "1",
};
const liveEnv = { ...process.env };
delete liveEnv.AGENT_PRACTICE_PREFLIGHT;
delete liveEnv.CODEX_BIN;
delete liveEnv.REAL_CODEX_BIN;
const childEnv = preflight ? preflightEnv : liveEnv;

let result;
try {
  fs.mkdirSync(runtimeRoot, { recursive: false, mode: 0o700 });
  const version = run(realBinary, ["--version"], { env: childEnv, timeout: 30_000 });
  assert(version.code === 0 && version.stdout.trim().split(/\r?\n/)[0] === EXPECTED_VERSION, `expected ${EXPECTED_VERSION}`);
  assert(fs.existsSync(sessionsRoot) || preflight, "Codex sessions directory is unavailable");

  const common = [
    "-a", "never", "exec", "--json", "--sandbox", "read-only",
    "--ignore-user-config", "--ignore-rules", "--skip-git-repo-check",
    "-C", caseRoot, "-c", "sandbox_workspace_write.network_access=false",
  ];
  const baselinePrompt = `Reply with exactly ${markers.baseline}. Do not use tools, commands, web search, MCP, or edit files.`;
  const baseline = run(realBinary, [...common, "-o", baselineFinal, baselinePrompt], { env: childEnv, timeout: 120_000 });
  const baselineEvents = parseEvents(baseline.stdout);
  assert(baseline.code === 0 && !baseline.timed_out && baselineEvents.completed === 1 && baselineEvents.failed === 0, "baseline did not complete successfully");
  assert(baselineEvents.tool_events === 0, "baseline attempted a tool");
  assert(baselineEvents.thread_ids.length === 1, "baseline did not emit exactly one session ID");
  const sessionId = baselineEvents.thread_ids[0];
  assert(/^[0-9a-f]{8}-[0-9a-f-]{27}$/.test(sessionId), "baseline session ID has an unexpected shape");
  assert(fs.existsSync(sessionsRoot), "Codex sessions directory was not created");
  const matches = findRollouts(sessionsRoot, sessionId);
  assert(matches.length === 1, `expected one rollout match, found ${matches.length}`);
  const target = matches[0];
  const targetRelative = path.relative(codexHome, target);
  assert(targetRelative && !targetRelative.startsWith("..") && !path.isAbsolute(targetRelative), "target rollout escaped Codex home");
  const before = snapshot(target, markers);
  assert(before.baseline_marker_count >= 1, "baseline marker is absent from target rollout");
  assert(before.resume_marker_count === 0, "resume marker was already present before resume");

  const resumePrompt = `Reply with exactly ${markers.resume}. Do not use tools, commands, web search, MCP, or edit files.`;
  const resumeArgs = [
    "-a", "never", "exec", "--ephemeral", "--json", "--sandbox", "read-only",
    "--ignore-user-config", "--ignore-rules", "--skip-git-repo-check",
    "-C", caseRoot, "-c", "sandbox_workspace_write.network_access=false",
    "-o", resumeFinal, "resume", sessionId, resumePrompt,
  ];
  const resume = run(realBinary, resumeArgs, { env: childEnv, timeout: 120_000 });
  const resumeEvents = parseEvents(resume.stdout);
  assert(resume.code === 0 && !resume.timed_out && resumeEvents.completed === 1 && resumeEvents.failed === 0, "resume did not complete successfully");
  assert(resumeEvents.tool_events === 0, "resume attempted a tool");
  assert(resumeEvents.thread_ids.length === 1 && resumeEvents.thread_ids[0] === sessionId, "resume session ID mismatch");
  assert(findRollouts(sessionsRoot, sessionId).length === 1, "rollout match became ambiguous after resume");
  const after = snapshot(target, markers);
  const prefixUnchanged = after.buffer.subarray(0, before.buffer.length).equals(before.buffer);
  const appendedText = after.buffer.subarray(before.buffer.length).toString("utf8");
  const appendedResumeCount = prefixUnchanged ? countLiteral(appendedText, markers.resume) : 0;
  const unchanged = before.sha256 === after.sha256
    && before.bytes === after.bytes
    && before.lines === after.lines
    && after.resume_marker_count === 0;
  const appended = before.sha256 !== after.sha256
    && after.bytes > before.bytes
    && after.lines >= before.lines
    && prefixUnchanged
    && appendedResumeCount >= 1;
  assert(unchanged || appended, "rollout changed in an unregistered or unattributable way");

  result = {
    schema_version: 1,
    preflight,
    codex_version: EXPECTED_VERSION,
    session_id: sessionId,
    target_relative_path: targetRelative,
    runner_controls: {
      approval: "never",
      sandbox: "read-only",
      network: false,
      ignore_user_config: true,
      ignore_rules: true,
      model_override: null,
    },
    baseline: { code: baseline.code, signal: baseline.signal, timed_out: baseline.timed_out, ...baselineEvents },
    resume: { code: resume.code, signal: resume.signal, timed_out: resume.timed_out, ...resumeEvents },
    before: safeFacts(before),
    after: safeFacts(after),
    delta: {
      bytes: after.bytes - before.bytes,
      lines: after.lines - before.lines,
      prefix_unchanged: prefixUnchanged,
      appended_resume_marker_count: appendedResumeCount,
    },
    observation: appended ? "claim-supported" : "not-reproduced",
  };
  fs.writeFileSync(path.join(caseRoot, "probe-result.json"), `${JSON.stringify(result, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  fs.writeFileSync(outputFile, `Codex resume-persistence probe completed: ${result.observation}\n`, { mode: 0o600 });
} finally {
  if (fs.existsSync(runtimeRoot)) fs.rmSync(runtimeRoot, { recursive: true, force: true });
}

process.stdout.write(`${JSON.stringify({ type: "fixture.completed", observation: result.observation })}\n`);
