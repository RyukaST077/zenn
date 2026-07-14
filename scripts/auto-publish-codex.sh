#!/usr/bin/env bash
# Codex Zenn pipeline: research -> practice -> draft -> review/revise -> branch -> PR.
# By default this matches the Claude pipeline's unattended host access. Run only on a
# dedicated machine or inside an outer isolation boundary such as a dev container.
set -euo pipefail

: "${CODEX_BIN:=codex}"
: "${CODEX_MODEL:=gpt-5.6-sol}"
: "${CODEX_REASONING_EFFORT:=high}"
: "${CODEX_SEARCH:=1}"
: "${CODEX_SANDBOX_MODE:=danger-full-access}"
: "${MAX_REVIEW_ROUNDS:=3}"
: "${BASE_BRANCH:=main}"
: "${MERGE_METHOD:=--squash}"

stage_timeout() {
  case "$1" in
    search) echo "${TIMEOUT_SEARCH:=2400}" ;;
    plan) echo "${TIMEOUT_PLAN:=1800}" ;;
    run) echo "${TIMEOUT_RUN:=14400}" ;;
    draft) echo "${TIMEOUT_DRAFT:=1800}" ;;
    review) echo "${TIMEOUT_REVIEW:=1200}" ;;
    revise) echo "${TIMEOUT_REVISE:=1800}" ;;
    prepare_publish) echo "${TIMEOUT_PUBLISH:=900}" ;;
  esac
}

AUTO_MERGE=0
DRY_RUN=0
RESUME_DIR=""
SEARCH_ARGS=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --auto-merge) AUTO_MERGE=1 ;;
    --dry-run) DRY_RUN=1 ;;
    --resume) RESUME_DIR="${2:?--resume requires a pipeline directory}"; shift ;;
    --max-rounds) MAX_REVIEW_ROUNDS="${2:?--max-rounds requires a number}"; shift ;;
    --search-args) SEARCH_ARGS="${2:?--search-args requires text}"; shift ;;
    -h|--help)
      sed -n '1,80p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
  shift
done

case "$MAX_REVIEW_ROUNDS" in *[!0-9]*|0) echo "MAX_REVIEW_ROUNDS must be a positive integer" >&2; exit 2 ;; esac
case "$CODEX_SANDBOX_MODE" in
  workspace-write|danger-full-access) ;;
  *) echo "CODEX_SANDBOX_MODE must be workspace-write or danger-full-access" >&2; exit 2 ;;
esac
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
TS="$(date +%Y%m%d-%H%M%S)"
if [ -n "$RESUME_DIR" ]; then
  case "$RESUME_DIR" in
    logs/codex-pipeline-*) PIPE_DIR="$RESUME_DIR" ;;
    *) echo "--resume must be a repository-relative logs/codex-pipeline-* directory" >&2; exit 2 ;;
  esac
else
  PIPE_DIR="logs/codex-pipeline-$TS"
fi
STATE="$PIPE_DIR/state.json"
PLOG="$PIPE_DIR/pipeline.log"
STATE_TOOL="scripts/pipeline-state.mjs"
RESULT_TOOL="scripts/validate-stage-result.mjs"
CONTRACT_TOOL="scripts/stage-result-contract.mjs"
TIMEOUT_BIN="$(command -v timeout || command -v gtimeout || true)"

