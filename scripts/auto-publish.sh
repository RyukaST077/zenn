#!/usr/bin/env bash
# auto-publish.sh - Zenn記事 自動投稿パイプライン オーケストレーター
#
# 各スキルを非対話の claude コマンド（claude -p "/skill ..."）で順番に実行する。
#
#   search-topic → plan-practice → run-practice → draft-article
#     → [ review-article ⇄ revise-article ]×最大N回 → publish-pr → (auto-merge)
#
# 使い方:
#   bash scripts/auto-publish.sh                     # 1サイクル実行（PR作成まで。マージは人間）
#   bash scripts/auto-publish.sh --auto-merge        # PRの自動マージまで行う（完全自律）
#   bash scripts/auto-publish.sh --resume <dir>      # 失敗したパイプラインを途中から再開
#   bash scripts/auto-publish.sh --max-rounds 5      # レビューループ上限の変更（既定3）
#   bash scripts/auto-publish.sh --search-args "..." # search-topic への引数（関心領域など）
#   bash scripts/auto-publish.sh --dry-run           # 実行計画と設定を表示して終了
#
# モデル/effort（既定: 全段 Opus / medium。環境変数で上書き）:
#   AP_MODEL=sonnet AP_EFFORT=high bash scripts/auto-publish.sh
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
: "${AP_MODEL=opus}"       # 全段のモデル（alias可: opus/sonnet/fable。空=CLI の既定に従う）
: "${AP_EFFORT=medium}"    # 全段の effort（low/medium/high/xhigh/max。空=既定）
# ※ CLAUDE_MODEL/CLAUDE_EFFORT という名前は Claude Code 自身が環境に export する値と
#   衝突する（claude 経由で起動すると意図しない値が漏れ込む）ため AP_ 接頭辞にしている
: "${MAX_REVIEW_ROUNDS:=3}"
: "${BASE_BRANCH:=main}"
: "${MERGE_METHOD:=--squash}"

MODEL_FLAGS=""
if [ -n "$AP_MODEL" ];  then MODEL_FLAGS="$MODEL_FLAGS --model $AP_MODEL"; fi
if [ -n "$AP_EFFORT" ]; then MODEL_FLAGS="$MODEL_FLAGS --effort $AP_EFFORT"; fi

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

# ---------- 共通ヘルパー ----------
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
TS="$(date +%Y%m%d-%H%M%S)"

if [ -n "$RESUME_DIR" ]; then
  PIPE_DIR="$RESUME_DIR"
  [ -f "$PIPE_DIR/state.sh" ] || { echo "resume 対象に state.sh が無い: $PIPE_DIR" >&2; exit 2; }
else
  PIPE_DIR="logs/pipeline-$TS"
fi
STATE="$PIPE_DIR/state.sh"
PLOG="$PIPE_DIR/pipeline.log"

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
save_state() { printf "%s='%s'\n" "$1" "$2" >> "$STATE"; }

TIMEOUT_BIN="$(command -v timeout || command -v gtimeout || true)"

# run_claude <段名> <ログファイル> <プロンプト>
run_claude() {
  local name="$1" logfile="$2" prompt="$3" rc=0
  local secs turns
  secs="$(stage_timeout "$name")"; turns="$(stage_turns "$name")"
  log "── $name 開始 (timeout=${secs}s, max-turns=$turns)"
  log "   prompt: $prompt"
  set +e
  if [ -n "$TIMEOUT_BIN" ]; then
    "$TIMEOUT_BIN" "$secs" "$CLAUDE_BIN" -p "$prompt" $CLAUDE_FLAGS $MODEL_FLAGS --max-turns "$turns" >"$logfile" 2>&1
  else
    [ -n "${WARNED_TIMEOUT:-}" ] || { log "WARN: timeout/gtimeout が無いためタイムアウト無しで実行する"; WARNED_TIMEOUT=1; }
    "$CLAUDE_BIN" -p "$prompt" $CLAUDE_FLAGS $MODEL_FLAGS --max-turns "$turns" >"$logfile" 2>&1
  fi
  rc=$?
  set -e
  if [ "$rc" = 124 ]; then die "$name がタイムアウトした (${secs}s)。ログ: $logfile"; fi
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
  local name="$1" idx="$2" dir="$3" mode="$4" pat="$5" prompt="$6"
  local marker="$PIPE_DIR/.marker-$idx-$name" logfile="$PIPE_DIR/$idx-$name.log" artifact
  touch "$marker"
  run_claude "$name" "$logfile" "$prompt"
  artifact="$(newest_since "$marker" "$dir" "$mode" "$pat")"
  [ -n "$artifact" ] || die "$name: 成果物 ($dir $pat) が作られなかった（スキルが中断した可能性）。ログ: $logfile"
  log "   $name 完了 → $artifact"
  echo "$artifact"
}

