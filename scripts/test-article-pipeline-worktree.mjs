#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'zenn-runtime-test-'));
const checkout = path.join(temp, 'checkout'), remote = path.join(temp, 'remote.git'), store = path.join(temp, 'store');
const run = (cmd, args, cwd = checkout, env = {}) => spawnSync(cmd, args, { cwd, encoding: 'utf8', timeout: 60000, env: { ...process.env, ...env } });
const ok = r => { assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`); return r; };
const git = (...args) => ok(run('git', args)).stdout.trim();
const write = (p, s) => { fs.mkdirSync(path.dirname(path.join(checkout, p)), { recursive: true }); fs.writeFileSync(path.join(checkout, p), s); };
const execute = (args = [], flags = [], env = {}) => run('bash', ['scripts/run-article-pipeline-worktree.sh', '--store', store, ...flags, '--', 'scripts/fake-pipeline.sh', ...args], checkout, env);
const manifest = r => {
  const match = [...r.stderr.matchAll(/manifest: (.+)\n/g)].at(-1); assert.ok(match, r.stderr);
  const file = match[1]; return { ...JSON.parse(fs.readFileSync(file)), dir: path.dirname(file) };
};
const checkFile = (m, p, text) => assert.equal(fs.readFileSync(path.join(m.dir, 'files', p), 'utf8'), text);
try {
  fs.mkdirSync(checkout); git('init', '-b', 'main'); git('config', 'user.name', 'Runtime Test'); git('config', 'user.email', 'test@example.invalid');
  for (const p of ['scripts/article-runtime.mjs', 'scripts/run-article-pipeline-worktree.sh', 'scripts/safe-sync-main.sh', 'scripts/agent-practice/enqueue-reviewed-article.sh', 'scripts/agent-practice/recover-queue-pr.sh', 'scripts/agent-practice/recover-queue-pr.mjs', 'scripts/agent-practice/publish-reviewed-article.sh', 'scripts/zenn-publish-queue.sh', 'scripts/check-article.mjs', 'scripts/zenn-publish-queue.mjs']) { write(p, fs.readFileSync(path.join(root, p))); fs.chmodSync(path.join(checkout, p), fs.statSync(path.join(root, p)).mode & 0o777); }
  write('.agents/skills/example/SKILL.md', 'committed skill\n');
  write('scripts/helper.sh', 'echo committed-helper\n');
  write('articles/baseline.md', 'baseline\n');
  write('README.md', 'baseline\n');
  write('config/zenn-publish-queue.json', JSON.stringify({ version: 1, zennUsername: 'test', maxPublicationsPer24Hours: 2, retryAfterHours: 6, entries: [] }));
  write('scripts/fake-pipeline.sh', `#!/usr/bin/env bash
set -euo pipefail
[ "\${ARTICLE_PIPELINE_ISOLATED_WORKTREE:-}" = 1 ]
[ -z "$(git branch --show-current)" ]
[ -f "$ARTICLE_PIPELINE_ARTIFACT_BASELINE" ]
[ -f "$ARTICLE_PIPELINE_SHARED_ARTIFACT_SNAPSHOT" ]
mkdir -p logs/pipeline-fixture research articles scripts/articles images/fixture
bash scripts/helper.sh > logs/helper.txt
printf '%s\\n' "$ARTICLE_PIPELINE_CODE_SHA" > logs/sha.txt
case "\${1:-success}" in
  enqueue-advance|enqueue-stale)
    git --git-dir="$TEST_REMOTE" update-ref refs/heads/main "$TEST_NEXT_SHA"
    SLUG=reviewed-fixture
    [ "$1" != enqueue-stale ] || SLUG=previous-article
    mkdir -p analytics/contracts "images/$SLUG"
    printf '%s\\n' --- 'title: "Runtime publication fixture"' 'emoji: "🧪"' 'type: tech' 'topics: ["test"]' 'published: false' --- '' 'Reviewed content.' > "articles/$SLUG.md"
    printf 'verdict: pass\\nblockers: 0\\nwarnings: 0\\n' > logs/review-fixture.md
    printf '{"classification":{"arm":"test"}}\\n' > "analytics/contracts/$SLUG.json"
    printf 'image\\n' > "images/$SLUG/test.png"
    bash scripts/agent-practice/enqueue-reviewed-article.sh --article "articles/$SLUG.md" --review logs/review-fixture.md --pipeline logs/codex-pipeline-fixture --review-style codex --pr-only
    exit $?
    ;;
  advance)
    git --git-dir="$TEST_REMOTE" update-ref refs/heads/main "$TEST_NEXT_SHA"
    git fetch -q origin main
    bash scripts/helper.sh > logs/after-fetch.txt
    ;;
  fail) printf 'failure evidence\\n' > research/failure.md; exit 20 ;;
  controls) printf 'changed\\n' > scripts/helper.sh; printf 'throw new Error("wrong exporter");\\n' > scripts/article-runtime.mjs ;;
  collision) mkdir -p "$ARTICLE_PIPELINE_RUN_DIR/files/research"; printf 'other writer\\n' > "$ARTICLE_PIPELINE_RUN_DIR/files/research/generated.md" ;;
  resume) test -f research/generated.md; test -f logs/pipeline-fixture/state.json; printf 'resumed\\n' > logs/pipeline-fixture/state.json ;;
  legacy) test -f research/legacy.md ;;
  delete) rm articles/baseline.md ;;
  resume-deleted) test ! -e articles/baseline.md ;;
  concurrent-analytics)
    cat analytics/article-ledger.jsonl > logs/ledger-before.txt
    (cd "$ARTICLE_PIPELINE_SHARED_ROOT"; bash scripts/run-article-pipeline-worktree.sh --store "$ARTICLE_PIPELINE_STORE" -- scripts/auto-improve-topics.sh)
    cat analytics/article-ledger.jsonl > logs/ledger-after.txt
    ;;
  analytics) cat analytics/article-ledger.jsonl > logs/ledger.txt; test ! -e analytics/private/secret.json; test ! -e analytics/evil.sh ;;
  lock) mkdir "$ARTICLE_PIPELINE_STORE/observed-lock"; test -d "$ARTICLE_PIPELINE_STORE/run.lock" ;;
  dev-push) git push origin HEAD:refs/heads/should-not-exist; exit 90 ;;
  dev-absolute-push) "$TEST_REAL_GIT" push origin HEAD:refs/heads/should-not-exist; exit 90 ;;
  dev-gh) gh pr create --title unsafe --body unsafe; exit 90 ;;
  pending) printf 'logs/pipeline-fixture\\n' > logs/.auto-publish-resume; exit 20 ;;
  stop-controls) printf 'changed\\n' > scripts/helper.sh; node "$ARTICLE_PIPELINE_RUNTIME" assert-controls "$PWD" "$ARTICLE_PIPELINE_CONTROL_BASELINE"; exit 90 ;;
  bundle)
    printf 'verdict: pass\\nblockers: 0\\nwarnings: 0\\n' > logs/review-fixture.md
    printf 'draft\\n' > articles/fixture.md
    node "$ARTICLE_PIPELINE_RUNTIME" prepare-publication "$PWD" articles/fixture.md logs/review-fixture.md > logs/bundle.txt
    ;;
