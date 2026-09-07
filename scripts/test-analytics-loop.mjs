#!/usr/bin/env node
//
// Tests for the topic-improvement loop:
//   collect-zenn-metrics.mjs / register-article.mjs
//   build-topic-feedback.mjs / evaluate-policy.mjs
//
// Every case runs against a throwaway fixture repo so no test touches the real
// analytics/ or strategy/ files.

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  OBSERVATION_ARCHETYPES,
  POLICY_ARCHETYPES,
  guessValueArchetype,
} from "./analytics/zenn-metrics-lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..");
const scripts = {
  collect: path.join(here, "analytics/collect-zenn-metrics.mjs"),
  register: path.join(here, "analytics/register-article.mjs"),
  feedback: path.join(here, "analytics/build-topic-feedback.mjs"),
  evaluate: path.join(here, "analytics/evaluate-policy.mjs"),
  nextArm: path.join(here, "analytics/next-arm.mjs"),
};

const NOW = "2026-09-05T00:00:00.000Z";
let passed = 0;

const fixture = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "analytics-loop-test-"));
  fs.mkdirSync(path.join(dir, "articles"), { recursive: true });
  fs.mkdirSync(path.join(dir, "experiments"), { recursive: true });
  fs.mkdirSync(path.join(dir, "strategy"), { recursive: true });
  fs.copyFileSync(
    path.join(repo, "strategy/topic-selection-policy.json"),
    path.join(dir, "strategy/topic-selection-policy.json"),
  );
  fs.copyFileSync(
    path.join(repo, "experiments/EXP-001.json"),
    path.join(dir, "experiments/EXP-001.json"),
  );
  fs.writeFileSync(path.join(dir, "strategy/decision-log.md"), "| 日付 | 実験 | verdict | 提案 | 提案ファイル |\n|---|---|---|---|---|\n");
  return dir;
};

const run = (script, args, dir) => spawnSync("node", [script, ...args, "--root", dir], { encoding: "utf8" });

const ok = (result, label) => {
  assert.equal(result.status, 0, `${label} failed (exit ${result.status})\n${result.stdout}\n${result.stderr}`);
  return result;
};

const test = (name, body) => {
  const dir = fixture();
  try {
    body(dir);
    passed += 1;
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`FAIL - ${name}`);
    throw error;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

const article = (overrides = {}) => ({
  id: overrides.id ?? 1,
  slug: overrides.slug ?? "sample-article",
  title: overrides.title ?? "サンプル記事",
  liked_count: overrides.liked_count ?? 0,
  bookmarked_count: 0,
  comments_count: 0,
  body_letters_count: 5000,
  article_type: "tech",
  published_at: overrides.published_at ?? "2026-09-01T00:00:00.000+09:00",
  user: { username: overrides.username ?? "clopy" },
});

const writeJson = (dir, rel, value) => {
  const file = path.join(dir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value));
  return rel;
};

const writeArticleFile = (dir, slug, topics) => {
  fs.writeFileSync(
    path.join(dir, "articles", `${slug}.md`),
    `---\ntitle: "t"\nemoji: "x"\ntype: tech\ntopics: ${JSON.stringify(topics)}\npublished: true\n---\n\nbody\n`,
  );
};

const readLedger = (dir) => fs.readFileSync(path.join(dir, "analytics/article-ledger.jsonl"), "utf8")
  .split("\n").filter(Boolean).map((line) => JSON.parse(line));

// ---------------------------------------------------------------- collect

test("collect seeds pre-loop articles as a heuristically labelled historical control", (dir) => {
  const self = writeJson(dir, "self.json", [{ articles: [
    article({ id: 1, slug: "a-verify", title: "denyは塞ぐか検証した", published_at: "2026-07-01T00:00:00.000+09:00", liked_count: 2 }),
    article({ id: 2, slug: "b-asset", title: "使える設定をまとめて公開しました", published_at: "2026-07-02T00:00:00.000+09:00" }),
  ] }]);
  writeArticleFile(dir, "a-verify", ["claudecode", "security"]);
  ok(run(scripts.collect, ["--self-json", self, "--now", NOW], dir), "collect");

  const ledger = readLedger(dir);
  assert.equal(ledger.length, 2);
  const verify = ledger.find((entry) => entry.slug === "a-verify");
  assert.equal(verify.classification.source, "heuristic");
  assert.equal(verify.classification.arm, "historical-control");
  assert.equal(verify.classification.valueArchetype, "boundary-verification");
  assert.deepEqual(verify.topics, ["claudecode", "security"]);
  assert.equal(verify.primaryTopic, "claudecode");
  assert.equal(
    ledger.find((entry) => entry.slug === "b-asset").classification.valueArchetype,
    "asset",
  );
});

