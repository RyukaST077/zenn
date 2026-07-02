#!/usr/bin/env bash
# check-article.sh - Zenn記事ドラフトの機械チェック (review-article スキル用)
#
# 使い方:  bash check-article.sh articles/<slug>.md
# 出力  :  [PASS]/[WARN]/[FAIL] の行 と、末尾の "SUMMARY fail=.. warn=.."
# 方針  :  レビュー用の一次検出。終了コードは常に 0 (判定は呼び出し側=SKILLが行う)。
#          macOS の bash 3.2 でも動くように連想配列や mapfile は使わない。
#
# 注意(出力の書式): この環境では「変数展開の直後に全角文字が接する」と表示が壊れる
#          ロケール不具合がある。メッセージ中で $var に隣接する記号は半角に統一し、
#          $var の直後には半角スペースを置く（全角括弧を変数に接触させない）。

ART="${1:-}"

if [ -z "$ART" ] || [ ! -f "$ART" ]; then
  echo "[FAIL] 記事ファイルが見つからない: ${ART:-(none)}"
  echo "SUMMARY fail=1 warn=0"
  exit 0
fi

# リポジトリ直下 (/images 解決の基点)
ROOT="$(git -C "$(dirname "$ART")" rev-parse --show-toplevel 2>/dev/null)"
if [ -z "$ROOT" ]; then
  ROOT="$(cd "$(dirname "$ART")/.." && pwd)"
fi

FAIL=0
WARN=0
pass() { echo "[PASS] $1"; }
warn() { echo "[WARN] $1"; WARN=$((WARN + 1)); }
fail() { echo "[FAIL] $1"; FAIL=$((FAIL + 1)); }

slug="$(basename "$ART" .md)"
echo "== check-article: $ART (slug=$slug) =="

# ---------- Front Matter / body の分離 ----------
fm="$(awk 'NR==1 && $0=="---"{f=1;next} f && $0=="---"{exit} f{print}' "$ART")"
body="$(awk 'NR==1 && $0=="---"{f=1;next} f && $0=="---" && s==0{s=1;next} s{print}' "$ART")"

if [ -z "$fm" ]; then
  fail "Front Matter が見つからない (先頭行が --- で始まっていない)"
else
  pass "Front Matter を検出した"
fi

# キー抽出 (スカラ用): 値の先頭トークン
fm_scalar() { printf '%s\n' "$fm" | grep -E "^$1:" | head -1 | sed -E "s/^$1:[[:space:]]*//" | awk '{print $1}'; }
# キー抽出 (生の値。引用符やコメントは呼び出し側で処理)
fm_raw() { printf '%s\n' "$fm" | grep -E "^$1:" | head -1 | sed -E "s/^$1:[[:space:]]*//"; }
# 引用符を外す
unquote() { sed -E 's/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/'; }

published="$(fm_scalar published)"
type_="$(fm_raw type | sed -E 's/[[:space:]]*#.*$//' | unquote | awk '{print $1}')"
title="$(fm_raw title | sed -E 's/[[:space:]]*#.*$//' | unquote)"
emoji="$(fm_raw emoji | sed -E 's/[[:space:]]*#.*$//' | unquote)"
topics_raw="$(fm_raw topics)"

# ---------- 1. 公開安全 ----------
case "$published" in
  false) pass "published=false (ドラフト)" ;;
  true)  fail "published=true -> 公開前レビュー対象は false であるべき (push で自動公開=事故公開リスク)" ;;
  "")    warn "published フィールドが無い (false を明示すべき)" ;;
  *)     warn "published の値が不正: $published (true/false のみ)" ;;
esac

# slug 文字種・長さ
slen=$(printf '%s' "$slug" | wc -c | tr -d ' ')
if printf '%s' "$slug" | grep -qE '^[a-z0-9_-]+$'; then
  if [ "$slen" -ge 12 ] && [ "$slen" -le 50 ]; then
    pass "slug 文字種OK, 長さ=$slen (12-50)"
  else
    fail "slug の長さ=$slen が範囲外 (12-50 にする)"
  fi
else
  fail "slug に使えない文字が含まれる (a-z 0-9 - _ のみ): $slug"
fi

# slug 汎用回避
if printf '%s' "$slug" | grep -qE '^(getting-started|hello-world|introduction|sample|test|demo|my-first|example|untitled)'; then
  warn "slug が汎用的で衝突しやすい: $slug -> 技術名+切り口で具体化 (knowledge/2026-07-01-zenn-slug-already-used.md)"
else
  pass "slug は汎用語で始まっていない"
fi

# ---------- 2. Front Matter 妥当性 ----------
case "$type_" in
  tech|idea) pass "type=$type_" ;;
  "")        warn "type フィールドが無い (tech/idea)" ;;
  *)         warn "type が不正: $type_ (tech/idea のみ)" ;;
esac

if [ -n "$title" ]; then
  tlen=$(printf '%s' "$title" | wc -m | tr -d ' ')
  if [ "$tlen" -gt 60 ]; then
    warn "title が長い: ${tlen}文字 (60字目安)"
  else
    pass "title あり: ${tlen}文字"
  fi
  if printf '%s' "$title" | grep -qE '完全理解|徹底解説|保存版|完全網羅|最強|究極'; then
    warn "title が誇大表現 (完全理解/徹底解説/保存版 等) -> 経験談トーンに合わせる"
  fi
