---
title: "Node 26.5 の text imports で .txt import に詰まった"
emoji: "📄"
type: "tech"
topics: ["nodejs", "javascript", "esm", "importattributes"]
published: true
---

<!-- 前提: 出典ログ logs/run-node-text-imports-20260713-0408/execution-log.md / 記事タイプ: 試してみた・検証ログ / slug: node26-experimental-import-text-try / published: false -->

## はじめに

Node.js v26.5.0 に `.txt` などのテキストファイルを ESM の `import` で読み込む「text imports」という機能が入りました。構文は import attributes を使って `import x from './f.txt' with { type: 'text' };` と書きます。JSON を `with { type: 'json' }` で読むのと同じ見た目です。

JSON import は前から使ったことがあったので「同じノリで書けるだろう」と思って触ってみたら、最初から最後までフラグと属性で細かく詰まりました。この記事はその詰まった過程の記録です。動いた成功パターンだけでなく、どこで何のエラーが出て、どう見分けたのかを中心に書きます。

結論から言うと、`.txt` を import で読むところまでは動きました。ただ「フラグを付け忘れる」「属性を書き忘れる」「型を書き間違える」の3つのミスが、どれも同じエラーメッセージになって見分けがつかない、というのが一番の学びでした。

:::message
筆者は実務経験の浅いエンジニアで、text imports を触るのは初めてです。実行環境は macOS 26.5 (arm64) / Node.js v26.5.0（npm 11.17.0）。この機能は Stability 1.0 - Early development の実験的機能で、将来 API が変わる可能性があります。
:::

## 使ったもの・環境

- 対象技術: Node.js v26.5.0 の text imports（`--experimental-import-text` フラグ ＋ `with { type: 'text' }` 属性）
- OS / ランタイム: macOS 26.5 (arm64) / Node.js **v26.5.0**（npm 11.17.0）
- 比較対象: `fs.readFileSync`、JSON imports（`with { type: 'json' }`, v23.1.0+ で安定）

text imports は **v26.5.0 以上が必須**です。手元の既定は v22.17.0 だったので、まずここから詰まりました。

## 環境構築（Node 26.5 を入れる）

まず手元の Node のバージョンを確認したら v22.17.0 でした。

```bash
$ node -v
v22.17.0
```

このバージョンには text imports 自体が存在しないので、そもそも試せません。nvm で v26 系を入れます。自分は homebrew で入れた nvm を使っているので、シェルを開くたびに `source` が要ります（PATH に自動では入らない）。ここも地味にハマりました。

```bash
export NVM_DIR="$HOME/.nvm"
source /opt/homebrew/opt/nvm/nvm.sh
nvm ls-remote | grep v26   # v26.0.0 〜 v26.5.0 が候補に出る
nvm install 26             # v26.5.0 が入る
node -v                    # → v26.5.0
```

インストール中の出力（抜粋）:

```
Downloading and installing node v26.5.0...
Downloading https://nodejs.org/dist/v26.5.0/node-v26.5.0-darwin-arm64.tar.xz...
Computing checksum with sha256sum
Checksums matched!
Now using node v26.5.0 (npm v11.17.0)
```

`nvm ls-remote` の時点で v26.5.0 が既にミラーされていたので、ダウンロードから切り替えまで一瞬で終わりました。バージョンマネージャが最新系を持っていれば導入はそんなに構えなくていいみたいです。

続いて作業ディレクトリを用意します。ESM 構文を使うので `package.json` に `"type": "module"` を入れました（今回は拡張子も `.mjs` に統一して二重で担保しています）。

```json:package.json
{
  "name": "node-text-imports-demo",
  "version": "1.0.0",
  "type": "module",
  "private": true
}
```

読み込ませるテキストファイルはこんな内容です。改行や末尾スペースがちゃんと保持されるか後で見たいので、わざと4行にしています。

```text:message.txt
こんにちは、text imports！
これは複数行のテキストファイルです。
3行目には末尾スペースがあります
last line without trailing newline handling test
```

## 実際に試してみる（本編）

text import 本体はこれだけです。`with { type: 'text' }` を付けて `.txt` を import します。

```js:main.mjs
// text imports の最小例（Node 26.5+, --experimental-import-text 必須）
import msg from './message.txt' with { type: 'text' };

console.log('=== text import ===');
console.log(msg);
```

