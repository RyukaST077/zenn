import { setTimeout as sleep } from 'node:timers/promises';

export { sleep };

export function valueType(value) {
  if (value && typeof value.then === 'function') return 'promise';
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  return typeof value;
}

export function errorFact(error) {
  return {
    name: error?.name ?? null,
    code: error?.code ?? null,
    message: error?.message ?? String(error),
    cause: error?.cause == null ? null : String(error.cause),
  };
}
