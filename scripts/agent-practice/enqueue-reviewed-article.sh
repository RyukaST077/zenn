#!/usr/bin/env bash
# Add one reviewed article to the deterministic Zenn publication queue.
set -euo pipefail

: "${AGENT_PIPELINE_BASE_BRANCH:=main}"
: "${AGENT_PIPELINE_MERGE_METHOD:=--squash}"
: "${PUBLISH_QUEUE_FILE:=config/zenn-publish-queue.json}"

ARTICLE=""
REVIEW=""
PIPE_DIR=""
AUTO_MERGE=1
REVIEW_STYLE="agent"
while [ "$#" -gt 0 ]; do
  case "$1" in
    --article) ARTICLE="${2:?--article requires a path}"; shift ;;
    --review) REVIEW="${2:?--review requires a path}"; shift ;;
    --pipeline) PIPE_DIR="${2:?--pipeline requires a path}"; shift ;;
    --review-style) REVIEW_STYLE="${2:?--review-style requires agent, codex, or claude}"; shift ;;
    --auto-merge) AUTO_MERGE=1 ;;
    --pr-only) AUTO_MERGE=0 ;;
    -h|--help) sed -n '1,90p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
  shift
done

safe_relative() {
  case "$1" in ""|/*|..|../*|*/..|*/../*) return 1 ;; *) return 0 ;; esac
}
safe_relative "$ARTICLE" || { echo "invalid article path: $ARTICLE" >&2; exit 2; }
safe_relative "$REVIEW" || { echo "invalid review path: $REVIEW" >&2; exit 2; }
safe_relative "$PIPE_DIR" || { echo "invalid pipeline path: $PIPE_DIR" >&2; exit 2; }
case "$ARTICLE" in articles/*.md) ;; *) echo "article must be under articles/: $ARTICLE" >&2; exit 2 ;; esac
case "$REVIEW_STYLE" in
  agent)
    case "$REVIEW" in logs/agent/*.md) ;; *) echo "agent review must be under logs/agent/: $REVIEW" >&2; exit 2 ;; esac
    case "$PIPE_DIR" in logs/agent/pipeline-*) ;; *) echo "invalid agent pipeline directory: $PIPE_DIR" >&2; exit 2 ;; esac
    ;;
  codex)
    case "$REVIEW" in logs/review-*.md) ;; *) echo "Codex review must match logs/review-*.md: $REVIEW" >&2; exit 2 ;; esac
    case "$PIPE_DIR" in logs/codex-pipeline-*) ;; *) echo "invalid Codex pipeline directory: $PIPE_DIR" >&2; exit 2 ;; esac
    ;;
  claude)
    case "$REVIEW" in logs/review-*.md) ;; *) echo "Claude review must match logs/review-*.md: $REVIEW" >&2; exit 2 ;; esac
    case "$PIPE_DIR" in logs/pipeline-*) ;; *) echo "invalid Claude pipeline directory: $PIPE_DIR" >&2; exit 2 ;; esac
    ;;
  *) echo "--review-style must be agent, codex, or claude" >&2; exit 2 ;;
esac
case "$AGENT_PIPELINE_MERGE_METHOD" in
  --merge|--rebase|--squash) ;;
  *) echo "AGENT_PIPELINE_MERGE_METHOD must be --merge, --rebase, or --squash" >&2; exit 2 ;;
esac

SOURCE_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
PLOG="$ROOT/$PIPE_DIR/pipeline.log"
mkdir -p "$ROOT/$PIPE_DIR"
touch "$PLOG"
log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*" | tee -a "$PLOG" >&2; }
die() { log "ERROR: $*"; exit 1; }

[ -f "$ROOT/$ARTICLE" ] || die "article does not exist: $ARTICLE"
[ -f "$ROOT/$REVIEW" ] || die "review does not exist: $REVIEW"
[ "$(git branch --show-current)" = "$AGENT_PIPELINE_BASE_BRANCH" ] \
  || die "current branch must be $AGENT_PIPELINE_BASE_BRANCH"
if git status --porcelain --untracked-files=no | grep -q .; then
  die "tracked files contain uncommitted changes"
fi
command -v gh >/dev/null 2>&1 || die "gh is required"
command -v node >/dev/null 2>&1 || die "node is required"
GH_PROMPT_DISABLED=1 gh auth status >/dev/null 2>&1 || die "GitHub CLI is not authenticated"

ARTICLE_CHECK_TOOL="$SOURCE_ROOT/scripts/check-article.mjs"
QUEUE_TOOL="$SOURCE_ROOT/scripts/zenn-publish-queue.mjs"
SAFE_SYNC_TOOL="$SOURCE_ROOT/scripts/safe-sync-main.sh"
[ -f "$ARTICLE_CHECK_TOOL" ] || die "article checker is missing"
[ -f "$QUEUE_TOOL" ] || die "publication queue tool is missing"
[ -x "$SAFE_SYNC_TOOL" ] || die "safe sync helper is missing or not executable"
(cd "$ROOT" && node "$ARTICLE_CHECK_TOOL" "$ARTICLE" --expect-published false) \
  || die "draft article check failed"
case "$REVIEW_STYLE" in
  agent|codex)
    [ "$(grep -c '^verdict: pass$' "$ROOT/$REVIEW" || true)" = 1 ] \
      || die "review must contain exactly one verdict: pass"
    [ "$(grep -c '^blockers: 0$' "$ROOT/$REVIEW" || true)" = 1 ] \
      || die "passing review must declare blockers: 0"
    [ "$(grep -c '^warnings: 0$' "$ROOT/$REVIEW" || true)" = 1 ] \
      || die "passing review must declare warnings: 0"
    ;;
  claude)
    [ "$(grep -Ec '^\*\*判定: 公開可\*\*$' "$ROOT/$REVIEW" || true)" = 1 ] \
      || die "passing Claude review must contain exactly one 判定: 公開可"
    [ "$(grep -c 'blocker: 0 件 / warning: 0 件' "$ROOT/$REVIEW" || true)" -ge 1 ] \
      || die "passing Claude review must declare blocker and warning counts as zero"
    ;;
esac
if [ "$REVIEW_STYLE" = agent ]; then
  EDITORIAL_SCORE="$(sed -nE 's/^editorial_score: ([0-9]{1,3})\/100$/\1/p' "$ROOT/$REVIEW")"
  [ -n "$EDITORIAL_SCORE" ] && [ "$EDITORIAL_SCORE" -ge 80 ] && [ "$EDITORIAL_SCORE" -le 100 ] \
    || die "passing review editorial score must be 80-100"
fi

SLUG="$(basename "$ARTICLE" .md)"
TS="$(date +%Y%m%d-%H%M%S)"
BRANCH="queue/$SLUG"
if git show-ref --verify --quiet "refs/heads/$BRANCH" \
    || GIT_TERMINAL_PROMPT=0 git ls-remote --exit-code --heads origin "$BRANCH" >/dev/null 2>&1; then
  BRANCH="$BRANCH-$TS"
fi

TMP_BASE="${TMPDIR:-/tmp}"
WORKTREE="$(mktemp -d "$TMP_BASE/zenn-reviewed-enqueue.XXXXXX")"
WORKTREE_ACTIVE=0
cleanup_worktree() {
  if [ "$WORKTREE_ACTIVE" = 1 ]; then
    git -C "$ROOT" worktree remove --force "$WORKTREE" >/dev/null 2>&1 \
      || log "WARN: failed to remove temporary queue worktree: $WORKTREE"
    WORKTREE_ACTIVE=0
  fi
  [ ! -d "$WORKTREE" ] || rmdir "$WORKTREE" 2>/dev/null || true
}
trap cleanup_worktree EXIT

git worktree add -b "$BRANCH" "$WORKTREE" "$AGENT_PIPELINE_BASE_BRANCH" >/dev/null \
  || die "failed to create isolated queue worktree"
WORKTREE_ACTIVE=1
mkdir -p "$WORKTREE/$(dirname "$ARTICLE")"
cp "$ROOT/$ARTICLE" "$WORKTREE/$ARTICLE"
if [ -d "$ROOT/images/$SLUG" ]; then
  mkdir -p "$WORKTREE/images"
  cp -R "$ROOT/images/$SLUG" "$WORKTREE/images/$SLUG"
fi

ENQUEUE_ARGS=(enqueue --queue "$PUBLISH_QUEUE_FILE" --article "$ARTICLE")
[ -z "${PUBLISH_QUEUE_NOW:-}" ] || ENQUEUE_ARGS+=(--now "$PUBLISH_QUEUE_NOW")
(cd "$WORKTREE" && node "$QUEUE_TOOL" "${ENQUEUE_ARGS[@]}") >/dev/null \
  || die "failed to add article to publication queue"
git -C "$WORKTREE" add -- "$ARTICLE" "$PUBLISH_QUEUE_FILE"
[ ! -d "$WORKTREE/images/$SLUG" ] || git -C "$WORKTREE" add -- "images/$SLUG"
STAGED="$(git -C "$WORKTREE" diff --cached --name-only)"
[ -n "$STAGED" ] || die "nothing was staged for the publication queue"
while IFS= read -r staged_path; do
  case "$staged_path" in "$ARTICLE"|"$PUBLISH_QUEUE_FILE"|images/"$SLUG"/*) ;; *) die "disallowed staged path: $staged_path" ;; esac
done <<EOF
$STAGED
EOF
git -C "$WORKTREE" diff --cached --check || die "staged queue diff failed whitespace checks"
git -C "$WORKTREE" commit -m "queue: $SLUG for Zenn publication" >/dev/null \
  || die "queue commit failed"
COMMIT="$(git -C "$WORKTREE" rev-parse HEAD)"
GIT_TERMINAL_PROMPT=0 git -C "$WORKTREE" push --set-upstream origin "$BRANCH" >/dev/null \
  || die "queue push failed"

cleanup_worktree
PR_BODY="$ROOT/$PIPE_DIR/queue-pr-body.md"
printf 'レビュー合格済みの記事をZenn公開キューへ追加します。公開はAI非依存ワーカーが1件ずつ行います。\n\n- article: `%s`\n- review: `%s`\n' \
  "$ARTICLE" "$REVIEW" >"$PR_BODY"
PR_URL="$(GH_PROMPT_DISABLED=1 gh pr create --base "$AGENT_PIPELINE_BASE_BRANCH" --head "$BRANCH" \
  --title "queue: $SLUG for Zenn publication" --body-file "$PR_BODY")" \
  || die "PR creation failed"
if [ "$AUTO_MERGE" = 1 ]; then
  if GH_PROMPT_DISABLED=1 gh pr merge "$PR_URL" "$AGENT_PIPELINE_MERGE_METHOD" --delete-branch; then
    MERGE_RESULT="merged immediately"
  elif GH_PROMPT_DISABLED=1 gh pr merge "$PR_URL" "$AGENT_PIPELINE_MERGE_METHOD" --auto --delete-branch; then
    MERGE_RESULT="auto-merge requested"
  else
    die "PR merge failed: $PR_URL"
  fi
  bash "$SAFE_SYNC_TOOL" "$AGENT_PIPELINE_BASE_BRANCH" \
    || log "WARN: could not safely refresh $AGENT_PIPELINE_BASE_BRANCH after merge request"
else
  MERGE_RESULT="PR created; waiting for human merge"
fi

log "queue complete: article=$ARTICLE PR=$PR_URL merge=$MERGE_RESULT"
printf 'Article: %s\nPR: %s\nQueue: %s\nCommit: %s\nMerge: %s\n' \
  "$ARTICLE" "$PR_URL" "$PUBLISH_QUEUE_FILE" "$COMMIT" "$MERGE_RESULT"
