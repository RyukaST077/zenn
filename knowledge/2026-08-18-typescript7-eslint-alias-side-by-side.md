---
title: "TypeScript 7.0 に上げると typescript-eslint が `typescript-eslint does not support TS 7.0.` で起動不能になる（公式 alias 併用構成で解決）"
date: "2026-08-18"
cause_category: "Dependency"
tech: [node, typescript, eslint, npm, pnpm]
error_type: [Error, PeerDependencyMismatch, ModuleResolution]
library: [typescript, "@typescript/typescript6", "@typescript/native", typescript-eslint, eslint]
keywords: [typescript 7, TS7, typescript-eslint, does not support TS 7.0, alias, npm:@typescript/typescript6, "@typescript/native", side-by-side, bin 衝突, tsc6, version.cjs, createProgram undefined, ERESOLVE overriding peer dependency, "<6.1.0"]
status: "resolved"   # resolved | workaround | unresolved
---

# 開発ナレッジ報告書

## タイトル
TypeScript 7.0 に上げると typescript-eslint が `typescript-eslint does not support TS 7.0.` で起動不能になる（公式 alias 併用構成で解決）

## 概要
`typescript@7.0.2`（Go ネイティブ版）に単純アップグレードすると `tsc` は約9倍速くなる一方、`eslint` が lint を1件も走らせずに throw する。
`typescript@7.0.2` の `exports["."]` は `./lib/version.cjs` しか無く Compiler API が同梱されていないため。
公式の side-by-side（alias）構成に書き換えると、`tsc` = 7.0.2 / lint = 6.0 API が両立する。npm 10.9.2・pnpm 10.13.1 の両方で成功した。

## 背景
- プロジェクト: 024_zenn（run-practice で TypeScript 7.0 GA の検証中）
- 技術スタック: macOS 26.5 arm64（論理10コア）/ Node v22.17.0 / npm 10.9.2 / pnpm 10.13.1 / eslint 10.8.1 / typescript-eslint 8.67.0
- 発生タイミング: `npm i -D typescript@7.0.2` の後、`npx eslint .` の初回実行時
- 既存ナレッジ `2026-07-09-typescript-eslint-typescript7-cjs-crash.md` の続報。
  typescript-eslint 8.63.0 では `TypeError: Cannot read properties of undefined (reading 'Cjs')` だったが、
  8.67.0 では**明示的なガード付きエラー**に変わっている（原因は同じ）。

## 問題
`npm i -D --save-exact typescript@7.0.2` は npm 10.9.2 では**警告どまりで成功する**（`ERESOLVE overriding peer dependency` を8回）。
そのため気づかずに進むと、次で初めて落ちる。

```
$ ./node_modules/.bin/eslint .
typescript-eslint does not support TS 7.0.
Please see https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6.0 to run typescript-eslint using the TS 6 API.
See also https://github.com/typescript-eslint/typescript-eslint/issues/10940 for tracking typescript-eslint's support for TS >=7.1

Oops! Something went wrong! :(

ESLint: 10.8.1

Error: typescript-eslint does not support TS 7.0.
    at Object.<anonymous> (.../node_modules/typescript-eslint/dist/index.js:52:11)
```

## 原因
`typescript@7.0.2` は Compiler API を同梱しない。

```bash
$ node -e "console.log(require.resolve('typescript'))"
.../node_modules/typescript/lib/version.cjs
$ node -e "const ts=require('typescript'); console.log(Object.keys(ts))"
[ 'version', 'versionMajorMinor' ]
$ node -e "const ts=require('typescript'); console.log(typeof ts.createProgram)"
undefined
```

typescript-eslint 8.67.0 は `dist/index.js` 冒頭で `ts.versionMajorMinor` を見て 7 以上なら自ら throw する。
peer も `typescript: ">=4.8.4 <6.1.0"` で 7.0.2 は範囲外。

## 解決方法 / 効いた対処
公式アナウンスの alias 併用構成に `package.json` を書き換え、`node_modules` と lockfile を消して入れ直す。

```json
{
  "devDependencies": {
    "@typescript/native": "npm:typescript@^7.0.2",
    "typescript": "npm:@typescript/typescript6@^6.0.2"
  }
}
```

```bash
rm -rf node_modules package-lock.json && npm i
```

結果（npm 10.9.2）。peer 警告も消える。

```
node_modules/.bin/tsc  -> ../@typescript/native/bin/tsc   => Version 7.0.2
node_modules/.bin/tsc6 -> ../typescript/bin/tsc6          => Version 6.0.3
$ ./node_modules/.bin/eslint .   => 7 errors（TS6 構成と完全一致）
```

`tsc` は 7.0.2（0.37s）、lint は `typescript` = `@typescript/typescript6` 経由で 6.0 API（`createProgram` は `function`）を掴む。
pnpm 10.13.1 でも同じ `package.json` でそのまま成功した。

## 予防・再発防止
- `npm i` が **警告どまりで成功しても安心しない**。`ERESOLVE overriding peer dependency` は実害（lint 起動不能）の予告。
  導入前に `npm view typescript-eslint@<版> peerDependencies --json` で範囲を見る。
- TS7 に上げる前に `npm view typescript@7.0.2 exports --json` で `exports["."]` を確認する。
  `./lib/version.cjs` だけなら、Compiler API に依存するツール（typescript-eslint / ts-jest / ts-morph / Vue / Svelte / Astro 等）は全滅する前提で計画する。
- 過去（2026-07-11）に `typescript@7.0.2` + `@typescript/typescript6@6.0.2` を**素直に併記**したときは
  `.bin/tsc` が `@typescript/old/bin/tsc`（6.0.3）に張られ `tsc` / `tsc6` 両方が `Version 6.0.3` になった。
  **alias（`@typescript/native`）を使うこと**が bin 衝突の回避条件。構成を変えたら必ず
  `ls -l node_modules/.bin/tsc*` と各バイナリの `--version` で実体を検証する。
- Yarn 4.16.0 + `nodeLinker: node-modules` には typescript-go#4368（現在 Closed）の既知問題があった。Yarn 利用時は要確認。
