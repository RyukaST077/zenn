---
title: "Claude Codeの--permission-prompts noneは「何を拒否するか」ではなく「誰が拒否するか」を変える"
emoji: "🚧"
type: tech
topics: ["claudecode", "cli", "ci", "automation"]
published: false
---

`claude -p` をCIや無人のエージェントランナーに組み込もうとすると、権限プロンプトが必要なツール呼び出しでヘッドレスセッションがハングする、あるいは黙って失敗するという問題に当たります。これまでの回避策は `--permission-mode dontAsk` や `--allowedTools` によるアローリストでした。Claude Code 2.1.259で追加された `--permission-prompts none` はこの問題への新しい答えですが、既存のドキュメントには `--permission-mode` と組み合わせた具体例がありません。

検証の結論はこうです。**`--permission-prompts none` は、選んだ `--permission-mode` が本来プロンプトを出すはずだったツール呼び出しだけを自動拒否します。すでにそのモードが自動許可しているアクションを上書きすることはありません。** つまりこのフラグは「何が許可されるか」を決めず、「プロンプトが出るはずだった場面で誰が答えるか（人間ではなく自動拒否）」を決めます。CIでこの拒否を検知するには、終了コードではなく終端の `result` JSONの `permission_denials` 配列を見る必要があります。

## 検証条件

- Claude Code `2.1.259`、モデル `sonnet`（effort `low`）
- 固定プロンプト: 「`target.txt` に `PERMISSION_PROMPTS_PROBE` という内容だけを書き込め、他のツールは使うな」
- 起動オプションは `--permission-mode <mode> --permission-prompts none --output-format stream-json` で固定し、`<mode>` だけを2ケースで変える
- 検証日: 2026-09-04（実行ログのUTCタイムスタンプ `2026-09-03T20:09:09Z` はJST基準で2026-09-04。本記事の日付は他の証跡ファイル名と同じくJSTで統一）
- n=1/ケース。単一CLIバージョンでの結果であり、他バージョンや他ツール（`Write`以外）への一般化は主張しない

| ケース | `--permission-mode` | 期待される結果 |
|---|---|---|
| `default-mode-deny` | `default` | `Write` が自動拒否される |
| `acceptedits-mode-allow` | `acceptEdits` | `Write` が成功する |

## 結果: モードが許可していない書き込みは自動拒否される

`default` モードのケースでは、モデルが `Write` ツール呼び出しを発行した直後に `system`/`permission_denied` イベントが記録され、`decision_reason` は次の通りでした。

```
no approval surface in this session; permission request denied automatically
```

続くtool_resultは `is_error:true` でしたが、セッション自体は最後まで正常終了し、終端の `result` イベントは次の状態でした。

```json
{
  "permission_denials": [{"tool_name": "Write", "...": "..."}],
  "is_error": false,
  "subtype": "success"
}
```

ワークスペース側の確認（`case-result.json`）でも `file_created_in_workspace:false`、`file_content_matches:false`、`permission_denial_observed:true` と一致しており、`target.txt` は実際には作成されていません。

重要なのは、**プロセスの終了コードも `is_error` も、拒否されたケースと成功したケースで区別がつかない**という点です。両ケースとも `is_error:false`、エージェント終了コード0で正常終了しています。CIのスクリプトが終了コード頼みだと、書き込みがサイレントにスキップされたことに気づけません。

## 結果: モードがすでに許可しているアクションは通る

`acceptEdits` モードの同一ケースでは、同じ `Write` 呼び出しに対してtool_resultが次のように返り、拒否イベントは発生しませんでした。

```
File created successfully at: .../target.txt
```

終端の `result` は `permission_denials: []`。ワークスペース確認でも `file_created_in_workspace:true`、`file_content_matches:true`、`permission_denial_observed:false` と一致し、`target.txt` は指定した内容で実際に作成されていました。

つまり `--permission-prompts none` を付けても、`acceptEdits` がすでに許可している書き込みは変わらず実行されます。このフラグは「プロンプトが出るはずの場面」だけに作用し、モードの許可範囲そのものを狭めたり無効化したりはしません。

## CIで拒否を検知する具体的な方法

両ケースの結果から導ける、再現可能なアサーションは次の通りです。

1. `--permission-mode <mode> --permission-prompts none --output-format stream-json` で起動する
2. 終端の `result` JSONオブジェクトを読み、`permission_denials` を見る
   - 空でなければ、そのアクションはブロックされている。中の `tool_name`/`tool_input` で何が拒否されたか特定できる
3. `permission_denials` だけでなく、期待した副作用（ファイルが実際に作られたかなど）も併せて確認する
4. `is_error` や終了コードは拒否判定に使わない — 拒否時も成功時もどちらも `0`/`false` になる

```
permission_denials が空でない  → そのステップのファイル書き込み等は実行されていない。
                                  ダウンストリームの処理を信頼する前に、
                                  permission-mode やアローリストの設定を見直す。
permission_denials が空        → 設定通りにアクションが実行された。
  かつ期待したファイル/副作用がある   次のステップに進んで安全。
```

## 実務での判断ルール

CIステップ内のツールアクションをすべて自動許可したいなら、その許可範囲をすでにカバーする `--permission-mode` を選び（ファイル書き込みなら `acceptEdits` など）、設定漏れに対する安全網として `--permission-prompts none` を追加します。そのうえで `permission_denials.length === 0` と、期待した副作用が実際に発生したことの両方をアサートしてください。終了コードや `is_error` だけを信頼するのは避けるべきです。

## 検証していないこと

この結果は以下を主張しません。

- `default`/`acceptEdits` 以外の権限モード（`plan`、`auto`、`dontAsk`、`bypassPermissions` など）での挙動
- `Write` 以外のツールでの挙動
- `--permission-prompt-tool` などホスト側の承認インターフェースが設定されている場合の挙動
- `managedMcpServers` など管理ポリシーとの相互作用
- 実際の対話的ホストが同じプロンプトにどう答えたかとの比較
- セキュリティ/サンドボックス上の保証(この検証環境ではClaudeのホストプロセス自体はネットワーク・ファイルシステム分離されておらず、`network: false` 設定はランナー側のサンドボックスにのみ適用される)
- 2ケース間のコスト差(`$0.0457` 対 `$0.0083`)は本検証のターン数・キャッシュ状態による副産物であり、フラグの一般的なコスト特性としては扱わない

## まとめ

`--permission-prompts none` は、選んだ `--permission-mode` が本来プロンプトを要求していたはずのツール呼び出しだけを自動拒否に置き換えるフラグです。すでにモードが許可している操作には影響しません。ヘッドレスCIでこの挙動を安全に使うには、実行時に許可したい操作をカバーするモードとこのフラグを組み合わせ、終了コードではなく終端 `result` JSONの `permission_denials` フィールドと実際の副作用の両方をアサートしてください。
