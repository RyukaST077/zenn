# 公開前レビュー: Node 26で既定になったTemporalを、Dateと同じ処理で書き比べてみた（node26-temporal-vs-date-try）

## レビューの前提

- 対象記事: articles/node26-temporal-vs-date-try.md
- 出典ログ: logs/run-node26-temporal-vs-date-20260714-1517/execution-log.md
  （記事冒頭コメント `<!-- 前提: 出典ログ ... -->` から辿った。引数指定とも一致）
- 参照した一次情報: 上記ログ ＋ `logs/run-.../workspace/01〜06.mjs`（実ソース）
- レビュー日時: 2026-07-14 15:35
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準

## 判定

**判定: 公開可**

- blocker: 0 件 / warning: 0 件 / suggestion: 3 件
- 根拠（判定を決めた主な指摘）:
  - 公開安全（published:false / slug / 秘密情報・個人パスの漏れなし）をすべてクリア。
  - 事実整合が非常に高い。本文のコード・出力・エラー全文が、出典ログおよび
    workspace の実ソース（`01〜06.mjs`）と一致。ログを超えた成功の断定・創作コード・
    存在しないスクショ参照は見つからなかった。
  - blocker / warning のいずれも0のため「公開可」。suggestion は任意対応。

## 最優先で直すべき指摘（上位3件）

いずれも suggestion（任意）。公開をブロックする指摘はなし。

1. [suggestion] 「Temporalで書き直し」TZ節ほか — 同じ `03-tz.mjs` を3つのコードブロックに
   分割して別々の見出し下に貼っているため、読者が「1ファイルからの抜粋」と分かりにくい。
   各ブロック冒頭に「（`03-tz.mjs` の抜粋）」等を一言添えると親切。
2. [suggestion] 「Temporalで書き直し」相互変換節（コード `05-convert.mjs`, 271-286行） —
   実ソースにある `else`（未実装時のフォールバック）と末尾の `ZonedDateTime` 変換部分が
   省略されている。動作・出力に矛盾はないが、コピペ再現性を上げるなら省略した旨を明記するか
   実ソースどおりに載せると良い。
3. [suggestion] 参考リンク — 動作に効いた `Duration.total()`/`relativeTo` の話題があるので、
   MDN の `Temporal.Duration.prototype.total` へのリンクを追加すると読者の裏取りが楽になる。

## 指摘一覧（重大度順）

### blocker

なし。

### warning

なし。

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | 「Temporalで書き直し」〜「詰まった点」の `js:03-tz.mjs` 3ブロック（141/214/308行） | 同一ファイル名ラベルのブロックが3つに分割されている | 「同一ファイルの抜粋」と明示すれば、読者が全文と誤解せず再現しやすい |
| 2 | 相互変換 `js:05-convert.mjs`（271-286行） | 実ソースの `else` 分岐・末尾 `ZonedDateTime` 変換を省略 | 省略明記 or 全文掲載でコピペ再現性が上がる（出力との整合は問題なし） |
| 3 | 参考リンク（402-406行） | `Duration.total()`/`relativeTo` の公式リンクが無い | 記事の核である詰まり4件目の裏取りが容易になる |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | published:false / slug 27字・具体的・重複なし / 秘密情報・個人パス漏れなし（`file:///.../workspace/` と適切に伏字化） |
| Front Matter | OK | title 41字（誇大なし）・type=tech・emoji 1つ・topics 4個すべて英小文字 |
| 事実性（ログ照合） | OK | コード=workspace実ソース由来、出力・エラー全文=ログと一致、結論=ログ「達成」と整合 |
| 画像 | OK | CLI検証のため画像なし（ログのスクショ0枚と整合）。`/images` 参照なし |
| Markdown構造 | OK | コードフェンス62行で閉じ、`:::message` 2行で閉じ、H1乱用なし、リンク健全 |
| 文章品質・トーン | OK | 経験談トーン、詰まった点5件が具体的、再現性（OS/Node/V8/nvm）明記、冒頭に対象読者・結論あり |
| 完成度 | OK | 要素材/プレースホルダ残存なし。前提コメントは出典明示として意図的 |

## 事実整合の照合結果（ログとの突合）

- 結論（達成/一部/未達）: 記事「書き比べは一通り動いて違いも見えた／途中でエラーに複数遭遇」
  ↔ ログ「結果サマリー: 達成（4条件すべて客観ログで確認）、詰まり5件すべて解決」 → **一致**
- コードの出所: 本文の全コードブロックを workspace 実ソース（`01〜06.mjs`）と照合。
  01/02 は完全一致。03/04/05 はコメントの微トリム・一部行の抜粋のみで、意味・出力は同一。
  06 は [5] 部分の抜粋。**創作コードは検出されず**。
- 出力・エラーの照合:
  - v22 `typeof Temporal → undefined` / `ReferenceError`、v26 `object 2026-07-14T15:17:48...` → ログ一致
  - 01: `2026-03-03`（破壊的ロールオーバー）/ 02: `2026-02-28`（constrainクランプ） → ログ一致
  - `overflow:reject → RangeError: ... not a valid ISO date.` → ログ一致
  - 03 TZ変換出力、`toZonedDateTime()` 引数なし → `TypeError: Time zone must be...` → ログ一致
  - 04 差分 `P164DT12H` / `P5M14DT12H` / `total days: 164.5` → ログ一致
  - 05 相互変換 `往復一致?: true`、`toTemporalInstant: function` → ログ一致
  - 06 `Duration.total({unit:'week'})` の**空メッセージ RangeError**（`RangeError: Temporal error:`）
    と `relativeTo` を渡した対処 `23.428571428571427` → ログ一致（knowledge化済みとも整合）
- 数値の裏付け: V8 `14.6.202.34-node.24`（実機値。リリースノートの `.33` との差にも言及）→ ログの
  一次情報メモと一致。AI単独の実測時間（約0.3h）等の「記事に転記しない」内部メタは**本文に漏れていない**。
- 創作の疑いがある記述: なし
- 存在しないスクショ参照: なし（画像参照ゼロ）
- 残存する `要素材` マーカー: 0 件

## 機械チェック結果（scripts/check-article.sh）

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

## 適用した修正（修正適用時のみ）

なし（レポートのみ・非破壊レビュー）。

## 次のアクション

- [ ] suggestion（任意）を必要に応じて反映する
- [ ] 判定は「公開可」。反映するなら `/revise-article` → `/review-article` で再確認
- [ ] 公開するときは Front Matter を `published: true` に変えて `git push`
      （`/publish-pr` 経由推奨。「サイト内で既に使用されています」が出たら slug を具体化。
       knowledge/2026-07-01-zenn-slug-already-used.md）
