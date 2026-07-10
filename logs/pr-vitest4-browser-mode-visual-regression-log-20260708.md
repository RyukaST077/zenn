## 概要

- 記事: `articles/vitest4-browser-mode-visual-regression-log.md`
- タイトル: Vitest 4 の Browser Mode で toMatchScreenshot を初めて書いてみた
- topics: vitest / playwright / react / typescript / testing
- 記事タイプ: 検証ログ・試してみた

## ⚠️ このPRの性質（マージ＝公開）

このPRを `main` にマージすると、Zennの GitHub連携により **記事が自動公開されます**
（`published: true`）。公開してよいか確認のうえマージしてください。取り下げる場合は
マージせずブランチを削除してください。

## レビュー結果

- 公開前レビュー: `logs/review-vitest4-browser-mode-visual-regression-log-20260708-1801.md`
- 判定: **公開可**（blocker 0 / warning 0 / suggestion 3）
- 機械チェック（`scripts/check-article.sh`）: `SUMMARY fail=0 warn=0`

## 出典（この記事の素材）

- テーマ: `research/search-topic-20260708-1741.md`
- 実践タスク: `practice/practice-vitest-browser-mode-20260708-1746.md`
- 実践ログ: `logs/run-vitest-browser-mode-20260708-1748/execution-log.md`

## レビュアー向けチェックリスト

- [ ] `published: true` が意図どおり（マージ＝公開でよい）
- [ ] slug `vitest4-browser-mode-visual-regression-log` が汎用的すぎない（Zenn全体で一意。衝突時はリネーム）
- [ ] 画像が表示される（`/images/vitest4-browser-mode-visual-regression-log/...` が解決する）
- [ ] 秘密情報・個人情報が含まれていない
- [ ] `npx zenn preview` で表示を確認した

## プレビュー

```bash
git switch publish/vitest4-browser-mode-visual-regression-log
npx zenn preview   # http://localhost:8000
```

## マージ後に起きること / 注意

- マージ → Zennがデプロイ → 記事公開。
- 「Slug『vitest4-browser-mode-visual-regression-log』はサイト内で既に使用されています」が出たら
  slug が衝突している。具体的な名前にリネームして再push
  （`knowledge/2026-07-01-zenn-slug-already-used.md`）。
