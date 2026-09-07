#!/usr/bin/env bash
# Fetch the public Zenn data the topic-improvement loop runs on, then hand the
# raw files to collect-zenn-metrics.mjs.
#
#   bash scripts/analytics/fetch-zenn-metrics.sh [--deep] [--keep-raw] [--now <iso>]
#
# `--deep` pages each topic back ~46 days instead of taking only the newest page.
# This is required, not optional: a busy topic like `claudecode` publishes ~24
# articles a day, so an article has fallen off page 1 long before it turns 7 or
# 30 days old. Without a deep sweep the `d7-14` and `d30-45` cohorts stay empty
# and the D30 percentile -- the loop's primary metric -- can never be computed.
# Run it weekly; the market index accumulates, so one sweep fills every bracket.
#
# Only unauthenticated public endpoints are used:
#   * /api/articles?username=<user>          our own articles
#   * /api/articles?topicname=<t>&order=latest   the age-matched market baseline
#   * /api/articles?order=liked_count        the cross-topic winners
#
# Page views are dashboard-only and cannot be fetched, so the loop never claims
# to separate "not reached" from "reached but did not land".
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

POLICY="${POLICY_FILE:-strategy/topic-selection-policy.json}"
QUEUE="${PUBLISH_QUEUE_FILE:-config/zenn-publish-queue.json}"
KEEP_RAW=0
DEEP=0
NOW_ARG=()
# 46 days covers the d30-45 window with a day of slack.
DEEP_DAYS="${DEEP_DAYS:-46}"
# Hard cap so a runaway topic cannot issue hundreds of requests.
DEEP_MAX_PAGES="${DEEP_MAX_PAGES:-30}"

while [ $# -gt 0 ]; do
  case "$1" in
    --deep) DEEP=1; shift ;;
    --keep-raw) KEEP_RAW=1; shift ;;
    --now) NOW_ARG=(--now "$2"); shift 2 ;;
    -h|--help) sed -n '2,23p' "$0"; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

command -v curl >/dev/null 2>&1 || { echo "curl is required" >&2; exit 2; }
command -v node >/dev/null 2>&1 || { echo "node is required" >&2; exit 2; }

ZENN_USER="${ZENN_USERNAME:-$(node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('$QUEUE','utf8')).zennUsername)")}"
[ -n "$ZENN_USER" ] || { echo "cannot resolve zenn username" >&2; exit 2; }

# Topics to keep a market baseline for. Defaults to the policy's watch list.
if [ -n "${MARKET_TOPICS:-}" ]; then
  read -r -a TOPICS <<<"$MARKET_TOPICS"
elif [ -f "$POLICY" ]; then
  read -r -a TOPICS <<<"$(node -e "
    const p = JSON.parse(require('fs').readFileSync('$POLICY', 'utf8'));
    process.stdout.write((p.marketWatch?.topics ?? []).join(' '));
  ")"
else
  TOPICS=(claudecode ai typescript nodejs)
fi
[ "${#TOPICS[@]}" -gt 0 ] || { echo "no market topics configured" >&2; exit 2; }

WORK="$(mktemp -d "${TMPDIR:-/tmp}/zenn-metrics.XXXXXX")"
if [ "$KEEP_RAW" -eq 0 ]; then
  trap 'rm -rf "$WORK"' EXIT
else
  echo "raw responses kept in $WORK"
fi

fetch() {
  curl --fail --silent --show-error --location --retry 2 --max-time 30 \
    -H 'Accept: application/json' "$1"
}

echo "fetching own articles (user: $ZENN_USER)"
: >"$WORK/self.jsonl"
for page in 1 2 3 4 5; do
  body="$(fetch "https://zenn.dev/api/articles?username=${ZENN_USER}&order=latest&count=48&page=${page}")"
  printf '%s\n' "$body" >>"$WORK/self.jsonl"
  # Stop as soon as Zenn reports no further page.
  if ! printf '%s' "$body" | grep -q '"next_page":[0-9]'; then break; fi
done
node -e "
  const fs = require('fs');
  const pages = fs.readFileSync('$WORK/self.jsonl', 'utf8')
    .split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line));
  fs.writeFileSync('$WORK/self.json', JSON.stringify(pages));
"

# Oldest published_at in a response, as epoch seconds. Used to decide whether a
# deep sweep has paged back far enough.
oldest_epoch() {
  node -e '
    let raw = "";
    process.stdin.on("data", (chunk) => { raw += chunk; });
    process.stdin.on("end", () => {
      const articles = (JSON.parse(raw).articles ?? []);
      const times = articles
        .map((article) => Date.parse(article.published_at))
        .filter((value) => Number.isFinite(value));
      process.stdout.write(String(times.length ? Math.min(...times) / 1000 : 0));
    });
  '
}

if [ "$DEEP" -eq 1 ]; then
  echo "fetching market baseline (deep, back ~${DEEP_DAYS}d) for: ${TOPICS[*]}"
else
  echo "fetching market baseline (newest page only) for: ${TOPICS[*]}"
fi
MARKET="$WORK/market.json"
CUTOFF=$(( $(date +%s) - DEEP_DAYS * 86400 ))
printf '{' >"$MARKET"
first=1
for topic in "${TOPICS[@]}"; do
  : >"$WORK/topic.jsonl"
  pages=1
  [ "$DEEP" -eq 1 ] && pages="$DEEP_MAX_PAGES"
  for page in $(seq 1 "$pages"); do
    body="$(fetch "https://zenn.dev/api/articles?topicname=${topic}&order=latest&count=48&page=${page}")"
    printf '%s\n' "$body" >>"$WORK/topic.jsonl"
    # Stop at the last page, or once this page is already older than the window.
    printf '%s' "$body" | grep -q '"next_page":[0-9]' || break
    if [ "$DEEP" -eq 1 ]; then
      oldest="$(printf '%s' "$body" | oldest_epoch)"
      if [ "$oldest" != "0" ] && [ "${oldest%.*}" -lt "$CUTOFF" ]; then break; fi
    fi
  done
  merged="$(node -e "
    const fs = require('fs');
    const pages = fs.readFileSync('$WORK/topic.jsonl', 'utf8')
      .split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line));
    process.stdout.write(JSON.stringify(pages));
  ")"
  [ "$first" -eq 1 ] || printf ',' >>"$MARKET"
  first=0
  printf '"%s":%s' "$topic" "$merged" >>"$MARKET"
done
# Cross-topic winners land in a reserved cohort used for archetype mining only.
body="$(fetch "https://zenn.dev/api/articles?order=liked_count&count=48")"
printf ',"_top":%s}' "$body" >>"$MARKET"

node scripts/analytics/collect-zenn-metrics.mjs \
  --self-json "$WORK/self.json" \
  --market-json "$MARKET" \
  ${NOW_ARG[@]+"${NOW_ARG[@]}"}
