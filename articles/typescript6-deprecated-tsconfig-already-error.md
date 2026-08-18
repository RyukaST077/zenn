---
title: "TypeScript 6で「警告」だと思っていたtsconfigは、6の時点でもうビルドを止めていた"
emoji: "🚧"
type: "tech"
topics: ["typescript", "tsconfig", "nodejs", "npm"]
published: true
---

<!-- 前提: 出典ログ logs/run-typescript7-tsconfig-defaults-20260727-0411/execution-log.md / 記事タイプ: 検証ログ（3世代の比較） / slug: typescript6-deprecated-tsconfig-already-error / published: false -->

## はじめに

`npm view typescript dist-tags` を打ってみて、正直ちょっと焦りました。

```text
{
  "dev": "3.9.4",
  "tag-for-publishing-older-releases": "4.1.6",
  "insiders": "4.6.2-insiders.20220225",
  "beta": "6.0.0-beta",
  "rc": "7.0.1-rc",
  "latest": "7.0.2",
  "next": "7.1.0-dev.20260726.1"
}
```

`latest` が `7.0.2` です。つまり今 `npm i -D typescript` と打つだけで TypeScript 7 が入ります。移行を「まだ先の話」だと思っていたんですが、新規に作るプロジェクトはもう7から始まっている状態でした。

そこで、いかにも旧世代という感じの tsconfig（`target: es5` / `moduleResolution: node` / `baseUrl` + `paths` / `downlevelIteration` / `esModuleInterop: false`）を用意して、TypeScript 5.9.3 / 6.0.3 / 7.0.2 の3つに同じものを通してみました。やる前に立てた予測は、だいたいこうです。

- 5.9 は無警告で通る
- 6.0 は deprecation の警告が出るが、ビルド自体は通る（終了コード0）
- 7.0 でハードエラーになって落ちる

このうち2つ目が外れました。6.0 は警告ではなく `error` を出して終了コード2で落ちます。TypeScript 7 を待たずに、6.0 の時点でもうビルドが止まっていました。

この記事は、その一連の比較ログです。「TypeScript 7で急に壊れる」と言われている項目のうち、実際には6.0で始まっていたものがどれなのかを、3世代の実測で切り分けています。

:::message
筆者は新人で、TypeScript のメジャー移行をちゃんと追うのは初めてです。題材は `src/*.ts` が6ファイル45行という極小のものなので、実プロジェクトの数字ではありません。
:::

## 使ったもの・環境

```text
OS: macOS 26.5 (Build 25F71, arm64)
Node.js: v22.17.0
npm: 10.9.2
typescript: 5.9.3 / 6.0.3 / 7.0.2
@types/node: 22.18.13
@typescript/typescript6: 6.0.2（tsc6 --version の報告は Version 6.0.3）
```

確かめたかったのは4つです。

1. 3つのディレクトリで、狙った版の `tsc` が本当に動いているか
2. 同じ tsconfig に対する3世代の出力全文を残すこと
3. 「どの設定が、どの版で、警告なのかハードエラーなのか」の対応表を実測だけで埋めること
4. TypeScript 7 で `tsc --noEmit` が終了コード0になる tsconfig まで持っていくこと

## 検証設計：なぜ3つのディレクトリに分けたか

前に `typescript@7` と `@typescript/typescript6` を同じ `node_modules` に素で同居させて、`node_modules/.bin/tsc` が期待した版で起動しないところで検証が止まったことがありました（別の記事に書きました）。同じ踏み方をしたくなかったので、今回は版を同居させず、`ts59` / `ts60` / `ts70` の3ディレクトリに完全に分けました。

```bash
for pair in "ts59:5.9.3" "ts60:6.0.3" "ts70:7.0.2"; do
  d=${pair%%:*}; v=${pair##*:}
  mkdir -p "$d"; cp -R fixture/tsconfig.json fixture/src "$d"/
  (cd "$d" && npm init -y >/dev/null && npm pkg set private=true \
    && npm i -D --save-exact --ignore-scripts --no-audit --no-fund \
         "typescript@$v" "@types/node@22.18.13")
done
```

