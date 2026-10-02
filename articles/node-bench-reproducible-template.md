---
title: "Node.js標準だけで再実行できるnode:bench計測テンプレート"
emoji: "⏱️"
type: "tech"
topics: ["nodejs", "javascript", "performance", "benchmark", "cli"]
published: false
---

小さな性能改善PRで困るのは、1回だけ速い値を出すことより、レビュー時に同じ条件で測り直せる形を残すことです。`performance.now()` で処理を1回囲むだけでは、ウォームアップ、計測外に出すべき準備処理、プロセス間の状態、外れ値を確認できません。

そこで、Node.js標準の実験的な `node:bench` だけを使い、次をまとめた依存ゼロの計測キットを作って再実行しました。

- 計測対象を差し替える `benchmark.mjs`
- 人が読むspec出力と、機械処理するJSONL
- raw samplesからCV（変動係数）と歪度を出す解析スクリプト
- process isolationの境界を確認するfixture
- 別ディレクトリへコピーしても通る再実行手順

検証はchecksum確認済みのNode.js v26.10.0、Darwin arm64、Codex `workspace-write` sandboxで行いました。追加パッケージ、サーバー、ブラウザ、認証、課金APIは使っていません。CPU名はsandbox内で取得できなかったため、この記事でも主張しません。

