---
title: "claude -pのcronジョブ、auto-compact設定ミスは--autocompactだけが落ちる"
emoji: "🧯"
type: "tech"
topics: ["claudecode", "cli", "aiagent", "automation"]
published: false
---

`claude -p` をcron・launchd・CIから無人実行していて、auto-compact(自動コンパクション)のウィンドウ幅を何かしらの方法で指定しているなら、その設定を間違えたときに今の仕組みはちゃんと気づけるだろうか。`.claude/settings.json` の `autoCompactWindow` や環境変数で範囲外の値を渡しても、`claude -p` は無言のまま終了コード0で終わる、という報告がある。誰も見ていないジョブの中で設定ミスが黙って握りつぶされるのは一番困るパターンだ。

今回、ハーネスで実機検証したのは `--autocompact` というCLIフラグ経由で値を渡した場合の1ケースだけである。これに加えて、同じ調査セッション内で手元検証済みだがハーネス証拠としては保存されていない3件の観測(後述、研究レポート由来)を、出所を明記した上でまとめる。結論は次の通りである。

**`--autocompact` フラグは、`claude -p` のヘッドレス実行でも対話実行と同じようにパース時点の範囲チェックを効かせる。これが、今回ハーネスで確認した4つの設定経路のうち唯一、無人ジョブに検知可能な非ゼロ終了コードを返す経路である。** ドキュメントが定める100k〜1Mの範囲外の値(`50000`)を渡すと、プロンプトが一つも実行される前にCLIが終了コード1で落ちる。一方、`auto` を渡した場合は通常通りターンが走る。これは`-p`という実行形態が検証をバイパスしない、というこの1フラグに関する確認であり、ハーネス実行による再現可能な証拠はこの1フラグに限られる。`autoCompactWindow`や環境変数側の挙動については、同じ調査セッション内での手動検証(証拠の強度がハーネス実行より低い)を外部観測として後述する。

## 検証内容

Claude Code 2.1.319上で、同一のベース引数(`-p <prompt> --output-format stream-json --verbose --no-session-persistence --setting-sources project --permission-mode bypassPermissions --tools Read,Edit,Write,Bash`)に対して `--autocompact` の値だけを変えた2ケースを、実際の認証済み`claude`バイナリに対して1回ずつ実行した。判定はモデルの発言ではなく、実プロセスの終了コード・stderr・エージェントマーカーファイルの有無で行った。

| ケース | `--autocompact` | 実CLI終了コード | stderr | マーカー書き込み | 所要時間 |
|---|---|---:|---|---|---:|
| `autocompact-flag-valid-control` | `auto` | 0 | なし | あり(`AUTOCOMPACT_FLAG_PROBE_OK`) | 8321ms |
| `autocompact-flag-invalid-experiment` | `50000` | 1 | `error: option '--autocompact <auto\|tokens>' argument '50000' is invalid. It must be 'auto', or between 100k and 1M (e.g. 500k, 200000, or 200 as shorthand)` | なし | 582ms |

`50000`ケースのstderrは実際に記録された文言をそのまま引用している。マシン上の`metrics.json`では両ケースとも`agent_exit_code: 0`になっているが、これはこのハーネスのラッパースクリプトが自身の終了コードを常に0に固定する設計によるもので、実CLIの挙動そのものではない。実際の判定材料は、サイドカーファイル`autocompact-probe.json`に記録された`real_exit_code`であり、`auto`では`0`、`50000`では`1`だった。

この結論は終了コード単独ではなく、3つの独立した証拠が揃って裏付けている。

- **所要時間の非対称性**: `auto`は8321msかかっているのに対し、`50000`は582ms。実際にモデルとの往復が発生したかどうかの差に見える長さである。
- **`events.jsonl`の有無**: `auto`ケースでは`system init`イベント、実セッションID、モデル`claude-opus-5-5`、`Write`ツール呼び出し、`result`イベント(`total_cost_usd: 0.064733`)まで記録された本物のAPIトラフィックが残っている。`50000`ケースの`events.jsonl`は空で、どのターンも開始していないことと整合する。
- **マーカーファイルの有無**: `auto`ケースでは`agent-marker.txt`(内容`AUTOCOMPACT_FLAG_PROBE_OK`)が生成されたが、`50000`ケースでは生成されなかった。生成されたのはサイドカーの`autocompact-probe.json`と`probe-result.txt`の2つのみだった。

タイムアウトやクラッシュによる偶発的な失敗ではないことも、サイドカーの`timed_out: false`と、`--autocompact`・`50000`という具体的な引数名を名指ししたパースエラー文言から切り分けられる。

## なぜこの結果が重要か

無人実行のパイプラインは、人間がTUIを見ていなくても検知できる失敗だけに反応できる。今回の確認は、「設定ミスを実際に検知可能な終了コードへ変換してくれる、唯一テスト済みの経路」が`--autocompact`フラグだということを示している。たとえば、コピー&ペーストで`k`サフィックスを付け忘れたトークン数をそのまま渡してしまうような、現実にありそうな設定ミスのクラスがこれに当たる。

## 他の設定経路はどうか(研究レポートの手動検証、ハーネス証拠ではない)

