# 修正レポート: using / Symbol.dispose を try/finally と書き比べてみた（using-symbol-dispose-try-finally-compare）

## 修正の前提

- 対象記事: articles/using-symbol-dispose-try-finally-compare.md
- レビューレポート: logs/review-using-symbol-dispose-try-finally-compare-20260717-0417.md（判定: 公開不可 / blocker 1件）
- 出典ログ: logs/run-using-symbol-dispose-20260717-0409/execution-log.md
- 適用範囲: blocker + warning（+ 安全な suggestion 3件）
- slug リネーム: なし（指摘なし）
- 修正日時: 2026-07-17 04:20

## 結果サマリー

- 適用: blocker 1 件（行56・行67 の2箇所を含む個人特定情報のマスク）/ warning 0 件 / suggestion 3 件
- 未解消: 0 件
- slug リネーム: なし
- セルフチェック: SUMMARY fail=0 warn=3（残 WARN はすべて suggestion / false-positive。下記参照）
- published: false のまま維持

## 適用した修正（指摘ごと）

| # | 元の指摘（重大度 / 箇所） | 分類 | 適用した修正（before → after の要点） | 素材の出典 |
|---|---|---|---|---|
| 1a | [blocker] 行67 エラー全文にローカルパス `/Users/katayamaryuunosuke/...` | E | `file:///Users/katayamaryuunosuke/workspace/024_zenn/[eval1]:1` → `file:///Users/you/workspace/024_zenn/[eval1]:1` | レビュー指摘の具体案どおり（機械修正） |
| 1b | [blocker] 行56 `uname -a` 出力にホスト名 `katayamaryuunosukes-MacBook-Pro.local` | E | `Darwin katayamaryuunosukes-MacBook-Pro.local 25.5.0 ...` → `Darwin macbook.local 25.5.0 ...`（意味不変） | レビュー指摘の具体案どおり（機械修正） |
| 2 | [suggestion] 行1 title が78字とやや長い | A/C | `... を try/finally と同じ処理で書き比べてみた` → `... を try/finally と書き比べてみた`（63字。「同じ処理で」を削除。意味は保持） | 機械修正 |
| 3 | [suggestion] 行9 前提コメント `<!-- 前提: ... -->` の消し忘れ確認 | A | 冒頭の前提 HTML コメント1行を削除 | 機械修正 |
| 4 | [suggestion] 参考リンクがラベル＋ベアURLの別行表記 | A | 4件を `[ラベル](URL)` の Markdown リンク表記に変換（URL・ラベルは不変） | 機械修正 |

## 削除した記述（分類C で削ったもの）

- なし（事実性・完成度は blocker/warning なし。削減修正は発生していない）

## 未解消の指摘

- なし

## 警告

- ⚠ 個人特定パス／ホスト名はファイル修正で伏字化したが、対象記事はまだコミットされていない未追跡ファイル（`git status` で `??`）のため、git 履歴への残存は無い。今後コミットする版は伏字化後の内容のみ。

## セルフチェック出力（check-article.sh）

```
== check-article: articles/using-symbol-dispose-try-finally-compare.md (slug=using-symbol-dispose-try-finally-compare) ==
[PASS] Front Matter を検出した
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=40 (12-50)
[PASS] slug は汎用語で始まっていない
[PASS] type=tech
[WARN] title が長い: 63文字 (60字目安)
[PASS] emoji あり: 🧹
[PASS] topics 4個
[INFO] /images 参照なし (ブラウザ表示を伴わない記事なら可)
[PASS] コードフェンスが閉じている: フェンス行=38
[PASS] ::: ブロックが閉じている: 4 行
[WARN] プレースホルダ/空リンクの疑い (example.com / 空リンク)
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[WARN] 秘密情報の疑い [user-path] (散文か目視確認) at line 65
SUMMARY fail=0 warn=3
```

残 WARN の切り分け（すべて非 blocker）:
- `title が長い: 63文字` → 78字から短縮済み。60字目安をわずかに超えるが suggestion（誇大表現ではない）。
- `プレースホルダ/空リンクの疑い` → false-positive。本文コード内の `[Symbol.dispose]()` 等 JS 記法が `]()` にマッチしたもの（レビューレポートでも false-positive と判定済み）。
- `[user-path] at line 65` → 行65は伏字化後の `file:///Users/you/workspace/024_zenn/[eval1]:1`。実名は含まず、レビュー指摘が推奨した汎用プレースホルダそのもの。個人特定 blocker は解消済みで、この WARN は `/Users/` 文字列への機械マッチ（残置可）。

## 次のアクション

- [ ] `/review-article articles/using-symbol-dispose-try-finally-compare.md` で再レビューする
- [ ] 判定が「公開可」になったら `/publish-pr` で公開準備する
