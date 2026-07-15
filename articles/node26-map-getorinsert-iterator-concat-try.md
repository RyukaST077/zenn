---
title: "Node 26 の Map.getOrInsert と Iterator.concat で get-or-set 定型を書き比べてみた"
emoji: "🗺️"
type: "tech"
topics: ["nodejs", "javascript", "v8", "map", "iterator"]
published: true
---

<!-- 前提: 出典ログ logs/run-node26-map-getorinsert-20260716-0407/execution-log.md / 記事タイプ: 検証ログ・試してみた / slug: node26-map-getorinsert-iterator-concat-try / published: false -->

## はじめに

`Map` を使って「そのキーがあれば取得、なければ初期値を入れてから足す」という処理、たぶん誰でも一度は書いていると思います。単語の出現回数を数えたり、レコードをチームごとにグルーピングしたり。定型ではあるんですが、毎回 `has` / `get` / `set` を並べるのが地味に面倒でした。

Node 26（同梱の V8 は 14.6）で `Map.prototype.getOrInsert` / `getOrInsertComputed` と `Iterator.concat` が既定で使えるようになった、と知ったので、この get-or-set 定型を旧来の書き方と新しいメソッドで書き比べてみました。旧版と新版の出力が完全一致するところまで確認して、行数や挙動、簡単なベンチまで見ています。

- 試したこと: 単語カウントとチーム別グルーピングを、旧来の書き方と `getOrInsert` 系で実装して `diff` で突き合わせ。`getOrInsertComputed` の遅延評価、`Iterator.concat` の遅延連結、100万件の簡易ベンチまで。
- 結論の先出し: 書き比べはひととおり動いて、コードは確かに短くなりました。ただ「予測と実際の挙動が違った」箇所が1つあって、そこが個人的にいちばんの学びでした。

:::message
筆者は新人寄りのエンジニアで、これらの新メソッドを触るのは初めてです。実行環境は macOS 26.5 (arm64) / Node v26.5.0（nvm で導入。マシンの既定は v22.17.0）。
:::

## 使ったもの・環境

- 対象技術: Node.js 26（V8 14.6）の
  - `Map.prototype.getOrInsert(key, defaultValue)` … あれば取得、なければ `defaultValue` を格納して返す。**第2引数は即時評価**される。
  - `Map.prototype.getOrInsertComputed(key, callbackFn)` … コールバックは**キーが未存在のときだけ**実行され、その戻り値がそのまま格納される。
  - `Iterator.concat(...iterables)` … 複数のイテラブルを中間配列を作らず遅延連結する静的メソッド。同期専用。
- 実行環境: macOS 26.5 (Darwin 25.5.0, arm64) / Node **v26.5.0**（nvm、既定の v22.17.0 とは別）/ スクショ撮影に playwright（chromium）。

題材にしたデータはこれだけです。単語配列と、チーム所属のメンバー一覧。

```js:data.mjs
export const words = [
  'apple', 'banana', 'apple', 'cherry', 'banana', 'apple',
  'date', 'cherry', 'banana', 'apple', 'elderberry', 'date',
];

export const members = [
  { team: 'red', name: 'Alice' },
  { team: 'blue', name: 'Bob' },
  { team: 'red', name: 'Carol' },
  { team: 'green', name: 'Dave' },
  { team: 'blue', name: 'Eve' },
  { team: 'red', name: 'Frank' },
  { team: 'green', name: 'Grace' },
];
```

## 環境構築

まず現在の Node を確認したら v22 でした。

```bash
$ node -v
v22.17.0
```

対象のメソッドは Node 26 でしか動かないので、このままだと `TypeError: ... is not a function` になるはずです。nvm を見たら v26.5.0 は既に入っていたので、切り替えるだけで済みました。

```bash
export NVM_DIR="$HOME/.nvm"; \. "$NVM_DIR/nvm.sh"
nvm use 26
node -v
# node: v26.5.0
```

ここで1つつまずきました。シェルの既定は v22 のままなので、スクリプトを別プロセスで叩くたびに v22 に戻ってしまいます。sub-shell には nvm の環境が引き継がれないんですね。結局、各コマンドの頭で `export NVM_DIR...; \. nvm.sh; nvm use 26` を毎回付けて固定しました。

新メソッドが本当に有効かは、ワンライナーで確認できます。

```bash
node -e "console.log(new Map().getOrInsert('a', 1))"
node -e "console.log(new Map().getOrInsertComputed('a', () => 99))"
node -e "console.log([...Iterator.concat([1,2],[3,4])])"
```

出力:

```
1
99
[ 1, 2, 3, 4 ]
```

3つともフラグなしで既定有効でした。`getOrInsert('a', 1)` が `1` を返せば有効、という判定に使えます。

## 実際に書き比べてみる（本編）

### 旧来の書き方

まず新メソッドを使わない版です。カウントは `get() ?? 0` の1行で書けますが、`get` が2回出てきます。グルーピングは `has` → `set` → `get().push()` の3手順が必要でした。

