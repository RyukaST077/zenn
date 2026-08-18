#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
exec bash "$ROOT/scripts/check-article.sh" "${1:?article path is required}" --expect-published false
