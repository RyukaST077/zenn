#!/usr/bin/env node
//
// Render analytics/topic-feedback.md from the ledger and the market index.
//
//   node scripts/analytics/build-topic-feedback.mjs [--now <iso>] [--root <dir>]
//
// This file is OBSERVATION, not policy. search-topic reads it after the policy
// and may use it to pick between candidates, but a trend seen here never
// silently becomes a rule -- strategy/topic-selection-policy.json is only
// changed by a human-merged PR.

import path from "node:path";
import fs from "node:fs";

import {
  AGE_BRACKETS,
  COHORT_MIN,
  cohortLikes,
  cohortStats,
  emptyMarketIndex,
  fail,
  OBSERVATION_ARCHETYPES,
  guessValueArchetype,
  parseArgs,
  parseInstant,
  readJsonIfExists,
  readLedger,
} from "./zenn-metrics-lib.mjs";

const { options } = parseArgs(process.argv.slice(2));
const root = path.resolve(options.root || process.cwd());
const now = options.now ? parseInstant(options.now, "--now") : new Date();

const ledgerPath = path.resolve(root, options.ledger || "analytics/article-ledger.jsonl");
const marketIndexPath = path.resolve(root, options["market-index"] || "analytics/market-index.json");
const policyPath = path.resolve(root, options.policy || "strategy/topic-selection-policy.json");
const outPath = path.resolve(root, options.out || "analytics/topic-feedback.md");
// Git-ignored, and excluded from worktree sync. See collect-ga4-metrics.mjs.
const overlayPath = path.resolve(root, options.overlay || "analytics/private/ga4-ledger.jsonl");
const detailPath = path.resolve(root, options["ga4-detail"] || "analytics/private/ga4-detail.md");

const ledger = readLedger(ledgerPath);
if (ledger.length === 0) fail(`ledger is empty: ${path.relative(root, ledgerPath)}`);
const marketIndex = readJsonIfExists(marketIndexPath, emptyMarketIndex());
const policy = readJsonIfExists(policyPath, null);

const pct = (value) => (value === null || value === undefined ? "—" : `${(value * 100).toFixed(0)}%`);
const num = (value, digits = 2) => (
  value === null || value === undefined || Number.isNaN(value) ? "—" : value.toFixed(digits)
);

/** Sample-size honesty: say out loud what a cell is big enough to decide. */
const confidence = (n) => {
  if (n >= COHORT_MIN.promotion) return "昇格根拠に使える";
  if (n >= COHORT_MIN.decision) return "続行判断に使える";
  if (n >= COHORT_MIN.display) return "表示のみ";
  return "判定不可";
};

const lines = [];
const push = (line = "") => lines.push(line);

push("# トピック観測フィードバック（自動生成）");
push();
push("> このファイルは `scripts/analytics/build-topic-feedback.mjs` が生成する**観測結果**です。");
push("> 方針そのものではありません。正式な選定方針は `strategy/topic-selection-policy.json`（人間がPRでマージ）。");
push("> ここに出た傾向を方針に昇格させるには `scripts/analytics/evaluate-policy.mjs` が出す提案を経由します。");
push();
push(`- 生成時刻: ${now.toISOString()}`);
push(`- 参照した policyVersion: ${policy?.policyVersion ?? "(policy未読込)"}`);
push(`- 自分の記事: ${ledger.length} 本`);
push(`- 市場コホート最終更新: ${marketIndex.updatedAt ?? "(未収集)"}`);
push();

// -------------------------------------------------- 露出と内容の分離（GA4）

push("## 0. 露出と内容の分離（GA4）");
push();

// GA4 numbers live in a git-ignored overlay, not in the committed ledger: this
// repository is public and per-article traffic is not. Only bucketed aggregates
// are rendered below; the exact per-article table goes to analytics/private/.
const overlay = new Map(
  readLedger(overlayPath).map((record) => [record.slug, record]),
);
for (const entry of ledger) {
  const record = overlay.get(entry.slug);
  if (record) entry.ga4 = record;
}