そして測る前に、版ゲートを置きました。`--version` の出力を `grep -q` で機械的に照合して、1つでも違ったらそこで止める、というだけのものです。

```bash
for pair in "ts59:5.9.3" "ts60:6.0.3" "ts70:7.0.2"; do
  d=${pair%%:*}; v=${pair##*:}
  out=$(cd "$d" && node node_modules/typescript/bin/tsc --version)
  echo "$out" | grep -q "Version $v" && echo "GATE OK: $d" || echo "GATE NG: $d"
done
```

```text
===== ts59 expect 5.9.3 =====
Version 5.9.3
GATE OK: ts59
===== ts60 expect 6.0.3 =====
Version 6.0.3
GATE OK: ts60
===== ts70 expect 7.0.2 =====
Version 7.0.2
GATE OK: ts70
GATE_FAIL=0
```

今回は一発で通りました。地味な工程ですが、前回これが無くて「TypeScript 6を2回測っていた」に近い事故になりかけたので、比較検証では入れておいてよかったと思っています。

`tsc` の呼び出しに `npx tsc` を使っていないのは、npm に同名のスクワッターパッケージ `tsc@2.0.4` があって別物に解決されることがあるからです（これも前に一度踏みました）。全部 `node node_modules/typescript/bin/tsc` を直接叩いています。

### 版ゲートのついでに気づいたこと

`ls -l node_modules/.bin/` を並べて見ていたら、ts70 だけ中身が違いました。

```text
# ts59 / ts60
tsc -> ../typescript/bin/tsc
tsserver -> ../typescript/bin/tsserver

# ts70
tsc -> ../typescript/bin/tsc
```

TypeScript 7 の `typescript` パッケージには `tsserver` が入っていません。エディタが使う言語サーバが同梱されない、ということです。これは後半の side-by-side の話とつながります。

あと ts70 だけ `added 4 packages`（他は3）でした。TypeScript 7 はプラットフォーム別のネイティブバイナリ（手元では `@typescript/typescript-darwin-arm64`）を optionalDependencies で引くためです。

## 旧世代 tsconfig の fixture

1ファイル1罠を原則にして、こういうものを置きました。

```json:fixture/tsconfig.json
{
  "compilerOptions": {
    "target": "es5",
    "module": "commonjs",
    "moduleResolution": "node",
    "baseUrl": ".",
    "paths": {
      "@lib/*": ["src/lib/*"]
    },
    "downlevelIteration": true,
    "esModuleInterop": false,
    "outDir": "dist"
  },
  "include": ["src"]
}
```

`strict` と `types` は「未指定」であることが罠なので、あえて書いていません。コード側はこんな感じです。

```ts:fixture/src/loose.ts
// 罠7: strict 未指定前提のゆるいコード
export function double(n) {
  return n * 2;
}

export function head(items: string[] | undefined) {
  return items[0].toUpperCase();
}

let box: string = null;
export { box };
```

```ts:fixture/src/node-env.ts
// 罠8: types 未指定。@types/node が自動で拾われる前提のコード
export const stage = process.env.NODE_ENV;
export const cwd = process.cwd();
```

```ts:fixture/src/interop.ts
// 罠5: esModuleInterop: false 前提の CommonJS スタイル import
import * as path from "path";

export function join(a: string, b: string): string {
  return path.join(a, b);
}
```

他に `paths` エイリアス経由の import（`@lib/greet`）と、`downlevelIteration` が効く `for...of` を入れて、合計6ファイル45行です。

`moduleResolution: classic` や `module: amd/umd/systemjs` は、実務で見かける頻度が低いので入れませんでした。`allowSyntheticDefaultImports: false` は `esModuleInterop` と連動するので後者で代表させています。

## TypeScript 5.9 では通る（基準線）

```bash
(cd ts59 && node node_modules/typescript/bin/tsc --noEmit)
```

