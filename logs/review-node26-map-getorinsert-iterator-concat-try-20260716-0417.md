# 公開前レビュー: Node 26 の Map.getOrInsert と Iterator.concat で get-or-set 定型を書き比べてみた / node26-map-getorinsert-iterator-concat-try

## レビューの前提

- 対象記事: articles/node26-map-getorinsert-iterator-concat-try.md
- 出典ログ: logs/run-node26-map-getorinsert-20260716-0407/execution-log.md（記事冒頭コメントで指定・引数一致）
- レビュー日時: 2026-07-16 04:17
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準

## 判定

**判定: 公開可**

- blocker: 0 件 / warning: 0 件 / suggestion: 4 件
- 根拠（判定を決めた主な指摘）:
  - 公開安全（published:false / slug 妥当 / 秘密情報なし）はすべてクリア。
  - 事実整合: 記事のコード・出力・数値はすべて出典ログおよび workspace 実ファイルと一致。創作・誇大の断定なし。
  - 機械チェックの唯一の WARN（title 長）は、誇大表現ではなく具体的・説明的なタイトルのため suggestion に降格（下記 suggestion #1 に理由を明記）。

## 最優先で直すべき指摘（上位3件）

1. [suggestion] タイトル（93字） — 表示崩れ回避のため 60字前後に短縮を検討（例: `Node 26 の Map.getOrInsert / Iterator.concat で get-or-set を書き比べてみた`）。公開可否には影響しない。
2. [suggestion] 9行目の前提コメント `<!-- 前提: 出典ログ ... -->` — 内部ログパスを含むため、公開前に削除を検討（Zennでは非表示だが GitHub 上のソースには残る）。
3. [suggestion] 250〜259行の `04-iterator-concat.mjs` ブロック — 実ファイルはコメントと成功パスの `console.log` を含む省略版。冒頭に「（抜粋）」と添えると誤解が減る。

## 指摘一覧（重大度順）

### blocker

なし。

### warning

なし。

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | Front Matter title（2行目） | 93字と長め（機械チェック WARN）。ただし誇大語なし・内容を正確に表す説明的タイトル | 60字前後に短縮すると一覧/OGPでの表示崩れを避けられる。安全側だが必須ではない |
| 2 | 9行目 前提コメント | `<!-- 前提: 出典ログ logs/run-... -->` が残存。内部運用パスを含む | 公開版から削除すると読者に不要な内部情報を出さずに済む（秘密ではないため suggestion） |
| 3 | 250-259行 コードブロック | 同名 `04-iterator-concat.mjs` の省略版（実ファイルの成功パス出力・コメントを割愛） | 「（抜粋）」注記で「これがファイル全体」という誤読を防げる。内容は実ファイルと整合 |
| 4 | 全体トーン | 「予想外れ→検証」の流れが良く書けている。強いて言えば冒頭「結論の先出し」で学びを1行足しても良い | 読者の期待形成がさらに明確になる（任意） |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | published:false / slug 42字・文字種OK・重複なし / 秘密情報検出なし |
| Front Matter | OK | 必須フィールド揃い・type=tech・topics 5個・emoji あり。title 長のみ suggestion |
| 事実性（ログ照合） | OK | コード・出力・数値すべてログ/workspace と一致。創作・誇大なし |
| 画像 | OK | `/images/<slug>/01-bench-report.png` 実在（79KB）・alt あり・孤立画像なし |
| Markdown構造 | OK | フェンス32行（偶数）・`:::` 4行（偶数）・見出し階層正常・壊れリンクなし |
| 文章品質・トーン | OK | 経験談トーン・詰まった点あり・再現性（OS/Node版）明記・ベンチは断定回避 |
| 完成度 | OK | プレースホルダ/要素材マーカーなし。前提コメントのみ整理余地（suggestion） |

## 事実整合の照合結果（ログとの突合）

- 結論（達成/一部/未達）: 記事「5つの完了条件はすべて確認できた」（298行）↔ ログ「完了条件の判定: 達成（5つすべて客観確認）」（19行）→ **一致**
- 主要事実の裏付け:
  - diff exit 0 一致（160行）↔ commands.log「diff exit code: 0」→ 一致
  - コールバック 5回 / expensive 12回（196-199行）↔ 03-lazy-callback 出力 → 一致
  - take(3)=[20,40,60]・source3 未評価（240-244行）↔ 04 出力 → 一致
  - async generator が `TypeError: [object AsyncGenerator] is not iterable`（265行）↔ 04 出力 → 一致（「予測＝Promiseが入る」→「実際＝throw」の訂正もログ158行と整合）
  - ベンチ数値 93.7/107.2ms・heap 29.13/21.53MB・節約約7.6MB（283-290行）↔ 05-bench 出力 → 一致
  - コード 01〜04 は workspace 実ファイルの忠実な抜粋（コメント簡略化のみ、ロジック改変なし）
- 創作の疑いがある記述: なし
- 残存する `要素材` マーカー: 0 件

## 機械チェック結果（scripts/check-article.sh）

```
== check-article: articles/node26-map-getorinsert-iterator-concat-try.md (slug=node26-map-getorinsert-iterator-concat-try) ==
[PASS] Front Matter を検出した
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=42 (12-50)
[PASS] slug は汎用語で始まっていない
[PASS] type=tech
[WARN] title が長い: 93文字 (60字目安)
[PASS] emoji あり: 🗺️
[PASS] topics 5個
[PASS] 画像あり: /images/node26-map-getorinsert-iterator-concat-try/01-bench-report.png
[PASS] コードフェンスが閉じている: フェンス行=32
[PASS] ::: ブロックが閉じている: 4 行
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[PASS] 秘密情報パターンの検出なし
SUMMARY fail=0 warn=1
```

補足: 唯一の WARN（title 93字）は誇大表現ではなく内容を正確に表す説明的タイトルのため、
公開安全・事実性に影響せず suggestion に降格。短縮は任意。

## 次のアクション

- [ ] （任意）suggestion（タイトル短縮・前提コメント削除・抜粋注記）を反映
- [ ] 判定は「公開可」。Front Matter を `published: true` に変えて `git push`（または /publish-pr）で公開
      （「サイト内で既に使用されています」が出たら slug を具体化。
       knowledge/2026-07-01-zenn-slug-already-used.md）