log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*" | tee -a "$PLOG" >&2; }
die() {
  log "ERROR: $*"
  log "pipeline: $PIPE_DIR"
  log "resume: bash scripts/auto-publish-codex.sh --resume $PIPE_DIR$([ "$AUTO_MERGE" = 1 ] && printf ' --auto-merge')"
  exit 1
}
state_get() { node "$STATE_TOOL" get "$STATE" "$1"; }
state_set() { node "$STATE_TOOL" set "$STATE" "$1" "$2"; }
is_done() { [ "$(state_get "completed.$1")" = "true" ]; }
require_artifact() { local value; value="$(state_get "artifacts.$1")"; [ -n "$value" ] && [ -f "$value" ]; }
invalidate_from() {
  local stage="$1" seen=0 name
  for name in search plan run draft review prepare_publish push pr merge; do
    [ "$name" = "$stage" ] && seen=1
    [ "$seen" = 0 ] || state_set "completed.$name" false
  done
  case "$stage" in
    search)
      state_set artifacts.report null; state_set artifacts.task null
      state_set artifacts.run_log null; state_set artifacts.article null
      state_set artifacts.review null; state_set artifacts.revise null
      state_set artifacts.pr_metadata null
      state_set review '{"rounds":0,"last_verdict":null,"next_stage":"review","history":[]}' ;;
    plan)
      state_set artifacts.task null; state_set artifacts.run_log null
      state_set artifacts.article null; state_set artifacts.review null
      state_set artifacts.revise null; state_set artifacts.pr_metadata null
      state_set review '{"rounds":0,"last_verdict":null,"next_stage":"review","history":[]}' ;;
    run)
      state_set artifacts.run_log null; state_set artifacts.article null
      state_set artifacts.review null; state_set artifacts.revise null
      state_set artifacts.pr_metadata null
      state_set review '{"rounds":0,"last_verdict":null,"next_stage":"review","history":[]}' ;;
    draft)
      state_set artifacts.article null; state_set artifacts.review null
      state_set artifacts.revise null; state_set artifacts.pr_metadata null
      state_set review '{"rounds":0,"last_verdict":null,"next_stage":"review","history":[]}' ;;
    review)
      state_set artifacts.review null; state_set artifacts.revise null
      state_set artifacts.pr_metadata null
      state_set review '{"rounds":0,"last_verdict":null,"next_stage":"review","history":[]}' ;;
    prepare_publish) state_set artifacts.pr_metadata null ;;
  esac
  if [ "$stage" != "push" ] && [ "$stage" != "pr" ] && [ "$stage" != "merge" ]; then
    state_set publish '{"branch":null,"commit":null,"pr_url":null}'
  fi
}

if [ "$DRY_RUN" = 1 ]; then
  cat <<EOF
[dry-run] Codex Zenn pipeline
  root: $ROOT
  pipeline: $PIPE_DIR
  codex: $CODEX_BIN (model=${CODEX_MODEL:-CLI default}, reasoning=$CODEX_REASONING_EFFORT)
  policy: approval=never, sandbox=$CODEX_SANDBOX_MODE, ephemeral=true
  timeout: ${TIMEOUT_BIN:-MISSING (actual run will stop in preflight)}
  search: $CODEX_SEARCH
  review rounds: $MAX_REVIEW_ROUNDS
  base branch: $BASE_BRANCH
  auto merge: $AUTO_MERGE
  stages: zenn-search-topic -> zenn-plan-practice -> zenn-run-practice -> zenn-draft-article -> zenn-review-article <-> zenn-revise-article -> branch -> zenn-prepare-publish -> commit/push -> $([ "$AUTO_MERGE" = 1 ] && echo "archive artifacts -> ")PR
  codex command: $CODEX_BIN -a never [--search] exec --ephemeral --ignore-user-config --sandbox $CODEX_SANDBOX_MODE -C $ROOT --json --output-schema <stage-schema> -o <result> <prompt>
EOF
  exit 0
fi

mkdir -p "$PIPE_DIR"
touch "$PLOG"
[ -n "$TIMEOUT_BIN" ] || die "timeout or gtimeout is required (macOS: brew install coreutils)"
command -v "$CODEX_BIN" >/dev/null 2>&1 || die "Codex CLI not found: $CODEX_BIN"
command -v node >/dev/null 2>&1 || die "node is required"
command -v git >/dev/null 2>&1 || die "git is required"
command -v gh >/dev/null 2>&1 || die "gh is required"
command -v rg >/dev/null 2>&1 || die "ripgrep (rg) is required"
"$CODEX_BIN" login status >/dev/null 2>&1 || die "Codex is not authenticated"
GH_PROMPT_DISABLED=1 gh auth status >/dev/null 2>&1 || die "GitHub CLI is not authenticated"
[ -f "$CONTRACT_TOOL" ] || die "stage result contract tool is missing"
if [ "$CODEX_SANDBOX_MODE" = "workspace-write" ]; then
  SANDBOX_PROBE=".codex-sandbox-probe-$$"
  OUTSIDE_PROBE="$HOME/.codex-sandbox-outside-probe-$$"
  rm -f "$SANDBOX_PROBE" "$OUTSIDE_PROBE"
  if ! "$CODEX_BIN" sandbox -P :workspace -C "$ROOT" sh -c 'touch "$1" || exit 2; if touch "$2" 2>/dev/null; then exit 3; fi' sh "$SANDBOX_PROBE" "$OUTSIDE_PROBE"; then
    rm -f "$SANDBOX_PROBE" "$OUTSIDE_PROBE"
    die "Codex :workspace sandbox diagnostic failed"
  fi
  if [ ! -f "$SANDBOX_PROBE" ] || [ -f "$OUTSIDE_PROBE" ]; then
    rm -f "$SANDBOX_PROBE" "$OUTSIDE_PROBE"
    die "Codex sandbox does not enforce the expected write boundary"
  fi
  rm -f "$SANDBOX_PROBE" "$OUTSIDE_PROBE"
