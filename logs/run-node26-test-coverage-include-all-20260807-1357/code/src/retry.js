export async function retry(fn, options = {}) {
  const attempts = options.attempts ?? 3;
  const delayMs = options.delayMs ?? 10;
  const factor = options.factor ?? 2;
  const shouldRetry = options.shouldRetry ?? (() => true);

  if (typeof fn !== 'function') {
    throw new TypeError('fn must be a function');
  }
  if (attempts < 1) {
    throw new RangeError('attempts must be >= 1');
  }

  let lastError;
  let wait = delayMs;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn(i);
    } catch (err) {
      lastError = err;
      if (!shouldRetry(err, i)) {
        break;
      }
      if (i === attempts - 1) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, wait));
      wait = wait * factor;
    }
  }
  throw lastError;
}
