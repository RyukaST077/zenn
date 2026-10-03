import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const childPath = fileURLToPath(new URL('./timer-ref-child.mjs', import.meta.url));

function runMode(mode) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, [childPath, mode], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, 2000);
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      const elapsed = Date.now() - started;
      resolve({
        mode,
        code,
        signal,
        timedOut,
        callbackRan: stdout.includes('CALLBACK'),
        elapsedClass: elapsed < 200 ? 'early' : elapsed <= 1000 ? 'callback-window' : 'late',
        stderr: stderr.trim(),
      });
    });
  });
}

export async function runTimerRef() {
  return {
    node: {
      ref: await runMode('ref'),
      unref: await runMode('unref'),
      reref: await runMode('reref'),
    },
    lodash: { refApi: 'not-provided', unrefApi: 'not-provided' },
    timingRule: 'early < 200ms; callback-window 200..1000ms; hard timeout 2000ms',
  };
}
