#!/usr/bin/env bash
# Publish one reviewed agent-practice article from an isolated Git worktree.
set -euo pipefail

: "${CODEX_BIN:=codex}"
: "${AGENT_PIPELINE_MODEL:=}"
: "${AGENT_PIPELINE_EFFORT:=high}"
: "${AGENT_PIPELINE_BASE_BRANCH:=main}"
: "${AGENT_PIPELINE_MERGE_METHOD:=--squash}"
: "${TIMEOUT_AGENT_PREPARE_PUBLISH:=900}"

ARTICLE=""
REVIEW=""
PIPE_DIR=""
AUTO_MERGE=1
while [ "$#" -gt 0 ]; do
  case "$1" in
    --article) ARTICLE="${2:?--article requires a path}"; shift ;;
    --review) REVIEW="${2:?--review requires a path}"; shift ;;
    --pipeline) PIPE_DIR="${2:?--pipeline requires a path}"; shift ;;
    --auto-merge) AUTO_MERGE=1 ;;
    --pr-only) AUTO_MERGE=0 ;;
    -h|--help) sed -n '1,100p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
  shift
done

safe_relative() {
  case "$1" in ""|/*|..|../*|*/..|*/../*) return 1 ;; *) return 0 ;; esac
}
safe_relative "$ARTICLE" || { echo "invalid article path: $ARTICLE" >&2; exit 2; }
safe_relative "$REVIEW" || { echo "invalid review path: $REVIEW" >&2; exit 2; }
safe_relative "$PIPE_DIR" || { echo "invalid pipeline path: $PIPE_DIR" >&2; exit 2; }
case "$ARTICLE" in articles/*.md) ;; *) echo "article must be under articles/: $ARTICLE" >&2; exit 2 ;; esac
case "$REVIEW" in logs/agent/*.md) ;; *) echo "review must be under logs/agent/: $REVIEW" >&2; exit 2 ;; esac
case "$PIPE_DIR" in logs/agent/pipeline-*) ;; *) echo "invalid agent pipeline directory: $PIPE_DIR" >&2; exit 2 ;; esac
case "$AGENT_PIPELINE_MERGE_METHOD" in
  --merge|--rebase|--squash) ;;
  *) echo "AGENT_PIPELINE_MERGE_METHOD must be --merge, --rebase, or --squash" >&2; exit 2 ;;
esac

SOURCE_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
PLOG="$ROOT/$PIPE_DIR/pipeline.log"
mkdir -p "$ROOT/$PIPE_DIR"
touch "$PLOG"
log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*" | tee -a "$PLOG" >&2; }
die() { log "ERROR: $*"; exit 1; }

[ -f "$ROOT/$ARTICLE" ] || die "article does not exist: $ARTICLE"
[ -f "$ROOT/$REVIEW" ] || die "review does not exist: $REVIEW"
[ "$(git branch --show-current)" = "$AGENT_PIPELINE_BASE_BRANCH" ] \
  || die "current branch must be $AGENT_PIPELINE_BASE_BRANCH"
if git status --porcelain --untracked-files=no | rg . >/dev/null 2>&1; then
  die "tracked files contain uncommitted changes"
fi
command -v "$CODEX_BIN" >/dev/null 2>&1 || die "Codex CLI not found: $CODEX_BIN"
command -v gh >/dev/null 2>&1 || die "gh is required"
command -v node >/dev/null 2>&1 || die "node is required"
command -v rg >/dev/null 2>&1 || die "ripgrep is required"
TIMEOUT_BIN="$(command -v timeout || command -v gtimeout || true)"
[ -n "$TIMEOUT_BIN" ] || die "timeout or gtimeout is required"
GH_PROMPT_DISABLED=1 gh auth status >/dev/null 2>&1 || die "GitHub CLI is not authenticated"
"$CODEX_BIN" login status >/dev/null 2>&1 || die "Codex is not authenticated"

PUBLISH_CONTRACT_TOOL="$SOURCE_ROOT/scripts/stage-result-contract.mjs"
PUBLISH_RESULT_TOOL="$SOURCE_ROOT/scripts/validate-stage-result.mjs"
ARTICLE_CHECK_TOOL="$SOURCE_ROOT/scripts/check-article.mjs"
PR_METADATA_TOOL="$SOURCE_ROOT/scripts/validate-pr-metadata.mjs"
for required_tool in "$PUBLISH_CONTRACT_TOOL" "$PUBLISH_RESULT_TOOL" "$ARTICLE_CHECK_TOOL" "$PR_METADATA_TOOL"; do
  [ -f "$required_tool" ] || die "required publication tool is missing: $required_tool"
done
(cd "$ROOT" && node "$ARTICLE_CHECK_TOOL" "$ARTICLE" --expect-published false) \
  || die "draft article check failed"
[ "$(rg -c '^verdict: pass$' "$ROOT/$REVIEW" || true)" = 1 ] \
  || die "review must contain exactly one verdict: pass"
[ "$(rg -c '^blockers: 0$' "$ROOT/$REVIEW" || true)" = 1 ] \
  || die "passing review must declare blockers: 0"
[ "$(rg -c '^warnings: 0$' "$ROOT/$REVIEW" || true)" = 1 ] \
  || die "passing review must declare warnings: 0"
EDITORIAL_SCORE="$(sed -nE 's/^editorial_score: ([0-9]{1,3})\/100$/\1/p' "$ROOT/$REVIEW")"
[ -n "$EDITORIAL_SCORE" ] && [ "$EDITORIAL_SCORE" -ge 80 ] && [ "$EDITORIAL_SCORE" -le 100 ] \
  || die "passing review editorial score must be 80-100"

SLUG="$(basename "$ARTICLE" .md)"
TS="$(date +%Y%m%d-%H%M%S)"
BRANCH="publish/$SLUG"
if git show-ref --verify --quiet "refs/heads/$BRANCH" \
    || GIT_TERMINAL_PROMPT=0 git ls-remote --exit-code --heads origin "$BRANCH" >/dev/null 2>&1; then
  BRANCH="$BRANCH-$TS"
fi

PUBLISH_TMP_BASE="${TMPDIR:-/tmp}"
PUBLISH_WORKTREE="$(mktemp -d "$PUBLISH_TMP_BASE/zenn-agent-publish.XXXXXX")"
WORKTREE_ACTIVE=0
cleanup_worktree() {
  if [ "$WORKTREE_ACTIVE" = 1 ]; then
    git -C "$ROOT" worktree remove --force "$PUBLISH_WORKTREE" >/dev/null 2>&1 \
      || log "WARN: failed to remove temporary publication worktree: $PUBLISH_WORKTREE"
    WORKTREE_ACTIVE=0
  fi
  [ ! -d "$PUBLISH_WORKTREE" ] || rmdir "$PUBLISH_WORKTREE" 2>/dev/null || true
}
trap cleanup_worktree EXIT

git worktree add -b "$BRANCH" "$PUBLISH_WORKTREE" "$AGENT_PIPELINE_BASE_BRANCH" >/dev/null \
  || die "failed to create isolated publication worktree"
WORKTREE_ACTIVE=1
mkdir -p "$PUBLISH_WORKTREE/$(dirname "$ARTICLE")" "$PUBLISH_WORKTREE/$(dirname "$REVIEW")" "$PUBLISH_WORKTREE/$PIPE_DIR"
cp "$ROOT/$ARTICLE" "$PUBLISH_WORKTREE/$ARTICLE"
cp "$ROOT/$REVIEW" "$PUBLISH_WORKTREE/$REVIEW"
if [ -d "$ROOT/images/$SLUG" ]; then
  mkdir -p "$PUBLISH_WORKTREE/images"
  cp -R "$ROOT/images/$SLUG" "$PUBLISH_WORKTREE/images/$SLUG"
fi

STAGE="prepare_publish"
IDX="8"
MARKER="$ROOT/$PIPE_DIR/.$IDX-$STAGE.marker"
EVENTS="$ROOT/$PIPE_DIR/$IDX-$STAGE.events.jsonl"
RESULT="$ROOT/$PIPE_DIR/$IDX-$STAGE.result.json"
SCHEMA="$ROOT/$PIPE_DIR/$IDX-$STAGE.schema.json"
node "$PUBLISH_CONTRACT_TOOL" schema "$STAGE" "$SCHEMA" \
  || die "$STAGE schema generation failed"
CONTRACT="$(node "$PUBLISH_CONTRACT_TOOL" prompt "$STAGE")" \
  || die "$STAGE result prompt generation failed"
touch "$MARKER"

CMD=("$CODEX_BIN" "-a" "never" "exec" "--ephemeral" "--ignore-user-config"
  "--sandbox" "danger-full-access" "-c" "model_reasoning_effort=\"$AGENT_PIPELINE_EFFORT\"")
[ -z "$AGENT_PIPELINE_MODEL" ] || CMD+=("--model" "$AGENT_PIPELINE_MODEL")
CMD+=("-C" "$PUBLISH_WORKTREE" "--json" "--output-schema" "$SCHEMA" "-o" "$RESULT")
CMD+=("Use \$zenn-prepare-publish. Article: $ARTICLE. Passing review: $REVIEW. Pipeline directory: $PIPE_DIR. Prepare publication and PR metadata. Do not ask questions, perform Git or GitHub operations, modify the article body, or expose credentials. Your final response must be only the schema-conforming stage result JSON. For status \"ok\", reason must be empty. For status \"abort\", artifact must be empty, reason must state the precise blocker, and all metadata must be null. $CONTRACT")

log "$STAGE start in isolated worktree (timeout=${TIMEOUT_AGENT_PREPARE_PUBLISH}s)"
set +e
"$TIMEOUT_BIN" "$TIMEOUT_AGENT_PREPARE_PUBLISH" "${CMD[@]}" >"$EVENTS" 2>>"$PLOG"
RC=$?
set -e
[ "$RC" != 124 ] || die "$STAGE timed out; events: $EVENTS"
[ "$RC" = 0 ] || die "$STAGE failed with exit $RC; events: $EVENTS"
REPAIRED="$(node "$PUBLISH_CONTRACT_TOOL" normalize "$STAGE" "$RESULT")" \
  || die "$STAGE result normalization failed"
[ -z "$REPAIRED" ] || log "$STAGE result normalization: set $REPAIRED to null"
STAGE_ARTIFACT="$(cd "$PUBLISH_WORKTREE" && node "$PUBLISH_RESULT_TOOL" "$RESULT" articles "$MARKER" "$STAGE" 2>>"$PLOG")" \
  || die "$STAGE result contract failed: $RESULT"
[ "$STAGE_ARTIFACT" = "$ARTICLE" ] || die "$STAGE returned a different article: $STAGE_ARTIFACT"
(cd "$PUBLISH_WORKTREE" && node "$ARTICLE_CHECK_TOOL" "$ARTICLE" --expect-published true) \
  || die "publication article check failed"

PR_METADATA="$(node -e 'const fs=require("node:fs"); const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(r.metadata.pr_metadata)' "$RESULT")"
case "$PR_METADATA" in "$PIPE_DIR"/*) ;; *) die "PR metadata is outside pipeline directory: $PR_METADATA" ;; esac
METADATA_LINES="$(cd "$PUBLISH_WORKTREE" && node "$PR_METADATA_TOOL" "$PR_METADATA" "$PIPE_DIR")" \
  || die "PR metadata validation failed"
PR_TITLE="$(printf '%s\n' "$METADATA_LINES" | sed -n '1p')"
PR_BODY="$(printf '%s\n' "$METADATA_LINES" | sed -n '2p')"
mkdir -p "$ROOT/$(dirname "$PR_METADATA")" "$ROOT/$(dirname "$PR_BODY")"
cp "$PUBLISH_WORKTREE/$PR_METADATA" "$ROOT/$PR_METADATA"
cp "$PUBLISH_WORKTREE/$PR_BODY" "$ROOT/$PR_BODY"

git -C "$PUBLISH_WORKTREE" add -- "$ARTICLE"
[ -d "$PUBLISH_WORKTREE/images/$SLUG" ] && git -C "$PUBLISH_WORKTREE" add -- "images/$SLUG"
STAGED="$(git -C "$PUBLISH_WORKTREE" diff --cached --name-only)"
[ -n "$STAGED" ] || die "nothing was staged for publication"
while IFS= read -r staged_path; do
  case "$staged_path" in "$ARTICLE"|images/"$SLUG"/*) ;; *) die "disallowed staged path: $staged_path" ;; esac
done <<EOF
$STAGED
EOF
git -C "$PUBLISH_WORKTREE" diff --cached --check \
  || die "staged publication diff failed whitespace checks"
git -C "$PUBLISH_WORKTREE" commit -m "publish: $SLUG" >/dev/null \
  || die "publication commit failed"
COMMIT="$(git -C "$PUBLISH_WORKTREE" rev-parse HEAD)"
GIT_TERMINAL_PROMPT=0 git -C "$PUBLISH_WORKTREE" push --set-upstream origin "$BRANCH" >/dev/null \
  || die "publication push failed"

cleanup_worktree
PR_URL="$(GH_PROMPT_DISABLED=1 gh pr create --base "$AGENT_PIPELINE_BASE_BRANCH" --head "$BRANCH" --title "$PR_TITLE" --body-file "$ROOT/$PR_BODY")" \
  || die "PR creation failed"
if [ "$AUTO_MERGE" = 1 ]; then
  if GH_PROMPT_DISABLED=1 gh pr merge "$PR_URL" "$AGENT_PIPELINE_MERGE_METHOD" --auto --delete-branch; then
    MERGE_RESULT="auto-merge requested"
  elif GH_PROMPT_DISABLED=1 gh pr merge "$PR_URL" "$AGENT_PIPELINE_MERGE_METHOD" --delete-branch; then
    MERGE_RESULT="merged immediately"
  else
    die "PR merge failed: $PR_URL"
  fi
  GIT_TERMINAL_PROMPT=0 git pull --ff-only origin "$AGENT_PIPELINE_BASE_BRANCH" >/dev/null 2>&1 \
    || log "WARN: could not refresh $AGENT_PIPELINE_BASE_BRANCH after merge request"
else
  MERGE_RESULT="PR created; waiting for human merge"
fi

log "publication complete: article=$ARTICLE PR=$PR_URL merge=$MERGE_RESULT"
printf 'Article: %s\nPR: %s\nPipeline: %s\nCommit: %s\nMerge: %s\n' \
  "$ARTICLE" "$PR_URL" "$PIPE_DIR" "$COMMIT" "$MERGE_RESULT"
