# Practice plan: Chrome 150 `focusgroup` と JavaScript roving tabindex の対照検証

## Source report

- 出典: `research/search-topic-20260713-1030.md`
- 選定テーマ: Chrome 150 の `focusgroup` で toolbar の roving tabindex を置き換え、同一 fixture の手書き JavaScript 版と、Tab/矢印/Home/End、wrap、last-focused memory、RTL、disabled/hidden、focus と selection の責務、accessibility tree、非対応時 fallback を Playwright で比較する。
- 記事案: 「Chrome 150の`focusgroup`を試す: roving tabindexのJavaScriptはどこまで消せる？」
- このプランは上記の1テーマだけを扱う。実験の実行、結果の先取り、記事本文の作成は行わない。

## Objective

localhost 上の最小 fixture と実ブラウザを使い、同じ toolbar を次の2方式で操作した機械可読な証拠を残す。

1. 手書き JavaScript による roving `tabindex`
2. `focusgroup="toolbar wrap"` による宣言的 focus navigation

比較対象は、entry/exit の Tab、ArrowLeft/ArrowRight、Home/End、端での wrap、再入場時の memory、`nomemory` と `focusgroupstart`、RTL、disabled/hidden item、動的追加・削除、`focusgroup="none"`、tablist の focus と selection の分離、非対応時 fallback、accessibility tree とする。主証拠は `document.activeElement`、DOM 属性、選択状態、browser/version、CDP から得た accessibility tree とし、スクリーンショットは focus ring の補助証拠だけに使う。

## Hypothesis

- Chrome 150 Stable では `focusgroup` が toolbar の single Tab stop、矢印移動、Home/End、wrap、last-focused memory を focus-navigation 用 JavaScript なしで提供する。
- `dir="rtl"`、disabled/hidden、動的 item でも、手書き版で明示していた分岐の一部をブラウザへ委譲できる。ただし実際の順序は観測値として保存し、想定と違う場合も書き換えたり推測したりしない。
- `focusgroup` は focus を移すが、tablist の `aria-selected` と panel 表示は更新しないため、その selection 用 author code は残る。
- 非対応環境では property-based feature detection により手書き roving tabindex へ切り替えられる。

## Environment inspected at planning time

- 実効 sandbox mode: `danger-full-access`。実ブラウザ起動と Playwright 検証を許可する。
- OS/architecture: Darwin arm64
- Node.js: `v22.17.0`
- npm: `10.9.2`
- npm registry 上の固定候補: `playwright-core@1.61.1`
- 利用可能: `curl`, `unzip`, `jq`, Docker `28.5.1`
- `/Applications/Google Chrome.app` は計画時点で `149.0.7827.201` のため検証対象にしない。公式 Chrome for Testing manifest の Stable artifact を run directory 内へ取得し、major 150 以上を gate で確認する。
- Playwright browser cache は存在するが、version を推測して再利用しない。
- repository 内への system-level install、Homebrew、既存 browser の更新は行わない。

## Prerequisites and isolation

- run 開始位置は repository root とする。
- 全生成物、依存、browser archive、展開した browser、fixture、ログ、JSON、画像は新規 `logs/run-focusgroup-chrome150-<timestamp>/work/` 以下だけに置く。
- repository の package manifest、articles、practice、research、既存 logs を変更しない。Git コマンド、commit、branch 作成、push は行わない。
- 認証、API key、signup、OAuth、CAPTCHA、外部 API、課金、物理 device は不要。
- network access は npm registry と公式 Chrome for Testing 配布先への取得だけに限定する。fixture は loopback だけで配信する。

## Ordered steps and exact commands

### 1. Run directory と環境証拠を作る

repository root で次を実行する。既存パスと衝突した場合は上書きせず、新しい timestamp でやり直す。

```sh
set -eu
RUN_ID="$(date '+%Y%m%d-%H%M%S')"
RUN_DIR="$PWD/logs/run-focusgroup-chrome150-$RUN_ID"
WORK_DIR="$RUN_DIR/work"
test ! -e "$RUN_DIR"
mkdir -p "$WORK_DIR"/{browser,downloads,evidence,fixture,shots}
cd "$WORK_DIR"
printf '%s\n' "$RUN_DIR" > evidence/run-directory.txt
{
  date '+%Y-%m-%d %H:%M:%S %Z'
  uname -a
  node --version
  npm --version
  sw_vers
} > evidence/environment.txt 2>&1
```

