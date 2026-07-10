# 公開前レビュー: JSなしでツールチップとポップオーバーをCSS Anchor Positioningで作ってみた / css-anchor-positioning-no-js-tooltip-try

## レビューの前提

- 対象記事: articles/css-anchor-positioning-no-js-tooltip-try.md
- 出典ログ: logs/run-css-anchor-positioning-20260710-0407/execution-log.md（記事冒頭コメント・引数どおり）
- レビュー日時: 2026-07-10 04:32
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準

## 判定

**判定: 要修正**

- blocker: 0 件 / warning: 1 件 / suggestion: 4 件
- 根拠（判定を決めた主な指摘）:
  - 公開安全（published:false / 秘密情報なし / slug 妥当）はすべてクリア。blocker なし。
  - 末尾に `要素材` マーカーが1件残存（未完成サイン）→ warning のため「要修正」。
  - 事実整合はログと高い整合。数値・コマンド・スクショ・結論すべて出典ログに裏付けあり。

## 最優先で直すべき指摘（上位3件）

1. [warning] 357行目（末尾 HTMLコメント） — 残存する `<!-- 要素材: Floating UI の実コード... -->` を削除する（Floating UI 節は「メモ比較」として完結しており、マーカーは消し忘れ扱い）。
2. [suggestion] 2行目（title） — 96文字（機械チェック）。誇大表現ではないが長め。「CSS Anchor Positioning でツールチップとポップオーバーをJSなしで作ってみた」等に短縮を検討。
3. [suggestion] images 配下 `00-skeleton.png` が未参照。70行目で雛形に言及しているので画像を差し込むか、`images/<slug>/` から削除する。

## 指摘一覧（重大度順）

### blocker

なし。

### warning

| # | 箇所（節/行） | 指摘 | 具体的な直し方 | 根拠 |
|---|---|---|---|---|
| 1 | 357行目（末尾コメント） | `要素材` マーカーが1件残存。未完成のサイン | `<!-- 要素材: Floating UI の実コード（今回はメモ比較のみで、JS版の実装・ベンチは未取得） -->` の行を削除。Floating UI 節（300-313行）は「メモ」として本文で完結しているので削除で問題ない | 機械チェック（要素材=1件）/ チェックリスト 3.要素材マーカー残存=warning |

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | 2行目 title | 96文字（機械チェックの60字目安超過）。誇大語（完全理解/徹底解説等）はなく内容は妥当 | 一覧やSNSでの見切れを避けられる。例:「CSS Anchor Positioning でツールチップとポップオーバーをJSなしで作ってみた」 |
| 2 | 画像（`00-skeleton.png`） | `images/<slug>/00-skeleton.png` が本文未参照の孤立画像。70行目で雛形に言及済み | 雛形スクショを70行目付近に差し込むと導入が具体化。掲載しないなら削除でディレクトリが整う |
| 3 | コードフェンスのファイル名 | HTMLファイル名とスクショ番号にオフセットがある（例: `05-position-area.html`→`06-position-area-3ways.png` / `06-fallback-before.html`→`07-fallback-before.png` / `08-supports.html`→`09-supports.png`）。出典ログの命名どおりで事実整合はOK | 番号を揃える or コードフェンス名を外すと、コードと画像の対応が読者に伝わりやすい（任意） |
| 4 | Floating UI 比較（304-311行） | `computePosition(..., { middleware: [offset(), flip(), shift()] })` 等はログの一次情報（依存追加・computePosition・autoUpdate）よりやや詳細。JS版は実装せずメモ比較 | 「実測ではなく一般的なAPIメモ」である旨を一言添えると、実践ログとの線引きがより誠実に伝わる（本文で「メモです」とは書かれており許容範囲） |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | published=false / 秘密情報なし / slug 40字・文字種OK・汎用でない・ローカル重複なし |
| Front Matter | OK | title/emoji/type(tech)/topics(4・英小文字)/published 揃う。title のみ長め(suggestion) |
| 事実性（ログ照合） | OK | 結論「3UI 動作・完了条件3つ達成・詰まり4件すべて解決」がログの結果サマリーと一致。数値・コマンド・CSS.supports 出力もログに裏付け |
| 画像 | OK | 参照10枚すべて実在。孤立画像 00-skeleton は suggestion |
| Markdown構造 | OK | コードフェンス30行(偶数)・`:::`2行で閉じ・H1乱用なし・見出し階層健全 |
| 文章品質・トーン | OK | 新人の経験談トーン。詰まった点4件を具体的に記載。環境・バージョン明記。冒頭に結論あり |
| 完成度 | 要修正 | 要素材マーカー1件残存（warning）。それ以外プレースホルダなし |

