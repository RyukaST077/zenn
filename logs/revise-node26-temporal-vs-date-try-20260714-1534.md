# 修正レポート: node26-temporal-vs-date-try

## 採用した前提

- 対象記事: `articles/node26-temporal-vs-date-try.md`（published: false のまま維持）
- レビューレポート: `logs/review-node26-temporal-vs-date-try-20260714-1531.md`（引数で指定）
- 出典ログ: `logs/run-node26-temporal-vs-date-20260714-1517/execution-log.md`（引数で指定）
  - 補完素材の実ファイル: `logs/run-.../workspace/05-convert.mjs`, `workspace/03-tz.mjs`
- 適用範囲: blocker ＋ warning ＋ 安全で機械的な suggestion
- slug リネーム: 指摘なし（リネームせず）
- 修正日時: 2026-07-14 15:34

判定は「要修正」（blocker 0 / warning 2 / suggestion 3）。掲載コードが貼付出力を再現しない
2箇所（分類B: ログ由来の補完）と、トレーサビリティ用コメントの欠如（安全な機械修正）を対象に修正。

## 指摘ごとの適用/スキップ

| # | 重大度 | 箇所 | 分類 | 対応 | 内容 |
|---|---|---|---|---|---|
| warning-1 | warning | `05-convert.mjs`（旧L269-291） | B ログ由来の補完 | 適用 | 掲載コードに欠けていた3行の `console.log`（`'Date ...'` / `'   epochMilliseconds:'` / `'Instant -> Date ...'`）を実ファイル `workspace/05-convert.mjs` L7,9,13 どおりに補い、`back` 宣言後に出力行を配置。コード→貼付出力（`Date`/`epochMilliseconds: 1784032496789`/`Instant -> Date`）が一致するようになった。出力側は変更なし。 |
| warning-2 | warning | `03-tz.mjs`（旧L303-316） | B ログ由来の補完 | 適用 | try/catch の後に実ファイル `workspace/03-tz.mjs` L32-33 どおり `const zdtOk = pdt.toZonedDateTime('Asia/Tokyo');` と対応する `console.log('[Temporal] toZonedDateTime("Asia/Tokyo"):', ...)` を追記。貼付出力2行目 `[Temporal] toZonedDateTime("Asia/Tokyo"): ...` を生成するコードが揃った。本文（「TZを渡せば変換できる」）とも整合。 |
| suggestion-1 | suggestion | 冒頭（L1-8） | A 機械修正 | 適用 | Front Matter 直後に `<!-- 前提: 出典ログ logs/run-node26-temporal-vs-date-20260714-1517/execution-log.md -->` を追加。再レビュー・改稿時のトレーサビリティ向上。 |
| suggestion-2 | suggestion | `06-extra.mjs`（旧L331-348） | C（本文追記） | スキップ | 掲載抜粋4行とトレースの行番号（`06-extra.mjs:28`）が対応しない旨を一言添える提案。任意であり本文の追記を伴うため、最小修正の原則に照らし今回は見送り。出力・エラーはログと一致しており事実性の問題はない。 |
| suggestion-3 | suggestion | `01-date.mjs`（旧L105-125） | C（本文追記） | スキップ | `d2` のローカル版が環境TZ依存である点を本文でも触れる提案。コード内コメントに既に明記済みで、任意の親切追記のため今回は見送り。 |

## 補完素材の収集結果（分類B）

- warning-1: `workspace/05-convert.mjs`（実ファイル）に欠けていた3行の `console.log` が存在。出典ログ
  L219-231 の出力全文とも一致。→ 実ファイルどおりに補完（捏造なし）。
- warning-2: `workspace/03-tz.mjs`（実ファイル）L32-33 に `zdtOk` の生成・出力行が存在。出典ログ
  L177-178 の出力とも一致。→ 実ファイルどおりに補完（捏造なし）。

いずれも出力値・エラーはログ由来の既存記述を維持し、コード側の「抜け」だけを埋めた。

## セルフチェック結果（check-article.sh 再実行）

```
== check-article: articles/node26-temporal-vs-date-try.md (slug=node26-temporal-vs-date-try) ==
[PASS] published=false (ドラフト)
[PASS] コードフェンスが閉じている: フェンス行=62
[PASS] ::: ブロックが閉じている: 2 行
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[PASS] 秘密情報パターンの検出なし
SUMMARY fail=0 warn=0
```

`published: false` を維持していることを最終確認済み。

## 未解消の指摘

- なし（warning 2件はすべて解消。suggestion 2件は任意のためスキップ、事実性・公開安全に影響なし）。

## 修正不能・中止

- なし。

## 次のアクション

- `/review-article articles/node26-temporal-vs-date-try.md` で再レビューし、公開可になったら `/publish-pr` へ。
