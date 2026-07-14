# 公開前レビュー: Node 26 の node:ffi で JS から libc の strlen を呼んでみた（BigInt と SIGSEGV に詰まった） / node26-ffi-libc-strlen-try

## レビューの前提

- 対象記事: articles/node26-ffi-libc-strlen-try.md
- 出典ログ: logs/run-node-ffi-20260715-0408/execution-log.md
- レビュー日時: 2026-07-15 04:19
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準

## 判定

**判定: 要修正**

- blocker: 0 件 / warning: 3 件 / suggestion: 3 件
- 根拠（判定を決めた主な指摘）:
  - 公開安全（published=false / slug / 秘密情報）はすべてクリア。blocker なし。
  - warning: ①`要素材` マーカーが1件残存（未完成サイン）②参考リンクが「推測パス」で未検証 ③title が 109 文字と長い。
  - 事実整合は良好。記事の主張・コマンド・出力・終了コードはすべて出典ログに裏付けあり。ログを超えた成功の断定や創作数値は検出せず。

## 最優先で直すべき指摘（上位3件）

1. [warning] 参考リンク節（L403-407）— `https://nodejs.org/api/ffi.html` は末尾の `要素材` コメントが自認するとおり「推測パス」で未検証。実在URLを確認して確定するか、URLが確認できないなら「公式ドキュメント（要確認）」等に留めて推測URLを本文の参考リンクとして提示しない。あわせて `要素材` コメント（L407）を除去する。
2. [warning] `要素材` マーカー残存（L407）— 上記1と同一箇所。埋める（URL確定）か、当該コメント行を削除して未完成マーカーを消す。
3. [warning] title が 109 文字（目安60字）— L2。副題「（BigInt と SIGSEGV に詰まった）」は活きているので、前半を圧縮する（例: 「Node 26 の node:ffi で libc の strlen を呼んでみた（BigInt と SIGSEGV に詰まった）」）など60〜80字程度へ短縮を検討。

## 指摘一覧（重大度順）

### blocker

なし。

### warning

| # | 箇所（節/行） | 指摘 | 具体的な直し方 | 根拠 |
|---|---|---|---|---|
| 1 | 参考リンク L403-407 | 参考リンク `https://nodejs.org/api/ffi.html` が未検証の推測パス。ログはdocsを読まずAPIサーフェスから確認しており、公式URLの裏付けが無い | 実在URLを確認して確定する。確認できないなら推測URLを参考リンクとして貼らず「公式ドキュメント（バージョン別: nodejs.org/dist/latest-v26.x/docs/api/ で要確認）」等の記述に留める | 機械チェック[WARN]／L407 の `要素材` コメント／出典ログ（docs未読で API サーフェス確認） |
| 2 | L407 | `要素材` マーカーが1件残存（未完成サイン） | URL確定後、`<!-- 要素材: ... -->` コメント行を削除する | `scripts/check-article.sh`: 要素材マーカー1件 |
| 3 | title L2 | title が 109 文字で目安60字を大きく超過 | 前半を圧縮し60〜80字程度へ。副題は維持可 | 機械チェック[WARN] title 109文字 |

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | 冒頭コメント L9 | 前提コメント `<!-- 前提: 出典ログ ... -->` が残っている | 意図的なら可だが、公開版では消し忘れに見えるため削除するとより自然（消すかどうかは任意） |
| 2 | コードブロック各所（step2-strlen.mjs 等） | 貼られた `.mjs` 全文ソースはログに「コード要点」しか無く、workspace（gitignore対象）由来の完全一致は照合不能。ただし出力（`5n`/`9n`/`42`/`139` 等）はすべてログと一致しており創作の疑いは低い | 出力が裏付けられているため実害は小さいが、コードは実際に動かした版であることを保てば信頼性が上がる |
| 3 | 画像 | スクショ0枚（CLI検証のため妥当） | 詰まり節（特に SIGSEGV=139）はターミナル出力の画像があると臨場感が増す。任意 |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | published=false、slug 妥当（26字/重複なし/汎用語でない）、秘密情報・個人パス漏れなし（トレースの path は `.../workspace/` にマスク済み） |
| Front Matter | 要修正 | 必須フィールド揃い・type=tech・topics 4個は OK。title が長い（warning） |
| 事実性（ログ照合） | OK | 結論・コマンド・エラー全文・出力・終了コード139すべてログと一致。ログを超えた断定なし |
| 画像 | OK | /images 参照なし（CLI検証で妥当）。孤立画像なし |
| Markdown構造 | OK | コードフェンス48行で閉じ・`:::`8行で閉じ・見出し階層OK・壊れリンクなし |
| 文章品質・トーン | OK | 経験談トーン良好。詰まった点が具体的。再現性（OS/Node/arm64）明記 |
| 完成度 | 要修正 | `要素材`1件残存・推測URL（warning）。他プレースホルダなし |

