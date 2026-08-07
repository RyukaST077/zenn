export function parseQuery(qs) {
  const out = {};
  if (typeof qs !== 'string') {
    return out;
  }
  const body = qs.startsWith('?') ? qs.slice(1) : qs;
  if (body.length === 0) {
    return out;
  }
  for (const pair of body.split('&')) {
    if (pair.length === 0) {
      continue;
    }
    const idx = pair.indexOf('=');
    if (idx === -1) {
      out[decodeURIComponent(pair)] = '';
      continue;
    }
    const key = decodeURIComponent(pair.slice(0, idx));
    const value = decodeURIComponent(pair.slice(idx + 1));
    if (Object.hasOwn(out, key)) {
      if (Array.isArray(out[key])) {
        out[key].push(value);
      } else {
        out[key] = [out[key], value];
      }
    } else {
      out[key] = value;
    }
  }
  return out;
}
