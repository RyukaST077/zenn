---
title: "Deno 2.9のDeno.test.each()とt.assertSnapshot()をnode:testと書き比べた"
emoji: "🧪"
type: "tech"
topics: ["deno", "nodejs", "typescript", "test"]
published: true
---

<!-- 前提: 出典ログ logs/run-deno29-test-each-snapshot-20260814-0410/execution-log.md / 記事タイプ: 試してみた・検証ログ / slug: deno29-test-each-snapshot / published: false -->

## はじめに

Deno 2.9 でテストランナーに `Deno.test.each()` とスナップショット用の `t.assertSnapshot()` が入りました。自分はふだん `node:test` を使っていて、パラメータ化テストを書くときは毎回 `for...of` とテスト名のテンプレート文字列を手で書いていたので、標準機能でそこが埋まるならどれくらい楽になるのか気になって手元で試しました。

やったことは、同じ対象コード（`add()` と `renderHeader()`）に対して Deno 版のテスト4本と Node 版のテスト4本を書き、行数・テスト名の出方・失敗時の出力・スナップショットの更新フローを見比べた、というだけです。結果としては欲しかったものは全部動いたんですが、事前に立てた予想6件のうち4件が外れました。特にスナップショットは「初回実行で自動生成される」と思い込んでいて、そこで一番時間を使いました。

:::message
筆者は新人で、`Deno.test.each()` も `t.assertSnapshot()` も今回が初めてです。Deno 2.9 については以前 `deno task` のキャッシュと package/lock 周りを別記事で触りましたが、今回はテスト機能だけを見ています。実行環境は macOS 26.5 (arm64) / deno 2.9.5 / Node v26.7.0 と v22.17.0。
:::

## 使ったもの・環境

| 項目 | 値 |
|---|---|
| OS | macOS 26.5 (Build 25F71) / arm64 |
| Deno | 2.8.3 → 2.9.5 (stable, aarch64-apple-darwin) / v8 15.0.245.2-rusty / typescript 6.0.3 |
| Node.js | v26.7.0 (npm 11.19.0) と v22.17.0 (npm 10.9.2)、nvm 経由 |
| Deno 側の依存 | `jsr:@std/assert@1`（実際に解決されたのは 1.0.19、`@std/internal` 1.0.14 を巻き込む） |
| Node 側の依存 | なし（標準モジュールのみ） |

対象コードはこれだけです。Deno 用に `.ts`、Node 用に同じ内容の `.js` を置きました。Node は `.ts` を読めないだろうと決め打ちしたためです。

```ts:src/add.ts
export function add(a: number, b: number): number {
  return a + b;
}
```

```ts:src/render.ts
export function renderHeader({ title }: { title: string }): string {
  return `<header><h1>${title}</h1></header>`;
}
```

「できた」と言える条件は、①deno 2.9 系に上がっている ②`.each()` のケースがケース単位の個別テスト名で出る ③`__snapshots__/*.snap` が生成され、出力を変えると失敗して差分が出て、更新して再パスするまでが揃う ④Node でも同等シナリオが動く ⑤4観点の比較表が埋まる、の5つに置きました。

## 事前に調べたこと

