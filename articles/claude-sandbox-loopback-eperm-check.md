---
title: "Claude Code sandboxで127.0.0.1がEPERM、allowlistでは変わらなかった"
emoji: "🔌"
type: tech
topics: ["claudecode", "aiagent", "sandbox", "macos"]
published: true
---

`sandbox.enabled` を有効にして `npm test` や `pytest` のたびに出る確認を止めたあと、`127.0.0.1` の dev server やモック API を叩く統合テストだけが落ちるようになった、という状況を考えます。dev server の access log にはリクエストが1件も届いていません。ここで取れる選択肢は、`sandbox.network.allowedDomains` に `127.0.0.1` を足す、sandbox の設定が壊れていると疑う、sandbox を切り戻す、のどれかです。

Claude Code 2.1.236 / macOS 26.5 arm64 の1ホストで、条件を1つずつ変えた6ケースを各1回実行しました。測ったのはネットワーク側だけで、許可の扱いは全ケース固定です（確認プロンプトそのものの挙動は測っていません。後述します）。結果は、sandbox 有効時の Bash コマンドから同一ホストの `127.0.0.1` listener への直接 TCP connect は、`allowedDomains` に `127.0.0.1` / `localhost` / `[::1]` を入れても入れなくても `EPERM` で失敗する、というものでした。`filesystem.disabled` の有無でも変わりません。つまり、少なくともこのバージョンとホストでは、allowlist に1行足す修正は当たりではありませんでした。

ただし今回の記事の中心はそこではありません。**server 側の「0件」を接続拒否として読めるのは、コマンド自身が実行の記録を残したときだけ**です。同じ実験系列の前回 run（fixture は今回の改訂前）では、sandbox profile の適用自体が `sandbox-exec: sandbox_apply: Operation not permitted` で失敗し、コマンドが1度も起動しないまま、同じ「listener 0件」が記録されていました。allowlist を疑う前に確かめるのはこちらです。

## 6ケースで観測した結果

検証日は 2026-08-20 です。プロンプトは全ケース同一（`prompt_sha256` が全ケースで一致）で、`node probe.mjs` を Bash ツールでちょうど1回実行させるだけの内容です。変えたのは inline の sandbox 設定と probe のモードだけです。

| ケース | sandbox 設定 | probe モード | tool result | probe の記録 | listener |
|---|---|---|---|---|---:|
| control-nosandbox-loopback | `{"enabled": false}` | loopback | `PROBE_CONNECTED 200` | status 200 / body marker あり | 1 |
| sandbox-defaultfs-local | 有効・既定 fs・`allowedDomains: []` | local-only | `PROBE_LOCAL_COMPLETED` | `local_completed: true` | 0 |
| sandbox-disabledfs-local | 上に `filesystem.disabled: true` | local-only | `PROBE_LOCAL_COMPLETED` | `local_completed: true` | 0 |
| sandbox-defaultfs-deny-loopback | 有効・既定 fs・`allowedDomains: []` | loopback | `PROBE_BLOCKED EPERM` | `connect EPERM 127.0.0.1:61978` | 0 |
| sandbox-defaultfs-allow-loopback | 上の allowlist に loopback 3件 | loopback | `PROBE_BLOCKED EPERM` | `connect EPERM 127.0.0.1:62001` | 0 |
| sandbox-disabledfs-allow-loopback | 上に `filesystem.disabled: true` | loopback | `PROBE_BLOCKED EPERM` | `connect EPERM 127.0.0.1:62018` | 0 |

sandbox 有効の5ケースはいずれも `strictAllowlist: true` と `allowUnsandboxedCommands: false` を含みます。control の設定文書は `{"enabled": false}` の1フィールドだけで、このどちらも持ちません。設定の渡し方は6ケースとも同じで、CLI の `--settings` に inline JSON として与えています。6ケースとも agent 終了コード 0、verifier 終了コード 0、timeout なし、変更ファイルはケースごとに2件のみでした。なお `sandbox-defaultfs-local` と `sandbox-defaultfs-deny-loopback` は設定文書のダイジェストが同一（`2f47100…`）で、違いは probe のモード1つだけです。

listener は sandbox の外側、実験用アダプタのプロセス内で `127.0.0.1` の ephemeral port に bind しています。bind 側の権限（`allowLocalBinding` 周辺）を検証に混ぜないための構成です。

## sandbox 無効なら 200 が返る

まず oracle が動くことを確認します。`{"enabled": false}` のケースでは、同じプロンプト・同じコマンドで probe が status 200 と本文マーカーを受け取り、listener 側にも `GET /loopback-probe` がちょうど1件記録されました。