test("collect fills d7/d30 slots by age and marks unrecoverable ones as an upper bound", (dir) => {
  // 7.6 days old -> the first day of the d7 window, which a daily run hits.
  const fresh = writeJson(dir, "fresh.json", [{ articles: [
    article({ slug: "fresh", published_at: "2026-08-28T09:00:00.000+09:00", liked_count: 1 }),
  ] }]);
  ok(run(scripts.collect, ["--self-json", fresh, "--now", NOW], dir), "collect fresh");
  let entry = readLedger(dir)[0];
  assert.equal(entry.observations.d7.basis, "measured-on-time");
  assert.equal(entry.observations.d7.likes, 1);
  assert.equal(entry.observations.d30, undefined, "d30 must stay empty before day 30");

  // A run 38 days after publication still fills d30, but late: the cadence
  // slipped past the first days of the window, so a judgement can tell.
  const later = writeJson(dir, "later.json", [{ articles: [
    article({ slug: "fresh", published_at: "2026-08-28T09:00:00.000+09:00", liked_count: 6 }),
  ] }]);
  ok(run(scripts.collect, ["--self-json", later, "--now", "2026-10-05T00:00:00.000Z"], dir), "collect later");
  entry = readLedger(dir)[0];
  assert.equal(entry.observations.d7.likes, 1, "d7 must be frozen once measured");
  assert.equal(entry.observations.d30.basis, "late-measured");
  assert.equal(entry.observations.d30.likes, 6);

  // An article first seen long after publication cannot have a real d30.
  const old = writeJson(dir, "old.json", [{ articles: [
    article({ slug: "ancient", published_at: "2026-01-01T00:00:00.000+09:00", liked_count: 3 }),
  ] }]);
  ok(run(scripts.collect, ["--self-json", old, "--now", NOW], dir), "collect old");
  const ancient = readLedger(dir).find((item) => item.slug === "ancient");
  assert.equal(ancient.observations.d30.basis, "current-upper-bound");
  assert.equal(ancient.observations.d7.basis, "current-upper-bound");
});

test("collect keeps our own articles out of the market baseline and dedupes re-observations", (dir) => {
  const self = writeJson(dir, "self.json", [{ articles: [article({ slug: "mine", liked_count: 1 })] }]);
  const market = writeJson(dir, "market.json", {
    claudecode: { articles: [
      article({ id: 900, slug: "theirs", liked_count: 4, username: "someone" }),
      article({ id: 901, slug: "also-theirs", liked_count: 0, username: "someone" }),
      // Same username as ours: must be skipped so we never rank against ourselves.
      article({ id: 902, slug: "mine", liked_count: 1, username: "clopy" }),
    ] },
  });
  ok(run(scripts.collect, ["--self-json", self, "--market-json", market, "--now", NOW], dir), "collect");
  let index = JSON.parse(fs.readFileSync(path.join(dir, "analytics/market-index.json"), "utf8"));
  let cell = index.cohorts.claudecode["d2-6"].observations;
  assert.deepEqual(Object.keys(cell).sort(), ["900", "901"], "own article must not enter the cohort");

  // Re-observing the same article in the same bracket refreshes, never duplicates.
  const market2 = writeJson(dir, "market2.json", {
    claudecode: { articles: [article({ id: 900, slug: "theirs", liked_count: 9, username: "someone" })] },
  });
  ok(run(scripts.collect, ["--self-json", self, "--market-json", market2, "--now", NOW], dir), "collect again");
  index = JSON.parse(fs.readFileSync(path.join(dir, "analytics/market-index.json"), "utf8"));
  cell = index.cohorts.claudecode["d2-6"].observations;
  assert.equal(Object.keys(cell).length, 2);
  assert.equal(cell["900"].likes, 9);
});

test("collect ranks an article only once its age-matched cohort has 20 observations", (dir) => {
  const self = writeJson(dir, "self.json", [{ articles: [
    article({ slug: "mine", published_at: "2026-09-03T00:00:00.000+09:00", liked_count: 3 }),
  ] }]);
  writeArticleFile(dir, "mine", ["claudecode"]);

  const cohort = (count) => ({
    claudecode: { articles: Array.from({ length: count }, (unused, index) => article({
      id: 1000 + index,
      slug: `t-${index}`,
      // Mostly zeros with a heavy tail, like the real distribution.
      liked_count: index < count - 2 ? 0 : 8,
      published_at: "2026-09-03T00:00:00.000+09:00",
      username: "someone",
    })) },
  });

  ok(run(scripts.collect, ["--self-json", self, "--market-json", writeJson(dir, "m1.json", cohort(19)), "--now", NOW], dir), "small cohort");
  assert.deepEqual(readLedger(dir)[0].relative, {}, "19 observations is too few to rank against");

  ok(run(scripts.collect, ["--self-json", self, "--market-json", writeJson(dir, "m2.json", cohort(25)), "--now", NOW], dir), "big cohort");
  const relative = readLedger(dir)[0].relative["d2-6"];
  assert.equal(relative.cohortSize, 25);
  // 23 zeros and 2 eights: 3 likes beats the zeros and loses to the tail.
  assert.ok(relative.percentile > 90 && relative.percentile < 93, `unexpected percentile ${relative.percentile}`);
  assert.equal(relative.tier, "top10");
});

// --------------------------------------------------------------- register

test("register rejects the deprecated archetype and single-check contracts", (dir) => {
  const contract = writeJson(dir, "c.json", {
    slug: "one-probe",
    policyVersion: "2026-09-05.1",
    experimentId: null,
    arm: "exploration",
    valueArchetype: "boundary-verification",
    targetReader: "reader",
    readerDecision: "denyが効くか分かる",
    takeaway: "検証結果",
    verificationItems: ["one"],
    titleDraft: "denyは塞ぐか検証した",
    primaryTopic: "claudecode",
    topics: ["claudecode"],
    demandEvidence: "気になる",
  });
  const result = run(scripts.register, ["--check", "--contract", contract], dir);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /deprecated/);
  assert.match(result.stderr, /at least 3 entries/);
});

