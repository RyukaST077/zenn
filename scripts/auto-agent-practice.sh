#!/usr/bin/env bash
# AI coding-agent article pipeline: research -> plan -> real CLI run -> analysis -> draft ->
# review/revise -> publication queue PR -> merge.
# The run stage starts authenticated Claude Code and Codex processes, so the outer orchestrator uses
# unrestricted permissions. Run this only on the dedicated local machine used for these experiments.
set -euo pipefail

: "${CODEX_BIN:=codex}"
: "${CLAUDE_BIN:=claude}"
: "${AGENT_PIPELINE_ORCHESTRATOR:=codex}"
: "${AGENT_PIPELINE_MODEL:=}"
: "${AGENT_PIPELINE_EFFORT:=high}"
: "${AGENT_PIPELINE_SEARCH:=1}"
: "${MAX_AGENT_REVIEW_ROUNDS:=5}"
: "${AGENT_PIPELINE_BASE_BRANCH:=main}"
: "${AGENT_PIPELINE_MERGE_METHOD:=--squash}"
: "${AGENT_PIPELINE_RETRYABLE_EXIT:=20}"
: "${MAX_AGENT_PREFLIGHT_REPAIRS:=2}"
: "${MAX_AGENT_STAGE_CONTRACT_REPAIRS:=1}"
: "${AGENT_PIPELINE_AUTO_RESUME_USAGE_LIMIT:=1}"
: "${AGENT_PIPELINE_MAX_USAGE_RESUMES:=8}"
: "${AGENT_PIPELINE_USAGE_RESUME_COUNT:=0}"
: "${AGENT_PIPELINE_USAGE_RESET_GRACE_SECONDS:=30}"
: "${AGENT_PIPELINE_USAGE_WAIT_SECONDS_OVERRIDE:=}"
: "${AGENT_EXPERIMENT_RUNNER:=scripts/agent-practice/run-experiment.mjs}"
: "${AGENT_PIPELINE_RETRY_SIGNAL_FILE:=}"

TOPIC="Current practical Claude Code or OpenAI Codex know-how, configuration, workflow, harness, model or CLI feature that is not already covered by this repository, framed so the article leaves the reader a configuration, script, checklist, migration path, or decision table they can take away"
DRY_RUN=0
SCHEDULED=0
AUTO_MERGE=1
RESUME_RUN_LOG=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --topic) TOPIC="${2:?--topic requires text}"; shift ;;
    --orchestrator) AGENT_PIPELINE_ORCHESTRATOR="${2:?--orchestrator requires codex or claude}"; shift ;;
    --max-rounds) MAX_AGENT_REVIEW_ROUNDS="${2:?--max-rounds requires a number}"; shift ;;
    --resume-after-run) RESUME_RUN_LOG="${2:?--resume-after-run requires an execution log}"; shift ;;
    --scheduled) SCHEDULED=1 ;;
    --auto-merge) AUTO_MERGE=1 ;;
    --pr-only) AUTO_MERGE=0 ;;
    --dry-run) DRY_RUN=1 ;;
    -h|--help) sed -n '1,100p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
  shift
done
case "$MAX_AGENT_REVIEW_ROUNDS" in
  *[!0-9]*|0) echo "MAX_AGENT_REVIEW_ROUNDS must be a positive integer" >&2; exit 2 ;;
esac
case "$MAX_AGENT_PREFLIGHT_REPAIRS" in
  *[!0-9]*|'') echo "MAX_AGENT_PREFLIGHT_REPAIRS must be a non-negative integer" >&2; exit 2 ;;
esac
case "$MAX_AGENT_STAGE_CONTRACT_REPAIRS" in
  *[!0-9]*|'') echo "MAX_AGENT_STAGE_CONTRACT_REPAIRS must be a non-negative integer" >&2; exit 2 ;;
esac
case "$AGENT_PIPELINE_ORCHESTRATOR" in
  codex|claude) ;;
  *) echo "AGENT_PIPELINE_ORCHESTRATOR must be codex or claude" >&2; exit 2 ;;
esac
case "$AGENT_PIPELINE_SEARCH" in 0|1) ;; *) echo "AGENT_PIPELINE_SEARCH must be 0 or 1" >&2; exit 2 ;; esac
case "$AGENT_PIPELINE_AUTO_RESUME_USAGE_LIMIT" in
  0|1) ;;
  *) echo "AGENT_PIPELINE_AUTO_RESUME_USAGE_LIMIT must be 0 or 1" >&2; exit 2 ;;
esac
validate_non_negative_integer() {
  case "$2" in
    *[!0-9]*|'') echo "$1 must be a non-negative integer" >&2; exit 2 ;;
  esac
}
validate_non_negative_integer AGENT_PIPELINE_MAX_USAGE_RESUMES "$AGENT_PIPELINE_MAX_USAGE_RESUMES"
validate_non_negative_integer AGENT_PIPELINE_USAGE_RESUME_COUNT "$AGENT_PIPELINE_USAGE_RESUME_COUNT"
validate_non_negative_integer AGENT_PIPELINE_USAGE_RESET_GRACE_SECONDS "$AGENT_PIPELINE_USAGE_RESET_GRACE_SECONDS"
case "$AGENT_PIPELINE_USAGE_WAIT_SECONDS_OVERRIDE" in
  ''|*[!0-9]*)
    [ -z "$AGENT_PIPELINE_USAGE_WAIT_SECONDS_OVERRIDE" ] \
      || { echo "AGENT_PIPELINE_USAGE_WAIT_SECONDS_OVERRIDE must be a non-negative integer" >&2; exit 2; } ;;
esac
case "$AGENT_PIPELINE_MERGE_METHOD" in
  --merge|--rebase|--squash) ;;
  *) echo "AGENT_PIPELINE_MERGE_METHOD must be --merge, --rebase, or --squash" >&2; exit 2 ;;
