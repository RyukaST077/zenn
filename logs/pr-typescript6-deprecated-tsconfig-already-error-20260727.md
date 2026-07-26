## 概要

- 記事: `articles/typescript6-deprecated-tsconfig-already-error.md`
- タイトル: TypeScript 6で「警告」だと思っていたtsconfigは、6の時点でもうビルドを止めていた
- topics: `typescript` / `tsconfig` / `nodejs` / `npm`
- 記事タイプ: 検証ログ（TypeScript 5.9 / 6.0 / 7.0 の3世代比較）

## 採用した前提（/publish-pr）

- 対象記事: 引数で明示（`articles/typescript6-deprecated-tsconfig-already-error.md`）
- base: `main` / ブランチ: `publish/typescript6-deprecated-tsconfig-already-error`
- 画像: `images/typescript6-deprecated-tsconfig-already-error/` は存在しない（ブラウザ表示を伴わない記事）ため、記事ファイルのみをコミット

## ⚠️ このPRの性質（マージ＝公開）

このPRを `main` にマージすると、Zennの GitHub連携により **記事が自動公開されます**
（`published: true`）。公開してよいか確認のうえマージしてください。取り下げる場合は
マージせずブランチを削除してください。

## レビュー結果

- 公開前レビュー: `logs/review-typescript6-deprecated-tsconfig-already-error-20260727-0433.md`
- 判定: **公開可**（blocker 0 / warning 0 / suggestion 4）
- 経緯: 初回レビュー `…-0427.md`（要修正 / warning 3）→ 修正 `logs/revise-typescript6-deprecated-tsconfig-already-error-20260727-0431.md` → 再レビューで公開可
- 機械チェック（`check-article.sh`）: `SUMMARY fail=0 warn=1`
  - 残る 1 warning は `title が長い: 108文字` のバイト数カウントによる誤検知（実文字数は約50字）。レビューでも suggestion に降格済み。

## 出典（この記事の素材）

- テーマ: `research/search-topic-20260727-0402.md`
- 実践タスク: `practice/practice-typescript7-tsconfig-defaults-20260727-0408.md`
- 実践ログ: `logs/run-typescript7-tsconfig-defaults-20260727-0411/execution-log.md`

## レビュアー向けチェックリスト

- [ ] `published: true` が意図どおり（マージ＝公開でよい）
- [ ] slug `typescript6-deprecated-tsconfig-already-error` が汎用的すぎない（Zenn全体で一意。衝突時はリネーム）
- [ ] 画像参照なしで問題ない（`/images` 参照は本文に無い）
- [ ] 秘密情報・個人情報が含まれていない
- [ ] `npx zenn preview` で表示を確認した

## プレビュー

```bash
git switch publish/typescript6-deprecated-tsconfig-already-error
npx zenn preview   # http://localhost:8000
```

## マージ後に起きること / 注意

- マージ → Zennがデプロイ → 記事公開。
- 「Slug『typescript6-deprecated-tsconfig-already-error』はサイト内で既に使用されています」が出たら slug が衝突している。
  具体的な名前にリネームして再push（`knowledge/2026-07-01-zenn-slug-already-used.md`）。

🤖 Generated with [Claude Code](https://claude.com/claude-code)
