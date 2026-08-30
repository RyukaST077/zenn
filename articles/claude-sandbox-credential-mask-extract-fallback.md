---
title: "Claude Codeのsandbox credential mask、extractが不一致だと平文が漏れる"
emoji: "🔓"
type: tech
topics: ["claudecode", "aiagent", "sandbox", "security"]
published: true
---

`sandbox.enabled: true` のBash sandboxを有効にし、`sandbox.credentials.envVars`に`mode: "mask"`と`extract`正規表現を設定して、構造化されたsecret（例えば`DATABASE_URL`）をClaudeのcontextやtranscriptに渡さないようにしている場合を考えます。公式ドキュメントには、`extract`パターンが値にマッチしなかった場合のfallbackとして`onExtractNoMatch`が既定で`"warn"`になり、「変数をunmaskedのまま通す("passes the variable through unmasked")」と1行だけ書かれています。しかしこれがsandboxed commandの視点から実際どう見えるかの実例はなく、保護対象のツール自体は`extract`が壊れていても壊れていなくても正常に動き続けるため、通常のテストでは検知できません。

Claude Code 2.1.247 (macOS) で3ケースを各1回実行して確かめたところ、`onExtractNoMatch`を明示しない既定状態でマッチしない`extract`を使うと、secretの**全文がそのまま**sandboxed Bashコマンドのstdout、つまりClaudeのtranscriptに現れました。これはfail-closedではなくfail-openです。`extract`の正規表現に書式ドリフト（キャプチャグループのミス、エスケープ漏れ、secret側の書式変更など）が起きても、保護対象のツールは何ら変わらず動くため、運用中の通常利用では気づく手がかりがありません。

## 3ケースの設定と結果

検証日は2026-08-27、対象はClaude Code `2.1.247 (Claude Code)` (macOS)です。3ケースとも`sandbox: {"enabled": true, "allowUnsandboxedCommands": false, "network": {"allowedDomains": [], "strictAllowlist": true}, "filesystem": {"disabled": true}}`は共通で、`credentials.envVars`だけを変えています。プロンプトは全ケース同一で、Bashツールを1回だけ使って`echo "$FAKE_SECRET"`を実行させ、他の操作はしないという指示です。ダミー値は`postgres://user:dummy-marker-not-a-real-credential@host/db`という構造化secretを模した文字列です。

| ケース | `credentials.envVars`設定 | sandboxed commandのstdout | 検証結果 |
|---|---|---|---|
| `extract-nomatch-warn` | `extract: "user:([0-9]+)@"`（意図的に不一致）、`onExtractNoMatch`未指定 | ダミー値の全文（`dummy-marker-not-a-real-credential`含む） | verifier exit 0、marker `CREDENTIAL_MASK_WARN_UNMASKED_COMPLETED` |
| `extract-nomatch-deny` | 同じ不一致パターン、`onExtractNoMatch: "deny"` | 空文字列（stdout `""`） | verifier exit 1、marker未発行（後述） |
| `extract-match-mask` | `extract: "user:([^@]+)@"`（マッチする）、`onExtractNoMatch: "deny"` | `postgres://user:fake_value_982cc932-...@host/db`（prefix/suffixは元のまま、captureした部分だけ置換） | verifier exit 0、marker `CREDENTIAL_MASK_MATCH_MASKED_COMPLETED` |

`extract-nomatch-warn`では、sandboxed commandのstdout自体がダミー値をそのまま返しただけでなく、Claude Code自身がstderrに独立した診断を出していました。

```text
[sandbox-runtime] WARNING: credentials.envVars entry "FAKE_SECRET" has extract pattern ...
that matched nothing ... The variable is left UNPROTECTED (visible as-is inside the sandbox)
```

この警告はfixtureの判定ロジックが期待した文言ではなく、Claude Code自身が独自の言い回し（"UNPROTECTED"）で同じ機構を説明しているため、stdoutの生データとは独立した2つ目の裏付けになっています。3ケースとも、live Claudeプロセスはexit 0で、timeoutやsignal、stream overflowはなく、意図しない変更ファイルもありませんでした。

## `extract`が一致すればprefix/suffixを保ったまま置換される