:::message alert
`node:bench` はNode.js 26.9.0で追加されたStability 1.0（Early Development）のAPIです。この記事はv26.10.0で確認した結果であり、将来のCLIやAPI互換性を保証するものではありません。[公式ドキュメント](https://nodejs.org/api/bench.html)と[Node.js 26.9.0のリリースノート](https://nodejs.org/en/blog/release/v26.9.0/)を、利用するバージョンに合わせて確認してください。
:::

## 先に結論

小さな性能改善PRに `node:bench` を添えるなら、最低限、次の5点をセットにすると再実行しやすくなります。

1. 比較する各実装を、独立に書いた期待値に対してベンチ登録前にassertする
2. setupを計測区間の外へ出し、warmupと複数operationsを固定する
3. specの要約だけでなくJSONLのraw samplesも保存する
4. 原則としてprocess isolationを保ち、外す場合は状態持ち越しを確認する
5. 別ディレクトリで再実行し、絶対パス依存がないことを確かめる

今回のテンプレートは、この5点をすべて通しました。一方、rateの大小は実行環境に依存するため、別マシンとの数値比較や「常にどちらが速い」という結論には使いません。

## テンプレートの構成

検証したキットは次の構成です。

```text
.
├── package.json
├── benchmark.mjs
├── README.md
├── src/
│   └── targets.mjs
├── fixtures/
│   ├── measurement-cases.bench.mjs
│   ├── noisy-skewed.bench.mjs
│   ├── diagnostics.bench.mjs
│   └── isolation/
│       ├── state.mjs
│       ├── 01-first.bench.mjs
│       └── 02-second.bench.mjs
├── scripts/
│   ├── check-jsonl.mjs
│   └── analyze-samples.mjs
└── results/
```

以下が今回検証した主要sourceです。各見出しのパスへそのまま保存し、空の `results/` ディレクトリを作れば、後述のコマンドを実行できます。計測対象を差し替える場合は、`src/targets.mjs` の固定入力と2実装に加え、`benchmark.mjs` の独立な期待値と結果用の `fingerprint()` も新しい返り値に合わせます。`fixtures/measurement-cases.bench.mjs` も残すなら、そちらの期待値と `fingerprint()` も同じように更新する必要があります。

### `package.json`

```json
{
  "name": "node-bench-reproducible-template",
  "private": true,
  "type": "module",
  "scripts": {
    "bench:spec": "node --experimental-bench --bench --bench-reporter=spec benchmark.mjs",
    "bench:json": "node --experimental-bench --bench --bench-reporter=json benchmark.mjs",
    "bench:isolation:process": "node --experimental-bench --bench --bench-reporter=json --bench-isolation=process fixtures/isolation/*.bench.mjs",
    "bench:isolation:none": "node --experimental-bench --bench --bench-reporter=json --bench-isolation=none fixtures/isolation/*.bench.mjs",
    "bench:diagnostics": "node --experimental-bench --bench --bench-reporter=json fixtures/diagnostics.bench.mjs",
    "bench:analyze": "node scripts/analyze-samples.mjs results/main.jsonl"
  }
}
```

### `benchmark.mjs`

```js
import assert from 'node:assert/strict';
import { bench } from 'node:bench';
import { inputs, implementationA, implementationB } from './src/targets.mjs';

export const BENCHMARK_CONFIG = Object.freeze({
  samples: 24,
  warmup: 5,
  operationsPerSample: 2_000,
});

const expectedResults = Object.freeze([
  Object.freeze({ page: '2', sort: 'created_at', tag: 'nodejs' }),
  Object.freeze({ page: '10', sort: 'updated_at', tag: 'performance' }),
  Object.freeze({ page: '1', sort: 'score', tag: 'benchmark' }),
]);

function fingerprint(result) {
  const text = `${result.page}\u0000${result.sort}\u0000${result.tag}`;
  let total = 0;
  for (let index = 0; index < text.length; index += 1) {
    total += text.charCodeAt(index) * (index + 1);
  }
  return total;
}

const expectedFingerprints = expectedResults.map(fingerprint);
for (const [index, input] of inputs.entries()) {
  assert.deepStrictEqual(implementationA(input), expectedResults[index]);
  assert.deepStrictEqual(implementationB(input), expectedResults[index]);
}

function register(name, target) {
  let markerEmitted = false;
  bench(name, {
    samples: BENCHMARK_CONFIG.samples,
    warmup: BENCHMARK_CONFIG.warmup,
  }, (context) => {
    const inputIndex = context.index % inputs.length;
    const input = inputs[inputIndex];
    const expectedAggregate = expectedFingerprints[inputIndex]
      * BENCHMARK_CONFIG.operationsPerSample;
    let aggregate = 0;
    context.start();
    for (let index = 0; index < BENCHMARK_CONFIG.operationsPerSample; index += 1) {
      aggregate += fingerprint(target(input));
    }
    context.end(BENCHMARK_CONFIG.operationsPerSample);
    assert.equal(aggregate, expectedAggregate);
    if (!markerEmitted) {
      context.diagnostic(`AGGREGATE_ASSERT_OK ${JSON.stringify({
        name,
        operations: BENCHMARK_CONFIG.operationsPerSample,
        expectedAggregate,
        actualAggregate: aggregate,
      })}`);
      markerEmitted = true;
    }
  });
}

register('query parser / URLSearchParams', implementationA);
register('query parser / split and decode', implementationB);
```

### `src/targets.mjs`

```js
export const inputs = Object.freeze([
  'page=2&sort=created_at&tag=nodejs',
  'tag=performance&page=10&sort=updated_at',
  'sort=score&tag=benchmark&page=1',
]);

function canonical(entries) {
  return Object.fromEntries([...entries].sort(([left], [right]) => left.localeCompare(right)));
}

export function implementationA(input) {
  return canonical(new URLSearchParams(input).entries());
}

export function implementationB(input) {
  const entries = input.split('&').map((field) => {
    const separator = field.indexOf('=');
    const key = decodeURIComponent(separator === -1 ? field : field.slice(0, separator));
    const value = decodeURIComponent(separator === -1 ? '' : field.slice(separator + 1));
    return [key, value];
  });
  return canonical(entries);
}
```

### `fixtures/measurement-cases.bench.mjs`

```js
import assert from 'node:assert/strict';
import { bench } from 'node:bench';
import { inputs, implementationA } from '../src/targets.mjs';

const SAMPLES = 24;
const WARMUP = 5;
const BATCH_OPERATIONS = 2_000;

const expectedResults = Object.freeze([
  Object.freeze({ page: '2', sort: 'created_at', tag: 'nodejs' }),
  Object.freeze({ page: '10', sort: 'updated_at', tag: 'performance' }),
  Object.freeze({ page: '1', sort: 'score', tag: 'benchmark' }),
]);

function fingerprint(result) {
  const text = `${result.page}\u0000${result.sort}\u0000${result.tag}`;
  let total = 0;
  for (let index = 0; index < text.length; index += 1) {
    total += text.charCodeAt(index) * (index + 1);
  }
  return total;
}

const expectedFingerprints = expectedResults.map(fingerprint);
for (const [index, input] of inputs.entries()) {
  assert.deepStrictEqual(implementationA(input), expectedResults[index]);
}

function emitAggregateMarker(context, state, name, operations, expectedAggregate, aggregate) {
  if (state.emitted) return;
  context.diagnostic(`AGGREGATE_ASSERT_OK ${JSON.stringify({
    name,
    operations,
    expectedAggregate,
    actualAggregate: aggregate,
  })}`);
  state.emitted = true;
}

const goodMarker = { emitted: false };
bench('GOOD setup-before-start warmup-5 batch-2000', { samples: SAMPLES, warmup: WARMUP }, (context) => {
  const inputIndex = context.index % inputs.length;
  const input = inputs[inputIndex];
  const expectedAggregate = expectedFingerprints[inputIndex] * BATCH_OPERATIONS;
  let aggregate = 0;
  context.start();
  for (let index = 0; index < BATCH_OPERATIONS; index += 1) {
    aggregate += fingerprint(implementationA(input));
  }
  context.end(BATCH_OPERATIONS);
  assert.equal(aggregate, expectedAggregate);
  emitAggregateMarker(context, goodMarker, 'GOOD setup-before-start warmup-5 batch-2000', BATCH_OPERATIONS, expectedAggregate, aggregate);
});

const setupInsideMarker = { emitted: false };
bench('COUNTEREXAMPLE setup-inside-measurement', { samples: SAMPLES, warmup: WARMUP }, (context) => {
  const inputIndex = context.index % inputs.length;
  const expectedAggregate = expectedFingerprints[inputIndex] * BATCH_OPERATIONS;
  let aggregate = 0;
  context.start();
  const input = [...inputs][inputIndex];
  for (let index = 0; index < BATCH_OPERATIONS; index += 1) {
    aggregate += fingerprint(implementationA(input));
  }
  context.end(BATCH_OPERATIONS);
  assert.equal(aggregate, expectedAggregate);
  emitAggregateMarker(context, setupInsideMarker, 'COUNTEREXAMPLE setup-inside-measurement', BATCH_OPERATIONS, expectedAggregate, aggregate);
});

const noBatchMarker = { emitted: false };
bench('COUNTEREXAMPLE no-batch operations-1', { samples: SAMPLES, warmup: WARMUP }, (context) => {
  const inputIndex = context.index % inputs.length;
  const input = inputs[inputIndex];
  const expectedAggregate = expectedFingerprints[inputIndex];
  let aggregate = 0;
  context.start();
  aggregate += fingerprint(implementationA(input));
  context.end(1);
  assert.equal(aggregate, expectedAggregate);
  emitAggregateMarker(context, noBatchMarker, 'COUNTEREXAMPLE no-batch operations-1', 1, expectedAggregate, aggregate);
});

const noWarmupMarker = { emitted: false };
bench('COUNTEREXAMPLE no-warmup', { samples: SAMPLES, warmup: 0 }, (context) => {
  const inputIndex = context.index % inputs.length;
  const input = inputs[inputIndex];
  const expectedAggregate = expectedFingerprints[inputIndex] * BATCH_OPERATIONS;
  let aggregate = 0;
  context.start();
  for (let index = 0; index < BATCH_OPERATIONS; index += 1) {
    aggregate += fingerprint(implementationA(input));
  }
  context.end(BATCH_OPERATIONS);
  assert.equal(aggregate, expectedAggregate);
  emitAggregateMarker(context, noWarmupMarker, 'COUNTEREXAMPLE no-warmup', BATCH_OPERATIONS, expectedAggregate, aggregate);
});
```

### `fixtures/noisy-skewed.bench.mjs`

```js
import { bench } from 'node:bench';

const SAMPLES = 24;
const WARMUP = 5;
const OPERATIONS = 2_000;

function work(multiplier) {
  let value = 0;
  for (let index = 0; index < OPERATIONS * multiplier; index += 1) {
    value = (value + index) % 1_000_003;
  }
  return value;
}

bench('distribution / deterministic', { samples: SAMPLES, warmup: WARMUP }, (context) => {
  context.start();
  const value = work(1);
  context.end(OPERATIONS);
  if (!Number.isInteger(value)) throw new Error('unexpected deterministic result');
});

bench('distribution / fixed-skew every-7th-heavy', { samples: SAMPLES, warmup: WARMUP }, (context) => {
  const multiplier = context.index % 7 === 0 ? 30 : 1;
  context.start();
  const value = work(multiplier);
  context.end(OPERATIONS);
  if (!Number.isInteger(value)) throw new Error('unexpected skewed result');
});
```

### `fixtures/diagnostics.bench.mjs`

```js
import { bench } from 'node:bench';

console.log('NODE_BENCH_STDOUT_SENTINEL');
console.error('NODE_BENCH_STDERR_SENTINEL');

bench('diagnostics / short benchmark', { samples: 20, warmup: 5 }, (context) => {
  context.start();
  let total = 0;
  for (let index = 0; index < 1_000; index += 1) total += index;
  context.end(1_000);
  if (total !== 499_500) throw new Error('unexpected total');
});
```

### `fixtures/isolation/state.mjs`

```js
const heapKey = Symbol.for('node-bench-template.isolation-counter');
globalThis[heapKey] ??= 0;
let moduleCounter = 0;

export function claimEntry(entry) {
  moduleCounter += 1;
  globalThis[heapKey] += 1;
  return {
    entry,
    pid: process.pid,
    moduleCounter,
    heapCounter: globalThis[heapKey],
  };
}
```

### `fixtures/isolation/01-first.bench.mjs`

```js
import { bench } from 'node:bench';
import { claimEntry } from './state.mjs';

const observation = claimEntry('01-first');
let emitted = false;

bench('isolation / 01-first', { samples: 20, warmup: 5 }, (context) => {
  if (!emitted) {
    context.diagnostic(`NODE_BENCH_ISOLATION_SENTINEL ${JSON.stringify(observation)}`);
    emitted = true;
  }
  context.start();
  let total = 0;
  for (let index = 0; index < 1_000; index += 1) total += index;
  context.end(1_000);
  if (total !== 499_500) throw new Error('unexpected total');
});
```

### `fixtures/isolation/02-second.bench.mjs`

```js
import { bench } from 'node:bench';
import { claimEntry } from './state.mjs';

const observation = claimEntry('02-second');
let emitted = false;

bench('isolation / 02-second', { samples: 20, warmup: 5 }, (context) => {
  if (!emitted) {
    context.diagnostic(`NODE_BENCH_ISOLATION_SENTINEL ${JSON.stringify(observation)}`);
    emitted = true;
  }
  context.start();
  let total = 0;
  for (let index = 0; index < 1_000; index += 1) total += index * 2;
  context.end(1_000);
  if (total !== 999_000) throw new Error('unexpected total');
});
```

### `scripts/check-jsonl.mjs`

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [file] = process.argv.slice(2);
if (!file) throw new Error('usage: node scripts/check-jsonl.mjs <file.jsonl>');

const lines = (await readFile(file, 'utf8')).split(/\r?\n/u).filter((line) => line.trim() !== '');
assert.ok(lines.length > 0, 'JSONL must contain at least one non-empty line');
const records = lines.map((line, index) => {
  try {
    return JSON.parse(line);
  } catch (error) {
    throw new Error(`line ${index + 1} is not JSON: ${error.message}`);
  }
});

const plans = records.filter((record) => record.type === 'bench:plan');
const completes = records.filter((record) => record.type === 'bench:complete');
const summaries = records.filter((record) => record.type === 'bench:summary');
const identities = [...new Set(plans.map((record) => record.data?.name).filter(Boolean))].sort();
assert.ok(identities.length > 0, 'benchmark identity not found');
assert.ok(summaries.some((record) => record.data?.success === true), 'successful file summary not found');

const rawSampleCounts = Object.fromEntries(completes.map((record) => {
  const name = record.data?.name;
  const samples = record.data?.samples;
  assert.equal(typeof name, 'string', 'complete record identity missing');
  assert.ok(record.data?.summary && Number.isFinite(record.data.summary.mean), `summary missing for ${name}`);
  assert.ok(Array.isArray(samples) && samples.length > 0, `raw samples missing for ${name}`);
  assert.ok(samples.every((sample) => Number.isFinite(sample.rate)), `non-numeric raw rate for ${name}`);
  return [name, samples.length];
}));
assert.equal(Object.keys(rawSampleCounts).length, identities.length, 'complete records do not match identities');

function findStringPaths(value, needle, path = '$', found = []) {
  if (typeof value === 'string' && value.includes(needle)) found.push(path);
  if (Array.isArray(value)) value.forEach((item, index) => findStringPaths(item, needle, `${path}[${index}]`, found));
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, item] of Object.entries(value)) findStringPaths(item, needle, `${path}.${key}`, found);
  }
  return found;
}

