# Claude Code `dontAsk` で広い Bash 許可ルールが無言で無効化される境界の調査

## 調査条件

- 調査日時: 2026-08-18 05:21 JST
- 対象: Claude Code / OpenAI Codex の現在の実用的な設定、ワークフロー、ハーネス、モデル・CLI 機能、または再現可能な失敗境界
- 制約:
  - 既存記事および `research/agent/` の過去レポートと重複しないこと
  - 公式一次情報を根拠にし、コミュニティ情報は未検証の仮説としてのみ扱うこと
  - ローカルの有界なオフライン fixture で反証可能であること
  - この段階では Claude Code / Codex の実行、実践、記事執筆、Git 操作、公開を行わないこと
  - 認証情報を表示、複製、ハッシュ化、またはレポートへ記録しないこと
- ローカル観測（外部事実ではない）:
  - macOS 26.5 arm64
  - Claude Code `2.1.227 (Claude Code)`
  - OpenAI Codex CLI `0.147.0`
  - Node.js `v22.17.0`
  - Python `3.14.6` (`/opt/homebrew/bin/python3`)

## リポジトリ内の除外確認

`articles/*.md` 44件と既存の `research/agent/*.md` 7件について、ファイル名、見出し、エージェント関連本文、既存レポートの採否を確認した。さらに `dontAsk`、`permissions.allow`、`Bash(python3`、広い allow rule に相当する語を全文検索し、一致がないことを確認した。

既存の主なエージェント記事は、プロジェクトルート指示、Codex の hook dispatch、Codex の ephemeral resume、Codex の ignore 設定と user skill、Codex GPT-5.6、Claude Code plugin の遅延読込を扱う。過去レポートは、Claude Code の turn 上限、subprocess の環境分離、Codex resume 永続化、JSONL 最終成果物、PreToolUse fail-open、ignore 設定と user skill、プロジェクト指示の provider 間差を選定済みである。Claude Code の `dontAsk` における Bash allow rule の exact / wildcard 境界は未収録だった。

## 検索範囲

代表的な検索クエリ:

- `site:code.claude.com/docs/en/permissions "python3" allow rule`
- `site:code.claude.com/docs/en/permissions permission rule ignored allowlist Bash`
- `site:code.claude.com/docs/en "silently ignored" "print mode" settings`
- `site:code.claude.com/docs/en hooks settings validation Claude Code`
- `"Bash(python3:*)" dontAsk Claude Code`
- `Claude Code dontAsk broad allow rule silently dropped`
- `"permissions.allow" "dontAsk" "python3" Claude Code`
- `site:github.com/anthropics/claude-code/issues security heuristics allowlist`
- `site:zenn.dev Claude Code dontAsk permissions allow`
- GitHub Issues 内: `repo:anthropics/claude-code is:issue created:>=2026-08-10 permissions allow`

### 代表的な強い既存カバレッジ

