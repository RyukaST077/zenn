---
title: "Node.js 26.11でイベントループ遅延をリセットせず窓別監視する"
emoji: "⏱️"
type: tech
topics: ["nodejs", "javascript", "performance", "observability", "backend"]
published: false
---

## この記事で解決すること

Node.js APIの応答が遅くなったとき、CPU使用率だけでは「イベントループ内の同期処理が詰まったのか」「非同期I/Oを待っているのか」を判断できないことがあります。`monitorEventLoopDelay()` の値を一定間隔で読みたい一方、従来の read → `reset()` 方式は監視元のヒストグラムを破壊的にリセットします。

Node.js 26.11.0では、ヒストグラムの `snapshot()` とスナップショット間の `diff()` が追加されました。[Node.js 26.11.0のリリースノート](https://nodejs.org/ja/blog/release/v26.11.0)と[perf_hooksの公式ドキュメント](https://github.com/nodejs/node/blob/main/doc/api/perf_hooks.md)に基づき、`reset()` せず窓別のイベントループ遅延をJSON Linesで出すスクリプトを作成しました。

ローカル検証の結論は次のとおりです。

- Node.js 26.11.0では、監視元の `resetCount` を増やさず10個の観測窓を作れた
- 同期CPUブロックは、idleや今回の非同期I/Oより大きい `max` とELUを示した
- 別コードがヒストグラムを `reset()` しても、次の1窓だけフォールバックして監視を継続できた
- `resolution` ごとの処理時間差は今回の固定負荷ではほぼ見えず、サンプル数だけが大きく変わった
- Node.js 26.10.0では、ログを出す前に終了コード2で安全に停止した

したがって、Node.js 26.11以降を使え、対象環境で `resolution` のコストを測れるなら採用候補です。ただし、イベントループ遅延だけで根本原因やユーザー影響を断定する用途には使えません。

## 検証環境

| 項目 | 検証値 |
|---|---|
| OS | macOS 26.5 / Darwin 25.5.0 |
| アーキテクチャ | arm64 |
| 対象Node.js | v26.11.0 |
| 互換性確認Node.js | v26.10.0 |
| 窓の長さ | 1秒 |
| Case 1の窓数 | 各モード5窓 |
| Case 2の窓数 | 各方式10窓 |

Node.jsの公式配布アーカイブを使い、SHA-256を公式の一覧と照合しました。v26.11.0で `snapshot` と `diff` がどちらも関数であることを、負荷テスト前に確認しています。

この記事の数値は、この1台・この時点のローカル観測です。他のOS、CPU、Node.jsパッチ版、本番ワークロードには一般化できません。

## コピペ用スクリプト

次を `event-loop-window-monitor.mjs` として保存します。依存パッケージは使いません。

```javascript
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';
import { readFile } from 'node:fs/promises';

function parseArgs(argv) {
  const out = { mode: 'idle', windows: 5, windowMs: 1000, resolution: 10, samplePerIteration: false, selfCheck: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--self-check') out.selfCheck = true;
    else if (arg === '--sample-per-iteration') out.samplePerIteration = true;
    else if (['--mode', '--windows', '--window-ms', '--resolution'].includes(arg)) {
      if (argv[i + 1] === undefined) throw new Error(`missing value for ${arg}`);
      const value = argv[++i];
      if (arg === '--mode') out.mode = value;
      else if (arg === '--windows') out.windows = Number(value);
      else if (arg === '--window-ms') out.windowMs = Number(value);
      else out.resolution = Number(value);
    } else throw new Error(`unknown argument: ${arg}`);
  }
  if (!['idle', 'block', 'io', 'alternating-boundary'].includes(out.mode)) throw new Error(`unsupported mode: ${out.mode}`);
  for (const [key, value] of [['windows', out.windows], ['window-ms', out.windowMs], ['resolution', out.resolution]]) {
    if (!Number.isFinite(value) || value <= 0 || !Number.isInteger(value)) throw new Error(`${key} must be a positive integer`);
  }
  return out;
}

function featureCheck() {
  const probe = monitorEventLoopDelay({ resolution: 10 });
  const snapshot = typeof probe.snapshot === 'function' ? probe.snapshot() : null;
  const ok = typeof probe.snapshot === 'function' && snapshot && typeof snapshot.diff === 'function';
  probe.disable();
  if (!ok) {
    process.stderr.write('monitorEventLoopDelay histogram.snapshot() and snapshot.diff() require Node.js 26.11.0 or newer\n');
    return false;
  }
  return true;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const immediate = () => new Promise((resolve) => setImmediate(resolve));

function busy(ms) {
  const end = performance.now() + ms;
  while (performance.now() < end) {}
}

async function runWindow(mode, index, windowMs, timers) {
  if (mode === 'idle') {
    await sleep(windowMs);
    return;
  }
  if (mode === 'io') {
    const deadline = performance.now() + windowMs;
    while (performance.now() < deadline) {
      await readFile(new URL(import.meta.url));
      await sleep(Math.min(20, Math.max(1, deadline - performance.now())));
    }
    return;
  }
  const shouldBlock = mode === 'block' || (mode === 'alternating-boundary' && index % 2 === 0);
  const done = new Promise((resolve) => {
    const endTimer = setTimeout(resolve, windowMs);
    timers.add(endTimer);
  });
  let interval;
  if (shouldBlock) {
    interval = setInterval(() => busy(35), 160);
    timers.add(interval);
  }
  let boundary;
  if (mode === 'alternating-boundary') {
    boundary = setTimeout(() => busy(35), Math.max(0, windowMs - 35));
    timers.add(boundary);
  }
  await done;
  if (interval) { clearInterval(interval); timers.delete(interval); }
  if (boundary) { clearTimeout(boundary); timers.delete(boundary); }
}

function ms(ns) {
  return Number((ns / 1e6).toFixed(3));
}

function record(histogram, elu, args, windowIndex, resetCount, fallback, fallbackReason, previousResetCount) {
  return {
    mode: args.mode,
    windowIndex,
    p50Ms: ms(histogram.percentile(50)),
    p99Ms: ms(histogram.percentile(99)),
    maxMs: ms(histogram.max),
    count: histogram.count,
    elu: Number(elu.utilization.toFixed(6)),
    resetCount,
    previousResetCount,
    fallback,
    fallbackReason,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!featureCheck()) process.exitCode = 2;
  if (process.exitCode) return;
  if (args.selfCheck) return;

  const options = args.samplePerIteration ? { samplePerIteration: true } : { resolution: args.resolution };
  const histogram = monitorEventLoopDelay(options);
  const timers = new Set();
  let interrupted = false;
  const onSigint = () => { interrupted = true; };
  process.once('SIGINT', onSigint);
  histogram.enable();
  try {
    await sleep(args.windowMs); // warm-up, deliberately excluded
    let previous = histogram.snapshot();
    let previousElu = performance.eventLoopUtilization();
    for (let index = 1; index <= args.windows && !interrupted; index += 1) {
      await runWindow(args.mode, index, args.windowMs, timers);
      const current = histogram.snapshot();
      const elu = performance.eventLoopUtilization(previousElu);
      previousElu = performance.eventLoopUtilization();
      const fallback = current.resetCount !== previous.resetCount;
      const windowHistogram = fallback ? current : current.diff(previous);
      console.log(JSON.stringify(record(windowHistogram, elu, args, index, current.resetCount, fallback, fallback ? 'reset-count-changed' : null, previous.resetCount)));
      previous = current;
      await immediate();
    }
    if (interrupted) process.exitCode = 130;
  } finally {
    histogram.disable();
    for (const timer of timers) { clearTimeout(timer); clearInterval(timer); }
    process.removeListener('SIGINT', onSigint);
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
```

このスクリプトは最初の1窓をウォームアップとして捨て、その終了時点のスナップショットを基準にします。以後は `current.diff(previous)` を窓のヒストグラムとして出力します。自分では `reset()` を呼びません。

別コードによるリセットを検出するため、前後の `resetCount` を比較します。不一致なら `diff()` を使わず、現在のスナップショットを採用して `fallback: true` を出します。これは監視停止を避けるためのフォールバックであり、その窓が意図した境界と厳密に一致する保証ではありません。

## まず版チェックを通す

検証では、Node.js 26.11.0を指す `$NODE_2611` を使って次を実行しました。

```bash
"$NODE_2611" event-loop-window-monitor.mjs --self-check
```

26.11.0では終了コード0でした。同じファイルを26.10.0で実行すると、標準出力は空のまま終了コード2となり、標準エラーへ次の1行だけを出しました。

```text
monitorEventLoopDelay histogram.snapshot() and snapshot.diff() require Node.js 26.11.0 or newer
```

スタックトレース、途中までのJSON、ハングは発生しませんでした。26.10以前では監視を有効にせず、既存方式を維持するかNode.jsを更新します。

## 1秒窓をJSON Linesで記録する

idleモードを5窓記録したコマンドです。実行時はこの前に1秒のウォームアップが入るため、全体では約6秒かかります。

```bash
"$NODE_2611" event-loop-window-monitor.mjs \
  --mode idle --windows 5 --window-ms 1000 --resolution 10
```

負荷比較では `--mode` を `idle`、`block`、`io` に変えて、それぞれ5窓ずつ実行しました。`block` は35msのbusy loopを繰り返す検証用モードです。`io` はスクリプト自身の非同期ファイル読み取りと非同期タイマーを使い、ネットワークや本番ストレージの遅延は再現していません。`alternating-boundary` も方式比較専用のfixtureなので、本番監視の負荷生成には使いません。

出力の各行は1観測窓です。

| フィールド | 単位・型 | 読み方 |
|---|---|---|
| `p50Ms` | ms | 窓内のイベントループ遅延の50パーセンタイル |
| `p99Ms` | ms | 窓内のイベントループ遅延の99パーセンタイル |
| `maxMs` | ms | 窓内の最大イベントループ遅延 |
| `count` | 整数 | 窓へ割り当てられたヒストグラム観測数 |
| `elu` | 0〜1の比率 | その窓の `eventLoopUtilization()` 差分 |
| `resetCount` | 整数 | 現在の監視元スナップショットのリセット回数 |
| `previousResetCount` | 整数 | 比較元スナップショットのリセット回数 |
| `fallback` | 真偽値 | リセット回数の不一致でフォールバックしたか |
| `fallbackReason` | 文字列またはnull | フォールバック時は `reset-count-changed` |

`p50Ms`、`p99Ms`、`maxMs` はナノ秒からミリ秒へ変換し、小数第3位まで出しています。`count` は `resolution` とスケジューリングに依存し、ELUも単独では原因を診断しません。

## 同期ブロックと非同期I/Oをどう見分けられたか

各モードを5窓測り、各指標の中央値を比較した結果です。

| モード | p50中央値 ms | p99中央値 ms | max中央値 ms | count中央値 | ELU中央値 |
|---|---:|---:|---:|---:|---:|
| idle | 12.042 | 12.083 | 12.100 | 85 | 0.003997 |
| block | 12.034 | 44.007 | 45.285 | 70 | 0.212269 |
| io | 11.297 | 12.517 | 12.706 | 89 | 0.015762 |

この負荷では、blockの `max` 中央値がidleより33.185ms、ioより32.579ms大きくなりました。5窓中4窓以上で、blockの `max` が同じ番号のidle窓を15ms以上上回ることも確認しました。

ここから言えるのは「このfixtureと端末では、同期ブロックを待機から区別する材料になった」までです。45msを本番の警戒閾値にしてよい、あるいは高いevent-loop delayだけで遅延原因が確定した、とは言えません。

## `snapshot()` / `diff()` を使う実益

10個の1秒窓について、新方式と従来の read → `reset()` 方式を別プロセスで実行しました。奇数窓をidle、偶数窓をblockとし、境界直前にも35msのpulseを置いています。

両方式とも10窓を出力しました。新方式では監視元の `resetCount` が最初から最後まで一定でした。一方、従来方式は各窓の読み取り後に `resetCount` が増えました。非破壊な境界を作れたことが、新方式で確認できた実益です。

ただし、2方式は別プロセス・別時刻で動かしています。窓ごとのcount、p99、maxには差があったものの、境界pulseがどちら側の窓に帰属したかを集約ヒストグラムだけで一意に特定できませんでした。そのため「`diff()` なら必ずパーセンタイルが改善する」「境界サンプルを常に正しく帰属できる」とは主張しません。

なお、従来方式の最初の実装では、ウォームアップ中の167サンプルが第1窓へ混入していました。他の窓はおよそ83サンプルでした。ウォームアップ後に一度リセットしてから測定するよう修正し、2方式を再実行しています。read → `reset()` 方式を残す場合も、ウォームアップを測定窓へ混ぜないことが重要です。

## 他コードが `reset()` した場合

5窓の検証で、第3窓のスナップショット後に同じヒストグラムを明示的に1回リセットしました。

- 第4窓だけが `fallback: true`
- `fallbackReason` は `reset-count-changed`
- 現在の `resetCount` は1、直前の値は0
- 第5窓は `resetCount: 1` のまま `fallback: false` に復帰
- 全5窓のp50、p99、max、count、ELUは有限値

つまり、リセット直後の1窓だけ現在のスナップショットへフォールバックし、次の窓から再び差分を取れました。複数コンポーネントが同じヒストグラムを共有するなら、`fallback: true` を監視し、その頻度も運用判断へ含めます。

## `resolution` は対象環境で決める

2,000回の `setImmediate` と、各反復500µsの固定CPU処理を組み合わせました。監視なし、1ms、10ms、20ms、`samplePerIteration: true` を、ウォームアップ後に各5回測った結果です。

| 設定 | 経過時間中央値 ms | min–max ms | baseline比 | count中央値 | count範囲 |
|---|---:|---:|---:|---:|---:|
| off | 1026.317 | 1026.214–1026.496 | 1.000 | - | - |
| resolution-1 | 1026.530 | 1026.411–1026.580 | 1.000 | 1026 | 1025–1026 |
| resolution-10 | 1026.440 | 1026.115–1026.570 | 1.000 | 101 | 101–101 |
| resolution-20 | 1026.126 | 1025.881–1026.466 | 1.000 | 50 | 50–50 |
| sample-per-iteration | 1026.298 | 1026.209–1026.422 | 1.000 | 2001 | 2001–2001 |

経過時間中央値の差は約0.4ms以内で、表示上のbaseline比はすべて1.000に丸まりました。一方、count中央値は50〜2,001まで変わりました。

この結果から特定の設定を普遍的な勝者にはできません。小さいresolutionの観測コストが問題になりうる背景は[Node.js issue #56064](https://github.com/nodejs/node/issues/56064)にもあります。実際のリクエスト処理と同じ負荷で、必要なサンプル数とコストを測って決めます。

## 導入判断表

| 条件 | 判断 | 次のアクション |
|---|---|---|
| Node.js 26.11以降、外部resetなし、対象環境でコスト測定済み | 採用 | 測定結果からresolutionを選ぶ |
| Node.js 26.11以降、外部resetあり、対象環境でコスト測定済み | 条件付き採用 | fallbackを残し、`fallback: true` を監視する |
| Node.js 26.11以降、対象環境でコスト未測定 | 条件付き採用 | 本番相当の負荷で先にベンチマークする |
| 旧方式に対する数値上の優位を確認できない | 非破壊な境界が必要な場合のみ採用 | パーセンタイル改善ではなくreset回避を採用理由にする |
| Node.js 26.10以前 | 見送り | Node.jsを更新するか互換性のある既存監視を残す |

長時間の累積ヒストグラムには、短い測定値へ統計が偏りうるという再現報告もあります（[Node.js issue #34661](https://github.com/nodejs/node/issues/34661)）。窓別にした後も、イベントループ遅延とELUは診断信号の一部として扱い、アプリケーションのレイテンシ、CPU、外部依存先などと合わせて判断します。

## まとめ

Node.js 26.11.0の `snapshot()` / `diff()` を使うと、監視元を `reset()` せずイベントループ遅延を窓別に出せました。今回確認できた利点は、必ず数値が良くなることではなく、非破壊な観測境界を作れることです。

導入時は、Node.js 26.11以降をfeature detectionで確認し、外部resetに備えたフォールバックを残し、対象環境でresolutionのコストを測ります。そして、得られた遅延値だけで原因やユーザー影響を断定しないことが重要です。

## 参考資料

- [Node.js 26.11.0 release](https://nodejs.org/ja/blog/release/v26.11.0)
- [Node.js perf_hooks documentation](https://github.com/nodejs/node/blob/main/doc/api/perf_hooks.md)
- [Node.js issue #34661: monitorEventLoopDelay histogram bias](https://github.com/nodejs/node/issues/34661)
- [Node.js issue #56064: monitorEventLoopDelay resolution overhead](https://github.com/nodejs/node/issues/56064)