const sentinelNames = ['NODE_BENCH_STDOUT_SENTINEL', 'NODE_BENCH_STDERR_SENTINEL', 'NODE_BENCH_ISOLATION_SENTINEL'];
const diagnostics = {};
for (const sentinel of sentinelNames) {
  const matches = records.flatMap((record, index) => findStringPaths(record, sentinel).map((path) => ({ index, path, type: record.type, stream: record.data?.stream })));
  if (matches.length > 0) {
    assert.ok(matches.every((match) => match.type === 'bench:diagnostic'), `${sentinel} was not a diagnostic record`);
    diagnostics[sentinel] = matches;
  }
}
if ('NODE_BENCH_STDOUT_SENTINEL' in diagnostics || 'NODE_BENCH_STDERR_SENTINEL' in diagnostics) {
  assert.ok(diagnostics.NODE_BENCH_STDOUT_SENTINEL?.some((match) => match.stream === 'stdout'), 'stdout diagnostic sentinel missing');
  assert.ok(diagnostics.NODE_BENCH_STDERR_SENTINEL?.some((match) => match.stream === 'stderr'), 'stderr diagnostic sentinel missing');
}

console.log(JSON.stringify({
  file,
  parsedNonEmptyLines: lines.length,
  identities,
  rawSampleCounts,
  diagnostics,
}, null, 2));
```

### `scripts/analyze-samples.mjs`

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [file] = process.argv.slice(2);
if (!file) throw new Error('usage: node scripts/analyze-samples.mjs <file.jsonl>');

const records = (await readFile(file, 'utf8')).split(/\r?\n/u).filter(Boolean).map(JSON.parse);
const results = {};
for (const record of records.filter((item) => item.type === 'bench:complete')) {
  const rates = record.data?.samples?.map((sample) => sample.rate);
  assert.ok(Array.isArray(rates) && rates.length >= 3, `at least 3 samples required for ${record.data?.name}`);
  assert.ok(rates.every(Number.isFinite), `all rates must be finite for ${record.data.name}`);
  const count = rates.length;
  const mean = rates.reduce((sum, value) => sum + value, 0) / count;
  assert.notEqual(mean, 0, `mean must not be zero for ${record.data.name}`);
  const sorted = [...rates].sort((left, right) => left - right);
  const median = count % 2 === 0 ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2 : sorted[(count - 1) / 2];
  const squared = rates.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  const sampleStandardDeviation = Math.sqrt(squared / (count - 1));
  const adjustedFisherPearsonSkewness = (count / ((count - 1) * (count - 2))) * rates.reduce((sum, value) => sum + ((value - mean) / sampleStandardDeviation) ** 3, 0);
  results[record.data.name] = {
    count,
    mean,
    median,
    sampleStandardDeviation,
    coefficientOfVariation: sampleStandardDeviation / mean,
    adjustedFisherPearsonSkewness,
    min: sorted[0],
    max: sorted.at(-1),
  };
}
assert.ok(Object.keys(results).length > 0, 'no completed benchmark samples found');
console.log(JSON.stringify({ file, benchmarks: results }, null, 2));
```

