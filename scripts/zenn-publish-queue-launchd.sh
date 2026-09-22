#!/bin/bash
# Hourly launchd wrapper for the deterministic Zenn publication queue worker.
set -uo pipefail

# Entrypoints dispatch before parsing (preserve all original arguments).
if [ "${ARTICLE_PIPELINE_ISOLATED_WORKTREE:-0}" != 1 ]; then
  case " $* " in
    *" --dry-run "*|*" --help "*) ;;
    *)
      ENTRY_ROOT="$(git rev-parse --show-toplevel)" || exit 2
      git -C "$ENTRY_ROOT" show HEAD:scripts/run-article-pipeline-worktree.sh | \
        bash -s -- --shared-root "$ENTRY_ROOT" -- scripts/zenn-publish-queue-launchd.sh "$@"
      exit $?
      ;;
  esac
fi

export PATH="/Users/katayamaryuunosuke/.local/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/Users/katayamaryuunosuke/.nvm/versions/node/v22.17.0/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
REPO="${ARTICLE_PIPELINE_RUN_DIR:+$(git rev-parse --show-toplevel)}"
: "${REPO:=/Users/katayamaryuunosuke/workspace/024_zenn}"
cd "$REPO" || { echo "cannot cd to $REPO" >&2; exit 1; }

LOG_DIR="$REPO/logs/launchd"
mkdir -p "$LOG_DIR"
find "$LOG_DIR" -type f -name 'zenn-publish-queue-*.log' -mtime +30 -delete 2>/dev/null || true
LOG="$LOG_DIR/zenn-publish-queue-$(date +%Y%m%d-%H%M%S).log"

{
  echo "===== Zenn publish queue start: $(date) ====="
  bash "$REPO/scripts/zenn-publish-queue.sh"
  rc=$?
  echo "===== Zenn publish queue end: $(date) exit=$rc ====="
  exit "$rc"
} >>"$LOG" 2>&1