```text
tool_result : PROBE_CONNECTED 200
probe       : connected=true, status=200, body_marker_present=true
listener    : 1 × GET /loopback-probe
```

このケースが通らなければ run 全体を破棄する、と計画側で事前に決めてありました。通ったので、以降の「0件」は listener 側の不具合ではありません。

## sandbox 有効でも、socket を開かないコマンドは完走する

次に、sandbox を有効にしたまま、ネットワークに一切触れないコマンドを同じ profile で走らせます。probe の `local-only` モードは `node:http` を import すらせず、`probe.json` を書いて終了します。

既定 filesystem profile でも `filesystem: {"disabled": true}` でも、結果は `PROBE_LOCAL_COMPLETED` と `local_completed: true` でした。listener は当然 0 件です。

ここが切り分けの要です。この2ケースは、**同じ sandbox profile 下でコマンドが起動して自分の出力ファイルを書ける**ことを示します。これがないと、この後の loopback ケースの 0 件が「拒否された」のか「そもそも起動していない」のか判定できません。

## allowlist に 127.0.0.1 を足しても結果は同じだった

決定的な比較は、`allowedDomains` 以外を完全に固定した2ケースです。渡した設定文書はこの形です。

```json
{
  "permissions": { "allow": ["Bash(node probe.mjs)"] },
  "sandbox": {
    "enabled": true,
    "allowUnsandboxedCommands": false,
    "network": {
      "allowedDomains": ["127.0.0.1", "localhost", "[::1]"],
      "strictAllowlist": true
    }
  }
}
```

`allowedDomains` を `[]` にしたものとの違いはその1フィールドだけで、設定文書のダイジェストは `2f47100…`（空）と `728f100…`（loopback 3件）です。観測はどちらも同じでした。

```json
{
  "probe_connected": false,
  "probe_status": null,
  "probe_body_marker_present": false,
  "probe_error_code": "EPERM",
  "probe_error_syscall": "connect",
  "probe_error_message": "connect EPERM 127.0.0.1:62001 - Local (0.0.0.0:0)",
  "listener_request_count": 0
}
```

失敗は hang ではありません。Bash の `tool_use` から `tool_result` までは 3ケースそれぞれ 0.787 秒 / 0.713 秒 / 0.647 秒で、probe 自身の 4000 ms タイムアウトの内側であり、記録上も `timed_out: false` です。`connect` が即座に `EPERM` を返しています。

`[::1]` を角括弧付きで書いているのは、公式ドキュメントが IPv6 リテラルにその記法を要求しているためです（2.1.229 以降）。記法違反で無視された、という説明を避けるための指定でした。

## filesystem.disabled も結果を変えなかった

allowlist 済み profile に `filesystem: {"disabled": true}` を足したケース（ダイジェスト `728f100…` → `8f1b734…`）も、同じく `connect` の `EPERM`、listener 0 件です。filesystem 側の profile はこの結果に効いていません。

## 「0件」を接続拒否と読めるのは、コマンド自身の記録があるときだけ

前回 run は同じ実験系列ですが、fixture は今回のために改訂しています。記録上で同一なのは harness ではなく設定文書のほうで、前回の sandbox 有効2ケースの設定文書は、今回の `filesystem.disabled: true` の2ケースと同一です（`21187bf…` と `8f1b734…`）。harness 側は、読者が比較を監査するときに効く2点が変わっています。probe に `local-only` モードを追加したこと（今回の切り分けの要）と、workspace 直下の `.claude` エントリを型と名前だけで受け入れるよう verifier を緩めたことです。後者はまさに前回の verifier が止まった地点でした。

その前回 run では、sandbox 有効の2ケースがどちらも tool result に `Exit code 71` と `sandbox-exec: sandbox_apply: Operation not permitted` を返し、`probe.json` はどこにも作られませんでした。listener は 0 件です。数字だけ見れば今回の `blocked` と区別がつきません。しかも agent の終了コードは 0、最終メッセージも error ではなく、落ちたのは verifier（終了コード 1、マーカー未書き込み）で、その停止地点はネットワークの分岐ではなく workspace の assertion でした。

今回の run では、その取り違えを防ぐために2つの前提を先に記録しています。

