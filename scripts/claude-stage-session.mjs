#!/usr/bin/env node
// Durable diagnostics for in-process usage recovery, not a supervisor restart mechanism.
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { claudeResult } from './claude-response.mjs';

const [command, file, ...args] = process.argv.slice(2);
const read = () => JSON.parse(fs.readFileSync(file, 'utf8'));
const save = state => {
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, JSON.stringify({ ...state, updated_at: new Date().toISOString() }, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(temporary, file);
};
try {
  if (command === 'init') {
    if (fs.existsSync(file)) throw new Error('session state already exists');
    const [stage, index, marker, previousId, identityFile, model, effort, prompt] = args;
    const session_id = previousId || crypto.randomUUID();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(session_id)) throw new Error('invalid session UUID');
    const prompt_file = `${file}.prompt.txt`;
    fs.writeFileSync(prompt_file, prompt, { mode: 0o600, flag: 'wx' });
    save({ version: 1, pipeline: path.dirname(file), stage, index, marker, session_id, cwd: process.cwd(), prompt_file,
      article_identity: fs.existsSync(identityFile) ? JSON.parse(fs.readFileSync(identityFile, 'utf8')) : null,
      model, effort, prompt_sha256: crypto.createHash('sha256').update(prompt).digest('hex'),
      started_at: new Date().toISOString(), status: 'running', attempts: 1, usage_resumes: 0 });
    process.stdout.write(session_id);
  } else if (command === 'get') {
    const value = read()[args[0]];
    if (typeof value !== 'string' || !value) throw new Error(`missing session ${args[0]}`);
    process.stdout.write(value);
  } else if (command === 'response') {
    const state = read();
    const response = claudeResult(fs.readFileSync(args[0], 'utf8'));
    state.last_events = args[0];
    if (response.session_id && response.session_id !== state.session_id) {
      save({ ...state, status: 'resume_unavailable', reason: 'session ID mismatch' });
      throw Object.assign(new Error('session ID mismatch'), { exitCode: 3 });
    }
    save({ ...state, provider_error: typeof response.api_error === 'string' ? response.api_error : null });
  } else if (command === 'wait') {
    const [resetLabel, waitSeconds, policy, count] = args;
    const state = read();
    save({ ...state, status: 'waiting_usage_limit', reason: 'Claude usage limit',
      usage_limit_reason: state.provider_error || 'Claude usage limit', usage_limit_events: state.last_events,
      reset_label: resetLabel, wait_seconds: Number(waitSeconds), wait_policy: policy,
      resume_at: new Date(Date.now() + Number(waitSeconds) * 1000).toISOString(), usage_resumes: Number(count) });
  } else if (command === 'resume') {
    const state = read();
    save({ ...state, status: 'running', attempts: state.attempts + 1 });
  } else if (command === 'status') {
    save({ ...read(), status: args[0], reason: args[1] || null });
  } else throw new Error('invalid session state command');
} catch (error) {
  console.error(`Claude session state: ${error.message}`);
  process.exitCode = error.exitCode || 2;
}