esac
printf 'generated evidence\\n' > research/generated.md
printf 'draft\\n' > articles/fixture.md
printf 'image\\n' > images/fixture/test.png
printf 'article attachment\\n' > scripts/articles/demo.sh
printf '{"step":1}\\n' > logs/pipeline-fixture/state.json
`);
  write('scripts/auto-improve-topics.sh', `#!/bin/bash
set -eu
mkdir -p analytics/private
printf '{"generation":2}\\n' > analytics/article-ledger.jsonl
printf '{"cohort":2}\\n' > analytics/market-index.json
printf 'latest report\\n' > analytics/topic-feedback.md
printf '{"traffic":123}\\n' > analytics/private/ga4.json
exit "\${1:-0}"
`);
  write('scripts/auto-publish-launchd.sh', `#!/bin/bash
set -eu
mkdir -p logs/pipeline-allowance
if [ -f logs/.auto-publish-resume ]; then
  test -f logs/pipeline-allowance/state.json
  printf 'resumed after allowance\\n' > logs/pipeline-allowance/resumed.txt
  rm logs/.auto-publish-resume
else
  printf '{"step":"review"}\\n' > logs/pipeline-allowance/state.json
  printf 'logs/pipeline-allowance\\n' > logs/.auto-publish-resume
  exit 20
