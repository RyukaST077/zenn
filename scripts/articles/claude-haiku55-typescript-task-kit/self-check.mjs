import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { grade, snapshot, tasks } from './grade.mjs';

export const fixture = path.dirname(fileURLToPath(import.meta.url));
export function prepare(task, target) {
  fs.cpSync(path.join(fixture, 'tasks', task), target, { recursive: true });
  fs.copyFileSync(path.join(fixture, 'public-support.mjs'), path.join(target, 'public-support.mjs'));
}
export function applyAnswer(task, target) {
  fs.cpSync(path.join(fixture, 'answers', task), target, { recursive: true });
}
export function selfCheck(task) {
  if (!tasks.includes(task)) throw new Error('HARNESS: unknown task');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-task-oracle-'));
  try {
    prepare(task, temp);
    const before = snapshot(temp), baseline = grade(task, temp, before);
    applyAnswer(task, temp);
    const answer = grade(task, temp, before);
    if (baseline.full_pass || !answer.full_pass) throw new Error('HARNESS: baseline/golden oracle calibration failed');
    return { baseline, answer, marker: 'ORACLE_CALIBRATED' };
  } finally { fs.rmSync(temp, { recursive: true }); }
}