test("register rejects a missing field, a multi-sentence decision, and quantified without a metric", (dir) => {
  const base = {
    slug: "ok-slug",
    policyVersion: "2026-09-05.1",
    experimentId: null,
    arm: "exploration",
    valueArchetype: "asset",
    targetReader: "reader",
    readerDecision: "決められる",
    takeaway: "設定全文",
    verificationItems: ["a", "b", "c"],
    titleDraft: "使える設定",
    primaryTopic: "claudecode",
    topics: ["claudecode"],
    demandEvidence: "上位記事が657いいね",
  };

  const missing = run(scripts.register, ["--check", "--contract", writeJson(dir, "m.json", { ...base, takeaway: "" })], dir);
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /missing required field: takeaway/);

  const twoSentences = run(scripts.register, ["--check", "--contract",
    writeJson(dir, "t.json", { ...base, readerDecision: "AかBを決められる。あとCも分かる。" })], dir);
  assert.equal(twoSentences.status, 2);
  assert.match(twoSentences.stderr, /single decision/);

  const quantified = run(scripts.register, ["--check", "--contract",
    writeJson(dir, "q.json", { ...base, valueArchetype: "quantified" })], dir);
  assert.equal(quantified.status, 2);
  assert.match(quantified.stderr, /quantifiedMetric is required/);

  ok(run(scripts.register, ["--check", "--contract", writeJson(dir, "good.json", base)], dir), "valid contract");
});

test("register reads the contract out of a research report and refuses silent overwrites", (dir) => {
  const report = path.join(dir, "research/search-topic-20260905-0000.md");
  fs.mkdirSync(path.dirname(report), { recursive: true });
  fs.writeFileSync(report, [
    "# report", "", "## 記事契約", "", "```json",
    JSON.stringify({
      slug: "deny-recipe",
      policyVersion: "2026-09-05.1",
      experimentId: "EXP-001",
      arm: "B-payload",
      valueArchetype: "asset",
      targetReader: "権限設定でつまずいている人",
      readerDecision: "deny設定をどこまで信用するか決められる",
      takeaway: "settings.json 全文と穴の一覧",
      verificationItems: ["redirect", "symlink", "write"],
      titleDraft: "denyはどこまで信用できるか、3経路試した設定",
      primaryTopic: "claudecode",
      topics: ["claudecode", "security"],
      demandEvidence: "上位記事が657いいね",
    }, null, 2),
    "```", "",
  ].join("\n"));

  ok(run(scripts.register, ["--from-research", "research/search-topic-20260905-0000.md"], dir), "register from research");
  const entry = readLedger(dir)[0];
  assert.equal(entry.slug, "deny-recipe");
  assert.equal(entry.classification.source, "contract");
  assert.equal(entry.classification.experimentId, "EXP-001");
  assert.equal(entry.classification.arm, "B-payload");
  assert.equal(entry.classification.contract.verificationItems.length, 3);
  assert.equal(entry.publishedAt, null, "a contract is registered before publication");

  const again = run(scripts.register, ["--from-research", "research/search-topic-20260905-0000.md"], dir);
  assert.equal(again.status, 2);
  assert.match(again.stderr, /already registered/);
});

test("collect fills in the publish time of a pre-registered contract without touching it", (dir) => {
  const contract = writeJson(dir, "c.json", {
    slug: "deny-recipe",
    policyVersion: "2026-09-05.1",
    experimentId: "EXP-001",
    arm: "B-payload",
    valueArchetype: "asset",
    targetReader: "reader",
    readerDecision: "決められる",
    takeaway: "設定全文",
    verificationItems: ["a", "b", "c"],
    titleDraft: "案",
    primaryTopic: "claudecode",
    topics: ["claudecode"],
    demandEvidence: "657いいね",
  });
  ok(run(scripts.register, ["--contract", contract], dir), "register");

  const self = writeJson(dir, "self.json", [{ articles: [article({
    slug: "deny-recipe", title: "公開後の実タイトル", published_at: "2026-09-04T10:00:00.000+09:00", liked_count: 2,
  })] }]);
  ok(run(scripts.collect, ["--self-json", self, "--now", NOW], dir), "collect");

  const ledger = readLedger(dir);
  assert.equal(ledger.length, 1, "collect must not create a duplicate heuristic entry");
  assert.equal(ledger[0].publishedAt, "2026-09-04T10:00:00.000+09:00");
  assert.equal(ledger[0].title, "公開後の実タイトル");
  assert.equal(ledger[0].classification.source, "contract", "the contract must survive collection");
  assert.equal(ledger[0].classification.arm, "B-payload");
  assert.equal(ledger[0].observations.latest.likes, 2);
});

// --------------------------------------------------------------- feedback

