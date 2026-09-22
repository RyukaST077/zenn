#!/usr/bin/env node
// Immutable per-review evidence and deterministic finding transition checks.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const read = (file) => fs.readFileSync(file, 'utf8');
const json = (file) => JSON.parse(read(file));
const write = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const requireText = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must contain evidence/reason`);
};

export function validateFindings(current, previous, verdict, report) {
  if (!Array.isArray(current) || !Array.isArray(previous)) throw new Error('findings must be arrays');
  const old = new Map(previous.map((f) => [f.id, f]));
  const seen = new Set();
  for (const finding of current) {
    const { id, status, severity, category, reason, evidence } = finding;
    if (!/^F-\d{3,}$/.test(id) || seen.has(id)) throw new Error(`invalid/duplicate finding ID: ${id}`);
    seen.add(id);
    if (!['unresolved', 'resolved'].includes(status)) throw new Error(`${id}: invalid status`);
    if (!['blocker', 'warning', 'suggestion'].includes(severity)) throw new Error(`${id}: invalid severity`);
    requireText(reason, `${id} reason`);
    requireText(evidence, `${id} evidence`);
    const prior = old.get(id);
    if (!prior) {
      const allowed = previous.length || verdict.round > 1
        ? ['major-oversight', 'revision-regression'] : ['initial'];
      if (!allowed.includes(category)) throw new Error(`${id}: new finding requires an allowed category and rationale`);
    } else {
      if (category !== prior.category) throw new Error(`${id}: preserve original category`);
      if (prior.status === 'resolved' && status === 'unresolved') {
        requireText(finding.reopen_reason, `${id} reopen_reason`);
        if (evidence.trim() === prior.evidence.trim()) throw new Error(`${id}: reopening requires new evidence`);
      }
    }
  }
  for (const id of old.keys()) if (!seen.has(id)) throw new Error(`${id}: prior finding disappeared`);
  for (const [severity, field] of [['blocker', 'blockers'], ['warning', 'warnings']]) {
    const count = current.filter((f) => f.status === 'unresolved' && f.severity === severity).length;
    const lines = [...report.matchAll(new RegExp(`^${field}: (\\d+)$`, 'gm'))];
    if (lines.length !== 1 || Number(lines[0][1]) !== count) throw new Error(`${field} does not match unresolved findings`);
  }
  const blocking = current.filter((f) => f.status === 'unresolved' && f.severity !== 'suggestion');
  if (verdict.value === 'pass' && blocking.length) throw new Error('pass has unresolved findings');
  if (verdict.value === 'fix' && !blocking.length) throw new Error('fix must name unresolved blockers/warnings');
  return blocking;
}

function eventsFor(provider, raw) {
  return provider === 'claude' ? [JSON.parse(raw)] : raw.trim().split('\n').map((line) => {
    try { return JSON.parse(line); } catch { return {}; }
  });
}

export function hasProviderError(provider, raw) {
  const events = eventsFor(provider, raw);
  // A Codex transient error may recover before the turn completes.
  const terminal = events.findLast((event) => ['turn.completed', 'turn.failed'].includes(event.type));
  if (provider === 'codex' && terminal) return terminal.type === 'turn.failed';
  return events.some((event) => event.is_error === true || event.type === 'error');
}

export function sessionId(provider, raw) {
  const ids = eventsFor(provider, raw)
    .filter((event) => provider === 'claude' || event.type === 'thread.started')
    .map((event) => provider === 'claude' ? event.session_id : event.thread_id).filter(Boolean);
  const id = ids.at(-1);
  if (typeof id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{7,127}$/.test(id)) throw new Error('missing or invalid review session ID');
  return id;
}

function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'session') {
    process.stdout.write(sessionId(args[0], read(args[1])));
  } else if (command === 'has-error') {
    process.exitCode = hasProviderError(args[0], read(args[1])) ? 0 : 1;
  } else if (command === 'prepare') {
    const [directory, roundText, article] = args;
    const round = Number(roundText);
    const target = path.join(directory, `round-${round}`);
    fs.mkdirSync(target, { recursive: true });
    fs.copyFileSync(article, path.join(target, 'article.md'));
    write(path.join(target, 'input.json'), { article, round });
    if (round > 1) {
      const before = path.join(directory, `round-${round - 1}`, 'article.md');
      const diff = spawnSync('diff', ['-u', before, path.join(target, 'article.md')], { encoding: 'utf8' });
      if (![0, 1].includes(diff.status)) throw new Error(`article diff failed: ${diff.stderr}`);
      fs.writeFileSync(path.join(target, 'article.diff'), diff.stdout || '(no article text changes)\n');
    }
    process.stdout.write(target);
  } else if (command === 'accept') {
    const [directory, roundText, reportFile, verdict, article] = args;
    const round = Number(roundText);
    const target = path.join(directory, `round-${round}`);
    if (read(article) !== read(path.join(target, 'article.md'))) throw new Error('review modified the article');
    const report = read(reportFile);
    const blocks = [...report.matchAll(/^```review-findings\n([\s\S]*?)\n```/gm)];
    if (blocks.length !== 1) throw new Error('review requires exactly one review-findings JSON block');
    const current = JSON.parse(blocks[0][1]);
    const previous = round > 1 ? json(path.join(directory, `round-${round - 1}`, 'findings.json')) : [];
    const unresolved = validateFindings(current, previous, { value: verdict, round }, report);
    fs.copyFileSync(reportFile, path.join(target, 'review.md'));
    write(path.join(target, 'findings.json'), current);
    process.stdout.write(unresolved.map((f) => `${f.id} (${f.severity}): ${f.reason}`).join('\n') || 'none');
  } else if (command === 'revision') {
    const [file, marker, findingsFile] = args;
    if (!fs.lstatSync(file).isFile() || fs.statSync(file).mtimeMs < fs.statSync(marker).mtimeMs) {
      throw new Error('revision log missing, stale, or not a regular file');
    }
    const content = read(file);
    for (const finding of json(findingsFile)) {
      if (finding.status === 'unresolved' && !content.includes(finding.id)) throw new Error(`revision log missing ${finding.id}`);
    }
  } else throw new Error(`unknown review history command: ${command}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try { main(); } catch (error) { console.error(error.message); process.exit(2); }
}