1. 起動側プロセスが Seatbelt を入れ子で使えるか。`/usr/bin/sandbox-exec -p '(version 1) (allow default)' /usr/bin/true` を live 実行前に走らせ、6ケースとも終了コード 0 を記録しました。0 以外になる分岐は今回再現していません。その場合はネットワークの所見を出さず、launcher 境界の診断に戻るための停止条件として扱います。
2. コマンドが起動して自分の記録を書いたか。5つの sandbox 有効ケースすべてで `probe_present: true`、Bash 使用1回、`bash_command: "node probe.mjs"` が記録され、`sandbox_apply` のテキストは1件も現れませんでした。

この2つが揃ってはじめて、listener の 0 件を「socket で拒否された」と読めます。逆に言えば、読者側の環境で dev server のログが 0 件でも、テストランナー自身のレポートファイル（JUnit XML や `--json` 出力）が作られていないだけでは、起動したか、どこまで完了したかは未確認です。選んだコマンドが到達したすべての結果でその出力を必ず残すと分かっていない限り、server 側の 0 件の解釈をそこで止めます。

なお、今回の run で `sandbox_denial_pattern: "eperm"` が立っているのは、probe が記録した `connect EPERM …` という実際のトランスポート文字列に対してです。前回 run で同じフラグが立ったときは、その照合対象が `sandbox_apply` のメッセージでした。フラグ名だけを見て判断できない例でもあります。

## 事前登録した予想と観測のずれ

計画では、control は `connected`、既定 filesystem のケースは「完走するか、前回の起動失敗の原因を露出させるか」、そして `filesystem.disabled: true` の2ケースは**前回と同じ `probe-absent`（`sandbox_apply` で起動失敗）を再現する**と書いていました。

観測は `connected` / `local-completed` / `local-completed` / `blocked` / `blocked` / `blocked` です。`filesystem.disabled: true` の2ケースは普通に起動し、片方は socket レベルの結果まで到達しました。前回 `sandbox_apply` に失敗した2つの profile は、前述のとおり今回の `filesystem.disabled: true` の2ケースと同一の設定文書です。前回はどちらも loopback probe で走っており、今回は `21187bf…` 側だけ probe のモードが local-only に変わっています。

これは記録された予想と観測の食い違いであって、前回の `sandbox_apply` 失敗が説明できたという意味ではありません。今回の run が示すのは「起動側の Seatbelt 能力が 0 で記録されている状態では再発しなかった」ことだけで、2つの run の間で何が違ったのかは、どちらの run も測定していません。

一方で、観測はすべて事前登録した候補の内側でした。計画には「allow と deny の両方が接続する、または両方がブロックされる場合は、この profile では allowlist フィールドが結果を分けなかったと報告する」という分岐が書いてあり、今回はその分岐に着地しています。

## これで確定していないこと

- **proxy 経由の egress か、loopback の一律拒否か。** sandbox 有効の loopback 3ケースでは、子プロセスに `HTTP_PROXY` / `HTTPS_PROXY` / `ALL_PROXY` / `NO_PROXY`（大文字・小文字の計8名）が渡っていました。同じ環境変数を継承して起動した無効 control 側では 0 件です。今回の probe は `agent: false` でホストとポートを明示した生の `http.request` を投げるので、これらの変数を無視します。公式の sandboxing ページは、network の分離を sandbox の外側にある proxy で行うと明記しています。したがって観測された `EPERM` は「loopback への直接接続は拒否され、通信は sandbox 外の proxy を通る想定になっている」という説明とも矛盾しません。proxy 対応クライアントは試していないため、この2つを今回の記録では分離できません。
- **allowlist の評価規則。** 分かったのは「列挙した3つのエントリが直接 connect の結果を変えなかった」ことだけです。allowlist が loopback に適用されるのかどうか、別の記法なら違うのか、は分かりません。
- **未検証の設定。** `allowLocalBinding`、`excludedCommands`、`deniedDomains`、外部ホストを含む allowlist は1ケースも実行していません。回避策は1つも検証済みではありません。
- **既存の community report との関係。** `anthropics/claude-code` の issue #28018 は、`localhost` / `127.0.0.1` / `::1` を許可し `allowLocalBinding: true` を設定しても sandbox 内からの loopback TCP が `EPERM` になると報告しています（2026-02-24 起票、参照時点で maintainer の回答は確認できず、open のまま）。今回の観測はその症状と整合しますが、`allowLocalBinding` を設定したケースがなく、対象も Docker 経由のサービスと in-process listener で異なるため、確認も反証もしていません。

## 実務での判定順序

sandbox 有効化後にローカル接続系のテストが落ちたときの順序です。今回の evidence にある成功ケースだけで構成しています。

