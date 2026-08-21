# zenn

Zenn の記事を **AIエージェントだけで** 調査 → 実践 → 執筆 → レビュー → 公開準備まで行うリポジトリ。
投稿上限で保留された記事とAI coding-agent記事は公開キューへ入り、AIを使わないワーカーが
投稿上限を見ながら1件ずつ`published: true`にする。GitHub 連携により、その変更が`main`へ
マージされるとZennで公開される。

## パイプライン全体像

各工程は `.claude/skills/` のスキルとして実装されており、オーケストレーター
`scripts/auto-publish.sh` が非対話の claude コマンド（`claude -p "/スキル名 ..."`）で順番に実行する。
同じ工程を OpenAI Codex CLI で実行する **Codex 版**（`scripts/auto-publish-codex.sh`、
スキルは `.agents/skills/zenn-*`）もある → [auto-publish-codex.sh の使い方](#auto-publish-codexsh-の使い方codex-版)。

```
/search-topic   → research/search-topic-*.md      テーマ候補の調査・評価
/plan-practice  → practice/practice-*.md          実践タスク（チェックリスト）の設計
/run-practice   → logs/run-*/execution-log.md     実装・検証（ログ/スクショ＝記事の素材）
/draft-article  → articles/<slug>.md              記事ドラフト生成（published: false）
/review-article → logs/review-*.md                公開前レビュー（公開可/要修正/公開不可）
/revise-article → 記事修正 + logs/revise-*.md      指摘の修正適用（公開可までループ）
/queue          → queue/<slug> + PR                published:falseのまま公開キューへ追加
```

## auto-publish.sh の使い方

### 前提

| 必要なもの | 備考 |
|---|---|
| `claude` CLI | ログイン済みであること |
| `gh` CLI | PR作成・自動マージに使用（無くても compare URL のフォールバックあり） |
| `npm install` 済み | zenn-cli / playwright（run-practice がスクショ取得に使用） |
| `coreutils`（推奨） | macOS には `timeout` が無い。`brew install coreutils` で `gtimeout` を入れると段ごとのタイムアウトが有効になる（無いと警告のうえタイムアウト無しで実行） |
| クリーンな作業ツリー | 追跡ファイルに未コミット変更があると開始時に中止する |

> ⚠ **権限について**: headless 実行では許可プロンプトに応答できないため、既定で
> `--permission-mode bypassPermissions` を使う。run-practice は調査対象の任意コードを
> 実行する工程なので、**専用マシンやコンテナ等の隔離環境での実行を推奨**。
> allowlist 運用に切り替える場合は環境変数 `CLAUDE_FLAGS` を上書きする。

### 基本の実行

```bash
# 1サイクル実行（テーマ調査 → … → 公開キュー追加PRまで。マージは人間が行う）
bash scripts/auto-publish.sh

# PRの自動マージまで行う（完全自律。記事はpublished:falseでキューに貯まる）
bash scripts/auto-publish.sh --auto-merge

# 実行計画と設定の確認だけ（何も実行しない）
bash scripts/auto-publish.sh --dry-run
```

### オプション

| オプション | 意味 | 既定 |
|---|---|---|
| `--auto-merge` | キュー追加PRを`gh pr merge`で自動マージ（branch protectionがあれば`--auto`予約） | OFF（PR作成まで） |
| `--resume <dir>` | 失敗したパイプラインを途中から再開（`logs/pipeline-*/` を渡す） | — |
| `--max-rounds <n>` | review ⇄ revise ループの上限回数 | 5 |
| `--search-args "..."` | search-topic への引数（関心領域・スキルレベルなど） | — |
| `--dry-run` | 実行計画を表示して終了 | — |
| `-h` / `--help` | ヘルプ（スクリプト冒頭コメント）を表示 | — |

### 環境変数

| 変数 | 意味 | 既定 |
|---|---|---|
| `AP_MODEL` | 全段のモデル（フルID推奨。`opus` / `sonnet` / `fable` の alias も可。空=CLI の既定） | `claude-opus-5` |
| `AP_EFFORT` | 全段の effort（`low` / `medium` / `high` / `xhigh` / `max`。空=既定） | `medium` |
| `CLAUDE_FLAGS` | claude に渡す共通フラグ（権限モード等） | `--permission-mode bypassPermissions` |
| `MAX_REVIEW_ROUNDS` | `--max-rounds` と同じ | `5` |
| `BASE_BRANCH` | PR の base ブランチ | `main` |
| `MERGE_METHOD` | 自動マージ方式 | `--squash` |
| `TIMEOUT_<STAGE>` | 段別タイムアウト秒（`TIMEOUT_SEARCH` / `_PLAN` / `_RUN` / `_DRAFT` / `_REVIEW` / `_REVISE` / `_PUBLISH`） | 段ごと（run は 4時間） |
| `TURNS_<STAGE>` | 段別の claude 最大ターン数（同上の接尾辞） | 段ごと |

```bash
# 例: モデル/effort を変えて実行
AP_MODEL=claude-sonnet-5 AP_EFFORT=high bash scripts/auto-publish.sh

# 例: run-practice のタイムアウトを2時間に短縮
TIMEOUT_RUN=7200 bash scripts/auto-publish.sh
```

> `CLAUDE_MODEL` / `CLAUDE_EFFORT` という変数名は Claude Code 自身が環境に export する値と
> 衝突するため、あえて `AP_` 接頭辞にしている。

### 実行中に作られるもの

```
logs/pipeline-<日時>/     ← このパイプライン実行の記録
├── pipeline.log          ← 進行ログ（何をいつ実行したか）
├── state.json            ← 段ごとの完了状態・レビュー履歴・再試行状態
├── 1-search.log          ← 各段の claude 標準出力（失敗調査はここを見る）
├── ...
└── 6-publish.log
```

成果物（research/ practice/ logs/run-* articles/ images/）は各スキルの出力先にそのまま残る。

### 失敗したら（resume）

途中で失敗すると、エラー内容・該当ログ・再開コマンドを表示して終了する（exit 1）。

```bash
bash scripts/auto-publish.sh --resume logs/pipeline-20260702-193000
```

resume は `state.json` を読み、**完了済みの段をスキップして失敗した段からやり直す**
（数時間かかる run-practice を再実行せずに済む）。旧実行ディレクトリに`state.sh`しかない場合は、
初回resume時に`state.json`へ自動移行する。

主な中断ポイントと対処:

| 中断メッセージ | 原因と対処 |
|---|---|
| `成果物が作られなかった` | スキルが前提不足で中断した。該当段のログ（`N-<段名>.log`）を確認 |
| `レビュー N 回で公開可にならず中断` | 指摘が解消しきれない。最終レビューレポートを見て判断（`--max-rounds` 増加 or 手動修正） |
| `revise-article が中止した` | 素材不足など修正不能。多くは `/run-practice` からのやり直しが必要 |
| `別のパイプラインが実行中` | 多重起動防止。前回が異常終了したままなら `.auto-publish.lock` を削除 |
| `追跡ファイルに未コミットの変更がある` | コミットまたは退避してから再実行 |

### 公開の仕組み（安全設計）

- 記事は常に `published: false` のドラフトとして生成・レビューされる
- レビュー合格後も`false`のまま、`queue/<slug>`ブランチから公開キュー追加PRを作る
- キュー追加PRをマージしても、まだZennでは公開されない
- AI非依存ワーカーだけが投稿枠を確認して、先頭記事を`true`にする公開PRを作成・マージする
- `--auto-merge`を付けない場合、人間が確認してから記事をキューへ追加する
- 公開後に「Slug はサイト内で既に使用されています」が出た場合は
  `knowledge/2026-07-01-zenn-slug-already-used.md` を参照（slug を具体化してリネーム）

### 定期実行（cron の例）

```bash
# 毎週月曜 9:00 に1サイクル（完全自律）
0 9 * * 1 cd /path/to/024_zenn && bash scripts/auto-publish.sh --auto-merge >> logs/cron.log 2>&1
```

多重起動はロック（`.auto-publish.lock`）で防止されるため、前回が長引いていても安全。

### launchd実行時のClaude利用率ゲート

`scripts/auto-publish-launchd.sh` は開始前にClaude.aiの5時間枠を確認する。残り利用可能量が
80%以下ならリセット後に枠が回復するまで60秒間隔で待ち、記事生成を開始する。開始後も
各AIステージの直前に再確認し、既定では残量20%以下で安全に一時停止する。途中でsession limitに
達した場合も失敗済み成果物を捨てず、`state.json`と`logs/.auto-publish-resume`へ再開情報を保存する。
launchdラッパーは同じ実行内で回復を待ち、完了済み段を飛ばして自動再開する。プロセスが中断されても、
次回のlaunchd実行は新規パイプラインを作らず保存済みパイプラインを再開する。

開始時のしきい値は`CLAUDE_USAGE_MIN_REMAINING_PERCENT`、段ごとのしきい値は
`CLAUDE_STAGE_MIN_REMAINING_PERCENT`で変更できる。`--dry-run`ではゲートを通さない。
モデルとeffortは`AP_MODEL` / `AP_EFFORT`の全体設定に加え、`AP_MODEL_REVIEW`や
`AP_EFFORT_RUN`のような`AP_MODEL_<STAGE>` / `AP_EFFORT_<STAGE>`で段ごとに上書きできる。

Claude版のreview判定もMarkdown本文の文字列検索ではなく、`scripts/stage-result-contract.mjs`が
生成するJSON Schemaとstage resultを使う。Markdownレポート内の現在判定とも照合し、両者が
一致しない場合は公開キューへ進まない。記事の決定的チェックはClaude/Codex/公開キューのすべてで
`scripts/check-article.sh`を使う。

## auto-publish-codex.sh の使い方（Codex 版）

Claude 版と同じ「調査 → 実践 → 執筆 → レビュー → 公開準備 → PR」を **OpenAI Codex CLI** で
実行するオーケストレーター。各工程は `.agents/skills/zenn-*` のスキルとして実装されている。
設計の詳細は `docs/codex-auto-publish-design.md` を参照。

```
zenn-search-topic → zenn-plan-practice → zenn-run-practice → zenn-draft-article
→ zenn-review-article ⇄ zenn-revise-article → published:falseのまま公開キュー追加PR
```

Claude 版との主な違い:

- 各段は `codex exec --json --output-schema` で実行され、**結果を JSON（stage result）で返す契約**
  になっている。`scripts/stage-result-contract.mjs` が段ごとのSchemaとプロンプト規則を生成し、
  `scripts/validate-stage-result.mjs` が同じ契約を使って成果物パス・スラッグ・レビュー判定などを
  機械検証する。禁止されたmetadataだけが原因で前回結果が止まった場合は、必須値を捏造せず
  `null`へ正規化して既存成果物を再検証する（成功時は `reason` を空にする決まり。経緯は
  `knowledge/2026-07-11-codex-stage-result-empty-reason-contract.md`）
- 実行は既定で `--sandbox danger-full-access` を使う。専用環境または外側の隔離境界でのみ実行する。
  `CODEX_SANDBOX_MODE=workspace-write` を指定した場合は、起動時に書き込み境界を診断し、
  search / run だけネットワークを許可する
- `coreutils`（`timeout` / `gtimeout`）が**必須**（Claude 版は警告のみだが Codex 版は無いと開始しない）

### 前提

| 必要なもの | 備考 |
|---|---|
| `codex` CLI | ログイン済みであること（`codex login status` で確認される） |
| `gh` CLI | 認証済みであること。PR 作成・自動マージに使用 |
| `node` / `git` / `rg` | 結果検証・状態管理・各種チェックに使用 |
| `coreutils` | `brew install coreutils`（`timeout` / `gtimeout` が必須） |
| クリーンな作業ツリー | 追跡ファイルに未コミット変更があると開始時に中止する |

### 基本の実行

```bash
# 1サイクル実行（published:falseの公開キュー追加PRまで）
bash scripts/auto-publish-codex.sh

# 公開キュー追加PRの自動マージまで行う（記事はpublished:false）
bash scripts/auto-publish-codex.sh --auto-merge

# 実行計画と設定の確認だけ（何も実行しない）
bash scripts/auto-publish-codex.sh --dry-run
```

### オプション

| オプション | 意味 | 既定 |
|---|---|---|
| `--auto-merge` | PR 作成後に `gh pr merge --auto --delete-branch` で自動マージ | OFF（PR作成まで） |
| `--resume <dir>` | 失敗したパイプラインを途中から再開（`logs/codex-pipeline-*/` を渡す） | — |
| `--max-rounds <n>` | review ⇄ revise ループの上限回数 | 5 |
| `--search-args "..."` | zenn-search-topic への制約（関心領域など） | — |
| `--dry-run` | 実行計画を表示して終了 | — |
| `-h` / `--help` | ヘルプ（スクリプト冒頭コメント）を表示 | — |

### 環境変数

| 変数 | 意味 | 既定 |
|---|---|---|
| `CODEX_BIN` | codex コマンド | `codex` |
| `CODEX_MODEL` | 全段のモデル（空 = CLI の既定） | `gpt-5.6-sol` |
| `CODEX_REASONING_EFFORT` | 全段の reasoning effort | `high` |
| `CODEX_SEARCH` | `1` なら search 段で `--search`（Web検索）を有効化 | `1` |
| `MAX_REVIEW_ROUNDS` | `--max-rounds` と同じ | `5` |
| `BASE_BRANCH` | PR の base ブランチ | `main` |
| `MERGE_METHOD` | 自動マージ方式（`--merge` でマージコミット） | `--squash` |
| `TIMEOUT_<STAGE>` | 段別タイムアウト秒（`TIMEOUT_SEARCH` / `_PLAN` / `_RUN` / `_DRAFT` / `_REVIEW` / `_REVISE` / `_PUBLISH`） | 段ごと（run は 4時間） |

```bash
# 例: マージコミット方式で完全自律実行
MERGE_METHOD=--merge bash scripts/auto-publish-codex.sh --auto-merge
```

### 実行中に作られるもの

```
logs/codex-pipeline-<日時>/        ← このパイプライン実行の記録
├── pipeline.log                   ← 進行ログ（何をいつ実行したか）
├── state.json                     ← 段ごとの完了状態と成果物パス（resume が読む）
├── 1-search.events.jsonl          ← 各段の codex イベントストリーム（失敗調査はここを見る）
├── 1-search.result.json           ← 各段の stage result（契約検証の対象）
└── ...
```

### 失敗したら（resume）

途中で失敗すると、エラー内容・パイプラインディレクトリ・再開コマンドを表示して終了する。

```bash
bash scripts/auto-publish-codex.sh --resume logs/codex-pipeline-20260710-232528 --auto-merge
```

resume は `state.json` を読み、完了済みの段をスキップして失敗した段からやり直す。
`--auto-merge` は resume 時にも付け直す必要がある（エラー表示の resume コマンドをそのまま使えば付いてくる）。

### 定期実行（launchd）

`scripts/auto-publish-codex-launchd.sh` が launchd 用ラッパー（ログは `logs/launchd/` に出力、
引数は環境変数 `CODEX_AP_ARGS` で渡す。例: `CODEX_AP_ARGS="--auto-merge"`）。

> **Zenn の投稿数レートリミット**: Zenn の正確な上限判定は非公開。そのためこのリポジトリは
> `config/zenn-publish-queue.json` で直近24時間を最大4件として扱い、先頭の記事だけを
> 公開する。公開できなかった記事は6時間空けて再試行し、公開APIで確認できるまで次へ進まない。

## Zenn公開キュー

`scripts/zenn-publish-queue.sh` はClaude/Codexを呼ばず、Node.js、Zenn公開API、Git、GitHub CLIだけで
動く。1回の実行で行う変更は最大1件である。

```bash
# キューと記事の整合性確認
node scripts/zenn-publish-queue.mjs validate

# 実APIを見て、いま何をするか確認（変更なし）
bash scripts/zenn-publish-queue.sh --dry-run

# 先頭1件を公開・再試行・公開確認のいずれかへ進める
bash scripts/zenn-publish-queue.sh
```

ワーカーは次の順で動く。

1. `https://zenn.dev/api/articles?username=clopy&order=latest` から直近24時間の公開数を数える
2. 2件以上なら何もせず待つ
3. 枠があれば先頭記事だけを `published: true` にしてPRをマージする
4. 次回実行で公開APIに記事があればキューから削除する
5. 見つからなければ6時間の間隔を空け、キュー状態の更新pushでZennデプロイを再試行する

`config/launchd/com.zenn.publish-queue.plist` はこのワーカーを1時間ごとに実行する設定で、ログは
`logs/launchd/zenn-publish-queue-*.log` に残る。記事作成側はキュー残量に関係なく毎朝動き、
レビュー合格済みの記事を`published: false`のまま末尾へ追加する。これにより記事を貯めながら、
公開ペースだけをワーカーが制御できる。

## AI coding-agent know-how pipeline

Claude Code と Codex 自体の使い方を、通常の技術テーマとは別枠で調査・実験・記事化するパイプライン。
モデル性能の比較だけでなく、`CLAUDE.md` / `AGENTS.md`、hooks、skills、権限、prompt、subagent、
長時間タスク、harness engineering、新機能や失敗条件などを対象にできる。

```
zenn-agent-search-knowhow       → 読者課題・既存記事との差分を含む research report
zenn-agent-plan-practice       → 事前予想・読者の判断を含む manifest + 人間向けplan
zenn-agent-run-practice        → logs/agent/run-*/execution-log.md + ケース別一次証拠
zenn-agent-analyze-results     → 事実分析 + 編集ブリーフ
zenn-agent-draft-article       → 記事タイプ別の articles/<slug>.md（published: false）
zenn-agent-review-article      → 証拠監査 + 100点の編集品質レビュー
zenn-agent-revise-article      → 構成を含む記事修正（必要な場合だけ）
publication queue              → published: false のままキュー追加PR
AI非依存ワーカー               → 投稿枠を確認 → published: true → PR → 自動マージ
```

記事は正確性・安全性・再現性の必須条件に加え、読者の問題、独自価値、説明、証拠、実用性、
読みやすさを100点で評価する。`pass` には80点以上、各項目で配点の半分以上、blockerとwarningが
ともに0であることが必要。実験ログの完全性と本文の読みやすさを両立するため、判断に必要な証拠を
本文へ置き、監査向けの詳細は後半へ分離する。

実験は `scripts/agent-practice/run-experiment.mjs` が一時ディレクトリへfixtureを複製し、認証済みの
`claude` / `codex` CLIを非対話で実行する。ケースごとにコマンド、JSONL、stderr、検証結果、diff、
変更ファイル、CLI versionを保存し、credential fileは読まず、ログは既知のtoken・session・home pathを
redactする。manifestは変更許可ファイル、保護ファイル、timeout、network、期待markerまで明示する。
fixture固有のCLIラッパーを使うケースは、オフラインのfake CLIと検証処理を全ケース分先に実行し、
すべて合格した場合だけ認証済みCLIの実験へ進む。これにより、証拠ファイルの受け渡し不備をモデル実行前に検出する。
ただし現在の `network` はCodexのworkspace sandboxにだけ強制され、ホストで直接動くClaudeの
ネットワークを遮断しない。Claudeで `bypassPermissions` を使う実験は、ネットワークを切った
コンテナ／VM／dev containerなど、別のOSレベル境界を用意する。

```bash
# 設定と段構成だけ確認
bash scripts/auto-agent-practice.sh --dry-run

# 未掲載のAI coding-agentテーマを選び、実CLI検証から公開キュー追加まで実行
bash scripts/auto-agent-practice.sh

# Claude Codeをオーケストレーターにして同じパイプラインを実行
bash scripts/auto-agent-practice.sh --orchestrator claude

# 公開PRを作成し、人間が確認してマージする場合
bash scripts/auto-agent-practice.sh --pr-only

# 調査テーマを指定（実験可能な1 claimへsearch段が絞り込む）
bash scripts/auto-agent-practice.sh --topic "Claude Code hooksでformatを強制できる条件"
```

前提は、ログイン済みの `claude`、`codex`、`gh`、`node`、`git`、`rg`、`timeout` または `gtimeout`。
run段から両方の認証済みCLIを起動するため、選択した外側のオーケストレーターは制限なしの権限で動く。
専用のローカル環境でのみ使うこと。レビューが `pass`、`blockers: 0`、`warnings: 0`、80点以上を満たした
場合だけ、`queue/<slug>` ブランチで `published: false` の記事とキュー更新のPRを作成する。通常実行はPRを
自動マージし、`--pr-only` を付けた場合は人間の確認・マージを待つ。既存の未追跡ファイルはキュー
コミットに含めず、記事と同じslugの画像だけを明示的にstageする。公開準備からpushまでは一時Git
worktree内で行うため、途中で失敗しても呼び出し元の`main` checkoutと下書き記事は変更されない。
実際の`published: true`への変更と再試行は、上記のAI非依存ワーカーが担当する。

初回の実運用や公開設定を変更した直後は `--pr-only` でPR内容を確認し、問題がなければ通常実行へ
切り替える。統合テストでは隔離した実Gitリポジトリとfake Codex / GitHub CLIを使い、`--pr-only`、
自動マージ、prepare失敗時のmain保持を検証する。外部GitHubやZennには接続しない。

| 環境変数 | 意味 | 既定 |
|---|---|---|
| `AGENT_PIPELINE_ORCHESTRATOR` | オーケストレーター（`codex` / `claude`） | `codex` |
| `AGENT_PIPELINE_MODEL` | オーケストレーターのモデル。空なら選択したCLIの既定 | 空 |
| `AGENT_PIPELINE_EFFORT` | オーケストレーターのreasoning effort | `high` |
| `AGENT_PIPELINE_SEARCH` | search段のWeb検索 | `1` |
| `AGENT_PIPELINE_AUTO_RESUME_USAGE_LIMIT` | Claude利用上限後に待機して自動再起動する | `1` |
| `AGENT_PIPELINE_MAX_USAGE_RESUMES` | 1回のパイプラインで許可する自動再起動回数 | `8` |
| `AGENT_PIPELINE_USAGE_RESET_GRACE_SECONDS` | 表示されたリセット時刻の後に追加で待つ秒数 | `30` |
| `MAX_AGENT_REVIEW_ROUNDS` | review ⇄ revise上限 | `5` |
| `AGENT_PIPELINE_BASE_BRANCH` | 公開PRのbaseブランチ | `main` |
| `AGENT_PIPELINE_MERGE_METHOD` | `gh pr merge`方式 | `--squash` |
| `TIMEOUT_AGENT_<STAGE>` | 専用段ごとのtimeout秒 | 段ごと |

開発時の決定論的テストは `node scripts/test-agent-practice.mjs`、全体は `npm test` で実行する。

### AI記事の定期実行（毎日5:00）

従来記事の4:00ジョブとは別に、`scripts/auto-agent-practice-launchd.sh`を
`com.zenn.auto-agent-practice`として毎日5:00に実行する。AI記事側はキュー残量に関係なく記事を作り、
レビュー合格後に`published: false`のまま公開キュー追加PRを自動マージする。4:00側のパイプラインが
まだ動いている場合は、同じリポジトリを同時更新しないよう終了を待ってから5:00側を開始する。
選んだテーマが安全に記事化できない場合は、証拠基準を下げず、別テーマでもう1回だけ試す。
試行回数は`AGENT_PRACTICE_MAX_ATTEMPTS`で変更でき、既定は2回。

```bash
# launchdと同じ経路をdry-run
AGENT_PRACTICE_ARGS="--scheduled --dry-run" \
  bash scripts/auto-agent-practice-launchd.sh
```

実行ログは`logs/agent/launchd/auto-agent-practice-YYYYMMDD-HHMMSS.log`へ保存する。

Claudeオーケストレーターがusage/session limitで終了した場合、表示されたリセット時刻まで待って
自動再起動する。run段以降ではmanifestに一致する`logs/agent/run-*/execution-log.md`を検出し、
`--resume-after-run`付きで分析段から続行する。実行ログがまだ無いsearch・plan段では、待機後に
researchから安全に再始動する。リセット時刻を解釈できない場合、または再起動上限に達した場合は停止する。
調査・実験・分析などの成果物は通常どおり`research/agent/`、`practice/agent/`、`logs/agent/`、
`articles/`へ保存する。

## スキルを個別に使う

パイプラインを通さず、対話セッションで1工程だけ実行することもできる。

```
/search-topic フロントエンド寄りで
/plan-practice research/search-topic-20260702-1200.md
/run-practice
/draft-article
/review-article
/revise-article
/publish-pr
```

各スキルは引数省略時「最新の成果物」を自動選択する。詳細は各 `.claude/skills/<name>/SKILL.md` を参照。

## 開発トラブルのナレッジループ

トラブルの解決記録は `knowledge/` に蓄積している（検索: `grep -ri "<keyword>" knowledge/`）。
運用ルールは `knowledge/README.md` と `CLAUDE.md` を参照。
