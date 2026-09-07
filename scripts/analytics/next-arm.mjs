#!/usr/bin/env node
//
// Decide which experiment arm the NEXT article must be registered under.
//
//   node scripts/analytics/next-arm.mjs            # human summary
//   node scripts/analytics/next-arm.mjs --json     # machine readable
//   node scripts/analytics/next-arm.mjs --prompt   # one paragraph for the search stage
//
// Why this exists: the policy names an active experiment and an exploration
// share, but nothing assigned articles to arms. The result is visible in the
// ledger — EXP-001 needs 12 B-payload articles and had 0, while both
// contract-registered articles went to exploration. An experiment nobody is
// allocated to never reaches a verdict, so the loop cannot learn anything.
//
// The assignment is deterministic from the ledger. It is NOT random: a random
// draw over a dozen articles can leave the treatment arm underfilled for weeks,
// and the loop has no slack to waste. Exploration slots are interleaved rather
// than deferred, so a candidate archetype keeps getting evidence while the
// experiment fills.
//
// Exit codes: 0 ok / 2 misconfiguration

import fs from "node:fs";
import path from "node:path";

import { fail, parseArgs, readJson, readLedger } from "./zenn-metrics-lib.mjs";

const { options } = parseArgs(process.argv.slice(2));
const root = path.resolve(options.root || process.cwd());
const policyPath = path.resolve(root, options.policy || "strategy/topic-selection-policy.json");
const ledgerPath = path.resolve(root, options.ledger || "analytics/article-ledger.jsonl");
const contractsDir = path.resolve(root, options.contracts || "analytics/contracts");

const policy = readJson(policyPath, "policy");
const ledger = readLedger(ledgerPath);

const share = policy.explorationShare?.value;
if (typeof share !== "number" || share < 0 || share >= 1) {
  fail(`explorationShare.value must be a number in [0, 1): ${share}`);
}

// Only contract-registered entries count. The 57 heuristic historical-control
// rows were classified after the fact and were never allocated to anything.
//
// The per-slug files under analytics/contracts/ are the authoritative record and
// the ledger is derived from them, so read both and let a contract file win. A
// pipeline running in an isolated worktree cannot write its ledger line back --
// the daily loop owns that file -- but its contract file does ride back, so
// counting contracts keeps the next run from re-allocating a filled slot.
const registeredBySlug = new Map();
for (const entry of ledger) {
  if (entry.slug && entry.classification?.source === "contract") {
    registeredBySlug.set(entry.slug, { classification: entry.classification });
  }
}
if (fs.existsSync(contractsDir)) {
  for (const name of fs.readdirSync(contractsDir).sort()) {
    if (!name.endsWith(".json")) continue;
    const contract = readJson(path.join(contractsDir, name), `contract ${name}`);
    if (!contract?.slug || !contract.classification) {
      fail(`contract ${name} must carry a slug and a classification`);
    }
    registeredBySlug.set(contract.slug, { classification: contract.classification });
  }
}
const registered = [...registeredBySlug.values()];

const experimentId = policy.activeExperiment ?? null;
let experiment = null;
if (experimentId) {
  experiment = readJson(path.resolve(root, `experiments/${experimentId}.json`), `experiment ${experimentId}`);
}

const treatmentArm = experiment?.design?.treatment?.arm ?? null;
const treatmentTarget = experiment?.design?.treatment?.n ?? 0;
const treatmentArchetypes = experiment?.design?.treatment?.valueArchetypes ?? [];
const experimentOpen = Boolean(experiment) && experiment.status === "active" && Boolean(treatmentArm);

const filled = registered.filter((entry) => (
  entry.classification?.experimentId === experimentId
  && entry.classification?.arm === treatmentArm
)).length;
const explorationCount = registered.filter((entry) => entry.classification?.arm === "exploration").length;
const allocated = filled + explorationCount;

// Exploration is owed when it has fallen behind its share of the slots handed
// out so far, counting the slot about to be assigned. floor() keeps the very
// first slot on the experiment: with 12 to fill, the treatment arm is what the
// loop is short of, and one exploration article cannot answer anything alone.
const explorationOwed = Math.floor(share * (allocated + 1));
const explorationBehind = explorationCount < explorationOwed;

const remaining = Math.max(0, treatmentTarget - filled);

let arm;
let why;
if (!experimentOpen) {
  arm = "exploration";
  why = experiment
    ? `${experimentId} is ${experiment.status}; it accepts no new articles`
    : "no active experiment in the policy";
} else if (remaining === 0) {
  arm = "exploration";
  why = `${experimentId} already has its ${treatmentTarget} ${treatmentArm} articles registered; wait for the D30 verdict before opening a second batch`;
} else if (explorationBehind) {
  arm = "exploration";
  why = `exploration is behind its ${Math.round(share * 100)}% share (${explorationCount}/${allocated} allocated)`;
} else {
  arm = treatmentArm;
  why = `${experimentId} still needs ${remaining} more ${treatmentArm} article${remaining === 1 ? "" : "s"} (${filled}/${treatmentTarget} registered)`;
}

const explorationArchetypes = (policy.valueArchetypes ?? [])
  .filter((item) => item.stage === "candidate")
  .map((item) => item.id);

const assignment = {
  arm,
  experimentId: arm === treatmentArm ? experimentId : null,
  valueArchetypes: arm === treatmentArm ? treatmentArchetypes : explorationArchetypes,
  why,
  state: {
    registered: registered.length,
    treatmentArm,
    treatmentFilled: filled,
    treatmentTarget,
    treatmentRemaining: remaining,
    explorationCount,
    explorationShare: share,
  },
};

if (assignment.valueArchetypes.length === 0) {
  fail(`no value archetype is available for arm ${arm}; check ${path.relative(root, policyPath)}`);
}

if (options.json) {
  console.log(JSON.stringify(assignment, null, 2));
} else if (options.prompt) {
  const id = assignment.experimentId
    ? `experimentId "${assignment.experimentId}"`
    : "experimentId null";
  console.log(
    `Register this article's contract with arm "${assignment.arm}" and ${id}. `
    + `Its valueArchetype must be one of: ${assignment.valueArchetypes.join(", ")}. `
    + `Reason: ${assignment.why}. `
    + `Choose the topic so that this archetype is honest for it — do not relabel a single-boundary check. `
    + `If no candidate topic can carry one of these archetypes, abort rather than registering a different arm.`,
  );
} else {
  console.log(`next arm: ${assignment.arm}`);
  console.log(`  experimentId: ${assignment.experimentId ?? "null"}`);
  console.log(`  valueArchetype must be one of: ${assignment.valueArchetypes.join(", ")}`);
  console.log(`  why: ${assignment.why}`);
  console.log(`  state: ${filled}/${treatmentTarget} ${treatmentArm}, ${explorationCount} exploration, ${registered.length} registered total`);
}
