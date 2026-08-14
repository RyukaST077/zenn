#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { redactJsonLines, redactText, redactValue } from "./redact.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "../..");
const input = process.argv[2];
const preflightOnly = process.argv.slice(3).includes("--preflight-only");
const die = (message) => { console.error(message); process.exit(2); };
if (!input) die("usage: run-experiment.mjs <manifest.json> [--preflight-only]");
const manifestFile = path.resolve(root, input);

const validation = spawnSync(process.execPath, [path.join(scriptDir, "validate-manifest.mjs"), manifestFile], {
  cwd: root, encoding: "utf8",
});
if (validation.status !== 0) die(validation.stderr || "manifest validation failed");
const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));

const pad = (value) => String(value).padStart(2, "0");
const now = new Date();
const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const runRelative = `logs/agent/run-${manifest.id}-${timestamp}`;
const runDir = path.join(root, runRelative);
fs.mkdirSync(runDir, { recursive: true });
fs.copyFileSync(manifestFile, path.join(runDir, "manifest.json"));

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), `zenn-agent-${manifest.id}-`));
const providers = [...new Set(manifest.cases.map((item) => item.provider))];
const binaries = {
  claude: process.env.CLAUDE_BIN || "claude",
  codex: process.env.CODEX_BIN || "codex",
};
const versions = {};

function resolveExecutable(command) {
  const candidates = command.includes(path.sep)
    ? [path.resolve(command)]
    : String(process.env.PATH || "").split(path.delimiter).filter(Boolean).map((directory) => path.join(directory, command));
  for (const candidate of candidates) {
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return fs.realpathSync(candidate);
    } catch { /* try the next PATH entry */ }
  }
  die(`provider executable is unavailable: ${command}`);
}

const realBinaries = Object.fromEntries(
  providers.map((provider) => [provider, resolveExecutable(binaries[provider])]),
);

function commandResult(command, args, options = {}) {
  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd: options.cwd || root,
    encoding: "utf8",
    timeout: options.timeoutMs,
    maxBuffer: 50 * 1024 * 1024,
    env: options.env || process.env,
  });
  const timedOut = result.error?.code === "ETIMEDOUT";
  return {
    code: timedOut ? 124 : (result.status ?? (result.error ? 127 : 0)),
    signal: result.signal || null,
    timed_out: timedOut,
    duration_ms: Date.now() - started,
    stdout: result.stdout || "",
    stderr: result.stderr || (result.error ? String(result.error.message) : ""),
  };
}

for (const provider of providers) {
  const authArgs = provider === "claude" ? ["auth", "status"] : ["login", "status"];
  const auth = commandResult(binaries[provider], authArgs, { timeoutMs: 30_000 });
  if (auth.code !== 0) die(`${provider} is not authenticated or unavailable`);
  const version = commandResult(binaries[provider], ["--version"], { timeoutMs: 30_000 });
  if (version.code !== 0) die(`${provider} version check failed`);
  versions[provider] = redactText((version.stdout || version.stderr).trim().split(/\r?\n/)[0]);
}

function walkFiles(directory, base = directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(absolute, base));
    else if (entry.isFile()) files.push(path.relative(base, absolute));
  }
  return files.sort();
}

function digest(file) {
  return fs.existsSync(file) && fs.statSync(file).isFile()
    ? crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
    : null;
}

function changedFiles(before, after) {
  const names = new Set([...walkFiles(before), ...walkFiles(after)]);
  return [...names].filter((name) => digest(path.join(before, name)) !== digest(path.join(after, name))).sort();
}

function writeJson(target, value) {
  fs.writeFileSync(target, `${JSON.stringify(redactValue(value), null, 2)}\n`);
}

function extractClaudeResult(events) {
  let final = "";
  for (const line of events.split(/\r?\n/)) {
    try {
      const item = JSON.parse(line);
      if (item.type === "result" && typeof item.result === "string") final = item.result;
    } catch { /* keep raw evidence; malformed lines are handled by redaction */ }
  }
  return final;
}