## 事実整合の照合結果（ログとの突合）

- 結論（達成/一部/未達）: 記事「`strlen('hello')`→`5n`、`abs(-42)`→`42` まで達成、3種の詰まりを経験」 ↔ ログ結果サマリー「達成（`5n`/`42`＋3種の詰まりログ取得）」 → **一致**
- 主要な数値・出力の裏付け（すべて一致）:
  - `strlen("hello") = 5n / typeof = bigint` ↔ step2 ✓
  - `STRING arg strlen("日本語") = 9n` ↔ step2 ✓
  - `abs(-42) = 42 / typeof = number` ↔ step3 ✓
  - 型ミス4種（i32誤宣言で静かに number化 / `Cannot mix BigInt` / `Argument 0 must be a buffer...` / `Unsupported FFI type: banana`）↔ step4 ✓
  - `0xdeadbeefn` で SIGSEGV・終了コード **139** ↔ step4b ✓
  - `using` 自動close・二重close no-op ↔ step5 ✓
  - `ERR_ACCESS_DENIED`（permission: 'FFI'）/ `SecurityWarning: --allow-ffi must be used with extreme caution` ↔ フェーズ4 ✓
  - `No such built-in module: node:ffi` エラー全文 ↔ step1 ✓
- 創作の疑いがある記述: なし（数値・エラー文言・終了コードはすべてログ由来）。唯一、参考リンクの公式URLのみログに裏付けが無い（推測）→ warning#1。
- 残存する `要素材` マーカー: 1 件（L407, 参考リンクの正確なURL）

## 機械チェック結果（scripts/check-article.sh）

```
== check-article: articles/node26-ffi-libc-strlen-try.md (slug=node26-ffi-libc-strlen-try) ==
[PASS] Front Matter を検出した
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=26 (12-50)
[PASS] slug は汎用語で始まっていない
[PASS] type=tech
[WARN] title が長い: 109文字 (60字目安)
[PASS] emoji あり: 🔌
[PASS] topics 4個
[INFO] /images 参照なし (ブラウザ表示を伴わない記事なら可)
[PASS] コードフェンスが閉じている: フェンス行=48
[PASS] ::: ブロックが閉じている: 8 行
[WARN] 要素材マーカーが 1件残っている (未完成。埋めるか節を削る)
[PASS] プレースホルダ残りなし
[PASS] 秘密情報パターンの検出なし
SUMMARY fail=0 warn=2
```

## 適用した修正

なし（レポートのみ・非破壊）。

## 次のアクション

- [ ] warning 3件（参考リンクURL確定／`要素材`削除／title短縮）を直す
- [ ] 直したら `/review-article` で再レビューする
- [ ] 判定が「公開可」になったら Front Matter を `published: true` に変えて `git push`
      （「サイト内で既に使用されています」が出たら slug を具体化。
       knowledge/2026-07-01-zenn-slug-already-used.md）
