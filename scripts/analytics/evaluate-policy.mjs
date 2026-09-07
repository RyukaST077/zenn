#!/usr/bin/env node
//
// Judge the active experiment and, when the evidence warrants it, write a policy
// change PROPOSAL.
//
//   node scripts/analytics/evaluate-policy.mjs [--now <iso>] [--root <dir>]
//   node scripts/analytics/evaluate-policy.mjs --apply     # write the diff for a PR
//
// Without --apply this script never touches strategy/topic-selection-policy.json.
// With --apply it writes the proposed change into the policy so the PR carries a
// real diff -- a proposal a human "approves" that changes nothing is worse than
// no gate at all. The gate is still the human merge, not this script.
//
// Every judgement here obeys one rule: a small sample must not decide anything.
// Zenn likes are zero-inflated and heavy-tailed (market median 0, ~6% reach five
// likes), so a batch of a dozen articles carries no significance, and a single
// hit is as likely to be luck as skill.
//
// Exit codes:
//   0  evaluated; a proposal may or may not have been written
//   3  not enough matured observations yet (nothing to judge)
//   2  misconfiguration

import fs from "node:fs";
import path from "node:path";

import {
  COHORT_MIN,
  dayStamp,
  fail,
  isMaturedBasis,
  parseArgs,
  parseInstant,
  readJson,
  readLedger,
} from "./zenn-metrics-lib.mjs";

const { options } = parseArgs(process.argv.slice(2));
const root = path.resolve(options.root || process.cwd());
const now = options.now ? parseInstant(options.now, "--now") : new Date();
const stamp = dayStamp(now);
const apply = options.apply === true;

const policyPath = path.resolve(root, options.policy || "strategy/topic-selection-policy.json");
const ledgerPath = path.resolve(root, options.ledger || "analytics/article-ledger.jsonl");
const proposalsDir = path.resolve(root, options["proposals-dir"] || "strategy/proposals");
const decisionLogPath = path.resolve(root, options["decision-log"] || "strategy/decision-log.md");

const policy = readJson(policyPath, "policy");
if (policy.version !== 1) fail("policy version must be 1");
const experimentId = options.experiment || policy.activeExperiment;
if (!experimentId) fail("no active experiment in policy and --experiment not given");

const experimentPath = path.resolve(root, `experiments/${experimentId}.json`);
const experiment = readJson(experimentPath, `experiment ${experimentId}`);
const ledger = readLedger(ledgerPath);

// --------------------------------------------------------------------- groups

const isPublished = (entry) => Boolean(entry.publishedAt);
const d30 = (entry) => entry.observations?.d30 ?? null;
// Both in-slot bases count as matured. The previous suffix test excluded
// `measured-on-time` -- the cleanest observations were the ones being dropped.
const isMatured = (entry) => isMaturedBasis(d30(entry)?.basis);

const control = ledger.filter((entry) => entry.classification?.arm === "historical-control");
const assigned = ledger.filter((entry) => (
  entry.classification?.experimentId === experimentId
  && entry.classification?.arm === experiment.design?.treatment?.arm
));
const published = assigned.filter(isPublished);
const matured = published.filter(isMatured);
const targetN = experiment.design?.treatment?.n ?? 12;

/**
 * Percentile frozen at the article's own D30 observation. The rolling
 * `entry.relative` map is report-only: reading it here would compare a 3-day-old
 * article's standing to a 40-day-old one's.
 */
const d30Percentile = (entry, minCohort) => {
  const relative = d30(entry)?.relative;
  if (!relative || typeof relative.percentile !== "number") return null;
  if (relative.cohortSize < minCohort) return null;
  return relative.percentile;
};

const percentilesOf = (entries, minCohort) => entries
  .map((entry) => d30Percentile(entry, minCohort))
  .filter((value) => value !== null)
  .sort((a, b) => a - b);

const likesOf = (entries) => entries
  .map((entry) => d30(entry)?.likes)
  .filter((value) => typeof value === "number");

const share = (values, predicate) => (
  values.length === 0 ? null : values.filter(predicate).length / values.length
);
const median = (sorted) => (sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : null);

