#!/bin/bash
# launchd wrapper for the separate daily AI coding-agent article pipeline.
set -uo pipefail

export PATH="/Users/katayamaryuunosuke/.local/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/Users/katayamaryuunosuke/.nvm/versions/node/v22.17.0/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

REPO="/Users/katayamaryuunosuke/workspace/024_zenn"
cd "$REPO" || { echo "cannot cd to $REPO" >&2; exit 1; }
PIPELINE_SCRIPT="${AGENT_PRACTICE_SCRIPT:-}"
WORKTREE_RUNNER="$REPO/scripts/run-article-pipeline-worktree.sh"

LOG_DIR="$REPO/logs/agent/launchd"
: "${AGENT_PRACTICE_LOG_DIR:=$LOG_DIR}"
LOG_DIR="$AGENT_PRACTICE_LOG_DIR"
mkdir -p "$LOG_DIR"
TS="$(date +%Y%m%d-%H%M%S)"
LOG="$LOG_DIR/auto-agent-practice-$TS.log"
RETRY_SIGNAL="$LOG_DIR/.auto-agent-practice-retry-$TS"
trap 'rm -f "$RETRY_SIGNAL"' EXIT

ARG_TEXT="${AGENT_PRACTICE_ARGS:---scheduled --orchestrator claude}"
read -r -a AGENT_ARGS <<< "$ARG_TEXT"
# Safe research or plan rejection is expected for some current topics. Keep
# looking across usage-window resets instead of ending the daily run after a
# single five-topic streak, which has occurred in production.
: "${AGENT_PRACTICE_MAX_ATTEMPTS:=12}"
: "${AGENT_PIPELINE_RETRYABLE_EXIT:=20}"
: "${AGENT_PRACTICE_MAX_SAME_SYSTEM_FAILURES:=2}"
# The scheduled Claude workflow must leave enough of a five-hour window for
# planning, execution, drafting, and review. Direct CLI runs keep their own
# defaults; the launchd path uses Sonnet/medium unless explicitly overridden.
case " $ARG_TEXT " in
  *" --orchestrator codex "*)
    : "${AGENT_PIPELINE_MODEL:=}"
    : "${AGENT_PIPELINE_EFFORT:=high}"
    ;;
  *)
    : "${AGENT_PIPELINE_MODEL:=claude-sonnet-5}"
    : "${AGENT_PIPELINE_EFFORT:=medium}"
    ;;
esac
export AGENT_PIPELINE_MODEL AGENT_PIPELINE_EFFORT
# For this unattended Claude workflow, a detected usage limit must wait a full
# five hours before resuming so the next attempt starts in a fresh usage window.
: "${AGENT_PIPELINE_USAGE_WAIT_SECONDS_OVERRIDE:=18000}"
export AGENT_PIPELINE_USAGE_WAIT_SECONDS_OVERRIDE
: "${ARTICLE_PIPELINE_LOCK_WAIT_SECONDS:=60}"
: "${ARTICLE_PIPELINE_LOCK_MAX_WAIT_SECONDS:=21600}"
: "${AGENT_PRACTICE_STATUS_DIR:=$REPO/logs/agent/daily-status}"
case "$AGENT_PRACTICE_MAX_ATTEMPTS" in
  *[!0-9]*|0) echo "AGENT_PRACTICE_MAX_ATTEMPTS must be a positive integer" >&2; exit 2 ;;
esac
case "$AGENT_PRACTICE_MAX_SAME_SYSTEM_FAILURES" in
  *[!0-9]*|0) echo "AGENT_PRACTICE_MAX_SAME_SYSTEM_FAILURES must be a positive integer" >&2; exit 2 ;;
esac