役割は大きく4つです。

- `benchmark.mjs`: 2実装を独立な期待値で先に確認し、対象処理と全返り値の集計を測る
- `measurement-cases.bench.mjs`: setup混入、batchなし、warmupなしを反例として分ける
- `check-jsonl.mjs`: 全非空行をJSONとしてparseし、identity、summary、raw samples、diagnosticを確認する
- `analyze-samples.mjs`: raw rate samplesから件数、平均、中央値、標本標準偏差、CV、調整Fisher–Pearson歪度を計算する

`package.json` は `private: true`、`type: module` とし、依存欄やlockfileは置きませんでした。計測・分離・diagnostic・解析をnpm scriptsから再実行できるようにしています。

## 1. 正しさを確認してから測る

テンプレートでは、同じURL query入力を処理する2実装を比較対象にしました。すべての固定入力について、実装同士の一致だけに依存せず、独立に書いた期待オブジェクトとそれぞれを `node:assert/strict` で比較します。そのassertが通ってからベンチを登録します。

計測部分は次の境界に固定しました。

```text
固定入力・期待値を選びaggregateを初期化  ← setup、計測外
context.start()
対象を2,000回呼び全返り値を集計          ← 計測対象＋集計
context.end(2_000)
aggregateを期待値×2,000とassert          ← 検証、計測外
```

