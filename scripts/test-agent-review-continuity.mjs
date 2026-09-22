#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateFindings, sessionId, hasProviderError } from './agent-review-history.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const finding = { id: 'F-001', status: 'unresolved', severity: 'warning', category: 'initial', reason: 'Missing option', evidence: 'recipe line 2' };
assert.throws(() => validateFindings([], [finding], { value: 'pass', round: 2 }, 'blockers: 0\nwarnings: 0'), /disappeared/);
assert.throws(() => validateFindings([finding], [], { value: 'fix', round: 2 }, 'blockers: 0\nwarnings: 1'), /category/);
assert.throws(() => validateFindings([{ ...finding, category: 'preference' }], [], { value: 'fix', round: 2 }, ''), /category/);
assert.throws(() => validateFindings([finding], [{ ...finding, status: 'resolved' }], { value: 'fix', round: 3 }, ''), /reopen_reason/);
assert.throws(() => validateFindings([{ ...finding, reopen_reason: 'Again' }], [{ ...finding, status: 'resolved' }], { value: 'fix', round: 3 }, ''), /new evidence/);
assert.equal(validateFindings([{ ...finding, reopen_reason: 'Later edit removed option', evidence: 'recipe line 5 diff' }], [{ ...finding, status: 'resolved' }], { value: 'fix', round: 3 }, 'blockers: 0\nwarnings: 1').length, 1);
assert.throws(() => validateFindings([finding], [], { value: 'pass', round: 1 }, 'blockers: 0\nwarnings: 0'), /does not match/);
assert.equal(sessionId('codex', '{"type":"thread.started","thread_id":"test-session-1"}\n'), 'test-session-1');
assert.equal(sessionId('claude', '{"session_id":"test-session-2"}'), 'test-session-2');
assert.throws(() => sessionId('claude', '{}'), /session ID/);
assert.equal(hasProviderError('claude', '{"result":"An article about usage limits and session not found"}'), false);
assert.equal(hasProviderError('claude', '{"is_error":true}'), true);
assert.equal(hasProviderError('codex', '{"type":"turn.failed"}'), true);
assert.equal(hasProviderError('codex', '{"type":"error"}\n{"type":"turn.completed"}'), false);

const fakeCli = String.raw`#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
if (args.includes('status')) process.exit(0);
const provider = path.basename(process.argv[1]);
const prompt = provider === 'claude' ? args[args.indexOf('-p') + 1] : args.at(-1);
const stage = prompt.match(/zenn-agent-(analyze-results|draft-article|review-article|revise-article)/)[1].split('-')[0];
const stateFile = 'fake-state.json';
const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile)) : { sessions: 0, failed: false };
const resumed = provider === 'claude' ? args[args.indexOf('--resume') + 1] : args.at(-2);
const isResume = provider === 'claude' ? args.includes('--resume') : args.includes('resume');
const session = isResume ? resumed : 'fake-session-' + (++state.sessions);
const round = Number(prompt.match(/review-history\/round-(\d+)/)?.[1] || 0);
const scenario = process.env.SCENARIO;
fs.appendFileSync('calls.jsonl', JSON.stringify({ provider, stage, args, prompt, session, isResume, round }) + '\n');
function save() { fs.writeFileSync(stateFile, JSON.stringify(state)); }
if (stage === 'review' && isResume && !state.failed && ['fallback', 'fallback-zero'].includes(scenario)) {
  state.failed = true; save();
  console.log(JSON.stringify({ is_error: true, result: 'No conversation found with session ID ' + session }));
  console.error('session not found');
  process.exit(scenario === 'fallback-zero' ? 0 : 1);
}
if (!state.failed && ((scenario === 'usage-review' && stage === 'review' && round === 2) || (scenario === 'usage-revise' && stage === 'revise'))) {
  state.failed = true; save();
  console.log(JSON.stringify({ type: 'result', is_error: true, result: "You've hit your session limit · resets 2pm (Asia/Tokyo)" }));
  process.exit(0);
}
save();
const slug = 'review-continuity-fixture';
const article = 'articles/' + slug + '.md';
const result = { status: 'ok', artifact: '', reason: '', metadata: { verdict: null, action: null, slug: null } };
function write(file, text) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); }
if (stage === 'analyze') {
  result.artifact = 'logs/agent/analysis.md'; result.metadata = { verdict: 'confirmed', action: 'draft', slug: null };
  write(result.artifact, 'verdict: confirmed\naction: draft\n');
} else if (stage === 'draft') {
  result.artifact = article; result.metadata.slug = slug; write(article, 'draft\n');
} else if (stage === 'review') {
  result.artifact = prompt.match(/report to ([^ ]+)\./)[1]; result.metadata.slug = slug;
  result.metadata.verdict = round < 3 || scenario === 'final-fail' ? 'fix' : 'pass';
  const findings = [{ id: 'F-001', status: round === 1 ? 'unresolved' : 'resolved', severity: 'warning', category: 'initial', reason: 'recipe option', evidence: 'article recipe ' + round }];
  if (round > 1) findings.push({ id: 'F-002', status: result.metadata.verdict === 'pass' ? 'resolved' : 'unresolved', severity: 'warning', category: 'revision-regression', reason: 'Revision removed version', evidence: 'article version and diff ' + round });
  const warnings = findings.filter(f => f.status === 'unresolved').length;
  write(result.artifact, 'verdict: ' + result.metadata.verdict + '\nblockers: 0\nwarnings: ' + warnings + '\neditorial_score: ' + (scenario === 'low-score' && round === 3 ? 70 : 90) + '/100\n' + '\x60\x60\x60review-findings\n' + JSON.stringify(findings) + '\n\x60\x60\x60\n');
  if (scenario === 'contract-repair' && !state.failed) { result.artifact = 'logs/agent/nonexistent.md'; state.failed = true; save(); }
} else if (stage === 'revise') {
  result.artifact = article; result.metadata.slug = slug;
  fs.appendFileSync(article, 'revision ' + round + '\n');
  const logFile = prompt.match(/skill at ([^ ]+)\./)[1];
  if (scenario !== 'missing-revision-log') write(logFile, 'F-001: option added, checked recipe. F-002: restored version, checked execution log.\n');
}
if (provider === 'claude') console.log(JSON.stringify({ type: 'result', session_id: session, structured_output: result }));
else {
  fs.writeFileSync(args[args.indexOf('-o') + 1], JSON.stringify(result));
  console.log(JSON.stringify({ type: 'thread.started', thread_id: session }));
}
`;

