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

このパイプラインの**上流**に、テーマ選定を継続的に改善するループがある。
公開後の実績と市場を毎日観測し、選定方針を更新していく
→ [テーマ選定の継続的改善ループ](#テーマ選定の継続的改善ループ)。

```
Zenn公開API → analytics/            観測（自分の実績＋市場ベースライン）
            → strategy/             選定方針（人間がPRでマージしたときだけ変わる）
            → /search-topic が読む  → 記事契約を発行 → 後工程が執行
```

## auto-publish.sh の使い方

### 前提

| 必要なもの | 備考 |
|---|---|
| `claude` CLI | ログイン済みであること |
| `gh` CLI | PR作成・自動マージに使用（無くても compare URL のフォールバックあり） |
| `npm install` 済み | zenn-cli / playwright（run-practice がスクショ取得に使用） |
| `coreutils`（推奨） | macOS には `timeout` が無い。`brew install coreutils` で `gtimeout` を入れると段ごとのタイムアウトが有効になる（無いと警告のうえタイムアウト無しで実行） |
| Git worktree と origin | 直接実行でも一時worktreeを作成するため、共有ツリーの未コミット変更は保持される |

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
- 実行は `--sandbox workspace-write` に固定し、起動時にリポジトリ外への書き込み拒否を診断する。
  search / run だけネットワークを許可し、`danger-full-access` は受け付けない
- run段には `ASTRO_TELEMETRY_DISABLED=1` を強制的に継承させる。計画・実行スキルも、製品固有の
  telemetry／設定永続化のopt-outを最初のコマンドより前に要求し、`HOME`や`CODEX_HOME`は変更しない
- 各段は終了コード0に加え、JSONL内の単一`turn.completed`、`turn.failed`不在、`-o`と最後の
  completed `agent_message`の一致を検査する。途中メッセージからstage resultを復元しない
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
# 共有ツリーの変更を保持したまま、一時worktree内で実行
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
| `CODEX_SANDBOX_MODE` | Codex sandbox。安全境界を弱める値は拒否 | `workspace-write`固定 |
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
├── 1-search.final.json            ← `-o`が保存する不変の最終メッセージ（completion gate対象）
├── 1-search.result.json           ← finalのコピー。禁止metadataだけを正規化してstage契約を検証
└── ...
```

### 失敗したら（resume）

途中で失敗すると、エラー内容・パイプラインディレクトリ・再開コマンドを表示して終了する。

```bash
bash scripts/auto-publish-codex.sh --resume logs/codex-pipeline-20260710-232528 --auto-merge
```

resume は `state.json` を読み、完了済みの段をスキップして失敗した段からやり直す。
`--auto-merge` は resume 時にも付け直す必要がある（エラー表示の resume コマンドをそのまま使えば付いてくる）。
既存stage resultを再利用する場合も、対応するJSONLと`-o`がcompletion gateを通ることが必要。
安全停止後に実践計画を修正した場合は、証拠の意味を変えないため旧runをresumeせず、新しい計画・runとして実行する。

### 定期実行（launchd）

`scripts/auto-publish-codex-launchd.sh` が launchd 用ラッパー（ログは `logs/launchd/` に出力）。
自動実行は既定で `--auto-merge` を使う。人間の確認を挟む場合だけ
`CODEX_AP_ARGS="--pr-only"` を指定する。

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
選んだテーマが安全に記事化できない場合は、証拠基準を下げず、別テーマを最大5回まで試す。
試行回数は`AGENT_PRACTICE_MAX_ATTEMPTS`で変更できる。launchdの既定オーケストレーターは、
利用上限時の待機・再開に対応したClaudeとする。5時間枠内で後続の実験・執筆・レビューまで
進めるため、launchd経路の既定は`claude-sonnet-5` / `medium`とする。明示した
`AGENT_PIPELINE_MODEL` / `AGENT_PIPELINE_EFFORT`は優先される。

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

## テーマ選定の継続的改善ループ

「どのテーマで書けば読まれるか」を、観測 → 方針 → 記事 → 再観測で回す仕組み。
設計の根拠と読み方は [docs/analytics-feedback-loop.md](docs/analytics-feedback-loop.md)。

### なぜ入れたか（2026-09-05 時点の実測）

| 観測 | 値 |
|---|---|
| 公開記事 | 57本 |
| いいね 合計 / 平均 / 最大 | 42 / 0.74 / 3 |
| 5いいね以上 | **0本** |
| 公開ペース | 2026-07: 20本 / 2026-08: 31本（頻度は足りている） |
| 市場（`claudecode` 新着48本） | 中央値 **0** いいね / 0いいねが60% / p90=4 / 5+到達 6% |

自分の平均は市場の新着中央値を下回ってはいない。問題は**裾（上位層）に一度も入れていない**こと。
主因はカテゴリ選択ではなく、「単一の境界条件が成立するかを1記事にしていて、読者の持ち帰りが無く
対象読者が極小になっている」こと。

### ファイル構成

| パス | 役割 | 書き換える主体 |
|---|---|---|
| `strategy/topic-selection-policy.json` | **正式な選定方針**（唯一の権威） | 人間がPRをマージしたときだけ |
| `strategy/decision-log.md` | なぜそう決めたかの履歴 | 人間 / スクリプトは提案履歴の追記のみ |
| `strategy/proposals/*.md` | 方針変更の提案 | `evaluate-policy.mjs` |
| `strategy/article-contract.md` | 記事契約のスキーマ | 人間 |
| `analytics/contracts/<slug>.json` | **契約の正本**（不変）。台帳が失われても復元できる | `register-article.mjs` |
| `analytics/article-ledger.jsonl` | 契約＋APIから導出される台帳（D7/D30観測＋市場内順位） | `register-article.mjs` / `collect-zenn-metrics.mjs` |
| `analytics/market-index.json` | トピック×記事年齢の他者いいね分布 | `collect-zenn-metrics.mjs` |
| `analytics/topic-feedback.md` | 観測レポート（**方針ではない**） | `build-topic-feedback.mjs` |
| `experiments/EXP-*.json` | 事前登録した実験 | 人間 |

観測が方針を自動で書き換えることはない。傾向は提案を経由し、**人間のPRマージで初めて方針になる**
（publish PR と同じゲート方式）。

### 使い方

```bash
# 日次: 収集（自分＋市場の最新ページ）→ 観測レポート更新
bash scripts/auto-improve-topics.sh

# 週1（必須）: 市場を46日分まで遡る。これをやらないとD30順位が永久に出ない
bash scripts/auto-improve-topics.sh --deep

# 実験の判定 → policy へ実差分を書いて提案PR（マージが承認ゲート）
bash scripts/auto-improve-topics.sh --evaluate --pr

# 個別に実行
bash scripts/analytics/fetch-zenn-metrics.sh          # API取得＋台帳・市場インデックス更新
node scripts/analytics/build-topic-feedback.mjs       # analytics/topic-feedback.md 生成
node scripts/analytics/evaluate-policy.mjs            # 実験判定＋提案生成
node scripts/analytics/register-article.mjs --from-research research/search-topic-<日時>.md
```

`register-article.mjs` は**公開前**に記事契約を登録する。deprecated な価値型・検証3件未満・
持ち帰りの無い契約・`experimentId` の省略は exit 2 で棄却される（テーマ選定のゲート）。

> ⚠ **`--deep` は必須**。`claudecode` は1日に約24本公開されるため、最新ページだけを毎日取っても
> 記事は7日・30日になる前にページから流れて消える。深いスイープが無いと `d7-14` / `d30-45` の
> 市場コホートが永久に空になり、**主指標のD30順位が計算できない**。launchd は日曜に `--deep` を付ける。

launchd 常駐（日次4:20 / 日曜は `--deep` / 毎月1日は判定つき）:

```bash
cp config/launchd/com.zenn.improve-topics.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.zenn.improve-topics.plist
```

### 判定指標（4層）

| 層 | 指標 | 用途 |
|---|---|---|
| 品質ゲート | 記事契約の充足 | 公開可否。成果指標ではない |
| 短期（主指標） | D30の市場コホート内パーセンタイル中央値 / 上位25%到達率 | 方針の続行判断 |
| 劣化検知 | 0いいね率 / 非ゼロ率 / 平均いいね | 明確な悪化の検出のみ |
| 最終成果 | D30で上位10% / 5いいね以上 | 長期確認。昇格の必須条件にしない |

**平均いいねを目標にしない。** ゼロ過剰・裾が重い分布では1本の当たりが平均を支配する。
**hitが1本出ても勝ち型の証拠にしない。** 市場のhit率は約6%で、12本での期待hit数は0.7本。
出ても偶然、出なくても偶然。

### 群（arm）と未公開ドラフトの扱い

| arm | experimentId | 用途 |
|---|---|---|
| `historical-control` | `null` | 方針導入前に公開済みの57本。ループが自動で付ける歴史的対照群 |
| `B-payload` | `EXP-001` | 新方針で選定した実験対象（`asset` / `migration` / `quantified`） |
| `exploration` | `null` | 探索枠（`stage: candidate` の価値型） |
| `legacy-transition` | `null` | 方針導入前の未公開ドラフトを束ね直した記事。**実験判定には使わない** |

方針導入時点で `published: false` のドラフトが33本あり、本文を読んで分類した結果
**24本（73%）が deprecated な型**
（「〜検証した」「〜話」）。**そのまま公開しない**。同じ読者判断に寄与するものを3〜5件束ね、
`asset` / `migration` / `decision` に再設計して新しい slug・新しい契約で出す
（詳細は [strategy/article-contract.md](strategy/article-contract.md)）。

### 到達と反応の分離（GA4）

Zenn のユーザー別 GA 設定で `zenn.dev/<user>` 配下に自分の測定IDが入るので、
**自分の記事のページ到達だけ**は GA4 Data API から取れる。これで「誰も来ていない」と
「来たが刺さらない」が割れる。セットアップと、GA4データの扱いで守っている規則は
[docs/analytics-feedback-loop.md](docs/analytics-feedback-loop.md) の「GA4 の接続」を参照。

記事別の実数は `analytics/private/`（git管理外）にのみ書き、コミットされる
`analytics/topic-feedback.md` には帯と本数だけを出す。このリポジトリは公開なので。

### 取れないもの

- **Zennの露出（インプレッション）**: 非公開。GA4で取れるのは「到達」であって
  フィードや検索結果での表示回数ではない。到達の低さの原因をテーマとタイトルに分けられない。
- **過去記事のD30いいね率**: D30到達は復元できるが、D30時点のいいね数は復元できない。
  過去分は到達の分析にのみ使う。
- **窓ごとのユニークユーザー数**: 日次 `totalUsers` の合計は user-days で、
  ユニークユーザー数ではない。

GA4を見て何が出たら診断を撤回するかは、データを見る前に
[experiments/EXP-GA4-DIAG-001.json](experiments/EXP-GA4-DIAG-001.json) に判定線ごと固定してある。

## 開発トラブルのナレッジループ

トラブルの解決記録は `knowledge/` に蓄積している（検索: `grep -ri "<keyword>" knowledge/`）。
運用ルールは `knowledge/README.md` と `CLAUDE.md` を参照。
