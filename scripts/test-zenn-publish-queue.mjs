#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "zenn-publish-queue.mjs");
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "zenn-publish-queue-test-"));
const queueRelative = "config/zenn-publish-queue.json";
const queuePath = path.join(fixture, queueRelative);
const article = "articles/queue-fixture.md";
const secondArticle = "articles/second-queue-fixture.md";
const now = "2026-08-14T03:00:00.000Z";

const run = (args) => spawnSync("node", [script, ...args, "--root", fixture, "--queue", queueRelative], {
  encoding: "utf8",
});
const mustRun = (args) => {
  const result = run(args);
  assert.equal(result.status, 0, `command failed: ${args.join(" ")}\n${result.stderr}`);
  return result.stdout.trim();
};
const writeApi = (name, articles) => {
  const file = path.join(fixture, name);
  fs.writeFileSync(file, `${JSON.stringify({ articles })}\n`);
  return file;
};
const readQueue = () => JSON.parse(fs.readFileSync(queuePath, "utf8"));

const runAt = (cwd, command, args, options = {}) => spawnSync(command, args, {
  cwd,
  encoding: "utf8",
  env: { ...process.env, ARTICLE_PIPELINE_ISOLATED_WORKTREE: "1", ...options.env },
});
const assertRun = (result, label) => {
  assert.equal(result.status, 0, `${label}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
};

const testWorkerFlow = () => {
  const integration = fs.mkdtempSync(path.join(os.tmpdir(), "zenn-publish-worker-test-"));
  const remote = path.join(integration, "remote.git");
  const checkout = path.join(integration, "checkout");
  const updater = path.join(integration, "updater");
  const bin = path.join(integration, "bin");
  const api = path.join(integration, "api.json");
  const workerArticle = "articles/worker-queue-fixture.md";
  const remoteArticleBody = `---
title: "Worker queue fixture"
emoji: "🧪"
type: tech
topics: ["test"]
published: false
---

Remote worker fixture body.
`;
  const localCollisionBody = `${remoteArticleBody}\nLocal untracked copy must remain untouched.\n`;
  try {
    fs.mkdirSync(checkout, { recursive: true });
    fs.mkdirSync(bin, { recursive: true });
    assertRun(runAt(checkout, "git", ["init", "-b", "main"]), "worker git init");
    assertRun(runAt(checkout, "git", ["config", "user.name", "Publish Worker Test"]), "worker git user.name");
    assertRun(runAt(checkout, "git", ["config", "user.email", "worker@example.com"]), "worker git user.email");
    fs.mkdirSync(path.join(checkout, "articles"), { recursive: true });
    fs.mkdirSync(path.join(checkout, "config"), { recursive: true });
    fs.mkdirSync(path.join(checkout, "scripts"), { recursive: true });
    fs.writeFileSync(path.join(checkout, queueRelative), `${JSON.stringify({
      version: 1,
      zennUsername: "clopy",
      maxPublicationsPer24Hours: 2,
      retryAfterHours: 6,
      entries: [{
        article: workerArticle,
        enqueuedAt: "2026-08-13T00:00:00.000Z",
        attempts: 0,
        lastAttemptAt: null,
      }],
    }, null, 2)}\n`);
    fs.copyFileSync(script, path.join(checkout, "scripts/zenn-publish-queue.mjs"));
    const workerSource = path.join(path.dirname(script), "zenn-publish-queue.sh");
    fs.copyFileSync(workerSource, path.join(checkout, "scripts/zenn-publish-queue.sh"));
    fs.chmodSync(path.join(checkout, "scripts/zenn-publish-queue.sh"), 0o755);
    fs.writeFileSync(api, '{"articles":[]}\n');
    assertRun(runAt(checkout, "git", ["add", "."]), "worker git add");
    assertRun(runAt(checkout, "git", ["commit", "-m", "fixture"]), "worker git commit");
    assertRun(runAt(integration, "git", ["init", "--bare", remote]), "worker git init bare");
    assertRun(runAt(checkout, "git", ["remote", "add", "origin", remote]), "worker git remote add");
    assertRun(runAt(checkout, "git", ["push", "-u", "origin", "main"]), "worker git push main");

    // Reproduce the production failure: origin/main adds an article at a path
    // that is still an untracked, user-owned file in the shared checkout.
    assertRun(runAt(integration, "git", ["clone", "--branch", "main", remote, updater]),
      "worker clone updater");
    assertRun(runAt(updater, "git", ["config", "user.name", "Publish Worker Updater"]),
      "worker updater user.name");
    assertRun(runAt(updater, "git", ["config", "user.email", "updater@example.com"]),
      "worker updater user.email");
    fs.mkdirSync(path.join(updater, "articles"), { recursive: true });
    fs.writeFileSync(path.join(updater, workerArticle), remoteArticleBody);
    assertRun(runAt(updater, "git", ["add", "--", workerArticle]), "worker updater git add");
    assertRun(runAt(updater, "git", ["commit", "-m", "add queued article"]),
      "worker updater git commit");
    assertRun(runAt(updater, "git", ["push", "origin", "main"]), "worker updater git push");

    fs.writeFileSync(path.join(checkout, workerArticle), localCollisionBody);
    const checkoutHeadBefore = runAt(checkout, "git", ["rev-parse", "HEAD"]);
    assertRun(checkoutHeadBefore, "worker read shared checkout head");

    const fakeGh = path.join(bin, "gh");
    fs.writeFileSync(fakeGh, `#!/bin/sh
if [ "$1" = auth ] && [ "$2" = status ]; then exit 0; fi
if [ "$1" = pr ] && [ "$2" = list ]; then exit 0; fi
if [ "$1" = pr ] && [ "$2" = create ]; then echo "https://example.invalid/pull/3"; exit 0; fi
exit 2
`, { mode: 0o755 });
    const result = runAt(checkout, "bash", [
      "scripts/zenn-publish-queue.sh", "--pr-only", "--now", now,
    ], {
      env: {
        PATH: `${bin}:${process.env.PATH}`,
        PUBLISH_QUEUE_API_FILE: api,
      },
    });
    assertRun(result, "publication queue worker");
    assert.match(result.stdout, /"action":"publish"/);
    assert.match(result.stdout, /PR: https:\/\/example\.invalid\/pull\/3/);
    const refs = runAt(integration, "git", [
      `--git-dir=${remote}`, "for-each-ref", "--format=%(refname)",
      "refs/heads/publish-queue/",
    ]);
    assertRun(refs, "worker list remote refs");
    const ref = refs.stdout.trim();
    assert.match(ref, /^refs\/heads\/publish-queue\/publish-worker-queue-fixture-/);
    const remoteArticle = runAt(integration, "git", [
      `--git-dir=${remote}`, "show", `${ref}:articles/worker-queue-fixture.md`,
    ]);
    assertRun(remoteArticle, "worker read remote article");
    assert.match(remoteArticle.stdout, /^published: true$/m);
    assert.match(remoteArticle.stdout, /Remote worker fixture body\./);
    const remoteQueue = runAt(integration, "git", [
      `--git-dir=${remote}`, "show", `${ref}:${queueRelative}`,
    ]);
    assertRun(remoteQueue, "worker read remote queue");
    assert.equal(JSON.parse(remoteQueue.stdout).entries[0].attempts, 1);
    const worktrees = runAt(checkout, "git", ["worktree", "list", "--porcelain"]);
    assert.equal((worktrees.stdout.match(/^worktree /gm) || []).length, 1,
      `worker leaked a temporary worktree:\n${worktrees.stdout}`);
    const checkoutHeadAfter = runAt(checkout, "git", ["rev-parse", "HEAD"]);
    assertRun(checkoutHeadAfter, "worker re-read shared checkout head");
    assert.equal(checkoutHeadAfter.stdout, checkoutHeadBefore.stdout,
      "worker must not update the shared checkout branch");
    assert.equal(fs.readFileSync(path.join(checkout, workerArticle), "utf8"), localCollisionBody,
      "worker must not overwrite the shared checkout's untracked article");
    const sharedStatus = runAt(checkout, "git", ["status", "--porcelain", "--", workerArticle]);
    assertRun(sharedStatus, "worker read shared checkout status");
    assert.equal(sharedStatus.stdout, `?? ${workerArticle}\n`);
  } finally {
    fs.rmSync(integration, { recursive: true, force: true });
  }
};

const testWorkerMergeGate = () => {
  // Since main requires the article-pipeline-tests check, an immediate merge
  // always failed, the queue state on main never advanced, and every hourly run
  // opened another identical retry PR (77 of them). The worker must wait for the
  // required checks and reuse an open PR for the queue head instead.
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "zenn-publish-merge-gate-test-"));
  const retryArticle = "articles/merge-gate-fixture.md";
  const slug = "merge-gate-fixture";
  const setup = (name) => {
    const dir = path.join(base, name);
    const remote = path.join(dir, "remote.git");
    const checkout = path.join(dir, "checkout");
    const bin = path.join(dir, "bin");
    fs.mkdirSync(path.join(checkout, "articles"), { recursive: true });
    fs.mkdirSync(path.join(checkout, "config"), { recursive: true });
    fs.mkdirSync(path.join(checkout, "scripts"), { recursive: true });
    fs.mkdirSync(bin, { recursive: true });
    fs.writeFileSync(path.join(checkout, queueRelative), `${JSON.stringify({
      version: 1,
      zennUsername: "clopy",
      maxPublicationsPer24Hours: 2,
      retryAfterHours: 6,
      entries: [{
        article: retryArticle,
        enqueuedAt: "2026-08-13T00:00:00.000Z",
        attempts: 1,
        lastAttemptAt: "2026-08-13T00:00:00.000Z",
      }],
    }, null, 2)}\n`);
    fs.writeFileSync(path.join(checkout, retryArticle), `---
title: "Merge gate fixture"
emoji: "🧪"
type: tech
topics: ["test"]
published: true
---

Merge gate fixture body.
`);
    fs.copyFileSync(script, path.join(checkout, "scripts/zenn-publish-queue.mjs"));
    fs.copyFileSync(path.join(path.dirname(script), "zenn-publish-queue.sh"),
      path.join(checkout, "scripts/zenn-publish-queue.sh"));
    fs.writeFileSync(path.join(dir, "api.json"), '{"articles":[]}\n');
    for (const [args, label] of [
      [["init", "-b", "main"], "init"],
      [["config", "user.name", "Merge Gate Test"], "user.name"],
      [["config", "user.email", "merge-gate@example.com"], "user.email"],
      [["add", "."], "add"],
      [["commit", "-m", "fixture"], "commit"],
    ]) assertRun(runAt(checkout, "git", args), `merge gate git ${label}`);
    assertRun(runAt(dir, "git", ["init", "--bare", remote]), "merge gate bare");
    assertRun(runAt(checkout, "git", ["remote", "add", "origin", remote]), "merge gate remote");
    assertRun(runAt(checkout, "git", ["push", "-u", "origin", "main"]), "merge gate push");
    return { dir, remote, checkout, bin, log: path.join(dir, "gh.log") };
  };
  // The fake gh prints what the real one prints after --jq. `checks` is a list
  // of successive `gh pr checks` outputs; the last one repeats.
  const fakeGh = (env, { existing = "", state = "CLEAN", checks = ["pass"], listFails = false, mergeExit = 0, closeExit = 0 }) => {
    const checksFile = path.join(env.dir, "checks");
    fs.writeFileSync(checksFile, `${checks.join("\n")}\n`);
    fs.writeFileSync(path.join(env.bin, "gh"), `#!/bin/sh
echo "$*" >>"${env.log}"
case "$1 $2" in
  "auth status") exit 0 ;;
  "pr list") ${listFails ? "exit 1" : `printf '%s' '${existing}'; exit 0`} ;;
  "pr view")
    case "$*" in
      *CLOSED*) [ ! -f "${env.dir}/closed" ] || cat "${env.dir}/closed"; exit 0 ;;
      *headRefName*) [ ! -f "${env.dir}/merged" ] || cat "${env.dir}/merged"; exit 0 ;;
      *) echo "${state}"; exit 0 ;;
    esac ;;
  "pr create")
    prev=""; for arg in "$@"; do [ "$prev" != --head ] || printf '%s' "$arg" >"${env.dir}/branch"; prev="$arg"; done
    echo "https://example.invalid/pull/9"; exit 0 ;;
  "pr merge")
    if [ -f "${env.dir}/branch" ]; then cp "${env.dir}/branch" "${env.dir}/merged"
    else printf '%s' "publish-queue/retry-${slug}-20260101-000000" >"${env.dir}/merged"; fi
    exit ${mergeExit} ;;
  "pr checks")
    line="$(head -n 1 "${checksFile}")"
    if [ "$(wc -l <"${checksFile}")" -gt 1 ]; then sed -i.bak 1d "${checksFile}"; fi
    [ "$line" = none ] || echo "$line"
    exit 0 ;;
  "pr close") printf '%s' "${staleBranch}" >"${env.dir}/closed"; exit ${closeExit} ;;
