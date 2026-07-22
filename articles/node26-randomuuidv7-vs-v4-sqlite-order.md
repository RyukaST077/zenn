---
title: "Node 26のrandomUUIDv7()とv4を書き比べ、SQLiteの並び順を見た"
emoji: "🆔"
type: "tech"
topics: ["nodejs", "uuid", "sqlite", "crypto"]
published: true
---

## はじめに

Node.js 26 で `crypto.randomUUIDv7()` が使えるようになったと知って、これまで使っていた `randomUUID()`（UUIDv4）と何が違うのか、自分の手元で確かめてみたくなりました。「v7 は時刻順に並ぶからDBの主キーに向いている」という話はよく見かけるのですが、実際にどのくらい並ぶのか数字で見たことがなかったので、生成した文字列を辞書順にソートしたり、`node:sqlite` に入れて `ORDER BY id` で取り出したりして比べてみました。

結論から言うと、通常のペースでINSERTするぶんには v7 は狙いどおり挿入順に並んでくれた一方で、同じミリ秒に大量生成すると順序は保証されない、という当たり前だけど見落としがちな点でつまずきました。この記事はその過程の記録です。

:::message
筆者は実務経験の浅いエンジニアで、UUIDv7 を触るのは初めてです。実行環境は macOS (Darwin 25.5.0, arm64) / Node.js v26.5.0。以下の数値はすべてこの環境での観測値で、件数やマシンによって多少ぶれます。
:::

## 使ったもの・環境

- Node.js **v26.5.0**（`randomUUIDv7` は 26.1.0 で追加されたので、それ以上が必要）
- 標準モジュールのみ。追加ライブラリはなし（`node:crypto` と `node:sqlite`）
- 依存ゼロの `.mjs` スクリプトをいくつか書いて、CLIの標準出力で結果を確認しました

やりたかったのは次の3つです。

1. v4 と v7 を生成して、辞書順ソートが生成順とどれだけ一致するか
2. v7 の先頭からタイムスタンプを復元できるか
3. `node:sqlite` の `ORDER BY id`（TEXT主キー）が挿入順とどれだけ一致するか

## 環境構築

最初に `node -v` を叩いたら、手元の既定は v22.17.0 でした。この状態で `randomUUIDv7` を触ろうとすると、そもそも関数が存在しません。

```bash
$ node -v
v22.17.0
$ node -e "const c=require('crypto');console.log(typeof c.randomUUIDv7)"
undefined
```

`is not a function` ですらなく `undefined` です。追加が 26.1.0 なので、22系には関数ごと無いということでした。nvm が入っていたので 26.5.0 に切り替えました。

```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
nvm install 26.5.0 && nvm use 26.5.0
node -v            # → v26.5.0
```

```
Now using node v26.5.0 (npm v11.17.0)
```

次に、`randomUUIDv7` が実行時に警告を出さないか、オプション引数があるかを確認しました。

```bash
$ node -e "const c=require('node:crypto'); console.log('typeof randomUUIDv7 =',typeof c.randomUUIDv7); console.log('typeof randomUUID   =',typeof c.randomUUID)"
typeof randomUUIDv7 = function
typeof randomUUID   = function
$ node -e "const c=require('node:crypto'); console.log('randomUUIDv7.length =',c.randomUUIDv7.length); console.log('options受理OK:',c.randomUUIDv7({disableMonotonicity:true}))"
randomUUIDv7.length = 1
options受理OK: 019f8b3c-21e2-7cc5-b650-7687793d436d
```

`.length` が 1 なので引数を1つ取ること、`{ disableMonotonicity: true }` が例外なく受理されることが分かりました。ExperimentalWarning のような警告は出ませんでした。ここで `disableMonotonicity` というオプションが実在することに気づいて、Node が「単調性（monotonicity）」の概念を持っているらしいと分かったので、あとで実測することにしました。

`node:sqlite` のほうも確認しておきました。古い記事だと `--experimental-sqlite` フラグが要るとされていますが、この環境ではフラグなし・警告なしで import できました。

```bash
$ node --input-type=module -e "import('node:sqlite').then(m=>console.log('typeof DatabaseSync =', typeof m.DatabaseSync))"
typeof DatabaseSync = function
```

まず Hello World で v7 と v4 を1つずつ出して、見た目を比べました。

```js:hello.mjs
import { randomUUIDv7, randomUUID } from 'node:crypto';

const v7 = randomUUIDv7();
const v4 = randomUUID();

console.log('v7:', v7);
console.log('v4:', v4);
// UUIDの13文字目(index14)がバージョン桁。v7なら'7'、v4なら'4'。
console.log('v7 version digit (idx14):', v7[14]);
console.log('v4 version digit (idx14):', v4[14]);
```

