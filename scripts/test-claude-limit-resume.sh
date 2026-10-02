#!/bin/bash
set -euo pipefail
export ARTICLE_PIPELINE_ISOLATED_WORKTREE=1
ROOT="$(git rev-parse --show-toplevel)"
TEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/claude-limit-resume-test.XXXXXX")"
trap 'rm -rf "$TEST_DIR"' EXIT
STATE="$TEST_DIR/state.json"
node "$ROOT/scripts/pipeline-state.mjs" init "$STATE" main

# Missing or malformed actual-limit reset information must not cause a retry loop.
if bash "$ROOT/scripts/wait-for-claude-usage.sh" "$STATE" >"$TEST_DIR/missing.out" 2>&1; then
  echo "missing reset time unexpectedly passed" >&2; exit 1
fi
rg -q 'reset time is missing' "$TEST_DIR/missing.out"
node "$ROOT/scripts/pipeline-state.mjs" set "$STATE" retry.retry_at '"unparseable"'
if bash "$ROOT/scripts/wait-for-claude-usage.sh" "$STATE" >"$TEST_DIR/invalid.out" 2>&1; then
  echo "invalid reset time unexpectedly passed" >&2; exit 1
fi
rg -q 'unsupported reset time' "$TEST_DIR/invalid.out"
node "$ROOT/scripts/pipeline-state.mjs" set "$STATE" retry.retry_at '"2099-01-01 00:00 (UTC)"'
set +e
CLAUDE_USAGE_WAIT_MAX_SECONDS=1 bash "$ROOT/scripts/wait-for-claude-usage.sh" "$STATE" >"$TEST_DIR/max.out" 2>&1
rc=$?
set -e
[ "$rc" = 10 ]
CLAUDE_USAGE_WAIT_SECONDS_OVERRIDE=1 CLAUDE_USAGE_WAIT_INTERVAL_SECONDS=1 \
  bash "$ROOT/scripts/wait-for-claude-usage.sh" "$STATE" >"$TEST_DIR/wait.out"
rg -q 'waiting 1s' "$TEST_DIR/wait.out"
rg -q 'reset wait complete' "$TEST_DIR/wait.out"

# Run launchd in a temporary Git repository so no real resume marker is touched.
FAKE_REPO="$TEST_DIR/repo"
git init -q "$FAKE_REPO"
FAKE_PIPELINE="$TEST_DIR/fake-pipeline.sh"
cat >"$FAKE_PIPELINE" <<'EOF'
#!/bin/bash
set -eu
printf '%s|%s\n' "${AP_MODEL:-}" "${AP_EFFORT:-}" >"$FAKE_PIPELINE_MODEL"
count=0
[ ! -f "$FAKE_PIPELINE_COUNT" ] || count="$(cat "$FAKE_PIPELINE_COUNT")"
count=$((count + 1))
printf '%s\n' "$count" >"$FAKE_PIPELINE_COUNT"
printf '%s\n' "$*" >>"$FAKE_PIPELINE_ARGS"
if [ "${FAKE_LIMIT:-0}" = 1 ] && [ "$count" = 1 ]; then
  mkdir -p "$FAKE_REPO/logs/pipeline-limit-test"
  node "$STATE_TOOL" init "$FAKE_REPO/logs/pipeline-limit-test/state.json" main
  node "$STATE_TOOL" set "$FAKE_REPO/logs/pipeline-limit-test/state.json" retry.pending true
  node "$STATE_TOOL" set "$FAKE_REPO/logs/pipeline-limit-test/state.json" retry.retry_at '"2099-01-01 00:00 (UTC)"'
  printf 'logs/pipeline-limit-test\n' >"$FAKE_REPO/logs/.auto-publish-resume"
  echo 'usage limit resets 2099-01-01 00:00 (UTC)'
  exit 20
fi
rm -f "$FAKE_REPO/logs/.auto-publish-resume"
echo "RESULT: ok https://example.invalid/pull/limit-resume"
EOF
chmod +x "$FAKE_PIPELINE"
run_wrapper() {
  (
    cd "$FAKE_REPO"
    FAKE_LIMIT="$1" FAKE_REPO="$FAKE_REPO" STATE_TOOL="$ROOT/scripts/pipeline-state.mjs" \
    CLAUDE_USAGE_STATUSLINE_SCRIPT="$TEST_DIR/missing-statusline" \
    CLAUDE_USAGE_CACHE_FILE="$TEST_DIR/missing-cache" \
    CLAUDE_USAGE_GATE_ENABLED=1 CLAUDE_USAGE_MIN_REMAINING_PERCENT=100 \
    CLAUDE_USAGE_WAITER="$ROOT/scripts/wait-for-claude-usage.sh" \
    CLAUDE_USAGE_WAIT_SECONDS_OVERRIDE=0 \
    AUTO_PUBLISH_SCRIPT="$FAKE_PIPELINE" \
    FAKE_PIPELINE_COUNT="$TEST_DIR/pipeline-count" \
    FAKE_PIPELINE_MODEL="$TEST_DIR/pipeline-model" \
    FAKE_PIPELINE_ARGS="$TEST_DIR/pipeline-args" \
    AP_ARGS= AUTO_PUBLISH_LOG_DIR="$TEST_DIR/launchd-logs" \
    AUTO_PUBLISH_STATUS_DIR="$TEST_DIR/status" ARTICLE_PIPELINE_RUN_DIR="$FAKE_REPO" \
    ARTICLE_PIPELINE_LOCK_WAIT_ENABLED=0 \
      bash "$ROOT/scripts/auto-publish-launchd.sh"
  ) || {
    find "$TEST_DIR/launchd-logs" -maxdepth 1 -name '*.log' -exec cat {} \; >&2
    return 1
  }
}

# No cache/statusline and legacy gate settings cannot block the first model call.
run_wrapper 0
[ "$(cat "$TEST_DIR/pipeline-count")" = 1 ]
[ "$(cat "$TEST_DIR/pipeline-model")" = "claude-sonnet-5|medium" ]
[ -f "$TEST_DIR/status/$(date +%F)-claude.json" ]
[ ! -e "$TEST_DIR/missing-cache" ]
rm -f "$TEST_DIR/pipeline-count" "$TEST_DIR/pipeline-args"

# An actual limit response still saves state, waits for reset, and resumes that run.
run_wrapper 1
[ "$(cat "$TEST_DIR/pipeline-count")" = 2 ]
[ "$(sed -n '1p' "$TEST_DIR/pipeline-args")" = '--auto-merge' ]
[ "$(sed -n '2p' "$TEST_DIR/pipeline-args")" = '--resume logs/pipeline-limit-test --auto-merge' ]
[ -f "$FAKE_REPO/logs/pipeline-limit-test/state.json" ]
[ ! -e "$FAKE_REPO/logs/.auto-publish-resume" ]
bash -n "$ROOT/scripts/auto-publish.sh" "$ROOT/scripts/wait-for-claude-usage.sh" "$ROOT/scripts/auto-publish-launchd.sh"
echo "Claude limit resume tests passed"
