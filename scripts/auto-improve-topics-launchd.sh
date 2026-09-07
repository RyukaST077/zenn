#!/bin/bash
# Daily launchd wrapper for the topic-improvement loop.
#
# Collection must run daily: the D7/D30 observation slots and the age-matched
# market cohorts are built by accumulating snapshots, and a skipped day cannot
# be backfilled from the API.
#
# Evaluation runs on the 1st of the month only. Judging more often just produces
# "insufficient" verdicts, and re-judging the same batch invites reading noise
# as signal.
set -uo pipefail
# The GA4 service-account key and analytics/private/ must not become
# group- or world-readable via a file this job creates.
umask 077

export PATH="/Users/katayamaryuunosuke/.local/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/Users/katayamaryuunosuke/.nvm/versions/node/v22.17.0/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
REPO="/Users/katayamaryuunosuke/workspace/024_zenn"
cd "$REPO" || { echo "cannot cd to $REPO" >&2; exit 1; }

LOG_DIR="$REPO/logs/launchd"
mkdir -p "$LOG_DIR"
find "$LOG_DIR" -type f -name 'improve-topics-*.log' -mtime +60 -delete 2>/dev/null || true
LOG="$LOG_DIR/improve-topics-$(date +%Y%m%d-%H%M%S).log"

ARGS=()
# Sunday: page the market back ~46 days so the d7-14 and d30-45 cohorts fill.
# A daily run only sees the newest page, where nothing is old enough to matter.
if [ "$(date +%u)" = "7" ]; then
  ARGS+=(--deep)
fi
if [ "$(date +%d)" = "01" ]; then
  ARGS+=(--evaluate)
fi

{
  echo "===== improve-topics start: $(date) ====="
  bash "$REPO/scripts/auto-improve-topics.sh" ${ARGS[@]+"${ARGS[@]}"}
  rc=$?
  echo "===== improve-topics end: $(date) exit=$rc ====="
  exit "$rc"
} >>"$LOG" 2>&1