# レビューレポートの判定を読む: pass / fix / blocker / unknown
verdict_of() {
  local line
  line="$(grep -m1 -E '判定[:：]' "$1" || true)"
  case "$line" in
    *公開不可*) echo blocker ;;
    *要修正*)   echo fix ;;
    *公開可*)   echo pass ;;
    *)          echo unknown ;;
  esac
}

# ---------- dry-run ----------
if [ "$DRY_RUN" = 1 ]; then
  cat <<EOF
[dry-run] 実行計画:
  作業ディレクトリ : $ROOT
  パイプラインdir  : $PIPE_DIR
  claude           : $CLAUDE_BIN $CLAUDE_FLAGS$MODEL_FLAGS
  timeout コマンド : ${TIMEOUT_BIN:-（無し: タイムアウト無効）}
  レビューループ   : 最大 $MAX_REVIEW_ROUNDS 回
  auto-merge       : $([ "$AUTO_MERGE" = 1 ] && echo ON || echo OFF（PR作成まで）)
  段:
    1. /search-topic${SEARCH_ARGS:+ $SEARCH_ARGS}            → research/search-topic-*.md
    2. /plan-practice <レポート>                → practice/practice-*.md
    3. /run-practice <タスク>                   → logs/run-*/execution-log.md
    4. /draft-article <ログ>                    → articles/<slug>.md
    5. /review-article ⇄ /revise-article        → 判定「公開可」までループ
    6. /publish-pr <記事>                       → feature ブランチ + PR
    7. $([ "$AUTO_MERGE" = 1 ] && echo "gh pr merge (auto)" || echo "（マージは人間が行う）")
EOF
  exit 0
fi

# ---------- 前提チェック・多重起動防止 ----------
command -v "$CLAUDE_BIN" >/dev/null || { echo "claude コマンドが見つからない" >&2; exit 2; }
HAS_GH=0; command -v gh >/dev/null && HAS_GH=1

LOCK="$ROOT/.auto-publish.lock"
if ! mkdir "$LOCK" 2>/dev/null; then
  echo "別のパイプラインが実行中（$LOCK が存在）。前回異常終了なら手で削除する。" >&2
  exit 2
fi
trap 'rmdir "$LOCK" 2>/dev/null || true' EXIT

mkdir -p "$PIPE_DIR"
touch "$STATE" "$PLOG"
# shellcheck disable=SC1090
. "$STATE"   # resume 時は前回の成果物パス・完了フラグを読み込む

log "=== auto-publish 開始 (pipeline: $PIPE_DIR)$( [ -n "$RESUME_DIR" ] && echo ' [resume]' )"

# ---------- Git 状態のリセット ----------
if [ -z "${DONE_gitreset:-}" ]; then
  current_branch="$(git rev-parse --abbrev-ref HEAD)"
  [ "$current_branch" = "$BASE_BRANCH" ] || { log "ブランチ $current_branch → $BASE_BRANCH へ切替"; git checkout "$BASE_BRANCH"; }
  # 追跡ファイルの未コミット変更があると publish-pr のブランチ操作が汚れるため中止
  if git status --porcelain | grep -qv '^??'; then
    die "追跡ファイルに未コミットの変更がある。コミットか退避をしてから実行する"
  fi
  git remote get-url origin >/dev/null 2>&1 && { git pull --ff-only || log "WARN: git pull に失敗（オフライン?）。ローカルの $BASE_BRANCH で続行"; }
  save_state DONE_gitreset 1
fi

# ---------- 1. search-topic ----------
if [ -z "${DONE_search:-}" ]; then
  REPORT="$(run_stage search 1 research -name 'search-topic-*.md' "/search-topic${SEARCH_ARGS:+ $SEARCH_ARGS}")"
  save_state REPORT "$REPORT"; save_state DONE_search 1
else log "skip: search-topic (実行済み → $REPORT)"; fi

# ---------- 2. plan-practice ----------
if [ -z "${DONE_plan:-}" ]; then
  TASK="$(run_stage plan 2 practice -name 'practice-*.md' "/plan-practice 対象レポート: $REPORT")"
  save_state TASK "$TASK"; save_state DONE_plan 1
else log "skip: plan-practice (実行済み → $TASK)"; fi

# ---------- 3. run-practice ----------
if [ -z "${DONE_run:-}" ]; then
  RUNLOG="$(run_stage run 3 logs -path 'logs/run-*/execution-log.md' "/run-practice 対象タスクファイル: $TASK")"
  save_state RUNLOG "$RUNLOG"; save_state DONE_run 1
else log "skip: run-practice (実行済み → $RUNLOG)"; fi

# ---------- 4. draft-article ----------
if [ -z "${DONE_draft:-}" ]; then
  ARTICLE="$(run_stage draft 4 articles -name '*.md' "/draft-article 対象ログ: $RUNLOG")"
  save_state ARTICLE "$ARTICLE"; save_state DONE_draft 1
else log "skip: draft-article (実行済み → $ARTICLE)"; fi

