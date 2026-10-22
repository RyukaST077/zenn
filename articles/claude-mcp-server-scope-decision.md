---
title: "committedなenableAllProjectMcpServers: trueはworkspace trust未承認なら効かない"
emoji: "🔐"
type: "tech"
topics: ["claudecode", "mcp", "aiagent", "security", "cli"]
published: true
---

## 結論: 承認バイパスにはなっていない

チームで `.mcp.json` をコミットしてMCPサーバーを配ろうとしたとき、teammateの新規clone環境やCIのチェックアウトで `claude mcp get <name>` が `⏸ Pending approval (run 'claude' to approve)` のままになっていて、これがバグなのか設定ミスなのか分からず困ったことはないでしょうか。さらに、そこで「じゃあ `.claude/settings.json` に `enableAllProjectMcpServers: true` をコミットすれば直るのでは」と思ったとき、それは workspace trust そのものをバイパスしてしまう危険な設定なのかどうかも気になるはずです。

`claude` CLI `2.1.284`(サブスクリプション認証)で、この2つを1つの再現実験として確認しました。結論は次のとおりです。

**`enableAllProjectMcpServers: true` を `.claude/settings.json` にコミットしても安全です。この設定はworkspace trustのダイアログをそのプロジェクトで承認した後にしか効かず、trustを取り消せば再び承認待ちに戻ります。** trustを一度も承認していない新規cloneやCIのチェックアウトは、コミット済みのこの設定だけで未確認のMCPサーバーを自動実行されることはありません。

## スコープ×trustの決定表

再現実験の `outcome.json` に基づく6項目の結果です(すべて `true` = 観測どおり)。

| 確認項目 | 観測結果 |
|---|---|
| `--scope local` は登録元プロジェクトのパスに厳密に紐づき、兄弟プロジェクトからは見えないか | yes |
| `--scope user` は全プロジェクトから見えるか | yes |
| 新規の `--scope project`(`.mcp.json`)サーバーは、workspace trust未承認の間は承認待ちのままか | yes |
| 未trustのworkspaceでは、コミット済みの `enableAllProjectMcpServers: true` は無視されるか | yes |
| 同じ設定は、trust承認後には有効になるか | yes |
| trustを取り消すと、再び承認待ちに戻るか | yes |

この表は1回の決定的な再現実行(`verifier` exit code 0、期待マーカー `TRUST_GATE_HOLDS` と一致)から得たものです。事前に、対立する結果として「`TRUST_GATE_BYPASSED`(trust未承認でも設定が効いてしまう)」も候補として登録していましたが、これは発生しませんでした。

用途に対応させると、実務上の使い分けは次のようになります。

- パス固有の設定や個人の認証情報を含むサーバー → `local`
- 個人が全プロジェクトで使いたいサーバー → `user`
- チームで共有するサーバー → `project`(`.mcp.json`)+ `enableAllProjectMcpServers: true` をコミット。ただしこれは「各利用者が1回workspace trustダイアログを承認する」ことが引き続き必要で、trustを取り消した人には再び効かなくなる、という条件付きの安全さです。

## 検証条件

- 検証日: 2026-09-28
- CLI: `claude` `2.1.284 (Claude Code)`、ローカルのサブスクリプション認証セッション(APIキー・対話ログインなし)
- モデル指定なし(アカウントのデフォルトが解決される)
- 1ケース(`scope-trust-recipe`)を1回実行した単一サンプルの再現です。統計的な検証ではなく、決定的な状態遷移を1回確かめたケーススタディとして読んでください
- `proj-a` はtrust未承認の新規clone/CIチェックアウトの代役、`proj-b` は無関係な兄弟プロジェクトの代役です。どちらも `git init` はしていません(project-root検出に `.mcp.json` 以外の何かが必要かどうかは未検証です)
- スタブサーバーは `echo hello` で、実際に動作するMCPサーバーではありません。したがって確認できるのは承認ゲートの状態遷移(`Pending approval` → 承認/接続試行 → 再び `Pending approval`)までで、承認後にツール呼び出しが実際に成功するかどうかは検証していません

## 状態遷移の生ログ

`proj-a` に `.mcp.json` で `proj-srv` を登録し、`.claude/settings.json` に `{"enableAllProjectMcpServers": true}` をコミットした状態で、workspace trustの状態を切り替えながら `claude mcp get proj-srv` を実行した結果です。

`.claude/settings.json`:

```json
{"enableAllProjectMcpServers": true}
```

`.mcp.json`:

```json
{
  "mcpServers": {
    "proj-srv": {
      "type": "stdio",
      "command": "echo",
      "args": ["hello"],
      "env": {}
    }
  }
}
```

**未trust、かつ上記のbypass設定がコミット済みの状態**(`proja-get-untrusted-with-bypass.log`):

```
proj-srv:
  Scope: Project config (shared via .mcp.json)
  Status: ⏸ Pending approval (run `claude` to approve)
```

