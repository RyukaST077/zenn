#!/usr/bin/env node
//
// Pre-register an article contract in analytics/article-ledger.jsonl.
//
//   node scripts/analytics/register-article.mjs --contract <file.json>
//   node scripts/analytics/register-article.mjs --from-research research/search-topic-*.md
//   node scripts/analytics/register-article.mjs --check --contract <file.json>
//
// Registration must happen BEFORE publication. Classifying an article after
// seeing its numbers turns the loop into post-hoc storytelling: the value
// archetype would always be whatever the winners happened to be.
//
// Exit codes: 0 ok / 2 invalid contract or misconfiguration

import fs from "node:fs";
import path from "node:path";

import {
  fail,
  parseArgs,
  parseInstant,
  readJson,
  readLedger,
  titleFeatures,
  writeLedger,
} from "./zenn-metrics-lib.mjs";

const REQUIRED = [
  "slug",
  "policyVersion",
  "valueArchetype",
  "targetReader",
  "readerDecision",
  "takeaway",
  "verificationItems",
  "titleDraft",
  "primaryTopic",
  "topics",
  "demandEvidence",
];

const MIN_VERIFICATION_ITEMS = 3;

const { options } = parseArgs(process.argv.slice(2));
const root = path.resolve(options.root || process.cwd());
const now = options.now ? parseInstant(options.now, "--now") : new Date();
const checkOnly = options.check === true;

const policyPath = path.resolve(root, options.policy || "strategy/topic-selection-policy.json");
const ledgerPath = path.resolve(root, options.ledger || "analytics/article-ledger.jsonl");
const contractsDir = path.resolve(root, options.contracts || "analytics/contracts");

