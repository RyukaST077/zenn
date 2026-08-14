#!/bin/bash
# launchd wrapper for the separate daily AI coding-agent article pipeline.
set -uo pipefail

export PATH="/Users/katayamaryuunosuke/.local/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/Users/katayamaryuunosuke/.nvm/versions/node/v22.17.0/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

REPO="/Users/katayamaryuunosuke/workspace/024_zenn"
cd "$REPO" || { echo "cannot cd to $REPO" >&2; exit 1; }
PIPELINE_SCRIPT="${AGENT_PRACTICE_SCRIPT:-$REPO/scripts/auto-agent-practice.sh}"

LOG_DIR="$REPO/logs/agent/launchd"
mkdir -p "$LOG_DIR"
TS="$(date +%Y%m%d-%H%M%S)"
LOG="$LOG_DIR/auto-agent-practice-$TS.log"

ARG_TEXT="${AGENT_PRACTICE_ARGS:---scheduled}"
read -r -a AGENT_ARGS <<< "$ARG_TEXT"
: "${AGENT_PRACTICE_MAX_ATTEMPTS:=2}"
: "${AGENT_PIPELINE_RETRYABLE_EXIT:=20}"
case "$AGENT_PRACTICE_MAX_ATTEMPTS" in
  *[!0-9]*|0) echo "AGENT_PRACTICE_MAX_ATTEMPTS must be a positive integer" >&2; exit 2 ;;
esac

{
  echo "===== AI agent practice start: $(date) ====="
  echo "args: ${AGENT_ARGS[*]}"
  echo

  for other_lock in "$REPO/.auto-publish.lock" "$REPO/.auto-publish-codex.lock"; do
    if [ -d "$other_lock" ]; then
      echo "RESULT: skipped (another article pipeline holds $other_lock)"
      echo "===== AI agent practice end: $(date) exit=0 ====="
      exit 0
    fi
  done

  attempt=1
  while :; do
    echo "attempt: $attempt/$AGENT_PRACTICE_MAX_ATTEMPTS"
    AGENT_PIPELINE_RETRYABLE_EXIT="$AGENT_PIPELINE_RETRYABLE_EXIT" \
      bash "$PIPELINE_SCRIPT" "${AGENT_ARGS[@]}"
    rc=$?
    if [ "$rc" = "$AGENT_PIPELINE_RETRYABLE_EXIT" ] \
        && [ "$attempt" -lt "$AGENT_PRACTICE_MAX_ATTEMPTS" ]; then
      echo "RESULT: retrying with a different topic after an evidence-safe skip"
      attempt=$((attempt + 1))
      continue
    fi
    break
  done
  echo
  echo "===== AI agent practice end: $(date) exit=$rc ====="
  exit "$rc"
} >>"$LOG" 2>&1
