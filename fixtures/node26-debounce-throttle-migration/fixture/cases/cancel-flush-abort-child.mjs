import { debounce } from 'node:util';
import lodashDebounce from 'lodash.debounce';
import { errorFact, sleep } from '../lib/timeline.mjs';

const scenario = process.argv[2];

async function main() {
  if (scenario === 'handled-cancel') {
    const fn = debounce(() => 'never', 100);
    const promise = fn('A');
    const observed = promise.catch(errorFact);
    fn.cancel('handled-reason');
    console.log(JSON.stringify({ rejection: await observed, callbackCount: 0 }));
    return;
  }
  if (scenario === 'unhandled-cancel') {
    let unhandled = null;
    process.on('unhandledRejection', (error) => { unhandled = errorFact(error); });
    const fn = debounce(() => 'never', 100);
    fn('A');
    fn.cancel('unhandled-reason');
    await sleep(40);
    console.log(JSON.stringify({ unhandled, callbackCount: 0 }));
    return;
  }
  if (scenario === 'strict-cancel') {
    const fn = debounce(() => 'never', 100);
    fn('A');
    fn.cancel('strict-reason');
    await sleep(40);
    return;
  }
  if (scenario === 'flush') {
    const calls = [];
    const fn = debounce((arg) => {
      calls.push(arg);
      return `result:${arg}`;
    }, 100);
    const promise = fn('F');
    const before = calls.length;
    const flushReturn = fn.flush();
    console.log(JSON.stringify({ before, after: calls.length, flushReturnType: typeof flushReturn, value: await promise, calls }));
    return;
  }
  if (scenario === 'abort') {
    const pre = new AbortController();
    pre.abort('pre-reason');
    let constructorError;
    try { debounce(() => {}, 20, { signal: pre.signal }); } catch (error) { constructorError = errorFact(error); }
    const active = new AbortController();
    let calls = 0;
    const fn = debounce(() => { calls++; }, 100, { signal: active.signal });
    const pending = fn('A').catch(errorFact);
    active.abort('pending-reason');
    const pendingError = await pending;
    const futureError = await fn('B').catch(errorFact);
    console.log(JSON.stringify({ constructorError, pendingError, futureError, callbackCount: calls }));
    return;
  }
  if (scenario === 'lodash') {
    const calls = [];
    const cancelled = lodashDebounce((arg) => { calls.push(arg); return `result:${arg}`; }, 100);
    const cancelReturn = cancelled('A');
    cancelled.cancel();
    await sleep(20);
    const flushed = lodashDebounce((arg) => { calls.push(arg); return `result:${arg}`; }, 100);
    const beforeFlush = flushed('F');
    const flushValue = flushed.flush();
    console.log(JSON.stringify({ cancelReturnType: typeof cancelReturn, beforeFlushType: typeof beforeFlush, flushValue, calls }));
    return;
  }
  throw new Error(`unknown scenario: ${scenario}`);
}

await main();
