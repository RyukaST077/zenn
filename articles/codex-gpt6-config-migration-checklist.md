---
title: "Codex CLIでGPT-6 Sol/Lunaへ切り替える前にconfig.tomlで点検すべき3箇所"
emoji: "🧭"
type: "tech"
topics: ["cli", "codex", "aiagent", "ai"]
published: false
---

## この記事の結論

Codex CLIをChatGPTサブスクリプション認証(APIキーなし)で使っていて、`config.toml`の`profile`にGPT-5.6世代(Sol/Terra/Luna)の`model`・`model_reasoning_effort`を書いている人向けです。

手元のconfig.tomlをGPT-6 Sol/Lunaへ今切り替えてよいか、退役までに直す必要がある箇所はどこかを、自分の設定を見比べるだけで判断できるようにするのがこの記事の目的です。

2026-09-25時点でCodex CLI 0.156.1(ChatGPTサブスクリプション認証)に対し、`echo RAN > marker.txt`だけを実行させる使い捨てターンを5パターンの`model`/`model_reasoning_effort`組み合わせで走らせた結果、次のことが分かりました。

- **`gpt-6-terra`を指定したprofileは明確なエラーで拒否される**。ターン開始前に`400 invalid_request_error`が返り、何も実行されない。
- **`gpt-6-luna` + `model_reasoning_effort = "ultra"`(公式には非対応の組み合わせ)は、CLIが無言で受理してターンを完走させる**。警告もエラーも出ない。
- **`gpt-6-astra`(公式にはAPI専用と説明されているモデル)も、CLIが無言で受理してターンを完走させる**。
- 既存の`gpt-5.6-sol`指定、および新設された`model_reasoning_effort = "xhigh"`を付けた`gpt-6-sol`指定は、どちらも変更なしで通る。

つまり、公式モデルページに書かれている「Lunaはultra非対応」「Astraは API専用」という制限は、**Codex CLI自体は強制していません**。CLIが黙って通してしまうため、「非対応と書いてあるからCLIが止めてくれるはず」という前提でconfig.tomlを移行すると、気づかないまま意図しないモデル/effortでターンが走ります。

## なぜこれが問題になるか

OpenAIの公式GPT-6 Sol/Lunaモデルページ(2026-09-22公開)は、モデルと`reasoning effort`の対応表を示しています。そこでは次のように非対称な仕様が説明されています(このモデルページの記述自体は一次情報であり、本記事ではローカルのCLI検証結果と分けて扱います)。

- `gpt-6-astra`はLow/Medium/High/Extra High(xhigh)/Max/Ultraに対応するが、API専用。
- `gpt-6-luna`はLow/Medium/High/Extra High(xhigh)/Maxのみに対応し、Ultra非対応。
- `gpt-5.6-terra`世代に相当するGPT-6モデルはモデルページのCLIコマンド/仕様表に存在しない。

しかしこのページは、「Codex CLI自体が、documentedに非対応な組み合わせを渡されたときにどう振る舞うか」までは説明していません。サイレントに縮退させるのか、そのまま実行するのか、拒否するのか——ここが今回のローカル検証で埋めたかった空白です。

## 検証したこと

Codex CLI 0.156.1に対し、`--ignore-user-config`を付けた`codex exec`で`--model`/`-c model_reasoning_effort=...`を直接渡し、「`echo RAN > marker.txt`以外のコマンドやツールを一切使わせない」制約付きプロンプトを1ターンだけ実行させるケースを5パターン走らせました(ChatGPTサブスクリプション認証、`--sandbox workspace-write`、`sandbox_workspace_write.network_access=false`、`--json`でイベントストリームを記録)。下記は各ケースの`command.json`に実際に記録された引数そのままです(`-C`はケースごとの作業ディレクトリ、`-o`はイベントストリームの出力先ファイル)。

```bash
codex -a never exec --ephemeral --ignore-user-config --ignore-rules \
  --sandbox workspace-write --skip-git-repo-check \
  -C <case-workspace> \
  -c sandbox_workspace_write.network_access=false --json \
  -o <result-file> \
  --model <model> [-c model_reasoning_effort="<effort>"] \
  "Run exactly one command: \`echo RAN > marker.txt\`. Do not run any other command, do not use any other tool, and do not read, create, or modify any other file."
```

