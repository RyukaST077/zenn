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
const additionalManifests = [];
const additionalRuns = [];
const generatedRunIds = [];

const run = (command, args, options = {}) => spawnSync(command, args, {
  cwd: root,
  encoding: "utf8",
  env: { ...process.env, ...options.env },
});

const runAt = (cwd, command, args, options = {}) => spawnSync(command, args, {
  cwd,
  encoding: "utf8",
  env: { ...process.env, ...options.env },
});

const assertRun = (result, label) => {
  assert.equal(result.status, 0, `${label}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
};

const testSafeSync = () => {
  const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zenn-safe-sync-test-"));
  const remote = path.join(testRoot, "remote.git");
  const checkout = path.join(testRoot, "checkout");
  const publisher = path.join(testRoot, "publisher");
  try {
    fs.mkdirSync(checkout, { recursive: true });
    assertRun(runAt(checkout, "git", ["init", "-b", "main"]), "safe-sync git init");
    assertRun(runAt(checkout, "git", ["config", "user.name", "Safe Sync Test"]), "safe-sync user.name");
    assertRun(runAt(checkout, "git", ["config", "user.email", "safe-sync@example.com"]), "safe-sync user.email");
    fs.writeFileSync(path.join(checkout, "README.md"), "# safe sync\n");
    fs.mkdirSync(path.join(checkout, "knowledge"), { recursive: true });
    fs.writeFileSync(path.join(checkout, "knowledge/INDEX.md"), "# shared baseline\n");
    assertRun(runAt(checkout, "git", ["add", "README.md", "knowledge/INDEX.md"]), "safe-sync add");
    assertRun(runAt(checkout, "git", ["commit", "-m", "base"]), "safe-sync commit");
    assertRun(runAt(testRoot, "git", ["init", "--bare", remote]), "safe-sync bare remote");
    assertRun(runAt(checkout, "git", ["remote", "add", "origin", remote]), "safe-sync remote add");
    assertRun(runAt(checkout, "git", ["push", "-u", "origin", "main"]), "safe-sync push base");
    assertRun(runAt(testRoot, "git", ["clone", "-b", "main", remote, publisher]), "safe-sync publisher clone");
    assertRun(runAt(publisher, "git", ["config", "user.name", "Safe Sync Publisher"]), "safe-sync publisher name");
    assertRun(runAt(publisher, "git", ["config", "user.email", "publisher@example.com"]), "safe-sync publisher email");

    const localKnowledge = "# shared baseline\n\n- local-only finding\n";
    fs.writeFileSync(path.join(checkout, "knowledge/INDEX.md"), localKnowledge);

    fs.mkdirSync(path.join(checkout, "articles"), { recursive: true });
    fs.mkdirSync(path.join(publisher, "articles"), { recursive: true });
    const articleText = "merged unpublished article\n";
    fs.writeFileSync(path.join(checkout, "articles/merged.md"), articleText);
    fs.writeFileSync(path.join(publisher, "articles/merged.md"), articleText);
    assertRun(runAt(publisher, "git", ["add", "articles/merged.md"]), "safe-sync publisher add");
    assertRun(runAt(publisher, "git", ["commit", "-m", "queue article"]), "safe-sync publisher commit");
    assertRun(runAt(publisher, "git", ["push", "origin", "main"]), "safe-sync publisher push");

    const identical = runAt(checkout, "bash", [path.join(root, "scripts/safe-sync-main.sh"), "main"]);
    assertRun(identical, "safe-sync identical merged duplicate");
    assert.match(identical.stderr, /removed byte-identical merged duplicate/);
    assert.equal(fs.readFileSync(path.join(checkout, "articles/merged.md"), "utf8"), articleText);
    assert.equal(fs.readFileSync(path.join(checkout, "knowledge/INDEX.md"), "utf8"), localKnowledge);
    assert.match(runAt(checkout, "git", ["status", "--porcelain"]).stdout, /knowledge\/INDEX\.md/);

    fs.writeFileSync(path.join(checkout, "README.md"), "# unsafe local change\n");
    const dirtyTracked = runAt(checkout, "bash", [path.join(root, "scripts/safe-sync-main.sh"), "main"]);
    assert.notEqual(dirtyTracked.status, 0, "safe-sync accepted a tracked change outside knowledge/");
    assert.match(dirtyTracked.stderr, /outside local knowledge\/ contain uncommitted changes/);
    fs.writeFileSync(path.join(checkout, "README.md"), "# safe sync\n");

    fs.writeFileSync(path.join(checkout, "articles/conflict.md"), "local evidence\n");
    fs.writeFileSync(path.join(publisher, "articles/conflict.md"), "remote article\n");
    assertRun(runAt(publisher, "git", ["add", "articles/conflict.md"]), "safe-sync conflict add");
    assertRun(runAt(publisher, "git", ["commit", "-m", "conflicting article"]), "safe-sync conflict commit");
    assertRun(runAt(publisher, "git", ["push", "origin", "main"]), "safe-sync conflict push");
    const conflict = runAt(checkout, "bash", [path.join(root, "scripts/safe-sync-main.sh"), "main"]);
    assert.notEqual(conflict.status, 0, "safe-sync overwrote differing local evidence");
    assert.match(conflict.stderr, /untracked file differs/);
    assert.equal(fs.readFileSync(path.join(checkout, "articles/conflict.md"), "utf8"), "local evidence\n");
  } finally {
    fs.rmSync(testRoot, { recursive: true, force: true });
  }
};

const testPublicationFlow = ({ autoMerge, failPrepare = false, failPrCreate = false }) => {
  const publishRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zenn-agent-publish-test-"));
  const remote = path.join(publishRoot, "remote.git");
  const checkout = path.join(publishRoot, "checkout");
  const bin = path.join(publishRoot, "bin");
  const ghLog = path.join(publishRoot, "gh.log");
  const article = "articles/integration-publish-fixture.md";
  const review = "logs/agent/review-integration-publish-fixture.md";
  const pipeline = "logs/agent/pipeline-integration-publish-fixture";
  const slug = "integration-publish-fixture";
  try {
    fs.mkdirSync(checkout, { recursive: true });
    fs.mkdirSync(bin, { recursive: true });
    assertRun(runAt(checkout, "git", ["init", "-b", "main"]), "git init");
    assertRun(runAt(checkout, "git", ["config", "user.name", "Agent Publish Test"]), "git user.name");
    assertRun(runAt(checkout, "git", ["config", "user.email", "agent-publish@example.com"]), "git user.email");
    fs.mkdirSync(path.join(checkout, "articles"), { recursive: true });
    fs.writeFileSync(path.join(checkout, article), `---
title: "Integration publication fixture"
emoji: "🧪"
type: tech
topics: ["codex", "test"]
published: false
---

Publication fixture body.
`);
    fs.writeFileSync(path.join(checkout, "README.md"), "# publication integration fixture\n");
    fs.mkdirSync(path.join(checkout, "knowledge"), { recursive: true });
    fs.writeFileSync(path.join(checkout, "knowledge/INDEX.md"), "# shared knowledge\n");
    assertRun(runAt(checkout, "git", ["add", "articles", "README.md", "knowledge/INDEX.md"]), "git add fixture");
    assertRun(runAt(checkout, "git", ["commit", "-m", "fixture"]), "git commit fixture");
    assertRun(runAt(publishRoot, "git", ["init", "--bare", remote]), "git init bare");
    assertRun(runAt(checkout, "git", ["remote", "add", "origin", remote]), "git remote add");
    assertRun(runAt(checkout, "git", ["push", "-u", "origin", "main"]), "git push main");

    const localKnowledge = "# shared knowledge\n\n- local-only finding\n";
    fs.writeFileSync(path.join(checkout, "knowledge/INDEX.md"), localKnowledge);

    fs.mkdirSync(path.join(checkout, path.dirname(review)), { recursive: true });
    fs.writeFileSync(path.join(checkout, review), `# Integration review

verdict: pass
blockers: 0
warnings: 0
editorial_score: 90/100
`);

    const fakeCodex = path.join(bin, "codex");
    fs.writeFileSync(fakeCodex, `#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
const args = process.argv.slice(2);
if (args[0] === "login" && args[1] === "status") process.exit(0);
if (process.env.FAKE_PREPARE_FAILURE === "1") process.exit(9);
const worktree = args[args.indexOf("-C") + 1];
const output = args[args.indexOf("-o") + 1];
const article = process.env.FAKE_ARTICLE;
const pipeline = process.env.FAKE_PIPELINE;
const slug = path.basename(article, ".md");
const articlePath = path.join(worktree, article);
const draft = fs.readFileSync(articlePath, "utf8");
fs.writeFileSync(articlePath, draft.replace("published: false", "published: true"));
fs.mkdirSync(path.join(worktree, pipeline), { recursive: true });
const body = path.join(pipeline, "pr-body.md");
const metadata = path.join(pipeline, "pr-metadata.json");
fs.writeFileSync(path.join(worktree, body), "# Publish integration fixture\\n");
fs.writeFileSync(path.join(worktree, metadata), JSON.stringify({
  title: "Publish integration fixture",
  body_file: body,
}));
fs.writeFileSync(output, JSON.stringify({
  status: "ok",
  artifact: article,
  reason: "",
  metadata: { verdict: null, slug, pr_metadata: metadata },
}));
console.log(JSON.stringify({ type: "turn.completed" }));
`, { mode: 0o755 });

    const fakeGh = path.join(bin, "gh");
    fs.writeFileSync(fakeGh, `#!/bin/sh
printf '%s\\n' "$*" >> "$FAKE_GH_LOG"
if [ "$1" = auth ] && [ "$2" = status ]; then exit 0; fi
if [ "$1" = pr ] && [ "$2" = create ]; then
  if [ "$FAKE_PR_CREATE_FAILURE" = 1 ]; then exit 7; fi
  echo "https://example.invalid/pull/1"
  exit 0
fi
if [ "$1" = pr ] && [ "$2" = merge ]; then exit 0; fi
exit 2
`, { mode: 0o755 });

    const result = runAt(checkout, "bash", [
      path.join(root, "scripts/agent-practice/publish-reviewed-article.sh"),
      "--article", article,
      "--review", review,
      "--pipeline", pipeline,
      autoMerge ? "--auto-merge" : "--pr-only",
    ], {
      env: {
        PATH: `${bin}:${process.env.PATH}`,
        CODEX_BIN: fakeCodex,
        FAKE_ARTICLE: article,
        FAKE_PIPELINE: pipeline,
        FAKE_GH_LOG: ghLog,
        FAKE_PREPARE_FAILURE: failPrepare ? "1" : "0",
        FAKE_PR_CREATE_FAILURE: failPrCreate ? "1" : "0",
      },
    });

    const branch = runAt(checkout, "git", ["branch", "--show-current"]);
    assert.equal(branch.stdout.trim(), "main", "publication flow changed the caller checkout branch");
    const worktrees = runAt(checkout, "git", ["worktree", "list", "--porcelain"]);
    assert.equal((worktrees.stdout.match(/^worktree /gm) || []).length, 1,
      `temporary worktree leaked:\n${worktrees.stdout}`);
    assert.match(fs.readFileSync(path.join(checkout, article), "utf8"), /published: false/);
    assert.equal(fs.readFileSync(path.join(checkout, "knowledge/INDEX.md"), "utf8"), localKnowledge);

    if (failPrepare) {
      assert.notEqual(result.status, 0, "prepare failure unexpectedly succeeded");
      assert.match(result.stderr, /prepare_publish failed with exit 9/);
      return;
    }
    if (failPrCreate) {
      assert.notEqual(result.status, 0, "PR creation failure unexpectedly succeeded");
      assert.match(result.stderr, /PR creation failed/);
      return;
    }

    assertRun(result, `publication helper (${autoMerge ? "auto-merge" : "pr-only"})`);
    assert.match(result.stdout, /PR: https:\/\/example\.invalid\/pull\/1/);
    const remoteArticle = runAt(checkout, "git", [
      `--git-dir=${remote}`, "show", `refs/heads/publish/${slug}:${article}`,
    ]);
    assertRun(remoteArticle, "read published remote article");
    assert.match(remoteArticle.stdout, /published: true/);
    const remoteKnowledge = runAt(checkout, "git", [
      `--git-dir=${remote}`, "show", `refs/heads/publish/${slug}:knowledge/INDEX.md`,
    ]);
    assertRun(remoteKnowledge, "read publication branch knowledge baseline");
    assert.equal(remoteKnowledge.stdout, "# shared knowledge\n",
      "local-only knowledge leaked into the publication branch");
    const calls = fs.readFileSync(ghLog, "utf8");
    assert.match(calls, /pr create/);
    if (autoMerge) assert.match(calls, /pr merge/);
    else assert.doesNotMatch(calls, /pr merge/);
  } finally {
    fs.rmSync(publishRoot, { recursive: true, force: true });
  }
};

// The one path nobody had ever exercised end to end: allocate an arm, register
// a contract from the research report, ship article + contract + queue in one
// commit, merge it, then read the arm allocator out of a FRESH worktree built
// from the merged branch. Every stage of this reported success for three days
// while the treatment arm stayed at 0/12, because each stage was only tested in
// isolation. The assertion that matters is the last one: B goes from 0 to 1.
const testArmRoundTrip = () => {
  const armRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zenn-agent-arm-roundtrip-"));
  const remote = path.join(armRoot, "remote.git");
  const checkout = path.join(armRoot, "checkout");
  const bin = path.join(armRoot, "bin");
  const ghLog = path.join(armRoot, "gh.log");
  const slug = "arm-roundtrip-fixture";
  const article = `articles/${slug}.md`;
  const review = `logs/agent/review-${slug}.md`;
  const pipeline = `logs/agent/pipeline-${slug}`;
  const report = "research/agent/agent-knowhow-arm-roundtrip.md";
  const nextArmIn = (cwd) => {
    const result = runAt(cwd, "node", [path.join(cwd, "scripts/analytics/next-arm.mjs"), "--json"]);
    assertRun(result, `next-arm in ${cwd}`);
    return JSON.parse(result.stdout);
  };
  try {
    fs.mkdirSync(checkout, { recursive: true });
    fs.mkdirSync(bin, { recursive: true });
    assertRun(runAt(checkout, "git", ["init", "-b", "main"]), "arm git init");
    assertRun(runAt(checkout, "git", ["config", "user.name", "Arm Round Trip"]), "arm git user.name");
    assertRun(runAt(checkout, "git", ["config", "user.email", "arm@example.com"]), "arm git user.email");

    // The loop's real inputs, so the allocator answers the question it answers
    // in production rather than one shaped by the fixture.
    for (const relative of [
      "strategy/topic-selection-policy.json",
      "experiments/EXP-001.json",
      "scripts/analytics/next-arm.mjs",
      "scripts/analytics/register-article.mjs",
      "scripts/analytics/zenn-metrics-lib.mjs",
      "scripts/zenn-publish-queue.mjs",
    ]) {
      fs.mkdirSync(path.join(checkout, path.dirname(relative)), { recursive: true });
      fs.copyFileSync(path.join(root, relative), path.join(checkout, relative));
    }
    fs.mkdirSync(path.join(checkout, "articles"), { recursive: true });
    fs.mkdirSync(path.join(checkout, "config"), { recursive: true });
    fs.mkdirSync(path.join(checkout, "analytics/contracts"), { recursive: true });
    fs.writeFileSync(path.join(checkout, "config/zenn-publish-queue.json"), `${JSON.stringify({
      version: 1,
      zennUsername: "clopy",
      maxPublicationsPer24Hours: 2,
      retryAfterHours: 12,
      maxAttempts: 15,
      entries: [],
    }, null, 2)}\n`);
    assertRun(runAt(checkout, "git", ["add", "-A"]), "arm git add fixture");
    assertRun(runAt(checkout, "git", ["commit", "-m", "loop fixture"]), "arm git commit fixture");
    assertRun(runAt(armRoot, "git", ["init", "--bare", remote]), "arm git init bare");
    assertRun(runAt(checkout, "git", ["remote", "add", "origin", remote]), "arm git remote add");
    assertRun(runAt(checkout, "git", ["push", "-u", "origin", "main"]), "arm git push main");

    // 1. Allocate. The treatment arm is empty, so the next article belongs to it.
    const allocated = nextArmIn(checkout);
    assert.equal(allocated.arm, "B-payload", "an empty treatment arm must be filled first");
    assert.equal(allocated.state.treatmentFilled, 0);

    // 2. Register from the research report, under the arm that was allocated.
    fs.mkdirSync(path.join(checkout, path.dirname(report)), { recursive: true });
    fs.writeFileSync(path.join(checkout, report), [
      "# report", "", "## 記事契約", "", "```json",
      JSON.stringify({
        slug,
        policyVersion: "2026-09-05.1",
        experimentId: allocated.experimentId,
        arm: allocated.arm,
        valueArchetype: allocated.valueArchetypes[0],
        targetReader: "権限設定でつまずいている運用者",
        readerDecision: "この設定をそのまま置いてよいか決められる",
        takeaway: "依存なし1ファイルのチェックキット",
        verificationItems: ["redirect", "symlink", "write"],
        titleDraft: "denyはどこまで信用できるか、3経路で確かめる設定",
        primaryTopic: "claudecode",
        topics: ["claudecode", "security"],
        demandEvidence: "同トピック市場の asset 型が平均91.5いいね",
      }, null, 2),
      "```", "",
    ].join("\n"));
    assertRun(
      runAt(checkout, "node", [
        path.join(checkout, "scripts/analytics/register-article.mjs"), "--from-research", report,
      ]),
      "register the allocated arm from the research report",
    );
    const contract = `analytics/contracts/${slug}.json`;
    assert.ok(fs.existsSync(path.join(checkout, contract)), "registration must write the contract file");

    // 3. The article and its review, as the later stages leave them.
    fs.writeFileSync(path.join(checkout, article), `---
title: "Arm round trip fixture"
emoji: "\u{1F9EA}"
type: tech
topics: ["claudecode", "security"]
published: false
---

Round trip fixture body.
`);
    fs.mkdirSync(path.join(checkout, path.dirname(review)), { recursive: true });
    fs.writeFileSync(path.join(checkout, review), "# Integration review\n\nverdict: pass\nblockers: 0\nwarnings: 0\neditorial_score: 90/100\n");
    fs.writeFileSync(path.join(bin, "gh"), `#!/bin/sh
printf '%s\\n' "$*" >> "$FAKE_GH_LOG"
if [ "$1" = auth ] && [ "$2" = status ]; then exit 0; fi
if [ "$1" = pr ] && [ "$2" = create ]; then echo "https://example.invalid/pull/9"; exit 0; fi
if [ "$1" = pr ] && [ "$2" = merge ]; then exit 0; fi
exit 2
`, { mode: 0o755 });

    // 4. Ship it. The gate has to accept the arm it was handed.
    assertRun(
      runAt(checkout, "bash", [
        path.join(root, "scripts/agent-practice/enqueue-reviewed-article.sh"),
        "--article", article,
        "--review", review,
        "--pipeline", pipeline,
        "--review-style", "agent",
        "--expect-arm", allocated.arm,
        "--auto-merge",
      ], {
        env: {
          PATH: `${bin}:${process.env.PATH}`,
          FAKE_GH_LOG: ghLog,
          PUBLISH_QUEUE_NOW: "2026-08-14T03:00:00.000Z",
        },
      }),
      "enqueue the allocated article",
    );

    // 5. The fake gh reports a merge without performing one, so land the branch
    //    on main the way the merged PR would.
    assertRun(
      runAt(checkout, "git", [`--git-dir=${remote}`, "update-ref", "refs/heads/main", `refs/heads/queue/${slug}`]),
      "land the queue branch on main",
    );

    // 6. Read the allocator out of a fresh clone of the merged branch -- the
    //    same thing the next run's worktree does. This is the assertion the
    //    three-day stall would have failed.
    const fresh = path.join(armRoot, "fresh");
    assertRun(runAt(armRoot, "git", ["clone", "-q", remote, fresh]), "clone the merged branch");
    assert.ok(fs.existsSync(path.join(fresh, contract)),
      "the contract must reach main in the same commit as its article");
    assert.equal(
      fs.readFileSync(path.join(fresh, contract), "utf8"),
      fs.readFileSync(path.join(checkout, contract), "utf8"),
      "the contract on main must match the registration byte for byte",
    );
    const after = nextArmIn(fresh);
    assert.equal(after.state.treatmentFilled, 1,
      `the treatment arm must advance to 1 after one merged article, got ${after.state.treatmentFilled}`);
    const queue = JSON.parse(fs.readFileSync(path.join(fresh, "config/zenn-publish-queue.json"), "utf8"));
    assert.equal(queue.entries.length, 1, "the merged commit must also carry the queue entry");
    assert.equal(queue.entries[0].article, article);
  } finally {
    fs.rmSync(armRoot, { recursive: true, force: true });
  }
};

