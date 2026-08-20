# 修正適用: hono-query-method-curl-fetch-browser

## 採用した前提

- 対象記事: `articles/hono-query-method-curl-fetch-browser.md`（引数で明示 / `published: false` 維持）
- レビューレポート: `logs/review-hono-query-method-curl-fetch-browser-20260818-0440.md`（引数で明示。**判定: 公開可** / blocker 0・warning 0・suggestion 5）
- 出典ログ: `logs/run-hono-query-method-20260818-0412/execution-log.md`（引数で明示。`workspace/logs/` の生ログ・`workspace/versions.txt` も照合に使用）
- 適用範囲: **suggestion のみ**（blocker / warning は 0 件のため必須修正なし）。安全かつ機械的で、ログで裏付けが取れる suggestion 1〜4 を任意適用した
- slug リネーム: 指摘なし。リネームしていない
- 過去の修正レポート: `logs/revise-hono-query-method-curl-fetch-browser-20260818-0437.md`（前回は warning 1・suggestion 5 を全件適用。**修正不能の項目はなく、同一指摘の再来もない**）

判定は既に「公開可」なので本来は修正不要。今回は公開を止めない任意改善として suggestion を適用した（記事の主旨・文体は変更していない）。

## 適用した修正

| # | 重大度 | 箇所 | 分類 | 修正内容 | 根拠 |
|---|---|---|---|---|---|
| S1 | suggestion | 結果表 冒頭（旧 L694） | A 機械修正 | 「冒頭に貼った予想の答え合わせ」→「『事前に調べたこと』で貼った予想の答え合わせ」。予想7項目の実際の掲載位置（「事前に調べたこと」節）と参照先を一致させた | 記事内の予想リスト位置（`### undici 側の状況` 末尾） |
| S2 | suggestion | 環境構築（旧 L121-130） | B ログ由来の補完 | 「丸ごと貼るのが安全です」の後に「以下は記事用に4キーだけ抜き出したもので、手元の台帳には全キーを残しています」を追記。主張（丸ごと残す）と掲載（4キー抜粋）の食い違いを解消 | `workspace/versions.txt` に `process.versions` の全キー（acorn / ada / icu / openssl 等を含む）が実在することを確認 |
| S3 | suggestion | 405 と Allow ヘッダ（404 応答ブロック） | B ログ由来の補完 | 欠落していた `Content-Length: 13` を生ログから復元し、直前の文に「（`Date` 以下のヘッダを落とした抜粋）」を明記 | `workspace/logs/curl-405-before.log`（`Content-Length: 13` / `Date:` / `Connection:` / `Keep-Alive:` を含む全文） |
| S3 | suggestion | ETag と 304（4回分の応答ブロック） | C 削減修正（注記） | 「応答は各回のステータス行と `etag` 行だけを抜粋しています」を追記。`content-type` / `content-length` / `Date` 等を落としている旨を明示 | `workspace/logs/curl-etag-1.log` / `curl-etag-2.log` |
| S4 | suggestion | ブラウザから（`page.html` のコードフェンス） | A 機械修正 | フェンスラベルを ```` ```javascript:page.html（script 部分） ```` → ```` ```javascript:page.html ```` に変更し、コード先頭に `// script 部分の抜粋` を追加。Zenn のファイル名表示に全角括弧が混ざらないようにした | Zenn のコードブロックファイル名記法 |

## スキップ・未解消の指摘

| # | 箇所 | 判断 | 理由 |
|---|---|---|---|
| S3（一部） | プリフライト応答ブロック（`curl -si -X OPTIONS` の 204） | **修正不要（指摘は誤り）** | 生ログ `workspace/logs/curl-preflight-with-cors.log` と記事の掲載内容を1行ずつ照合した結果、`access-control-allow-*` 4行・`vary`・`Date` / `Connection` / `Keep-Alive` まで**全文一致**で、末尾行の欠落は無かった。注記の追加は誤った断りになるため行っていない |
| S5 | （記事外）`scripts/check-article.sh` L94 の `wc -m` ロケール依存 | **未適用（記事外・スコープ外）** | 本 Skill の対象は記事ドラフトの修正であり、チェックスクリプトの改修は範囲外。`[WARN] title が長い: 105文字` は前回レビューでも誤検知と確定済み（実文字数 55 文字）。スクリプト側の修正は別途対応が必要 |

未解消の blocker / warning は 0 件。

## セルフチェック結果（scripts/check-article.sh 再実行）

```
== check-article: articles/hono-query-method-curl-fetch-browser.md (slug=hono-query-method-curl-fetch-browser) ==
[PASS] Front Matter を検出した
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=36 (12-50)
[PASS] slug は汎用語で始まっていない
[PASS] type=tech
[WARN] title が長い: 105文字 (60字目安)
[PASS] emoji あり: 🔎
[PASS] topics 5個
[PASS] 画像あり: 01-browser-same-origin.png / 02-browser-cross-origin-no-cors.png / 03-browser-cross-origin-with-cors.png
[PASS] コードフェンスが閉じている: フェンス行=74
[PASS] ::: ブロックが閉じている: 6 行
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[PASS] 秘密情報パターンの検出なし
SUMMARY fail=0 warn=1
```

- `[WARN] title が長い: 105文字` はレビューレポートで確定済みの誤検知（`wc -m` のロケール依存によるバイト数。実文字数 55 文字）。記事側は修正対象外
- `published: false` のままであることを確認済み
- `/Users/` の個人パス残存を grep → 0 件
- フェンス行数 74（偶数）・`:::` 6 行のまま。今回の編集で Markdown 構造は変わっていない

## 次のアクション

- `/review-article articles/hono-query-method-curl-fetch-browser.md` で再レビュー（前回判定は既に「公開可」）
- `/publish-pr` で公開（`published: true` にして PR 作成 → main へマージ）
- （記事外の宿題）`scripts/check-article.sh` に `export LC_ALL=ja_JP.UTF-8` を入れると title 長チェックの誤検知が全記事で解消する