以降は `$WORK_DIR` から出ない。run executor は最初に `execution-log.md` を作り、各コマンド、exit code、stdout/stderr、開始・終了時刻を逐次記録する。

### 2. Playwright driver と Chrome for Testing Stable を隔離取得する

run executor は `package.json` を `$WORK_DIR` に作り、`private: true`、`type: module`、devDependency `playwright-core: 1.61.1` だけを定義する。その後、次を実行する。

```sh
npm install --ignore-scripts --no-audit --no-fund 2>&1 | tee evidence/npm-install.txt
curl --fail --location --silent --show-error \
  https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json \
  --output downloads/cft.json
jq -er '
  .channels.Stable as $s
  | select(($s.version | split(".")[0] | tonumber) >= 150)
  | [$s.version, ($s.downloads.chrome[] | select(.platform == "mac-arm64") | .url)]
  | @tsv
' downloads/cft.json > evidence/cft-stable.tsv
CFT_VERSION="$(cut -f1 evidence/cft-stable.tsv)"
CFT_URL="$(cut -f2 evidence/cft-stable.tsv)"
test -n "$CFT_VERSION"
test -n "$CFT_URL"
curl --fail --location --silent --show-error "$CFT_URL" --output downloads/chrome.zip
unzip -q downloads/chrome.zip -d browser
CFT_EXECUTABLE="$WORK_DIR/browser/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
test -x "$CFT_EXECUTABLE"
"$CFT_EXECUTABLE" --version | tee evidence/browser-cli-version.txt
shasum -a 256 downloads/cft.json downloads/chrome.zip package-lock.json > evidence/sha256.txt
```

`jq` が non-zero、Stable major が150未満、`mac-arm64` URL がない、download/unzip が失敗した場合は capability gate failure として即停止する。別 channel、system Chrome 149、feature flag、cached Chromium で代用しない。

### 3. Fixture と automation を作る

run executor は以下を `$WORK_DIR` 内だけに実装する。

- `fixture/index.html`: group 前後に focusable sentinel を置き、同一ラベル・同一順序の4 button toolbar を表示する。variant は query parameter で `js`, `native`, `nomemory`, `start`, `rtl`, `edge`, `none`, `tablist`, `fallback` を切り替える。
- `fixture/app.js`: `js` variant の ArrowLeft/ArrowRight/Home/End、wrap、disabled/hidden skip、roving `tabindex` を実装する。`native` variant では focus-navigation listener を登録せず `focusgroup="toolbar wrap"` を使う。`tablist` では selection 更新を別 listener に分離する。`fallback` では `'focusgroup' in HTMLElement.prototype` の結果だけで native/JS を選択でき、test hook によって unsupported branch を強制できるようにする。
- `fixture/styles.css`: focus ring と現在の selection が識別できる最小 style。外部 font、CDN、画像は使わない。
- `server.mjs`: `127.0.0.1` の未使用 port にだけ bind する静的 server。実 URL を stdout に1行で出し、SIGTERM で終了する。directory traversal を拒否する。
- `gate.mjs`: Playwright で指定 executable を headless 起動し、browser version の major と localhost page 上の `'focusgroup' in HTMLElement.prototype` を評価して `evidence/capability.json` に保存する。browser launch、context/page 作成、navigation のいずれかが失敗した場合は error name/message/stack と exit code を記録して non-zero で終了する。
- `run.mjs`: 各 variant を独立 page で実行し、操作ごとに active element id、全 item の `tabindex`/`disabled`/`hidden`、`aria-selected`、表示 panel id、console/page error を JSONL に保存する。同じ基本 key sequence を `js` と `native` に与える。CDP session の `Accessibility.enable` と `Accessibility.getFullAXTree` を使い toolbar/tablist の tree を JSON に保存する。AX API だけが失敗した場合は `unavailable` と error 原文を保存して残りを続行する。

source の行数と分岐数は、生成後に次の固定コマンドで記録する。これらは保守コストの近似であり、優劣の断定には使わない。

