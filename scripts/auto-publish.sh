#!/usr/bin/env bash
# auto-publish.sh - Zenn記事 自動投稿パイプライン オーケストレーター
#
# 各スキルを非対話の claude コマンド（claude -p "/skill ..."）で順番に実行する。
#
#   search-topic → plan-practice → run-practice → draft-article
#     → [ review-article ⇄ revise-article ]×最大N回 → publication queue PR → (auto-merge)
#
# 使い方:
#   bash scripts/auto-publish.sh                     # 1サイクル実行（PR作成まで。マージは人間）
#   bash scripts/auto-publish.sh --auto-merge        # PRの自動マージまで行う（完全自律）
#   bash scripts/auto-publish.sh --resume <dir>      # 失敗したパイプラインを途中から再開
#   bash scripts/auto-publish.sh --max-rounds 7      # レビューループ上限の変更（既定5）
#   bash scripts/auto-publish.sh --search-args "..." # search-topic への引数（関心領域など）
#   bash scripts/auto-publish.sh --dry-run           # 実行計画と設定を表示して終了
#
# モデル/effort（既定: 全段 Opus 5 / medium。全体または段別の環境変数で上書き）:
#   AP_MODEL=claude-sonnet-5 AP_EFFORT=high bash scripts/auto-publish.sh
#   AP_MODEL_REVIEW=claude-sonnet-5 AP_EFFORT_REVIEW=low bash scripts/auto-publish.sh
#   AP_MODEL= AP_EFFORT= bash scripts/auto-publish.sh           # CLI の既定設定に従う
#
# 成否判定の契約:
#   - 各段は「成果物ファイルが新規作成されたか」で成否を判定する（スキルは中断時も exit 0 のため）
#   - revise-article のみ標準出力最終行の `RESULT: ok <path>` / `RESULT: abort <理由>` を使う
#   - review-article はレポート内の `判定: 公開可 / 要修正 / 公開不可` を読む
#
# 権限に関する注意:
#   headless 実行では許可プロンプトに誰も答えられないため、既定で
#   `--permission-mode bypassPermissions` を使う。run-practice は調査対象の任意コードを
#   実行する段なので、専用マシン・コンテナ等の隔離環境での実行を推奨する。
#   allowlist 運用に切り替える場合は CLAUDE_FLAGS を上書きすること。
#
# 実装の注意: macOS の bash 3.2 で動かすため、連想配列・mapfile は使わない。
#   `timeout` が無い環境（macOS 標準）では gtimeout (coreutils) を探し、
#   どちらも無ければタイムアウト無しで実行して警告する。

set -euo pipefail

# ---------- 設定（環境変数で上書き可能） ----------
: "${CLAUDE_BIN:=claude}"
: "${CLAUDE_FLAGS:=--permission-mode bypassPermissions}"
: "${AP_MODEL=claude-opus-5}"  # 全段のモデル（フルID推奨。alias可: opus/sonnet/fable。空=CLI の既定に従う）
: "${AP_EFFORT=medium}"    # 全段の effort（low/medium/high/xhigh/max。空=既定）
# ※ CLAUDE_MODEL/CLAUDE_EFFORT という名前は Claude Code 自身が環境に export する値と
#   衝突する（claude 経由で起動すると意図しない値が漏れ込む）ため AP_ 接頭辞にしている
: "${MAX_REVIEW_ROUNDS:=5}"
: "${BASE_BRANCH:=main}"
: "${MERGE_METHOD:=--squash}"
: "${CLAUDE_USAGE_GATE_ENABLED:=1}"
: "${CLAUDE_STAGE_MIN_REMAINING_PERCENT:=20}"
: "${AGENT_PIPELINE_RETRYABLE_EXIT:=20}"

stage_model() {
  case "$1" in
    search) printf '%s' "${AP_MODEL_SEARCH-$AP_MODEL}" ;;
    plan) printf '%s' "${AP_MODEL_PLAN-$AP_MODEL}" ;;
    run) printf '%s' "${AP_MODEL_RUN-$AP_MODEL}" ;;
    draft) printf '%s' "${AP_MODEL_DRAFT-$AP_MODEL}" ;;
    review) printf '%s' "${AP_MODEL_REVIEW-$AP_MODEL}" ;;
    revise) printf '%s' "${AP_MODEL_REVISE-$AP_MODEL}" ;;
    publish) printf '%s' "${AP_MODEL_PUBLISH-$AP_MODEL}" ;;
  esac
}
stage_effort() {
  case "$1" in
    search) printf '%s' "${AP_EFFORT_SEARCH-$AP_EFFORT}" ;;
    plan) printf '%s' "${AP_EFFORT_PLAN-$AP_EFFORT}" ;;
    run) printf '%s' "${AP_EFFORT_RUN-$AP_EFFORT}" ;;
    draft) printf '%s' "${AP_EFFORT_DRAFT-$AP_EFFORT}" ;;
    review) printf '%s' "${AP_EFFORT_REVIEW-$AP_EFFORT}" ;;
    revise) printf '%s' "${AP_EFFORT_REVISE-$AP_EFFORT}" ;;
    publish) printf '%s' "${AP_EFFORT_PUBLISH-$AP_EFFORT}" ;;
  esac
}

