#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const isSchemaValid = (text) => {
  try {
    const value = JSON.parse(text);
    return value !== null
      && typeof value === "object"
      && !Array.isArray(value)
      && Object.keys(value).length === 1
      && typeof value.message === "string"
      && value.message.length >= 1;
  } catch {
    return false;
  }
};

assert.equal(fs.readFileSync("alpha.txt", "utf8"), "ALPHA_READY\n");
assert.equal(fs.readFileSync("beta.txt", "utf8"), "BETA_READY\n");
const schema = readJson("schema.json");
assert.deepEqual(schema.required, ["message"]);
assert.equal(schema.additionalProperties, false);
assert.equal(schema.properties.message.type, "string");
assert.equal(schema.properties.message.minLength, 1);

const processResult = readJson("agent-process.json");
assert.equal(processResult.exit_code, 0, "Codex must exit successfully");
assert.equal(processResult.signal, null, "Codex must not be terminated by a signal");

const rawLines = fs.readFileSync("agent-events.jsonl", "utf8").split(/\r?\n/).filter(Boolean);
assert.ok(rawLines.length > 0, "JSONL stream is empty");
const events = rawLines.map((line, index) => {
  try {
    return JSON.parse(line);
  } catch (error) {
    assert.fail(`JSONL line ${index + 1} is invalid: ${error.message}`);
  }
});
assert.equal(events.filter((event) => event.type === "turn.completed").length, 1, "expected exactly one turn.completed");
assert.equal(events.some((event) => event.type === "turn.failed" || event.type === "error"), false, "failure event observed");

const completedItems = events.filter((event) => event.type === "item.completed").map((event) => event.item);
const commands = completedItems.filter((item) => item?.type === "command_execution");
assert.equal(commands.length, 2, "expected exactly two completed commands");
assert.deepEqual(commands.map((item) => item.command), [
  "/bin/zsh -lc 'head -n 1 alpha.txt'",
  "/bin/zsh -lc 'head -n 1 beta.txt'",
]);
assert.deepEqual(commands.map((item) => item.exit_code), [0, 0]);
assert.deepEqual(commands.map((item) => item.status), ["completed", "completed"]);
assert.deepEqual(commands.map((item) => item.aggregated_output), ["ALPHA_READY\n", "BETA_READY\n"]);

const messages = completedItems.filter((item) => item?.type === "agent_message");
assert.equal(messages.length, 3, "expected exactly two progress messages and one final message");
assert.ok(messages.every((item) => isSchemaValid(item.text)), "every completed agent message must satisfy the exact schema predicate");
const positions = completedItems.map((item) => item?.type);
assert.deepEqual(positions, ["agent_message", "command_execution", "agent_message", "command_execution", "agent_message"]);

const finalText = fs.readFileSync("agent-final.json", "utf8").replace(/(?:\r?\n)+$/, "");
assert.ok(isSchemaValid(finalText), "final artifact must independently satisfy the schema");
assert.notEqual(messages[0].text, finalText, "first schema-valid message must differ from the final artifact");
assert.equal(messages.at(-1).text, finalText, "final artifact must equal the last completed agent message");
assert.equal(JSON.parse(finalText).message, "ALPHA_READY + BETA_READY", "final message must summarize both fixed reads");

fs.writeFileSync("verification.txt", "FIRST_VALID_IS_NOT_FINAL\n", { flag: "wx", mode: 0o600 });
process.stdout.write("FIRST_VALID_IS_NOT_FINAL\n");