```sh
wc -l fixture/app.js > evidence/source-lines.txt
grep -Ec '(^|[^[:alnum:]_])(if|switch|case)([^[:alnum:]_]|$)' fixture/app.js > evidence/branch-token-count.txt || true
```

### 4. 必須 capability gate を実行する

```sh
node server.mjs > evidence/server-url.txt 2> evidence/server-stderr.txt &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true; wait "$SERVER_PID" 2>/dev/null || true' EXIT INT TERM
for attempt in 1 2 3 4 5; do
  test -s evidence/server-url.txt && break
  sleep 1
done
test -s evidence/server-url.txt
BASE_URL="$(sed -n '1p' evidence/server-url.txt)"
node gate.mjs \
  --executable "$CFT_EXECUTABLE" \
  --url "$BASE_URL" \
  > evidence/gate-stdout.txt 2> evidence/gate-stderr.txt
jq -e '
  (.launch == "ok") and
  (.browserMajor >= 150) and
  (.focusgroupPropertySupport == true)
' evidence/capability.json > /dev/null
```

この gate が1つでも失敗したら、以後の UI/keyboard/DOM/accessibility 操作を実行しない。得られなかった結果を推測せず、`execution-log.md` に停止理由と原文を記録して run を終了する。`hasAttribute("focusgroup")` は support 判定に使わない。

### 5. 同一 key sequence の基本比較を実行する

`run.mjs` は各操作前後の snapshot を取り、少なくとも次を `evidence/basic-js.jsonl` と `evidence/basic-native.jsonl` に保存する。

1. 前 sentinel から Tab で group へ入る。
2. ArrowRight を3回、端でさらに1回押して wrap を観測する。
3. ArrowLeft を1回押す。
4. Home、End を各1回押す。
5. Tab で後 sentinel へ出る。Shift+Tab で戻り、last-focused memory を観測する。

```sh
set +e
node run.mjs --phase basic --url "$BASE_URL" --executable "$CFT_EXECUTABLE" \
  > evidence/basic-stdout.txt 2> evidence/basic-stderr.txt
BASIC_EXIT=$?
set -e
printf '%s\n' "$BASIC_EXIT" > evidence/basic-exit-code.txt
```

基本 contract の期待値は、group への Tab が1回、矢印/Home/End が document focus を item 間で移すこと、wrap が端から反対端へ移すこと、native variant で focus-navigation 用 author listener が0件であること。各 step の実測値を保存し、期待と不一致なら assertion を failure として残すが、証拠取得可能なら境界 matrix は続行する。

### 6. Memory と境界条件 matrix を実行する

```sh
set +e
node run.mjs --phase edges --url "$BASE_URL" --executable "$CFT_EXECUTABLE" \
  > evidence/edges-stdout.txt 2> evidence/edges-stderr.txt
EDGES_EXIT=$?
set -e
printf '%s\n' "$EDGES_EXIT" > evidence/edges-exit-code.txt
```

次の各 case を独立 page/context で行い、case ごとの JSONL、console、page error を保存する。

- default memory と `nomemory` の再入場先、および `focusgroupstart` 指定時の entry target
- `dir="rtl"` の ArrowLeft/ArrowRight。visual order から推測せず active element の列を保存する
- disabled item と `hidden` item を含む順序、および動的追加後・focused item 削除後の順序
- `focusgroup="none"` 区間をまたぐ Arrow と Tab の違い
- native と JS の全基本 sequence の対照表

edge case が想定外でも観測値を失敗として保存する。focused item 削除後など仕様解釈が曖昧な項目は、事後に「成功」へ丸めず observed-only として扱う。

### 7. Focus/selection、fallback、accessibility を実行する

```sh
set +e
node run.mjs --phase responsibility --url "$BASE_URL" --executable "$CFT_EXECUTABLE" \
  > evidence/responsibility-stdout.txt 2> evidence/responsibility-stderr.txt
RESPONSIBILITY_EXIT=$?
set -e
printf '%s\n' "$RESPONSIBILITY_EXIT" > evidence/responsibility-exit-code.txt
```

