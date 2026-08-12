## 概要

- 記事: `articles/node26-context-log-test-log-attribution.md`
- タイトル: Node 26.6のt.log()を試したら、ログに帰属が付くのはイベント側だけだった
- topics: nodejs / testing / test / javascript
- 記事タイプ: 検証ログ（試してみた）

Node.js v26.6 で入った `context.log()` / `test:log` イベントを、依存ゼロの小さなプロジェクトで検証したログ記事です。「並行実行でもログが読めるようになる」という当初の想定が正しくなく、帰属情報はイベントには載るが組み込み reporter が捨てている、という発見までを記録しています。

## ⚠️ このPRの性質（マージ＝公開）

このPRを `main` にマージすると、Zennの GitHub連携により **記事が自動公開されます**
（`published: true`）。公開してよいか確認のうえマージしてください。取り下げる場合は
マージせずブランチを削除してください。

## レビュー結果

- 公開前レビュー: `logs/review-node26-context-log-test-log-attribution-20260812-1642.md`
- 判定: **公開可**（blocker 0 / warning 0）
- 機械チェック（`.claude/skills/review-article/scripts/check-article.sh`）: `SUMMARY fail=0 warn=0`
- 修正履歴: `logs/revise-node26-context-log-test-log-attribution-20260812-1621.md` / `-20260812-1638.md`

## 出典（この記事の素材）

- テーマ: `research/search-topic-20260812-1553.md`
- 実践タスク: `practice/practice-node-test-context-log-20260812-1600.md`
- 実践ログ: `logs/run-node-test-context-log-20260812-1603/execution-log.md`

## レビュアー向けチェックリスト

- [ ] `published: true` が意図どおり（マージ＝公開でよい）
- [ ] slug `node26-context-log-test-log-attribution` が汎用的すぎない（Zenn全体で一意。衝突時はリネーム）
- [ ] 画像なし記事で問題ない（ブラウザ表示を伴わない検証のためスクショ 0 枚）
- [ ] 秘密情報・個人情報が含まれていない（絶対パスはマスク済み）
- [ ] `npx zenn preview` で表示を確認した

## プレビュー

```bash
git switch publish/node26-context-log-test-log-attribution
npx zenn preview   # http://localhost:8000
```

## 採用した前提（publish-pr）

- 対象記事: 引数で指定（`articles/node26-context-log-test-log-attribution.md`）
- base: `main` / ブランチ: `publish/node26-context-log-test-log-attribution`
- コミット対象: 記事1ファイルのみ（`images/<slug>/` は存在しないため無し）

## マージ後に起きること / 注意

- マージ → Zennがデプロイ → 記事公開。
- 「Slug『node26-context-log-test-log-attribution』はサイト内で既に使用されています」が出たら slug が衝突している。
  具体的な名前にリネームして再push（`knowledge/2026-07-01-zenn-slug-already-used.md`）。
