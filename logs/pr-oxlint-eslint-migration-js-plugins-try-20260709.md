## 概要

- 記事: `articles/oxlint-eslint-migration-js-plugins-try.md`
- タイトル: ESLintしか知らない新人がoxlintに移行してJSプラグイン(alpha)まで試してみた
- topics: oxlint, eslint, typescript, react, oxc
- 記事タイプ: 検証ログ・試してみた

## ⚠️ このPRの性質（マージ＝公開）

このPRを `main` にマージすると、Zennの GitHub連携により **記事が自動公開されます**
（`published: true`）。公開してよいか確認のうえマージしてください。取り下げる場合は
マージせずブランチを削除してください。

## レビュー結果

- 公開前レビュー: `logs/review-oxlint-eslint-migration-js-plugins-try-20260709-0426.md`
- 判定: **公開可**（blocker 0 / warning 0 / suggestion 3）
- 機械チェック（`scripts/check-article.sh`）: `SUMMARY fail=0 warn=1`
  - 唯一の WARN は title の**バイト数**カウントによる誤検知（可視タイトルは約47字で60字目安内・レビューで問題なしと判定済み）

## 出典（この記事の素材）

- テーマ: `research/search-topic-20260709-0400.md`
- 実践タスク: `practice/practice-oxlint-eslint-migration-20260709-0404.md`
- 実践ログ: `logs/run-oxlint-eslint-migration-20260709-0407/execution-log.md`

## レビュアー向けチェックリスト

- [ ] `published: true` が意図どおり（マージ＝公開でよい）
- [ ] slug `oxlint-eslint-migration-js-plugins-try` が汎用的すぎない（Zenn全体で一意。衝突時はリネーム）
- [ ] 画像が表示される（`/images/oxlint-eslint-migration-js-plugins-try/01-summary.png` が解決する）
- [ ] 秘密情報・個人情報が含まれていない
- [ ] `npx zenn preview` で表示を確認した

## プレビュー

```bash
git switch publish/oxlint-eslint-migration-js-plugins-try
npx zenn preview   # http://localhost:8000
```

## マージ後に起きること / 注意

- マージ → Zennがデプロイ → 記事公開。
- 「Slug『oxlint-eslint-migration-js-plugins-try』はサイト内で既に使用されています」が出たら slug が衝突している。
  具体的な名前にリネームして再push（`knowledge/2026-07-01-zenn-slug-already-used.md`）。
