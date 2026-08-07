function isPlainObject(value) {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  if (Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function deepMerge(target, source) {
  if (!isPlainObject(target)) {
    return isPlainObject(source) ? deepMerge({}, source) : source;
  }
  if (!isPlainObject(source)) {
    return target;
  }
  const out = { ...target };
  for (const key of Object.keys(source)) {
    const sv = source[key];
    const tv = out[key];
    if (isPlainObject(sv) && isPlainObject(tv)) {
      out[key] = deepMerge(tv, sv);
    } else if (Array.isArray(sv) && Array.isArray(tv)) {
      out[key] = [...tv, ...sv];
    } else if (sv === undefined) {
      continue;
    } else {
      out[key] = sv;
    }
  }
  return out;
}
