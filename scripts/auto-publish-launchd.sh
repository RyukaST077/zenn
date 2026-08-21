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
: "${AUTO_PUBLISH_LOG_DIR:=$LOG_DIR}"
LOG_DIR="$AUTO_PUBLISH_LOG_DIR"
mkdir -p "$LOG_DIR"
TS="$(date +%Y%m%d-%H%M%S)"
LOG="$LOG_DIR/auto-publish-$TS.log"

# 既定は本番運用（--auto-merge）。上限などで一時停止したstateがあれば先に再開する。
PENDING_RESUME_FILE="$REPO/logs/.auto-publish-resume"
PIPELINE_SCRIPT="${AUTO_PUBLISH_SCRIPT:-$REPO/scripts/auto-publish.sh}"
USAGE_WAITER="${CLAUDE_USAGE_WAITER:-$REPO/scripts/wait-for-claude-usage.sh}"
: "${AUTO_PUBLISH_STATUS_DIR:=$REPO/logs/daily-status}"
: "${AGENT_PIPELINE_RETRYABLE_EXIT:=20}"
: "${AUTO_PUBLISH_MAX_USAGE_RESUMES:=8}"
: "${ARTICLE_PIPELINE_LOCK_WAIT_SECONDS:=60}"
: "${ARTICLE_PIPELINE_LOCK_MAX_WAIT_SECONDS:=21600}"
: "${ARTICLE_PIPELINE_LOCK_WAIT_ENABLED:=1}"
case "$ARTICLE_PIPELINE_LOCK_WAIT_ENABLED" in
  0|1) ;;
  *) echo "ARTICLE_PIPELINE_LOCK_WAIT_ENABLED must be 0 or 1" >&2; exit 2 ;;
esac

resolve_args() {
  if [ -n "${AP_ARGS:-}" ]; then
    ARGS="$AP_ARGS"
  elif [ -f "$PENDING_RESUME_FILE" ]; then
    pending_pipeline="$(sed -n '1p' "$PENDING_RESUME_FILE")"
    if printf '%s\n' "$pending_pipeline" | grep -Eq '^logs/pipeline-[A-Za-z0-9._-]+$'; then
      ARGS="--resume $pending_pipeline --auto-merge"
    else
      echo "invalid pending pipeline: $pending_pipeline" >&2
      return 2
    fi
  else
    ARGS="--auto-merge"
  fi
}

resolve_args || exit $?

{
  echo "===== auto-publish (launchd) start: $(date) ====="
  echo "PATH=$PATH"
  echo "args: $ARGS"
  echo
  if [ "$ARTICLE_PIPELINE_LOCK_WAIT_ENABLED" = 1 ]; then
    lock_waited=0
    while :; do
      held_lock=""
      for other_lock in "$REPO/.agent-practice-pipeline.lock" "$REPO/.auto-publish-codex.lock"; do
        [ ! -d "$other_lock" ] || { held_lock="$other_lock"; break; }
      done
      [ -n "$held_lock" ] || break
      if [ "$lock_waited" -ge "$ARTICLE_PIPELINE_LOCK_MAX_WAIT_SECONDS" ]; then
        echo "RESULT: failed (timed out waiting for $held_lock)"
        echo "===== auto-publish (launchd) end: $(date) exit=1 ====="
        exit 1
      fi
      echo "WAIT: another article pipeline holds $held_lock; checking again in ${ARTICLE_PIPELINE_LOCK_WAIT_SECONDS}s"
      sleep "$ARTICLE_PIPELINE_LOCK_WAIT_SECONDS"
      lock_waited=$((lock_waited + ARTICLE_PIPELINE_LOCK_WAIT_SECONDS))
    done
  fi
  case " $ARGS " in
    *" --dry-run "*) echo "Claude usage gate: bypassed for dry-run" ;;
    *)
      bash "$USAGE_WAITER" || {
        usage_rc=$?
        echo "RESULT: failed (Claude allowance wait failed, exit=$usage_rc)"
        echo "===== auto-publish (launchd) end: $(date) exit=$usage_rc ====="
        exit "$usage_rc"
      }
      ;;
  esac
  usage_resumes=0
  while :; do
    # shellcheck disable=SC2086
    bash "$PIPELINE_SCRIPT" $ARGS
    rc=$?
    [ "$rc" = "$AGENT_PIPELINE_RETRYABLE_EXIT" ] || break
    if [ "$usage_resumes" -ge "$AUTO_PUBLISH_MAX_USAGE_RESUMES" ]; then
      echo "RESULT: failed (Claude allowance resume limit reached: $AUTO_PUBLISH_MAX_USAGE_RESUMES)"
      rc=1
      break
    fi
    usage_resumes=$((usage_resumes + 1))
    echo "PAUSE: Claude allowance exhausted; waiting for reset before resume $usage_resumes/$AUTO_PUBLISH_MAX_USAGE_RESUMES"
    bash "$USAGE_WAITER" || { rc=$?; break; }
    resolve_args || { rc=$?; break; }
    echo "RESUME: $ARGS"
  done
  if [ "$rc" = 0 ]; then
    case " $ARGS " in
      *" --dry-run "*) ;;
      *)
        if ! grep -q '^RESULT: ok ' "$LOG"; then
          echo "RESULT: failed (pipeline exited 0 without the success contract)"
          rc=1
        else
          mkdir -p "$AUTO_PUBLISH_STATUS_DIR"
          status_file="$AUTO_PUBLISH_STATUS_DIR/$(date +%F)-claude.json"
          node -e 'const fs=require("node:fs"); const [file,log]=process.argv.slice(1); fs.writeFileSync(file, JSON.stringify({version:1,pipeline:"claude",status:"success",completed_at:new Date().toISOString(),log},null,2)+"\n")' \
            "$status_file" "$LOG"
          echo "SUCCESS: recorded $status_file"
        fi
        ;;
    esac
  fi
  echo
  echo "===== auto-publish (launchd) end: $(date) exit=$rc ====="
  exit $rc
} >>"$LOG" 2>&1
