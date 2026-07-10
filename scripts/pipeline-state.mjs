#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const [command, file, ...args] = process.argv.slice(2);

function fail(message) {
  console.error(message);
  process.exit(2);
}

function baseState(baseBranch = "main") {
  return {
    version: 1,
    base_branch: baseBranch,
    completed: {
      preflight: false, search: false, plan: false, run: false, draft: false,
      review: false, prepare_publish: false, push: false, pr: false, merge: false
    },
    artifacts: {
      report: null, task: null, run_log: null, article: null, review: null,
      revise: null, pr_metadata: null
    },
    review: { rounds: 0, last_verdict: null, next_stage: "review", history: [] },
    publish: { branch: null, commit: null, pr_url: null }
  };
}

function validate(state) {
  if (!state || state.version !== 1) fail("unsupported or missing state version");
  for (const key of ["base_branch", "completed", "artifacts", "review", "publish"])
    if (!(key in state)) fail(`state is missing ${key}`);
  if (!Number.isInteger(state.review.rounds) || state.review.rounds < 0) fail("invalid review.rounds");
  if (!["review", "revise"].includes(state.review.next_stage)) fail("invalid review.next_stage");
  if (!Array.isArray(state.review.history)) fail("invalid review.history");
  return state;
}

function read() {
  if (!file) fail("state file is required");
  try { return validate(JSON.parse(fs.readFileSync(file, "utf8"))); }
  catch (error) { fail(`cannot read state: ${error.message}`); }
}

function write(state) {
  validate(state);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(tmp, file);
}

function parts(key) {
  if (!/^[a-z_]+(?:\.[a-z_]+)*$/.test(key)) fail(`invalid state key: ${key}`);
  return key.split(".");
}

function lookup(state, key) {
  let value = state;
  for (const part of parts(key)) value = value?.[part];
  return value;
}

function assign(state, key, value) {
  const keys = parts(key);
  let target = state;
  for (const part of keys.slice(0, -1)) {
    if (!target[part] || typeof target[part] !== "object") fail(`unknown state key: ${key}`);
    target = target[part];
  }
  if (!(keys.at(-1) in target)) fail(`unknown state key: ${key}`);
  target[keys.at(-1)] = value;
}

switch (command) {
  case "init": {
    if (!file) fail("state file is required");
    if (fs.existsSync(file)) fail(`state already exists: ${file}`);
    write(baseState(args[0] || "main"));
    break;
  }
  case "validate":
    read();
    break;
  case "get": {
    const value = lookup(read(), args[0]);
    if (value === undefined) process.exit(3);
    if (typeof value === "object" && value !== null) process.stdout.write(JSON.stringify(value));
    else if (value !== null) process.stdout.write(String(value));
    break;
  }
  case "set": {
    const state = read();
    let value;
    try { value = JSON.parse(args[1]); } catch { value = args[1]; }
    assign(state, args[0], value);
    write(state);
    break;
  }
  case "review": {
    const state = read();
    const [verdict, report, timestamp] = args;
    if (!["pass", "fix", "blocker"].includes(verdict)) fail("invalid verdict");
    state.review.rounds += 1;
    state.review.last_verdict = verdict;
    state.review.next_stage = verdict === "fix" ? "revise" : "review";
    state.review.history.push({ round: state.review.rounds, verdict, report, timestamp });
    state.artifacts.review = report;
    state.completed.review = verdict === "pass";
    write(state);
    break;
  }
  default:
    fail("usage: pipeline-state.mjs init|validate|get|set|review <state-file> ...");
}