```text
exit=0
error_lines=0
```

出力ゼロです。この tsconfig とこのコードは 5.9 では本当に何も言われずに通ります。基準線としては成立しました。

## TypeScript 6.0 は「警告」ではなく落ちる

ここで予測が外れました。

```text
tsconfig.json(3,15): error TS5107: Option 'target=ES5' is deprecated and will stop functioning in TypeScript 7.0. Specify compilerOption '"ignoreDeprecations": "6.0"' to silence this error.
tsconfig.json(5,25): error TS5107: Option 'moduleResolution=node10' is deprecated and will stop functioning in TypeScript 7.0. Specify compilerOption '"ignoreDeprecations": "6.0"' to silence this error.
  Visit https://aka.ms/ts6 for migration information.
tsconfig.json(6,5): error TS5101: Option 'baseUrl' is deprecated and will stop functioning in TypeScript 7.0. Specify compilerOption '"ignoreDeprecations": "6.0"' to silence this error.
  Visit https://aka.ms/ts6 for migration information.
tsconfig.json(10,5): error TS5101: Option 'downlevelIteration' is deprecated and will stop functioning in TypeScript 7.0. Specify compilerOption '"ignoreDeprecations": "6.0"' to silence this error.
tsconfig.json(11,24): error TS5107: Option 'esModuleInterop=false' is deprecated and will stop functioning in TypeScript 7.0. Specify compilerOption '"ignoreDeprecations": "6.0"' to silence this error.

exit=2
error_lines=5
```

`warning` ではなく `error` で、終了コードは2です。CIなら普通に赤くなります。メッセージ自身が "deprecated" と言いながら "to silence this **error**" と書いていて、読みながら「あ、そういうことか」となりました。deprecation は非致命的なもの、という思い込みがあったんですが、TypeScript の設定オプションについてはそうではないようです。

エラーコードが2種類に分かれているのも予測していませんでした。並べてみると規則性があって、値が問題な場合は `TS5107`（`target=ES5` のように `オプション=値` で表示される）、オプションの存在自体が問題な場合は `TS5101`（`baseUrl` / `downlevelIteration`）でした。

もう一つ、`src/` 由来の行が1件もありません。型エラーがゼロです。設定エラーで止まっているので、型チェックまで到達していないようでした。

## TypeScript 7.0 で何がハードエラーになったか

```text
tsconfig.json(3,15): error TS5108: Option 'target=ES5' has been removed. Please remove it from your configuration.
tsconfig.json(5,25): error TS5108: Option 'moduleResolution=node10' has been removed. Please remove it from your configuration.
tsconfig.json(6,5): error TS5102: Option 'baseUrl' has been removed. Please remove it from your configuration.
  Use '"paths": {"*": ["./*"]}' instead.
tsconfig.json(8,18): error TS5090: Non-relative paths are not allowed. Did you forget a leading './'?
tsconfig.json(10,5): error TS5102: Option 'downlevelIteration' has been removed. Please remove it from your configuration.
tsconfig.json(11,24): error TS5108: Option 'esModuleInterop=false' has been removed. Please remove it from your configuration.

exit=1
error_lines=6
```

6.0 の出力と見比べると、エラーコードが `TS5101` → `TS5102`、`TS5107` → `TS5108` と1つずつ繰り上がっています。deprecated と removed が番号で対応している設計みたいです。覚えなくていい話ですが、両方の出力を並べたときに読みやすくなりました。

気になったのは終了コードです。6.0 は `2`、7.0 は `1` を返します。どちらも「設定エラーで落ちた」なのに値が違うので、CIスクリプトで `if [ $? -eq 2 ]` みたいに値で分岐していると挙動が変わります。

それと 7.0 だけ `TS5090` が増えて6件になっています。`paths` の値 `["src/lib/*"]` が非相対パスだという指摘で、6.0 は `baseUrl` を deprecated と言うだけで `paths` の中身までは見ていませんでした。7.0 だけが値を検証しているようです。

