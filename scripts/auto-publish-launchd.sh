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

# 既定は本番運用（--auto-merge）。上限などで一時停止したstateがあれば先に再開する。
PENDING_RESUME_FILE="$REPO/logs/.auto-publish-resume"
if [ -n "${AP_ARGS:-}" ]; then
  ARGS="$AP_ARGS"
elif [ -f "$PENDING_RESUME_FILE" ]; then
  pending_pipeline="$(sed -n '1p' "$PENDING_RESUME_FILE")"
  if printf '%s\n' "$pending_pipeline" | grep -Eq '^logs/pipeline-[A-Za-z0-9._-]+$'; then
    ARGS="--resume $pending_pipeline --auto-merge"
  else
    echo "invalid pending pipeline: $pending_pipeline" >&2
    exit 2
  fi
else
  ARGS="--auto-merge"
fi
USAGE_GATE="$REPO/scripts/check-claude-session-usage.sh"
: "${AGENT_PIPELINE_RETRYABLE_EXIT:=20}"

{
  echo "===== auto-publish (launchd) start: $(date) ====="
  echo "PATH=$PATH"
  echo "args: $ARGS"
  echo
  case " $ARGS " in
    *" --dry-run "*) echo "Claude usage gate: bypassed for dry-run" ;;
    *)
      bash "$USAGE_GATE"
      usage_rc=$?
      case "$usage_rc" in
        0) ;;
        10)
          echo "RESULT: skipped (Claude five-hour remaining allowance is 80% or lower)"
          echo "===== auto-publish (launchd) end: $(date) exit=0 ====="
          exit 0
          ;;
        *)
          echo "RESULT: skipped (Claude usage could not be verified safely)"
          echo "===== auto-publish (launchd) end: $(date) exit=0 ====="
          exit 0
          ;;
      esac
      ;;
  esac
  # shellcheck disable=SC2086
  bash "$REPO/scripts/auto-publish.sh" $ARGS
  rc=$?
  if [ "$rc" = "$AGENT_PIPELINE_RETRYABLE_EXIT" ]; then
    echo "RESULT: paused (Claude allowance; state will resume on the next scheduled run)"
    echo "===== auto-publish (launchd) end: $(date) exit=0 ====="
    exit 0
  fi
  echo
  echo "===== auto-publish (launchd) end: $(date) exit=$rc ====="
  exit $rc
} >>"$LOG" 2>&1
