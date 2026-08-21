---
title: "Codex resume --ephemeralを終了コード0だけで信じない"
emoji: "🧪"
type: tech
topics: [codex, cli, aiagent, automation]
published: true
---

CIやバッチ処理でCodexのセッションを再開しつつ、その再開ターンはローカルのrolloutへ残したくない場合、`--ephemeral`が受理されて終了コード0になったことだけでは不十分です。

2026年8月14日、Codex CLI `0.147.0`で既存セッションを1回だけ`resume --ephemeral`したところ、コマンドは成功した一方、対象rolloutには`4,402`バイトが追記されました。したがって、ローカル非永続化が要件なら、この組み合わせは**版を固定し、同じrolloutの前後差分がゼロになることを確認してから使う**必要があります。

これは1バージョン・1ケースの検証です。すべての`--ephemeral`、新規セッション、別OS、別バージョンに一般化するものではありません。

## 症状：成功したresumeでもrolloutが増えた

OpenAIのCLIドキュメントは`--ephemeral`を、session rollout fileをディスクへ永続化せずに実行するためのオプションとして説明しています。また、非対話モードのガイドもrolloutを永続化したくない場合にこのオプションを案内しています。[^developer-commands] [^non-interactive]

しかし今回、通常の`codex exec`で作った1つの永続セッションに対し、同じsession IDを指定して`--ephemeral`付きで再開すると、次の結果になりました。

| 確認項目 | baseline完了後 | resume完了後 | 判定 |
| --- | ---: | ---: | --- |
| 子プロセス終了コード | `0` | `0` | 両方成功 |
| 対象rolloutのサイズ | `38,025` bytes | `42,427` bytes | `+4,402` bytes |
| 行数 | `14` | `23` | `+9` lines |
| resume用マーカー出現数 | `0` | `5` | 追記部分に5件 |
| SHA-256（短縮表示） | `ee691034ed3b…f28637d6` | `3ed77b333ea0…52d44f1` | 変化あり |
| resume前の全バイト | - | 先頭部分として一致 | 上書きではなく追記 |

baselineとresumeはどちらも終了コード0で、成功イベントは各1件、観測されたsession IDも同一でした。認識されたcommand、file change、Web search、MCPのtool eventは0件です。検証器も終了コード0で`claim-supported`と判定しました。

重要なのは、単にファイルサイズが変わっただけではない点です。resume前の全バイトがresume後のファイルのprefixとしてそのまま残り、事前には存在しなかった無害なresumeマーカーが追記部分だけで見つかりました。この組み合わせにより、別セッションや上書きではなく、対象セッションの再開ターンに帰属する追記だと判定しました。

## なぜ終了コードやモデルの応答では判定できないのか

終了コード0が示すのは、CLI呼び出しが正常に完了したことです。既存rolloutがbyte-identicalだったことまでは示しません。今回もbaselineとresumeの両方が正常終了しながら、rolloutは増えています。

また、モデルへ「前の会話を覚えているか」と尋ねる方法も、ローカルファイルの非永続化を直接測っていません。応答はモデル依存であり、さらに1ターン増やすため、検証対象そのものを変えてしまいます。

必要なのは、再開に使った正確なsession IDから対象rolloutを1つだけ解決し、同じファイルについて次を比較するfile oracleです。

- SHA-256
- byte数と行数
- resume前の全バイトがprefixとして保たれたか
- 無害なresumeマーカーが追記部分に現れたか

一時作業ディレクトリや`read-only` sandboxは、Codexのsession storeへrolloutが書かれるかどうかとは別の境界です。今回もそれらの制御を有効にしたまま、session store側の対象rolloutは増えました。

## 最小の検証条件

検証では、freshな使い捨ての非Git workspaceを使い、モデルへ渡すpromptと保持するマーカーを無害・非機密の文字列に限定しました。workspaceには`markers.json`、依存パッケージを使わない`codex-resume-wrapper.mjs`、`preflight-codex.mjs`、`verify.mjs`を置き、実行後に`probe-result.json`と`verification.txt`を生成しています。Codexの2つの子プロセスが認識したtool eventは、いずれも0件でした。

1. 通常の`codex exec`を1回実行し、永続baselineと正確なsession IDを得る
2. 同じIDを`--ephemeral`付きで1回だけresumeする

主な条件は次のとおりです。

