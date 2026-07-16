---
title: "using / Symbol.dispose を try/finally と書き比べてみた"
emoji: "🧹"
type: "tech"
topics: ["javascript", "nodejs", "typescript", "ecmascript"]
published: true
---

## はじめに

`try/finally` で `close()` を手で呼んでいると、たまに書き忘れて後始末が漏れることがあります。そこを言語側で面倒みてくれるのが ES2026 の明示的資源管理（Explicit Resource Management）で、`using` 宣言と `Symbol.dispose` が中心です。名前だけは前から知っていたので、同じ題材を `try/finally` 版と `using` 版で書き比べて、後始末のタイミングや解放順が実際どう動くのかを手元で確かめてみました。

結論から書くと、後始末は思ったとおりスコープを抜けた瞬間に自動で走りました。ただ、いきなり `SyntaxError` で止まったり、非同期の解放で「待ってくれない」挙動に出くわしたりと、詰まった箇所もいくつかあったので、そのあたりを中心に残しておきます。

:::message
筆者はこの機能を触るのは初めてです。実行環境は macOS (Darwin 25.5.0, arm64) / Node.js v26.5.0。
:::

## 使ったもの・環境

- 対象技術: ES2026 明示的資源管理（`using` / `await using` / `Symbol.dispose` / `Symbol.asyncDispose`）
- ランタイム: Node.js **v26.5.0**（後述しますが、v22.17.0 では動きませんでした）
- 作ったもの: `Symbol.dispose` / `Symbol.asyncDispose` を実装した自作リソースクラスと、同じ題材を `try/finally` 版・`using` 版で書いた比較スクリプト（`.mjs` を7本）

確かめたかったのは次の4つです。

1. `using` 版と `try/finally` 版が同じ後始末結果になるか
2. 複数の `using` を並べたとき、解放順（LIFO）がログで見えるか
3. 例外時・early return 時にもちゃんと解放されるか
4. `await using` + `Symbol.asyncDispose` で非同期の解放が await されるか

## 事前に調べたこと

手を動かす前に MDN と TC39 の Explicit Resource Management を眺めて、`Symbol.dispose` について押さえておいた点です。

- `Symbol.dispose` が例外を投げると「解放に失敗した」という意味になる
- 複数回呼ばれても例外を投げない（冪等な）実装にしておくべき
- **同期の `Symbol.dispose` は Promise を返してはいけない**（`using` は戻り値を await しない）。非同期で解放したいなら `await using` + `Symbol.asyncDispose` を使う
- MDN では `Symbol.dispose` は "Limited availability"（Baseline 未到達）の表記。ブラウザというより Node / TypeScript でまず使う機能という位置づけ

最後の「Promise を返さない」は、あとで実際に踏んで理解が深まったので詳しくは後半に書きます。

## 環境構築（と、いきなりの詰まり）

まず実行環境のバージョンを見ておきました。

```bash
node -v
uname -a
```

```
v22.17.0
Darwin macbook.local 25.5.0 Darwin Kernel Version 25.5.0: ... arm64
```

手元の既定の Node は v22.17.0 でした。この状態で `using` が使えるか、ワンライナーで機能検出してみたところ、いきなり `SyntaxError` で止まりました。

```bash
node --input-type=module -e "using x = { [Symbol.dispose](){ console.log('disposed') } }; console.log('ok')"
```

:::details エラー全文（Node v22.17.0）
```
file:///Users/you/workspace/024_zenn/[eval1]:1
using x = { [Symbol.dispose](){ console.log('disposed') } }; console.log('ok')
      ^

SyntaxError: Unexpected identifier 'x'
    at compileSourceTextModule (node:internal/modules/esm/utils:344:16)
    at ModuleLoader.createModuleWrap (node:internal/modules/esm/loader:252:12)
    at ModuleLoader.eval (node:internal/modules/esm/loader:291:23)
    at node:internal/process/execution:72:24
    at asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:117:11)
    at Object.runEntryPointWithESMLoader (node:internal/modules/run_main:139:19)
    at evalModuleEntryPoint (node:internal/process/execution:71:47)
    at node:internal/main/eval_string:38:3

Node.js v22.17.0
```
:::