1. Anthropic の permission mode 文書は、`dontAsk` が事前承認済みルールと読み取り専用操作だけを実行する、ロックダウンされた CI 向けモードだと説明する。また、auto mode に入ると任意コード実行に使える広いルールが除外され、狭いルールは引き継がれ、auto mode を出ると元に戻ると説明する。更新日はページ上で確認できなかった。URL: https://code.claude.com/docs/en/permission-modes （参照日: 2026-08-18）
2. Anthropic の permissions 文書は Bash rule の `*` wildcard と `:*` の末尾 wildcard 記法を正式な構文として説明し、`Bash(npm run *)` のような例も載せている。更新日はページ上で確認できなかった。URL: https://code.claude.com/docs/en/permissions （参照日: 2026-08-18）
3. Anthropic の headless 文書は、`dontAsk` では `permissions.allow` または読み取り専用集合にない操作を拒否し、ロックダウンされた CI で使えると説明する。更新日はページ上で確認できなかった。URL: https://code.claude.com/docs/en/headless （参照日: 2026-08-18）
4. Anthropic Engineering の auto mode 解説は、広い shell、wildcard interpreter、package-runner の許可ルールが auto mode への移行時に除外され、狭いルールは残るという安全境界を説明する。公開日: 2026-03-25。URL: https://www.anthropic.com/engineering/claude-code-auto-mode （参照日: 2026-08-18）
5. Claude Code CLI reference は `--permission-mode`、`--settings`、`--setting-sources`、`--strict-mcp-config`、`--no-session-persistence`、structured output 等、提案 fixture に必要な非対話フラグを説明する。更新日はページ上で確認できなかった。URL: https://code.claude.com/docs/en/cli-reference （参照日: 2026-08-18）
6. Developers Digest の `dontAsk` 解説は、事前設定した権限だけが動くという公式説明を短く整理しているが、exact rule と広い wildcard rule を同一条件で比較していない。公開日: 2026-04-23。URL: https://www.developersdigest.tech/guides/dontask-mode （参照日: 2026-08-18）
7. RulesTrack の解説は allow / deny / ask の照合構文や無効な specifier が気づきにくい点を説明するが、現在の `dontAsk` が正式な広い wildcard rule を除外するかは検証していない。公開日: 2026-07-17。URL: https://dev.to/rulestack/claude-code-permission-rules-how-allow-deny-and-ask-actually-match-1bj7 （参照日: 2026-08-18）

### コミュニティ由来の仮説

Anthropic の公開 issue #87416 は、Claude Code 2.1.233 / macOS で、設定ファイルには残る `Bash(python3:*)` と `Bash(npm run:*)` が `/permissions` に現れず、警告もなく、auto mode を無効にしても Python 実行が確認を求めると報告する。これは単一の未解決報告であり、本レポートのローカル環境 2.1.227 の挙動を証明しない。記事の根拠ではなく、検証対象を選ぶための仮説としてのみ使う。作成日: 2026-08-17。URL: https://github.com/anthropics/claude-code/issues/87416 （参照日: 2026-08-18）

過去の issue #34106 にも、allowlist より内部の security heuristic が優先されたという類似報告があるが、Linux 上の別バージョン・別条件であり、closed / not planned の履歴情報にすぎない。作成日: 2026-03-13。URL: https://github.com/anthropics/claude-code/issues/34106 （参照日: 2026-08-18）

## 候補と除外理由

| 候補 | 判定 | 理由 |
| --- | --- | --- |
| Claude Code `dontAsk` の exact rule と broad wildcard rule の挙動差 | 採用 | 公式に構文上有効な rule と、auto mode での除外は説明される一方、fresh な `dontAsk` 実行にも同じ除外が及ぶか、診断が出るかは明記されない。CI の可否判断に直結し、2ケースで反証できる。 |
| 無効な MCP config の CLI rejection | 除外 | 公式 CLI 文書で strict config の役割が明確で、過去の turn-limit レポートでも候補から除外済み。新しい読者判断が残らない。 |
| `--no-session-persistence` の transcript 境界 | 除外 | 過去レポートで既に候補検討され、確認できた外部事例も古いバージョン中心である。 |
| `--add-dir` と追加ディレクトリ設定の読込順 | 除外 | 過去レポートで既に除外され、現在の公式文書で主要挙動が説明されている。 |
| Codex の `approve-for-me` / approval mode | 除外 | 複数の過去レポートで周辺境界が扱われ、今回の調査で独立した未解決差分を得られなかった。 |
| provider 間の permissions 比較 | 除外 | 今回の具体的な読者判断は Claude Code の locked-down CI 設定だけで完結する。比較は検証ケースと主張を不必要に増やす。 |

## 選定した実践 claim

- 対象 provider: Anthropic Claude Code
- 想定記事種別: `configuration-harness`
- 検証モード: `ablation`

### 反証可能な主張