# 段ごとの上限（秒 / claude の最大ターン数）。bash3.2 のため case で引く。
stage_timeout() {
  case "$1" in
    search)  echo "${TIMEOUT_SEARCH:=2400}" ;;   # 40分
    plan)    echo "${TIMEOUT_PLAN:=1800}" ;;     # 30分
    run)     echo "${TIMEOUT_RUN:=14400}" ;;     # 4時間
    draft)   echo "${TIMEOUT_DRAFT:=1800}" ;;    # 30分
    review)  echo "${TIMEOUT_REVIEW:=1200}" ;;   # 20分
    revise)  echo "${TIMEOUT_REVISE:=1800}" ;;   # 30分
    publish) echo "${TIMEOUT_PUBLISH:=900}" ;;   # 15分
  esac
}
stage_turns() {
  case "$1" in
    search)  echo "${TURNS_SEARCH:=80}" ;;
    plan)    echo "${TURNS_PLAN:=60}" ;;
    run)     echo "${TURNS_RUN:=300}" ;;
    draft)   echo "${TURNS_DRAFT:=60}" ;;
    review)  echo "${TURNS_REVIEW:=50}" ;;
    revise)  echo "${TURNS_REVISE:=60}" ;;
    publish) echo "${TURNS_PUBLISH:=40}" ;;
  esac
}

# ---------- 引数 ----------
AUTO_MERGE=0
DRY_RUN=0
RESUME_DIR=""
SEARCH_ARGS=""
while [ $# -gt 0 ]; do
  case "$1" in
    --auto-merge)  AUTO_MERGE=1 ;;
    --dry-run)     DRY_RUN=1 ;;
    --resume)      RESUME_DIR="${2:?--resume にはパイプラインディレクトリを渡す}"; shift ;;
    --max-rounds)  MAX_REVIEW_ROUNDS="${2:?--max-rounds には回数を渡す}"; shift ;;
    --search-args) SEARCH_ARGS="${2:?--search-args には文字列を渡す}"; shift ;;
    -h|--help)     grep -E '^#( |$)' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "不明な引数: $1 (-h でヘルプ)" >&2; exit 2 ;;
  esac
  shift
done

case "$MAX_REVIEW_ROUNDS" in
  ''|*[!0-9]*|0) echo "MAX_REVIEW_ROUNDS は正の整数にする" >&2; exit 2 ;;
esac

# ---------- 共通ヘルパー ----------
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
TS="$(date +%Y%m%d-%H%M%S)"

if [ -n "$RESUME_DIR" ]; then
  if printf '%s\n' "$RESUME_DIR" | grep -Eq '^logs/pipeline-[A-Za-z0-9._-]+$'; then
    PIPE_DIR="$RESUME_DIR"
  else
    echo "--resume はリポジトリ相対の logs/pipeline-* を指定する" >&2
    exit 2
  fi
else
  PIPE_DIR="logs/pipeline-$TS"
fi
STATE="$PIPE_DIR/state.json"
LEGACY_STATE="$PIPE_DIR/state.sh"
PLOG="$PIPE_DIR/pipeline.log"
STATE_TOOL="scripts/pipeline-state.mjs"
RESULT_TOOL="scripts/validate-stage-result.mjs"
CONTRACT_TOOL="scripts/stage-result-contract.mjs"
CLAUDE_RESULT_TOOL="scripts/extract-claude-stage-result.mjs"
CLAUDE_REVIEW_TOOL="scripts/validate-claude-review-result.mjs"
USAGE_GATE="scripts/check-claude-session-usage.sh"
PENDING_RESUME_FILE="logs/.auto-publish-resume"