const testQueueFlow = ({ autoMerge, failPrCreate = false, reviewStyle = "agent", withContract = false, armGate = null }) => {
  const publishRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zenn-agent-queue-test-"));
  const remote = path.join(publishRoot, "remote.git");
  const checkout = path.join(publishRoot, "checkout");
  const bin = path.join(publishRoot, "bin");
  const ghLog = path.join(publishRoot, "gh.log");
  const article = "articles/integration-queue-fixture.md";
  const review = reviewStyle === "agent"
    ? "logs/agent/review-integration-queue-fixture.md"
    : "logs/review-integration-queue-fixture.md";
  const pipeline = reviewStyle === "agent"
    ? "logs/agent/pipeline-integration-queue-fixture"
    : `logs/${reviewStyle === "codex" ? "codex-" : ""}pipeline-integration-queue-fixture`;
  const slug = "integration-queue-fixture";
  try {
    fs.mkdirSync(checkout, { recursive: true });
    fs.mkdirSync(bin, { recursive: true });
    assertRun(runAt(checkout, "git", ["init", "-b", "main"]), "queue git init");
    assertRun(runAt(checkout, "git", ["config", "user.name", "Agent Queue Test"]), "queue git user.name");
    assertRun(runAt(checkout, "git", ["config", "user.email", "agent-queue@example.com"]), "queue git user.email");
    fs.mkdirSync(path.join(checkout, "articles"), { recursive: true });
    fs.mkdirSync(path.join(checkout, "config"), { recursive: true });
    fs.writeFileSync(path.join(checkout, article), `---
title: "Integration queue fixture"
emoji: "🧪"
type: tech
topics: ["codex", "test"]
published: false
---

Queue fixture body.
`);
    fs.writeFileSync(path.join(checkout, "config/zenn-publish-queue.json"), `${JSON.stringify({
      version: 1,
      zennUsername: "clopy",
      maxPublicationsPer24Hours: 2,
      retryAfterHours: 6,
      entries: [],
    }, null, 2)}\n`);
    fs.mkdirSync(path.join(checkout, "knowledge"), { recursive: true });
    fs.writeFileSync(path.join(checkout, "knowledge/INDEX.md"), "# shared knowledge\n");
    assertRun(runAt(checkout, "git", ["add", "articles", "config", "knowledge/INDEX.md"]), "queue git add fixture");
    assertRun(runAt(checkout, "git", ["commit", "-m", "fixture"]), "queue git commit fixture");
    assertRun(runAt(publishRoot, "git", ["init", "--bare", remote]), "queue git init bare");
    assertRun(runAt(checkout, "git", ["remote", "add", "origin", remote]), "queue git remote add");
    assertRun(runAt(checkout, "git", ["push", "-u", "origin", "main"]), "queue git push main");

    const localKnowledge = "# shared knowledge\n\n- local-only finding\n";
    fs.writeFileSync(path.join(checkout, "knowledge/INDEX.md"), localKnowledge);

    // The arm allocator counts registrations from analytics/contracts/, and a
    // pipeline run leaves its contract there as an untracked file after the
    // artifact sync. It only reaches the next run's worktree if the queue commit
    // carries it, so the queue flow has to stage it alongside the article.
    const contract = `analytics/contracts/${slug}.json`;
    const contractBody = `${JSON.stringify({
      slug,
      topics: ["codex", "test"],
      primaryTopic: "codex",
      classification: { source: "contract", arm: "B-payload", experimentId: "EXP-001" },
    }, null, 2)}\n`;
    if (withContract) {
      fs.mkdirSync(path.join(checkout, path.dirname(contract)), { recursive: true });
      fs.writeFileSync(path.join(checkout, contract), contractBody);
    }

    fs.mkdirSync(path.join(checkout, path.dirname(review)), { recursive: true });
    const reviewText = reviewStyle === "claude" ? `# 公開前レビュー

## 判定

**判定: 公開可**

- blocker: 0 件 / warning: 0 件 / suggestion: 0 件
` : `# Integration review

verdict: pass
blockers: 0
warnings: 0
${reviewStyle === "agent" ? "editorial_score: 90/100\n" : ""}`;
    fs.writeFileSync(path.join(checkout, review), reviewText);

    const fakeGh = path.join(bin, "gh");
    fs.writeFileSync(fakeGh, `#!/bin/sh
printf '%s\\n' "$*" >> "$FAKE_GH_LOG"
if [ "$1" = auth ] && [ "$2" = status ]; then exit 0; fi
if [ "$1" = pr ] && [ "$2" = create ]; then
  if [ "$FAKE_PR_CREATE_FAILURE" = 1 ]; then exit 7; fi
  echo "https://example.invalid/pull/2"
  exit 0
fi
if [ "$1" = pr ] && [ "$2" = merge ]; then exit 0; fi
exit 2
`, { mode: 0o755 });

    const result = runAt(checkout, "bash", [
      path.join(root, "scripts/agent-practice/enqueue-reviewed-article.sh"),
      "--article", article,
      "--review", review,
      "--pipeline", pipeline,
      "--review-style", reviewStyle,
      ...(armGate === "missing" ? ["--require-contract"] : []),
      ...(armGate === "match" ? ["--expect-arm", "B-payload"] : []),
      ...(armGate === "mismatch" ? ["--expect-arm", "A-baseline"] : []),
      autoMerge ? "--auto-merge" : "--pr-only",
    ], {
      env: {
        PATH: `${bin}:${process.env.PATH}`,
        FAKE_GH_LOG: ghLog,
        FAKE_PR_CREATE_FAILURE: failPrCreate ? "1" : "0",
        PUBLISH_QUEUE_NOW: "2026-08-14T03:00:00.000Z",
      },
    });

    const branch = runAt(checkout, "git", ["branch", "--show-current"]);
    assert.equal(branch.stdout.trim(), "main", "queue flow changed the caller checkout branch");
    const worktrees = runAt(checkout, "git", ["worktree", "list", "--porcelain"]);
    assert.equal((worktrees.stdout.match(/^worktree /gm) || []).length, 1,
      `temporary queue worktree leaked:\n${worktrees.stdout}`);
    assert.match(fs.readFileSync(path.join(checkout, article), "utf8"), /published: false/);
    assert.equal(fs.readFileSync(path.join(checkout, "knowledge/INDEX.md"), "utf8"), localKnowledge);

    if (failPrCreate) {
      assert.notEqual(result.status, 0, "queue PR creation failure unexpectedly succeeded");
      assert.match(result.stderr, /PR creation failed/);
      return;
    }

    // A run that allocated an arm and then loses its contract -- or writes one
    // for a different arm -- must stop here. Publishing anyway is the failure
    // that kept EXP-001 at 0/12 while every stage reported success, so the
    // check has to land before the push rather than in a later reconciliation.
    if (armGate === "missing" || armGate === "mismatch") {
      assert.notEqual(result.status, 0, `${armGate} contract unexpectedly reached the push`);
      assert.match(
        result.stdout + result.stderr,
        armGate === "missing" ? /no registered contract/ : /contract arm mismatch/,
      );
      const rejected = runAt(checkout, "git", [
        `--git-dir=${remote}`, "rev-parse", "--verify", `refs/heads/queue/${slug}`,
      ]);
      assert.notEqual(rejected.status, 0, "a rejected run must not leave a branch on the remote");
      assert.doesNotMatch(fs.readFileSync(ghLog, "utf8"), /pr create/,
        "a rejected run must not open a PR");
      return;
    }

    assertRun(result, `queue helper (${reviewStyle}, ${autoMerge ? "auto-merge" : "pr-only"})`);
    assert.match(result.stdout, /PR: https:\/\/example\.invalid\/pull\/2/);
    const remoteArticle = runAt(checkout, "git", [
      `--git-dir=${remote}`, "show", `refs/heads/queue/${slug}:${article}`,
    ]);
    assertRun(remoteArticle, "read queued remote article");
    assert.match(remoteArticle.stdout, /published: false/);
    const remoteQueue = runAt(checkout, "git", [
      `--git-dir=${remote}`, "show", `refs/heads/queue/${slug}:config/zenn-publish-queue.json`,
    ]);
    assertRun(remoteQueue, "read remote publication queue");
    const queue = JSON.parse(remoteQueue.stdout);
    assert.equal(queue.entries.length, 1);
    assert.equal(queue.entries[0].article, article);
    const remoteContract = runAt(checkout, "git", [
      `--git-dir=${remote}`, "show", `refs/heads/queue/${slug}:${contract}`,
    ]);
    if (withContract) {
      assertRun(remoteContract, "the queue commit must carry the article's contract");
      assert.equal(remoteContract.stdout, contractBody,
        "the contract on the queue branch must match the registration");
    } else {
      assert.notEqual(remoteContract.status, 0,
        "no contract exists, so the queue branch must not invent one");
    }

    const remoteKnowledge = runAt(checkout, "git", [
      `--git-dir=${remote}`, "show", `refs/heads/queue/${slug}:knowledge/INDEX.md`,
    ]);
    assertRun(remoteKnowledge, "read queued branch knowledge baseline");
    assert.equal(remoteKnowledge.stdout, "# shared knowledge\n",
      "local-only knowledge leaked into the publication queue branch");
    const calls = fs.readFileSync(ghLog, "utf8");
    assert.match(calls, /pr create/);
    if (autoMerge) assert.match(calls, /pr merge/);
    else assert.doesNotMatch(calls, /pr merge/);
  } finally {
    fs.rmSync(publishRoot, { recursive: true, force: true });
  }
};

