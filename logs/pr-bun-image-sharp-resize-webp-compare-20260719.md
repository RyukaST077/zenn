## 概要

- 記事: `articles/bun-image-sharp-resize-webp-compare.md`
- タイトル: Bun.Image で sharp なしに画像をリサイズ/WebP変換して、sharpと書き比べてみた
- topics: bun, sharp, image, webp, typescript
- 記事タイプ: 書き比べ・検証ログ（Bun.Image と sharp の導入コスト・処理時間・出力サイズ比較）

## ⚠️ このPRの性質（マージ＝公開）

このPRを `main` にマージすると、Zennの GitHub連携により **記事が自動公開されます**
（`published: true`）。公開してよいか確認のうえマージしてください。取り下げる場合は
マージせずブランチを削除してください。

## レビュー結果

- 公開前レビュー: `logs/review-bun-image-sharp-resize-webp-compare-20260719-0417.md`
- 判定: **公開可**（blocker 0 / warning 0 / suggestion 4）
- 機械チェック（`scripts/check-article.sh`）: `SUMMARY fail=0 warn=1`
  - 唯一の WARN（`title が長い: 99文字`）はバイト数計測由来の false positive。実文字数は約51字で60字目安内（レビュー報告参照）。

## 出典（この記事の素材）

- テーマ: `research/search-topic-20260719-0402.md`
- 実践タスク: `practice/practice-bun-image-20260719-0405.md`
- 実践ログ: `logs/run-bun-image-20260719-0407/execution-log.md`（＋一次ログ `commands.log` / `workspace/*.ts`）

## レビュアー向けチェックリスト

- [ ] `published: true` が意図どおり（マージ＝公開でよい）
- [ ] slug `bun-image-sharp-resize-webp-compare` が汎用的すぎない（Zenn全体で一意。衝突時はリネーム）
- [ ] 画像なし記事（CLI 完結タスク。`/images` 参照なしは想定どおり）
- [ ] 秘密情報・個人情報が含まれていない
- [ ] `npx zenn preview` で表示を確認した

## プレビュー

```bash
git switch publish/bun-image-sharp-resize-webp-compare
npx zenn preview   # http://localhost:8000
```

## マージ後に起きること / 注意

- マージ → Zennがデプロイ → 記事公開。
- 「Slug『bun-image-sharp-resize-webp-compare』はサイト内で既に使用されています」が出たら slug が衝突している。
  具体的な名前にリネームして再push（`knowledge/2026-07-01-zenn-slug-already-used.md`）。

## 採用した前提（非対話実行）

- 対象記事: `articles/bun-image-sharp-resize-webp-compare.md`（引数指定）
- base: `main` / ブランチ名: `publish/bun-image-sharp-resize-webp-compare`
- レビュー: 最新 `logs/review-bun-image-sharp-resize-webp-compare-20260719-0417.md` の判定「公開可」を採用
