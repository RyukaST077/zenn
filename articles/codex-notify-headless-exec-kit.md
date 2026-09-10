---
title: "codex execの完了をnotifyで検知する: 効く設定・効かない設定"
emoji: "🔔"
type: "tech"
topics: ["cli", "aiagent", "ai", "automation"]
published: false
---

## この記事でできるようになること

CIジョブやシェルスクリプトから `codex exec`(非対話モードのCodex CLI)を呼び出しているなら、実行が終わったタイミングを検知して次の処理(Slack通知、ログ記録、後続コマンドの起動など)につなげたいことがあります。標準出力をポーリングしたりJSONLを逐次パースしたりしなくても、Codex CLIには実行完了時に任意のコマンドを起動する `notify` という仕組みがあります。

ただし、`notify` の話としてよく見かける説明は「対話モードでデスクトップ通知や音を鳴らす」用途が中心で、`codex exec` のような非対話実行でも同じように発火するのか、どこに設定を書けば有効になるのかは書かれていないことが多いです。この記事では、実際に認証済みのCodex CLI(`codex-cli 0.153.4`)で `codex exec` を動かし、次の2点を確認した結果を示します。

- `-c notify=[...]` を `codex exec` のコマンドラインに直接付けると、完了後にnotifyコマンドが起動し、`type` や `last-assistant-message` を含むJSONペイロードを受け取れる
- 同じ `notify` 設定をプロジェクト直下の `.codex/config.toml` に書くだけでは、`codex exec` では発火しない

読み終えると、自分のCI/自動化スクリプトに「コピペで動く」notify設定を追加でき、なぜプロジェクト設定に書くだけでは動かないのかを理解できます。

## 前提知識

この記事は、シェルスクリプトやCIジョブから `codex exec` を実行したことがあり、TOML形式の設定ファイルを編集したり、CLIに `-c key=value` 形式のオプションを渡したりしたことがある人を想定しています。Codexの内部的なイベントストリーム形式を知っている必要はありません。

## `notify` とは何か

`notify` は、Codex CLIが1回のターン(1回のやり取り)を終えたときに起動する外部コマンドを指定する設定です。設定に書いたコマンドが、完了情報を含むJSON文字列を引数として渡された状態で実行されます。対話モードでは、これを使ってデスクトップ通知や音を鳴らす使い方が一般的です。

今回確認したいのは、この仕組みが `codex exec`(非対話・スクリプト向けの実行モード)でも同じように働くか、という点です。

## 動作確認1: `-c notify=[...]` を付けて`codex exec`を実行する

### 用意するもの

notifyコマンドとして、受け取ったJSONペイロードをファイルに書き出すだけの2引数スクリプトを用意します。

`notify-record.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
if [ "$#" -ne 2 ]; then
  echo "usage: notify-record.sh <output-file> <payload-json>" >&2
  exit 2
fi
output_file="$1"
payload="$2"
printf '%s\n' "$payload" > "$output_file"
```

このスクリプトに実行権限を付けておきます(`chmod +x notify-record.sh`)。

### 実行するコマンド

作業ディレクトリで、`codex exec` のコマンドラインに `-c notify=[...]` を追加して実行します。

```bash
codex exec \
  -c notify='["bash","/path/to/notify-record.sh","/path/to/notify-payload.txt"]' \
  "Reply with exactly the text DONE."
```

`notify` の値は「起動するコマンドと、それに渡す固定の引数」を並べた配列です。ここでは `bash notify-record.sh notify-payload.txt` を、Codex側が用意する追加の1引数(JSONペイロード)付きで実行させています。

### 得られた結果

実行後、`notify-payload.txt` に次の内容が書き出されました(実際の検証記録 `work/notify-headless-live-fires/case-a-result.json` より、値の一部は当該実行環境のもの)。

```json
{
  "type": "agent-turn-complete",
  "thread-id": "01a08937-6e0b-75f1-8403-15cbabb8a2cc",
  "turn-id": "01a08937-724a-72f3-976e-e043d6d82ef2",
  "cwd": "/path/to/workdir",
  "client": "codex_exec",
  "input-messages": ["Reply with exactly the text DONE. ..."],
  "last-assistant-message": "DONE"
}
```

