#!/bin/bash
# Claude.ai subscription usage gate for unattended publishing.
# Exit 0: enough five-hour allowance remains.
# Exit 10: allowance is at or below the configured threshold.
# Exit 2: usage could not be verified safely.

set -uo pipefail

: "${CLAUDE_USAGE_MIN_REMAINING_PERCENT:=80}"
: "${CLAUDE_USAGE_STATUSLINE_SCRIPT:=$HOME/.claude/statusline.sh}"
: "${CLAUDE_USAGE_CACHE_FILE:=/tmp/claude/statusline-usage-cache.json}"
: "${CLAUDE_USAGE_MAX_CACHE_AGE:=120}"

fail() {
  echo "Claude usage gate: unavailable ($*)" >&2
  exit 2
}

case "$CLAUDE_USAGE_MIN_REMAINING_PERCENT" in
  ''|*[!0-9.]*) fail "CLAUDE_USAGE_MIN_REMAINING_PERCENT must be numeric" ;;
esac
case "$CLAUDE_USAGE_MAX_CACHE_AGE" in
  ''|*[!0-9]*) fail "CLAUDE_USAGE_MAX_CACHE_AGE must be an integer" ;;
esac

command -v jq >/dev/null 2>&1 || fail "jq is required"
[ -f "$CLAUDE_USAGE_STATUSLINE_SCRIPT" ] || fail "status line script not found: $CLAUDE_USAGE_STATUSLINE_SCRIPT"

# The existing status line refreshes its usage cache without consuming a Claude
# model response. The minimal input only supplies fields the renderer expects.
probe='{"model":{"display_name":"Claude"},"cwd":"/Users/katayamaryuunosuke/workspace/024_zenn","context_window":{"context_window_size":200000,"current_usage":null}}'
printf '%s' "$probe" | bash "$CLAUDE_USAGE_STATUSLINE_SCRIPT" >/dev/null 2>&1 || \
  fail "status line refresh failed"

[ -f "$CLAUDE_USAGE_CACHE_FILE" ] || fail "usage cache was not created"
cache_mtime="$(stat -f %m "$CLAUDE_USAGE_CACHE_FILE" 2>/dev/null || stat -c %Y "$CLAUDE_USAGE_CACHE_FILE" 2>/dev/null || true)"
[ -n "$cache_mtime" ] || fail "usage cache timestamp is unavailable"
cache_age=$(( $(date +%s) - cache_mtime ))
[ "$cache_age" -le "$CLAUDE_USAGE_MAX_CACHE_AGE" ] || fail "usage cache is stale (${cache_age}s)"

used="$(jq -r '.five_hour.utilization // empty' "$CLAUDE_USAGE_CACHE_FILE" 2>/dev/null)"
reset_at="$(jq -r '.five_hour.resets_at // empty' "$CLAUDE_USAGE_CACHE_FILE" 2>/dev/null)"
[ -n "$used" ] || fail "five-hour utilization is missing"

if ! awk -v value="$used" 'BEGIN { exit !(value ~ /^[0-9]+([.][0-9]+)?$/ && value >= 0 && value <= 100) }'; then
  fail "five-hour utilization is invalid: $used"
fi

remaining="$(awk -v value="$used" 'BEGIN { printf "%.1f", 100 - value }')"
if awk -v remaining="$remaining" -v minimum="$CLAUDE_USAGE_MIN_REMAINING_PERCENT" \
  'BEGIN { exit !(remaining > minimum) }'; then
  echo "Claude usage gate: run (5h used=${used}%, remaining=${remaining}%, required>${CLAUDE_USAGE_MIN_REMAINING_PERCENT}%, reset=${reset_at:-unknown})"
  exit 0
fi

echo "Claude usage gate: skip (5h used=${used}%, remaining=${remaining}%, required>${CLAUDE_USAGE_MIN_REMAINING_PERCENT}%, reset=${reset_at:-unknown})"
exit 10