> ローカルの Claude Code 2.1.227 / macOS arm64 で、非対話の `claude -p --permission-mode dontAsk` に同じ固定 Bash command `python3 -c "print('ALLOW_RULE_PROBE')"` を1回だけ要求する2ケースを作る。差分を `permissions.allow` の exact rule `Bash(python3 -c "print('ALLOW_RULE_PROBE')")` と、構文上有効な broad wildcard rule `Bash(python3:*)` だけに限定すると、exact rule は Bash call を許可して marker を出力する一方、wildcard rule は無言で無効になり、Bash call が自動拒否されて実行結果の marker が現れず、起動時の rule validation warning も出ない。したがって broad interpreter allow rule は auto mode 外でも有効とは限らず、locked-down CI は設定ファイルに rule が存在することではなく、狭い exact rule と挙動 preflight で必要 command の実行を確認すべきである。

これは現時点の確定事実ではなく、次段階で支持・反証する単一 claim である。特に、ローカル 2.1.227 と issue の 2.1.233 が異なるため、バージョン差で再現しない可能性を明示する。

## 読者価値と残るカバレッジ gap

### 具体的な読者

`claude -p --permission-mode dontAsk` を CI、cron、または unattended な検証ジョブに組み込み、Python helper のような限定コマンドだけを allowlist で動かしたいエンジニア。

### 現在の問題

公式構文に従った broad wildcard rule が設定ファイルに存在しても、実効 permissions から無言で除外されるなら、ジョブは必要な helper を実行できない。CLI 自体が応答を返しても、期待した検証を省略した degraded result を wrapper が成功扱いするおそれがある。

### 記事が可能にする判断・行動

- `Bash(python3:*)` のような広い rule を `dontAsk` CI の前提にできるか判断する。
- 広い rule が無効なら、許可対象を固定した exact rule へ絞る。
- 設定ファイルの静的確認ではなく、必要 command が実際に1回成功したことを structured output で確認する preflight gate を導入する。

### 公式文書が答えていること

- wildcard を含む Bash rule は正式な構文である。
- `dontAsk` は事前承認された操作だけを実行する。
- auto mode へ入る際は広い interpreter / shell rule が安全上除外され、狭い rule は残る。

### まだ答えていないこと

- auto mode へ切り替えていない fresh な `dontAsk` process でも、同じ broad-rule 除外が適用されるか。
- 除外時に stderr、structured output、または起動時 validation warning が出るか。
- 同じ command に対する exact rule が通り、broad wildcard rule だけが落ちる、という設定差だけの controlled comparison。

この gap は、公式文書の要約ではなく、設定の存在と実効権限が乖離する failure boundary を明らかにするため、記事価値が残る。

## ローカル検証可能性

### fixture

将来の run directory 内に、case ごとの disposable working directory、`HOME`、`CLAUDE_CONFIG_DIR`、settings file、stdout JSONL、stderr、exit status、inventory を置く。リポジトリ本体や実ユーザー設定は変更しない。

2ケースは次の1文字列だけを変える。

1. control: `Bash(python3 -c "print('ALLOW_RULE_PROBE')")`
2. treatment: `Bash(python3:*)`

prompt は Bash tool を1回だけ使い、固定 command `python3 -c "print('ALLOW_RULE_PROBE')"` を完全一致で実行し、代替 command を使わないよう求める。task 自体はローカル stdout に固定 marker を出すだけで、ファイル、ネットワーク、Git、外部サービスを操作しない。

CLI controls の候補:

```bash
claude -p \
  --permission-mode dontAsk \
  --tools Bash \
  --setting-sources "" \
  --settings CASE_SETTINGS_JSON \
  --strict-mcp-config \
  --mcp-config '{"mcpServers":{}}' \
  --disable-slash-commands \
  --no-chrome \
  --no-session-persistence \
  --output-format stream-json \
  --verbose \
  --max-turns 2 \
  --max-budget-usd SMALL_FIXED_CAP \
  'FIXED_PROMPT'
```

`CASE_SETTINGS_JSON`、`SMALL_FIXED_CAP`、`FIXED_PROMPT` は shell 展開へ依存させず、manifest で具体値を固定する。run 段階では `claude --help` と version を先に記録し、未対応フラグがあれば claim を変更せず停止する。

### 記録する一次 evidence