| 項目 | 記録した条件 |
| --- | --- |
| 検証日 | 2026-08-14 |
| Codex CLI | `codex-cli 0.147.0` |
| model / reasoning effort | overrideなし。解決されたbackendは未確定 |
| approval | `never` |
| sandbox | `read-only` |
| user config / rules | 無効化 |
| workspace toolのnetwork | 無効化 |
| live呼び出し | baseline 1回、resume 1回、retryなし |

workspace toolのnetwork無効化は、プロバイダー通信やホストOS全体を隔離する設定ではありません。また、認証は通常のCLI動作に任せ、認証ファイルの読み取りや複製は行っていません。

## 導入前に置くconformance gate

ローカル非永続化が必要な自動化では、本番プロンプトを流す前に、版固定の無害なpreflightを置きます。今回の2つの子プロセスに対応するコマンドの骨格は次のとおりです。baselineでは`--ephemeral`を付けず、永続セッションと正確なsession IDを1つ作ります。

```sh
codex -a never exec --json --sandbox read-only \
  --ignore-user-config --ignore-rules --skip-git-repo-check \
  -C <disposable-case-dir> \
  -c sandbox_workspace_write.network_access=false \
  -o <temporary-baseline-final-output> \
  '<harmless-baseline-marker-only-prompt>'
```

baselineのJSONLを1行ずつ解析し、session IDが1種類だけであることを確認して`<exact-session-id>`へ渡します。次に、同じIDを指定して1回だけresumeします。

```sh
codex -a never exec --ephemeral --json --sandbox read-only \
  --ignore-user-config --ignore-rules --skip-git-repo-check \
  -C <disposable-case-dir> \
  -c sandbox_workspace_write.network_access=false \
  -o <temporary-final-output> \
  resume <exact-session-id> '<harmless-marker-only-prompt>'
```

このshell例は子プロセスの起動部分です。`<...>`は実値へ置換し、stdoutのJSONL解析、session store内でのexact-ID検索、hashと件数の計測は呼び出し側で実装します。検索結果が0件または複数なら先へ進みません。1件に解決できたrolloutについて、resume前の全バイトを一時的に保持し、SHA-256、byte数、行数、resumeマーカー数を記録します。resume後は同じIDで再検索し、再び1件だけで、かつ同じpathであることを確認してから再計測します。他セッションのrolloutは比較対象に含めず、その内容をログへ出力・複製しません。

判定は次の**実装用チェックリスト**です。実行可能なshell式ではありません。`success_events`と`failed_events`はJSONL内の終端イベント、`tool_events`はcommand、file change、Web search、MCPの認識イベントの合計、`match_count`はexact session IDに対応したrolloutの件数を表します。

```text
SCOPE_OK =
  cli_version == pinned_version
  AND approval == never
  AND sandbox == read-only
  AND user_config_and_rules == ignored
  AND workspace_tool_network == disabled
  AND prompts_and_markers_are_harmless
  AND baseline_call_count == 1
  AND resume_call_count == 1
  AND retry_count == 0

PROCESS_OK(call) =
  call.exit == 0
  AND call.timed_out == false
  AND call.signal == null
  AND call.success_events == 1
  AND call.failed_events == 0
  AND call.unique_session_ids == 1
  AND call.tool_events == 0

ATTRIBUTED =
  PROCESS_OK(baseline)
  AND PROCESS_OK(resume)
  AND baseline.session_id == resume.session_id
  AND before.match_count == 1
  AND after.match_count == 1
  AND before.path == after.path
  AND before.resume_marker_count == 0

NO_GROWTH =
  before_sha256 == after_sha256
  AND before_bytes == after_bytes
  AND before_lines == after_lines
  AND after_resume_marker_count == 0

ATTRIBUTABLE_APPEND =
  before_sha256 != after_sha256
  AND after_bytes > before_bytes
  AND after_lines >= before_lines
  AND after_content starts_with before_content
  AND appended_resume_marker_count > 0
  AND after_resume_marker_count == appended_resume_marker_count

ACCEPT = SCOPE_OK AND ATTRIBUTED AND NO_GROWTH AND oracle_result_is_well_formed
REJECT = SCOPE_OK AND ATTRIBUTED AND ATTRIBUTABLE_APPEND AND oracle_result_is_well_formed
INCONCLUSIVE = NOT ACCEPT AND NOT REJECT
```

