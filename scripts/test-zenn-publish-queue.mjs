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
  env: { ...process.env, ...options.env },
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
  fs.writeFileSync(path.join(fixture, article), frontmatter("Queue fixture"));
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
  testWorkerFlow();
  console.log("zenn publication queue tests: ok");
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}