```js:01-group-old.mjs
import { words, members } from './data.mjs';

// 単語カウント
const counts = new Map();
for (const w of words) {
  counts.set(w, (counts.get(w) ?? 0) + 1);
}

// チーム別グルーピング
const byTeam = new Map();
for (const { team, name } of members) {
  if (!byTeam.has(team)) {
    byTeam.set(team, []);
  }
  byTeam.get(team).push(name);
}
```

出力はこうなります（01 と 02 を diff で突き合わせるため、キーをソートして決定的にしています）。

```
== counts ==
apple: 4
banana: 3
cherry: 2
date: 2
elderberry: 1
== byTeam ==
blue: Bob, Eve
green: Dave, Grace
red: Alice, Carol, Frank
```

### 新メソッド版

同じ処理を `getOrInsert` / `getOrInsertComputed` で書き換えます。

```js:02-group-new.mjs
import { words, members } from './data.mjs';

// 単語カウント: 初期値が定数(0)なので getOrInsert が自然
const counts = new Map();
for (const w of words) {
  counts.set(w, counts.getOrInsert(w, 0) + 1);
}

// チーム別グルーピング: 初期値を毎回 new する配列なので getOrInsertComputed
const byTeam = new Map();
for (const { team, name } of members) {
  byTeam.getOrInsertComputed(team, () => []).push(name);
}
```

カウントは `get` の二重呼び出しが消えます。そしてグルーピングが、`has`/`set`/`get().push()` の4行から `getOrInsertComputed(team, () => []).push(name)` の1行になりました。

出力が旧版と完全一致するかは `diff` で確認しました。

```bash
node workspace/01-group-old.mjs > workspace/a.txt
node workspace/02-group-new.mjs > workspace/b.txt
diff workspace/a.txt workspace/b.txt; echo "exit: $?"
# exit: 0
```

exit code 0、つまり差分ゼロで一致でした。

使い分けとしては、初期値が定数（`0` など）なら `getOrInsert(k, 0)`、初期値を毎回 new する（配列やオブジェクト）なら `getOrInsertComputed(k, () => [])` が自然だと感じました。`getOrInsert(k, [])` だと、キーが既にあって使われない場合でも空配列を毎回作ってしまうので。

### コールバックが呼ばれる回数を数えてみる

「`getOrInsertComputed` のコールバックは未存在時だけ」という説明が本当か、カウンタで実測しました。対比として、`getOrInsert(k, expensive())` の第2引数（即時評価される）も数えています。

```js:03-lazy-callback.mjs
// getOrInsertComputed: コールバックは未存在時のみ実行
let computedCalls = 0;
const m1 = new Map();
for (const w of words) {
  m1.getOrInsertComputed(w, () => {
    computedCalls++;
    return 0;
  });
  m1.set(w, m1.get(w) + 1);
}

// 対比: getOrInsert(k, expensive()) は第2引数を毎回「即時評価」する
let eagerCalls = 0;
function expensive() {
  eagerCalls++;
  return 0;
}
const m2 = new Map();
for (const w of words) {
  m2.set(w, m2.getOrInsert(w, expensive()) + 1);
}
```

出力:

```
入力件数: 12, ユニークキー数: 5
[getOrInsertComputed] コールバック呼び出し回数 = 5
  → ユニークキー数(5)と一致: true
[getOrInsert(k, expensive())] expensive() 呼び出し回数 = 12
  → 入力件数(12)と一致（毎回評価される）: true
```

`getOrInsertComputed` のコールバックはユニークキー数と同じ5回。一方 `getOrInsert(k, expensive())` の第2引数は入力件数と同じ12回でした。重い初期化や副作用のある初期値を書くなら `getOrInsertComputed` を使う、という差がはっきり出ました。

### Iterator.concat で中間配列なしに連結する

`Iterator.concat` は複数のイテレータを中間配列を作らずに連結できます。`.filter().map().take()` を繋いで、`take(3)` で早期に止まったときに後続のソースが評価されないか（遅延しているか）を、ソースごとのログで見てみました。

```js:04-iterator-concat.mjs
function* source1() {
  for (let i = 1; i <= 5; i++) { console.log(`  source1 -> ${i}`); yield i; }
}
function* source2() {
  for (let i = 6; i <= 10; i++) { console.log(`  source2 -> ${i}`); yield i; }
}
function* source3() {
  for (let i = 11; i <= 15; i++) { console.log(`  source3 -> ${i}`); yield i; }
}

const it = Iterator.concat(source1(), source2(), source3())
  .filter((n) => n % 2 === 0)   // 偶数だけ
  .map((n) => n * 10);          // 10倍

const result = [];
for (const v of it.take(3)) {   // 先頭3件だけ取得（早期終了）
  result.push(v);
}
console.log('take(3) の結果:', result);
```

出力:

```
== Iterator.concat + filter/map/take（遅延評価） ==
  source1 -> 1
  source1 -> 2
  source1 -> 3
  source1 -> 4
  source1 -> 5
  source2 -> 6
take(3) の結果: [ 20, 40, 60 ]
→ source3 のログが出ていなければ、後続ソースは評価されていない（遅延）
```

