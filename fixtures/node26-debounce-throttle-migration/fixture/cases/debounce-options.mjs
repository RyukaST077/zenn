import { debounce } from 'node:util';
import lodashDebounce from 'lodash.debounce';
import { sleep } from '../lib/timeline.mjs';

async function burst(factory, options, inputs = ['A', 'B', 'C'], interval = 10, settle = 60) {
  const calls = [];
  const fn = factory((arg) => {
    calls.push(arg);
    return `result:${arg}`;
  }, options);
  for (const input of inputs) {
    const returned = fn(input);
    if (returned && typeof returned.catch === 'function') returned.catch(() => {});
    await sleep(interval);
  }
  await sleep(settle);
  return calls;
}

export async function runDebounceOptions() {
  const longInput = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  return {
    node: {
      documentedOptions: ['leading', 'rejectOnCancel', 'signal'],
      default: await burst((fn) => debounce(fn, 30), null),
      leadingTrue: await burst((fn) => debounce(fn, 30, { leading: true }), null),
      trailingOption: 'not-provided',
      maxWaitOption: 'not-provided',
    },
    lodash: {
      documentedOptions: ['leading', 'trailing', 'maxWait'],
      default: await burst((fn) => lodashDebounce(fn, 30), null),
      leadingTrue: await burst((fn) => lodashDebounce(fn, 30, { leading: true }), null),
      trailingFalse: await burst((fn) => lodashDebounce(fn, 30, { trailing: false }), null),
      maxWait: await burst(
        (fn) => lodashDebounce(fn, 50, { maxWait: 70 }),
        null,
        longInput,
        20,
        90,
      ),
    },
    classifications: {
      leading: 'direct-option-exists-with-semantics-to-review',
      trailingFalse: 'wrapper-or-lodash',
      maxWait: 'wrapper-or-lodash',
    },
  };
}
