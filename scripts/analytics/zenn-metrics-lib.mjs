// Shared helpers for the topic-improvement loop.
//
// The loop deliberately keeps two data sources apart:
//   * self   ... our own published articles (few, low variance, weak signal)
//   * market ... other people's recent articles per topic (many, the actual
//                driver of what a "winning" theme looks like)
//
// Likes on Zenn are zero-inflated and heavy-tailed: in a 48-article sample of
// the `claudecode` topic the median was 0 and only 6% reached 5 likes. So every
// comparison here is relative (percentile inside an age-matched market cohort)
// rather than an absolute average, which a single tail article would dominate.

import fs from "node:fs";
import path from "node:path";

// Brackets line up with the observation windows below, so the percentile frozen
// at a d30 observation is compared against articles of the same age. A wide
// "d30+" bucket would rank a 30-day-old article against year-old ones.
export const AGE_BRACKETS = ["d0-1", "d2-6", "d7-14", "d15-29", "d30-45", "d46+"];

// How large an age-matched cohort must be before a comparison may be used.
// Ranking against 20 articles has only two above the 90th percentile, so top10
// is far too unstable to justify a policy change at that size.
export const COHORT_MIN = {
  display: 20,
  decision: 50,   // median percentile / top25 share
  promotion: 100, // top10 share
};

// Cap per (topic, bracket). A few hundred observations already pin a percentile
// to well under a point, and the index is committed, so it must stay small.
export const MAX_COHORT_OBSERVATIONS = 400;

// The three ways a slot observation can come to exist. Membership must be
// tested against these sets, never with a substring or suffix match: the
// obvious-looking `basis.endsWith("measured")` is true for "late-measured" and
// false for "measured-on-time", i.e. exactly inverted for the case that matters.
export const BASIS = {
  onTime: "measured-on-time",     // taken inside the slot's on-time window
  late: "late-measured",          // taken inside the slot, but after the on-time edge
  upperBound: "current-upper-bound", // first seen past the slot; likes only grow
};

/** Already observed inside the slot, so the value is frozen and must not be rewritten. */
export const isFrozenBasis = (basis) => basis === BASIS.onTime || basis === BASIS.late;

/** Usable as a D30 result. Excludes `current-upper-bound`, which has no percentile. */
export const isMaturedBasis = (basis) => isFrozenBasis(basis);

/** Numerator and denominator line up closely enough to form a rate. */
export const isRateAlignedBasis = (basis) => basis === BASIS.onTime;

export const fail = (message) => {
  console.error(`ERROR: ${message}`);
  process.exit(2);
};

export const parseArgs = (argv) => {
  const positional = [];
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) {
      positional.push(value);
      continue;
    }
    const key = value.slice(2);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) {
      options[key] = true;
      continue;
    }
    options[key] = next;
    index += 1;
  }
  return { positional, options };
};

export const parseInstant = (value, label) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) fail(`${label} is not a valid date: ${value}`);
  return date;
};

export const readJson = (file, label) => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(`cannot read ${label} (${file}): ${error.message}`);
  }
  return undefined;
};

export const readJsonIfExists = (file, fallback) => (
  fs.existsSync(file) ? readJson(file, path.basename(file)) : fallback
);

export const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
};

/**
 * Local-date stamp (YYYY-MM-DD). The rest of the repo names artifacts with local
 * time (`date +%Y%m%d-%H%M`), so a UTC stamp would file a run made on the 5th
 * JST under the 4th. Instants stored inside files stay ISO/UTC.
 */
export const dayStamp = (date) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

export const ageDays = (publishedAt, at) => (
  (at.getTime() - new Date(publishedAt).getTime()) / 86400000
);

export const ageBracket = (days) => {
  if (days < 2) return "d0-1";
  if (days < 7) return "d2-6";
  if (days < 15) return "d7-14";
  if (days < 30) return "d15-29";
  if (days < 46) return "d30-45";
  return "d46+";
};

