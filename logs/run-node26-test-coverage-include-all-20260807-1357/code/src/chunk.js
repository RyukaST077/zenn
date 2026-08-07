export function chunk(items, size) {
  if (!Array.isArray(items)) {
    throw new TypeError('items must be an array');
  }
  if (!Number.isInteger(size) || size < 1) {
    throw new RangeError('size must be a positive integer');
  }
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export function zip(a, b) {
  const len = Math.min(a.length, b.length);
  const out = [];
  for (let i = 0; i < len; i++) {
    out.push([a[i], b[i]]);
  }
  return out;
}

export function uniq(items) {
  return [...new Set(items)];
}
