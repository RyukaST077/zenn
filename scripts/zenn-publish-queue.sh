#!/usr/bin/env bash
# Publish or reconcile at most one queued Zenn article. This worker is deterministic and uses no AI.
set -euo pipefail

: "${PUBLISH_QUEUE_BASE_BRANCH:=main}"
: "${PUBLISH_QUEUE_MERGE_METHOD:=--squash}"
: "${PUBLISH_QUEUE_FILE:=config/zenn-publish-queue.json}"
: "${PUBLISH_QUEUE_API_URL:=}"

DRY_RUN=0
AUTO_MERGE=1
NOW=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --pr-only) AUTO_MERGE=0 ;;
    --now) NOW="${2:?--now requires an ISO timestamp}"; shift ;;
    -h|--help) sed -n '1,90p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
  shift
done
case "$PUBLISH_QUEUE_MERGE_METHOD" in
  --merge|--rebase|--squash) ;;
  *) echo "PUBLISH_QUEUE_MERGE_METHOD must be --merge, --rebase, or --squash" >&2; exit 2 ;;
esac

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
command -v git >/dev/null 2>&1 || { echo "git is required" >&2; exit 2; }
command -v node >/dev/null 2>&1 || { echo "node is required" >&2; exit 2; }
command -v curl >/dev/null 2>&1 || { echo "curl is required" >&2; exit 2; }

TMP_BASE="${TMPDIR:-/tmp}"
WORK_DIR="$(mktemp -d "$TMP_BASE/zenn-publish-queue.XXXXXX")"
WORKTREE=""
WORKTREE_ACTIVE=0
LOCK="$ROOT/.zenn-publish-queue.lock"
LOCK_ACTIVE=0
cleanup() {
  if [ "$WORKTREE_ACTIVE" = 1 ]; then
    git -C "$ROOT" worktree remove --force "$WORKTREE" >/dev/null 2>&1 || true
  fi
  [ "$LOCK_ACTIVE" = 0 ] || rmdir "$LOCK" 2>/dev/null || true
  [ ! -d "$WORK_DIR" ] || rm -rf "$WORK_DIR"
}
trap cleanup EXIT

if [ "$DRY_RUN" = 0 ]; then
  for other_lock in "$ROOT/.auto-publish.lock" "$ROOT/.auto-publish-codex.lock" "$ROOT/.agent-practice-pipeline.lock"; do
    if [ -d "$other_lock" ]; then
      echo "RESULT: skipped (another article pipeline holds $other_lock)"
      exit 0
    fi
  done
  if ! mkdir "$LOCK" 2>/dev/null; then
    echo "RESULT: skipped (another publication queue worker is running)"
    exit 0
  fi
  LOCK_ACTIVE=1
fi

# Always inspect and mutate a fresh origin snapshot. The shared checkout may be
# behind, on another branch, or contain user-owned changes and untracked files.
GIT_TERMINAL_PROMPT=0 git -C "$ROOT" fetch --quiet origin "$PUBLISH_QUEUE_BASE_BRANCH"
WORKTREE="$WORK_DIR/worktree"
git -C "$ROOT" worktree add --detach "$WORKTREE" "origin/$PUBLISH_QUEUE_BASE_BRANCH" >/dev/null
WORKTREE_ACTIVE=1
QUEUE_TOOL="$WORKTREE/scripts/zenn-publish-queue.mjs"
[ -f "$QUEUE_TOOL" ] || { echo "queue tool is missing: $QUEUE_TOOL" >&2; exit 2; }
(cd "$WORKTREE" && node "$QUEUE_TOOL" validate --queue "$PUBLISH_QUEUE_FILE") >/dev/null

API_JSON="$WORK_DIR/zenn-articles.json"
if [ -n "${PUBLISH_QUEUE_API_FILE:-}" ]; then
  cp "$PUBLISH_QUEUE_API_FILE" "$API_JSON"
else
  if [ -z "$PUBLISH_QUEUE_API_URL" ]; then
    ZENN_USER="$(node -e 'const q=require(process.argv[1]); process.stdout.write(q.zennUsername)' "$WORKTREE/$PUBLISH_QUEUE_FILE")"
    PUBLISH_QUEUE_API_URL="https://zenn.dev/api/articles?username=$ZENN_USER&order=latest"
  fi
  curl --fail --silent --show-error --location --retry 2 --max-time 30 \
    "$PUBLISH_QUEUE_API_URL" >"$API_JSON"
fi

