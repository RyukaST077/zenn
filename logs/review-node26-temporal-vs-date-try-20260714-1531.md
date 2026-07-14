# 公開前レビュー: Node 26で既定になったTemporalを、Dateと同じ処理で書き比べてみた / node26-temporal-vs-date-try

## レビューの前提

- 対象記事: articles/node26-temporal-vs-date-try.md
- 出典ログ: logs/run-node26-temporal-vs-date-20260714-1517/execution-log.md（引数で指定）
- レビュー日時: 2026-07-14 15:31
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準

## 判定

**判定: 要修正**

- blocker: 0 件 / warning: 2 件 / suggestion: 3 件
- 根拠（判定を決めた主な指摘）:
  - warning-1: `05-convert.mjs` の掲載コードが、貼ってある出力を再現しない（出力側にある `Date`/`epochMilliseconds`/`Instant -> Date` の3行を生成する `console.log` がコードから抜けている）。
  - warning-2: 「詰まった点」の `03-tz.mjs` コードブロックも同様に、出力2行目 `toZonedDateTime("Asia/Tokyo")` を出す行がコードに無い。
  - 公開安全（published:false / 秘密情報なし / slug 妥当・重複なし）は問題なし。事実整合（出力値・エラー全文）はログと完全一致。

## 最優先で直すべき指摘（上位3件）

1. [warning] 「Temporalで書き直し」`05-convert.mjs`（記事 L269-291） — 掲載コードに欠けている3行の `console.log`（`'Date ...'` / `'   epochMilliseconds:'` / `'Instant -> Date ...'`）を実ファイルどおり補い、コードと出力を一致させる。
2. [warning] 「詰まった点」`03-tz.mjs`（記事 L303-316） — try/catch の後に実ファイルにある `const zdtOk = pdt.toZonedDateTime('Asia/Tokyo'); console.log('[Temporal] toZonedDateTime("Asia/Tokyo"):', zdtOk.toString());` を補い、出力2行目と対応させる。
3. [suggestion] 冒頭に出典ログをたどる `<!-- 前提: 出典ログ ... -->` コメントが無い（記事 L1-8） — 再レビュー時のトレーサビリティ用に付けておくとよい。

## 指摘一覧（重大度順）

### blocker

なし。

### warning

| # | 箇所（節/行） | 指摘 | 具体的な直し方 | 根拠 |
|---|---|---|---|---|
| 1 | Temporalで書き直し / `05-convert.mjs`（L269-291） | 掲載コードが出力を再現しない。出力（L283-291）には `Date : ...` / `epochMilliseconds: 1784032496789` / `Instant -> Date : ...` の3行があるが、掲載コード（L269-281）には対応する `console.log` が無い。読者がこのコードをそのまま実行しても掲載出力にならない。 | 実ファイル `workspace/05-convert.mjs` どおりに、`console.log('Date : ', now.toISOString());`／`console.log(' epochMilliseconds:', instant.epochMilliseconds);`／`console.log('Instant -> Date : ', back.toISOString());` を該当位置に補う（`back` の宣言も含める）。出力側は現状維持でよい。 | 出典ログ L219-231 と workspace 実ファイルで確認。出力値自体はログと一致（創作ではなく掲載コードの抜け） |
| 2 | 詰まった点 / `03-tz.mjs`（L303-316） | 掲載コード（L303-311）は引数なし呼び出しの try/catch のみだが、出力（L313-316）には `[Temporal] toZonedDateTime("Asia/Tokyo"): ...` の行がある。この行を出すコードが掲載されていない。 | try/catch の後に実ファイルどおり `const zdtOk = pdt.toZonedDateTime('Asia/Tokyo');`／`console.log('[Temporal] toZonedDateTime("Asia/Tokyo"):', zdtOk.toString());` を追記する。本文（L318）が「TZを渡せば変換できる」と述べており、コードで裏取りされる形になる。 | 出典ログ L177-178 と workspace 実ファイルで確認 |

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | 冒頭（L1-8） | 出典ログをたどる `<!-- 前提: 出典ログ logs/run-...-1517/execution-log.md -->` コメントが無い | 再レビュー・改稿時に素材ログへ辿れて事実整合の確認が速くなる |
| 2 | 詰まった点 / `06-extra.mjs`（L331-348） | 掲載コードは4行の抜粋だが、エラートレースは `06-extra.mjs:28` を指す。行番号と抜粋が対応しないため、読者が混乱しうる | 「実ファイルの28行目」等の一言を添えるか、抜粋である旨を明記すると親切 |
| 3 | Dateで書いた処理（L105-125） | `01-date.mjs` の掲載コードは出力を正しく再現する（問題なし）が、`d2` のローカル版が環境TZ依存である点はコメントに書かれているものの、本文でも一言触れると再現条件が明確になる | 読者環境（TZ）による出力差の予防になる |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | published:false / 秘密情報なし / slug=node26-temporal-vs-date-try（27字・重複なし・汎用でない） |
| Front Matter | OK | title 41字・type tech・emoji 🕰️・topics 4個（nodejs/javascript/temporal/date）すべて妥当 |
| 事実性（ログ照合） | 要修正 | 出力値・エラー全文・結論（全達成）はログと完全一致。ただし掲載コード2箇所が出力を再現しない（warning 1,2） |
| 画像 | OK | 画像を伴わない CLI 記事。/images 参照なしは仕様どおり |
| Markdown構造 | OK | コードフェンス62行（偶数・閉）/ `:::` 2行（閉）/ 見出し階層 H2 のみで破綻なし / 参考リンク2件 |
| 文章品質・トーン | OK | 経験談トーン維持・断定しすぎない・詰まった点5件が具体的・環境（macOS/Node v26.5.0/V8/nvm）明記 |
| 完成度 | OK | 要素材マーカー・プレースホルダ残りなし。前提コメント欠如は suggestion |

