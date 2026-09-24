#!/usr/bin/env bash
# Repair an existing queue PR; --merge explicitly authorizes merging its approved head.
set -euo pipefail
if [ "${ARTICLE_PIPELINE_ISOLATED_WORKTREE:-0}" != 1 ]; then
  ENTRY_ROOT="$(git rev-parse --show-toplevel)"
  git -C "$ENTRY_ROOT" show HEAD:scripts/run-article-pipeline-worktree.sh |
    bash -s -- --shared-root "$ENTRY_ROOT" -- scripts/agent-practice/recover-queue-pr.sh "$@"
  exit $?
fi
[ "${ARTICLE_PIPELINE_MODE:-normal}" != development ] || {
  echo 'publication prohibited in development mode' >&2; exit 2;
}
exec node "$(cd "$(dirname "$0")" && pwd)/recover-queue-pr.mjs" "$@"