const withReach = ledger.filter((entry) => entry.ga4?.windows?.d30?.basis === "measured");
const ga4Meta = ledger.find((entry) => entry.ga4)?.ga4 ?? null;

// Reference lines, fixed in advance rather than derived from the data. A median
// split cannot answer "is reach low?": half the articles land above the median
// even if every single one got three views. These are absolute and arguable --
// 100 arrivals in 30 days, and one like per 100 arrivals -- but they are stated,
// so a reader can disagree with a number instead of with a moving target.
const REACH_LINE = 100;
const RATE_LINE = 0.01;

const REACH_BANDS = [
  { label: "0", min: 0, max: 0 },
  { label: "1-9", min: 1, max: 9 },
  { label: "10-29", min: 10, max: 29 },
  { label: "30-99", min: 30, max: 99 },
  { label: "100-299", min: 100, max: 299 },
  { label: "300+", min: 300, max: Infinity },
];
const bandOf = (views) => REACH_BANDS.find((band) => views >= band.min && views <= band.max)?.label ?? "?";

if (!ga4Meta) {
  push("_GA4未接続。`node scripts/analytics/fetch-ga4-metrics.mjs --probe` で疎通を確認してから_");
  push("_`fetch-ga4-metrics.mjs` → `collect-ga4-metrics.mjs` を実行すると、この節が埋まります。_");
  push();
  push("接続するまでは「いいね0が、到達されなかったのか・読まれて刺さらなかったのか」を区別できません。");
  push("その状態では、テーマ選定を直しても原因を外している可能性が残ります。");
} else if (withReach.length === 0) {
  // property ID はこの公開レポートに出さない。private 側の詳細レポートにある。
  push("_GA4は接続済みだが、D30を実測できた記事がまだ0本。_");
  push();
  push("D30窓が計測範囲に収まっていない記事は復元できません。理由は3つに分かれます。");
  push();
  push("| basis | 意味 |");
  push("|---|---|");
  push("| `outside-tracking-coverage` | GAタグ導入前、または保持期間より前。行が0件でも「0PV」ではなく**不明** |");
  push("| `window-not-closed` | D30窓がまだ閉じていない（処理途中の直近数日を含む） |");
  push("| `report-data-loss` | GA4が行を `(other)` に丸めた、または閾値で伏せた。合計が不完全なので実測扱いにしない |");
  push();
  push(`計測範囲: ${ga4Meta.coverage?.from ?? "?"} .. ${ga4Meta.coverage?.to ?? "?"}`);
  push(`（タグ開始 ${ga4Meta.coverage?.trackingStartDate ?? "不明"} / ${ga4Meta.coverage?.trackingStartSource ?? "不明"}）`);
} else {
  const reachOf = (entry) => entry.ga4.windows.d30.views;
  const obsOf = (entry) => entry.ga4.observations?.d30 ?? null;
  const rateOf = (entry) => obsOf(entry)?.likeRate ?? null;

  const rated = withReach.filter((entry) => rateOf(entry) !== null);
  const notAligned = withReach.filter((entry) => (
    String(obsOf(entry)?.likeRateBasis ?? "").startsWith("numerator-not-aligned")
  ));
  const tooFewViews = withReach.filter((entry) => (
    String(obsOf(entry)?.likeRateBasis ?? "").startsWith("too-few-views")
  ));

  push(`- 対象: D30の到達を実測できた **${withReach.length} 本**（GA4 / TZ ${ga4Meta.timeZone ?? "不明"}）`);
  push(`- 計測範囲: ${ga4Meta.coverage?.from ?? "?"} .. ${ga4Meta.coverage?.to ?? "?"}（タグ開始 ${ga4Meta.coverage?.trackingStartDate ?? "不明"} / ${ga4Meta.coverage?.trackingStartSource ?? "不明"}）`);
  push(`- D30いいね率を出せた本数: **${rated.length} 本**`);
  push(`  - 分子が窓とずれていて出せない: ${notAligned.length} 本（\`current-upper-bound\` 等。現在の累積いいねを30日PVで割ると率が跳ね上がるため出さない）`);
  push(`  - PV${30}未満で出せない: ${tooFewViews.length} 本`);
  push();
  push("> **GA4のPVは「ページ到達」です。**「露出」や「インプレッション」ではありません。");
  push("> 到達が低い原因はテーマだけでなく、タイトル・Zenn内での表示・検索順位・公開時刻を含みます。");
  push("> このリポジトリは公開なので、ここには帯（バンド）と本数だけを出します。");
  push("> 記事ごとの実数は `analytics/private/ga4-detail.md`（git管理外）にあります。");
  push();
  push("### 0.1 D30到達の分布");
  push();
  push("| D30到達（PV） | 本数 | 比率 |");
  push("|---|---:|---:|");
  for (const band of REACH_BANDS) {
    const n = withReach.filter((entry) => bandOf(reachOf(entry)) === band.label).length;
    if (n === 0) continue;
    push(`| ${band.label} | ${n} | ${((n / withReach.length) * 100).toFixed(0)}% |`);
  }
  push();
  const belowLine = withReach.filter((entry) => reachOf(entry) < REACH_LINE).length;
  push(`基準線 **${REACH_LINE}PV/30日** を下回るのが ${belowLine} / ${withReach.length} 本（${((belowLine / withReach.length) * 100).toFixed(0)}%）。`);
  push("この基準線はデータから決めたものではなく、事前に置いた参照値です。中央値で二分すると");
  push("「全記事の到達が極端に低い」場合でも必ず半数が「到達 高」に入ってしまうため、絶対値で切っています。");
  push();
  push("### 0.2 どちらが原因か（2×2）");
  push();

  if (rated.length === 0) {
    push(`**いま2×2は作れません。** いいね率を出せた記事が0本です（分子ずれ ${notAligned.length} 本 / PV不足 ${tooFewViews.length} 本）。`);
    push();
    push("読めるのは到達だけです。0.1の分布が「到達そのものが足りない」ことを示していれば、");
    push("本文側の判断材料はまだ無いということです。反応率は、これから公開する記事の");
    push("D30を `measured-on-time` で取れた時点で初めて出ます。");
  } else {
    push(`基準線: 到達 **${REACH_LINE}PV** / いいね率 **${(RATE_LINE * 100).toFixed(1)}%**（いずれも事前設定）。対象は率を出せた ${rated.length} 本のみ。`);
    push();
    const quadrant = (highReach, highRate) => rated.filter((entry) => (
      (reachOf(entry) >= REACH_LINE) === highReach && (rateOf(entry) >= RATE_LINE) === highRate
    ));
    push("| | いいね率 高 | いいね率 低 |");
    push("|---|---:|---:|");
    push(`| **到達 高** | ${quadrant(true, true).length} 本 | ${quadrant(true, false).length} 本 |`);
    push(`| **到達 低** | ${quadrant(false, true).length} 本 | ${quadrant(false, false).length} 本 |`);
    push();
    push("読み方（いずれも**示唆**であって確定ではない）:");
    push();
    push("- **到達 低 × いいね率 高** → テーマは刺さっている可能性。到達側（タイトル・トピック・公開時刻）を疑う。");
    push("- **到達 高 × いいね率 低** → 人は来ている。本文の構成と持ち帰り（takeaway）を疑う。");
    push("  ただしこれは「価値型の切り替えが正しい」根拠にはならない。撤回条件は `experiments/EXP-GA4-DIAG-001.json` に事前登録済み。");
    push("- **到達 低 × いいね率 低** → 到達と反応の両方。複合原因として扱う。");
    push();
    push(`> PVが${30}未満の ${tooFewViews.length} 本は率を出せないので上表から除いてあります。`);
    push("> これは**表示上の下限**であって、「到達していない」の判定線ではありません（29PVは到達しています）。");
  }
  push();
  push("### 0.3 流入経路");
  push();
  const bySource = new Map();
  for (const entry of withReach) {
    for (const [source, sessions] of Object.entries(entry.ga4.sourceMediumWholeRange ?? {})) {
      bySource.set(source, (bySource.get(source) ?? 0) + sessions);
    }
  }
  if (bySource.size === 0) {
    push("_流入経路のデータがありません。_");
  } else {
    const total = [...bySource.values()].reduce((sum, value) => sum + value, 0);
    push(`集計期間は取得範囲全体（${ga4Meta.sourceMediumRange?.from ?? "?"} .. ${ga4Meta.sourceMediumRange?.to ?? "?"}）です。`);
    push("流入元レポートには日付の軸が無いため、**D7/D30の窓では切れません**。実数ではなく比率のみ出します。");
    push();
    push("| 流入元 | 比率 |");
    push("|---|---:|");
    for (const [source, sessions] of [...bySource.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
      push(`| ${source} | ${((sessions / total) * 100).toFixed(0)}% |`);
    }
    push();
    push("検索流入（`google / organic` 等）の比率は、policy の需要（demand 30点）が正しく効いているかの直接の証拠。");
    push("Zenn内フィードからの流入しか無いなら、検索需要のあるテーマを取れていないということ。");
  }
}
push();

// ---------------------------------------------------------------- 市場の勝ち型

push("## 1. 市場の勝ち型（改善ループの主駆動輪）");
push();
push("Zenn全体の上位記事（`order=liked_count`）に、どの価値型が濃縮しているか。");
push("自分の記事は最大3いいねで信号が無いため、**仮説はここから取る**。");
push();

const topCell = marketIndex.cohorts?._top ?? {};
const topArticles = Object.values(topCell)
  .flatMap((cell) => Object.values(cell.observations ?? {}))
  .sort((a, b) => b.likes - a.likes);

if (topArticles.length === 0) {
  push("_市場データ未収集。`bash scripts/analytics/fetch-zenn-metrics.sh` を実行してください。_");
} else {
  const byArchetype = new Map();
  for (const article of topArticles) {
    const archetype = guessValueArchetype(article.title ?? "");
    const bucket = byArchetype.get(archetype) ?? { n: 0, likes: 0, max: 0, samples: [] };
    bucket.n += 1;
    bucket.likes += article.likes;
    bucket.max = Math.max(bucket.max, article.likes);
    bucket.samples.push(article);
    byArchetype.set(archetype, bucket);
  }
  const stageOf = (id) => {
    const stage = policy?.valueArchetypes?.find((entry) => entry.id === id)?.stage;
    if (stage) return stage;
    // comparison / intro-try / news are real market categories the policy has
    // no stance on. Saying "(未登録)" made them look like a classifier bug.
    if (OBSERVATION_ARCHETYPES.includes(id)) return "観測専用（policy対象外）";
    return "—";
  };

  push(`観測母数: 上位記事 ${topArticles.length} 本（信頼度: ${confidence(topArticles.length)}）`);
  push();
  push("| 価値型 | policy stage | 本数 | 平均いいね | 最大 | 代表例 |");
  push("|---|---|---:|---:|---:|---|");
  for (const [archetype, bucket] of [...byArchetype.entries()].sort((a, b) => b[1].likes / b[1].n - a[1].likes / a[1].n)) {
    const best = bucket.samples.sort((a, b) => b.likes - a.likes)[0];
    const title = (best.title ?? "").slice(0, 40);
    push(`| ${archetype} | ${stageOf(archetype)} | ${bucket.n} | ${num(bucket.likes / bucket.n, 1)} | ${bucket.max} | ${title} |`);
  }
  push();
  push("> 価値型のラベルはタイトルからの正規表現による推定です（`guessValueArchetype`）。");
push("> `fixtures/archetype-labels.json` の手分類60本に対する実測は **正解80% / 誤判定0% / 判定不能20%**。");
push("> 判定不能を誤って埋めないことを優先しているので、`unclassified` は「どの型でもない」ではなく");
push("> 「タイトルだけでは決められない」の意味です。下の生リストで読み直してください。");
push("> `観測専用（policy対象外）` の型は市場に実在するカテゴリですが、policy が扱いを決めていません。");
  push("> 取りこぼし（`unclassified`）が出るので、集計だけを信用せず**次の生データを自分で読んで分類し直すこと**。");
  push();
  push("### 上位記事の生データ（分類は読み手が判断する）");
  push();
  push("| いいね | 推定型 | タイトル |");
  push("|---:|---|---|");
  for (const article of topArticles.slice(0, 25)) {
    const title = (article.title ?? "").replace(/\|/g, "\\|");
    push(`| ${article.likes} | ${guessValueArchetype(article.title ?? "")} | ${title} |`);
  }
}
push();

// -------------------------------------------------------------- 市場ベースライン

push("## 2. 市場ベースライン（相対順位の分母）");
push();
push("トピック × 記事年齢ごとの、他者記事のいいね分布。自分の記事の順位はこの分布に対して計算する。");
push();
push("| トピック | 年齢 | n | 信頼度 | 0いいね率 | p50 | p75 | p90 | 5+到達率 |");
push("|---|---|---:|---|---:|---:|---:|---:|---:|");
const watchTopics = policy?.marketWatch?.topics ?? Object.keys(marketIndex.cohorts ?? {}).filter((t) => t !== "_top");
for (const topic of watchTopics) {
  for (const bracket of AGE_BRACKETS) {
    const likes = cohortLikes(marketIndex, topic, bracket);
    const stats = cohortStats(likes);
    if (!stats) continue;
    push(`| ${topic} | ${bracket} | ${stats.n} | ${confidence(stats.n)} | ${pct(stats.zeroShare)} | ${stats.p50} | ${stats.p75} | ${stats.p90} | ${pct(stats.hitShare)} |`);
  }
}
push();
push();
push("### primaryTopic に選べるトピック（D30を測れるか）");
push();
push("`d30-45` コホートが育っていないトピックは、記事を出しても**D30の市場順位が計算できない**。");
push("search-topic は契約の `primaryTopic` を、下表で「続行判断に使える」以上のトピックから選ぶ。");
push();
push("| トピック | d30-45 の n | 測れるもの |");
push("|---|---:|---|");
for (const topic of watchTopics) {
  const n = cohortLikes(marketIndex, topic, "d30-45").length;
  const verdict = n >= COHORT_MIN.promotion ? "昇格根拠まで測れる"
    : n >= COHORT_MIN.decision ? "続行判断まで測れる"
    : n >= COHORT_MIN.display ? "表示のみ（判断に使えない）"
    : "**D30を測れない — primaryTopic に選ばない**";
  push(`| ${topic} | ${n} | ${verdict} |`);
}
push();
push("> n が伸びないトピックは、記事の流量が多すぎて `--deep` スイープの上限（既定30ページ）でも");
push("> 46日前まで遡れないことが原因。そういうトピックは読者母数が大きい代わりに記事が埋もれるので、");
push("> より具体的なトピックを `primaryTopic` にするのが妥当（`ai` より `claudecode` など）。");
push();
push("> `d30-45` の行は `bash scripts/analytics/fetch-zenn-metrics.sh --deep` でしか埋まりません。");
push("> 最新ページだけを取る日次収集では、記事は7日・30日になる前にページから流れて消えます。");
push();

// ------------------------------------------------------------------ 自分の実績

push("## 3. 自分の実績（劣化検知と適用失敗の早期発見）");
push();

const observationOf = (entry) => entry.observations?.d30 ?? entry.observations?.latest ?? null;
const summarize = (entries) => {
  const observed = entries.map(observationOf).filter(Boolean);
  if (observed.length === 0) return null;
  const likes = observed.map((observation) => observation.likes);
  // Only the percentile frozen at the article's own D30 observation counts. The
  // rolling `entry.relative` map holds whatever age the article is today, so
  // averaging it would mix a 3-day-old standing with a 40-day-old one.
  const tiers = entries
    .map((entry) => entry.observations?.d30?.relative)
    .filter((relative) => relative && typeof relative.percentile === "number");
  const percentiles = tiers.map((tier) => tier.percentile).sort((a, b) => a - b);
  return {
    n: entries.length,
    mean: likes.reduce((sum, value) => sum + value, 0) / likes.length,
    zeroShare: likes.filter((value) => value === 0).length / likes.length,
    hitShare: likes.filter((value) => value >= 5).length / likes.length,
    max: Math.max(...likes),
    medianPercentile: percentiles.length ? percentiles[Math.floor((percentiles.length - 1) / 2)] : null,
    top25Share: tiers.length ? tiers.filter((tier) => tier.percentile >= 75).length / tiers.length : null,
    top10Share: tiers.length ? tiers.filter((tier) => tier.percentile >= 90).length / tiers.length : null,
    ranked: tiers.length,
  };
};

const control = ledger.filter((entry) => entry.classification?.arm === "historical-control");
const treatment = ledger.filter((entry) => entry.classification?.arm && entry.classification.arm !== "historical-control");

push("### 3.1 歴史的対照群 vs 新方針");
push();
push("| 群 | n | 平均いいね | 0いいね率 | 5+到達率 | 最大 | 順位算出済n | 市場順位中央値 | 上位25% | 上位10% |");
push("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
for (const [label, entries] of [["A-historical（対照）", control], ["B-新方針", treatment]]) {
  const stats = summarize(entries);
  if (!stats) {
    push(`| ${label} | ${entries.length} | — | — | — | — | 0 | — | — | — |`);
    continue;
  }
  push(`| ${label} | ${stats.n} | ${num(stats.mean)} | ${pct(stats.zeroShare)} | ${pct(stats.hitShare)} | ${stats.max} | ${stats.ranked} | ${num(stats.medianPercentile, 1)} | ${pct(stats.top25Share)} | ${pct(stats.top10Share)} |`);
}
push();
push("> `順位算出済n` は **D30観測に凍結された順位を持つ記事の数**。D30を実測できていない記事や、");
push("> 年齢を揃えた市場コホートが20本未満だった記事は数に入りません。");
push("> 対照群の大半はこの数に入りません。ループ導入前に公開され、D30を過ぎてから初めて観測したため");
push("> 順位を復元できない（`basis: current-upper-bound` / `relative: null`）。入っているのは、");
push("> 収集開始時にちょうど公開30〜45日だった数本だけです。この少数を対照値として使わないこと。");
push("> B群の順位は対照群ではなく**市場そのもの**（中央値50）と比べます。");
push("> 平均いいねは**劣化検知のみ**に使います。裾が重い分布では1本の当たりが平均を支配するため、");
push("> 平均の増減で方針を昇格・棄却しないこと（`strategy/topic-selection-policy.json` の metrics 参照）。");
push();

push("### 3.2 価値型別");
push();
push("| 価値型 | 登録元 | n | 平均 | 0いいね率 | 最大 | 順位算出済n | 市場順位中央値 |");
push("|---|---|---:|---:|---:|---:|---:|---:|");
const archetypeGroups = new Map();
for (const entry of ledger) {
  const key = `${entry.classification?.valueArchetype ?? "unclassified"} ${entry.classification?.source ?? "?"}`;
  if (!archetypeGroups.has(key)) archetypeGroups.set(key, []);
  archetypeGroups.get(key).push(entry);
}
for (const [key, entries] of [...archetypeGroups.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const [archetype, source] = key.split(" ");
  const stats = summarize(entries);
  if (!stats) continue;
  push(`| ${archetype} | ${source} | ${stats.n} | ${num(stats.mean)} | ${pct(stats.zeroShare)} | ${stats.max} | ${stats.ranked} | ${num(stats.medianPercentile, 1)} |`);
}
push();
push("> `登録元: heuristic` はループ導入前の記事をタイトルから後付け分類したものです。");
push("> 事前登録（`contract`）より弱い証拠として扱い、これだけで方針を変えないこと。");
push();

// ---------------------------------------------------------------------- 実験

push("## 4. 実施中の実験");
push();
const experimentId = policy?.activeExperiment;
const experimentPath = experimentId ? path.resolve(root, `experiments/${experimentId}.json`) : null;
const experiment = experimentPath && fs.existsSync(experimentPath) ? readJsonIfExists(experimentPath, null) : null;
if (!experiment) {
  push("_実施中の実験はありません。_");
} else {
  const assigned = ledger.filter((entry) => entry.classification?.experimentId === experiment.id);
  const matured = assigned.filter((entry) => entry.observations?.d30?.basis === "measured");
  push(`- ${experiment.id}: ${experiment.title}`);
  push(`- 仮説: ${experiment.hypothesis}`);
  push(`- 割り付け済み: ${assigned.length} / ${experiment.design?.treatment?.n ?? "?"} 本`);
  push(`- D30到達: ${matured.length} 本（判定には ${experiment.design?.treatment?.n ?? "?"} 本のD30が必要）`);
  push();
  push(`> ${experiment.statisticalNote ?? ""}`);
}
push();

// ------------------------------------------------------------- 言えないこと

push("## 5. このデータで言えないこと");
push();
push("- **露出と内容の分離**: GA4を接続していれば節0で分離できる。未接続・保持期間外の記事については");
push("  「表示されなかった」のか「読まれて刺さらなかった」のか区別できない。");
push("- **他者のPV**: 自分のGA4は自分の記事しか見えない。市場のいいね率は測れないので、");
push("  いいね率の良し悪しは自分の記事間の相対比較でしか判断できない。");
push("- **1本の当たり/外れ**: 市場の5いいね以上到達率は数%。1本hitが出ても勝ち型の証拠にはならず、");
push("  0本でも失敗の証拠にはならない。hitは追試候補を示す発見シグナルとしてのみ扱う。");
push("- **有意差**: 十数本のバッチで統計的有意差は出ない。方針変更は複数バッチの一貫した向きで判断する。");
push("- **収集開始前のD30**: ループ導入前の記事はD30時点の値が復元できない。現在値を保守的な上限として");
push("  扱っており、対照群に有利な向きに歪んでいる。");
push();

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${lines.join("\n")}\n`);
console.log(`wrote ${path.relative(root, outPath)} (${ledger.length} articles, ${topArticles.length} market winners)`);

// ------------------------------------------------- private per-article detail
// The exact numbers the committed report deliberately withholds. Git-ignored and
// excluded from worktree sync, so it never reaches a PR.
if (withReach.length > 0) {
  const detail = [];
  detail.push("# GA4 記事別詳細（非公開 / git管理外）");
  detail.push("");
  detail.push(`生成: ${now.toISOString()}`);
  detail.push("");
  detail.push("公開リポジトリに実数を出さないため、`analytics/topic-feedback.md` は帯でしか出していません。");
  detail.push("こちらが実数です。**コミットしないでください。**");
  detail.push("");
  detail.push("| slug | 価値型 | D30 PV | user-days | 秒/PV | いいね | いいね率 | 率のbasis |");
  detail.push("|---|---|---:|---:|---:|---:|---:|---|");
  for (const entry of [...withReach].sort((a, b) => b.ga4.windows.d30.views - a.ga4.windows.d30.views)) {
    const window = entry.ga4.windows.d30;
    const observation = entry.ga4.observations?.d30 ?? null;
    const rate = observation?.likeRate;
    detail.push([
      "",
      entry.slug,
      entry.classification?.valueArchetype ?? "—",
      window.views,
      window.userDays,
      window.engagementSecondsPerView ?? "—",
      observation?.numerator?.likes ?? "—",
      rate === null || rate === undefined ? "—" : `${(rate * 100).toFixed(2)}%`,
      observation?.likeRateBasis ?? "—",
      "",
    ].join(" | ").trim());
  }
  detail.push("");
  detail.push("`user-days` は日別 `totalUsers` の合計です。同じ人が複数日訪れると重複するため、");
  detail.push("ユニークユーザー数ではありません。");
  fs.mkdirSync(path.dirname(detailPath), { recursive: true });
  fs.writeFileSync(detailPath, `${detail.join("\n")}\n`);
  console.log(`wrote ${path.relative(root, detailPath)} (${withReach.length} articles, git-ignored)`);
}