log()  { echo "[$(date +%H:%M:%S)] $*" | tee -a "$PLOG" >&2; }
# 注意: この環境の bash は「変数展開の直後に全角文字」が接するとパースが壊れる
# （check-article.sh 冒頭の注意と同じ）。$var の直後は半角スペース/半角記号にする。
die()  {
  log "ERROR: $*"
  log "パイプラインディレクトリ: $PIPE_DIR (各段のログあり)"
  if [ "$AUTO_MERGE" = 1 ]; then
    log "再開するには: bash scripts/auto-publish.sh --resume $PIPE_DIR --auto-merge"
  else
    log "再開するには: bash scripts/auto-publish.sh --resume $PIPE_DIR"
  fi
  exit 1
}
state_get() { node "$STATE_TOOL" get "$STATE" "$1"; }
state_set() { node "$STATE_TOOL" set "$STATE" "$1" "$2"; }
is_done() { [ "$(state_get "completed.$1")" = true ]; }
require_artifact() {
  local value
  value="$(state_get "artifacts.$1")"
  [ -n "$value" ] && [ -f "$value" ]
}
json_string() {
  node -e 'process.stdout.write(JSON.stringify(process.argv[1]))' "$1"
}
mark_retry_pending() {
  local reason="$1" retry_at="${2:-}"
  if [ -f "$STATE" ]; then
    state_set retry.pending true
    state_set retry.reason "$(json_string "$reason")"
    if [ -n "$retry_at" ]; then
      state_set retry.retry_at "$(json_string "$retry_at")"
    else
      state_set retry.retry_at null
    fi
  fi
  printf '%s\n' "$PIPE_DIR" >"$PENDING_RESUME_FILE"
  log "PAUSE: $reason"
  log "次回実行で自動再開する: bash scripts/auto-publish.sh --resume $PIPE_DIR$([ "$AUTO_MERGE" = 1 ] && printf ' --auto-merge')"
}
clear_retry_pending() {
  if [ -f "$STATE" ]; then
    state_set retry.pending false
    state_set retry.reason null
    state_set retry.retry_at null
  fi
  if [ -f "$PENDING_RESUME_FILE" ] && [ "$(sed -n '1p' "$PENDING_RESUME_FILE")" = "$PIPE_DIR" ]; then
    rm -f "$PENDING_RESUME_FILE"
  fi
}

invalidate_from() {
  local stage="$1" seen=0 name
  for name in search plan run draft review prepare_publish push pr merge; do
    [ "$name" = "$stage" ] && seen=1
    [ "$seen" = 0 ] || state_set "completed.$name" false
  done
  case "$stage" in
    search)
      state_set artifacts.report null; state_set artifacts.task null
      state_set artifacts.run_log null; state_set artifacts.article null
      state_set artifacts.review null; state_set artifacts.revise null
      state_set review '{"rounds":0,"last_verdict":null,"next_stage":"review","history":[]}' ;;
    plan)
      state_set artifacts.task null; state_set artifacts.run_log null
      state_set artifacts.article null; state_set artifacts.review null
      state_set artifacts.revise null
      state_set review '{"rounds":0,"last_verdict":null,"next_stage":"review","history":[]}' ;;
    run)
      state_set artifacts.run_log null; state_set artifacts.article null
      state_set artifacts.review null; state_set artifacts.revise null
      state_set review '{"rounds":0,"last_verdict":null,"next_stage":"review","history":[]}' ;;
    draft)
      state_set artifacts.article null; state_set artifacts.review null; state_set artifacts.revise null
      state_set review '{"rounds":0,"last_verdict":null,"next_stage":"review","history":[]}' ;;
    review)
      state_set artifacts.review null; state_set artifacts.revise null
      state_set review '{"rounds":0,"last_verdict":null,"next_stage":"review","history":[]}' ;;
  esac
  state_set publish '{"branch":null,"commit":null,"pr_url":null}'
}

TIMEOUT_BIN="$(command -v timeout || command -v gtimeout || true)"

