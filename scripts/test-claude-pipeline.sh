#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/claude-pipeline-test.XXXXXX")"
SLUG="claude-pipeline-fixture-$$"
ARTICLE="articles/$SLUG.md"
INVALID_ARTICLE="articles/claude-invalid-type-$$.md"
REPORT="logs/review-$SLUG-test.md"
LEGACY_PIPELINE="logs/pipeline-legacy-test-$$"
RUNTIME_PIPELINE="logs/pipeline-runtime-test-$$"
RUNTIME_REPORT="research/search-topic-runtime-test-$$.md"
RUNTIME_TASK="practice/practice-runtime-test-$$.md"
RUNTIME_RUN_DIR="logs/run-runtime-test-$$"
RUNTIME_RUNLOG="$RUNTIME_RUN_DIR/execution-log.md"
RUNTIME_SLUG="claude-command-runtime-$$"
RUNTIME_ARTICLE="articles/$RUNTIME_SLUG.md"
RUNTIME_REVIEW="logs/review-$RUNTIME_SLUG-test.md"
trap 'rm -rf "$TMP" "$ARTICLE" "$INVALID_ARTICLE" "$REPORT" "$LEGACY_PIPELINE" "$RUNTIME_PIPELINE" "$RUNTIME_REPORT" "$RUNTIME_TASK" "$RUNTIME_RUN_DIR" "$RUNTIME_ARTICLE" "$RUNTIME_REVIEW"' EXIT

bash -n scripts/auto-publish.sh scripts/auto-publish-launchd.sh \
  .claude/skills/review-article/scripts/check-article.sh
node --check scripts/check-article.mjs
node --check scripts/extract-claude-stage-result.mjs
node --check scripts/validate-claude-review-result.mjs
node --check scripts/pipeline-state.mjs

printf '%s\n' \
  '---' \
  'title: "日本語タイトルの文字数はロケールに依存しない"' \
  'emoji: "🧪"' \
  'type: "tech" # valid quoted YAML scalar' \
  'topics: ["claude", "test"]' \
  'published: false' \
  '---' \
  '' \
  'Deterministic fixture.' >"$ARTICLE"

LC_ALL=C bash scripts/check-article.sh "$ARTICLE" --expect-published false >/dev/null
LC_ALL=C bash .claude/skills/review-article/scripts/check-article.sh "$ARTICLE" >/dev/null

printf '%s\n' \
  '---' \
  'title: "Invalid type fixture"' \
  'emoji: "🧪"' \
  'type: idea' \
  'topics: ["claude"]' \
  'published: false' \
  '---' \
  '' \
  'Invalid fixture.' >"$INVALID_ARTICLE"
if bash scripts/check-article.sh "$INVALID_ARTICLE" --expect-published false >"$TMP/invalid.out" 2>&1; then
  echo "invalid article type unexpectedly passed" >&2
  exit 1
fi
rg -q 'BLOCKER: type must be tech' "$TMP/invalid.out"

touch "$TMP/review.marker"
printf '%s\n' \
  '# 公開前レビュー' \
  '' \
  '- 備考: 前回は（判定: 要修正 / warning 1）' \
  '' \
  '## 判定' \
  '' \
  '**判定: 公開可**' \
  '' \
  '- blocker: 0 件 / warning: 0 件 / suggestion: 2 件' >"$REPORT"

cat >"$TMP/envelope.json" <<EOF
{"type":"result","structured_output":{"status":"ok","artifact":"$REPORT","reason":"","metadata":{"verdict":"pass","slug":"$SLUG","pr_metadata":null}}}
EOF
node scripts/extract-claude-stage-result.mjs "$TMP/envelope.json" "$TMP/result.json"
[ "$(node scripts/validate-stage-result.mjs "$TMP/result.json" logs "$TMP/review.marker" review)" = "$REPORT" ]
[ "$(node scripts/validate-claude-review-result.mjs "$TMP/result.json" "$REPORT")" = pass ]

printf '%s\n' '**判定: 公開可**' >>"$REPORT"
if node scripts/validate-claude-review-result.mjs "$TMP/result.json" "$REPORT" \
    >"$TMP/duplicate.out" 2>&1; then
  echo "duplicate canonical verdict unexpectedly passed" >&2
  exit 1
fi
rg -q 'exactly one canonical verdict line' "$TMP/duplicate.out"

node scripts/pipeline-state.mjs init "$TMP/state.json" main
node scripts/pipeline-state.mjs set "$TMP/state.json" retry.pending true
[ "$(node scripts/pipeline-state.mjs get "$TMP/state.json" retry.pending)" = true ]
node scripts/pipeline-state.mjs review "$TMP/state.json" fix "$REPORT" 2026-08-18T00:00:00Z
[ "$(node scripts/pipeline-state.mjs get "$TMP/state.json" review.next_stage)" = revise ]

CLAUDE_USAGE_GATE_ENABLED=0 bash scripts/auto-publish.sh --dry-run >"$TMP/dry-run.out"
rg -Fq 'Claude JSON Schema + 構造化stage result' "$TMP/dry-run.out"
rg -q -- '--json-schema' scripts/auto-publish.sh
if rg -q 'grep -m1.*判定' scripts/auto-publish.sh; then
  echo "fragile first-match verdict parser is still present" >&2
  exit 1
fi