型エラーがゼロ行なのは 6.0 と同じでした。

エラーメッセージについては、正直かなり親切だと感じました。`baseUrl` には `Use '"paths": {"*": ["./*"]}' instead.` が付いているし、`TS5090` は `Did you forget a leading './'?` と直し方まで書いてあります。この記事の後半で実際に潰していきますが、ほぼメッセージを読むだけで済みました。

## 設定 → 3世代での扱い

この記事に貼った出力と、後半で個別に測った分の実測です（`alwaysStrict` は 7.0 のみ単独プローブしたので、5.9 / 6.0 は未計測です）。

| 設定 | TS 5.9.3 | TS 6.0.3 | TS 7.0.2 |
|---|---|---|---|
| `"target": "es5"` | 無警告で通る | `error TS5107`（`ignoreDeprecations` で抑制可） | `error TS5108` removed |
| `"moduleResolution": "node"` | 無警告で通る | `error TS5107`（node10 と表示） | `error TS5108` removed |
| `"baseUrl": "."` | 無警告で通る | `error TS5101` | `error TS5102` removed |
| `paths` の非相対値 `["src/lib/*"]` | 通る | 指摘なし | `error TS5090` 非相対パス禁止 |
| `"downlevelIteration": true` | 無警告で通る | `error TS5101` | `error TS5102` removed |
| `"esModuleInterop": false` | 無警告で通る | `error TS5107` | `error TS5108` removed |
| `"alwaysStrict": false` | （未計測） | （未計測） | `error TS5108` removed |
| `"module": "commonjs"` | 通る | 通る | 通る |
| `strict` 未指定 | 非strict（型エラー0） | strict 既定ON → TS7006/TS18048/TS2322 | 同左 |
| `types` 未指定 + `@types/node` | 自動探索され通る | `types: []` 既定 → TS2591 ×3 | 同左 |
| `ignoreDeprecations: "6.0"` | — | 効く（5件すべて抑制） | 無視される |
| 終了コード（設定エラー時） | 0 | 2 | 1 |
| `tsserver` バイナリ | あり | あり | 無い |

`module: commonjs` は廃止されていません。ここは予測どおりでした。

外した予測を並べるとこうなります。

| 立てた予測 | 実際 |
|---|---|
| TS6 は deprecation 警告で終了コード0で通る | `error` で終了コード2で落ちる。TS7を待たず6.0で止まる |
| `baseUrl` を消すと `paths` 解決が全滅する | 全滅しない。`paths` は `baseUrl` に依存していなかった |
| `ignoreDeprecations` は TS7 で未知オプションとして弾かれる | 弾かれない。黙って無視される |
| 題材が小さすぎて速度差は出ない | 45行でも約4.1倍出た（公称の8〜12倍には届かない） |
| （予測していなかった） | 終了コードが 6.0=2 / 7.0=1 で違う |
| （予測していなかった） | TS7 の `typescript` パッケージに `tsserver` が無い |

`alwaysStrict: false` は fixture 本体に入れなかったので単独で試しました。7.0 では `error TS5108: Option 'alwaysStrict=false' has been removed.` になります。`esModuleInterop: false` と同じで、`false` を明示的に書くこと自体が禁止されている形です。単独プローブは 7.0 だけなので、5.9 / 6.0 での挙動は測っていません。

## 1件ずつ潰して通すまで（件数は単調減少しなかった）

7.0 のエラーを、1回の変更で1つの設定だけ触るようにして潰していきました。毎回の残り件数を記録すると、こうなりました。

| step | 変更内容 | 残りエラー件数 | exit |
|---|---|---|---|
| 0 | （初期状態） | 6 | 1 |
| 1 | `"target": "es5"` → `"es2022"` | 5 | 1 |
| 2 | `"moduleResolution": "node"` を削除 | 4 | 1 |
| 3 | `"baseUrl": "."` を削除 | 3 | 1 |
| 4 | `"downlevelIteration": true` を削除 | 2 | 1 |
| 5 | `"esModuleInterop": false` を削除 | 1 | 1 |
| 6 | `paths` を `["src/lib/*"]` → `["./src/lib/*"]` | 1 → 6 | 1 |
| 7 | `"types": ["node"]` を追加 | 3 | 1 |
| 8 | `src/loose.ts` を strict 対応に修正（コード側） | 0 | 0 |