// Zenn's API is paginated and each response nests articles under `articles`.
// Accept a raw array, a single response, or a list of responses so the fetch
// script can simply concatenate pages.
export const extractArticles = (payload) => {
  const collected = [];
  const visit = (value) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value.articles)) {
      value.articles.forEach(visit);
      return;
    }
    if (value.slug || value.id) collected.push(value);
  };
  visit(payload);
  const seen = new Set();
  return collected.filter((article) => {
    const key = article.id ?? article.slug;
    if (key === undefined || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const normalizeArticle = (article) => ({
  id: article.id ?? null,
  slug: article.slug ?? null,
  title: article.title ?? "",
  publishedAt: article.published_at ?? null,
  articleType: article.article_type ?? null,
  likes: Number(article.liked_count ?? 0),
  bookmarks: Number(article.bookmarked_count ?? 0),
  comments: Number(article.comments_count ?? 0),
  bodyLetters: Number(article.body_letters_count ?? 0),
  username: article.user?.username ?? null,
});

/** Mid-rank percentile so the many tied zeros do not all collapse to 0 or 100. */
export const midRankPercentile = (value, sortedValues) => {
  const total = sortedValues.length;
  if (total === 0) return null;
  let less = 0;
  let equal = 0;
  for (const candidate of sortedValues) {
    if (candidate < value) less += 1;
    else if (candidate === value) equal += 1;
  }
  return ((less + equal / 2) / total) * 100;
};

export const quantile = (sortedValues, p) => {
  if (sortedValues.length === 0) return null;
  const index = Math.min(sortedValues.length - 1, Math.floor((sortedValues.length - 1) * p));
  return sortedValues[index];
};

export const tierFromPercentile = (percentile) => {
  if (percentile === null) return null;
  if (percentile >= 90) return "top10";
  if (percentile >= 75) return "top25";
  if (percentile >= 50) return "mid";
  return "low";
};

export const emptyMarketIndex = () => ({ version: 1, updatedAt: null, cohorts: {} });

/**
 * Record one market observation. Observations are keyed by article id inside a
 * (topic, bracket) cell, so re-observing the same article in the same age
 * bracket refreshes the value instead of double counting it.
 */
export const recordMarketObservation = (index, topic, bracket, article, observedAt) => {
  const cohorts = index.cohorts[topic] || (index.cohorts[topic] = {});
  const cell = cohorts[bracket] || (cohorts[bracket] = { observations: {} });
  const key = String(article.id ?? article.slug);
  cell.observations[key] = {
    likes: article.likes,
    observedAt,
    publishedAt: article.publishedAt,
    // Kept so archetype mining can run over the winners without re-fetching.
    title: article.title,
  };
  const keys = Object.keys(cell.observations);
  if (keys.length > MAX_COHORT_OBSERVATIONS) {
    keys
      .sort((a, b) => (
        String(cell.observations[a].observedAt).localeCompare(String(cell.observations[b].observedAt))
      ))
      .slice(0, keys.length - MAX_COHORT_OBSERVATIONS)
      .forEach((stale) => delete cell.observations[stale]);
  }
};

export const cohortLikes = (index, topic, bracket) => {
  const cell = index.cohorts?.[topic]?.[bracket];
  if (!cell) return [];
  return Object.values(cell.observations).map((entry) => entry.likes).sort((a, b) => a - b);
};

export const cohortStats = (likes) => {
  if (likes.length === 0) return null;
  const total = likes.length;
  return {
    n: total,
    zeroShare: likes.filter((value) => value === 0).length / total,
    p50: quantile(likes, 0.5),
    p75: quantile(likes, 0.75),
    p90: quantile(likes, 0.9),
    max: likes[total - 1],
    hitShare: likes.filter((value) => value >= 5).length / total,
  };
};

export const readLedger = (file) => {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, position) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        fail(`ledger line ${position + 1} is not valid JSON: ${error.message}`);
      }
      return undefined;
    });
};

export const writeLedger = (file, entries) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const ordered = [...entries].sort((a, b) => (
    String(a.publishedAt ?? "").localeCompare(String(b.publishedAt ?? ""))
  ));
  fs.writeFileSync(file, ordered.map((entry) => JSON.stringify(entry)).join("\n") + "\n");
};

