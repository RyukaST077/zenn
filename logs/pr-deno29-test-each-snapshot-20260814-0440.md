## 概要

- 記事: `articles/deno29-test-each-snapshot.md`
- タイトル: Deno 2.9のDeno.test.each()とt.assertSnapshot()をnode:testと書き比べた
- topics: deno / nodejs / typescript / test
- 記事タイプ: 試してみた・検証ログ

## ⚠️ このPRの性質（マージ＝公開）

このPRを `main` にマージすると、Zennの GitHub連携により **記事が自動公開されます**（`published: true`）。公開してよいか確認のうえマージしてください。取り下げる場合はマージせずブランチを削除してください。

## レビュー結果

- 公開前レビュー: `logs/review-deno29-test-each-snapshot-20260814-0435.md`（2回目・再レビュー）
- 判定: **公開可**（blocker 0 / warning 0 / suggestion 5）
- 前段: `logs/review-deno29-test-each-snapshot-20260814-0430.md`（要修正 / warning 3）→ `logs/revise-deno29-test-each-snapshot-20260814-0432.md` で解消済み
- 機械チェック（`check-article.sh`、published 切替前）: `SUMMARY fail=0 warn=2`
  - `title が長い: 78文字` / `秘密情報の疑い [user-path] at line 500` の2件。後者は Node の警告出力の引用で `/Users/.../024_zenn/package.json` とマスク済み（レビューで誤検知と確認）

## 出典（この記事の素材）

- テーマ: `research/search-topic-20260814-0402.md`
- 実践タスク: `practice/practice-deno29-test-each-snapshot-20260814-0406.md`
- 実践ログ: `logs/run-deno29-test-each-snapshot-20260814-0410/execution-log.md`

## 採用した前提

- 対象記事: 引数指定（`articles/deno29-test-each-snapshot.md`）
- base: `main` / ブランチ: `publish/deno29-test-each-snapshot`
- 変更は Front Matter の `published: false` → `true` のみ（本文・slug・画像参照は未変更）

## レビュアー向けチェックリスト

- [ ] `published: true` が意図どおり（マージ＝公開でよい）
- [ ] slug `deno29-test-each-snapshot` が汎用的すぎない（Zenn全体で一意。衝突時はリネーム）
- [ ] 画像が表示される（`/images/deno29-test-each-snapshot/01-render-header.png`）
- [ ] 秘密情報・個人情報が含まれていない（L500 の user-path はマスク済み）
- [ ] 冒頭 L9 の `<!-- 前提: 出典ログ ... -->` コメント（リポジトリ内部パスを含み、`published: false` の記述が残る）を残すか削除するか。レビューでは suggestion 扱い、公開安全上の問題なし
- [ ] `npx zenn preview` で表示を確認した

## プレビュー

```bash
git switch publish/deno29-test-each-snapshot
npx zenn preview   # http://localhost:8000
```

## マージ後に起きること / 注意

- マージ → Zennがデプロイ → 記事公開。
- 「Slug『deno29-test-each-snapshot』はサイト内で既に使用されています」が出たら slug が衝突している。具体的な名前にリネームして再push（`knowledge/2026-07-01-zenn-slug-already-used.md`）。
