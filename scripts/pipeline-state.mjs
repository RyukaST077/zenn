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
    publish: { branch: null, commit: null, pr_url: null },
    retry: { pending: false, reason: null, retry_at: null }
  };
}

function validate(state) {
  if (!state || state.version !== 1) fail("unsupported or missing state version");
  // Older pipeline states predate retry metadata. Upgrade them in memory so
  // the next atomic write persists the backward-compatible default.
  if (!("retry" in state)) state.retry = { pending: false, reason: null, retry_at: null };
  for (const key of ["base_branch", "completed", "artifacts", "review", "publish"])
    if (!(key in state)) fail(`state is missing ${key}`);
  if (!Number.isInteger(state.review.rounds) || state.review.rounds < 0) fail("invalid review.rounds");
  if (!["review", "revise"].includes(state.review.next_stage)) fail("invalid review.next_stage");
  if (!Array.isArray(state.review.history)) fail("invalid review.history");
  if (typeof state.retry?.pending !== "boolean") fail("invalid retry.pending");
  for (const key of ["reason", "retry_at"])
    if (state.retry[key] !== null && typeof state.retry[key] !== "string") fail(`invalid retry.${key}`);
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
  case "migrate-legacy": {
    const [source, baseBranch = "main"] = args;
    if (!file || !source || fs.existsSync(file)) fail("migration requires a legacy source and a new state file");
    const state = baseState(baseBranch);
    const artifacts = { REPORT: "report", TASK: "task", RUNLOG: "run_log", ARTICLE: "article", REVIEW: "review" };
    const stages = { DONE_gitreset: "preflight", DONE_search: "search", DONE_plan: "plan", DONE_run: "run", DONE_draft: "draft", DONE_review: "review", DONE_publish: "pr", DONE_merge: "merge" };
    for (const [index, raw] of fs.readFileSync(source, "utf8").split(/\r?\n/).entries()) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      // Parse data only. Never source shell from a saved run or shared checkout.
      const match = line.match(/^([A-Za-z_][A-Za-z_0-9]*)=(?:'([^']*)'|"([^"$`\\]*)"|([A-Za-z0-9_./:@%+,=-]*))$/);
      if (!match) fail(`unsafe legacy state syntax at line ${index + 1}; expected a literal assignment`);
      const key = match[1], value = match[2] ?? match[3] ?? match[4];
      if (key in artifacts) {
        if (value.startsWith("/") || value.split("/").includes("..")) fail(`unsafe legacy artifact path: ${key}`);
        state.artifacts[artifacts[key]] = value || null;
        if (key === "REVIEW") state.review.rounds++;
      } else if (key in stages) {
        if (!["", "0", "1", "true", "false"].includes(value)) fail(`invalid legacy completion flag: ${key}`);
        state.completed[stages[key]] = ["1", "true"].includes(value);
      } else if (key === "PR_URL") state.publish.pr_url = value || null;
      else fail(`unsupported legacy state key: ${key}`);
    }
    if (state.completed.review) state.review.last_verdict = "pass";
    write(state);
    break;
  }
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
    state.review.next_stage = verdict === "pass" ? "review" : "revise";
    state.review.history.push({ round: state.review.rounds, verdict, report, timestamp });
    state.artifacts.review = report;
    state.completed.review = verdict === "pass";
    write(state);
    break;
  }
  default:
    fail("usage: pipeline-state.mjs init|validate|get|set|review <state-file> ...");
}
