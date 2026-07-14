## 概要

- 記事: `articles/node26-experimental-import-text-try.md`
- タイトル: Node 26.5 の text imports で .txt import に詰まった
- topics: nodejs / javascript / esm / importattributes
- 記事タイプ: 試してみた・検証ログ（詰まった点中心）

## ⚠️ このPRの性質（マージ＝公開）

このPRを `main` にマージすると、Zennの GitHub連携により **記事が自動公開されます**
（`published: true`）。公開してよいか確認のうえマージしてください。取り下げる場合は
マージせずブランチを削除してください。

## レビュー結果

- 公開前レビュー: `logs/review-node26-experimental-import-text-try-20260713-0422.md`
- 判定: **公開可**（blocker 0 / warning 0 / suggestion 3・任意）
- 機械チェック（`scripts/check-article.sh`）: `SUMMARY fail=0 warn=1`
  - 唯一の WARN（`user-path`）はスタックトレース中のパスが `/Users/.../workspace/...` と
    匿名化済みのため **false positive**（実ユーザー名の露出なし）。レビューで目視確認済み。

## 出典（この記事の素材）

- テーマ: `research/search-topic-20260713-0400.md`
- 実践タスク: `practice/practice-node-text-imports-20260713-0406.md`
- 実践ログ: `logs/run-node-text-imports-20260713-0408/execution-log.md`

## レビュアー向けチェックリスト

- [ ] `published: true` が意図どおり（マージ＝公開でよい）
- [ ] slug `node26-experimental-import-text-try` が汎用的すぎない（Zenn全体で一意。衝突時はリネーム）
- [ ] 画像なし記事（CLI 検証・ログ引用が証拠。`/images` 参照なしで整合）
- [ ] 秘密情報・個人情報が含まれていない（パスは匿名化済み）
- [ ] `npx zenn preview` で表示を確認した

## プレビュー

```bash
git switch publish/node26-experimental-import-text-try
npx zenn preview   # http://localhost:8000
```

## マージ後に起きること / 注意

- マージ → Zennがデプロイ → 記事公開。
- 「Slug『node26-experimental-import-text-try』はサイト内で既に使用されています」が出たら
  slug が衝突している。具体的な名前にリネームして再push
  （`knowledge/2026-07-01-zenn-slug-already-used.md`）。
