#!/usr/bin/env node

import fs from "node:fs";

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

const strings = [];
const collectStrings = (value) => {
  if (typeof value === "string") strings.push(value);
  else if (Array.isArray(value)) value.forEach(collectStrings);
  else if (value && typeof value === "object") Object.values(value).forEach(collectStrings);
};

try {
  collectStrings(JSON.parse(raw));
} catch {
  strings.push(raw);
}

const limitMessage = strings.find((value) =>
  /(?:hit your session limit|usage limit|rate limit)/i.test(value));
if (!limitMessage) process.exit(1);

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
    /(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/,
  );
  if (absolute) {
    return zonedDateTimeToEpoch({
      year: Number(absolute[1]),
      month: Number(absolute[2]),
      day: Number(absolute[3]),
      hour: Number(absolute[4]),
      minute: Number(absolute[5]),
      second: Number(absolute[6] || 0),
    }, timeZone);
  }

  const clock = resetLabel.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (!clock) throw new Error(`unsupported reset time: ${resetLabel}`);
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
