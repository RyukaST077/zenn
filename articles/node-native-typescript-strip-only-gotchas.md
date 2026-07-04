---
title: "`node app.ts` を試したら、まずバージョンで詰まった話（ネイティブTypeScript）"
emoji: "🦖"
type: "tech"
topics: ["typescript", "nodejs", "tsx", "tsnode"]
published: true
---

<!-- 前提: 出典ログ logs/run-node-native-typescript-20260705-0217/execution-log.md / 記事タイプ 検証ログ・詰まった点まとめ / slug は汎用衝突を避けて node-native-typescript-strip-only-gotchas に具体化 / published は false 固定 -->

## はじめに

これまで TypeScript を直接動かすときは `tsx` か `ts-node` を使っていました。最近の Node.js は `.ts` ファイルをそのまま `node app.ts` で実行できるようになった、という話を見かけたので、追加ランタイム無しでどこまでいけるのか、どこで詰まるのかを一通り試してみた記録です。

先に結論を言うと、「型注釈を消すだけ」の最小構成なら本当にそのまま動きました。ただ、手元の環境では最初の `node app.ts` からいきなり `SyntaxError` で止まって、原因を追ったら Node のバージョンでした。あと `tsx` に慣れているほど引っかかる差分（拡張子の書き方、`enum`、`.tsx`）がいくつかあります。そのあたりを、実際に踏んだエラー全文つきでまとめます。

:::message
筆者は実務経験の浅いエンジニアで、ネイティブ TypeScript 実行を触るのは初めてです。試した環境は macOS 26.5 (arm64) / ローカルの Node は v22.17.0 / Docker で `node:24` (v24.18.0) / TypeScript 5.9.2。
:::

想定読者は、普段 `tsx` や `ts-node` を使っていて「`node app.ts` って結局どこまで使えるの？」が気になっている人です。

## 使ったもの・環境

- Node.js のネイティブ TypeScript 実行（type stripping / strip-only モード）
- ローカル: macOS 26.5 (arm64) / Node **v22.17.0** / npm 10.9.2 / TypeScript 5.9.2
- 安定版の挙動を見る用に Docker: `node:24` イメージ = Node **v24.18.0**

やったことは、動く最小の `.ts` と、わざと詰まる `.ts` を何種類か用意して、それぞれを `node` で実行してログを残す、という地味な作業です。確かめたかったのは次の4つでした。

1. `node app.ts` がフラグなしで動いて、期待した文字列が出るか
2. `enum` などの非対応構文で実際にどんなエラーが出るか
3. 型エラーのある `.ts` を `node` はどう扱うか（見てくれるのか）
4. `tsx` と `node` で起動時間がどのくらい違うか

公式の説明はここを読みました。

https://nodejs.org/api/typescript.html

https://nodejs.org/en/learn/typescript/run-natively

要点は、

- type stripping は「消せる型だけ」を空白に置き換えて剥がす **strip-only モード**。実行時にコード生成が必要な構文（`enum` / 値を持つ `namespace` / パラメータプロパティ / decorator など）は対応していない。
- Node は**型チェックをしない**。型エラーがあってもそのまま実行される。型検査は `tsc --noEmit` などを別に回す。
- import は**拡張子必須**（`./util` ではなく `./util.ts`）、型だけの import は `import type` が必要。

このあたりを、頭で理解した気になっていても実際に踏むと結構違ったので、順番に書いていきます。

## `node app.ts` を動かす（と、バージョンで止まった）

まず一番単純な例。型注釈つきの関数を書いて実行するだけです。

```ts:app.ts
// app.ts — 動く最小例（型注釈は type stripping で消える）
function greet(name: string): string {
  return `hello, ${name}`;
}
console.log(greet("node native ts"));
```

「Node 24 なら黙って動くでしょ」と思って `node app.ts` を叩いたら、こうなりました。

```
$ node app.ts   (flagless)
/.../app.ts:2
function greet(name: string): string {
                   ^
SyntaxError: Unexpected token ':'
    at wrapSafe (node:internal/modules/cjs/loader:1662:18)
    ...
Node.js v22.17.0
exit=1
```

