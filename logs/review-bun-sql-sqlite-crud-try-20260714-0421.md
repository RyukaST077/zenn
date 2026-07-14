# 公開前レビュー: Bun 1.3 の Bun.SQL で SQLite を初めて触ってみた / bun-sql-sqlite-crud-try

## レビューの前提

- 対象記事: articles/bun-sql-sqlite-crud-try.md
- 出典ログ: logs/run-bun-sql-sqlite-20260714-0406/execution-log.md
- レビュー日時: 2026-07-14 04:21
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準

## 判定

**判定: 公開可**

- blocker: 0 件 / warning: 0 件 / suggestion: 3 件
- 根拠（判定を決めた主な指摘）:
  - 公開安全 OK: `published: false`、slug 妥当（`bun-sql-sqlite-crud-try` / 23字 / ローカル重複なし）、秘密情報なし、個人パスは `<user>` に匿名化済み。
  - 事実整合 OK: 結論・コマンド・エラー全文・出力・比較表・スクショ参照はすべて出典ログに裏付けあり。ログを超えた断定・創作コード・存在しないスクショ参照は検出されず。
  - 機械チェックの唯一の WARN（example.com）は例示メールアドレスによる false positive。

## 最優先で直すべき指摘（上位3件）

blocker / warning はなし。以下は任意（suggestion）。

1. [suggestion] 冒頭（9行目）— 前提コメント `<!-- 前提: 出典ログ ... -->` は公開時に残る。意図的なら可。気になるなら publish 前に除去。
2. [suggestion] 本編「SQLインジェクション試行」（207〜219行目）— 出力の「全件(3件)」と実際1件の齟齬は本文で補足済みだが、コードブロック直下の一言でさらに読者の混乱を減らせる。
3. [suggestion] 参考リンク（39〜40, 423〜424行目）— URL がプレーンテキスト。Zenn では Markdown リンク `[SQL](https://...)` にすると導線が良くなる。

## 指摘一覧（重大度順）

### blocker

なし。

### warning

なし。

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | 9行目 | 前提コメント `<!-- 前提: ... -->` が残存 | publish 直前に消すと本文がクリーンに。パイプライン運用上は残しても実害なし（HTMLコメントは表示されない） |
| 2 | 207〜219行目 | 出力中「全件(3件)にならなければ」はスクリプト固定メッセージで、この時点の実挿入は Alice 1件のみ。本文（219行目）で補足済み | 補足済みなので必須ではないが、コードブロック脇の注記を1行足すと初読でも詰まらない |
| 3 | 39〜40, 423〜424行目 | 参考URL がプレーンテキスト表記 | Markdown リンク化で Zenn 上のクリック導線が改善 |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | published:false / slug 妥当・重複なし / 秘密情報なし / 個人パス匿名化済み |
| Front Matter | OK | title 58字・type=tech・topics 4個・emoji 1つ、いずれも妥当 |
| 事実性（ログ照合） | OK | 結論・コマンド・出力・比較表・スクショすべてログ裏付けあり。創作なし |
| 画像 | OK | `/images/bun-sql-sqlite-crud-try/01-...png` 実在・alt あり・孤立画像なし |
| Markdown構造 | OK | コードフェンス偶数(42)・`:::`偶数(2)・見出し階層健全 |
| 文章品質・トーン | OK | 経験談トーン、詰まった点（PostgresError/lastInsertRowid）を具体的に記述、環境明記 |
| 完成度 | OK | 要素材マーカー・プレースホルダ残存なし。構成・分量とも公開に耐える |

## 事実整合の照合結果（ログとの突合）

- 結論: 記事「やりたかった4つは全部確認できた」↔ ログ「完了条件 4条件すべて達成」→ **一致**
- 環境: 記事「Darwin 25.5.0 arm64 / Bun 1.3.14 / Node v22.17.0」↔ ログ同一 → **一致**
- 主要出力の突合（すべて一致）:
  - Hello World の配列＋メタ出力（count/command/lastInsertRowid/affectedRows）
  - INSERT RETURNING（id=1, lastInsertRowid=null）
  - インジェクション試行 0件
  - トランザクション コミット5件 / ロールバック 5→5
  - error.ts の SQLiteError / SQLITE_ERROR / errno=1
  - pitfall-adapter のケースA PostgresError / B・C 成功
  - compare-old の `{ changes:1, lastInsertRowid:1 }`
  - 旧/新 比較表（ログのフェーズ4差分表と一致）
- 創作の疑いがある記述: なし
- 個人情報: npm パス（87行目）・`ls` 出力（176行目）ともに `<user>` へ匿名化済み。ログの実ユーザー名はリークしていない
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
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[PASS] 秘密情報パターンの検出なし
[WARN] プレースホルダ/空リンクの疑い (example.com / 空リンク)
SUMMARY fail=0 warn=1
```

### 機械チェックの false positive 切り分け

- `[WARN] example.com`: 本文の `alice@example.com` / `bob@example.com` など**例示用メールアドレス**（RFC 2606 の予約ドメイン）に反応したもの。プレースホルダや空リンクではないため **suggestion にも該当せず、重大度なし**として扱う。

## 適用した修正（修正適用時のみ）

なし（レポートのみ・非破壊レビュー）。

## 次のアクション

- [ ] （任意）上記 suggestion を検討する（必須ではない）
- [x] blocker / warning はゼロ
- [ ] Front Matter を `published: true` に変えて `git push`（または `/publish-pr`）で公開
      （「サイト内で既に使用されています」が出たら slug を具体化。
       knowledge/2026-07-01-zenn-slug-already-used.md）