/** Pull the ```json block that follows the "## 記事契約" heading. */
const contractFromResearch = (file) => {
  const source = fs.readFileSync(file, "utf8");
  const section = source.split(/^##\s+記事契約\s*$/m)[1];
  if (!section) fail(`no "## 記事契約" section in ${path.relative(root, file)}`);
  const block = section.match(/```json\s*\n([\s\S]*?)```/);
  if (!block) fail(`no json block under "## 記事契約" in ${path.relative(root, file)}`);
  try {
    return JSON.parse(block[1]);
  } catch (error) {
    fail(`contract json is invalid in ${path.relative(root, file)}: ${error.message}`);
  }
  return undefined;
};

let contract;
if (options.contract) {
  contract = readJson(path.resolve(root, options.contract), "contract");
} else if (options["from-research"]) {
  contract = contractFromResearch(path.resolve(root, options["from-research"]));
} else {
  fail("--contract <file> or --from-research <file> is required");
}

const policy = readJson(policyPath, "policy");
const problems = [];

for (const field of REQUIRED) {
  const value = contract[field];
  const empty = value === undefined
    || value === null
    || value === ""
    || (Array.isArray(value) && value.length === 0);
  if (empty) problems.push(`missing required field: ${field}`);
}

if (!/^[a-z0-9][a-z0-9-]*$/.test(contract.slug ?? "")) {
  problems.push(`slug must be lowercase kebab-case: ${contract.slug}`);
}

const archetype = policy.valueArchetypes?.find((item) => item.id === contract.valueArchetype);
if (!archetype) {
  problems.push(`unknown valueArchetype: ${contract.valueArchetype} (policy ${policy.policyVersion})`);
} else if (archetype.stage === "deprecated") {
  problems.push(`valueArchetype "${contract.valueArchetype}" is deprecated: ${archetype.whyDeprecated ?? ""}`);
}

if (Array.isArray(contract.verificationItems) && contract.verificationItems.length < MIN_VERIFICATION_ITEMS) {
  problems.push(`verificationItems must have at least ${MIN_VERIFICATION_ITEMS} entries (got ${contract.verificationItems.length}); a single-boundary check is not an article`);
}

if (contract.valueArchetype === "quantified" && !contract.quantifiedMetric) {
  problems.push("quantifiedMetric is required when valueArchetype is \"quantified\"");
}

// An experiment must be joined on purpose. Defaulting to the active experiment
// would sweep exploration articles and legacy rewrites into the treatment arm
// and quietly corrupt its verdict.
if (contract.experimentId === undefined) {
  problems.push("experimentId is required; use null to keep this article out of every experiment");
} else if (contract.experimentId !== null) {
  const experimentPath = path.resolve(root, `experiments/${contract.experimentId}.json`);
  if (!fs.existsSync(experimentPath)) {
    problems.push(`unknown experimentId: ${contract.experimentId}`);
  } else {
    const experiment = readJson(experimentPath, `experiment ${contract.experimentId}`);
    const arms = [
      experiment.design?.control?.arm,
      experiment.design?.treatment?.arm,
    ].filter(Boolean);
    if (!contract.arm) {
      problems.push(`arm is required when experimentId is set (expected one of: ${arms.join(", ")})`);
    } else if (arms.length > 0 && !arms.includes(contract.arm)) {
      problems.push(`arm "${contract.arm}" is not defined by ${contract.experimentId} (expected one of: ${arms.join(", ")})`);
    }
    const allowed = experiment.design?.treatment?.valueArchetypes;
    if (Array.isArray(allowed)
        && contract.arm === experiment.design?.treatment?.arm
        && !allowed.includes(contract.valueArchetype)) {
      problems.push(`${contract.experimentId} arm ${contract.arm} accepts only ${allowed.join(" / ")}, not ${contract.valueArchetype}`);
    }
    if (experiment.status && experiment.status !== "active") {
      problems.push(`${contract.experimentId} is ${experiment.status}; it accepts no new articles`);
    }
  }
} else if (!contract.arm) {
  problems.push("arm is required; use \"exploration\" or \"legacy-transition\" for an article outside an experiment");
}

if (contract.policyVersion !== policy.policyVersion) {
  // Not fatal: an article selected under an older policy keeps its own version
  // on purpose, so the loop can tell which policy produced which article.
  console.warn(`WARN: contract policyVersion ${contract.policyVersion} != current ${policy.policyVersion} (kept as-is)`);
}

if (typeof contract.readerDecision === "string" && contract.readerDecision.split(/[。\n]/).filter(Boolean).length > 1) {
  problems.push("readerDecision must be a single decision in one sentence");
}

if (problems.length > 0) {
  console.error("contract rejected:");
  problems.forEach((problem) => console.error(`  - ${problem}`));
  process.exit(2);
}

if (checkOnly) {
  console.log(`contract ok: ${contract.slug} (${contract.valueArchetype})`);
  process.exit(0);
}

const ledger = readLedger(ledgerPath);
const existing = ledger.find((entry) => entry.slug === contract.slug);
// The contract file is the authoritative registration and the ledger line is
// derived, so a worktree that synced only the contract back leaves a slug
// registered with no ledger line at all. Guarding on the ledger alone would let
// that registration be silently re-armed.
const contractFile = path.join(contractsDir, `${contract.slug}.json`);
if (fs.existsSync(contractFile) && !options.force) {
  fail(`${contract.slug} is already registered in ${path.relative(root, contractFile)}; pass --force to overwrite the contract`);
}
const classification = {
  source: "contract",
  valueArchetype: contract.valueArchetype,
  titleFeatures: titleFeatures(contract.titleDraft ?? ""),
  policyVersion: contract.policyVersion,
  experimentId: contract.experimentId,
  arm: contract.arm,
  registeredAt: now.toISOString(),
  contract: {
    targetReader: contract.targetReader,
    readerDecision: contract.readerDecision,
    takeaway: contract.takeaway,
    verificationItems: contract.verificationItems,
    quantifiedMetric: contract.quantifiedMetric ?? null,
    demandEvidence: contract.demandEvidence,
  },
};

if (existing) {
  if (existing.classification?.source === "contract" && !options.force) {
    fail(`${contract.slug} is already registered; pass --force to overwrite the contract`);
  }
  existing.classification = classification;
  existing.topics = contract.topics;
  existing.primaryTopic = contract.primaryTopic;
} else {
  ledger.push({
    slug: contract.slug,
    title: contract.titleDraft,
    publishedAt: null,
    articleType: "tech",
    topics: contract.topics,
    primaryTopic: contract.primaryTopic,
    bodyLetters: 0,
    classification,
    observations: {},
    relative: {},
  });
}

writeLedger(ledgerPath, ledger);

// The per-slug contract file is the authoritative record. The ledger is derived
// from it plus the API, so losing a ledger line (isolated worktree, concurrent
// write) can never downgrade a registered article to a heuristic label.
fs.mkdirSync(contractsDir, { recursive: true });
fs.writeFileSync(
  path.join(contractsDir, `${contract.slug}.json`),
  `${JSON.stringify({
    slug: contract.slug,
    topics: contract.topics,
    primaryTopic: contract.primaryTopic,
    classification,
  }, null, 2)}\n`,
);

console.log(`registered ${contract.slug} as ${contract.valueArchetype} (arm: ${classification.arm}, experiment: ${classification.experimentId ?? "none"})`);
