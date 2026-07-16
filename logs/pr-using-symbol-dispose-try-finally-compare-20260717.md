## 概要

- 記事: `articles/using-symbol-dispose-try-finally-compare.md`
- タイトル: using / Symbol.dispose を try/finally と書き比べてみた
- topics: javascript, nodejs, typescript, ecmascript
- 記事タイプ: 試してみた / 検証ログ（詰まった点あり）

## ⚠️ このPRの性質（マージ＝公開）

このPRを `main` にマージすると、Zennの GitHub連携により **記事が自動公開されます**
（`published: true`）。公開してよいか確認のうえマージしてください。取り下げる場合は
マージせずブランチを削除してください。

## レビュー結果

- 公開前レビュー: `logs/review-using-symbol-dispose-try-finally-compare-20260717-0422.md`
- 判定: **公開可**（blocker 0 / warning 0 / suggestion 3）
- 機械チェック（`scripts/check-article.sh`）: `SUMMARY fail=0 warn=3`
  - WARN 3件はレビューで目視切り分け済み: title 63字（suggestion）／空リンク疑い（`[Symbol.dispose]()` の誤検出=false positive）／user-path 疑い（`/Users/you/...` に匿名化済み=false positive）。公開ブロッカーなし。

## 出典（この記事の素材）

- テーマ: `research/search-topic-20260717-0403.md`
- 実践タスク: `practice/practice-using-symbol-dispose-20260717-0407.md`
- 実践ログ: `logs/run-using-symbol-dispose-20260717-0409/execution-log.md`

## レビュアー向けチェックリスト

- [ ] `published: true` が意図どおり（マージ＝公開でよい）
- [ ] slug `using-symbol-dispose-try-finally-compare` が汎用的すぎない（Zenn全体で一意。衝突時はリネーム）
- [ ] 画像なし記事（CLI 検証・スクショ0枚）で問題ない
- [ ] 秘密情報・個人情報が含まれていない（ユーザ名/ホスト名は匿名化済み）
- [ ] `npx zenn preview` で表示を確認した

## プレビュー

```bash
git switch publish/using-symbol-dispose-try-finally-compare
npx zenn preview   # http://localhost:8000
```

## マージ後に起きること / 注意

- マージ → Zennがデプロイ → 記事公開。
- 「Slug『using-symbol-dispose-try-finally-compare』はサイト内で既に使用されています」が出たら slug が衝突している。
  具体的な名前にリネームして再push（`knowledge/2026-07-01-zenn-slug-already-used.md`）。
