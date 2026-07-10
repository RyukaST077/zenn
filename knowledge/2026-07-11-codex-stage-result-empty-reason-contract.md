---
title: "Codexパイプラインが successful stage result must have an empty reason で失敗する"
date: "2026-07-11"
cause_category: "Code/Logic"
tech: [codex, bash, node]
error_type: [StageResultContractFailed]
library: [codex-cli]
keywords: [stage result, empty reason, 契約違反, output schema, LLM prompt contract, auto-publish]
status: "resolved"
---

# 開発ナレッジ報告書

## タイトル
Codexパイプラインが successful stage result must have an empty reason で失敗する

## 概要
auto-publish-codex.sh の search ステージが成功したのに、結果JSONの契約チェックで
「successful stage result must have an empty reason」で die した。原因は「成功時は
reason を空文字にする」というルールがバリデータ（validate-stage-result.mjs）にしか
存在せず、プロンプトにも JSON スキーマにも書かれていなかったこと。ステージプロンプトに
ルールを1文追記して解決した。

## 背景
- プロジェクト: 024_zenn（Zenn記事自動公開パイプライン）
- 機能 / 作業内容: Codex CLI 版の全自動公開パイプライン（scripts/auto-publish-codex.sh）の実行
- 技術スタック: bash, Node.js, Codex CLI（exec --json --output-schema）, gh CLI
- 環境: macOS (Darwin 25.5.0), ローカル実行
- 発生タイミング: パイプライン第1ステージ（search）完了直後の結果検証時
- 関連ファイル: scripts/auto-publish-codex.sh, scripts/validate-stage-result.mjs, scripts/schemas/codex-stage-result.schema.json
- 関連コマンド: bash scripts/auto-publish-codex.sh

## 問題
- 期待した挙動: search ステージがレポートを生成し、結果JSONが契約チェックを通過して次ステージへ進む。
- 実際の挙動: ステージ本体は成功（レポート生成済み）なのに、契約チェックで die してパイプライン全体が停止。
- エラーメッセージ:

  ```
  successful stage result must have an empty reason
  [23:30:17] ERROR: search result contract failed: logs/codex-pipeline-20260710-232528/1-search.result.json
  ```

  却下された結果JSON（reason に成功サマリが入っている）:

  ```json
  {"status":"ok","artifact":"research/search-topic-20260710-2326.md",
   "reason":"Created exactly one research report using live primary and community sources, ...",
   "metadata":{"verdict":null,"slug":null,"pr_metadata":null}}
  ```

- 再現手順:
  1. `bash scripts/auto-publish-codex.sh` を実行
  2. Codex がステージ成功時に reason へ説明文を書く（確率的挙動）→ 契約チェックで die

## 原因
- 推測した原因: 当初はステージ（スキル実行）自体の失敗を疑ったが、レポートは正常に生成されていた。
- 確定した原因: 「status が ok のとき reason は空文字でなければならない」というルールが
  validate-stage-result.mjs:25 にしか存在せず、エージェントに伝わる場所
  （ステージプロンプト・output スキーマ・AGENTS.md・スキル定義）のどこにも書かれていなかった。
  スキーマ上 reason はただの string なので、Codex が成功理由を記述するのはスキーマ適合の自然な挙動。
- 原因カテゴリ: Code/Logic
- 根拠: 結果JSONはスキーマ適合かつ artifact も正しい。grep で「empty reason」ルールが
  validator 以外のどこにも存在しないことを確認。プロンプト追記後の再実行では全7ステージが一発通過。

## 解決策
- 試したこと: knowledge/ 検索（該当なし）→ ログ・バリデータ・スキーマ・AGENTS.md・スキル定義を
  横断調査し、ルールの記載箇所がバリデータのみと特定（失敗した試行は特になし）。
- 最終的な修正: run_stage のステージプロンプト末尾に成功時ルールを明示する1文を追加。
- 変更ファイル: scripts/auto-publish-codex.sh（commit 77e8939）
- Before / After:

  ```bash
  # Before
  cmd+=("Use \$$skill. $prompt ... Your final response must be only the schema-conforming stage result JSON.")

  # After
  cmd+=("Use \$$skill. $prompt ... Your final response must be only the schema-conforming stage result JSON. When status is \"ok\", set \"reason\" to an empty string; use \"reason\" only when status is \"abort\".")
  ```

## 検証
- 検証方法: `bash scripts/auto-publish-codex.sh --resume logs/codex-pipeline-20260710-232528` で再実行
- テスト結果: 全ステージ（search → plan → run → draft → review → prepare_publish → PR作成）が
  契約チェック込みで一発通過。PR #11 作成・マージまで完走。
- ビルド結果: N/A
- 残課題: スキーマ側でも `anyOf` + `const: ""` で構造的に強制する余地あり（現状はプロンプト頼み）。

## 再発防止
- 防止策: バリデータが強制するルールは、必ずエージェントに見える場所（プロンプト or スキーマ）にも書く。
- 次回チェック手順: 「result contract failed」で die したら、まず結果JSONを開き、
  どのバリデータ行（validate-stage-result.mjs の fail メッセージ）に当たったかを特定する。
  ステージ本体の失敗と契約チェックの失敗を混同しない。
- チェックリスト項目:
  - [ ] validate-stage-result.mjs に新ルールを足したら、プロンプト/スキーマ/AGENTS.md にも反映したか
  - [ ] 結果JSONの reason は成功時に空文字か

## 検索タグ
- Tech: codex, bash, node
- Error Type: StageResultContractFailed
- Library: codex-cli
- Keywords: stage result, empty reason, 契約違反, output schema, LLM prompt contract, auto-publish