`using x` の `x` のところで `Unexpected identifier` と言われています。最初は「フラグを付ければ動くのかな」と `--harmony-*` 系を探しかけたのですが、これはそういう話ではなく、`using` は構文なので未対応のバージョンだと実行時ではなく**パース段階で落ちる**、というのが実際でした。フラグでは救えません。

`nvm ls` を見たら v26.5.0 が入っていたので、そちらに切り替えて同じスニペットを流し直しました。

```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 26
node -v   # v26.5.0
node --input-type=module -e "using x = { [Symbol.dispose](){ console.log('disposed') } }; console.log('ok')"
# => ok
#    disposed
```

今度は `ok` の後に `disposed` が出ました。`console.log('ok')` を通り抜けたあと（＝ブロックを抜けたあと）に `Symbol.dispose` が走っている順番です。「Node 26 の新機能を試す」というより「実行環境のバージョンが対応しているか」がまず本質だな、と最初につまずいて実感しました。

対応版に切り替えたところで、最小のリソースクラスで解放のタイミングを見てみます。

```js:resource.mjs
// 最小リソースクラス: Symbol.dispose を実装
// using でスコープを抜けると自動で dispose が呼ばれる。
export class Resource {
  constructor(name) {
    this.name = name;
    console.log(`open ${name}`);
  }
  [Symbol.dispose]() {
    console.log(`dispose ${this.name}`);
  }
}

console.log('--- enter block ---');
{
  using r = new Resource('A');
  console.log('using inside block');
}
console.log('--- left block ---');
```

```
--- enter block ---
open A
using inside block
dispose A
--- left block ---
```

`using inside block` の直後、ブロックの `}` を抜けた瞬間に `dispose A` が出ています。`--- left block ---` より前です。スコープの終端が解放タイミングだ、というのが目で見えました。

## try/finally 版から using 版へ書き換える

ここからが本編。DB接続っぽいものを開いて使って閉じる、という同じ題材を2通りで書きました。まず従来の `try/finally` 版です。

```js:a-finally.mjs
class Conn {
  constructor(name) {
    this.name = name;
    console.log(`open ${name}`);
  }
  close() {
    console.log(`close ${this.name}`);
  }
  use() {
    console.log(`use ${this.name}`);
  }
}

function run() {
  const c = new Conn('db');
  try {
    c.use();
  } finally {
    c.close(); // 手で後始末
  }
}

run();
console.log('done');
```

```
open db
use db
close db
done
```

`finally { c.close() }` を自分で書く必要があります。この `close()` を書き忘れると、そのまま後始末漏れになるところです。

これを `using` 版に書き換えます。`close()` メソッドを `[Symbol.dispose]()` に置き換えて、呼び出し側は `const c = ...; try {} finally { c.close() }` を `using c = ...` の1行にしました。

```js:a-using.mjs
class Conn {
  constructor(name) {
    this.name = name;
    console.log(`open ${name}`);
  }
  [Symbol.dispose]() {
    console.log(`close ${this.name}`);
  }
  use() {
    console.log(`use ${this.name}`);
  }
}

function run() {
  using c = new Conn('db');
  c.use();
  // finally も close() も書かない。スコープ終端で自動 dispose。
}

run();
console.log('done');
```

```
open db
use db
close db
done
```

出力は `try/finally` 版と完全に一致しました。`try`・`finally`・`c.close()` が消えて、`using c = ...` の1行だけになった書き味は素直に良いなと思いました。

## 解放順・例外時・early return の挙動

次に、複数リソースを並べたときの解放順を見ます。`using` を3つ宣言しただけのブロックと、同じ順序を `try/finally` で手で再現したものを並べました。