- tablist で Arrow により focus だけを移した直後、`aria-selected` と panel が不変であることを記録する。
- selection author code を有効にして activation key を押した後だけ selection/panel が変わることを記録する。
- feature detection を test hook で false にした fallback branch で、JS roving tabindex の基本 sequence が動くことを記録する。これは browser が本当に非対応だと偽装した主張ではなく、fallback branch の単体検証と明記する。
- toolbar と tablist の full AX tree を `evidence/ax-toolbar.json` と `evidence/ax-tablist.json` に保存する。role/name/focused/selected を抽出した小さい summary も保存し、取得不能時は DOM から role を推測しない。
- `shots/` には JS/native の同じ focus step と tablist の選択前後だけを保存する。

### 8. 証拠を検査して server を終了する

```sh
kill "$SERVER_PID" 2>/dev/null || true
wait "$SERVER_PID" 2>/dev/null || true
trap - EXIT INT TERM
find evidence shots -type f -maxdepth 2 -print | LC_ALL=C sort > evidence/file-list.txt
find evidence shots -type f -maxdepth 2 -exec shasum -a 256 {} \; \
  | LC_ALL=C sort > evidence/artifact-sha256.txt
jq -s '.' evidence/basic-js.jsonl > evidence/basic-js.json
jq -s '.' evidence/basic-native.jsonl > evidence/basic-native.json
```

run executor は最後に `execution-log.md` へ、gate 判定、各 phase exit code、assertion の pass/fail/observed-only、AX API availability、未実施項目、cleanup 結果を追記する。実測値のない欄は空想で埋めず `not-run` または `unavailable` とする。

## Observations to capture

- timestamp、OS/architecture、Node/npm/Playwright、manifest URL、Chrome for Testing exact version、browser executable path、archive/checksum
- capability gate の launch result、browser major、property support、失敗時の error 原文と exit code
- variant/case/step/key ごとの active element id と全 item の `tabindex`, `disabled`, `hidden`
- Tab entry/exit 回数、Arrow/Home/End/wrap、memory/nomemory/start、RTL、disabled/hidden、dynamic item、`none` の実測列
- native/JS variant に登録した focus-navigation listener 数と `app.js` の line/branch-token count
- tablist の focused id、`aria-selected`、visible panel と selection author code の有無
- forced unsupported fallback branch の選択方式と key sequence
- AX tree または取得不能の明示的 error。DOM 観測とは別ファイルにする
- console/page errors、各 phase の stdout/stderr/exit code、補助 screenshot、全証拠の checksum

## Success criteria

実験完了は次をすべて満たすこととする。

1. Chrome for Testing Stable の browser launch、major 150以上、`'focusgroup' in HTMLElement.prototype === true` の3 gate を通過する。
2. JS/native の同一 fixture・同一基本 key sequence が完走し、全 step の active element と DOM state が保存される。
3. Tab、矢印、Home/End、wrap、memory、nomemory/start、RTL、disabled/hidden の観測値がある。
4. tablist で focus と selection の状態が別々に記録され、selection に残る author code が特定できる。
5. forced unsupported fallback branch の JS sequence が記録される。
6. accessibility tree が取得されるか、API 取得不能だけが原文付きで `unavailable` と明示される。
7. 期待外の挙動を含め、assertion 結果と全 phase exit codeが改変されず残る。

仮説支持は、基本 contract の assertion がすべて pass し、native 版から focus-navigation listener を除去でき、selection code は残る場合とする。edge の observed-only 項目は仮説支持の件数へ水増ししない。

## Failure and stop criteria

- browser download/unzip/executable discovery の失敗
- Stable browser major 150未満
- browser launch、context/page 作成、localhost navigation の失敗
- property-based feature gate が false
- basic JS/native のどちらかで機械可読な操作証拠を作れない
- server が loopback 以外へ bind する、外部通信や秘密情報が必要になる、work directory 外への書込みが必要になる
- 4時間時点で基本 toolbar matrix が完了していない

最初の4つは即停止条件であり、その後の表示・key 操作・AX tree を推測しない。AX API 単独の失敗は全体停止にせず、その項目だけ `unavailable` にする。behavior assertion の不一致は仮説不支持であり、automation 自体が証拠を保存できる限り実験失敗とは混同しない。

## Security and cost limits

