# 修正レポート: Node 26 の node:ffi で libc の strlen を呼んでみた / node26-ffi-libc-strlen-try

## 採用した前提

- 対象記事: `articles/node26-ffi-libc-strlen-try.md`（slug リネームなし）
- レビューレポート: `logs/review-node26-ffi-libc-strlen-try-20260715-0419.md`（判定: 要修正 / blocker 0・warning 3・suggestion 3）
- 出典ログ: `logs/run-node-ffi-20260715-0408/execution-log.md`
- 適用範囲: blocker ＋ warning（＋ 安全で機械的な suggestion のみ任意適用）
- slug リネーム: 指摘なしのため実施せず
- 過去の修正レポート: なし（本記事は初回の修正）

`published: false` を維持（最終確認済み）。

## 適用した修正

| # | 重大度 | 箇所 | 分類 | 対応 |
|---|---|---|---|---|
| 1 | warning | 参考リンク（旧 L403-407） | C 削減修正 | 未検証の推測 URL `https://nodejs.org/api/ffi.html` を本文の参考リンクから削除。出典ログが「docs を読む代わりに API サーフェスから直接確認」（execution-log.md L37）と明記しており、公式 URL の裏付けが無いため。捏造せず、「今回は公式ドキュメントを読まず API サーフェスで確認したため URL の裏付けは取れていない。公式を当たる場合はバージョン別ドキュメント（`nodejs.org/dist/latest-v26.x/docs/api/` 等）で確認を」という正直な記述に置き換えた。 |
| 2 | warning | 旧 L407 `要素材` マーカー | A 機械修正 | #1 と同一箇所。URL 確定後に残る `<!-- 要素材: ... -->` コメント行を削除。check-article で「要素材マーカーなし」を確認。 |
| 3 | warning | title（L2） | C 削減修正 | レビュー指摘の例示どおり、前半の「JS から」を削って副題を維持。`Node 26 の node:ffi で JS から libc の strlen を呼んでみた（BigInt と SIGSEGV に詰まった）` → `Node 26 の node:ffi で libc の strlen を呼んでみた（BigInt と SIGSEGV に詰まった）`。可視文字で約65字（レビュー目安の60〜80字圏内）。 |

### 任意適用した suggestion

| # | 箇所 | 対応 |
|---|---|---|
| suggestion 1 | 冒頭コメント（旧 L9） | 前提コメント `<!-- 前提: 出典ログ ... -->` を削除。公開版での消し忘れに見えるため。安全・機械的な削除のため任意適用した。 |

### スキップした suggestion（任意・未適用）

- **suggestion 2（コードブロック全文の完全一致照合）**: `.mjs` 全文は workspace（gitignore 対象）由来で完全一致の照合が不能。ただし出力（`5n`/`9n`/`42`/`139` 等）はすべて出典ログと一致しており、レビュー自身も「創作の疑いは低い／実害は小さい」と判断。捏造の追加も削除も不要と判断し、本文は変更していない。
- **suggestion 3（ターミナル出力のスクショ追加）**: 出典ログのスクショは0枚（CLI 検証のため妥当）。一次情報に存在しない画像を追加することは捏造にあたるため適用しない。

## 未解消の指摘

- **title 長（機械チェックの WARN が1件残存）**: `check-article.sh` は `wc -m` で計測しており、当環境のロケール下では日本語文字がバイト数で膨らんで数える（旧109→新99 と表示）。可視文字数では約65字で、レビューの目安「60〜80字」に収まっている。レビューは「副題は維持可・前半を圧縮」と指示しており、その例示を採用済み。これ以上の短縮は Node 26 / libc などの意味情報を失うため行わない。warning のみのため適用済み修正を保存し、再レビューの判断に委ねる。

修正不能（blocker 含む）は無し。中止条件には該当しない。

## セルフチェック結果（check-article.sh 再実行）

```
== check-article: articles/node26-ffi-libc-strlen-try.md (slug=node26-ffi-libc-strlen-try) ==
[PASS] Front Matter を検出した
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=26 (12-50)
[PASS] slug は汎用語で始まっていない
[PASS] type=tech
[WARN] title が長い: 99文字 (60字目安)
[PASS] emoji あり: 🔌
[PASS] topics 4個
[INFO] /images 参照なし (ブラウザ表示を伴わない記事なら可)
[PASS] コードフェンスが閉じている: フェンス行=48
[PASS] ::: ブロックが閉じている: 8 行
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[PASS] 秘密情報パターンの検出なし
SUMMARY fail=0 warn=1
```

- 修正前: `SUMMARY fail=0 warn=2`（title 長・要素材マーカー）
- 修正後: `SUMMARY fail=0 warn=1`（title 長のみ。上記のとおり可視文字ではレビュー目安内）
- `published: false` を最終確認済み。

## 次のアクション

`/review-article articles/node26-ffi-libc-strlen-try.md` で再レビューし、公開可になったら `/publish-pr` へ。
</content>
</invoke>
