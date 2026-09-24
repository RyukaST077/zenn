---
title: "fast_mode_disabled_reasonで切り分けるClaude Code Fast mode無効化の優先順位"
emoji: "🚦"
type: "tech"
topics: ["claudecode", "aiagent", "cli", "automation"]
published: true
---

## 結論から: 4つの阻害要因には固定の優先順位がある

`claude -p`(ヘッドレスモード)やAgent SDK、CI/自動化スクリプトからClaude Codeを呼んでいて、Fast modeを有効にしようとしたが `/fast` のUI文言だけでは「環境変数」「`--settings` の指定漏れ」「モデル許可リスト」「usage credits未有効化」のどれが効いているのか区別できない、という状況はよくあります。四つの原因を毎回1つずつ潰していくのは、CLIラウンドトリップのぶんだけ遅く、無駄です。

Claude Code 2.1.270(サブスクリプション認証、usage credits無効)で実測したところ、`claude -p "/fast" --output-format json` のJSON出力には `fast_mode_disabled_reason` という(ドキュメント化されていない)フィールドがあり、複数の阻害要因が同時に成立している状態でも、次の優先順位で1つだけが報告されることを確認しました。

```
disabled_by_env > sdk_opt_in_required(-p専用) > model_not_allowed > extra_usage_disabled
```

つまり、このフィールドの値を読むだけで「次に直すべき設定はどれか」を一意に決められます。usage creditsを一切消費せずに済みます。

| 観測された `fast_mode_disabled_reason` | 次に直す設定 |
|---|---|
| `disabled_by_env` | まず `CLAUDE_CODE_DISABLE_FAST_MODE` を unset する(他の設定を見るのはそのあと) |
| `sdk_opt_in_required` | `--settings` に `"fastMode": true` を追加する(`/fast` で対話的に保存しただけでは `-p` には効かない) |
| `model_not_allowed` | usage creditsを見る前に `availableModels` にOpusが含まれているか直す |
| `extra_usage_disabled` | usage creditsを直接確認する(`fastModePerSessionOptIn: true` を足しても、この状態からは区別できない) |

## なぜこの優先順位を確認する必要があるのか

