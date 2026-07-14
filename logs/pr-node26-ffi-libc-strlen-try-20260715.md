## 概要

- 記事: `articles/node26-ffi-libc-strlen-try.md`
- タイトル: Node 26 の node:ffi で libc の strlen を呼んでみた
- topics: nodejs / ffi / javascript / libc
- 記事タイプ: 試してみた / 検証ログ・詰まった点

## ⚠️ このPRの性質（マージ＝公開）

このPRを `main` にマージすると、Zennの GitHub連携により **記事が自動公開されます**
（`published: true`）。公開してよいか確認のうえマージしてください。取り下げる場合は
マージせずブランチを削除してください。

## レビュー結果

- 公開前レビュー: `logs/review-node26-ffi-libc-strlen-try-20260715-0427.md`
- 判定: **公開可**（blocker 0 / warning 0 / suggestion 2）
- 機械チェック（`scripts/check-article.sh`）: `SUMMARY fail=0 warn=0`
- 補足: 04:19 / 04:23 の2回のレビューと 04:22 / 04:25 の2回の修正を経た最終ゲート通過版。

## 出典（この記事の素材）

- テーマ: `research/search-topic-20260715-0402.md`
- 実践タスク: `practice/practice-node-ffi-20260715-0405.md`
- 実践ログ: `logs/run-node-ffi-20260715-0408/execution-log.md`

## レビュアー向けチェックリスト

- [ ] `published: true` が意図どおり（マージ＝公開でよい）
- [ ] slug `node26-ffi-libc-strlen-try` が汎用的すぎない（Zenn全体で一意。衝突時はリネーム）
- [ ] 画像なし記事（CLI 検証のため `/images` 参照なしで妥当）
- [ ] 秘密情報・個人情報が含まれていない（Permission 拒否のスタックトレースは `file://.../workspace/...` と伏字済み）
- [ ] `npx zenn preview` で表示を確認した

## プレビュー

```bash
git switch publish/node26-ffi-libc-strlen-try
npx zenn preview   # http://localhost:8000
```

## マージ後に起きること / 注意

- マージ → Zennがデプロイ → 記事公開。
- 「Slug『node26-ffi-libc-strlen-try』はサイト内で既に使用されています」が出たら slug が衝突している。
  具体的な名前にリネームして再push（`knowledge/2026-07-01-zenn-slug-already-used.md`）。

## 採用した前提（引数不足時のデフォルト）

- 対象記事: `articles/node26-ffi-libc-strlen-try.md`（引数で明示指定）
- base: `main` / ブランチ名: `publish/node26-ffi-libc-strlen-try`
- レビュー: 最新 `logs/review-node26-ffi-libc-strlen-try-20260715-0427.md` の判定「公開可」を採用
