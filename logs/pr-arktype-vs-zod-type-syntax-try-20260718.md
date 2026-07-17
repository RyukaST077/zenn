## 概要

- 記事: `articles/arktype-vs-zod-type-syntax-try.md`
- タイトル: ArkTypeの型主導構文でZodと同じschemaを書き比べてみた
- topics: arktype / zod / typescript / validation
- 記事タイプ: 検証ログ・書き比べ（Zod v4 と ArkType 2.2 で同じ schema を実装して比較）

## ⚠️ このPRの性質（マージ＝公開）

このPRを `main` にマージすると、Zennの GitHub連携により **記事が自動公開されます**
（`published: true`）。公開してよいか確認のうえマージしてください。取り下げる場合は
マージせずブランチを削除してください。

## レビュー結果

- 公開前レビュー: `logs/review-arktype-vs-zod-type-syntax-try-20260718-0430.md`
- 判定: **公開可**（blocker 0 / warning 0 / suggestion 3・任意）
- 機械チェック（`scripts/check-article.sh`）: `SUMMARY fail=0 warn=2`
  - WARN 2件はレビューで **false positive** と確認済み
    - title 70文字 → 実測34文字（マルチバイトをバイト長で数えた過大表示）
    - example.com/空リンク → すべてコード内のサンプルメールアドレス。参考リンクは実在URL

## 出典（この記事の素材）

- テーマ: `research/search-topic-20260718-0402.md`
- 実践タスク: `practice/practice-arktype-20260718-0405.md`
- 実践ログ: `logs/run-arktype-20260718-0407/execution-log.md`（＋一次証跡 `commands.log`）

## レビュアー向けチェックリスト

- [ ] `published: true` が意図どおり（マージ＝公開でよい）
- [ ] slug `arktype-vs-zod-type-syntax-try` が汎用的すぎない（Zenn全体で一意。衝突時はリネーム）
- [ ] 画像なし記事（CLI/API完結、`/images` 参照なし）で問題ない
- [ ] 秘密情報・個人情報が含まれていない（個人パスは `.../` に伏せ済み）
- [ ] `npx zenn preview` で表示を確認した

## プレビュー

```bash
git switch publish/arktype-vs-zod-type-syntax-try
npx zenn preview   # http://localhost:8000
```

## マージ後に起きること / 注意

- マージ → Zennがデプロイ → 記事公開。
- 「Slug『arktype-vs-zod-type-syntax-try』はサイト内で既に使用されています」が出たら slug が衝突している。
  具体的な名前にリネームして再push（`knowledge/2026-07-01-zenn-slug-already-used.md`）。
