# 修正適用レポート: node26-ffi-libc-strlen-try

## 採用した前提

- 対象記事: `articles/node26-ffi-libc-strlen-try.md`（引数で明示）
- レビューレポート: `logs/review-node26-ffi-libc-strlen-try-20260715-0423.md`（引数で明示）
- 出典ログ: `logs/run-node-ffi-20260715-0408/execution-log.md`（引数で明示）
- 適用範囲: blocker ＋ warning（既定）。suggestion は安全で機械的なもののみ任意適用
- slug リネーム: なし（指摘なし）
- 修正日時: 2026-07-15 04:25
- 元判定: **要修正**（blocker 0 / warning 1 / suggestion 3）

## 指摘ごとの適用結果

### warning

| # | 箇所 | 分類 | 対応 | 内容 |
|---|---|---|---|---|
| 1 | Front Matter `title`（2行目） | C 削減修正 | **適用** | 副題「（BigInt と SIGSEGV に詰まった）」を削り、`title` を99文字→41文字（機械チェック上は59文字）に短縮。本文で BigInt/SIGSEGV には引き続き触れているため内容の欠落なし |

### suggestion

| # | 箇所 | 分類 | 対応 | 理由 |
|---|---|---|---|---|
| 1 | 参考リンク節（401行付近） | — | **スキップ（任意）** | 具体的な `node:ffi` ドキュメント URL は出典ログに無く、書き足すと捏造になる。レビューでも「無理に載せず現状の正直な断り書きのままでも可」とされており、既存の正直な断り書き（バージョン別 docs 配置への案内）を維持 |
| 2 | 事前に調べたこと（51行付近） | C 削減修正 | **適用** | 「`'uint64'` のような文字列でも通った」という直接証跡の薄い断定を削除。出典ログ（`types` 定数の値が `'uint64'` 等の文字列そのもの／短縮名 `'u64'` は実測で通過）に沿って「`types.*` 定数の実体が文字列定数なので、定数でも値の文字列でも同義」という表現へ寄せた。実測済みの短縮名 `'u64'` の記述は残置 |
| 3 | 全体（スクショ） | — | **対応不要** | CLI 検証でブラウザ表示が無く、ログでもスクショ0枚が正。レビューでも「対応不要」。変更なし |

## 適用した変更の詳細

1. **`title` の短縮（warning#1 / 分類C）**
   - 変更前: `Node 26 の node:ffi で libc の strlen を呼んでみた（BigInt と SIGSEGV に詰まった）`（99文字）
   - 変更後: `Node 26 の node:ffi で libc の strlen を呼んでみた`（41文字 / 機械チェック計測59文字）
   - BigInt・SIGSEGV の話題は本文「戻り値が `5` じゃなくて `5n`」「型が合っていてもアドレスが不正だと落ちる（SIGSEGV）」節で従来どおり扱われており、副題削除による情報欠落はない。

2. **型指定の記述をログ準拠へ（suggestion#2 / 分類C）**
   - 変更前: 「`types.*` 定数・`'uint64'` のような文字列・`'u64'` のような短縮名のどれでも通りました」
   - 変更後: 「`types.*` 定数でも `'u64'` のような短縮名でも通りました。なお `types.UINT_64` の実体は `'uint64'` という文字列定数なので、定数で書いても値の文字列そのもの（`'uint64'`）で書いても同義になります」
   - 根拠: 出典ログ フェーズ1（execution-log.md L56-57）「型は `types` 定数で指定する（値は文字列 `"uint64"` 等）」「短縮エイリアス `'u64'`/`'i32'` も受け付ける（実測）」。直接の実行証跡がある短縮名 `'u64'` は残し、`'uint64'` フルスペル文字列を独立に試した旨の断定は「定数値が文字列なので同義」という裏付けのある表現に置き換えた。

## セルフチェック結果（check-article.sh 再実行）

```
[PASS] published=false (ドラフト)
[PASS] title あり: 59文字        ← 変更前 [WARN] title が長い: 99文字
[PASS] コードフェンスが閉じている: フェンス行=48
[PASS] ::: ブロックが閉じている: 8 行
[PASS] 要素材マーカーなし
[PASS] 秘密情報パターンの検出なし
SUMMARY fail=0 warn=0            ← 変更前 fail=0 warn=1
```

- 機械チェックの唯一の warning（title 長超過）が解消。fail/warn ともに 0。
- `published: false` を維持（true 化していないことを確認）。

## 未解消・修正不能の指摘

- なし（warning は全件解消。suggestion#1 は任意スキップ、#3 は対応不要）。

## まとめ

- 修正後の記事パス: `articles/node26-ffi-libc-strlen-try.md`（**published: false のまま** / slug リネームなし）
- 適用: blocker 0 / warning 1（title 短縮）/ suggestion 1（型指定の表現をログ準拠に）
- スキップ: suggestion 1（参考リンクURL・任意）/ 対応不要 1（スクショ）
- セルフチェック: `SUMMARY fail=0 warn=0`
- 次のアクション: `/review-article articles/node26-ffi-libc-strlen-try.md` で再レビューし、公開可になったら `/publish-pr` へ