```js:b-lifo.mjs
class R {
  constructor(name) {
    this.name = name;
    console.log(`open ${name}`);
  }
  [Symbol.dispose]() {
    console.log(`dispose ${this.name}`);
  }
}

console.log('--- using: 確保 a,b,c ---');
{
  using a = new R('a');
  using b = new R('b');
  using c = new R('c');
  console.log('body');
}
console.log('--- 参考: try/finally で同じ LIFO を手で再現 ---');
{
  const a = new R('a2');
  try {
    const b = new R('b2');
    try {
      const c = new R('c2');
      try {
        console.log('body2');
      } finally { c[Symbol.dispose](); }
    } finally { b[Symbol.dispose](); }
  } finally { a[Symbol.dispose](); }
}
```

```
--- using: 確保 a,b,c ---
open a
open b
open c
body
dispose c
dispose b
dispose a
--- 参考: try/finally で同じ LIFO を手で再現 ---
open a2
open b2
open c2
body2
dispose c2
dispose b2
dispose a2
```

`using` は宣言を3行並べるだけで `c → b → a` の逆順（LIFO）で解放されました。同じ順序を `try/finally` で出そうとすると、コードのとおり3段ネストが要ります。コード量の差がはっきり出た部分です。

例外を投げたときはどうなるか。`using` で確保した後に `throw` してみます。

```js:c-throw.mjs
class R {
  constructor(name) {
    this.name = name;
    console.log(`open ${name}`);
  }
  [Symbol.dispose]() {
    console.log(`dispose ${this.name}`);
  }
}

function run() {
  using r = new R('x');
  console.log('before throw');
  throw new Error('boom');
  // ここには来ない
}

try {
  run();
} catch (e) {
  console.log(`caught: ${e.message}`);
}
console.log('after catch');
```

```
open x
before throw
dispose x
caught: boom
after catch
```

`throw` の後にまず `dispose x` が出て、そのあとで例外が呼び出し側に伝わって `caught: boom` になっています。`finally` 相当が自動で効いている形です。

early return でも同じで、条件付きの `return` を足しても解放されました。

```js:d-return.mjs
class R {
  constructor(name) {
    this.name = name;
    console.log(`open ${name}`);
  }
  [Symbol.dispose]() {
    console.log(`dispose ${this.name}`);
  }
}

function run(flag) {
  using r = new R('y');
  console.log('before return check');
  if (flag) {
    console.log('early return');
    return 'early';
  }
  console.log('normal path');
  return 'normal';
}

console.log(`result = ${run(true)}`);
console.log('---');
console.log(`result = ${run(false)}`);
```

```
open y
before return check
early return
dispose y
result = early
---
open y
before return check
normal path
dispose y
result = normal
```

early return 側・通常 return 側のどちらでも `dispose y` が出ています。`return` を後から足しても後始末の手当てが要らないのは、`try/finally` を書き足す運用と比べて事故が減りそうだと感じました。

## 非同期の解放と、やりがちな取り違え

最後に非同期。`await using` + `Symbol.asyncDispose` が正しく await されるかと、事前に調べておいた「同期 `dispose` は Promise を返さない」の誤用を、わざと並べて対比しました。

```js:e-async.mjs
function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

// (1) 正しい非同期解放
class AsyncRes {
  constructor(name) {
    this.name = name;
    console.log(`open ${name}`);
  }
  async [Symbol.asyncDispose]() {
    console.log(`asyncDispose start ${this.name}`);
    await delay(50);
    console.log(`asyncDispose end ${this.name}`);
  }
}

// (2) 誤用: 同期 using の Symbol.dispose が Promise を返す（await されない）
class BadRes {
  constructor(name) {
    this.name = name;
    console.log(`open ${name}`);
  }
  [Symbol.dispose]() {
    console.log(`dispose start ${this.name} (returns a Promise)`);
    // using は戻り値を await しない → この then は後で勝手に走る
    return delay(50).then(() => console.log(`dispose end ${this.name} (too late!)`));
  }
}

async function good() {
  console.log('=== (1) await using + asyncDispose ===');
  {
    await using r = new AsyncRes('async');
    console.log('body (async)');
  }
  console.log('after block (async) <- ここは asyncDispose end の後に出るはず');
}

async function bad() {
  console.log('=== (2) using + dispose が Promise を返す（誤用） ===');
  {
    using r = new BadRes('bad');
    console.log('body (bad)');
  }
  console.log('after block (bad) <- dispose end より前に出てしまう');
}

await good();
console.log('---');
await bad();
// bad() の未 await な dispose がここで解決する様子を見るため少し待つ
await delay(100);
console.log('=== end (bad の dispose end はここまでの間に遅れて出る) ===');
```

