# 修正適用レポート: Node 26のrandomUUIDv7()とv4を書き比べ、SQLiteの並び順を見た

## 採用した前提

- 対象記事: `articles/node26-randomuuidv7-vs-v4-sqlite-order.md`（引数で明示 / published: false 維持）
- レビューレポート: `logs/review-node26-randomuuidv7-vs-v4-sqlite-order-20260723-0420.md`（引数で明示）
- 出典ログ: `logs/run-uuidv7-20260723-0409/execution-log.md`（引数で明示）
- 適用範囲: blocker ＋ warning ＋ suggestion（suggestion も安全・機械的なものは適用）
- slug リネーム: なし（指摘なし）
- 修正日時: 2026-07-23 04:24
- 判定（修正前）: 要修正（blocker 0 / warning 3 / suggestion 4）

## 適用した修正

### warning（3件中2件を解消・修正、1件は緩和して未解消として明記）

| # | 箇所 | 分類 | 対応 | 内容 |
|---|---|---|---|---|
| 1 | 本文「つまずいた点」節（旧272行）"2msおき（1msに1件未満）" | C 削減 | 適用（削除） | 未計測の "2msおき（1msに1件未満）に分かれていました" を削除。ログにある事実（`sqlite-order.mjs` で `ORDER BY id` が挿入順と100%一致・各IDが別msに落ちる）に置き換え、「間隔そのものは今回は数値化していません」と観測範囲を明示。根拠: execution-log 160/181-183行。 |
| 2 | Front Matter・本文「使ったもの/環境」節「26.1.0で追加」 | B ログ由来＋一次確認 | 適用（据え置き・裏取り済み） | Node.js 公式リリースノート [v26.1.0 (Current)](https://nodejs.org/en/blog/release/v26.1.0)（PR #62553）で `crypto.randomUUIDv7` が v26.1.0 追加であることを一次確認。二次情報のみだった断定が公式ソースで裏付けられたため緩和不要と判断し、記述はそのまま維持。 |
| 3 | タイトル（1行目, 旧92文字） | C 削減（体裁） | 適用（短縮・**残り warning あり**） | 「〜書き比べて、SQLiteの並び順で違いを見てみた」→「〜書き比べ、SQLiteの並び順を見た」に短縮。check-article.sh の `wc -m` はバイト計数のため 74（=ASCII 29バイト＋日本語15字×3バイト）と表示され60字目安の WARN は残る。API名（`randomUUIDv7()`/`v4`/`SQLite`/`Node 26`）だけで29バイトを占め、これ以上の短縮は必須の技術用語を落とすことになるため、意味を保つ範囲で最大限短縮した。→ **未解消 warning（体裁のみ・fail=0）** として明記。 |

### suggestion（4件中3件を適用・任意）

| # | 箇所 | 対応 | 内容 |
|---|---|---|---|
| 1 | 「環境構築」節のコードブロック（typeof/length確認） | 適用 | 表示コマンドと表示出力のラベル不一致を解消。`console.log('typeof v7=',...)` → `console.log('typeof randomUUIDv7 =', typeof c.randomUUIDv7)` 等、出力（execution-log 68-71行の整形済み出力）と一致するコマンドに修正。読者がコピペしても同じ結果になる。 |
| 2 | 9行目 前提コメント `<!-- 前提: ... -->` | 適用 | ドラフト用コメントを削除（機械的に安全な削除。出典追跡は本修正レポート・レビューレポートに残存）。 |
| 3 | 「参考リンク」Nodeドキュメント | 適用 | `docs/latest/api/...`（バージョン非固定）→ `docs/latest-v26.x/api/...` にバージョン固定。crypto は該当セクションアンカー `#cryptorandomuuidv7options` も付与。 |
| 4 | 各 `.mjs` コードブロック全般（ソース未記録） | スキップ | 次回以降ログにソースも残すべき、という将来向けの助言であり本記事への修正指示ではないため対応不要。出力・挙動はログと完全一致で創作の疑いは低い、と原レビューも判断。 |

## スキップ・未解消の指摘

- **warning #3（タイトル長）**: 上記のとおり体裁 WARN が残る（`wc -m` のバイト計数＋必須API名により60字目安を機械的には満たせない）。fail=0。誇大表現ではなく説明的なタイトルで、意味を保つ範囲で最大限短縮済み。再レビューの判断に委ねる。
- suggestion #4: 将来向け助言のためスキップ（上表参照）。

## セルフチェック結果（check-article.sh 再実行）

```
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=38 (12-50)
[WARN] title が長い: 74文字 (60字目安)
[PASS] コードフェンスが閉じている: フェンス行=34
[PASS] ::: ブロックが閉じている: 2 行
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[PASS] 秘密情報パターンの検出なし
SUMMARY fail=0 warn=1
```

- `published: false` を維持（確認済み）。
- 機械検出可能な指摘は title 長（体裁 WARN）を除きすべて PASS。fail=0。

## 捏造チェック

- 追記した事実はすべて出典ログ由来（`sqlite-order.mjs` の100%一致・distinct ms・別msに落ちる挙動）、またはNode公式リリースノート（v26.1.0 追加）による一次確認。ログ・公式に無い成功・数値・コード・画像は書き足していない。
- 未計測だった "2msおき" は書き足さず削除（削減方向）で対応した。

## 次のアクション

- `/review-article articles/node26-randomuuidv7-vs-v4-sqlite-order.md` で再レビューする。
- 公開可になったら `/publish-pr` へ（Front Matter を `published: true` にして PR 作成）。
