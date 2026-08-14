#!/bin/bash
# launchd wrapper for the separate daily AI coding-agent article pipeline.
set -uo pipefail

export PATH="/Users/katayamaryuunosuke/.local/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/Users/katayamaryuunosuke/.nvm/versions/node/v22.17.0/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

REPO="/Users/katayamaryuunosuke/workspace/024_zenn"
cd "$REPO" || { echo "cannot cd to $REPO" >&2; exit 1; }

LOG_DIR="$REPO/logs/agent/launchd"
mkdir -p "$LOG_DIR"
TS="$(date +%Y%m%d-%H%M%S)"
LOG="$LOG_DIR/auto-agent-practice-$TS.log"

ARG_TEXT="${AGENT_PRACTICE_ARGS:---scheduled}"
read -r -a AGENT_ARGS <<< "$ARG_TEXT"

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

  bash "$REPO/scripts/auto-agent-practice.sh" "${AGENT_ARGS[@]}"
  rc=$?
  echo
  echo "===== AI agent practice end: $(date) exit=$rc ====="
  exit "$rc"
} >>"$LOG" 2>&1
