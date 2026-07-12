## 概要

- 記事: `articles/biome-type-aware-lint-tsc-free.md`
- タイトル: ESLint/oxlintしか知らない新人がBiomeの型認識lintを試してみた
- topics: biome, typescript, lint, oxlint, eslint
- 記事タイプ: 検証ログ・試してみた（型情報がないと検出できないバグ3種を Biome / oxlint / ESLint で比較）

## ⚠️ このPRの性質（マージ＝公開）

このPRを `main` にマージすると、Zennの GitHub連携により **記事が自動公開されます**
（`published: true`）。公開してよいか確認のうえマージしてください。取り下げる場合は
マージせずブランチを削除してください。

## レビュー結果

- 公開前レビュー: `logs/review-biome-type-aware-lint-tsc-free-20260711-0430.md`
- 判定: **公開可**（blocker 0 / warning 0）
- 機械チェック（`.claude/skills/review-article/scripts/check-article.sh`）: `SUMMARY fail=0 warn=1`
  - 唯一の WARN（title 79字）は説明的で誇大でないため suggestion 相当。公開ブロッカーではない。

## 出典（この記事の素材）

- テーマ: `research/search-topic-20260711-0402.md`
- 実践タスク: `practice/practice-biome-type-aware-lint-20260711-0406.md`
- 実践ログ: `logs/run-biome-type-aware-lint-20260711-0408/execution-log.md`
- 関連ナレッジ: `knowledge/2026-07-11-biome-types-domain-all-not-enabling-nursery-rules.md`

## レビュアー向けチェックリスト

- [ ] `published: true` が意図どおり（マージ＝公開でよい）
- [ ] slug `biome-type-aware-lint-tsc-free` が汎用的すぎない（Zenn全体で一意。衝突時はリネーム）
- [ ] 画像なし記事のため画像参照チェックは対象外（`/images` 参照なし）
- [ ] 秘密情報・個人情報が含まれていない
- [ ] `npx zenn preview` で表示を確認した

## プレビュー

```bash
git switch publish/biome-type-aware-lint-tsc-free
npx zenn preview   # http://localhost:8000
```

## マージ後に起きること / 注意

- マージ → Zennがデプロイ → 記事公開。
- 「Slug『biome-type-aware-lint-tsc-free』はサイト内で既に使用されています」が出たら slug が衝突している。
  具体的な名前にリネームして再push（`knowledge/2026-07-01-zenn-slug-already-used.md`）。

## 採用した前提（非対話実行）

- 対象記事: 引数指定 `articles/biome-type-aware-lint-tsc-free.md`
- base: `main` / ブランチ名: `publish/biome-type-aware-lint-tsc-free`
- レビュー: 最新 `logs/review-biome-type-aware-lint-tsc-free-20260711-0430.md`（判定=公開可）

🤖 Generated with [Claude Code](https://claude.com/claude-code)