fi
`);
  git('add', '.'); git('commit', '-m', 'baseline');
  ok(run('git', ['init', '--bare', remote], temp)); git('remote', 'add', 'origin', remote); git('push', '-u', 'origin', 'main');
  const sha = git('rev-parse', 'HEAD');
  const bin = path.join(temp, 'bin'); fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'gh'), '#!/bin/sh\nprintf "%s\\n" "$*" >> "$FAKE_GH_LOG"\nif [ "$1 $2" = "pr create" ]; then echo https://example.invalid/pull/1; fi\n', { mode: 0o755 });
  const ghLog = path.join(temp, 'gh.log');
  write('README.md', 'user owned\n'); write('local.txt', 'preserve\n');
  const status = git('status', '--porcelain', '--untracked-files=all'), index = fs.readFileSync(path.join(checkout, '.git/index'));
  const success = manifest(ok(execute()));
  assert.equal(success.base_sha, sha); assert.equal(success.status, 'success');
  checkFile(success, 'research/generated.md', 'generated evidence\n'); checkFile(success, 'scripts/articles/demo.sh', 'article attachment\n');
  assert.ok(success.changes.some(p => p.path === 'articles/fixture.md' && p.hash));
  assert.equal(git('rev-parse', 'HEAD'), sha); assert.equal(git('status', '--porcelain', '--untracked-files=all'), status);
  assert.deepEqual(fs.readFileSync(path.join(checkout, '.git/index')), index);
  assert.equal(fs.existsSync(path.join(checkout, 'research/generated.md')), false);
  const failedResult = execute(['fail']); assert.equal(failedResult.status, 20); const failed = manifest(failedResult);
  assert.equal(failed.pipeline_exit_code, 20); checkFile(failed, 'research/failure.md', 'failure evidence\n');
  assert.equal(git('status', '--porcelain', '--untracked-files=all'), status);
  for (const p of ['scripts/helper.sh', 'scripts/article-runtime.mjs', 'scripts/run-article-pipeline-worktree.sh', '.agents/skills/example/SKILL.md']) {
    const original = fs.readFileSync(path.join(checkout, p));
    fs.appendFileSync(path.join(checkout, p), '\nlocal-marker\n');
    const r = execute(); assert.notEqual(r.status, 0); assert.match(r.stderr, /uncommitted control code/); assert.match(r.stderr, /--dev-file/);
    fs.writeFileSync(path.join(checkout, p), original);
  }
  const marker = path.join(temp, 'UNCOMMITTED_EXECUTED');
  for (const target of ['scripts/run-article-pipeline-worktree.sh', 'scripts/fake-pipeline.sh', 'scripts/helper.sh']) {
    const original = fs.readFileSync(path.join(checkout, target));
    fs.writeFileSync(path.join(checkout, target), `touch "$UNCOMMITTED_MARKER"\n${original}`);
    const guarded = run('bash', ['-o', 'pipefail', '-c', 'git show HEAD:scripts/run-article-pipeline-worktree.sh | bash -s -- --store "$TEST_STORE" -- scripts/fake-pipeline.sh'], checkout, { UNCOMMITTED_MARKER: marker, TEST_STORE: store });
    assert.notEqual(guarded.status, 0); assert.match(guarded.stderr, /uncommitted control code/); assert.equal(fs.existsSync(marker), false);
    fs.writeFileSync(path.join(checkout, target), original);
  }
  const badRef = execute([], ['--dev-ref', 'missing-branch']); assert.notEqual(badRef.status, 0);
  assert.equal(manifest(badRef).pipeline_exit_code, null);
  write('scripts/new-control.sh', 'echo untracked\n'); assert.match(execute().stderr, /scripts\/new-control.sh/); fs.rmSync(path.join(checkout, 'scripts/new-control.sh'));
  write('scripts/helper.sh', 'echo staged\n'); git('add', 'scripts/helper.sh'); write('scripts/helper.sh', 'echo committed-helper\n');
  assert.match(execute().stderr, /uncommitted control code/); git('restore', '--staged', 'scripts/helper.sh');
  // A flag in the index must not conceal a changed helper.
  git('update-index', '--assume-unchanged', 'scripts/helper.sh'); write('scripts/helper.sh', 'echo local-marker\n');
  assert.match(execute().stderr, /uncommitted control code/);
  git('update-index', '--no-assume-unchanged', 'scripts/helper.sh');
  const dev = manifest(ok(execute([], ['--dev-ref', 'HEAD', '--dev-file', 'scripts/helper.sh'])));
  assert.equal(dev.mode, 'development'); assert.equal(dev.development.files[0].path, 'scripts/helper.sh');
  checkFile(dev, 'logs/helper.txt', 'local-marker\n'); assert.ok(fs.readFileSync(path.join(dev.dir, 'development.patch'), 'utf8').includes('local-marker'));
  for (const flag of ['--auto-merge', '--pr-only', '--pr']) {
    const r = execute([flag], ['--dev-ref', 'HEAD', '--dev-file', 'scripts/helper.sh']); assert.notEqual(r.status, 0); assert.match(r.stderr, /development mode prohibits/);
  }
  write('scripts/helper.sh', 'echo committed-helper\n');
  for (const mode of ['dev-push', 'dev-absolute-push', 'dev-gh']) {
    const r = execute([mode], ['--dev-ref', 'HEAD'], { TEST_REAL_GIT: ok(run('which', ['git'])).stdout.trim() });
    assert.notEqual(r.status, 0); assert.notEqual(r.status, 90); assert.match(r.stderr, /prohibited/);
    assert.equal(run('git', ['ls-remote', '--exit-code', '--heads', remote, 'should-not-exist']).status, 2);
  }
  for (const helper of ['scripts/agent-practice/recover-queue-pr.sh', 'scripts/agent-practice/enqueue-reviewed-article.sh', 'scripts/agent-practice/publish-reviewed-article.sh', 'scripts/zenn-publish-queue.sh']) {
    const r = run('bash', [helper, '--pr-only'], checkout, { ARTICLE_PIPELINE_MODE: 'development', ARTICLE_PIPELINE_ISOLATED_WORKTREE: '1' });
    assert.notEqual(r.status, 0); assert.match(r.stderr, /publication prohibited/);
  }
  const bundle = manifest(ok(execute(['bundle'])));
  const bundleDir = fs.readFileSync(path.join(bundle.dir, 'files/logs/bundle.txt'), 'utf8').trim();
  assert.ok(fs.existsSync(path.join(bundleDir, 'bundle.json')));
  assert.equal(fs.readFileSync(path.join(bundleDir, 'articles/fixture.md'), 'utf8'), 'draft\n');
  const blockedPublish = execute(['stop-controls']); assert.notEqual(blockedPublish.status, 90); assert.match(blockedPublish.stderr, /publication blocked/);
  const resumed = manifest(ok(execute(['resume', '--resume', 'logs/pipeline-fixture'], ['--resume-run', success.run_id])));
  assert.equal(resumed.resume.from, success.run_id); checkFile(resumed, 'research/generated.md', 'generated evidence\n');
  assert.match(execute(['resume'], ['--resume-run', dev.run_id]).stderr, /development artifacts may only resume/);
  write('research/legacy.md', 'legacy evidence\n');
  const legacy = manifest(ok(execute(['legacy', '--resume-after-run', 'logs/agent/run-legacy/execution-log.md'])));
  assert.equal(legacy.resume.legacy, true); checkFile(legacy, 'research/legacy.md', 'legacy evidence\n');
  const migrateArgs = ['scripts/run-article-pipeline-worktree.sh', '--store', store, '--migrate-legacy', checkout];
  const preview = JSON.parse(ok(run('bash', migrateArgs)).stdout); assert.equal(fs.existsSync(preview.destination), false);
  ok(run('bash', [...migrateArgs, '--apply'])); ok(run('bash', [...migrateArgs, '--apply'])); assert.equal(fs.readFileSync(path.join(checkout, 'research/legacy.md'), 'utf8'), 'legacy evidence\n');
  const allowanceArgs = ['scripts/run-article-pipeline-worktree.sh', '--store', store, '--', 'scripts/auto-publish-launchd.sh'];
  const paused = run('bash', allowanceArgs); assert.equal(paused.status, 20);
  const pausedManifest = manifest(paused);
  assert.equal(JSON.parse(fs.readFileSync(path.join(store, 'pending-claude.json'))).run_id, pausedManifest.run_id);
  const resumedAllowance = manifest(ok(run('bash', allowanceArgs)));
  assert.equal(resumedAllowance.resume.from, pausedManifest.run_id);
  checkFile(resumedAllowance, 'logs/pipeline-allowance/resumed.txt', 'resumed after allowance\n');
  assert.equal(fs.existsSync(path.join(store, 'pending-claude.json')), false);
  const collisionResult = execute(['collision']); assert.notEqual(collisionResult.status, 0);
  const collision = manifest(collisionResult); assert.equal(collision.status, 'save-failed');
  assert.ok(fs.existsSync(path.join(collision.resume.worktree, 'research/generated.md')));
  assert.equal(fs.readFileSync(path.join(collision.dir, 'files/research/generated.md'), 'utf8'), 'other writer\n');
  const recovery = ok(run('bash', ['scripts/run-article-pipeline-worktree.sh', '--store', store, '--migrate-legacy', collision.resume.worktree, '--apply']));
  const recovered = JSON.parse(recovery.stdout);
  assert.equal(fs.readFileSync(path.join(recovered.destination, 'files/research/generated.md'), 'utf8'), 'generated evidence\n');
  assert.ok(fs.existsSync(collision.resume.worktree));
  const changed = manifest(execute(['controls'])); assert.equal(changed.status, 'failed'); assert.equal(changed.control_changes.length, 2);
  assert.equal(fs.readFileSync(path.join(changed.dir, 'control-changes/scripts/helper.sh'), 'utf8'), 'changed\n');
  const deleted = manifest(ok(execute(['delete']))); assert.ok(deleted.changes.some(p => p.path === 'articles/baseline.md' && p.action === 'deleted'));
  const deletedResume1 = manifest(ok(execute(['resume-deleted'], ['--resume-run', deleted.run_id])));
  const deletedResume2 = manifest(ok(execute(['resume-deleted'], ['--resume-run', deletedResume1.run_id])));
  const deletedResume3 = manifest(ok(execute(['resume-deleted'], ['--resume-run', deletedResume2.run_id])));
  for (const run of [deletedResume1, deletedResume2, deletedResume3]) {
    assert.ok(run.changes.some(p => p.path === 'articles/baseline.md' && p.action === 'deleted'));
    assert.equal(fs.existsSync(path.join(run.dir, 'files/articles/baseline.md')), false);
  }
  write('analytics/article-ledger.jsonl', '{"latest":true}\n'); write('analytics/private/secret.json', '{"private":true}\n'); write('analytics/evil.sh', 'echo MUST_NOT_IMPORT\n');
  const analytic = manifest(ok(execute(['analytics']))); checkFile(analytic, 'logs/ledger.txt', '{"latest":true}\n');
  assert.equal(Object.keys(analytic.operational_snapshot.files).length, 1);
  const concurrent = manifest(ok(execute(['concurrent-analytics'])));
  checkFile(concurrent, 'logs/ledger-before.txt', '{"latest":true}\n');
  checkFile(concurrent, 'logs/ledger-after.txt', '{"latest":true}\n');
  const dailyArgs = ['scripts/run-article-pipeline-worktree.sh', '--store', store, '--', 'scripts/auto-improve-topics.sh'];
  const daily = manifest(ok(run('bash', dailyArgs)));
  const pointer = JSON.parse(fs.readFileSync(path.join(store, 'operations.json')));
  assert.equal(pointer.run_id, daily.run_id);
  const fresh = manifest(ok(execute(['analytics'])));
  checkFile(fresh, 'logs/ledger.txt', '{"generation":2}\n');
  assert.equal(fresh.operational_snapshot.source, path.join(daily.dir, 'operations'));
  assert.equal(Object.keys(fresh.operational_snapshot.files).some(p => p.includes('/private/')), false);
  const failedDaily = run('bash', [...dailyArgs, '7']); assert.equal(failedDaily.status, 7);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(store, 'operations.json'))), pointer);
  fs.appendFileSync(path.join(daily.dir, 'operations/analytics/market-index.json'), ' ');
  assert.match(execute().stderr, /operations snapshot hash mismatch/);
  fs.writeFileSync(path.join(daily.dir, 'operations/analytics/market-index.json'), '{"cohort":2}\n');
  // Lock contention must not remove another process's lock or touch its files.
  fs.mkdirSync(path.join(store, 'run.lock')); fs.writeFileSync(path.join(store, 'run.lock/owner.json'), '{"pid":999}\n');
  const locked = execute(); assert.notEqual(locked.status, 0); assert.match(locked.stderr, /EEXIST/); assert.ok(fs.existsSync(path.join(store, 'run.lock/owner.json'))); fs.rmSync(path.join(store, 'run.lock'), { recursive: true });
  // Advance origin during a run; helpers and exporter stay at the original SHA.
  write('scripts/helper.sh', 'echo next-version\n'); git('add', 'scripts/helper.sh'); git('commit', '-m', 'next version');
  write('articles/previous-article.md', '---\npublished: true\n---\nexisting published article\n');
  write('config/zenn-publish-queue.json', JSON.stringify({ version: 1, zennUsername: 'test', maxPublicationsPer24Hours: 2, retryAfterHours: 8, entries: [] }));
  git('add', 'articles/previous-article.md', 'config/zenn-publish-queue.json'); git('commit', '-m', 'newer publication data');
  const next = git('rev-parse', 'HEAD'); git('push', 'origin', 'HEAD:refs/heads/next');
  const committedDev = manifest(ok(execute([], ['--dev-ref', 'HEAD'])));
  assert.equal(committedDev.base_sha, next); checkFile(committedDev, 'logs/helper.txt', 'next-version\n');
  const publication = manifest(ok(execute(['enqueue-advance'], [], { TEST_REMOTE: remote, TEST_NEXT_SHA: next, PATH: `${bin}:${process.env.PATH}`, FAKE_GH_LOG: ghLog })));
  assert.equal(publication.base_sha, sha);
  assert.ok(publication.publication.some(p => p.phase === 'pr' && p.value === 'https://example.invalid/pull/1'));
  assert.equal(publication.articles.find(p => p.path === 'articles/reviewed-fixture.md').disposition, 'accepted');
  const publishedCommit = publication.publication.find(p => p.phase === 'commit').value;
  const staged = git('diff', '--name-only', next, publishedCommit).split('\n');
  assert.deepEqual(staged.sort(), ['analytics/contracts/reviewed-fixture.json', 'articles/reviewed-fixture.md', 'config/zenn-publish-queue.json', 'images/reviewed-fixture/test.png']);
  assert.equal(JSON.parse(git('show', `${publishedCommit}:config/zenn-publish-queue.json`)).retryAfterHours, 8);
  assert.match(git('show', `${publishedCommit}:articles/previous-article.md`), /published: true/);
  const stale = execute(['enqueue-stale'], [], { TEST_REMOTE: remote, TEST_NEXT_SHA: next, PATH: `${bin}:${process.env.PATH}`, FAKE_GH_LOG: ghLog });
  assert.notEqual(stale.status, 0); assert.match(stale.stderr, /refusing to overwrite/);
  // Reset only the disposable bare remote's test ref for the following pinning case.
  git(`--git-dir=${remote}`, 'update-ref', 'refs/heads/main', sha);
  write('scripts/helper.sh', 'echo next-version\n');
  const advanced = manifest(ok(execute(['advance'], [], { TEST_REMOTE: remote, TEST_NEXT_SHA: next })));
  assert.equal(advanced.base_sha, sha); checkFile(advanced, 'logs/after-fetch.txt', 'committed-helper\n');
  console.log('article runtime tests passed');
} finally {
  const listing = run('git', ['worktree', 'list', '--porcelain']);
  for (const line of (listing.stdout || '').split('\n')) {
    if (!line.startsWith('worktree ')) continue;
    const worktree = line.slice(9);
    if (worktree === checkout || !path.basename(path.dirname(worktree)).startsWith('zenn-article-run-')) continue;
    run('git', ['worktree', 'remove', '--force', worktree]);
    fs.rmSync(path.dirname(worktree), { recursive: true, force: true });
  }
  fs.rmSync(temp, { recursive: true, force: true });
}