esac
exit 2
`, { mode: 0o755 });
  };
  const work = (env, args = []) => runAt(env.checkout, "bash", [
    "scripts/zenn-publish-queue.sh", ...args, "--now", now,
  ], {
    env: {
      PATH: `${env.bin}:${process.env.PATH}`,
      PUBLISH_QUEUE_API_FILE: path.join(env.dir, "api.json"),
      PUBLISH_QUEUE_CHECK_INTERVAL_SECONDS: "0",
      PUBLISH_QUEUE_CHECK_TIMEOUT_SECONDS: "30",
    },
  });
  const ghCalls = (env) => (fs.existsSync(env.log) ? fs.readFileSync(env.log, "utf8") : "")
    .trim().split("\n").filter(Boolean);
  const pushedBranches = (env) => runAt(env.dir, "git", [
    `--git-dir=${env.remote}`, "for-each-ref", "--format=%(refname)", "refs/heads/publish-queue/",
  ]).stdout.trim().split("\n").filter(Boolean);
  const existingPr = "https://example.invalid/pull/7";
  const staleBranch = `publish-queue/retry-${slug}-20260101-000000`;

  try {
    // New PR: no checks reported yet, then pending, then pass -> merge once.
    let env = setup("new-pr");
    fakeGh(env, { checks: ["none", "pending", "pass"] });
    let result = work(env);
    assertRun(result, "merge gate: new PR");
    let calls = ghCalls(env);
    assert.equal(calls.filter((c) => c.startsWith("pr create")).length, 1);
    assert.ok(calls.filter((c) => c.startsWith("pr checks")).length >= 3,
      `worker merged before the required checks passed:\n${calls.join("\n")}`);
    const merges = calls.filter((c) => c.startsWith("pr merge"));
    assert.equal(merges.length, 1);
    assert.doesNotMatch(merges[0], /--auto/);
    assert.ok(calls.findIndex((c) => c.startsWith("pr merge"))
      > calls.findLastIndex((c) => c.startsWith("pr checks")));
    assert.match(result.stdout, /Merge: merged/);
    assert.deepEqual(pushedBranches(env), [], "the merged queue branch must be deleted");

    // gh exits non-zero after a successful merge (its local branch cleanup
    // fails in a detached worktree); GitHub's PR state decides, not the exit.
    env = setup("merge-exit-after-merge");
    fakeGh(env, { mergeExit: 1 });
    result = work(env);
    assertRun(result, "merge gate: gh fails after the merge");
    assert.match(result.stdout, /Merge: merged/);
    assert.deepEqual(pushedBranches(env), []);

    // Failed required check: the PR stays open and nothing is merged.
    env = setup("check-fails");
    fakeGh(env, { checks: ["pending", "fail"] });
    result = work(env);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /required checks failed; leaving PR open/);
    assert.equal(ghCalls(env).filter((c) => c.startsWith("pr merge")).length, 0);

    // An open PR from an earlier run is never merged: its commits, action and
    // lastAttemptAt may be stale. It is closed and rebuilt from the current main.
    env = setup("existing-rebuilt");
    fakeGh(env, { existing: existingPr, checks: ["pass"] });
    result = work(env);
    assertRun(result, "merge gate: existing PR");
    calls = ghCalls(env);
    assert.ok(calls.some((c) => c.startsWith(`pr close ${existingPr}`)));
    assert.equal(calls.filter((c) => c.startsWith("pr create")).length, 1);
    assert.ok(!calls.some((c) => c.startsWith(`pr merge ${existingPr}`)),
      `worker merged a PR it did not build:\n${calls.join("\n")}`);
    const rebuiltMerge = calls.find((c) => c.startsWith("pr merge https://example.invalid/pull/9"));
    assert.match(rebuiltMerge || "", /--match-head-commit [0-9a-f]{40}$/);
    assert.match(result.stdout, /Merge: merged/);

    // Failed required checks on the open PR need a human; rebuilding would
    // only repeat them every hour.
    env = setup("existing-red");
    fakeGh(env, { existing: existingPr, checks: ["fail"] });
    result = work(env);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /required checks failed on the open queue PR/);
    assert.deepEqual(ghCalls(env).filter((c) => /^pr (create|merge|close)/.test(c)), []);
    assert.deepEqual(pushedBranches(env), []);

    // Unreadable checks are not a pass: stop instead of closing the PR.
    env = setup("existing-unreadable");
    fakeGh(env, { existing: existingPr, checks: ["none"] });
    result = work(env);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /could not read required checks/);
    assert.deepEqual(ghCalls(env).filter((c) => /^pr (create|merge|close)/.test(c)), []);

    // --pr-only leaves an open PR to the human and does nothing else.
    env = setup("existing-pr-only");
    fakeGh(env, { existing: existingPr });
    result = work(env, ["--pr-only"]);
    assertRun(result, "merge gate: existing PR, --pr-only");
    assert.match(result.stdout, /waiting for human merge/);
    assert.deepEqual(ghCalls(env).filter((c) => /^pr (create|merge|close)/.test(c)), []);
    assert.deepEqual(pushedBranches(env), []);

    // A PR built on an older main is closed and recreated from the current one.
    // gh's --delete-branch fails in the detached worktree (like merge), and
    // `gh pr close` may exit non-zero after closing: the run must continue.
    env = setup("existing-behind");
    assertRun(runAt(env.checkout, "git", ["push", "origin", `HEAD:refs/heads/${staleBranch}`]),
      "merge gate: push stale branch");
    fakeGh(env, { existing: existingPr, state: "BEHIND", closeExit: 1 });
    result = work(env);
    assertRun(result, "merge gate: stale existing PR");
    calls = ghCalls(env);
    assert.ok(calls.some((c) => c.startsWith(`pr close ${existingPr}`)));
    assert.ok(!calls.some((c) => c.startsWith("pr close") && c.includes("--delete-branch")));
    assert.equal(calls.filter((c) => c.startsWith("pr create")).length, 1);
    assert.match(result.stdout, /Merge: merged/);
    assert.deepEqual(pushedBranches(env), [], "the stale and the recreated branches are deleted");

    // Several open PRs for one head: stop and ask for cleanup.
    env = setup("duplicates");
    fakeGh(env, { existing: `${existingPr}\nhttps://example.invalid/pull/8` });
    result = work(env);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /multiple open queue PRs/);
    assert.deepEqual(pushedBranches(env), []);

    // If the open PRs cannot be listed, fail closed instead of opening another.
    env = setup("list-fails");
    fakeGh(env, { listFails: true });
    result = work(env);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /refusing to open another/);
    assert.deepEqual(pushedBranches(env), []);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
};

