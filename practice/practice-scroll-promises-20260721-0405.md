# 実践タスク: スクロール完了を Promise で待つ（Programmatic Scroll Promises / Chrome 150）を setTimeout / scrollend と書き比べ、resolve タイミングのズレまで測る

## このタスクの前提

- 出典レポート: `research/search-topic-20260721-0400.md`
- 元テーマ: テーマ#1（レポートの「最初に試すべき1本」）
- 対象技術: Programmatic Scroll Promises（`window.scrollTo()` / `element.scrollBy()` / `element.scrollIntoView()` が返す Promise。Chrome / Edge 150+）
- 記事の方向性（記事タイプ）: 書き比べ + 検証ログ（「試してみた」「詰まった点をまとめた」）
- 想定筆者 / 想定読者: Web系の新人エンジニア / 新人〜実務2年目のフロントエンド（`scrollend` や `setTimeout` で「スクロール後に処理」を書いた経験がある層）
- 検証に使える想定時間: 半日（約3.5時間）を基準に配分（深掘りを削れば1〜2時間でも成立）
- 判断方針: 引数は対象レポートのパスのみ指定。テーマ・時間・スキルレベルは未指定のため、レポートの推奨1本＋デフォルト前提（新人 / 半日〜1日）を採用。手順は 2026-07 時点の一次情報（web.dev / ICS MEDIA / Chromium issue #41406914 / MDN）で裏取り済み。
- 実行環境の担保: **AIエージェント単独で完結できる**。ローカルの静的HTML＋Playwright（Chromium/Chrome）だけで、配信・スクロール操作・計測・スクショまで自動化できる。課金・サインアップ・手動デプロイ・手動ブラウザ操作は一切不要。テーマの置き換えは行っていない。
  - **唯一の実行リスク**: 対象APIは Chrome/Edge **150+** 限定。Playwright 同梱ブラウザのバージョンが 150 未満だと API 自体が無い（フェーズ2でフィーチャ検出し、150 未満なら `channel: 'chrome'` でローカル導入済みの Chrome 150 を使うか、「未対応で止まった記録」に切り替える）。これ自体が記事の山場になる。

## 完成イメージ（成果物）

- 作るもの: `scroll-promises-lab/` という最小リポジトリ。中身は
  1. 縦長でアンカー（`#sec1`〜`#sec5`）付きの静的HTML 1枚（`public/index.html`）
  2. Playwright スクリプト 1本（`measure.mjs`）。3手法（**scroll promise `await` / `scrollend` / `setTimeout`**）で「スクロール開始→完了検知」までの経過時間と、検知した瞬間の `scrollY` を計測し、比較表（JSON + Markdown）とスクショを出力する
- 「できた」と言える完了条件:
  - `node measure.mjs`（または `npx playwright ...`）が最後まで走り、`out/result.md` に **3手法 × (経過ms / 検知時の scrollY / 最終 scrollY / コード行数)** の比較表が出力される
  - `out/*.png` に各手法の最終スクロール位置のスクショが残る
  - `scrollIntoView()` の Promise が「スクロール完了前に resolve するか」を、resolve 時 `scrollY` と 300ms 後の `scrollY` の差分で判定した結果がログに残る（差が大きければ early-resolve を観測＝記事の核）
- 完了確認の方法: Playwright スクショ（`out/*.png`）＋ CLI 標準出力＋ `out/result.md` の3点。すべて機械生成で人手確認不要。
- 記事タイトル案（そのまま使える形）:
  1. スクロール完了を `await` で待てるようになったので、setTimeout / scrollend と書き比べてみた
  2. Chrome 150 のスクロール Promise を試したら、scrollIntoView だけ完了前に resolve した記録
  3. 新人が「スクロール終わったら実行」を3つの書き方で計測して比べてみた

## 事前準備チェックリスト

- [ ] 認証・APIキー: **不要**。課金・サインアップ・トークンは一切使わない（ローカル完結）
- [ ] ローカル環境（言語・ランタイム・バージョン）: Node.js 20+ 推奨（`node -v` で確認）。macOS を想定（他OSでもコマンドはほぼ同じ）
- [ ] インストールするもの: `playwright`（`npm i -D playwright` ＋ `npx playwright install chromium`）。静的配信は Node 標準の `node:http` で自作するので追加不要（`npx serve` 等でも可）
- [ ] 無料枠 / コストの確認: すべて OSS・ローカル実行のみ。**コストゼロ**
- [ ] 記録用の準備: `scroll-promises-lab/out/`（スクショ・計測結果）と、リポジトリ直下 `logs/run-*/`（実行ログ）を置き場にする
- [ ] **要確認**: Playwright 同梱 Chromium が Chrome 150 相当か（`npx playwright --version` と、起動後 `navigator.userAgent` のメジャーバージョンをフェーズ2で確認）。150 未満なら `channel: 'chrome'` でローカル Chrome を使う準備をする

