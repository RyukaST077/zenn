# 記事パイプラインのコード・成果物・運用データ

Issue #299。通常記事（Claude / Codex）、AI記事、launchd、日次分析、公開キューワーカーの共通入口は `scripts/run-article-pipeline-worktree.sh`。

## 実行の流れ

| 区間 | コード | データ・出力 |
| --- | --- | --- |
| 起動 | コミット済みbootstrapを読み、fetch結果をSHAに解決 | 共有checkoutのHEAD・indexを更新しない |
| supervisor | 選択SHAのGit blobから取り出した `article-runtime.mjs` | run ID、manifest、共通ロックを作成 |
| 記事生成・レビュー | 同じSHAのdetached worktree。スキル、実験ランナー、テンプレート、検証ヘルパーも同版 | worktree内は既存の相対パスを維持 |
| 分析入力 | コードには混ぜない | 最新成功スナップショットから許可した3ファイルだけを記事実行へコピー |
| キュー追加 | 実行SHAの検証・キューヘルパー | 合格記事の保存済みbundleと、fetch直後の公開ブランチの最新キューを使用 |
| 終了 | worktree外に保持した同じsupervisor | ハッシュ検証後にrun別保存。保存できなければworktreeを残す |

実行中に `origin/main` が進んでもコードは切り替えない。公開ブランチの**データ**だけは公開直前に取得する。既存記事が最新ブランチで異なる場合は停止し、公開状態を戻さない。記事・対象slugの画像・対象契約・キュー以外は公開コミットに含めない。

共有checkoutから制御コードをコピーせず、`assume-unchanged` も設定しない。未ステージ・ステージ済み・未追跡の制御コードを検査し、既存の `assume-unchanged` で隠れた変更も実ファイルのハッシュで検出する。停止時にパスと開発モードの使い方を表示する。自動commit / stash / resetは行わない。

## 通常実行

```bash
# bootstrap自体も作業ファイルから読み込まない入口（定期実行もこれを使用）
git show HEAD:scripts/run-article-pipeline-worktree.sh |
  bash -s -- -- scripts/auto-publish.sh --auto-merge

# Codex / AI記事
bash scripts/run-article-pipeline-worktree.sh -- scripts/auto-publish-codex.sh
bash scripts/run-article-pipeline-worktree.sh -- scripts/auto-agent-practice.sh --orchestrator claude

# 日次分析。出力は共有analytics/には書き戻さない
bash scripts/run-article-pipeline-worktree.sh -- scripts/auto-improve-topics.sh --deep
```

各 `auto-*.sh` の直接呼び出しも通常は共通入口へ移譲する。`--dry-run` / `--help` はモデル・公開処理を起動しないローカルの表示専用。入口に渡した引数はそのまま隔離実行へ渡す。

通常はfetchした `origin/main` を使う。`--base <branch>` で基準ブランチを変更できる。bootstrapのコミット版が取得版と違う場合は整合性エラーとして停止する。共有checkoutを確認し、mainなら `bash scripts/safe-sync-main.sh main` で安全に更新してから再実行する。

## 開発・恒久採用

```bash
# 開発ブランチにコミット済みの版を検証（公開せず最終レビューで終了）
bash scripts/run-article-pipeline-worktree.sh --dev-ref HEAD -- scripts/auto-agent-practice.sh

# 明示した未コミットファイルだけを隔離worktreeへ反映
bash scripts/run-article-pipeline-worktree.sh --dev-ref HEAD \
  --dev-file scripts/auto-agent-practice.sh \
  --dev-file .agents/skills/zenn-agent-review-article/SKILL.md \
  -- scripts/auto-agent-practice.sh --orchestrator codex
```

指定していない制御コードの変更があれば開発モードも停止する。manifestには選択SHA、originのSHA、開発ref、コピーしたファイルのハッシュ・mode・削除、差分を記録する。未追跡の追加ファイルは `development-files/` にも保存する。bootstrap / supervisor自身を試す場合は先に開発ブランチへコミットして `--dev-ref` を使う（保存担当のsupervisorは実行中に差し替えない）。

開発モードは `--auto-merge` / `--pr-only` / `--pr`、launchd、公開ヘルパー、公開キューワーカーと組み合わせられない。各パイプラインは最終レビュー後に終了する。公開ヘルパーにも拒否を置き、Git / gh の子プロセスとpre-push hookでも公開操作を拒否する。これは開発用の誤操作防止であり、意図的に保護を無効化する任意コードを閉じ込めるOS sandboxではない。

