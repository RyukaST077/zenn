# 公開前レビュー: Node 26で既定になったTemporalを、Dateと同じ処理で書き比べてみた / node26-temporal-vs-date-try

## レビューの前提

- 対象記事: articles/node26-temporal-vs-date-try.md
- 出典ログ: logs/run-node26-temporal-vs-date-20260714-1517/execution-log.md（記事冒頭コメントから特定）
- レビュー日時: 2026-07-14 15:25
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準

## 判定

**判定: 要修正**

- blocker: 0 件 / warning: 1 件 / suggestion: 3 件
- 根拠（判定を決めた主な指摘）:
  - [warning] 複数のコードブロックで、貼られたコードが出力の一部の行を生成していない（コードと出力が一致しない）。事実は全てログ由来だが、読者が貼られたコードをそのまま実行しても示された出力を再現できない。

## 最優先で直すべき指摘（上位3件）

1. [warning] 「Dateで書いた処理」「Temporalで書き直し」節（01-date.mjs / 04-diff.mjs）— 出力ブロックに、直前のコードブロックに `console.log` が無い行が混じっている。コードにその出力行を生む文を足すか、余分な出力行を削って一致させる。
2. [suggestion] 冒頭コメント `<!-- 前提: 出典ログ ... -->`（9行目）— 公開前に削除を検討（内部パスを含む消し忘れ防止）。
3. [suggestion] 「詰まった点」節の 06-extra.mjs 抜粋（310–313行）— `a` / `b` の定義が抜粋に無く文脈が追いにくい。定義行を1行添えるかコメントで補う。

## 指摘一覧（重大度順）

### blocker

なし。

### warning

| # | 箇所（節/行） | 指摘 | 具体的な直し方 | 根拠 |
|---|---|---|---|---|
| 1 | 「Dateで書いた処理」01-date.mjs（107–129行）/ 04-diff.mjs Date版（153–165行）/「Temporalで書き直し」04-diff.mjs Temporal版（224–242行） | 出力ブロックに、直前のコードでは出力していない行が含まれる。①01-date: 出力の `ローカル版 : Tue Mar 03 ...` を生む `console.log` がコードに無い。②04-diff Date: 出力の `[Date] 差(日,整数): 164` を生む行が無い。③04-diff Temporal: 出力の `[Temporal] since()（既定）`, `-> ... minutes: 0`, `[Temporal] Instant.since(hour): PT3948H => total days: 164.5` を生むコードが無く、`since(largestUnit:month)` の出力に付く ` => months: 5 days: 14` もコードに現れない。コードは実物の抜粋、出力はログ全文なので両者がズレている | 各ブロックで整合を取る。抜粋方針なら出力側から余分行を削る（例: 01-date は `ローカル版` 行を出力から除く）、または実物どおりに `console.log` をコードへ足して出力と一対一に対応させる。出力の数値・文字列自体はログと一致しており改変不要 | 出典ログ 132–138 / 194–205 行（出力はログと一致・創作ではない）。checklist「貼っているコードが実際のworkspace由来」「再現性」 |

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | 冒頭コメント（9行目） | `<!-- 前提: 出典ログ logs/... -->` が残っている | 公開前に削除すれば、内部の作業ログパスが記事に残らず、消し忘れの見た目も避けられる（機械チェックは秘密情報とは判定せず） |
| 2 | 詰まった点・06-extra.mjs 抜粋（310–313行） | `const dur = a.since(b, ...)` の `a` / `b` の定義が抜粋に無い | 直前に `a` / `b`（`PlainDate.from(...)`）の定義を1行添えると、読者が抜粋単体で意味を追える |
| 3 | 「Temporalで書き直し」02-temporal.mjs 出力（191–197行） | 出力末尾の `overflow:constrain: 2026-02-28` を生むコードが抜粋に無い（`try/catch` までしか載っていない） | コードへ該当行を足すか出力から外すと、warning#1 と同じ整合が全ブロックで揃う |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | published=false / slug 妥当(27字, 汎用でない, ローカル重複なし) / 秘密情報・個人パスなし（エラーは `file:///.../workspace/...` と匿名化済み） |
| Front Matter | OK | title/emoji/type/topics/published 揃う。type=tech, topics 4個, title 41字で誇大表現なし |
| 事実性（ログ照合） | 要修正 | 数値・エラー・結論はすべてログ由来で一致。ただしコードと出力の対応にズレあり（warning#1） |
| 画像 | OK | CLI検証で画像なし（ログでスクショ0枚・ブラウザ不使用と明記）。参照切れなし |
| Markdown構造 | OK | コードフェンス62行(偶数)・`:::` 2行で閉じ。見出しはH2主体でH1乱用なし。参考リンク2件（公式/MDN）実在 |
| 文章品質・トーン | OK | 経験談トーン、詰まった点5件を具体的に記載、環境/再現性(OS・Node v26.5.0・V8)明記 |
| 完成度 | 要修正 | プレースホルダ・要素材マーカーなし。前提コメントの消し忘れ懸念（suggestion#1） |

## 事実整合の照合結果（ログとの突合）

- 結論（達成/一部/未達）: 記事「書き比べは一通り動いて違いは見えた／予想と外れるエラーに複数遭遇」 ↔ ログ結果サマリー「達成（4条件すべて客観ログで確認）／詰まり5件すべて解決」 → **一致**
- 主要な事実の突合（すべて一致・創作なし）:
  - V8 `14.6.202.34-node.24`、リリースノート表記 `.33` との差 → ログ 50 行と一致（実機値を正しく記載）
  - v22 `typeof Temporal` → `undefined`（落ちない）→ ログ 95–96 行と一致
  - Jan31+1M: Date `2026-03-03` / Temporal `2026-02-28` → ログ 133/151 行と一致
  - `overflow:reject` → `RangeError: ... not a valid ISO date.` → ログ 154 行と一致
  - TZ: `TypeError: Time zone must be string or ZonedDateTime object.` → ログ 177 行と一致
  - `since` 既定 largestUnit の型依存（PlainDate=P164D / PlainDateTime=P164DT12H）→ ログ 199/250 行と一致
  - `Duration.total({unit:'week'})` 空メッセージ RangeError → `relativeTo` で `23.428...` → ログ 258/285 行と一致
  - 相互変換 往復一致 `true` / `toTemporalInstant` は `function` → ログ 225–227 行と一致
- 創作の疑いがある記述: なし（数値・エラー全文・コマンドはログに裏付けあり）
- 注意点: 記述内容は正しいが、**貼られたコードが出力全行を生成しない**（warning#1）。「創作」ではなく「抜粋と出力の不一致」。
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

- [ ] warning#1（コードと出力の不一致）を、コードへ `console.log` を足す or 出力の余分行を削る形で解消する（数値・文字列は改変しない）
- [ ] suggestion（前提コメント削除・抜粋の変数定義補足）を任意で反映する
- [ ] 直したら `/review-article` で再レビューする
- [ ] 判定が「公開可」になったら Front Matter を `published: true` に変えて `git push`
      （「サイト内で既に使用されています」が出たら slug を具体化。
       knowledge/2026-07-01-zenn-slug-already-used.md）