```
=== (1) await using + asyncDispose ===
open async
body (async)
asyncDispose start async
asyncDispose end async
after block (async) <- ここは asyncDispose end の後に出るはず
---
=== (2) using + dispose が Promise を返す（誤用） ===
open bad
body (bad)
dispose start bad (returns a Promise)
after block (bad) <- dispose end より前に出てしまう
dispose end bad (too late!)
=== end (bad の dispose end はここまでの間に遅れて出る) ===
```

(1) の `await using` は、`asyncDispose end async` が出てから `after block (async)` に進んでいます。解放がちゃんと await されています。

問題は (2) です。同期の `using` に渡した `Symbol.dispose` が Promise を返しても、`using` はそれを await してくれません。なので `after block (bad)` が先に出て、`dispose end bad (too late!)` はその後にずれて出てきています。事前に「同期 `dispose` は Promise を返さない」と読んではいたのですが、実際に順番がずれるのを見ると腑に落ちました。非同期の後始末をしたいときは、素直に `await using` + `Symbol.asyncDispose` を使う、というのが結論です。

## 分かったこと・比較

書き比べてみた印象を表にまとめます。

| 観点 | try/finally 版 | using 版 |
|---|---|---|
| コード量 | `const c=...; try{}finally{c.close()}` の定型が要る | `using c = ...` の1行。finally 不要 |
| close の書き忘れ | 手で書くので忘れ得る | スコープ終端で自動 |
| 解放順の明示性 | 複数資源は手動ネストで順序を作る | 宣言順の逆＝LIFO が自動（`dispose c,b,a`） |
| 例外時 | finally に書けば解放される | 自動で解放してから例外が伝播 |
| early return | return ごとに finally が効く | return を足しても自動解放 |
| 非同期 | `await` を finally に手書き | `await using` + `Symbol.asyncDispose`。同期 `dispose` に Promise は禁止 |

ファイルハンドル・DB接続・ロック・一時ディレクトリなど、「開いたら必ず閉じたい」ものとは相性が良さそうです。一方で `try/finally` はどのバージョンでも動くので、対応版が使えない環境ではまだそちらが必要です。今回の一番の学びは、機能そのものよりも「`using` は構文なので実行環境のバージョンが対応していないとパース時点で落ちる」という入口の部分でした。

## まとめ

確かめたかった4つ（同じ後始末結果になるか / LIFO / 例外・early return / 非同期の await）は、いずれも実際の出力で確認できました。詰まったのは2箇所で、最初の `SyntaxError`（バージョン非対応）は Node 26 への切り替えで、非同期の取り違えは `await using` に直すことで解消しました。

新しく `using` を積極的に使うかというと、対応ランタイムが前提になるぶんプロジェクト次第ですが、後始末を書き忘れやすい箇所には効きそうだという感触は得られました。次は TypeScript のダウンコンパイル（対応前の環境向けに `try/finally` へ落とす挙動）がどうなるかを見てみたいです。今回は素の `.mjs` で完結させたので、そこはまだ触れていません。

## 参考リンク

- [MDN: `Symbol.dispose`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/dispose)
- [MDN: `Symbol.asyncDispose`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/asyncDispose)
- [MDN: `await using`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/await_using)
- [TC39: Explicit Resource Management](https://github.com/tc39/proposal-explicit-resource-management)