自分の手元で再現する場合は、上記の制約文をそのままプロンプトとして渡してください。`"echo RAN > marker.txt"`のような素のコマンド文字列だけを渡すと、モデルが他のツール呼び出しを挟む余地が生まれ、今回の検証(`luna-ultra-boundary`/`astra-scope-boundary`/`command.json`ほか全5ケース)と同じ条件になりません。

`marker.txt`が作成されターンが正常完了したかどうか、そして`--json`のイベントストリームに警告やエラーが出たかどうかを、5ケースそれぞれで記録しました。

## チェックリスト:5つの検証項目とその結果

移行前後のconfig.toml diff(model・model_reasoning_effort・profile定義)と、Terra指定・Lunaでのultra指定・退役済み/退役予定モデル指定の有無で自分の設定が影響を受けるか判定するチェックリスト表は次のとおりです。

| # | 確認項目 | 観測結果 |
|---|---|---|
| 1 | `model = "gpt-6-terra"`を指定したprofileでcodex execを起動し、GPT-6に存在しないTerra階層が明示的なエラーになるか無言フォールバックするかを確認する | **明示的なエラーになる**。ターン開始直後に`item.completed`型の`error`アイテムで`"Model metadata for \`gpt-6-terra\` not found. Defaulting to fallback metadata..."`が記録され、続けて`turn.failed`として`{"status":400,"error":{"type":"invalid_request_error","message":"The 'gpt-6-terra' model is not supported when using Codex with a ChatGPT account."}}`が返る。`marker.txt`は作成されず、`agent_exit_code=1`。 |
| 2 | `model = "gpt-6-luna"` + `model_reasoning_effort = "ultra"`(公式非対応の組み合わせ)を指定したprofileが、ターン消費前のconfig検証で拒否されるかターン消費後のAPIエラーになるかを確認する | **どちらでもない。無言で受理されターンが完走する**。`events.jsonl`に警告・エラーアイテムは1件もなく、`agent_message`→`command_execution`(`exit_code:0`)→`agent_message`の3アイテムだけの正常なターン。`marker.txt`が`RAN`で作成され、`agent_exit_code=0`。 |
| 3 | 既存の`model = "gpt-5.6-sol"`を指定したprofileが、GPT-6公開後の現行バージョンでも変更なしに起動できるかを確認し、即時の書き換えが不要な猶予期間が実在するか確かめる | **変更なしで起動できる**。正常な3アイテムのターンで`marker.txt`が`RAN`、`agent_exit_code=0`。既存profileを即座に書き換える必要はない。 |
| 4 | `model = "gpt-6-sol"` + `model_reasoning_effort = "xhigh"`(新設の効果水準)を指定したprofileがconfig検証を通るかを確認し、旧effort語彙前提の自作バリデーションが新しい値を誤って弾かないか点検する | **通る**。正常な3アイテムのターンで`marker.txt`が`RAN`、`agent_exit_code=0`。`xhigh`という新しいeffort語彙をCLI側は問題なく受理する。 |
| 5 | Codex CLI(サブスクリプション認証)のモデル選択経路に`gpt-6-astra`が選択肢として現れるか確認し、API専用のAstraとCodex/ChatGPT提供のSol/Lunaの対象範囲の境界を実際のCLI挙動で確定する | **`gpt-6-astra`も無言で受理されターンが完走する**。`gpt-6-luna`+`ultra`と同じく警告・エラーなしの3アイテムの正常なターン。`marker.txt`が`RAN`、`agent_exit_code=0`。公式に「API専用」と説明されている境界は、この認証方式のCLI層では観測できなかった。 |

5項目のうち、事前に立てた「ターンが始まらない」という予想が的中したのは項目1(`gpt-6-terra`)だけです。項目2・5(`gpt-6-luna`+`ultra`、`gpt-6-astra`)は逆に「CLIが受理しターンが走る」という、事前に想定していたもう一方の可能性の側に倒れました。項目3・4はどちらも「無変更で通る」という予想どおりでした。

