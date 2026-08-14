#!/bin/bash
# Hourly launchd wrapper for the deterministic Zenn publication queue worker.
set -uo pipefail

export PATH="/Users/katayamaryuunosuke/.local/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/Users/katayamaryuunosuke/.nvm/versions/node/v22.17.0/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
REPO="/Users/katayamaryuunosuke/workspace/024_zenn"
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