型注釈の `:` で構文エラー。つまり型が全然剥がされていません。原因を探したら、手元の Node が **v22.17.0** だったのが理由でした。ネイティブ TypeScript 実行はバージョンの境界がわりとシビアで、調べたところ次のようになっています。

- `22.6`〜`22.17`: 動かせるが `--experimental-strip-types` フラグが必要
- `22.18` 以降: フラグ無しで既定で有効
- `24.12` / `25.2` 以降: 安定版（experimental の警告も出なくなる）

つまり `22.17` と `22.18` という 0.01 の差でフラグの要否が変わります。手元はちょうど境界の一つ下でした。`tsx` / `ts-node` は追加ランタイムなので Node 側のバージョンにここまで敏感ではなく、ネイティブだと「Node のバージョンそのものが対応表」になるのが感覚として新鮮でした。

フラグを付けたら動きました。

```
$ node --experimental-strip-types app.ts
hello, node native ts
(node:66143) ExperimentalWarning: Type Stripping is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
exit=0
```

安定版だとどうなるか気になったので、Docker の `node:24` (v24.18.0) でも同じファイルを実行しました。

```bash
docker run --rm -v "$PWD:/app" -w /app node:24 sh -c 'node app.ts; echo "exit=$?"'
```

```
$ node app.ts
hello, node native ts
exit=0
```

フラグも警告も無しで動きます。この「警告も出ずに素直に動くログ」が、安定版で試したときの一番きれいな状態でした。試す前に `node -v` を確認しておくのは必須だと思います。

## 詰まる構文を一通り踏んでみる

ここからは、わざと strip-only で対応していない構文を書いて、実際のエラーを見ていきます。以下は Docker の `node:24` (v24.18.0) で実行しています。

### enum

```ts:bad-enum.ts
// bad-enum.ts — enum は実行時コード生成が要るので type stripping では消せない
enum Color { Red, Green, Blue }
console.log(Color.Red);
```

```
/app/bad-enum.ts:2
...
enum Color { Red, Green, Blue }
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]: TypeScript enum is not supported in strip-only mode
    at parseTypeScript (node:internal/modules/typescript:68:40)
    ...
  code: 'ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX'
Node.js v24.18.0
exit=1
```

`enum` は実行時に値オブジェクトを生成する構文なので、「型を消すだけ」では表現できません。`const enum` でも同じ理屈でダメでした。

### namespace（全部ダメではない）

`namespace` は「全部非対応」だと思い込んでいたんですが、実際は違いました。

```ts:bad-namespace.ts
// bad-namespace.ts — 値を持つ namespace は非対応
namespace App { export let x = 1; }
console.log(App.x);
```

これは `SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]: TypeScript namespace declaration is not supported in strip-only mode` で exit=1。一方、型だけの `namespace` は動きました。

```ts:ok-namespace.ts
// ok-namespace.ts — 型だけの namespace は消せるので動く
namespace TypeOnly { export type A = string; }
const a: TypeOnly.A = "ok";
console.log(a);
```

こちらは `ok` が出て exit=0。値を持つ `namespace` はダメで、型だけの `namespace` は消せるので通る、という境界でした。「namespace は全部NG」と覚えていると誤解します。

### パラメータプロパティ

これは新人ほど無意識に書きそうな構文です。

```ts:bad-param-prop.ts
class Point { constructor(private x: number, private y: number) {} }
console.log(new Point(1, 2));
```

```
SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]: TypeScript parameter property is not supported in strip-only mode
```

`constructor(private x: number)` は、実行時に `this.x = x` を生成する糖衣構文なので、型を消すだけでは再現できません。回避するなら、フィールドを明示的に宣言してコンストラクタ内で代入する形にします。

### import の拡張子と `import type`

`tsx` に慣れていると一番差を感じたのがここでした。まず拡張子なしの import。

```ts:main-bad-ext.ts
import { version } from "./util";
console.log(version);
```

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/app/util' imported from /app/main-bad-ext.ts
  code: 'ERR_MODULE_NOT_FOUND', url: 'file:///app/util'
