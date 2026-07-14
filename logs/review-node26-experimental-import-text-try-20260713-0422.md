# 公開前レビュー: Node 26.5 の text imports で .txt import に詰まった / node26-experimental-import-text-try

## レビューの前提

- 対象記事: articles/node26-experimental-import-text-try.md
- 出典ログ: logs/run-node-text-imports-20260713-0408/execution-log.md
- レビュー日時: 2026-07-13 04:22
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準

## 判定

**判定: 公開可**

- blocker: 0 件 / warning: 0 件 / suggestion: 3 件
- 根拠（判定を決めた主な指摘）:
  - 公開安全: `published: false`、slug 妥当（35字・汎用語でない・ローカル重複なし）、秘密情報なし。
  - 機械チェックの唯一の WARN（`user-path`）は、対象パスがすべて `/Users/.../workspace/...` と匿名化済みのため **false positive**。実ユーザー名は露出していない。
  - 事実整合: 本文のコマンド・エラー全文・出力・比較表がすべて出典ログの一次情報に裏付けられている。ログを超えた断定・創作コード・存在しない画像参照は検出されず。

## 最優先で直すべき指摘（上位3件）

1. [suggestion] 冒頭 line 9 `<!-- 前提: 出典ログ ... -->` — 公開前に削除すると読者向けの見た目が締まる（消し忘れ防止）。任意。
2. [suggestion] topics line 5 `"importattributes"` — `import-attributes` 等ハイフン区切りにすると Zenn 上の既存トピックと揃いやすい。任意。
3. [suggestion] 本編/詰まった点にスクショなし（CLI 検証なのでログ引用が証拠。ログでも「スクショ0枚」で整合）— 必要なら実行画面の1枚があると視覚的に分かりやすい。任意。

## 指摘一覧（重大度順）

### blocker

なし。

### warning

なし。

（機械チェックの WARN `user-path` は目視の結果 false positive と判断し warning から除外。詳細は下記「機械チェック結果」参照。）

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | line 9 前提コメント | `<!-- 前提: ... -->` が残っている | 公開版から消すと本文がすっきりする（消し忘れでなく意図的なら現状維持でも可） |
| 2 | line 5 topics | `importattributes` が連結語 | `import-attributes` 等にすると Zenn の既存トピックに寄せられる |
| 3 | 全体 | スクショ 0 枚 | CLI 検証で証拠はログ引用で足りているが、成功出力の1枚があると視覚的に映える |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | published=false / slug 35字・重複なし / 秘密情報なし（パスは匿名化済み） |
| Front Matter | OK | title 58字・type=tech・emoji 📄・topics 4個。誇大表現なし |
| 事実性（ログ照合） | OK | コマンド・エラー全文・出力・比較表・結論すべてログと一致。創作なし |
| 画像 | OK | 画像参照なし（CLI 検証記事・ログでもスクショ0枚で整合） |
| Markdown構造 | OK | フェンス50行（偶数・閉じ）、`:::` 4行（閉じ）、見出し階層破綻なし |
| 文章品質・トーン | OK | 経験談トーン・詰まった点が具体的・再現性（OS/バージョン）明記・冒頭に結論あり |
| 完成度 | OK | プレースホルダ・要素材マーカーなし。前提コメントのみ suggestion |

## 事実整合の照合結果（ログとの突合）

- 結論（達成/一部/未達）: 記事「`.txt` を import で読むところまでは動きました」（まとめ line 341）↔ ログ「完了条件の判定: **達成**（4条件すべて）」（結果サマリー）→ **一致**。
- 主要な突合（すべて裏付けあり）:
  - フラグ無し `ERR_UNKNOWN_FILE_EXTENSION` 全文（記事 line 124-144 ↔ ログ line 98-118）→ 一致。
  - 「フラグ無し／属性無し／type:json 誤記が同一エラーに集約」（記事 line 171 ↔ ログ line 145「重要な実測」）→ 一致。核の学びが実測裏付けあり。
  - `missing` の `ERR_MODULE_NOT_FOUND` 全文（記事 line 182-203 ↔ ログ line 146-166）→ 一致。
  - named import の `SyntaxError`（記事 line 222-234 ↔ ログ line 175-187）→ 一致。
  - inspect の出力 typeof string / length 104 / JSON.stringify（記事 line 254-261 ↔ ログ line 196-205）→ 一致。
  - fs 版 string / length 104（記事 line 281-289 ↔ ログ line 216-224）→ 一致。
  - JSON 版 パース済みオブジェクト（記事 line 307-318 ↔ ログ line 233-244）→ 一致。
  - 比較表（記事 line 324-333 ↔ ログ line 249-258）→ 完全一致。
  - nvm 導入出力・`v22.17.0`→`v26.5.0`（記事 line 33-60 ↔ ログ line 49-76）→ 一致。
- 創作の疑いがある記述: なし。本文のコード・出力・数値はすべてログ由来。
- 残存する `要素材` マーカー: 0 件。

## 機械チェック結果（scripts/check-article.sh）

```
== check-article: articles/node26-experimental-import-text-try.md (slug=node26-experimental-import-text-try) ==
[PASS] Front Matter を検出した
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=35 (12-50)
[PASS] slug は汎用語で始まっていない
[PASS] type=tech
[PASS] title あり: 58文字
[PASS] emoji あり: 📄
[PASS] topics 4個
[INFO] /images 参照なし (ブラウザ表示を伴わない記事なら可)
[PASS] コードフェンスが閉じている: フェンス行=50
[PASS] ::: ブロックが閉じている: 4 行
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[WARN] 秘密情報の疑い [user-path] (散文か目視確認) at line 129,188,200,225
SUMMARY fail=0 warn=1
```

### WARN の切り分け（false positive）

`[WARN] user-path at line 129,188,200,225` はエラースタックトレース中のファイルパスを検出したもの。
該当箇所はすべて `/Users/.../workspace/...` の形で **ユーザー名が `...` に匿名化済み**（`grep -E '/Users/[^./]'` で実名パスは0件）。
個人情報・ローカル環境の特定情報は露出していないため、blocker/warning には該当しない。**目視により警告を無効化**した。

## 適用した修正（修正適用時のみ）

なし（レポートのみ・非破壊）。

## 次のアクション

- [x] blocker / warning はなし（suggestion 3件は任意）
- [ ] （任意）前提コメント削除・topics のハイフン化などを反映
- [ ] 判定が「公開可」のため、Front Matter を `published: true` に変えて `git push` で公開してよい
      （「サイト内で既に使用されています」が出たら slug を具体化。
       knowledge/2026-07-01-zenn-slug-already-used.md）