今回の設定は、各identityにつきwarmup 5回、計測24 samples、各sample 2,000 operationsです。最初に構文チェックと結果一致を確認し、その後に次の2形式で実行しました。

```bash
node --experimental-bench --bench --bench-reporter=spec benchmark.mjs
node --experimental-bench --bench --bench-reporter=json benchmark.mjs \
  > results/main.jsonl 2> results/main.json.stderr
node scripts/check-jsonl.mjs results/main.jsonl
```

spec reporterでは両identityについてsample数、mean rate、95%信頼区間、median rateが表示されました。JSONLは全非空行をparseでき、各identityに24件のraw rate samplesがありました。各sampleは2,000 operationsを宣言し、各identityのdiagnosticには `actualAggregate=expectedAggregate=36868000` が記録されました。

この集計は、最後の返り値だけでなく2,000回すべての `page`、`sort`、`tag` をfingerprintへ反映するためのものです。その代わり、rateには対象関数だけでなくfingerprint計算と加算も含まれます。したがって、以下の数値をtarget-only throughputとは解釈しません。また、このassertは今回のfixtureで全返り値を観測できた証拠ですが、最適化runtimeのあらゆる変換に対する数学的証明ではありません。

setupを計測内へ入れたケース、1 operationだけのケース、warmupなしのケースも別fixtureで実行しています。ただし、これらのrateを実装の性能差とは解釈しません。何を計測区間へ含めたかが違うため、名前付きの `COUNTEREXAMPLE` として残すためのものです。