- Claude Code / OS / Python / Node の version
- 2 settings file の内容と SHA-256、および差分が allow rule 文字列だけであること
- argv、prompt、開始・終了時刻、exit status
- stdout の raw JSONL と stderr
- Bash tool request の入力 command、tool result、permission denial の有無
- 実行前後の disposable directories の inventory
- network / MCP / 追加 tool call が発生していないこと
- rule rejection に関する startup warning の有無

dependency-free の Node.js verifier で、次を機械判定する。

- 両ケースの tool input が固定 command と完全一致する。
- control は Bash tool result が成功し、実行結果に marker がある。
- treatment は Bash tool result が permission denial で、実行結果の marker がない。
- 許可されていない tool、command、ファイル変更がない。
- treatment の stderr / JSONL に rule validation warning がない。

prompt、settings、ログ自体にも marker 文字列が含まれるため、単なる全文検索は成功判定に使わない。Bash tool result の構造化フィールドだけを検査し、marker が実行由来であることを区別する。

### 判定基準

- **支持**: exact case だけが固定 command を実行し、wildcard case は permission denial、かつ起動時診断なし。
- **条件付き支持**: exact / wildcard の差は再現するが、診断が出る、または拒否の表現が claim と異なる。この場合は観測した境界へ claim を狭める。
- **再現せず**: 両ケースが同じ固定 command を正常実行する。
- **不確定**: 両ケースが拒否、model が固定 tool call を要求しない、設定を読み込めない、出力が欠落、ambient managed policy の影響を排除できない、または認証・version 条件を満たせない。

### 実務への対応関係

- fixture の `python3 -c` は、CI が呼ぶ code generator、migration verifier、テスト補助 script の最小代替である。
- broad wildcard rule は「Python helper を一括許可する」設定、exact rule は「監査済みの固定 helper だけを許可する」設定に対応する。
- marker の tool-result 確認は、CI で必要な検証 command が実際に実行されたことを wrapper が gate する処理に対応する。
- 実務上の推奨は broad rule の回避と最小権限化であり、fixture を根拠に任意 interpreter 実行を許可しない。

## Safety・cost・停止条件

### Safety

- run は新規 disposable directory 内だけで行い、リポジトリルート、実ユーザー設定、production data を書き換えない。
- dependency install、外部 network task、MCP server、browser、Git command、publish を使わない。
- Bash command は固定した Python stdout だけに限定し、command 不一致または追加 tool request が出た時点で拒否・停止する。
- `--dangerously-skip-permissions`、sandbox bypass、権限拡張は使わない。
- 認証情報は表示、検索、一覧化、複製、ハッシュ化しない。isolated config で既存認証が利用できなければ、認証データを移さず不確定として停止する。
- 実行前後 inventory で fixture 外の変更がないことを確認する。

### Cost

- 有料 model invocation は exact / wildcard の各1回、合計2回を上限とする。
- 各ケースは `--max-turns 2` と小さな固定 `--max-budget-usd` を設定する。
- 自動 retry は行わない。model が固定 command を要求しなければ不確定とし、prompt 調整の追加実行は別 manifest とする。

### 停止条件

次のいずれかで直ちに停止し、claim を支持したと扱わない。

- ローカル version が記録値と異なる、または必要 CLI flag がない。
- isolated environment で認証できない。
- managed policy や環境設定の介入を除外できない。
- model が固定 command 以外を要求する、Bash 以外の tool を呼ぶ、network を要求する。
- control が固定 command を実行できない。
- stdout JSONL / stderr / tool result のいずれかが欠落する。
- fixture 外のファイル変更が検出される。
- 2回の invocation または budget cap に達する。

## 結論

調査対象は、Claude Code `dontAsk` における exact Bash allow rule と broad wildcard interpreter allow rule の実効差に限定する。公式文書は rule 構文、`dontAsk` の基本、auto mode 移行時の broad-rule 除外を説明するが、auto mode 外の fresh process での除外と診断有無は答えていない。コミュニティ報告を仮説に留めたまま、2ケースの ablation と structured evidence で支持・反証でき、locked-down CI の設定判断に直接つながるため、現時点で記事化候補として採用する。
