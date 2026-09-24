#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const code = path.dirname(fileURLToPath(import.meta.url));
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zenn-recovery-test-'));
const checkout = path.join(root, 'checkout'), remote = path.join(root, 'remote.git'), bin = path.join(root, 'bin');
const qpath = 'config/zenn-publish-queue.json';
const run = (cmd, args, cwd = checkout, env = {}) => spawnSync(cmd, args, { cwd, encoding: 'utf8', timeout: 60000,
  env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_AUTHOR_NAME: 'Queue Test', GIT_AUTHOR_EMAIL: 'queue@example.invalid', GIT_COMMITTER_NAME: 'Queue Test', GIT_COMMITTER_EMAIL: 'queue@example.invalid', ARTICLE_PIPELINE_RUNTIME: '', ARTICLE_PIPELINE_RUN_DIR: '', ARTICLE_PIPELINE_MODE: 'normal', ARTICLE_PIPELINE_ISOLATED_WORKTREE: '1', PATH: `${bin}:${process.env.PATH}`, TEST_REMOTE: remote, TEST_ROOT: root, ...env } });
const ok = r => { assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`); return r.stdout.trim(); };
const git = (...args) => ok(run('git', args));
const write = (p, content) => { fs.mkdirSync(path.dirname(path.join(checkout, p)), { recursive: true }); fs.writeFileSync(path.join(checkout, p), content); };
const json = file => JSON.parse(fs.readFileSync(file));
const queue = ref => JSON.parse(git('show', `${ref}:${qpath}`));
const entry = article => ({ article: `articles/${article}.md`, enqueuedAt: '2026-09-24T00:00:00.000Z', attempts: 0, lastAttemptAt: null });
const draft = name => `---\ntitle: "Queue ${name}"\nemoji: "🧪"\ntype: tech\ntopics: [git]\npublished: false\n---\n\nEvidence for ${name}.\n`;
let serial = 0;
const commit = message => { git('add', '.'); git('commit', '-qm', message); return git('rev-parse', 'HEAD'); };
const makePr = (name, base, mutate) => {
  git('switch', '--detach', base);
  write(`articles/${name}.md`, draft(name));
  const q = queue('HEAD'); q.entries.push(entry(name)); write(qpath, JSON.stringify(q, null, 2) + '\n');
  write(`analytics/contracts/${name}.json`, JSON.stringify({ slug: name }));
  write(`images/${name}/fixture.png`, 'test image');
  if (mutate) mutate(q);
  const head = commit(`queue ${name}`);
  git('push', 'origin', `${head}:refs/heads/queue/${name}`);
  const metadata = { number: ++serial, url: `https://example.invalid/pull/${serial}`, branch: `queue/${name}`, state: 'OPEN', name };
  const metaFile = path.join(root, `pr-${serial}.json`); fs.writeFileSync(metaFile, JSON.stringify(metadata));
  return { name, head, metadata, metaFile, state: path.join(root, `receipt-${serial}.json`) };
};
const advance = mutate => {
  git('fetch', '-q', 'origin', 'main'); git('switch', '--detach', 'FETCH_HEAD');
  mutate(); const result = commit('worker update'); git('push', 'origin', 'HEAD:main'); return result;
};
const recover = (p, args = [], env = {}) => run('node', [path.join(code, 'agent-practice/recover-queue-pr.mjs'), '--pr', p.metadata.url, '--article', `articles/${p.name}.md`, '--expected-head', p.head, '--state', p.state, ...args], checkout, { TEST_PR: p.metaFile, ...env });
const mainQueue = () => JSON.parse(ok(run('git', ['--git-dir', remote, 'show', `main:${qpath}`])));
const assertFailure = (r, expression) => { assert.notEqual(r.status, 0, r.stdout); assert.match(r.stderr, expression); };
try {
  fs.mkdirSync(checkout); fs.mkdirSync(bin);
  git('init', '-b', 'main'); git('config', 'user.name', 'Queue Test'); git('config', 'user.email', 'queue@example.invalid');
  write(qpath, JSON.stringify({ version: 1, zennUsername: 'test', maxPublicationsPer24Hours: 2, retryAfterHours: 6, maxAttempts: 3, entries: [entry('existing')], blocked: [] }, null, 2) + '\n');
  write('articles/existing.md', draft('existing'));
  const base = commit('base'); ok(run('git', ['init', '--bare', remote], root)); git('remote', 'add', 'origin', remote); git('push', 'origin', 'HEAD:main');
  fs.writeFileSync(path.join(bin, 'gh'), `#!/usr/bin/env node
const fs = require('node:fs'), cp = require('node:child_process');
const file = process.env.TEST_PR, p = JSON.parse(fs.readFileSync(file)), remote = process.env.TEST_REMOTE;
const args = process.argv.slice(2);
const git = (...a) => cp.execFileSync('git', ['--git-dir', remote, ...a], {encoding:'utf8'}).trim();
const save = () => fs.writeFileSync(file, JSON.stringify(p));
const head = () => git('rev-parse', 'refs/heads/' + p.branch);
function bumpMain() {
  const old = git('rev-parse', 'main');
  const next = git('commit-tree', git('rev-parse', 'main^{tree}'), '-p', old, '-m', 'concurrent main update ' + Date.now());
  git('update-ref', 'refs/heads/main', next, old);
}
if (args[0] === 'pr' && args[1] === 'view') {
  p.views = (p.views || 0) + 1;
  if (process.env.TEST_RACE === 'main-always' && p.views >= 3) bumpMain();
  if (process.env.TEST_RACE === 'head' && p.views === 3) {
    const old = head(), next = git('commit-tree', git('rev-parse', old + '^{tree}'), '-p', old, '-m', 'another PR writer');
    git('update-ref', 'refs/heads/' + p.branch, next, old);
  }
  save();
  console.log(JSON.stringify({number:p.number,url:p.url,state:p.state,headRefOid:head(),headRefName:p.branch,baseRefName:'main',isCrossRepository:false,mergeCommit:p.mergeCommit}));
} else if (args[0] === 'pr' && args[1] === 'merge') {
  p.merges = (p.merges || 0) + 1; save();
  const expected = args[args.indexOf('--match-head-commit') + 1];
  if (!args.includes('--match-head-commit') || expected !== head()) process.exit(3);
  if (process.env.TEST_RACE === 'merge-once' && p.merges === 1) { bumpMain(); process.exit(1); }
  if (process.env.TEST_RACE === 'checks') process.exit(0); // Request accepted is NOT a merge.
  const old = git('rev-parse', 'main');
  if (git('merge-base', old, expected) !== old) process.exit(1);
  const merged = git('commit-tree', git('rev-parse', expected + '^{tree}'), '-p', old, '-m', 'squash approved queue PR');
  git('update-ref', 'refs/heads/main', merged, old);
  p.state = 'MERGED'; p.mergeCommit = {oid:merged}; save();
} else process.exit(2);
`, { mode: 0o755 });

  const realGit = ok(run('which', ['git']));
  fs.writeFileSync(path.join(bin, 'git'), `#!/usr/bin/env node
const cp = require('node:child_process'), fs = require('node:fs');
const args = process.argv.slice(2), actual = ${JSON.stringify(realGit)};
if (process.env.TEST_PUSH_RACE && args[0] === 'push' && args.some(a => a.startsWith('--force-with-lease='))) {
  const pr = JSON.parse(fs.readFileSync(process.env.TEST_PR)), remote = process.env.TEST_REMOTE;
  const g = (...a) => cp.execFileSync(actual, ['--git-dir', remote, ...a], {encoding:'utf8'}).trim();
  const previous = g('rev-parse', pr.branch);
  const replacement = process.env.TEST_PUSH_RACE === 'rewind' ? g('rev-parse', previous + '^') :
    g('commit-tree', g('rev-parse', previous + '^{tree}'), '-p', previous, '-m', 'concurrent push');
  g('update-ref', 'refs/heads/' + pr.branch, replacement, previous);
}
const result = cp.spawnSync(actual, args, {stdio:'inherit'});
process.exit(result.status ?? 1);
`, { mode: 0o755 });

  // Two independent PRs from the same main, including a worker retry update.
  const a = makePr('first-article', base), b = makePr('second-article', base);
  ok(recover(a, ['--merge']));
  advance(() => { const q = queue('HEAD'); q.entries[0].attempts = 2; q.entries[0].lastAttemptAt = '2026-09-24T04:00:00.000Z'; q.retryAfterHours = 12; write(qpath, JSON.stringify(q, null, 2) + '\n'); });
  const before = mainQueue();
  ok(recover(b, ['--merge']));
  const after = mainQueue();
  assert.deepEqual(after.entries.slice(0, -1), before.entries);
  assert.equal(after.retryAfterHours, 12);
  assert.deepEqual(after.entries.map(e => e.article), ['articles/existing.md', 'articles/first-article.md', 'articles/second-article.md']);
  assert.equal(json(b.state).status, 'merged');
  assert.equal(json(b.state).disposition, 'added');
  ok(recover(b, ['--merge'])); assert.deepEqual(mainQueue(), after); // Already merged is idempotent.

  // A waiting PR can be repaired without authorizing its merge.
  const pending = makePr('pending-article', base);
  ok(recover(pending));
  assert.equal(json(pending.state).status, 'awaiting-approval');
  assert.equal(json(pending.metaFile).merges, undefined);
  const approvedHead = json(pending.state).expected_head;
  assert.equal(git('merge-base', pending.head, approvedHead), pending.head); // append-only history
  ok(recover(pending, ['--merge']));
  assert.equal(json(pending.state).status, 'merged');

  // A separately registered target keeps its latest retry state, exactly once.
  const duplicate = makePr('duplicate-article', base);
  advance(() => {
    write(`articles/${duplicate.name}.md`, draft(duplicate.name));
    const q = queue('HEAD'); q.entries.push({ ...entry(duplicate.name), attempts: 2, lastAttemptAt: '2026-09-24T06:00:00.000Z' }); write(qpath, JSON.stringify(q, null, 2) + '\n');
  });
  const duplicateBefore = mainQueue(); ok(recover(duplicate, ['--merge'])); assert.deepEqual(mainQueue(), duplicateBefore);
  assert.equal(json(duplicate.state).disposition, 'already-queued');

  // Removal is detected from history even with no remaining queue tombstone.
  const removed = makePr('removed-article', base);
  advance(() => { const q = queue('HEAD'); write(`articles/${removed.name}.md`, draft(removed.name)); q.entries.push(entry(removed.name)); write(qpath, JSON.stringify(q, null, 2) + '\n'); });
  advance(() => { const q = queue('HEAD'); q.entries = q.entries.filter(e => e.article !== `articles/${removed.name}.md`); write(qpath, JSON.stringify(q, null, 2) + '\n'); });
  const removedBefore = mainQueue(); ok(recover(removed, ['--merge'])); assert.deepEqual(mainQueue(), removedBefore);
  assert.equal(json(removed.state).disposition, 'removed');
  assert.notEqual(run('git', ['--git-dir', remote, 'cat-file', '-e', `main:analytics/contracts/${removed.name}.json`]).status, 0);

  for (const kind of ['held', 'published']) {
    const p = makePr(`${kind}-article`, base);
    advance(() => {
      const q = queue('HEAD');
      write(`articles/${p.name}.md`, draft(p.name).replace('published: false', `published: ${kind === 'published'}`));
      if (kind === 'held') q.blocked.push({ article: `articles/${p.name}.md`, blockedAt: '2026-09-24T06:00:00.000Z', reason: 'hold' });
      write(qpath, JSON.stringify(q, null, 2) + '\n');
    });
    const before = mainQueue(); ok(recover(p, ['--merge'])); assert.deepEqual(mainQueue(), before); assert.equal(json(p.state).disposition, kind);
    if (kind === 'published') assert.match(ok(run('git', ['--git-dir', remote, 'show', `main:articles/${p.name}.md`])), /published: true/);
  }

  // Non-queue conflicts and unexpected PR changes fail without a push/merge.
  const conflict = makePr('conflict-article', base);
  advance(() => write(`articles/${conflict.name}.md`, draft(conflict.name) + 'Human edit\n'));
  assertFailure(recover(conflict, ['--merge']), /non-queue conflict/);
  assert.equal(ok(run('git', ['--git-dir', remote, 'rev-parse', conflict.metadata.branch])), conflict.head);
  assert.ok(fs.existsSync(json(conflict.state).worktree));
  const bad = makePr('bad-article', base, () => write('scripts/evil.sh', 'echo unsafe'));
  assertFailure(recover(bad, ['--merge']), /outside the publication allowlist/);
  const badQueue = makePr('bad-queue', base, q => { q.retryAfterHours = 99; write(qpath, JSON.stringify(q)); });
  assertFailure(recover(badQueue, ['--merge']), /beyond appending/);
  const stranger = makePr('other-writer', base);
  assertFailure(recover(stranger, ['--merge'], { TEST_RACE: 'head' }), /another writer/);
  assert.equal(json(stranger.metaFile).merges, undefined);

  for (const race of ['append', 'rewind']) {
    const p = makePr(`push-race-${race}`, base);
    assertFailure(recover(p, ['--merge'], { TEST_PUSH_RACE: race }), /stale info|rejected/);
    assert.equal(json(p.metaFile).merges, undefined);
    const remoteHead = ok(run('git', ['--git-dir', remote, 'rev-parse', p.metadata.branch]));
    assert.notEqual(remoteHead, json(p.state).pending_head, 'concurrent PR writer was overwritten');
  }

  // Publication-base scripts must never replace pinned validators.
  const pinned = makePr('pinned-code-article', base);
  advance(() => write('scripts/check-article.mjs', 'throw new Error("LATEST_BASE_CODE_EXECUTED");\n'));
  ok(recover(pinned, ['--merge']));

  // An unchanged draft is still covered by the original review. A later main
  // edit must be rejected even when the PR only changed the queue/contract.
  const existingBase = advance(() => write('articles/preexisting-article.md', draft('preexisting-article')));
  const existing = makePr('preexisting-article', existingBase);
  advance(() => write('articles/preexisting-article.md', draft('preexisting-article') + 'Later edit\n'));
  assertFailure(recover(existing, ['--merge']), /non-queue conflict: articles\/preexisting-article/);
  assert.equal(json(existing.metaFile).merges, undefined);

  const deletedBase = advance(() => write('articles/removed-existing-article.md', draft('removed-existing-article')));
  const deleted = makePr('removed-existing-article', deletedBase);
  advance(() => { const q = queue('HEAD'); q.entries.push(entry(deleted.name)); write(qpath, JSON.stringify(q, null, 2) + '\n'); });
  advance(() => {
    const q = queue('HEAD'); q.entries = q.entries.filter(e => e.article !== `articles/${deleted.name}.md`); write(qpath, JSON.stringify(q, null, 2) + '\n');
    fs.unlinkSync(path.join(checkout, `articles/${deleted.name}.md`));
  });
  ok(recover(deleted, ['--merge']));
  assert.equal(json(deleted.state).disposition, 'removed');
  assert.notEqual(run('git', ['--git-dir', remote, 'cat-file', '-e', `main:articles/${deleted.name}.md`]).status, 0);

  // A race is retried within the bound; an endless race and uncompleted merge
  // requests are failures with evidence, never a successful queue registration.
  const once = makePr('retry-once-article', base);
  ok(recover(once, ['--merge'], { TEST_RACE: 'merge-once' }));
  assert.equal(json(once.metaFile).merges, 2); assert.equal(json(once.state).status, 'merged');
  const forever = makePr('retry-forever', base);
  assertFailure(recover(forever, ['--merge', '--attempts', '2'], { TEST_RACE: 'main-always' }), /retry limit reached \(2\)/);
  assert.equal(json(forever.state).attempts.length, 2); assert.equal(json(forever.state).status, 'recovery-failed');
  const checks = makePr('checks-pending', base);
  assertFailure(recover(checks, ['--merge', '--attempts', '2'], { TEST_RACE: 'checks' }), /not merged/);
  assert.equal(json(checks.metaFile).state, 'OPEN'); assert.equal(json(checks.state).status, 'recovery-failed');
  ok(recover(checks, ['--merge'])); assert.equal(json(checks.state).status, 'merged');
  const dev = makePr('dev-blocked', base);
  assertFailure(recover(dev, ['--merge'], { ARTICLE_PIPELINE_MODE: 'development' }), /prohibited in development/);
  assert.equal(json(dev.metaFile).views, undefined);
  console.log('queue PR recovery tests passed');
} finally {
  for (const name of fs.readdirSync(root).filter(n => /^receipt-.*\.json$/.test(n))) {
    const retained = json(path.join(root, name)).worktree;
    if (retained && path.basename(path.dirname(retained)).startsWith('zenn-queue-recovery-')) fs.rmSync(path.dirname(retained), { recursive: true, force: true });
  }
  fs.rmSync(root, { recursive: true, force: true });
}