## 解釈:何が言えて、何が言えないか

- `gpt-6-luna`+`ultra`と`gpt-6-astra`のどちらのイベントストリームにも、`gpt-6-terra`で出た「モデルメタデータが見つからない」という警告が一切出ていません。これはCLIがこの2つのモデルIDをメタデータとして認識していることを示唆しますが、それだけでは「本当にそのモデル/effortの組み合わせがサーバー側で正式に受理されている」のか「CLIが未対応のeffort値を黙って別の値にクランプし、有効なモデルの下でターンを走らせている」のかは区別できません。どちらの解釈でも「ターンが始まらない」という事前予想は否定されるため、記事の結論(=CLIはこの2件を拒否しない)には影響しません。
- `marker.txt`の有無とイベントストリームの内容だけでは、実際にどのバックエンドモデルがターンを処理したかまでは特定できません。「`gpt-6-luna`+`ultra`で本当にUltra相当の推論が行われた」という主張はできず、言えるのは「CLIが引数を受理し、コマンドが正常終了した」ことだけです。

## 実務への影響:CIリンタやチェックリストに落とし込むときの注意

「Lunaはultra非対応」「Astraは API専用」という公式ページの記載を、そのままCIの設定リンタや自分の頭の中のメンタルモデルに「CLIが止めてくれるはず」として組み込むと、少なくともこの2パターンについては誤りです。実行結果は次のように整理できます。

- `gpt-6-terra`のような**退役済み/存在しないモデルID**を指定したprofileは、書き換えるかprofileごと削除する。CLIが明確な理由付きで拒否してくれるので、気づかずに残っていても実害は小さい。
- `gpt-6-luna`+`ultra`や`gpt-6-astra`のような**公式ドキュメント上は非対応/対象外の組み合わせ**は、CLIが黙って通してしまう前提で、profileに残っていないか個別に確認する。「ドキュメントに非対応と書いてあるから安全」という考え方はここでは通用しない。
- `gpt-5.6-sol`のような既存profileと、`xhigh`のような新設effort語彙を使った`gpt-6-sol`は、そのまま使い続けて問題ない。

## 決定ルール

config.tomlの`profile`をGPT-6 Sol/Lunaへ移行する際は、公式モデルページのモデル/effort対応表を「CLIが強制してくれる制約」だと思わないでください。本当に存在しない/退役したモデルIDだけが、明確な拒否という形でCLI側から教えてもらえます。それ以外の組み合わせ(非対応のeffort、対象外のモデル)を安全に判定する唯一の方法は、上記の使い捨て1コマンドターンを`--json`付きで実行し、イベントストリームに「モデルメタデータが見つからない」警告や`turn.failed`エラーが出るかどうかを目視で確認することです。沈黙は「正しく動いている」ことの証拠にはなりません。

## 再現条件と限界

- 検証日時: 2026-09-25T20:14:14Z〜20:15:52Z(1ケースあたり1回のみの実行、リトライなし)。
- CLI: `codex-cli 0.156.1`、ChatGPTサブスクリプション認証(APIキーなし)。他のCLIバージョンやAPIキー認証、Claudeでの挙動は未検証。
- `--ignore-user-config`を使い`--model`/`-c model_reasoning_effort=...`のCLIオプションとして直接値を渡しているため、これは値そのものの受理境界の検証であり、`config.toml`の`profile`テーブルのTOML構文レベルの互換性検証ではありません。
- 各ケースは1サンプルのみで、アカウント側のロールアウト状態や時間帯によって結果が変わる可能性は排除できていません。
- `marker.txt`が作成された4ケース(`gpt-6-luna`+`ultra`、`gpt-6-astra`、`gpt-5.6-sol`、`gpt-6-sol`+`xhigh`)は、どの具体的なバックエンドモデルが処理したかまでは判別できません。判別できるのは「CLIが引数を受理し、コマンドが正常終了した」という事実だけです。