const controlLikes = likesOf(control);
const controlZeroShare = share(controlLikes, (value) => value === 0);
const treatmentLikes = likesOf(matured);
const treatmentZeroShare = share(treatmentLikes, (value) => value === 0);

// Nearly all control articles predate collection and have no D30 percentile
// (`basis: current-upper-bound`, `relative: null`); only the handful that were
// 30-45 days old when collection started carry a real one. Far too few to serve
// as the control value, so the treatment's percentile is compared against the
// market itself -- which is what a percentile already means.
const controlPercentiles = percentilesOf(control, COHORT_MIN.display);
const treatmentPercentiles = percentilesOf(matured, COHORT_MIN.decision);
const treatmentMedianPercentile = median(treatmentPercentiles);
const treatmentTop25 = share(treatmentPercentiles, (value) => value >= 75);

// --------------------------------------------------------------------- verdict

const CATASTROPHIC_N = 6;
const STOP_ZERO_DELTA = 0.2;

let verdict;
let rationale;

const catastrophic = treatmentLikes.length >= CATASTROPHIC_N
  && treatmentLikes.slice(0, CATASTROPHIC_N).every((value) => value === 0)
  && treatmentZeroShare === 1;

const zeroRateWorse = treatmentZeroShare !== null
  && controlZeroShare !== null
  && treatmentZeroShare - controlZeroShare >= STOP_ZERO_DELTA;
// A blown-out zero rate alone is within the noise of a dozen articles, so a
// regression also has to show up in the market-relative standing.
const percentileWorse = treatmentMedianPercentile !== null && treatmentMedianPercentile < 50;
const stopRuleTriggered = treatmentLikes.length >= targetN && zeroRateWorse && percentileWorse;

if (catastrophic) {
  verdict = "regress";
  rationale = `最初の ${CATASTROPHIC_N} 本すべてが0いいねで、B群 ${treatmentLikes.length} 本に非ゼロが1本も無い（破局条件）。`;
} else if (stopRuleTriggered) {
  verdict = "regress";
  rationale = `B群の0いいね率 ${(treatmentZeroShare * 100).toFixed(0)}% が対照群 ${(controlZeroShare * 100).toFixed(0)}% を20ポイント以上悪化させ、かつD30の市場順位中央値 ${treatmentMedianPercentile.toFixed(1)} が50を下回った。`;
} else if (matured.length < targetN) {
  verdict = "insufficient";
  rationale = `D30を実測できたB群は ${matured.length} / ${targetN} 本（公開済み ${published.length} / 割り付け ${assigned.length}）。判定にはまだ足りない。`;
} else if (treatmentMedianPercentile === null) {
  verdict = "hold";
  rationale = `D30到達は ${matured.length} 本あるが、順位を出せる市場コホート（n>=${COHORT_MIN.decision}）がそろっていない。日次収集を続ける。`;
} else if (treatmentMedianPercentile >= 50) {
  verdict = "continue";
  rationale = `B群のD30市場順位中央値 ${treatmentMedianPercentile.toFixed(1)} が市場中央値以上。方針続行（昇格ではない）。`;
} else {
  verdict = "hold";
  rationale = `B群の順位中央値 ${treatmentMedianPercentile.toFixed(1)} が市場中央値を下回った。ただし十数本では有意差は出ないため棄却せず判定保留。次バッチで確認する。`;
}

// ------------------------------------------------------- archetype promotions

/** Only published, D30-measured articles ranked against a large cohort count. */
const evidence = (entries) => entries.filter((entry) => (
  isPublished(entry) && isMatured(entry) && d30Percentile(entry, COHORT_MIN.promotion) !== null
));

const byArchetype = new Map();
for (const entry of ledger) {
  if (entry.classification?.source !== "contract") continue;
  const id = entry.classification.valueArchetype;
  if (!byArchetype.has(id)) byArchetype.set(id, []);
  byArchetype.get(id).push(entry);
}