## 実践タスク（フェーズ別）

### フェーズ1: 事前調査（目安: 30分）

- [ ] web.dev / ICS MEDIA / MDN で「scroll promise の resolve 値」を確認する（目安: 15分）
  - 押さえること: 対象メソッドは `scroll()` / `scrollTo()` / `scrollBy()` / `scrollIntoView()`。resolve 値は **`{ interrupted: boolean }`**（別のプログラム的スクロールに割り込まれると `interrupted: true`）。対応は **Chrome / Edge 150+**。
  - 記録すること: 参照した一次情報のURLと日付、resolve 値の正確な形、「対応ブラウザ」の記述（記事の冒頭注記にそのまま使う）
- [ ] `scrollIntoView` の early-resolve 情報（Chromium issue #41406914）を確認する（目安: 15分）
  - 押さえること: ICS MEDIA が「2026-07 時点・筆者環境で `scrollIntoView()` は**スクロール完了前に resolve した**」と明記。断定せず「環境での観測」として扱う方針を決める。
  - 記録すること: issue の状態（open/議論中）、early-resolve の記述の原文、記事で「筆者環境の観測」と書くと決めたこと

### フェーズ2: 環境構築（目安: 45分）

- [ ] `scroll-promises-lab/` を作り、`npm init -y` → `npm i -D playwright` → `npx playwright install chromium` を実行する（目安: 15分）
  - 記録すること: 実行コマンド全文、`npx playwright --version`、install で出た警告やダウンロード時間、`node -v`
- [ ] 縦長の `public/index.html` を作る（`#sec1`〜`#sec5` のアンカー、各セクション高さ `100vh` 超、末尾に十分なスクロール量）（目安: 15分）
  - 記録すること: HTML の最小構成（何行で足りたか）、ページ全高（`document.body.scrollHeight`）
- [ ] Playwright で `index.html` を開き、`navigator.userAgent` とスクロール promise 対応をフィーチャ検出する（目安: 15分）
  - 検出コード例: `typeof window.scrollTo === 'function' && (window.scrollTo({top:0})?.then !== undefined)`（返り値が thenable か）。より安全には `'scroll' in caniuse` ではなく実返り値で判定する。
  - **分岐**: Chromium が 150 未満で対応なしなら → `chromium.launch({ channel: 'chrome' })` にしてローカル Chrome 150 で再検出。それも 150 未満なら「未対応で止まった記録」として詰まりポイント表に回し、`scrollend`/`setTimeout` 版だけでも計測を続ける。
  - 記録すること: 検出したメジャーバージョン、フィーチャ検出の結果（true/false）、`channel: 'chrome'` に切り替えたか、切り替え理由

### フェーズ3: 実装・検証【本編】（目安: 90分）

- [ ] 縦スクロールを「開始→完了検知」まで計測する共通ハーネスを `measure.mjs` に書く（`performance.now()` で経過ms、完了検知時の `page.evaluate(() => window.scrollY)`）（目安: 25分）
  - 記録すること: 計測の起点/終点の定義（どこを t0 にしたか）、`behavior: 'smooth'` を使ったこと、1手法あたりの試行回数
- [ ] **手法A: scroll promise `await`** を実装（`await page.evaluate(() => window.scrollTo({top: Y, behavior:'smooth'}))` で resolve を待ち、resolve 直後の `scrollY` を取る）（目安: 20分）
  - 記録すること: コード全文と行数、resolve 値（`{interrupted}`）の中身、経過ms、resolve 時 scrollY
- [ ] **手法B: `scrollend` イベント**を実装（`scrollTo` を撃ってから `page.evaluate` 内で `scrollend` を Promise 化して待つ）（目安: 20分）
  - 記録すること: コード全文と行数、`scrollend` が発火しないケースの有無、経過ms、検知時 scrollY