const scrubWorkspace = (value) => redactText(value).split(tempRoot).join("$RUN_WORKSPACE");

function executionFor(item) {
  return item.execution || {
    mode: "direct",
    wrapper: null,
    preflight_cli: null,
    environment: "inherit",
  };
}

function prepareCase(item, caseDirectory) {
  fs.mkdirSync(path.dirname(caseDirectory), { recursive: true });
  fs.cpSync(path.resolve(root, manifest.fixture), caseDirectory, { recursive: true });
  if (item.guidance) {
    fs.copyFileSync(path.resolve(root, item.guidance), path.join(caseDirectory, path.basename(item.guidance)));
  }
}

function buildAgentArgs(item, caseDirectory, outputFile) {
  let args;
  if (item.provider === "claude") {
    args = [
      "-p", manifest.prompt,
      "--output-format", "stream-json",
      "--verbose",
      "--no-session-persistence",
      "--setting-sources", "project",
      "--permission-mode", "bypassPermissions",
      "--tools", "Read,Edit,Write,Bash",
    ];
    if (item.model) args.push("--model", item.model);
    if (item.effort) args.push("--effort", item.effort);
  } else {
    args = [
      "-a", "never", "exec", "--ephemeral", "--ignore-user-config", "--ignore-rules",
      ...(fs.existsSync(path.join(caseDirectory, ".codex/hooks.json"))
        ? ["--dangerously-bypass-hook-trust"]
        : []),
      "--sandbox", "workspace-write", "--skip-git-repo-check", "-C", caseDirectory,
      "-c", `sandbox_workspace_write.network_access=${manifest.network}`,
      "--json", "-o", outputFile,
    ];
    if (item.model) args.push("--model", item.model);
    if (item.effort) args.push("-c", `model_reasoning_effort=\"${item.effort}\"`);
    args.push(manifest.prompt);
  }
  return args;
}

function caseInvocation(item, caseDirectory, preflight = false) {
  const execution = executionFor(item);
  if (execution.mode === "direct") {
    return {
      executable: binaries[item.provider],
      realExecutable: realBinaries[item.provider],
      env: process.env,
      execution,
    };
  }
  const wrapper = path.join(caseDirectory, execution.wrapper);
  const providerName = item.provider.toUpperCase();
  const selectedRealCli = preflight
    ? path.join(caseDirectory, execution.preflight_cli)
    : realBinaries[item.provider];
  const env = preflight || execution.environment === "minimal"
    ? {
      PATH: process.env.PATH || "/usr/bin:/bin",
      TMPDIR: process.env.TMPDIR || os.tmpdir(),
    }
    : { ...process.env };
  env[`${providerName}_BIN`] = wrapper;
  env[`REAL_${providerName}_BIN`] = selectedRealCli;
  if (preflight) env.AGENT_PRACTICE_PREFLIGHT = "1";
  return {
    executable: wrapper,
    realExecutable: selectedRealCli,
    env,
    execution,
  };
}

function inspectWorkspace(snapshot, caseDirectory, item) {
  const changed = changedFiles(snapshot, caseDirectory);
  const protectedChanged = manifest.verification.protected_paths.filter((name) => (
    digest(path.join(snapshot, name)) !== digest(path.join(caseDirectory, name))
  ));
  const allowed = new Set(manifest.verification.allowed_changes);
  const unexpected = changed.filter((name) => !allowed.has(name));
  const markerPath = path.join(caseDirectory, manifest.verification.marker_file);
  const marker = fs.existsSync(markerPath) ? fs.readFileSync(markerPath, "utf8").trimEnd() : null;
  return {
    changed,
    protectedChanged,
    unexpected,
    marker,
    markerMatches: marker === item.expected_marker,
  };
}

