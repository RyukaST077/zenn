#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/codex-pipeline-test.XXXXXX")"
ARTICLE="articles/codex-pipeline-fixture.md"
PR_FIXTURE="logs/codex-pipeline-test-$$"
trap 'rm -rf "$TMP" "$ARTICLE" "$PR_FIXTURE"' EXIT

bash -n scripts/auto-publish-codex.sh scripts/auto-publish-codex-launchd.sh scripts/check-article.sh
node --check scripts/pipeline-state.mjs
node --check scripts/check-article.mjs
node --check scripts/validate-stage-result.mjs
node --check scripts/validate-pr-metadata.mjs
node -e 'JSON.parse(require("node:fs").readFileSync("scripts/schemas/codex-stage-result.schema.json", "utf8"))'

node scripts/pipeline-state.mjs init "$TMP/state.json" main
node scripts/pipeline-state.mjs validate "$TMP/state.json"
node scripts/pipeline-state.mjs set "$TMP/state.json" completed.search true
[ "$(node scripts/pipeline-state.mjs get "$TMP/state.json" completed.search)" = true ]
node scripts/pipeline-state.mjs review "$TMP/state.json" fix logs/review-fixture.md 2026-07-10T00:00:00Z
[ "$(node scripts/pipeline-state.mjs get "$TMP/state.json" review.next_stage)" = revise ]

printf '%s\n' \
  '---' \
  'title: "Codex pipeline fixture"' \
  'emoji: "🧪"' \
  'type: tech' \
  'topics: [codex, test]' \
  'published: false' \
  '---' \
  '' \
  '# Verification' \
  '' \
  'This is a deterministic fixture article.' >"$ARTICLE"
bash scripts/check-article.sh "$ARTICLE" --expect-published false

touch "$TMP/marker"
sleep 1
touch "$ARTICLE"
printf '%s\n' \
  '{' \
  '  "status": "ok",' \
  '  "artifact": "articles/codex-pipeline-fixture.md",' \
  '  "reason": "",' \
  '  "metadata": {"verdict": null, "slug": "codex-pipeline-fixture", "pr_metadata": null}' \
  '}' >"$TMP/stage-result.json"
[ "$(node scripts/validate-stage-result.mjs "$TMP/stage-result.json" articles "$TMP/marker" draft)" = "$ARTICLE" ]

mkdir -p "$PR_FIXTURE"
printf '%s\n' '# PR body' >"$PR_FIXTURE/pr-body.md"
printf '%s\n' "{\"title\":\"Fixture PR\",\"body_file\":\"$PR_FIXTURE/pr-body.md\"}" >"$PR_FIXTURE/pr-metadata.json"
node scripts/validate-pr-metadata.mjs "$PR_FIXTURE/pr-metadata.json" "$PR_FIXTURE" >/dev/null

bash scripts/auto-publish-codex.sh --dry-run >"$TMP/dry-run.txt"
rg -q 'approval=never, sandbox=danger-full-access' "$TMP/dry-run.txt"
rg -q 'model=gpt-5.6-sol, reasoning=high' "$TMP/dry-run.txt"
rg -q 'zenn-search-topic.*zenn-prepare-publish' "$TMP/dry-run.txt"

CODEX_SANDBOX_MODE=workspace-write bash scripts/auto-publish-codex.sh --dry-run >"$TMP/dry-run-workspace.txt"
rg -q 'approval=never, sandbox=workspace-write' "$TMP/dry-run-workspace.txt"

if CODEX_SANDBOX_MODE=invalid bash scripts/auto-publish-codex.sh --dry-run >"$TMP/dry-run-invalid.txt" 2>&1; then
  echo "invalid CODEX_SANDBOX_MODE unexpectedly succeeded" >&2
  exit 1
fi
rg -q 'CODEX_SANDBOX_MODE must be workspace-write or danger-full-access' "$TMP/dry-run-invalid.txt"

echo "Codex pipeline tests passed"
