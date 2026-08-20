---
title: "planステージがCodexサンドボックスで実行できない検証計画（実ブラウザ起動・deno upgrade等）を立ててしまう"
date: "2026-07-11"
cause_category: "Environment"
tech: [codex, sandbox, playwright, deno, docker]
error_type: [SandboxConstraintViolation, BrowserLaunchFailed, UpgradeFeatureDisabled]
library: [codex-cli, playwright, deno]
keywords: [サンドボックス制約, browser gate, deno upgrade, Homebrew, 実行不能な計画, run stage abort, workspace-write]
status: "resolved"
---

# 開発ナレッジ報告書

## タイトル
planステージがCodexサンドボックスで実行できない検証計画（実ブラウザ起動・deno upgrade等）を立ててしまう

## 概要
Codex 版パイプラインの run ステージ（`--sandbox workspace-write`）で、plan ステージが立てた検証手順が
実行環境の制約に阻まれて停止する事象が連続した（CSS Gap 記事: 実ブラウザ起動不可 / Deno 記事:
Homebrew 版 deno の `deno upgrade` 無効）。原因は plan スキルが run ステージのサンドボックス制約を
知らないまま検証方法を選ぶこと。実測済みの制約（ブラウザ起動不可・brew 不可・deno upgrade 不可・
Docker は使用可）を `.agents/skills/zenn-plan-practice/SKILL.md` に明記して解決した。

## 背景
- プロジェクト: 024_zenn（Zenn記事自動公開パイプライン）
- 機能 / 作業内容: Codex 版パイプラインの run ステージ（zenn-run-practice による実践検証）
- 技術スタック: Codex CLI（`codex exec --sandbox workspace-write`）, Playwright, Deno, Docker
- 環境: macOS (Darwin 25.5.0) arm64, Homebrew, Docker Desktop 28.5.1
- 発生タイミング: run ステージ冒頭の環境ゲート（ツール取得・起動確認）
- 関連ファイル: .agents/skills/zenn-plan-practice/SKILL.md,
  practice/practice-deno29-built-in-testing-20260711-0152.md,
  logs/run-css-gap-decorations-20260711-0622/execution-log.md
- 関連コマンド: `bash scripts/auto-publish-codex.sh --auto-merge`

## 問題
- 期待した挙動: plan が立てた検証手順を run ステージがそのまま実行し、検証ログを作って完了する。
- 実際の挙動: 環境ゲートで停止し、abort または「止まった記録」のみの部分的なログになる。
- エラーメッセージ:

  ```
  # Deno の例（Homebrew 版 deno は upgrade 機能無効）
  error: This deno was built without the "upgrade" feature. Please upgrade using the installation
  method originally used to install Deno.

  # CSS Gap の例（実行ログより）
  Outcome: Stopped at the mandatory browser gate (negative/partial evidence).
  The runner tried system Chrome first and then the one permitted bundled-Chromium fallback.
  Neither produced a usable browser context.
  ```

- 再現手順:
  1. plan ステージが「実ブラウザ起動」や「`deno upgrade` による特定バージョン取得」を検証手順に含める
  2. run ステージ（Codex サンドボックス内）で該当コマンドが失敗する
  3. プランの停止条件により検証が中断する

## 原因
- 推測した原因: 当初 Docker デーモンソケットも遮断されると推測した（`codex sandbox -P :workspace` での
  事前検証は connect: operation not permitted）。しかし実際の run ステージでは `docker pull` / `docker run`
  が成功しており、事前検証と実実行経路の挙動が異なった。**推測でなく実行ログで制約を確定させること。**
- 確定した原因: plan スキル（zenn-plan-practice）が run ステージの実行環境制約を知らず、
  ホストでは可能でもサンドボックス内では不可能な検証方法を選んでいた。実測で確定した制約:
  - 実ブラウザ起動（Playwright + システム Chrome / 同梱 Chromium とも）は browser context を作れず失敗
  - `brew` などシステムレベルのインストールは不可
  - Homebrew 版 deno は `deno upgrade` がビルド時に無効化されている（サンドボックス以前にホストでも失敗）
  - Docker（`docker pull` / `docker run`）は動作する（実行ログで確認済み）
- 原因カテゴリ: Environment
- 根拠: logs/run-css-gap-decorations-20260711-0622/execution-log.md（ブラウザゲート停止）、
  `deno upgrade` のエラーをホストで再現、logs/run-node-test-randomize-20260711-095234/execution-log.md
  （Docker で Node v24.16.0 コンテナ実行成功）。

## 解決策
- 試したこと:
  1. Deno プランは取得コマンドを公式 CDN 直ダウンロードに手動パッチ（`deno upgrade` →
     `curl https://dl.deno.land/release/v2.9.0/deno-aarch64-apple-darwin.zip` + unzip）→ resume 可能な状態にした
  2. 「Docker 禁止」を一度スキルに書いたが、実行ログで Docker が動作していたことを確認し記述を訂正（教訓）
- 最終的な修正: zenn-plan-practice の SKILL.md に、実測済みサンドボックス制約と推奨手段
  （公式 Docker イメージ or 公式配布アーカイブをワークスペース内に取得して隔離実行）を明記（PR #18）。
- 変更ファイル: .agents/skills/zenn-plan-practice/SKILL.md,
  practice/practice-deno29-built-in-testing-20260711-0152.md
- Before / After:

  ```
  Before: plan スキルに実行環境の制約記述なし → ブラウザ起動前提・deno upgrade 前提の計画が生成される
  After:  "The run stage executes inside the Codex workspace-write sandbox. Known environment
          constraints observed in past runs: launching real browsers fails ... Docker has worked.
          When a specific runtime version is required, prefer the official Docker image or download
          the official release archive ..." を手順に追加
  ```

## 検証
- 検証方法: 修正後の Node.js テーマのパイプラインが Docker ベースの検証で run〜publish まで完走
  （PR #17 マージ）。ブラウザ/deno 制約はホスト再現とログで確認。
- テスト結果: pass（新プラン生成での効果は次回以降のパイプライン実行で継続確認）
- ビルド結果: N/A
- 残課題: 制約リストは実測ベースなので、新しい制約に当たったら SKILL.md へ追記していく運用。

## 再発防止
- 防止策: run 実行環境の制約は plan スキルに集約して明記する。制約は推測でなく実行ログで確定させてから書く。
- 次回チェック手順: run ステージが環境ゲートで止まったら、(1) 実行ログの停止理由を読む →
  (2) ホストで単体再現して切り分け → (3) 確定した制約を zenn-plan-practice の SKILL.md に追記 →
  (4) 当該プランは代替手段（公式配布物 / Docker）でパッチして resume。
- チェックリスト項目:
  - [ ] プランの検証手順はサンドボックス内で実行可能か（ブラウザ起動・システムインストールを含まないか）
  - [ ] 特定バージョンのランタイムは公式配布物 or Docker イメージで隔離取得しているか
  - [ ] 新たに判明した制約を SKILL.md に反映したか

## 検索タグ
- Tech: codex, sandbox, playwright, deno, docker
- Error Type: SandboxConstraintViolation, BrowserLaunchFailed, UpgradeFeatureDisabled
- Library: codex-cli, playwright, deno
- Keywords: サンドボックス制約, browser gate, deno upgrade, Homebrew, 実行不能な計画, run stage abort, workspace-write
