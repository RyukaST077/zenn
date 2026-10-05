import test from 'node:test';
import assert from 'node:assert/strict';
import { runDebounceCalls } from '../fixture/cases/debounce-calls.mjs';
import { runDebounceOptions } from '../fixture/cases/debounce-options.mjs';
import { runCancelFlushAbort } from '../fixture/cases/cancel-flush-abort.mjs';
import { runThrottleBurst } from '../fixture/cases/throttle-burst.mjs';
import { runTimerRef } from '../fixture/cases/timer-ref.mjs';

test('Case 1 runtime is Node 26.10.0', () => assert.equal(process.version, 'v26.10.0'));
test('Case 2 same A/B/C input exposes Promise versus sync returns', async () => {
  const x = await runDebounceCalls(); assert.deepEqual(x.node.callbackArgs, ['C']); assert.deepEqual(x.lodash.callbackArgs, ['C']);
});
test('Case 3 same burst exposes option asymmetry', async () => {
  const x = await runDebounceOptions(); assert.equal(x.node.maxWaitOption, 'not-provided'); assert.ok(x.lodash.maxWait.length >= 2);
});
test('Case 4 isolated children expose cancellation and AbortSignal', async () => {
  const x = await runCancelFlushAbort(); assert.equal(x.handled.summary.rejection.name, 'AbortError'); assert.notEqual(x.strict.code, 0);
});
test('Case 5 same burst distinguishes queue/drop/concurrency', async () => {
  const x = await runThrottleBurst(); assert.deepEqual(x.node.queue.calls, ['A','B','C']); assert.equal(x.node.counts.dropRejected, 2);
});
test('Case 6 child exit distinguishes ref/unref', async () => {
  const x = await runTimerRef(); assert.equal(x.node.ref.callbackRan, true); assert.equal(x.node.unref.callbackRan, false);
});
