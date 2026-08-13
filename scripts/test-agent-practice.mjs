#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { redactText, redactValue } from "./agent-practice/redact.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const token = `${process.pid}-${Date.now()}`;
const reportRelative = `research/agent/test-agent-runner-${token}.md`;
const planRelative = `practice/agent/test-agent-runner-${token}.md`;
const manifestRelative = `practice/agent/test-agent-runner-${token}.json`;
const analysisRelative = `logs/agent/test-agent-analysis-${token}.md`;
const report = path.join(root, reportRelative);
const plan = path.join(root, planRelative);
const manifest = path.join(root, manifestRelative);
const analysis = path.join(root, analysisRelative);
const fakeDir = fs.mkdtempSync(path.join(os.tmpdir(), "zenn-agent-fake-cli-"));
const fakeCli = path.join(fakeDir, "fake-cli.mjs");
let generatedRun = null;

const run = (command, args, options = {}) => spawnSync(command, args, {
  cwd: root,
  encoding: "utf8",
  env: { ...process.env, ...options.env },
});

try {
  const shellSyntax = run("bash", ["-n", "scripts/auto-agent-practice.sh", "scripts/auto-agent-practice-launchd.sh"]);
  assert.equal(shellSyntax.status, 0, shellSyntax.stderr);
  const dryRun = run("bash", ["scripts/auto-agent-practice.sh", "--scheduled", "--dry-run"]);
  assert.equal(dryRun.status, 0, dryRun.stderr);
  assert.match(dryRun.stdout, /scheduled: 1/);
  assert.match(dryRun.stdout, /Current practical Claude Code or OpenAI Codex know-how/);
  assert.doesNotMatch(dryRun.stdout, /first end-to-end proof/);

  assert.ok(!redactText(`${os.homedir()}/${os.userInfo().username}/fixture`).includes(os.userInfo().username));
  assert.equal(redactValue({ signature: "opaque-thinking-signature" }).signature, "[REDACTED]");
  fs.mkdirSync(path.dirname(report), { recursive: true });
  fs.mkdirSync(path.dirname(plan), { recursive: true });
  fs.writeFileSync(report, "# Test research report\n");
  fs.writeFileSync(plan, "# Test practice plan\n");
  fs.writeFileSync(fakeCli, `#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
const args = process.argv.slice(2);
const provider = process.env.FAKE_PROVIDER;
if (args.includes("--version")) { console.log(provider + " fake-1.0.0"); process.exit(0); }
if ((provider === "claude" && args[0] === "auth" && args[1] === "status")
    || (provider === "codex" && args[0] === "login" && args[1] === "status")) {
  console.log("authenticated"); process.exit(0);
}
const cIndex = args.indexOf("-C");
if (cIndex >= 0) process.chdir(args[cIndex + 1]);
fs.writeFileSync(path.join(process.cwd(), "src/greet.js"),
  'export function greet(name) { return "Hello, " + name + "!"; }\\n');
const guided = fs.existsSync(path.join(process.cwd(), provider === "claude" ? "CLAUDE.md" : "AGENTS.md"));
if (guided) fs.writeFileSync(path.join(process.cwd(), "verification.txt"), "AGENT_RULE_APPLIED\\n");
const outputIndex = args.indexOf("-o");
if (outputIndex >= 0) fs.writeFileSync(args[outputIndex + 1], "fake result\\n");
console.log(JSON.stringify(provider === "claude"
  ? { type: "result", result: "fake result" }
  : { type: "item.completed", item: { type: "agent_message", text: "fake result" } }));
`, { mode: 0o755 });

  const cases = [
    ["claude-baseline", "claude", null, null],
    ["claude-guided", "claude", "fixtures/agent-practice/guidance/claude/CLAUDE.md", "AGENT_RULE_APPLIED"],
    ["codex-baseline", "codex", null, null],
    ["codex-guided", "codex", "fixtures/agent-practice/guidance/codex/AGENTS.md", "AGENT_RULE_APPLIED"],
  ].map(([id, provider, guidance, expected_marker]) => ({
    id, provider, guidance, model: null, effort: null, expected_marker,
  }));
  fs.writeFileSync(manifest, `${JSON.stringify({
    version: 1,
    id: `runner-test-${process.pid}`,
    topic: "runner test",
    claim: "the deterministic runner records each case",
    mode: "ablation",
    source_report: reportRelative,
    plan: planRelative,
    fixture: "fixtures/agent-practice/instruction-loading",
    prompt: "Implement greet, run node test.mjs, and obey project instructions.",
    timeout_seconds: 30,
    network: false,
    cases,
    verification: {
      command: ["node", "test.mjs"],
      marker_file: "verification.txt",
      protected_paths: ["test.mjs", "package.json"],
      allowed_changes: ["src/greet.js", "verification.txt"],
    },
  }, null, 2)}\n`);

  const valid = run(process.execPath, ["scripts/agent-practice/validate-manifest.mjs", manifestRelative]);
  assert.equal(valid.status, 0, valid.stderr);

  const invalidObject = JSON.parse(fs.readFileSync(manifest, "utf8"));
  invalidObject.unexpected = true;
  const invalid = path.join(fakeDir, "invalid.json");
  fs.writeFileSync(invalid, JSON.stringify(invalidObject));
  const invalidResult = run(process.execPath, ["scripts/agent-practice/validate-manifest.mjs", invalid]);
  assert.notEqual(invalidResult.status, 0, "manifest with an extra field unexpectedly passed");

  const schema = path.join(fakeDir, "analysis.schema.json");
  const schemaResult = run(process.execPath, ["scripts/agent-stage-result-contract.mjs", "schema", "analyze", schema]);
  assert.equal(schemaResult.status, 0, schemaResult.stderr);
  const parsedSchema = JSON.parse(fs.readFileSync(schema, "utf8"));
  assert.ok(parsedSchema.properties.metadata.properties.verdict.enum.includes("conditional"));
  assert.ok(parsedSchema.properties.metadata.properties.action.enum.includes("draft"));
  const marker = path.join(fakeDir, "stage.marker");
  fs.writeFileSync(marker, "");
  fs.mkdirSync(path.dirname(analysis), { recursive: true });
  fs.writeFileSync(analysis, "# Test analysis\n\nverdict: conditional\naction: draft\n");
  const stageResult = path.join(fakeDir, "stage-result.json");
  fs.writeFileSync(stageResult, JSON.stringify({
    status: "ok",
    artifact: analysisRelative,
    reason: "",
    metadata: { verdict: "conditional", action: "draft", slug: null },
  }));
  const contractPass = run(process.execPath, [
    "scripts/validate-agent-stage-result.mjs", stageResult, "logs/agent", marker, "analyze",
  ]);
  assert.equal(contractPass.status, 0, contractPass.stderr);
  const mismatched = JSON.parse(fs.readFileSync(stageResult, "utf8"));
  mismatched.metadata.action = "rerun";
  fs.writeFileSync(stageResult, JSON.stringify(mismatched));
  const contractFailure = run(process.execPath, [
    "scripts/validate-agent-stage-result.mjs", stageResult, "logs/agent", marker, "analyze",
  ]);
  assert.notEqual(contractFailure.status, 0, "mismatched analysis metadata unexpectedly passed");

  const wrapperClaude = path.join(fakeDir, "claude");
  const wrapperCodex = path.join(fakeDir, "codex");
  fs.writeFileSync(wrapperClaude, `#!/bin/sh\nFAKE_PROVIDER=claude exec ${JSON.stringify(fakeCli)} "$@"\n`, { mode: 0o755 });
  fs.writeFileSync(wrapperCodex, `#!/bin/sh\nFAKE_PROVIDER=codex exec ${JSON.stringify(fakeCli)} "$@"\n`, { mode: 0o755 });
  const experiment = run(process.execPath, ["scripts/agent-practice/run-experiment.mjs", manifestRelative], {
    env: { CLAUDE_BIN: wrapperClaude, CODEX_BIN: wrapperCodex },
  });
  assert.equal(experiment.status, 0, `${experiment.stdout}\n${experiment.stderr}`);
  const executionLogRelative = experiment.stdout.trim();
  assert.match(executionLogRelative, /^logs\/agent\/run-runner-test-/);
  generatedRun = path.dirname(path.join(root, executionLogRelative));
  const summary = JSON.parse(fs.readFileSync(path.join(generatedRun, "summary.json"), "utf8"));
  assert.equal(summary.cases.length, 4);
  assert.ok(summary.cases.every((item) => item.passed), JSON.stringify(summary.cases, null, 2));
  assert.equal(summary.cases.find((item) => item.id === "claude-baseline").network_enforcement,
    "not-enforced-for-claude-host-process");
  assert.equal(summary.cases.find((item) => item.id === "codex-guided").network_enforcement,
    "codex-workspace-sandbox");
  assert.equal(summary.cases.find((item) => item.id === "claude-guided").marker_observed, "AGENT_RULE_APPLIED");
  assert.equal(summary.cases.find((item) => item.id === "codex-baseline").marker_observed, null);

  console.log("AI agent practice runner tests passed");
} finally {
  for (const file of [report, plan, manifest, analysis]) fs.rmSync(file, { force: true });
  if (generatedRun) fs.rmSync(generatedRun, { recursive: true, force: true });
  fs.rmSync(fakeDir, { recursive: true, force: true });
}