const promotions = [];
for (const [archetype, entries] of byArchetype) {
  const stage = policy.valueArchetypes?.find((item) => item.id === archetype)?.stage;
  if (stage !== "provisional") continue;

  const usable = evidence(entries);
  const top10 = usable.filter((entry) => d30Percentile(entry, COHORT_MIN.promotion) >= 90);
  // "Different batches" means different registration batches, not different
  // experiment ids: a single experiment can span several.
  const batches = new Set(top10.map((entry) => (
    entry.classification.batchId ?? entry.classification.experimentId ?? "unbatched"
  )));
  const top25Share = share(
    usable.map((entry) => d30Percentile(entry, COHORT_MIN.promotion)),
    (value) => value >= 75,
  );

  const conditions = {
    twoBatchesWithTop10: batches.size >= 2,
    // No control percentile exists, so the bar is the market's own top quartile
    // rate: by construction 25% of the cohort is in it.
    top25AtLeastMarketRate: top25Share !== null && top25Share >= 0.25,
    atLeast24MaturedArticles: usable.length >= 24,
  };
  if (Object.values(conditions).every(Boolean)) {
    promotions.push({
      archetype, from: stage, to: "preferred", conditions, n: usable.length, top10: top10.length,
    });
  }
}

// --------------------------------------------------------------- proposal file

const needsProposal = verdict === "regress" || promotions.length > 0;
const pct = (value) => (value === null || value === undefined ? "—" : `${(value * 100).toFixed(0)}%`);
const num = (value, digits = 1) => (value === null || value === undefined ? "—" : value.toFixed(digits));

const report = [];
report.push(`# 方針提案 ${stamp} (${experimentId})`);
report.push("");
report.push("> `scripts/analytics/evaluate-policy.mjs` が生成。");
report.push(apply
  ? "> `--apply` 付きで実行したため、同じブランチ上の `strategy/topic-selection-policy.json` に提案差分を適用済み。**PRのマージが承認**。"
  : "> **この提案は方針ではない。** policy は変更していない。適用するには `--apply` 付きで実行してPRを作る。");
report.push("");
report.push("## 判定");
report.push("");
report.push(`- verdict: **${verdict}**`);
report.push(`- 根拠: ${rationale}`);
report.push(`- 参照 policyVersion: ${policy.policyVersion}`);
report.push("");
report.push("## 観測");
report.push("");
report.push("| 群 | 割り付け | 公開済 | D30実測 | 平均いいね | 0いいね率 | 5+到達率 | 順位算出済 | D30順位中央値 | 上位25% |");
report.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
report.push(`| A-historical（対照） | ${control.length} | ${control.filter(isPublished).length} | ${control.filter(isMatured).length} | ${num(controlLikes.length ? controlLikes.reduce((sum, value) => sum + value, 0) / controlLikes.length : null, 2)} | ${pct(controlZeroShare)} | ${pct(share(controlLikes, (value) => value >= 5))} | ${controlPercentiles.length} | ${num(median(controlPercentiles))} | ${pct(share(controlPercentiles, (value) => value >= 75))} |`);
report.push(`| B-${experiment.design?.treatment?.arm ?? "treatment"} | ${assigned.length} | ${published.length} | ${matured.length} | ${num(treatmentLikes.length ? treatmentLikes.reduce((sum, value) => sum + value, 0) / treatmentLikes.length : null, 2)} | ${pct(treatmentZeroShare)} | ${pct(share(treatmentLikes, (value) => value >= 5))} | ${treatmentPercentiles.length} | ${num(treatmentMedianPercentile)} | ${pct(treatmentTop25)} |`);
report.push("");
report.push("対照群の `順位算出済` は、収集開始時にちょうど公開30〜45日だった数本だけ。それ以前の記事は");
report.push("D30時点の市場コホートが存在せず順位を復元できない（`basis: current-upper-bound` / `relative: null`）。");
report.push("よってこの列は参考値であり、判定には使っていない。B群の順位は対照群ではなく");
report.push("**市場そのもの**（中央値50）と比較している（パーセンタイルとはそういう指標）。");
report.push("");
report.push(`> ${experiment.statisticalNote ?? ""}`);
report.push("");