esac

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
TS="$(date +%Y%m%d-%H%M%S)"
PIPE_DIR="logs/agent/pipeline-$TS"
PLOG="$PIPE_DIR/pipeline.log"
CONTRACT_TOOL="scripts/agent-stage-result-contract.mjs"
ARM_TOOL="scripts/analytics/next-arm.mjs"
RESULT_TOOL="scripts/validate-agent-stage-result.mjs"
RUN_RESULT_TOOL="scripts/validate-agent-run-result.mjs"
GENERATED_PATH_TOOL="scripts/validate-agent-generated-paths.mjs"
ARTIFACT_TOOL="scripts/isolated-artifacts.mjs"
CLAUDE_LIMIT_TOOL="scripts/claude-usage-limit.mjs"
RUN_LOG_FINDER="scripts/find-agent-run-log.mjs"
TIMEOUT_BIN="$(command -v timeout || command -v gtimeout || true)"

stage_timeout() {
  case "$1" in
    search) echo "${TIMEOUT_AGENT_SEARCH:=1800}" ;;
    plan) echo "${TIMEOUT_AGENT_PLAN:=1200}" ;;
    run) echo "${TIMEOUT_AGENT_RUN:=3600}" ;;
    analyze) echo "${TIMEOUT_AGENT_ANALYZE:=1200}" ;;
    draft) echo "${TIMEOUT_AGENT_DRAFT:=1200}" ;;
    review) echo "${TIMEOUT_AGENT_REVIEW:=900}" ;;
    revise) echo "${TIMEOUT_AGENT_REVISE:=1200}" ;;
  esac
}

if [ "$DRY_RUN" = 1 ]; then
  cat <<EOF
[dry-run] AI coding-agent practice pipeline
  root: $ROOT
  topic: $TOPIC
  pipeline: $PIPE_DIR
  orchestrator: $AGENT_PIPELINE_ORCHESTRATOR ($([ "$AGENT_PIPELINE_ORCHESTRATOR" = codex ] && printf '%s' "$CODEX_BIN" || printf '%s' "$CLAUDE_BIN"), model=${AGENT_PIPELINE_MODEL:-CLI default}, effort=$AGENT_PIPELINE_EFFORT)
  experiment CLIs: $CLAUDE_BIN, $CODEX_BIN
  policy: non-interactive, outer permissions=unrestricted, ephemeral=true
  search: $AGENT_PIPELINE_SEARCH
  scheduled: $SCHEDULED
  review rounds: $MAX_AGENT_REVIEW_ROUNDS
  preflight repairs: $MAX_AGENT_PREFLIGHT_REPAIRS
  stage contract repairs: $MAX_AGENT_STAGE_CONTRACT_REPAIRS
  base branch: $AGENT_PIPELINE_BASE_BRANCH
  auto merge: $AUTO_MERGE
  resume after run: ${RESUME_RUN_LOG:-none}
  auto resume at usage limit: $AGENT_PIPELINE_AUTO_RESUME_USAGE_LIMIT (attempt $AGENT_PIPELINE_USAGE_RESUME_COUNT/$AGENT_PIPELINE_MAX_USAGE_RESUMES)
  stages: zenn-agent-search-knowhow -> zenn-agent-plan-practice -> fake-CLI preflight <-> plan repair -> deterministic experiment runner -> zenn-agent-analyze-results -> zenn-agent-draft-article -> zenn-agent-review-article <-> zenn-agent-revise-article -> publication queue -> commit/push -> PR -> $([ "$AUTO_MERGE" = 1 ] && echo "merge" || echo "human merge")
  result: a reviewed article added to the rate-limited Zenn publication queue
EOF
  exit 0
fi

mkdir -p "$PIPE_DIR"
touch "$PLOG"
log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*" | tee -a "$PLOG" >&2; }
die() { log "ERROR: $*"; log "pipeline evidence: $PIPE_DIR"; exit 1; }
retry_pipeline() {
  local kind="$1" signature="$2"
  shift 2
  log "RETRYABLE: $*"
  log "retry classification: $kind/$signature"
  if [ -n "$AGENT_PIPELINE_RETRY_SIGNAL_FILE" ]; then
    if ! printf '%s|%s\n' "$kind" "$signature" >"$AGENT_PIPELINE_RETRY_SIGNAL_FILE"; then
      die "could not write retry classification"
    fi
  fi
  log "pipeline evidence: $PIPE_DIR"
  exit "$AGENT_PIPELINE_RETRYABLE_EXIT"
}
system_failure() {
  local signature="$1"
  shift
  if [ "$SCHEDULED" = 1 ]; then
    retry_pipeline system "$signature" "$*; another scheduled topic may be tried"
  fi
  die "$*"
}

[ -n "$TIMEOUT_BIN" ] || die "timeout or gtimeout is required (macOS: brew install coreutils)"
command -v "$CODEX_BIN" >/dev/null 2>&1 || die "Codex CLI not found: $CODEX_BIN"
command -v "$CLAUDE_BIN" >/dev/null 2>&1 || die "Claude Code CLI not found: $CLAUDE_BIN"
command -v node >/dev/null 2>&1 || die "node is required"
command -v git >/dev/null 2>&1 || die "git is required"
command -v gh >/dev/null 2>&1 || die "gh is required"
command -v rg >/dev/null 2>&1 || die "ripgrep is required"
[ -f "$CONTRACT_TOOL" ] || die "agent stage contract tool is missing"
[ -f "$ARM_TOOL" ] || die "experiment arm allocator is missing"
[ -f "$RESULT_TOOL" ] || die "agent stage result validator is missing"
[ -f "$RUN_RESULT_TOOL" ] || die "agent direct-run result validator is missing"
[ -f "$GENERATED_PATH_TOOL" ] || die "agent generated-path validator is missing"
[ -f "$ARTIFACT_TOOL" ] || die "isolated artifact helper is missing"
[ -f "$CLAUDE_LIMIT_TOOL" ] || die "Claude usage limit parser is missing"
[ -f "$RUN_LOG_FINDER" ] || die "agent execution log finder is missing"
[ -f "$AGENT_EXPERIMENT_RUNNER" ] || die "agent experiment runner is missing"
[ -x scripts/agent-practice/enqueue-reviewed-article.sh ] || die "queue helper is missing or not executable"
"$CODEX_BIN" login status >/dev/null 2>&1 || die "Codex is not authenticated"
"$CLAUDE_BIN" auth status >/dev/null 2>&1 || die "Claude Code is not authenticated"
GH_PROMPT_DISABLED=1 gh auth status >/dev/null 2>&1 || die "GitHub CLI is not authenticated"
git remote get-url origin >/dev/null 2>&1 || die "origin remote is required"
git check-ref-format --branch "$AGENT_PIPELINE_BASE_BRANCH" >/dev/null 2>&1 \
  || die "invalid base branch: $AGENT_PIPELINE_BASE_BRANCH"
