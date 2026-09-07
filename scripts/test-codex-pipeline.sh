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
node --check scripts/stage-result-contract.mjs
node --check scripts/validate-codex-completion.mjs

FINAL_MESSAGE='{"status":"ok","artifact":"logs/run-fixture/execution-log.md","reason":"","metadata":{"verdict":null,"slug":null,"pr_metadata":null}}'
printf '%s\n' "$FINAL_MESSAGE" >"$TMP/final.json"
printf '%s\n' \
  '{"type":"thread.started"}' \
  '{"type":"item.completed","item":{"type":"agent_message","text":"{\"status\":\"ok\",\"artifact\":\"progress\"}"}}' \
  '{"type":"item.completed","item":{"type":"command_execution","status":"completed","exit_code":0}}' \
  '{"type":"item.completed","item":{"type":"agent_message","text":"'"$(printf '%s' "$FINAL_MESSAGE" | sed 's/"/\\"/g')"'"}}' \
  '{"type":"turn.completed"}' >"$TMP/completed.events.jsonl"
node scripts/validate-codex-completion.mjs "$TMP/completed.events.jsonl" "$TMP/final.json"

expect_completion_failure() {
  local expected="$1" events="$2" final="$3"
  if node scripts/validate-codex-completion.mjs "$events" "$final" \
      >"$TMP/completion.stdout" 2>"$TMP/completion.stderr"; then
    echo "Codex completion unexpectedly passed: $expected" >&2
    exit 1
  fi
  rg -Fq "$expected" "$TMP/completion.stderr"
}

printf '%s\n' \
  '{"type":"item.completed","item":{"type":"agent_message","text":"'"$(printf '%s' "$FINAL_MESSAGE" | sed 's/"/\\"/g')"'"}}' \
  >"$TMP/no-completion.events.jsonl"
expect_completion_failure 'expected exactly one turn.completed, found 0' \
  "$TMP/no-completion.events.jsonl" "$TMP/final.json"

printf '%s\n' \
  '{"type":"item.completed","item":{"type":"agent_message","text":"'"$(printf '%s' "$FINAL_MESSAGE" | sed 's/"/\\"/g')"'"}}' \
  '{"type":"turn.completed"}' \
  '{"type":"turn.completed"}' >"$TMP/duplicate-completion.events.jsonl"
expect_completion_failure 'expected exactly one turn.completed, found 2' \
  "$TMP/duplicate-completion.events.jsonl" "$TMP/final.json"

printf '%s\n' \
  '{"type":"item.completed","item":{"type":"agent_message","text":"'"$(printf '%s' "$FINAL_MESSAGE" | sed 's/"/\\"/g')"'"}}' \
  '{"type":"turn.failed"}' \
  '{"type":"turn.completed"}' >"$TMP/failed.events.jsonl"
expect_completion_failure 'events contain turn.failed' "$TMP/failed.events.jsonl" "$TMP/final.json"

printf '%s\n' '{"different":true}' >"$TMP/mismatched-final.json"
expect_completion_failure 'final output does not equal the last completed agent message' \
  "$TMP/completed.events.jsonl" "$TMP/mismatched-final.json"

printf '%s\n' '{not-json}' >"$TMP/malformed.events.jsonl"
expect_completion_failure 'events line 1 is not valid JSON' \
  "$TMP/malformed.events.jsonl" "$TMP/final.json"

expect_completion_failure 'final output file is missing' \
  "$TMP/completed.events.jsonl" "$TMP/missing-final.json"

for stage in search plan run draft review revise prepare_publish; do
  node scripts/stage-result-contract.mjs schema "$stage" "$TMP/$stage.schema.json"
  node -e 'JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"))' "$TMP/$stage.schema.json"
  node scripts/stage-result-contract.mjs prompt "$stage" >"$TMP/$stage.prompt.txt"
done
node -e '
  const fs = require("node:fs");
  const run = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const review = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  if (run.properties.metadata.properties.verdict.type !== "null") process.exit(1);
  if (run.properties.metadata.properties.slug.type !== "null") process.exit(1);
  if (!review.properties.metadata.properties.verdict.enum.includes("pass")) process.exit(1);
' "$TMP/run.schema.json" "$TMP/review.schema.json"
rg -q 'successful run result.*metadata.verdict must be null.*metadata.slug must be null' "$TMP/run.prompt.txt"
rg -q 'successful review result.*metadata.verdict must be "pass"' "$TMP/review.prompt.txt"

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

expect_contract_failure() {
  local expected="$1"
  shift
  if "$@" >"$TMP/contract.stdout" 2>"$TMP/contract.stderr"; then
    echo "stage result unexpectedly passed: $expected" >&2
    exit 1
  fi
  rg -Fq "$expected" "$TMP/contract.stderr"
}

RUN_FIXTURE="$PR_FIXTURE/run/execution-log.md"
REVIEW_FIXTURE="$PR_FIXTURE/review-codex-pipeline-fixture.md"
mkdir -p "$(dirname "$RUN_FIXTURE")"
touch "$RUN_FIXTURE" "$REVIEW_FIXTURE"