`Array.from` を使わずに `Iterator.concat(...).filter().map().take(3)` が動きました。`take(3)` で3件（20, 40, 60）取れた時点で止まり、source2 は `6` を出したところで打ち切り、source3 は一度も評価されていません。遅延がちゃんと効いています。

## 詰まった点：async generator を渡すと throw された

同じ 04 のスクリプトで、`Iterator.concat` に async generator を渡すとどうなるかも試しました。実は事前のメモでは「async iterable を渡すと Promise が要素として入ってくる（値は取り出せないが concat 自体は作れる）」と予想していました。コードもそのつもりで書いていて、こんな感じです。

```js:04-iterator-concat.mjs
async function* asyncGen() { yield 1; yield 2; }
try {
  const bad = Iterator.concat(asyncGen());
  const out = [...bad.take(2)];
  console.log('取り出せた要素:', out.map((x) => x?.constructor?.name ?? typeof x));
} catch (e) {
  console.log('例外:', e.constructor.name, e.message);
}
```

ところが実際の出力はこうでした。

```
== Iterator.concat に async iterable を渡すと？ ==
例外: TypeError [object AsyncGenerator] is not iterable
```

予想と違って、`Iterator.concat(asyncGen())` を呼んだ時点で `TypeError: [object AsyncGenerator] is not iterable` が throw されました。async generator は同期の iterable ではない（`Symbol.iterator` を持たない）ので、concat がそもそも受け付けてくれない、ということみたいです。「Promise が入ってくる」どころか、もっと手前できっぱり弾かれました。

`Iterator.concat` は同期専用、と割り切って使うのが正解でした。非同期のソースを連結したいなら、自前で `async function*` を書いて中で `yield*` する、という別の道になりそうです（そちらは今回は試していません）。

## 分かったこと・既存の書き方との比較

グルーピングのロジックは 4行から1行になりました。行数だけ見ると 01 が28行・02が27行で大差ないんですが、これは出力整形が共通だからで、本質は get-or-set 部分の 4行→1行 です。可読性の面では、`has`/`get`/`set` の分岐が消えて意図（「なければ空配列を入れて push」）が一行で読めるのが良かったです。

速度も気になったので、100万件・ユニークキー1000・5試行の中央値で簡易ベンチを取りました（`--expose-gc` 付き）。結果を HTML にして Playwright でスクショしたのがこちらです。

![簡易ベンチの結果表（集計の時間/メモリと、連結の heap 比較）](/images/node26-map-getorinsert-iterator-concat-try/01-bench-report.png)

```
入力件数=1,000,000, ユニークキー=1000, 試行=5（中央値）
  旧来 (get ?? 0)        中央値 93.7 ms  heapUsed 0.07 MB
  新 (getOrInsert)      中央値 107.2 ms  heapUsed 0.06 MB

== 連結: スプレッド中間配列 vs Iterator.concat（合計を取るだけ） ==
  [...A, ...B]        84.9 ms  追加heap 29.13 MB  sum=999999000000
  Iterator.concat     172.2 ms  追加heap 21.53 MB  sum=999999000000
```

集計の速度は、旧来と `getOrInsert` でほぼ誤差でした（むしろ `getOrInsert` がわずかに遅いくらい）。なので `getOrInsert` の価値は速度ではなく可読性のほうだと思います。連結のほうは、`Iterator.concat` が中間配列を作らないぶん heap を約7.6MB 節約する一方で、要素アクセスのオーバーヘッドで時間はスプレッドより長くなりました。メモリと時間のトレードオフ、という感じです。両者の合計値は一致していました（assert 通過）。

:::message
このベンチは1台のマシンでの簡易計測で、数値は JIT や GC でブレます。あくまで参考値として見てください。速度差については断定しないでおきます。
:::

## まとめ

get-or-set 定型を Node 26 の新メソッドで書き比べて、5つの完了条件（旧版との diff 一致、コールバック回数=ユニークキー数、`Array.from` なしの連結、両版の集計一致、スクショ保存）はすべて確認できました。

使いどころの自分なりの整理:

- 初期値が定数なら `getOrInsert(k, 0)`。ただし第2引数は即時評価なので、重い式や副作用を書いてはいけない。
- 初期値を毎回 new する・重い初期化をするなら `getOrInsertComputed(k, () => ...)`。コールバックは未存在時だけ走る。
- `Iterator.concat` は中間配列を作らずに遅延連結できるが、同期専用。async generator を渡すと `TypeError` で弾かれる。

いちばん印象に残ったのは、async generator が「Promise が入る」ではなく throw された、という予想外れでした。ドキュメントの説明を鵜呑みにせず、呼び出し回数を数えたりエラーを実際に出したりして確かめると、こういう線引きがはっきり分かって良かったです。次は非同期ソースを自前の `async function*` で連結する側を試してみたいと思っています。

## 参考リンク

- [Map.prototype.getOrInsert - MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/getOrInsert)
- [Map.prototype.getOrInsertComputed - MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/getOrInsertComputed)
- [Iterator.concat - MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Iterator/concat)
- [Node.js — Releases](https://nodejs.org/en/about/previous-releases)