# ---------- 5. review ⇄ revise ループ ----------
if [ -z "${DONE_review:-}" ]; then
  round=1
  while :; do
    REVIEW="$(run_stage review "5-$round" logs -name 'review-*.md' \
      "/review-article 対象記事: $ARTICLE 出典ログ: $RUNLOG")"
    save_state REVIEW "$REVIEW"
    verdict="$(verdict_of "$REVIEW")"
    log "   レビュー判定 (round $round/$MAX_REVIEW_ROUNDS): $verdict"
    case "$verdict" in
      pass) break ;;
      unknown) die "レビューレポートから判定を読み取れなかった: $REVIEW" ;;
      fix|blocker)
        [ "$round" -lt "$MAX_REVIEW_ROUNDS" ] || die "レビュー $MAX_REVIEW_ROUNDS 回で公開可にならず中断。最終レポート: $REVIEW"
        revlog="$PIPE_DIR/5-$round-revise.log"
        run_claude revise "$revlog" \
          "/revise-article 対象記事: $ARTICLE レビューレポート: $REVIEW 出典ログ: $RUNLOG"
        result="$(grep -E '^RESULT:' "$revlog" | tail -1 || true)"
        case "$result" in
          RESULT:\ ok\ *)
            new_article="${result#RESULT: ok }"
            [ -f "$new_article" ] || die "revise-article が返したパスが存在しない: $new_article"
            if [ "$new_article" != "$ARTICLE" ]; then
              log "   slug リネーム検出: $ARTICLE → $new_article"
              ARTICLE="$new_article"; save_state ARTICLE "$ARTICLE"
            fi ;;
          RESULT:\ abort\ *) die "revise-article が中止した: ${result#RESULT: abort }" ;;
          *) die "revise-article の RESULT 行が無い（契約違反）。ログ: $revlog" ;;
        esac
        round=$((round + 1)) ;;
    esac
  done
  save_state DONE_review 1
else log "skip: review ループ（実行済み・公開可）"; fi

# ---------- 6. publish-pr ----------
SLUG="$(basename "$ARTICLE" .md)"
if [ -z "${DONE_publish:-}" ]; then
  publog="$PIPE_DIR/6-publish.log"
  run_claude publish "$publog" "/publish-pr 対象記事: $ARTICLE"
  PR_URL="$(grep -oE 'https://github\.com/[^ ")]+/pull/[0-9]+' "$publog" | head -1 || true)"
  if [ -z "$PR_URL" ] && [ "$HAS_GH" = 1 ]; then
    PR_URL="$(gh pr list --head "publish/$SLUG" --json url --jq '.[0].url' 2>/dev/null || true)"
  fi
  [ -n "$PR_URL" ] || die "publish-pr: PR を確認できなかった（公開ゲートで中止した可能性）。ログ: $publog"
  save_state PR_URL "$PR_URL"; save_state DONE_publish 1
  log "   PR 作成: $PR_URL"
else log "skip: publish-pr (実行済み → $PR_URL)"; fi

# publish-pr は feature ブランチに残るため、次サイクルに備えて main へ戻す
git checkout "$BASE_BRANCH" >/dev/null 2>&1 || true

# ---------- 7. auto-merge（--auto-merge 指定時のみ） ----------
MERGED=0
if [ "$AUTO_MERGE" = 1 ] && [ -z "${DONE_merge:-}" ]; then
  [ "$HAS_GH" = 1 ] || die "--auto-merge には gh CLI が必要"
  # branch protection があれば --auto（必須チェック通過後にマージ）、無ければ即時マージ
  if gh pr merge "$PR_URL" "$MERGE_METHOD" --auto --delete-branch >>"$PLOG" 2>&1; then
    log "auto-merge を予約した（必須チェック通過後にマージ→公開される）"
  elif gh pr merge "$PR_URL" "$MERGE_METHOD" --delete-branch >>"$PLOG" 2>&1; then
    log "PR を即時マージした（Zenn へ公開される）"
  else
    die "PR のマージに失敗した: $PR_URL ($PLOG 参照)"
  fi
  MERGED=1
  save_state DONE_merge 1
  git pull --ff-only >/dev/null 2>&1 || true
fi

# ---------- サマリー ----------
log "=== auto-publish 完了"
{
  echo ""
  echo "  記事        : $ARTICLE"
  echo "  PR          : $PR_URL"
  if [ "$AUTO_MERGE" = 1 ]; then
    echo "  マージ      : $([ "$MERGED" = 1 ] && echo '実行/予約済み（マージ＝Zenn公開）' || echo '実行済み（resume）')"
    echo "  次のアクション: 公開後に zenn.dev で表示確認（slug 衝突時は revise でリネーム→再PR）"
  else
    echo "  マージ      : 未実施（人間が PR を確認してマージ＝公開）"
  fi
  echo "  ログ一式    : $PIPE_DIR"
} | tee -a "$PLOG" >&2
echo "RESULT: ok $PR_URL"
