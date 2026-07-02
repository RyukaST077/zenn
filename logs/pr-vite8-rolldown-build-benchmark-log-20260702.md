## 概要

- 記事: `articles/vite8-rolldown-build-benchmark-log.md`
- タイトル: Vite 8（Rolldown）へ移行してビルド時間を測ってみた — 8倍速のはずが実際は1.9倍だった話
- topics: vite, rolldown, react, typescript, frontend
- 記事タイプ: 検証ログ・試してみた

## ⚠️ このPRの性質（マージ＝公開）

このPRを `main` にマージすると、Zennの GitHub連携により **記事が自動公開されます**
（`published: true`）。公開してよいか確認のうえマージしてください。取り下げる場合は
マージせずブランチを削除してください。

## レビュー結果

- 公開前レビュー: `logs/review-vite8-rolldown-build-benchmark-log-20260702-2142.md`
- 判定: **公開可**（blocker 0 / warning 0 / suggestion 3）
- 機械チェック（`.claude/skills/review-article/scripts/check-article.sh`）: `SUMMARY fail=1 warn=0`
  - fail の内訳は `published=true` のみ。本ブランチで公開準備として意図的に true 化したもの（マージ＝公開の想定どおり）。秘密情報・slug・画像・コードフェンス等の他の blocker 系チェックはすべて PASS。

## 出典（この記事の素材）

- テーマ: `research/search-topic-20260702-2109.md`
- 実践タスク: `practice/practice-vite8-rolldown-20260702-2113.md`
- 実践ログ: `logs/run-vite8-rolldown-20260702-2116/execution-log.md`

## レビュアー向けチェックリスト

- [ ] `published: true` が意図どおり（マージ＝公開でよい）
- [ ] slug `vite8-rolldown-build-benchmark-log` が汎用的すぎない（Zenn全体で一意。衝突時はリネーム）
- [ ] 画像が表示される（`/images/vite8-rolldown-build-benchmark-log/...` が解決する）
- [ ] 秘密情報・個人情報が含まれていない
- [ ] `npx zenn preview` で表示を確認した

## プレビュー

```bash
git switch publish/vite8-rolldown-build-benchmark-log
npx zenn preview   # http://localhost:8000
```

## マージ後に起きること / 注意

- マージ → Zennがデプロイ → 記事公開。
- 「Slug『vite8-rolldown-build-benchmark-log』はサイト内で既に使用されています」が出たら slug が衝突している。
  具体的な名前にリネームして再push（`knowledge/2026-07-01-zenn-slug-already-used.md`）。