恒久採用は「開発ブランチで変更 → `npm test` と必要な開発実行 → コード改修のPR → レビュー・マージ → 共有入口を安全に同期」の順。未コミット修正を翌朝の定期実行へ採用する運用は廃止する。`AUTO_PUBLISH_SCRIPT` / `AUTO_PUBLISH_CODEX_SCRIPT` / `AGENT_PRACTICE_SCRIPT` / `CLAUDE_USAGE_WAITER` / `CLAUDE_USAGE_GATE_COMMAND` / `AGENT_EXPERIMENT_RUNNER` による共有スクリプトへの差し替えも通常入口で拒否する。

## 保存先・分類

既定は `<git-common-dir>/article-runtime/`。通常checkoutなら `.git/article-runtime/`、linked worktreeなら共通Gitディレクトリ側。Git管理対象外で全worktreeが共有する。リポジトリ外の保存先は `ARTICLE_PIPELINE_STORE=/absolute/path` または `--store /absolute/path` で指定できる。ソースツリー内の任意ディレクトリは拒否する。ディレクトリはownerのみアクセス可能な権限で作る。

```text
article-runtime/
  run.lock/owner.json              # 記事・公開処理
  operations.lock/owner.json       # 日次分析の単一writer
  operations.json                 # 最新の正常終了した日次分析runへのポインタ
  pending-claude.json              # 利用上限などからの自動再開対象
  runs/<run-id>/
    manifest.json                 # 実行台帳（stage result JSONとは別契約）
    summary.md                    # 終了状態・理由・復旧先
    process.log                   # 子プロセスのstdout/stderr
    inputs/                       # 当該runで使った分析入力
    files/                        # 記事・画像・調査・計画・fixture・ログ・レビュー履歴
    reviewed/<slug>-<hash>/        # 公開用に確定・検証保存したbundle
    publication.jsonl             # commit / push / PRの到達記録
    development.patch             # 明示的な開発差分
    development-files/
    control-changes.patch         # 実行中に生じた正式コード変更
    control-changes/               # 自動採用しない変更ファイル
    operations/                   # 日次分析runのみ。private/rawもここに保存
```

`files/` は参照の欠落を防ぐため、許可対象の既存証拠も含めたスナップショット。生成・変更・削除の区別、分類、保存先、SHA-256、modeはmanifestの `changes` / `files` で確認する。記事の採用／保留、レビュー・証拠、公開操作の識別子、再開候補も記録する。

- 制御コード: `scripts/`（後述の添付コードを除く）、各スキルディレクトリ、`docs/`、`templates/`、設定、パッケージ定義、指示ファイル、正式な `experiments/`、選定policy。
- 生成物: `articles/`、`images/`、`research/`、`practice/`（実験manifestを含む）、`fixtures/`、`logs/`、`knowledge/`、`analytics/contracts/`、`strategy/`（正式policyを除く）。
- 記事付属コード: **`scripts/articles/<slug>/...`** に作る。`scripts/`直下に作ったコードは正式コードの変更として別保存・報告し、成果物として再実行へ自動導入しない。
- `.env*`、鍵・資格情報を示すファイル、依存キャッシュ、一時workspaceは成果物対象外。シンボリックリンク経由の読み込み・書き込みは拒否する。実行ログやGA4データは公開コミットに入れない。

既存コードを実行中に変更すると、公開前の検査で停止する。終了時にも変更を別保存する。保存失敗・同名衝突では既存保存内容を上書きせず、元のworktreeを残し、`resume.worktree` と理由を記録する。パイプラインの終了コードと保存処理の終了状態は別々に残す。

## 分析データと日次更新

記事実行への入力契約は `analytics/article-ledger.jsonl`、`analytics/market-index.json`、`analytics/topic-feedback.md` の3ファイル。JSON / JSONLを構文検査し、入力のハッシュを保存する。契約ファイルは基準SHAに含まれる正式採用済みのものを使う。失敗したrunの契約を次回の実験割り当てへ混入させない。

初回（`operations.json` がないとき）だけ共有checkoutの旧保存先から3ファイルを読む。以後は日次分析の最新成功runの `operations/` を検証して読む。日次分析自身はprivate/rawを含む前回の運用状態を引き継ぐ。失敗・開発実行では最新ポインタを更新しない。記事実行へprivate/raw、任意の `analytics/*.sh`、共有ディレクトリ全体をコピーしない。

GA4設定は共有 `config/ga4.json` を明示的なprivate入力として分析プロセスだけが読む。鍵の相対パスは元の設定リポジトリを基準にする。設定・鍵はworktreeや記事成果物へコピーしない。日次分析と記事選定は同じ `ARTICLE_PIPELINE_STORE` を使う。`--evaluate` の提案はrunに保存し、policyの恒久改修は別の開発ブランチでPR化する。データ更新ジョブからの `--pr` は拒否する。

## 再開・移行・復旧