# run_claude <段名> <ログファイル> <プロンプト> [JSON Schemaファイル]
run_claude() {
  local name="$1" logfile="$2" prompt="$3" schema_file="${4:-}" rc=0
  local secs turns usage_output usage_rc retry_at schema_json model effort
  local -a claude_cmd
  secs="$(stage_timeout "$name")"; turns="$(stage_turns "$name")"
  model="$(stage_model "$name")"; effort="$(stage_effort "$name")"

  if [ "$CLAUDE_USAGE_GATE_ENABLED" = 1 ]; then
    set +e
    usage_output="$(CLAUDE_USAGE_MIN_REMAINING_PERCENT="$CLAUDE_STAGE_MIN_REMAINING_PERCENT" \
      bash "$USAGE_GATE" 2>&1)"
    usage_rc=$?
    set -e
    log "$usage_output"
    if [ "$usage_rc" != 0 ]; then
      retry_at="$(printf '%s\n' "$usage_output" | sed -n 's/.*reset=\([^)]*\).*/\1/p' | tail -1)"
      mark_retry_pending "$name の開始前にClaude利用可能量が不足または確認不能" "$retry_at"
      return "$AGENT_PIPELINE_RETRYABLE_EXIT"
    fi
  fi

  # macOS 標準の Bash 3.2 は set -u 下で空配列の "${array[@]}" を
  # unbound variable として扱う。常に先頭要素を持つ単一配列へ条件付きで追記する。
  claude_cmd=("$CLAUDE_BIN" -p "$prompt")
  if [ -n "$CLAUDE_FLAGS" ]; then
    # CLAUDE_FLAGS は従来どおり空白区切りの複数オプションを許容する。
    # shellcheck disable=SC2206
    claude_cmd+=($CLAUDE_FLAGS)
  fi
  [ -z "$model" ] || claude_cmd+=(--model "$model")
  [ -z "$effort" ] || claude_cmd+=(--effort "$effort")
  claude_cmd+=(--max-turns "$turns")
  if [ -n "$schema_file" ]; then
    schema_json="$(tr -d '\n' <"$schema_file")"
    claude_cmd+=(--output-format json --json-schema "$schema_json")
  fi
  log "── $name 開始 (timeout=${secs}s, max-turns=$turns, model=${model:-default}, effort=${effort:-default})"
  log "   prompt: $prompt"
  set +e
  if [ -n "$TIMEOUT_BIN" ]; then
    "$TIMEOUT_BIN" "$secs" "${claude_cmd[@]}" >"$logfile" 2>&1
  else
    [ -n "${WARNED_TIMEOUT:-}" ] || { log "WARN: timeout/gtimeout が無いためタイムアウト無しで実行する"; WARNED_TIMEOUT=1; }
    "${claude_cmd[@]}" >"$logfile" 2>&1
  fi
  rc=$?
  set -e
  if [ "$rc" = 124 ]; then die "$name がタイムアウトした (${secs}s)。ログ: $logfile"; fi
  if [ "$rc" != 0 ] && grep -Eiq 'hit your session limit|usage limit|rate limit' "$logfile"; then
    retry_at="$(sed -nE 's/.*resets? ([^·]+).*/\1/p' "$logfile" | tail -1)"
    mark_retry_pending "$name の実行中にClaudeセッション上限へ到達した" "$retry_at"
    return "$AGENT_PIPELINE_RETRYABLE_EXIT"
  fi
  if [ "$rc" != 0 ]; then die "$name の claude 実行が失敗した (exit=$rc)。ログ: $logfile"; fi
}

# 実行前に触ったマーカーより新しい成果物を探す（新しい順の先頭を返す）
# newest_since <マーカー> <検索ディレクトリ> <-name|-path> <パターン>
newest_since() {
  local marker="$1" dir="$2" mode="$3" pat="$4" found
  [ -d "$dir" ] || return 0
  found="$(find "$dir" "$mode" "$pat" -type f -newer "$marker" 2>/dev/null)"
  [ -n "$found" ] || return 0
  # shellcheck disable=SC2086
  ls -t $found | head -1
}

# run_stage <段名> <番号> <検索dir> <-name|-path> <パターン> <プロンプト>
# 成果物パスを標準出力で返す（見つからなければ die）
run_stage() {
  local name="$1" idx="$2" dir="$3" mode="$4" pat="$5" prompt="$6" rc
  local marker="$PIPE_DIR/.marker-$idx-$name" logfile="$PIPE_DIR/$idx-$name.log" artifact
  touch "$marker"
  set +e
  run_claude "$name" "$logfile" "$prompt"
  rc=$?
  set -e
  [ "$rc" = 0 ] || return "$rc"
  artifact="$(newest_since "$marker" "$dir" "$mode" "$pat")"
  [ -n "$artifact" ] || die "$name: 成果物 ($dir $pat) が作られなかった（スキルが中断した可能性）。ログ: $logfile"
  log "   $name 完了 → $artifact"
  echo "$artifact"
}