フラグを付けて実行すると、`.txt` の中身が文字列として出力されました。

```bash
node --experimental-import-text main.mjs
```

```
(node:89451) ExperimentalWarning: Text import is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
=== text import ===
こんにちは、text imports！
これは複数行のテキストファイルです。
3行目には末尾スペースがあります
last line without trailing newline handling test
```

先頭に `ExperimentalWarning` が出ます。最初これを見て「失敗した？」と一瞬思ったんですが、その下にちゃんとテキストが出ているので実は成功しています。実験機能なので警告が stderr に出るだけで、致命的ではありませんでした。

## 詰まった点と解決

ここが今回の本題です。フラグと属性の組み合わせで、いくつも失敗パターンを踏みました。

### フラグを付けないと「未知の拡張子」で弾かれる

`main.mjs` は正しく書けているのに、`--experimental-import-text` を付けずに実行すると失敗します。

```bash
node main.mjs
```

```
node:internal/modules/esm/get_format:243
  throw new ERR_UNKNOWN_FILE_EXTENSION(ext, filepath);
        ^

TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".txt" for /Users/.../workspace/message.txt
    at Object.getFileProtocolModuleFormat [as file:] (node:internal/modules/esm/get_format:243:9)
    at defaultGetFormat (node:internal/modules/esm/get_format:283:36)
    at defaultLoadSync (node:internal/modules/esm/load:161:16)
    at #loadAndMaybeBlockOnLoaderThread (node:internal/modules/esm/loader:809:12)
    at #loadSync (node:internal/modules/esm/loader:841:53)
    at ModuleLoader.load (node:internal/modules/esm/loader:790:26)
    at ModuleLoader.loadAndTranslate (node:internal/modules/esm/loader:501:31)
    at #getOrCreateModuleJobAfterResolve (node:internal/modules/esm/loader:567:36)
    at afterResolve (node:internal/modules/esm/loader:614:52)
    at ModuleLoader.getOrCreateModuleJob (node:internal/modules/esm/loader:620:12) {
  code: 'ERR_UNKNOWN_FILE_EXTENSION'
}

Node.js v26.5.0
```

引っかかったのは、エラーが「フラグを付けろ」とは一言も言わないことです。`.txt` が単に「知らない拡張子」として弾かれます。フラグが無い状態だと、この機能自体が存在しないものとして扱われるみたいでした。JSON import はフラグ不要で動くので、同じ感覚で無フラグにするとここで最初に「なんで？」となります。

### 属性を書き忘れる・型を書き間違えると、同じエラーになる

もっと厄介だったのがここです。属性 `with { type: 'text' }` を省略したパターンと、`.txt` なのに `type: 'json'` と書き間違えたパターンを試しました。

```js:no-attr.mjs
// 失敗パターン: with { type: 'text' } を省略
import msg from './message.txt';

console.log(msg);
```

```js:wrong-type.mjs
// 失敗パターン: .txt に対して type: 'json' と誤記
import msg from './message.txt' with { type: 'json' };

console.log(msg);
```

```bash
node --experimental-import-text no-attr.mjs      # with{type:'text'} を省略
node --experimental-import-text wrong-type.mjs   # .txt に type:'json' と誤記
```

どちらも、さっきのフラグ無しと**まったく同じ** `ERR_UNKNOWN_FILE_EXTENSION`（`Unknown file extension ".txt"`）が出ます。つまり「フラグを付け忘れた」「属性を書き忘れた」「型を json と間違えた」という別々の3つのミスが、どれも見分けのつかない同一エラーに集約されてしまいます。これは想定していませんでした（別々のメッセージが出ると思っていた）。実運用でここに嵌まると、どの原因なのかエラーからは切り分けられないのが罠だなと思いました。

一方で、パスを間違えた（存在しない `.txt` を指定した）ときは、ちゃんと別のエラーになります。

```js:missing.mjs
// 失敗パターン: 存在しない .txt を text import
import msg from './does-not-exist.txt' with { type: 'text' };

console.log(msg);
```

