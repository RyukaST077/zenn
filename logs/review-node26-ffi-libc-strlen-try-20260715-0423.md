# 公開前レビュー: Node 26 の node:ffi で libc の strlen を呼んでみた（BigInt と SIGSEGV に詰まった） / node26-ffi-libc-strlen-try

## レビューの前提

- 対象記事: articles/node26-ffi-libc-strlen-try.md
- 出典ログ: logs/run-node-ffi-20260715-0408/execution-log.md（引数で明示）
  - 付随して step-logs/*.txt・workspace/*.mjs も照合に使用
- レビュー日時: 2026-07-15 04:23
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準

## 判定

**判定: 要修正**

- blocker: 0 件 / warning: 1 件 / suggestion: 3 件
- 根拠（判定を決めた主な指摘）:
  - warning#1: `title` が 99 文字と長い（目安 60 字）。公開安全・事実整合はすべてクリアしており、
    blocker は無い。タイトルを目安内に収めれば「公開可」相当になる。

## 最優先で直すべき指摘（上位3件）

1. [warning] Front Matter `title`（2行目）— 99文字と長い。副題を削って60字前後に短縮する
   （例: 「Node 26 の node:ffi で libc の strlen を呼んでみた」＋本文で BigInt/SIGSEGV に触れる）。
2. [suggestion] 参考リンク節（401-403行）— 公式ドキュメントの URL が無い。正直に理由を書けており
   問題ではないが、Node 26 の `node:ffi` ドキュメント URL を1本添えると読者の裏取りが楽になる。
3. [suggestion] 事前に調べたこと（51行）— 「`'uint64'` のような文字列でも通りました」は step-logs 上に
   直接の実行証跡が無い（実測は `types.*` 定数と短縮名 `'u64'`）。ログにある範囲へ表現を寄せるか、
   文字列形は「定数の値が文字列なので同義」である旨に留める。

## 指摘一覧（重大度順）

### blocker

なし。

### warning

| # | 箇所（節/行） | 指摘 | 具体的な直し方 | 根拠 |
|---|---|---|---|---|
| 1 | Front Matter `title` / 2行目 | title が99文字で目安60字を超過（機械チェック [WARN]） | 副題「（BigInt と SIGSEGV に詰まった）」を落とすか短縮し、60字前後に収める。誇大表現ではないので必須度は低いが体裁として調整推奨 | check-article.sh: `title が長い: 99文字 (60字目安)` |

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | 参考リンク節 / 401-403行 | 公式ドキュメント URL が無い（理由は明記済み） | Node 26 系の `node:ffi` ドキュメント URL を1本添えると読者が仕様を裏取りしやすい。無理に載せず現状の正直な断り書きのままでも可 |
| 2 | 事前に調べたこと / 51行 | 型指定「文字列 `'uint64'` でも通った」は step-logs に直接の実行証跡が無い（実測は `types.*` 定数と短縮名 `'u64'`） | ログ準拠に寄せる（「`types` 定数の値が文字列そのものなので同義」等）と、事実整合がより厳密になる |
| 3 | 全体（スクショ） | 完了条件・詰まった点にスクショが無い | CLI 検証でブラウザ表示が無く、ログでもスクショ0枚が正（標準出力＋終了コードが証拠）。対応不要。念のため記録 |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | published=false / 秘密情報なし / slug 妥当（26字・一意）。ERR_ACCESS_DENIED のスタックトレースは個人パスを `file://.../workspace/...` に伏せてあり漏れなし |
| Front Matter | 要修正 | title 99字（warning#1）。type=tech / topics 4個 / emoji 🔌 は妥当 |
| 事実性（ログ照合） | OK | 全コード・出力・終了コード139・エラー全文が step-logs / workspace と一致（下記照合結果） |
| 画像 | OK | 画像参照なし＝ログと一致（CLI 検証） |
| Markdown構造 | OK | コードフェンス48行（偶数・閉）/ `:::` 8行（閉）/ H1 乱用なし・見出し順当 |
| 文章品質・トーン | OK | 経験談トーン、詰まった点が具体的、再現環境（macOS 26.5 arm64 / Node v26.5.0）明記 |
| 完成度 | OK | プレースホルダ・要素材マーカー残存なし。前提コメントの消し忘れもなし |

## 事実整合の照合結果（ログとの突合）

- 結論（達成/一部/未達）: 記事「`strlen('hello')`→`5n`、`abs(-42)`→`42` まで達成、3種の詰まりを経験」
  ↔ ログ結果サマリー「達成（`5n`/`42`＋フラグ忘れ/型ミス/Permission拒否の3種ログ取得）」 → **一致**
- 主要な出力の突合（すべて一致）:
  - `strlen("hello") = 5n / typeof = bigint / === 5n: true` … step2.txt と一致
  - `STRING arg strlen("日本語") = 9n` … step2.txt と一致
  - `abs(-42) = 42 / typeof = number` … step3.txt と一致
  - 型ミス4種 [1]〜[4] の TypeError 文言 … step4.txt と逐語一致
  - `0xdeadbeefn` で出力停止・終了コード **139**（SIGSEGV）… step4b.txt（exit=139）と一致
  - `using` 自動 close＋二重 close no-op … step5.txt と一致
  - `ERR_ACCESS_DENIED`（permission: 'FFI'）/ `SecurityWarning: --allow-ffi ...` … step6-perm-{denied,allowed}.txt と一致
- 掲載コード（step1/2/3/4/4b/5）は workspace/*.mjs の実物と一致（創作コードなし）
- 創作の疑いがある記述: なし。唯一 51行の「文字列 `'uint64'` でも通った」は直接証跡が薄い（suggestion#2）
- 残存する `要素材` マーカー: 0 件

## 機械チェック結果（scripts/check-article.sh）

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

## 次のアクション

- [ ] warning#1（title 短縮）を直す。suggestion は任意
- [ ] 直したら `/review-article` で再レビューする（`/revise-article` 経由でも可）
- [ ] 判定が「公開可」になったら Front Matter を `published: true` に変えて `git push`
      （「サイト内で既に使用されています」が出たら slug を具体化。
       knowledge/2026-07-01-zenn-slug-already-used.md）
