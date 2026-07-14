# 修正レポート: Bun 1.3 の Bun.SQL で SQLite を初めて触ってみた / bun-sql-sqlite-crud-try

## 採用した前提

- 対象記事: `articles/bun-sql-sqlite-crud-try.md`（slug リネームなし）
- レビューレポート: `logs/review-bun-sql-sqlite-crud-try-20260714-0417.md`
- 出典ログ: `logs/run-bun-sql-sqlite-20260714-0406/execution-log.md`
- 適用範囲: blocker ＋ warning（＋安全な suggestion）
- slug リネーム: なし（指摘なし）
- 修正日時: 2026-07-14 04:20
- 前回の修正レポート: なし（本記事に対する初回の revise）

## 元の判定

**要修正** — blocker: 0 件 / warning: 1 件 / suggestion: 3 件

## 指摘ごとの対応（適用 / スキップ）

| # | 重大度 | 箇所 | 分類 | 対応 | 内容 |
|---|---|---|---|---|---|
| 1 | warning | line 87 / line 176 | E 匿名化・マスク | **適用** | 個人のホームディレクトリ（ユーザ名 `katayamaryuunosuke` 込み）を 2 箇所とも `<user>` に置換。バージョン `1.3.14` とファイルサイズ `8192` の確認情報は保持 |
| 2 | suggestion | line 216・219 | C 削減修正（補足） | **適用** | 「全件(3件)」の件数根拠がこの時点の実データ（Alice 1件のみ）と噛み合わない点を prose で補足。stdout コードブロック（固定メッセージ）は一次情報として verbatim 維持し、prose 側で「固定メッセージであること／追加は後段」「文字列連結なら既存行に一致してしまうはず」を明記して整合させた |
| 3 | suggestion | 冒頭 line 9 | — | **スキップ** | 前提コメント `<!-- 前提: ... -->` は残存させた。理由: 本記事は `published: false` のドラフトであり、当コメントはレビュー／修正パイプラインが出典ログを辿るために利用している。レビュー側も「意図的なら維持でも可」としており、Zenn 上は非表示。公開直前（`/publish-pr`）で扱う想定 |
| 4 | suggestion | 全体 | — | **スキップ（対応不要）** | `alice@example.com` 等はサンプルメールデータで、機械チェックの空リンク疑いは false positive。レビューでも切り分け済み |

## 適用した修正の詳細

### warning #1: 個人パスのマスク（分類 E）

- line 87 環境構築の出力ブロック:
  - 変更前: `/Users/katayamaryuunosuke/.nvm/versions/node/v22.17.0/bin/bun`
  - 変更後: `/Users/<user>/.nvm/versions/node/v22.17.0/bin/bun`
- line 176 本編の `ls -la app.db` 出力:
  - 変更前: `-rw-r--r--@ 1 katayamaryuunosuke  staff  8192 Jul 14 04:09 app.db`
  - 変更後: `-rw-r--r--@ 1 <user>  staff  8192 Jul 14 04:09 app.db`
- いずれもユーザ名部分のみを一般化。バージョン確認・ファイル生成確認という記述の意図は保持している。

### suggestion #1: インジェクション節の件数説明を実データに整合（分類 C）

- stdout コードブロック（line 206-217）は一次ログ由来のため verbatim 維持。
- prose（line 219）を、この時点の INSERT 済みは Alice 1件のみで「(3件)」はスクリプトの固定メッセージである旨、
  および「文字列連結なら `WHERE id = 1 OR 1=1` に展開されて既存行に一致してしまうはず」という
  実データと整合する説明に書き換えた。捏造はなく、出典ログ line 149-153 の記述と一致。

## セルフチェック結果（check-article.sh 再実行）

```
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=23 (12-50)
[PASS] 画像あり: /images/bun-sql-sqlite-crud-try/01-bun-sql-users-table.png
[PASS] コードフェンスが閉じている: フェンス行=42
[PASS] ::: ブロックが閉じている: 2 行
[WARN] プレースホルダ/空リンクの疑い (example.com / 空リンク)  ← false positive（対応不要）
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[PASS] 秘密情報パターンの検出なし   ← 前回の [WARN] user-path が解消
SUMMARY fail=0 warn=1
```

- warning の user-path（line 87）は解消し、`[PASS] 秘密情報パターンの検出なし` に変化。
- 残る warn=1 は `example.com` の false positive（サンプルデータ）のみ。
- `published: false` を維持していることを最終確認済み。

## 未解消の指摘

- なし（blocker 0・有効 warning 0）。残 warn は false positive のみ。

## 結果サマリー

- 修正後の記事: `articles/bun-sql-sqlite-crud-try.md`（**published: false のまま** / slug リネームなし）
- 適用: blocker 0 / warning 1 / suggestion 1
- スキップ: suggestion 2（前提コメント維持＝意図的、false positive＝対応不要）
- 未解消: 0
- セルフチェック: `SUMMARY fail=0 warn=1`（残 warn は example.com の false positive）

## 次のアクション

- `/review-article articles/bun-sql-sqlite-crud-try.md` で再レビューし、公開可になったら `/publish-pr` へ。
