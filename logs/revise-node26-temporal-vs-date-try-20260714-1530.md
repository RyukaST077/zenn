# 修正レポート: Node 26で既定になったTemporalを、Dateと同じ処理で書き比べてみた / node26-temporal-vs-date-try

## 修正の前提

- 対象記事: articles/node26-temporal-vs-date-try.md（slug リネームなし）
- レビューレポート: logs/review-node26-temporal-vs-date-try-20260714-1525.md（判定: 要修正 / blocker 0・warning 1・suggestion 3）
- 出典ログ: logs/run-node26-temporal-vs-date-20260714-1517/execution-log.md
  （+ 一次情報として workspace/01-date.mjs〜06-extra.mjs の実物コードを使用）
- 適用範囲: blocker + warning + suggestion（すべて安全・機械的に適用可能だったため全件適用）
- 修正日時: 2026-07-14 15:30
- 過去の修正レポート: なし（初回修正・ループ懸念なし）

## 結果サマリー

- 適用: blocker 0 件 / warning 1 件 / suggestion 3 件
- 未解消: 0 件
- slug リネーム: なし
- セルフチェック: SUMMARY fail=0 warn=0（check-article.sh 再実行）
- published: false のまま維持

## 修正方針

warning#1（コードと出力の不一致）は、レビューでは「出力から余分行を削る」か
「コードへ console.log を足す」の二択が提示されていた。今回は出典ログの workspace/
に実物の `.mjs` が残っており、出力行はすべて実物コードが生成したものであることが
確認できた。よって**削るのではなく、記事の抜粋コードを workspace の実物どおりに
補完して出力と一対一に対応させる**方針（分類B: ログ由来の補完）を採用した。
出力の数値・文字列自体はログと一致しており、一切改変していない。

## 適用した修正（指摘ごと）

| # | 元の指摘（重大度 / 箇所） | 分類 | 適用した修正（before → after の要点） | 素材の出典 |
|---|---|---|---|---|
| 1 | [warning] 01-date.mjs（出力に `ローカル版 : Tue Mar 03 ...` を生む console.log が無い） | B | ローカルTZ版の `d2`（`new Date('2026-01-31T00:00:00')` → `setMonth` → `d2.toString()`）ブロックを追加。月末クランプも実物どおり `targetMonth` を経由する2行に差し替え。出力5行すべてにコードが対応 | workspace/01-date.mjs 13-22行 / execution-log 132-138行 |
| 2 | [warning] 04-diff.mjs Date版（出力 `[Date] 差(日,整数): 164` を生む行が無い） | B | `console.log('[Date] 差(日,整数):', Math.floor(ms / 86400000));` を追加 | workspace/04-diff.mjs 10行 / execution-log 196-198行 |
| 3 | [warning] 04-diff.mjs Temporal版（`since()（既定）`・`minutes: 0`・`=> months: 5 days: 14`・`Instant.since(hour) ... => total days: 164.5` を生むコードが無い） | B | Temporal版を workspace 実物（`dDefault`＝既定 since、`dDays` に `minutes` 追記、`dMonths` に `=> months: days:`、`Instant.since('hour')` ＋ `total({unit:'day'})`）へ補完。出力5行すべてにコードが対応 | workspace/04-diff.mjs 16-33行 / execution-log 199-203行 |
| 4 | [suggestion] 冒頭コメント `<!-- 前提: 出典ログ ... -->`（9行目） | A | コメント行を削除（内部作業ログパスの消し忘れ防止） | 機械修正 |
| 5 | [suggestion] 06-extra.mjs 抜粋に `a` / `b` の定義が無い | B | 抜粋冒頭に `const a = Temporal.PlainDate.from('2026-07-14');` / `const b = ...('2026-01-31');` の2行を追加 | workspace/06-extra.mjs 17-18行 |
| 6 | [suggestion] 02-temporal.mjs 出力の `overflow:constrain: 2026-02-28` を生むコードが無い | B | try/catch の後に `overflow:'constrain'` を明示する `constrained` ブロックを追加 | workspace/02-temporal.mjs 20-22行 / execution-log 150-156行 |

## 削除した記述（分類C で削ったもの）

- なし（すべて分類B/A で解消。裏付けのある一次情報で補完できたため削減修正は不要）。

## 未解消の指摘

- なし。

## 警告

- なし（秘密情報・個人パスの混入なし。削除した前提コメントに内部パスが含まれていたが
  git 未コミットのドラフトのため履歴残存の懸念なし）。

## セルフチェック出力（check-article.sh）

```
== check-article: articles/node26-temporal-vs-date-try.md (slug=node26-temporal-vs-date-try) ==
[PASS] Front Matter を検出した
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=27 (12-50)
[PASS] slug は汎用語で始まっていない
[PASS] type=tech
[PASS] title あり: 41文字
[PASS] emoji あり: 🕰️
[PASS] topics 4個
[INFO] /images 参照なし (ブラウザ表示を伴わない記事なら可)
[PASS] コードフェンスが閉じている: フェンス行=62
[PASS] ::: ブロックが閉じている: 2 行
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[PASS] 秘密情報パターンの検出なし
SUMMARY fail=0 warn=0
```

## 次のアクション

- [ ] `/review-article articles/node26-temporal-vs-date-try.md` で再レビューする
- [ ] 判定が「公開可」になったら `/publish-pr` で公開準備する