## 2. process isolationを外す前に状態持ち越しを見る

既定、明示的な `process`、`none` の3通りで、2つのbench entryを実行しました。

```bash
node --experimental-bench --bench --bench-reporter=json fixtures/isolation/*.bench.mjs
node --experimental-bench --bench --bench-reporter=json \
  --bench-isolation=process fixtures/isolation/*.bench.mjs
node --experimental-bench --bench --bench-reporter=json \
  --bench-isolation=none fixtures/isolation/*.bench.mjs
```

観測したPIDとcounterは次のとおりです。

| mode | 01-first | 02-second | 観測した境界 |
|---|---|---|---|
| default | PID 33839 / module 1 / heap 1 | PID 33840 / module 1 / heap 1 | 別process、counterは初期化 |
| process | PID 33842 / module 1 / heap 1 | PID 33843 / module 1 / heap 1 | 別process、counterは初期化 |
| none | PID 33844 / module 1 / heap 1 | PID 33844 / module 2 / heap 2 | 同じprocess、状態を持ち越し |

この結果は、v26.10.0の今回のfixtureでの観測です。ただし実務上の判断は明快です。startup costを避けるために `none` を選ぶなら、module stateや `globalThis` の状態が次のentryへ残ることを許容できるか、先に確認する必要があります。理由がなければ既定の分離を維持する方が説明しやすいでしょう。

