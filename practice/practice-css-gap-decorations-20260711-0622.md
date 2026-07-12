# CSS Gap Decorations と従来の border 実装の比較検証プラン

## Source report

- 入力レポート: `research/search-topic-20260711-0619.md`
- 選定テーマ: **CSS Gap Decorations で Grid/Flex の区切り線を引き、border + `nth-child` 回避策と比較する**
- 参照する一次・公式情報:
  - [Gap decorations: Now available in Chromium](https://developer.chrome.com/blog/gap-decorations-stable)
  - [CSS Gap Decorations Module Level 1](https://www.w3.org/TR/css-gaps-1/)
  - [CSS WG: CSS Gap Decorations Level 1 Updated Working Draft](https://www.w3.org/blog/CSS/2026/03/06/css-gap-decorations-level-1-updated-working-draft/)
  - [MDN: CSS gaps](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Gaps)
  - [MDN browser-compat-data: row-rule](https://chromium.googlesource.com/external/github.com/mdn/browser-compat-data/+/1c8d7073c8173fdc9c716517b7a21dc459afe3f0/css/properties/row-rule.json)

## Objective

同一の Grid/Flex マークアップについて、従来の `border` + `nth-child` 実装と CSS Gap Decorations 実装をヘッドレス Chromium で比較する。960 px と 480 px での見た目、末尾線、CSS の行数・セレクタ数、feature detection、computed style、要素座標を機械的に保存し、`@supports` による progressive enhancement も確認する。

仕様全体や全ブラウザの互換性を証明する実験ではない。対象は Grid/Flex の基本的な区切り線と、`repeat()`、`rule-break`、`rule-inset`、`rule-visibility-items` の小さな代表例に限る。

## Hypothesis

1. Chrome 149 以降では `CSS.supports("row-rule", "1px solid red")` と `CSS.supports("column-rule", "1px solid red")` が真になり、Grid/Flex の gap 内に線を描画できる。
2. Gap Decorations の有無を切り替えても、同じマークアップの container/item の `getBoundingClientRect()` は許容誤差 0.1 px 以内で変わらない。
3. 3 列から 1 列へ変わる Grid と折り返す Flex では、従来版より Gap Decorations 版のほうが viewport 固有の `nth-child` 調整を減らせ、不要な外周・末尾線を避けやすい。
4. 非対応環境でも fallback の border が既定で有効であり、`@supports` 内の新実装が適用されなくても全 item の内容と配置は失われない。

## Environment

計画作成時の読み取り専用確認結果:

- macOS 上の Node.js `v22.17.0`
- npm / npx `10.9.2`
- リポジトリに導入済みの Playwright `1.61.1`
- Playwright の bundled Chromium は利用可能、bundled Firefox/WebKit は未導入
- system Google Chrome `149.0.7827.201` は利用可能

実行時には固定値とみなさず、下記コマンドで再記録する。ユーザー名、ホームパス、環境変数一覧、ブラウザプロファイルは記録しない。

## Prerequisites

- リポジトリルートから実行する。
- `node`, `npm`, `node_modules/playwright` が既に存在すること。新規パッケージは導入しない。
- `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` または Playwright bundled Chromium のどちらかが起動できること。
- system Chrome には一時的な run-local user data directory だけを渡し、普段のプロファイルを使わない。
- ネットワーク、認証、外部サイト、手動操作は不要とする。

## Isolation directory

この検証で作成・更新するファイルは、すべて新規の `logs/run-css-gap-decorations-20260711-0622/work/` 配下に置く。`practice/` や `articles/` を含むリポジトリの他の場所は変更せず、Git コマンドも実行しない。

開始コマンド:

```bash
RUN_DIR="logs/run-css-gap-decorations-20260711-0622"
test ! -e "$RUN_DIR"
mkdir -p "$RUN_DIR/work/evidence/screenshots" "$RUN_DIR/work/tmp-profile"
cd "$RUN_DIR/work"
```

`test ! -e` が失敗したら既存ディレクトリを再利用・削除せず、実行時刻を付けた新しい `logs/run-css-gap-decorations-<YYYYMMDD-HHMM>/work/` に計画全体のパスを読み替える。

## Ordered steps and commands

### 1. 環境を記録する（10 分）

`work/` で次を実行する。絶対パスは成果物へ出力しない。

```bash
date -u '+%Y-%m-%dT%H:%M:%SZ' > evidence/start-time.txt
node --version > evidence/node-version.txt
npm --version > evidence/npm-version.txt
node ../../../node_modules/playwright/cli.js --version > evidence/playwright-version.txt
'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' --version > evidence/system-chrome-version.txt 2>&1
uname -s > evidence/os.txt
uname -m > evidence/arch.txt
```

system Chrome のバージョン取得だけが失敗した場合は `system-chrome-version.txt` に失敗を残し、bundled Chromium へ進む。Node または Playwright の読み込みが失敗した場合は停止する。

### 2. 最小 fixture と検証 runner を作る（35 分）

`work/` 配下だけに次の 3 ファイルを作る。

- `index.html`: 同一 item 構造を使う次の比較ケースを置く。
  - 6 item の responsive Grid（960 px は 3 列、480 px は 1 列）
  - 6 item の wrapping Flex（各 item の基準幅 180 px）
  - 各 layout について `.legacy` と `.modern` を並べる
  - `.legacy` は `border` と `nth-child` / media query で内側線を表現する
  - `.modern` は `row-rule` と `column-rule` を使い、外周 border は置かない
  - `.advanced` に `repeat(2, 1px solid #2563eb, 3px dashed #dc2626)`、`rule-break: intersection`、`rule-inset: 8px`、`rule-visibility-items: between` を別々に適用する
  - `.fallback` は border を既定値とし、`@supports (row-rule: 1px solid)` 内で border を解除して rule を有効にする
  - item には安定した `data-item`、ケースには `data-case` を付ける
- `styles.css`: `/* legacy:start */`、`/* legacy:end */`、`/* modern:start */`、`/* modern:end */` マーカーを置き、比較対象 CSS を機械集計できるようにする。色は高コントラストに固定し、animation は使わない。
- `verify.cjs`: `require('../../../node_modules/playwright')` を使う非対話 runner。system Chrome を優先し、存在しない場合だけ bundled Chromium を使う。run-local の `tmp-profile/` と headless mode を使用し、外部 URL への request が発生したら失敗させる。

`verify.cjs` は以下を JSON と PNG に保存する。

1. browser 名・実バージョンと `row-rule` / `column-rule` / `rule-inset` / `rule-visibility-items` の `CSS.supports()` 結果
2. 960 px と 480 px における全ケースの screenshot
3. 各 container/item の `getBoundingClientRect()`、item 数、可視テキスト、overflow の有無
4. modern case の rule 適用前後の rect 差（同一ページで class を切り替えて測る）
5. 対象要素の `getComputedStyle()` から、`rowRuleWidth/Style/Color`、`columnRuleWidth/Style/Color` と、ブラウザが公開する場合は advanced property の値
6. marker 間の非空・非コメント CSS 行数、セレクタ数、media query 内の補正ルール数
7. fallback case で全 item が表示され、container の幅を超えず、feature detection の結果に応じて fallback または modern rule が有効であること

runner の構文確認:

```bash
node --check verify.cjs > evidence/node-check.txt 2>&1
```

### 3. 事前ゲートを実行する（15 分）

runner に `--gate-only` を実装し、ブラウザ起動、バージョン、feature detection だけを `evidence/gate.json` へ保存する。

```bash
node verify.cjs --gate-only > evidence/gate-stdout.txt 2> evidence/gate-stderr.txt
```

合格条件は、起動した Chromium 系ブラウザが major version 149 以上で、`row-rule` と `column-rule` の両方を support すること。system Chrome が起動不能なら bundled Chromium を 1 回だけ試す。両方が不合格なら、ブラウザや依存をダウンロードせず停止し、未検証を成功扱いしない。

### 4. Grid/Flex の比較を実行する（55 分）

ゲート合格後に 1 回だけ本検証を実行する。

```bash
node verify.cjs --full > evidence/run-stdout.txt 2> evidence/run-stderr.txt
```

出力先を次に固定する。

- `evidence/results.json`: support、computed style、rect、CSS 集計、assertion 結果
- `evidence/screenshots/grid-legacy-960.png`
- `evidence/screenshots/grid-modern-960.png`
- `evidence/screenshots/grid-legacy-480.png`
- `evidence/screenshots/grid-modern-480.png`
- `evidence/screenshots/flex-legacy-960.png`
- `evidence/screenshots/flex-modern-960.png`
- `evidence/screenshots/flex-legacy-480.png`
- `evidence/screenshots/flex-modern-480.png`
- `evidence/screenshots/advanced-960.png`
- `evidence/screenshots/fallback-960.png`

画像の目視だけで合否を決めず、JSON の support、computed style、rect、overflow、item 数の assertion を必須にする。

### 5. 証拠の整合性を確認する（20 分）

```bash
node -e "const r=require('./evidence/results.json'); if(!r.summary || r.summary.failed!==0) process.exit(1); console.log(JSON.stringify(r.summary))" > evidence/assert-summary.txt
test "$(find evidence/screenshots -type f -name '*.png' | wc -l | tr -d ' ')" -eq 10
find . -type f -maxdepth 3 -print | LC_ALL=C sort > evidence/file-list.txt
date -u '+%Y-%m-%dT%H:%M:%SZ' > evidence/end-time.txt
```

Firefox/WebKit は計画作成時点で未導入のため実行しない。すでに run-local に存在することが実行時に確認できる場合だけ、追加ダウンロードなしの任意観測として同じ fallback case を実行し、必須の成功条件とは分けて `evidence/optional-engines.json` に記録する。

## Observations to capture

- 使用した browser の種類と実バージョン
- 各対象 property の `CSS.supports()` 真偽
- viewport ごとの Grid 列数、Flex の折り返し行数、末尾・外周線の有無
- legacy / modern の CSS 行数、セレクタ数、viewport 用補正数
- modern rule の on/off 前後における container/item の x, y, width, height の最大差
- legacy と modern の overflow、表示 item 数、テキスト一致
- shorthand と advanced properties の computed style（取得 API が空の場合は「未取得」とし、描画成功の証拠へ読み替えない）
- 10 枚の screenshot と全 assertion の pass/fail
- stdout、stderr、開始・終了時刻。秘密や絶対ホームパスは保存しない

## Success criteria

次をすべて満たした場合のみ成功とする。

1. Chromium major 149 以上で `row-rule` と `column-rule` の support がともに真。
2. Grid/Flex の modern case が 960 px / 480 px の両方で全 6 item を表示し、horizontal overflow がない。
3. modern rule の on/off で全 container/item rect の最大差が 0.1 px 以下。
4. `row-rule` と `column-rule` の computed width/style/color が指定値と一致する。
5. fallback case が全 item を表示し、support が真の環境では `@supports` 内の modern rule が有効になる。
6. legacy / modern の CSS 集計値、全 JSON、10 枚の screenshot が保存され、runner assertion が 0 failure。

CSS 行数が modern のほうが少ないことや、advanced properties のすべてが期待通り描画されることは観測対象だが、基本検証の成功条件にはしない。結果が仮説と異なっても、runner と証拠が完全なら「反証された観測」として記録し、成功したように書き換えない。

## Failure criteria and stop conditions

- 入力レポートで選定されたものと異なるテーマ・構文が必要になった。
- Node / Playwright が読み込めない、または system Chrome と bundled Chromium の両方が起動しない。
- browser major が 149 未満、あるいは `row-rule` / `column-rule` の support が偽。
- 外部通信、手動ブラウザ操作、認証、通常の browser profile が必要になった。
- item 欠落、overflow、rect 差 0.1 px 超過、必須 computed style 不一致、欠けた JSON/PNG がある。
- screenshot と数値証拠が矛盾し、20 分以内に fixture/runner の単純な誤りだと切り分けられない。
- 開始から 2 時間で最小 Grid の rule を数値と画像の両方で確認できない。

失敗時は stderr、gate/results JSON、得られた screenshot をそのまま残し、成功判定や推測で補完しない。

## Security and cost limits

- 費用上限は 0 円。API、SaaS、認証、クラウド資源は使わない。
- ネットワークアクセスは禁止し、依存や browser binary を追加取得しない。
- 外部 URL への browser request を runner で拒否する。fixture は inline/local asset のみを使う。
- system Chrome は headless、一時 profile、拡張機能無効で起動し、普段の profile、cookie、履歴へ触れない。
- `env`、credential file、cookie、token、ユーザー名、完全なホームパスを収集しない。
- Git の変更系・読み取り系を含め Git コマンドは実行しない。
- 再試行は system Chrome 失敗後の bundled Chromium 1 回だけ。本検証の無制限な繰り返しはしない。

## Cleanup

通常終了時は browser context/browser/server（使用した場合）を runner の `finally` で閉じ、`tmp-profile/` だけを削除する。証拠は review 用に残す。

```bash
rm -rf tmp-profile
test ! -e tmp-profile
```

検証全体を破棄する必要がある場合も、削除対象は実行時に新規作成した `logs/run-css-gap-decorations-<timestamp>/` だけとする。自動 cleanup では run directory や evidence を削除しない。

## Timebox

- 環境記録・ゲート: 25 分
- fixture / runner 作成: 35 分
- Grid/Flex と advanced/fallback 実行: 55 分
- 整合性確認・整理: 20 分
- 切り分け予備: 25 分
- 合計上限: **2 時間 40 分**

2 時間時点で最小 Grid の `row-rule` / `column-rule` を確認できなければ advanced case を打ち切る。2 時間 40 分で検証全体を停止する。

## Fallback scope

1. advanced property の computed style 取得や描画判定だけが不安定なら、advanced case を参考観測へ降格し、基本の Grid/Flex、座標不変、fallback に絞る。
2. Flex の rule 表現だけが不明確なら Grid の基本比較を完了させ、Flex は失敗証拠と制約を残す。Flex 成功を捏造しない。
3. Firefox/WebKit がない場合は導入せず、Chromium の feature detection と `@supports` fallback の確認だけにする。
4. `row-rule` / `column-rule` の基本ゲートが不合格なら範囲縮小で成功扱いせず、検証を abort する。

## Expected article takeaways

実行ログが成功条件を満たした場合、記事では次の範囲だけを扱える。

- Grid/Flex の区切り線を gap に描く最小構文と、実行 browser での実測値
- border + `nth-child` と比較した CSS 行数・補正ルール・responsive 挙動
- rule の on/off で layout rect が変わらなかったかという観測
- `repeat()`、`rule-break`、`rule-inset`、visibility のうち実際に証拠が取れた挙動
- Chrome/Edge 系での利点と、`@supports` を用いた progressive enhancement の必要性
- Firefox/Safari の対応状況は入力レポートの一次情報と実際に実行できた範囲を明確に分ける

記事の結論は execution log の観測に限定し、未実行 engine、画像だけで判断した描画、Working Draft の将来挙動を断定しない。