test("feedback reports market winners, the control group, and what cannot be concluded", (dir) => {
  const self = writeJson(dir, "self.json", [{ articles: [
    article({ id: 1, slug: "x", title: "検証した", published_at: "2026-07-01T00:00:00.000+09:00", liked_count: 1 }),
  ] }]);
  const market = writeJson(dir, "market.json", {
    _top: { articles: [
      article({ id: 500, slug: "w1", title: "個人的claude code設定", liked_count: 657, username: "someone" }),
      article({ id: 501, slug: "w2", title: "移行のつまづきポイント", liked_count: 10, username: "someone" }),
    ] },
  });
  ok(run(scripts.collect, ["--self-json", self, "--market-json", market, "--now", NOW], dir), "collect");
  ok(run(scripts.feedback, ["--now", NOW], dir), "feedback");

  const report = fs.readFileSync(path.join(dir, "analytics/topic-feedback.md"), "utf8");
  assert.match(report, /## 1\. 市場の勝ち型/);
  assert.match(report, /個人的claude code設定/, "raw winner titles must be listed for the reader to classify");
  assert.match(report, /A-historical（対照）/);
  assert.match(report, /## 5\. このデータで言えないこと/);
  assert.match(report, /露出と内容の分離/, "the PV limitation must be stated");
  assert.match(report, /順位算出済n/, "percentile columns must carry their sample size");
});

// --------------------------------------------------------------- evaluate

test("evaluate reports insufficient data instead of judging a half-finished batch", (dir) => {
  const self = writeJson(dir, "self.json", [{ articles: [
    article({ slug: "x", published_at: "2026-07-01T00:00:00.000+09:00", liked_count: 1 }),
  ] }]);
  ok(run(scripts.collect, ["--self-json", self, "--now", NOW], dir), "collect");

  const result = run(scripts.evaluate, ["--now", NOW], dir);
  assert.equal(result.status, 3, "an unfinished batch is not an error, but it is not a verdict either");
  assert.match(result.stdout, /verdict: insufficient/);
  assert.match(result.stdout, /policy change proposed: no/);

  // The policy itself must never be rewritten by the evaluator.
  const policy = JSON.parse(fs.readFileSync(path.join(dir, "strategy/topic-selection-policy.json"), "utf8"));
  assert.equal(policy.policyVersion, "2026-09-05.1");
  assert.equal(
    policy.valueArchetypes.find((item) => item.id === "asset").stage,
    "provisional",
    "evaluate-policy must not promote an archetype on its own",
  );
  assert.match(fs.readFileSync(path.join(dir, "strategy/decision-log.md"), "utf8"), /insufficient/);
});

test("evaluate raises a stop-rule regression when the new arm's zero-like share blows out", (dir) => {
  // Control: 10 pre-loop articles, 3 of them at zero (30%).
  const control = Array.from({ length: 10 }, (unused, index) => article({
    id: index + 1,
    slug: `old-${index}`,
    title: "検証した",
    published_at: "2026-01-01T00:00:00.000+09:00",
    liked_count: index < 3 ? 0 : 2,
  }));
  // Treatment: 6 registered articles, all at zero (100%) -> +70 points.
  const treatment = Array.from({ length: 6 }, (unused, index) => article({
    id: 100 + index,
    slug: `new-${index}`,
    title: "設定",
    // Inside the d30 observation window at NOW, so the slot is measured rather
    // than an unrecoverable upper bound.
    published_at: "2026-08-01T00:00:00.000+09:00",
    liked_count: 0,
  }));

  for (let index = 0; index < 6; index += 1) {
    const contract = writeJson(dir, `c-${index}.json`, {
      slug: `new-${index}`,
      policyVersion: "2026-09-05.1",
      experimentId: "EXP-001",
      arm: "B-payload",
      valueArchetype: "asset",
      targetReader: "reader",
      readerDecision: "決められる",
      takeaway: "設定全文",
      verificationItems: ["a", "b", "c"],
      titleDraft: "設定",
      primaryTopic: "claudecode",
      topics: ["claudecode"],
      demandEvidence: "657いいね",
    });
    ok(run(scripts.register, ["--contract", contract], dir), `register ${index}`);
  }

  const self = writeJson(dir, "self.json", [{ articles: [...control, ...treatment] }]);
  ok(run(scripts.collect, ["--self-json", self, "--now", NOW], dir), "collect");

  const result = run(scripts.evaluate, ["--now", NOW], dir);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /verdict: regress/);
  assert.match(result.stdout, /policy change proposed: yes/);

  const proposal = fs.readFileSync(path.join(dir, "strategy/proposals/2026-09-05-EXP-001.md"), "utf8");
  assert.match(proposal, /### 実験の停止/);
  assert.match(proposal, /この提案は方針ではない/, "a proposal must not read as an applied change");

  const policy = JSON.parse(fs.readFileSync(path.join(dir, "strategy/topic-selection-policy.json"), "utf8"));
  assert.equal(policy.policyVersion, "2026-09-05.1", "policy must stay untouched even on a regression");
});

test("register refuses an implicit or mismatched experiment assignment", (dir) => {
  const base = {
    slug: "ok-slug",
    policyVersion: "2026-09-05.1",
    valueArchetype: "asset",
    targetReader: "reader",
    readerDecision: "決められる",
    takeaway: "設定全文",
    verificationItems: ["a", "b", "c"],
    titleDraft: "使える設定",
    primaryTopic: "claudecode",
    topics: ["claudecode"],
    demandEvidence: "上位記事が657いいね",
  };

  // Omitting experimentId must not silently enrol the article in the active
  // experiment: exploration articles would corrupt the treatment arm's verdict.
  const implicit = run(scripts.register, ["--check", "--contract", writeJson(dir, "i.json", base)], dir);
  assert.equal(implicit.status, 2);
  assert.match(implicit.stderr, /experimentId is required/);

  const noArm = run(scripts.register, ["--check", "--contract",
    writeJson(dir, "n.json", { ...base, experimentId: "EXP-001" })], dir);
  assert.equal(noArm.status, 2);
  assert.match(noArm.stderr, /arm is required/);

  const badArm = run(scripts.register, ["--check", "--contract",
    writeJson(dir, "b.json", { ...base, experimentId: "EXP-001", arm: "B-asset" })], dir);
  assert.equal(badArm.status, 2);
  assert.match(badArm.stderr, /not defined by EXP-001/);

  // mental-model is a candidate archetype, not one EXP-001's treatment accepts.
  const badArchetype = run(scripts.register, ["--check", "--contract",
    writeJson(dir, "a.json", { ...base, experimentId: "EXP-001", arm: "B-payload", valueArchetype: "mental-model" })], dir);
  assert.equal(badArchetype.status, 2);
  assert.match(badArchetype.stderr, /accepts only/);

  ok(run(scripts.register, ["--check", "--contract",
    writeJson(dir, "g.json", { ...base, experimentId: "EXP-001", arm: "B-payload" })], dir), "valid assignment");
});

test("the D30 percentile is frozen with its own observation, not overwritten later", (dir) => {
  const cohort = (count, at, likes) => ({
    claudecode: { articles: Array.from({ length: count }, (unused, index) => article({
      id: 2000 + index,
      slug: `c-${index}`,
      liked_count: likes(index),
      published_at: at,
      username: "someone",
    })) },
  });

  // Day 30: our article beats a cohort that is almost all zeros.
  const selfDay30 = writeJson(dir, "s30.json", [{ articles: [
    article({ slug: "mine", published_at: "2026-08-01T00:00:00.000+09:00", liked_count: 3 }),
  ] }]);
  writeArticleFile(dir, "mine", ["claudecode"]);
  ok(run(scripts.collect, [
    "--self-json", selfDay30,
    "--market-json", writeJson(dir, "m30.json", cohort(60, "2026-08-01T00:00:00.000+09:00", () => 0)),
    "--now", "2026-08-31T12:00:00.000Z",
  ], dir), "collect at d30");

  let entry = readLedger(dir)[0];
  const frozen = entry.observations.d30.relative;
  assert.equal(entry.observations.d30.basis, "measured-on-time");
  assert.equal(frozen.bracket, "d30-45");
  assert.ok(frozen.percentile > 95, `expected a high frozen percentile, got ${frozen.percentile}`);
  assert.equal(frozen.usableFor.decision, true);
  assert.equal(frozen.usableFor.promotion, false, "60 observations is below the promotion threshold");

  // Much later, in a cohort where everyone has many likes, the rolling standing
  // drops -- but the frozen D30 percentile must not move.
  ok(run(scripts.collect, [
    "--self-json", writeJson(dir, "s90.json", [{ articles: [
      article({ slug: "mine", published_at: "2026-08-01T00:00:00.000+09:00", liked_count: 3 }),
    ] }]),
    "--market-json", writeJson(dir, "m90.json", cohort(60, "2026-06-01T00:00:00.000+09:00", () => 40)),
    "--now", "2026-11-01T00:00:00.000Z",
  ], dir), "collect much later");

  entry = readLedger(dir)[0];
  assert.deepEqual(entry.observations.d30.relative, frozen, "the D30 percentile must be immutable");
  assert.ok(entry.relative["d46+"].percentile < 10, "the rolling standing should have dropped");
});

test("the day after the D30 slot is taken, the daily run must not overwrite it", (dir) => {
  // Regression: the freeze check was `basis.endsWith("measured")`, which is true
  // for "late-measured" and FALSE for "measured-on-time" -- exactly inverted. A
  // value taken on time at day 30 was therefore rewritten by the day-31 and
  // day-32 runs, so the "frozen" D30 was really day 32's. The earlier freeze
  // test jumped from day 30 to day 90 and stepped right over it.
  const cohort = (count, at, likes) => ({
    claudecode: { articles: Array.from({ length: count }, (unused, index) => article({
      id: 3000 + index,
      slug: `d-${index}`,
      liked_count: likes,
      published_at: at,
      username: "someone",
    })) },
  });
  const publishedAt = "2026-08-01T00:00:00.000+09:00";
  const self = (likes, name) => writeJson(dir, name, [{ articles: [
    article({ slug: "mine", published_at: publishedAt, liked_count: likes }),
  ] }]);

  writeArticleFile(dir, "mine", ["claudecode"]);
  // Day 30, on time: 1 like against an all-zero cohort.
  ok(run(scripts.collect, [
    "--self-json", self(1, "s30.json"),
    "--market-json", writeJson(dir, "m30.json", cohort(60, publishedAt, 0)),
    "--now", "2026-08-31T00:00:00.000Z",
  ], dir), "collect at d30");

  const day30 = readLedger(dir)[0].observations.d30;
  assert.equal(day30.basis, "measured-on-time");
  assert.equal(day30.likes, 1);

  // Day 31 and 32 are still inside the slot's on-time edge (< 33 days), so the
  // buggy check let them through. Give them a different like count and a
  // different cohort so any overwrite is visible.
  for (const [day, likes] of [["2026-09-01", 7], ["2026-09-02", 9]]) {
    ok(run(scripts.collect, [
      "--self-json", self(likes, `s-${day}.json`),
      "--market-json", writeJson(dir, `m-${day}.json`, cohort(60, publishedAt, 20)),
      "--now", `${day}T00:00:00.000Z`,
    ], dir), `collect at ${day}`);

    const current = readLedger(dir)[0].observations.d30;
    assert.deepEqual(current, day30, `the D30 slot was rewritten on ${day}`);
  }
});

test("a lost ledger line cannot downgrade a registered contract to a heuristic label", (dir) => {
  const contract = writeJson(dir, "c.json", {
    slug: "deny-recipe",
    policyVersion: "2026-09-05.1",
    experimentId: "EXP-001",
    arm: "B-payload",
    valueArchetype: "asset",
    targetReader: "reader",
    readerDecision: "決められる",
    takeaway: "設定全文",
    verificationItems: ["a", "b", "c"],
    titleDraft: "案",
    primaryTopic: "claudecode",
    topics: ["claudecode"],
    demandEvidence: "657いいね",
  });
  ok(run(scripts.register, ["--contract", contract], dir), "register");
  assert.ok(
    fs.existsSync(path.join(dir, "analytics/contracts/deny-recipe.json")),
    "the contract must also live in its own file",
  );

  // Simulate the ledger being lost (isolated worktree, concurrent write).
  fs.rmSync(path.join(dir, "analytics/article-ledger.jsonl"));

  ok(run(scripts.collect, ["--self-json", writeJson(dir, "self.json", [{ articles: [
    article({ slug: "deny-recipe", title: "検証した", published_at: "2026-09-04T10:00:00.000+09:00" }),
  ] }]), "--now", NOW], dir), "collect after losing the ledger");

  const entry = readLedger(dir)[0];
  assert.equal(entry.classification.source, "contract", "the contract file must restore the classification");
  assert.equal(entry.classification.arm, "B-payload");
  assert.equal(entry.classification.valueArchetype, "asset");
});

test("evaluate does not stop the experiment on a small sample, and --apply carries the diff", (dir) => {
  const control = Array.from({ length: 10 }, (unused, index) => article({
    id: index + 1,
    slug: `old-${index}`,
    title: "検証した",
    published_at: "2026-01-01T00:00:00.000+09:00",
    liked_count: index < 3 ? 0 : 2,
  }));
  // Five zero-like treatment articles: the old rule stopped here. The batch of
  // 12 is not complete and the sixth is non-zero, so nothing may be concluded.
  const treatment = Array.from({ length: 5 }, (unused, index) => article({
    id: 100 + index,
    slug: `new-${index}`,
    title: "設定",
    published_at: "2026-08-01T00:00:00.000+09:00",
    liked_count: 0,
  }));

  for (let index = 0; index < 5; index += 1) {
    ok(run(scripts.register, ["--contract", writeJson(dir, `c-${index}.json`, {
      slug: `new-${index}`,
      policyVersion: "2026-09-05.1",
      experimentId: "EXP-001",
      arm: "B-payload",
      valueArchetype: "asset",
      targetReader: "reader",
      readerDecision: "決められる",
      takeaway: "設定全文",
      verificationItems: ["a", "b", "c"],
      titleDraft: "設定",
      primaryTopic: "claudecode",
      topics: ["claudecode"],
      demandEvidence: "657いいね",
    })], dir), `register ${index}`);
  }

  ok(run(scripts.collect, ["--self-json",
    writeJson(dir, "self.json", [{ articles: [...control, ...treatment] }]), "--now", NOW], dir), "collect");

  const result = run(scripts.evaluate, ["--now", NOW], dir);
  assert.equal(result.status, 3, "5 of 12 articles is not a verdict");
  assert.match(result.stdout, /verdict: insufficient/);

  // Same data with --apply must still change nothing, because nothing was decided.
  const applied = run(scripts.evaluate, ["--now", NOW, "--apply"], dir);
  assert.equal(applied.status, 3);
  const policy = JSON.parse(fs.readFileSync(path.join(dir, "strategy/topic-selection-policy.json"), "utf8"));
  assert.equal(policy.policyVersion, "2026-09-05.1", "--apply must not bump the version with no decision");
});

test("--apply writes a real policy diff when the experiment actually regresses", (dir) => {
  // Six treatment articles, every one at zero: the catastrophic stop rule.
  for (let index = 0; index < 6; index += 1) {
    ok(run(scripts.register, ["--contract", writeJson(dir, `c-${index}.json`, {
      slug: `new-${index}`,
      policyVersion: "2026-09-05.1",
      experimentId: "EXP-001",
      arm: "B-payload",
      valueArchetype: "asset",
      targetReader: "reader",
      readerDecision: "決められる",
      takeaway: "設定全文",
      verificationItems: ["a", "b", "c"],
      titleDraft: "設定",
      primaryTopic: "claudecode",
      topics: ["claudecode"],
      demandEvidence: "657いいね",
    })], dir), `register ${index}`);
  }
  const treatment = Array.from({ length: 6 }, (unused, index) => article({
    id: 100 + index,
    slug: `new-${index}`,
    published_at: "2026-08-01T00:00:00.000+09:00",
    liked_count: 0,
  }));
  ok(run(scripts.collect, ["--self-json",
    writeJson(dir, "self.json", [{ articles: treatment }]), "--now", NOW], dir), "collect");

  // Without --apply: a verdict, a proposal, and no change on disk.
  const dry = run(scripts.evaluate, ["--now", NOW], dir);
  assert.equal(dry.status, 0);
  assert.match(dry.stdout, /verdict: regress/);
  assert.match(dry.stdout, /re-run with --apply/);
  let experiment = JSON.parse(fs.readFileSync(path.join(dir, "experiments/EXP-001.json"), "utf8"));
  assert.equal(experiment.status, "active", "no --apply means no change");

  // With --apply: the branch carries a diff a human can actually review.
  const applied = run(scripts.evaluate, ["--now", NOW, "--apply"], dir);
  assert.equal(applied.status, 0);
  assert.match(applied.stdout, /applied to the working tree/);
  experiment = JSON.parse(fs.readFileSync(path.join(dir, "experiments/EXP-001.json"), "utf8"));
  assert.equal(experiment.status, "stopped");
  assert.match(experiment.stopReason, /破局条件/);
  const policy = JSON.parse(fs.readFileSync(path.join(dir, "strategy/topic-selection-policy.json"), "utf8"));
  assert.equal(policy.policyVersion, "2026-09-05.1", "a stop does not itself change the archetype stages");
});

// ------------------------------------------------- archetype classification

test("the archetype heuristic never mislabels a market title", () => {
  // The market analysis in build-topic-feedback is what the policy learns
  // "which value type wins" from, so a WRONG label silently biases the policy
  // while an `unclassified` one is visible and gets re-read by the LLM step.
  // This test therefore fails on any false positive, and only warns on recall.
  const fixture = JSON.parse(fs.readFileSync(
    path.join(repo, "fixtures/archetype-labels.json"), "utf8",
  ));
  const wrong = [];
  let correct = 0;
  let unclassified = 0;
  for (const row of fixture.labels) {
    const got = guessValueArchetype(row.title);
    if (got === "unclassified") unclassified += 1;
    else if (row.accept.includes(got)) correct += 1;
    else wrong.push(`${got} (expected ${row.accept.join("|")}): ${row.title}`);
  }
  assert.deepEqual(wrong, [], `mislabelled market titles:\n  ${wrong.join("\n  ")}`);
  // Recall floor: the measured rate when the fixture was written was 80%.
  // Well below that means new rules stopped matching, which is worth failing on.
  const recall = correct / fixture.labels.length;
  assert.ok(recall >= 0.7, `recall dropped to ${Math.round(recall * 100)}% (was 80%)`);
  assert.equal(correct + unclassified, fixture.labels.length);
});

test("the archetype heuristic does not fire on the words it used to trip over", () => {
  // Each of these produced a wrong label before: "モデル" as in an ML model
  // matched the mental-model rule, "話" at the end of an intro-try, the word
  // "判断" buried in a subtitle, and "作った" in a subordinate clause.
  const cases = [
    ["CLAUDE_CODE_SUBAGENT_MODELだけではpin済みsubagentのモデルを変えられない", "mental-model"],
    ["TanStack Virtual を使ってみた話", "incident-log"],
    ["Gemini Enterprise ワークフロービルダーをさっそく触ってみた ― 人間の判断も入れられるWFに生まれ変わった", "decision"],
    ["Agent Plugins 1.0.0の仕様どおりに作ったプラグインをClaude Codeに読ませたら半分だけ読めた", "asset"],
    ["BRIG 1.1.1で環状ゲノムの比較結果を可視化", "comparison"],
    ["PR の概要や動作確認結果を HTML で共有するのに、zip 不要の GitHub Actions Artifact がちょうどよかった", "mental-model"],
  ];
  for (const [title, mustNotBe] of cases) {
    assert.notEqual(guessValueArchetype(title), mustNotBe, `"${title}" must not be ${mustNotBe}`);
  }
  // And the ones it should still catch, so the fix was not just "match less".
  assert.equal(guessValueArchetype("Rustでイテレータを作って色のグラデーションを表現してみた"), "intro-try");
  assert.equal(guessValueArchetype("Buffaloルーターのログを可視化してWi-Fi/DHCPの不調を切り分けるツールを作った"), "asset");
  assert.equal(guessValueArchetype("Prisma v7 移行のつまづきポイントと、importを安全に置き換えた話"), "migration");
});

test("a contract cannot name an observation-only archetype", () => {
  // comparison / intro-try / news describe the market but the policy has no
  // stance on them, so they must never reach a contract.
  for (const id of OBSERVATION_ARCHETYPES) {
    assert.ok(
      !POLICY_ARCHETYPES.includes(id),
      `${id} must not be a policy archetype`,
    );
  }
  const policy = JSON.parse(fs.readFileSync(
    path.join(repo, "strategy/topic-selection-policy.json"), "utf8",
  ));
  assert.deepEqual(
    policy.valueArchetypes.map((a) => a.id).sort(),
    [...POLICY_ARCHETYPES].sort(),
    "the policy file and POLICY_ARCHETYPES have drifted apart",
  );
});


// ---------------------------------------------------------------- next-arm

/** Register one contract straight into the fixture ledger, bypassing research. */
const registerContract = (dir, slug, overrides = {}) => {
  const contract = {
    slug,
    titleDraft: `${slug} のタイトル`,
    policyVersion: "2026-09-05.1",
    valueArchetype: "asset",
    experimentId: null,
    arm: "exploration",
    primaryTopic: "claudecode",
    topics: ["claudecode"],
    targetReader: "読者",
    readerDecision: "何かを決められる",
    takeaway: "持ち帰れるもの",
    verificationItems: ["a", "b", "c"],
    demandEvidence: "根拠",
    ...overrides,
  };
  const file = writeJson(dir, `contracts/${slug}.json`, contract);
  ok(run(scripts.register, ["--contract", file], dir), `register ${slug}`);
};

const nextArm = (dir) => JSON.parse(
  ok(run(scripts.nextArm, ["--json"], dir), "next-arm").stdout,
);

test("the allocator sends the next article to the arm the active experiment is short of", (dir) => {
  const first = nextArm(dir);
  assert.equal(first.arm, "B-payload", "an empty treatment arm must be filled first");
  assert.equal(first.experimentId, "EXP-001");
  assert.deepEqual(first.valueArchetypes, ["asset", "migration", "quantified"]);

  // The real ledger got into exactly this state: two exploration contracts and
  // zero treatment articles. The allocator must not read that as "exploration
  // is owed more"; the experiment is what is starved.
  registerContract(dir, "explore-a");
  registerContract(dir, "explore-b");
  const starved = nextArm(dir);
  assert.equal(starved.arm, "B-payload");
  assert.equal(starved.state.treatmentFilled, 0);
  assert.equal(starved.state.explorationCount, 2);
});

test("exploration keeps its share instead of being deferred to the end of the batch", (dir) => {
  const arms = [];
  for (let i = 0; i < 8; i += 1) {
    const assignment = nextArm(dir);
    arms.push(assignment.arm);
    registerContract(dir, `slot-${i}`, assignment.arm === "B-payload"
      ? { arm: "B-payload", experimentId: "EXP-001", valueArchetype: "asset" }
      : { arm: "exploration", experimentId: null, valueArchetype: "mental-model" });
  }
  // explorationShare 0.25 → one exploration slot in every four, interleaved.
  assert.deepEqual(arms, [
    "B-payload", "B-payload", "B-payload", "exploration",
    "B-payload", "B-payload", "B-payload", "exploration",
  ], `unexpected allocation order: ${arms.join(", ")}`);
});

test("a full or closed experiment stops taking articles instead of overfilling", (dir) => {
  const experimentPath = path.join(dir, "experiments/EXP-001.json");
  const experiment = JSON.parse(fs.readFileSync(experimentPath, "utf8"));
  experiment.design.treatment.n = 2;
  fs.writeFileSync(experimentPath, JSON.stringify(experiment));

  registerContract(dir, "b-1", { arm: "B-payload", experimentId: "EXP-001", valueArchetype: "asset" });
  registerContract(dir, "b-2", { arm: "B-payload", experimentId: "EXP-001", valueArchetype: "migration" });
  const full = nextArm(dir);
  assert.equal(full.arm, "exploration", "a filled arm must not take a 13th article");
  assert.equal(full.experimentId, null);
  assert.match(full.why, /D30/, "the reason must say what the loop is waiting for");

  experiment.status = "concluded";
  fs.writeFileSync(experimentPath, JSON.stringify(experiment));
  const closed = nextArm(dir);
  assert.equal(closed.arm, "exploration");
  assert.match(closed.why, /concluded/);
});

test("a registration the ledger lost still counts, because the contract file carries it", (dir) => {
  // The pipeline registers inside an isolated worktree, and the ledger is owned
  // by the daily loop in the shared checkout, so the worktree's ledger line does
  // not travel back. Only analytics/contracts/<slug>.json does. If the allocator
  // counted the ledger alone it would hand the same slot out twice.
  registerContract(dir, "b-1", { arm: "B-payload", experimentId: "EXP-001", valueArchetype: "asset" });
  const ledgerPath = path.join(dir, "analytics/article-ledger.jsonl");
  assert.ok(fs.existsSync(ledgerPath), "register should have written a ledger line");
  fs.rmSync(ledgerPath);

  const assignment = nextArm(dir);
  assert.equal(assignment.state.treatmentFilled, 1, "the contract file must still be counted");
  assert.equal(assignment.state.registered, 1);
  assert.equal(assignment.arm, "B-payload", "11 of 12 still to fill");
  assert.match(assignment.why, /11 more/);
});

test("the allocator never offers a deprecated archetype to the exploration arm", (dir) => {
  const experimentPath = path.join(dir, "experiments/EXP-001.json");
  const experiment = JSON.parse(fs.readFileSync(experimentPath, "utf8"));
  experiment.status = "concluded";
  fs.writeFileSync(experimentPath, JSON.stringify(experiment));

  const policy = JSON.parse(fs.readFileSync(path.join(dir, "strategy/topic-selection-policy.json"), "utf8"));
  const deprecated = policy.valueArchetypes.filter((a) => a.stage === "deprecated").map((a) => a.id);
  assert.ok(deprecated.length > 0, "fixture policy should still have deprecated archetypes");

  const assignment = nextArm(dir);
  for (const id of deprecated) {
    assert.ok(
      !assignment.valueArchetypes.includes(id),
      `exploration must not be offered the deprecated archetype ${id}`,
    );
  }
});

// -----------------------------------------------------------------------

console.log(`\n${passed} analytics-loop tests passed`);
