#!/bin/bash
# auto-publish-launchd.sh - launchd から毎朝呼ばれる auto-publish.sh のラッパー
#
# launchd(cron) は対話シェルの PATH を継承しないため、ここで claude/node/gh/git を
# 見つけられるように PATH を明示し、リポジトリへ cd して auto-publish を回す。
# 実行ごとの出力は logs/launchd/auto-publish-YYYYMMDD-HHMMSS.log に残す。
#
# 手動テスト:
#   bash scripts/auto-publish-launchd.sh            # 本番同様に auto-merge まで
#   AP_ARGS=--dry-run bash scripts/auto-publish-launchd.sh   # 中身を実行せず計画だけ

set -uo pipefail

# --- 必要なコマンドが入っている場所を PATH に明示（launchd の最小環境対策） ---
export PATH="/Users/katayamaryuunosuke/.local/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/Users/katayamaryuunosuke/.nvm/versions/node/v22.17.0/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

REPO="/Users/katayamaryuunosuke/workspace/024_zenn"
cd "$REPO" || { echo "cannot cd to $REPO" >&2; exit 1; }

LOG_DIR="$REPO/logs/launchd"
mkdir -p "$LOG_DIR"
TS="$(date +%Y%m%d-%H%M%S)"
LOG="$LOG_DIR/auto-publish-$TS.log"

# 既定は本番運用（--auto-merge）。AP_ARGS で上書き可能（例: --dry-run）。
ARGS="${AP_ARGS:---auto-merge}"

{
  echo "===== auto-publish (launchd) start: $(date) ====="
  echo "PATH=$PATH"
  echo "args: $ARGS"
  echo
  # shellcheck disable=SC2086
  bash "$REPO/scripts/auto-publish.sh" $ARGS
  rc=$?
  echo
  echo "===== auto-publish (launchd) end: $(date) exit=$rc ====="
  exit $rc
} >>"$LOG" 2>&1
