# 修正レポート: node26-experimental-import-text-try

## 採用した前提

- 対象記事: `articles/node26-experimental-import-text-try.md`（published: false 維持）
- レビューレポート: `logs/review-node26-experimental-import-text-try-20260713-0417.md`
- 出典ログ: `logs/run-node-text-imports-20260713-0408/execution-log.md`（記事冒頭コメントの指定と一致）
- 適用範囲: blocker ＋ warning（suggestion は安全・機械的なもののみ任意適用）
- slug リネーム: 指摘なし → リネームなし
- 修正日時: 2026-07-13 04:21

判定は「要修正」（blocker 0 / warning 1 / suggestion 3）。修正不能な指摘なし。

## 指摘ごとの適用結果

### warning

| # | 箇所 | 指摘 | 分類 | 対応 |
|---|---|---|---|---|
| 1 | Front Matter `title` (L2) | title 105文字で一覧・OGP で見切れる | C 削減修正 | **適用**。下記参照 |

**warning #1 の適用内容**

- 旧: `"Node 26.5 の text imports（--experimental-import-text）で .txt を import したら詰まった記録"`（`wc -m` で 105）
- 新: `"Node 26.5 の text imports で .txt import に詰まった"`（`wc -m` で 58、60字目安内）
- 方針: 長さの主因だった `--experimental-import-text` のパーレン部を削除。フラグ名は本文（L25, L87, L97, L343 ほか）に繰り返し登場するため、タイトルから外しても情報は失われない。経験談トーンの核である「詰まった」は残し、`.txt import` で主題を保持した。
- 注記: この環境は非 UTF-8 ロケールのため `check-article.sh` の `wc -m` はマルチバイト文字をバイト数で数える（和文1字 ≒ 3）。「60字目安」は実質バイト基準。レビュー例（`...import してみた`）だと同基準で 60 超になるため、より短い表現を採用した。捏造・意味変更はなし（削減のみ）。

### suggestion（すべて任意。今回の対応判断）

| # | 箇所 | 指摘 | 対応 | 理由 |
|---|---|---|---|---|
| 1 | 冒頭コメント (L9) | 前提コメント `<!-- 前提: ... -->` が残っている | **スキップ（保持）** | HTML コメントは Zenn のレンダリングで読者に表示されない（読者影響なし）。一方このコメントは `/review-article` が出典ログを辿る際に参照する。次工程の再レビューまで残す方が pipeline のトレーサビリティ上安全なため、意図的に保持。最終公開は `/publish-pr` が担当 |
| 2 | 比較節「v23.1.0+ で安定」(L27, L328) | 実測でなく裏取り情報。断定を緩める余地 | **スキップ** | 出典ログ L253 に `v23.1.0+（安定）` と記録があり事実整合済み。レビューも「表記は出典ログどおりで問題ない」と明記。ログ由来の正確な数値を保持する方が良く、緩めるのは任意のため未適用 |
| 3 | エラーブロック内パス (L129,188,200,225) | `/Users/.../workspace/...` と適切にマスク済み | **対応不要** | レビューが「対応不要」と明記。`.../` マスク済み・実名リークなし |

## セルフチェック結果（check-article.sh 再実行）

```
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=35 (12-50)
[PASS] type=tech
[PASS] title あり: 58文字        ← warning #1 解消（旧: 105文字で WARN）
[PASS] emoji あり: 📄
[PASS] topics 4個
[PASS] コードフェンスが閉じている: フェンス行=50
[PASS] ::: ブロックが閉じている: 4 行
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[WARN] 秘密情報の疑い [user-path] (散文か目視確認) at line 129,188,200,225
SUMMARY fail=0 warn=1
```

- title の WARN は解消（fail=0 warn=2 → warn=1）。
- 残る WARN（user-path）はレビューで切り分け済みの false positive（`.../` マスク済み・実名なし）。対応不要。
- `published: false` を維持していることを最終確認。

## 未解消・修正不能の指摘

なし（blocker 0。warning #1 は解消。suggestion は任意で、上記理由により保持/スキップ）。

## 秘密情報に関する注記

新規のマスク対応なし。エラーブロックのパスは既に `/Users/.../workspace/...` にマスク済みで、grep でも実名の混入なし。

## 次のアクション

- `/review-article articles/node26-experimental-import-text-try.md` で再レビュー。
- 公開可になったら `/publish-pr` へ。