const testBlockFlow = () => {
  // A head Zenn refuses to serve (HTTP 403) never reaches the public API, so the
  // queue must give up on it instead of retrying it forever.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "zenn-publish-block-test-"));
  const stuck = "articles/stuck-queue-fixture.md";
  const waiting = "articles/waiting-queue-fixture.md";
  const blockRun = (args) => spawnSync("node", [script, ...args, "--root", root, "--queue", queueRelative], {
    encoding: "utf8",
  });
  const blockMustRun = (args) => {
    const result = blockRun(args);
    assert.equal(result.status, 0, `command failed: ${args.join(" ")}\n${result.stderr}`);
    return result.stdout.trim();
  };
  const body = (title, published) => `---
title: "${title}"
emoji: "🧪"
type: tech
topics: ["test"]
published: ${published}
---

Test body.
`;
  const writeBlockQueue = (extra) => fs.writeFileSync(path.join(root, queueRelative), `${JSON.stringify({
    version: 1,
    zennUsername: "clopy",
    maxPublicationsPer24Hours: 2,
    retryAfterHours: 6,
    ...extra,
    entries: [
      { article: stuck, enqueuedAt: "2026-08-13T00:00:00.000Z", attempts: 3, lastAttemptAt: "2026-08-14T02:30:00.000Z" },
      { article: waiting, enqueuedAt: "2026-08-13T01:00:00.000Z", attempts: 0, lastAttemptAt: null },
    ],
  }, null, 2)}\n`);
  try {
    fs.mkdirSync(path.join(root, "articles"), { recursive: true });
    fs.mkdirSync(path.join(root, "config"), { recursive: true });
    fs.writeFileSync(path.join(root, stuck), body("Stuck fixture", "true"));
    fs.writeFileSync(path.join(root, waiting), body("Waiting fixture", "false"));
    const emptyApi = path.join(root, "empty.json");
    fs.writeFileSync(emptyApi, '{"articles":[]}\n');
    const fullApi = path.join(root, "full.json");
    fs.writeFileSync(fullApi, `${JSON.stringify({ articles: [
      { slug: "recent-one", published_at: "2026-08-14T02:00:00.000Z" },
      { slug: "recent-two", published_at: "2026-08-14T01:00:00.000Z" },
    ] })}\n`);

    // Inside the retry backoff window the attempt limit still wins: waiting six
    // more hours would only hold the rest of the queue back.
    writeBlockQueue({});
    const blocked = JSON.parse(blockMustRun(["decide", "--api-json", emptyApi, "--now", now]));
    assert.equal(blocked.action, "block");
    assert.equal(blocked.maxAttempts, 3);

    // A full 24-hour window must not turn the give-up into another wait either.
    const blockedWhileFull = JSON.parse(blockMustRun(["decide", "--api-json", fullApi, "--now", now]));
    assert.equal(blockedWhileFull.action, "block");

    // An explicit higher limit keeps the old retry behaviour.
    writeBlockQueue({ maxAttempts: 5 });
    const stillRetrying = JSON.parse(blockMustRun([
      "decide", "--api-json", emptyApi, "--now", "2026-08-14T10:00:00.000Z",
    ]));
    assert.equal(stillRetrying.action, "retry");

    writeBlockQueue({});
    blockMustRun(["apply", "--action", "block", "--slug", "stuck-queue-fixture", "--now", now]);
    const afterBlock = JSON.parse(fs.readFileSync(path.join(root, queueRelative), "utf8"));
    assert.equal(afterBlock.entries.length, 1);
    assert.equal(afterBlock.entries[0].article, waiting, "block must release the next article");
    assert.equal(afterBlock.blocked.length, 1);
    assert.equal(afterBlock.blocked[0].article, stuck);
    assert.equal(afterBlock.blocked[0].attempts, 3);
    assert.equal(afterBlock.blocked[0].blockedAt, now);
    assert.match(fs.readFileSync(path.join(root, stuck), "utf8"), /^published: true$/m,
      "block must not rewrite the article");
    assert.match(blockMustRun(["validate"]), /1 pending article/);

    // The released head publishes on the next decision.
    const released = JSON.parse(blockMustRun(["decide", "--api-json", emptyApi, "--now", now]));
    assert.equal(released.action, "publish");
    assert.equal(released.article, waiting);

    // Re-queueing a given-up article must fail loudly instead of looping again.
    const requeue = blockRun(["enqueue", "--article", stuck, "--now", now]);
    assert.notEqual(requeue.status, 0, "blocked article must not be silently re-queued");
    assert.match(requeue.stderr, /published: false/);
    fs.writeFileSync(path.join(root, stuck), body("Stuck fixture", "false"));
    const requeueUnpublished = blockRun(["enqueue", "--article", stuck, "--now", now]);
    assert.notEqual(requeueUnpublished.status, 0, "blocked article must not be silently re-queued");
    assert.match(requeueUnpublished.stderr, /blocked/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};

// The shipped calibration is a claim about elapsed time, not about a count of
// attempts, so assert it by driving the state machine across simulated hours.
// Multiplying retryAfterHours by maxAttempts hid a full window: `publish`
// already sets attempts to 1, and the block check runs ahead of the backoff.
const testGiveUpTimeline = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "zenn-publish-timeline-test-"));
  const shipped = JSON.parse(fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "..", queueRelative), "utf8",
  ));
  const timelineArticle = "articles/timeline-queue-fixture.md";
  const timelineBody = (published) => `---
title: "Timeline fixture"
emoji: "\u{1F9EA}"
type: tech
topics: ["test"]
published: ${published}
---

Test body.
`;
  const timelineRun = (args) => spawnSync(
    "node", [script, ...args, "--root", root, "--queue", queueRelative], { encoding: "utf8" },
  );
  const timelineMustRun = (args) => {
    const result = timelineRun(args);
    assert.equal(result.status, 0, `command failed: ${args.join(" ")}\n${result.stderr}`);
    return result.stdout.trim();
  };
  try {
    fs.mkdirSync(path.join(root, "articles"), { recursive: true });
    fs.mkdirSync(path.join(root, "config"), { recursive: true });
    fs.writeFileSync(path.join(root, timelineArticle), timelineBody("false"));
    fs.writeFileSync(path.join(root, queueRelative), `${JSON.stringify({
      version: 1,
      zennUsername: shipped.zennUsername,
      maxPublicationsPer24Hours: shipped.maxPublicationsPer24Hours,
      retryAfterHours: shipped.retryAfterHours,
      maxAttempts: shipped.maxAttempts,
      entries: [
        { article: timelineArticle, enqueuedAt: "2026-08-14T03:00:00.000Z", attempts: 0, lastAttemptAt: null },
      ],
    }, null, 2)}\n`);
    const emptyApi = path.join(root, "empty.json");
    fs.writeFileSync(emptyApi, '{"articles":[]}\n');

    const start = Date.parse("2026-08-14T03:00:00.000Z");
    const at = (hours) => new Date(start + hours * 60 * 60 * 1000).toISOString();
    let blockedAtHours = null;
    // Step one hour at a time so the assertion is about the clock the worker
    // reads, not about how many times it happened to be invoked.
    for (let hours = 0; hours <= 400 && blockedAtHours === null; hours += 1) {
      const decision = JSON.parse(timelineMustRun(["decide", "--api-json", emptyApi, "--now", at(hours)]));
      if (decision.action === "wait_retry_backoff") continue;
      assert.notEqual(decision.action, "reconcile", "the fixture is never public");
      if (decision.action === "block") {
        blockedAtHours = hours;
        break;
      }
      assert.ok(
        decision.action === "publish" || decision.action === "retry",
        `unexpected action at +${hours}h: ${decision.action}`,
      );
      timelineMustRun(["apply", "--action", decision.action, "--slug", "timeline-queue-fixture", "--now", at(hours)]);
    }
    assert.notEqual(blockedAtHours, null, "the queue must eventually give up");
    // Zenn's measured deploy lag reached 168h at the 90th percentile, so giving
    // up any earlier discards articles that were still on their way.
    assert.ok(
      blockedAtHours >= 168,
      `the queue gave up ${blockedAtHours}h after the first publish, inside Zenn's observed p90 of 168h`,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};

try {
  fs.mkdirSync(path.join(fixture, "articles"), { recursive: true });
  fs.mkdirSync(path.join(fixture, "config"), { recursive: true });
  const frontmatter = (title) => `---
title: "${title}"
emoji: "🧪"
type: tech
topics: ["test"]
published: false
---

Test body.
`;
  fs.writeFileSync(path.join(fixture, article), frontmatter("Queue fixture").replace("Test body.\n", "```yaml\npublished: true\n```\n"));
  fs.writeFileSync(path.join(fixture, secondArticle), frontmatter("Second queue fixture"));
  fs.writeFileSync(queuePath, `${JSON.stringify({
    version: 1,
    zennUsername: "clopy",
    maxPublicationsPer24Hours: 2,
    retryAfterHours: 6,
    entries: [{
      article,
      enqueuedAt: "2026-08-13T00:00:00.000Z",
      attempts: 0,
      lastAttemptAt: null,
    }],
  }, null, 2)}\n`);

  assert.match(mustRun(["validate"]), /1 pending article/);
  assert.equal(mustRun(["pending-count"]), "1");

  const fullApi = writeApi("full.json", [
    { slug: "recent-one", published_at: "2026-08-14T02:00:00.000Z" },
    { slug: "recent-two", published_at: "2026-08-14T01:00:00.000Z" },
  ]);
  const full = JSON.parse(mustRun(["decide", "--api-json", fullApi, "--now", now]));
  assert.equal(full.action, "wait_rate_limit");
  assert.equal(full.recentPublications, 2);

  const emptyApi = writeApi("empty.json", []);
  const publish = JSON.parse(mustRun(["decide", "--api-json", emptyApi, "--now", now]));
  assert.equal(publish.action, "publish");
  mustRun(["apply", "--action", "publish", "--slug", "queue-fixture", "--now", now]);
  assert.match(fs.readFileSync(path.join(fixture, article), "utf8"), /^published: true$/m);
  assert.match(fs.readFileSync(path.join(fixture, article), "utf8"), /```yaml\npublished: true\n```/);
  assert.equal(readQueue().entries[0].attempts, 1);

  const backoff = JSON.parse(mustRun([
    "decide", "--api-json", emptyApi, "--now", "2026-08-14T04:00:00.000Z",
  ]));
  assert.equal(backoff.action, "wait_retry_backoff");
  assert.equal(backoff.retryAt, "2026-08-14T09:00:00.000Z");

  const retry = JSON.parse(mustRun([
    "decide", "--api-json", emptyApi, "--now", "2026-08-14T10:00:00.000Z",
  ]));
  assert.equal(retry.action, "retry");
  mustRun([
    "apply", "--action", "retry", "--slug", "queue-fixture",
    "--now", "2026-08-14T10:00:00.000Z",
  ]);
  assert.equal(readQueue().entries[0].attempts, 2);

  const visibleApi = writeApi("visible.json", [
    { slug: "queue-fixture", published_at: "2026-08-14T10:01:00.000Z" },
  ]);
  const reconcile = JSON.parse(mustRun([
    "decide", "--api-json", visibleApi, "--now", "2026-08-14T10:02:00.000Z",
  ]));
  assert.equal(reconcile.action, "reconcile");
  mustRun([
    "apply", "--action", "reconcile", "--slug", "queue-fixture",
    "--now", "2026-08-14T10:02:00.000Z",
  ]);
  assert.equal(readQueue().entries.length, 0);

  mustRun([
    "enqueue", "--article", secondArticle, "--now", "2026-08-14T11:00:00.000Z",
  ]);
  mustRun([
    "enqueue", "--article", secondArticle, "--now", "2026-08-14T12:00:00.000Z",
  ]);
  assert.equal(readQueue().entries.length, 1, "enqueue must be idempotent");
  assert.equal(readQueue().entries[0].article, secondArticle);

  testBlockFlow();
  testGiveUpTimeline();
  testWorkerFlow();
  testWorkerMergeGate();
  // The shipped queue must stay patient enough for Zenn's real latency. Measured
  // on 2026-09-07 from `source_repo_updated_at` on 37 published articles: the lag
  // between the publish commit landing on main and Zenn reading the file had a
  // median of 12h, a 75th percentile of 27h and a 90th percentile of 168h. The
  // original 6h x 3 attempts gave up after 18h -- below the 75th percentile --
  // and moved four still-pending articles to `blocked` with the reason "article
  // never became public within the attempt limit". Three of those seven blocked
  // articles were public by the time this was checked, one of them 167h after
  // its commit. Giving up early is therefore a false negative, not a safeguard.
  const shipped = JSON.parse(fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "..", queueRelative), "utf8",
  ));
  // The block check runs before the retry backoff, and the first `publish`
  // already sets attempts to 1, so attempts reaches N after (N-1) backoff
  // windows -- not N. Multiplying the two numbers overstates the real wait by a
  // full window, which is how a 14 x 12h setting that looks like 168h actually
  // gave up at 156h, inside the observed p90.
  const giveUpHours = shipped.retryAfterHours * ((shipped.maxAttempts ?? Infinity) - 1);
  assert.ok(
    giveUpHours >= 168,
    `the queue gives up after ${giveUpHours}h, inside Zenn's observed p90 of 168h`,
  );
  assert.ok(
    shipped.maxPublicationsPer24Hours <= 2,
    "flipping more articles per day than Zenn absorbs only grows the backlog",
  );
  for (const entry of shipped.blocked ?? []) {
    assert.fail(`${entry.article} is blocked; verify it against the public API before shipping that`);
  }

  console.log("zenn publication queue tests: ok");
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}