else
  log "WARN: danger-full-access is enabled; generated commands can access the host without sandbox restrictions"
fi

LOCK="$ROOT/.auto-publish-codex.lock"
if ! mkdir "$LOCK" 2>/dev/null; then die "another Codex pipeline holds $LOCK"; fi
trap 'rmdir "$LOCK" 2>/dev/null || true' EXIT

if [ -n "$RESUME_DIR" ]; then
  [ -f "$STATE" ] || die "resume state is missing: $STATE"
  node "$STATE_TOOL" validate "$STATE" || die "resume state is invalid"
  [ "$(state_get base_branch)" = "$BASE_BRANCH" ] || die "resume base branch differs from BASE_BRANCH"
else
  node "$STATE_TOOL" init "$STATE" "$BASE_BRANCH"
fi

# Resume repair: a completed stage is reusable only while its primary artifact exists.
if is_done search && ! require_artifact report; then invalidate_from search; fi
if is_done plan && ! require_artifact task; then invalidate_from plan; fi
if is_done run && ! require_artifact run_log; then invalidate_from run; fi
if is_done draft && ! require_artifact article; then invalidate_from draft; fi
if is_done review && ! require_artifact review; then invalidate_from review; fi
if is_done prepare_publish && ! require_artifact pr_metadata; then invalidate_from prepare_publish; fi
if [ "$(state_get review.next_stage)" = "revise" ] && ! require_artifact review; then invalidate_from review; fi

current_branch="$(git branch --show-current)"
saved_branch="$(state_get publish.branch)"
if [ "$current_branch" != "$BASE_BRANCH" ] && { [ -z "$saved_branch" ] || [ "$current_branch" != "$saved_branch" ]; }; then
  die "current branch is $current_branch; expected $BASE_BRANCH${saved_branch:+ or $saved_branch}"
fi
if git status --porcelain --untracked-files=no | rg . >/dev/null 2>&1; then
  die "tracked files contain uncommitted changes"
fi
if ! is_done preflight; then
  if [ "$current_branch" = "$BASE_BRANCH" ]; then
    GIT_TERMINAL_PROMPT=0 git pull --ff-only || die "git pull --ff-only failed"
  fi
  state_set completed.preflight true
fi

