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

FAKE_WAIT_GATE="$TEST_DIR/wait-gate.sh"
FAKE_WAIT_COUNT="$TEST_DIR/wait-count"
cat >"$FAKE_WAIT_GATE" <<'EOF'
#!/bin/bash
[ -z "${EXPECTED_GATE_MIN:-}" ] \
  || [ "${CLAUDE_USAGE_MIN_REMAINING_PERCENT:-}" = "$EXPECTED_GATE_MIN" ] \
  || exit 9
count=0
[ ! -f "$FAKE_WAIT_COUNT" ] || count="$(cat "$FAKE_WAIT_COUNT")"
count=$((count + 1))
printf '%s\n' "$count" >"$FAKE_WAIT_COUNT"
[ "$count" -gt 1 ] || exit 10
exit 0
EOF
chmod +x "$FAKE_WAIT_GATE"

CLAUDE_USAGE_GATE_COMMAND="$FAKE_WAIT_GATE" \
FAKE_WAIT_COUNT="$FAKE_WAIT_COUNT" \
CLAUDE_USAGE_WAIT_INTERVAL_SECONDS=1 \
CLAUDE_USAGE_WAIT_MAX_SECONDS=2 \
  bash scripts/wait-for-claude-usage.sh >/dev/null
[ "$(cat "$FAKE_WAIT_COUNT")" = 2 ]

# The waiter invokes its gate through bash, so a repository script with mode
# 0644 must remain valid input.
chmod -x "$FAKE_WAIT_GATE"
rm -f "$FAKE_WAIT_COUNT"
CLAUDE_USAGE_GATE_COMMAND="$FAKE_WAIT_GATE" \
FAKE_WAIT_COUNT="$FAKE_WAIT_COUNT" \
CLAUDE_USAGE_WAIT_INTERVAL_SECONDS=1 \
CLAUDE_USAGE_WAIT_MAX_SECONDS=2 \
  bash scripts/wait-for-claude-usage.sh >/dev/null
[ "$(cat "$FAKE_WAIT_COUNT")" = 2 ]

FAKE_PIPELINE="$TEST_DIR/fake-pipeline.sh"
FAKE_PIPELINE_COUNT="$TEST_DIR/pipeline-count"
cat >"$FAKE_PIPELINE" <<'EOF'
#!/bin/bash
printf '%s|%s\n' "${AP_MODEL:-}" "${AP_EFFORT:-}" >"$FAKE_PIPELINE_MODEL"
count=0
[ ! -f "$FAKE_PIPELINE_COUNT" ] || count="$(cat "$FAKE_PIPELINE_COUNT")"
count=$((count + 1))
printf '%s\n' "$count" >"$FAKE_PIPELINE_COUNT"
[ "$count" -gt 1 ] || exit 20
echo "RESULT: ok https://example.invalid/pull/usage-resume"
EOF
chmod +x "$FAKE_PIPELINE"
rm -f "$FAKE_WAIT_COUNT"
CLAUDE_USAGE_GATE_COMMAND="$FAKE_WAIT_GATE" \
FAKE_WAIT_COUNT="$FAKE_WAIT_COUNT" \
EXPECTED_GATE_MIN=20 \
CLAUDE_USAGE_WAITER="$ROOT/scripts/wait-for-claude-usage.sh" \
CLAUDE_USAGE_WAIT_INTERVAL_SECONDS=1 \
CLAUDE_USAGE_WAIT_MAX_SECONDS=2 \
AUTO_PUBLISH_SCRIPT="$FAKE_PIPELINE" \
FAKE_PIPELINE_COUNT="$FAKE_PIPELINE_COUNT" \
FAKE_PIPELINE_MODEL="$TEST_DIR/pipeline-model" \
AP_ARGS="--fixture" \
AUTO_PUBLISH_LOG_DIR="$TEST_DIR/launchd-logs" \
AUTO_PUBLISH_STATUS_DIR="$TEST_DIR/status" \
ARTICLE_PIPELINE_LOCK_WAIT_ENABLED=0 \
  bash scripts/auto-publish-launchd.sh || {
    find "$TEST_DIR/launchd-logs" -type f -maxdepth 1 -name '*.log' -exec sed -n '1,240p' {} \; >&2
    exit 1
  }
[ "$(cat "$FAKE_PIPELINE_COUNT")" = 2 ]
[ "$(cat "$TEST_DIR/pipeline-model")" = "claude-sonnet-5|medium" ]
[ -f "$TEST_DIR/status/$(date +%F)-claude.json" ]

bash -n scripts/check-claude-session-usage.sh scripts/wait-for-claude-usage.sh scripts/auto-publish-launchd.sh
echo "Claude usage gate tests passed"