:::details ERR_MODULE_NOT_FOUND の全文
```
node:internal/modules/esm/resolve:272
    throw new ERR_MODULE_NOT_FOUND(
          ^

Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/Users/.../workspace/does-not-exist.txt' imported from /Users/.../workspace/missing.mjs
    at finalizeResolution (node:internal/modules/esm/resolve:272:11)
    at moduleResolve (node:internal/modules/esm/resolve:879:10)
    at defaultResolve (node:internal/modules/esm/resolve:1006:11)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:708:20)
    at #resolveAndMaybeBlockOnLoaderThread (node:internal/modules/esm/loader:728:38)
    at ModuleLoader.resolveSync (node:internal/modules/esm/loader:766:56)
    at #resolve (node:internal/modules/esm/loader:690:17)
    at ModuleLoader.getOrCreateModuleJob (node:internal/modules/esm/loader:610:35)
    at ModuleJob.syncLink (node:internal/modules/esm/module_job:277:33)
    at ModuleJob.link (node:internal/modules/esm/module_job:389:17) {
  code: 'ERR_MODULE_NOT_FOUND',
  url: 'file:///Users/.../workspace/does-not-exist.txt'
}
```
:::

拡張子や属性まわりのミスは `ERR_UNKNOWN_FILE_EXTENSION`、パス間違いは `ERR_MODULE_NOT_FOUND` と分かれるので、この2つは区別できます。区別できないのは前述の属性系3種だけ、という整理になりました。

### named import では受け取れない

公開されるのは default export だけです。それを知らずに named import で書くとどうなるか試しました。

```js:named.mjs
// 失敗パターン: named import で受け取ろうとする（公開は default のみ）
import { foo } from './message.txt' with { type: 'text' };

console.log(foo);
```

```bash
node --experimental-import-text named.mjs
```

```
(node:90050) ExperimentalWarning: Text import is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
file:///Users/.../workspace/named.mjs:2
import { foo } from './message.txt' with { type: 'text' };
         ^^^
SyntaxError: The requested module './message.txt' does not provide an export named 'foo'
    at #asyncInstantiate (node:internal/modules/esm/module_job:463:21)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
    at async ModuleJob.run (node:internal/modules/esm/module_job:561:5)
    at async node:internal/modules/esm/loader:650:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5)
```

これは他の失敗と違って `SyntaxError`（does not provide an export named 'foo'）になります。フラグも属性も正しいので `ExperimentalWarning` は出たうえで、export の形だけが弾かれています。エラーの質が違うので、これは逆に原因が分かりやすかったです。「default だけ」というのを身をもって確認できました。

## 触ってみて分かったこと

読み込んだ値がどういう性質なのかも見てみました。

```js:inspect.mjs
// text import の値の性質を調べる: 型・長さ・改行保持
import msg from './message.txt' with { type: 'text' };

console.log('typeof msg     :', typeof msg);
console.log('msg.length     :', msg.length);
console.log('lines (split n):', msg.split('\n').length);
console.log('has newline    :', msg.includes('\n'));
console.log('--- JSON.stringify (改行やスペースを可視化) ---');
console.log(JSON.stringify(msg));
```

```
typeof msg     : string
msg.length     : 104
lines (split n): 4
has newline    : true
--- JSON.stringify (改行やスペースを可視化) ---
"こんにちは、text imports！\nこれは複数行のテキストファイルです。\n3行目には末尾スペースがあります\nlast line without trailing newline handling test"
```

値は素直な `string`（length 104）でした。改行 `\n` も、3行目の末尾スペースも、加工されずそのまま保持されています。ファイルの中身がそのまま文字列になる、という理解で良さそうです。

## fs / JSON import と比べて感じたこと

同じ `message.txt` を `fs.readFileSync` で読んだ場合と比べてみました。

```js:fs-version.mjs
// 比較: fs.readFileSync で同じ message.txt を読む
import { readFileSync } from 'node:fs';

const msg = readFileSync(new URL('./message.txt', import.meta.url), 'utf8');

console.log('=== fs.readFileSync ===');
console.log('typeof msg :', typeof msg);
console.log('msg.length :', msg.length);
console.log(msg);
```

```
=== fs.readFileSync ===
typeof msg : string
msg.length : 104
こんにちは、text imports！
これは複数行のテキストファイルです。
3行目には末尾スペースがあります
last line without trailing newline handling test
```

中身は text import と完全に一致します（`string` / length 104）。違いは値ではなく書き味のほうで、text import は静的・トップレベルで書けてフラグが要る、`fs` は実行時読み込みだけどフラグ不要でどの Node でも動く、という感じです。