run_stage() {
  local stage="$1" idx="$2" skill="$3" allowed="$4" network="$5" search="$6" prompt="$7"
  local marker="$PIPE_DIR/.$idx-$stage.marker" events="$PIPE_DIR/$idx-$stage.events.jsonl"
  local result="$PIPE_DIR/$idx-$stage.result.json" schema="$PIPE_DIR/$idx-$stage.schema.json"
  local seconds rc contract repaired
  STAGE_MARKER="$marker"
  seconds="$(stage_timeout "$stage")"
  node "$CONTRACT_TOOL" schema "$stage" "$schema" || die "$stage result schema generation failed"
  contract="$(node "$CONTRACT_TOOL" prompt "$stage")" || die "$stage result prompt generation failed"

  # A prior attempt may have produced a valid artifact but populated metadata fields
  # that this stage is not allowed to own. Canonicalize only those forbidden fields;
  # never invent required verdict, slug, or PR metadata values.
  if [ -f "$marker" ] && [ -f "$result" ]; then
    repaired="$(node "$CONTRACT_TOOL" normalize "$stage" "$result")" || die "$stage result repair failed"
    [ -z "$repaired" ] || log "$stage result repair: set $repaired to null"
    if STAGE_ARTIFACT="$(node "$RESULT_TOOL" "$result" "$allowed" "$marker" "$stage" 2>>"$PLOG")"; then
      log "$stage recovered existing result: $STAGE_ARTIFACT"
      return
    fi
  fi

  touch "$marker"
  local cmd=("$CODEX_BIN" "-a" "never")
  [ "$search" = 1 ] && cmd+=("--search")
  cmd+=("exec" "--ephemeral" "--ignore-user-config" "--sandbox" "$CODEX_SANDBOX_MODE")
  [ "$CODEX_SANDBOX_MODE" != "workspace-write" ] || cmd+=("-c" "sandbox_workspace_write.network_access=$network")
  cmd+=("-c" "model_reasoning_effort=\"$CODEX_REASONING_EFFORT\"")
  [ -n "$CODEX_MODEL" ] && cmd+=("--model" "$CODEX_MODEL")
  cmd+=("-C" "$ROOT" "--json" "--output-schema" "$schema" "-o" "$result")
  cmd+=("Use \$$skill. $prompt The effective Codex sandbox mode for every pipeline stage, including run, is $CODEX_SANDBOX_MODE. If it is danger-full-access, override any workspace-write assumption in the skill: real-browser and Playwright verification are allowed, with a capability gate that stops rather than infers results when browser launch fails. Do not ask questions. Obey AGENTS.md. Your final response must be only the schema-conforming stage result JSON. When status is \"ok\", set \"reason\" to an empty string; use \"reason\" only when status is \"abort\". When status is \"abort\", set \"artifact\" to an empty string and put the precise cause in \"reason\". $contract")
  log "$stage start (timeout=${seconds}s, skill=$skill)"
  set +e
  "$TIMEOUT_BIN" "$seconds" "${cmd[@]}" >"$events" 2>>"$PLOG"
  rc=$?
  set -e
  [ "$rc" != 124 ] || die "$stage timed out; events: $events"
  [ "$rc" = 0 ] || die "$stage failed with exit $rc; events: $events"
  repaired="$(node "$CONTRACT_TOOL" normalize "$stage" "$result")" || die "$stage result normalization failed"
  [ -z "$repaired" ] || log "$stage result normalization: set $repaired to null"
  STAGE_ARTIFACT="$(node "$RESULT_TOOL" "$result" "$allowed" "$marker" "$stage")" || die "$stage result contract failed: $result"
  log "$stage complete: $STAGE_ARTIFACT"
}

if ! is_done search || ! require_artifact report; then
  run_stage search 1 zenn-search-topic research true "$([ "$CODEX_SEARCH" = 1 ] && echo 1 || echo 0)" \
    "Search constraints: ${SEARCH_ARGS:-use the skill defaults}. Create exactly one research report."
  case "$STAGE_ARTIFACT" in research/search-topic-*.md) ;; *) die "search artifact path is invalid: $STAGE_ARTIFACT" ;; esac
  state_set artifacts.report "\"$STAGE_ARTIFACT\""; state_set completed.search true
fi
REPORT="$(state_get artifacts.report)"

if ! is_done plan || ! require_artifact task; then
  run_stage plan 2 zenn-plan-practice practice false 0 \
    "Input research report: $REPORT. Create exactly one practice plan derived from it."
  case "$STAGE_ARTIFACT" in practice/practice-*.md) ;; *) die "plan artifact path is invalid: $STAGE_ARTIFACT" ;; esac
  state_set artifacts.task "\"$STAGE_ARTIFACT\""; state_set completed.plan true
fi
TASK="$(state_get artifacts.task)"

if ! is_done run || ! require_artifact run_log; then
  run_stage run 3 zenn-run-practice logs true 0 \
    "Input practice plan: $TASK. The primary artifact must be logs/run-*/execution-log.md."
  case "$STAGE_ARTIFACT" in logs/run-*/execution-log.md) ;; *) die "run artifact path is invalid: $STAGE_ARTIFACT" ;; esac
  state_set artifacts.run_log "\"$STAGE_ARTIFACT\""; state_set completed.run true
fi
RUN_LOG="$(state_get artifacts.run_log)"

