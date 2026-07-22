## 概要

- 記事: `articles/node26-randomuuidv7-vs-v4-sqlite-order.md`
- タイトル: Node 26のrandomUUIDv7()とv4を書き比べ、SQLiteの並び順を見た
- topics: nodejs / uuid / sqlite / crypto
- 記事タイプ: 検証ログ（試してみた・詰まった点）

## ⚠️ このPRの性質（マージ＝公開）

このPRを `main` にマージすると、Zennの GitHub連携により **記事が自動公開されます**（`published: true`）。公開してよいか確認のうえマージしてください。取り下げる場合はマージせずブランチを削除してください。

## レビュー結果

- 公開前レビュー: `logs/review-node26-randomuuidv7-vs-v4-sqlite-order-20260723-0426.md`
- 判定: **公開可**（blocker 0 / warning 0 / suggestion 3・すべて任意）
- 機械チェック（`scripts/check-article.sh`）: `SUMMARY fail=0 warn=1`
  - `warn=1` は `title が長い: 74文字` の **誤検知**（`wc -m` がバイト数計測のため。実測 44 文字で目安内）。公開ブロックではない。

## 出典（この記事の素材）

- テーマ: `research/search-topic-20260723-0403.md`
- 実践タスク: `practice/practice-uuidv7-20260723-0406.md`
- 実践ログ: `logs/run-uuidv7-20260723-0409/execution-log.md`

## レビュアー向けチェックリスト

- [ ] `published: true` が意図どおり（マージ＝公開でよい）
- [ ] slug `node26-randomuuidv7-vs-v4-sqlite-order` が汎用的すぎない（Zenn全体で一意。衝突時はリネーム）
- [ ] 画像なし記事（CLI検証のためスクショ 0 枚。出典ログの前提どおり）
- [ ] 秘密情報・個人情報が含まれていない（DBパスは `.../workspace/...` と匿名化済み）
- [ ] `npx zenn preview` で表示を確認した

## プレビュー

```bash
git switch publish/node26-randomuuidv7-vs-v4-sqlite-order
npx zenn preview   # http://localhost:8000
```

## マージ後に起きること / 注意

- マージ → Zennがデプロイ → 記事公開。
- 「Slug『node26-randomuuidv7-vs-v4-sqlite-order』はサイト内で既に使用されています」が出たら slug が衝突している。具体的な名前にリネームして再push（`knowledge/2026-07-01-zenn-slug-already-used.md`）。

🤖 Generated with [Claude Code](https://claude.com/claude-code)
