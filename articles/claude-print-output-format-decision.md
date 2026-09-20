---
title: "claude -p を自動化に組み込むとき、text・json・stream-jsonのどれを選ぶか"
emoji: "🔀"
type: tech
topics: ["claudecode", "cli", "automation", "bash", "aiagent"]
published: true
---

## この記事でできるようになること

`claude -p "プロンプト"` は一度使ったことがあるけれど、npm scriptsやCIのステップからその出力をコードで読み取ったことはない、という人を対象にします。

`claude -p` には `--output-format` というオプションがあり、値を `text` / `json` / `stream-json` のどれにするかで返ってくるものが変わります。この記事を読むと、次の判断ができるようになります。

- スクリプトが最終的なテキストしか使わないなら、何も付けなくていい
- コストや、あとで会話を再開するためのセッションID（`--resume` に渡すID）をログに残したいなら、何を付ければいいか（用語は次の章で説明します）
- 進行中のイベントを1行ずつ処理したいなら、何を付ければいいか、そして付け忘れると何が起きるか

検証日は2026年9月15日、使用したCLIは `claude 2.1.270 (Claude Code)` です。プロンプトは共通で `"Say hi in 2 words"`、`--print`（`-p`）モードで実行しています。

なお、この記事の実測は検証用ハーネスから `--no-session-persistence --max-turns 3` を追加した状態で実行しています。これはセッションを使い捨てにし、エージェントのターン数の上限を決めておくための検証用の設定で、以下で示す各フォーマットの出力内容やキーの有無を変えるものではないため、本文のコマンド例では省略しています。

## 3つのフォーマットの違いを1つずつ確認する

### text（何も指定しない場合と同じ）

```bash
claude -p "Say hi in 2 words" --output-format text
```

このケースでは、標準出力はプレーンテキスト1行だけで（実測: 空白を除いた文字数9、改行を含む非空行は1行）、JSONとしてパースできる形にはなっていませんでした。終了コードは0です。

「最終的な返答の文字列だけをそのままログに出したい、あるいは変数に入れたい」というスクリプトなら、`--output-format` を付けない、またはこの `text` を指定するだけで十分だと分かります。追加のパース処理は不要です。

### json（1つのJSONオブジェクトで返す）

```bash
claude -p "Say hi in 2 words" --output-format json
```

こちらは標準出力全体が1つのJSONオブジェクトになっていました。今回実際に観測できたキーは次のとおりです（値は実行のたびに変わるため、キー名だけを載せます）。

```json
{
  "type": "...",
  "subtype": "...",
  "is_error": false,
  "session_id": "...",
  "result": "...",
  "total_cost_usd": 0.0,
  "usage": { "...": "..." }
}
```

コストを記録したい・セッションIDを保存して後で `--resume` したい、という用途にはこの `json` が必要な情報を持っています。CLIのバージョンによっては `modelUsage` や `duration_ms` など上記以外のキーも含まれていましたが、`session_id` / `total_cost_usd` / `usage` / `result` の4つは今回のプロンプトで安定して確認できました。

この形なら `jq` でそのまま値を取り出せます。`jq` はJSONを扱うための別のコマンドラインツールで、OSに標準では入っていないため、`brew install jq`（macOS）や `apt install jq`（Ubuntu系）などで別途インストールしておく必要があります。

```bash
claude -p "Say hi in 2 words" --output-format json | jq -r '.result, .session_id, .total_cost_usd'
```

### stream-json（進行中のイベントを1行ずつ返す。ただし --verbose が必須）

ここが今回いちばん重要な確認です。まず `--verbose` を付けずに試すとどうなるかを見ます。

```bash
claude -p "Say hi in 2 words" --output-format stream-json
```

標準出力は空、標準エラーには次の1行だけが出て、**終了コードは1**でした。

```
Error: When using --print, --output-format=stream-json requires --verbose
```

つまり `stream-json` は単独では動かず、`--verbose` が必須です。ここで注意が必要なのは終了コードです。「エラーなら終了コードが0以外になるはず」と考えて `$? -ne 0` だけで検知しようとすると、たまたま今回のように非0で終わる分には問題ありませんが、この振る舞いを別のプロンプトやCLIバージョンでも常に非0だと決めつけるのは早すぎます。この記事の検証は1回だけなので、「毎回必ずこの終了コードになる」とは言えません。確実に検知したいなら、**終了コードではなく、標準エラーに `requires --verbose` という文字列が含まれているか、または標準出力が空かどうか**で判定するほうが、今回観測した事実に対して安全な書き方です。

`--verbose` を付けると、想定どおり動きます。

```bash
claude -p "Say hi in 2 words" --output-format stream-json --verbose
```

標準出力は複数行のNDJSON（1行に1つのJSONオブジェクト、行区切り）で、今回は6行返ってきました。各行の `type` フィールドを順に並べると次のとおりです。

```
system
system
system
rate_limit_event
assistant
result
```

最後の行は必ず `type: "result"` で、この行の中身は先ほどの `json` モードの出力と同じように `session_id` や `total_cost_usd` を含んでいます。つまり「最後の行だけ拾えば `json` モードと同じ情報が手に入る」という扱い方ができます。

一方で、`system` が1回・`assistant` が1回・`result` が1回という単純な3行構成を期待していると、今回のように `system` が複数回や `rate_limit_event` が挟まるケースで行数が合わず戸惑うかもしれません。行数を決め打ちにせず、「`type` を見て `result` が来るまで読み進める」という実装にしておくほうが、今回観測した範囲では安全です。

## 目的別の判断表

| やりたいこと | 付けるオプション | 補足 |
|---|---|---|
| 最終テキストだけ使う | 何も付けない、または `--output-format text` | 追加パース不要 |
| コスト・セッションIDも記録する | `--output-format json` | `jq '.result, .session_id, .total_cost_usd'` で取り出せる |
| 進行中のイベントを1行ずつ処理する | `--output-format stream-json --verbose` | `--verbose` を忘れると失敗する。最後の`result`行を`json`モードと同様に扱える |

`stream-json` を使う場合の失敗検知は、終了コードではなく標準エラー文字列（`requires --verbose`）または標準出力が空であることを見る、というのがこの記事の実測に基づく判断です。

## この記事の検証範囲

- 各フォーマットにつき1回ずつの実行結果です。複数回実行した場合の再現性（特に `stream-json` 未指定時の終了コード）は確認していません。
- モデルやeffortの指定はせず、アカウントのデフォルト設定のまま実行しています。
- `stream-json --verbose` のイベント行数・種類は、他のプロンプトやツール呼び出しを伴うやり取りでは変わる可能性があります。

## まとめ

- 最終テキストだけでいいなら `text`（デフォルト）
- コスト・セッションIDが要るなら `json`、`jq` で該当フィールドを抜き出す
- 進行中のイベントを段階的に扱いたいなら `stream-json --verbose`（`--verbose` を忘れると `--print` 使用時は失敗する）
- `stream-json` の失敗検知は終了コードに頼らず、標準エラーの文字列か標準出力の有無で判定する
