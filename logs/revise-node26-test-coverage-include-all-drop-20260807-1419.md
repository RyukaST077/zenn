# 修正レポート（2回目）: Node 26.7の--test-coverage-include-allで100%が16.95%になった / node26-test-coverage-include-all-drop

## 修正の前提

- 対象記事: `articles/node26-test-coverage-include-all-drop.md`（リネームなし）
- レビューレポート: `logs/review-node26-test-coverage-include-all-drop-20260807-1415.md`（判定: **要修正** / blocker 0・warning 1・suggestion 5）
- 出典ログ: `logs/run-node26-test-coverage-include-all-20260807-1357/execution-log.md`
  - すべて引数で明示。記事冒頭の前提コメント L9 とも一致
- 適用範囲: blocker + warning（既定）。suggestion は安全で機械的なもののみ
- slug リネーム: 不可（指摘なし）
- 修正日時: 2026-08-07 14:19
- 過去の修正レポート: `logs/revise-node26-test-coverage-include-all-drop-20260807-1414.md`（warning 4件＋suggestion 1件を適用。未解消・修正不能はゼロ）
  - 今回の warning 1 は前回スキップ／修正不能だった指摘の再来ではなく、**新規検出**。ループではない

## 結果サマリー

- 適用: blocker 0 件 / warning **1 件（全件）** / suggestion 1 件
- 未解消: 0 件
- スキップ: suggestion 4 件（任意・記事の主旨に関わらないため）
- slug リネーム: なし
- `published: false` 維持: **OK**
- セルフチェック: `SUMMARY fail=0 warn=0`（前回と同じ。今回の修正は本文1文の書き換え2箇所のみでフェンス数等に変化なし）

## 適用した修正（指摘ごと）

| # | 元の指摘（重大度 / 箇所） | 分類 | 適用した修正（before → after） | 素材の出典 |
|---|---|---|---|---|
| W1 | warning / 「`--test-coverage-exclude` を1つ足したら、カバレッジが上がった」L387 / L420 | C（ログ由来の事実への寄せ） | L387 before:「除外を追加すれば分母が減るので数字は上がるか、少なくとも下がらない、くらいに思っていました。」→ after:「除外を足せばカバレッジの対象が1本減るので、数字も下がると思っていました。」 L420 の結び（「『除外を足したらカバレッジが上がった』は直感に反する」）は**変更せず維持**。レビューの選択肢 (a) を採用 | `execution-log.md` フェーズ4-1(b)「**予想外の結果。カバレッジが下がるどころか 28.30% に上がった**」／詰まった点表#3「カバレッジが**下がるどころか** 16.95% → 28.30% に上がった」「直感に反する挙動」。筆者の当初の見立ては「下がる」だったとログに明記されているため、記事側の予想をログに合わせるほうが捏造にならない（(b) の書き換えは L420 の「直感に反する」を筆者の別の感想に置き換えることになり、ログの記述から離れる） |
| S1 | suggestion / 「どんなプロジェクトで効きそうか」L502 | A（機械修正） | before:「`run()` API から使う場合、CLI と結果が一致するかは確認できました（…）」→ after:「`run()` API から使う場合、挙動としては CLI と一致していました（…）」。両義的な「確認できました」を言い切りに変更し、直後の括弧書き（数値のずれは `runner.mjs` 自身が対象に入ったため）と噛み合わせた | `execution-log.md` 3-5「26.7.0 の `run()` は CLI と同じくテスト無し3ファイルを 0% で出す」／L383 で記事内でも既に「挙動としては同じで、ずれは実行スクリプト自身が対象に入ったせい」と述べており、記述の重複ではなく整合 |

## 削除した記述（分類C で削ったもの）

なし。W1 はログの記述に沿った**書き換え**であり、削除は発生していない。

## スキップした指摘（suggestion / 任意）

| # | 指摘 | スキップ理由 |
|---|---|---|
| S2 | 冒頭にヘッドライン数値の比較表を置く | 記事構成の変更にあたり、指摘の無い箇所への手入れになる。前回（S3）と同じ理由で見送り。結論の数値（100.00% → 16.95%）は title と L15 で既に冒頭に出ている |
| S3 | 再現手順末尾の `:::message`（絶対パスが漏れない話）を箇条書きに溶かす | 事実は正しく、公開安全・事実性に影響しない体裁の好み。前回（S1）と同じ理由で見送り |
| S4 | topics を `ci` / `node` に寄せる | 流入最適化の提案で、公開可否に影響しない。現行 `nodejs` / `testing` / `coverage` / `nodetest` も内容と整合。前回（S4）と同じ |
| S5 | 冒頭の前提コメント `<!-- 前提: ... -->` を削除 | `review-article` / `revise-article` が出典ログを辿るために使うパイプライン内部メタ。今回もレポート・ログの特定に使用した。公開直前（`/publish-pr`）の判断に委ねる。前回（S5）と同じ |

## 未解消の指摘

なし（blocker 0・warning 1 すべて適用済み）。修正不能の指摘もなし。

## 警告

- なし。秘密情報・個人パスの検出は修正前後ともゼロ。

## セルフチェック出力（check-article.sh）

```
== check-article: articles/node26-test-coverage-include-all-drop.md (slug=node26-test-coverage-include-all-drop) ==
[PASS] Front Matter を検出した
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=37 (12-50)
[PASS] slug は汎用語で始まっていない
[PASS] type=tech
[PASS] title あり: 53文字
[PASS] emoji あり: 📉
[PASS] topics 4個
[INFO] /images 参照なし (ブラウザ表示を伴わない記事なら可)
[PASS] コードフェンスが閉じている: フェンス行=70
[PASS] ::: ブロックが閉じている: 4 行
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[PASS] 秘密情報パターンの検出なし
SUMMARY fail=0 warn=0
```

## 次のアクション

- [ ] `/review-article articles/node26-test-coverage-include-all-drop.md` で再レビューする
- [ ] 判定が「公開可」になったら `/publish-pr` で `published: true` にして PR を作る