function runCase(provider, scenario) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-review-'));
  const write = (file, content, executable = false) => {
    const full = path.join(temporary, file);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, executable ? { mode: 0o755 } : undefined);
  };
  try {
    fs.cpSync(path.join(root, 'scripts'), path.join(temporary, 'scripts'), { recursive: true });
    fs.cpSync(path.join(root, 'docs'), path.join(temporary, 'docs'), { recursive: true });
    // Stub boundaries outside the review pipeline; stage result, session, diff and history validation remain real.
    write('scripts/safe-sync-main.sh', '#!/bin/sh\nexit 0\n', true);
    write('scripts/check-article.sh', '#!/bin/sh\nexit 0\n', true);
    write('scripts/agent-practice/validate-manifest.mjs', '');
    write('scripts/agent-practice/enqueue-reviewed-article.sh', '#!/bin/sh\nprintf "%s\\n" "$@" > queued.txt\n', true);
    write('practice/agent/fixture.json', JSON.stringify({ source_report: 'research/agent/fixture.md' }));
    write('research/agent/fixture.md', '# Research');
    write('logs/agent/run-fixture/execution-log.md', '- Manifest: `practice/agent/fixture.json`\n');
    write('bin/codex', fakeCli, true);
    write('bin/claude', fakeCli, true);
    write('bin/gh', '#!/bin/sh\nexit 0\n', true);
    write('bin/timeout', '#!/bin/sh\nshift\nexec "$@"\n', true);
    for (const args of [['init', '-q'], ['remote', 'add', 'origin', 'https://example.invalid/test.git']]) {
      const result = spawnSync('git', args, { cwd: temporary, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
    }
    const result = spawnSync('bash', ['scripts/auto-agent-practice.sh', '--orchestrator', provider,
      '--resume-after-run', 'logs/agent/run-fixture/execution-log.md', '--max-rounds', '2', '--scheduled', '--pr-only'], {
      cwd: temporary, encoding: 'utf8', timeout: 30_000,
      env: { ...process.env, PATH: path.join(temporary, 'bin') + ':' + process.env.PATH,
        CODEX_BIN: path.join(temporary, 'bin/codex'), CLAUDE_BIN: path.join(temporary, 'bin/claude'),
        SCENARIO: scenario, AGENT_PIPELINE_USAGE_WAIT_SECONDS_OVERRIDE: '0',
        AGENT_PIPELINE_USAGE_RESUME_COUNT: '0', AGENT_PIPELINE_AUTO_RESUME_USAGE_LIMIT: '1',
        AGENT_PIPELINE_MAX_USAGE_RESUMES: '2', MAX_AGENT_STAGE_CONTRACT_REPAIRS: '1',
        ARTICLE_PIPELINE_LOCK_ROOT: temporary, ARTICLE_PIPELINE_SHARED_ARTIFACT_SNAPSHOT: '',
        ARTICLE_PIPELINE_SHARED_ROOT: '', ARTICLE_PIPELINE_ARTIFACT_BASELINE: '',
        AGENT_PIPELINE_RETRY_SIGNAL_FILE: path.join(temporary, 'retry.txt') },
    });
    const expectedFail = ['final-fail', 'low-score', 'missing-revision-log'].includes(scenario);
    assert.equal(result.status, expectedFail ? 20 : 0, `${provider}/${scenario}\n${result.stdout}\n${result.stderr}`);
    assert.equal(fs.existsSync(path.join(temporary, 'queued.txt')), !expectedFail);
    const calls = fs.readFileSync(path.join(temporary, 'calls.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    const reviews = calls.filter(c => c.stage === 'review');
    const revisions = calls.filter(c => c.stage === 'revise');
    assert.equal(reviews[0].isResume, false);
    assert.ok(calls.filter(c => c.stage !== 'review').every(c => !c.isResume && c.session !== reviews[0].session));
    for (const call of calls) {
      const ephemeral = call.args.includes(provider === 'claude' ? '--no-session-persistence' : '--ephemeral');
      assert.equal(ephemeral, call.stage !== 'review', 'only review should persist');
      if (provider === 'codex' && call.isResume) {
        assert.ok(call.args.indexOf('-C') < call.args.indexOf('resume'), 'exec parent options must precede resume');
        assert.ok(call.args.includes('--output-schema'));
      }
    }
    if (scenario === 'missing-revision-log') {
      assert.match(result.stderr, /revision log is missing or incomplete/);
      console.log(`PASS ${provider}/${scenario}`);
      return;
    }
    assert.equal(revisions.filter(c => !(scenario === 'usage-revise' && c === revisions[0])).length, 2);
    assert.equal(reviews.at(-1).round, 3, 'last allowed revision must be reviewed');
    for (const call of reviews.filter(c => c.round > 1)) {
      assert.match(call.prompt, /Previous report: .*review.md/);
      assert.match(call.prompt, /Previous findings: .*findings.json/);
      assert.match(call.prompt, /Revision log: .*revision.md/);
      assert.match(call.prompt, /Diff since the previous review: .*article.diff/);
      assert.match(call.prompt, /Execution log: .*execution-log.md/);
      assert.match(call.prompt, /full history/);
    }
    if (scenario.startsWith('fallback')) {
      const replacement = reviews.find((c, i) => i > 0 && !c.isResume);
      assert.ok(replacement);
      assert.notEqual(replacement.session, reviews[0].session);
      assert.equal(reviews.at(-1).session, replacement.session);
      assert.match(result.stderr, /review session fallback/);
    } else {
      assert.ok(reviews.every(c => c.session === reviews[0].session));
      assert.ok(result.stderr.includes('review session: resume id=' + reviews[0].session));
    }
    if (scenario.startsWith('usage')) {
      assert.match(result.stderr, /preserving review session, history and revision budget/);
      assert.equal(calls.filter(c => c.stage === 'draft').length, 1);
    }
    if (scenario === 'final-fail') {
      assert.match(result.stderr, /final confirmation did not pass after 2 revisions; unresolved: F-002/);
      assert.equal(fs.readFileSync(path.join(temporary, 'retry.txt'), 'utf8'), 'content|review-rounds-exhausted\n');
    }
    if (scenario === 'contract-repair') assert.match(result.stderr, /review contract repair start/);
    const pipeline = fs.readdirSync(path.join(temporary, 'logs/agent')).find(name => name.startsWith('pipeline-'));
    const history = path.join(temporary, 'logs/agent', pipeline, 'review-history');
    assert.match(fs.readFileSync(path.join(history, 'round-2/article.diff'), 'utf8'), /\+revision 1/);
    assert.match(fs.readFileSync(path.join(history, 'round-1/article.md'), 'utf8'), /^draft\n$/);
    const ledger = JSON.parse(fs.readFileSync(path.join(history, 'round-3/findings.json')));
    assert.equal(ledger[0].status, 'resolved');
    assert.equal(ledger[1].status, scenario === 'final-fail' ? 'unresolved' : 'resolved');
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
  console.log(`PASS ${provider}/${scenario}`);
}
for (const provider of ['codex', 'claude']) {
  for (const scenario of ['normal', 'final-fail', 'fallback', 'fallback-zero', 'contract-repair', 'low-score', 'missing-revision-log']) runCase(provider, scenario);
}
runCase('claude', 'usage-review');
runCase('claude', 'usage-revise');
console.log('Agent review continuity tests passed');
