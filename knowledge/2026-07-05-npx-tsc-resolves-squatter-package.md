---
title: "`npx tsc` が本物のTypeScriptではなく別パッケージ(tsc@2.0.4)に解決されて型チェックできない"
date: "2026-07-05"
cause_category: "Dependency"
tech: [node, typescript, npx]
error_type: [WrongPackageResolved]
library: [typescript, tsc]
keywords: [npx tsc, This is not the tsc command you are looking for, tsc@2.0.4, typescript未インストール, npx -p typescript tsc, スクワッター, 別パッケージ]
status: "resolved"   # resolved | workaround | unresolved
---

# 開発ナレッジ報告書

## タイトル
`npx tsc` が本物のTypeScriptではなく別パッケージ(tsc@2.0.4)に解決されて型チェックできない

## 概要
TypeScriptを未インストールのクリーン環境（Docker `node:24` コンテナ）で `npx -y tsc --noEmit foo.ts` を実行したところ、本物のTypeScriptコンパイラではなく、npm上に存在する同名の別パッケージ `tsc@2.0.4`（deprecated）が取得・実行されてしまい、`This is not the tsc command you are looking for` というメッセージで型チェックが行われなかった。パッケージ名を明示する `npx -p typescript tsc ...` に変えることで本物のコンパイラが実行され、型エラー（TS2322）を正しく検出できた。

## 背景
- プロジェクト: 024_zenn（run-practice で Node ネイティブTypeScript検証を実行中）
- 機能 / 作業内容: `node app.ts`（type stripping）は型を見ないことの実証として、型エラーを含む `.ts` を `tsc --noEmit` で検出させたかった
- 技術スタック: Node.js v24.18.0 (Docker `node:24`), npm 11.16.0, npx
- 環境: TypeScriptがプロジェクトにもグローバルにも入っていないクリーンなコンテナ
- 発生タイミング: `npx -y tsc --noEmit type-error.ts` 実行時
- 関連コマンド: `docker run --rm -v "$PWD:/app" -w /app node:24 sh -c 'npx -y tsc --noEmit type-error.ts'`

## 問題
- 期待した挙動: TypeScriptコンパイラが起動し、`type-error.ts` の型エラーを報告する。
- 実際の挙動: 別パッケージが起動し、型チェックされずに終了コード1で終わる。
- エラーメッセージ:
  ```
  npm warn deprecated tsc@2.0.4: Package no longer supported. Contact Support at https://www.npmjs.com/support for more info.

                 This is not the tsc command you are looking for

  To get access to the TypeScript compiler, tsc, from the command line either:

  - Use npm install typescript to first add TypeScript to your project before using npx
  - Use yarn to avoid accidentally running code from un-installed packages
  ```
- 再現手順:
  1. TypeScriptが入っていないクリーン環境を用意する（例: `docker run --rm node:24`）
  2. `npx -y tsc --noEmit foo.ts` を実行する
  3. 本物のコンパイラではなく `tsc@2.0.4` が取得・実行され、上記メッセージで終わる

## 原因
`tsc` という名前のパッケージは、本物のTypeScript（パッケージ名 `typescript`、bin名が `tsc`）とは別に、npm上に単独で存在する（`tsc@2.0.4`, deprecated）。`npx tsc` はまずローカル/グローバルにインストール済みの `tsc` bin を探し、無ければ「`tsc` という名前のパッケージ」を取得しにいくため、TypeScript未インストール環境では別パッケージの方が取得されてしまう。`-y` を付けていると確認プロンプトも出ずにそのまま実行される。
（ローカルホスト側では過去に `typescript` を取得済みで npx キャッシュに残っていたため `npx -y tsc -v` が 5.9.2 を返し、この罠に気づきにくかった。）

## 解決策
実行するパッケージを明示する `-p typescript` を付ける。

```bash
# NG: 別パッケージ tsc@2.0.4 に解決されうる
npx -y tsc --noEmit foo.ts

# OK: 本物のTypeScriptを指定して tsc を実行
npx -y -p typescript tsc --noEmit foo.ts
```

実行結果（OK の場合）:
```
type-error.ts(2,7): error TS2322: Type 'string' is not assignable to type 'number'.
（終了コード 2）
```

恒久対策としては、プロジェクトに `npm install -D typescript` してから `npx tsc`（＝ローカルの本物のbinが使われる）を使うのが確実。CI やクリーン環境で `npx tsc` を直書きしない。

## 教訓 / 再発防止
- クリーン環境（CI・Docker・新規マシン）で `npx <bin名>` を叩くときは、bin名とパッケージ名が一致しない/同名スクワッターがある可能性を疑い、`npx -p <package> <bin>` でパッケージを明示する。
- `tsc` はまさにその代表例。`typescript` を devDependencies に入れてローカルbinを使うのが最も安全。
- `-y` は確認をスキップするので、意図しないパッケージ取得を黙って通してしまう点に注意。
