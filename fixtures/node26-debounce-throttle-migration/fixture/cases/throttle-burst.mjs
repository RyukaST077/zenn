import { throttle } from 'node:util';
import lodashThrottle from 'lodash.throttle';
import { errorFact, sleep, valueType } from '../lib/timeline.mjs';

async function settle(promises) {
  return Promise.all(promises.map((promise) => promise.then(
    (value) => ({ status: 'fulfilled', value }),
    (error) => ({ status: 'rejected', error: errorFact(error) }),
  )));
}

async function nodeSync(options = {}) {
  const calls = [];
  const fn = throttle((arg) => { calls.push(arg); return `result:${arg}`; }, 1, 35, options);
  const returns = ['A', 'B', 'C'].map((arg) => fn(arg));
  return { calls: (await settle(returns), calls), returnTypes: returns.map(valueType), settled: await settle(returns) };
}

async function nodeConcurrency() {
  const started = [];
  const completed = [];
  let active = 0;
  let maxActive = 0;
  const fn = throttle(async (arg) => {
    active++;
    maxActive = Math.max(maxActive, active);
    started.push(arg);
    await sleep(35);
    completed.push(arg);
    active--;
    return `result:${arg}`;
  }, 10, 100, { concurrency: 2 });
  const returns = ['A', 'B', 'C'].map((arg) => fn(arg));
  return { started, completed, maxActive, returnTypes: returns.map(valueType), settled: await settle(returns) };
}

async function lodashScenario(options) {
  const calls = [];
  const fn = lodashThrottle((arg) => { calls.push(arg); return `result:${arg}`; }, 35, options);
  const returns = ['A', 'B', 'C'].map((arg) => fn(arg));
  await sleep(60);
  return { calls, returnTypes: returns.map(valueType), returnedValues: returns.map((x) => x ?? null) };
}

export async function runThrottleBurst() {
  const queue = await nodeSync();
  const drop = await nodeSync({ overflow: 'drop' });
  const maxPending = await nodeSync({ maxPending: 1 });
  const concurrency = await nodeConcurrency();
  return {
    input: ['A', 'B', 'C'],
    node: {
      queue,
      drop,
      maxPending,
      concurrency,
      counts: {
        queueAccepted: queue.settled.filter((x) => x.status === 'fulfilled').length,
        dropRejected: drop.settled.filter((x) => x.status === 'rejected').length,
        maxPendingRejected: maxPending.settled.filter((x) => x.status === 'rejected').length,
      },
    },
    lodash: {
      default: await lodashScenario(undefined),
      trailingOnly: await lodashScenario({ leading: false, trailing: true }),
      leadingOnly: await lodashScenario({ leading: true, trailing: false }),
    },
  };
}