公式のFast modeドキュメント(https://code.claude.com/docs/en/fast-mode 、2026-09-24アクセス)は、Fast modeがOpus限定であること、`fastMode` 設定で保存されること、サブスクリプションプランではusage creditsが必要であること、ヘッドレスの `-p` では `--settings` に明示的に `{"fastMode": true}` を渡す必要があることを、それぞれ個別には説明しています。しかし、返却されるフィールド名(`fast_mode_disabled_reason`)自体を文書化しておらず、複数の阻害条件が同時に成り立つときにどれが報告されるかにも触れていません。

CIや自動化スクリプトでは、たとえば `CLAUDE_CODE_DISABLE_FAST_MODE=1` が環境に紛れ込んでいるだけで、`fastMode: true` を正しく設定していても静かにFast modeが無効化されます。UIの文言を目視確認できない自動化パスでは、この優先順位を機械的に判定できる signal が要ります。

## 検証条件と5ケースの実測結果

検証日は2026-09-24、Claude Codeバージョンは `2.1.270 (Claude Code)`、認証はサブスクリプション、usage creditsは意図的に無効のままです。5ケースはすべて次の共通テンプレートから `--settings` の中身(と、ケースによっては先頭の環境変数)だけを変えたものです。

```
claude -p "/fast" --output-format json --no-session-persistence \
  --setting-sources "" --settings '<CASE_SETTINGS_JSON>' \
  --strict-mcp-config --mcp-config '{"mcpServers":{}}' --no-chrome --max-turns 1
```

各ケースは実行前に事前登録した「期待される理由」と「競合する(それが出れば反証になる)理由」を1件ずつ定義し、実際に観測された値と突き合わせました。5件とも live・real CLI呼び出し(`total_cost_usd: 0`、`live_model_calls: 1`)で、事前登録した期待値どおりの結果になり、競合する値は一度も出ませんでした。

| ケース | 変えた条件 | 期待した理由 | 競合する理由 | 観測結果 |
|---|---|---|---|---|
| `sdk-opt-in-required` | `fastMode` キーなし、env変数なし | `sdk_opt_in_required` | `extra_usage_disabled` | 期待どおり |
| `env-disable-overrides-usage-credits` | `fastMode:true` + `CLAUDE_CODE_DISABLE_FAST_MODE=1` | `disabled_by_env` | `extra_usage_disabled` | 期待どおり |
| `model-not-allowed-overrides-usage-credits` | `fastMode:true` + `availableModels:["sonnet"]` | `model_not_allowed` | `extra_usage_disabled` | 期待どおり |
| `per-session-optin-hidden-by-usage-credits` | `fastMode:true` + `fastModePerSessionOptIn:true` | `extra_usage_disabled` | `per_session_opt_in_required` | 期待どおり |
| `org-skip-check-no-effect-without-optin` | `fastMode` キーなし + `CLAUDE_CODE_SKIP_FAST_MODE_ORG_CHECK=1` | `sdk_opt_in_required` | (変化なしを期待) | 期待どおり(変化なし) |

具体的には、`sdk-opt-in-required` ケースの生JSONは `"fast_mode_state":"off","fast_mode_disabled_reason":"sdk_opt_in_required"`、`"result":"Fast mode unavailable: Fast mode is not available in the Agent SDK"` を返しました。`per-session-optin-hidden-by-usage-credits` では `fastModePerSessionOptIn:true` を足しても、`fastMode:true` かつusage credits無効という条件下では、報告される理由は `extra_usage_disabled` のままで、per-session opt-in固有の理由は出ませんでした。`org-skip-check-no-effect-without-optin` では `CLAUDE_CODE_SKIP_FAST_MODE_ORG_CHECK=1` を付けても、`--settings` に `fastMode:true` がない限り `sdk_opt_in_required` から変化しませんでした。

### コピペ用コマンド集(5ケース全文)

上の表の `<CASE_SETTINGS_JSON>` と環境変数を、実行時に使った値でそのまま埋めた5本です。手元で `<CASE_SETTINGS_JSON>` を組み立て直す必要はありません。

```bash
# 1. sdk-opt-in-required → 期待: sdk_opt_in_required
claude -p "/fast" --output-format json --no-session-persistence \
  --setting-sources "" --settings '{}' \
  --strict-mcp-config --mcp-config '{"mcpServers":{}}' --no-chrome --max-turns 1

# 2. env-disable-overrides-usage-credits → 期待: disabled_by_env
CLAUDE_CODE_DISABLE_FAST_MODE=1 claude -p "/fast" --output-format json --no-session-persistence \
  --setting-sources "" --settings '{"fastMode":true}' \
  --strict-mcp-config --mcp-config '{"mcpServers":{}}' --no-chrome --max-turns 1

# 3. model-not-allowed-overrides-usage-credits → 期待: model_not_allowed
claude -p "/fast" --output-format json --no-session-persistence \
  --setting-sources "" --settings '{"fastMode":true,"availableModels":["sonnet"]}' \
  --strict-mcp-config --mcp-config '{"mcpServers":{}}' --no-chrome --max-turns 1

# 4. per-session-optin-hidden-by-usage-credits → 期待: extra_usage_disabled
claude -p "/fast" --output-format json --no-session-persistence \
  --setting-sources "" --settings '{"fastMode":true,"fastModePerSessionOptIn":true}' \
  --strict-mcp-config --mcp-config '{"mcpServers":{}}' --no-chrome --max-turns 1

# 5. org-skip-check-no-effect-without-optin → 期待: sdk_opt_in_required(変化なし)
CLAUDE_CODE_SKIP_FAST_MODE_ORG_CHECK=1 claude -p "/fast" --output-format json --no-session-persistence \
  --setting-sources "" --settings '{}' \
  --strict-mcp-config --mcp-config '{"mcpServers":{}}' --no-chrome --max-turns 1
```

いずれも `--settings` の値は各ケースの `claude-fastmode-wrapper.mjs` の `CASES` テーブルと `case-result.json.settings_applied` に記録された値そのままで、環境変数はケース2・5だけがコマンド先頭に付与しています。

## この結果からの実務マッピング

- `sdk_opt_in_required` が出た: `-p` の `--settings` に `"fastMode": true` を明示していないのが原因。対話モードの `/fast` でfastMode設定を保存済みでも、`-p` には別途 `--settings` での指定が要る。
- `disabled_by_env` が出た: usage creditsやモデル許可リストを疑う前に、まず `CLAUDE_CODE_DISABLE_FAST_MODE` がセットされていないか確認する。CI環境でこの変数が紛れ込んでいると、他の設定が正しくてもFast modeは有効にならない。
- `model_not_allowed` が出た: usage creditsを調べる前に `availableModels` にOpusが含まれているかを直す。
- `extra_usage_disabled` が出た(`fastModePerSessionOptIn:true` を設定していても): `-p` のJSON出力だけではper-session opt-in固有の状態は診断できないので、usage creditsの有効化状況を直接確認する。
- `CLAUDE_CODE_SKIP_FAST_MODE_ORG_CHECK=1` は、`--settings` の `fastMode:true` opt-inの代わりにはならない。

## 限界と一般化できない範囲

- 各ケースはサンプル数1回のみで、断続的・非決定的なバックエンド挙動を今回の記録から排除することはできません。
- 検証したのは `-p` ヘッドレスパスのみ、1台のマシン、1つのサブスクリプションアカウント、usage creditsを意図的に無効化した状態のみです。usage creditsを有効にした状態、他のプランティア、対話UIパスでの挙動は未検証です。
- `fastModePerSessionOptIn` に関する結果は「usage credits無効という条件下では区別できない」ことのみを示しており、「あらゆるアカウント状態で区別できない」という一般化はできません(usage credits有効時のテストは行っていません)。
- `fast_mode_disabled_reason` というフィールド名自体とその値は、ドキュメント化されていないClaude Codeの実装詳細であり、将来のリリースで予告なく変わる可能性があります。
- この優先順位が公式に保証された仕様であるとは主張できません。あくまで v2.1.270 での単一時点・単一アカウントの観測です。

## 検証環境

- Claude Code: `2.1.270 (Claude Code)`
- 検証日: 2026-09-24
- 認証: サブスクリプション、usage credits無効
- 各ケースはサンプル数1回のみの実行
- コマンドの `--no-session-persistence --setting-sources "" --strict-mcp-config --mcp-config '{"mcpServers":{}}' --no-chrome --max-turns 1` は、他のセッション設定やMCPサーバー、対話的ツール実行の影響を排除して条件を揃えるためのもの
- ネットワーク設定 `false` はサンドボックス側の強制であり、Claudeホストプロセス自体をOSレベルで隔離するものではない
- バージョンの鮮度: 検証日の2026-09-24時点で、実測に使った v2.1.270 より新しい v2.1.274(2026-09-17)・v2.1.277(2026-09-18)・v2.1.280(2026-09-22)がすでにリリースされていました。うち v2.1.277 は `/fast` の保存不具合修正であり、`sdk_opt_in_required` の判定(`/fast` で対話的に保存した設定が `-p` に反映されるかどうか)と隣接する変更です。本記事はこの3リリースでの再検証は行っておらず、上記の優先順位は v2.1.270 時点の観測として読んでください。

## 参考

- Claude Code Docs, "Speed up responses with fast mode": https://code.claude.com/docs/en/fast-mode