if ! is_done draft || ! require_artifact article; then
  run_stage draft 4 zenn-draft-article articles false 0 \
    "Input execution log: $RUN_LOG. Create exactly one unpublished article."
  bash scripts/check-article.sh "$STAGE_ARTIFACT" --expect-published false || die "draft article check failed"
  state_set artifacts.article "\"$STAGE_ARTIFACT\""; state_set completed.draft true
fi
ARTICLE="$(state_get artifacts.article)"

while ! is_done review; do
  rounds="$(state_get review.rounds)"
  [ "$rounds" -lt "$MAX_REVIEW_ROUNDS" ] || die "review limit reached ($MAX_REVIEW_ROUNDS)"
  next="$(state_get review.next_stage)"
  if [ "$next" = "revise" ]; then
    REVIEW="$(state_get artifacts.review)"
    run_stage revise "5r-$((rounds + 1))" zenn-revise-article articles false 0 \
      "Article: $ARTICLE. Review report: $REVIEW. Execution log: $RUN_LOG. Create a revision log under logs/ as a side artifact."
    ARTICLE="$STAGE_ARTIFACT"
    bash scripts/check-article.sh "$ARTICLE" --expect-published false || die "revised article check failed"
    REVISION_SLUG="$(basename "$ARTICLE" .md)"
    REVISION_LOG="$(find logs -type f -name "revise-$REVISION_SLUG-*.md" -newer "$STAGE_MARKER" -print | head -1)"
    [ -n "$REVISION_LOG" ] || die "revise stage did not create a revision log"
    state_set artifacts.article "\"$ARTICLE\""; state_set artifacts.revise "\"$REVISION_LOG\""; state_set review.next_stage '"review"'
  else
    run_stage review "5-$((rounds + 1))" zenn-review-article logs false 0 \
      "Article: $ARTICLE. Execution log: $RUN_LOG. Create exactly one review report."
    REVIEW="$STAGE_ARTIFACT"
    case "$REVIEW" in logs/review-*.md) ;; *) die "review artifact path is invalid: $REVIEW" ;; esac
    verdict="$(node -e 'const fs=require("node:fs"); const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(r.metadata.verdict)' "$PIPE_DIR/5-$((rounds + 1))-review.result.json")"
    lines="$(rg -c '^verdict: (pass|fix|blocker)$' "$REVIEW" || true)"
    [ "$lines" = 1 ] || die "review report must contain exactly one verdict line: $REVIEW"
    rg -q "^verdict: $verdict$" "$REVIEW" || die "review result and report verdict differ"
    if [ "$verdict" = "pass" ]; then
      [ "$(rg -c '^blockers: 0$' "$REVIEW" || true)" = 1 ] || die "passing review must declare blockers: 0"
      [ "$(rg -c '^warnings: 0$' "$REVIEW" || true)" = 1 ] || die "passing review must declare warnings: 0"
    fi
    node "$STATE_TOOL" review "$STATE" "$verdict" "$REVIEW" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    [ "$verdict" != "blocker" ] || die "review found a blocker requiring new evidence: $REVIEW"
  fi
done

ARTICLE="$(state_get artifacts.article)"
SLUG="$(basename "$ARTICLE" .md)"
BRANCH="$(state_get publish.branch)"
if [ -z "$BRANCH" ]; then
  BRANCH="publish/$SLUG"
  git show-ref --verify --quiet "refs/heads/$BRANCH" && BRANCH="$BRANCH-$TS"
  [ "$(git branch --show-current)" = "$BASE_BRANCH" ] || die "cannot create publish branch outside $BASE_BRANCH"
  git switch -c "$BRANCH" || die "failed to create $BRANCH"
  state_set publish.branch "\"$BRANCH\""
elif [ "$(git branch --show-current)" != "$BRANCH" ]; then
  git switch "$BRANCH" || die "failed to switch to saved publish branch $BRANCH"
fi

