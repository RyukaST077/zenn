#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'zenn-codex-contract-'));
const run = (cwd, cmd, args, env = {}) => spawnSync(cmd, args, {
  cwd, encoding: 'utf8', timeout: 30000, env: { ...process.env, ...env },
});
const ok = result => {
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return result.stdout;
};
const write = (cwd, relative, data, mode) => {
  const file = path.join(cwd, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data, mode ? { mode } : undefined);
};
const init = cwd => {
  fs.mkdirSync(cwd);
  ok(run(cwd, 'git', ['init', '-q', '-b', 'main']));
  ok(run(cwd, 'git', ['config', 'user.name', 'Codex Fixture']));
  ok(run(cwd, 'git', ['config', 'user.email', 'fixture@example.invalid']));
};

try {
  // The modern entrypoint loads a committed bootstrap before parsing arguments.
  const dispatch = path.join(temp, 'dispatch');
  init(dispatch);
  write(dispatch, 'scripts/auto-publish-codex.sh', fs.readFileSync(path.join(root, 'scripts/auto-publish-codex.sh')));
  write(dispatch, 'scripts/run-article-pipeline-worktree.sh', 'printf "%s\\n" "$@"\n');
  ok(run(dispatch, 'git', ['add', '.']));
  ok(run(dispatch, 'git', ['commit', '-qm', 'dispatch fixture']));
  for (const args of [[], ['--search-args', 'テーマはunsnooze 自動再開', '--max-rounds', '3', '--resume', 'logs/codex-pipeline-fixture', '--auto-merge']]) {
    const output = ok(run(dispatch, 'bash', ['scripts/auto-publish-codex.sh', ...args], { ARTICLE_PIPELINE_ISOLATED_WORKTREE: '0' }));
    assert.deepEqual(output.trimEnd().split('\n'), ['--shared-root', fs.realpathSync(dispatch), '--', 'scripts/auto-publish-codex.sh', ...args]);
  }

  const report = 'research/search-topic-fixture.md';
  const plan = 'practice/practice-fixture.md';
  const pipeline = 'logs/codex-pipeline-fixture';
  const policy = JSON.parse(fs.readFileSync(path.join(root, 'strategy/topic-selection-policy.json')));
  const contract = {
    slug: 'search-contract-fixture', policyVersion: policy.policyVersion,
    experimentId: null, arm: 'exploration', valueArchetype: 'decision',
    targetReader: '設定を選ぶ開発者', readerDecision: '用途に合う設定を選べる',
    takeaway: '設定の選択表', verificationItems: ['設定A', '設定B', '設定C'],
    titleDraft: '設定の選択を検証する', primaryTopic: 'test', topics: ['test'], demandEvidence: 'fixture',
  };
  for (const scenario of ['missing', 'invalid', 'valid', 'resume-missing', 'resume-valid', 'stale-plan', 'updated-plan']) {
    const cwd = path.join(temp, scenario);
    init(cwd);
    fs.cpSync(path.join(root, 'scripts'), path.join(cwd, 'scripts'), { recursive: true });
    write(cwd, 'strategy/topic-selection-policy.json', JSON.stringify(policy));
    ok(run(cwd, 'git', ['remote', 'add', 'origin', dispatch]));
    const selected = { ...contract };
    if (scenario === 'invalid') delete selected.arm;
    const body = scenario.endsWith('missing') ? '# Missing contract\n'
      : '# Research\n\n## 記事契約\n\n```json\n' + JSON.stringify(selected) + '\n```\n';
    write(cwd, 'report-input.md', body);
    write(cwd, plan, '# Plan from an interrupted attempt\n');
    fs.utimesSync(path.join(cwd, plan), new Date(0), new Date(0));
    write(cwd, 'bin/gh', '#!/bin/sh\n[ "$1 $2" = "auth status" ]\n', 0o755);
    write(cwd, 'bin/codex', `#!/usr/bin/env node
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const args = process.argv.slice(2);
if (args[0] === 'login') process.exit(0);
if (args[0] === 'sandbox') {
  // Simulate only the repository-side sandbox probe; never write outside it.
  fs.writeFileSync(args.at(-2), '');
  process.exit(0);
}
const prompt = args.at(-1);
const stage = prompt.includes('$zenn-search-topic') ? 'search' : prompt.includes('$zenn-plan-practice') ? 'plan' : 'run';
fs.appendFileSync('calls.txt', stage + '\\n');
let artifact = '';
if (stage === 'search') {
  fs.mkdirSync('research', { recursive: true });
  fs.copyFileSync('report-input.md', ${JSON.stringify(report)});
  artifact = ${JSON.stringify(report)};
  if (process.env.SCENARIO !== 'missing' && process.env.SCENARIO !== 'invalid')
    execFileSync(process.execPath, ['scripts/analytics/register-article.mjs', '--from-research', artifact]);
} else if (stage === 'plan' && ['stale-plan', 'updated-plan'].includes(process.env.SCENARIO)) {
  artifact = ${JSON.stringify(plan)};
  if (process.env.SCENARIO === 'updated-plan') fs.appendFileSync(artifact, '\\nRevalidated against the supplied report.\\n');
}
const result = JSON.stringify({ status: artifact ? 'ok' : 'abort', artifact,
  reason: artifact ? '' : 'fixture stop at ' + stage, metadata: { verdict: null, slug: null, pr_metadata: null } });
fs.writeFileSync(args[args.indexOf('-o') + 1], result);
console.log(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: result } }));
console.log(JSON.stringify({ type: 'turn.completed' }));
`, 0o755);
    const resume = scenario.startsWith('resume-');
    if (resume) {
      write(cwd, report, body);
      ok(run(cwd, process.execPath, ['scripts/pipeline-state.mjs', 'init', `${pipeline}/state.json`, 'main']));
      ok(run(cwd, process.execPath, ['scripts/pipeline-state.mjs', 'set', `${pipeline}/state.json`, 'completed.search', 'true']));
      ok(run(cwd, process.execPath, ['scripts/pipeline-state.mjs', 'set', `${pipeline}/state.json`, 'artifacts.report', JSON.stringify(report)]));
      if (scenario === 'resume-valid') ok(run(cwd, process.execPath, ['scripts/analytics/register-article.mjs', '--from-research', report]));
    }
    const result = run(cwd, 'bash', ['scripts/auto-publish-codex.sh', ...(resume ? ['--resume', pipeline] : [])], {
      PATH: `${path.join(cwd, 'bin')}:${process.env.PATH}`,
      CODEX_BIN: path.join(cwd, 'bin/codex'), SCENARIO: scenario,
      ARTICLE_PIPELINE_ISOLATED_WORKTREE: '1', ARTICLE_PIPELINE_LOCK_ROOT: cwd,
    });
    assert.equal(result.status, 1, `${scenario}: ${result.stdout}\n${result.stderr}`);
    const calls = fs.existsSync(path.join(cwd, 'calls.txt')) ? fs.readFileSync(path.join(cwd, 'calls.txt'), 'utf8').trim().split('\n') : [];
    const prefix = resume ? [] : ['search'];
    if (scenario.endsWith('missing') || scenario === 'invalid') {
      assert.deepEqual(calls, prefix, `${scenario} must stop before planning`);
      assert.match(result.stderr, /search article contract is missing or invalid/);
    } else if (scenario === 'stale-plan') {
      assert.deepEqual(calls, [...prefix, 'plan']);
      assert.match(result.stderr, /artifact was not created or updated by this stage/);
    } else if (scenario === 'updated-plan') {
      assert.deepEqual(calls, [...prefix, 'plan', 'run']);
      assert.match(result.stderr, /fixture stop at run/);
    } else {
      assert.deepEqual(calls, [...prefix, 'plan']);
      assert.match(result.stderr, /fixture stop at plan/);
    }
  }
  console.log('Codex search contract and resume tests passed');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