step 6 で跳ね返っています。設定エラーの最後の1件を消した瞬間に、それまで隠れていた型エラーが6件まとめて出てきました。

```text
src/interop.ts(2,23): error TS2591: Cannot find name 'path'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
src/loose.ts(2,24): error TS7006: Parameter 'n' implicitly has an 'any' type.
src/loose.ts(7,10): error TS18048: 'items' is possibly 'undefined'.
src/loose.ts(10,5): error TS2322: Type 'null' is not assignable to type 'string'.
src/node-env.ts(2,22): error TS2591: Cannot find name 'process'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
src/node-env.ts(3,20): error TS2591: Cannot find name 'process'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.

exit=1
error_lines=6
```

6 → 5 → 4 → 3 → 2 → 1 → 6 です。「残り1件」を見て終わりが近いと思っていたので、ここでちょっと笑ってしまいました。設定エラーがある間は型チェックに到達しないので、型エラーの件数は最後まで見えません。エラー件数を進捗として見るなら、設定エラーと型エラーは別に数えるべきでした。

もう一つ外したのが `baseUrl` です。「`paths` の基準点を消したら `paths` 解決が全滅する」と思っていたんですが、step 3 で `baseUrl` を消しても `paths` 由来の新規エラーは出ませんでした。`TS5090`（非相対パス）は step 0 の時点から出ていて、`baseUrl` の有無とは無関係でした。TypeScript 7 の `paths` は、値を `./` 始まりの相対パスにすれば tsconfig の位置基準で解決されるので、基準点のオプションが要らなくなっている、という理解でいます。エラーメッセージの `Use '"paths": {"*": ["./*"]}' instead.` がまさにそれを言っていました。

最終的な tsconfig の差分です。

```diff
 {
   "compilerOptions": {
-    "target": "es5",
+    "target": "es2022",
     "module": "commonjs",
-    "moduleResolution": "node",
-    "baseUrl": ".",
     "paths": {
-      "@lib/*": ["src/lib/*"]
+      "@lib/*": ["./src/lib/*"]
     },
-    "downlevelIteration": true,
-    "esModuleInterop": false,
-    "outDir": "dist"
+    "outDir": "dist",
+    "types": ["node"]
   },
   "include": ["src"]
 }
```

コード側は `loose.ts` だけ直しました。

```ts:src/loose.ts
// 罠7: strict 既定ON に合わせて直したあと
export function double(n: number) {
  return n * 2;
}

export function head(items: string[] | undefined) {
  return items?.[0]?.toUpperCase();
}

let box: string | null = null;
export { box };
```

これで `tsc --noEmit` が終了コード0、エラー0行になりました。

## strict 既定ONで出た型エラーは、TypeScript 7の話ではなかった

出たエラーを由来で分けるとこうなります。

| 分類 | エラーコード | 件数 | 由来 |
|---|---|---|---|
| 設定エラー | TS5108 / TS5102 / TS5090 | 6 | TS7 の removal（6.0では TS5107/TS5101 で5件） |
| 型エラー（`types: []` 由来） | TS2591 | 3 | 6.0 からの既定変更 |
| 型エラー（`strict` 由来） | TS7006 / TS18048 / TS2322 | 3 | 6.0 からの既定変更 |

TS7006 が暗黙の any、TS18048 が possibly 'undefined'、TS2322 が null の非代入、TS2591 が名前が見つからない（node の型）です。

このうち下2行は TypeScript 7 固有ではありません。同じ fixture で `types` 未指定のまま3版を比べると、境目が 6.0 にあることが分かります。`@types/node@22.18.13` はどのディレクトリにも入れた状態です。

