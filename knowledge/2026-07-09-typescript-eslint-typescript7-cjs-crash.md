---
title: "typescript-eslint 8.x が TypeScript 7.x で `Cannot read properties of undefined (reading 'Cjs')` でクラッシュする"
date: "2026-07-09"
cause_category: "Dependency"
tech: [node, typescript, eslint]
error_type: [TypeError, PeerDependencyMismatch]
library: [typescript-eslint, "@typescript-eslint/typescript-estree", typescript, eslint]
keywords: [typescript-eslint, typescript 7, TS7, Cjs, unmet peer typescript, "<6.1.0", peer dependency, eslint flat config, typescript-estree, shared.js]
status: "resolved"   # resolved | workaround | unresolved
---

# 開発ナレッジ報告書

## タイトル
typescript-eslint 8.x が TypeScript 7.x で `Cannot read properties of undefined (reading 'Cjs')` でクラッシュする

## 概要
`pnpm add -D eslint typescript-eslint typescript` で最新を入れると `typescript@7.0.2` が解決され、`typescript-eslint@8.63.0` の peer 範囲 `>=4.8.4 <6.1.0` を外れる。この状態で `npx eslint .` を実行すると `@typescript-eslint/typescript-estree` の `create-program/shared.js` で `TypeError: Cannot read properties of undefined (reading 'Cjs')` が発生し、lint が一切走らない。TypeScript を peer 範囲内（例 `5.9.3`）に固定すると解消する。

## 背景
- プロジェクト: 024_zenn（run-practice で oxlint 移行検証中に発生）
- 作業内容: React+TS の ESLint flat config サンプルを用意し `npx eslint .` を通そうとした
- 技術スタック: Node.js v22.17.0, pnpm 10.13.1, eslint 10.6.0, typescript-eslint 8.63.0
- 発生タイミング: `pnpm add -D` 直後、`npx eslint .` の初回実行時
- インストール時に既に `WARN Issues with peer dependencies found` / `unmet peer typescript@">=4.8.4 <6.1.0": found 7.0.2` が出ていた

## 問題
- 期待した挙動: ESLint が flat config を読んで lint 結果を出力する
- 実際の挙動: 下記でクラッシュし lint されない（"Oops! Something went wrong! :("）

```
TypeError: Cannot read properties of undefined (reading 'Cjs')
    at Object.<anonymous> (.../@typescript-eslint/typescript-estree@8.63.0_typescript@7.0.2/.../create-program/shared.js:59:18)
```

## 原因
`typescript@latest` が 7.x（ネイティブ移植版）に到達しており、typescript-eslint 8.x はまだ TS 7 の内部 API に未対応。peer 範囲外の TS を掴むと typescript-estree の初期化でクラッシュする。インストール時の peer 警告が実害（起動不能）として顕在化したもの。

## 解決方法 / 効いた対処
TypeScript を typescript-eslint の peer 範囲内に固定する。

```bash
pnpm add -D typescript@5.9.3
```

その後 `npx eslint .` は正常に完走した。

## 予防・再発防止
- `pnpm add` 時の `unmet peer typescript` 警告を無視しない。ESLint(TS連携)導入時は typescript-eslint の peer 範囲に合う TS を明示指定する。
- `typescript@latest` が 7.x を返す時期は、Lint/型ツールが追従するまで 5.x 系を固定するのが無難。
