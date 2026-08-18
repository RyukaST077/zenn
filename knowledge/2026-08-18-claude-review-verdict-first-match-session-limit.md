---
title: "Claude版記事パイプラインが過去の要修正判定を誤読してsession limitで停止する"
date: "2026-08-18"
status: "resolved"
cause_category: "Code/Logic"
tech: [claude-code, bash, node]
error_type: [IncorrectReviewVerdict, SessionLimit]
library: [claude-cli]
keywords: [verdict, grep-first-match, structured-output, json-schema, state-json, article-checker, auto-publish]
---

# 開発ナレッジ報告書

## 背景

Zenn記事のClaude版自動パイプラインは、テーマ調査、実践、下書き、review/revise、公開キュー追加を
別々の非対話Claudeセッションで実行している。reviewの機械判定はMarkdownレポートから文字列を
検索し、再開状態は追記型の`state.sh`へ保存していた。

## 症状

下書きと2回目のreviewまでは完了し、最新reviewには`**判定: 公開可**`と記録されていた。しかし
オーケストレーターは`fix`と判定して不要なreviseを開始し、公開キューへ進む前に停止した。記事は
`published: false`の未追跡ファイルとして残り、review/publishの完了状態は保存されなかった。

## 環境

- macOS / bash 3.2互換のシェルスクリプト
- Claude CLIの非対話実行（`claude -p`）
- Node.jsによるstage result・記事検証
- launchdによる定期起動

## エラー

reviseステージの標準出力は次の1行で、Claude CLIはexit 1を返した。

```text
You've hit your session limit · resets 9am (Asia/Tokyo)
```

直前の進行ログは、最新reviewが公開可能にもかかわらず次を記録していた。

```text
レビュー判定 (round 2/3): fix
```

## 試行

- 下書きの有無、review本文、パイプライン状態、revise標準出力を順に照合した。
- session limitだけを原因とせず、`verdict_of()`が実際に取得する最初の行を再現した。
- Claudeスキル内の記事チェッカーと公開キュー側チェッカーを同じ記事へ実行し、判定差を確認した。
- 修正前にknowledgeを検索したが、同じ原因の報告は無かった。stage result契約を一元化した既存報告は
  設計上の先例として利用した。

## 確定原因

1. `verdict_of()`が`grep -m1 -E '判定[:：]'`を使い、現在判定より前にある履歴説明
   `判定: 要修正`を取得していた。
2. その誤判定で不要なreviseを呼び、パイプライン開始時にしか確認していなかった5時間枠を使い切った。
3. reviseは記事と修正レポートを書いた後、最終`RESULT:`を返す前にsession limitへ達したため、
   オーケストレーターは部分成果物を再利用できなかった。
4. Claudeスキルと公開キューが別の記事チェッカーを使っていた。引用符付きの`type: "tech"`と
   launchdロケール下の日本語文字数について判定が一致していなかった。

## 最終修正

- Claude CLIの`--json-schema`を使い、reviewの`pass/fix/blocker`をMarkdownではなく構造化stage resultで受け取る。
- stage resultとMarkdown内の正規化された現在判定行が一対一で一致することを別バリデータで検証する。
- Claude版の状態を`pipeline-state.mjs`による原子的な`state.json`へ移行し、旧`state.sh`もresume時に移行する。
- draft/revise直後にオーケストレーター自身が共通`check-article.sh`を実行する。
- Claudeスキル内チェッカーを共通チェッカーの薄いラッパーにし、引用符付きscalarを正規化する。
- 各AIステージの開始前に利用率を再確認し、session limitはretryableな一時停止として状態を残す。
- revise中の上限到達後に有効な記事更新があれば、二重修正を避けて次回は非破壊reviewから再開する。

## 検証

次を実行した。

```bash
npm test
```

結果:

```text
Codex pipeline tests passed
Claude pipeline tests passed
Claude usage gate tests passed
zenn publication queue tests: ok
AI agent practice runner tests passed
```

Claude版の新規回帰テストでは、過去の`判定: 要修正`が現在判定より前にあるfixture、現在判定の重複、
`type: "tech"`、`LC_ALL=C`での日本語タイトル、構造化結果抽出、旧`state.sh`移行を確認した。

## 制限

実Claudeを使った全ステージ通し実行とGitHub PR作成は、利用枠消費と外部副作用を避けるため実施していない。
Claude JSON出力のenvelopeはfixtureで検証し、複数の既知形状を抽出できるようにしている。次回の定期実行では
実envelopeと段ごとの利用率ログを確認する。

## 再発防止

- LLMが生成する人間向けMarkdownを制御フローの唯一の入力にしない。
- 判定、artifact、slugは共通Schema、プロンプト、バリデータから生成し、別々に定義しない。
- AIが「チェック成功」と報告しても、オーケストレーター側で同じ決定的チェッカーを再実行する。
- 利用量ゲートは長時間パイプラインの開始前だけでなく、各AIステージの直前にも置く。
- 上限到達は通常失敗と区別し、原子的な状態と部分成果物を残して安全な段から再開する。