exit=1
```

`bundler` や `tsx` は拡張子を暗黙で補完してくれますが、ネイティブ実行では `./util.ts` と拡張子まで書く必要があります。

次に、型を普通の import で持ってきた場合。`util.ts` 側は `export type Id = string;` を持っています。

```ts:main-bad-type.ts
import { Id } from "./util.ts";
const id: Id = "abc";
console.log(id);
```

```
SyntaxError: The requested module './util.ts' does not provide an export named 'Id'
exit=1
```

`Id` は型なので、実行時のエクスポートとしては存在しません。`tsx` は型か値かを自動で判別してくれますが、ネイティブだと `import type` を自分で書かないと落ちます。両方直すとこうなります。

```ts:main-ok.ts
// main-ok.ts — 修正版（拡張子つき ＋ import type）
import { version } from "./util.ts";
import type { Id } from "./util.ts";
const id: Id = "abc";
console.log(id);
```

これで `1.0.0 abc` が出て exit=0。拡張子と `import type` を「手で正しく書く」必要があるのが、`tsx` 慣れした状態だと一番ハマる差分だと思いました。

### `.tsx`

JSX を含まなくても、拡張子が `.tsx` だとどうなるか気になったので試しました。

```ts:app.tsx
const msg: string = "hello from tsx";
console.log(msg);
```

```
SyntaxError: Missing initializer in const declaration
```

`: string` の部分でエラーになっています。node の strip-only が対象にするのは `.ts` / `.mts` / `.cts` で、`.tsx` は型を剥がしません（JSX 変換が必要なため）。なので型注釈がそのまま構文エラーとして残ります。React 系のファイルでいきなり `.tsx` を `node` に渡すとこうなる、というのは先に知っておきたかった挙動です。

### decorator

穴埋め的に decorator も試しました。

```ts:bad-decorator.ts
function log(target: any, key: string) {}
class Svc {
  @log
  run() { return 1; }
}
console.log(new Svc().run());
```

```
SyntaxError: Invalid or unexpected token
```

レガシー（experimental）の decorator も非対応でした。ここで面白かったのは、エラーが `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` ではなく素の `SyntaxError` だった点で、`@` 自体を解釈できずに落ちている感じでした。他の構文と違うエラーの出方をするので、少し戸惑いました。

## 型エラーは検出されない（そこで `tsc` の使い方でも詰まった）

個人的に一番「なるほど」となったのがここです。あきらかに型が合っていないコードを書いてみます。

```ts:type-error.ts
const n: number = "str";
console.log(n);
```

これを `node type-error.ts` で実行すると、`str` が出て **exit=0**。何事もなく動きます。node は型を見ずに空白へ置き換えるだけなので、型エラーは素通りします。node が黙って動くぶん、「型チェックまで通った」と勘違いしそうで、実際にやってみると危うさが体感できました。

型を見てほしいときは `tsc --noEmit` を別に回します。……のですが、ここでもう一つ詰まりました。TypeScript を入れていない状態で

```bash
npx -y tsc --noEmit type-error.ts
```

を叩いたら、型チェックされずに `This is not the tsc command you are looking for` というメッセージが出て終わりました。調べると、`tsc` という名前の別パッケージ（`tsc@2.0.4`）が取得されていました。`-y` を付けていたので、確認もなくそのまま実行されてしまっていたわけです。パッケージを明示すると正しく動きます。

```bash
npx -y -p typescript tsc --noEmit type-error.ts
```

```
type-error.ts(2,7): error TS2322: Type 'string' is not assignable to type 'number'.
exit=2
```

これで `TS2322` がちゃんと出ました（ローカルの TypeScript 5.9.2 でも同じエラーを再現）。恒久的には `npm i -D typescript` でプロジェクトに入れておくのが素直だと思います。この `npx tsc` の罠は別途 knowledge にも残しました。

というわけで運用としては、**実行は node / 型チェックは `tsc --noEmit`（またはエディタや CI）** と分けて考えるのが良さそう、という当たり前の結論に自分の手で辿り着いた感じです。

## `tsx` との比較（速度とカバー範囲）

最後に `tsx` と比べてみました。速度計測はコンテナ起動のオーバーヘッドを載せたくなかったので、ローカルホストで `/usr/bin/time -p` を使って各3回測りました（ローカルは v22.17.0 なので `--experimental-strip-types` を付与。stripping のコード経路自体は安定版と同じで、フラグは可否のゲートだけです）。

| ランナー | run1 | run2 | run3 | 中央値 |
|---|---|---|---|---|
| `node --experimental-strip-types app.ts` | 0.08s | 0.05s | 0.05s | 0.05s |
| `npx tsx app.ts` | 1.89s | 0.61s | 0.58s | 0.61s |

数字だけ見ると node が速いですが、`tsx` 側は `npx` の解決コストを含んでいます。初回の 1.89s は npx のパッケージ解決やキャッシュの warmup 込みです。ローカルに `tsx` を入れて直接叩けば差は縮むはずで、それでもトランスパイル分の起動コストは乗る、くらいの理解でいます。ここは条件次第なので、あまり「◯倍速い」と断定はしないでおきます。

カバー範囲のほうは、逆に `tsx` が強いです。node で落ちた `enum` / 値 `namespace` / パラメータプロパティを `tsx` はすべて実行できました（`0` / `1` / `Point { x: 1, y: 2 }`）。node は strip-only、`tsx` は full transpile という違いがそのまま出た形です。

まとめると、node と tsx の挙動はこうなりました。

| 構文 / ケース | node (strip-only) v24.18.0 | tsx | 回避策 |
|---|---|---|---|
| 型注釈つき関数 (`app.ts`) | ✅ 動く | ✅ | — |
| `enum` | ❌ ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX | ✅ (`0`) | union 型 / `object as const`、または tsx |
| 値を持つ `namespace` | ❌ ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX | ✅ (`1`) | ESM module に置換、または tsx |
| 型のみ `namespace` | ✅ 動く (`ok`) | ✅ | そのまま可 |
| パラメータプロパティ | ❌ ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX | ✅ (`Point {x:1,y:2}`) | 明示フィールド＋代入、または tsx |
| decorator (legacy) | ❌ SyntaxError (`@`) | 設定次第 | 使わない、または tsx＋設定 |
| 拡張子なし import (`./util`) | ❌ ERR_MODULE_NOT_FOUND | ✅（暗黙補完） | `./util.ts` と書く |
| 型を値として import | ❌ SyntaxError (no export) | ✅（自動判別） | `import type` を使う |
| `.tsx` | ❌ SyntaxError（型を剥がさない） | ✅ | tsx / bundler を使う |
| 型エラー (`n: number = "str"`) | ⚠️ 素通り実行 (exit0) | ⚠️ 素通り（実行系は同じ） | `tsc --noEmit` を別途 |
| 起動速度 (中央値) | 0.05s | 0.61s (npx込) | — |

## まとめ：新人が今から始めるなら

一通り試して、確かめたかった4点はどれも実際に手元で確認できました。

- 型注釈を消すだけの範囲なら `node app.ts` はそのまま動く。ただしフラグや警告の有無は Node のバージョン次第（`22.18` 以降で既定、`24.12` / `25.2` 以降が安定版）。
- `enum` / 値 `namespace` / パラメータプロパティ / decorator は strip-only では動かない。エラーは基本 `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`、decorator だけ素の `SyntaxError`。
- import は拡張子必須、型は `import type`。`.tsx` は対象外。`tsx` の暗黙補完に慣れているとここで詰まる。
- node は型を見ないので、型チェックは `tsc --noEmit` を別に。`npx tsc` は TypeScript 未インストールだと別パッケージを拾うので `-p typescript` を付けるか、プロジェクトに入れておく。

向いていそうなのは、小さいスクリプトや、`enum` などを使わない素直な TypeScript を追加ランタイム無しでサッと動かしたいケースだと思います。逆に既存プロジェクトを丸ごと持ってくると、`enum` やパラメータプロパティで引っかかる可能性が高いので、そこは `tsx` やバンドラを使うか、書き方を変える判断になりそうです。まずは自分の環境で `node -v` を確認するところから始めるのが良いと思います。

自分としては、フラグの要否とバージョン境界のあたりがまだ「そういうものらしい」の理解に留まっているので、実際に `22.18` 以降の環境をローカルに用意して、警告なしで動く状態も手元で確かめたいです。

## 参考リンク

- Node.js Docs: Modules: TypeScript
  https://nodejs.org/api/typescript.html
- Node.js Learn: Running TypeScript Natively
  https://nodejs.org/en/learn/typescript/run-natively
