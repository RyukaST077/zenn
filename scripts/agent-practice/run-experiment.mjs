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
const die = (message) => { console.error(message); process.exit(2); };
if (!input) die("usage: run-experiment.mjs <manifest.json>");
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

function commandResult(command, args, options = {}) {
  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd: options.cwd || root,
    encoding: "utf8",
    timeout: options.timeoutMs,
    maxBuffer: 50 * 1024 * 1024,
    env: process.env,
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

const caseResults = [];
try {
  for (const item of manifest.cases) {
    const caseTemp = path.join(tempRoot, item.id);
    const snapshot = path.join(tempRoot, `${item.id}-input`);
    const evidenceRelative = `${runRelative}/${item.id}`;
    const evidenceDir = path.join(root, evidenceRelative);
    fs.mkdirSync(evidenceDir, { recursive: true });
    fs.cpSync(path.resolve(root, manifest.fixture), caseTemp, { recursive: true });
    if (item.guidance) {
      fs.copyFileSync(path.resolve(root, item.guidance), path.join(caseTemp, path.basename(item.guidance)));
    }
    fs.cpSync(caseTemp, snapshot, { recursive: true });

    let args;
    let outputFile = path.join(evidenceDir, "result.txt");
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
        ...(fs.existsSync(path.join(caseTemp, ".codex/hooks.json"))
          ? ["--dangerously-bypass-hook-trust"]
          : []),
        "--sandbox", "workspace-write", "--skip-git-repo-check", "-C", caseTemp,
        "-c", `sandbox_workspace_write.network_access=${manifest.network}`,
        "--json", "-o", outputFile,
      ];
      if (item.model) args.push("--model", item.model);
      if (item.effort) args.push("-c", `model_reasoning_effort=\"${item.effort}\"`);
      args.push(manifest.prompt);
    }

    const agent = commandResult(binaries[item.provider], args, {
      cwd: caseTemp,
      timeoutMs: manifest.timeout_seconds * 1000,
    });
    const scrubWorkspace = (value) => redactText(value).split(tempRoot).join("$RUN_WORKSPACE");
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

    const changed = changedFiles(snapshot, caseTemp);
    const protectedChanged = manifest.verification.protected_paths.filter((name) => (
      digest(path.join(snapshot, name)) !== digest(path.join(caseTemp, name))
    ));
    const allowed = new Set(manifest.verification.allowed_changes);
    const unexpected = changed.filter((name) => !allowed.has(name));
    const markerPath = path.join(caseTemp, manifest.verification.marker_file);
    const marker = fs.existsSync(markerPath) ? fs.readFileSync(markerPath, "utf8").trimEnd() : null;
    const markerMatches = marker === item.expected_marker;
    const passed = agent.code === 0 && verifier.code === 0 && protectedChanged.length === 0
      && unexpected.length === 0 && markerMatches;

    const diff = commandResult("git", ["diff", "--no-index", "--no-ext-diff", "--", snapshot, caseTemp], {
      cwd: root, timeoutMs: 30_000,
    });
    const displayDiff = redactText(`${diff.stdout}${diff.stderr}`)
      .split(tempRoot).join("$RUN_WORKSPACE");
    fs.writeFileSync(path.join(evidenceDir, "diff.patch"), displayDiff);
    writeJson(path.join(evidenceDir, "command.json"), {
      executable: binaries[item.provider],
      args: args.map((part) => redactText(part).split(tempRoot).join("$RUN_WORKSPACE")),
      cwd: "$RUN_WORKSPACE",
    });

    const metrics = {
      id: item.id,
      provider: item.provider,
      provider_version: versions[item.provider],
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
      marker_observed: marker,
      marker_matches: markerMatches,
      protected_paths_changed: protectedChanged,
      changed_files: changed,
      unexpected_changes: unexpected,
      passed,
    };
    writeJson(path.join(evidenceDir, "metrics.json"), metrics);
    const preservedWorkspace = path.join(runDir, "work", item.id);
    fs.mkdirSync(path.dirname(preservedWorkspace), { recursive: true });
    fs.cpSync(caseTemp, preservedWorkspace, { recursive: true });
    caseResults.push({ ...metrics, evidence: evidenceRelative });
  }
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
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
  "- Each case ran in a fresh temporary directory. Final workspaces were copied under the ignored `work/` directory.",
  `- Manifest network setting: \`${manifest.network}\`. The runner enforces it through the Codex workspace sandbox only; it does not OS-isolate Claude host processes.`,
  "",
  "## Case results",
  "",
  "| Case | Provider | Guidance | Agent exit | Duration ms | Verifier | Marker | Protected | Unexpected | Passed |",
  "|---|---|---|---:|---:|---:|---|---|---|---|",
  ...caseResults.map((item) => `| ${escaped(item.id)} | ${escaped(item.provider)} | ${escaped(item.guidance)} | ${item.agent_exit_code} | ${item.duration_ms} | ${item.verifier_exit_code} | ${escaped(item.marker_observed)} | ${escaped(item.protected_paths_changed.join(", ") || "none")} | ${escaped(item.unexpected_changes.join(", ") || "none")} | ${item.passed ? "yes" : "no"} |`),
  "",
  "## Recorded observations",
  "",
  ...caseResults.map((item) => `- \`${item.id}\`: exit=${item.agent_exit_code}, verifier=${item.verifier_exit_code}, marker=${JSON.stringify(item.marker_observed)}, changed=${item.changed_files.length}, passed=${item.passed}.`),
  "",
  "## Evidence inventory",
  "",
  ...caseResults.map((item) => `- \`${item.evidence}/\`: \`command.json\`, \`events.jsonl\`, \`stderr.log\`, \`result.txt\`, \`verify.log\`, \`diff.patch\`, \`metrics.json\``),
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
