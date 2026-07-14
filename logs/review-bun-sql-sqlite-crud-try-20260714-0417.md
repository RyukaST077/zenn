# 公開前レビュー: Bun 1.3 の Bun.SQL で SQLite を初めて触ってみた / bun-sql-sqlite-crud-try

## レビューの前提

- 対象記事: articles/bun-sql-sqlite-crud-try.md
- 出典ログ: logs/run-bun-sql-sqlite-20260714-0406/execution-log.md
- レビュー日時: 2026-07-14 04:17
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準

## 判定

**判定: 要修正**

- blocker: 0 件 / warning: 1 件 / suggestion: 3 件
- 根拠（判定を決めた主な指摘）:
  - 個人を特定しうるローカルパス（`/Users/katayamaryuunosuke/...`）が本文コードブロック内に2箇所露出している（line 87 / line 176）。秘密情報ではないが公開前にマスクすべき個人情報のため warning。

## 最優先で直すべき指摘（上位3件）

1. [warning] 環境構築節 line 87 / 本編 line 176 — `/Users/katayamaryuunosuke/...` のホームディレクトリパス（ユーザ名込み）が露出。ユーザ名を `<user>` 等に置換するか、当該行を要点だけ（`/opt/.../bin/bun` 相当・`8192 app.db` のサイズ部分のみ）に削るかで匿名化する。
2. [suggestion] SELECT/インジェクション節 line 216・219 — 「全件(3件)」とあるが、この時点でINSERT済みは Alice の1件のみ（トランザクションでの追加は後段）。ログ由来の文言を忠実転記した結果だが読者には件数の根拠が不明。「もし文字列連結なら 0 件にならず一致してしまうはず」等、実データと整合する説明に補足するとより正確。
3. [suggestion] 冒頭 line 9 — 前提コメント `<!-- 前提: 出典ログ ... -->` が残存。公開時に消し忘れでなく意図的か確認（Zenn上は非表示だが、公開版では削除推奨）。

## 指摘一覧（重大度順）

### blocker

なし。

### warning

| # | 箇所（節/行） | 指摘 | 具体的な直し方 | 根拠 |
|---|---|---|---|---|
| 1 | 環境構築 line 87 / 本編 line 176 | 個人のホームディレクトリパス（ユーザ名 `katayamaryuunosuke` 込み）が2箇所露出 | line 87 の `/Users/katayamaryuunosuke/.nvm/versions/node/v22.17.0/bin/bun` と line 176 の `... katayamaryuunosuke  staff  8192 ... app.db` のユーザ名部分を `<user>` 等に置換、または当該出力行を要点（バージョン `1.3.14` / ファイルサイズ `8192` の生成確認）だけに絞る | check-article.sh [WARN] user-path at line 87 ＋目視（line 176 も同一パターン） |

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | line 216・219 | 「全件(3件)」の根拠がこの時点の実データ（Alice 1件のみ）と噛み合わない。ログ文言の忠実転記だが読者に不親切 | インジェクション不成立の説明を実データに合わせ、件数の混乱を避けられる |
| 2 | 冒頭 line 9 | 前提コメント `<!-- 前提: ... -->` が残存 | 公開版から削除すれば消し忘れ感がなくなる（意図的なら維持でも可） |
| 3 | 全体 | `example.com` メールはサンプルデータで問題なし（機械チェックの空リンク疑いは false positive） | 対応不要。誤検知として切り分け済み |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | 要修正 | published=false OK・slug OK（23字/重複なし）・秘密情報なし。ただし個人パス露出2箇所（warning） |
| Front Matter | OK | title 58字・type=tech・topics 4個・emoji 🗃️、すべて妥当 |
| 事実性（ログ照合） | OK | 結論・コマンド・エラー全文・各stdout・比較表がログと一致。創作なし |
| 画像 | OK | `/images/bun-sql-sqlite-crud-try/01-bun-sql-users-table.png` 実在・alt あり。孤立画像なし |
| Markdown構造 | OK | コードフェンス 42行（偶数）・`:::` 2行で閉、見出し階層 H2 中心で破綻なし |
| 文章品質・トーン | OK | 新人経験談トーン・詰まった点（PostgresError/lastInsertRowid）具体的・環境明記 |
| 完成度 | OK | 要素材/プレースホルダ残存なし。前提コメントのみ suggestion |

## 事実整合の照合結果（ログとの突合）

- 結論（達成/一部/未達）: 記事「上の4つは全部確認できました」↔ ログ「完了条件の判定: **達成**（4条件すべて）」 → **一致**
- 主要な突合:
  - Hello World 戻り値（配列＋`count`/`command`/`lastInsertRowid`/`affectedRows`）: 記事 line 127-138 ↔ ログ line 94-105 → 一致
  - INSERT RETURNING / `lastInsertRowid = null`: 記事 line 181-191 ↔ ログ line 128-137 → 一致
  - インジェクション 0件: 記事 line 206-217 ↔ ログ line 141-153 → 一致
  - トランザクション 5→5: 記事 line 241-250 ↔ ログ line 156-166 → 一致
  - PostgresError 再現（A失敗/B・C成功）: 記事 line 298-309 ↔ ログ line 200-211 → 一致
  - SQLiteError（code=SQLITE_ERROR/errno=1）: 記事 line 335-355 ↔ ログ line 173-192 → 一致
  - 旧 bun:sqlite 比較・差分表: 記事 line 385-411 ↔ ログ line 216-258 → 一致
  - 環境（Bun 1.3.14 / Node v22.17.0 / Darwin 25.5.0 arm64）: 記事 line 30-32 ↔ ログ line 13 → 一致
- 創作の疑いがある記述: なし
- 残存する `要素材` マーカー: 0 件

## 機械チェック結果（scripts/check-article.sh）

```
== check-article: articles/bun-sql-sqlite-crud-try.md (slug=bun-sql-sqlite-crud-try) ==
[PASS] Front Matter を検出した
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=23 (12-50)
[PASS] slug は汎用語で始まっていない
[PASS] type=tech
[PASS] title あり: 58文字
[PASS] emoji あり: 🗃️
[PASS] topics 4個
[PASS] 画像あり: /images/bun-sql-sqlite-crud-try/01-bun-sql-users-table.png
[PASS] コードフェンスが閉じている: フェンス行=42
[PASS] ::: ブロックが閉じている: 2 行
[WARN] プレースホルダ/空リンクの疑い (example.com / 空リンク)
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[WARN] 秘密情報の疑い [user-path] (散文か目視確認) at line 87
SUMMARY fail=0 warn=2
```

- [WARN] example.com / 空リンク: **false positive**。`alice@example.com` 等はSQLのサンプルメールデータで、リンクではない。重大度なし（対応不要）。
- [WARN] user-path at line 87: **有効**（warning）。line 176 も同一パターンで露出。上記 warning #1 参照。

## 適用した修正（修正適用時のみ）

なし（レポートのみ・非破壊）。

## 次のアクション

- [ ] warning #1（個人パス2箇所のマスク）を直す（`/revise-article` 推奨）
- [ ] 余力があれば suggestion #1・#2 も反映
- [ ] 直したら `/review-article` で再レビューする
- [ ] 判定が「公開可」になったら Front Matter を `published: true` に変えて `git push`
      （「サイト内で既に使用されています」が出たら slug を具体化。
       knowledge/2026-07-01-zenn-slug-already-used.md）
