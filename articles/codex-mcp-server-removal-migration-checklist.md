---
title: "codex mcp-serverが消えた後、Claude Codeとの配線をどう直すか"
emoji: "🔌"
type: tech
topics: ["claudecode", "codex", "cli", "aiagent"]
published: false
---

Codex CLIを `codex mcp-server` としてMCPサーバーに見立て、Claude Codeの `.mcp.json` に

```json
{ "command": "codex", "args": ["mcp-server"] }
```

のように登録していた人へ。Codex CLIを `0.154.0` 以降に上げた(または上げる予定の)瞬間、この配線は動かなくなります。しかも壊れ方が厄介で、はっきりしたエラーではなく、対話プロンプト待ちのように見える壊れ方をします。

結論から書きます。`codex mcp-server` は `0.154.0` で削除済みで、代わりに使うべきは統合先によって2つに分かれます。Claude Code統合なら公式プラグイン `openai/codex-plugin-cc`、自作クライアント統合なら `codex app-server proxy --sock <socketPath>` です。後者は今回、既存の `codex login` セッションのみ、追加のログインなしに動くことを実機で確認しました。

## この壊れ方を自分の環境で確認する

まず自分の `codex` が対象かどうかを見ます。

```
codex --version
# => codex-cli 0.157.1
```

