# 検証ログ: JSなしでツールチップ/ポップオーバーを CSS Anchor Positioning で作ってみた

> Zenn記事の素材。実行の一次情報（コマンド・エラー全文・所要時間・スクショ）を記録。
> 記事本文は未執筆。「記事への写像」を見て articles/*.md に展開する。

## 実行の前提（採用した前提）

- 対象タスク: `practice/practice-css-anchor-positioning-20260710-0405.md`
- 出典レポート: `research/search-topic-20260710-0400.md`
- 対象技術: CSS Anchor Positioning（`anchor-name` / `position-anchor` / `anchor()` / `position-area` / `anchor-center` / `position-try-fallbacks` / `anchor-scope`）
- 実行者: AIエージェント単独（非対話）
- 実行日時 / 所要時間: 2026-07-10 04:07 / 見積もり 約4h（人間想定）→ 実測 約17分（AI単独）
- 実行環境: macOS（Darwin 25.5.0）/ Node v22.17.0 / Playwright 1.61.1 / Chromium 149.0.7827.55
- 採用した撤退ライン: 1タスクで30分以上詰まったら記録してスキップ or 等価手段に切替（対象タスクの既定）。加えて「`position-try-fallbacks` が Chromium でも安定しないなら基本配置＋@supports まで」。→ 実際は Chromium 149 で安定動作したため撤退不要。
- 判断方針: 引数は対象タスクパスのみ。時間・撤退ラインはデフォルト前提を採用。ブラウザ確認はすべて Playwright(Chromium) スクショで自動判定。

## 結果サマリー

- 完了条件の判定: **達成**（3条件すべてクリア。下表参照）
- 作ったもの: CSS Anchor Positioning だけで動く 3UI（anchor()ツールチップ / position-area版 / flip-inline 端フォールバック）＋各検証用HTML。→ `workspace/`（`index.html` が3UI統合の成果物）
- スクショ: 12 枚（`screenshots/`）
- 詰まった点: 4 件（うち解決 4 / 未解決・撤退 0）
- knowledge 記録: `knowledge/2026-07-10-css-anchor-position-try-fallbacks-containing-block.md`

## 完了条件の検証

| # | 完了条件 | 判定 | 根拠（ログ / スクショ） |
|---|---|---|---|
| 1 | ツールチップがアンカー（ボタン）に対し意図した位置（直下・中央）に表示される | 達成 | `02-tooltip-ok.png`（直下・左揃え）/ `06-position-area-3ways.png`（下・中央）/ 実測: tip1 はボタン左端に整列、tip2 はボタン中央に整列 |
| 2 | ボタンを画面端に寄せるとフォールバックで反対側に回り込み、ビューポートからはみ出さない | 達成 | `07-fallback-before.png`（right=1006, vw=800 をはみ出し）→ `08-fallback-after.png`（`flip-inline` で left へ回り込み right=667, 収まる）。数値は commands.log |
| 3 | `@supports (anchor-name: --x)` フォールバックを入れ、非対応環境でも崩れない | 達成 | `09-supports.png`（静的フォールバック＋anchor分岐）/ `CSS.supports('anchor-name: --x') = true`（Chromium 149）を commands.log に記録 |

## タスク実行ログ（フェーズ別）

### フェーズ1: 事前調査（見積もり30分 → 実測 約3分）

- [x] MDN の各プロパティ役割を1行ずつ書き出し
  - 参照: MDN「Using CSS anchor positioning」/「anchor-name」（WebFetch で取得）
  - 分かったこと（一次情報）:
    - `anchor()` は **length を返す関数**（"returns a length value"）。`top`/`left` などの inset プロパティで使う。`margin` 用は `anchor-size()` の方。
    - 同名 `anchor-name` が複数あると positioned 要素は **"the last anchor element in the source order"** に紐づく。`anchor-scope` でスコープを切れる。
- [x] Baseline / 対応状況を確認
  - `anchor-name` の Baseline 表記（原文）: **"Baseline 2026 * Newly available"**
  - 但し書き（原文）: **"Some parts of this feature may have varying levels of support."**
  - 記事に使える一次引用として `workspace/notes.md` に保存。

### フェーズ2: 環境構築（見積もり40分 → 実測 約2分）

- [x] 作業ディレクトリ作成・`git init`・最小HTML雛形
  - 実行したコマンド:
    ```bash
    mkdir -p logs/run-css-anchor-positioning-20260710-0407/{workspace,screenshots}
    cd logs/run-css-anchor-positioning-20260710-0407/workspace && git init -q
    ```
- [x] Playwright / Chromium バージョン確認（既存インストール済みを使用）
  - 出力:
    ```
    Version 1.61.1
    Chromium version: 149.0.7827.55
    ```
  - 補足: `npm i -D @playwright/test` / `playwright install` は既に導入済みだったため再DL不要（ネットワーク待ちなし）。
- [x] スクショ取得スクリプト `shot.mjs` を作り `file://` で1枚撮れることを確認
  - 実行したコマンド:
    ```bash
    node shot.mjs index.html ../screenshots/00-skeleton.png
    ```
  - 出力:
    ```
    [index.html] CSS.supports = {"anchorName":true,"positionAnchor":true,"anchorFn":true,"positionArea":true,"positionTryFallbacks":true,"anchorScope":true}
      -> saved ../screenshots/00-skeleton.png
    ```
  - つまずき対策: `file://` は `path.resolve` で絶対URL化し、`waitUntil: 'load'` を指定（真っ白対策）。→ 一発で描画。
  - スクショ: `screenshots/00-skeleton.png`

### フェーズ3: 実装・検証【本編】（見積もり110分 → 実測 約7分）

- [x] ツールチップを anchor() で実装（見積もり30分 → 実測 約2分）
  - まず**わざと失敗版**（`margin-top: anchor(bottom)`）を作成しスクショ→効かないことを確認。
    - `01-tooltip-fail.html`: ツールチップがボタン左端に整列せず、位置がずれる。→ `01-tooltip-fail.png`
  - 修正版（`top: anchor(bottom); left: anchor(left);`）でボタン直下に正しく配置。→ `02-tooltip-ok.png`
  - つまずいた理由: `anchor()` は length を返すので inset プロパティで使う。margin では無効（宣言が落ちる）。
- [x] `anchor-side` 上下左右4パターン（見積もり20分 → 実測 約1分）
  - 4アンカーを別名にして top/right/bottom/left へ出す4パターンを1画面に。→ `03-anchor-sides.png`（全方向 期待どおり）
  - 追加検証（詰まりポイント表#2の裏取り）: `top: anchor(left)` の**軸ミスマッチ**を実装。
    - 実行:
      ```bash
      node probe.mjs 04-anchor-side-mismatch.html
      ```
    - 出力（全文）:
      ```
      button box: {"x":208,"y":208,"width":89.328125,"height":41}
      tip box   : {"x":297.328125,"y":249,"width":245.46875,"height":32}
      computed top: 249px
      computed left: 297.328px
      ```
    - 結果: **エラーは出ず**、computed top が 249px（ボタン下端）に静かに解決され意図と違う位置へ。→ `04-anchor-side-mismatch.png`
- [x] `position-area` 版で書き換え・比較（見積もり30分 → 実測 約2分）
  - anchor()版 / `position-area: bottom center` 版 / `justify-self: anchor-center` 版の3種を横並び。→ `06-position-area-3ways.png`
  - 記述量: anchor()版=3宣言（top/left/margin）、position-area版=2宣言（position-area/margin）。
  - 幅の挙動: position-area は箱がアンカーのグリッド幅方向に広がる／anchor-center は max-content 幅のまま中央寄せ。
- [x] 画面端フォールバック（見積もり30分 → 実測 約5分 ← 唯一詰まった）
  - 実行（数値確認）:
    ```bash
    node -e "...getBoundingClientRect().right を before/after で比較..."
    ```
  - 出力（全文）:
    ```
    06-fallback-before.html left= 782 right= 1006 → はみ出し
    07-fallback-after.html left= 443 right= 667 → 収まる
    ```
  - 詰まり→解決は「詰まった点」表#3 参照。→ `07-fallback-before.png` / `08-fallback-after.png`

### フェーズ4: 深掘り・比較（見積もり30分 → 実測 約3分）

- [x] `@supports` 分岐 + `CSS.supports` ログ
  - 実行:
    ```bash
    node -e "...page.evaluate(() => CSS.supports('anchor-name: --x'))..."
    ```
  - 出力:
    ```
    CSS.supports(anchor-name: --x) = true
    Chromium version: 149.0.7827.55
    ```
  - 静的フォールバック（`top:100%; left:0`）＋anchor分岐を実装。→ `09-supports.png`
- [x] 同名 anchor-name の落とし穴（詰まりポイント表#4の裏取り）
  - 共通 relative にフラット配置すると両tipが最後のボタンに吸着（カードA のtipが消える）／各カードを relative で包むと解決。→ `10-anchor-scope.png`
- [x] Floating UI/Popper 比較メモ（`workspace/notes.md` の「比較メモ」節）
  - JS版で必要: 依存追加・`computePosition`・`autoUpdate()` によるスクロール/リサイズ監視・クリーンアップ。
  - CSS版で不要: JS依存ゼロ・監視ゼロ・`flip()` 相当が `position-try-fallbacks: flip-inline` の1宣言。
  - 残る手間: `@supports` フォールバック必須／containing block 依存の詰まり。

### フェーズ5: 振り返り・記事化準備（見積もり30分 → 実測 込み）

- [x] 詰まった点の棚卸し（下表）
- [x] 記事への写像を実績で更新（下記）

## 詰まった点と解決過程（記事の核）

| # | 詰まった点 | 原因 | 効いた対処 | 所要 | 解決/撤退 | 記事での活かし方 |
|---|---|---|---|---|---|---|
| 1 | `anchor()` を書いても要素が意図の位置に揃わない | `anchor()` は length を返す関数。`margin` に書くと宣言が無効化され効かない | `top`/`left` などの inset プロパティに移す | 約1分 | 解決 | 失敗CSS(`01`)と修正後(`02`)を並べ「新人が最初にハマる誤解」 |
| 2 | `anchor-side` を変えても想定と違う位置、しかもエラーが出ない | `top` に `anchor(left)` の軸ミスマッチ。例外にならず computed が別値(249px)に静かに解決 | inset プロパティと anchor-side の軸を合わせる（`top` には `bottom`/`top`） | 約1分 | 解決 | 「エラーが出ないから気づきにくい」落とし穴。`04` + computed値ログ |
| 3 | `position-try-fallbacks: flip-inline` が発火せず端ではみ出したまま／逆にはみ出す before を作れない | フォールバックのはみ出し判定・position-area の自動クランプが **containing block 依存**。小さな positioned 祖先だと判定が壊れ、`position-area`+`fixed` は常に収まってしまう | positioned 祖先を作らず（ICB基準）**明示 inset**（`left: anchor(right)`）で本当にはみ出す before を作る→ `flip-inline` で回り込み | 約5分 | 解決 | 記事の山場。before/after 2枚(`07`/`08`)＋数値(right 1006→667)。knowledge にも記録 |
| 4 | 同名 `anchor-name` を繰り返すと全ツールチップが最後の1つに吸着 | positioned 要素は「acceptable anchor の中でソース順最後」のアンカーに紐づく | 各コンポーネントを自前の `position: relative` で包み containing block を分離（or `anchor-scope`） | 約2分 | 解決 | 「コンポーネントを繰り返すと壊れる」実務ハマり。`10` の NG/OK 比較 |

> 予測（詰まりポイント表）との差分: #1・#2・#4 はほぼ予測どおり。#3 は予測（「Baseline のばらつきで flip が効かない」）とは**原因が違い**、実際は「Baseline/対応の問題ではなく containing block 依存」だった（Chromium 149 では機能自体は安定）。この差分こそ記事の価値。

## スクリーンショット一覧

| ファイル | 何を示すか | 使う見出し |
|---|---|---|
| screenshots/00-skeleton.png | 最小HTML雛形（配置なし） | 4. 最小サンプル |
| screenshots/01-tooltip-fail.png | `margin: anchor()` 失敗版（揃わない） | 6. 詰まった点(#1) |
| screenshots/02-tooltip-ok.png | inset で直下配置した成功版 | 4. 最小サンプル / 6. 詰まった点(#1) |
| screenshots/03-anchor-sides.png | anchor-side 上下左右4パターン | 5. 実際に試したこと |
| screenshots/04-anchor-side-mismatch.png | 軸ミスマッチで黙ってズレる | 6. 詰まった点(#2) |
| screenshots/05-position-area.png | position-area 版（2way、初期） | 5. 実際に試したこと（予備） |
| screenshots/06-position-area-3ways.png | anchor()/position-area/anchor-center 比較 | 5. 実際に試したこと |
| screenshots/07-fallback-before.png | 端でポップオーバーがはみ出す（前） | 6. 詰まった点(#3) |
| screenshots/08-fallback-after.png | flip-inline で回り込む（後） | 6. 詰まった点(#3) |
| screenshots/09-supports.png | @supports 分岐つきツールチップ | 9. どんな人向きか |
| screenshots/10-anchor-scope.png | 同名 anchor-name の NG/OK | 6. 詰まった点(#4) |
| screenshots/11-index-combined.png | 3UI 統合の成果物 index.html | 5. 実際に試したこと / まとめ |

## 記事への写像（実績で埋める）

| 記事の見出し | 使う記録 / スクショ | 書くこと（メモ） |
|---|---|---|
| 1. はじめに | 対象タスク前提 / notes.md 冒頭 | JS の位置計算に苦労した動機、CSSだけで3UIを試した |
| 2. なぜCSSだけで配置したいのか | notes.md「Floating UI 比較メモ」 | 監視・再計算・依存の面倒さ（autoUpdate 等） |
| 3. 事前に調べたこと（Baseline状況） | フェーズ1記録 / notes.md 引用 | "Baseline 2026 * Newly available" と "some parts ... varying levels of support" 原文 |
| 4. 最小サンプル | フェーズ2・3a / `00`,`02` | 単一HTML雛形と最初のツールチップCSS（inset版） |
| 5. 実際に試したこと（配置バリエーション） | フェーズ3b/3c / `03`,`06`,`11` | anchor-side 4種、anchor()版 vs position-area版の記述量・幅比較 |
| 6. 詰まった点（ブラウザ差・はみ出し） | 「詰まった点」表 / `01`,`04`,`07`,`08`,`10` | 4つの詰まりとフォールバック前後スクショ＋数値 |
| 7. 分かったこと | フェーズ5棚卸し | inset必須・containing block 依存・記述量比較の結論 |
| 8. Floating UI比較 | notes.md「比較メモ」 | 依存ゼロ・監視ゼロ vs ライブラリ＋監視コード |
| 9. どんな人向きか | フェーズ4 @supports / `09` | Chromium 前提・@supports フォールバック必須の線引き |
| 10. まとめ | 結果サマリー | 向いている人・次にやること |

## 未達・撤退した項目

- なし（全フェーズ達成。完了条件3つすべてクリア、撤退ラインには到達せず）。

## 再現性メモ（記事に転記する用）

- OS / ランタイム / 主要ライブラリ: macOS（Darwin 25.5.0）/ Node v22.17.0 / Playwright 1.61.1 / Chromium 149.0.7827.55
- 最短の再現手順:
  1. `npm i -D playwright && npx playwright install chromium`
  2. `workspace/` の各HTML（`index.html` ほか）を用意
  3. `node shot.mjs <html> <out.png> [WxH]` で `file://` を開いてスクショ＋`CSS.supports` ログ
  4. はみ出し検証は `getBoundingClientRect().right > viewportWidth` を数値で確認
- 注意点（ハマりどころ）:
  - `anchor()` は inset プロパティ限定（margin 不可）。
  - `position-try-fallbacks` / `position-area` の挙動は **containing block 依存**。`fixed`/`absolute`/ラッパの `relative` で結果が変わる。はみ出し検証は「本当にはみ出しているか」を数値で担保してから判定する。
  - 同名 `anchor-name` は containing block を分けないと最後のアンカーへ吸着する。
  - Baseline 2026「newly available」＋「一部機能はばらつき」→ `@supports (anchor-name: --x)` フォールバック前提。本検証は Chromium 149 のみで確認（Safari/Firefox は未検証）。

## 次のアクション（記事化）

- [ ] この execution-log.md の「記事への写像」に沿って `articles/<slug>.md` を作成する（`/draft-article`）
- [ ] スクショを Zenn 用に `images/<slug>/` へ移し `![](/images/<slug>/..)` で参照する（記事化担当）
- [ ] 完了条件・詰まった点（特に#3の containing block）・Floating UI 比較を本文に落とす