- [ ] **手法C: `setTimeout(_, 500)`** を実装（当て推量待ち）（目安: 10分）
  - 記録すること: コード全文と行数、500ms が長すぎ/短すぎだったか、検知時 scrollY（完了しきっているか）
- [ ] 3手法の結果を `out/result.md`（比較表）と `out/*.png`（各手法の最終位置スクショ）に出力する（目安: 15分）
  - 記録すること: 生成された比較表そのもの、スクショのファイル名と何が写っているか

### フェーズ4: 深掘り・比較（目安: 45分）

- [ ] `scrollIntoView()` の early-resolve を検証する（`el.scrollIntoView({behavior:'smooth'})` の resolve 直後 scrollY と、300ms 後 scrollY を比較。差が閾値以上なら early-resolve と判定）（目安: 25分）
  - 記録すること: resolve 時 scrollY と 300ms 後 scrollY の実測値、差分、early-resolve を観測できたか（できなければ「観測できなかった」も価値ある記録）
- [ ] early-resolve の回避策を1つ試す（例: `scrollIntoView` の代わりに要素の `offsetTop` を求めて `window.scrollTo({top, behavior:'smooth'})` の promise を待つ）（目安: 20分）
  - 記録すること: 回避策のコード、回避後の resolve 時 scrollY が最終位置と一致したか、`scrollTo` は正しく完了検知できたか

### フェーズ5: 振り返り・記事化準備（目安: 30分）

- [ ] 記録テンプレを見返し、詰まった点（バージョン壁 / scrollend 未発火 / early-resolve）を棚卸しする（目安: 15分）
- [ ] 「記事への写像」に沿って本文ドラフトの見出しを埋める（目安: 15分）

> 目安時間の合計: 約 4 時間（半日の範囲内。深掘り・振り返りを削れば約2.5時間、本編のみなら約1.5時間で成立）

## 詰まりそうなポイントと対処の指針

| # | 詰まりそうな点 | なぜ起きるか | 最初に試すこと | 記事での活かし方 |
|---|---|---|---|---|
| 1 | Playwright 同梱ブラウザが Chrome 150 未満で `scrollTo` が Promise を返さない（`.then` が `undefined`） | 対象APIは Chrome/Edge 150+ 限定。Playwright の同梱 Chromium は必ずしも最新メジャーではない（1.57+ は Chrome for Testing ベース） | フェーズ2のフィーチャ検出でメジャーバージョン確認 → `chromium.launch({ channel: 'chrome' })` でローカル Chrome 150 を使う。無ければ「未対応で止まった記録」として scrollend/setTimeout 版だけ計測 | 「新APIは実行環境のバージョン壁が最初の関門」という新人あるある。フィーチャ検出コードごと載せると実用的 |
| 2 | `scrollIntoView()` の Promise がスクロール完了前に resolve し、resolve 直後の `scrollY` が最終位置とズレる | 2026-07 時点の既知挙動（Chromium #41406914 で議論中）。ICS MEDIA も筆者環境で観測を報告 | resolve 時と数百ms後の `scrollY` を両方記録して差分を見る。`scrollTo({top: offsetTop})` に置き換える回避策を試す | 記事の核。**公式APIと実挙動のズレを実測**したログとして最も価値が高い。「筆者環境での観測」と断定を避けて書く |
| 3 | `scrollend` イベントが発火せず待ち続ける／`smooth` 未指定だと一瞬で終わり計測にならない | すでに目的位置に居る・スクロール量ゼロだと `scrollend` は発火しない。瞬間スクロールだと3手法の差が出ない | 必ず `behavior:'smooth'` を付け、十分なスクロール距離を確保。`scrollend` には数秒のタイムアウトを付けフォールバックする | 「イベント方式は発火保証がなくタイムアウト対策が要る」という比較上の弱点として書ける |
| 4 | Playwright の `page.evaluate` 内 Promise の待ち方をミスり、計測が resolve を待たず先に進む | `page.evaluate(async () => { await window.scrollTo(...) })` のように **evaluate 内で await** しないと、Playwright 側は即座に返る | evaluate 関数自体を `async` にして中で `await` する。返り値に resolve 値と scrollY を含めて取り出す | 「計測ハーネスの落とし穴」。非同期を跨ぐ計測の注意点として新人に刺さる |

## 記録テンプレ（実行中に埋める）

各タスクを実行しながら、以下を都度メモする。これがそのまま経験談の一次情報になる。

