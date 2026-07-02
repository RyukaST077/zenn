# PRタイトル・本文テンプレート＆コミット書式

`publish-pr` の Step 5〜Step 6 で使う。

## Commit（コミットメッセージ書式）

```
docs(article): publish <slug>

<記事タイトル>

Co-Authored-By: <実行エージェントに応じたトレーラ>
```

* 1行目は種別＋slug。既存リポジトリの傾向（`docs(knowledge): ...` 等）に合わせる。
* 2行目以降に記事タイトルを入れる。
* 末尾に Co-Authored-By トレーラを付ける（環境の規約に従う）。
* 記事＋画像以外の変更を含めない（`git diff --cached --name-only` で確認）。

## PR Title（タイトル）

記事タイトルをそのまま使うか、公開である旨を添える。例:

```
記事公開: <記事タイトル>
```

## PR Body（本文テンプレート）

次のテンプレートで組み立てる。プレースホルダは対象記事・レビュー結果で埋める。
`gh pr create --body-file` 用にファイル（例 `logs/pr-<slug>-<日時>.md`）へ書き出すとよい。

```md
## 概要

- 記事: `articles/<slug>.md`
- タイトル: <記事タイトル>
- topics: <topics>
- 記事タイプ: <試してみた / 検証ログ / 詰まった点 など>

## ⚠️ このPRの性質（マージ＝公開）

このPRを `main` にマージすると、Zennの GitHub連携により **記事が自動公開されます**
（`published: true`）。公開してよいか確認のうえマージしてください。取り下げる場合は
マージせずブランチを削除してください。

## レビュー結果

- 公開前レビュー: `logs/review-<slug>-<日時>.md`
- 判定: **公開可**（blocker 0 / warning 0）
- 機械チェック（`scripts/check-article.sh`）: `SUMMARY fail=0 warn=<n>`

## 出典（この記事の素材）

- テーマ: `research/search-topic-*.md`
- 実践タスク: `practice/practice-<slug>-*.md`
- 実践ログ: `logs/run-<slug>-*/execution-log.md`

## レビュアー向けチェックリスト

- [ ] `published: true` が意図どおり（マージ＝公開でよい）
- [ ] slug `<slug>` が汎用的すぎない（Zenn全体で一意。衝突時はリネーム）
- [ ] 画像が表示される（`/images/<slug>/...` が解決する）
- [ ] 秘密情報・個人情報が含まれていない
- [ ] `npx zenn preview` で表示を確認した

## プレビュー

```bash
git switch <branch>
npx zenn preview   # http://localhost:8000
```

## マージ後に起きること / 注意

- マージ → Zennがデプロイ → 記事公開。
- 「Slug『<slug>』はサイト内で既に使用されています」が出たら slug が衝突している。
  具体的な名前にリネームして再push（`knowledge/2026-07-01-zenn-slug-already-used.md`）。
```

## 書き方の注意

* 「マージ＝公開」を本文の目立つ位置に必ず書く（誤マージによる意図しない公開を防ぐ）。
* レビュー判定・機械チェックの結果は、対応する `logs/` のパスとともに引用する（追跡可能に）。
* 出典（research/practice/run）へのリンクで、記事がパイプラインのどこから来たか分かるようにする。
* チェックリストは公開安全（published/slug/画像/秘密情報/プレビュー）を必ず含める。