| 版 | `types` 未指定のとき | 結果 |
|---|---|---|
| 5.9.3 | 自動探索される | exit=0 / エラー0件 |
| 6.0.3 | 自動探索されない | exit=2 / TS2591 が3件 |
| 7.0.2 | 自動探索されない | exit=1 / TS2591 が3件 |

`"types": ["node"]` を明示すれば 6.0 / 7.0 とも TS2591 は3件とも消えます。`@types/node` を入れているのに `process` が見つからない現象は 6.0 で始まった挙動で、7.0 の新機能ではない、ということでした。ここを混ぜて説明している記事をいくつか見かけたので、自分でも取り違えていました。

エラーメッセージ自身が答えを書いていて、``Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.`` の後半（"add 'node' to the types field"）が、すでに入れている人向けの答えになっています。前半だけ読んで「もう入ってるけど？」とやったのは自分です。

なお `strict` 由来の3件は `"strict": false` を書けば消えて終了コード0になります。試して確認しましたが、今回は最終形をコード側の修正にしました。

## `ignoreDeprecations` はTypeScript 7で効くのか

6.0 のエラーメッセージが自分で `Specify compilerOption '"ignoreDeprecations": "6.0"' to silence this error.` と案内してくるので、これが7.0でも効くのかは一番気になっていました。

6.0 に入れた場合、deprecation の5件はすべて消えました。そして代わりに、隠れていた型エラー6件が出てきます。

```text
src/interop.ts(2,23): error TS2591: Cannot find name 'path'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
src/loose.ts(2,24): error TS7006: Parameter 'n' implicitly has an 'any' type.
src/loose.ts(7,10): error TS18048: 'items' is possibly 'undefined'.
src/loose.ts(10,5): error TS2322: Type 'null' is not assignable to type 'string'.
src/node-env.ts(2,22): error TS2591: Cannot find name 'process'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
src/node-env.ts(3,20): error TS2591: Cannot find name 'process'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.

exit=2
```

7.0 に入れた場合は、6件が1件も減りませんでした。

```text
tsconfig.json(3,15): error TS5108: Option 'target=ES5' has been removed. Please remove it from your configuration.
tsconfig.json(5,25): error TS5108: Option 'moduleResolution=node10' has been removed. Please remove it from your configuration.
tsconfig.json(6,5): error TS5102: Option 'baseUrl' has been removed. Please remove it from your configuration.
  Use '"paths": {"*": ["./*"]}' instead.
tsconfig.json(9,9): error TS5090: Non-relative paths are not allowed. Did you forget a leading './'?
tsconfig.json(12,5): error TS5102: Option 'downlevelIteration' has been removed. Please remove it from your configuration.
tsconfig.json(13,24): error TS5108: Option 'esModuleInterop=false' has been removed. Please remove it from your configuration.
```

予測では「未知のオプションとして弾かれる」だったんですが、外れました。7.0 は `ignoreDeprecations` について怒りもしないし、効きもしません。「そのオプションはもう意味がない」とも言ってくれないので、tsconfig に書いてあるのを見て「一応対策済み」と思っていると気づけないと思います。この静かな無視が、今回いちばん怖かった挙動でした。

6.0 と 7.0 の差はここに集約されるように見えます。6.0 は落ちるけれど `ignoreDeprecations` という逃げ道がある。7.0 は落ちて逃げ道がない。移行を先延ばしできる期限が、そのまま `ignoreDeprecations` の寿命でした。6.0 で警告（実際はエラーですが）を消して先送りした分は、7.0 で一括で請求される形になります。

## 型チェックは本当に速いのか

ネイティブ化の速度も測ってみました。エラーの有無で処理経路が変わると比較にならないので、3版とも終了コード0になる状態に揃えてから、同じ tsconfig・同じ `src` で5回ずつです。

