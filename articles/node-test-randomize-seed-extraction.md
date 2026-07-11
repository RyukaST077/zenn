---
title: "Node.jsのテスト順ランダム化で依存を検出、seed抽出で止まった記録"
emoji: "🔀"
type: tech
topics: ["nodejs", "testing", "docker"]
published: true
---

## 対象読者

- `node:test`で、単独では通るのに実行順によって落ちるテストを見つけたい方
- `--test-randomize`の実際の出力と、検証を自動化するときの注意点を知りたい方

この記事は成功した範囲だけでなく、seedの自動抽出に失敗して検証を止めたところまでを記録します。seedによる決定的な再現や、テスト修正後の回帰確認には成功していません。

## 試したこと

Node.js 24.16.0の組み込みテストランナーで、モジュール内の配列を2つのテストが共有する最小fixtureを実行しました。

1. 通常の`node --test`で宣言順に通ることを確認する
2. `--test-randomize`を付け、順序が逆転したときの失敗を捕捉する
3. 出力からseedを抽出する
4. 抽出したseedで同じ失敗を再現する

実際には3で抽出処理が失敗したため、計画の停止条件に従って4以降は実行していません。

公式ドキュメントでは、`--test-randomize`はテストファイルとキューに入ったテストの実行順をランダム化し、表示されたseedを`--test-random-seed`へ渡すことで順序を再現できると説明されています（[Node.js v24 Test runner documentation](https://nodejs.org/docs/latest-v24.x/api/test.html#randomizing-tests-execution-order)、2026-07-11閲覧）。また、この機能がNode.js 24.16.0へ入ったことは公式リリースノートに記載されています（[Node.js 24.16.0 release](https://nodejs.org/en/blog/release/v24.16.0)、2026-07-11閲覧）。

## 検証環境

| 項目 | 実測値 |
|---|---|
| ホスト | Darwin 25.5.0 arm64 |
| Docker CLI | Docker 28.5.1 |
| Docker image | `node:24.16.0-bookworm-slim` |
| image digest | `node@sha256:2c87ef9bd3c6a3bd4b472b4bec2ce9d16354b0c574f736c476489d09f560a203` |
| Node.js | v24.16.0 |
| コンテナ | linux arm64 |

イメージ取得後のテストコンテナはすべて`--rm --network none`で実行し、隔離した作業ディレクトリだけを`/work`へマウントしました。

## 再現手順

### 1. fixtureを作る

`order-dependent.test.js`を次の内容で作成します。

```js
const test = require('node:test');
const assert = require('node:assert/strict');

let shared = [];

test('01 initializes shared state', () => {
  shared.push('ready');
  assert.deepEqual(shared, ['ready']);
});

test('02 consumes shared state', () => {
  assert.deepEqual(shared, ['ready']);
});
```

2本目は1本目が作った状態を暗黙に前提としているため、テスト同士が独立していません。

### 2. 固定したコンテナで通常実行する

作業ディレクトリで次を実行します。

```bash
docker run --rm --network none \
  -v "$PWD:/work" -w /work \
  node:24.16.0-bookworm-slim \
  node --test order-dependent.test.js
```

今回の実行ではexit code 0となり、2本とも通りました。

```text
✔ 01 initializes shared state
✔ 02 consumes shared state
ℹ tests 2
ℹ pass 2
ℹ fail 0
```

### 3. 実行順をランダム化する

出力先を作り、終了コードを失わないようにしたうえでログへ保存します。失敗した試行は、後続のseed抽出で使うファイル名へコピーします。

```bash
mkdir -p logs

set +e
docker run --rm --network none \
  -v "$PWD:/work" -w /work \
  node:24.16.0-bookworm-slim \
  node --test --test-randomize order-dependent.test.js \
  >logs/random-01.log 2>&1
exit_code=$?
set -e

if [ "$exit_code" -ne 0 ]; then
  cp logs/random-01.log logs/random-first-failure.log
fi
```

失敗しなかった場合は、出力先の連番を変えて同じ手順を繰り返します。今回の探索では1回目がexit code 0、2回目がexit code 1でした。実際には2回目の出力を`logs/random-first-failure.log`へコピーしました。2回目はconsumerが先に走り、空配列と`['ready']`の比較で失敗しました。

```text
✖ 02 consumes shared state
✔ 01 initializes shared state
ℹ Randomized test order seed: 1476629161
ℹ tests 2
ℹ pass 1
ℹ fail 1

AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
+ actual - expected

+ []
- [
-   'ready'
- ]
```

通常実行の成功と、ランダム化による順序逆転後の失敗を合わせると、このfixtureにテスト順依存があると判断できます。ただし「2回で見つかる」という回数は今回の観測に限られます。

## 観測結果

| 確認項目 | 結果 |
|---|---|
| Node.jsがv24.16.0か | 成功 |
| 通常実行で2本とも通るか | 成功 |
| 20回以内にランダム順で失敗するか | 成功（2回目） |
| failing seedを自動抽出できるか | 失敗 |
| 同じseedで3回再現できるか | 未実行 |
| 状態分離後の回帰確認 | 未実行 |

## 失敗と対応

seed抽出には次の式を使いました。

```bash
SEED="$(sed -nE \
  's/.*random seed: ([^ ]+).*/\1/p' \
  logs/random-first-failure.log | tail -n 1)"
test -n "$SEED"
```

しかし、実際の出力は次の表記でした。

```text
Randomized test order seed: 1476629161
```

抽出式が必要とする連続した文字列`random seed:`は、実際の`Randomized test order seed:`には含まれていません。大文字・小文字だけでなく文言も異なるため、`SEED`は空になり、`test -n "$SEED"`がexit code 1で終了しました。ログ上ではseedを目視できますが、自動抽出に成功したことにはなりません。

今回は、抽出に失敗したらコマンドをその場で変更せず停止する計画でした。そのため抽出式の修正版は試しておらず、表示された`1476629161`を使った再実行もしていません。ここから言えるのは、CLI出力を処理する自動化では、対象バージョンの実際の文言を検証する必要がある、という範囲までです。

## 制限事項

- seed `1476629161`で同じ順序と失敗を再現できるかは未確認です。
- 逐次`await`するsubtest、watch modeとの併用は未確認です。
- `beforeEach`で状態を分離したfixtureは作成しましたが、実行していません。
- ランダム化の試行は2回だけです。一般的な検出率や、flaky testが存在しないことの根拠にはできません。
- 今回確認したのは、固定したNode.js 24.16.0コンテナ内の小さなfixtureだけです。

## まとめ

通常順では2本とも通るfixtureに`--test-randomize`を付けると、2回目の試行で実行順が逆転し、共有可変状態への依存を失敗として観測できました。

一方、seedの出力文言と抽出式が一致せず、seed再現まで進めませんでした。ランダム化で失敗を見つける処理だけでなく、seedを確実に保存できたことを確認してから再現性を評価する必要があります。今回の結果をseed再現や修正完了の成功例としては扱えません。

## 参考資料

- [Node.js v24 Test runner: Randomizing tests execution order](https://nodejs.org/docs/latest-v24.x/api/test.html#randomizing-tests-execution-order)（2026-07-11閲覧）
- [Node.js 24.16.0 (LTS) release](https://nodejs.org/en/blog/release/v24.16.0)（2026-07-11閲覧）