log "WARN: outer $AGENT_PIPELINE_ORCHESTRATOR stages use unrestricted permissions; the authenticated experiment runner is invoked directly by the pipeline"

LOCK_ROOT="${ARTICLE_PIPELINE_LOCK_ROOT:-$ROOT}"
LOCK="$LOCK_ROOT/.agent-practice-pipeline.lock"
for other_lock in "$LOCK_ROOT/.auto-publish.lock" "$LOCK_ROOT/.auto-publish-codex.lock"; do
  [ ! -d "$other_lock" ] || die "another article pipeline holds $other_lock"
done
if ! mkdir "$LOCK" 2>/dev/null; then die "another AI agent practice pipeline holds $LOCK"; fi
trap 'rmdir "$LOCK" 2>/dev/null || true' EXIT

restart_after_usage_limit() {
  local stage="$1" events="$2" marker="$3"
  local limit_info limit_rc wait_seconds reset_label resume_log next_count step remaining find_rc
  local restart_cmd
  set +e
  limit_info="$(node "$CLAUDE_LIMIT_TOOL" "$events" 2>>"$PLOG")"
  limit_rc=$?
  set -e
  [ "$limit_rc" = 0 ] || return 1

  if [ "$AGENT_PIPELINE_AUTO_RESUME_USAGE_LIMIT" != 1 ]; then
    die "$stage hit the Claude usage limit and automatic resume is disabled; events: $events"
  fi
  if [ "$AGENT_PIPELINE_USAGE_RESUME_COUNT" -ge "$AGENT_PIPELINE_MAX_USAGE_RESUMES" ]; then
    die "$stage hit the Claude usage limit after $AGENT_PIPELINE_USAGE_RESUME_COUNT automatic resumes; events: $events"
  fi

  wait_seconds="$(printf '%s\n' "$limit_info" | sed -n '1p')"
  reset_label="$(printf '%s\n' "$limit_info" | sed -n '2p')"
  if [ -n "$AGENT_PIPELINE_USAGE_WAIT_SECONDS_OVERRIDE" ]; then
    wait_seconds="$AGENT_PIPELINE_USAGE_WAIT_SECONDS_OVERRIDE"
    reset_label="test override"
  else
    wait_seconds=$((wait_seconds + AGENT_PIPELINE_USAGE_RESET_GRACE_SECONDS))
  fi

  resume_log="${RUN_LOG:-}"
  if [ "$stage" = run ]; then
    set +e
    resume_log="$(node "$RUN_LOG_FINDER" "$marker" "$MANIFEST" "$ROOT" 2>>"$PLOG")"
    find_rc=$?
    set -e
    [ "$find_rc" = 0 ] || die "run hit the Claude usage limit but no unique saved execution log matched $MANIFEST"
  fi
  if [ -n "$resume_log" ] && [ ! -f "$resume_log" ]; then
    die "$stage selected a missing execution log for automatic resume: $resume_log"
  fi

  next_count=$((AGENT_PIPELINE_USAGE_RESUME_COUNT + 1))
  log "PAUSE: $stage hit the Claude usage limit; reset=$reset_label, wait=${wait_seconds}s"
  if [ -n "$resume_log" ]; then
    log "saved execution log: $resume_log"
  else
    log "no reusable execution log exists yet; the pipeline will restart from research"
  fi
  remaining="$wait_seconds"
  while [ "$remaining" -gt 0 ]; do
    step=60
    [ "$remaining" -ge "$step" ] || step="$remaining"
    sleep "$step"
    remaining=$((remaining - step))
    if [ "$remaining" -gt 0 ] \
        && { [ "$remaining" -lt 60 ] || [ $(((wait_seconds - remaining) % 300)) -eq 0 ]; }; then
      log "usage-limit wait remaining: ${remaining}s"
    fi
  done

  if [ -n "$resume_log" ]; then
    log "RESTART: resuming from $resume_log (automatic resume $next_count/$AGENT_PIPELINE_MAX_USAGE_RESUMES)"
  else
    log "RESTART: restarting from research (automatic resume $next_count/$AGENT_PIPELINE_MAX_USAGE_RESUMES)"
  fi
  rmdir "$LOCK" 2>/dev/null || die "could not release pipeline lock before automatic resume"
  trap - EXIT
  export AGENT_PIPELINE_USAGE_RESUME_COUNT="$next_count"
  restart_cmd=(bash "$ROOT/scripts/auto-agent-practice.sh" --orchestrator "$AGENT_PIPELINE_ORCHESTRATOR")
  restart_cmd+=(--max-rounds "$MAX_AGENT_REVIEW_ROUNDS")
  if [ -n "$resume_log" ]; then
    restart_cmd+=(--resume-after-run "$resume_log")
  else
    restart_cmd+=(--topic "$TOPIC")
  fi
  [ "$SCHEDULED" = 1 ] && restart_cmd+=(--scheduled)
  [ "$AUTO_MERGE" = 1 ] && restart_cmd+=(--auto-merge) || restart_cmd+=(--pr-only)
  exec "${restart_cmd[@]}"
}