| 版 | 1 | 2 | 3 | 4 | 5 | 中央値 | 最小 |
|---|---|---|---|---|---|---|---|
| 5.9.3 | 5336 | 5610 | 5223 | 5550 | 5478 | 5478 | 5223 |
| 6.0.3 | 5629 | 5598 | 5333 | 5563 | 5525 | 5563 | 5333 |
| 7.0.2 | 1393 | 1343 | 1289 | 1322 | 1173 | 1322 | 1173 |

単位は ms です。中央値の比で 5.9.3 / 7.0.2 が約4.1倍、6.0.3 / 7.0.2 が約4.2倍でした。`--singleThreaded` を1回だけ試したら 1643ms で、通常の中央値より遅いものの桁は変わりませんでした。

「6ファイル45行なんてプロセス起動が支配的で差なんて出ないだろう」と予測していたので、これも外れです。ただ[公式アナウンス](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)が言う8〜12倍には届きません（この倍率は実測ではなく公式の数字です）。というより、45行のプロジェクトで5秒かかっている時点で、測っているのは自分のコードではなく `lib.*.d.ts` と `@types/node` の読み込みと起動のコストが主だと思います。そこがネイティブ化で速くなった分が4倍として出た、という読み方が今のところ自分の中では一番納得できました。

5.9 と 6.0 の間にほぼ差がないのも、両方とも同じJS実装なので順当です。差はGo実装のネイティブ化そのものから来ています。

繰り返しになりますが、この4倍は6ファイル45行という極小の題材の参考値です。実プロジェクトでこうなるという話ではありません。

## side-by-side 併用（前回の宿題）

前回 `tsc` の bin が衝突して止まったので、4つ目の隔離ディレクトリで、公式が案内しているエイリアス構成をそのまま試しました。

```bash
npm i -D --ignore-scripts --no-audit --no-fund \
  "@typescript/native@npm:typescript@^7.0.2" \
  "typescript@npm:@typescript/typescript6@^6.0.2"
```

```json:package.json
{
  "@typescript/native": "npm:typescript@^7.0.2",
  "typescript": "npm:@typescript/typescript6@^6.0.2"
}
```

`.bin` はこうなりました。

```text
tsc -> ../@typescript/native/bin/tsc
tsc6 -> ../typescript/bin/tsc6
tsserver -> ../@typescript/old/bin/tsserver
```

```text
./node_modules/.bin/tsc --version   → Version 7.0.2
./node_modules/.bin/tsc6 --version  → Version 6.0.3
```

前回の衝突は再現しませんでした。理由も構造から分かりました。`@typescript/typescript6` が提供する bin は `tsc6` だけで、`tsc` を持っていません（`ls node_modules/typescript/bin/` の中身が `tsc6` のみ）。だから `tsc` という名前を奪い合いません。前回は自己流で `typescript@6` と `typescript@7` を素で入れたので、同じ名前を取り合ったわけです。

もう一つ、`@typescript/old`（`typescript@6.0.3` の実体）は消えたわけではなく、`.bin/tsserver` の供給元になっていました。ts70 単体で見た「TypeScript 7 に `tsserver` が無い」と辻褄が合います。エディタ側は実質まだ 6.0 が動いている構成です。

両方で同じ fixture（7.0 を通った最終 tsconfig）を型チェックしたら、`tsc` も `tsc6` も終了コード0でした。

途中 `sbs/` だけ `error TS2688: Cannot find type definition file for 'node'` が出て少し止まりました。`types: ["node"]` は tsconfig に書いてあるのに `@types/node` を入れ忘れていただけです。型定義が無いときは TS2591 ではなく TS2688 になるのが、あとから見ると区別として分かりやすかったです。

`npm ls` の出力が `UNMET OPTIONAL DEPENDENCY` だらけになるのは驚きましたが、これは正常でした。`@typescript/native` が20個のプラットフォーム別 optionalDependencies を持っていて、実環境（darwin-arm64）以外は全部入らないためです。

## 移行を止める条件

今回の実測と、既に分かっている一次情報を並べます。

上げてよさそうだと思った材料。