`after_content starts_with before_content`は、保存したresume前の全byte列がresume後ファイルのprefixと一致するという意味です。`oracle_result_is_well_formed`には、計測項目が欠けていないことと、wrapperとは独立した検証処理が同じ判定を返すことを含めます。

運用手順をまとめると次のとおりです。

1. 対象のCodex CLI versionを固定する
2. freshな使い捨てディレクトリで、無害なbaselineを1回だけ永続化する
3. baselineがtimeout・signal・失敗イベントなしで正常終了し、成功イベントが1件、tool eventが0件、session IDが1種類だけであることを確認する
4. exact session IDに対応するrolloutを1つだけ解決し、path、全バイト、hash、byte数、行数、resumeマーカー数を記録する。resume前のマーカーが0件でなければ停止する
5. 同じIDへ上記コマンドで1回だけresumeし、baselineと同じprocess条件および同じsession IDを確認する
6. exact IDから再び1件だけ解決した同じpathを再計測し、独立した検証処理とも判定が一致するときだけ`ACCEPT`または`REJECT`を確定する

byte-identicalかつマーカー不在なら、その版と記録条件に限って`ACCEPT`です。今回のように元のprefixが保たれ、追記部分へresumeマーカーが現れた場合は`REJECT`とし、そのcommand combinationを使いません。対象が複数見つかる、再検索したpathが違う、IDが一致しない、timeout・signal・失敗イベント・tool eventがある、計測値が欠ける、独立検証と判定が食い違う、登録外のmutation shapeになる、といった場合は`INCONCLUSIVE`として停止し、自動retryしません。

CLIを更新した後は、以前の結果を引き継がず、このpreflightを再実行します。

## 原因候補：startとresumeのパラメーターが非対称

Codex `0.147.0`のversion-pinned sourceでは、新規threadを作る`ThreadStartParams`へ`ephemeral`が渡されています。一方、隣接するresume用の構築処理は`config.ephemeral`を渡しておらず、`ThreadResumeParams`のprotocol shapeにも`ephemeral`フィールドがありません。[^exec-source] [^thread-protocol]

この非対称性は今回のファイル追記と整合します。ただし、1回の外部観測だけから、ソース上のフィールド欠如が直接の原因だと証明したわけではありません。ここで確定したのは、インストール済み`0.147.0`の記録条件で、`resume --ephemeral`後に既存rolloutへの追記を観測したことまでです。

## この結果で判断できないこと

今回の結果は、Codex CLI `0.147.0`、1つの既存セッション、1回のresumeというcase studyです。次は検証していません。

- freshな`codex exec --ephemeral`やfork、interactive session
- 他のCodex CLI version、OS、model backend
- server-side retention、model memory、暗号化、privacy compliance
- 複数回実行した場合の再現率
- ホスト上の別プロセスによるsession storeへの同時書き込みを完全に排除できるか

生のrollout内容はログへ複製せず、hash、件数、差分量、無害なマーカーの計測値だけを証拠として残しました。そのため、過去のhashを公開ログだけから再計算することもできません。

## 結論：版固定のno-growth gateが通るまで使わない

Codex CLI `0.147.0`の記録条件では、`resume --ephemeral`は正常終了しましたが、既存rolloutへ`4,402`バイトが追記されました。したがって、再開ターンをローカルへ残さないことが要件なら、flagの受理や終了コード0を適合判定に使えません。

実務上の判断ルールは単純です。**正確なsession IDに対応するrolloutがbyte-identicalで、resumeマーカーも不在になる版固定preflightが通った環境だけ許可する**。追記を観測した環境は拒否し、判定材料が欠ける環境もinconclusiveとして止めます。

## 参考資料

[^developer-commands]: [OpenAI Developer commands](https://learn.chatgpt.com/docs/developer-commands?surface=cli)（2026-08-14閲覧）
[^non-interactive]: [OpenAI Non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode)（2026-08-14閲覧）
[^exec-source]: [Codex 0.147.0 exec source](https://github.com/openai/codex/blob/rust-v0.147.0/codex-rs/exec/src/lib.rs)（2026-08-14閲覧）
[^thread-protocol]: [Codex 0.147.0 thread protocol](https://github.com/openai/codex/blob/rust-v0.147.0/codex-rs/app-server-protocol/src/protocol/v2/thread.rs)（2026-08-14閲覧）
