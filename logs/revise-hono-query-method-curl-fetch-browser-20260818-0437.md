# 修正適用: hono-query-method-curl-fetch-browser

## 採用した前提

- 対象記事: `articles/hono-query-method-curl-fetch-browser.md`（引数で明示 / `published: false` 維持）
- レビューレポート: `logs/review-hono-query-method-curl-fetch-browser-20260818-0433.md`（引数で明示。判定: 要修正 / blocker 0・warning 1・suggestion 5）
- 出典ログ: `logs/run-hono-query-method-20260818-0412/execution-log.md`（引数で明示。`workspace/logs/` の生ログも参照）
- 適用範囲: blocker ＋ warning ＋ suggestion（今回の suggestion はすべてログ由来で安全に適用できたため全件適用）
- slug リネーム: 指摘なし。リネームしていない
- 過去の修正レポート: `logs/revise-hono-query-method-*.md` は存在せず（初回修正。ループ再来なし）

## 適用した修正

| # | 重大度 | 箇所 | 分類 | 修正内容 | 根拠 |
|---|---|---|---|---|---|
| W1 | warning | はじめに L15 | C 削減修正 | 「一番自信があったのは」→「記事の柱にするつもりで、6割くらいの自信で立てていたのが」に置換。L93 の「自信6割」と整合 | ログ「予想 #2 …（自信6割。素通しされる可能性も残した）」／記事「記事に書きたい気づき」節の伏線指示 |
| S1 | suggestion | はじめに L15 | C 削減修正 | 「予想を紙に書いてから」→「予想をメモに書き出してから」。ログに無い媒体の具体を落とした | 実体は `workspace/phase1-notes.md`（ファイル存在を確認） |
| S2 | suggestion | 詰まった点（小文字 curl / ブラウザ・サーバーログ / プリフライト） | B ログ由来の補完 | 欠落していた行を生ログから復元: 小文字 curl に `> Accept: */*` と `{ [0 bytes data]`、クロスオリジンのブラウザログに末尾の `[console:error] Failed to load resource: net::ERR_FAILED`、サーバーログ2ブロックに `[server] listening on http://localhost:3000`、プリフライト応答に `Date:` / `Connection:` / `Keep-Alive:`。あわせて全文でない2箇所に「接続確立までの行は省略した抜粋」「QUERY の分だけ抜粋。この後 POST も同じ2段を踏んでいます」と明記 | `workspace/logs/curl-lowercase-query.log` / `browser-cross-no-cors.log` / `server-cross-no-cors.log` / `server-cross-cors.log` / `curl-preflight-with-cors.log` |
| S3 | suggestion | 参考リンク | B ログ由来の補完 | `https://github.com/nodejs/undici/issues/5454` と `https://github.com/nodejs/undici/pull/5459` を参考リンク節に追加 | ログ 1-3「undici issue #5454 / PR #5459 を確認」 |
| S4 | suggestion | 3経路 × 3メソッドの結果表（冒頭） | B ログ由来の補完 | 「7件中6件が当たりで、外れたのは #2 だけ」＋書き足した注意点が当たった旨の1段落を追加し、冒頭の答え合わせ構成を回収 | ログ「検証前に立てた予想（そのまま残す / 答え合わせ用）」の当たり外れ注記（#2 のみ外れ、他6件当たり） |
| S5 | suggestion | 環境構築 `npm ls` 出力 | E 匿名化の統一 | `/path/to/workspace` → `/.../workspace`。他ブロックの `/.../` 表記に統一 | 記事内の他ブロック（`/.../client-node.mjs` 等） |

## スキップ・未解消の指摘

なし。blocker 0 / warning 1 / suggestion 5 をすべて適用した。

## セルフチェック結果（scripts/check-article.sh 再実行）

```
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=36 (12-50)
[PASS] コードフェンスが閉じている: フェンス行=74
[PASS] ::: ブロックが閉じている: 6 行
[PASS] 要素材マーカーなし
[PASS] 秘密情報パターンの検出なし
SUMMARY fail=0 warn=1
```

- `[WARN] title が長い: 105文字` はレビューレポートで判定済みの false positive（`wc -m` のロケール依存によるバイト数。実測 55 文字）。修正対象としない
- `/Users/` の個人パス・`/path/to/` 表記の残存を grep で確認 → 0 件
- `published: false` のままであることを確認済み

## 次のアクション

- `/review-article articles/hono-query-method-curl-fetch-browser.md` で再レビュー
- 判定が「公開可」になったら `/publish-pr`