- `tsc --noEmit` / `tsc` のビルドだけで完結しているなら、設定の直しはそこまで大変ではない（6ファイルの題材では終了コード0まで到達できた）
- 直し方はエラーメッセージがそのまま教えてくれる
- 型チェックは実測で約4倍速い

保留したほうがよさそうだと思った材料。

- `tsserver` が同梱されない。TypeScript 7 単独ではエディタ体験を賄えず、公式の side-by-side 構成でも `tsserver` は `@typescript/old`（6.0.3）から供給されていた
- Compiler API（プログラマティックAPI）が 7.0 には無く 7.1 予定。API に依存するツールは動かない（[公式アナウンス](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)）
- Vue / Svelte / Astro / MDX / Angular テンプレートなどの埋め込み言語は未対応（同[公式アナウンス](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)。ここは自分では確かめていません）
- `typescript-eslint` が TypeScript 7 でクラッシュした（自分の別の検証で踏んだ範囲の話です。今回は lint を入れず `tsc` 単体に閉じました）
- `ignoreDeprecations` の猶予は 6.0 まで

## まとめ

やってみて自分の理解が一番変わったのは、「TypeScript 7で壊れる」と言われている話が、実際には2つの層に分かれていたところです。

`strict` 既定ONと `types: []` 既定は 6.0 の変更で、7.0 固有ではありません。7.0 で変わったのは、6.0 が `error` にしつつ `ignoreDeprecations` で黙らせられた設定が、本当に消えて逃げ道が無くなったことでした。そして 6.0 の時点で既にビルドは止まっています。「6.0 は警告だから急がなくていい」は、少なくとも今回の tsconfig では成り立ちませんでした。

`tsc` だけで完結しているプロジェクトなら、エラーメッセージを読みながら順番に潰していけそうです。ただ、エディタが実質 6.0 で動く構成になる点と Compiler API が 7.1 待ちな点は、自分だとまだ判断がつきません。ここは実際に移行した人の話を読みたいところです。

測り切れていないものもあります。`alwaysStrict: false` の 5.9 / 6.0 での挙動は測っていないし、速度の4倍は45行の題材の参考値でしかありません。実プロジェクトの規模でどうなるかは、別に測らないと分からないままです。

### 手元で試すときの最短手順

```bash
mkdir -p ts70 && cd ts70
npm init -y && npm pkg set private=true
npm i -D --save-exact typescript@7.0.2 @types/node@22.18.13
# 版ゲート（npx tsc は使わない）
node node_modules/typescript/bin/tsc --version   # → Version 7.0.2
# 旧世代 tsconfig を置いて
node node_modules/typescript/bin/tsc --noEmit; echo "exit=$?"
```

:::message alert
つまずいたところの引き継ぎ。

- `npx tsc` を使わない。npm に同名のスクワッターパッケージ `tsc@2.0.4` があり、別物に解決されることがある
- 複数版を1つの `node_modules` に同居させない。比較するなら版ごとにディレクトリを分けて、実行前に `--version` を `grep -q` で機械検証する
- 同居させたいなら自己流ではなく公式のエイリアス構成（`@typescript/native` = 7 / `typescript` = `@typescript/typescript6`、bin は `tsc` と `tsc6`）を使う
- 設定エラー時の終了コードは 6.0 が `2`、7.0 が `1`。CIで `$?` を値で判定していると挙動が変わる
- 時間を測るなら macOS の `date` は `%3N`（ミリ秒）に非対応。`date +%s%3N` が `1769...N` みたいな文字列を返して `bad math expression: operator expected at 'N'` で落ちるので、`python3 -c 'import time;print(int(time.time()*1000))'` などに置き換える
- `npm ls` で TypeScript 7 のプラットフォーム別 optionalDependencies が `UNMET OPTIONAL DEPENDENCY` と大量に出るのは正常
:::

## 参考リンク

https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/

https://www.typescriptlang.org/tsconfig/

6.0 のエラーメッセージ内で案内される移行情報のリンクは `https://aka.ms/ts6` です。
