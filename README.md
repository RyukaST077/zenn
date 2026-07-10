# zenn

Zenn の記事を **AIエージェントだけで** 調査 → 実践 → 執筆 → レビュー → 公開準備まで行うリポジトリ。
GitHub 連携により、`published: true` の記事が `main` にマージされると Zenn で公開される。

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
/publish-pr     → feature ブランチ + PR            公開準備（PRマージ＝Zenn公開）
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
# 1サイクル実行（テーマ調査 → … → PR作成まで。マージ＝公開は人間が行う）
bash scripts/auto-publish.sh

# PRの自動マージまで行う（完全自律。マージ＝Zenn公開）
bash scripts/auto-publish.sh --auto-merge

# 実行計画と設定の確認だけ（何も実行しない）
bash scripts/auto-publish.sh --dry-run
```

### オプション

| オプション | 意味 | 既定 |
|---|---|---|
| `--auto-merge` | PR作成後に `gh pr merge` で自動マージ（branch protection があれば `--auto` 予約、無ければ即時マージ） | OFF（PR作成まで） |
| `--resume <dir>` | 失敗したパイプラインを途中から再開（`logs/pipeline-*/` を渡す） | — |
| `--max-rounds <n>` | review ⇄ revise ループの上限回数 | 3 |
| `--search-args "..."` | search-topic への引数（関心領域・スキルレベルなど） | — |
| `--dry-run` | 実行計画を表示して終了 | — |
| `-h` / `--help` | ヘルプ（スクリプト冒頭コメント）を表示 | — |

### 環境変数

| 変数 | 意味 | 既定 |
|---|---|---|
| `AP_MODEL` | 全段のモデル（`opus` / `sonnet` / `fable` またはフルID。空=CLI の既定） | `opus` |
| `AP_EFFORT` | 全段の effort（`low` / `medium` / `high` / `xhigh` / `max`。空=既定） | `medium` |
| `CLAUDE_FLAGS` | claude に渡す共通フラグ（権限モード等） | `--permission-mode bypassPermissions` |
| `MAX_REVIEW_ROUNDS` | `--max-rounds` と同じ | `3` |
| `BASE_BRANCH` | PR の base ブランチ | `main` |
| `MERGE_METHOD` | 自動マージ方式 | `--squash` |
| `TIMEOUT_<STAGE>` | 段別タイムアウト秒（`TIMEOUT_SEARCH` / `_PLAN` / `_RUN` / `_DRAFT` / `_REVIEW` / `_REVISE` / `_PUBLISH`） | 段ごと（run は 4時間） |
| `TURNS_<STAGE>` | 段別の claude 最大ターン数（同上の接尾辞） | 段ごと |

```bash
# 例: モデル/effort を変えて実行
AP_MODEL=sonnet AP_EFFORT=high bash scripts/auto-publish.sh

# 例: run-practice のタイムアウトを2時間に短縮
TIMEOUT_RUN=7200 bash scripts/auto-publish.sh
```

> `CLAUDE_MODEL` / `CLAUDE_EFFORT` という変数名は Claude Code 自身が環境に export する値と
> 衝突するため、あえて `AP_` 接頭辞にしている。

### 実行中に作られるもの

```
logs/pipeline-<日時>/     ← このパイプライン実行の記録
├── pipeline.log          ← 進行ログ（何をいつ実行したか）
├── state.sh              ← 段ごとの完了状態と成果物パス（resume が読む）
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

resume は `state.sh` を読み、**完了済みの段をスキップして失敗した段からやり直す**
（数時間かかる run-practice を再実行せずに済む）。

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
- `publish-pr` が feature ブランチ（`publish/<slug>`）内でのみ `true` に変え、PRを作る
- **PRを `main` にマージした瞬間に Zenn で公開される**（`main` への直接 push はしない）
- `--auto-merge` を付けない限り、マージ（＝公開の最終判断）は人間が行う
- 公開後に「Slug はサイト内で既に使用されています」が出た場合は
  `knowledge/2026-07-01-zenn-slug-already-used.md` を参照（slug を具体化してリネーム）

### 定期実行（cron の例）

```bash
# 毎週月曜 9:00 に1サイクル（完全自律）
0 9 * * 1 cd /path/to/024_zenn && bash scripts/auto-publish.sh --auto-merge >> logs/cron.log 2>&1
```

多重起動はロック（`.auto-publish.lock`）で防止されるため、前回が長引いていても安全。

## auto-publish-codex.sh の使い方（Codex 版）

Claude 版と同じ「調査 → 実践 → 執筆 → レビュー → 公開準備 → PR」を **OpenAI Codex CLI** で
実行するオーケストレーター。各工程は `.agents/skills/zenn-*` のスキルとして実装されている。
設計の詳細は `docs/codex-auto-publish-design.md` を参照。

```
zenn-search-topic → zenn-plan-practice → zenn-run-practice → zenn-draft-article
→ zenn-review-article ⇄ zenn-revise-article → branch → zenn-prepare-publish → commit/push → PR
```

Claude 版との主な違い:

- 各段は `codex exec --json --output-schema` で実行され、**結果を JSON（stage result）で返す契約**
  になっている。`scripts/validate-stage-result.mjs` が成果物パス・スラッグ・レビュー判定などを
  機械検証し、契約違反は即中止する（成功時は `reason` を空にする決まり。経緯は
  `knowledge/2026-07-11-codex-stage-result-empty-reason-contract.md`）
- 実行は `--sandbox workspace-write` で行い、ネットワークは段ごとに制御される
  （search / run のみ許可）。起動時にサンドボックスの書き込み境界を診断し、
  効いていなければ中止する。`.codex/config.toml` が `danger-full-access` の場合も中止
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
# 1サイクル実行（PR 作成まで。マージ＝公開は人間が行う）
bash scripts/auto-publish-codex.sh

# PR の自動マージまで行う（完全自律。マージ＝Zenn公開）
bash scripts/auto-publish-codex.sh --auto-merge

# 実行計画と設定の確認だけ（何も実行しない）
bash scripts/auto-publish-codex.sh --dry-run
```

### オプション

| オプション | 意味 | 既定 |
|---|---|---|
| `--auto-merge` | PR 作成後に `gh pr merge --auto --delete-branch` で自動マージ | OFF（PR作成まで） |
| `--resume <dir>` | 失敗したパイプラインを途中から再開（`logs/codex-pipeline-*/` を渡す） | — |
| `--max-rounds <n>` | review ⇄ revise ループの上限回数 | 3 |
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
| `MAX_REVIEW_ROUNDS` | `--max-rounds` と同じ | `3` |
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

> ⚠ **Zenn の投稿数レートリミットに注意**: Zenn は新規記事の公開数を制限している
> （具体数は非公開。目安 1〜2 本/日）。上限を超えた記事はデプロイ通知に
> 「投稿数の上限に達したためデプロイされませんでした」と表示され、main にマージ済みでも
> Zenn には反映されない（次回以降の push 時に枠が空いていれば自動で再処理される）。
> 高頻度の定期実行は未反映記事が溜まるだけなので、公開ペースは 1 日 1 本程度に抑えるのが安全。

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
