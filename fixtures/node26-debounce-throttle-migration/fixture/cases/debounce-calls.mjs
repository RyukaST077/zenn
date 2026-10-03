import { debounce } from 'node:util';
import lodashDebounce from 'lodash.debounce';
import { sleep, valueType } from '../lib/timeline.mjs';

export async function runDebounceCalls() {
  const nodeCalls = [];
  const nodeFn = debounce((arg) => {
    nodeCalls.push(arg);
    return `result:${arg}`;
  }, 30);
  const nodeReturns = [nodeFn('A'), nodeFn('B'), nodeFn('C')];
  const nodeReturnTypes = nodeReturns.map(valueType);
  const nodeValues = await Promise.all(nodeReturns);
  const nodeFlush = debounce((arg) => `result:${arg}`, 100);
  const nodeFlushPromise = nodeFlush('F');
  const nodeFlushReturnType = valueType(nodeFlush.flush());
  const nodeFlushValue = await nodeFlushPromise;

  const lodashCalls = [];
  const lodashFn = lodashDebounce((arg) => {
    lodashCalls.push(arg);
    return `result:${arg}`;
  }, 30);
  const lodashReturns = [lodashFn('A'), lodashFn('B'), lodashFn('C')];
  const lodashReturnTypes = lodashReturns.map(valueType);
  await sleep(55);
  const lodashFlushValue = lodashFn.flush();

  return {
    input: ['A', 'B', 'C'],
    node: {
      callbackCount: nodeCalls.length,
      callbackArgs: nodeCalls,
      returnTypes: nodeReturnTypes,
      settledValues: nodeValues,
      flushReturnType: nodeFlushReturnType,
      flushValue: nodeFlushValue,
    },
    lodash: {
      callbackCount: lodashCalls.length,
      callbackArgs: lodashCalls,
      returnTypes: lodashReturnTypes,
      flushValue: lodashFlushValue,
    },
  };
}