1. そのマシンで sandbox を作れるか確認する。`/usr/bin/sandbox-exec -p '(version 1) (allow default)' /usr/bin/true` が終了コード 0 を返さないなら、launcher 境界の状態は未確定です。この失敗分岐は今回再現していないため、ネットワークの所見には進まず、起動環境の診断に戻ります。
2. 同じ profile で、socket を開かず、到達したすべての結果でクライアント側の記録（出力ファイルまたはエラー）を必ず残すコマンドを1本走らせる。実務なら、ネットワークに触れないユニットテストを `--json` や JUnit XML のレポート出力付きで1本だけ実行し、失敗時にもその出力が保証されるかを先に確認する形です（下の対応表の `probe.json` と local-only ケースの行）。期待した記録がなければ、起動または完了は未確認です。server 側の 0 件の解釈をそこで止めます。
3. そこではじめて server 側の 0 件を読む。ただし必ずクライアント側の error と併せて読みます。クライアントのタイムアウト内に返ってきた `connect` の `EPERM` は、hang でも listener 不在でもなく socket の拒否です。
4. このバージョンとホストでは、`allowedDomains: ["127.0.0.1", "localhost", "[::1]"]` が 3 の結果を変えることも、`filesystem.disabled` が効くことも期待しない。

fixture の信号を実務に置き換えると次のとおりです。

| fixture | 実務での対応物 |
|---|---|
| `probe.json` | 到達した全結果で出力が保証された、テストランナー自身のレポート（JUnit XML、カバレッジ、`--json` 出力） |
| listener のリクエスト数 | dev server の access log |
| local-only ケース | socket を開かないユニットテスト |
| 既定 fs / `filesystem.disabled` の対 | profile 互換性の確認 |
| Seatbelt smoke | 起動側の preflight |

回避策については、今回の evidence から言えることは1つだけです。**この記録の中に、sandbox を有効にしたまま loopback egress を通した設定は存在しません。** 接続できた唯一のケースは `{"enabled": false}`、つまり検証対象の機構そのものを外した状態です。`dangerouslyDisableSandbox` や `excludedCommands` は1度も実行しておらず（計画上、sandbox を弱めることは停止条件です）、動作確認済みの回避策として提示できるものはありません。

## 再現条件と起動形

### 実行条件

各ケースは使い捨ての一時ディレクトリで1回だけ実行し、自動リトライはしていません。

| 項目 | 条件 |
|---|---|
| 検証日 | 2026-08-20 |
| Claude Code | `2.1.236 (Claude Code)` |
| ホスト | macOS 26.5 arm64（単一ホスト） |
| model / effort | `sonnet` / `low`（override） |
| permission mode | `dontAsk`、allow ルールは `Bash(node probe.mjs)` のみ |
| tools | `Bash` のみ |
| 設定の入口 | CLI の `--settings`（inline JSON）、`--setting-sources` は空 |
| MCP | `--strict-mcp-config` でサーバ 0 |
| 予算 | 1ケース USD 0.20 上限、実績合計は約 0.52 USD |
| transport | `127.0.0.1` のみ。外部ホスト 0、名前解決なし |

### 起動形と隔離の範囲

adapter が渡した子プロセスの起動形は次のとおりです（`<SETTINGS_JSON>` はケースごとの inline 設定）。

```bash
claude -p '<PROMPT>' \
  --permission-mode dontAsk \
  --tools Bash \
  --setting-sources '' \
  --settings '<SETTINGS_JSON>' \
  --strict-mcp-config \
  --mcp-config '{"mcpServers":{}}' \
  --disable-slash-commands \
  --no-chrome \
  --no-session-persistence \
  --output-format stream-json \
  --verbose \
  --max-turns 4 \
  --max-budget-usd 0.20 \
  --model sonnet \
  --effort low
```

標準のランナー引数を置き換えているのは、設定の入口・許可ツール・ターン数・予算をケース間で完全に固定するためです。認証は既存の CLI 認証のみを使い、認証情報を持つ環境変数名は値を読まずに除去しています。

ランナー側の manifest には `network: false` がありますが、6ケースとも `network_enforcement: "not-enforced-for-claude-host-process"` が記録されています。この設定は Claude のホストプロセスを OS レベルで隔離していません。上の transport 行はランナーの隔離ではなく、記録された counter（`transport_scope: "loopback-only"`、外部ホスト 0、名前解決なし）に基づく記述です。

### preflight と verifier の範囲

