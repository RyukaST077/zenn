#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { hasProviderError } from './agent-review-history.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-limit-classifier-'));
const now = String(Date.parse('2026-11-09T22:16:49Z'));
// Only relevant public error fields from the production failure, no credentials.
const actual = { type: 'result', subtype: 'success', is_error: true, terminal_reason: 'api_error',
  api_error_status: 429, api_error: 'usage_limit_reached',
  result: "You've hit your 5-hour limit · resets 10am (Asia/Tokyo)" };
const cases = [
  ['actual', actual, 0],
  ['legacy', { type: 'result', is_error: true, result: "You've hit your session limit · resets 10am (Asia/Tokyo)" }, 0],
  ['code-before-wording', { ...actual, result: 'Allowance exhausted; resets 10am (Asia/Tokyo)' }, 0],
  ['zero-exit-error', { ...actual, is_error: false }, 0],
  ['no-reset', { ...actual, result: 'Allowance exhausted' }, 2],
  ['invalid-reset', { ...actual, result: 'Usage limit resets tomorrow-ish' }, 2],
  ['invalid-clock', { ...actual, result: 'Usage limit resets 13:99pm (Asia/Tokyo)' }, 2],
  ['invalid-date', { ...actual, result: 'Usage limit resets 2026-02-30 10:00 (Asia/Tokyo)' }, 2],
  ['unsupported-weekly-time', { ...actual, result: 'Weekly usage limit resets Friday 10am (Asia/Tokyo)' }, 2],
  ['non-limit-429', { type: 'result', is_error: true, api_error_status: 429, api_error: 'rate_limit_error', result: 'Rate limit exceeded' }, 1],
  ['success-mention', { type: 'result', is_error: false, result: actual.result }, 1],
  ['nested-tool-output', { type: 'result', is_error: true, result: 'Unrelated error', tool_output: actual }, 1],
  ['historical-error', [actual, { type: 'result', is_error: false, result: 'completed' }], 1],
  ['jsonl-limit', [{ type: 'assistant', message: 'Reading files' }, actual].map(JSON.stringify).join('\n'), 0],
  ['jsonl-recovered', [actual, { type: 'result', is_error: false, result: 'completed' }].map(JSON.stringify).join('\n'), 1],
  ['jsonl-terminal-error', [{ type: 'result', result: 'completed' }, { ...actual, type: 'error', message: actual.result }].map(JSON.stringify).join('\n'), 0],
  ['jsonl-tool-quote', [{ type: 'tool_result', content: actual.result }, { type: 'result', result: 'completed' }].map(JSON.stringify).join('\n'), 1],
  ['plain-reset-helper', 'usage limit resets 10am (Asia/Tokyo)\n', 0],
  ['malformed-json', '{"type":"result",', 2],
];
try {
  for (const [label, envelope, status] of cases) {
    const file = path.join(directory, label);
    fs.writeFileSync(file, typeof envelope === 'string' ? envelope : JSON.stringify(envelope));
    const result = spawnSync(process.execPath, [path.join(root, 'claude-usage-limit.mjs'), file, now], { encoding: 'utf8' });
    assert.equal(result.status, status, `${label}: ${result.stderr}`);
    if (status === 0) assert.equal(result.stdout, '9791\n10am (Asia/Tokyo)\n', label);
  }
  assert.equal(hasProviderError('claude', JSON.stringify(actual)), true);
  assert.equal(hasProviderError('claude', JSON.stringify({ ...actual, is_error: false })), true);
  assert.equal(hasProviderError('claude', [actual, { type: 'result', result: 'completed' }].map(JSON.stringify).join('\n')), false);
  console.log('Claude usage limit classification tests passed');
} finally { fs.rmSync(directory, { recursive: true, force: true }); }
