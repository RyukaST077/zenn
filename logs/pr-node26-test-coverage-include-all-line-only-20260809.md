## 概要

- 記事: `articles/node26-test-coverage-include-all-line-only.md`
- タイトル: Node 26.7の--test-coverage-include-allを試したら、正直になったのはlineだけだった
- topics: nodejs / testing / coverage / c8
- 記事タイプ: 検証ログ（試してみた）

採用した前提（引数で指定・省略時のデフォルト）:

- 対象記事: 引数で明示指定
- base: `main` / ブランチ: `publish/node26-test-coverage-include-all-line-only`
- 公開の扱い: feature ブランチ内で `published: false` → `true`

## ⚠️ このPRの性質（マージ＝公開）

このPRを `main` にマージすると、Zennの GitHub連携により **記事が自動公開されます**
（`published: true`）。公開してよいか確認のうえマージしてください。取り下げる場合は
マージせずブランチを削除してください。

## レビュー結果

- 公開前レビュー: `logs/review-node26-test-coverage-include-all-line-only-20260809-0422.md`
- 判定: **公開可**（blocker 0 / warning 0 / suggestion 4）
- 機械チェック（`scripts/check-article.sh`）: `SUMMARY fail=0 warn=1`
  - warn は `title が長い: 100文字`。実文字数は 60 文字で、`wc -m` がロケール非UTF-8のため
    byte 数を返している false positive（レビュー報告で確認済み）。

## 出典（この記事の素材）

- テーマ: `research/search-topic-20260809-0403.md`
- 実践タスク: `practice/practice-node-test-coverage-include-all-20260809-0407.md`
- 実践ログ: `logs/run-node-test-coverage-include-all-20260809-0410/execution-log.md`

## レビュアー向けチェックリスト

- [ ] `published: true` が意図どおり（マージ＝公開でよい）
- [ ] slug `node26-test-coverage-include-all-line-only` が汎用的すぎない（Zenn全体で一意。衝突時はリネーム）
- [ ] 画像なし（本文に `/images` 参照なし・ブラウザ表示を伴わない記事）
- [ ] 秘密情報・個人情報が含まれていない
- [ ] `npx zenn preview` で表示を確認した

## プレビュー

```bash
git switch publish/node26-test-coverage-include-all-line-only
npx zenn preview   # http://localhost:8000
```

## マージ後に起きること / 注意

- マージ → Zennがデプロイ → 記事公開。
- 「Slug『node26-test-coverage-include-all-line-only』はサイト内で既に使用されています」が出たら
  slug が衝突している。具体的な名前にリネームして再push
  （`knowledge/2026-07-01-zenn-slug-already-used.md`）。