printf '%s\n' \
  '{"status":"ok","artifact":"'"$RUN_FIXTURE"'","reason":"",' \
  ' "metadata":{"verdict":"pass","slug":"codex-pipeline-fixture","pr_metadata":null}}' \
  >"$TMP/run-invalid-result.json"
node -e 'require("node:fs").copyFileSync(process.argv[1], process.argv[2])' \
  "$TMP/run-invalid-result.json" "$TMP/run-invalid-final.json"
expect_contract_failure 'only review may set metadata.verdict' \
  node scripts/validate-stage-result.mjs "$TMP/run-invalid-result.json" logs "$TMP/marker" run

node scripts/stage-result-contract.mjs normalize run "$TMP/run-invalid-result.json" >"$TMP/run-normalized-fields.txt"
rg -q 'metadata.verdict,metadata.slug' "$TMP/run-normalized-fields.txt"
rg -q '"verdict":"pass"' "$TMP/run-invalid-final.json"
rg -q '"verdict":null' "$TMP/run-invalid-result.json"
[ "$(node scripts/validate-stage-result.mjs "$TMP/run-invalid-result.json" logs "$TMP/marker" run)" = "$RUN_FIXTURE" ]

printf '%s\n' \
  '{"status":"ok","artifact":"'"$REVIEW_FIXTURE"'","reason":"",' \
  ' "metadata":{"verdict":null,"slug":"codex-pipeline-fixture","pr_metadata":null}}' \
  >"$TMP/review-invalid-result.json"
expect_contract_failure 'review result requires a verdict' \
  node scripts/validate-stage-result.mjs "$TMP/review-invalid-result.json" logs "$TMP/marker" review

printf '%s\n' \
  '{"status":"ok","artifact":"'"$ARTICLE"'","reason":"",' \
  ' "metadata":{"verdict":null,"slug":"codex-pipeline-fixture","pr_metadata":null}}' \
  >"$TMP/publish-invalid-result.json"
expect_contract_failure 'prepare_publish requires metadata.pr_metadata' \
  node scripts/validate-stage-result.mjs "$TMP/publish-invalid-result.json" articles "$TMP/marker" prepare_publish

mkdir -p "$PR_FIXTURE"
printf '%s\n' '# PR body' >"$PR_FIXTURE/pr-body.md"
printf '%s\n' "{\"title\":\"Fixture PR\",\"body_file\":\"$PR_FIXTURE/pr-body.md\"}" >"$PR_FIXTURE/pr-metadata.json"
node scripts/validate-pr-metadata.mjs "$PR_FIXTURE/pr-metadata.json" "$PR_FIXTURE" >/dev/null

bash scripts/auto-publish-codex.sh --dry-run >"$TMP/dry-run.txt"
rg -q 'approval=never, sandbox=workspace-write' "$TMP/dry-run.txt"
rg -q 'run child env: ASTRO_TELEMETRY_DISABLED=1' "$TMP/dry-run.txt"
rg -q -- '-o <final>' "$TMP/dry-run.txt"
rg -q 'model=gpt-5.6-sol, reasoning=high' "$TMP/dry-run.txt"
rg -q 'zenn-search-topic.*published:false publication queue' "$TMP/dry-run.txt"
rg -q -- '--review-style codex --pr-only' scripts/auto-publish-codex.sh
rg -Fq 'ASTRO_TELEMETRY_DISABLED=1 "$TIMEOUT_BIN"' scripts/auto-publish-codex.sh
rg -Fq '"-o" "$final"' scripts/auto-publish-codex.sh
rg -Fq '"$final" "$result"' scripts/auto-publish-codex.sh
rg -Fq 'cleanup_merged_pr_branch' scripts/auto-publish-codex.sh
rg -Fq 'git push origin --delete "$head"' scripts/auto-publish-codex.sh
rg -q 'run-article-pipeline-worktree.sh' scripts/auto-publish-codex.sh
rg -q -- '--shared-root' scripts/auto-publish-codex.sh
rg -q 'astro preview status.*astro preview logs.*astro preview stop' .agents/skills/zenn-plan-practice/SKILL.md

CODEX_SANDBOX_MODE=workspace-write bash scripts/auto-publish-codex.sh --dry-run >"$TMP/dry-run-workspace.txt"
rg -q 'approval=never, sandbox=workspace-write' "$TMP/dry-run-workspace.txt"

if CODEX_SANDBOX_MODE=danger-full-access bash scripts/auto-publish-codex.sh --dry-run >"$TMP/dry-run-invalid.txt" 2>&1; then
  echo "danger-full-access unexpectedly succeeded" >&2
  exit 1
fi
rg -q 'CODEX_SANDBOX_MODE must be workspace-write' "$TMP/dry-run-invalid.txt"

echo "Codex pipeline tests passed"