# run_review_stage <番号> <プロンプト>
# Markdownレポートは成果物として残し、機械判定はClaudeの構造化JSONから取得する。
run_review_stage() {
  local idx="$1" prompt="$2" rc artifact contract
  local marker="$PIPE_DIR/.marker-$idx-review"
  local logfile="$PIPE_DIR/$idx-review.log"
  local schema="$PIPE_DIR/$idx-review.schema.json"
  local result="$PIPE_DIR/$idx-review.result.json"
  node "$CONTRACT_TOOL" schema review "$schema" || die "review result schema の生成に失敗した"
  contract="$(node "$CONTRACT_TOOL" prompt review)" || die "review result contract の生成に失敗した"
  touch "$marker"
  set +e
  run_claude review "$logfile" \
    "$prompt レビューレポートを保存した後、最終応答はschema適合JSONだけにする。成功時はreasonを空文字、artifactを保存したレポートのリポジトリ相対パスにする。$contract" \
    "$schema"
  rc=$?
  set -e
  [ "$rc" = 0 ] || return "$rc"
  node "$CLAUDE_RESULT_TOOL" "$logfile" "$result" \
    || die "review の構造化結果を抽出できなかった: $logfile"
  artifact="$(node "$RESULT_TOOL" "$result" logs "$marker" review)" \
    || die "review result contract に違反した: $result"
  case "$artifact" in logs/review-*.md) ;; *) die "review artifact path が不正: $artifact" ;; esac
  node "$CLAUDE_REVIEW_TOOL" "$result" "$artifact" >/dev/null \
    || die "review のJSON判定とMarkdownレポートが一致しない: $artifact"
  log "   review 完了 → $artifact"
  echo "$artifact"
}

# ---------- dry-run ----------
if [ "$DRY_RUN" = 1 ]; then
  cat <<EOF
[dry-run] 実行計画:
  作業ディレクトリ : $ROOT
  パイプラインdir  : $PIPE_DIR
  claude           : $CLAUDE_BIN $CLAUDE_FLAGS (default model=${AP_MODEL:-CLI default}, effort=${AP_EFFORT:-CLI default}; AP_MODEL_<STAGE>/AP_EFFORT_<STAGE>で段別上書き)
  timeout コマンド : ${TIMEOUT_BIN:-（無し: タイムアウト無効）}
  段ごとの利用量確認: $([ "$CLAUDE_USAGE_GATE_ENABLED" = 1 ] && echo "ON (最低残量>${CLAUDE_STAGE_MIN_REMAINING_PERCENT}%)" || echo OFF)
  review判定     : Claude JSON Schema + 構造化stage result
  再開状態       : $STATE
  レビューループ   : 最大 $MAX_REVIEW_ROUNDS 回
  auto-merge       : $([ "$AUTO_MERGE" = 1 ] && echo ON || echo OFF（PR作成まで）)
  段:
    1. /search-topic${SEARCH_ARGS:+ $SEARCH_ARGS}            → research/search-topic-*.md
    2. /plan-practice <レポート>                → practice/practice-*.md
    3. /run-practice <タスク>                   → logs/run-*/execution-log.md
    4. /draft-article <ログ>                    → articles/<slug>.md
    5. /review-article ⇄ /revise-article        → 判定「公開可」までループ
    6. reviewed article                         → published:false + 公開キュー追加PR
    7. $([ "$AUTO_MERGE" = 1 ] && echo "gh pr merge (auto、キューへ追加)" || echo "（マージは人間が行う）")
EOF
  exit 0
fi

# ---------- 前提チェック・多重起動防止 ----------
command -v "$CLAUDE_BIN" >/dev/null || { echo "claude コマンドが見つからない" >&2; exit 2; }
command -v node >/dev/null || { echo "node コマンドが見つからない" >&2; exit 2; }
HAS_GH=0; command -v gh >/dev/null && HAS_GH=1
[ -x scripts/agent-practice/enqueue-reviewed-article.sh ] || {
  echo "公開キュー追加スクリプトが見つからない" >&2; exit 2;
}

# 最終段は公開キュー追加PRを必須とするため、長いパイプラインを走らせる前にgh認証を確認する。
if [ "$HAS_GH" = 0 ]; then
  cat >&2 <<'EOF'
ERROR: gh CLI が見つからない。このパイプラインは最終段で公開キュー追加PRを作成する。
  対処: brew install gh && gh auth login
       その後 --resume でキュー追加段から再開できる（それ以前の成果物は再利用される）。
EOF
  exit 2
fi
if ! gh auth status >/dev/null 2>&1; then
  cat >&2 <<'EOF'
ERROR: gh CLI は入っているがGitHub未認証のため、公開キュー追加PRを作成できない。
  対処: gh auth login   （GitHub.com → HTTPS → ブラウザ/トークンで認証）
       その後 --resume で publish 段から再開できる。
EOF
  exit 2
fi

LOCK_ROOT="${ARTICLE_PIPELINE_LOCK_ROOT:-$ROOT}"
LOCK="$LOCK_ROOT/.auto-publish.lock"
for other_lock in "$LOCK_ROOT/.agent-practice-pipeline.lock" "$LOCK_ROOT/.auto-publish-codex.lock"; do
  [ ! -d "$other_lock" ] || { echo "別のパイプラインが実行中（$other_lock が存在）" >&2; exit 2; }