else
  warn "title が無い"
fi

if [ -n "$emoji" ]; then pass "emoji あり: $emoji"; else warn "emoji が無い"; fi

ntopics=$(printf '%s' "$topics_raw" | grep -oE '"[^"]+"' | wc -l | tr -d ' ')
if [ "$ntopics" -eq 0 ]; then
  warn "topics が空 (1-5個付ける)"
elif [ "$ntopics" -gt 5 ]; then
  warn "topics が多い: ${ntopics}個 (最大5個)"
else
  pass "topics ${ntopics}個"
fi

# ---------- 4. 画像参照の解決 ----------
refs="$(printf '%s\n' "$body" | grep -oE '/images/[A-Za-z0-9._/-]+' | sort -u)"
if [ -z "$refs" ]; then
  echo "[INFO] /images 参照なし (ブラウザ表示を伴わない記事なら可)"
else
  while IFS= read -r ref; do
    [ -z "$ref" ] && continue
    if [ -f "$ROOT$ref" ]; then
      pass "画像あり: $ref"
    else
      fail "画像が見つからない: $ref -> images/$slug/ に配置する"
    fi
  done <<EOF
$refs
EOF
  # 孤立画像 (配置したが未参照)
  if [ -d "$ROOT/images/$slug" ]; then
    for f in "$ROOT/images/$slug"/*; do
      [ -f "$f" ] || continue
      rel="/images/$slug/$(basename "$f")"
      if ! printf '%s\n' "$refs" | grep -qxF "$rel"; then
        warn "未参照の画像: $rel -> 本文で使うか削除する"
      fi
    done
  fi
fi

# ---------- 5. Markdown 構造 ----------
nfence=$(printf '%s\n' "$body" | grep -cE '^```')
if [ $((nfence % 2)) -eq 0 ]; then
  pass "コードフェンスが閉じている: フェンス行=$nfence"
else
  fail "コードフェンスが未閉じ: フェンス行=$nfence (奇数)"
fi

ncolon=$(printf '%s\n' "$body" | grep -cE '^:::')
if [ $((ncolon % 2)) -eq 0 ]; then
  [ "$ncolon" -gt 0 ] && pass "::: ブロックが閉じている: $ncolon 行" || true
else
  warn "::: ブロック (message/details) が未閉じ: $ncolon 行 (奇数)"
fi

# リンクのプレースホルダ
if printf '%s\n' "$body" | grep -qE 'example\.com|\]\(\)|\]\(#\)'; then
  warn "プレースホルダ/空リンクの疑い (example.com / 空リンク)"
fi

# ---------- 6/7. 完成度 ----------
nyoso=$(grep -c '要素材' "$ART")
if [ "$nyoso" -gt 0 ]; then
  warn "要素材マーカーが ${nyoso}件残っている (未完成。埋めるか節を削る)"
else
  pass "要素材マーカーなし"
fi

if grep -qE 'TODO|FIXME|<slug>|<\.\.\.>|<n>|<技術' "$ART"; then
  warn "プレースホルダ (TODO/FIXME/<slug>/<...> 等) が残っている"
else
  pass "プレースホルダ残りなし"
fi

# ---------- 秘密情報スキャン ----------
# 明確な鍵/トークンは FAIL、疑わしい語は WARN (散文の可能性を目視切り分け)
sec_hits=0
scan_fail() {
  local label="$1" pat="$2" lines
  lines="$(grep -nEi -e "$pat" "$ART" | cut -d: -f1 | tr '\n' ',' | sed 's/,$//')"
  if [ -n "$lines" ]; then
    fail "秘密情報の疑い [$label] at line $lines"
    sec_hits=$((sec_hits + 1))
  fi
}
scan_warn() {
  local label="$1" pat="$2" lines
  lines="$(grep -nEi -e "$pat" "$ART" | cut -d: -f1 | tr '\n' ',' | sed 's/,$//')"
  if [ -n "$lines" ]; then
    warn "秘密情報の疑い [$label] (散文か目視確認) at line $lines"
    sec_hits=$((sec_hits + 1))
  fi
}
scan_fail "private-key"   '-----BEGIN [A-Z ]*PRIVATE KEY-----'
scan_fail "aws-akid"      'AKIA[0-9A-Z]{16}'
scan_fail "github-token"  'gh[pousr]_[A-Za-z0-9]{20,}'
scan_fail "slack-token"   'xox[baprs]-[A-Za-z0-9-]{10,}'
scan_fail "openai-key"    'sk-[A-Za-z0-9]{20,}'
scan_warn "user-path"     '/Users/[A-Za-z0-9._-]+/'
scan_warn "cred-word"     '(api[_-]?key|secret|token|password|passwd|authorization|bearer)[[:space:]]*[:=]'
[ "$sec_hits" -eq 0 ] && pass "秘密情報パターンの検出なし"

# ---------- SUMMARY ----------
echo "SUMMARY fail=$FAIL warn=$WARN"
exit 0