[Deno 2.9 のリリースブログ](https://deno.com/blog/v2.9)を読んで、`.each()` の名前補間には2系統あることを控えました。

- 配列ケース（`[[1, 2, 3], ...]`）は位置引数として展開され、名前は printf 風のトークン（`%s` `%i`/`%d` `%f` `%j` `%o`）で補間する。ケース番号は `%#`
- オブジェクトケース（`[{ a: 1 }, ...]`）は単一引数で渡り、`$key` / `$key.nested` で補間する
- `Deno.test.only.each` / `Deno.test.ignore.each` もある
- `t.assertSnapshot()` は import 不要。保存先は `__snapshots__/<test file>.snap`。不一致時は差分を出して `deno test --update-snapshots [files]...` を案内。既定の場所なら read/write の権限フラグは不要。フル実行で未使用エントリを prune する

読んだ時点で確かめたくなったのは、`%#` が本当に使えるか、`$a.b` のネストが効くか、配列ケースに `$key` を書いたらどうなるか、「権限フラグ不要」は本当か、「フル実行で prune」の"フル実行"に `-u` は要るのか、の5点でした。

Node 側は [`node:test` のドキュメント](https://nodejs.org/api/test.html)を見て、まず `test.each()` 相当のパラメータ化 API が存在しないことを確認しました。スナップショットは `context.assert.snapshot(value[, options])` が v22.3.0 追加 / v23.4.0 で stable、保存先はテストファイル名 + `.snapshot`、更新は `--test-update-snapshots`。ここで自分は「手元の 22.17.0 は v22.3.0 より新しいけど v23.4.0 より古いから、`--experimental-test-snapshots` を要求されるだろう」と考えていました。これは後で外れます。

## 環境構築

手元の deno は 2.8.3 だったので、まず現状を記録しました。

```bash
{ deno --version; which -a deno; node --version; npm --version; sw_vers; uname -m; } 2>&1 | tee logs/00-before-versions.txt
```

```
deno 2.8.3 (stable, release, aarch64-apple-darwin)
v8 14.9.207.2-rusty
typescript 6.0.3
--- which -a deno ---
/opt/homebrew/bin/deno
--- node ---
v22.17.0
--- npm ---
10.9.2
--- os ---
ProductName:		macOS
ProductVersion:		26.5
BuildVersion:		25F71
arm64
```

`which -a deno` を一緒に出しておいたのが結果的に良くて、次のエラーの原因がすぐ分かりました。

公式の案内どおり `deno upgrade` を叩いたら、断られました。

```bash
deno upgrade
```

```
error: This deno was built without the "upgrade" feature. Please upgrade using the installation method originally used to install Deno.
```

自分が予想していたのは「Homebrew 管理を検出したから拒否された」というものだったんですが、書いてあることは違いました。Homebrew が配っている deno バイナリは upgrade 機能そのものを外してビルドされているので、「入れた方法で上げ直せ」としか言えないわけです。拒否ではなく、その機能が入っていない。

`/opt/homebrew/bin/deno` だと分かっているので、そのまま brew で上げました。

```bash
brew update && brew upgrade deno
deno --version
```

```
==> Upgrading deno
  2.8.3 -> 2.9.5
🍺  /opt/homebrew/Cellar/deno/2.9.5: 12 files, 157.4MB
...
deno 2.9.5 (stable, release, aarch64-apple-darwin)
v8 15.0.245.2-rusty
typescript 6.0.3
```

これで 2.9.5 になりました。時間のほとんどは `brew update`（portable-ruby の引き直しと tap の更新）で、deno 本体を入れる部分は速いです。あと `brew upgrade deno` は依存も巻き込むので、今回は jpeg-turbo / giflib / libpng / webp / libtiff / sqlite、それに関係のない `yt-dlp` まで一緒に上がりました。検証用に1個だけ上げたいときは、これは知っておいた方がいい挙動でした。

Node 側は 26.7.0 を使いたかったので nvm で切り替えます。参照していた資料には `nvm install 26` と書いてあったんですが、自分の環境には既に入っていたのでダウンロードは発生しませんでした。

```bash
source ~/.nvm/nvm.sh && nvm use 26.7.0 && node --version
```

```
Now using node v26.7.0 (npm v11.19.0)
v26.7.0
```

## 実際に試したこと

### 配列ケースで書いてみる

まず `add()` を4ケース。これで12行です。

```ts:tests_deno/add_test.ts
import { assertEquals } from "jsr:@std/assert@1";
import { add } from "../src/add.ts";

Deno.test.each([
  [1, 2, 3],
  [0, 0, 0],
  [-1, 1, 0],
  [10, 32, 42],
])("add(%i, %i) = %i", (a, b, expected) => {
  assertEquals(add(a, b), expected);
});
```

```bash
deno test tests_deno/add_test.ts
```

```
running 4 tests from ./tests_deno/add_test.ts
add(1, 2) = 3 ... ok (1ms)
add(0, 0) = 0 ... ok (103µs)
add(-1, 1) = 0 ... ok (94µs)
add(10, 32) = 42 ... ok (79µs)

ok | 4 passed | 0 failed (13ms)
```

`4 passed` なので、ケースごとに独立したテストとして登録されています。名前も `%i` が展開されている。ここで一番うれしかったのは `--filter` が補間後の名前で効くことでした。

```bash
deno test --filter "add(1, 2)" tests_deno/add_test.ts
```

```
running 1 test from ./tests_deno/add_test.ts
add(1, 2) = 3 ... ok (1ms)

ok | 1 passed | 0 failed | 3 filtered out (12ms)
```

`3 filtered out` と出ているので、本当に1ケースだけ走っています。手書きループでも名前をテンプレート化すれば同じことはできますが、そのテンプレートを自分で書くかどうかは自分次第です。

### オブジェクトケースと、取り違えたときの挙動

事前に気になっていた `%#` とネスト、それと「取り違えたらどうなるか」をまとめて1ファイルで試しました。

```ts:tests_deno/each_object_test.ts
import { assertEquals } from "jsr:@std/assert@1";
import { add } from "../src/add.ts";

// オブジェクトケース: $key 補間
Deno.test.each([
  { a: 1, b: 1, sum: 2 },
  { a: 2, b: 3, sum: 5 },
])("$a + $b = $sum", ({ a, b, sum }) => {
  assertEquals(add(a, b), sum);
});

// %# (インデックス) をオブジェクトケースで
Deno.test.each([
  { a: 7, b: 3, sum: 10 },
  { a: 8, b: 4, sum: 12 },
])("case %#: $a + $b", ({ a, b, sum }) => {
  assertEquals(add(a, b), sum);
});

// ネストした $key.nested
Deno.test.each([
  { input: { a: 1, b: 2 }, sum: 3 },
  { input: { a: 5, b: 5 }, sum: 10 },
])("nested $input.a + $input.b = $sum", ({ input, sum }) => {
  assertEquals(add(input.a, input.b), sum);
});

// 配列ケースに $key を使ったら？（取り違えパターン）
Deno.test.each([
  [1, 2, 3],
])("MISUSE array-case with $a + $b = $sum", (a, b, expected) => {
  assertEquals(add(a, b), expected);
});

// オブジェクトケースに %s を使ったら？（取り違えパターン）
Deno.test.each([
  { a: 1, b: 2, sum: 3 },
])("MISUSE object-case with %s and %i", ({ a, b, sum }) => {
  assertEquals(add(a, b), sum);
});

// %j / %o / %# を配列ケースで
Deno.test.each([
  [{ x: 1 }, "one"],
  [{ x: 2 }, "two"],
])("idx=%# json=%j obj=%o str=%s", (_obj, _label) => {
  assertEquals(1, 1);
});
```

```
running 10 tests from ./tests_deno/each_object_test.ts
1 + 1 = 2 ... ok (2ms)
2 + 3 = 5 ... ok (110µs)
case 0: 7 + 3 ... ok (155µs)
case 1: 8 + 4 ... ok (77µs)
nested 1 + 2 = 3 ... ok (181µs)
nested 5 + 5 = 10 ... ok (97µs)
MISUSE array-case with undefined + undefined = undefined ... ok (114µs)
MISUSE object-case with [object Object] and NaN ... ok (146µs)
idx=0 json={"x":1} obj=one str=undefined ... ok (126µs)
idx=1 json={"x":2} obj=two str=undefined ... ok (82µs)

ok | 10 passed | 0 failed (16ms)
```

気になっていた点はだいたい効きました。`$input.a` のネストは通るし、`%#` はオブジェクトケースでも使えて 0 始まりです。

問題は下4行です。配列ケースに `$a` を書くとテスト名が `undefined` になり、オブジェクトケースに `%s` を書くと `[object Object]`、`%i` は `NaN` になります。それでいて全部 `ok` です。エラーにならないし、警告も出ない。テストの中身は正しいので緑になるのは筋が通っているんですが、名前が壊れたまま気づかずコミットしそうだと思いました。テスト名に `undefined` や `NaN` が混じっていたら補間記法を疑う、という読み方をおぼえておくことにしました。

printf トークンの消費のしかたも実測しないと分からない部分でした。`idx=%# json=%j obj=%o str=%s` に `[{x:1}, "one"]` を渡すと、`%j` が1番目の引数、`%o` が2番目の `"one"`（オブジェクトではない）、`%s` は引数切れで `undefined` になります。`%#` は引数を消費しません。つまり位置引数を順に食っていくだけで、トークンの種類が引数を選んでくれるわけではないです。

### わざと1ケースだけ落とす

`add_test.ts` をコピーして、`add(-1, 1)` のケースの期待値だけ `0` → `99` に変えた `add_fail_test.ts` を実行しました。

```
running 4 tests from ./tests_deno/add_fail_test.ts
add(1, 2) = 3 ... ok (1ms)
add(0, 0) = 0 ... ok (109µs)
add(-1, 1) = 99 ... FAILED (73ms)
add(10, 32) = 42 ... ok (120µs)

 ERRORS 

add(-1, 1) = 99 => ./tests_deno/add_fail_test.ts:10:2
error: AssertionError: Values are not equal.


    [Diff] Actual / Expected


-   0
+   99

  throw new AssertionError(message);
        ^
    at assertEquals (https://jsr.io/@std/assert/1.0.19/equals.ts:67:9)
    at file:///.../tests_deno/add_fail_test.ts:11:3

 FAILURES 

add(-1, 1) = 99 => ./tests_deno/add_fail_test.ts:10:2

FAILED | 3 passed | 1 failed (86ms)

error: Test failed
```

落ちたケースがどの入力だったかは名前だけで分かります。ただ行番号は `.each()` の呼び出し位置（10:2）を指すので、ケース配列の何行目が壊れているかまでは教えてくれません。

### スナップショットを生成する

ここで一番詰まりました。まずこう書いて、型チェックで落ちました。

```ts
Deno.test.each([
  { title: "Hello" },
  { title: "こんにちは" },
])("renderHeader $title", async (t, { title }) => {
  await t.assertSnapshot(renderHeader({ title }));
});
```

```
Check tests_deno/render_test.ts
TS2339 [ERROR]: Property 'title' does not exist on type 'TestContext'.
])("renderHeader $title", async (t, { title }) => {
                                      ~~~~~
    at file:///.../tests_deno/render_test.ts:10:39

TS2339 [ERROR]: Property 'assertSnapshot' does not exist on type '{ readonly title: "Hello"; } | { readonly title: "こんにちは"; }'.
  await t.assertSnapshot(renderHeader({ title }));
          ~~~~~~~~~~~~~~
    at file:///.../tests_deno/render_test.ts:11:11

Found 2 errors.

error: Type checking failed.

  info: The program failed type-checking, but it still might work correctly.
  hint: Re-run with --no-check to skip type-checking.
```

素の `Deno.test("name", async (t) => ...)` は `t` が第1引数なので、`.each()` でも同じだと思い込んでいました。実際は逆で、ケース引数が先、`TestContext` が最後です。1つ目のエラーだけ見ていると「TestContext に title が無い」しか言っていないので気づきにくくて、2つ目の「case オブジェクトに `assertSnapshot` が無い」が実質のヒントでした。引数を入れ替えたら通りました。

```ts:tests_deno/render_test.ts
import { renderHeader } from "../src/render.ts";

Deno.test("renders the header", async (t) => {
  await t.assertSnapshot(renderHeader({ title: "Deno 2.9" }));
});

// .each + TestContext: ケース引数が先、TestContext は最後
Deno.test.each([
  { title: "Hello" },
  { title: "こんにちは" },
])("renderHeader $title", async ({ title }, t) => {
  await t.assertSnapshot(renderHeader({ title }));
});
```

型が通ったので、そのまま `deno test` すればスナップショットが生成されると思っていました。されません。

```
running 3 tests from ./tests_deno/render_test.ts
renders the header ... FAILED (6ms)
renderHeader Hello ... FAILED (985µs)
renderHeader こんにちは ... FAILED (811µs)

 ERRORS 

renders the header => ./tests_deno/render_test.ts:3:6
error: AssertionError: Missing snapshot file.
  await t.assertSnapshot(renderHeader({ title: "Deno 2.9" }));
          ^
    at assertSnapshot (ext:cli/40_test_snapshot.js:353:11)
    at TestContext.assertSnapshot (ext:cli/40_test.js:772:14)
    at file:///.../tests_deno/render_test.ts:4:11
（renderHeader Hello / こんにちは も同じ Missing snapshot file.）

FAILED | 0 passed | 3 failed (21ms)

error: Test failed
```

```
$ ls -la tests_deno/__snapshots__/
ls: tests_deno/__snapshots__/: No such file or directory
```

ディレクトリすら作られていません。困ったのは、この `Missing snapshot file.` が対処方法を何も言ってくれないことです（後で分かりますが、不一致のときはちゃんと `--update-snapshots` を案内してくれます）。ドキュメントを読み返して `-u` を付けたら生成されました。

```bash
deno test -u tests_deno/render_test.ts
```

```
running 3 tests from ./tests_deno/render_test.ts
renders the header ... ok (1ms)
renderHeader Hello ... ok (164µs)
renderHeader こんにちは ... ok (79µs)

 > 3 snapshots updated.

ok | 3 passed | 0 failed (28ms)
```

中身はこうなっていました。

```js:tests_deno/__snapshots__/render_test.ts.snap
export const snapshot = {};

snapshot[`renders the header 1`] = `"<header><h1>Deno 2.9</h1></header>"`;

snapshot[`renderHeader Hello 1`] = `"<header><h1>Hello</h1></header>"`;

snapshot[`renderHeader こんにちは 1`] = `"<header><h1>こんにちは</h1></header>"`;
```

`.each()` で作ったケースも、補間後の名前がそのままキーになります（`renderHeader Hello 1`）。日本語もそのままキーです。あと事前に確かめたかった「既定の場所なら権限フラグ不要」は本当で、`--allow-write` も `--allow-read` も一度も要求されませんでした。

ちなみにこのスナップショットが守っているのは、こういう見た目の HTML です。`renderHeader({ title: "Deno 2.9" })` の出力を最小のページに埋めて Playwright でスクショを撮りました。

![renderHeader の出力を最小ページで表示したもの](/images/deno29-test-each-snapshot/01-render-header.png)

### 変更 → 失敗 → 更新 → 再パス

`src/render.ts` の出力に `class="site-header"` を足してから、同じテストを実行しました。

```
renders the header => ./tests_deno/render_test.ts:3:6
error: AssertionError: Snapshot does not match:

    [Diff] Actual / Expected

+   '<header class="site-header"><h1>Deno 2.9</h1></header>'
-   "<header><h1>Deno 2.9</h1></header>"

To update snapshots, run
    deno test --update-snapshots [files]...

  await t.assertSnapshot(renderHeader({ title: "Deno 2.9" }));
          ^
    at assertSnapshot (ext:cli/40_test_snapshot.js:365:9)
    at TestContext.assertSnapshot (ext:cli/40_test.js:772:14)
    at file:///.../tests_deno/render_test.ts:4:11
```

こっちはちゃんと更新方法を案内してくれます。案内どおりに更新して、再実行するとパスします。

```
$ deno test -u tests_deno/render_test.ts
 > 3 snapshots updated.
ok | 3 passed | 0 failed (14ms)

$ deno test tests_deno/render_test.ts
ok | 3 passed | 0 failed (14ms)
```

`.snap` の差分はこうなりました。

```diff
--- a/logs/snap-before.snap
+++ b/tests_deno/__snapshots__/render_test.ts.snap
@@ -1,7 +1,7 @@
 export const snapshot = {};
 
-snapshot[`renders the header 1`] = `"<header><h1>Deno 2.9</h1></header>"`;
+snapshot[`renders the header 1`] = `'<header class="site-header"><h1>Deno 2.9</h1></header>'`;
 
-snapshot[`renderHeader Hello 1`] = `"<header><h1>Hello</h1></header>"`;
+snapshot[`renderHeader Hello 1`] = `'<header class="site-header"><h1>Hello</h1></header>'`;
 
-snapshot[`renderHeader こんにちは 1`] = `"<header><h1>こんにちは</h1></header>"`;
+snapshot[`renderHeader こんにちは 1`] = `'<header class="site-header"><h1>こんにちは</h1></header>'`;
```

値に `"` が入ると囲みが `'` に切り替わって、エスケープしない形になっています。`.snap` はそのまま読める JS なので、差分を目で追うのは楽でした。

### prune がいつ走るか

ドキュメントの「フル実行で未使用エントリを prune」の"フル実行"に `-u` が要るのか気になったので、`.snap` に使われないエントリを手で足して確かめました。

```js
snapshot[`obsolete entry 1`] = `"stale"`;
```

```
$ deno test tests_deno/          # -u なしフル実行
FAILED | 20 passed | 1 failed (382ms)
（.snap に obsolete entry 1 が残存）

$ deno test -u tests_deno/       # -u 付きフル実行
 > 1 snapshot removed.
   • obsolete entry 1
FAILED | 20 passed | 1 failed (384ms)
（.snap から obsolete entry 1 が消えた）
```

読み取り専用の実行では消しません。`-u` を付けたフル実行のときだけです。安全側に倒しているのは納得なんですが、ドキュメントの文面からは読み取れませんでした。あともう一つ、他のテストが落ちていても（`1 failed` のまま）prune 自体は走っていました。

## 詰まった点

### `nvm use` が次のコマンドに効いていなかった

Node 側を書き始めて最初に踏んだのはこれです。26.7.0 で試しているつもりで実行したら、出力が TAP 形式になって `v22.17.0` と表示されました。`nvm use` はシェル関数なので、別のシェル呼び出しには引き継がれず、default の 22.17.0 に戻っていました。以降はコマンドの先頭で毎回 `source ~/.nvm/nvm.sh && nvm use 26.7.0` を実行して、ログの先頭に `node --version` を必ず出すようにしました。

ただこのミスのおかげで、Node の既定レポータが版数で違うことに気づけました。v22.17.0 は TAP 形式（`TAP version 13` / `ok 1 - ...`）、v26.7.0 は spec 形式（`✔` / `ℹ tests 4`）です。出力の見た目が想定と違ったらまず `node --version`、という判断材料が増えました。

### `MODULE_TYPELESS_PACKAGE_JSON` と、その対処が生んだ副作用

Node 版のテストを初めて実行したときに警告が出ました。

```
(node:88836) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///.../tests_node/add.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/.../024_zenn/package.json.
```

検証用の作業ディレクトリに `package.json` を置いていなかったので、Node がリポジトリ直下の `package.json`（`type` 未指定）まで遡って解決していました。案内には「リポジトリ直下に `type: module` を足せ」と書いてありますが、そこは検証と無関係なので触りたくない。作業ディレクトリ側に置いて解決しました。

```bash
echo '{ "type": "module", "private": true }' > package.json
```

これで警告は消えたんですが、検証を終えて `git status` を見たら、リポジトリ直下に `deno.lock` が生えていました。中身は `jsr:@std/assert@1` → 1.0.19 など、今回の検証で解決した依存です。置いた `package.json` を起点に、Deno がリポジトリ直下まで遡って workspace root だと判定して、そこに lock を書いたようでした。リポジトリ本体の成果物ではないので消しました（作業ディレクトリ側の `deno.lock` はそのまま）。

親リポジトリの中に検証用ディレクトリを作ると、ツールが設定もロックファイルも上まで見に行くというのを2回続けて踏んだ形です。終わったら `git status` を見る、というだけの話ですが、今回は見ていなかったら気づかないままでした。

## node:test と比べて感じたこと

### 手書きループ版

`node:test` に `test.each()` 相当は無いので、`for...of` で書きます。

```js:tests_node/add.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { add } from "../src/add.js";

// node:test には test.each 相当が無いので for...of で手書きする
const cases = [
  [1, 2, 3],
  [0, 0, 0],
  [-1, 1, 0],
  [10, 32, 42],
];

for (const [a, b, expected] of cases) {
  test(`add(${a}, ${b}) = ${expected}`, () => {
    assert.equal(add(a, b), expected);
  });
}
```

```
✔ add(1, 2) = 3 (2.28875ms)
✔ add(0, 0) = 0 (0.289792ms)
✔ add(-1, 1) = 0 (0.258792ms)
✔ add(10, 32) = 42 (3.68575ms)
ℹ tests 4
ℹ suites 0
ℹ pass 4
ℹ fail 0
```

行数は 12 行 vs 17 行でした。

```
      12 tests_deno/add_test.ts
      17 tests_node/add.test.js
      13 tests_deno/render_test.ts
      13 tests_node/render.test.js
```

`.each()` に対して自分で書く必要があったのは、ループ本体、テスト名のテンプレート文字列、ケース配列を `const cases` として外出しする手間の3つです（`import assert` は Deno 側の `jsr:@std/assert` と相殺）。差は5行なので、行数だけ見れば劇的な差ではありません。

失敗時の出力は Node 側のほうが情報量が多いです。

```
✖ failing tests:

test at tests_node/add_fail.test.js:13:3
✖ add(-1, 1) = 99 (1.439125ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  
  0 !== 99
  
      at TestContext.<anonymous> (file:///.../tests_node/add_fail.test.js:14:12)
      ...
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: 0,
    expected: 99,
    operator: 'strictEqual',
    diff: 'simple'
  }
```

`test at tests_node/add_fail.test.js:13:3` と、ループの中の行番号まで出ます。Deno は `.each()` の呼び出し位置しか出さないので、ここは Node が親切でした。ただ `AssertionError` オブジェクトを丸ごとダンプするので縦には長いです。

### Node のスナップショット

```js:tests_node/render.test.js
import { test } from "node:test";
import { renderHeader } from "../src/render.js";

test("renders the header", (t) => {
  t.assert.snapshot(renderHeader({ title: "Deno 2.9" }));
});

// パラメータ化も自前ループ
for (const title of ["Hello", "こんにちは"]) {
  test(`renderHeader ${title}`, (t) => {
    t.assert.snapshot(renderHeader({ title }));
  });
}
```

初回に生成されないのは Deno と同じでした。ただエラーメッセージが違います。

:::details エラー全文（v26.7.0 / 更新フラグ無しの初回）
```
✖ renders the header (3.590417ms)
  Error [ERR_INVALID_STATE]: Invalid state: Cannot read snapshot file '/.../tests_node/render.test.js.snapshot.' Missing snapshots can be generated by rerunning the command with the --test-update-snapshots flag.
      at throwReadError (node:internal/test_runner/snapshot:253:17)
      at SnapshotFile.readFile (node:internal/test_runner/snapshot:114:7)
      at TestContext.snapshotAssertion (node:internal/test_runner/snapshot:206:22)
      ... 5 lines matching cause stack trace ...
      at startSubtestAfterBootstrap (node:internal/test_runner/harness:387:17) {
    code: 'ERR_INVALID_STATE',
    cause: Error: ENOENT: no such file or directory, open '/.../tests_node/render.test.js.snapshot'
        at readFileSync (node:fs:539:20)
        ...
      errno: -2,
      code: 'ENOENT',
      syscall: 'open',
      path: '/.../tests_node/render.test.js.snapshot'
    },
    filename: '/.../tests_node/render.test.js.snapshot'
  }
ℹ pass 0
ℹ fail 3
```
:::

`Missing snapshots can be generated by rerunning the command with the --test-update-snapshots flag.` と、初回から更新方法を教えてくれます。Deno の `Missing snapshot file.` と比べると、ここは Node のほうが迷わずに済みました。自分が Deno 側で時間を使ったのはまさにここだったので、差として印象に残っています。

生成されたファイルの中身はこうでした（この時点では `renderHeader` に `class="site-header"` を足した後です）。

```js:tests_node/render.test.js.snapshot
exports[`renderHeader Hello 1`] = `
"<header class=\\"site-header\\"><h1>Hello</h1></header>"
`;

exports[`renderHeader こんにちは 1`] = `
"<header class=\\"site-header\\"><h1>こんにちは</h1></header>"
`;

exports[`renders the header 1`] = `
"<header class=\\"site-header\\"><h1>Deno 2.9</h1></header>"
`;
```

Deno の `.snap` とはだいぶ違います。

| | Deno `__snapshots__/render_test.ts.snap` | Node `tests_node/render.test.js.snapshot` |
|---|---|---|
| 置き場所 | テストファイル隣の `__snapshots__/` サブディレクトリ | テストファイルと同じ階層に並ぶ（`.js.snapshot`） |
| モジュール形式 | `export const snapshot = {}`（ESM） | `exports[...]`（CJS） |
| 値の囲み | 単一行。`"` を含むと `'` に切り替えてエスケープ回避 | 前後に改行を入れた複数行。`"` は `\\"` にエスケープ |
| 並び順 | テストの登録順 | キーのアルファベット順（`renderHeader Hello` → `こんにちは` → `renders the header`） |
| 読みやすさ | 差分がそのまま HTML として読める | エスケープが混ざるので目視レビューが少し重い |

### v22.17.0 のフラグ仮説が外れた

事前に立てた「22.17.0 では `--experimental-test-snapshots` を要求されるだろう」という予想は外れました。フラグ無しで通りました。

```
=== node v22.17.0 ===
$ node --test tests_node/render.test.js
TAP version 13
# Subtest: renders the header
ok 1 - renders the header
...
# tests 3
# pass 3
# fail 0
```

ここで「フラグが無いから比較をスキップして緑になっただけでは？」が気になったので、出力をわざと変えてもう一度実行しました。

```
### 検証: v22 でスナップショットが本当に比較されているか（出力をわざと変えた）
=== node v22.17.0 ===
not ok 1 - renders the header
  error: |-
    Expected values to be strictly equal:
    + actual - expected
    
    + '\n"<header class=\\\\"CHANGED\\\\"><h1>Deno 2.9</h1></header>"\n'
    - '\n"<header class=\\\\"site-header\\\\"><h1>Deno 2.9</h1></header>"\n'
    
  code: 'ERR_ASSERTION'
  stack: |-
    TestContext.snapshotAssertion (node:internal/test_runner/snapshot:206:9)
    assert.<computed> [as snapshot] (node:internal/test_runner/test:320:18)
# pass 0
# fail 3
```

ちゃんと赤くなったので、空振りの緑ではなく実際に比較していました。ドキュメントの Added / Stable 表記から「stable 化バージョンより前はフラグが要る」と読んだのが間違いで、22.17.0 の時点で既にフラグは不要になっていたようです。手元の版数で叩いてみるのが早い、というのと、「フラグ無しで緑」を見たらわざと壊して赤くなるか確認する、というのを両方おぼえました。

### `.ts` は共有できた（Node 26 なら）

最初に「Node は `.ts` を読めないだろう」と決め打ちして `.js` を別に用意したんですが、後で試したら Node 26.7.0 はそのまま `--test` できました。拡張子付きの `../src/add.ts` という import もそのまま通ります。

```
=== node v26.7.0 ===
✔ add(1, 2) = 3 (2.067959ms)
✔ add(10, 32) = 42 (0.394334ms)
ℹ tests 2
ℹ pass 2
ℹ fail 0
```

落ちるのは 22.17.0 のほうでした。

```
=== node v22.17.0 ===
TAP version 13
# node:internal/modules/esm/get_format:219
#   throw new ERR_UNKNOWN_FILE_EXTENSION(ext, filepath);
#         ^
# TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".ts" for /.../tests_node/add_ts.test.ts
#     at Object.getFileProtocolModuleFormat [as file:] (node:internal/modules/esm/get_format:219:9)
#     at defaultGetFormat (node:internal/modules/esm/get_format:245:36)
#     at defaultLoad (node:internal/modules/esm/load:120:22)
#     at async ModuleLoader.loadAndTranslate (node:internal/modules/esm/loader:580:32)
#     at async ModuleJob._link (node:internal/modules/esm/module_job:154:19) {
#   code: 'ERR_UNKNOWN_FILE_EXTENSION'
# }
# Node.js v22.17.0
not ok 1 - tests_node/add_ts.test.ts
  code: 'ERR_TEST_FAILURE'
```

今回は 22 での比較も残したかったので `.js` 版を併置したままにしましたが、Node 26 だけを相手にするなら二重管理は不要でした。「比較の条件を揃えるコスト」が Node の版数次第で変わるという意味では、この二重管理そのものが記録として意味があったかもしれません。

### 4観点まとめ

| 観点 | Deno 2.9.5 | Node `node:test` (26.7.0) |
|---|---|---|
| 行数（add の4ケース） | 12行。ケース配列を `.each()` の引数に直接渡せる | 17行。`const cases` の外出し＋`for...of`＋名前テンプレートで +5行 |
| テスト名の出方 | `"add(%i, %i) = %i"` を書くだけで展開。オブジェクトケースは `$a + $b = $sum` / `$input.a` のネストも可。`%#` でケース番号（0始まり） | 名前は自分でテンプレート文字列を組む。書き忘れると全ケース同名になる |
| 失敗時出力 | 落ちたケース名で特定可。`[Diff] Actual / Expected` を色付き表示。行番号は `.each()` の呼び出し位置 | 同じく名前で特定可＋ループ内の行番号まで出る。`AssertionError` を丸ごとダンプするので情報量は多いが縦に長い |
| スナップショット更新フロー | 初回は `Missing snapshot file.` で失敗（更新方法の案内なし）→ `deno test -u` → 不一致時は差分＋`--update-snapshots` を案内 → `-u` 付きフル実行のときだけ stale を prune。権限フラグ不要 | 初回は `ERR_INVALID_STATE` だがその場で `--test-update-snapshots` を案内 → 生成 → 不一致時は `AssertionError` の actual/expected。prune 相当は今回未確認 |
| （おまけ）ケース単位フィルタ | `deno test --filter "add(1, 2)"` → `1 passed \| 3 filtered out` | `--test-name-pattern` で同等のことはできそうだが今回は未検証 |

## どんな人に向いていそうか

今回試した範囲では、表が増えるほど Deno 側に寄りたくなりました。決め手は行数（12 vs 17）ではなく、テスト名を組み立てる責任が自分から外れることでした。`node:test` の手書きループでも同じ名前は作れますが、それは「名前をちゃんとテンプレート化する」と自分で決めた場合の話で、雑に書くと4ケース全部が同名になります。`.each()` は名前を書く場所が最初から用意されている。

一方で `node:test` を捨てる理由にはならないとも思いました。今回いちばん怖かったのは、補間記法を取り違えても静かに通ってしまうことで（`MISUSE array-case with undefined + undefined = undefined ... ok`）、これは手書きのテンプレート文字列では起きない事故です。スナップショット単体で見れば、初回に更新方法を案内してくれる `node:test` のほうが親切でした。

なので、パラメータ化テストをよく書いて Deno を既に使っている人、スナップショットを追加依存なしで回したい人には試す価値がありそう、くらいの温度感です。

## まとめ

やる前に立てた予想は6件でしたが、当たったのは2件だけでした。

- `deno upgrade` が通らない → 踏んだ。ただし理由が「パッケージマネージャ検出で拒否」ではなく「upgrade 機能が入っていない」だった
- Node 22 でスナップショットにフラグが要る → 外れた。22.17.0 はフラグ無しで動き、わざと壊すと赤くなることまで確認した
- `nvm use` がシェルごとに要る → 踏んだ
- 名前補間が期待どおり展開されない → 正しく書けば `%#` も `$key.nested` も全部効いた。問題は取り違えても静かに通ることのほうだった
- スナップショットの差分が読めない → 差分は読みやすかった。迷ったのは「初回に `-u` が要る」と「prune がいつ走るか」だった
- Deno と Node で同じ `.ts` を共有できない → Node 26.7.0 では共有できた。できないのは 22.17.0

予想していなかった詰まりは3つで、`.each()` の引数順（`TestContext` が最後）、`MODULE_TYPELESS_PACKAGE_JSON`、リポジトリ直下に `deno.lock` が生えたこと。あとの2つは検証ディレクトリを親リポジトリの中に作ったせいなので、次からは外に置くか、最後に `git status` を見る癖をつけるかだと思っています。

今回触っていない範囲もそれなりにあります。Deno の `--filter` に対称な `node --test --test-name-pattern` の比較、Node 側の stale prune 挙動、`t.assert.fileSnapshot()` や `snapshot.setResolveSnapshotPath()` / `setDefaultSnapshotSerializers()`、`Deno.test.only.each` / `Deno.test.ignore.each`、それに Deno 2.9 の他の新機能（CSS module imports など）。特に prune の対称比較は気になっているので、そのうち試したいです。

## 再現手順

```bash
# 1. Deno を 2.9 系へ（Homebrew 管理の場合）
which -a deno                    # 導入経路を先に確認する
deno upgrade                     # → built without the "upgrade" feature で失敗する
brew update && brew upgrade deno
deno --version                   # 2.9.5

# 2. 作業場
mkdir -p work/{src,tests_deno,tests_node,logs} && cd work
echo '{ "type": "module", "private": true }' > package.json   # MODULE_TYPELESS_PACKAGE_JSON 回避

# 3. Deno 側（テストコードは本文参照）
deno test tests_deno/add_test.ts
deno test --filter "add(1, 2)" tests_deno/add_test.ts
deno test tests_deno/render_test.ts     # 初回は Missing snapshot file. で落ちる
deno test -u tests_deno/render_test.ts  # ここで __snapshots__/*.snap が生まれる
# renderHeader の出力を変えてから
deno test tests_deno/render_test.ts     # 差分表示
deno test -u tests_deno/render_test.ts  # 更新
deno test -u tests_deno/                # フル実行 + -u で stale が prune される

# 4. Node 側（毎回 nvm use を打つ / ログ先頭に node --version を出す）
source ~/.nvm/nvm.sh && nvm use 26.7.0 && node --version
node --test tests_node/add.test.js
node --test tests_node/render.test.js                          # 初回は ERR_INVALID_STATE
node --test --test-update-snapshots tests_node/render.test.js
```

ハマりどころを並べておきます。

- `deno upgrade` は導入経路によって使えない。`which -a deno` を先に見る
- `.each()` のコールバックはケース引数が先、`TestContext` が最後（`({ title }, t) => ...`）
- Deno のスナップショットは初回でも `-u` が必要。`Missing snapshot file.` は更新方法を案内しない
- stale entry の prune は `-u` 付きフル実行のときだけ走る
- 補間記法の取り違えはエラーにならない。テスト名に `undefined` / `NaN` / `[object Object]` が出たら疑う
- printf トークンは位置引数を順に消費する（`%#` は消費しない）
- `nvm use` は次のコマンドに引き継がれない。スクリプト実行のたびに `source ~/.nvm/nvm.sh && nvm use <ver>`
- Node の既定レポータは版数で違う（22.17.0 = TAP、26.7.0 = spec）
- `.ts` を直接 `node --test` できるのは 26.7.0。22.17.0 は `ERR_UNKNOWN_FILE_EXTENSION`
- 親リポジトリの中に作業ディレクトリを作ると `package.json` の解決が上に抜ける。さらに `package.json` を置くと Deno がリポジトリ直下を workspace root と判定して `deno.lock` をそこに書くので、終わったら `git status` を見る
- `brew upgrade deno` は依存パッケージも巻き込んで更新する

## 参考リンク

https://deno.com/blog/v2.9

https://nodejs.org/api/test.html