ここから先の3項目は、今回のハーネス実行では再検証していない。同じ調査セッション内(2026-11-09、同一マシン・同一`claude 2.1.319`・同じサブスクリプション認証)で著者が手動で行った検証であり、`/tmp`の使い捨てディレクトリで実施後に削除済みのため、`command.json`/`stderr.log`/`diff.patch`のようなハーネス形式の生証拠は残っていない。上の`--autocompact`フラグのケースよりも証拠として弱いことを明記した上で、研究レポート(`research/agent/agent-knowhow-claude-code-autocompact-headless-decision-20261109-1512.md`、「検索と一次情報」節 2.b/2.c/2.d)に記録された観測として引用する。

- **`.claude/settings.json`の`autoCompactWindow`(研究レポート観測、未再検証)**: `{"autoCompactWindow": 50}`(範囲外)や`{"autoCompactWindow": "not-a-number"}`(型違反)を書いた状態で`claude -p "say hi" --output-format json`を実行すると、どちらも`exit=0`・stderr空・応答は通常通り返ってきたという。設定が無視されたのか補正されたのかは、無人実行している側からは判別できない。
- **`CLAUDE_CODE_AUTO_COMPACT_WINDOW`・`CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`(研究レポート観測、未再検証)**: `CLAUDE_CODE_AUTO_COMPACT_WINDOW=50000`(範囲外)・`CLAUDE_CODE_AUTO_COMPACT_WINDOW=200kk`(壊れたサフィックス)・`CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=150`(ドキュメント上100%が上限で無視されるはずの値)のいずれも、`-p --output-format json`実行で標準エラー出力を`2>`で分離して確認したところ空だったという。公式チェンジログ(2.1.304)が明言する「warns when a value is out of range or ignored」という警告は、少なくともこの手動検証では`-p`ヘッドレスモードで観測できなかった。
- **`claude -p "/context" --output-format json`(研究レポート観測、未再検証)**: `-p`の非対話モードでも動作し、`result`フィールドにモデル別トークン使用量・カテゴリ別内訳・Skills一覧を含むMarkdown表が返ってきたという。無人パイプラインからコンテキスト使用量を機械可読に取得できる自己点検コマンドとして、以下のように使える。

```bash
claude -p "/context" --output-format json
```

cronやlaunchdのジョブに定期実行させ、`result`内のトークン使用量が想定レンジに収まっているかをパースで確認する、という使い方が考えられる。ただしこのコマンド自体の出力フォーマット(フィールド名やスキーマ)は今回ハーネスで再検証しておらず、研究レポートの手動実行結果に基づく。

なお、`idleCompaction`設定が`-p`の1ショット実行の応答・終了コードに影響するかどうかは、研究レポート・今回のハーネス実行のいずれでも実行されておらず(ドキュメント記述からの論理的な推測に留まる)、この記事では検証済みの事実として扱わない。

## 判断ルール

cronやlaunchd、CIから動く`claude -p`ジョブで、auto-compactウィンドウの値に対して「間違っていたら落ちてほしい」という挙動が必要なら、その値は`--autocompact <値>`フラグとして渡し、プロセスの終了コードを監視対象にする。これは今回ハーネスで実機確認した唯一の経路である。`.claude/settings.json`の`autoCompactWindow`や環境変数経由の設定にこの役割を期待しない――これらの経路は上述の通り研究レポートの手動検証(ハーネス証拠より弱い)でしか裏付けられておらず、「`-p`では無言でexit 0になる」「警告が出ない」という観測はこの記事自身のハーネス証拠ではなく、出所を明記した外部寄りの報告として扱う。`claude -p "/context" --output-format json`は、設定ミスの疑いがあるときに状況を機械可読に確認する補助手段として使えるが、同じく研究レポートの手動実行に基づく。

## 再現条件と限界

- 検証日: 2026-11-08。`claude 2.1.319 (Claude Code)`。認証は既存のサブスクリプションログインのみ、APIキーは未設定。モデル指定はnull(アカウントのデフォルトを使用)。
- 各ケース1回のみの実行であり、CLIバージョン間や複数回実行での再現性については何も主張しない。これは境界確認であり、統計的な信頼性の主張ではない。
- 検証したのはCLIフラグのパース境界のみで、実際のコンパクション挙動そのものではない。プローブに使ったプロンプトはコンパクションウィンドウに到達するには小さすぎる。
- `--autocompact 50000`という「範囲未満の数値」以外の壊れ方(負数、非数値文字列、範囲内だが変則的な省略記法など)は検証対象外。
- `.claude/settings.json`の`autoCompactWindow`、環境変数`CLAUDE_CODE_AUTO_COMPACT_WINDOW`・`CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`、`claude -p "/context" --output-format json`の3件については、この記事のハーネス実行結果としては何も示していない。研究レポートの手動検証観測として引用しているのみで、`command.json`/`stderr.log`/`diff.patch`のような保存済みの生証拠は無い(検証後に一時ディレクトリを削除済みのため)。
- `idleCompaction`設定が`-p`の1ショット実行に影響するかどうかは、研究レポート・ハーネス実行のいずれでも検証されておらず、この記事では一切主張しない。
- 使い捨てワークスペースと差分比較は、このリポジトリ内での証拠境界であり、ホストのファイルシステムやネットワークに対するセキュリティ境界ではない。

最小構成として、`claude -p <prompt> --output-format stream-json --verbose --no-session-persistence --setting-sources project --permission-mode bypassPermissions --tools Read,Edit,Write,Bash --autocompact <値>`を実行し、プロセスの終了コードを見る、という手順は今回の2ケースどちらでも決定的な結果を返した。値が範囲内かどうかを無人ジョブ自身に確かめさせたい場合は、この最小構成をそのまま使い回せる。