```
v7: 019f8b3c-7d73-7643-8eec-8b67199c4a0c
v4: 41a8c1a0-c58a-4687-9658-b9f0e7a91fec
v7 version digit (idx14): 7
v4 version digit (idx14): 4
```

v7 は先頭が `019f8b3c...` とタイムスタンプ由来で、続けて生成すると先頭が揃います。v4 は完全にランダム。index14 のバージョン桁で見分けられます。

## v4とv7を生成して比較する（本編）

最初にやったのは「各1000件生成して、配列を辞書順にソートしたとき、生成順の位置にぴたり戻る割合」を数えることでした。v7 は時刻順なので高い一致率になるはず、という予想です。

```js:gen-compare.mjs
import { randomUUIDv7, randomUUID } from 'node:crypto';

const N = 1000;

function genSequence(genFn) {
  const arr = [];
  for (let i = 0; i < N; i++) {
    arr.push({ i, id: genFn() });
  }
  return arr;
}

// 辞書順ソート後、要素が元の生成順(index)と同じ位置にある件数を数える
function matchRateAfterSort(arr) {
  const sorted = [...arr].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  let match = 0;
  for (let pos = 0; pos < sorted.length; pos++) {
    if (sorted[pos].i === pos) match++;
  }
  return { match, total: arr.length, rate: match / arr.length };
}
```

結果はこうでした。

```
生成件数: 1000 件ずつ
--- v7 (randomUUIDv7) ---
  辞書順ソート後、生成順と同じ位置: 3/1000 = 0.30%
--- v4 (randomUUID) ---
  辞書順ソート後、生成順と同じ位置: 0/1000 = 0.00%
[参考] v7 先頭3件: [ '019f8b3d-5d55-796e-...','019f8b3d-5d55-7ccf-...','019f8b3d-5d55-7c98-...' ]
```

予想が外れました。v7 が高い一致率になると思っていたのに 0.30% です。参考の先頭3件を見ると、`7ccf` のあとに `7c98` が来ていて、同じ先頭（`019f8b3d-5d55`）の中で逆転しています。1000件がほんの数msの間に生成されて、同じミリ秒の中に大量に詰まったせいだと当たりはつきましたが、この時点では確信が持てなかったので、あとで原因を切り分けることにしました。

## v7の先頭からタイムスタンプを復元する

UUIDv7 は RFC 9562 で「先頭48bit = unix_ts_ms」と定義されています。本当に生成時刻が埋まっているのか、先頭12桁のhexを `parseInt(hex, 16)` で戻して確かめました。

```js:extract-ts.mjs
import { randomUUIDv7 } from 'node:crypto';

function extractUnixMs(uuid) {
  // 019f8b3c-7d73-7643-... → ハイフン除いた先頭12桁が unix_ts_ms(48bit)
  const hex = uuid.replace(/-/g, '').slice(0, 12);
  return parseInt(hex, 16);
}

const samples = 5;
let maxErr = 0;
for (let i = 0; i < samples; i++) {
  const before = Date.now();
  const uuid = randomUUIDv7();
  const after = Date.now();
  const restored = extractUnixMs(uuid);
  const err = restored < before ? before - restored : restored > after ? restored - after : 0;
  maxErr = Math.max(maxErr, err);
}
```

出力（#1のみ抜粋）:

```
#1 uuid=019f8b3d-5e08-7334-ab69-5e88222c8a91
    復元ms=1784747482632 (2026-07-22T19:11:22.632Z)
    生成時刻 Date.now(): before=1784747482632 after=1784747482632  範囲外誤差=0ms
...
最大誤差: 0ms（0なら復元値が生成時のミリ秒レンジにぴたり収まった）
```

復元コードは実質3行で、生成時の `Date.now()` のレンジにぴたり収まりました（最大誤差0ms）。主キーから生成時刻が読めるのは、ログの相関やレンジ検索を考えると便利そうです。v4 にはこの情報はありません。

## SQLiteで並び順を検証する

次に `node:sqlite` の `DatabaseSync` を使い、v4/v7 を TEXT の主キーとしてファイルDBに1000件ずつINSERTして、`ORDER BY id` の並びが挿入順とどれだけ一致するかを見ました。