const caseResults = [];
const preflightResults = new Map();
let runError = null;
try {
  // Wrapper fixtures get a complete fake-CLI rehearsal before any authenticated model call.
  // Every wrapper case must pass first, so a later broken case cannot spend after an earlier pass.
  for (const item of manifest.cases) {
    const execution = executionFor(item);
    if (execution.mode === "direct") {
      preflightResults.set(item.id, { status: "not-required" });
      continue;
    }
    const preflightCase = path.join(tempRoot, "preflight", item.id);
    const preflightSnapshot = path.join(tempRoot, "preflight-input", item.id);
    const preflightOutput = path.join(tempRoot, "preflight-output", `${item.id}.txt`);
    const evidenceRelative = `${runRelative}/${item.id}`;
    const evidenceDir = path.join(root, evidenceRelative);
    fs.mkdirSync(evidenceDir, { recursive: true });
    fs.mkdirSync(path.dirname(preflightOutput), { recursive: true });
    prepareCase(item, preflightCase);
    fs.cpSync(preflightCase, preflightSnapshot, { recursive: true });

    const args = buildAgentArgs(item, preflightCase, preflightOutput);
    const invocation = caseInvocation(item, preflightCase, true);
    const agent = commandResult(invocation.executable, args, {
      cwd: preflightCase,
      timeoutMs: manifest.timeout_seconds * 1000,
      env: invocation.env,
    });
    fs.writeFileSync(path.join(evidenceDir, "preflight-events.jsonl"), `${redactJsonLines(agent.stdout).split(tempRoot).join("$RUN_WORKSPACE")}\n`);
    fs.writeFileSync(path.join(evidenceDir, "preflight-stderr.log"), `${scrubWorkspace(agent.stderr)}\n`);
    const verifier = commandResult(manifest.verification.command[0], manifest.verification.command.slice(1), {
      cwd: preflightCase,
      timeoutMs: Math.min(60_000, manifest.timeout_seconds * 1000),
    });
    fs.writeFileSync(path.join(evidenceDir, "preflight-verify.log"), `${scrubWorkspace(verifier.stdout)}${scrubWorkspace(verifier.stderr)}`);
    const inspected = inspectWorkspace(preflightSnapshot, preflightCase, item);
    const passed = agent.code === 0 && verifier.code === 0
      && inspected.protectedChanged.length === 0 && inspected.unexpected.length === 0
      && inspected.markerMatches;
    const summary = {
      status: passed ? "passed" : "failed",
      provider: item.provider,
      wrapper: execution.wrapper,
      fake_cli: execution.preflight_cli,
      environment: "minimal",
      wrapper_exit_code: agent.code,
      verifier_exit_code: verifier.code,
      marker_expected: item.expected_marker,
      marker_observed: inspected.marker,
      protected_paths_changed: inspected.protectedChanged,
      unexpected_changes: inspected.unexpected,
    };
    writeJson(path.join(evidenceDir, "preflight.json"), summary);
    const preflightWorkspace = path.join(runDir, "preflight-work", item.id);
    fs.mkdirSync(path.dirname(preflightWorkspace), { recursive: true });
    fs.cpSync(preflightCase, preflightWorkspace, { recursive: true });
    preflightResults.set(item.id, summary);
    if (!passed) {
      throw new Error(`preflight failed for ${item.id}; authenticated ${item.provider} experiment was not started`);
    }
  }

  if (preflightOnly) {
    writeJson(path.join(runDir, "preflight-summary.json"), {
      manifest: path.relative(root, manifestFile),
      cases: Object.fromEntries(preflightResults),
    });
  }

  for (const item of preflightOnly ? [] : manifest.cases) {
    const caseTemp = path.join(tempRoot, item.id);
    const snapshot = path.join(tempRoot, `${item.id}-input`);
    const evidenceRelative = `${runRelative}/${item.id}`;
    const evidenceDir = path.join(root, evidenceRelative);
    fs.mkdirSync(evidenceDir, { recursive: true });
    prepareCase(item, caseTemp);
    fs.cpSync(caseTemp, snapshot, { recursive: true });

    let outputFile = path.join(evidenceDir, "result.txt");
    const args = buildAgentArgs(item, caseTemp, outputFile);
    const invocation = caseInvocation(item, caseTemp, false);
    const agent = commandResult(invocation.executable, args, {
      cwd: caseTemp,
      timeoutMs: manifest.timeout_seconds * 1000,
      env: invocation.env,
    });
    fs.writeFileSync(path.join(evidenceDir, "events.jsonl"), `${redactJsonLines(agent.stdout).split(tempRoot).join("$RUN_WORKSPACE")}\n`);
    fs.writeFileSync(path.join(evidenceDir, "stderr.log"), `${scrubWorkspace(agent.stderr)}\n`);
    if (item.provider === "claude") {
      fs.writeFileSync(outputFile, `${scrubWorkspace(extractClaudeResult(agent.stdout))}\n`);
    } else if (fs.existsSync(outputFile)) {
      fs.writeFileSync(outputFile, `${scrubWorkspace(fs.readFileSync(outputFile, "utf8"))}`);
    }

    const verifier = commandResult(manifest.verification.command[0], manifest.verification.command.slice(1), {
      cwd: caseTemp,
      timeoutMs: Math.min(60_000, manifest.timeout_seconds * 1000),
    });
    fs.writeFileSync(path.join(evidenceDir, "verify.log"), `${scrubWorkspace(verifier.stdout)}${scrubWorkspace(verifier.stderr)}`);

    const inspected = inspectWorkspace(snapshot, caseTemp, item);
    const passed = agent.code === 0 && verifier.code === 0
      && inspected.protectedChanged.length === 0 && inspected.unexpected.length === 0
      && inspected.markerMatches;

    const diff = commandResult("git", ["diff", "--no-index", "--no-ext-diff", "--", snapshot, caseTemp], {
      cwd: root, timeoutMs: 30_000,
    });
    const displayDiff = redactText(`${diff.stdout}${diff.stderr}`)
      .split(tempRoot).join("$RUN_WORKSPACE");
    fs.writeFileSync(path.join(evidenceDir, "diff.patch"), displayDiff);
    writeJson(path.join(evidenceDir, "command.json"), {
      executable: invocation.executable,
      real_executable: invocation.realExecutable,
      execution_mode: invocation.execution.mode,
      environment_mode: invocation.execution.environment,
      args: args.map((part) => redactText(part).split(tempRoot).join("$RUN_WORKSPACE")),
      cwd: "$RUN_WORKSPACE",
    });

    const metrics = {
      id: item.id,
      provider: item.provider,
      provider_version: versions[item.provider],
      execution_mode: invocation.execution.mode,
      execution_environment: invocation.execution.environment,
      preflight_status: preflightResults.get(item.id)?.status || "not-required",
      guidance: item.guidance,
      model_override: item.model,
      effort_override: item.effort,
      network_requested: manifest.network,
      network_enforcement: item.provider === "codex"
        ? "codex-workspace-sandbox"
        : "not-enforced-for-claude-host-process",
      agent_exit_code: agent.code,
      timed_out: agent.timed_out,
      duration_ms: agent.duration_ms,
      verifier_exit_code: verifier.code,
      marker_expected: item.expected_marker,
      marker_observed: inspected.marker,
      marker_matches: inspected.markerMatches,
      protected_paths_changed: inspected.protectedChanged,
      changed_files: inspected.changed,
      unexpected_changes: inspected.unexpected,
      passed,
    };
    writeJson(path.join(evidenceDir, "metrics.json"), metrics);
    const preservedWorkspace = path.join(runDir, "work", item.id);
    fs.mkdirSync(path.dirname(preservedWorkspace), { recursive: true });
    fs.cpSync(caseTemp, preservedWorkspace, { recursive: true });
    caseResults.push({ ...metrics, evidence: evidenceRelative });
  }
} catch (error) {
  runError = error;
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
if (runError) die(runError.message);
if (preflightOnly) {
  process.stdout.write(`${runRelative}/preflight-summary.json\n`);
  process.exit(0);
}

const escaped = (value) => String(value ?? "-").replaceAll("|", "\\|").replaceAll("\n", " ");
const startedAt = now.toISOString();
const finishedAt = new Date().toISOString();
const lines = [
  "# AI coding-agent practice execution log",
  "",
  `- Manifest: \`${path.relative(root, manifestFile)}\``,
  `- Plan: \`${manifest.plan}\``,
  `- Research: \`${manifest.source_report}\``,
  `- Claim: ${manifest.claim}`,
  `- Mode: \`${manifest.mode}\``,
  `- Started: ${startedAt}`,
  `- Finished: ${finishedAt}`,
  "",
  "## Environment",
  "",
  ...Object.entries(versions).map(([provider, version]) => `- ${provider}: \`${version}\``),
  "- Authentication was checked through CLI status commands; credential files were not read.",
  "- Fixture-wrapper cases completed a fake-CLI preflight, including their verifier, before any authenticated experiment case started.",
  "- Each case ran in a fresh temporary directory. Final workspaces were copied under the ignored `work/` directory.",
  `- Manifest network setting: \`${manifest.network}\`. The runner enforces it through the Codex workspace sandbox only; it does not OS-isolate Claude host processes.`,
  "",
  "## Case results",
  "",
  "| Case | Provider | Execution | Preflight | Agent exit | Duration ms | Verifier | Marker | Protected | Unexpected | Passed |",
  "|---|---|---|---|---:|---:|---:|---|---|---|---|",
  ...caseResults.map((item) => `| ${escaped(item.id)} | ${escaped(item.provider)} | ${escaped(item.execution_mode)} | ${escaped(item.preflight_status)} | ${item.agent_exit_code} | ${item.duration_ms} | ${item.verifier_exit_code} | ${escaped(item.marker_observed)} | ${escaped(item.protected_paths_changed.join(", ") || "none")} | ${escaped(item.unexpected_changes.join(", ") || "none")} | ${item.passed ? "yes" : "no"} |`),
  "",
  "## Recorded observations",
  "",
  ...caseResults.map((item) => `- \`${item.id}\`: exit=${item.agent_exit_code}, verifier=${item.verifier_exit_code}, marker=${JSON.stringify(item.marker_observed)}, changed=${item.changed_files.length}, passed=${item.passed}.`),
  "",
  "## Evidence inventory",
  "",
  ...caseResults.map((item) => `- \`${item.evidence}/\`: \`command.json\`, \`events.jsonl\`, \`stderr.log\`, \`result.txt\`, \`verify.log\`, \`diff.patch\`, \`metrics.json\`${item.preflight_status === "passed" ? ", plus `preflight.json` and preflight logs" : ""}.`),
  "",
  "## Deviations and failures",
  "",
  ...(caseResults.some((item) => !item.passed)
    ? caseResults.filter((item) => !item.passed).map((item) => `- \`${item.id}\` did not satisfy all manifest assertions; see its metrics and raw evidence.`)
    : ["- None recorded by the deterministic runner."]),
  "",
  "## Limitations",
  "",
  "- This run records one sample per manifest case unless the manifest repeats a case explicitly.",
  "- A null model override means the authenticated account's CLI default was used; the recorded CLI version does not prove the resolved backend snapshot.",
  "- The runner verifies declared assertions only and does not claim general model or product performance.",
  "- A disposable workspace and post-run diff are evidence boundaries, not host filesystem or network security boundaries for Claude.",
  "",
  "## Article-safe facts",
  "",
  ...caseResults.map((item) => `- In case \`${item.id}\`, the recorded verifier exit code was ${item.verifier_exit_code} and the marker observation was ${JSON.stringify(item.marker_observed)}.`),
  "",
];
const executionLog = path.join(runDir, "execution-log.md");
fs.writeFileSync(executionLog, lines.join("\n"));
writeJson(path.join(runDir, "summary.json"), {
  manifest: path.relative(root, manifestFile),
  started_at: startedAt,
  finished_at: finishedAt,
  versions,
  cases: caseResults,
});
process.stdout.write(`${path.relative(root, executionLog)}\n`);