`type`・`thread-id`・`turn-id`・`cwd`・`last-assistant-message` の5つのフィールドはすべて空でない文字列として存在していました。つまり `codex exec` は `notify` に対応しており、ペイロードには「どのターンが」「どのディレクトリで」「最後に何を返して」終わったかが含まれます。`client: "codex_exec"` のように、5フィールド以外の追加情報が入ることもありますが、上記5フィールドは確実に読み取れると判断できます。

この結果を自分のタスクに当てはめる場合、`notify-record.sh` の中身を、Slack Webhookへのcurlやログファイルへの追記など、実際にやりたい処理に差し替えます。仕組み(`-c notify=["bash","<script>", ...]` という付け方と、スクリプトが2引数目でJSONを受け取ること)はそのまま使えます。

## 動作確認2: プロジェクトの`.codex/config.toml`に書くだけでは動かない

コマンドラインに毎回 `-c notify=[...]` を書くのは面倒なので、「プロジェクト直下の `.codex/config.toml` に書いておけば良いのでは」と考えるのは自然です。これを確認しました。

### 試したこと

プロジェクトの `.codex/config.toml` に次のように書き、コマンドラインには `-c notify=[...]` を付けずに `codex exec` を実行しました。

```toml
notify = ["bash", "/path/to/notify-record.sh", "/path/to/notify-payload.txt"]
```

### 結果

`notify-payload.txt` は作成されませんでした(検証記録 `work/notify-scope-boundary/case-b-result.json` の `project_scope.fired: false`)。つまり、同じ `notify` 設定でも、書く場所が「コマンドラインの `-c` オプション」か「プロジェクトの `.codex/config.toml`」かで挙動が変わり、後者では `codex exec` 実行時に発火しません。

さらに、`notify` を外して `.codex/config.toml` に `[tui]` セクションの通知設定(`notifications` / `notification_method`)だけを書いた場合も同様に、notifyスクリプトは起動されませんでした(同じ記録の `tui_only.fired: false`)。`[tui]` の通知設定と `notify` は別の独立した仕組みであり、`[tui]` 側を設定しても `notify` の代わりにはなりません。

### なぜこうなるのか、覚えておくべきこと

この2つの確認から言えるのは、`codex exec` で完了通知を確実に飛ばしたいなら、`notify` はプロジェクトにコミットする設定ファイルではなく、実行するコマンドライン(またはCI側で組み立てるコマンド)自体に `-c notify=[...]` として渡す必要がある、ということです。プロジェクト設定に書いて「動くはず」と思っていると、実際には何も起動されず気づきにくい失敗になります。もし手元で `notify` を設定したのに何も起動されない場合、まず「プロジェクトの `.codex/config.toml` だけに書いていないか」を疑うとよいです。

## まとめ: 使うときの判断ルール

- CIやスクリプトから `codex exec` の完了を検知したい場合は、`-c notify=["bash","<script>", "<引数>", ...]` を実行コマンドに直接付ける。
- `.codex/config.toml` (プロジェクト直下)に `notify` を書くだけでは `codex exec` では発火しない。コミットして共有したい場合でも、実行側(CIジョブの定義やラッパースクリプト)で `-c notify=[...]` を組み立てて渡す必要がある。
- `[tui]` の通知設定は `notify` とは別物で、`codex exec` の完了検知には使えない。

## この検証の範囲と限界

- 確認したのは `codex-cli 0.153.4` での挙動です。他のバージョンでの挙動は未確認です。
- 確認したのは `codex exec`(非対話)のみです。対話モード(TUI)でのペイロード内容についてはこの記事では検証していません。
- 各ケースは1回ずつの実行結果です。複数回実行した際の再現性(たまたま発火しない、といったばらつき)までは確認していません。
- 実行はネットワークアクセスを無効化したワークスペース内サンドボックス(`sandbox_workspace_write.network_access=false`)で行いました。これはモデル自身のツール呼び出しに対する制限であり、認証済みCLIがCodexのコントロールプレーンと通信すること自体を止めるものではありません。

## 参考: 実行環境

- Codex CLI: `codex-cli 0.153.4`(認証済み)
- 実行モード: `codex exec`(非対話)、モデル・推論強度のオーバーライドなし(アカウントのCLIデフォルトを使用)
- 検証日: 2026-09-10