# 旧state.shの停止済みパイプラインを、AIやGitHubを呼ばずstate.jsonへ移行できることを確認する。
mkdir -p "$LEGACY_PIPELINE" "$TMP/bin"
cat >"$LEGACY_PIPELINE/state.sh" <<EOF
DONE_gitreset='1'
REPORT='README.md'
DONE_search='1'
TASK='README.md'
DONE_plan='1'
RUNLOG='README.md'
DONE_run='1'
ARTICLE='$ARTICLE'
DONE_draft='1'
REVIEW='$REPORT'
DONE_review='1'
PR_URL='https://example.invalid/pull/1'
DONE_publish='1'
DONE_merge='1'
EOF
cat >"$TMP/bin/gh" <<'EOF'
#!/bin/sh
if [ "$1" = auth ] && [ "$2" = status ]; then exit 0; fi
exit 0
EOF
chmod +x "$TMP/bin/gh"
CURRENT_BRANCH="$(git branch --show-current)"
PATH="$TMP/bin:$PATH" BASE_BRANCH="$CURRENT_BRANCH" CLAUDE_BIN=true \
  CLAUDE_USAGE_GATE_ENABLED=0 bash scripts/auto-publish.sh --resume "$LEGACY_PIPELINE" \
  >"$TMP/legacy.stdout" 2>"$TMP/legacy.stderr"
[ -f "$LEGACY_PIPELINE/state.json" ]
[ "$(node scripts/pipeline-state.mjs get "$LEGACY_PIPELINE/state.json" completed.review)" = true ]
[ "$(node scripts/pipeline-state.mjs get "$LEGACY_PIPELINE/state.json" completed.pr)" = true ]

# macOS Bash 3.2 + set -u で、schemaを使わない段の空オプション配列が
# unbound variable にならないことを、実際のrun_claude経路で確認する。
cat >"$TMP/fake-claude" <<'EOF'
#!/bin/sh
set -eu
prompt=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    -p) prompt="$2"; shift 2 ;;
    *) shift ;;
  esac
done
case "$prompt" in
  /search-topic*)
    printf '%s\n' '# Runtime search fixture' >"$FAKE_REPORT"
    printf '%s\n' search >>"$FAKE_CALLS" ;;
  /plan-practice*)
    printf '%s\n' '# Runtime plan fixture' >"$FAKE_TASK"
    printf '%s\n' plan >>"$FAKE_CALLS" ;;
  /run-practice*)
    mkdir -p "$(dirname "$FAKE_RUNLOG")"
    printf '%s\n' '# Runtime execution fixture' >"$FAKE_RUNLOG"
    printf '%s\n' run >>"$FAKE_CALLS" ;;
  /draft-article*)
    printf '%s\n' \
      '---' \
      'title: "Claude command runtime fixture"' \
      'emoji: "🧪"' \
      'type: tech' \
      'topics: ["claude", "test"]' \
      'published: false' \
      '---' \
      '' \
      'Runtime fixture.' >"$FAKE_ARTICLE"
    printf '%s\n' draft >>"$FAKE_CALLS" ;;
  /review-article*)
    printf '%s\n' \
      '# 公開前レビュー' \
      '' \
      '## 判定' \
      '' \
      '**判定: 公開可**' \
      '' \
      '- blocker: 0 件 / warning: 0 件 / suggestion: 0 件' >"$FAKE_REVIEW"
    printf '%s\n' review >>"$FAKE_CALLS"
    printf '{"type":"result","structured_output":{"status":"ok","artifact":"%s","reason":"","metadata":{"verdict":"pass","slug":"%s","pr_metadata":null}}}\n' \
      "$FAKE_REVIEW" "$FAKE_SLUG" ;;
  *)
    printf 'unexpected prompt: %s\n' "$prompt" >&2
    exit 64 ;;
esac
EOF
chmod +x "$TMP/fake-claude"
mkdir -p "$RUNTIME_PIPELINE"
node scripts/pipeline-state.mjs init "$RUNTIME_PIPELINE/state.json" "$CURRENT_BRANCH"
node scripts/pipeline-state.mjs set "$RUNTIME_PIPELINE/state.json" completed.preflight true
node scripts/pipeline-state.mjs set "$RUNTIME_PIPELINE/state.json" completed.pr true
node scripts/pipeline-state.mjs set "$RUNTIME_PIPELINE/state.json" completed.merge true
node scripts/pipeline-state.mjs set "$RUNTIME_PIPELINE/state.json" publish.pr_url '"https://example.invalid/pull/runtime"'
PATH="$TMP/bin:$PATH" BASE_BRANCH="$CURRENT_BRANCH" CLAUDE_BIN="$TMP/fake-claude" \
  CLAUDE_USAGE_GATE_ENABLED=0 AP_MODEL= AP_EFFORT= \
  FAKE_REPORT="$RUNTIME_REPORT" FAKE_TASK="$RUNTIME_TASK" FAKE_RUNLOG="$RUNTIME_RUNLOG" \
  FAKE_ARTICLE="$RUNTIME_ARTICLE" FAKE_REVIEW="$RUNTIME_REVIEW" \
  FAKE_SLUG="$RUNTIME_SLUG" FAKE_CALLS="$TMP/runtime.calls" \
  bash scripts/auto-publish.sh --resume "$RUNTIME_PIPELINE" \
  >"$TMP/runtime.stdout" 2>"$TMP/runtime.stderr"
[ "$(node scripts/pipeline-state.mjs get "$RUNTIME_PIPELINE/state.json" completed.review)" = true ]
[ "$(tr '\n' ' ' <"$TMP/runtime.calls")" = 'search plan run draft review ' ]
if rg -q 'unbound variable' "$TMP/runtime.stderr"; then
  echo "Bash 3.2 empty-array regression detected" >&2
  exit 1
fi

echo "Claude pipeline tests passed"
