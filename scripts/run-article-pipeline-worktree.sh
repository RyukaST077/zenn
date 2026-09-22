#!/usr/bin/env bash
# Trusted bootstrap: schedules load this file with `git show HEAD:... | bash`.
# Select the commit before loading any runtime JavaScript; never load checkout code.
set -euo pipefail
umask 077
ROOT="$(git rev-parse --show-toplevel)"
BASE="${ARTICLE_PIPELINE_BASE_BRANCH:-main}"
DEV_REF=""
MIGRATE=0
STORE="${ARTICLE_PIPELINE_STORE:-}"
MODE=normal
ARGS=("$@")
for ((i=0; i<${#ARGS[@]}; i++)); do
  case "${ARGS[$i]}" in
    --) break ;;
    --shared-root|--base|--dev-ref|--dev-file|--store|--resume-run|--migrate-legacy)
      OPTION="${ARGS[$i]}"
      i=$((i+1))
      [ "$i" -lt "${#ARGS[@]}" ] || { echo "$OPTION requires a value" >&2; exit 2; }
      case "$OPTION" in
        --shared-root) ROOT="${ARGS[$i]}" ;;
        --base) BASE="${ARGS[$i]}" ;;
        --dev-ref) DEV_REF="${ARGS[$i]}"; MODE=development ;;
        --dev-file) MODE=development ;;
        --store) STORE="${ARGS[$i]}" ;;
        --migrate-legacy) MIGRATE=1 ;;
      esac
      ;;
    --apply) ;;
    -h|--help)
      echo 'usage: [--base main] [--store directory] [--dev-ref ref] [--dev-file path] [--resume-run id] -- scripts/pipeline.sh [args...]'
      echo 'migration: --migrate-legacy source-directory [--apply]'
      exit 0 ;;
    *) echo "unknown runtime option: ${ARGS[$i]}" >&2; exit 2 ;;
  esac
done
BOOT="$(mktemp -d "${TMPDIR:-/tmp}/zenn-bootstrap.XXXXXX")"
FETCH_REF="refs/article-runtime/bootstrap-$$-$(basename "$BOOT")"
cleanup_bootstrap() {
  git -C "$ROOT" update-ref -d "$FETCH_REF" >/dev/null 2>&1 || true
  rm -rf "$BOOT"
}
trap cleanup_bootstrap EXIT
record_bootstrap_failure() {
  local code="$1" reason="$2" common
  common="$(git -C "$ROOT" rev-parse --git-common-dir)" || return 0
  node - "$ROOT" "$common" "$STORE" "$MODE" "${SHA:-}" "$code" "$reason" <<'JS'
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const [root, gitDir, requested, mode, sha, code, reason] = process.argv.slice(2);
const common = path.resolve(root, gitDir), store = path.resolve(requested || path.join(common, 'article-runtime'));
if ((store === root || store.startsWith(root + '/')) && !store.startsWith(common + '/')) process.exit(0);
const id = 'bootstrap-' + Date.now() + '-' + crypto.randomBytes(5).toString('hex');
const dir = path.join(store, 'runs', id), now = new Date().toISOString();
fs.mkdirSync(dir, {recursive: true, mode: 0o700});
const manifest = {version: 1, run_id: id, started_at: now, ended_at: now, status: 'failed', reason,
  mode, base_sha: sha || null, exit_code: Number(code), pipeline_exit_code: null,
  development: {files: [], diff: null}, operational_snapshot: null, files: {}, changes: [],
  articles: [], publication: [], control_changes: [], resume: {worktree: null}};
fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
fs.writeFileSync(path.join(dir, 'summary.md'), `# Bootstrap failure ${id}\n\n${reason} (exit ${code}). No pipeline was started.\n`);
console.error('[article-runtime] manifest: ' + path.join(dir, 'manifest.json'));
JS
}
trap 'BOOT_RC=$?; record_bootstrap_failure "$BOOT_RC" "bootstrap failed before pipeline execution (line $LINENO)"; exit "$BOOT_RC"' ERR
if [ "$MIGRATE" = 1 ]; then
  SHA="$(git -C "$ROOT" rev-parse --verify HEAD)"
  ORIGIN_SHA="$SHA"
else
  git -C "$ROOT" check-ref-format --branch "$BASE" >/dev/null
  GIT_TERMINAL_PROMPT=0 git -C "$ROOT" fetch --quiet origin "+refs/heads/$BASE:$FETCH_REF"
  ORIGIN_SHA="$(git -C "$ROOT" rev-parse --verify "$FETCH_REF^{commit}")"
  SHA="$ORIGIN_SHA"
  [ -z "$DEV_REF" ] || SHA="$(git -C "$ROOT" rev-parse --verify "$DEV_REF^{commit}")"
  # An outdated installed entry must be explicitly synchronized, not silently
  # mixed with a new runtime. Local working-file changes are checked by runtime.
  if [ -z "$DEV_REF" ] && [ "$(git -C "$ROOT" rev-parse HEAD:scripts/run-article-pipeline-worktree.sh)" != "$(git -C "$ROOT" rev-parse "$SHA:scripts/run-article-pipeline-worktree.sh")" ]; then
    echo 'committed bootstrap differs from origin; safely synchronize the entry checkout or use --dev-ref' >&2
    record_bootstrap_failure 2 'committed bootstrap differs from selected code'
    exit 2
  fi
fi
git -C "$ROOT" show "$SHA:scripts/article-runtime.mjs" >"$BOOT/runtime.mjs" || {
  echo 'Runtime missing from selected commit. Commit the implementation on a development branch and use --dev-ref HEAD.' >&2
  record_bootstrap_failure 2 'runtime missing from selected commit'; exit 2;
}
trap - ERR
node "$BOOT/runtime.mjs" --selected-code "$SHA" "$ORIGIN_SHA" "${ARGS[@]}"
