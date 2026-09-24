#!/usr/bin/env node
// Reapply one reviewed enqueue operation. All validators are loaded from this
// code checkout, never from the newly fetched publication branch.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { isDeepStrictEqual as equal } from 'node:util';

const code = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const options = {};
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg === '--merge') options.merge = true;
  else if (['--pr', '--article', '--expected-head', '--state', '--attempts', '--method', '--base'].includes(arg)) {
    const value = process.argv[++i];
    if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value`);
    options[arg.slice(2)] = value;
  } else throw new Error(`unknown argument: ${arg}`);
}
const fail = message => { throw new Error(message); };
const run = (cmd, args, cwd = process.cwd(), check = true) => {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GH_PROMPT_DISABLED: '1' } });
  if (check && r.status !== 0) fail(`${cmd} ${args.join(' ')}: ${r.stderr || r.error || r.stdout}`);
  return r;
};
const git = (...args) => run('git', args).stdout.trimEnd();
const gh = (...args) => JSON.parse(run('gh', args).stdout);
const pr = () => gh('pr', 'view', options.pr, '--json', 'number,url,state,headRefOid,headRefName,baseRefName,isCrossRepository,mergeCommit');
const assertControls = () => {
  if (process.env.ARTICLE_PIPELINE_MODE === 'development') fail('publication prohibited in development mode');
  if (process.env.ARTICLE_PIPELINE_RUNTIME) run('node', [process.env.ARTICLE_PIPELINE_RUNTIME, 'assert-controls', process.cwd(), process.env.ARTICLE_PIPELINE_CONTROL_BASELINE]);
};
const sha = value => /^[a-f0-9]{40,64}$/.test(value || '');
const queueFile = 'config/zenn-publish-queue.json';
const article = options.article;
const slug = article?.replace(/^articles\//, '').replace(/\.md$/, '');
const allowed = p => p === queueFile || p === article || p === `analytics/contracts/${slug}.json` ||
  (p.startsWith(`images/${slug}/`) && !p.split('/').some(x => ['', '.', '..'].includes(x)) && /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(p));
const safeFile = (root, relative) => {
  let current = root;
  for (const component of relative.split('/')) {
    current = path.join(current, component);
    try { if (fs.lstatSync(current).isSymbolicLink()) fail(`symbolic link in publication data: ${relative}`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return current;
};
const blob = (ref, p) => {
  const line = git('ls-tree', ref, '--', p);
  if (!line) return null;
  const match = /^(100644) blob ([a-f0-9]+)\t/.exec(line);
  if (!match) fail(`only non-executable regular files are allowed: ${p}`);
  return match[2];
};
const queue = ref => JSON.parse(git('show', `${ref}:${queueFile}`));
const stateFile = path.resolve(options.state || `logs/queue-recovery-${Date.now()}.json`);
let state, temporary, worktree, active = false;
const save = (status, reason = '') => {
  state.status = status; state.reason = reason; state.updated_at = new Date().toISOString();
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(`${stateFile}.tmp`, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(`${stateFile}.tmp`, stateFile);
  if (process.env.ARTICLE_PIPELINE_RUN_DIR) fs.appendFileSync(path.join(process.env.ARTICLE_PIPELINE_RUN_DIR, 'publication.jsonl'),
    JSON.stringify({ article, phase: status, value: state.pr, head: state.expected_head, base: state.validated_base,
      reason, evidence: path.relative(process.cwd(), stateFile), at: state.updated_at }) + '\n');
};
const fetchRef = ref => {
  git('fetch', '--quiet', 'origin', `refs/heads/${ref}`);
  return git('rev-parse', 'FETCH_HEAD');
};
const remoteHead = ref => git('ls-remote', '--exit-code', 'origin', `refs/heads/${ref}`).split(/\s/)[0];
const frontMatter = content => content.match(/^---\n([\s\S]*?)\n---\n/)?.[1] || '';
const isPublished = content => /^published:\s*true\s*$/m.test(frontMatter(content));
const publishedVersion = content => content.replace(/^---\n([\s\S]*?)\n---\n/, (_, front) =>
  `---\n${front.replace(/^published:\s*false\s*$/m, 'published: true')}\n---\n`);
const requireStrictBase = () => {
  // GitHub's head SHA condition alone does not constrain the base. A strict,
  // admin-enforced branch rule makes a stale base fail at the server-side merge.
  const result = run('gh', ['api', `repos/{owner}/{repo}/branches/${encodeURIComponent(state.base)}/protection`], process.cwd(), false);
  let protection;
  try { protection = JSON.parse(result.stdout); } catch { /* unavailable or malformed */ }
  if (result.status !== 0 || protection?.required_status_checks?.strict !== true || protection?.enforce_admins?.enabled !== true)
    fail(`cannot guarantee validated ${state.base} at merge: strict, admin-enforced branch protection is required`);
  // Strict base enforcement is ineffective without a required status check.
  // Support both the legacy contexts and the app-aware checks REST fields.
  const required = protection.required_status_checks;
  const named = value => typeof value === 'string' && value.trim().length > 0;
  const hasContext = Array.isArray(required.contexts) && required.contexts.some(named);
  const hasCheck = Array.isArray(required.checks) && required.checks.some(check => named(check?.context));
  if (!hasContext && !hasCheck)
    fail(`cannot guarantee validated ${state.base} at merge: at least one named required status check is required`);
};
const verifyPr = () => {
  const current = pr();
  if (current.headRefOid !== state.expected_head || current.headRefName !== state.branch || current.baseRefName !== state.base || current.isCrossRepository)
    fail('PR changed by another writer; refusing to overwrite or merge it');
  if (!['OPEN', 'MERGED'].includes(current.state)) fail(`PR is ${current.state}`);
  return current;
};
try {
  if (process.env.ARTICLE_PIPELINE_MODE === 'development') fail('publication prohibited in development mode');
  if (process.env.ARTICLE_PIPELINE_ISOLATED_WORKTREE !== '1') fail('use recover-queue-pr.sh through the committed runtime');
  assertControls();
  if (!/^articles\/[a-z0-9-]+\.md$/.test(article || '') || !sha(options['expected-head']) || !options.pr) fail('--pr, --article and --expected-head SHA are required');
  const limit = Number(options.attempts || 3);
  if (!Number.isInteger(limit) || limit < 1 || limit > 10) fail('--attempts must be 1-10');
  const method = options.method || 'squash';
  if (!['squash', 'merge', 'rebase'].includes(method)) fail('invalid merge method');
  const info = pr();
  if (fs.existsSync(stateFile)) {
    const saved = JSON.parse(fs.readFileSync(stateFile));
    if (saved.pr !== info.url || saved.article !== article || ![saved.approved_head, saved.expected_head].includes(options['expected-head'])) fail('recovery receipt does not match the approved PR');
    state = saved;
    // Recover a push that completed just before the receipt could be updated.
    if (state.pending_head === info.headRefOid) {
      state.expected_head = state.pending_head;
      delete state.pending_head;
    }
  } else {
    state = { version: 1, pr: info.url, article, branch: info.headRefName, base: info.baseRefName,
      approved_head: options['expected-head'], expected_head: options['expected-head'], code_sha: process.env.ARTICLE_PIPELINE_CODE_SHA || git('rev-parse', 'HEAD'),
      started_at: new Date().toISOString(), attempts: [], operation: null };
  }
  state.execution_code_sha = process.env.ARTICLE_PIPELINE_CODE_SHA || git('rev-parse', 'HEAD');
  if (options.base && info.baseRefName !== options.base) fail('unexpected PR base branch');
  if (!state.branch.startsWith(`queue/${slug}`)) fail('expected an article queue PR branch');
  git('check-ref-format', `refs/heads/${state.branch}`); git('check-ref-format', `refs/heads/${state.base}`);
  const initial = verifyPr();
  if (initial.state === 'MERGED') {
    state.merge_commit = initial.mergeCommit?.oid; save('merged');
  } else {
    save('pr-created');
    const initialBase = fetchRef(state.base);
    if (fetchRef(state.branch) !== state.expected_head) fail('remote PR head differs from approved head');
    if (!state.operation) {
      const ancestor = git('merge-base', initialBase, state.expected_head);
      const before = queue(ancestor), after = queue(state.expected_head);
      const entry = after.entries?.find(e => e.article === article);
      const expected = structuredClone(before);
      if (!entry || before.entries.some(e => e.article === article) || before.blocked?.some(e => e.article === article)) fail('PR is not a new enqueue operation');
      if (!equal(entry, { article, enqueuedAt: entry.enqueuedAt, attempts: 0, lastAttemptAt: null }) || Number.isNaN(Date.parse(entry.enqueuedAt))) fail('invalid enqueue entry');
      expected.entries.push(entry);
      if (!equal(expected, after)) fail('PR changes queue data beyond appending the target article');
      const files = git('diff', '--name-only', '--no-renames', '-z', ancestor, state.expected_head).split('\0').filter(Boolean);
      if (files.some(p => !allowed(p))) fail('PR contains changes outside the publication allowlist');
      const contract = `analytics/contracts/${slug}.json`;
      // The review also covers existing payload that has no PR diff. Comparing
      // only changed paths would silently enqueue a subsequently edited draft.
      const payload = git('ls-tree', '-r', '--name-only', '-z', state.expected_head, '--', article, contract, `images/${slug}/`).split('\0').filter(Boolean);
      const assets = [...new Set([...files.filter(p => p !== queueFile), article, ...payload])].map(p => {
        if (!allowed(p)) fail(`disallowed publication asset: ${p}`);
        const value = blob(state.expected_head, p);
        if (!value) fail(`PR deletes or omits a publication asset: ${p}`);
        return { path: p, before: blob(ancestor, p), after: value };
      });
      state.operation = { ancestor, head: state.expected_head, entry, assets };
      save('validated-operation');
    }
    temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'zenn-queue-recovery-'));
    worktree = path.join(temporary, 'worktree');
    git('worktree', 'add', '--detach', worktree, state.expected_head); active = true;
    state.worktree = worktree;
    let finished = false;
    for (let attempt = 1; attempt <= limit; attempt++) {
      if (verifyPr().state === 'MERGED') { state.merge_commit = pr().mergeCommit?.oid; save('merged'); finished = true; break; }
      const base = fetchRef(state.base);
      if (git('merge-base', state.operation.ancestor, base) !== state.operation.ancestor) fail('base history was rewritten; manual recovery required');
      const latest = queue(base), next = structuredClone(latest);
      const exists = latest.entries.some(e => e.article === article);
      let disposition = exists ? 'already-queued' : latest.blocked?.some(e => e.article === article) ? 'held' : 'added';
      // A removal since the original PR was opened is a tombstone, even if a
      // later worker removed the article/blocked record entirely.
      if (disposition === 'added') {
        const history = git('rev-list', '--full-history', `${state.operation.ancestor}..${base}`, '--', queueFile).split('\n').filter(Boolean);
        if (history.some(commit => { const q = queue(commit); return q.entries.some(e => e.article === article) || q.blocked?.some(e => e.article === article); })) disposition = 'removed';
      }
      const currentArticle = blob(base, article);
      if (currentArticle && isPublished(git('show', currentArticle))) disposition = 'published';
      run('git', ['read-tree', '--reset', '-u', base], worktree);
      for (const asset of state.operation.assets) {
        const current = blob(base, asset.path);
        if (current === asset.after) continue;
        if (current === null && ['removed', 'held', 'published'].includes(disposition)) continue;
        if (current !== asset.before) {
          const onlyPublished = asset.path === article && current &&
            isPublished(git('show', current)) && git('show', current) === publishedVersion(git('show', asset.after));
          if (onlyPublished) continue;
          fail(`non-queue conflict: ${asset.path}`);
        }
        // Do not resurrect any payload from an operation that was removed or held.
        if (['removed', 'held', 'published'].includes(disposition)) continue;
        run('git', ['update-index', '--add', '--cacheinfo', `100644,${asset.after},${asset.path}`], worktree);
        safeFile(worktree, asset.path);
        run('git', ['checkout-index', '-f', '--', asset.path], worktree);
      }
      if (disposition === 'added') next.entries.push(state.operation.entry);
      // Require regular data before writing; never follow a publication-base symlink.
      blob(base, queueFile);
      const queuePath = safeFile(worktree, queueFile);
      fs.writeFileSync(queuePath, JSON.stringify(next, null, 2) + '\n');
      run('git', ['add', '--', queueFile], worktree);
      run('node', [path.join(code, 'zenn-publish-queue.mjs'), 'validate'], worktree);
      if (fs.existsSync(safeFile(worktree, article))) run('node', [path.join(code, 'check-article.mjs'), article, '--expect-published', disposition === 'published' ? 'true' : 'false'], worktree);
      const contract = safeFile(worktree, `analytics/contracts/${slug}.json`);
      if (fs.existsSync(contract)) JSON.parse(fs.readFileSync(contract));
      const changed = run('git', ['diff', '--cached', '--name-only', '-z', base], worktree).stdout.split('\0').filter(Boolean);
      if (changed.some(p => !allowed(p))) fail('rebuilt diff is outside publication allowlist');
      run('git', ['diff', '--cached', '--check', base], worktree);
      state.validated_base = base; state.disposition = disposition;
      state.attempts.push({ attempt, base, code_sha: state.execution_code_sha, head: state.expected_head, disposition, at: new Date().toISOString() });
      save('validated');
      assertControls();
      verifyPr();
      if (remoteHead(state.base) !== base) { save('retrying', 'base advanced during validation'); continue; }
      const tree = run('git', ['write-tree'], worktree).stdout.trim();
      if (git('rev-parse', `${state.expected_head}^{tree}`) !== tree || git('merge-base', base, state.expected_head) !== base) {
        const parents = ['-p', state.expected_head];
        if (git('merge-base', base, state.expected_head) !== base) parents.push('-p', base);
        const commit = git('commit-tree', tree, ...parents, '-m', `queue: reapply ${slug} onto latest ${state.base}`);
        // The new commit has the approved head as its first parent. The lease
        // adds compare-and-swap semantics, including concurrent branch rewinds;
        // this never rewrites the approved history.
        state.pending_head = commit;
        save('updating-pr');
        run('git', ['push', `--force-with-lease=refs/heads/${state.branch}:${state.expected_head}`, 'origin', `${commit}:refs/heads/${state.branch}`]);
        state.expected_head = commit;
        delete state.pending_head;
        save('recovered');
      }
      if (verifyPr().state === 'MERGED') { state.merge_commit = pr().mergeCommit?.oid; save('merged'); finished = true; break; }
      if (remoteHead(state.base) !== base) { save('retrying', 'base advanced after recovery'); continue; }
      if (!options.merge) { save('awaiting-approval', 'no merge authorization supplied'); finished = true; break; }
      assertControls();
      requireStrictBase();
      const merged = run('gh', ['pr', 'merge', options.pr, `--${method}`, '--match-head-commit', state.expected_head], process.cwd(), false);
      const observed = verifyPr();
      if (observed.state === 'MERGED') {
        state.merge_commit = observed.mergeCommit?.oid; save('merged'); finished = true; break;
      }
      save('retrying', `merge not completed: ${merged.stderr.trim() || 'checks/merge queue pending'}`);
    }
    if (!finished) fail(`retry limit reached (${limit}); PR is not merged; inspect ${stateFile} and resume with its expected_head`);
  }
  console.log(JSON.stringify({ status: state.status, pr: state.pr, head: state.expected_head, disposition: state.disposition, receipt: stateFile }));
} catch (error) {
  process.exitCode = 1;
  if (state) {
    state.worktree = active ? worktree : null;
    try { save('recovery-failed', error.message); }
    catch (saveError) { console.error(`recovery receipt could not be saved: ${saveError.message}`); }
  }
  console.error(`queue recovery failed: ${error.message}${active ? `; preserved worktree: ${worktree}` : ''}`);
} finally {
  if (active && process.exitCode !== 1) {
    const cleanup = run('git', ['worktree', 'remove', '--force', worktree], process.cwd(), false);
    if (cleanup.status === 0) fs.rmdirSync(temporary);
    else console.error(`queue worktree cleanup failed; retained: ${worktree}`);
  }
}
