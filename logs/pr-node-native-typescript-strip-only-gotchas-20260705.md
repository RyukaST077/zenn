## 概要

- 記事: `articles/node-native-typescript-strip-only-gotchas.md`
- タイトル: `node app.ts` を試したら、まずバージョンで詰まった話（ネイティブTypeScript）
- topics: typescript, nodejs, tsx, tsnode
- 記事タイプ: 検証ログ・詰まった点まとめ

## ⚠️ このPRの性質（マージ＝公開）

このPRを `main` にマージすると、Zennの GitHub連携により **記事が自動公開されます**
（`published: true`）。公開してよいか確認のうえマージしてください。取り下げる場合は
マージせずブランチを削除してください。

## レビュー結果

- 公開前レビュー: `logs/review-node-native-typescript-strip-only-gotchas-20260705-0228.md`
- 判定: **公開可**（blocker 0 / warning 0 / suggestion 4）
- 機械チェック（`scripts/check-article.sh`）: `SUMMARY fail=0 warn=0`

## 出典（この記事の素材）

- テーマ: `research/search-topic-20260705-0212.md`
- 実践タスク: `practice/practice-node-native-typescript-20260705-0214.md`
- 実践ログ: `logs/run-node-native-typescript-20260705-0217/execution-log.md`

## レビュアー向けチェックリスト

- [ ] `published: true` が意図どおり（マージ＝公開でよい）
- [ ] slug `node-native-typescript-strip-only-gotchas` が汎用的すぎない（Zenn全体で一意。衝突時はリネーム）
- [ ] 画像なし記事（CLI検証のためスクショ0枚。`/images` 参照なしはレビューで整合確認済み）
- [ ] 秘密情報・個人情報が含まれていない（`/Users/...` は `/.../` に匿名化済み）
- [ ] `npx zenn preview` で表示を確認した

## プレビュー

```bash
git switch publish/node-native-typescript-strip-only-gotchas
npx zenn preview   # http://localhost:8000
```

## マージ後に起きること / 注意

- マージ → Zennがデプロイ → 記事公開。
- 「Slug『node-native-typescript-strip-only-gotchas』はサイト内で既に使用されています」が出たら
  slug が衝突している。具体的な名前にリネームして再push
  （`knowledge/2026-07-01-zenn-slug-already-used.md`）。

## 未対応の suggestion（公開はブロックしない / レビュー由来）

- title 内バッククォートは Zenn では装飾されず素の `` ` `` 表示
- topics `"tsnode"` はトピックとして弱い（差し替え/削除検討）
- 比較表 decorator 行の tsx 挙動は「未計測」の明示が親切
- 冒頭の draft 由来 `<!-- 前提 -->` コメント（非表示・害なし）

---

## 採用した前提（引数不足時のデフォルト）

- 対象記事: 引数指定 `articles/node-native-typescript-strip-only-gotchas.md`
- base: `main` / ブランチ名: `publish/node-native-typescript-strip-only-gotchas`
- レビュー: `logs/review-...-20260705-0228.md` の判定「公開可」を採用

🤖 Generated with [Claude Code](https://claude.com/claude-code)
