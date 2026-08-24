#!/usr/bin/env bash
# Run an article pipeline in a detached worktree based on origin/main.
set -uo pipefail

BASE_BRANCH="${ARTICLE_PIPELINE_BASE_BRANCH:-main}"
SHARED_ROOT=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --base) BASE_BRANCH="${2:?--base requires a branch}"; shift 2 ;;
    --shared-root) SHARED_ROOT="${2:?--shared-root requires a path}"; shift 2 ;;
    --) shift; break ;;
    -h|--help)
      echo "usage: $0 [--base branch] [--shared-root path] -- scripts/pipeline.sh [args...]"
      exit 0
      ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
[ "$#" -gt 0 ] || { echo "pipeline command is required" >&2; exit 2; }

if [ -z "$SHARED_ROOT" ]; then
  SHARED_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" \
    || { echo "not inside a Git worktree" >&2; exit 1; }
fi
SHARED_ROOT="$(cd "$SHARED_ROOT" && pwd)"
PIPELINE_SCRIPT="$1"
shift
case "$PIPELINE_SCRIPT" in
  scripts/*.sh)
    case "$PIPELINE_SCRIPT" in */../*|*/..|../*|..) echo "pipeline path traversal is not allowed" >&2; exit 2 ;; esac
    ;;
  *) echo "pipeline must be a repository-relative scripts/*.sh path" >&2; exit 2 ;;
esac
[ -f "$SHARED_ROOT/$PIPELINE_SCRIPT" ] && [ ! -L "$SHARED_ROOT/$PIPELINE_SCRIPT" ] \
  || { echo "pipeline must be a regular file in the shared checkout: $PIPELINE_SCRIPT" >&2; exit 2; }
git -C "$SHARED_ROOT" check-ref-format --branch "$BASE_BRANCH" >/dev/null 2>&1 \
  || { echo "invalid base branch: $BASE_BRANCH" >&2; exit 2; }
git -C "$SHARED_ROOT" remote get-url origin >/dev/null 2>&1 \
  || { echo "origin remote is required" >&2; exit 1; }

echo "[pipeline-worktree] fetching origin/$BASE_BRANCH; shared checkout will not be updated"
GIT_TERMINAL_PROMPT=0 git -C "$SHARED_ROOT" fetch --quiet origin "$BASE_BRANCH" \
  || { echo "failed to fetch origin/$BASE_BRANCH" >&2; exit 1; }

TMP_BASE="${TMPDIR:-/tmp}"
RUN_PARENT="$(mktemp -d "$TMP_BASE/zenn-article-pipeline.XXXXXX")" || exit 1
RUN_WORKTREE="$RUN_PARENT/worktree"
SNAPSHOT="$RUN_PARENT/artifacts-before.json"
WORKTREE_ACTIVE=0
PRESERVE_WORKTREE=0
cleanup() {
  if [ "$WORKTREE_ACTIVE" = 1 ] && [ "$PRESERVE_WORKTREE" = 0 ]; then
    git -C "$SHARED_ROOT" worktree remove --force "$RUN_WORKTREE" >/dev/null 2>&1 || true
    WORKTREE_ACTIVE=0
  fi
  if [ "$PRESERVE_WORKTREE" = 0 ]; then
    rm -f "$SNAPSHOT"
    rmdir "$RUN_PARENT" 2>/dev/null || true
  else
    echo "[pipeline-worktree] preserved after artifact collision: $RUN_WORKTREE" >&2
  fi
}
trap cleanup EXIT

git -C "$SHARED_ROOT" worktree add --detach "$RUN_WORKTREE" "origin/$BASE_BRANCH" >/dev/null \
  || { echo "failed to create detached pipeline worktree" >&2; exit 1; }
WORKTREE_ACTIVE=1

# The scheduler controller is local configuration. Overlay only its bounded
# control scripts so this isolation change takes effect before the next commit;
# article inputs, skills, and repository content still come from origin/base.
for controller in \
  "$PIPELINE_SCRIPT" \
  scripts/safe-sync-main.sh \
  scripts/agent-practice/enqueue-reviewed-article.sh \
  scripts/agent-practice/publish-reviewed-article.sh
do
  if [ -f "$SHARED_ROOT/$controller" ]; then
    mkdir -p "$RUN_WORKTREE/$(dirname "$controller")"
    cp "$SHARED_ROOT/$controller" "$RUN_WORKTREE/$controller"
    git -C "$RUN_WORKTREE" ls-files --error-unmatch -- "$controller" >/dev/null 2>&1 \
      && git -C "$RUN_WORKTREE" update-index --assume-unchanged -- "$controller"
  fi
done

IMPORT_ARTIFACTS=0
previous=""
for argument in "$@"; do
  case "$previous" in --resume|--resume-after-run) IMPORT_ARTIFACTS=1 ;; esac
  previous="$argument"
done
if [ "$IMPORT_ARTIFACTS" = 1 ]; then
  node "$SHARED_ROOT/scripts/isolated-artifacts.mjs" import "$SHARED_ROOT" "$RUN_WORKTREE" \
    || { echo "failed to import resume artifacts" >&2; exit 1; }
fi
node "$SHARED_ROOT/scripts/isolated-artifacts.mjs" snapshot "$RUN_WORKTREE" "$SNAPSHOT" \
  || { echo "failed to snapshot pipeline artifacts" >&2; exit 1; }

echo "[pipeline-worktree] running $PIPELINE_SCRIPT at detached $(git -C "$RUN_WORKTREE" rev-parse --short HEAD)"
set +e
(
  cd "$RUN_WORKTREE" || exit 1
  export ARTICLE_PIPELINE_ISOLATED_WORKTREE=1
  export ARTICLE_PIPELINE_SHARED_ROOT="$SHARED_ROOT"
  export ARTICLE_PIPELINE_LOCK_ROOT="$SHARED_ROOT"
  bash "$RUN_WORKTREE/$PIPELINE_SCRIPT" "$@"
)
PIPELINE_RC=$?
set -e

set +e
node "$SHARED_ROOT/scripts/isolated-artifacts.mjs" sync "$RUN_WORKTREE" "$SHARED_ROOT" "$SNAPSHOT"
SYNC_RC=$?
set -e
if [ "$SYNC_RC" != 0 ]; then
  PRESERVE_WORKTREE=1
  echo "[pipeline-worktree] artifact export failed; shared files were not overwritten" >&2
  exit "$SYNC_RC"
fi

# The pending-resume marker is the one allowed deletion propagated back to the
# shared scheduler state. It is recreated by artifact sync whenever still needed.
if [ ! -f "$RUN_WORKTREE/logs/.auto-publish-resume" ] && [ "$IMPORT_ARTIFACTS" = 1 ]; then
  rm -f "$SHARED_ROOT/logs/.auto-publish-resume"
fi
exit "$PIPELINE_RC"
