import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const childPath = fileURLToPath(new URL('./cancel-flush-abort-child.mjs', import.meta.url));

function runChild(name, strict = false) {
  return new Promise((resolve) => {
    const args = strict ? ['--unhandled-rejections=strict', childPath, name] : [childPath, name];
    const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, 2000);
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      let summary = null;
      const trimmed = stdout.trim();
      if (trimmed) {
        try { summary = JSON.parse(trimmed.split('\n').at(-1)); } catch {}
      }
      resolve({ name, code, signal, timedOut, summary, stdout: trimmed, stderr: stderr.trim() });
    });
  });
}

export async function runCancelFlushAbort() {
  const handled = await runChild('handled-cancel');
  const unhandled = await runChild('unhandled-cancel');
  const strict = await runChild('strict-cancel', true);
  const flush = await runChild('flush');
  const abort = await runChild('abort');
  const lodash = await runChild('lodash');
  return { handled, unhandled, strict, flush, abort, lodash };
}
