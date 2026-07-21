# 検証ログ: スクロール完了を Promise で待つ（Programmatic Scroll Promises / Chrome 150）を setTimeout / scrollend と書き比べる

> Zenn記事の素材。実行の一次情報（コマンド・エラー全文・所要時間・スクショ）を記録。
> 記事本文は未執筆。「記事への写像」を見て articles/*.md に展開する。

## 実行の前提（採用した前提）

- 対象タスク: `practice/practice-scroll-promises-20260721-0405.md`
- 出典レポート: `research/search-topic-20260721-0400.md`
- 対象技術: Programmatic Scroll Promises（`window.scrollTo()` / `element.scrollBy()` / `element.scrollIntoView()` が返す Promise。Chrome / Edge 150+）
- 実行者: AIエージェント単独（非対話）
- 実行日時 / 所要時間: 2026-07-21 04:07〜04:11 / 見積もり 約4h → 実測 約4分（AI単独・単一試行。記事にそのまま書かない値）
- 実行環境: macOS (Darwin 25.5.0) / Node v22.17.0 / npm 10.9.2 / Playwright 1.61.1（同梱 Chromium 149.0.7827.55）/ ローカル Google Chrome 150.0.7871.125
- 採用した撤退ライン: 1タスク30分以上詰まったら記録してスキップ／等価手段へ。深掘り60分超で early-resolve は「観測を試みた記録」に切替（今回は未使用）
- 判断方針: 引数は対象タスクファイルのパスのみ。時間・スキルレベルは未指定のため practice の既定（新人 / 半日）を採用

## 結果サマリー

- 完了条件の判定: **達成**（`out/result.md` に 3手法×(経過ms/検知scrollY/最終scrollY/行数) の比較表、`out/*.png` にスクショ、early-resolve 判定ログを取得）
- 作ったもの: `scroll-promises-lab/`（静的HTML 1枚 + 静的配信サーバ + 計測 Playwright スクリプト 3本）。`workspace/scroll-promises-lab/`
- スクショ: 4 枚（`screenshots/`）
- 詰まった点: 2 件（うち解決 2 / 未解決・撤退 0）
- knowledge 記録: `knowledge/2026-07-21-playwright-bundled-chromium-lags-use-channel-chrome.md`

## 完了条件の検証

| # | 完了条件 | 判定 | 根拠（ログ / スクショ） |
|---|---|---|---|
| 1 | `node measure.mjs` が最後まで走り `out/result.md` に 3手法×(経過ms/検知scrollY/最終scrollY/行数) の比較表が出る | 達成 | `commands.log` の `node measure.mjs`（exit=0）/ `out/result.md` |
| 2 | `out/*.png` に各手法の最終スクロール位置スクショが残る | 達成 | `out/method-A.png` 〜 `method-C.png` / `screenshots/01〜03` |
| 3 | `scrollIntoView()` が完了前に resolve するかを resolve時 scrollY と 300ms後 scrollY の差で判定した結果がログに残る | 達成 | `out/intoview.md` / `out/intoview.json`（差=958px, early-resolve=はい）|

## タスク実行ログ（フェーズ別）

### フェーズ1: 事前調査（見積もり 30分 → 実測 数分）

- [x] resolve 値・対応ブラウザ・early-resolve の一次情報を確認
  - 確認できたこと（一次情報）:
    - resolve 値は `{ interrupted: boolean }`。別のプログラム的スクロールに割り込まれると `interrupted: true`（web.dev / ICS MEDIA / MDN）
    - 対応は **Chrome / Edge 150 以降**（2026-07 時点）
    - ICS MEDIA（EN, 2026-07-02）: 「As of July 2026, in the author's environment, `scrollIntoView()` resolved its `Promise` before scrolling had completed.」→ **early-resolve は「筆者環境の観測」として扱う**方針を採用
    - Chromium issue #41406914「Scrolling APIs should return a promise」で議論中
  - 参照 URL:
    - MDN Window.scrollTo() https://developer.mozilla.org/en-US/docs/Web/API/Window/scrollTo
    - MDN Element.scrollIntoView() https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView
    - ICS MEDIA (EN) https://ics.media/en/entry/260702/
    - chromestatus https://chromestatus.com/feature/5082138340491264
    - Chromium issue https://issues.chromium.org/issues/41406914
  - 記事に書きたい気づき: 「新APIは resolve 値の形（`{interrupted}`）と対応ブラウザ（150+）を冒頭で明記する」。early-resolve は断定せず「観測」で書く

### フェーズ2: 環境構築とフィーチャ検出（見積もり 45分 → 実測 数分）

- [x] `scroll-promises-lab/` 作成 → `npm init -y` → `npm i -D playwright` → `npx playwright install chromium`
  - 実行したコマンド:
    ```bash
    mkdir -p scroll-promises-lab && cd scroll-promises-lab
    npm init -y && npm i -D playwright && npx playwright install chromium
    ```
  - 出力（要点。全文は commands.log）:
    ```
    added 2 packages, and audited 3 packages in 5s
    found 0 vulnerabilities
    exit=0
    Version 1.61.1   # npx playwright --version
    ```
  - つまずいた理由・前提: Playwright 同梱 Chromium は **149.0.7827.55**（`node_modules/playwright-core/browsers.json` の browserVersion）。対象APIは 150+ なので**同梱ブラウザでは動かない**ことがこの時点で判明
- [x] 縦長 `public/index.html` 作成（`#sec1`〜`#sec5`、各 `min-height:120vh`）
  - できたこと: 33行で足りた。ページ全高 `document.body.scrollHeight = 4800px`（viewport 800px）
- [x] `navigator.userAgent` とフィーチャ検出（`detect.mjs`）
  - 実行したコマンド:
    ```bash
    node detect.mjs        # 同梱 Chromium
    node detect.mjs chrome # channel: 'chrome' でローカル Chrome
    ```
  - 出力（全文）:
    ```
    ## detect bundled
    {
      "channel": "bundled",
      "chromeMajor": "149",
      "userAgent": "...HeadlessChrome/149.0.7827.55 Safari/537.36",
      "returnType": "[object Undefined]",
      "isThenable": false
    }
    ## detect channel=chrome
    {
      "channel": "chrome",
      "chromeMajor": "150",
      "userAgent": "...HeadlessChrome/150.0.0.0 Safari/537.36",
      "returnType": "[object Promise]",
      "isThenable": true
    }
    ```
  - 効いた対処: `chromium.launch({ channel: 'chrome' })` でローカル Chrome 150 を使用。フィーチャ検出は `const r = window.scrollTo({top:0}); !!(r && typeof r.then==='function')` で「実返り値が thenable か」を判定
  - 既存技術と比べて感じた違い: 同じ Chromium 系でもメジャーが 1 違うだけで返り値が `undefined`↔`Promise` と変わる。caniuse 的な名前判定でなく**実返り値で検出**するのが安全
  - スクショ: なし（CLI 検出のため）
  - 記事に書きたい気づき: **バージョン壁が最初の関門**。フィーチャ検出コードと `channel:'chrome'` 切替をそのまま載せると実用的

### フェーズ3: 3手法の計測ハーネス（見積もり 90分 → 実測 数分）

- [x] `measure.mjs` で 3手法を計測（手法A await / 手法B scrollend / 手法C setTimeout(500)）
  - 計測の定義: `resetTop()` で `behavior:'instant'` で最上部に戻す→`t0=performance.now()`→smooth スクロール開始→各手法で完了検知→`t1`。検知時 `window.scrollY` を記録し、その後 400ms 待って「最終 scrollY」も記録。ターゲットは `#sec5`（offsetTop=3840）。**各手法1試行**
  - `page.evaluate` の落とし穴対策: evaluate 関数自体を `async` にして中で `await window.scrollTo(...)` する（そうしないと Playwright 側が即返る）
  - 実行したコマンド:
    ```bash
    node measure.mjs
    ```
  - 出力（全文）:
    ```
    [detect] channel=bundled chrome=149 未対応 → 次を試す
    [detect] 採用: channel=chrome chrome=150
    [page] {"scrollHeight":4800,"innerHeight":800,"targetY":3840}
    [method A] {"elapsed":1269.6999998092651,"detectY":3840,"finalY":3840,"resolveValue":{"interrupted":false}}
    [method B] {"elapsed":1082.4000000953674,"detectY":3840,"finalY":3840,"detectedBy":"scrollend"}
    [method C] {"elapsed":539.6000003814697,"detectY":3379,"finalY":3828}
    ```
  - 生成された比較表（`out/result.md`）:

    | 手法 | 経過ms | 検知時 scrollY | 最終 scrollY(+400ms) | コード行数 | 備考 |
    |---|---|---|---|---|---|
    | scroll promise await | 1269.7 | 3840 | 3840 | 1 | interrupted=false |
    | scrollend イベント | 1082.4 | 3840 | 3840 | 6 | 検知=scrollend |
    | setTimeout(500) | 539.6 | 3379 | 3828 | 2 | 固定待ち |

  - 既存技術と比べて感じた違い:
    - **手法A（await）**: 検知時 scrollY = 最終 scrollY = 3840 で正確。実質**1行**（`await window.scrollTo(...)`）。resolve 値で `interrupted` も取れる
    - **手法B（scrollend）**: 同じく正確に 3840 を検知。ただし発火保証がなく**タイムアウトフォールバックが要る**ぶんコードが増える（6行）。今回は `detectedBy: scrollend`（タイムアウトせず発火）
    - **手法C（setTimeout 500）**: 検知時 scrollY = **3379**（最終 3828 に未達）。**500ms では短すぎてスクロール途中で「完了」と誤検知**。当て推量の弱点が数値で出た
  - スクショ: `screenshots/01-method-a-await.png` / `02-method-b-scrollend.png` / `03-method-c-settimeout.png`（いずれも +400ms 静定後のため Section 5＝最終位置が写る。手法Cの「途中検知」は数値 detectY=3379 に表れ、スクショには出ない点は正直に記録）
  - 記事に書きたい気づき: 「await は最短コードで正確、scrollend は正確だが保険が要る、setTimeout は速いが不正確」の3軸（行数・正確さ・タイミング）が1表で言える

### フェーズ4: early-resolve 検証と回避策（見積もり 45分 → 実測 数分）

- [x] `intoview.mjs` で `scrollIntoView()` の resolve タイミングを検証
  - 実行したコマンド:
    ```bash
    node intoview.mjs
    ```
  - 出力（全文）:
    ```
    [scrollIntoView] {
      "elapsed": 2,
      "resolveY": 0,
      "after300Y": 958,
      "resolveValue": { "interrupted": false },
      "targetTop": 2880,
      "diff": 958,
      "earlyResolve": true
    }
    [workaround scrollTo(offsetTop)] {
      "elapsed": 966.0999999046326,
      "resolveY": 2880,
      "after300Y": 2880,
      "resolveValue": { "interrupted": false },
      "targetTop": 2880,
      "diff": 0,
      "earlyResolve": false
    }
    ```
  - 生成表（`out/intoview.md`）:

    | 手法 | 経過ms | resolve時 scrollY | 300ms後 scrollY | 差(px) | early-resolve? |
    |---|---|---|---|---|---|
    | `el.scrollIntoView({smooth})` | 2 | 0 | 958 | 958 | はい（完了前にresolve） |
    | 回避策 `scrollTo({top: offsetTop})` | 966 | 2880 | 2880 | 0 | いいえ（完了時にresolve） |

  - 効いた対処（回避策）: `el.scrollIntoView(...)` の代わりに `el.offsetTop` を求めて `window.scrollTo({top, behavior:'smooth'})` の Promise を await。これは resolve 時に scrollY=2880（=目標）で、300ms 後も 2880 のまま＝**完了時に正しく resolve**
  - つまずいた理由・前提: `scrollIntoView()` は **2ms で resolve**（scrollY はまだ 0＝スクロール開始前）。公式には「スクロール完了で resolve」する Promise なのに、この環境では**ほぼ即時 resolve** した。resolve 値は `{interrupted:false}` なので「割り込みで打ち切られた」わけではない点も記録
  - 既存技術と比べて感じた違い: 同じ Scroll Promise でも `window.scrollTo` は完了を待てるが `scrollIntoView` は（この環境では）待てない。**メソッドによって resolve タイミングが違う**のが最大の落とし穴
  - スクショ: `screenshots/04-intoview-workaround.png`（回避策実行後の最終位置＝#sec4）
  - 記事に書きたい気づき: **記事の核**。「公式APIの契約（完了で resolve）と実挙動（早期 resolve）のズレを実測」。ただし「2026-07 時点・この実行環境での観測」と限定し、Chromium issue #41406914 を添える

### フェーズ5: 振り返り・記事化準備（見積もり 30分 → 実測 数分）

- [x] 詰まった点の棚卸し（下表）と「記事への写像」を実績で更新（本ファイル）

## 詰まった点と解決過程（記事の核）

| # | 詰まった点 | 原因 | 効いた対処 | 所要 | 解決/撤退 | 記事での活かし方 |
|---|---|---|---|---|---|---|
| 1 | Playwright 同梱 Chromium(149) で `scrollTo` が Promise を返さない（`.then` が `undefined`、`returnType=[object Undefined]`） | 対象APIは Chrome/Edge 150+ 限定。Playwright 1.61.1 の同梱 Chromium は 149.0.7827.55 でメジャーが 1 足りない | フィーチャ検出（実返り値が thenable か）→ `chromium.launch({ channel:'chrome' })` でローカル Chrome 150.0.7871.125 を使用。detect で 149→未対応 / 150→対応 を確認 | 数分 | 解決 | 「新APIは実行環境のバージョン壁が最初の関門」。検出コード＋`channel:'chrome'` 切替をそのまま載せる |
| 2 | `scrollIntoView()` の Promise が完了前（2ms・scrollY=0）に resolve し、resolve 直後の scrollY(0) が最終位置(2880) と 958px ズレる | 2026-07 時点の既知挙動（Chromium #41406914 で議論中）。ICS MEDIA も筆者環境で観測を報告 | resolve時と300ms後の scrollY 差分で early-resolve を判定。回避策 `scrollTo({top: offsetTop})` に置換 → 差 0px で完了時 resolve を確認 | 数分 | 解決 | 記事の核。公式契約と実挙動のズレを実測。「筆者環境・2026-07 の観測」と限定して書く |

- 予測（practice の詰まりポイント表）との差分:
  - 予測どおり: #1 バージョン壁、#2 early-resolve、`page.evaluate` 内 await（対策済みで顕在化せず）
  - 予測とズレ: `scrollend` は**発火しなかったケースなし**（`detectedBy:scrollend`、タイムアウト未使用）。ただし発火保証がない点はコード上のフォールバックで担保。setTimeout は「長すぎ」を懸念していたが実測は逆に**500ms では短すぎて途中検知**だった

## スクリーンショット一覧

| ファイル | 何を示すか | 使う見出し |
|---|---|---|
| screenshots/01-method-a-await.png | 手法A(await) の最終スクロール位置（Section 5）| 5. 実際に試したこと |
| screenshots/02-method-b-scrollend.png | 手法B(scrollend) の最終位置（Section 5）| 5. 実際に試したこと |
| screenshots/03-method-c-settimeout.png | 手法C(setTimeout) の +400ms 静定後の位置（Section 5）※検知時の途中位置は数値 detectY=3379 で表現 | 5 / 6. 詰まった点 |
| screenshots/04-intoview-workaround.png | 回避策 `scrollTo(offsetTop)` 実行後の最終位置（Section 4）| 6. 詰まった点 / 7. 分かったこと |

## 記事への写像（実績で埋める）

| 記事の見出し | 使う記録 / スクショ | 書くこと（メモ） |
|---|---|---|
| 1. はじめに | 前提・完成イメージ | setTimeout で妥協してきた話。**Chrome/Edge 150 限定**を冒頭明記 |
| 2. なぜこの技術を試すのか | フェーズ1 | scrollend/setTimeout の不満点、`await` で書ける魅力（手法A=1行） |
| 3. 事前に調べたこと | フェーズ1の記録 | resolve 値 `{interrupted}`、対応ブラウザ 150+、early-resolve の既知情報＋一次リンク（MDN/ICS/chromestatus/Chromium issue）|
| 4. 環境構築 | フェーズ2の記録 / detect.mjs 出力 | Playwright 導入、同梱 Chromium 149 判明、フィーチャ検出→`channel:'chrome'`（詰まり#1）|
| 5. 実際に試したこと | フェーズ3の記録 / `out/result.md` / screenshots/01-03 | 3手法のコードと比較表、スクショ |
| 6. 詰まった点 | 「詰まった点」表 / detect 出力 / intoview 出力 | バージョン壁 / scrollIntoView early-resolve / evaluate 内 await / scrollend フォールバック |
| 7. 触ってみて分かったこと | フェーズ3・4の記録 | await が最短コードで正確 / scrollTo は完了 resolve / scrollIntoView は早期 resolve |
| 8. 既存技術と比べて感じたこと | フェーズ3の比較表 | コード行数(1/6/2)・正確さ(3840/3840/3379)・タイミングの3軸 |
| 9. どんな人に向いていそうか | フェーズ5の棚卸し | Chrome/Edge 環境・SPA の画面遷移後処理 |
| 10. まとめ | 結果サマリー | 現状の注意（early-resolve, ブラウザ限定）と次にやること |

## 未達・撤退した項目

- なし（全フェーズ達成）。撤退ラインには触れず

## 再現性メモ（記事に転記する用）

- OS / ランタイム / 主要ライブラリ: macOS (Darwin 25.5.0) / Node v22.17.0 / Playwright 1.61.1（同梱 Chromium 149）/ ローカル Google Chrome 150.0.7871.125
- 実行コマンドの並び（最短の再現手順）:
  ```bash
  mkdir scroll-promises-lab && cd scroll-promises-lab
  npm init -y && npm i -D playwright && npx playwright install chromium
  # public/index.html, server.mjs, detect.mjs, measure.mjs, intoview.mjs を配置
  node detect.mjs        # 同梱=149→未対応 を確認
  node measure.mjs       # 3手法比較 → out/result.md, out/*.png
  node intoview.mjs      # early-resolve 検証 → out/intoview.md
  ```
- 注意点:
  - 対象APIは **Chrome / Edge 150+ 限定**。Playwright 同梱 Chromium が 150 未満なら `chromium.launch({ channel:'chrome' })` でローカル Chrome を使う
  - 3手法の差を出すには **`behavior:'smooth'` 必須**＋十分なスクロール距離（今回 4800px ページ）
  - `page.evaluate` 内で `await window.scrollTo(...)` すること（evaluate 関数を async に）。しないと Playwright が即返る
  - early-resolve は「2026-07 時点・この実行環境での観測」。将来のバージョンで挙動が変わる可能性あり

## 次のアクション（記事化）

- [ ] この execution-log.md の「記事への写像」に沿って articles/scroll-promises.md を作成する（`/draft-article`）
- [ ] スクショを Zenn 用に `images/scroll-promises/` へ移し、本文から参照する
- [ ] 完了条件・詰まった点（バージョン壁 / early-resolve）・3軸比較を本文に落とす
