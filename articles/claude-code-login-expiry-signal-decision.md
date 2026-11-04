---
title: "cronでClaude Codeを回す前に: ログイン失効を課金せず検知する"
emoji: "🔑"
type: "tech"
topics: ["claudecode", "cli", "aiagent", "automation"]
published: true
---

## 結論: 無人実行の事前チェックは `claude auth status` に置く

Claude Code を `claude.ai` サブスクリプション認証のまま cron・launchd・systemd timer・CI で無人実行していると、ログインセッションには有効期限があるため、ある日突然ジョブが失敗します。しかも `claude -p`(`--output-format` を省略したデフォルトのテキストモード)は、stdoutにもstderrにも失効の兆候を一切出しません。何もしなければ、無人実行は無警告で失敗するところまで行ってから気づくことになります。

2026-11-04リリースの `v2.1.318` で、`claude auth status` に `loginExpiresAt`、`claude -p --output-format json` の結果に `credential_expires_at` という2つのフィールドが追加されました(公式チェンジログ `code.claude.com/docs/en/changelog`、アクセス日2026-11-05)。この記事は、この2フィールドと「デフォルト出力には何も出ない」という3点をローカルで検証した上で、無人実行の種類ごとにどこで失効シグナルを拾うべきかの決定表と、最小のシェルスニペットを示します。

検証環境: `claude 2.1.318 (Claude Code)`、`claude.ai` サブスクリプション認証(`authMethod: "claude.ai"`、teamプラン)、検証日2026-11-05。API キー認証や `--bare` モードは対象外です。

## 決定表

| 無人実行の種類 | どこで失効シグナルを見るか | コスト | 根拠 |
|---|---|---|---|
| cronジョブの本体(ジョブ実行前の事前チェック) | `claude auth status`(引数なしでJSONがデフォルト)の `loginExpiresAt` | 無課金・約0.2秒 | 実測: `auth_status` は183msで完了し、JSON結果に `total_cost_usd` フィールド自体が存在しない(`has_cost_field: false`) |
| 既に `-p --output-format json` を呼んでJSONを消費しているCI/バッチ | そのJSON結果に含まれる `credential_expires_at` を追加コストなしで読む | 追加コストなし(呼び出し自体は課金対象) | 実測: `credential_expires_at: "2026-11-28T03:56:35.544Z"` は同じ検証内の `loginExpiresAt` と完全一致。ただし、この値だけを得るために `-p` を新たに呼ぶのは割に合わない(そのターンで `total_cost_usd: 0.0783488` が発生) |
| デフォルト(`--output-format` 省略)の `-p` 呼び出しに頼る設計 | **使えない** — stdout/stderrのどちらにも失効シグナルは出ない | - | 実測: `stdout_is_json: false`、`signal_in_stdout: false`、`signal_in_stderr: false`、`stdout_len: 5`、`stderr_len: 0` |

この決定表の要点は、「事前チェックは無料、事後参照は追加コストなしで流用できるが新規に呼ぶ価値はない、デフォルト出力は何も教えてくれない」という3段構えです。

## 検証したこと(ローカル実測)

2026-11-05、既存のサブスクリプション認証のまま、1ケースの自動化された再現可能な検証を実行しました(`logs/agent/run-claude-login-expiry-signal-probe-20261105-1645-20261105-013621/`)。検証は決定的な終了コード・JSONフィールドの有無・文字列マッチのみで判定しており、モデルの自由記述には依存していません。

1. `claude auth status`(引数なし)はデフォルトでJSONを返し、`loginExpiresAt: "2026-11-28T03:56:35.544Z"` を含む。実行コストフィールド(`total_cost_usd`)は存在しない(`has_cost_field: false`)。実行時間183ms、終了コード0。
2. `claude -p --output-format json` の結果JSONの `credential_expires_at` は `"2026-11-28T03:56:35.544Z"` で、手順1の `loginExpiresAt` と完全一致する。同じ結果JSONに `total_cost_usd: 0.0783488`(>0)が含まれる。実行時間1930ms、終了コード0。
3. `claude -p`(`--output-format` 省略=デフォルトのテキストモード)は、stdout・stderrを個別にキャプチャしても失効関連の文字列を含まない。`stdout_is_json: false`、`signal_in_stdout: false`、`signal_in_stderr: false`、stdout長5、stderr長0。実行時間2416ms、終了コード0。

検証を実行したスクリプトの自己点検ログ(`verify.log`)でも、事前登録していた5条件 — `fieldsMatch`、`reactiveCallCosted`、`preflightCallFree`、`defaultOutputIsText`、`defaultOutputLeaksNoSignal` — がすべて真であることが確認されています。これは `preflight: false`(フィクスチャでの事前リハーサルではない)、実際に解決されたCLIバイナリ(`resolved_version: "2.1.318"`、sha256ダイジェストあり)に対する本物の認証済み呼び出しの結果です。

### 解釈