JSON import とも比べました。構文の見た目は同じ import attributes なのに、こちらはフラグ不要で exit 0、値はパース済みのオブジェクトになります。

```js:json-version.mjs
// 比較: JSON imports（v23.1.0+ で安定・フラグ不要）
import data from './data.json' with { type: 'json' };

console.log('=== json import ===');
console.log('typeof data :', typeof data);
console.log('data.greeting:', data.greeting);
console.log('data.count   :', data.count);
console.log('data.tags[0] :', data.tags[0]);
console.log(data);
```

```
=== json import ===
typeof data : object
data.greeting: こんにちは
data.count   : 3
data.tags[0] : node
{
  greeting: 'こんにちは',
  count: 3,
  tags: [ 'node', 'esm', 'import-attributes' ]
}
```

同じ `with { type: ... }` の見た目なのに、「安定/実験」「フラグの有無」「戻り値の型（string か object か）」が全部違うのが面白いところでした。JSON import に慣れていると text も同じだと思い込むので、その油断が最初の詰まりに繋がっていた気がします。

実測を並べるとこうなります。

| 観点 | text import | fs.readFileSync | JSON import |
|---|---|---|---|
| 構文 | `import x from './f.txt' with { type: 'text' }` | `readFileSync(url, 'utf8')` | `import x from './f.json' with { type: 'json' }` |
| 実行フラグ | `--experimental-import-text` 必須 | 不要 | 不要（安定） |
| 対応バージョン | v26.5.0+（実験 / Stability 1.0） | 従来から | v23.1.0+（安定） |
| 起動時の警告 | `ExperimentalWarning` あり | なし | なし |
| 値の型 | `string`（生の文字列, length 104） | `string`（同一, length 104） | `object`（パース済み） |
| 読み込みタイミング | 静的・モジュール解決時 | 実行時（同期呼び出し） | 静的・モジュール解決時 |
| 公開 export | default のみ | 戻り値を代入 | default のみ |
| コード量 | import 1行 | import ＋ readFileSync 呼び出し | import 1行 |

## どんな人に向いていそうか

import 1行で済むので、テンプレート文字列や設定ファイルの中身をコードに埋め込みたいときには手軽そうです。値が生の文字列でそのまま返るのも用途が分かりやすい。ただ現状は実験機能（Stability 1.0）でフラグ必須、しかも API が将来変わりうるので、本番でそのまま採用するのは慎重にしたほうが良さそうだと感じました。安定して同じことをしたいなら `fs.readFileSync` でも中身は同じ結果が得られます。

## まとめ

`.txt` を import で読むところまでは達成できました。振り返って印象に残ったのは次の点です。

- text imports は `--experimental-import-text` フラグと `with { type: 'text' }` 属性の**両方**が必要。どちらか欠けると `ERR_UNKNOWN_FILE_EXTENSION` になる。
- そのうえ「フラグ無し」「属性無し」「型を json と誤記」の3ミスが同じエラーに集約されて、エラーからは原因を切り分けられない。ここが一番ハマった。
- 公開は default export のみ。named で受けると `SyntaxError`。
- `ExperimentalWarning` は出るが動く。警告＝失敗ではない。
- 読み込んだ値は改行も末尾スペースも保持した素の string。

次は同じ実験機能まわりで、テキストを少しずつ読む API（Blob の textStream など）も触ってみたいです。

再現手順を残しておきます。

```bash
nvm install 26                     # v26.5.0
mkdir demo && cd demo
echo '{"type":"module"}' > package.json
printf 'line1\nline2\n' > message.txt
printf "import m from './message.txt' with { type: 'text' };\nconsole.log(m);\n" > main.mjs
node main.mjs                       # → ERR_UNKNOWN_FILE_EXTENSION（フラグ無しは失敗）
node --experimental-import-text main.mjs   # → 中身が文字列で出る（ExperimentalWarning付き）
```

## 参考リンク

- Node.js Modules: ECMAScript modules（import attributes / text imports）
  https://nodejs.org/api/esm.html
- Node.js CLI options（`--experimental-import-text`）
  https://nodejs.org/api/cli.html
- TC39 Import Attributes proposal
  https://github.com/tc39/proposal-import-attributes
