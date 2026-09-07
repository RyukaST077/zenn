#!/usr/bin/env node
//
// Turn raw Zenn API snapshots into the two durable stores the improvement loop
// reads: the per-article ledger (our own articles) and the market cohort index
// (everyone else's, bucketed by topic and article age).
//
// Usage:
//   node scripts/analytics/collect-zenn-metrics.mjs \
//     --self-json <file> [--market-json <file>] [--now <iso>] [--root <dir>]
//
// `fetch-zenn-metrics.sh` produces the input files. Keeping the network out of
// this script is what makes it testable with fixtures.

import fs from "node:fs";
import path from "node:path";

import {
  COHORT_MIN,
  ageBracket,
  BASIS,
  ageDays,
  cohortLikes,
  dayStamp,
  emptyMarketIndex,
  extractArticles,
  fail,
  guessValueArchetype,
  isFrozenBasis,
  midRankPercentile,
  normalizeArticle,
  parseArgs,
  parseFrontMatter,
  parseInstant,
  readJson,
  readJsonIfExists,
  readLedger,
  recordMarketObservation,
  tierFromPercentile,
  titleFeatures,
  writeJson,
  writeLedger,
} from "./zenn-metrics-lib.mjs";

const { options } = parseArgs(process.argv.slice(2));
const root = path.resolve(options.root || process.cwd());
const now = options.now ? parseInstant(options.now, "--now") : new Date();
const stamp = dayStamp(now);
const nowIso = now.toISOString();

if (!options["self-json"]) fail("--self-json is required");

const ledgerPath = path.resolve(root, options.ledger || "analytics/article-ledger.jsonl");
const contractsDir = path.resolve(root, options.contracts || "analytics/contracts");
const marketIndexPath = path.resolve(root, options["market-index"] || "analytics/market-index.json");
const articlesDir = path.resolve(root, options.articles || "articles");

// Observation windows. A daily run lands on the first day of the window; a run
// that skipped days still fills the slot but is marked `late-measured` so a
// judgement can require on-time data. `onTimeTo` is the width a daily cadence
// would hit.
const SLOTS = [
  { key: "d7", from: 7, onTimeTo: 9, to: 14, bracket: "d7-14" },
  { key: "d30", from: 30, onTimeTo: 33, to: 46, bracket: "d30-45" },
];

const localTopics = (slug) => {
  const file = path.join(articlesDir, `${slug}.md`);
  if (!fs.existsSync(file)) return { topics: [], published: null };
  const front = parseFrontMatter(fs.readFileSync(file, "utf8"));
  return {
    topics: Array.isArray(front.topics) ? front.topics : [],
    published: front.published === true,
  };
};

const selfArticles = extractArticles(readJson(path.resolve(root, options["self-json"]), "self snapshot"))
  .map(normalizeArticle)
  .filter((article) => article.slug && article.publishedAt);

if (selfArticles.length === 0) fail("self snapshot contained no articles");

// Every username seen in the self snapshot, so the market baseline can never
// include one of our own articles even if some rows omit the user object.
const ownUsernames = new Set(selfArticles.map((article) => article.username).filter(Boolean));

// ---------------------------------------------------------------- market index

const marketIndex = readJsonIfExists(marketIndexPath, emptyMarketIndex());
if (marketIndex.version !== 1) fail("market index version must be 1");
marketIndex.cohorts = marketIndex.cohorts || {};

let marketObservations = 0;
if (options["market-json"]) {
  const payload = readJson(path.resolve(root, options["market-json"]), "market snapshot");
  // The fetch script keys each response by the topic it queried; a bare array is
  // treated as the cross-topic "_all" cohort.
  const byTopic = Array.isArray(payload) ? { _all: payload } : payload;
  for (const [topic, response] of Object.entries(byTopic)) {
    for (const raw of extractArticles(response)) {
      const article = normalizeArticle(raw);
      if (!article.publishedAt) continue;
      // Our own articles must never inflate the baseline we measure against.
      if (article.username && ownUsernames.has(article.username)) continue;
      const days = ageDays(article.publishedAt, now);
      if (days < 0) continue;
      recordMarketObservation(marketIndex, topic, ageBracket(days), article, nowIso);
      marketObservations += 1;
    }
  }
}
marketIndex.updatedAt = nowIso;
writeJson(marketIndexPath, marketIndex);

// ----------------------------------------------------------------- self ledger

const ledger = readLedger(ledgerPath);
const bySlug = new Map(ledger.map((entry) => [entry.slug, entry]));

// Re-attach contracts from their own immutable files. The ledger is a derived
// artifact: it can be lost to an isolated worktree or a concurrent write, but a
// contract must never silently degrade into a heuristic label.
const contracts = new Map();
if (fs.existsSync(contractsDir)) {
  for (const name of fs.readdirSync(contractsDir)) {
    if (!name.endsWith(".json")) continue;
    const contract = readJson(path.join(contractsDir, name), `contract ${name}`);
    if (contract?.slug) contracts.set(contract.slug, contract);
  }
}