```js:sqlite-order.mjs
import { DatabaseSync } from 'node:sqlite';

const N = 1000;
const dbPath = new URL('./uuid-order.sqlite', import.meta.url).pathname;

const db = new DatabaseSync(dbPath);
db.exec('DROP TABLE IF EXISTS v7t; DROP TABLE IF EXISTS v4t;');
db.exec('CREATE TABLE v7t (id TEXT PRIMARY KEY, seq INTEGER);');
db.exec('CREATE TABLE v4t (id TEXT PRIMARY KEY, seq INTEGER);');

const { randomUUIDv7, randomUUID } = await import('node:crypto');

const insV7 = db.prepare('INSERT INTO v7t (id, seq) VALUES (?, ?)');
const insV4 = db.prepare('INSERT INTO v4t (id, seq) VALUES (?, ?)');
for (let i = 0; i < N; i++) {
  insV7.run(randomUUIDv7(), i);   // seq = 挿入順
  insV4.run(randomUUID(), i);
}

// ORDER BY id (TEXT=辞書順) で取り出したときの seq が 0,1,2,... と昇順か
function orderMatch(table) {
  const rows = db.prepare(`SELECT id, seq FROM ${table} ORDER BY id`).all();
  let match = 0;
  for (let pos = 0; pos < rows.length; pos++) {
    if (rows[pos].seq === pos) match++;
  }
  return { match, total: rows.length, rate: match / rows.length, firstSeqs: rows.slice(0, 5).map(r => r.seq) };
}
```

結果:

```
件数: 1000 件ずつ INSERT / DBファイル: .../workspace/uuid-order.sqlite
--- v7t: ORDER BY id が挿入順と一致 ---
  1000/1000 = 100.00%  先頭5件のseq=[0,1,2,3,4]
--- v4t: ORDER BY id が挿入順と一致 ---
  2/1000 = 0.20%  先頭5件のseq=[840,926,599,258,804]
```

今度は v7 が 100% で挿入順どおりに並びました。v4 は 0.20% で、先頭5件の seq が `[840,926,599,258,804]` とバラバラです。TEXT主キーなので並びは文字列の辞書順なのですが、v7 だとそれが挿入順とほぼ一致します。

ただ、さっきの `gen-compare.mjs` が 0.30% だったのに、こっちは 100%。同じ v7 なのに真逆の結果になったのが引っかかりました。

## つまずいた点と、原因の切り分け

引っかかった点をそのまま書くと、次の2つでした。

1つめは、環境の Node が古くて `randomUUIDv7` が `undefined` だったこと。これは冒頭に書いたとおり 26.1.0 で追加された関数なので、22系では存在しないというだけの話でした。バージョンを最初に確認しておくのは大事だと素直に思いました。

2つめが本題で、「v7を辞書順ソートしても生成順と一致しない（0.30%）のに、SQLiteでは100%」という食い違いです。仮説は「SQLiteへのINSERTが生成を遅くして、各IDが別のミリ秒に分かれたから並ぶ」でした。これを確かめるために、1000件を(a)純粋に生成するだけ、(b)メモリDBへINSERTしながら、の2通りで作り、それぞれ「distinct なミリ秒数」と所要時間を測りました。

```js:why-sqlite-100.mjs
import { randomUUIDv7 } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const N = 1000;
function msPrefix(u) { return u.replace(/-/g, '').slice(0, 12); }

// (a) 純生成
{
  const t0 = process.hrtime.bigint();
  const arr = [];
  for (let i = 0; i < N; i++) arr.push(randomUUIDv7());
  const t1 = process.hrtime.bigint();
  const distinct = new Set(arr.map(msPrefix)).size;
  console.log(`(a) 純生成 ${N}件: 所要 ${(Number(t1 - t0) / 1e6).toFixed(2)}ms / distinct ms: ${distinct} 個`);
}

// (b) INSERT付き
{
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE t (id TEXT PRIMARY KEY, seq INTEGER)');
  const ins = db.prepare('INSERT INTO t (id, seq) VALUES (?, ?)');
  const arr = [];
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < N; i++) { const u = randomUUIDv7(); ins.run(u, i); arr.push(u); }
  const t1 = process.hrtime.bigint();
  const distinct = new Set(arr.map(msPrefix)).size;
  console.log(`(b) INSERT付き ${N}件: 所要 ${(Number(t1 - t0) / 1e6).toFixed(2)}ms / distinct ms: ${distinct} 個`);
  db.close();
}
```

```
(a) 純生成1000件:        5.76ms / distinct ms 5個（≒200件/ms）
(b) メモリDB INSERT付き:  16.79ms / distinct ms 13個（≒77件/ms）
```

純生成だと1000件がわずか5.76msで作られ、ミリ秒の種類は5個しかありません。つまり1msあたり約200件が同じ先頭に詰まっています。INSERTを挟むと少し遅くなって13個に分散します。ファイルDBだとさらに遅くなり、各IDが別のミリ秒に落ちて、先ほどの `sqlite-order.mjs` では `ORDER BY id` が挿入順と100%一致していました（間隔そのものは今回は数値化していません）。要するに、生成ペースが1件/msを下回るほど各IDが別のミリ秒に落ちて、辞書順=生成順になる、ということでした。