DECIDE_ARGS=(decide --queue "$PUBLISH_QUEUE_FILE" --api-json "$API_JSON")
[ -z "$NOW" ] || DECIDE_ARGS+=(--now "$NOW")
PLAN="$(cd "$WORKTREE" && node "$QUEUE_TOOL" "${DECIDE_ARGS[@]}")"
printf '%s\n' "$PLAN"
ACTION="$(node -e 'const p=JSON.parse(process.argv[1]); process.stdout.write(p.action)' "$PLAN")"
case "$ACTION" in
  empty|wait_rate_limit|wait_retry_backoff) exit 0 ;;
  publish|retry|reconcile) ;;
  *) echo "unsupported queue decision: $ACTION" >&2; exit 2 ;;
esac
[ "$DRY_RUN" = 0 ] || exit 0

command -v gh >/dev/null 2>&1 || { echo "gh is required" >&2; exit 2; }
GH_PROMPT_DISABLED=1 gh auth status >/dev/null 2>&1 || { echo "GitHub CLI is not authenticated" >&2; exit 2; }
ARTICLE="$(node -e 'const p=JSON.parse(process.argv[1]); process.stdout.write(p.article)' "$PLAN")"
SLUG="$(node -e 'const p=JSON.parse(process.argv[1]); process.stdout.write(p.slug)' "$PLAN")"
TS="$(date +%Y%m%d-%H%M%S)"
BRANCH="publish-queue/$ACTION-$SLUG-$TS"
git -C "$WORKTREE" switch -c "$BRANCH" >/dev/null

APPLY_ARGS=(apply --queue "$PUBLISH_QUEUE_FILE" --action "$ACTION" --slug "$SLUG")
[ -z "$NOW" ] || APPLY_ARGS+=(--now "$NOW")
(cd "$WORKTREE" && node "$QUEUE_TOOL" "${APPLY_ARGS[@]}") >/dev/null
git -C "$WORKTREE" add -- "$PUBLISH_QUEUE_FILE" "$ARTICLE"
STAGED="$(git -C "$WORKTREE" diff --cached --name-only)"
[ -n "$STAGED" ] || { echo "queue action produced no changes" >&2; exit 2; }
while IFS= read -r staged_path; do
  case "$staged_path" in "$PUBLISH_QUEUE_FILE"|"$ARTICLE") ;; *) echo "disallowed staged path: $staged_path" >&2; exit 2 ;; esac
done <<EOF
$STAGED
EOF
git -C "$WORKTREE" diff --cached --check

case "$ACTION" in
  publish) COMMIT_MESSAGE="publish: $SLUG from queue"; PR_TITLE="$COMMIT_MESSAGE" ;;
  retry) COMMIT_MESSAGE="chore: retry Zenn publish for $SLUG"; PR_TITLE="$COMMIT_MESSAGE" ;;
  reconcile) COMMIT_MESSAGE="chore: confirm Zenn publish for $SLUG"; PR_TITLE="$COMMIT_MESSAGE" ;;
esac
git -C "$WORKTREE" commit -m "$COMMIT_MESSAGE" >/dev/null
GIT_TERMINAL_PROMPT=0 git -C "$WORKTREE" push --set-upstream origin "$BRANCH" >/dev/null

PR_BODY="$WORK_DIR/pr-body.md"
printf 'AIを使わない公開キューワーカーによる自動更新です。\n\n- action: `%s`\n- article: `%s`\n- remaining before action: `%s`\n' \
  "$ACTION" "$ARTICLE" "$(node -e 'const p=JSON.parse(process.argv[1]); process.stdout.write(String(p.pending))' "$PLAN")" >"$PR_BODY"
git -C "$ROOT" worktree remove --force "$WORKTREE" >/dev/null
WORKTREE_ACTIVE=0
PR_URL="$(GH_PROMPT_DISABLED=1 gh pr create --base "$PUBLISH_QUEUE_BASE_BRANCH" --head "$BRANCH" --title "$PR_TITLE" --body-file "$PR_BODY")"
if [ "$AUTO_MERGE" = 1 ]; then
  if GH_PROMPT_DISABLED=1 gh pr merge "$PR_URL" "$PUBLISH_QUEUE_MERGE_METHOD" --delete-branch; then
    MERGE_RESULT="merged"
  elif GH_PROMPT_DISABLED=1 gh pr merge "$PR_URL" "$PUBLISH_QUEUE_MERGE_METHOD" --auto --delete-branch; then
    MERGE_RESULT="auto-merge requested"
  else
    echo "PR merge failed: $PR_URL" >&2
    exit 1
  fi
else
  MERGE_RESULT="PR created; waiting for human merge"
fi
printf 'RESULT: %s\nArticle: %s\nPR: %s\nMerge: %s\n' "$ACTION" "$ARTICLE" "$PR_URL" "$MERGE_RESULT"