## 事実整合の照合結果（ログとの突合）

- 結論（達成/一部/未達）: 記事「3つとも JavaScript ゼロで動きました／完了条件3つすべて確認」(21,345行) ↔ ログ「完了条件の判定: 達成（3条件すべてクリア）」(19行) → **一致**
- 実行コマンド・出力の照合:
  - `CSS.supports = {...anchorScope:true}`（75行）↔ ログ69行 → 一致
  - 軸ミスマッチの computed 値 top:249px / left:297.328px（192-196行）↔ ログ91-94行 → 一致
  - フォールバック right 1006→667 / left 782→443（254-255行）↔ ログ108-109行 → 一致
  - `CSS.supports('anchor-name: --x') = true` / Chromium 149.0.7827.55（337-338行）↔ ログ122-123行 → 一致
  - 環境（macOS Darwin 25.5.0 / Node v22.17.0 / Playwright 1.61.1 / Chromium 149）↔ ログ13,187行 → 一致
- containing block が原因（予測「Baseline のばらつき」とは違った）という山場の記述（264行）↔ ログ147行の差分メモ・knowledge 記録 → 一致
- 創作の疑いがある記述: なし（Floating UI 節はメモ比較と明記。JS版未実装は要素材マーカーで開示済み）
- 残存する `要素材` マーカー: 1 件（357行 / Floating UI 実コード未取得）

## 機械チェック結果（scripts/check-article.sh）

```
== check-article: articles/css-anchor-positioning-no-js-tooltip-try.md (slug=css-anchor-positioning-no-js-tooltip-try) ==
[PASS] Front Matter を検出した
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=40 (12-50)
[PASS] slug は汎用語で始まっていない
[PASS] type=tech
[WARN] title が長い: 96文字 (60字目安)
[PASS] emoji あり: 📌
[PASS] topics 4個
[PASS] 画像あり: /images/css-anchor-positioning-no-js-tooltip-try/01-tooltip-fail.png
[PASS] 画像あり: /images/css-anchor-positioning-no-js-tooltip-try/02-tooltip-ok.png
[PASS] 画像あり: /images/css-anchor-positioning-no-js-tooltip-try/03-anchor-sides.png
[PASS] 画像あり: /images/css-anchor-positioning-no-js-tooltip-try/04-anchor-side-mismatch.png
[PASS] 画像あり: /images/css-anchor-positioning-no-js-tooltip-try/06-position-area-3ways.png
[PASS] 画像あり: /images/css-anchor-positioning-no-js-tooltip-try/07-fallback-before.png
[PASS] 画像あり: /images/css-anchor-positioning-no-js-tooltip-try/08-fallback-after.png
[PASS] 画像あり: /images/css-anchor-positioning-no-js-tooltip-try/09-supports.png
[PASS] 画像あり: /images/css-anchor-positioning-no-js-tooltip-try/10-anchor-scope.png
[PASS] 画像あり: /images/css-anchor-positioning-no-js-tooltip-try/11-index-combined.png
[WARN] 未参照の画像: /images/css-anchor-positioning-no-js-tooltip-try/00-skeleton.png -> 本文で使うか削除する
[PASS] コードフェンスが閉じている: フェンス行=30
[PASS] ::: ブロックが閉じている: 2 行
[WARN] 要素材マーカーが 1件残っている (未完成。埋めるか節を削る)
[PASS] プレースホルダ残りなし
[PASS] 秘密情報パターンの検出なし
SUMMARY fail=0 warn=3
```

補足（機械チェックの重大度調整）:
- title 96文字(WARN) → 誇大語がなく日本語として自然なため **suggestion** に緩和。
- 未参照画像 00-skeleton.png(WARN) → チェックリスト上「孤立画像は suggestion」のため **suggestion**。
- 要素材マーカー(WARN) → チェックリストどおり **warning**（唯一の要修正要因）。

## 適用した修正（修正適用時のみ）

なし（レポートのみ・非破壊）。

## 次のアクション

- [ ] warning（要素材マーカー357行の削除）を直す。余力があれば suggestion（title 短縮・00-skeleton の掲載/削除）も。
- [ ] 直したら `/review-article` で再レビューする（`/revise-article` で自動修正も可）。
- [ ] 判定が「公開可」になったら `/publish-pr` で published: true にして PR を作成 → main マージで公開
      （「サイト内で既に使用されています」が出たら slug を具体化。knowledge/2026-07-01-zenn-slug-already-used.md）