[ -x scripts/safe-sync-main.sh ] || die "safe sync helper is missing or not executable"
bash scripts/safe-sync-main.sh "$AGENT_PIPELINE_BASE_BRANCH" \
  || die "safe synchronization with origin/$AGENT_PIPELINE_BASE_BRANCH failed"

SHARED_ARTIFACT_SNAPSHOT="${ARTICLE_PIPELINE_SHARED_ARTIFACT_SNAPSHOT:-$PIPE_DIR/shared-artifacts-before.json}"
if [ -z "${ARTICLE_PIPELINE_SHARED_ARTIFACT_SNAPSHOT:-}" ]; then
  node "$ARTIFACT_TOOL" snapshot "$ROOT" "$SHARED_ARTIFACT_SNAPSHOT" \
    || die "could not snapshot existing artifacts for generated-path validation"
fi

run_stage() {
  local stage="$1" idx="$2" skill="$3" allowed="$4" search="$5" prompt="$6"
  local reuse_after="${7:-}"
  local contract_repair="${8:-0}"
  local marker="$PIPE_DIR/.$idx-$stage.marker"
  local events="$PIPE_DIR/$idx-$stage.events.jsonl"
  local result="$PIPE_DIR/$idx-$stage.result.json"
  local schema="$PIPE_DIR/$idx-$stage.schema.json"
  local validation_error="$PIPE_DIR/$idx-$stage.validation.stderr"
  local seconds contract rc stage_prompt schema_json
  seconds="$(stage_timeout "$stage")"
  node "$CONTRACT_TOOL" schema "$stage" "$schema" || die "$stage schema generation failed"
  contract="$(node "$CONTRACT_TOOL" prompt "$stage")" || die "$stage result prompt generation failed"
  touch "$marker"

  stage_prompt="Use \$$skill. $prompt Do not ask questions, alter Git state, publish, or expose credentials. Your final response must be only the schema-conforming stage result JSON. For status \"ok\", artifact must be one existing safe repository-relative regular file under $allowed and reason must be empty. For status \"abort\", artifact must be empty, reason must state the precise blocker, and all metadata must be null. $contract"

  local cmd
  if [ "$AGENT_PIPELINE_ORCHESTRATOR" = codex ]; then
    cmd=("$CODEX_BIN" "-a" "never")
    [ "$search" = 1 ] && cmd+=("--search")
    cmd+=("exec" "--ephemeral" "--ignore-user-config" "--sandbox" "danger-full-access")
    cmd+=("-c" "model_reasoning_effort=\"$AGENT_PIPELINE_EFFORT\"")
    [ -z "$AGENT_PIPELINE_MODEL" ] || cmd+=("--model" "$AGENT_PIPELINE_MODEL")
    cmd+=("-C" "$ROOT" "--json" "--output-schema" "$schema" "-o" "$result" "$stage_prompt")
  else
    schema_json="$(tr -d '\n' <"$schema")"
    stage_prompt="Read .agents/skills/$skill/SKILL.md completely, resolve its relative references from that skill directory, and follow it as the stage workflow. $prompt Do not ask questions, alter Git state, publish, or expose credentials. Your final response must be only the schema-conforming stage result JSON. For status \"ok\", artifact must be one existing safe repository-relative regular file under $allowed and reason must be empty. For status \"abort\", artifact must be empty, reason must state the precise blocker, and all metadata must be null. $contract"
    cmd=("$CLAUDE_BIN" "-p" "$stage_prompt" "--output-format" "json" "--json-schema" "$schema_json")
    cmd+=("--no-session-persistence" "--safe-mode" "--permission-mode" "bypassPermissions")
    [ "$search" = 1 ] || cmd+=("--disallowedTools" "WebSearch,WebFetch")
    [ -z "$AGENT_PIPELINE_MODEL" ] || cmd+=("--model" "$AGENT_PIPELINE_MODEL")
    [ -z "$AGENT_PIPELINE_EFFORT" ] || cmd+=("--effort" "$AGENT_PIPELINE_EFFORT")
  fi

  log "$stage start (timeout=${seconds}s, skill=$skill, orchestrator=$AGENT_PIPELINE_ORCHESTRATOR)"
  set +e
  "$TIMEOUT_BIN" "$seconds" "${cmd[@]}" >"$events" 2>>"$PLOG"
  rc=$?
  set -e
  if [ "$rc" = 124 ]; then
    if [ "$SCHEDULED" = 1 ]; then
      retry_pipeline system "stage-timeout-$stage" "$stage timed out; another scheduled topic may be tried"
    fi
    die "$stage timed out; events: $events"
  fi
  if [ "$rc" != 0 ]; then
    if [ "$AGENT_PIPELINE_ORCHESTRATOR" = claude ]; then
      restart_after_usage_limit "$stage" "$events" "$marker" || true
    fi
    if [ "$SCHEDULED" = 1 ]; then
      retry_pipeline system "stage-exit-$stage-$rc" "$stage failed with exit $rc; another scheduled topic may be tried"
    fi
    die "$stage failed with exit $rc; events: $events"
  fi
  if [ "$AGENT_PIPELINE_ORCHESTRATOR" = claude ]; then
    if ! node scripts/extract-claude-stage-result.mjs "$events" "$result"; then
      if [ "$SCHEDULED" = 1 ]; then
        retry_pipeline system "stage-extraction-$stage" "$stage Claude output extraction failed; another scheduled topic may be tried"
      fi
      die "$stage Claude output extraction failed; output: $events"
    fi
  fi
  set +e
  local validation_args=("$result" "$allowed" "$marker" "$stage")
  [ -z "$reuse_after" ] || validation_args+=("$reuse_after")
  STAGE_ARTIFACT="$(node "$RESULT_TOOL" "${validation_args[@]}" 2>"$validation_error")"
  local result_rc=$?
  set -e
  [ ! -s "$validation_error" ] || sed -n '1,200p' "$validation_error" >>"$PLOG"
  if [ "$result_rc" = 4 ] && [ "$SCHEDULED" = 1 ]; then
    retry_pipeline content "stage-abort-$stage" "$stage selected no safe or article-worthy output; another scheduled topic may be tried"
  fi
  if [ "$result_rc" != 0 ] && [ "$result_rc" != 4 ] \
      && [ "$contract_repair" -lt "$MAX_AGENT_STAGE_CONTRACT_REPAIRS" ]; then
    local next_repair=$((contract_repair + 1))
    local repair_prompt="$prompt The previous $stage attempt returned an invalid stage-result contract. Inspect $result and $validation_error. Repair only this stage: create or update the required primary artifact as a real regular file under $allowed, verify it exists before answering, and then return its exact repository-relative path in schema-conforming JSON. Do not claim an artifact that was not written."
    log "$stage contract repair start ($next_repair/$MAX_AGENT_STAGE_CONTRACT_REPAIRS)"
    run_stage "$stage" "$idx-contract-repair-$next_repair" "$skill" "$allowed" "$search" \
      "$repair_prompt" "$reuse_after" "$next_repair"
    return
  fi
  if [ "$result_rc" != 0 ] && [ "$SCHEDULED" = 1 ]; then
    retry_pipeline system "stage-result-contract-$stage" "$stage returned an invalid result contract; another scheduled topic may be tried"
  fi
  [ "$result_rc" = 0 ] || die "$stage result contract failed: $result"
  STAGE_RESULT="$result"
  log "$stage complete: $STAGE_ARTIFACT"
}