## 事実整合の照合結果（ログとの突合）

- 結論（達成/一部/未達）: 記事「書き比べは一通り動いて違いも見えた／エラーに何度か引っかかった」 ↔ ログ「完了条件4つすべて達成・詰まり5件すべて解決」 → **一致**
- 主要な数値・出力の照合（すべて一致）:
  - V8 `14.6.202.34-node.24`（実機値）とリリースノート `.33` の差 ↔ ログ L50-51 一致
  - `typeof Temporal` → `undefined`（v22, 落ちない）／直接参照で `ReferenceError` ↔ ログ L94-107 一致
  - v26 `object 2026-07-14T15:17:48.449033936` ↔ ログ L110 一致
  - Date月末加算 `2026-03-03`（破壊的） ↔ ログ L133-137 一致
  - Temporal `2026-02-28`（非破壊・constrain）／`overflow:'reject'` の `RangeError: ...not a valid ISO date.` ↔ ログ L151-155 一致
  - TZ変換 New York `8:00:00 AM` / Tokyo `9:00:00 PM` / `-04:00[America/New_York]` / `.hour:8` ↔ ログ L170-176 一致
  - 差分 `P164DT12H` / `P5M14DT12H` / `PT3948H` / 164.5 ↔ ログ L196-203 一致
  - `PlainDateTime.toZonedDateTime()` 引数なし → `TypeError: ...Time zone must be string or ZonedDateTime object.` ↔ ログ L177 一致
  - `since` 既定 largestUnit の型差（PlainDate=P164D / PlainDateTime=P164DT12H）↔ ログ L250-251, L267 一致
  - `Duration.total({unit:'week'})` 空メッセージ `RangeError`（06-extra.mjs:28:47）／`relativeTo` で `23.428571428571427` ↔ ログ L254-286 一致
  - `Date`↔`Instant` 往復一致 `true`・`toTemporalInstant` は `function` ↔ ログ L220-227 一致
- 創作の疑いがある記述: **なし**（値・エラーはすべてログ由来）。ただし掲載コードの一部が出力を生成する行を欠いている（warning 1,2）＝創作ではなく「抜け」。
- ログの内部メタ（実測0.3h・AIエージェント単独）の記事への転記: **なし**（適切に除外されている）
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

- [ ] warning 1,2（掲載コードと出力の不一致）を実ファイルどおりに直す（`/revise-article` 推奨）
- [ ] 直したら `/review-article` で再レビューする
- [ ] 判定が「公開可」になったら Front Matter を `published: true` に変えて `git push`
      （「サイト内で既に使用されています」が出たら slug を具体化。
       knowledge/2026-07-01-zenn-slug-already-used.md）
