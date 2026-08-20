---
title: "gh pr merge --auto が branch protection の無いリポジトリで不安定に失敗する"
date: "2026-07-11"
cause_category: "External Service"
tech: [gh, github, bash]
error_type: [AutoMergeSetupFailed]
library: [gh-cli]
keywords: [auto-merge, gh pr merge, branch protection, 即時マージ, フォールバック, auto-merge setup failed]
status: "resolved"
---

# 開発ナレッジ報告書

## タイトル
gh pr merge --auto が branch protection の無いリポジトリで不安定に失敗する

## 概要
auto-publish-codex.sh の最終ステップ `gh pr merge "$PR_URL" --squash --auto --delete-branch` が
「auto-merge setup failed」で die した。同じコマンドが数時間前の launchd 実行では成功しており、
branch protection / 必須チェックの無いリポジトリでは `--auto`（auto-merge 予約）の成否が安定しない。
Claude 版パイプラインに元々あった「`--auto` が失敗したら即時マージ」フォールバックを移植して解決した。

## 背景
- プロジェクト: 024_zenn（Zenn記事自動公開パイプライン）
- 機能 / 作業内容: Codex 版パイプライン `bash scripts/auto-publish-codex.sh --auto-merge` の最終マージ工程
- 技術スタック: bash, gh CLI, GitHub（branch protection 未設定の個人リポジトリ）
- 環境: macOS (Darwin 25.5.0), ローカル実行
- 発生タイミング: prepare_publish 完了後、PR 作成成功 → auto-merge 予約時
- 関連ファイル: scripts/auto-publish-codex.sh, scripts/auto-publish.sh（フォールバックの移植元）
- 関連コマンド: `gh pr merge <PR_URL> --squash --auto --delete-branch`

## 問題
- 期待した挙動: PR 作成後に auto-merge が予約（または即時マージ）され、パイプラインが complete する。
- 実際の挙動: PR は作成されたが auto-merge 予約で失敗し、パイプラインが die。記事は publish ブランチに残った。
- エラーメッセージ:

  ```
  [10:00:49] prepare_publish complete: articles/node-test-randomize-seed-extraction.md
  [10:00:56] ERROR: auto-merge setup failed
  ```

- 再現手順:
  1. branch protection / 必須チェックの無いリポジトリで PR を作る
  2. `gh pr merge <url> --squash --auto --delete-branch` を実行する
  3. タイミングにより成功することも「auto-merge setup failed」相当のエラーで失敗することもある
     （同日 06:36 の実行は成功、10:00 の実行は失敗）

## 原因
- 推測した原因: gh の認証切れや API レート制限も疑ったが、直後の手動 `gh pr merge`（--auto なし）は成功した。
- 確定した原因: GitHub の auto-merge 予約（`--auto`）はリポジトリ側の設定（Allow auto-merge / 必須チェック）に
  依存し、branch protection の無いリポジトリでは成否が安定しない。スクリプトに失敗時のフォールバックが無く、
  一発勝負だったため die した。
- 原因カテゴリ: External Service
- 根拠: 同一コマンドが同日内で成功と失敗の両方を記録。`--auto` を外した即時マージは常に成功。
  Claude 版 auto-publish.sh には同じ理由のフォールバックが最初から実装されていた（337行目コメント参照）。

## 解決策
- 試したこと:
  1. 失敗した PR #17 を手動で `gh pr merge 17 --squash --delete-branch` → 即成功（原因の切り分けになった）
- 最終的な修正: Codex 版に Claude 版と同じ2段構えを移植（PR #18）。
- 変更ファイル: scripts/auto-publish-codex.sh
- Before / After:

  ```bash
  # Before
  gh pr merge "$PR_URL" "$MERGE_METHOD" --auto --delete-branch || die "auto-merge setup failed"

  # After（--auto 失敗時は即時マージにフォールバック）
  if gh pr merge "$PR_URL" "$MERGE_METHOD" --auto --delete-branch; then
    log "auto-merge scheduled (merges after required checks pass)"
  elif gh pr merge "$PR_URL" "$MERGE_METHOD" --delete-branch; then
    log "PR merged immediately"
  else
    die "auto-merge setup failed"
  fi
  ```

## 検証
- 検証方法: 失敗した PR #17 に対しフォールバック相当の即時マージを手動実行し成功。`bash -n` で構文確認。
- テスト結果: PR #17 マージ成功（記事公開サイクル完走）。修正版スクリプトは次回定期実行で本番検証。
- ビルド結果: N/A
- 残課題: リポジトリ設定で「Allow auto-merge」を有効化すれば `--auto` 自体も安定する可能性がある（未検証）。

## 再発防止
- 防止策: 外部サービスの「予約系」操作には即時実行のフォールバックを常に用意する。
  2系統のパイプライン（Claude 版 / Codex 版）で片方だけにある防御は移植漏れを疑う。
- 次回チェック手順: 「auto-merge setup failed」が出たら、まず `gh pr merge <PR> --squash --delete-branch`
  （--auto なし）を手動実行して切り分ける。成功するならリポジトリ設定起因。
- チェックリスト項目:
  - [ ] gh の予約系コマンド（--auto 等）に即時実行フォールバックがあるか
  - [ ] Claude 版 / Codex 版で同じ防御が両方に入っているか

## 検索タグ
- Tech: gh, github, bash
- Error Type: AutoMergeSetupFailed
- Library: gh-cli
- Keywords: auto-merge, gh pr merge, branch protection, 即時マージ, フォールバック, auto-merge setup failed
