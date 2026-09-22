#!/usr/bin/env node
// Run supervisor. Loaded from a Git object, kept outside the writable worktree,
// and reloaded from the selected SHA before invoking any pipeline code.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

process.umask(0o077);
const self = fileURLToPath(import.meta.url);
const fail = message => { throw new Error(message); };
const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const writeJSON = (file, data) => {
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(data, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  fs.renameSync(temporary, file);
};
const git = (root, ...args) => {
  const r = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
  if (r.status !== 0) fail(`git ${args.join(' ')}: ${r.stderr || r.error}`);
  return r.stdout.trimEnd();
};
const safe = p => typeof p === 'string' && p !== '' && !path.isAbsolute(p) && !p.split('/').some(x => ['..', '.', ''].includes(x));
const secret = p => p.split('/').some(x => /^\.env(?:\.|$)/.test(x) || /(?:credentials|service-account|private[-_]key)/i.test(x)) || /\.(pem|key|p12)$/.test(p);
const control = p => p !== 'config/ga4.json' && p !== 'config/zenn-publish-queue.json' && (
  /^(scripts\/(?!articles\/)|\.agents\/|\.claude\/(?!\.cache\/)|\.codex\/|config\/|templates\/|docs\/|experiments\/)/.test(p) ||
  ['package.json', 'package-lock.json', 'AGENTS.md', 'CLAUDE.md', '.gitignore', 'strategy/topic-selection-policy.json'].includes(p)
);
const artifact = p => !control(p) && !secret(p) && /^(articles|images|research|practice|experiments|fixtures|logs|knowledge|analytics\/contracts|strategy|scripts\/articles)\//.test(p) &&
  !p.split('/').some(x => ['node_modules', 'npm-cache', '.git', '.cache', 'work', 'workspace'].includes(x));
const inputs = ['analytics/article-ledger.jsonl', 'analytics/market-index.json', 'analytics/topic-feedback.md'];
const operational = p => inputs.includes(p) || /^analytics\/(raw|private)\//.test(p);
function inventory(root, predicate) {
  const result = {};
  function visit(rel) {
    const abs = path.join(root, rel);
    const stat = fs.lstatSync(abs);
    if (stat.isSymbolicLink()) { if (predicate(rel) || !rel.includes('/')) fail(`symbolic link is not allowed: ${rel}`); return; }
    if (stat.isDirectory()) {
      if (['.git', 'node_modules', '.article-runtime', 'npm-cache', 'work', 'workspace', '.cache'].includes(path.basename(rel))) return;
      for (const n of fs.readdirSync(abs).sort()) visit(rel ? `${rel}/${n}` : n);
    } else if (stat.isFile() && predicate(rel)) result[rel] = { hash: hash(fs.readFileSync(abs)), mode: stat.mode & 0o777 };
  }
  for (const n of fs.readdirSync(root).sort()) visit(n);
  return result;
}
function regular(root, rel) {
  if (!safe(rel)) fail(`unsafe path: ${rel}`);
  let at = root;
  for (const part of rel.split('/')) {
    at = path.join(at, part);
    try { if (fs.lstatSync(at).isSymbolicLink()) fail(`symbolic link: ${at}`); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  return at;
}
function copyInventory(source, target, files, overwrite = false) {
  for (const [rel, meta] of Object.entries(files)) {
    const src = regular(source, rel), dst = regular(target, rel);
    const bytes = fs.readFileSync(src);
    if (hash(bytes) !== meta.hash) fail(`source changed during snapshot: ${rel}`);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    if (!overwrite && fs.existsSync(dst)) {
      if (hash(fs.readFileSync(dst)) !== meta.hash || (fs.statSync(dst).mode & 0o777) !== meta.mode) fail(`save collision: ${dst}`);
    } else fs.writeFileSync(dst, bytes, { flag: overwrite ? 'w' : 'wx', mode: meta.mode });
    fs.chmodSync(dst, meta.mode);
    if (hash(fs.readFileSync(dst)) !== meta.hash) fail(`save verification failed: ${dst}`);
  }
}
function changes(before, after, category) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].sort().filter(p =>
    before[p]?.hash !== after[p]?.hash || before[p]?.mode !== after[p]?.mode
  ).map(p => ({ path: p, category: category === 'artifact' ? (p.startsWith('scripts/articles/') ? 'article-code' : p.split('/')[0]) : category, action: !after[p] ? 'deleted' : !before[p] ? 'created' : 'modified', hash: after[p]?.hash ?? null, mode: after[p]?.mode ?? null }));
}
function dirtyControls(root) {
  const expected = {};
  for (const line of git(root, 'ls-tree', '-rz', 'HEAD').split('\0').filter(Boolean)) {
    const [meta, p] = line.split('\t');
    if (!control(p)) continue;
    const [mode, type, oid] = meta.split(' ');
    expected[p] = { mode, oid, type };
  }
  const current = inventory(root, control);
  const dirty = new Set();
  for (const p of new Set([...Object.keys(expected), ...Object.keys(current)])) {
    const e = expected[p], c = current[p];
    if (!e || !c || e.type !== 'blob' || e.mode === '120000' ||
        git(root, 'hash-object', '--no-filters', '--', p) !== e.oid || ((c.mode & 0o111) !== 0) !== (e.mode === '100755')) dirty.add(p);
  }
  for (const p of git(root, 'diff', '--cached', '--name-only', '-z', 'HEAD').split('\0')) if (control(p)) dirty.add(p);
  return [...dirty].sort();
}
function readInputs(source, target, privateData = false) {
  const files = inventory(source, privateData ? operational : p => inputs.includes(p));
  for (const [p] of Object.entries(files)) {
    if (p.endsWith('.json')) json(path.join(source, p));
    if (p.endsWith('.jsonl')) for (const line of fs.readFileSync(path.join(source, p), 'utf8').split('\n').filter(Boolean)) JSON.parse(line);
  }
  copyInventory(source, target, files);
  return files;
}
function assertControls(worktree, baseline) {
  const changed = changes(json(baseline), inventory(worktree, control), 'control');
  if (changed.length) fail(`control code changed during run; publication blocked: ${changed.map(x => x.path).join(', ')}`);
}
function importArtifacts(source, destination, manifest) {
  const files = manifest ? manifest.files : inventory(source, artifact);
  for (const p of Object.keys(files)) if (!artifact(p)) fail(`resume manifest contains disallowed path: ${p}`);
  copyInventory(source, destination, files, true);
  for (const item of manifest?.changes ?? []) if (item.action === 'deleted' && artifact(item.path)) fs.rmSync(regular(destination, item.path), { force: true });
}
function options(args) {
  const o = { root: process.cwd(), base: process.env.ARTICLE_PIPELINE_BASE_BRANCH || 'main', devFiles: [] };
  while (args.length && args[0] !== '--') {
    const k = args.shift();
    const fields = { '--shared-root': 'root', '--base': 'base', '--dev-ref': 'devRef', '--resume-run': 'resumeRun', '--store': 'store', '--migrate-legacy': 'migrate' };
    if (k === '--dev-file') o.devFiles.push(args.shift());
    else if (k === '--apply') o.apply = true;
    else if (fields[k]) o[fields[k]] = args.shift();
    else fail(`unknown option: ${k}`);
  }
  if (args[0] === '--') args.shift();
  o.command = args;
  o.root = fs.realpathSync(o.root);
  o.mode = o.devRef || o.devFiles.length ? 'development' : 'normal';
  return o;
}
function storeRoot(o) {
  // The common Git directory is outside every worktree, including linked ones.
  const common = path.resolve(o.root, git(o.root, 'rev-parse', '--git-common-dir'));
  const store = path.resolve(o.store || process.env.ARTICLE_PIPELINE_STORE || path.join(common, 'article-runtime'));
  if ((store === o.root || store.startsWith(`${o.root}/`)) && !store.startsWith(`${common}/`)) fail('store must be outside the source tree (default: common Git directory/article-runtime)');
  fs.mkdirSync(store, { recursive: true, mode: 0o700 });
  const real = fs.realpathSync(store);
  if ((real === o.root || real.startsWith(`${o.root}/`)) && !real.startsWith(`${common}/`)) fail('store must be outside the source tree (default: common Git directory/article-runtime)');
  return real;
}
async function supervise(o) {
  const store = storeRoot(o);
  const id = `${new Date().toISOString().replace(/[-:.]/g, '')}-${crypto.randomBytes(5).toString('hex')}`;
  const dir = path.join(store, 'runs', id);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const m = { version: 1, run_id: id, started_at: new Date().toISOString(), ended_at: null, status: 'starting', reason: null, mode: o.mode, base_sha: o.sha, origin_sha: o.originSha, command: o.command, development: { ref: o.devRef || null, files: [], diff: null }, operational_snapshot: null, files: {}, changes: [], articles: [], publication: [], control_changes: [], resume: { from: o.resumeRun || null, legacy: false }, pipeline_exit_code: null, artifacts_verified: false };
  const manifestFile = path.join(dir, 'manifest.json');
  const commonStore = path.resolve(o.root, git(o.root, 'rev-parse', '--git-common-dir'), 'article-runtime');
  fs.mkdirSync(commonStore, { recursive: true, mode: 0o700 });
  const isAnalytics = /auto-improve-topics(?:-launchd)?\.sh$/.test(o.command[0]);
  const lockName = isAnalytics ? 'operations.lock' : 'run.lock';
  const locks = [...new Set([path.join(commonStore, lockName), path.join(store, lockName)])];
  const acquiredLocks = [];
  let active = false, saved = false, rc = 1;
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'zenn-article-run-'));
  const worktree = path.join(temp, 'worktree');
  const codeBefore = path.join(dir, 'controls-before.json');
  let before = {};
  const updates = [];
  const persist = () => {
    writeJSON(manifestFile, m);
    fs.writeFileSync(path.join(dir, 'summary.md'), `# Run ${id}\n\n- Mode: ${o.mode}\n- Code: ${o.sha}\n- Status: ${m.status}\n- Reason: ${m.reason || 'none'}\n- Pipeline exit: ${m.pipeline_exit_code}\n- Artifacts: files/ (${Object.keys(m.files).length} files)\n- Control changes: ${m.control_changes.length}\n- Resume: ${JSON.stringify(m.resume)}\n- Publication: ${JSON.stringify(m.publication)}\n`);
  };
  persist();
  console.error(`[article-runtime] ${o.mode} run=${id} SHA=${o.sha} store=${dir}`);
  try {
    for (const lock of locks) {
      fs.mkdirSync(lock); acquiredLocks.push(lock);
      writeJSON(path.join(lock, 'owner.json'), { pid: process.pid, run: id, store, started_at: m.started_at });
    }
    if (!isAnalytics) {
      for (const name of ['.auto-publish.lock', '.auto-publish-codex.lock', '.agent-practice-pipeline.lock', '.zenn-publish-queue.lock']) {
        if (fs.existsSync(path.join(o.root, name))) fail(`legacy pipeline holds ${path.join(o.root, name)}; wait for it to finish before switching runtime`);
      }
    }
    const dirty = dirtyControls(o.root);
    const notSelected = dirty.filter(p => !o.devFiles.includes(p));
    if (notSelected.length) fail(`uncommitted control code: ${notSelected.join(', ')}. Use --dev-ref HEAD --dev-file <path> for each intended change; no files were reset or stashed.`);
    for (const name of ['AUTO_PUBLISH_SCRIPT', 'AUTO_PUBLISH_CODEX_SCRIPT', 'AGENT_PRACTICE_SCRIPT', 'CLAUDE_USAGE_WAITER', 'CLAUDE_USAGE_GATE_COMMAND', 'AGENT_EXPERIMENT_RUNNER']) if (process.env[name]) fail(`${name} overrides are disabled; use --dev-ref/--dev-file`);
    for (const name of ['CODEX_BIN', 'CLAUDE_BIN', 'CLAUDE_USAGE_STATUSLINE_SCRIPT']) {
      const value = process.env[name];
      if (value && value.includes('/') && path.resolve(o.root, value).startsWith(`${o.root}/`)) fail(`${name} cannot execute shared-checkout code; use the installed CLI or --dev-file`);
    }
    git(o.root, 'worktree', 'add', '--detach', worktree, o.sha); active = true;
    m.resume.worktree = worktree; persist();
    const originalControls = inventory(worktree, control);
    for (const p of o.devFiles) {
      if (!safe(p) || !control(p)) fail(`--dev-file must name a control file: ${p}`);
      const src = regular(o.root, p), dst = regular(worktree, p);
      if (!fs.existsSync(src)) { fs.rmSync(dst, { force: true }); m.development.files.push({ path: p, deleted: true }); continue; }
      if (!fs.lstatSync(src).isFile()) fail(`--dev-file must be a regular file: ${p}`);
      const meta = { hash: hash(fs.readFileSync(src)), mode: fs.statSync(src).mode & 0o777 };
      copyInventory(o.root, worktree, { [p]: meta }, true);
      m.development.files.push({ path: p, ...meta });
    }
    if (o.mode === 'development') {
      m.development.diff = 'development.patch';
      fs.writeFileSync(path.join(dir, m.development.diff), git(worktree, 'diff', '--binary', o.sha) + '\n');
      copyInventory(worktree, path.join(dir, 'development-files'), Object.fromEntries(Object.entries(inventory(worktree, control)).filter(([p]) => o.devFiles.includes(p))));
      m.development.changes = changes(originalControls, inventory(worktree, control), 'development');
    }
    writeJSON(codeBefore, inventory(worktree, control));
    // Resume only the explicitly selected immutable run. Legacy roots remain read-only.
    let resumeSource;
    const pendingPointer = path.join(store, 'pending-claude.json');
    if (!o.resumeRun && o.command[0]?.endsWith('auto-publish-launchd.sh') && fs.existsSync(pendingPointer)) o.resumeRun = json(pendingPointer).run_id;
    m.resume.from = o.resumeRun || null;
    if (o.resumeRun) {
      if (!/^[A-Za-z0-9._-]+$/.test(o.resumeRun)) fail('invalid resume run ID');
      const old = path.join(store, 'runs', o.resumeRun);
      const oldManifest = json(path.join(old, 'manifest.json'));
      if (!['success', 'failed', 'migrated'].includes(oldManifest.status) || oldManifest.artifacts_verified === false) fail('resume run has no verified artifact save');
      if (oldManifest.mode === 'development' && o.mode !== 'development') fail('development artifacts may only resume in development mode');
      resumeSource = path.join(old, 'files');
      importArtifacts(resumeSource, worktree, oldManifest);
    } else if (o.command.some(x => ['--resume', '--resume-after-run'].includes(x)) || (o.command[0]?.endsWith('auto-publish-launchd.sh') && fs.existsSync(path.join(o.root, 'logs/.auto-publish-resume')))) {
      resumeSource = o.root; m.resume.legacy = true;
      importArtifacts(o.root, worktree);
    }
    const pointer = path.join(store, 'operations.json');
    let inputSource = o.root;
    if (fs.existsSync(pointer)) {
      const inputId = json(pointer).run_id;
      if (!/^[A-Za-z0-9._-]+$/.test(inputId)) fail('invalid operations run ID');
      const inputRun = path.join(store, 'runs', inputId), inputManifest = json(path.join(inputRun, 'manifest.json'));
      if (inputManifest.status !== 'success' || inputManifest.mode !== 'normal') fail('operations snapshot is not a successful normal run');
      inputSource = path.join(inputRun, 'operations');
      const actual = inventory(inputSource, operational);
      if (JSON.stringify(actual) !== JSON.stringify(inputManifest.operational_output)) fail('operations snapshot hash mismatch');
    }
    const snapshot = path.join(dir, 'inputs');
    fs.mkdirSync(snapshot);
    const inputFiles = readInputs(inputSource, snapshot, isAnalytics);
    copyInventory(snapshot, worktree, inputFiles, true);
    m.operational_snapshot = { source: inputSource, directory: 'inputs', files: inputFiles };
    before = inventory(worktree, artifact);
    writeJSON(path.join(dir, 'artifacts-before.json'), before);
    // Collision inventory is for generated-path validation only, never an export target.
    writeJSON(path.join(dir, 'shared-artifacts-before.json'), inventory(o.root, artifact));
    if (!safe(o.command[0]) || !/^scripts\/.+\.sh$/.test(o.command[0])) fail('pipeline must be a scripts/*.sh relative path');
    if (o.mode === 'development' && (o.command.some(x => ['--auto-merge', '--pr-only', '--pr'].includes(x)) || /(?:launchd|publish-reviewed-article|enqueue-reviewed-article|zenn-publish-queue)\.sh$/.test(o.command[0]))) fail('development mode prohibits scheduled/publication commands and --auto-merge/--pr-only/--pr');
    if (isAnalytics && o.command.includes('--pr')) fail('policy changes must be reviewed in a separate development-branch PR; --pr is not available from the supervised data updater');
    // Every helper used after the child exits remains outside its writable tree.
    const env = { ...process.env, ARTICLE_PIPELINE_ISOLATED_WORKTREE: '1', ARTICLE_PIPELINE_MODE: o.mode,
      ARTICLE_PIPELINE_RUN_ID: id, ARTICLE_PIPELINE_RUN_DIR: dir, ARTICLE_PIPELINE_STORE: store,
      ARTICLE_PIPELINE_CODE_SHA: o.sha, ARTICLE_PIPELINE_RUNTIME: self, ARTICLE_PIPELINE_CONTROL_BASELINE: codeBefore,
      ARTICLE_PIPELINE_SHARED_ROOT: o.root, ARTICLE_PIPELINE_LOCK_ROOT: store,
      ARTICLE_PIPELINE_SHARED_ARTIFACT_SNAPSHOT: path.join(dir, 'shared-artifacts-before.json'),
      ARTICLE_PIPELINE_ARTIFACT_BASELINE: path.join(dir, 'artifacts-before.json'),
      ARTICLE_PIPELINE_BASE_BRANCH: o.base, BASE_BRANCH: o.base, AGENT_PIPELINE_BASE_BRANCH: o.base,
      PUBLISH_QUEUE_BASE_BRANCH: o.base, PUBLISH_QUEUE_FILE: 'config/zenn-publish-queue.json', POLICY_FILE: 'strategy/topic-selection-policy.json',
      AUTO_PUBLISH_LOG_DIR: path.join(worktree, 'logs/launchd'), AUTO_PUBLISH_STATUS_DIR: path.join(worktree, 'logs/daily-status'),
      AGENT_PRACTICE_LOG_DIR: path.join(worktree, 'logs/agent/launchd'), AGENT_PRACTICE_STATUS_DIR: path.join(worktree, 'logs/agent/daily-status'),
      AGENT_PIPELINE_RETRY_SIGNAL_FILE: path.join(dir, 'retry-signal'), GA4_CONFIG_PATH: isAnalytics ? path.join(o.root, 'config/ga4.json') : '' };
    if (o.mode === 'development') {
      const bin = path.join(temp, 'dev-bin'); fs.mkdirSync(bin);
      const realGit = spawnSync('which', ['git'], { encoding: 'utf8' }).stdout.trim();
      const realGh = spawnSync('which', ['gh'], { encoding: 'utf8' }).stdout.trim();
      const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
      fs.writeFileSync(path.join(bin, 'git'), `#!/bin/bash\nfor arg in "$@"; do [ "$arg" != push ] || { echo 'development mode: git push prohibited' >&2; exit 2; }; done\nexec ${quote(realGit)} "$@"\n`, { mode: 0o700 });
      fs.writeFileSync(path.join(bin, 'gh'), `#!/bin/bash\ncase "$1 $2" in 'auth status'|'pr view'|'pr checks') exec ${quote(realGh || '/usr/bin/false')} "$@";; *) echo 'development mode: GitHub write prohibited' >&2; exit 2;; esac\n`, { mode: 0o700 });
      // Applies to Git invoked through an absolute path too, without changing shared config.
      const hooks = path.join(temp, 'hooks'); fs.mkdirSync(hooks);
      fs.writeFileSync(path.join(hooks, 'pre-push'), '#!/bin/sh\necho "development mode: push prohibited" >&2\nexit 2\n', { mode: 0o700 });
      const count = Number(env.GIT_CONFIG_COUNT || 0);
      env.GIT_CONFIG_COUNT = String(count + 1); env[`GIT_CONFIG_KEY_${count}`] = 'core.hooksPath'; env[`GIT_CONFIG_VALUE_${count}`] = hooks;
      env.PATH = `${bin}:${env.PATH}`;
    }
    m.status = 'running'; persist();
    const log = fs.openSync(path.join(dir, 'process.log'), 'wx', 0o600);
    rc = await new Promise((resolve, reject) => {
      const child = spawn('bash', o.command, { cwd: worktree, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
      const forward = signal => { try { process.kill(-child.pid, signal); } catch { /* already exited */ } };
      const term = () => forward('SIGTERM'), int = () => forward('SIGINT');
      process.on('SIGTERM', term); process.on('SIGINT', int);
      child.stdout.on('data', b => { fs.writeSync(log, b); process.stdout.write(b); });
      child.stderr.on('data', b => { fs.writeSync(log, b); process.stderr.write(b); });
      child.on('error', reject);
      child.on('close', (code, signal) => { process.off('SIGTERM', term); process.off('SIGINT', int); resolve(code ?? (signal === 'SIGINT' ? 130 : 143)); });
    });
    fs.closeSync(log);
    m.pipeline_exit_code = rc;
    const afterControls = inventory(worktree, control);
    m.control_changes = changes(json(codeBefore), afterControls, 'control').map(item => ({ ...item, destination: item.hash ? `control-changes/${item.path}` : null }));
    if (m.control_changes.length) {
      copyInventory(worktree, path.join(dir, 'control-changes'), Object.fromEntries(Object.entries(afterControls).filter(([p]) => m.control_changes.some(x => x.path === p))));
      fs.writeFileSync(path.join(dir, 'control-changes.patch'), git(worktree, 'diff', '--binary', o.sha, '--', ...m.control_changes.map(x => x.path)) + '\n');
      m.reason = 'control code changed; preserved separately, not adopted'; rc ||= 2;
    }
    const after = inventory(worktree, artifact);
    m.changes = changes(before, after, 'artifact');
    m.files = after;
    for (const item of m.changes) item.destination = item.hash ? `files/${item.path}` : null;
    copyInventory(worktree, path.join(dir, 'files'), after);
    const receipts = path.join(dir, 'publication.jsonl');
    if (fs.existsSync(receipts)) m.publication = fs.readFileSync(receipts, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
    const states = m.changes.filter(p => /logs\/.*\/state.json$/.test(p.path) && p.action !== 'deleted').flatMap(p => {
      try { return [json(path.join(worktree, p.path)).artifacts || {}]; } catch { return []; }
    });
    const articlePaths = new Set([...m.changes.filter(x => x.path.startsWith('articles/')).map(x => x.path), ...m.publication.map(x => x.article), ...states.map(x => x.article).filter(Boolean)]);
    m.articles = [...articlePaths].map(article => ({ path: article,
      disposition: m.publication.some(p => p.article === article && ['pushed', 'pr'].includes(p.phase)) ? 'accepted' : 'held',
      reviews: [...new Set([...m.publication.filter(p => p.article === article).map(p => p.review), ...states.filter(p => p.article === article).map(p => p.review).filter(Boolean)])],
      evidence: m.changes.filter(p => /^(logs|research|practice)\//.test(p.path)).map(p => `files/${p.path}`) }));
    m.resume.worktree = null;
    m.resume.commands = Object.keys(after).filter(p => /^(logs\/.*\/state.json|logs\/agent\/run-[^/]+\/execution-log.md)$/.test(p)).map(p => ({ option: p.endsWith('state.json') ? '--resume' : '--resume-after-run', path: p.endsWith('state.json') ? path.dirname(p) : p }));
    if (isAnalytics) {
      const ops = inventory(worktree, operational);
      copyInventory(worktree, path.join(dir, 'operations'), ops);
      m.operational_output = ops;
      m.changes.push(...changes(inputFiles, ops, 'operations').map(item => ({ ...item, destination: item.hash ? `operations/${item.path}` : null })));
      if (rc === 0 && o.mode === 'normal') {
        writeJSON(path.join(store, `${id}.operations.tmp`), { run_id: id });
        updates.push(() => fs.renameSync(path.join(store, `${id}.operations.tmp`), pointer));
      }
    }
    if (o.mode === 'normal' && /auto-publish(?:-launchd)?\.sh$/.test(o.command[0])) {
      if (after['logs/.auto-publish-resume']) {
        writeJSON(path.join(store, `${id}.pending.tmp`), { run_id: id });
        updates.push(() => fs.renameSync(path.join(store, `${id}.pending.tmp`), pendingPointer));
      } else if (o.resumeRun && fs.existsSync(pendingPointer) && json(pendingPointer).run_id === o.resumeRun) updates.push(() => fs.rmSync(pendingPointer));
    }
    m.status = rc === 0 ? 'success' : 'failed'; m.reason ||= rc === 0 ? 'completed' : `pipeline exited ${rc}`;
    saved = true; m.artifacts_verified = true;
  } catch (e) {
    m.status = active && m.pipeline_exit_code !== null ? 'save-failed' : 'failed'; m.reason = e.message;
    console.error(`[article-runtime] ${e.message}`); rc ||= 2;
    if (active) m.resume.worktree = worktree;
  } finally {
    const receipts = path.join(dir, 'publication.jsonl');
    if (fs.existsSync(receipts)) {
      try { m.publication = fs.readFileSync(receipts, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse); }
      catch (e) { m.publication_audit_error = e.message; saved = false; rc ||= 2; }
    }
    m.ended_at = new Date().toISOString(); m.exit_code = rc;
    try { persist(); if (saved) for (const update of updates) update(); } catch (e) { saved = false; rc ||= 2; console.error(`manifest save failed: ${e.message}`); }
    if (active && saved) {
      try { git(o.root, 'worktree', 'remove', '--force', worktree); active = false; } catch (e) { m.resume.worktree = worktree; m.cleanup_error = e.message; persist(); console.error(e.message); }
    }
    if (active) console.error(`[article-runtime] preserved worktree: ${worktree}; reason: ${m.reason}`);
    else fs.rmSync(temp, { recursive: true, force: true });
    for (const lock of acquiredLocks.reverse()) fs.rmSync(lock, { recursive: true });
    console.error(`[article-runtime] manifest: ${manifestFile}`);
  }
  return rc;
}
async function main() {
  const args = process.argv.slice(2);
  if (args[0] === 'assert-controls') { assertControls(args[1], args[2]); return 0; }
  if (args[0] === 'prepare-publication') {
    const [_, root, article, review] = args;
    assertControls(root, process.env.ARTICLE_PIPELINE_CONTROL_BASELINE);
    if (process.env.ARTICLE_PIPELINE_MODE === 'development') fail('publication prohibited in development mode');
    if (!/^articles\/[a-z0-9_-]+\.md$/.test(article) || !safe(review) || !review.startsWith('logs/')) fail('invalid publication paths');
    const slug = path.basename(article, '.md');
    const selected = inventory(root, p => p === article || p === review || p === `analytics/contracts/${slug}.json` || p.startsWith(`images/${slug}/`));
    for (const p of Object.keys(selected)) {
      if (secret(p) || (p.startsWith('images/') && !/\.(png|jpe?g|gif|webp|svg|avif)$/i.test(p))) fail(`disallowed publication file: ${p}`);
    }
    const dest = path.join(process.env.ARTICLE_PIPELINE_RUN_DIR, 'reviewed', `${slug}-${hash(JSON.stringify(selected)).slice(0, 12)}`);
    copyInventory(root, dest, selected);
    writeJSON(path.join(dest, 'bundle.json'), { article, review, files: selected });
    console.log(dest);
    return 0;
  }
  if (args[0] === 'install-publication') {
    if (process.env.ARTICLE_PIPELINE_MODE === 'development') fail('publication prohibited in development mode');
    const [_, source, destination] = args, bundle = json(path.join(source, 'bundle.json'));
    const slug = path.basename(bundle.article, '.md');
    const files = Object.fromEntries(Object.entries(bundle.files).filter(([p]) => p !== bundle.review));
    for (const p of Object.keys(files)) {
      if (!safe(p) || !(p === bundle.article || p === `analytics/contracts/${slug}.json` || p.startsWith(`images/${slug}/`))) fail(`disallowed publication path: ${p}`);
    }
    copyInventory(source, destination, files);
    return 0;
  }
  if (args[0] === 'publication') {
    const [_, root, article, review, phase, value] = args;
    assertControls(root, process.env.ARTICLE_PIPELINE_CONTROL_BASELINE);
    if (process.env.ARTICLE_PIPELINE_MODE === 'development') fail('publication prohibited in development mode');
    fs.appendFileSync(path.join(process.env.ARTICLE_PIPELINE_RUN_DIR, 'publication.jsonl'), JSON.stringify({ article, review, phase, value, at: new Date().toISOString() }) + '\n');
    return 0;
  }
  if (args[0] !== '--selected-code') fail('invoke scripts/run-article-pipeline-worktree.sh, not the runtime module');
  args.shift();
  const sha = args.shift(), originSha = args.shift();
  if (!/^[a-f0-9]{40,64}$/.test(sha) || !/^[a-f0-9]{40,64}$/.test(originSha)) fail('invalid selected SHA');
  const o = { ...options(args), sha, originSha };
  if (o.migrate) {
    const source = fs.realpathSync(o.migrate), files = inventory(source, artifact);
    const id = `legacy-${hash(JSON.stringify(files)).slice(0, 20)}`, store = storeRoot(o), dest = path.join(store, 'runs', id);
    console.log(JSON.stringify({ run_id: id, source, destination: dest, files }, null, 2));
    if (o.apply) {
      fs.mkdirSync(dest, { recursive: true, mode: 0o700 });
      copyInventory(source, path.join(dest, 'files'), files);
      writeJSON(path.join(dest, 'manifest.json'), { version: 1, run_id: id, status: 'migrated', mode: 'normal', base_sha: git(o.root, 'rev-parse', 'HEAD'), started_at: new Date().toISOString(), ended_at: new Date().toISOString(), source, files, changes: [], resume: { legacy: true } });
      fs.writeFileSync(path.join(dest, 'summary.md'), `# Legacy migration ${id}\n\nVerified ${Object.keys(files).length} files from ${source}. Source retained.\n`);
    }
    return 0;
  }
  if (!o.command.length) fail('usage: [--dev-ref ref] [--dev-file path] [--resume-run id] -- scripts/pipeline.sh [args]');
  return supervise(o);
}
try { process.exitCode = await main(); } catch (e) { console.error(`[article-runtime] ${e.message}`); process.exitCode = 2; }
