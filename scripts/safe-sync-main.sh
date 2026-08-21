#!/usr/bin/env bash
# Safely fast-forward a pipeline checkout while preserving unique local evidence.
set -euo pipefail

BASE_BRANCH="${1:-main}"

log() { printf '[safe-sync] %s\n' "$*" >&2; }
die() { log "ERROR: $*"; exit 1; }

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || die "not inside a Git worktree"
cd "$ROOT"

[ "$(git branch --show-current)" = "$BASE_BRANCH" ] \
  || die "current branch must be $BASE_BRANCH"
if git status --porcelain --untracked-files=no | grep -q .; then
  die "tracked files contain uncommitted changes"
fi
git remote get-url origin >/dev/null 2>&1 || die "origin remote is required"
git check-ref-format --branch "$BASE_BRANCH" >/dev/null 2>&1 \
  || die "invalid base branch: $BASE_BRANCH"

GIT_TERMINAL_PROMPT=0 git fetch --quiet origin "$BASE_BRANCH" \
  || die "failed to fetch origin/$BASE_BRANCH"

TMP_BASE="${TMPDIR:-/tmp}"
SYNC_TMP="$(mktemp -d "$TMP_BASE/zenn-safe-sync.XXXXXX")"
cleanup() { rm -f "$SYNC_TMP/remote"; rmdir "$SYNC_TMP" 2>/dev/null || true; }
trap cleanup EXIT

# A merged queue PR can introduce an article at the same path as the local
# unpublished draft. Remove only byte-identical regular-file duplicates. A
# different local file is evidence and must stop the sync rather than be lost.
while IFS= read -r -d '' entry; do
  case "$entry" in
    '?? '*) path="${entry#?? }" ;;
    *) continue ;;
  esac
  if git cat-file -e "origin/$BASE_BRANCH:$path" 2>/dev/null; then
    object_type="$(git cat-file -t "origin/$BASE_BRANCH:$path" 2>/dev/null || true)"
    [ "$object_type" = blob ] \
      || die "untracked path conflicts with non-file on origin/$BASE_BRANCH: $path"
    [ -f "$path" ] && [ ! -L "$path" ] \
      || die "untracked path conflicts with origin/$BASE_BRANCH and is not a regular file: $path"
    git show "origin/$BASE_BRANCH:$path" >"$SYNC_TMP/remote" \
      || die "could not read origin/$BASE_BRANCH:$path"
    cmp -s -- "$path" "$SYNC_TMP/remote" \
      || die "untracked file differs from origin/$BASE_BRANCH: $path"
    rm -- "$path"
    log "removed byte-identical merged duplicate: $path"
  fi
done < <(git status --porcelain=v1 -z --untracked-files=all)

GIT_TERMINAL_PROMPT=0 git merge --ff-only "origin/$BASE_BRANCH" >/dev/null \
  || die "fast-forward to origin/$BASE_BRANCH failed"
log "synced $BASE_BRANCH to origin/$BASE_BRANCH"
