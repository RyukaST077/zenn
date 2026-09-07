#!/usr/bin/env bash
# Run one turn of the topic-improvement loop.
#
#   bash scripts/auto-improve-topics.sh                  # collect + report
#   bash scripts/auto-improve-topics.sh --deep            # + page the market back ~46d
#   bash scripts/auto-improve-topics.sh --evaluate        # + judge the experiment
#   bash scripts/auto-improve-topics.sh --evaluate --pr   # + open a policy-proposal PR
#   bash scripts/auto-improve-topics.sh --dry-run
#
# Run --deep at least weekly. Without it the d7-14 and d30-45 market cohorts stay
# empty, because a busy topic's articles fall off the newest page long before they
# reach that age -- and the D30 percentile is the loop's primary metric.
#
# The loop is deliberately split in two halves with different privileges:
#   * collect + report  ... runs unattended, overwrites only analytics/
#   * evaluate + PR     ... proposes policy changes, never applies them
#
# strategy/topic-selection-policy.json is only ever changed by a human merging
# the PR this script opens -- the same gate the repo uses for publishing.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

EVALUATE=0
OPEN_PR=0
DRY_RUN=0
DEEP=0
BASE_BRANCH="${BASE_BRANCH:-main}"

while [ $# -gt 0 ]; do
  case "$1" in
    --deep) DEEP=1; shift ;;
    --evaluate) EVALUATE=1; shift ;;
    --pr) OPEN_PR=1; EVALUATE=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) sed -n '2,16p' "$0"; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

if [ "$DRY_RUN" -eq 1 ]; then
  echo "plan:"
  echo "  1. bash scripts/analytics/fetch-zenn-metrics.sh$([ "$DEEP" -eq 1 ] && echo ' --deep')"
  [ -f config/ga4.json ] && echo "  1b. node scripts/analytics/fetch-ga4-metrics.mjs -> collect-ga4-metrics.mjs"
  echo "  2. node scripts/analytics/build-topic-feedback.mjs"
  [ "$EVALUATE" -eq 1 ] && echo "  3. node scripts/analytics/evaluate-policy.mjs$([ "$OPEN_PR" -eq 1 ] && echo ' --apply')"
  [ "$OPEN_PR" -eq 1 ] && echo "  4. open a policy-proposal PR against $BASE_BRANCH (human merge is the gate)"
  exit 0
fi

echo "== 1/2 collect =="
if [ "$DEEP" -eq 1 ]; then
  bash scripts/analytics/fetch-zenn-metrics.sh --deep
else
  bash scripts/analytics/fetch-zenn-metrics.sh
fi

# GA4 is optional: without it the loop still runs on Zenn's public API, it just
# cannot separate reach from response. Never fail the run over a missing key.
if [ -f config/ga4.json ]; then
  echo "== 1b/3 GA4 =="
  GA4_LOG="$(mktemp "${TMPDIR:-/tmp}/ga4-fetch.XXXXXX")"
  set +e
  node scripts/analytics/fetch-ga4-metrics.mjs >"$GA4_LOG" 2>&1
  GA4_RC=$?
  set -e
  cat "$GA4_LOG"
  # The fetch prints "wrote <path>"; take that rather than guessing the filename,
  # so a run with --from or a different stamp still hands over the right file.
  GA4_RAW="$(sed -n 's/^wrote //p' "$GA4_LOG" | tail -1)"
  rm -f "$GA4_LOG"
  if [ "$GA4_RC" -eq 0 ] && [ -n "$GA4_RAW" ]; then
    node scripts/analytics/collect-ga4-metrics.mjs --report-json "$GA4_RAW"
  else
    echo "WARN: GA4 collection failed (exit $GA4_RC); continuing with Zenn API data only" >&2
  fi
else
  echo "(config/ga4.json not found; skipping GA4. See docs/analytics-feedback-loop.md)"
fi

echo "== 2/2 report =="
node scripts/analytics/build-topic-feedback.mjs

if [ "$EVALUATE" -eq 0 ]; then
  exit 0
fi

echo "== evaluate =="
# --pr implies --apply: a PR whose only content is a proposal document changes
# nothing when merged, so "approved" would mean nothing.
set +e
if [ "$OPEN_PR" -eq 1 ]; then
  node scripts/analytics/evaluate-policy.mjs --apply
else
  node scripts/analytics/evaluate-policy.mjs
fi
EVAL_RC=$?
set -e
# 3 = not enough matured observations yet. Expected for weeks after a batch
# starts, so it is not an error for the caller.
if [ "$EVAL_RC" -ne 0 ] && [ "$EVAL_RC" -ne 3 ]; then
  echo "evaluate-policy failed (exit $EVAL_RC)" >&2
  exit "$EVAL_RC"
fi

if [ "$OPEN_PR" -eq 0 ]; then
  exit 0
fi

PROPOSAL="$(ls -t strategy/proposals/*.md 2>/dev/null | head -1 || true)"
[ -n "$PROPOSAL" ] || { echo "no proposal file to open a PR for" >&2; exit 0; }

if ! grep -q '^### ' "$PROPOSAL"; then
  echo "proposal has no policy change section; nothing to review: $PROPOSAL"
  exit 0
fi

command -v git >/dev/null 2>&1 || { echo "git is required for --pr" >&2; exit 2; }
BRANCH="policy/$(basename "${PROPOSAL%.md}")"

if [ -n "$(git status --porcelain strategy analytics experiments)" ]; then
  git checkout -b "$BRANCH" 2>/dev/null || git checkout "$BRANCH"
  git add strategy analytics experiments
  # analytics/private/ holds per-article GA4 traffic and is git-ignored. This is
  # a public repository, so verify rather than trust: a stale checkout or an
  # edited .gitignore would otherwise publish it inside a policy PR.
  if git diff --cached --name-only | grep -q '^analytics/private/'; then
    echo "REFUSING: analytics/private/ is staged. It contains non-public GA4 data." >&2
    git diff --cached --name-only | grep '^analytics/private/' >&2
    git reset >/dev/null
    exit 2
  fi
  git commit -m "policy: propose change from $(basename "$PROPOSAL")

$(sed -n '/^## 判定/,/^## 観測/p' "$PROPOSAL" | head -20)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
  git push -u origin "$BRANCH"
  if command -v gh >/dev/null 2>&1; then
    gh pr create --base "$BASE_BRANCH" --head "$BRANCH" \
      --title "policy proposal: $(basename "${PROPOSAL%.md}")" \
      --body-file "$PROPOSAL"
  else
    echo "gh not found. open a PR manually:"
    echo "  https://github.com/RyukaST077/zenn/compare/$BASE_BRANCH...$BRANCH"
  fi
else
  echo "nothing changed under strategy/, analytics/ or experiments/; no PR needed"
fi