run_experiment_direct() {
  local marker="$PIPE_DIR/.3-run.marker"
  local stdout_file="$PIPE_DIR/3-run.stdout"
  local stderr_file="$PIPE_DIR/3-run.stderr"
  local validation_error="$PIPE_DIR/3-run-validation.stderr"
  local seconds rc validation_rc
  seconds="$(stage_timeout run)"
  touch "$marker"
  log "run start (timeout=${seconds}s, deterministic runner=$AGENT_EXPERIMENT_RUNNER)"
  set +e
  "$TIMEOUT_BIN" "$seconds" node "$AGENT_EXPERIMENT_RUNNER" "$MANIFEST" \
    >"$stdout_file" 2>"$stderr_file"
  rc=$?
  set -e
  [ ! -s "$stderr_file" ] || sed -n '1,200p' "$stderr_file" >>"$PLOG"
  if [ "$rc" = 124 ]; then
    if [ "$SCHEDULED" = 1 ]; then
      retry_pipeline system "run-experiment-timeout" "deterministic experiment runner timed out; another scheduled topic may be tried"
    fi
    die "deterministic experiment runner timed out; output: $stdout_file"
  fi
  if [ "$rc" != 0 ]; then
    if [ "$SCHEDULED" = 1 ]; then
      retry_pipeline system "run-experiment-exit-$rc" "deterministic experiment runner failed with exit $rc; another scheduled topic may be tried"
    fi
    die "deterministic experiment runner failed with exit $rc; output: $stdout_file"
  fi

  set +e
  RUN_LOG="$(node "$RUN_RESULT_TOOL" "$stdout_file" "$MANIFEST" "$marker" 2>"$validation_error")"
  validation_rc=$?
  set -e
  [ ! -s "$validation_error" ] || sed -n '1,200p' "$validation_error" >>"$PLOG"
  if [ "$validation_rc" != 0 ]; then
    if [ "$SCHEDULED" = 1 ]; then
      retry_pipeline system "run-result-contract" "deterministic experiment runner returned an invalid artifact contract; another scheduled topic may be tried"
    fi
    die "deterministic experiment runner result contract failed: $stdout_file"
  fi
  log "run complete: $RUN_LOG"
}

validate_generated_manifest() {
  if ! node scripts/agent-practice/validate-manifest.mjs "$MANIFEST" >/dev/null; then
    if [ "$SCHEDULED" = 1 ]; then
      retry_pipeline content "invalid-manifest" "generated manifest failed independent validation; another scheduled topic may be tried"
    fi
    die "generated manifest failed independent validation"
  fi
  if ! node -e 'const fs=require("node:fs"); const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.exit(m.version === 2 ? 0 : 1)' "$MANIFEST"; then
    if [ "$SCHEDULED" = 1 ]; then
      retry_pipeline content "legacy-manifest" "generated manifest did not use version 2; another scheduled topic may be tried"
    fi
    die "generated manifest must use version 2 so wrapper cases cannot bypass fake-CLI preflight"
  fi
}

run_manifest_preflight() {
  local repair_round="$1"
  local stdout_file="$PIPE_DIR/2-preflight-$repair_round.stdout"
  local stderr_file="$PIPE_DIR/2-preflight-$repair_round.stderr"
  local rc summary path_stdout="$PIPE_DIR/2-path-preflight-$repair_round.stdout"
  local path_stderr="$PIPE_DIR/2-path-preflight-$repair_round.stderr"
  log "preflight start (repair=$repair_round/$MAX_AGENT_PREFLIGHT_REPAIRS, manifest=$MANIFEST)"
  set +e
  node "$GENERATED_PATH_TOOL" "$MANIFEST" "$SHARED_ARTIFACT_SNAPSHOT" \
    >"$path_stdout" 2>"$path_stderr"
  rc=$?
  set -e
  if [ "$rc" != 0 ]; then
    PREFLIGHT_EVIDENCE="$path_stderr"
    [ ! -s "$path_stderr" ] || sed -n '1,200p' "$path_stderr" >>"$PLOG"
    log "generated artifact namespace preflight failed before any authenticated experiment (exit=$rc, evidence=$PREFLIGHT_EVIDENCE)"
    return 1
  fi
  set +e
  node scripts/agent-practice/run-experiment.mjs "$MANIFEST" --preflight-only \
    >"$stdout_file" 2>"$stderr_file"
  rc=$?
  set -e
  summary="$(sed -n '1p' "$stdout_file")"
  if [ "$rc" = 0 ]; then
    if [ -z "$summary" ] || [ ! -f "$summary" ]; then
      PREFLIGHT_EVIDENCE="$stdout_file"
      log "preflight exited 0 without a summary artifact"
      return 1
    fi
    PREFLIGHT_EVIDENCE="$summary"
    log "preflight complete: $PREFLIGHT_EVIDENCE"
    return 0
  fi
  PREFLIGHT_EVIDENCE="${summary:-$stderr_file}"
  log "preflight failed before any authenticated experiment (exit=$rc, evidence=$PREFLIGHT_EVIDENCE)"
  return 1
}