done
if ! mkdir "$LOCK" 2>/dev/null; then
  echo "別のパイプラインが実行中（$LOCK が存在）。前回異常終了なら手で削除する。" >&2
  exit 2
fi
trap 'rmdir "$LOCK" 2>/dev/null || true' EXIT

mkdir -p "$PIPE_DIR"
touch "$PLOG"

migrate_legacy_state() {
  local legacy_rounds
  # state.sh は旧版オーケストレーター自身が生成した代入文だけを含む。
  # shellcheck disable=SC1090
  . "$LEGACY_STATE"
  node "$STATE_TOOL" init "$STATE" "$BASE_BRANCH"
  [ -z "${DONE_gitreset:-}" ] || state_set completed.preflight true
  if [ -n "${REPORT:-}" ]; then state_set artifacts.report "$(json_string "$REPORT")"; fi
  if [ -n "${TASK:-}" ]; then state_set artifacts.task "$(json_string "$TASK")"; fi
  if [ -n "${RUNLOG:-}" ]; then state_set artifacts.run_log "$(json_string "$RUNLOG")"; fi
  if [ -n "${ARTICLE:-}" ]; then state_set artifacts.article "$(json_string "$ARTICLE")"; fi
  if [ -n "${REVIEW:-}" ]; then state_set artifacts.review "$(json_string "$REVIEW")"; fi
  [ -z "${DONE_search:-}" ] || state_set completed.search true
  [ -z "${DONE_plan:-}" ] || state_set completed.plan true
  [ -z "${DONE_run:-}" ] || state_set completed.run true
  [ -z "${DONE_draft:-}" ] || state_set completed.draft true
  legacy_rounds="$(grep -c '^REVIEW=' "$LEGACY_STATE" || true)"
  state_set review.rounds "${legacy_rounds:-0}"
  state_set review.history '[]'
  state_set review.next_stage '"review"'
  if [ -n "${DONE_review:-}" ]; then
    state_set completed.review true
    state_set review.last_verdict '"pass"'
  fi
  if [ -n "${DONE_publish:-}" ]; then
    state_set completed.pr true
    [ -z "${PR_URL:-}" ] || state_set publish.pr_url "$(json_string "$PR_URL")"
  fi
  [ -z "${DONE_merge:-}" ] || state_set completed.merge true
  log "旧 state.sh を state.json へ移行した"
}

if [ -n "$RESUME_DIR" ]; then
  if [ -f "$STATE" ]; then
    node "$STATE_TOOL" validate "$STATE" || die "resume state.json が不正"
  elif [ -f "$LEGACY_STATE" ]; then
    migrate_legacy_state
  else
    die "resume対象に state.json / state.sh が無い"
  fi
else
  node "$STATE_TOOL" init "$STATE" "$BASE_BRANCH" || die "state.json を初期化できなかった"
fi

# 完了フラグは主成果物が残っている場合だけ再利用する。
if is_done search && ! require_artifact report; then invalidate_from search; fi
if is_done plan && ! require_artifact task; then invalidate_from plan; fi
if is_done run && ! require_artifact run_log; then invalidate_from run; fi
if is_done draft && ! require_artifact article; then invalidate_from draft; fi
if is_done review && ! require_artifact review; then invalidate_from review; fi

log "=== auto-publish 開始 (pipeline: $PIPE_DIR)$( [ -n "$RESUME_DIR" ] && echo ' [resume]' )"

# ---------- Git 状態のリセット ----------
if ! is_done preflight; then
  if [ "${ARTICLE_PIPELINE_ISOLATED_WORKTREE:-0}" != 1 ]; then
    current_branch="$(git rev-parse --abbrev-ref HEAD)"
    [ "$current_branch" = "$BASE_BRANCH" ] || { log "ブランチ $current_branch → $BASE_BRANCH へ切替"; git checkout "$BASE_BRANCH"; }
  fi
  [ -x scripts/safe-sync-main.sh ] || die "安全同期ヘルパーが無い、または実行できない"
  bash scripts/safe-sync-main.sh "$BASE_BRANCH" \
    || die "origin/$BASE_BRANCH との安全同期に失敗した"
  state_set completed.preflight true
fi

# ---------- 1. search-topic ----------
if ! is_done search || ! require_artifact report; then
  REPORT="$(run_stage search 1 research -name 'search-topic-*.md' "/search-topic${SEARCH_ARGS:+ $SEARCH_ARGS}")"
  state_set artifacts.report "$(json_string "$REPORT")"; state_set completed.search true