report.push("## 提案する変更");
report.push("");
if (promotions.length > 0) {
  for (const promotion of promotions) {
    report.push(`### ${promotion.archetype}: ${promotion.from} → ${promotion.to}`);
    report.push("");
    report.push(`根拠: D30実測かつ市場コホート n>=${COHORT_MIN.promotion} で順位が出た記事 ${promotion.n} 本、うち上位10%が ${promotion.top10} 本。`);
    report.push("");
    report.push("| 昇格条件 | 充足 |");
    report.push("|---|---|");
    for (const [name, met] of Object.entries(promotion.conditions)) {
      report.push(`| ${name} | ${met ? "✅" : "❌"} |`);
    }
    report.push("");
  }
}
if (verdict === "regress") {
  report.push("### 実験の停止");
  report.push("");
  report.push(`劣化検知に触れたため、\`experiments/${experimentId}.json\` の \`status\` を \`stopped\` にし、`);
  report.push("価値型の割り当てを見直す提案。どの価値型で0いいねが増えたかを");
  report.push("`analytics/topic-feedback.md` の 3.2 で確認してから方針を書き換えること。");
  report.push("");
}
if (!needsProposal) {
  report.push("_方針変更の提案はない。観測を続ける。_");
  report.push("");
  report.push(`- ${verdict === "insufficient" ? "D30実測本数が不足" : "劣化なし・昇格条件未達"}のため policy はそのまま。`);
  report.push("");
}

fs.mkdirSync(proposalsDir, { recursive: true });
const proposalPath = path.join(proposalsDir, `${stamp}-${experimentId}.md`);
fs.writeFileSync(proposalPath, `${report.join("\n")}\n`);

// ------------------------------------------------------------- apply the diff

let applied = [];
if (apply && needsProposal) {
  for (const promotion of promotions) {
    const target = policy.valueArchetypes.find((item) => item.id === promotion.archetype);
    target.stage = promotion.to;
    target.promotedAt = stamp;
    target.promotionEvidence = `${promotion.n} matured articles, ${promotion.top10} in market top 10% (${experimentId})`;
    applied.push(`valueArchetypes[${promotion.archetype}].stage: ${promotion.from} -> ${promotion.to}`);
  }
  if (verdict === "regress") {
    experiment.status = "stopped";
    experiment.stoppedAt = stamp;
    experiment.stopReason = rationale;
    fs.writeFileSync(experimentPath, `${JSON.stringify(experiment, null, 2)}\n`);
    applied.push(`experiments/${experimentId}.json status: active -> stopped`);
  }
  if (applied.length > 0) {
    policy.policyVersion = `${stamp}.1`;
    policy.updatedAt = stamp;
    fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
    applied.push(`policyVersion -> ${policy.policyVersion}`);
  }
}

// Appending to the decision log is allowed automatically: it records that an
// evaluation happened, which is auditable history rather than a rule change.
const logLine = `| ${stamp} | ${experimentId} | ${verdict} | ${promotions.length > 0 ? promotions.map((item) => `${item.archetype}→${item.to}`).join(", ") : (verdict === "regress" ? "実験停止" : "変更提案なし")} | ${apply && applied.length > 0 ? "適用済(PR待ち)" : "未適用"} | ${path.relative(root, proposalPath)} |`;
if (fs.existsSync(decisionLogPath)) {
  const current = fs.readFileSync(decisionLogPath, "utf8");
  if (!current.includes(logLine)) fs.appendFileSync(decisionLogPath, `${logLine}\n`);
}

console.log(`verdict: ${verdict}`);
console.log(rationale);
console.log(`proposal: ${path.relative(root, proposalPath)}`);
console.log(`policy change proposed: ${needsProposal ? "yes" : "no"}`);
if (applied.length > 0) {
  console.log("applied to the working tree (still needs a human merge):");
  applied.forEach((line) => console.log(`  - ${line}`));
} else if (needsProposal && !apply) {
  console.log("re-run with --apply to write the diff a PR can carry");
}
if (verdict === "insufficient") process.exit(3);