対照群の`extract-match-mask`では、`extract`が実際のダミー値にマッチするパターンに変わっています。結果は`postgres://user:`というprefixと`@host/db`というsuffixがそのまま残り、キャプチャした部分だけが`fake_value_<uuid>`形式の合成トークンに置き換わっていました。ダミーマーカーの文字列は含まれていません。つまり`extract`が正しく機能する場合、maskはピンポイントに該当セグメントだけを潰し、周囲の構造は保持します。ただしこの`fake_value_<uuid>`という置換トークンの形式はドキュメントに明記された仕様ではなく、今回の1回の観測で確認できた実装の一例に過ぎません。将来のバージョンで変わる可能性があるため、固定フォーマットとして依存すべきではありません。

## `onExtractNoMatch: "deny"`は「確認できたが証明はできていない」

`extract-nomatch-deny`ケースは、Bash呼び出し自体は成功し、`tool_use_result.stdout`が空文字列で、モデル自身の最終応答も「コマンドは出力なしで完了した（変数は空/未設定だった）」という趣旨でした。`extract-nomatch-warn`で見られた"UNPROTECTED"警告も出ていません。生データだけを見れば、これは`onExtractNoMatch: "deny"`が変数をunsetする、というドキュメント通りの挙動と矛盾しません。

ただし、このケースのverifierはexit 1で終わり、事前登録した3つの観測パターン（`unmasked-full` / `unset-empty` / `masked-structured`）のどれにも分類されず`unregistered`という区分に落ちました。原因は今回使ったfixture wrapperの分類ロジックの側にあります。`observedValue = matchingResults[0].stdout || matchingResults[0].text`という式が、空文字列の`stdout`をJavaScriptのfalsy判定で読み飛ばし、代わりにClaude Codeが出す非空のプレースホルダーテキスト`"(Bash completed with no output)"`を採用してしまい、これが事前登録済みのどの形とも一致しなかったためです。これはharness側の評価バグであり、`deny`が機能しなかった証拠でも機能した証拠でもありません。したがって本記事では、`onExtractNoMatch: "deny"`が変数をunsetする挙動を「このrunのライブ証拠で独立に再現された」とは主張せず、ドキュメント記載の挙動として、今回の生データ（空stdout、UNPROTECTED警告なし）による裏付けがある、という位置づけに留めます。

## 判断基準

`extract`で構造化secretをmaskしていて、そのsecretの書式が将来変わりうる（キー形式の変更、フォーマット移行など）なら、`onExtractNoMatch`を未指定のまま`"warn"`任せにしないことです。明示的に`"deny"`か`"error"`を設定してください。`"warn"`のままだと、`extract`が壊れた瞬間に保護対象のツールは変わらず動き続け、secretの全文がClaudeのcontextとtranscriptに平文で入り込みますが、それに気づく通常の動作確認は存在しません。

## 適用範囲と再現条件

- この結果はClaude Code 2.1.247 (macOS)の1ホスト・各ケース1回のライブ実行に限定されます。他バージョン、Linux/WSL2、繰り返し試行のばらつきは未検証です。
- credential *file* masking、`decode`、`sigv4`（AWS再署名）、`onExtractNoMatch: "error"`は今回のrunで一切exerciseしていません。
- 全ケースのstderrに「TLS termination is unavailable ... sandboxed commands see only a sentinel value」という別種の警告が出ていますが、これは`sandbox.network.allowedDomains: []`でegress自体をブロックしている状況でも出ており、egress用proxyの話で、環境変数maskingの機構とは別物です。今回のrunだけでは「mask entryがあれば常に出る」のか「egressを試みてブロックされた場合に出る」のかを切り分けられません。

### 再現レシピ

`extract-nomatch-warn`で確認できた、fail-openなmaskを再現する設定は次の通りです（実際にマッチしない正規表現を使う場合）。

```json
{
  "sandbox": {
    "enabled": true,
    "credentials": {
      "envVars": [
        { "name": "<VAR>", "mode": "mask", "extract": "<実際の値にマッチしないキャプチャ付き正規表現>" }
      ]
    }
  }
}
```

`onExtractNoMatch`キー自体を書かないのがポイントです。これをCLIの`--settings`経由で渡し、`sandbox.enabled: true`とあわせて設定します。`extract`が実際に値にマッチするようにすれば、`extract-match-mask`と同じ「prefix/suffix保持・captureのみ置換」という結果が再現できます（ドキュメント引用: Anthropicのsandboxing referenceは`onExtractNoMatch`について、`"warn"`（既定）は「警告のうえ変数をunmaskedのまま通す」、`"deny"`は「sandbox内で変数をunsetする」、`"error"`は「設定を修正するまでsandboxのセットアップを止める」としています）。
