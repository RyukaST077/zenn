## 概要

- 記事: `articles/node26-temporal-vs-date-try.md`
- タイトル: Node 26で既定になったTemporalを、Dateと同じ処理で書き比べてみた
- topics: nodejs, javascript, temporal, date
- 記事タイプ: 試してみた（Date と Temporal の書き比べ検証ログ / 詰まった点あり）

## ⚠️ このPRの性質（マージ＝公開）

このPRを `main` にマージすると、Zennの GitHub連携により **記事が自動公開されます**
（`published: true`）。公開してよいか確認のうえマージしてください。取り下げる場合は
マージせずブランチを削除してください。

## レビュー結果

- 公開前レビュー: `logs/review-node26-temporal-vs-date-try-20260714-1535.md`
- 判定: **公開可**（blocker 0 / warning 0 / suggestion 3・任意）
- 機械チェック（`scripts/check-article.sh`）: `SUMMARY fail=0 warn=0`

## 出典（この記事の素材）

- テーマ: `research/search-topic-20260714-1511.md`
- 実践タスク: `practice/practice-node26-temporal-vs-date-20260714-1514.md`
- 実践ログ: `logs/run-node26-temporal-vs-date-20260714-1517/execution-log.md`
- 関連ナレッジ: `knowledge/2026-07-14-temporal-duration-total-week-needs-relativeto.md`

## レビュアー向けチェックリスト

- [ ] `published: true` が意図どおり（マージ＝公開でよい）
- [ ] slug `node26-temporal-vs-date-try` が汎用的すぎない（Zenn全体で一意。衝突時はリネーム）
- [ ] 画像なし記事（CLI検証のため `/images` 参照なし）で問題ない
- [ ] 秘密情報・個人情報が含まれていない
- [ ] `npx zenn preview` で表示を確認した

## プレビュー

```bash
git switch publish/node26-temporal-vs-date-try
npx zenn preview   # http://localhost:8000
```

## マージ後に起きること / 注意

- マージ → Zennがデプロイ → 記事公開。
- 「Slug『node26-temporal-vs-date-try』はサイト内で既に使用されています」が出たら slug が衝突している。
  具体的な名前にリネームして再push（`knowledge/2026-07-01-zenn-slug-already-used.md`）。
