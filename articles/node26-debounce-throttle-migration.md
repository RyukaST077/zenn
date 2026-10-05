---
title: "Node.js 26標準debounce/throttle移行を6項目で判定する"
emoji: "⏱️"
type: "tech"
topics: ["nodejs", "javascript", "lodash", "testing", "migration"]
published: false
---

<!-- 出典ログ: logs/run-node26-debounce-throttle-20261002-224740/execution-log.md -->

## 結論：同名でも一括置換はできない

Node.js 26.10.0では、`node:util`に`debounce()`と`throttle()`が追加されました。[Node.js 26.10.0のリリースノート](https://nodejs.org/en/blog/release/v26.10.0)

ただし、`lodash.debounce` / `lodash.throttle`からの置換は、import先を変えるだけでは済みません。固定した2つのNode.jsとLodashを同じ入力で比較したところ、少なくとも次の差がありました。

- Node.js 22.17.0には両APIがなく、Node.js 26.10.0では利用できる
- Node版は呼び出しごとにPromiseを返す
- Node版debounceには、今回固定したドキュメントとランタイム上で`trailing`と`maxWait`がない
- Node版のcancelはPromiseをrejectし、未処理ならプロセス終了にも影響する
- Node版throttleは、Lodashの先頭・末尾呼び出し制御ではなく、queue/drop/concurrencyを扱う
- Node版debounceの`ref()` / `unref()`はCLIの終了条件を変える

この記事では、呼び出し箇所ごとに「直接置換」「wrapper」「Lodash継続」のどれを選ぶかを、6項目で判定します。Nodeの公式ドキュメントはPromise、cancel、AbortSignal、timer参照などのAPIを説明しています。[Node.js 26.10.0 Utilドキュメント](https://nodejs.org/download/release/v26.10.0/docs/api/util.html) 一方、Lodashの公式ドキュメントには`leading`、`trailing`、`maxWait`、`cancel()`、`flush()`があります。[Lodash debounce](https://lodash.com/docs/#debounce) / [Lodash throttle](https://lodash.com/docs/#throttle)

## まず移行チェックリスト

実測結果から作った判断表です。1行でも要件に引っかかれば、その呼び出し箇所は機械的な直接置換の対象から外します。

| Case | 確認すること | 実測結果 | 判断 |
|---|---|---|---|
| 1 | Node.js 22でも動かす必要があるか | 22.17.0では両exportが`undefined` | Node 26.10.0未満を残すなら直接置換しない |
| 2 | 同期戻り値を利用しているか | Node版はPromise、Lodash版は同期値または`undefined` | Promise対応済みなら直接候補。それ以外はwrapperか継続 |
| 3 | `trailing:false`や`maxWait`が必要か | Node版に直接対応するoptionなし | wrapperかLodash継続 |
| 4 | cancel時のrejectionを処理できるか | Node版は`AbortError`でreject | 全呼び出しを処理できる場合だけ直接候補 |
| 5 | UI的な間引きか、処理queueの制御か | Node版既定はA/B/Cをすべてqueue | queue/rate用途なら直接候補。Lodash意味論が必要なら継続 |
| 6 | pending timerでCLIを待たせるか | `unref()`時はcallback前に終了 | プロセス寿命を明示して置換 |

「Node 26へ上げたから全部置換する」のではなく、利用箇所ごとにこの表を当てるのが安全です。

## 検証環境と範囲

検証環境は次のとおりです。

| 項目 | 固定値 |
|---|---|
| OS / architecture | Darwin / arm64 |
| 比較Node.js | v22.17.0 / v26.10.0 |
| npm | 11.19.1（Node.js 26同梱） |
| lodash.debounce | 4.0.8 |
| lodash.throttle | 4.1.1 |

Node.jsは公式archiveをダウンロードし、`SHASUMS256.txt`の該当行でSHA-256を検証してから使いました。依存はexact versionでlockfileへ固定し、install scriptは無効化しています。認証、API key、課金、browser、Docker、global installは不要です。

テストは`node:test`でCase 1〜6を独立させ、child processには2秒のhard timeoutを設定しました。完全な6件を2回実行し、どちらも6/6 passでした。時刻そのものを除いたcanonical JSONのdiffも0 byteでした。

ここから先の「実測」は、この固定環境と記録した短いtimer入力に対する結果です。全platform、全負荷、全境界条件へ一般化した結果ではありません。

## Case 1：Node.jsのversion gate

同じ`node:util`をdynamic importし、exportの型を記録しました。

| Runtime | `typeof debounce` | `typeof throttle` |
|---|---|---|
| Node.js v22.17.0 | `undefined` | `undefined` |
| Node.js v26.10.0 | `function` | `function` |

両child processともexit code 0、stderrは空でした。したがってNode.js 22をsupport対象に残す間は、Node版へ直接置換できません。先にruntimeの最低versionを決める必要があります。

## Case 2：末尾の引数は同じでも、戻り値が違う

debounceへ`A`、`B`、`C`を連続して渡しました。両実装ともcallbackは1回だけ実行され、引数は`C`でした。ここだけを見ると置換できそうです。

しかし戻り値は異なります。

| 実装 | 3回の呼び出し直後 | callback | 最終値 |
|---|---|---|---|
| Node.js 26 | Promise / Promise / Promise | `C`を1回 | 3つとも`result:C`でfulfill |
| Lodash | `undefined` / `undefined` / `undefined` | `C`を1回 | 実行前の同期戻り値なし |

Node版の呼び出し側は、結果を`await`するか、不要でもrejectionを処理する設計が必要です。Lodashが返す「直近に実行されたcallbackの同期結果」に依存する箇所も、戻り値の契約が変わります。

判定は次のようになります。

- 戻り値を使わず、rejectも確実に処理できる: 直接置換の候補
- 同期APIを維持する必要がある: wrapperを検討
- 既存の同期戻り値の意味を変えられない: Lodash継続

## Case 3：`leading`はあっても、option集合は一致しない

固定したNode.js 26.10.0のdocs JSONとruntime introspectionでは、debounce optionは`leading`、`rejectOnCancel`、`signal`でした。`trailing`と`maxWait`はありませんでした。Lodash側のoptionは公式ドキュメントでも確認できます。[Lodash debounce](https://lodash.com/docs/#debounce)

| Scenario | Node.js 26 | Lodash 4.0.8 |
|---|---|---|
| default、入力A/B/C | `C` | `C` |
| `leading:true`、入力A/B/C | `A`, `C` | `A`, `C` |
| default leading + `trailing:false` | 対応optionなし | callbackなし |
| 連続入力 + `maxWait` | 対応optionなし | `D`, `G`, `H` |

ここで一度、テスト側の誤りも見つかりました。Lodashの`{ trailing:false }`で`A`が呼ばれると予想していましたが、実測は空配列でした。既定の`leading:false`と組み合わさり、両edgeが無効になるためです。実装と入力は変えず、誤っていた期待値だけを`['A']`から`[]`へ修正しました。その後、Case 3単独と完全run 2回のすべてでpassしています。

`leading:true`も同じ出力になった1ケースだけで完全互換とは言えません。少なくとも`trailing:false`と`maxWait`を使う箇所は、wrapperかLodash継続です。

## Case 4：cancelは「callbackを止める」だけではない

Node版debounceのpending callをcancelすると、戻りPromiseは`AbortError`でrejectしました。

```text
name: AbortError
code: ABORT_ERR
message: The operation was aborted
```

handled childはexit code 0でした。一方、`--unhandled-rejections=strict`で同じcancel rejectionを未処理にしたchildはexit code 1でした。いずれもtimeoutせず終了しています。

AbortSignalも次の3条件で`AbortError`になりました。

- すでにabort済みのsignalを渡して構築する
- pending中にabortする
- abort後に同じdebounced functionを再度呼ぶ

3条件ともcallback countは0でした。また、Node版の`flush()`はcallback countを0から1へ変え、pending Promiseは`result:F`でfulfillしました。

Lodash側では`cancel()`の戻り値は`undefined`で、`A`の実行を抑止しました。別の`F`をpendingにして`flush()`すると同期的に`result:F`が返りました。この差から、fire-and-forgetで呼んでいるコードほど、cancel導入時のrejection漏れを点検する必要があります。

## Case 5：throttleは目的から違う

同じburst入力`A`、`B`、`C`に対し、Node版throttleの既定queueは3件を受け付け、順にすべて実行しました。各呼び出しの戻り値はPromiseです。

| Node.js 26 scenario | callback | 結果 |
|---|---|---|
| default queue | `A`, `B`, `C` | 3件ともfulfill |
| `overflow:'drop'` | `A` | `B`, `C`は`ERR_THROTTLED`でreject |
| `maxPending:1` | `A`, `B` | `C`は`ERR_THROTTLED`でreject |
| `concurrency:2` | 開始・完了とも`A`, `B`, `C` | 観測した最大同時実行数は2 |

同じ入力に対するLodash版は次の結果でした。

| Lodash scenario | callback |
|---|---|
| default | `A`, `C` |
| trailing only | `C` |
| leading only | `A` |

つまり、Node版はrate/concurrencyを含む処理queueとして、Lodash版はburstの先頭・末尾を選ぶ用途として観測されました。同じ`throttle`という名前だけでUIイベントの間引きを置換すると、実行回数が2回から3回へ増える可能性があります。

## Case 6：`unref()`はCLIの寿命を変える

pending中のdebounced callbackをchild processで観測しました。時間は絶対値ではなく、事前に決めた区分だけで判定しています。

| Mode | callback | 終了区分 |
|---|---|---|
| default ref | 実行された | callback-window（200〜1000ms） |
| `unref()` | 実行されなかった | early（200ms未満） |
| `unref()`後に`ref()` | 実行された | callback-window（200〜1000ms） |

3つともexit code 0、signalなし、hard timeoutなしでした。Lodashには同名の`ref()` / `unref()` APIを割り当てていません。

CLIや短命なworkerでは、pending callbackを待つのか、それとも処理を捨てて終了可能にするのかを決める必要があります。`unref()`は単なる性能optionではなく、callbackが実行される保証とprocess lifetimeに関わる選択です。

## 比較テストを再実行する

再現用fixture一式は[リポジトリの`fixtures/node26-debounce-throttle-migration/`](https://github.com/RyukaST077/zenn/tree/main/fixtures/node26-debounce-throttle-migration)に置いてあります。Node.js 26.10.0をversion managerなどで用意してcheckoutしたリポジトリで、次のように固定versionを確認し、lockfileどおりに依存を入れて実行します。

```bash
FIXTURE_ROOT="$PWD/fixtures/node26-debounce-throttle-migration"
NODE26="$(command -v node)"
NPM26_CLI="$(dirname "$NODE26")/../lib/node_modules/npm/bin/npm-cli.js"

test "$("$NODE26" --version)" = "v26.10.0"
cd "$FIXTURE_ROOT/fixture"
"$NODE26" "$NPM26_CLI" ci --ignore-scripts --no-audit --no-fund
"$NODE26" --test --test-concurrency=1 \
  "$FIXTURE_ROOT/takeaway/compare-node-lodash.test.mjs"
```

結果は6 tests、6 passed、0 failedでした。生成された比較テスト全文は次のとおりです。

```js:compare-node-lodash.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { runDebounceCalls } from '../fixture/cases/debounce-calls.mjs';
import { runDebounceOptions } from '../fixture/cases/debounce-options.mjs';
import { runCancelFlushAbort } from '../fixture/cases/cancel-flush-abort.mjs';
import { runThrottleBurst } from '../fixture/cases/throttle-burst.mjs';
import { runTimerRef } from '../fixture/cases/timer-ref.mjs';

test('Case 1 runtime is Node 26.10.0', () => assert.equal(process.version, 'v26.10.0'));
test('Case 2 same A/B/C input exposes Promise versus sync returns', async () => {
  const x = await runDebounceCalls(); assert.deepEqual(x.node.callbackArgs, ['C']); assert.deepEqual(x.lodash.callbackArgs, ['C']);
});
test('Case 3 same burst exposes option asymmetry', async () => {
  const x = await runDebounceOptions(); assert.equal(x.node.maxWaitOption, 'not-provided'); assert.ok(x.lodash.maxWait.length >= 2);
});
test('Case 4 isolated children expose cancellation and AbortSignal', async () => {
  const x = await runCancelFlushAbort(); assert.equal(x.handled.summary.rejection.name, 'AbortError'); assert.notEqual(x.strict.code, 0);
});
test('Case 5 same burst distinguishes queue/drop/concurrency', async () => {
  const x = await runThrottleBurst(); assert.deepEqual(x.node.queue.calls, ['A','B','C']); assert.equal(x.node.counts.dropRejected, 2);
});
test('Case 6 child exit distinguishes ref/unref', async () => {
  const x = await runTimerRef(); assert.equal(x.node.ref.callbackRan, true); assert.equal(x.node.unref.callbackRan, false);
});
```

掲載したfileがimportする5 module、child harness、lockfileも上記fixture一式に含まれます。完全runでは各Caseの詳細schemaも別testで検証しました。

## 実際の移行手順

呼び出し箇所ごとに、次の順番で確認します。

1. deployment/runtimeの最低versionがNode.js 26.10.0以上か確認する
2. debounce/throttleの戻り値を利用している箇所を検索する
3. `leading`、`trailing`、`maxWait`の設定を棚卸しする
4. `cancel()`する全経路でPromise rejectionを処理できるか確認する
5. throttleが「先頭・末尾の間引き」と「queue/rate制御」のどちらを期待されているか確認する
6. CLIやworkerでpending timerをprocessが待つべきか決める

Case 1〜6をすべて通過した呼び出しだけが直接置換の候補です。optionや同期戻り値だけを吸収できるならwrapper、Lodash固有の意味論を維持する必要があるならLodash継続と判断できます。

## 制限

今回の観測はNode.js 22.17.0 / 26.10.0、lodash.debounce 4.0.8、lodash.throttle 4.1.1、Darwin arm64に限定されます。短い実時間timerを2回再実行してcanonical結果が一致したことは確認しましたが、全負荷・全platformで同じtimingになることは示していません。

`maxWait`も1つの連続入力scheduleだけです。性能やmemory使用量、application固有wrapperは検証していません。また、Node.js 26.10.0のAPIを固定しているため、後続versionでoptionや挙動が変わった場合は、同じチェックリストを新しいruntimeで再実行する必要があります。

## 参考資料

- [Node.js v26.10.0 release notes](https://nodejs.org/en/blog/release/v26.10.0)
- [Node.js v26.10.0 Util documentation](https://nodejs.org/download/release/v26.10.0/docs/api/util.html)
- [nodejs/node: util.debounce and util.throttle pull request](https://github.com/nodejs/node/pull/65899)
- [Lodash debounce documentation](https://lodash.com/docs/#debounce)
- [Lodash throttle documentation](https://lodash.com/docs/#throttle)