- 事前チェック(`auth status`)と事後参照(`-p --output-format json` の `credential_expires_at`)は、同じタイムスタンプ文字列を指す同一の値であり、どちらを使っても正しさは変わりません。違うのはコストと、そのフィールドを得るために新たに呼び出しを発生させるかどうかだけです。
- デフォルトの `-p` 出力(`--output-format` 省略)に失効の兆候が全く無いことは、「何もしなければ無人実行は無警告で失敗にたどり着く」という問題設定の裏付けです。`--output-format text` を明示した場合やインタラクティブな `auth status --text` には別途表示(例: `Sign-in ends: ...`)がありますが、これは今回の決定的な自動検証の対象外であり、本記事はJSON経路の3点に絞っています。

## 最小のシェルスニペット: 残り日数がしきい値未満ならジョブを中断

```bash
#!/usr/bin/env bash
set -euo pipefail

THRESHOLD_DAYS=3

expires_at=$(claude auth status | python3 -c "import json,sys; print(json.load(sys.stdin)['loginExpiresAt'])")

# GNU date (Linux cron/systemd/CI) vs BSD date (macOS launchd) — `-d` is GNU-only,
# BSD date needs `-j -f` with an explicit input format.
if date -d "$expires_at" +%s >/dev/null 2>&1; then
  expires_epoch=$(date -d "$expires_at" +%s)
else
  # ${expires_at%%.*} strips the trailing `Z`, so BSD date has no timezone
  # information left in the string — force UTC explicitly or it silently
  # parses in the host's local zone.
  expires_epoch=$(TZ=UTC date -j -f "%Y-%m-%dT%H:%M:%S" "${expires_at%%.*}" +%s)
fi
remaining_days=$(( (expires_epoch - $(date +%s)) / 86400 ))

if [ "$remaining_days" -lt "$THRESHOLD_DAYS" ]; then
  echo "Claude Code login expires in ${remaining_days} day(s) (< ${THRESHOLD_DAYS}); aborting unattended job." >&2
  exit 1
fi
```

これを cron ジョブや launchd タイマー、CIステップの先頭に置けば、本体の処理(課金対象の `claude -p` 呼び出し)を始める前に、無課金・約0.2秒のチェックでセッション失効が迫っているかどうかを判定できます。しきい値 `THRESHOLD_DAYS` は運用のスケジュール間隔(ジョブの実行頻度)に合わせて選んでください。`date -d` はGNU date(Linuxのcron/systemd timer/CIランナー)専用の構文で、BSD date(macOSのlaunchdが動くホスト)では `illegal option -- d` で失敗するため、上記スニペットは `date -d` の可否を実行時に判定してBSD形式の `date -j -f` にフォールバックします。`${expires_at%%.*}` でタイムスタンプ末尾の `Z`(UTCを示すマーカー)を切り落とすため、`TZ=UTC` を明示しないとBSD dateはホストのローカルタイムゾーンで解釈してしまいます。実際、このmacOSホスト(Darwin、ローカルタイムゾーンJST)で `TZ=UTC` を付けずに実行すると、UTC基準の正しいepoch値(`1795838195`)に対して9時間(32,400秒、JST/UTCのオフセットと一致)ずれた値(`1795805795`)を返すことを確認しました。`TZ=UTC` を付けた現在のスニペットでは、同じ入力に対してGNU `date -d` 側と一致する `1795838195` を返すことを、このホスト上で確認済みです。GNU date分岐自体はこの検証では実行していません。

## 限界と再現条件

- **n=1、単一バージョンの検証です**。CLIバージョン `2.1.318`、`claude.ai` サブスクリプション認証(teamプラン)の1アカウント状態(検証時点で残り約23日)での1回の実行に基づきます。APIキー認証や `--bare` モードでの挙動は未検証で、本記事の対象外です。
- 公式チェンジログは「失効10日前からstderrにテキスト警告が出る」とも記載していますが、検証時点でセッションの残り有効期間が約23日あり、この10日しきい値そのものはローカルで再現できていません。この点はベンダー記述の引用としてのみ扱い、本記事の検証済みクレームには含めていません。10日を切った状態での挙動を無人実行の設計に組み込む場合は、各自で別途確認してください。
- マニフェストの `network: false` はCodexサンドボックスの設定であり、Claude Codeのホストプロセス自体をOSレベルでネットワーク隔離するものではありません(実行環境のホスト側ネットワークはこの設定の対象外です)。
- 検証は事前登録した5条件の合致のみを確認するものであり、一般的な製品動作や将来バージョンでの継続を保証するものではありません。

## まとめ: 何をすればよいか

無人実行の前段に `claude auth status` を置き、`loginExpiresAt` を解析してしきい値未満ならジョブを中断してください。既に `-p --output-format json` を呼んでいる経路があるなら、その結果の `credential_expires_at` を流用して構いません(同一の値であることを確認済みです)。ただし、そのフィールドだけを得るために新しく `-p` 呼び出しを追加するのは避けてください — 無課金の `auth status` で同じ情報が得られます。そして、デフォルト(`--output-format` 省略)の `-p` 出力だけを監視する設計は、失効シグナルが実際には存在しないため機能しません。
