// Read only top-level provider envelopes; tool output and article text are not errors.
export function claudeEvents(raw) {
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch {
    parsed = raw.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  }
  const events = Array.isArray(parsed) ? parsed : [parsed];
  if (!events.length || events.some(event => !event || typeof event !== 'object' || Array.isArray(event))) {
    throw new Error('invalid Claude response envelope');
  }
  return events;
}

export function claudeResult(raw) {
  const events = claudeEvents(raw);
  return events.findLast(event => event.type === 'result' || event.type === 'error' || !event.type) || {};
}

export function claudeError(event) {
  return event.is_error === true || event.type === 'error'
    || event.terminal_reason === 'api_error' || Boolean(event.api_error)
    || /^error_/.test(event.subtype || '');
}
