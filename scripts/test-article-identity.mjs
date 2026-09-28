#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assertSlug, contractFromResearch } from './article-identity.mjs';
import { articleContract, researchText } from './test-fixtures/article-contract.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'article-identity-'));
const write = (relative, data) => {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data));
};
const run = (script, args) => spawnSync(process.execPath, [path.join(repo, 'scripts', script), ...args], { cwd: root, encoding: 'utf8' });
const ok = result => { assert.equal(result.status, 0, result.stderr); return result.stdout; };
const bad = (result, pattern) => { assert.notEqual(result.status, 0); assert.match(result.stderr, pattern); };
const identity = args => run('article-identity.mjs', args);
const report = 'research/agent/fixture.md';
const state = 'logs/agent/pipeline-fixture/article-identity.json';
const contract = articleContract();
const registeredPath = `analytics/contracts/${contract.slug}.json`;
const article = `articles/${contract.slug}.md`;
const init = ['init', '--report', report, '--state', state];
try {
  write('strategy/topic-selection-policy.json', fs.readFileSync(path.join(repo, 'strategy/topic-selection-policy.json'), 'utf8'));
  write(report, researchText(contract));
  const register = args => run('analytics/register-article.mjs', ['--from-research', report, ...args]);
  ok(register(['--check']));
  bad(identity(init), /missing file.*analytics\/contracts/);
  ok(register([]));
  write('snapshot.json', { [article]: { sha256: 'existing shared artifact' } });
  bad(identity([...init, '--snapshot', path.join(root, 'snapshot.json')]), /collision/);
  const original = fs.readFileSync(path.join(root, registeredPath));
  const ledger = fs.readFileSync(path.join(root, 'analytics/article-ledger.jsonl'));
  const canonical = ok(identity(init));
  const verify = ['verify', '--identity', canonical, '--state', state];
  ok(identity(verify));
  fs.rmSync(path.join(root, 'analytics/article-ledger.jsonl'));
  ok(identity(verify)); // The ledger is derived, not a prerequisite.
  write(article, 'draft');
  write('result.json', { metadata: { slug: contract.slug } });
  ok(identity([...verify, '--article', article, '--result', 'result.json']));
  bad(identity(init), /collision/);
  write('articles/wrong-article-slug.md', 'wrong');
  bad(identity([...verify, '--article', 'articles/wrong-article-slug.md']), /expected.*review-continuity-fixture.*actual.*wrong-article/);
  write('result.json', { metadata: { slug: 'wrong-article-slug' } });
  bad(identity([...verify, '--article', article, '--result', 'result.json']), /metadata.slug.*analytics\/contracts/);

  for (const change of [r => { r.slug = 'wrong-article-slug'; }, r => { r.classification.arm = 'wrong'; },
    r => { r.classification.experimentId = 'OTHER'; }, r => { r.classification.registeredAt = '2026-09-29T00:00:00Z'; }]) {
    const registered = JSON.parse(original); change(registered); write(registeredPath, registered);
    bad(identity(verify), /registered contract|article identity/);
  }
  const wrong = JSON.parse(original); wrong.slug = 'wrong-article-slug'; write(registeredPath, wrong);
  bad(identity(['publication', '--article', article]), /registered slug/);
  fs.writeFileSync(path.join(root, registeredPath), original);
  ok(identity(['publication', '--article', article, '--state', state]));

  const log = 'logs/agent/run-fixture/execution-log.md';
  write(log, '- Manifest: `practice/agent/fixture.json`\n');
  write('practice/agent/fixture.json', { source_report: report });
  const resume = [...init, '--resume-log', log];
  assert.equal(ok(identity(resume)), canonical); // Legacy run explicitly identified.
  assert.equal(ok(identity(resume)), canonical); // Idempotent resume, no registration.
  assert.deepEqual(fs.readFileSync(path.join(root, registeredPath)), original);
  assert.equal(fs.existsSync(path.join(root, 'analytics/article-ledger.jsonl')), false);
  assert.equal(fs.readdirSync(path.join(root, 'analytics/contracts')).length, 1);
  write('logs/agent/run-fixture/article-identity.json', { ...JSON.parse(canonical), slug: 'wrong-article-slug' });
  bad(identity(resume), /resume identity/);
  write('logs/agent/run-fixture/article-identity.json', JSON.parse(canonical));
  fs.rmSync(path.join(root, registeredPath));
  bad(identity(resume), /missing file/);
  fs.writeFileSync(path.join(root, registeredPath), original);
  write(state, { ...JSON.parse(canonical), slug: 'wrong-article-slug' });
  bad(identity(verify), /saved identity/);
  write(state, JSON.parse(canonical));
  write('allocation.json', { arm: 'exploration', experimentId: 'OTHER' });
  bad(identity([...resume, '--allocation', 'allocation.json']), /experimentId/);
  write('allocation.json', { arm: 'OTHER', experimentId: null });
  bad(identity([...resume, '--allocation', 'allocation.json']), /arm/);
  write('allocation.json', { arm: 'exploration', experimentId: null });
  ok(identity([...resume, '--allocation', 'allocation.json']));
  bad(identity([...resume, '--allocation', 'allocation.json', '--allocation-json', JSON.stringify({ arm: 'other', experimentId: null })]), /saved arm allocation/);
  write(report, researchText(contract) + '\nchanged');
  bad(identity(resume), /resume identity/);
  write(report, researchText(contract));
  write('practice/agent/fixture.json', { source_report: 'research/agent/other.md' });
  bad(identity(resume), /source_report/);
  bad(identity(['init', '--report', '../escape', '--state', state]), /invalid research/);
  fs.renameSync(path.join(root, registeredPath), path.join(root, 'original.json'));
  fs.symlinkSync(path.join(root, 'original.json'), path.join(root, registeredPath));
  bad(identity(verify), /symlink/);
  assert.throws(() => contractFromResearch(researchText(contract) + researchText(contract)), /exactly one/);
  // Exact slug accepted by the old registrar on 2026-09-28: 52 characters,
  // while the writer and article checker accepted at most 50.
  const incidentSlug = 'claude-doctor-prompt-audit-stale-migration-checklist';
  assert.equal(incidentSlug.length, 52);
  for (const slug of ['short', 'x'.repeat(51), incidentSlug, '../bad-slug-file', 'Uppercase-slug']) {
    assert.throws(() => assertSlug(slug), /slug/);
    write(report, researchText({ ...contract, slug }));
    bad(register(['--check']), /slug/);
  }
  assert.ok(ledger.length); // Registration was executed for real before deleting the derived data.
  console.log('Article identity: registration, stage, publication, collision and resume tests passed');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