if ! is_done prepare_publish; then
  REVIEW="$(state_get artifacts.review)"
  run_stage prepare_publish 6 zenn-prepare-publish articles false 0 \
    "Article: $ARTICLE. Passing review: $REVIEW. Pipeline directory: $PIPE_DIR. Prepare publication and PR metadata."
  ARTICLE="$STAGE_ARTIFACT"
  bash scripts/check-article.sh "$ARTICLE" --expect-published true || die "publication article check failed"
  PR_METADATA="$(node -e 'const fs=require("node:fs"); const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(r.metadata.pr_metadata)' "$PIPE_DIR/6-prepare_publish.result.json")"
  case "$PR_METADATA" in "$PIPE_DIR"/*) ;; *) die "PR metadata is outside pipeline directory: $PR_METADATA" ;; esac
  node scripts/validate-pr-metadata.mjs "$PR_METADATA" "$PIPE_DIR" >/dev/null || die "PR metadata validation failed"
  state_set artifacts.article "\"$ARTICLE\""; state_set artifacts.pr_metadata "\"$PR_METADATA\""; state_set completed.prepare_publish true
fi

ARTICLE="$(state_get artifacts.article)"
PR_METADATA="$(state_get artifacts.pr_metadata)"
if ! is_done push; then
  git add -- "$ARTICLE"
  [ -d "images/$SLUG" ] && git add -- "images/$SLUG"
  staged="$(git diff --cached --name-only)"
  [ -n "$staged" ] || die "nothing was staged for publication"
  while IFS= read -r staged_path; do
    case "$staged_path" in "$ARTICLE"|images/"$SLUG"/*) ;; *) die "disallowed staged path: $staged_path" ;; esac
  done <<EOF
$staged
EOF
  git commit -m "publish: $SLUG" || die "commit failed"
  COMMIT="$(git rev-parse HEAD)"
  state_set publish.commit "\"$COMMIT\""
  GIT_TERMINAL_PROMPT=0 git push --set-upstream origin "$BRANCH" || die "push failed"
  state_set completed.push true
fi

# auto-merge 時のみ: パイプライン素材(research/practice/logs)を同じ PR に別コミットで
# 相乗りさせ、マージ後に作業ツリーがクリーンになるようにする。記事コミット(記事+画像のみ)
# のガードは維持したいので、素材は必ず別コミットにする。.gitignore は git add が尊重する。
if [ "$AUTO_MERGE" = 1 ] && ! is_done archive; then
  if [ "$(git branch --show-current)" = "$BASE_BRANCH" ]; then
    log "archive: feature ブランチに居ないため素材コミットをスキップ"
  else
    git add -- research practice logs
    if git diff --cached --quiet; then
      log "archive: コミットする素材が無い"
    else
      git commit -m "chore: archive pipeline artifacts for $SLUG" || die "artifact commit failed"
      GIT_TERMINAL_PROMPT=0 git push || die "artifact push failed"
      log "archive: パイプライン素材を PR に追加コミット・push した"
    fi
  fi
  state_set completed.archive true
fi

if ! is_done pr; then
  metadata_lines="$(node scripts/validate-pr-metadata.mjs "$PR_METADATA" "$PIPE_DIR")" || die "PR metadata validation failed"
  PR_TITLE="$(printf '%s\n' "$metadata_lines" | sed -n '1p')"
  PR_BODY="$(printf '%s\n' "$metadata_lines" | sed -n '2p')"
  PR_URL="$(GH_PROMPT_DISABLED=1 gh pr create --base "$BASE_BRANCH" --head "$BRANCH" --title "$PR_TITLE" --body-file "$PR_BODY")" || die "PR creation failed"
  state_set publish.pr_url "\"$PR_URL\""; state_set completed.pr true
else
  PR_URL="$(state_get publish.pr_url)"
fi

if [ "$AUTO_MERGE" = 1 ] && ! is_done merge; then
  # branch protection があれば --auto（必須チェック通過後にマージ）、無ければ即時マージ
  if GH_PROMPT_DISABLED=1 gh pr merge "$PR_URL" "$MERGE_METHOD" --auto --delete-branch; then
    log "auto-merge scheduled (merges after required checks pass)"
  elif GH_PROMPT_DISABLED=1 gh pr merge "$PR_URL" "$MERGE_METHOD" --delete-branch; then
    log "PR merged immediately"
  else
    die "auto-merge setup failed"
  fi
  state_set completed.merge true
fi

git switch "$BASE_BRANCH" >/dev/null || die "failed to return to $BASE_BRANCH"
log "complete: article=$ARTICLE PR=$PR_URL"
printf 'Article: %s\nPR: %s\nPipeline: %s\n' "$ARTICLE" "$PR_URL" "$PIPE_DIR"