- 費用上限は0円。OSS と公式無償配布 artifact だけを使う。
- package は `playwright-core@1.61.1` に固定し、`npm install --ignore-scripts` を使う。Playwright の自動 browser install は行わない。
- Chrome は公式 Chrome for Testing Stable manifest が示す `mac-arm64` URLだけから取得する。major 条件を満たさない別 channel や flag に切り替えない。
- server は `127.0.0.1` の ephemeral port のみ。fixture は外部 resource を読み込まない。
- `sudo`, `brew`, system directory への install、既存 browser/profile の変更、任意 shell download の実行、credential の読取りを禁止する。
- screenshot には自作 fixture だけを含め、desktop、他 tab、個人情報を写さない。

## Cleanup

通常終了・失敗・割込みのすべてで trap により server/browser process を終了する。run 中に cleanup を確認するコマンドは次とする。

```sh
test -z "$(lsof -nP -a -p "${SERVER_PID:-0}" -iTCP -sTCP:LISTEN 2>/dev/null || true)"
```

証拠を保持するため `$RUN_DIR` は自動削除しない。削除が必要な場合も、実行者が path を `logs/run-focusgroup-chrome150-*` と確認した後に別途行う。repository の他ファイル、npm global cache、Playwright global cache、system Chrome は削除しない。

## Timebox

- isolation、metadata、dependency/browser 取得: 35分
- fixture と JS baseline/native variant: 55分
- capability gate と基本 matrix: 40分
- memory/RTL/disabled/hidden/dynamic/none matrix: 65分
- tablist/fallback/AX tree: 45分
- 証拠整形、checksum、cleanup、execution log: 20分
- 合計上限: 4時間20分

4時間時点で基本 matrix が未完なら即停止する。基本 matrix が完了済みで残り20分しかない場合は、`focusgroup="none"` と動的 item を `not-run` にして、tablist の責務境界、fallback、証拠整形を優先する。

## Fallback scope

- system Chrome 149、Beta/Dev/Canary、feature flag、他 browser への切替は行わない。
- Stable major 150 artifact を取得できない、または launch/property gate を通らない場合の fallback は「停止記録」だけである。
- AX API だけが使えない場合は keyboard/DOM matrix を続行し、AX 項目のみ未検証にする。
- 時間超過時に削れるのは `focusgroup="none"` と動的 item の2項目だけ。JS/native 基本比較、memory、RTL、disabled/hidden、tablist responsibility、fallback は削らない。
- 実行中に非自明な環境障害を解決した場合は、記事作成へ進む前に knowledge 保存対象かを判定する。解決できない障害の結果を推測で補わない。

## Expected article takeaways

- roving tabindex のどの focus-management code を Chrome 150 の `focusgroup` で削減でき、何が author responsibility として残るか。
- single Tab stop、Arrow/Home/End、wrap、memory、RTL、disabled/hidden の実測比較。
- focus navigation と tab selection は別であり、`aria-selected` と panel 更新を属性だけに期待できないこと。
- property-based detection と JS fallback の組み方。
- screenshot ではなく active element、DOM state、AX tree、version/gate を証拠にする再現可能な browser feature 検証方法。

## Relevant sources preserved from the report

- Chrome for Developers, New in Chrome 150: https://developer.chrome.com/blog/new-in-chrome-150
- Chrome for Developers, Request for developer feedback: focusgroup: https://developer.chrome.com/blog/focusgroup-rfc
- Open UI, focusgroup Explainer: https://open-ui.org/components/focusgroup.explainer/
- W3C APG, Developing a Keyboard Interface: https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/
- Chrome for Testing availability manifest: https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json
- Jeremy Keith, Testing browser support for focusgroup: https://adactio.com/journal/22445
- Adrian Roselli, Focusgroup Tests: https://adrianroselli.com/2026/07/focusgroup-tests.html
- ミツエーリンクス, Google Chrome 150が安定版に: https://www.mitsue.co.jp/knowledge/blog/qc/202607/01_1326.html
- ミツエーリンクス, ロービングタブインデックスを採用したUIの実装コストを下げるfocusgroup属性: https://www.mitsue.co.jp/knowledge/blog/a11y/202603/09_1305.html