GitHub Releasesでは `rust-v0.149.0`(2026-08-20)で `mcp-server` に非推奨警告が付き、`rust-v0.154.0`(2026-09-09、#42993)で完全に削除されています。手元のバージョンがこの境界以上なら対象です。`codex --help` の `Commands:` 一覧を見ても、`mcp`(外部MCPサーバーの管理、クライアント側)と `app-server`(実験的、サーバー/ブリッジ側)は載っていますが、`mcp-server` は載っていません。`codex mcp` は名前が似ていて紛らわしいですが、これは削除された `mcp-server` の代わりにはなりません。管理する対象の向きが逆(外部MCPサーバーをCodexから使う側)だからです。

次に、実際にどう壊れるかです。今回、以下の2つのコマンドを実機で確認しました。

```
codex mcp-server --help
# => exit 0, トップレベルの `codex --help` と同じ内容がそのまま出力される
```

専用のサブコマンドエラーにはならず、`--help` を指定したのにトップレベルヘルプにフォールバックします。ここですでに「あれ、想定と違う」となりますが、まだハングのようには見えません。次が本番です。

```
printf '{}' | codex mcp-server
# => exit 1, "Error: stdin is not a terminal"
```

`{}` というJSON-RPCらしき入力を渡しても、`mcp-server` という名前のサブコマンドとして処理されるのではなく、引数がまるごと対話プロンプトの入力として再解釈され、非対話環境なので「stdinが端末ではない」というエラーで落ちます。つまり「未知のサブコマンドです」という削除を名指しするエラーではなく、まったく別の機能(対話プロンプト受付)に飲み込まれる形で壊れます。Claude Code側からMCPサーバーとして起動しようとした場合、これはハングや原因不明の初期化失敗のように見えるはずで、「バージョン履歴を疑う」という発想に辿り着きにくいのがこの壊れ方の厄介さです。

毎回この2コマンドを手で打つ代わりに、自分の `.mcp.json`(や他のMCPクライアント設定ファイル)に古い配線が残っていないかは、次のgrepで機械的にチェックできます。

```bash
grep -n 'mcp-server' .mcp.json
```

ヒットした行が `"command": "codex"` とセットの `"args": ["mcp-server"]` になっていれば、今回確認した壊れ方の対象です(`mcp-server` という文字列自体はコメントなど無関係な箇所にも出現し得るので、ヒット行の前後は目視で確認してください)。

## どちらの後継に乗り換えるか

確認した2つの後継経路のうち、実機で配線まで検証できたのは自作クライアント向けの `app-server proxy` です。

```
codex app-server daemon start
# => {"status":"alreadyRunning","backend":"pid",...,
#     "socketPath":"$HOME/.codex/app-server-control/app-server-control.sock",
#     "cliVersion":"0.157.1","appServerVersion":"0.159.0"}
```

このJSONから `socketPath` を取り出し、それをそのまま次のコマンドに渡します。

```
codex app-server proxy --sock "$HOME/.codex/app-server-control/app-server-control.sock"
```

3秒間の監視ウィンドウでは、エラーも新規クレデンシャル要求も出さずにプロセスが生き続けることを確認しました。使っているのは既存の `codex login` セッションのみです。これで、`.mcp.json` 側の `command`/`args` を旧来の `codex mcp-server` から、この `daemon start` → `proxy --sock` の非対話ブリッジに置き換えれば、自作クライアント統合の配線は復旧します。`daemon start` は起動済みなら `alreadyRunning` を返すだけで副作用がないので(今回の実機確認どおり)、毎回の起動時に前段として呼んでおけば安全です。`.mcp.json` に落とし込むと次の形になります。

```json
{
  "command": "sh",
  "args": [
    "-c",
    "codex app-server daemon start >/dev/null && codex app-server proxy --sock \"$HOME/.codex/app-server-control/app-server-control.sock\""
  ]
}
```

このスニペットは「プロセスが起動しエラーなく生存する」ところまでを反映したものです。MCPクライアント側でのJSON-RPCハンドシェイクそのものまで通しで検証したわけではないので、自分のクライアントに組み込んだ後は実際に動くか確認してください。

Claude Code統合として使うなら、公式プラグイン `openai/codex-plugin-cc` が用意されています。README記載のインストール手順は次のスラッシュコマンド列です。

```
/plugin marketplace add openai/codex-plugin-cc
/plugin install codex@openai-codex
/reload-plugins
/codex:setup
```

ただしこちらは今回の検証では実機テストしておらず、リサーチ段階で確認した公開情報(README記載の、既存のChatGPTサブスクリプション認証のみで動作するという説明とこのコマンド列)に留まります。エンドツーエンドでインストールから初期化までを動かした事実はないため、「公式にそう案内されている」以上の裏付けとしては扱えません。

## 判定表

自分の設定がどちらに該当するかは、この順で見ます。

1. `codex --version` が `0.154.0` 以上か。未満なら今回確認した壊れ方はまだ起きていないはずですが、自分の環境で念のため確認してください。
2. `.mcp.json` などで `command: codex, args: [mcp-server]` になっていて、クライアントが「エラーは出ないが応答しない/ハングのように見える」なら、上で確認した `SILENT_REINTERPRETATION_NOT_HANG` の壊れ方と一致します。上の2コマンドを自分の環境でも実行して確認してください。
3. 統合先がClaude Codeなら `openai/codex-plugin-cc`(未検証、公式情報ベース)。
4. 統合先が自作クライアントやAgents SDK的な統合なら `codex app-server daemon start` → `codex app-server proxy --sock <socketPath>`(今回実機検証済み)。
5. 自分の設定が触っているのが `codex mcp`(外部MCPサーバー管理、クライアント側)だけなら、今回の削除とは無関係です。対応不要です。

## 検証条件と限界

- 検証日: 2026-09-29。`codex-cli 0.157.1`、`claude 2.1.284 (Claude Code)`。
- 3つのケースはいずれも1マシン・1サンプルの確認です。`0.149.0`(警告)と `0.154.0`(削除)という2つの境界点はGitHub Releasesの一次情報で、`0.149.0`〜`0.154.0`の間の挙動やこのマシン以外での挙動は未検証です。
- `app-server proxy` について確認したのは「プロセスが起動してエラーなく生存し、新規クレデンシャルを要求されない」ことまでで、JSON-RPCのハンドシェイクそのものを検証したわけではありません。プロトコルレベルで完全に疎通することの証明ではありません。
- `openai/codex-plugin-cc` のインストール〜初期化は今回ライブテストしていません。公式README由来の記載として扱ってください。
- 検証はいずれも `provider: claude` 実行下のもので、`network: false` 設定はCodexプロバイダのサンドボックスにのみ効くものであり、今回のようなClaudeホストプロセス自体のネットワーク隔離を意味しません。
- 生ログには本検証環境固有の `unsnooze` 関連の警告行が混ざっていますが、これは `codex` 自体の挙動ではなく、非対話シェル実行時にローカルの別ツールが出しているノイズです。他の環境で再現するものではありません。

## まとめ

`codex mcp-server` は `0.154.0` で削除済みで、壊れ方は「エラーで落ちる」ではなく「対話プロンプトへ静かにフォールバックする」形です。自分の `.mcp.json` がこの形で壊れているかは、`codex mcp-server --help` と `printf '{}' | codex mcp-server` の2コマンドで再現・確認できます。自作クライアント統合の後継としては `codex app-server daemon start` → `codex app-server proxy --sock <socketPath>` を今回実機で確認済みです。Claude Code統合としての `openai/codex-plugin-cc` は公式情報止まりなので、導入時は自分の手元で改めて動作確認してください。
