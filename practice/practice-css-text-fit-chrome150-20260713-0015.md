# 実践計画: Chrome 150 の CSS `text-fit` を日本語・英語の見出しで実測する

## Source report

- 入力レポート: `research/search-topic-20260713-0010.md`
- 選定テーマ: **Chrome 150 の CSS `text-fit` を、固定 `font-size` / `clamp()` fallback と同じ fixture で比較し、日本語・英語、container 幅、複数行、scale limit、computed value、page zoom を Playwright とスクリーンショットで実測する。**
- 参照する一次・公式情報:
  - [Chrome 150 release notes](https://developer.chrome.com/release-notes/150)
  - [New in Chrome 150](https://developer.chrome.com/blog/new-in-chrome-150)
  - [CSS Text Module Level 5: text-fit](https://drafts.csswg.org/css-text-5/#text-fit-property)
  - [css-fit-text explainer](https://github.com/explainers-by-googlers/css-fit-text)
  - [Chrome for Testing availability dashboard and JSON API](https://googlechromelabs.github.io/chrome-for-testing/)
- 互換性の補助資料: [Can I use: text-fit](https://caniuse.com/mdn-css_properties_text-fit)
- 対象外: 記事執筆、Git 操作、外部サイトの表示比較、全 browser 対応の証明、外部 font、性能 benchmark、CDP page scale / device scale factor / CSS `zoom` を page zoom とみなすこと。

## Objective

localhost の単一 fixture と Chrome for Testing 150 を使い、固定 `font-size`、`clamp()` fallback、`text-fit` を同一文字列・同一 browser・同一 viewport で比較する。日本語/英語、240 / 480 / 720 px、1行/複数行、`grow` / `shrink`、`consistent` / `per-line` / `per-line-all`、percentage limit、動的な幅・文言変更について、geometry、overflow、line rect、computed style、PNG を case ID で対応付ける。

この実験は CSS Text Level 5 の全仕様や全 OS/font の pixel 値を証明しない。page zoom は実際の browser UI zoom を独立に確認できた場合だけ補助実測し、確認できなければ未検証として切り離す。

## Hypothesis

1. Chrome 150 では `CSS.supports("text-fit", "grow")` と `CSS.supports("text-fit", "shrink consistent 50%")` が真になり、同じ指定 `font-size` の固定版と比べて `text-fit` 版の文字 geometry が container 幅へ適応する。
2. container 幅、言語、改行可能位置、mode、limit によって、余白、overflow、行ごとの見かけの拡縮が異なる。percentage limit がある case では fit を完了できず余白または overflow が残る場合がある。
3. `text-fit` で見た目の文字サイズが変わっても、`getComputedStyle(...).fontSize` は指定した値のままであり、computed `font-size` 単独では効果を判定できない。
4. container 幅または文言を動的に変えると fit が再計算される。
5. `@supports` の外側に固定 `font-size` / `clamp()` fallback を置くことで、`text-fit` 非対応として作った対照ページでも内容と可読性を維持できる。

いずれも検証前の仮説である。反証、未対応、測定不能を成功に読み替えない。

## Environment

計画作成時にインストールや browser 起動を行わず確認した環境:

- macOS 26.5 / Darwin 25.5.0 / arm64
- Node.js `v22.17.0`、npm `10.9.2`、`npx`、`curl`、`unzip`、`shasum` が利用可能
- リポジトリに Playwright `1.61.1` が導入済み
- system Google Chrome は `149.0.7827.201` で、必須の major 150 gate を満たさない
- Docker `28.5.1` は利用可能だが、GUI/browser と host font の比較条件が変わるため本計画では使わない
- 全 pipeline stage の sandbox mode は `danger-full-access`。実 browser / Playwright の起動を計画対象に含める

これらは run 時に再記録し、固定値とはみなさない。

## Prerequisites

- リポジトリルートから開始する。
- `node`, `curl`, `unzip` とリポジトリ既存の `node_modules/playwright` が読み込めること。
- 公式 Chrome for Testing JSON API と、その JSON が返す `storage.googleapis.com/chrome-for-testing-public/` の HTTPS URL に接続できること。
- run-local に Chrome for Testing 150 mac-arm64 の archive 展開用として最大 1.5 GB の空き容量があること。
- API key、アカウント、認証、外部 font、手動操作は不要。fixture の browser request は loopback のみに限定する。

## Isolation directory

全作業は新規の `logs/run-css-text-fit-chrome150-20260713-0015/work/` 以下だけで行う。証拠は同じ run directory の `evidence/` と `execution-log.md` に置く。リポジトリ直下の package / lockfile、`articles/`、`research/`、`practice/` を変更せず、Git コマンドを実行しない。

```sh
set -eu
umask 077
RUN_DIR="$PWD/logs/run-css-text-fit-chrome150-20260713-0015"
WORK_DIR="$RUN_DIR/work"
test ! -e "$RUN_DIR"
mkdir -p "$WORK_DIR/browser" "$WORK_DIR/fixture" "$WORK_DIR/tmp-profile" "$RUN_DIR/evidence/screenshots/core" "$RUN_DIR/evidence/screenshots/dynamic" "$RUN_DIR/evidence/screenshots/zoom"
touch "$RUN_DIR/execution-log.md"
```

`test ! -e` が失敗したら既存 run を再利用、削除、上書きせず abort する。別 timestamp への変更は上位 pipeline stage だけが行う。

## Ordered steps and commands

すべて非対話コマンドとする。各コマンド、開始・終了時刻、終了コード、stdout / stderr を `execution-log.md` または `evidence/` に記録する。shell pipeline を追加する場合は `set -o pipefail` を有効にする。fixture と runner は実行エージェントのパッチ機能で `$WORK_DIR` 内だけに作る。

### 1. 環境を記録する（10分）

完全な環境変数一覧、ユーザー名、browser profile は収集しない。

```sh
cd "$WORK_DIR"
{
  date -u '+UTC=%Y-%m-%dT%H:%M:%SZ'
  node --version
  npm --version
  uname -srm
  sw_vers -productVersion
  ../../../node_modules/playwright/cli.js --version
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' --version 2>&1 || true
} > "$RUN_DIR/evidence/environment.txt"
node -e "require('../../../node_modules/playwright'); console.log('playwright-load=ok')" > "$RUN_DIR/evidence/playwright-load.txt" 2>&1
```

Playwright を読み込めなければ新規 npm install は行わず停止する。

### 2. 公式 Chrome for Testing 150 を run-local に準備する（25分）

実行エージェントのパッチ機能で `select-browser.mjs` を作る。この script は `known-good-versions-with-downloads.json` を読み、version major が厳密に 150、platform が `mac-arm64` の Chrome entry のうち patch version が最大の1件を選ぶ。URL は protocol が `https:`、hostname が `storage.googleapis.com`、pathname が `/chrome-for-testing-public/` で始まる場合だけ `evidence/chrome-url.txt` に出力し、version を `evidence/selected-browser-version.txt` に出力する。該当 entry が0件または複数 URL へ曖昧に解決される場合は非0で終了する。

```sh
cd "$WORK_DIR"
curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location \
  --retry 1 --max-time 120 \
  'https://googlechromelabs.github.io/chrome-for-testing/known-good-versions-with-downloads.json' \
  --output "$RUN_DIR/evidence/known-good-versions-with-downloads.json"
node select-browser.mjs \
  "$RUN_DIR/evidence/known-good-versions-with-downloads.json" \
  "$RUN_DIR/evidence/chrome-url.txt" \
  "$RUN_DIR/evidence/selected-browser-version.txt"
CHROME_URL="$(sed -n '1p' "$RUN_DIR/evidence/chrome-url.txt")"
case "$CHROME_URL" in
  https://storage.googleapis.com/chrome-for-testing-public/*/mac-arm64/chrome-mac-arm64.zip) ;;
  *) exit 1 ;;
esac
curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location \
  --retry 1 --max-time 600 "$CHROME_URL" --output browser/chrome-mac-arm64.zip
shasum -a 256 browser/chrome-mac-arm64.zip > "$RUN_DIR/evidence/chrome-archive-local-sha256.txt"
unzip -q browser/chrome-mac-arm64.zip -d browser/unpacked
CHROME_PATH="$WORK_DIR/browser/unpacked/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
test -x "$CHROME_PATH"
"$CHROME_PATH" --version > "$RUN_DIR/evidence/chrome-binary-version.txt" 2>&1
```

SHA-256 は取得物の再識別用 local fingerprint であり、公式署名の代用とは表現しない。JSON または archive の取得は各2試行まで、配布元の変更、非 HTTPS mirror、system Chrome の上書き、`brew`、管理者権限は使わない。major 150 を取得できなければ停止する。

### 3. fixture と測定 runner を作る（45分）

実行エージェントのパッチ機能で次を作る。

```text
work/
├── select-browser.mjs
├── server.mjs
├── gate.mjs
├── verify.mjs
├── zoom-check.mjs
└── fixture/
    ├── index.html
    └── styles.css
```

- `server.mjs`: Node.js 組み込み `node:http` だけで `127.0.0.1:4173` に `fixture/` を配信する。path traversal を拒否し、`/healthz` と HTML/CSS 以外を返さない。
- `index.html`: 固定 `font-size: 32px`、`clamp()` fallback、`text-fit` の3対照を同じ case に置く。短い日本語、長い日本語、短い英語、空白を含む長い英語を使い、各要素へ安定した case ID を付ける。外部 resource、animation、transition、editable content は置かない。
- `styles.css`: 240 / 480 / 720 px、1行/複数行と、`grow consistent`、`shrink consistent 50%`、`grow per-line`、`grow per-line-all 200%` の matrix を作る。fallback を既定とし、`@supports (text-fit: grow)` 内だけで enhancement を有効にする。対照測定用に `html.force-fallback` では enhancement を無効化する。
- `gate.mjs`: 指定 executable を `headless: true`、run-local profile、拡張無効で実 launch し、`browser.version()`、UA、platform、`CSS.supports()`、実際の resolved font family を JSON に保存する。外部 URL request を検知したら失敗する。
- `verify.mjs`: viewport、case ID、指定値、text、container と text の rect、`scrollWidth/clientWidth`、Range による line rect 数、computed `fontSize` / `textFit`、support、assertion を JSON/CSV に保存し、case ID ごとの PNG を撮る。見かけの used font-size を computed `font-size` から逆算・断定しない。
- `zoom-check.mjs`: page zoom の補助試験専用。CDP page scale、device scale factor、CSS `zoom` は使わない。macOS の browser UI に対する zoom 操作が許可され、100% / 200% の状態変化を browser-side の独立した複数値（少なくとも `devicePixelRatio` と CSS viewport 幅）で確認できる場合だけ測定する。操作権限、foreground window、倍率状態のいずれかを証明できなければ非0で終了し、画像を結果扱いしない。

構文を確認する。

```sh
cd "$WORK_DIR"
node --check select-browser.mjs
node --check server.mjs
node --check gate.mjs
node --check verify.mjs
node --check zoom-check.mjs
```

### 4. 必須 capability gate を実行する（20分）

最初の実 browser 起動を独立した gate にする。

```sh
cd "$WORK_DIR"
CHROME_PATH="$WORK_DIR/browser/unpacked/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
set +e
node gate.mjs --browser "$CHROME_PATH" --output "$RUN_DIR/evidence/gate.json" \
  > "$RUN_DIR/evidence/gate-stdout.txt" 2> "$RUN_DIR/evidence/gate-stderr.txt"
GATE_STATUS=$?
set -e
printf '%s\n' "$GATE_STATUS" > "$RUN_DIR/evidence/gate.exit"
test "$GATE_STATUS" -eq 0
node -e "const r=require(process.argv[1]); if(r.browserMajor!==150 || r.supports.grow!==true || r.supports.shrinkConsistent50!==true || r.externalRequests!==0) process.exit(1)" "$RUN_DIR/evidence/gate.json"
```

合格条件は、run-local Chrome for Testing が実際に launch し、`browser.version()` の major が厳密に150、次の両方が真、外部 request が0であること。

```js
CSS.supports("text-fit", "grow")
CSS.supports("text-fit", "shrink consistent 50%")
```

browser download、executable 確認、launch、page/context 作成、major、feature detection のどれかが失敗したら **run 全体を直ちに停止**する。system Chrome 149、cached Chromium、Docker、flag 付き browser へ切り替えず、CSS の表示結果を一切推測しない。stderr、終了コード、得られた gate JSON だけを記録する。

### 5. 核心 matrix を3回測定する（75分）

gate 合格後だけ localhost server を起動し、毎回新しい browser context で同じ matrix を3回測る。

```sh
cd "$WORK_DIR"
node server.mjs > "$RUN_DIR/evidence/server.log" 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT INT TERM
i=0
until curl --fail --silent --show-error http://127.0.0.1:4173/healthz > "$RUN_DIR/evidence/healthz.json"; do
  i=$((i + 1))
  test "$i" -lt 20 || exit 1
  sleep 1
done
CHROME_PATH="$WORK_DIR/browser/unpacked/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
for RUN in 1 2 3; do
  node verify.mjs --mode core --repeat "$RUN" --browser "$CHROME_PATH" \
    --base-url http://127.0.0.1:4173 \
    --json "$RUN_DIR/evidence/core-$RUN.json" \
    --csv "$RUN_DIR/evidence/core-$RUN.csv" \
    --screenshots "$RUN_DIR/evidence/screenshots/core/run-$RUN" \
    > "$RUN_DIR/evidence/core-$RUN.stdout.txt" 2> "$RUN_DIR/evidence/core-$RUN.stderr.txt"
done
```

各 run で4文字列、3幅、4つの `text-fit` 値と固定 / clamp / text-fit 対照を測る。全 screenshot は viewport 単位の固定 full-page PNG とし、case ID を JSON/CSV と画像内ラベルに含める。3反復で値が異なる場合は分散を残し、都合のよい run だけを採用しない。

### 6. 動的変更と fallback を測定する（40分）

```sh
cd "$WORK_DIR"
CHROME_PATH="$WORK_DIR/browser/unpacked/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
node verify.mjs --mode dynamic --browser "$CHROME_PATH" \
  --base-url http://127.0.0.1:4173 \
  --json "$RUN_DIR/evidence/dynamic.json" \
  --screenshots "$RUN_DIR/evidence/screenshots/dynamic" \
  > "$RUN_DIR/evidence/dynamic.stdout.txt" 2> "$RUN_DIR/evidence/dynamic.stderr.txt"
node verify.mjs --mode fallback --browser "$CHROME_PATH" \
  --base-url http://127.0.0.1:4173 \
  --json "$RUN_DIR/evidence/fallback.json" \
  --screenshots "$RUN_DIR/evidence/screenshots/dynamic/fallback" \
  > "$RUN_DIR/evidence/fallback.stdout.txt" 2> "$RUN_DIR/evidence/fallback.stderr.txt"
```

dynamic は同一要素を 240 → 480 → 720 px に切り替え、layout 安定を `requestAnimationFrame` 2回で待って測定する。その後、日本語から英語へ差し替えて再測定する。fallback は `force-fallback` を使う制御された非対応相当の対照であり、「Chrome 149/Firefox/Safari の実測」とは表現しない。全段階で visible text、rect、overflow、line count を保存する。

### 7. page zoom の補助 capability gate と実測（30分以内）

これは核心 matrix の成功条件と分離する。実 browser UI zoom の自動操作と独立確認ができる場合だけ進める。

```sh
cd "$WORK_DIR"
CHROME_PATH="$WORK_DIR/browser/unpacked/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
set +e
node zoom-check.mjs --gate-only --browser "$CHROME_PATH" \
  --base-url http://127.0.0.1:4173 --output "$RUN_DIR/evidence/zoom-gate.json" \
  > "$RUN_DIR/evidence/zoom-gate.stdout.txt" 2> "$RUN_DIR/evidence/zoom-gate.stderr.txt"
ZOOM_GATE_STATUS=$?
set -e
printf '%s\n' "$ZOOM_GATE_STATUS" > "$RUN_DIR/evidence/zoom-gate.exit"
if test "$ZOOM_GATE_STATUS" -eq 0; then
  node zoom-check.mjs --measure --browser "$CHROME_PATH" \
    --base-url http://127.0.0.1:4173 \
    --output "$RUN_DIR/evidence/zoom-results.json" \
    --screenshots "$RUN_DIR/evidence/screenshots/zoom" \
    > "$RUN_DIR/evidence/zoom.stdout.txt" 2> "$RUN_DIR/evidence/zoom.stderr.txt"
fi
```

100% と 200% の双方について、固定 px 幅 box と viewport 依存幅 box の geometry、DPR、CSS viewport、PNG を保存する。zoom gate が失敗したらこの subtest だけを停止し、`zoom-results.json` を作らず、「page zoom は未実測」と記録する。CDP page scale、device scale factor、CSS `zoom`、画像の見た目から page zoom の結果を推測しない。100% / 200% の状態を独立確認できない場合も同じ扱いとする。

### 8. 証拠を検査して終了する（30分）

```sh
cd "$WORK_DIR"
node verify.mjs --summarize \
  --inputs "$RUN_DIR/evidence/core-1.json,$RUN_DIR/evidence/core-2.json,$RUN_DIR/evidence/core-3.json,$RUN_DIR/evidence/dynamic.json,$RUN_DIR/evidence/fallback.json" \
  --output "$RUN_DIR/evidence/summary.json"
node -e "const r=require(process.argv[1]); if(r.requiredFailures!==0 || r.repeats!==3 || r.browserMajor!==150) process.exit(1)" "$RUN_DIR/evidence/summary.json"
find "$RUN_DIR" -maxdepth 5 -type f -print | LC_ALL=C sort > "$RUN_DIR/evidence/file-list.txt"
date -u '+UTC=%Y-%m-%dT%H:%M:%SZ' > "$RUN_DIR/evidence/end-time.txt"
kill "$SERVER_PID"
wait "$SERVER_PID" 2>/dev/null || true
trap - EXIT INT TERM
```

最後に `execution-log.md` へ、全コマンドと終了コード、exact browser version、selected font、gate、case ごとの観測、反復差、仮説ごとの supported / contradicted / inconclusive、page zoom の実測可否、未検証範囲を記録する。

## Observations to capture

- OS / architecture、Node / Playwright、Chrome for Testing の exact version、archive URL、local SHA-256
- browser launch の成否、UA、major、`CSS.supports()` の各真偽、外部 request 数
- 実際に resolved された font family。外部 font は使わない
- case ID、言語、文字列、container 幅、1行/複数行、指定 `text-fit` 値、対照種別
- container/text の x, y, width, height、`scrollWidth/clientWidth`、overflow、Range の line rect 数
- computed `font-size` と browser が公開する computed `text-fit`。空値は未取得とし、描画の証拠へ読み替えない
- 動的な幅変更/文言変更の前後 geometry と再 layout 後の値
- 3反復の値と差。絶対 pixel 値を他 OS/font へ一般化しない
- case ID と対応した PNG。画像だけで合否を決めない
- fallback 制御時の全 text 可視性、overflow、適用 style
- page zoom gate の成否。合格時のみ100% / 200%の独立確認値、fixed/viewport box geometry、PNG
- stdout、stderr、終了コード、開始・終了時刻

## Success criteria

次をすべて満たした場合だけ核心実験を成功とする。

1. run-local Chrome for Testing が実 launch し、`browser.version()` の major が厳密に150で、必須2構文の `CSS.supports()` が真。
2. 4文字列 × 3幅 × 4指定値について、固定 / clamp / text-fit の同一環境対照が3回あり、JSON/CSV/PNG と case ID が対応する。
3. 各 case に rect、overflow、line rect、computed `font-size` があり、computed style 単独で効果を判定していない。
4. `grow`、`shrink`、複数行 mode、percentage limit の少なくとも1 case ずつで、指定値が parse/apply され、固定対照との差または limit による残余を数値と画像の両方で観測できる。
5. 240 → 480 → 720 px と日本語 → 英語の動的変更後に再測定が完了し、前後の値が保存される。
6. 強制 fallback 対照で全内容が可視、horizontal overflow がなく、固定 / `clamp()` style が適用される。
7. 外部 browser request が0で、必須 JSON/CSV/PNG、exact version、終了コードが揃う。

page zoom は補助項目である。zoom gate が合格して実測が完了すれば成功結果へ追加できるが、gate 不合格なら核心実験を失敗にせず、明確に「未実測」とする。

仮説と異なる geometry や computed value でも、測定系と証拠が完全なら反証された観測として残す。ただし必須 mode が parse/apply されない場合は成功条件4を満たさない。

## Failure criteria and stop conditions

- Chrome for Testing 150 の公式 metadata/archive を2試行以内に取得・展開できない、または executable / major を確認できない。
- Playwright の browser launch、page/context 作成、major 150 gate、必須 `CSS.supports()` のいずれかが失敗する。この場合は run 全体を停止し、表示結果を推測しない。
- fixture が外部 URL へ request する、通常 profile や system Chrome の上書き、非公式 mirror、flag による未提供機能の有効化が必要になる。
- 4指定値のいずれかが parse/apply されず、30分以内に fixture の単純な誤りと確認できない。
- 必須 case の JSON/CSV/PNG が欠ける、case ID が対応しない、文字欠落、runner error、3反復未完了がある。
- geometry と画像が矛盾し、20分以内に測定/fixture の単純な誤りへ切り分けられない。
- 開始から2時間30分で核心 matrix の初回を完了できない、または合計4時間30分を超える。

page zoom の browser UI 操作または倍率の独立確認だけが失敗した場合は zoom subtest の停止条件であり、核心 matrix を推測で補わない。

## Security and cost limits

- 費用上限0円。API、SaaS、クラウド、認証、アカウントは使わない。
- 外部通信は Chrome for Testing の公式 JSON/API と公式 archive の取得だけ。browser 本体の request は loopback 以外を runner で拒否する。
- download URL は HTTPS、許可 hostname/path/platform を script と shell の両方で検証する。再試行は各1回まで。
- 外部 font、実サイト、実ユーザーデータ、cookie、token、通常 browser profile、環境変数一覧を使わない。
- browser は run-local profile、拡張無効で起動する。page zoom 補助試験でも既存 Chrome window/profile を操作しない。
- Git コマンドを実行せず、リポジトリの package / lockfile に依存を追加しない。`brew`、`sudo`、system-wide install、Docker fallback は行わない。
- archive と展開物を含む追加 disk 使用量は1.5 GB、network download は1 GBを上限とする。

## Cleanup

通常終了・失敗時とも、runner の `finally` で page/context/browser を閉じ、server PID を停止する。run-local profile と取得 archive/展開 browser は証拠整理後に削除し、fixture、runner、サニタイズ済み evidence、execution log は review 用に残す。

```sh
test -z "${SERVER_PID:-}" || kill "$SERVER_PID" 2>/dev/null || true
rm -rf "$WORK_DIR/tmp-profile" "$WORK_DIR/browser/unpacked"
rm -f "$WORK_DIR/browser/chrome-mac-arm64.zip"
test ! -e "$WORK_DIR/tmp-profile"
test ! -e "$WORK_DIR/browser/unpacked"
test ! -e "$WORK_DIR/browser/chrome-mac-arm64.zip"
```

system Chrome、共有 Playwright cache、npm cache、run directory と evidence は削除しない。破棄が必要な場合も対象はこの run で新規作成した `logs/run-css-text-fit-chrome150-20260713-0015/` だけとする。

## Timebox

合計 **4時間30分** を絶対上限とする。

| 作業 | 目安 |
|---|---:|
| 環境記録 | 10分 |
| Chrome for Testing 150 準備 | 25分 |
| fixture / runner 作成 | 45分 |
| 必須 capability gate | 20分 |
| 核心 matrix 3反復 | 75分 |
| 動的変更 / fallback | 40分 |
| page zoom 補助 gate / 実測 | 最大30分 |
| 証拠検査・整理 | 30分 |
| 切り分け予備 | 35分 |

2時間30分で核心 matrix の初回が終わらなければ page zoom を行わず、必須範囲の切り分けだけを続ける。4時間30分で未完了範囲と終了コードを記録して停止する。

## Fallback scope

1. **browser launch / major / 必須 support gate が不合格**: fallback せず run 全体を停止する。Chrome 149、cached Chromium、Docker、静的推測へ切り替えない。
2. **page zoom gate のみ不合格**: zoom を未実測として終了し、CSS仕様の open issue と入力レポートの記述だけを実測結果から分離して残す。
3. **`per-line` 系または limit case だけが不合格**: grow/shrink の証拠は保持するが、核心実験の完全成功とはしない。不合格構文、computed value、画像、stderr を残す。
4. **動的変更だけが不安定**: 静的 matrix を保持し、動的再計算は inconclusive とする。固定 delay を増やして都合のよい結果を選ばない。
5. **3反復の pixel 値が揺れる**: 全値と環境を残し、絶対 pixel 値の結論を避ける。1回だけを採用しない。

非対応 browser の表示、page zoom、used font-size を、feature table、computed style、CDP scale、画像だけから補完することは fallback に含めない。

## Expected article takeaways

実行証拠が得られた範囲だけで、記事工程へ次を渡せる見込みである。計画時点では断定しない。

- Chrome 150 の `text-fit` が、日本語/英語と container 幅ごとに固定 `font-size` / `clamp()` とどう異なったか。
- `grow` / `shrink`、複数行 mode、percentage limit で余白、overflow、行 geometry がどう変化したか。
- 見た目が変わっても computed `font-size` だけでは判定できない点と、geometry / screenshot を組み合わせる測定方法。
- 幅/文言の動的変更時に fit が再計算されたか。
- 対応 browser が限定される段階での `@supports` progressive enhancement と、強制 fallback 対照の範囲。
- page zoom を実 browser UI で証明できた場合だけ、その観測と fixed/viewport box の差。証明できなければ未実測であること。
- exact Chrome version、OS、resolved font に依存する実測を他環境へ一般化しないための注意点。