## 3. specの平均値だけで判断しない

人が結果を確認するときはspecが読みやすい一方、後から再評価するにはraw samplesが必要です。今回は、決定的workloadと、固定規則で一部sampleを重くしたworkloadを用意しました。その同じfixtureをspec用とJSONL用に別々に実行し、それぞれの実行で各identityを24 samplesずつ計測しました。

```bash
node --experimental-bench --bench --bench-reporter=spec \
  fixtures/noisy-skewed.bench.mjs
node --experimental-bench --bench --bench-reporter=json \
  fixtures/noisy-skewed.bench.mjs \
  > results/noisy-skewed.jsonl 2> results/noisy-skewed.json.stderr
node scripts/check-jsonl.mjs results/noisy-skewed.jsonl
node scripts/analyze-samples.mjs results/noisy-skewed.jsonl
```

spec実行では、reporterが両identityに `noisy, skewed` を表示しました。それとは別のJSONL実行が生成したraw samplesから計算したCV / 歪度は、決定的workloadで約 `0.1055 / -0.4614`、固定skew workloadで約 `0.4496 / -1.7144` でした。後者のCVがJSONL実行では大きかった、というところまでが観測事実です。独立した実行のため、このCVと歪度でspec実行の警告を説明できるとは扱いません。

警告が別環境でも必ず出るとは限りません。そのため、テンプレートでは警告文字列の有無だけを合否にせず、raw samplesを保存し、次の順で再測定を判断します。

1. correctness assertが先に通っているか
2. setupと結果検証が計測区間の外か
3. warmupとoperations数が固定されているか
4. identity、sample数、平均、95%信頼区間、中央値、raw samplesが揃っているか
5. warning、CV、歪度、外れ値を見て、環境負荷、warmup、batch size、workloadの順に再確認したか
6. process isolationを外す理由があるか
7. 別マシンのrateを直接比較していないか

平均rateが良く見えることより、再測定が必要な結果を判別できることを優先します。

## 4. 既定のprocess分離でstdout / stderrをdiagnosticにする

ベンチ対象がログを出すと、JSON reporterの出力へ生テキストが混ざらないか気になります。stdoutとstderrへそれぞれsentinelを1回出すfixtureを、既定の `process` isolationで実行しました。

```bash
node --experimental-bench --bench --bench-reporter=json \
  fixtures/diagnostics.bench.mjs \
  > results/diagnostics.jsonl \
  2> results/diagnostics.process.stderr
node scripts/check-jsonl.mjs results/diagnostics.jsonl
```

既定の `process` isolationでは、すべての非空JSONL行をparseできました。stdoutの `NODE_BENCH_STDOUT_SENTINEL` とstderrの `NODE_BENCH_STDERR_SENTINEL` は、どちらも `bench:diagnostic` recordの `$.data.message` に入り、stream metadataも確認できました。process自体のstderrには、実験的機能であることを示すNode.jsのwarningだけが残りました。