コミット済みの `enableAllProjectMcpServers: true` は無視され、承認待ちのまま変化しません。

**workspace trustを承認した直後**(`proja-get-trusted-with-bypass.log`):

```
proj-srv:
  Scope: Project config (shared via .mcp.json)
  Status: ✘ Failed to connect
  Issue: CONNECTION_CLOSED: Connection closed
```

ステータスが `Pending approval` から動き、実際に接続を試みるところまで進みました(`Failed to connect` はスタブサーバーが `echo hello` に過ぎないための想定内の失敗で、trustゲートの挙動そのものとは無関係です)。ここで重要なのは「承認待ちで止まっていたものが動き出した」という遷移そのもので、これが `bypassEffectiveAfterTrust: true` の根拠です。

**trustを取り消した後**(`proja-get-revoked-trust.log`):

```
proj-srv:
  Scope: Project config (shared via .mcp.json)
  Status: ⏸ Pending approval (run `claude` to approve)
```

再び承認待ちに戻ります。設定ファイル自体は変更していないので、この変化はworkspace trustの状態だけに連動しています。

## local / userスコープの可視範囲

同じ実行内で、`local` と `user` スコープの可視範囲も確認しています。

`local-srv` を `proj-a` で `--scope local` 登録した後:

- `proj-a` から `claude mcp list` → `local-srv: echo hello - ...`(見える)
- 兄弟の `proj-b` から `claude mcp list` → `No MCP servers configured.`(見えない)

`user-srv` を `--scope user` 登録した後:

- `proj-a` からも `proj-b` からも `user-srv: echo hello - ...` が見える

これは「パス固有の設定や個人のcredentialを含むサーバーは `local`、複数プロジェクトで使い回したい個人設定は `user`」という使い分けの根拠です。

## この記事が確認していないこと

- CLIバージョン `2.1.284` 以外での挙動。他バージョンやプラットフォームでの再現は未確認です
- 承認後にMCPサーバーが実際にツール呼び出しに応答するかどうか(スタブサーバーは接続に失敗するため対象外)
- `git init` していないディレクトリでの `.mcp.json` のプロジェクトルート検出への影響
- この実行のharness自体は `passed: false` を記録していますが、これは `fixture-home/.claude/backups/` 配下のバックアップファイルや `Library/Caches/claude-cli-nodejs/` 配下のMCPサーバーログなど、実CLIが内部的に書き込むキャッシュ/バックアップファイルがマニフェストの許可リストに含まれていなかったための「作業ディレクトリの衛生上の差分」であり、trustゲートの主張(`verify.mjs` の exit code 0、`outcome-marker.txt` = `TRUST_GATE_HOLDS`、`outcome.json` の6項目すべて `true`)自体を否定するものではありません

## 再現手順: 実行したコマンドと注意点

上記の状態遷移は、次の3つの `claude mcp add` コマンドで各スコープにサーバーを登録した後の状態です(`local-add.log` / `user-add.log` / `project-add.log` に対応)。

```bash
claude mcp add --scope local local-srv -- echo hello
claude mcp add --scope user user-srv -- echo hello
claude mcp add --scope project proj-srv -- echo hello
```

**注意: すでに起動しているClaude Codeセッションの中からこれらの `claude mcp` コマンドを実行しないでください。** 実行中のセッション(Bashツール経由も含む)は環境変数 `CLAUDECODE=1` を引き継いでおり、この状態で入れ子に `claude mcp add`/`list`/`get` を呼ぶと、実際のオンディスク設定に関係なくサーバーが登録されていないかのように誤報告されます。今回の再現実験でも、この汚染を避けるためスクリプト内のすべてのネストした呼び出しを `env -i HOME=<分離済みHOME> PATH="$PATH" USER=...` 経由で実行し、`CLAUDECODE` を含む継承環境を除去してから `claude` を起動しています。読者がこの手順をそのまま追試する場合は、アクティブなClaude Codeセッションの外側の通常のターミナルから実行するか、同様に `env -i` で環境を切り離してから実行してください。

## 採用チェックリスト

1. 新しいMCPサーバーをどう配りたいかで登録スコープを選ぶ(パス固有/credential入り → `local`、個人が全プロジェクトで使う → `user`、チーム共有 → `project`)
2. チーム共有サーバーは `.mcp.json` をコミットし、必要なら `.claude/settings.json` に `enableAllProjectMcpServers: true` も一緒にコミットしてよい。これはworkspace trustのバイパスにはならない
3. teammateやCIで `claude mcp get <name>` が `Pending approval` のままなら、まずそのworkspaceでtrustダイアログを承認済みかどうかを確認する。設定ファイルの書き方の問題ではなく、trust側の状態が原因であることが多い
4. trustを取り消すと同じサーバーが再び `Pending approval` に戻ることを踏まえ、「なぜか急にMCPサーバーが動かなくなった」ときの切り分けにもtrust状態の確認を含める