else log "skip: search-topic (実行済み → $(state_get artifacts.report))"; fi
REPORT="$(state_get artifacts.report)"

# ---------- 2. plan-practice ----------
if ! is_done plan || ! require_artifact task; then
  TASK="$(run_stage plan 2 practice -name 'practice-*.md' "/plan-practice 対象レポート: $REPORT")"
  state_set artifacts.task "$(json_string "$TASK")"; state_set completed.plan true
else log "skip: plan-practice (実行済み → $(state_get artifacts.task))"; fi
TASK="$(state_get artifacts.task)"

# ---------- 3. run-practice ----------
if ! is_done run || ! require_artifact run_log; then
  RUNLOG="$(run_stage run 3 logs -path 'logs/run-*/execution-log.md' "/run-practice 対象タスクファイル: $TASK")"
  state_set artifacts.run_log "$(json_string "$RUNLOG")"; state_set completed.run true
else log "skip: run-practice (実行済み → $(state_get artifacts.run_log))"; fi
RUNLOG="$(state_get artifacts.run_log)"

# ---------- 4. draft-article ----------
if ! is_done draft || ! require_artifact article; then
  ARTICLE="$(run_stage draft 4 articles -name '*.md' "/draft-article 対象ログ: $RUNLOG")"
  bash scripts/check-article.sh "$ARTICLE" --expect-published false \
    || die "draft記事の決定的チェックに失敗した: $ARTICLE"
  state_set artifacts.article "$(json_string "$ARTICLE")"; state_set completed.draft true
else log "skip: draft-article (実行済み → $(state_get artifacts.article))"; fi
ARTICLE="$(state_get artifacts.article)"

# ---------- 5. review ⇄ revise ループ ----------
while ! is_done review; do
  round="$(state_get review.rounds)"
  next_stage="$(state_get review.next_stage)"
  if [ "$next_stage" = revise ]; then
    [ "$round" -lt "$MAX_REVIEW_ROUNDS" ] \
      || die "レビュー $MAX_REVIEW_ROUNDS 回で公開可にならず中断。最終レポート: $(state_get artifacts.review)"
    REVIEW="$(state_get artifacts.review)"
    revmarker="$PIPE_DIR/.marker-5-$round-revise"
    revlog="$PIPE_DIR/5-$round-revise.log"
    touch "$revmarker"
    set +e
    run_claude revise "$revlog" \
      "/revise-article 対象記事: $ARTICLE レビューレポート: $REVIEW 出典ログ: $RUNLOG"
    revise_rc=$?
    set -e
    if [ "$revise_rc" = "$AGENT_PIPELINE_RETRYABLE_EXIT" ]; then
      # 上限到達前に編集だけ完了している場合、同じ修正を二重適用せず非破壊レビューへ戻す。
      if [ "$ARTICLE" -nt "$revmarker" ] \
          && bash scripts/check-article.sh "$ARTICLE" --expect-published false >/dev/null 2>&1; then
        state_set review.next_stage '"review"'
        log "reviseの部分成果物を検出したため、再開時はreviewから確認する"
      fi
      exit "$revise_rc"
    fi
    [ "$revise_rc" = 0 ] || exit "$revise_rc"
    result="$(grep -E '^RESULT:' "$revlog" | tail -1 || true)"
    case "$result" in
      RESULT:\ ok\ *)
        new_article="${result#RESULT: ok }"
        [ -f "$new_article" ] || die "revise-article が返したパスが存在しない: $new_article"
        ARTICLE="$new_article" ;;
      RESULT:\ abort\ *) die "revise-article が中止した: ${result#RESULT: abort }" ;;
      *) die "revise-article の RESULT 行が無い（契約違反）。ログ: $revlog" ;;
    esac
    bash scripts/check-article.sh "$ARTICLE" --expect-published false \
      || die "revise後の記事チェックに失敗した: $ARTICLE"
    REVISION_LOG="$(newest_since "$revmarker" logs -name "revise-$(basename "$ARTICLE" .md)-*.md")"
    [ -n "$REVISION_LOG" ] || die "reviseレポートが作成されなかった"
    state_set artifacts.article "$(json_string "$ARTICLE")"
    state_set artifacts.revise "$(json_string "$REVISION_LOG")"
    state_set review.next_stage '"review"'
  else
    [ "$round" -lt "$MAX_REVIEW_ROUNDS" ] \
      || die "レビュー上限 $MAX_REVIEW_ROUNDS 回へ到達した"
    review_idx="5-$((round + 1))"
    REVIEW="$(run_review_stage "$review_idx" \
      "/review-article 対象記事: $ARTICLE 出典ログ: $RUNLOG")"
    review_result="$PIPE_DIR/$review_idx-review.result.json"
    verdict="$(node "$CLAUDE_REVIEW_TOOL" "$review_result" "$REVIEW")" \
      || die "review判定を検証できなかった"
    state_set artifacts.review "$(json_string "$REVIEW")"
    node "$STATE_TOOL" review "$STATE" "$verdict" "$REVIEW" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    log "   レビュー判定 (round $((round + 1))/$MAX_REVIEW_ROUNDS): $verdict"
  fi