live 実行の前に、全6ケースが offline のフェイク CLI に対して preflight を通しています。preflight では `--model` / `--effort` / `--max-budget-usd` を渡さない assertion があり、preflight 側の case 記録6件すべてに `network_or_paid_request_possible_in_preflight: false` が残っています。再現した観測はモードごとに分かれ、loopback モードの4ケースが `observation=connected listener_requests=1`、local-only モードの2ケースが `observation=local-completed listener_requests=0` でした。前者には sandbox 有効の loopback 3ケースが含まれます。sandbox を適用しないフェイク CLI ではこの3 profile でも同じ probe が同じ listener に到達するということなので、live 側の `blocked` は fixture の欠陥ではありません。

verifier は自己確認になっていません。sandbox 有効の loopback 3ケースには `["blocked", "intercepted", "probe-absent", "connected"]`、local の2ケースには `["local-completed", "probe-absent"]` を事前登録しています。control だけは `["connected"]` の1件のみで、これは前掲の「通らなければ run 全体を破棄する」というゲートを機械可読にした形です。マーカーが書かれたことは「登録済みの evidence 境界に到達した」ことだけを示します。

細かい記録として3点あります。

- sandbox 有効の5ケースでは、正規化された使い捨て workspace に `.cc-writes` だけを含む `.claude` ディレクトリが作られました。control では作られていません。
- その `.claude` について verifier が検査したのは型と名前だけで、中身は読んでいません。
- 各ケースの `modelUsage` には `claude-sonnet-5` と並んで補助的な `claude-haiku-4-5-20251001` の行があります。記録上の `live_model_calls: 1` は CLI 起動が1回という意味であって、backend へのリクエストが1回という意味ではありません。

## この結果が言える範囲

これは Claude Code 2.1.236 と上記1ホストでの、各1回・計6ケースの case study です。20秒ほどの間に取られた3サンプルで `blocked` を観測しており、再現率や統計的な比較ではありません。

今回の matrix が区別すると謳った3状態のうち、「コマンド起動前の sandbox profile 適用失敗」は今回発生しませんでした。その状態を積極的に同定できることは、今回の run では示されていません（前回 run の記録との対比があるだけです）。

許可の扱いも冒頭で置いた読者の状況とは一致していません。6ケースとも `--permission-mode dontAsk` と `Bash(node probe.mjs)` という単一の allow ルールに固定しており、sandbox を有効にしたこと自体が Bash の確認を省かせる、という構成では走らせていません。確認プロンプトの挙動そのものは今回の記録では測っていません。

Linux / WSL2 の bubblewrap による enforcement、他バージョン、他ホスト、Unix domain socket、レイテンシ、品質、価格、セキュリティ保証については何も言えません。製品バグの主張でもありません。使い捨て workspace と実行後の diff は evidence の境界であって、ホストのファイルシステムやネットワークの security boundary ではありません。

そのうえで取れる行動は1つです。**sandbox 有効化後にローカル接続のテストが落ちたら、`allowedDomains` を編集する前に、前掲の判定順序を上から実行する。** このバージョンとホストに関する限り、その順序を最後まで通しても loopback への直接接続は通りません。次に検討するのは allowlist の書き方ではなく、そのコマンドを sandbox の内側で走らせる必要があるのかどうか、という設計の側です。

## 参考資料

- [Claude Code sandboxing](https://code.claude.com/docs/en/sandboxing)（2026-08-20 参照）。2層の filesystem / network モデル、network の分離が sandbox 外の proxy 経由であること、既定で許可ドメインがないこと、`allowedDomains` / `deniedDomains` / `WebFetch(domain:…)` の合成、user・managed・CLI `--settings` 由来の `strictAllowlist` が prompt ではなく deny すること（2.1.219+）、IPv6 リテラルの角括弧記法（2.1.229+）、`allowUnsandboxedCommands: false` が `dangerouslyDisableSandbox` の再試行を無効化することが記載されています。Troubleshooting には loopback / `localhost` の項目はありません。
- [Claude Code headless mode](https://code.claude.com/docs/en/headless)（2026-08-20 参照）。`-p`、`--settings <file-or-json>`、`--output-format`、`--permission-mode` の仕様。
- [Claude Code settings](https://code.claude.com/docs/en/settings)（2026-08-20 参照）。取得時に `sandbox` の表が途中で切れており、`strictAllowlist` と `allowLocalBinding` の行は原文で確認できていません。
- [anthropics/claude-code issue #28018](https://github.com/anthropics/claude-code/issues/28018)（2026-08-20 参照、community report）。
