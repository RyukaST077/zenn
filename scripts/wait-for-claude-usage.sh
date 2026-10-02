#!/usr/bin/env bash
# Wait for the reset time recorded after an actual Claude limit response.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
STATE="${1:-}"
: "${CLAUDE_USAGE_WAIT_INTERVAL_SECONDS:=60}"
: "${CLAUDE_USAGE_WAIT_MAX_SECONDS:=21600}"
: "${CLAUDE_USAGE_RESET_GRACE_SECONDS:=30}"
: "${CLAUDE_USAGE_WAIT_SECONDS_OVERRIDE:=}"

case "$CLAUDE_USAGE_WAIT_INTERVAL_SECONDS" in
  ''|*[!0-9]*|0) echo "CLAUDE_USAGE_WAIT_INTERVAL_SECONDS must be a positive integer" >&2; exit 2 ;;
esac
for value in "$CLAUDE_USAGE_WAIT_MAX_SECONDS" "$CLAUDE_USAGE_RESET_GRACE_SECONDS"; do
  case "$value" in ''|*[!0-9]*) echo "Claude wait limits must be non-negative integers" >&2; exit 2 ;; esac
done
case "$CLAUDE_USAGE_WAIT_SECONDS_OVERRIDE" in
  *[!0-9]*) echo "CLAUDE_USAGE_WAIT_SECONDS_OVERRIDE must be a non-negative integer" >&2; exit 2 ;;
esac
[ -n "$STATE" ] && [ -f "$STATE" ] || { echo "usage: wait-for-claude-usage.sh STATE_JSON" >&2; exit 2; }
reset_label="$(node "$SCRIPT_DIR/pipeline-state.mjs" get "$STATE" retry.retry_at)" || exit 2
[ -n "$reset_label" ] && [ "$reset_label" != null ] || {
  echo "Claude limit reset time is missing; saved artifacts remain available for resume" >&2
  exit 2
}

RESET_LOG="$(mktemp "${TMPDIR:-/tmp}/claude-limit-reset.XXXXXX")" || exit 2
trap 'rm -f "$RESET_LOG"' EXIT
printf 'usage limit resets %s\n' "$reset_label" >"$RESET_LOG"
reset_info="$(node "$SCRIPT_DIR/claude-usage-limit.mjs" "$RESET_LOG")" || exit 2
wait_seconds="$(printf '%s\n' "$reset_info" | sed -n '1p')"
if [ -n "$CLAUDE_USAGE_WAIT_SECONDS_OVERRIDE" ]; then
  wait_seconds="$CLAUDE_USAGE_WAIT_SECONDS_OVERRIDE"
else
  wait_seconds=$((wait_seconds + CLAUDE_USAGE_RESET_GRACE_SECONDS))
fi
if [ "$CLAUDE_USAGE_WAIT_MAX_SECONDS" -gt 0 ] && [ "$wait_seconds" -gt "$CLAUDE_USAGE_WAIT_MAX_SECONDS" ]; then
  echo "Claude reset wait exceeds ${CLAUDE_USAGE_WAIT_MAX_SECONDS}s; saved artifacts remain available for resume" >&2
  exit 10
fi

echo "Claude limit reset=$reset_label; waiting ${wait_seconds}s"
remaining="$wait_seconds"
while [ "$remaining" -gt 0 ]; do
  step="$CLAUDE_USAGE_WAIT_INTERVAL_SECONDS"
  [ "$remaining" -ge "$step" ] || step="$remaining"
  sleep "$step"
  remaining=$((remaining - step))
done
echo "Claude limit reset wait complete"