{
  echo "===== AI agent practice start: $(date) ====="
  echo "args: ${AGENT_ARGS[*]}"
  echo "model: ${AGENT_PIPELINE_MODEL:-CLI default}; effort: $AGENT_PIPELINE_EFFORT"
  echo

  lock_waited=0
  while :; do
    held_lock=""
    for other_lock in "$REPO/.auto-publish.lock" "$REPO/.auto-publish-codex.lock"; do
      [ ! -d "$other_lock" ] || { held_lock="$other_lock"; break; }
    done
    [ -n "$held_lock" ] || break
    if [ "$lock_waited" -ge "$ARTICLE_PIPELINE_LOCK_MAX_WAIT_SECONDS" ]; then
      echo "RESULT: failed (timed out waiting for $held_lock)"
      echo "===== AI agent practice end: $(date) exit=1 ====="
      exit 1
    fi
    echo "WAIT: another article pipeline holds $held_lock; checking again in ${ARTICLE_PIPELINE_LOCK_WAIT_SECONDS}s"
    sleep "$ARTICLE_PIPELINE_LOCK_WAIT_SECONDS"
    lock_waited=$((lock_waited + ARTICLE_PIPELINE_LOCK_WAIT_SECONDS))
  done

  attempt=1
  last_system_signature=""
  same_system_failures=0
  retry_kind=""
  retry_signature=""
  while :; do
    echo "attempt: $attempt/$AGENT_PRACTICE_MAX_ATTEMPTS"
    rm -f "$RETRY_SIGNAL"
    if [ -n "$PIPELINE_SCRIPT" ]; then
      AGENT_PIPELINE_RETRYABLE_EXIT="$AGENT_PIPELINE_RETRYABLE_EXIT" \
        AGENT_PIPELINE_RETRY_SIGNAL_FILE="$RETRY_SIGNAL" \
        bash "$PIPELINE_SCRIPT" "${AGENT_ARGS[@]}"
    else
      AGENT_PIPELINE_RETRYABLE_EXIT="$AGENT_PIPELINE_RETRYABLE_EXIT" \
        AGENT_PIPELINE_RETRY_SIGNAL_FILE="$RETRY_SIGNAL" \
        bash "$WORKTREE_RUNNER" --shared-root "$REPO" -- \
          scripts/auto-agent-practice.sh "${AGENT_ARGS[@]}"
    fi
    rc=$?
    retry_kind=""
    retry_signature=""
    if [ "$rc" = "$AGENT_PIPELINE_RETRYABLE_EXIT" ] && [ -f "$RETRY_SIGNAL" ]; then
      IFS='|' read -r retry_kind retry_signature <"$RETRY_SIGNAL"
    fi
    if [ "$retry_kind" = system ]; then
      if [ "$retry_signature" = "$last_system_signature" ]; then
        same_system_failures=$((same_system_failures + 1))
      else
        last_system_signature="$retry_signature"
        same_system_failures=1
      fi
      if [ "$same_system_failures" -ge "$AGENT_PRACTICE_MAX_SAME_SYSTEM_FAILURES" ]; then
        echo "RESULT: failed (system failure repeated $same_system_failures times: $retry_signature)"
        rc=1
        break
      fi
    else
      last_system_signature=""
      same_system_failures=0
    fi
    if [ "$rc" = "$AGENT_PIPELINE_RETRYABLE_EXIT" ] \
        && [ "$attempt" -lt "$AGENT_PRACTICE_MAX_ATTEMPTS" ]; then
      echo "RESULT: retrying with a different topic after ${retry_kind:-unclassified}/${retry_signature:-retryable}"
      attempt=$((attempt + 1))
      continue
    fi
    break
  done
  if [ "$rc" = 0 ]; then
    case " ${AGENT_ARGS[*]} " in
      *" --dry-run "*) ;;
      *)
        if ! grep -q 'complete: publication queued for ' "$LOG"; then
          echo "RESULT: failed (pipeline exited 0 without the success contract)"
          rc=1
        else
          mkdir -p "$AGENT_PRACTICE_STATUS_DIR"
          status_file="$AGENT_PRACTICE_STATUS_DIR/$(date +%F)-agent.json"
          node -e 'const fs=require("node:fs"); const [file,log]=process.argv.slice(1); fs.writeFileSync(file, JSON.stringify({version:1,pipeline:"agent-practice",status:"success",completed_at:new Date().toISOString(),log},null,2)+"\n")' \
            "$status_file" "$LOG"
          echo "SUCCESS: recorded $status_file"
        fi
        ;;
    esac
  fi
  if [ "$rc" != 0 ]; then
    mkdir -p "$AGENT_PRACTICE_STATUS_DIR"
    status_file="$AGENT_PRACTICE_STATUS_DIR/$(date +%F)-agent.json"
    node -e 'const fs=require("node:fs"); const [file,log,code,kind,signature]=process.argv.slice(1); fs.writeFileSync(file, JSON.stringify({version:1,pipeline:"agent-practice",status:"failed",completed_at:new Date().toISOString(),exit_code:Number(code),retry_kind:kind||null,retry_signature:signature||null,log},null,2)+"\n")' \
      "$status_file" "$LOG" "$rc" "$retry_kind" "$retry_signature"
    echo "FAILED: recorded $status_file"
  fi
  echo
  echo "===== AI agent practice end: $(date) exit=$rc ====="
  exit "$rc"
} >>"$LOG" 2>&1
