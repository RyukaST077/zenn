## 概要

- 記事: `articles/pnpm11-minimum-release-age-ci-only-failure.md`
- タイトル: pnpm 11のminimumReleaseAge既定24hを踏みに行ったら、手元では通ってCIだけ落ちた
- topics: `pnpm` / `nodejs` / `npm` / `security` / `ci`
- 記事タイプ: 検証ログ（試してみた）
- 採用した前提: 対象記事＝引数で明示指定 / base=`main` / ブランチ=`publish/pnpm11-minimum-release-age-ci-only-failure` / published を true 化（マージ＝公開）

## ⚠️ このPRの性質（マージ＝公開）

このPRを `main` にマージすると、Zennの GitHub連携により **記事が自動公開されます**
（`published: true`）。公開してよいか確認のうえマージしてください。取り下げる場合は
マージせずブランチを削除してください。

## レビュー結果

- 公開前レビュー: `logs/review-pnpm11-minimum-release-age-ci-only-failure-20260808-0442.md`
- 判定: **公開可**（blocker 0 / warning 0 / suggestion 3）
- 経緯: 初回レビュー `logs/review-...-20260808-0437.md`（公開不可: 個人パス露出）→ `logs/revise-...-20260808-0440.md` で修正 → 再レビューで公開可
- 機械チェック（`scripts/check-article.sh`）: `SUMMARY fail=0 warn=2`
  - `title が長い: 101文字` … バイト数のため実文字数 53（60字目安内）。false positive
  - `秘密情報の疑い [user-path] at line 631,633` … スタックトレースの `file:///Users/.../pnpm/dist/pnpm.mjs`。ホームディレクトリ名は伏せ済みで個人特定情報なし。false positive
- 未対応の suggestion 3件（任意・公開ブロッカーではない）
  1. L467 ストアの 70 と 68 の差2を「直接依存分の差」と推測している箇所の根拠
  2. L358 「ネット上の記事や LLM の回答もまだ `.npmrc` 前提のものが多い」は未計測の一般化
  3. title をやや短くすると一覧で見切れにくい

## 出典（この記事の素材）

- テーマ: `research/search-topic-20260808-0402.md`
- 実践タスク: `practice/practice-pnpm11-minimum-release-age-20260808-0407.md`
- 実践ログ: `logs/run-pnpm11-minimum-release-age-20260808-0411/execution-log.md`

## レビュアー向けチェックリスト

- [ ] `published: true` が意図どおり（マージ＝公開でよい）
- [ ] slug `pnpm11-minimum-release-age-ci-only-failure` が汎用的すぎない（Zenn全体で一意。衝突時はリネーム）
- [ ] 画像なし記事でよい（CLI 検証のためスクショ 0 枚。`/images` 参照なし）
- [ ] 秘密情報・個人情報が含まれていない（個人パスは `/Users/<user>/` に伏せ済み）
- [ ] `npx zenn preview` で表示を確認した

## プレビュー

```bash
git switch publish/pnpm11-minimum-release-age-ci-only-failure
npx zenn preview   # http://localhost:8000
```

## マージ後に起きること / 注意

- マージ → Zennがデプロイ → 記事公開。
- 「Slug『pnpm11-minimum-release-age-ci-only-failure』はサイト内で既に使用されています」が出たら
  slug が衝突している。具体的な名前にリネームして再push
  （`knowledge/2026-07-01-zenn-slug-already-used.md`）。
