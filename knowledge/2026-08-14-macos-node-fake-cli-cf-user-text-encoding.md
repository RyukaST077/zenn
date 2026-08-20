---
title: "macOSのNode製fake CLIが unexpected environment name で事前検証に失敗する"
date: 2026-08-14
status: resolved
cause_category: Environment
tech: [macos, node, codex, fake-cli, preflight]
error_type: [UnexpectedEnvironmentName, PreflightFailure]
library: [node, codex-cli]
keywords: [__CF_USER_TEXT_ENCODING, AGENT_PRACTICE_PREFLIGHT, environment allowlist, fixture-wrapper]
---

# macOSのNode製fake CLIが unexpected environment name で事前検証に失敗する

## 状況

AI coding-agent記事パイプラインで、fixture wrapperを本物のCodexより先にオフラインfake CLIで検証した。

## 症状

fake CLIへ渡す環境を `PATH`、`TMPDIR`、`CODEX_HOME`、`AGENT_PRACTICE_PREFLIGHT` に限定したにもかかわらず、バージョン確認が終了コード2になった。本物のCodex実験は開始されず、記事パイプラインはrunステージで安全停止した。

## 環境

- macOS
- Node.jsで実装したfake CLI
- Codex CLI 0.147.0向けfixture wrapper

## エラー

fake CLIの直接的なエラーは次のとおりだった。

```text
offline preflight CLI error: unexpected environment name
```

wrapper側では標準エラーを結果へ含めていなかったため、次の二次的な表示になった。

```text
resume wrapper error: expected codex-cli 0.147.0
```

## 試したこと

- 実際の `codex --version` が `codex-cli 0.147.0` であることを確認した。
- fake CLIの `--version` 応答も同じ文字列であることを確認した。
- runner、wrapper、fake CLIの各段階で組み立てる環境変数を比較した。

## 確認できた原因

macOSでは、明示的に限定した環境でNodeプロセスを起動しても `__CF_USER_TEXT_ENCODING` が追加される場合がある。fake CLIの環境変数allowlistがこれを許可していなかったため、`--version` の処理より前に終了していた。

## 最終的な修正

認証情報を含む変数は引き続き拒否しつつ、macOSが追加する `__CF_USER_TEXT_ENCODING` をfake CLIの許可一覧へ追加した。

```js
const allowedEnvironment = new Set([
  "AGENT_PRACTICE_PREFLIGHT",
  "CODEX_HOME",
  "PATH",
  "TMPDIR",
  "__CF_USER_TEXT_ENCODING",
]);
```

また、今後生成するNode製fake CLIにも同じ考慮を求めるよう、計画ステージの指示へ追記した。

## 検証

修正後、同じmanifestで次を実行し、終了コード0と `preflight-summary.json` の生成を確認した。

```bash
node scripts/agent-practice/run-experiment.mjs \
  practice/agent/agent-practice-codex-ephemeral-resume-persistence-20260814-1130.json \
  --preflight-only
```

続けて同じmanifestを通常実行し、事前検証と認証済みCodex実験の両方が成功し、検証マーカー `RESUME_PERSISTENCE_BOUNDARY_OBSERVED` が記録された。

## 制限

`__CF_USER_TEXT_ENCODING` の値そのものには依存しない。ほかのOSやランタイムが追加する変数は別途確認が必要であり、すべての環境変数を無条件に許可する修正は避ける。

## 再発防止

- fake CLIは認証情報に関係する変数を拒否する。
- OSやランタイムが追加する無害な変数は、実環境での事前検証結果に基づいて限定的に許可する。
- wrapperのエラーには子プロセスの終了コードと、機密情報を除いた標準エラーを含める。