- 実行したコマンド:
- 出たエラー（全文）:
- 効いた解決方法 / 試したこと:
- 所要時間（見積もり → 実測）:
- つまずいた理由・分かっていなかった前提:
- 既存技術と比べて感じた違い（コード行数 / 正確さ / タイミング）:
- スクショを撮った箇所:
- 記事に書きたい気づき:

## 記事への写像（タスク → 見出し）

出典レポートの「記事構成案」に対応させる。実行後、右列の記録を左の見出しに流し込む。

| 記事の見出し | 対応するタスク / 記録 | 書くこと |
|---|---|---|
| 1. はじめに | 前提・完成イメージ | 「スクロール後に処理」を setTimeout で妥協してきた話。Chrome/Edge 150 限定を冒頭明記 |
| 2. なぜこの技術を試すのか | フェーズ1 | scrollend/setTimeout の不満点、await で書ける魅力 |
| 3. 事前に調べたこと | フェーズ1の記録 | resolve 値 `{interrupted}`、対応ブラウザ、early-resolve の既知情報＋一次リンク |
| 4. 環境構築 | フェーズ2の記録 | Playwright 導入、バージョン確認、フィーチャ検出（詰まり#1） |
| 5. 実際に試したこと | フェーズ3の記録 | 3手法のコードと比較表、スクショ |
| 6. 詰まった点 | 詰まりポイント表・記録テンプレ | バージョン壁 / scrollend 未発火 / evaluate の await / early-resolve |
| 7. 触ってみて分かったこと | フェーズ3・4の記録 | 計測値から言えること（await が最短コードで正確 等） |
| 8. 既存技術と比べて感じたこと | フェーズ3の比較表 | コード行数・正確さ・タイミングの3軸比較 |
| 9. どんな人に向いていそうか | フェーズ5の棚卸し | Chrome/Edge環境・SPAの画面遷移後処理 等 |
| 10. まとめ | フェーズ5 | 現状の注意（early-resolve, ブラウザ限定）と次にやること |

## 経験談として書くときのコツ

- 「新人が試した範囲」を明示し、専門家として断定しすぎない
- うまくいった点だけでなく、詰まった点（バージョン壁・early-resolve）と解決過程を書く
- 実行ログ・スクリーンショット・コードを残して貼る（`out/result.md`、`out/*.png` をそのまま活用）
- 公式ドキュメント（web.dev / MDN / Chromium issue）へのリンクを入れる
- 手順の再現性（Playwright/Chrome のバージョン・OS・`behavior:'smooth'` 前提）を明記する
- early-resolve は「筆者環境・2026-07 時点の観測」と限定して書く

## 参考リンク

- 公式ドキュメント: MDN [Window: scrollTo()](https://developer.mozilla.org/en-US/docs/Web/API/Window/scrollTo) / [Element: scrollIntoView()](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView) / web.dev「New to the web platform in June 2026」
- チュートリアル / 解説: ICS MEDIA（EN）[Await scroll completion with Programmatic Scroll Promises](https://ics.media/en/entry/260702/) / chromestatus [Programmatic scroll promise](https://chromestatus.com/feature/5082138340491264)
- 関連・既知の詰まり: Chromium issue [#41406914](https://issues.chromium.org/issues/41406914)（scrollIntoView の resolve タイミング）/ [Playwright Browsers](https://playwright.dev/docs/browsers)（同梱バージョン・`channel`）

## 想定リスク・注意点

- コスト: 無料枠すら不要（ローカルOSSのみ）。課金トリガーなし
- ライセンス / 規約: Playwright は Apache-2.0。問題なし
- セキュリティ: APIキー・秘密情報を扱わない。ログに環境固有パスを貼る場合のみ注意
- 撤退ライン: ローカルの Chrome も 150 未満でフィーチャ検出が false のままなら、scroll promise の計測は諦め、「未対応で止まった記録」＋ scrollend/setTimeout 版の比較に方針転換する（それでも1本の記事になる）。深掘り（フェーズ4）で60分以上詰まったら early-resolve は「観測を試みた記録」で切り上げる

## 次のアクション

- [ ] フェーズ1から順に着手する（`/run-practice` でこのファイルを渡す）
- [ ] 記録テンプレを埋めながら進める
- [ ] 完了条件（`out/result.md` の比較表＋スクショ＋early-resolve 判定ログ）を満たしたら「記事への写像」に沿って本文ドラフトへ展開する