```bash
# manifestのresume.commandsに記録された相対パスを使用
bash scripts/run-article-pipeline-worktree.sh --resume-run <run-id> -- \
  scripts/auto-publish.sh --resume logs/pipeline-YYYYMMDD-HHMMSS --auto-merge

bash scripts/run-article-pipeline-worktree.sh --resume-run <run-id> -- \
  scripts/auto-agent-practice.sh --resume-after-run logs/agent/run-XXX/execution-log.md

# 旧共有ツリーにある成果物は従来の引数でも互換読み込みできる
bash scripts/run-article-pipeline-worktree.sh -- scripts/auto-publish.sh --resume logs/pipeline-OLD

# 旧保存先の対象一覧と保存先を表示（書き込みなし）
bash scripts/run-article-pipeline-worktree.sh --migrate-legacy /path/to/old-checkout
# 同じ一覧を確認した後でコピー・全ファイル検証。元データは削除しない
bash scripts/run-article-pipeline-worktree.sh --migrate-legacy /path/to/old-checkout --apply
```

再開は新しいrun IDで行い、元runは変更しない。保存済みハッシュを確認し、削除情報も適用する。開発runを通常実行へ持ち込むことは拒否する。移行IDは対象の内容・modeから決まり、同じ対象の再移行は同じ保存先を検証する。旧 `scripts/` 直下の添付コードや正式な制御コードは自動移行しない。旧データを残したまま `scripts/articles/<slug>/` へ整理して検証するか、開発差分として明示的に扱う。stash・既存バックアップへは一切操作しない。

Claudeの利用上限による待機は同じworktree・SHAで継続する。終了時にpending markerが残ればrun IDを保存し、次のlaunchd実行が読み込む。旧 `state.sh` はリテラル代入だけをデータとして解析し、shellとしてsourceしない。実行可能構文は移行時に拒否する。stage result検証、レビュー専用セッション、指摘履歴、最終修正後の確認レビューは既存契約のまま。

記事・公開ワーカーは共通Gitディレクトリとstoreの `run.lock`、日次分析は `operations.lock` を実行から保存完了まで保持する（既定ではcommonとstoreは同じ場所）。分析は記事実行中も更新できる。記事は開始時に選んだ不変スナップショットを使い、次回実行が新しい入力を読む。保存先を変えても同じリポジトリ内の同種ジョブの同時実行は防ぐ。他の処理は理由を表示して停止し、他者のロックを削除しない。`safe-sync-main.sh` は両方のロックを取得してから同期する。旧版の共有checkoutのロックも検出し、旧ジョブが動作中なら切り替えを停止する。共有mainの同期は通常実行とは別に行い、cleanならfast-forward、変更・分岐なら停止する。従来のbyte-identicalなマージ済み重複ファイルの確認も維持する。

異常時はstderrに出た `manifest.json` → `summary.md` → `process.log` の順に確認する。`save-failed` なら表示されたworktreeを保持し、まず別保存先への `--migrate-legacy` で一覧確認・保存検証を行う。SIGKILLやマシン停止でロックが残った場合は、`owner.json` のPIDが終了し、関連worktreeも動作していないことを確認してから手動でロックを解除する。自動で期限切れとみなして削除しない。

## launchdの切り替え

`config/launchd/` のplistは、編集可能なラッパーファイルを直接実行せず、`git show HEAD:scripts/run-article-pipeline-worktree.sh | bash -s -- -- scripts/<wrapper>.sh` を実行する。既存のClaude / Codex / AI記事用のローカルplistも、現在の実行時刻・環境設定を保ち `ProgramArguments` をこの形式へ切り替える。ラッパー名はそれぞれ `auto-publish-launchd.sh`、`auto-publish-codex-launchd.sh`、`auto-agent-practice-launchd.sh`。

このコード改修をマージし、cleanな共有mainを安全に同期した後にplistを再読み込みする。保存先ディレクトリは事前に作る（launchdのstdout/stderrは起動前に開かれる）。このPRから稼働中のlaunchdや個人設定を直接更新することはしない。

```bash
mkdir -p "$(git rev-parse --git-common-dir)/article-runtime"
# 既存スケジュールのplistをバックアップし、ProgramArgumentsとログパスを更新後にreloadする
```

ラッパー内のログとdaily-statusはrunの `files/logs/` に保存される。launchd自身のstdout/stderrだけはGitディレクトリ下の `article-runtime/scheduler-*.log`。cronでも同じコミット済みbootstrap入口を使用する。

## 検証

`npm test` は隔離Gitリポジトリ、ローカルbare remote、模擬CLIで実行する。実記事の公開や認証済みモデル呼び出しはしない。実行基盤の統合テストは `node scripts/test-article-pipeline-worktree.mjs`。レビュー継続のテストは `node scripts/test-agent-review-continuity.mjs`。
