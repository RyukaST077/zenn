# Zenn フォーマット・公開ガイド

`draft-article` の Step 3〜Step 6 で使う。Zenn の記事仕様（Front Matter / slug / 画像 /
Markdown拡張 / 公開フロー）をまとめる。

## Front Matter

記事ファイルの先頭に置く。既存記事 `articles/zenn-github-integration-auto-publish.md` と同形式。

```md
---
title: "記事タイトル（30〜60字目安。長すぎ注意）"
emoji: "🚀"               # サムネ用の絵文字1つ
type: "tech"              # tech: 技術記事 / idea: アイデア
topics: ["hono", "typescript", "cloudflare"]  # タグ。英小文字、最大5個
published: false          # ★ ドラフトは false。公開は人間が true にする
---
```

* `title`: 経験談トーンで具体的に。「完全理解」「徹底解説」など経験値に対し強すぎる語は避ける。
* `emoji`: 絵文字1つ。対象技術・内容に合うもの。
* `type`: 検証・実装ログは基本 `tech`。考察・ポエムは `idea`。
* `topics`: Zenn のタグ。英小文字＋数字が無難（例: `hono`, `typescript`, `cloudflareworkers`）。
  最大5個。日本語タグも可だが技術名は英語表記が一般的。
* `published`: **ドラフトは必ず `false`**。理由は後述の公開フロー。

## slug 規約（重要）

slug ＝ 記事ファイル名から拡張子を除いた部分（`articles/<slug>.md`）。

* 使える文字: **半角英小文字 `a-z`・数字 `0-9`・ハイフン `-`・アンダースコア `_`**。
* 長さ: **12〜50文字**。
* **Zennサイト全体でグローバルに一意**である必要がある（リポジトリ内だけでなく、他ユーザーの
  記事とも衝突不可）。汎用的すぎる slug は衝突しやすい。
  * NG例: `getting-started`, `hello-world`, `introduction`, `my-first-app`
  * OK例: `hono-cloudflare-workers-first-api`, `sqlite-vec-local-rag-try`,
    `bun-test-runner-migration-log`（技術名＋切り口で具体化）
* 作り方: ログのスラッグ（`run-<slug>-*`）を引き継ぎ、汎用的なら技術名＋やったこと/切り口を足す。
* **ローカル重複チェック**: `ls articles/` で同名が無いか確認する。あれば別名にする。
* 衝突は公開（push）時に「Slug「...」はサイト内で既に使用されています」で判明する。
  出たら slug を具体的な名前にリネームする。詳細と対処:
  `knowledge/2026-07-01-zenn-slug-already-used.md`。

## 画像の扱い

* 画像はリポジトリ直下の **`/images`** 配下に置く（Zenn がここを配信する）。
* 記事ごとに `images/<slug>/` を作り、`run-practice` の `logs/run-*/screenshots/` から
  本文で使うスクショをコピーする。
* 本文からは**先頭スラッシュの絶対パス**で参照する:

  ```md
  ![Todoを追加した画面](/images/hono-cloudflare-workers-first-api/02-todo-added.png)
  ```

* 存在しない画像は参照しない。ファイル名は内容が分かる連番（`01-top.png` 等）にする。

## よく使う Markdown 拡張（Zenn独自）

必要に応じて使う。多用しない。

* メッセージ / 警告ボックス:

  ```md
  :::message
  補足や注意点。
  :::

  :::message alert
  つまずきやすい点・警告。
  :::
  ```

* 折りたたみ（長いログやエラー全文に便利）:

  ```md
  :::details エラー全文
  （長いスタックトレースをここに）
  :::
  ```

* ファイル名付きコードブロック:

  ````md
  ```ts:src/index.ts
  export default { fetch: () => new Response("hello") }
  ```
  ````

* リンクカード: URLだけを1行で書くと自動でカード化される。
* 脚注: `本文[^1]` … `[^1]: 注釈`。

## 公開フロー（事故公開を防ぐ）

このリポジトリは **GitHub連携で `main` に push すると自動でZennにデプロイ／公開**される。

1. `draft-article` は **`published: false`** で保存する（この状態では push しても公開されない）。
2. 人間が `npx zenn preview` で内容を確認する。
3. 公開準備ができたら Front Matter を **`published: true`** に変えて `git push`。
4. 「サイト内で既に使用されています」エラーが出たら slug が衝突している。
   具体的な slug にリネームして再 push（`knowledge/2026-07-01-zenn-slug-already-used.md`）。

> したがって本Skillは絶対に `published: true` にしない。true 指定の引数が来ても false のまま
> 保存し、標準出力でこの公開手順を案内する。

## プレビュー

```bash
npx zenn preview        # http://localhost:8000 で記事一覧・プレビュー
```
