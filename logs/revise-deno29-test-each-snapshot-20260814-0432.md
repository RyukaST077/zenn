# 修正レポート: Deno 2.9のDeno.test.each()とt.assertSnapshot()をnode:testと書き比べた / deno29-test-each-snapshot

## 修正の前提

- 対象記事: `articles/deno29-test-each-snapshot.md`（リネームなし）
- レビューレポート: `logs/review-deno29-test-each-snapshot-20260814-0430.md`（判定: 要修正 / blocker 0・warning 3・suggestion 4）
- 出典ログ: `logs/run-deno29-test-each-snapshot-20260814-0410/execution-log.md`（引数で明示指定）
- 適用範囲: blocker + warning（既定）。suggestion は安全・機械的なものに限る方針で確認した結果、適用対象なしと判断
- slug リネーム: 既定（指摘があれば可）だが、slug への指摘なし → 実施せず
- 過去の修正レポート: なし（本記事に対する `/revise-article` は初回）
- 修正日時: 2026-08-14 04:32

## 結果サマリー

- 適用: blocker 0 件 / warning 3 件 / suggestion 0 件
- 未解消: 0 件
- slug リネーム: なし
- セルフチェック: `SUMMARY fail=0 warn=2`（2件ともレビューで誤検知と判定済み。下記参照）
- `published: false` を維持

## 適用した修正（指摘ごと）

| # | 元の指摘（重大度 / 箇所） | 分類 | 適用した修正（before → after の要点） | 素材の出典 |
|---|---|---|---|---|
| 1 | warning /「はじめに」L15 — 「半分くらいが外れました」が、まとめの「6件中当たったのは2件」（＝4件外れ）と食い違う | C（記事内の事実整合に合わせて言い換え） | before:「事前に予想していたことの半分くらいが外れました」→ after:「事前に立てた予想6件のうち4件が外れました」。まとめ節の数え方（予想6件・当たり2件）と一致させた | 記事「まとめ」節 ＋ ログ「予測（詰まりポイント表）との差分」（予想6件） |
| 2 | warning /「わざと1ケースだけ落とす」L257〜260 — コードフェンスが文の途中に挟まり、日本語が「の期待値を1つだけ…」から始まる宙に浮いた段落になる | A（Markdown構造の機械修正） | before: ```ts フェンス（`])("add(%i, %i) = %i", (a, b, expected) => {`）＋「の期待値を1つだけ `99` にして実行しました。」→ after: フェンスを削除し「`add_test.ts` をコピーして、`add(-1, 1)` のケースの期待値だけ `0` → `99` に変えた `add_fail_test.ts` を実行しました。」の1文に統合 | レビューの「具体的な直し方」。ファイル名・変更内容はログ（`add_fail_test.ts` / `add(-1, 1) = 99`）と一致 |
| 3 | warning /「手書きループ版」L566〜583 — 引用に無い `test at tests_node/add_fail.test.js:13:3` を本文が「出ます」と指している | B（ログ由来の補完） | 引用ブロックの `✖ add(-1, 1) = 99` の前に、ログ原文どおり `✖ failing tests:` / 空行 / `test at tests_node/add_fail.test.js:13:3` の3行を追加。本文「ループの中の行番号まで出ます」が引用で裏付けられる状態にした | `execution-log.md` L490〜493（`logs/20b-node-loop-fail.txt` 由来の全文） |

## 適用しなかった suggestion（任意・記録のみ）

| # | 指摘 | 対応 | 理由 |
|---|---|---|---|
| 1 | title を短縮（`Deno.` / `t.` を削って約50文字に） | 見送り | レビュー自身が「実測60文字＝目安ちょうど」と判定しており、必須ではない。title 変更は記事の顔を書き換える修正で、最小修正の原則から任意適用の範囲外と判断 |
| 2 | 詰まった点の節にスクショ追加 | 見送り | レビューも「出典ログのスクショは1枚のみ（`screenshots/01-render-header.png`）で、追加は捏造になるため見送りが妥当」と明記。捏造禁止に該当 |
| 3 | 失敗版が「期待値だけ変えたコピー」である旨を1行添える | 実質対応済み（Deno 側のみ） | warning 2 の修正文で Deno 側（`add_fail_test.ts`）については明記された。Node 側（`add_fail.test.js`）への追記は指摘外の箇所への加筆になるため見送り |
| 4 | Deno ドキュメントの該当節への直リンク追加 | 見送り | 出典ログに該当 URL（アンカー付き）の記録がなく、URL を組み立てて書くと未検証リンクの追加になるため。任意指摘 |

## 削除した記述（分類C で削ったもの）

- 「わざと1ケースだけ落とす」節: `])("add(%i, %i) = %i", (a, b, expected) => {` のみを含む ```ts フェンスを削除 — 理由: 文を分断していただけで、変更内容は後続の散文（期待値を `99` に変えた）で表現できるため。削除により事実は失われていない（フェンス内容は既出の `add_test.ts` の一部）。

## 未解消の指摘

なし（warning 3件すべて適用済み）。

## 警告

- なし。秘密情報の混入・git 履歴への残存はいずれも該当なし。

## セルフチェック出力（check-article.sh）

```
== check-article: articles/deno29-test-each-snapshot.md (slug=deno29-test-each-snapshot) ==
[PASS] Front Matter を検出した
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=25 (12-50)
[PASS] slug は汎用語で始まっていない
[PASS] type=tech
[WARN] title が長い: 78文字 (60字目安)
[PASS] emoji あり: 🧪
[PASS] topics 4個
[PASS] 画像あり: /images/deno29-test-each-snapshot/01-render-header.png
[PASS] コードフェンスが閉じている: フェンス行=90
[PASS] ::: ブロックが閉じている: 4 行
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[WARN] 秘密情報の疑い [user-path] (散文か目視確認) at line 500
SUMMARY fail=0 warn=2
```

残る WARN 2件は、いずれもレビューレポート「機械チェックの WARN の切り分け」で誤検知と判定済み。

- `title が長い: 78文字` … `wc -m` のロケール依存カウント。実測60文字 → suggestion 1 に降格済み（見送り）
- `秘密情報の疑い [user-path] at line 500` … Node の警告全文の引用で、パスは `/Users/.../024_zenn/package.json` と既にマスク済み（修正前 L503 と同一行。フェンス削除で行番号が3つ繰り上がった）

なお、コードフェンス行数は 92 → 90 に減少（warning 2 のフェンス削除による。偶数のまま＝閉じている）。

## 次のアクション

- [ ] `/review-article articles/deno29-test-each-snapshot.md` で再レビューする
- [ ] 判定が「公開可」になったら `/publish-pr` で公開準備する
