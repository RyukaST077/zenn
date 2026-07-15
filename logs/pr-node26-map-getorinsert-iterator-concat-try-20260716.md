## 概要

- 記事: `articles/node26-map-getorinsert-iterator-concat-try.md`
- タイトル: Node 26 の Map.getOrInsert と Iterator.concat で get-or-set 定型を書き比べてみた
- topics: nodejs / javascript / v8 / map / iterator
- 記事タイプ: 検証ログ・試してみた（予想外れ→検証を含む）

## ⚠️ このPRの性質（マージ＝公開）

このPRを `main` にマージすると、Zennの GitHub連携により **記事が自動公開されます**
（`published: true`）。公開してよいか確認のうえマージしてください。取り下げる場合は
マージせずブランチを削除してください。

## レビュー結果

- 公開前レビュー: `logs/review-node26-map-getorinsert-iterator-concat-try-20260716-0417.md`
- 判定: **公開可**（blocker 0 / warning 0 / suggestion 4）
- 機械チェック（`.claude/skills/review-article/scripts/check-article.sh`）: `SUMMARY fail=0 warn=1`
  - 唯一の WARN は title 長（93字）。誇大表現ではなく説明的タイトルのため suggestion 扱い（公開可否に影響なし）。

## 出典（この記事の素材）

- テーマ: `research/search-topic-20260716-0400.md`
- 実践タスク: `practice/practice-node26-map-getorinsert-20260716-0404.md`
- 実践ログ: `logs/run-node26-map-getorinsert-20260716-0407/execution-log.md`

## レビュアー向けチェックリスト

- [ ] `published: true` が意図どおり（マージ＝公開でよい）
- [ ] slug `node26-map-getorinsert-iterator-concat-try` が汎用的すぎない（Zenn全体で一意。衝突時はリネーム）
- [ ] 画像が表示される（`/images/node26-map-getorinsert-iterator-concat-try/01-bench-report.png` が解決する）
- [ ] 秘密情報・個人情報が含まれていない
- [ ] `npx zenn preview` で表示を確認した

## プレビュー

```bash
git switch publish/node26-map-getorinsert-iterator-concat-try
npx zenn preview   # http://localhost:8000
```

## マージ後に起きること / 注意

- マージ → Zennがデプロイ → 記事公開。
- 「Slug『node26-map-getorinsert-iterator-concat-try』はサイト内で既に使用されています」が出たら
  slug が衝突している。具体的な名前にリネームして再push
  （`knowledge/2026-07-01-zenn-slug-already-used.md`）。
