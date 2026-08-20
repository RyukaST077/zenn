---
title: "Zennの記事slugがサイト全体で重複していて保存に失敗する"
date: "2026-07-01"
cause_category: "Config"
tech: [zenn, zenn-cli, markdown]
error_type: [SlugAlreadyUsed]
library: [zenn-cli]
keywords: [slug, サイト内で既に使用されています, slug already used, zenn記事保存失敗, グローバル一意]
status: "resolved"   # resolved | workaround | unresolved
---

# 開発ナレッジ報告書

## タイトル
Zennの記事slugがサイト全体で重複していて保存に失敗する

## 概要
`articles/getting-started-with-claude-code.md` という記事ファイルをZennに保存（デプロイ）しようとしたところ、「Slug「getting-started-with-claude-code」はサイト内で既に使用されています」というエラーで保存に失敗した。Zennのslug（記事ファイル名から拡張子を除いた部分）はリポジトリ内だけでなくZennサイト全体でグローバルに一意である必要があり、他ユーザーの既存記事と衝突していたのが原因。ファイル名（slug）をより具体的なものにリネームすることで解決した。

## 背景
- プロジェクト: 024_zenn（Zenn記事投稿用リポジトリ、zenn-cli使用）
- 機能 / 作業内容: zenn-cliのセットアップ後、`npx zenn new:article --slug getting-started-with-claude-code ...` で作成したサンプル記事をZennに公開しようとした
- 技術スタック: zenn-cli, Markdown, GitHub連携によるZenn自動公開
- 環境: ローカル作業 → GitHub連携経由でZennへ自動デプロイ
- 発生タイミング: GitHub連携による記事デプロイ時
- 関連ファイル: `articles/getting-started-with-claude-code.md`
- 関連コマンド: `npx zenn new:article --slug getting-started-with-claude-code --title "..." --type tech --emoji "🚀"`、`git push`

## 問題
- 期待した挙動: pushした記事がZenn上に公開される。
- 実際の挙動: 記事の保存（デプロイ）に失敗する。
- エラーメッセージ:
  ```
  articles/getting-started-with-claude-code.mdの保存に失敗しました
  （Slug「getting-started-with-claude-code」はサイト内で既に使用されています）
  ```
- 再現手順:
  1. `npx zenn new:article --slug getting-started-with-claude-code ...` でslugを指定して記事を作成する
  2. そのslugが既にZenn上の別記事（自分の記事とは限らない）で使われている
  3. push / デプロイすると上記エラーで保存に失敗する

## 原因
- 推測した原因: リポジトリ内でのファイル名重複ではないかと最初は考えた。
- 確定した原因: Zennのslugはリポジトリ単位ではなく**Zennサイト全体でグローバルに一意**である必要があり、汎用的すぎるslug（`getting-started-with-claude-code`）が既存の他記事と衝突していた。
- 原因カテゴリ: Config
- 根拠: Zenn公式仕様上、slug（記事のパス識別子）はサイト全体で一意という制約があり、汎用的な英語フレーズのslugは衝突しやすい。

## 解決策
- 試したこと:
  1. frontmatter（title, published等）を見直したが、slug自体が原因と分かるまでは的外れだった。
- 最終的な修正: 記事ファイル名（slug）を、内容に即した一意性の高いものにリネームした。
  ```bash
  git mv articles/getting-started-with-claude-code.md articles/zenn-github-integration-auto-publish.md
  git add articles/zenn-github-integration-auto-publish.md
  git commit -m "Rename article slug to avoid Zenn-wide slug collision"
  git push origin main
  ```
- 変更ファイル: `articles/getting-started-with-claude-code.md` → `articles/zenn-github-integration-auto-publish.md`（frontmatterの内容自体は変更なし）
- Before / After:
  ```
  Before: articles/getting-started-with-claude-code.md
  After:  articles/zenn-github-integration-auto-publish.md
  ```

## 検証
- 検証方法: リネーム後にコミット・pushし、Zenn側の再デプロイでエラーが出ないか確認する想定。
- テスト結果: N/A（Zenn側の反映確認はユーザー側で実施予定）
- ビルド結果: N/A
- 残課題: 新しいslugでも実際にZenn上で保存が成功したかは要確認。

## 再発防止
- 防止策: 新規記事作成時は `getting-started-with-*` のような汎用的すぎるslugを避け、プロジェクト名やトピックを含めた具体的なslugを付ける。
- 次回チェック手順:
  1. `npx zenn new:article --slug <slug>` でslugを決める際、汎用フレーズでないか確認する。
  2. 保存エラーが出た場合は「サイト内で既に使用されています」の文言を確認し、slugのリネームを試す。
- チェックリスト項目:
  - [ ] slugが具体的でユニーク性が高いか確認したか
  - [ ] 保存エラー時にslug衝突の可能性をまず疑ったか

## 検索タグ
- Tech: zenn, zenn-cli, markdown
- Error Type: SlugAlreadyUsed
- Library: zenn-cli
- Keywords: slug, サイト内で既に使用されています, slug already used, zenn記事保存失敗, グローバル一意