try {
  const shellSyntax = run("bash", [
    "-n",
    "scripts/auto-agent-practice.sh",
    "scripts/auto-agent-practice-launchd.sh",
    "scripts/run-article-pipeline-worktree.sh",
    "scripts/auto-publish.sh",
    "scripts/auto-publish-launchd.sh",
    "scripts/auto-publish-codex-launchd.sh",
    "scripts/safe-sync-main.sh",
    "scripts/wait-for-claude-usage.sh",
    "scripts/agent-practice/publish-reviewed-article.sh",
    "scripts/agent-practice/enqueue-reviewed-article.sh",
    "scripts/zenn-publish-queue.sh",
    "scripts/zenn-publish-queue-launchd.sh",
  ]);
  assert.equal(shellSyntax.status, 0, shellSyntax.stderr);
  const dryRun = run("bash", ["scripts/auto-agent-practice.sh", "--scheduled", "--dry-run"]);
  assert.equal(dryRun.status, 0, dryRun.stderr);
  assert.match(dryRun.stdout, /scheduled: 1/);
  assert.match(dryRun.stdout, /orchestrator: codex/);
  assert.match(dryRun.stdout, /Current practical Claude Code or OpenAI Codex know-how/);
  assert.match(dryRun.stdout, /auto merge: 1/);
  assert.match(dryRun.stdout, /auto resume at usage limit: 1 \(attempt 0\/8\)/);
  assert.match(dryRun.stdout, /fake-CLI preflight/);
  assert.match(dryRun.stdout, /preflight repairs: 2/);
  assert.match(dryRun.stdout, /fake-CLI preflight <-> plan repair/);
  assert.match(dryRun.stdout, /deterministic experiment runner/);
  assert.doesNotMatch(dryRun.stdout, /zenn-agent-run-practice/);
  assert.match(dryRun.stdout, /publication queue -> commit\/push -> PR -> merge/);
  assert.match(dryRun.stdout, /rate-limited Zenn publication queue/);
  assert.doesNotMatch(dryRun.stdout, /reviewed unpublished/);
  assert.doesNotMatch(dryRun.stdout, /first end-to-end proof/);
  const agentPipelineSource = fs.readFileSync(path.join(root, "scripts/auto-agent-practice.sh"), "utf8");
  assert.match(agentPipelineSource, /existing successful claude auth status or codex login status/);
  assert.match(agentPipelineSource, /do not add --max-budget-usd/);
  assert.match(agentPipelineSource, /Exclude modes such as Claude Code --bare/);
  assert.match(agentPipelineSource, /outcome-specific marker/);
  assert.match(agentPipelineSource, /precise timing, simultaneous tool ordering/);
  assert.match(agentPipelineSource, /do not turn an honest negative result into a verifier failure/);
  assert.match(agentPipelineSource, /artifact must be one existing safe repository-relative regular file/);
  assert.match(agentPipelineSource, /run_experiment_direct/);
  assert.match(agentPipelineSource, /wait_seconds - remaining/,
    "usage-limit progress must be based on elapsed wait time so reset-time remainders still log");
  const prOnlyDryRun = run("bash", ["scripts/auto-agent-practice.sh", "--pr-only", "--dry-run"]);
  assert.equal(prOnlyDryRun.status, 0, prOnlyDryRun.stderr);
  assert.match(prOnlyDryRun.stdout, /auto merge: 0/);
  assert.match(prOnlyDryRun.stdout, /PR -> human merge/);
  const claudeOrchestratorDryRun = run("bash", [
    "scripts/auto-agent-practice.sh", "--orchestrator", "claude", "--dry-run",
  ]);
  assert.equal(claudeOrchestratorDryRun.status, 0, claudeOrchestratorDryRun.stderr);
  assert.match(claudeOrchestratorDryRun.stdout, /orchestrator: claude/);
  const invalidOrchestrator = run("bash", [
    "scripts/auto-agent-practice.sh", "--orchestrator", "invalid", "--dry-run",
  ]);
  assert.equal(invalidOrchestrator.status, 2);
  assert.match(invalidOrchestrator.stderr, /must be codex or claude/);
  const invalidResumeCount = run("bash", [
    "scripts/auto-agent-practice.sh", "--dry-run",
  ], { env: { AGENT_PIPELINE_USAGE_RESUME_COUNT: "invalid" } });
  assert.equal(invalidResumeCount.status, 2);
  assert.match(invalidResumeCount.stderr, /must be a non-negative integer/);
  const invalidPreflightRepairs = run("bash", [
    "scripts/auto-agent-practice.sh", "--dry-run",
  ], { env: { MAX_AGENT_PREFLIGHT_REPAIRS: "invalid" } });
  assert.equal(invalidPreflightRepairs.status, 2);
  assert.match(invalidPreflightRepairs.stderr, /MAX_AGENT_PREFLIGHT_REPAIRS must be a non-negative integer/);
  const invalidSameSystemFailures = run("bash", ["scripts/auto-agent-practice-launchd.sh"], {
    env: { AGENT_PRACTICE_MAX_SAME_SYSTEM_FAILURES: "invalid" },
  });
  assert.equal(invalidSameSystemFailures.status, 2);
  assert.match(invalidSameSystemFailures.stderr,
    /AGENT_PRACTICE_MAX_SAME_SYSTEM_FAILURES must be a positive integer/);
  const resumeDryRun = run("bash", [
    "scripts/auto-agent-practice.sh",
    "--resume-after-run", "logs/agent/run-example/execution-log.md",
    "--dry-run",
  ]);
  assert.equal(resumeDryRun.status, 0, resumeDryRun.stderr);
  assert.match(resumeDryRun.stdout, /resume after run: logs\/agent\/run-example\/execution-log\.md/);

  const usageLimitEvent = path.join(fakeDir, "usage-limit-event.json");
  fs.writeFileSync(usageLimitEvent, JSON.stringify({
    type: "result",
    is_error: true,
    api_error_status: 429,
    result: "You've hit your session limit · resets 2pm (Asia/Tokyo)",
  }));
  const fixedNow = Date.parse("2026-08-20T02:26:00Z");
  const parsedLimit = run(process.execPath, [
    "scripts/claude-usage-limit.mjs", usageLimitEvent, String(fixedNow),
  ]);
  assertRun(parsedLimit, "parse Claude usage reset");
  assert.equal(parsedLimit.stdout, "9240\n2pm (Asia/Tokyo)\n");
  const noLimitEvent = path.join(fakeDir, "no-limit-event.json");
  fs.writeFileSync(noLimitEvent, JSON.stringify({ type: "result", result: "completed" }));
  const noLimit = run(process.execPath, ["scripts/claude-usage-limit.mjs", noLimitEvent]);
  assert.equal(noLimit.status, 1, "non-limit output was misclassified as a usage limit");

  const finderRoot = path.join(fakeDir, "run-log-finder");
  const finderMarker = path.join(finderRoot, "stage.marker");
  const finderRun = path.join(finderRoot, "logs/agent/run-fixture/execution-log.md");
  const finderManifest = "practice/agent/finder-fixture.json";
  fs.mkdirSync(path.dirname(finderRun), { recursive: true });
  fs.writeFileSync(finderMarker, "");
  fs.writeFileSync(finderRun, `# execution\n\n- Manifest: \`${finderManifest}\`\n`);
  fs.utimesSync(finderMarker, new Date(fixedNow - 10_000), new Date(fixedNow - 10_000));
  fs.utimesSync(finderRun, new Date(fixedNow), new Date(fixedNow));
  const foundRun = run(process.execPath, [
    "scripts/find-agent-run-log.mjs", finderMarker, finderManifest, finderRoot,
  ]);
  assertRun(foundRun, "find saved agent run log");
  assert.equal(foundRun.stdout, "logs/agent/run-fixture/execution-log.md");
  const missingRun = run(process.execPath, [
    "scripts/find-agent-run-log.mjs", finderMarker, "practice/agent/missing.json", finderRoot,
  ]);
  assert.equal(missingRun.status, 1, "missing run log unexpectedly matched");
  const retryDir = fs.mkdtempSync(path.join(os.tmpdir(), "zenn-agent-launchd-retry-"));
  const retryScript = path.join(retryDir, "retryable-pipeline.sh");
  const retryCount = path.join(retryDir, "count");
  fs.writeFileSync(retryScript, `#!/bin/bash
count=0
[ ! -f "$FAKE_RETRY_COUNT" ] || count="$(cat "$FAKE_RETRY_COUNT")"
count=$((count + 1))
printf '%s\\n' "$count" >"$FAKE_RETRY_COUNT"
if [ "$count" -le 1 ]; then
  printf 'content|evidence-safe-skip\\n' >"$AGENT_PIPELINE_RETRY_SIGNAL_FILE"
  exit 20
fi
echo "complete: publication queued for articles/fake.md"
exit 0
`, { mode: 0o755 });
  const retryRun = run("bash", ["scripts/auto-agent-practice-launchd.sh"], {
    env: {
      AGENT_PRACTICE_SCRIPT: retryScript,
      AGENT_PRACTICE_ARGS: "--scheduled",
      AGENT_PRACTICE_MAX_ATTEMPTS: "2",
      AGENT_PIPELINE_RETRYABLE_EXIT: "20",
      FAKE_RETRY_COUNT: retryCount,
      AGENT_PRACTICE_LOG_DIR: retryDir,
      AGENT_PRACTICE_STATUS_DIR: path.join(retryDir, "status"),
    },
  });
  assert.equal(retryRun.status, 0, retryRun.stderr);
  assert.equal(fs.readFileSync(retryCount, "utf8").trim(), "2",
    "launchd wrapper must retry one evidence-safe scheduled skip");

  const systemFailureScript = path.join(retryDir, "system-failure-pipeline.sh");
  const systemFailureCount = path.join(retryDir, "system-failure-count");
  const systemFailureStatusDir = path.join(retryDir, "system-failure-status");
  const systemFailureLogDir = path.join(retryDir, "system-failure-logs");
  fs.writeFileSync(systemFailureScript, `#!/bin/bash
count=0
[ ! -f "$FAKE_SYSTEM_FAILURE_COUNT" ] || count="$(cat "$FAKE_SYSTEM_FAILURE_COUNT")"
count=$((count + 1))
printf '%s\\n' "$count" >"$FAKE_SYSTEM_FAILURE_COUNT"
printf 'system|run-experiment-exit-2\\n' >"$AGENT_PIPELINE_RETRY_SIGNAL_FILE"
exit 20
`, { mode: 0o755 });
  const systemFailureRun = run("bash", ["scripts/auto-agent-practice-launchd.sh"], {
    env: {
      AGENT_PRACTICE_SCRIPT: systemFailureScript,
      AGENT_PRACTICE_ARGS: "--scheduled",
      AGENT_PRACTICE_MAX_ATTEMPTS: "5",
      AGENT_PRACTICE_MAX_SAME_SYSTEM_FAILURES: "2",
      AGENT_PIPELINE_RETRYABLE_EXIT: "20",
      FAKE_SYSTEM_FAILURE_COUNT: systemFailureCount,
      AGENT_PRACTICE_LOG_DIR: systemFailureLogDir,
      AGENT_PRACTICE_STATUS_DIR: systemFailureStatusDir,
    },
  });
  assert.equal(systemFailureRun.status, 1, "repeated system failure did not open the circuit breaker");
  assert.equal(fs.readFileSync(systemFailureCount, "utf8").trim(), "2",
    "circuit breaker must stop a repeated system failure after two attempts");
  const systemFailureStatusFiles = fs.readdirSync(systemFailureStatusDir);
  assert.equal(systemFailureStatusFiles.length, 1, "failed launchd run must write one status file");
  const systemFailureStatus = JSON.parse(fs.readFileSync(path.join(
    systemFailureStatusDir, systemFailureStatusFiles[0],
  ), "utf8"));
  assert.equal(systemFailureStatus.status, "failed");
  assert.equal(systemFailureStatus.retry_kind, "system");
  assert.equal(systemFailureStatus.retry_signature, "run-experiment-exit-2");

  const missingSuccessScript = path.join(retryDir, "missing-success-pipeline.sh");
  const missingSuccessStatusDir = path.join(retryDir, "missing-success-status");
  const missingSuccessLogDir = path.join(retryDir, "missing-success-logs");
  fs.writeFileSync(missingSuccessScript, "#!/bin/bash\nexit 0\n", { mode: 0o755 });
  const missingSuccessRun = run("bash", ["scripts/auto-agent-practice-launchd.sh"], {
    env: {
      AGENT_PRACTICE_SCRIPT: missingSuccessScript,
      AGENT_PRACTICE_ARGS: "--scheduled",
      AGENT_PRACTICE_MAX_ATTEMPTS: "1",
      AGENT_PRACTICE_LOG_DIR: missingSuccessLogDir,
      AGENT_PRACTICE_STATUS_DIR: missingSuccessStatusDir,
    },
  });
  assert.equal(missingSuccessRun.status, 1, "missing success contract unexpectedly passed");
  const missingSuccessStatusFiles = fs.readdirSync(missingSuccessStatusDir);
  assert.equal(missingSuccessStatusFiles.length, 1,
    "missing success contract must write one failed status file");
  const missingSuccessStatus = JSON.parse(fs.readFileSync(path.join(
    missingSuccessStatusDir, missingSuccessStatusFiles[0],
  ), "utf8"));
  assert.equal(missingSuccessStatus.status, "failed");
  assert.equal(missingSuccessStatus.exit_code, 1);

  const defaultArgsScript = path.join(retryDir, "default-args-pipeline.sh");
  const defaultArgsFile = path.join(retryDir, "default-args");
  fs.writeFileSync(defaultArgsScript, `#!/bin/bash
printf '%s\\n' "$*" >"$FAKE_DEFAULT_ARGS"
printf '%s|%s\\n' "$AGENT_PIPELINE_MODEL" "$AGENT_PIPELINE_EFFORT" >"$FAKE_DEFAULT_MODEL"
printf '%s\\n' "$AGENT_PIPELINE_USAGE_WAIT_SECONDS_OVERRIDE" >"$FAKE_USAGE_WAIT"
echo "complete: publication queued for articles/fake-default.md"
`, { mode: 0o755 });
  const defaultArgsRun = run("bash", ["scripts/auto-agent-practice-launchd.sh"], {
    env: {
      AGENT_PRACTICE_SCRIPT: defaultArgsScript,
      AGENT_PRACTICE_ARGS: "",
      AGENT_PRACTICE_MAX_ATTEMPTS: "1",
      FAKE_DEFAULT_ARGS: defaultArgsFile,
      FAKE_DEFAULT_MODEL: path.join(retryDir, "default-model"),
      FAKE_USAGE_WAIT: path.join(retryDir, "usage-wait"),
      AGENT_PRACTICE_LOG_DIR: retryDir,
      AGENT_PRACTICE_STATUS_DIR: path.join(retryDir, "default-status"),
    },
  });
  assert.equal(defaultArgsRun.status, 0, defaultArgsRun.stderr);
  assert.equal(fs.readFileSync(defaultArgsFile, "utf8").trim(), "--scheduled --orchestrator claude",
    "launchd wrapper must default to the Claude orchestrator with usage-limit recovery");
  assert.equal(fs.readFileSync(path.join(retryDir, "default-model"), "utf8").trim(),
    "claude-sonnet-5|medium",
    "scheduled Claude pipeline must use the usage-fit model and effort defaults");
  assert.equal(fs.readFileSync(path.join(retryDir, "usage-wait"), "utf8").trim(), "18000",
    "scheduled Claude pipeline must wait five hours after a usage limit");
  fs.rmSync(retryDir, { recursive: true, force: true });
  const claudeDryRun = run("bash", ["scripts/auto-publish.sh", "--dry-run"]);
  assert.equal(claudeDryRun.status, 0, claudeDryRun.stderr);
  assert.match(claudeDryRun.stdout, /published:false \+ 公開キュー追加PR/);
  for (const wrapper of [
    "scripts/auto-publish-launchd.sh",
    "scripts/auto-publish-codex-launchd.sh",
    "scripts/auto-agent-practice-launchd.sh",
  ]) {
    assert.doesNotMatch(fs.readFileSync(path.join(root, wrapper), "utf8"), /pending-count/,
      `${wrapper} must not stop article creation while the publication queue has a backlog`);
  }
  const agentLaunchdSource = fs.readFileSync(path.join(
    root, "scripts/auto-agent-practice-launchd.sh",
  ), "utf8");
  assert.match(agentLaunchdSource, /AGENT_PRACTICE_MAX_ATTEMPTS:=12/,
    "scheduled AI articles must keep searching past a five-topic safe-rejection streak");
  assert.match(agentPipelineSource, /MAX_AGENT_STAGE_CONTRACT_REPAIRS:=1/,
    "AI article stages must repair one invalid artifact contract before abandoning the topic");
  assert.match(agentPipelineSource, /Do not claim an artifact that was not written/,
    "stage contract repair must explicitly require a real artifact");

  testSafeSync();

  testPublicationFlow({ autoMerge: false });
  testPublicationFlow({ autoMerge: true });
  testPublicationFlow({ autoMerge: false, failPrepare: true });
  testPublicationFlow({ autoMerge: false, failPrCreate: true });
  testQueueFlow({ autoMerge: false });
  testQueueFlow({ autoMerge: true });
  testQueueFlow({ autoMerge: true, withContract: true });
  testQueueFlow({ autoMerge: true, withContract: true, armGate: "match" });
  testQueueFlow({ autoMerge: true, withContract: true, armGate: "mismatch" });
  testQueueFlow({ autoMerge: true, withContract: false, armGate: "missing" });
  testArmRoundTrip();
  testQueueFlow({ autoMerge: false, failPrCreate: true });
  testQueueFlow({ autoMerge: false, reviewStyle: "codex" });
  testQueueFlow({ autoMerge: false, reviewStyle: "claude" });

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

  const directV2 = JSON.parse(fs.readFileSync(manifest, "utf8"));
  directV2.version = 2;
  directV2.cases = directV2.cases.map((item) => ({
    ...item,
    execution: {
      mode: "direct",
      wrapper: null,
      preflight_cli: null,
      environment: "inherit",
    },
  }));
  const directV2Manifest = path.join(fakeDir, "direct-v2.json");
  fs.writeFileSync(directV2Manifest, JSON.stringify(directV2));
  assertRun(run(process.execPath, [
    "scripts/agent-practice/validate-manifest.mjs", directV2Manifest,
  ]), "validate direct version 2 manifest");

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
  const resumeMarker = path.join(fakeDir, "resume-stage.marker");
  const resumeBaseline = path.join(fakeDir, "resume-run.md");
  fs.writeFileSync(resumeMarker, "");
  fs.writeFileSync(resumeBaseline, "# Prior run\n");
  const analysisMtime = fs.statSync(analysis).mtimeMs;
  fs.utimesSync(resumeBaseline, new Date(analysisMtime - 2000), new Date(analysisMtime - 2000));
  fs.utimesSync(resumeMarker, new Date(analysisMtime + 2000), new Date(analysisMtime + 2000));
  const staleWithoutResume = run(process.execPath, [
    "scripts/validate-agent-stage-result.mjs", stageResult, "logs/agent", resumeMarker, "analyze",
  ]);
  assert.notEqual(staleWithoutResume.status, 0, "stale stage artifact unexpectedly passed without a resume baseline");
  const reusableAfterRun = run(process.execPath, [
    "scripts/validate-agent-stage-result.mjs", stageResult, "logs/agent", resumeMarker, "analyze", resumeBaseline,
  ]);
  assert.equal(reusableAfterRun.status, 0, reusableAfterRun.stderr);
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
  const directRunStdout = path.join(fakeDir, "direct-run.stdout");
  const directRunMarker = path.join(fakeDir, "direct-run.marker");
  fs.writeFileSync(directRunStdout, experiment.stdout);
  fs.writeFileSync(directRunMarker, "");
  const executionMtime = fs.statSync(path.join(root, executionLogRelative)).mtimeMs;
  fs.utimesSync(directRunMarker, new Date(executionMtime - 1000), new Date(executionMtime - 1000));
  const directRunContract = run(process.execPath, [
    "scripts/validate-agent-run-result.mjs", directRunStdout, manifestRelative, directRunMarker,
  ]);
  assertRun(directRunContract, "validate direct experiment runner artifact");
  assert.equal(directRunContract.stdout, executionLogRelative);

  const emptyDirectRunStdout = path.join(fakeDir, "direct-run-empty.stdout");
  fs.writeFileSync(emptyDirectRunStdout, "");
  const emptyDirectRunContract = run(process.execPath, [
    "scripts/validate-agent-run-result.mjs", emptyDirectRunStdout, manifestRelative, directRunMarker,
  ]);
  assert.notEqual(emptyDirectRunContract.status, 0,
    "empty direct-run artifact unexpectedly passed validation");
  assert.match(emptyDirectRunContract.stderr, /exactly one artifact path/);

  const absoluteDirectRunStdout = path.join(fakeDir, "direct-run-absolute.stdout");
  fs.writeFileSync(absoluteDirectRunStdout, `${path.join(root, executionLogRelative)}\n`);
  const absoluteDirectRunContract = run(process.execPath, [
    "scripts/validate-agent-run-result.mjs", absoluteDirectRunStdout, manifestRelative, directRunMarker,
  ]);
  assert.notEqual(absoluteDirectRunContract.status, 0,
    "absolute direct-run artifact unexpectedly passed validation");
  assert.match(absoluteDirectRunContract.stderr, /safe repository-relative path/);

  const summary = JSON.parse(fs.readFileSync(path.join(generatedRun, "summary.json"), "utf8"));
  assert.equal(summary.cases.length, 4);
  assert.ok(summary.cases.every((item) => item.passed), JSON.stringify(summary.cases, null, 2));
  assert.equal(summary.cases.find((item) => item.id === "claude-baseline").network_enforcement,
    "not-enforced-for-claude-host-process");
  assert.equal(summary.cases.find((item) => item.id === "codex-guided").network_enforcement,
    "codex-workspace-sandbox");
  assert.equal(summary.cases.find((item) => item.id === "claude-guided").marker_observed, "AGENT_RULE_APPLIED");
  assert.equal(summary.cases.find((item) => item.id === "codex-baseline").marker_observed, null);

  const codexHistorical = JSON.parse(fs.readFileSync(path.join(
    root, "practice/agent/agent-practice-codex-exec-jsonl-final-artifact-20260814-0504.json",
  ), "utf8"));
  const codexWrapperId = `runner-wrapper-codex-${process.pid}`;
  generatedRunIds.push(codexWrapperId);
  const codexWrapperManifestRelative = `practice/agent/${codexWrapperId}.json`;
  const codexWrapperManifest = path.join(root, codexWrapperManifestRelative);
  additionalManifests.push(codexWrapperManifest);
  fs.writeFileSync(codexWrapperManifest, `${JSON.stringify({
    ...codexHistorical,
    version: 2,
    id: codexWrapperId,
    source_report: reportRelative,
    plan: planRelative,
    cases: codexHistorical.cases.map((item) => ({
      ...item,
      execution: {
        mode: "fixture-wrapper",
        wrapper: "codex-wrapper.mjs",
        preflight_cli: "preflight-codex.mjs",
        environment: "inherit",
      },
    })),
    verification: {
      ...codexHistorical.verification,
      protected_paths: [...codexHistorical.verification.protected_paths, "preflight-codex.mjs"],
    },
  }, null, 2)}\n`);
  assertRun(run(process.execPath, [
    "scripts/agent-practice/validate-manifest.mjs", codexWrapperManifestRelative,
  ]), "validate Codex wrapper manifest");
  const codexWrapperRun = run(process.execPath, [
    "scripts/agent-practice/run-experiment.mjs", codexWrapperManifestRelative,
  ], {
    env: {
      CODEX_BIN: path.join(root, "fixtures/agent-practice/codex-exec-jsonl-final-artifact/preflight-codex.mjs"),
    },
  });
  assertRun(codexWrapperRun, "Codex wrapper preflight and experiment");
  const codexWrapperRunDir = path.dirname(path.join(root, codexWrapperRun.stdout.trim()));
  additionalRuns.push(codexWrapperRunDir);
  const codexWrapperSummary = JSON.parse(fs.readFileSync(path.join(codexWrapperRunDir, "summary.json"), "utf8"));
  assert.equal(codexWrapperSummary.cases[0].execution_mode, "fixture-wrapper");
  assert.equal(codexWrapperSummary.cases[0].preflight_status, "passed");
  assert.equal(codexWrapperSummary.cases[0].passed, true);
  const codexPreflight = JSON.parse(fs.readFileSync(path.join(
    codexWrapperRunDir, codexHistorical.cases[0].id, "preflight.json",
  ), "utf8"));
  assert.equal(codexPreflight.status, "passed");

  if (fs.existsSync("/usr/bin/sandbox-exec")) {
    const claudeHistorical = JSON.parse(fs.readFileSync(path.join(
      root, "practice/agent/agent-practice-claude-subprocess-scrub-home-stubs-20260813-0502.json",
    ), "utf8"));
    const claudeWrapperId = `runner-wrapper-claude-${process.pid}`;
    generatedRunIds.push(claudeWrapperId);
    const claudeWrapperManifestRelative = `practice/agent/${claudeWrapperId}.json`;
    const claudeWrapperManifest = path.join(root, claudeWrapperManifestRelative);
    additionalManifests.push(claudeWrapperManifest);
    fs.writeFileSync(claudeWrapperManifest, `${JSON.stringify({
      ...claudeHistorical,
      version: 2,
      id: claudeWrapperId,
      source_report: reportRelative,
      plan: planRelative,
      cases: claudeHistorical.cases.map((item) => ({
        ...item,
        execution: {
          mode: "fixture-wrapper",
          wrapper: "probe-wrapper.mjs",
          preflight_cli: "preflight/2.1.227",
          environment: "minimal",
        },
      })),
      verification: {
        ...claudeHistorical.verification,
        protected_paths: [...claudeHistorical.verification.protected_paths, "preflight/2.1.227"],
      },
    }, null, 2)}\n`);
    assertRun(run(process.execPath, [
      "scripts/agent-practice/validate-manifest.mjs", claudeWrapperManifestRelative,
    ]), "validate Claude wrapper manifest");
    const claudeWrapperRun = run(process.execPath, [
      "scripts/agent-practice/run-experiment.mjs", claudeWrapperManifestRelative, "--preflight-only",
    ], {
      env: {
        CLAUDE_BIN: path.join(
          root, "fixtures/agent-practice/claude-subprocess-scrub-home-stubs/preflight/2.1.227",
        ),
      },
    });
    assertRun(claudeWrapperRun, "Claude wrapper preflight and experiment");
    const claudePreflightSummaryPath = path.join(root, claudeWrapperRun.stdout.trim());
    const claudeWrapperRunDir = path.dirname(claudePreflightSummaryPath);
    additionalRuns.push(claudeWrapperRunDir);
    const claudeWrapperSummary = JSON.parse(fs.readFileSync(claudePreflightSummaryPath, "utf8"));
    assert.ok(Object.values(claudeWrapperSummary.cases).every((item) => item.status === "passed"));
    assert.ok(Object.values(claudeWrapperSummary.cases).every((item) => item.environment === "minimal"));
  }

  const guardSentinel = path.join(fakeDir, "authenticated-experiment-started");
  const guardCodex = path.join(fakeDir, "guard-codex.mjs");
  fs.writeFileSync(guardCodex, `#!/usr/bin/env node
import fs from "node:fs";
const args = process.argv.slice(2);
if (args[0] === "login" && args[1] === "status") process.exit(0);
if (args.length === 1 && args[0] === "--version") {
  console.log("codex-cli 0.147.0"); process.exit(0);
}
fs.writeFileSync(process.env.GUARD_SENTINEL, "started\\n");
process.exit(9);
`, { mode: 0o755 });
  const rejectedId = `runner-wrapper-rejected-${process.pid}`;
  generatedRunIds.push(rejectedId);
  const rejectedManifestRelative = `practice/agent/${rejectedId}.json`;
  const rejectedManifest = path.join(root, rejectedManifestRelative);
  additionalManifests.push(rejectedManifest);
  const rejectedObject = JSON.parse(fs.readFileSync(codexWrapperManifest, "utf8"));
  rejectedObject.id = rejectedId;
  rejectedObject.cases[0].expected_marker = "INTENTIONALLY_WRONG_PREFLIGHT_MARKER";
  fs.writeFileSync(rejectedManifest, `${JSON.stringify(rejectedObject, null, 2)}\n`);
  const rejectedRun = run(process.execPath, [
    "scripts/agent-practice/run-experiment.mjs", rejectedManifestRelative,
  ], { env: { CODEX_BIN: guardCodex, GUARD_SENTINEL: guardSentinel } });
  assert.notEqual(rejectedRun.status, 0, "invalid wrapper preflight unexpectedly succeeded");
  assert.match(rejectedRun.stderr, /preflight failed.*authenticated codex experiment was not started/);
  const rejectedSummaryPath = path.join(root, rejectedRun.stdout.trim());
  assert.equal(fs.existsSync(rejectedSummaryPath), true,
    "failed preflight must still return a machine-readable summary path");
  const rejectedSummary = JSON.parse(fs.readFileSync(rejectedSummaryPath, "utf8"));
  assert.equal(rejectedSummary.status, "failed");
  assert.match(rejectedSummary.error, /preflight failed/);
  assert.equal(rejectedSummary.cases[rejectedObject.cases[0].id].status, "failed");
  assert.equal(fs.existsSync(guardSentinel), false, "authenticated experiment started after preflight failure");
  for (const entry of fs.readdirSync(path.join(root, "logs/agent"))) {
    if (entry.startsWith(`run-${rejectedId}-`)) additionalRuns.push(path.join(root, "logs/agent", entry));
  }

  console.log("AI agent practice runner tests passed");
} finally {
  for (const file of [report, plan, manifest, analysis]) fs.rmSync(file, { force: true });
  for (const file of additionalManifests) fs.rmSync(file, { force: true });
  if (generatedRun) fs.rmSync(generatedRun, { recursive: true, force: true });
  for (const directory of additionalRuns) fs.rmSync(directory, { recursive: true, force: true });
  const agentLogs = path.join(root, "logs/agent");
  if (fs.existsSync(agentLogs)) {
    for (const entry of fs.readdirSync(agentLogs)) {
      if (generatedRunIds.some((id) => entry.startsWith(`run-${id}-`))) {
        fs.rmSync(path.join(agentLogs, entry), { recursive: true, force: true });
      }
    }
  }
  fs.rmSync(fakeDir, { recursive: true, force: true });
}