## 分かったこと・比較

もう一つ気になったのが `disableMonotonicity` オプションです。同じミリ秒内でも v7 は単調増加してくれるのか、実測しました。全文字列で比べるとタイムスタンプの差が混ざるので、先頭48bit（先頭12hex）が同一のペアだけに絞って、隣接ペアが昇順か逆転かを数えるようにしました。

```js:verify-monotonic.mjs
import { randomUUIDv7 } from 'node:crypto';

const N = 200000;
function tsPrefix(u) { return u.replace(/-/g, '').slice(0, 12); }

function analyze(genFn, label) {
  const arr = new Array(N);
  for (let i = 0; i < N; i++) arr[i] = genFn();
  let sameMsPairs = 0, sameMsDesc = 0;
  for (let i = 1; i < N; i++) {
    if (tsPrefix(arr[i]) === tsPrefix(arr[i - 1])) {
      sameMsPairs++;
      if (arr[i] < arr[i - 1]) sameMsDesc++;
    }
  }
  console.log(`--- ${label} ---`);
  console.log(`  同一ms隣接ペア: ${sameMsPairs} / 逆転: ${sameMsDesc} = ${(sameMsDesc / sameMsPairs * 100).toFixed(2)}%`);
}

analyze(() => randomUUIDv7(), '既定 randomUUIDv7()');
analyze(() => randomUUIDv7({ disableMonotonicity: true }), 'disableMonotonicity:true');
```

```
[verify-monotonic.mjs] 同一ms隣接ペアのみ（20万件）
  既定:                同一msペア199809 / 逆転99983 → 逆転率 50.04%
  disableMonotonicity: 同一msペア199859 / 逆転99875 → 逆転率 49.97%
```

意外だったのは、既定の `randomUUIDv7()` でも同一ミリ秒内はおよそ50%が逆転していたことです。単調性が効いているなら逆転は0に近くなるはずだと思っていたので、これは予想と違いました。`disableMonotonicity: true` を付けても実測の差はほとんど無く、どちらも50%前後。Node v26.5.0 のこの観測では、少なくとも「同一ms内の狭義の増加」としては単調性が効いているようには見えませんでした。オプションが何のためにあるのか、実装の意図までは分からないままです。ここは断定できないので、観測値だけ置いておきます。

参考までに、隣接する10万件の全文字列での逆転もほぼ半々でした（既定49908 / disableMonotonicity 49817）。

まとめると、今回の観測範囲での結論は次のとおりです。

| 観点 | v7 (`randomUUIDv7`) | v4 (`randomUUID`) |
|---|---|---|
| 辞書順ソートで生成順に戻る（純生成1000件） | 0.30% | 0.00% |
| SQLite `ORDER BY id` が挿入順と一致（1000件） | 100.00% | 0.20% |
| 先頭からのタイムスタンプ復元 | できる（誤差0ms） | 不可 |
| 同一ms内の順序（20万件） | 約50%逆転 | ― |

「v7はソート可能」というのは、ミリ秒粒度での話でした。実務でありそうな通常のINSERT（およそ1件/ms以下のペース）では `ORDER BY id` が挿入順と100%一致した一方で、同じミリ秒に大量生成すると順序は保証されず、この環境では約50%が逆転しました。並ぶかどうかは生成ペースに依存する、というのが自分の得た実務的な感触です。

## まとめ

- Node 26 の `randomUUIDv7()` を v4 と書き比べ、辞書順ソート・タイムスタンプ復元・SQLiteの並び順で違いを見ました。狙っていた検証はひととおりできました。
- 通常ペースなら v7 は DB の `ORDER BY id` と挿入順が一致し、主キーから生成時刻も復元できる。この点は v4 より扱いやすそうです。
- ただし「完全にソート可能」は言い過ぎで、同一ミリ秒に大量生成すると崩れます。数値は Node v26.5.0・macOS・1件/ms前後という自分の観測範囲のもので、バージョンやマシンで変わりうる点は割り引いてください。
- 次は、実際にPostgreSQLなど別のDBやBINARY(16)での格納だとどうなるか、あるいは高負荷時の実挙動を試してみたいです。

## 参考リンク

- Node.js `crypto` ドキュメント（`randomUUIDv7` / `randomUUID`）
  https://nodejs.org/docs/latest-v26.x/api/crypto.html#cryptorandomuuidv7options
- Node.js `node:sqlite` ドキュメント（`DatabaseSync`）
  https://nodejs.org/docs/latest-v26.x/api/sqlite.html
- RFC 9562: Universally Unique IDentifiers (UUIDs) — UUIDv7 の定義
  https://www.rfc-editor.org/rfc/rfc9562.html