ここで重要なのは、sentinelを `grep` で見つけるだけで終わらせないことです。全行を `JSON.parse()` したうえで、diagnostic record内のfield pathとstreamを確認すれば、壊れた生テキストの混入を検出できます。ただし、この観測を `--bench-isolation=none` へ一般化はできません。v26.10.0の仕様上、`none` はbench fileをreporterと同じprocessへimportし、user codeのreporterはstdout / stderrを共有します。そのため、生のwriteがJSON reporter出力を壊す可能性があり、`none` を使うならログを別に制御する必要があります。

## 5. コピー先で再実行する

最後にキット一式をsibling directoryへコピーし、JSONL生成、checker、解析、2実装の結果一致をもう一度実行しました。

```bash
npm run --silent bench:json \
  > results/replay.jsonl 2> results/replay-json.stderr
node scripts/check-jsonl.mjs results/replay.jsonl
node scripts/analyze-samples.mjs results/replay.jsonl
```

コピー先でも次を確認できました。

- 2実装の結果一致
- mainと同じbenchmark identity集合
- 各identityに24件のraw samples
- 各sampleに2,000 operations、各identityに期待値と一致するaggregate diagnostic
- summary fieldの存在
- sourceやscriptに絶対パスが不要

ここで比較したのはidentity、summaryの存在、raw samplesの存在です。rate、信頼区間、個々のsample値が元ディレクトリと一致することは要求していません。再現性は「同じ数字」ではなく、「同じ条件と検証を再実行できること」として扱います。

## 実行ハーネスで起きた失敗

replay後の複数チェックを1つの長いPTY pasteで実行しようとしたところ、入力が崩れ、zshが `NODE_ck: parameter not set` を報告して継続引用符promptへ入りました。Ctrl-Cで止めたのは、その未完了入力だけです。完了済みのbenchmark結果やsourceは変更されていません。

その後、JSONL checker、sample analyzer、replay verifierを短いコマンドへ分けて再実行し、すべてexit 0を確認しました。失敗streamは事前にredirectされていなかったため、保存されたexcerptはraw logではなくtranscriptionです。この記事では、この失敗を `node:bench` の不具合とは扱いません。

## 採用するときの判断基準

`node:bench` は、高機能な既存ベンチツールをすべて置き換えるものとしてではなく、Node.js標準だけで再実行可能な最小構成を置きたい場面に向いています。実装PRでも、最小primitiveを意図した説明がされています（[nodejs/node PR #65606](https://github.com/nodejs/node/pull/65606)）。

今回の結果から、次の条件なら採用候補にできます。

- Node.js v26.10.0へ実行環境を固定できる
- Early Development APIの変更を追える
- 数値ランキングではなく、同一条件での再実行を目的にする
- correctness、計測境界、isolation、raw samplesをレビュー対象に含める
- 依存ゼロで小さなfixtureをPRに同梱したい

反対に、長期安定したAPI、複数runtimeの横断比較、分散負荷試験、異なるマシン間のrate比較が必要なら、この検証だけでは判断できません。

## 制約

- 検証対象はNode.js v26.10.0、Darwin arm64の1環境です。
- CPU brand stringはsandbox内で取得できませんでした。
- rate、信頼区間、CV、歪度は環境固有であり、一般化できません。
- reporter warningは別実行で同じように出るとは限りません。
- 他のNode.jsバージョン、他OS、長時間実行、cross-machine比較は検証していません。
- `HOME`、`CODEX_HOME`、telemetry、npm保存先の確認は明示したpath/valueの検査であり、あらゆる外部writeの不存在を証明するものではありません。書き込み境界は実行時の `workspace-write` sandboxにも依存します。

## 参考資料

- [Benchmark runner | Node.js v26.10.0 Documentation](https://nodejs.org/api/bench.html)
- [Node.js 26.9.0 (Current)](https://nodejs.org/en/blog/release/v26.9.0/)
- [Node.js v26.10.0 distribution](https://nodejs.org/dist/v26.10.0/)
- [bench: add experimental `node:bench` module #65606](https://github.com/nodejs/node/pull/65606)
