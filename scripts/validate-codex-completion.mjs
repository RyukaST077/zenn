#!/usr/bin/env node
import fs from "node:fs";

function fail(message) {
  console.error(`codex completion validation failed: ${message}`);
  process.exit(1);
}

const [eventsPath, finalPath] = process.argv.slice(2);
if (!eventsPath || !finalPath) {
  fail("usage: validate-codex-completion.mjs EVENTS_JSONL FINAL_OUTPUT");
}

for (const [label, filePath] of [["events", eventsPath], ["final output", finalPath]]) {
  let stat;
  try {
    stat = fs.lstatSync(filePath);
  } catch {
    fail(`${label} file is missing: ${filePath}`);
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    fail(`${label} must be a regular non-symlink file: ${filePath}`);
  }
}

const rawEvents = fs.readFileSync(eventsPath, "utf8");
const lines = rawEvents.split(/\r?\n/).filter((line) => line.trim() !== "");
if (lines.length === 0) fail("events stream is empty");

const events = lines.map((line, index) => {
  try {
    return JSON.parse(line);
  } catch {
    fail(`events line ${index + 1} is not valid JSON`);
  }
});

const completedTurns = [];
const failedTurns = [];
const completedMessages = [];
for (const [index, event] of events.entries()) {
  if (event?.type === "turn.completed") completedTurns.push(index);
  if (event?.type === "turn.failed") failedTurns.push(index);
  if (event?.type === "item.completed" && event?.item?.type === "agent_message") {
    if (typeof event.item.text !== "string") {
      fail(`completed agent message at events line ${index + 1} has no text`);
    }
    completedMessages.push({ index, text: event.item.text });
  }
}

if (failedTurns.length !== 0) fail("events contain turn.failed");
if (completedTurns.length !== 1) {
  fail(`expected exactly one turn.completed, found ${completedTurns.length}`);
}
if (completedMessages.length === 0) fail("events contain no completed agent message");

const lastMessage = completedMessages.at(-1);
if (lastMessage.index > completedTurns[0]) {
  fail("last completed agent message occurs after turn.completed");
}

const trimFinalNewlines = (value) => value.replace(/(?:\r?\n)+$/, "");
const finalOutput = trimFinalNewlines(fs.readFileSync(finalPath, "utf8"));
if (finalOutput === "") fail("final output file is empty");
if (trimFinalNewlines(lastMessage.text) !== finalOutput) {
  fail("final output does not equal the last completed agent message");
}