export const parseFrontMatter = (source) => {
  const match = source.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result = {};
  for (const line of match[1].split("\n")) {
    const pair = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!pair) continue;
    const [, key] = pair;
    let raw = pair[2].trim();
    if (raw.startsWith("[") && raw.endsWith("]")) {
      result[key] = raw
        .slice(1, -1)
        .split(",")
        .map((item) => item.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
      continue;
    }
    raw = raw.replace(/^["']|["']$/g, "");
    result[key] = raw === "true" ? true : raw === "false" ? false : raw;
  }
  return result;
};

/**
 * Value archetypes are the unit the loop learns about: "what kind of payoff does
 * the reader get". They are pre-registered per article by search-topic; this
 * heuristic only backfills the pre-loop articles so they can act as a historical
 * control. Heuristic labels are marked as such and never treated as evidence of
 * the same strength as a pre-registered one.
 */
/**
 * The 7 archetypes the policy can act on. A contract must name one of these.
 */
export const POLICY_ARCHETYPES = [
  "asset", "migration", "quantified", "mental-model", "decision",
  "boundary-verification", "incident-log",
];

/**
 * Labels that describe real, common categories in the market but that the
 * policy has no stance on. They exist so market observation is not forced to
 * mislabel a "触ってみた" article as an incident log -- but nothing may be
 * promoted into them, and `register-article.mjs` rejects them in a contract.
 */
export const OBSERVATION_ARCHETYPES = ["comparison", "intro-try", "news"];

/**
 * Guess an archetype from a title alone.
 *
 * Ordering is load-bearing: the first match wins, so the more specific frame
 * has to be tested before the more general one. "TanStack Virtual を使ってみた話"
 * is an intro-try that happens to end in 話, and "Rustでイテレータを作って...
 * 表現してみた" is an intro-try that happens to contain 作って.
 *
 * Precision beats recall here. A wrong label silently biases the market
 * analysis that the policy learns from, whereas "unclassified" is visible and
 * gets sent to the LLM re-classification step instead. Every pattern below was
 * checked against fixtures/archetype-labels.json; patterns that gained one
 * match but cost a false positive were dropped rather than kept.
 */
export const guessValueArchetype = (title) => {
  const rules = [
    // Numbers in the title are the strongest single signal, and no other
    // archetype competes for them.
    [/(\d+)\s*(倍|分の1|%|％|ms|秒|時間)|削減|高速化|ベンチ|減らせた|減った/, "quantified"],

    // Roundups. Narrow on purpose: bare まとめ is far too common.
    [/動向|\d+年\d+月版|リリースノート|今週の|ウィークリー/, "news"],

    // Before intro-try: "移行してみた" is a migration, not a first look.
    [/移行|マイグレ|アップグレード|バージョンアップ|つまづき|ハマ|落とし穴|破壊的変更|適用しました|導入しました/, "migration"],

    // Before asset and incident-log, for 作って…してみた and 使ってみた話.
    [/てみた|てみる|入門|はじめる|初めて|触った|使ってみ/, "intro-try"],

    // A named A-vs-B comparison, not the word 比較 anywhere in the sentence:
    // "比較結果を可視化" is a how-to, not a comparison article.
    [/\bvs\b|ＶＳ|と.{0,20}を比較|書き比べ|.{2,}の違い/i, "comparison"],

    [/選定|選び方|どちら|使い分け|べき|選び直|採用する|に決めた/, "decision"],

    // 作った must not fire on a subordinate clause ("作ったプラグインを読ませたら"),
    // so it is anchored to the end of the title or to a explicit 話/方 form.
    [/公開しました|作りました|作った(お?話)?$|作り方|作る$|作ってみ|設定|テンプレ|ハーネス|スクリプト|ツールを|可視化|する方法|活用実例|活用事例|実践$/, "asset"],

    // 概要 only at the end: "PR の概要や..." is not an explainer.
    [/なぜ|とは|考え方|仕組み|概念|理解|読み解く|考える|視点|前提|理由|概要$/, "mental-model"],

    [/検証|実測|確かめた|調べた|効くか|塞ぐか|防ぐか|ゲート|境界|挙動/, "boundary-verification"],

    [/やったこと|振り返り|レポート|記録|ログ|話$|挑んだ|参加した|しました$/, "incident-log"],
  ];
  for (const [pattern, archetype] of rules) {
    if (pattern.test(title)) return archetype;
  }
  return "unclassified";
};

export const titleFeatures = (title) => ({
  length: [...title].length,
  hasNumber: /\d/.test(title),
  hasVersion: /\d+\.\d+|\bv?\d+\b/.test(title),
  hasQuantifiedOutcome: /(\d+)\s*(倍|分の1|%|％|ms|秒)|削減|激減|高速化/.test(title),
  framedAsVerification: /検証|実測|確かめ|調べた|効くか|塞ぐか/.test(title),
});
