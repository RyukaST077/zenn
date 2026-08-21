#!/usr/bin/env bash
# Wait until the Claude five-hour window has enough allowance for a pipeline.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
USAGE_GATE="${CLAUDE_USAGE_GATE_COMMAND:-$SCRIPT_DIR/check-claude-session-usage.sh}"
: "${CLAUDE_USAGE_WAIT_INTERVAL_SECONDS:=60}"
: "${CLAUDE_USAGE_WAIT_MAX_SECONDS:=21600}"

case "$CLAUDE_USAGE_WAIT_INTERVAL_SECONDS" in
  ''|*[!0-9]*|0) echo "CLAUDE_USAGE_WAIT_INTERVAL_SECONDS must be a positive integer" >&2; exit 2 ;;
esac
case "$CLAUDE_USAGE_WAIT_MAX_SECONDS" in
  ''|*[!0-9]*) echo "CLAUDE_USAGE_WAIT_MAX_SECONDS must be a non-negative integer" >&2; exit 2 ;;
esac
[ -f "$USAGE_GATE" ] || { echo "Claude usage gate is not a regular file: $USAGE_GATE" >&2; exit 2; }

waited=0
while :; do
  bash "$USAGE_GATE"
  gate_rc=$?
  case "$gate_rc" in
    0)
      [ "$waited" -eq 0 ] || echo "Claude usage wait complete after ${waited}s"
      exit 0
      ;;
    10)
      if [ "$CLAUDE_USAGE_WAIT_MAX_SECONDS" -gt 0 ] \
          && [ "$waited" -ge "$CLAUDE_USAGE_WAIT_MAX_SECONDS" ]; then
        echo "Claude usage wait exceeded ${CLAUDE_USAGE_WAIT_MAX_SECONDS}s" >&2
        exit 10
      fi
      step="$CLAUDE_USAGE_WAIT_INTERVAL_SECONDS"
      if [ "$CLAUDE_USAGE_WAIT_MAX_SECONDS" -gt 0 ] \
          && [ $((waited + step)) -gt "$CLAUDE_USAGE_WAIT_MAX_SECONDS" ]; then
        step=$((CLAUDE_USAGE_WAIT_MAX_SECONDS - waited))
      fi
      echo "Claude allowance is low; checking again in ${step}s (waited=${waited}s)"
      sleep "$step"
      waited=$((waited + step))
      ;;
    *)
      echo "Claude usage could not be verified safely (exit=$gate_rc)" >&2
      exit "$gate_rc"
      ;;
  esac
done
