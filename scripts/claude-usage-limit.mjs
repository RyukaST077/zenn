#!/usr/bin/env node

import fs from "node:fs";
import { claudeResult, claudeError } from './claude-response.mjs';

const [eventsFile, nowArgument] = process.argv.slice(2);
if (!eventsFile) {
  console.error("usage: claude-usage-limit.mjs EVENTS_FILE [NOW_EPOCH_MS]");
  process.exit(2);
}

let raw;
try {
  raw = fs.readFileSync(eventsFile, "utf8");
} catch (error) {
  console.error(`cannot read Claude events: ${error.message}`);
  process.exit(2);
}

let limitMessage;
try {
  const response = claudeResult(raw);
  if (!claudeError(response)) process.exit(1);
  const message = typeof response.result === 'string' ? response.result
    : typeof response.message === 'string' ? response.message : '';
  if (response.api_error !== 'usage_limit_reached'
      && !/(?:hit your (?:session|5[- ]hour) limit|usage limit)/i.test(message)) process.exit(1);
  limitMessage = message;
} catch {
  // Compatibility with the reset-only input synthesized by wait-for-claude-usage.sh.
  if (/^usage limit resets? [^\r\n]+\s*$/i.test(raw.trim())
      || /^You've hit your (?:session|5[- ]hour) limit\b[^\r\n]*\s*$/i.test(raw.trim())) {
    limitMessage = raw.trim();
  } else {
    console.error('invalid Claude usage limit response');
    process.exit(2);
  }
}

const resetMatch = limitMessage.match(/resets?\s+([^\n"·]+)/i);
if (!resetMatch) {
  console.error("Claude usage limit was detected, but its reset time was missing");
  process.exit(2);
}

const resetLabel = resetMatch[1].trim();
const nowMs = nowArgument === undefined ? Date.now() : Number(nowArgument);
if (!Number.isFinite(nowMs)) {
  console.error("NOW_EPOCH_MS must be numeric");
  process.exit(2);
}

const zonedParts = (epochMs, timeZone) => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  return Object.fromEntries(formatter.formatToParts(new Date(epochMs))
    .filter((part) => part.type !== "literal")
    .map((part) => [part.type, Number(part.value)]));
};

const zonedDateTimeToEpoch = (target, timeZone) => {
  const desiredUtc = Date.UTC(
    target.year, target.month - 1, target.day, target.hour, target.minute, target.second || 0,
  );
  let guess = desiredUtc;
  for (let index = 0; index < 5; index += 1) {
    const observed = zonedParts(guess, timeZone);
    const observedUtc = Date.UTC(
      observed.year, observed.month - 1, observed.day,
      observed.hour, observed.minute, observed.second,
    );
    const adjustment = desiredUtc - observedUtc;
    guess += adjustment;
    if (adjustment === 0) break;
  }
  return guess;
};

const addDay = ({ year, month, day }) => {
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
};

const parseResetEpoch = () => {
  const zoneMatch = resetLabel.match(/\(([^)]+)\)\s*$/);
  const timeZone = zoneMatch?.[1] || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  // Validate the named zone before using it in the conversion helpers.
  try { zonedParts(nowMs, timeZone); }
  catch { throw new Error(`unsupported reset timezone: ${timeZone}`); }

  const absolute = resetLabel.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*\([^)]+\))?$/,
  );
  if (absolute) {
    const values = absolute.slice(1, 7).map(value => Number(value || 0));
    const [year, month, day, hour, minute, second] = values;
    const check = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    if (check.getUTCFullYear() !== year || check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day
        || hour > 23 || minute > 59 || second > 59) throw new Error(`unsupported reset time: ${resetLabel}`);
    return zonedDateTimeToEpoch({
      year: Number(absolute[1]),
      month: Number(absolute[2]),
      day: Number(absolute[3]),
      hour: Number(absolute[4]),
      minute: Number(absolute[5]),
      second: Number(absolute[6] || 0),
    }, timeZone);
  }

  const clock = resetLabel.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)(?:\s*\([^)]+\))?$/i);
  if (!clock) throw new Error(`unsupported reset time: ${resetLabel}`);
  if (Number(clock[1]) < 1 || Number(clock[1]) > 12 || Number(clock[2] || 0) > 59) {
    throw new Error(`unsupported reset time: ${resetLabel}`);
  }
  let hour = Number(clock[1]) % 12;
  if (clock[3].toLowerCase() === "pm") hour += 12;
  const minute = Number(clock[2] || 0);
  const today = zonedParts(nowMs, timeZone);
  let date = { year: today.year, month: today.month, day: today.day };
  let target = zonedDateTimeToEpoch({ ...date, hour, minute, second: 0 }, timeZone);
  if (target <= nowMs) {
    date = addDay(date);
    target = zonedDateTimeToEpoch({ ...date, hour, minute, second: 0 }, timeZone);
  }
  return target;
};

let resetEpoch;
try {
  resetEpoch = parseResetEpoch();
} catch (error) {
  console.error(error.message);
  process.exit(2);
}

const waitSeconds = Math.max(0, Math.ceil((resetEpoch - nowMs) / 1000));
process.stdout.write(`${waitSeconds}\n${resetLabel}\n`);