done
REVIEW="$(state_get artifacts.review)"
ARTICLE="$(state_get artifacts.article)"

# ---------- 6. publication queue PR ----------
SLUG="$(basename "$ARTICLE" .md)"
if ! is_done pr; then
  publog="$PIPE_DIR/6-publish.log"
  QUEUE_SUMMARY="$(AGENT_PIPELINE_BASE_BRANCH="$BASE_BRANCH" AGENT_PIPELINE_MERGE_METHOD="$MERGE_METHOD" \
    bash scripts/agent-practice/enqueue-reviewed-article.sh \
      --article "$ARTICLE" --review "$REVIEW" --pipeline "$PIPE_DIR" \
      --review-style claude --pr-only)" || die "公開キュー追加に失敗した。ログ: $publog"
  printf '%s\n' "$QUEUE_SUMMARY" >"$publog"
  PR_URL="$(printf '%s\n' "$QUEUE_SUMMARY" | sed -n 's/^PR: //p' | head -1)"
  [ -n "$PR_URL" ] || die "公開キューPRのURLを確認できなかった。ログ: $publog"
  state_set publish.pr_url "$(json_string "$PR_URL")"; state_set completed.pr true
  log "   公開キューPR作成: $PR_URL"
else log "skip: publication queue PR (実行済み → $(state_get publish.pr_url))"; fi
PR_URL="$(state_get publish.pr_url)"

# 公開キューPRは隔離worktreeで記事とキューだけをコミットする。
# 調査・実践ログはローカル証拠として残し、公開キューPRには混ぜない。
if [ "$AUTO_MERGE" = 1 ]; then
  log "   archive: 公開キューPRには記事・画像・キューだけを含める"
fi

# 共有 checkout では呼び出し元を main のまま保つ。隔離 worktree は detached のままにする。
if [ "${ARTICLE_PIPELINE_ISOLATED_WORKTREE:-0}" != 1 ]; then
  git checkout "$BASE_BRANCH" >/dev/null 2>&1 || true
fi

# ---------- 7. auto-merge（--auto-merge 指定時のみ） ----------
MERGED=0
if [ "$AUTO_MERGE" = 1 ] && ! is_done merge; then
  [ "$HAS_GH" = 1 ] || die "--auto-merge には gh CLI が必要"
  # branch protection があれば --auto、無ければ即時マージ。ここでは公開ではなくキュー追加になる。
  if gh pr merge "$PR_URL" "$MERGE_METHOD" --auto --delete-branch >>"$PLOG" 2>&1; then
    log "auto-merge を予約した（必須チェック通過後に公開キューへ追加）"
  elif gh pr merge "$PR_URL" "$MERGE_METHOD" --delete-branch >>"$PLOG" 2>&1; then
    log "PR を即時マージした（公開キューへ追加）"
  else
    die "PR のマージに失敗した: $PR_URL ($PLOG 参照)"
  fi
  MERGED=1
  state_set completed.merge true
  bash scripts/safe-sync-main.sh "$BASE_BRANCH" \
    || log "WARN: マージ後の $BASE_BRANCH 同期に失敗。次回は安全同期から再開する"
fi

# ---------- サマリー ----------
clear_retry_pending
log "=== auto-publish 完了"
{
  echo ""
  echo "  記事        : $ARTICLE"
  echo "  PR          : $PR_URL"
  if [ "$AUTO_MERGE" = 1 ]; then
    echo "  マージ      : $([ "$MERGED" = 1 ] && echo '実行/予約済み（published:falseでキュー追加）' || echo '実行済み（resume）')"
    echo "  次のアクション: AI非依存ワーカーが投稿枠に合わせて1件ずつ公開"
  else
    echo "  マージ      : 未実施（人間がPRを確認して公開キューへ追加）"
  fi
  echo "  ログ一式    : $PIPE_DIR"
} | tee -a "$PLOG" >&2
echo "RESULT: ok $PR_URL"
