#!/bin/bash
set -uo pipefail

export PATH="/Users/katayamaryuunosuke/.local/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/Users/katayamaryuunosuke/.nvm/versions/node/v22.17.0/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
REPO="/Users/katayamaryuunosuke/workspace/024_zenn"
cd "$REPO" || exit 1
mkdir -p "$REPO/logs/launchd"
find "$REPO/logs/launchd" -type f -name 'auto-publish-codex-*.log' -mtime +30 -delete 2>/dev/null || true
LOG="$REPO/logs/launchd/auto-publish-codex-$(date +%Y%m%d-%H%M%S).log"
ARGS="${CODEX_AP_ARGS:-}"
PIPELINE_SCRIPT="${AUTO_PUBLISH_CODEX_SCRIPT:-}"
WORKTREE_RUNNER="$REPO/scripts/run-article-pipeline-worktree.sh"
{
  echo "===== Codex auto-publish start: $(date) ====="
  echo "args: $ARGS"
  if [ -n "$PIPELINE_SCRIPT" ]; then
    # shellcheck disable=SC2086
    bash "$PIPELINE_SCRIPT" $ARGS
  else
    # shellcheck disable=SC2086
    bash "$WORKTREE_RUNNER" --shared-root "$REPO" -- scripts/auto-publish-codex.sh $ARGS
  fi
  rc=$?
  echo "===== Codex auto-publish end: $(date) exit=$rc ====="
  exit "$rc"
} >>"$LOG" 2>&1