if [ -n "$RESUME_RUN_LOG" ]; then
  case "$RESUME_RUN_LOG" in
    logs/agent/run-*/execution-log.md) ;;
    *) die "--resume-after-run must be a repository-relative logs/agent/run-*/execution-log.md path" ;;
  esac
  [ -f "$RESUME_RUN_LOG" ] || die "resume execution log does not exist: $RESUME_RUN_LOG"
  RUN_LOG="$RESUME_RUN_LOG"
  MANIFEST="$(node -e '
    const fs = require("node:fs");
    const text = fs.readFileSync(process.argv[1], "utf8");
    const match = text.match(/^- Manifest: `([^`]+)`$/m);
    if (!match) process.exit(1);
    process.stdout.write(match[1]);
  ' "$RUN_LOG")" || die "resume execution log does not declare a manifest"
  case "$MANIFEST" in practice/agent/*.json) ;; *) die "resume manifest path is invalid: $MANIFEST" ;; esac
  node scripts/agent-practice/validate-manifest.mjs "$MANIFEST" >/dev/null \
    || die "resume manifest failed independent validation"
  REPORT="$(node -e '
    const fs = require("node:fs");
    const manifest = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    process.stdout.write(manifest.source_report);
  ' "$MANIFEST")"
  case "$REPORT" in research/agent/*.md) ;; *) die "resume research path is invalid: $REPORT" ;; esac
  [ -f "$REPORT" ] || die "resume research report does not exist: $REPORT"
  log "resuming after verified run: $RUN_LOG"
else
  # Which arm the next article belongs to is decided from the ledger BEFORE the
  # research stage sees the topic. Letting the research stage pick its own arm
  # is how EXP-001 ended up with 0 of its 12 treatment articles while both
  # registered contracts went to exploration.
  ARM_PROMPT="$(node "$ARM_TOOL" --prompt)" || die "experiment arm allocation failed"
  ALLOCATED_ARM="$(node "$ARM_TOOL" --json | node -e '
    const chunks = [];
    process.stdin.on("data", (chunk) => chunks.push(chunk));
    process.stdin.on("end", () => {
      process.stdout.write(String(JSON.parse(chunks.join("")).arm ?? ""));
    });
  ')" || die "experiment arm allocation failed"
  [ -n "$ALLOCATED_ARM" ] || die "experiment arm allocation returned no arm"
  log "arm assignment: $(node "$ARM_TOOL" | sed -n '1p;4p' | tr '\n' ' ')"

  SEARCH_PROMPT="Research this scope: $TOPIC. Select one current, article-worthy reader decision for Claude Code, OpenAI Codex, or a fair cross-provider workflow only when comparison serves a concrete reader decision, and three or more falsifiable claims that together answer it. Exclude topics already covered by articles or prior agent reports. A boundary, failure mode, configuration, new feature, or reproducible workflow is evidence inside the article, not the article itself: a single boundary check is the deprecated archetype that produced 57 articles with no result above four likes. Every claim must add value beyond official documentation and be verifiable locally with a bounded offline fixture. $ARM_PROMPT Every authenticated live case must be runnable with the machine's existing successful claude auth status or codex login status and subscription authentication, without an API key, new secret, separate paid API billing, or interactive login. Exclude modes such as Claude Code --bare when official behavior says they discard subscription credentials and require ANTHROPIC_API_KEY. Use current official primary sources, record access dates, use community guidance only as a hypothesis, and create exactly one research report."
  SEARCH_PROMPT="$SEARCH_PROMPT Prefer a claim whose expected and competing outcomes can be distinguished from deterministic CLI output, filesystem state, or configuration behavior without depending on a model to reproduce precise timing, simultaneous tool ordering, or probabilistic narration."
  run_stage search 1 zenn-agent-search-knowhow research/agent "$AGENT_PIPELINE_SEARCH" "$SEARCH_PROMPT"
  REPORT="$STAGE_ARTIFACT"

  PLAN_PROMPT="Research report: $REPORT. Before choosing any generated path, inspect the existing shared artifact inventory at $SHARED_ARTIFACT_SNAPSHOT. Create exactly one safe plan and one runner-compatible version 2 manifest for the selected claim. Every authenticated live case must complete with the machine's existing successful claude auth status or codex login status and subscription authentication; do not require an API key, new secret, separate paid API billing, or interactive login, and reject the report as infeasible if its tested mode discards those existing credentials. Bound live probes with the manifest timeout and turn limits; do not add --max-budget-usd because a low currency cap can terminate a valid subscription-backed probe before verification. Every case must declare execution with mode, wrapper, preflight_cli, and environment. Use direct/inherit with null wrapper fields unless a fixture adapter is essential. A fixture-wrapper case must declare executable fixture-relative wrapper and offline fake preflight CLI paths, protect both paths, and pass no credential, network, model, or paid request during preflight. Inspect scripts/agent-practice/run-experiment.mjs and make the wrapper accept its exact buildAgentArgs contract; in particular, Codex cases receive --sandbox workspace-write, so a wrapper must not require read-only. If a fake CLI starts asynchronous work needed by verification, wait for its required artifacts with a bounded timeout before the fake CLI exits. A Node-based fake CLI that allowlists environment names must tolerate harmless variables injected by the platform runtime, including macOS __CF_USER_TEXT_ENCODING, while still rejecting credential-bearing variables. Never rely on a launch override described only in prose. Reuse an origin-tracked existing fixture only when it fits without distortion and do not modify it. Otherwise create the smallest deterministic self-contained fixture under fixtures/agent-practice/: the new manifest id and fixture basename must be identical and end in -YYYYMMDD-HHMM. Never overwrite or reuse an untracked shared artifact path. New product guidance must live under fixtures/agent-practice/guidance/<manifest-id>/. Require no dependency installation, network, secret, browser login, production state, or external service. Use the fewest providers and cases that falsify the claim, pre-register the expected and competing outcomes, define deterministic verification and strict changed-path boundaries, validate the manifest, and return it as the primary artifact."
  PLAN_PROMPT="$PLAN_PROMPT The verifier must treat every pre-registered conclusive expected or competing outcome as a successful evidence capture, emit an outcome-specific marker for each, and leave the verdict to analysis; it must fail only for inconclusive harness, safety, service, or evidence-integrity conditions. Do not require an exact count of provider result events unless the wrapper first filters nested child events from the single top-level result."
  run_stage plan 2 zenn-agent-plan-practice practice/agent 0 "$PLAN_PROMPT"
  MANIFEST="$STAGE_ARTIFACT"
  validate_generated_manifest

  preflight_repair=0
  while ! run_manifest_preflight "$preflight_repair"; do
    if [ "$preflight_repair" -ge "$MAX_AGENT_PREFLIGHT_REPAIRS" ]; then
      if [ "$SCHEDULED" = 1 ]; then
        retry_pipeline content "preflight-exhausted" "preflight did not pass after $MAX_AGENT_PREFLIGHT_REPAIRS repairs; another scheduled topic may be tried"
      fi
      die "preflight did not pass after $MAX_AGENT_PREFLIGHT_REPAIRS repairs; evidence: $PREFLIGHT_EVIDENCE"
    fi
    preflight_repair=$((preflight_repair + 1))
    REPAIR_PROMPT="Research report: $REPORT. The previous manifest $MANIFEST failed either the generated-artifact namespace check or the runner's offline fake-CLI preflight before any authenticated experiment. Inspect $PREFLIGHT_EVIDENCE and any sibling per-case preflight logs and preserved preflight-work directory that exist. Repair the same selected claim by creating exactly one corrected safe plan and runner-compatible version 2 manifest. Fix the recorded failure rather than changing the claim or weakening verification. If the evidence reports an artifact path collision or new-fixture naming failure, choose a fresh manifest id and identical fixture basename ending in -YYYYMMDD-HHMM; do not rename or mutate an origin-tracked fixture. Every authenticated live case must remain runnable with existing subscription authentication only, without an API key, new secret, separate paid API billing, interactive login, or --max-budget-usd. The wrapper must accept the exact arguments built by scripts/agent-practice/run-experiment.mjs, and asynchronous fake-CLI effects required by verification must be durably observable before the fake CLI exits. Preserve credential rejection, zero network and paid requests in preflight, bounded cleanup, strict protected paths, and deterministic competing outcomes. Validate the corrected manifest and return it as the primary artifact."
    REPAIR_PROMPT="$REPAIR_PROMPT Preserve outcome-specific success markers for all pre-registered conclusive expected and competing observations; do not turn an honest negative result into a verifier failure."
    run_stage plan "2-repair-$preflight_repair" zenn-agent-plan-practice practice/agent 0 "$REPAIR_PROMPT"
    MANIFEST="$STAGE_ARTIFACT"
    validate_generated_manifest
  done

  run_experiment_direct
fi

ANALYZE_PROMPT="Execution log: $RUN_LOG. Inspect the manifest and every case's raw metrics, verifier output, and diff. Create exactly one analysis report with one verdict, one next action, and the required editorial brief. A negative or conditional finding may still recommend drafting when it is reproducible and gives the named reader a useful decision."
run_stage analyze 4 zenn-agent-analyze-results logs/agent 0 "$ANALYZE_PROMPT" "$RESUME_RUN_LOG"
ANALYSIS="$STAGE_ARTIFACT"
ACTION="$(node -e 'const fs=require("node:fs"); const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(r.metadata.action)' "$STAGE_RESULT")"
if [ "$ACTION" != draft ]; then
  if [ "$SCHEDULED" = 1 ]; then
    retry_pipeline content "analysis-action-$ACTION" "analysis selected action=$ACTION; another scheduled topic may be tried"
  fi
  die "analysis selected action=$ACTION; an honest article cannot be drafted without a new run"
fi

DRAFT_PROMPT="Analysis: $ANALYSIS. Execution log: $RUN_LOG. Draft exactly one unpublished Japanese Zenn article using the editorial brief and the appropriate article-type structure. Lead with the reader's practical problem and evidence-backed answer. Focus on the selected tested practice and its observed limits, not an unsupported broad ranking or a pipeline-shaped report."
run_stage draft 5 zenn-agent-draft-article articles 0 "$DRAFT_PROMPT"
ARTICLE="$STAGE_ARTIFACT"
if ! bash scripts/check-article.sh "$ARTICLE" --expect-published false; then
  if [ "$SCHEDULED" = 1 ]; then
    retry_pipeline system "draft-article-check" "draft article check failed; another scheduled topic may be tried"
  fi
  die "draft article check failed"
fi

round=1
while [ "$round" -le "$MAX_AGENT_REVIEW_ROUNDS" ]; do
  REVIEW_PROMPT="Article: $ARTICLE. Analysis: $ANALYSIS. Execution log: $RUN_LOG. Review the exact draft against source and run evidence, apply the 100-point editorial rubric, and create exactly one review report."
  run_stage review "6-$round" zenn-agent-review-article logs/agent 0 "$REVIEW_PROMPT"
  REVIEW="$STAGE_ARTIFACT"
  VERDICT="$(node -e 'const fs=require("node:fs"); const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(r.metadata.verdict)' "$STAGE_RESULT")"
  case "$VERDICT" in
    pass)
      [ "$(rg -c '^blockers: 0$' "$REVIEW" || true)" = 1 ] \
        || system_failure "review-pass-contract" "passing review must declare blockers: 0"
      [ "$(rg -c '^warnings: 0$' "$REVIEW" || true)" = 1 ] \
        || system_failure "review-pass-contract" "passing review must declare warnings: 0"
      [ "$(rg -c '^editorial_score: [0-9]{1,3}/100$' "$REVIEW" || true)" = 1 ] \
        || system_failure "review-pass-contract" "passing review must declare exactly one editorial_score: N/100"
      EDITORIAL_SCORE="$(sed -nE 's/^editorial_score: ([0-9]{1,3})\/100$/\1/p' "$REVIEW")"
      [ "$EDITORIAL_SCORE" -ge 80 ] && [ "$EDITORIAL_SCORE" -le 100 ] \
        || system_failure "review-pass-contract" "passing review editorial score must be 80-100, got $EDITORIAL_SCORE"
      break
      ;;
    fix)
      REVISION_PROMPT="Article: $ARTICLE. Review: $REVIEW. Analysis: $ANALYSIS. Execution log: $RUN_LOG. Apply every evidence-resolvable integrity and editorial finding, including structural changes needed by the weakest rubric categories. Keep the article unpublished, run deterministic checks, and create the revision log required by the skill. Return the revised article as the primary artifact."
      run_stage revise "7-$round" zenn-agent-revise-article articles 0 "$REVISION_PROMPT"
      ARTICLE="$STAGE_ARTIFACT"
      if ! bash scripts/check-article.sh "$ARTICLE" --expect-published false; then
        if [ "$SCHEDULED" = 1 ]; then
          retry_pipeline system "revised-article-check" "revised article check failed; another scheduled topic may be tried"
        fi
        die "revised article check failed"
      fi
      ;;
    rerun|blocker)
      if [ "$SCHEDULED" = 1 ]; then
        retry_pipeline content "review-$VERDICT" "review verdict=$VERDICT requires new evidence; another scheduled topic may be tried"
      fi
      die "review verdict=$VERDICT requires new evidence: $REVIEW"
      ;;
    *) system_failure "unsupported-review-verdict" "unsupported review verdict: $VERDICT" ;;
  esac
  round=$((round + 1))
done
if [ "${VERDICT:-}" != pass ]; then
  if [ "$SCHEDULED" = 1 ]; then
    retry_pipeline content "review-rounds-exhausted" "review did not pass within $MAX_AGENT_REVIEW_ROUNDS rounds; another scheduled topic may be tried"
  fi
  die "review did not pass within $MAX_AGENT_REVIEW_ROUNDS rounds"
fi

if [ -n "${ARTICLE_PIPELINE_SHARED_ROOT:-}" ] && [ -n "${ARTICLE_PIPELINE_ARTIFACT_BASELINE:-}" ] \
    && [ "$ROOT" != "$ARTICLE_PIPELINE_SHARED_ROOT" ]; then
  EXPORT_PREFLIGHT="$PIPE_DIR/artifact-export-precheck.stderr"
  log "artifact export precheck start before publication side effects"
  set +e
  node "$ARTIFACT_TOOL" check-sync "$ROOT" "$ARTICLE_PIPELINE_SHARED_ROOT" \
    "$ARTICLE_PIPELINE_ARTIFACT_BASELINE" 2>"$EXPORT_PREFLIGHT"
  EXPORT_PREFLIGHT_RC=$?
  set -e
  [ ! -s "$EXPORT_PREFLIGHT" ] || sed -n '1,200p' "$EXPORT_PREFLIGHT" >>"$PLOG"
  if [ "$EXPORT_PREFLIGHT_RC" = 3 ]; then
    if [ "$SCHEDULED" = 1 ]; then
      retry_pipeline content "artifact-path-collision" "artifact export precheck found a shared-path collision before PR creation"
    fi
    die "artifact export precheck found a shared-path collision before PR creation: $EXPORT_PREFLIGHT"
  elif [ "$EXPORT_PREFLIGHT_RC" != 0 ]; then
    system_failure "artifact-export-precheck" "artifact export precheck failed with exit $EXPORT_PREFLIGHT_RC"
  fi
  log "artifact export precheck complete"
fi

PUBLISH_ARGS=(--article "$ARTICLE" --review "$REVIEW" --pipeline "$PIPE_DIR")
# A run that allocated an arm must not reach main without the matching contract:
# the article would be published and the experiment would still read 0/12. On a
# resumed run the arm was allocated by the earlier attempt, so only require that
# some contract accompanies the article.
if [ -n "${ALLOCATED_ARM:-}" ]; then
  PUBLISH_ARGS+=(--expect-arm "$ALLOCATED_ARM")
else
  PUBLISH_ARGS+=(--require-contract)
fi
[ "$AUTO_MERGE" = 1 ] && PUBLISH_ARGS+=(--auto-merge) || PUBLISH_ARGS+=(--pr-only)
PUBLISH_SUMMARY="$(bash scripts/agent-practice/enqueue-reviewed-article.sh "${PUBLISH_ARGS[@]}")" \
  || die "publication queue helper failed"

log "complete: publication queued for $ARTICLE"
log "research: $REPORT"
log "manifest: $MANIFEST"
log "execution: $RUN_LOG"
log "analysis: $ANALYSIS"
log "review: $REVIEW"
printf '%s\n' "$PUBLISH_SUMMARY"
