#!/bin/bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

TEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/claude-usage-gate-test.XXXXXX")"
trap 'rm -rf "$TEST_DIR"' EXIT
FAKE_STATUSLINE="$TEST_DIR/statusline.sh"
FAKE_CACHE="$TEST_DIR/usage.json"

cat >"$FAKE_STATUSLINE" <<'EOF'
#!/bin/bash
cat >/dev/null
printf '{"five_hour":{"utilization":%s,"resets_at":"2026-08-07T04:40:00+09:00"}}\n' "$FAKE_USED" >"$CLAUDE_USAGE_CACHE_FILE"
EOF
chmod +x "$FAKE_STATUSLINE"

run_gate() {
  FAKE_USED="$1" \
  CLAUDE_USAGE_STATUSLINE_SCRIPT="$FAKE_STATUSLINE" \
  CLAUDE_USAGE_CACHE_FILE="$FAKE_CACHE" \
  CLAUDE_USAGE_MIN_REMAINING_PERCENT=80 \
    bash scripts/check-claude-session-usage.sh >/dev/null
}

run_gate 19

set +e
run_gate 20
rc_at_threshold=$?
run_gate 67
rc_below_threshold=$?
set -e

[ "$rc_at_threshold" = 10 ]
[ "$rc_below_threshold" = 10 ]

bash -n scripts/check-claude-session-usage.sh scripts/auto-publish-launchd.sh
echo "Claude usage gate tests passed"