/** Standing inside the age-matched market cohort, or null when it is too small. */
const standing = (topic, bracket, likes) => {
  if (!topic) return null;
  const cohort = cohortLikes(marketIndex, topic, bracket);
  if (cohort.length < COHORT_MIN.display) return null;
  const percentile = midRankPercentile(likes, cohort);
  return {
    topic,
    bracket,
    percentile: Number(percentile.toFixed(1)),
    tier: tierFromPercentile(percentile),
    cohortSize: cohort.length,
    // Recorded so a later judgement can demand a bigger cohort than the one
    // that was available when the observation was frozen.
    usableFor: {
      display: true,
      decision: cohort.length >= COHORT_MIN.decision,
      promotion: cohort.length >= COHORT_MIN.promotion,
    },
    observedAt: nowIso,
  };
};

let created = 0;
const filledSlots = [];

for (const article of selfArticles) {
  const days = ageDays(article.publishedAt, now);
  const { topics } = localTopics(article.slug);
  let entry = bySlug.get(article.slug);

  if (!entry) {
    // No pre-registration exists for articles written before the loop, so label
    // them heuristically and mark the weaker provenance.
    entry = {
      slug: article.slug,
      title: article.title,
      publishedAt: article.publishedAt,
      articleType: article.articleType,
      topics,
      primaryTopic: topics[0] ?? null,
      bodyLetters: article.bodyLetters,
      classification: {
        source: "heuristic",
        valueArchetype: guessValueArchetype(article.title),
        titleFeatures: titleFeatures(article.title),
        policyVersion: "0-pre-loop",
        experimentId: null,
        arm: "historical-control",
      },
      observations: {},
      relative: {},
    };
    bySlug.set(article.slug, entry);
    created += 1;
  }

  // A contract outranks whatever the ledger happened to hold, and is restored
  // before anything reads primaryTopic.
  const contract = contracts.get(article.slug);
  if (contract && entry.classification?.source !== "contract") {
    entry.classification = contract.classification;
    entry.topics = contract.topics ?? entry.topics;
    entry.primaryTopic = contract.primaryTopic ?? entry.primaryTopic;
  }

  // Facts that can change after publication are refreshed every run; the
  // pre-registered classification block is never rewritten here.
  entry.title = article.title;
  entry.bodyLetters = article.bodyLetters;
  // Contracts are registered before publication, so the ledger learns the real
  // publish time (and article type) only on the first collection after it goes live.
  entry.publishedAt = article.publishedAt;
  entry.articleType = article.articleType ?? entry.articleType;
  if (topics.length > 0) {
    entry.topics = topics;
    entry.primaryTopic = entry.primaryTopic ?? topics[0];
  }

  const observation = {
    likes: article.likes,
    bookmarks: article.bookmarks,
    comments: article.comments,
    observedAt: nowIso,
    ageDays: Number(days.toFixed(2)),
  };
  entry.observations.latest = { ...observation, basis: "measured" };

  const topicKey = entry.primaryTopic;

  for (const slot of SLOTS) {
    const existing = entry.observations[slot.key];
    // Frozen means frozen. This used to be a suffix test, which silently let
    // day 31 and 32 overwrite a value already taken on time at day 30.
    if (existing && isFrozenBasis(existing.basis)) continue;
    if (days >= slot.from && days < slot.to) {
      const basis = days < slot.onTimeTo ? BASIS.onTime : BASIS.late;
      entry.observations[slot.key] = {
        ...observation,
        basis,
        // The percentile is frozen together with the likes it was computed from,
        // against the cohort of the slot's own age. Reading a "D30 percentile"
        // off a later observation would compare different ages.
        relative: standing(topicKey, slot.bracket, article.likes),
      };
      filledSlots.push(`${article.slug}:${slot.key}:${basis}`);
    } else if (!existing && days >= slot.to) {
      // Already past the window on first sight: likes only ever grow, so the
      // current value is an upper bound for what the slot would have held.
      // No percentile: there is no cohort of that age to compare against, and a
      // percentile from today's age is not the slot's percentile.
      entry.observations[slot.key] = {
        ...observation,
        basis: BASIS.upperBound,
        relative: null,
      };
    }
  }

  // Rolling standing at the article's current age. Report-only: judgements must
  // use the percentile frozen inside observations.d30.
  const current = standing(topicKey, ageBracket(days), article.likes);
  if (current) entry.relative[ageBracket(days)] = current;

}

writeLedger(ledgerPath, [...bySlug.values()]);

// Keep the normalized snapshot so a future analysis can be re-derived offline.
// These are local-only (git-ignored); the ledger and the market index are the
// durable stores.
const rawDir = path.resolve(root, "analytics/raw/self");
writeJson(path.join(rawDir, `${stamp}.json`), {
  collectedAt: nowIso,
  articles: selfArticles,
});

const RAW_RETENTION_DAYS = 120;
const cutoff = new Date(now.getTime() - RAW_RETENTION_DAYS * 86400000);
for (const name of fs.readdirSync(rawDir)) {
  const match = name.match(/^(\d{4}-\d{2}-\d{2})\.json$/);
  if (match && new Date(match[1]) < cutoff) fs.rmSync(path.join(rawDir, name));
}

console.log(`self articles: ${selfArticles.length} (new ledger entries: ${created})`);
console.log(`market observations recorded: ${marketObservations}`);
console.log(`observation slots filled this run: ${filledSlots.length}`);
console.log(`ledger: ${path.relative(root, ledgerPath)}`);
