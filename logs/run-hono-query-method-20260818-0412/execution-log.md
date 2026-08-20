# 検証ログ: Hono 4.13 の `app.query()` で QUERY サーバーを立て、curl / Node fetch / ブラウザ fetch のどこで落ちるか確かめる

> Zenn記事の素材。実行の一次情報（コマンド・エラー全文・所要時間・スクショ）を記録。
> 記事本文は未執筆。「記事への写像」を見て articles/*.md に展開する。

## 実行の前提（採用した前提）

- 対象タスク: `practice/practice-hono-query-method-20260818-0409.md`
- 出典レポート: `research/search-topic-20260818-0400.md`
- 対象技術: HTTP QUERY メソッド（RFC 10008）/ Hono v4.13.2 の `app.query()` ・`hono/method-not-allowed` /
  `hono/cors` / `hono/etag` / `@hono/node-server` 2.1.1 / Node の `fetch`（undici）/ Chromium 149
- 実行者: AIエージェント単独（非対話） <!-- 内部メタ: 記事に転記しない -->
- 実行日時 / 所要時間: 2026-08-18 04:12〜04:23 / 見積もり 405分（約6h45m）→ 実測 **488秒（約8分）**
  <!-- 実測はAI単独の値。記事にそのまま書かない -->
- 実行環境: macOS 26.5 / arm64 (Darwin 25.5.0) / Node v22.17.0（同梱 undici 6.21.2）/ npm 10.9.2 /
  curl 8.7.1 / Playwright 1.61.1（Chromium 149.0.7827.55）
- 採用した撤退ライン: 対象タスクの「想定リスク・注意点」の撤退ラインをそのまま採用
  （2-4 の疎通に60分／Playwright 起動に30分／undici 差し替えで差が出なければ重心を 4-1・4-3 へ移す）。
  **いずれも発動しなかった**（すべてのタスクが完走）。
- 判断方針: 引数で渡されたのは対象タスクファイルのパスのみ。実行時間・撤退ライン・成果物の置き場は
  すべて `run-practice` のデフォルト前提を採用した（成果物コードは
  `logs/run-hono-query-method-20260818-0412/workspace/`）。
- 実行環境の担保: 課金APIキー・サインアップ・手動デプロイ・外部SaaSは一切使っていない。
  npm パッケージのローカル実行と Playwright（headless Chromium）のみ。テーマの差し替えも不要だった。

## 結果サマリー

- 完了条件の判定: **達成**（完了条件5件すべてを一次情報つきで確認。下表参照）
- 作ったもの: 1ファイルの QUERY サーバー `server.mjs`（ミドルウェアを環境変数で ON/OFF できる形）＋
  Node クライアント `client-node.mjs` ＋ ブラウザ用 `page.html` ＋ Playwright スクリプト `shot.mjs` ＋
  クロスオリジン用 `static-server.mjs`。すべて `workspace/` に置いた
- スクショ: **3枚**（`screenshots/`）
- 詰まった点: **5件**（うち解決 5 / 未解決・撤退 0）。ただし「詰まった」の中身は当初の想定と大きく違った（後述）
- knowledge 記録: **なし**。作業を止めるレベルのトラブルが発生しなかったため
  （`consult-knowledge` を引く場面もなかった）。唯一の警告 `EBADENGINE` は原因が自明で即解釈できた

### ⚠️ 検証前の予想が外れた（記事の山場がここで反転した）

対象タスクは「手元の Node 22.17.0 が同梱する undici は 6.21.2 なので、
**Hono 側は書けるのに Node の `fetch` からは送れない**ギャップが再現できる見込みが高い」を
検証の核心に置いていた。**これは外れた**。

- Node 22.17.0 同梱 `fetch`（undici 6.21.2）で `method: 'QUERY'` は **200 OK で普通に通った**
- undici 8.10.0 に差し替えても大文字 `QUERY` の結果は **同じ（200 OK）**
- 代わりに詰まったのは **GET+body**（3経路すべてで落ちる / しかも curl だけ「落ちずに黙って消える」）と
  **クロスオリジンの CORS プリフライト**だった

undici 6 と 8 の差は、追加で仕込んだ**小文字 `'query'` プローブ**でだけ観測できた（詳細は 4-2）。
記事の主結論は「送れない」ではなく「**もう送れる。落ちるのは別の場所**」に振る必要がある。

## 完了条件の検証

| # | 完了条件 | 判定 | 根拠（ログ / スクショ） |
|---|---|---|---|
| 1 | `curl -v -X QUERY .../search --data '{"q":"hello"}'` が 200 とJSONを返す | **達成** | `workspace/logs/curl-2-4-first.log`（初回）/ `workspace/logs/curl-query.log`（本番）。`< HTTP/1.1 200 OK` と `{"handler":"query",...}` |
| 2 | Node の `fetch(..., { method: 'QUERY' })` の結果が成功なら本文・失敗なら例外全文として記録されている | **達成**（結果は成功） | `workspace/logs/node-fetch.log`。先頭に `node v22.17.0` / `process.versions.undici: 6.21.2` を印字済み。QUERY は `status=200`、GET は `TypeError` 全文 |
| 3 | `curl -X POST .../only-get` が 405 を返し、`Allow` ヘッダの実値がログに残っている | **達成** | `workspace/logs/curl-405-after.log`。`HTTP/1.1 405 Method Not Allowed` / `allow: GET, HEAD`。`/search` へ DELETE では `allow: QUERY, GET, HEAD, POST` |
| 4 | Playwright でページを開き、QUERY 結果と OPTIONS プリフライトの有無がネットワークログに残り、スクショが1枚以上ある | **達成** | `workspace/logs/browser-same-origin.log` / `browser-cross-no-cors.log` / `browser-cross-with-cors.log`、スクショ3枚。プリフライトはサーバー側 `[wire]` ログで確認（`server-cross-no-cors.log` / `server-cross-cors.log`） |
| 5 | 3経路 × 3メソッドの結果表がすべて埋まっている | **達成** | 下記「最終成果の結果表」。6行 × 3列すべて実測値 |

## バージョン台帳（`workspace/versions.txt` の実測値）

```
node --version            → v22.17.0
process.versions.undici   → 6.21.2
process.versions.llhttp   → 9.3.0
npm --version             → 10.9.2
hono                      → hono@4.13.2
@hono/node-server         → @hono/node-server@2.1.1
undici（npm 追加分）       → undici@8.10.0（フェーズ4-2で追加）
playwright --version      → Version 1.61.1（Chromium 149.0.7827.55）
curl --version（1行目）    → curl 8.7.1 (x86_64-apple-darwin25.0) libcurl/8.7.1 (SecureTransport) LibreSSL/3.3.6 zlib/1.2.12 nghttp2/1.68.1
OS / arch                 → macOS 26.5 / arm64 (Darwin 25.5.0)
```

## 最終成果の結果表（フェーズ5-1）

対象は `http://localhost:3000/search`、ボディは `{"q":"hello"}`、`Content-Type: application/json`。

| クライアント \ メソッド | QUERY | GET + body | POST |
|---|---|---|---|
| curl 8.7.1 | **200** JSON。サーバーに `bodyLen=13` で届く | **200 だが body が消える**。curl は 13 バイト送っている（`Content-Length: 13`）のにハンドラ側は `bodyLen=0` | **200** JSON。`bodyLen=13` |
| Node 同梱 fetch（undici 6.21.2） | **200** JSON | **送信前に例外** `TypeError: Request with GET/HEAD method cannot have body.` | **200** JSON |
| undici 8.10.0 の fetch | **200** JSON（同梱版と差なし） | **送信前に例外**（同文言。スタックが `node_modules/undici/...` になるだけ） | **200** JSON |
| ブラウザ fetch（同一オリジン） | **200** JSON、`res.type = basic`、**プリフライトなし** | **送信前に例外** `TypeError: Failed to execute 'fetch' on 'Window': Request with GET/HEAD method cannot have body.` | **200** JSON |
| ブラウザ fetch（クロスオリジン / `cors()` 有） | **200** JSON、`res.type = cors`、**OPTIONS プリフライトあり → 204** | 同上（プリフライト以前にクライアントで例外） | **200** JSON。POST も `Content-Type: application/json` のためプリフライトが飛ぶ |
| ブラウザ fetch（クロスオリジン / `cors()` 無） | **失敗** `TypeError: Failed to fetch`。OPTIONS は飛んだが 405 → 本リクエストは飛ばず | 同上（クライアントで例外） | **失敗** `TypeError: Failed to fetch`（QUERY と同じ理由） |

### 追加プローブ（表に入らないが結論を決めた1行）

| クライアント | `method: 'query'`（小文字） | 結果 |
|---|---|---|
| Node 同梱 fetch（undici 6.21.2） | 正規化されず、ワイヤに `query` がそのまま出る | **400 Bad Request**（Hono には到達しない。Node の HTTP パーサが切る） |
| undici 8.10.0 の fetch | `QUERY` に正規化される | **200 OK**（`receivedMethod: "QUERY"`） |
| curl `-X query` | curl は文字列をそのまま送る | **400 Bad Request** + `Connection: close`。サーバー側ログに一切残らない |

**これが undici 6 → 8 の唯一観測できた差**。PR #5459 が `lib/core/util.js` の
normalized method records に QUERY を足したこと、そのものの現れ。

## タスク実行ログ（フェーズ別）

### フェーズ1: 事前調査（見積もり 45分 → 実測 約3分）

詳細メモは `workspace/phase1-notes.md`（検証前に書いたもの。結果が出てからも書き換えていない）。

- [x] 1-1. RFC 10008 の要点を3語とボディの扱いに絞って確認（見積もり 15分 → 実測 約1分）
  - 参照: https://http.dev/query
  - 拾えた一次情報（原文）:
    ```
    Safe / Idempotent / Cacheable いずれも yes
    "sends query content in the request body while preserving the safe and idempotent semantics of GET"
    Accept-Query: "declares the media types a server accepts for QUERY requests"（Structured Fields List 構文）
    "Cross-origin QUERY requests require a preflight OPTIONS request before the browser sends the actual request."
    キャッシュキー: "the request content and related metadata in addition to the target URI"
    ```
  - つまずいた理由・分かっていなかった前提: 最初は「GET にボディを付ければ実質同じ」だと思っていた。
    決定的な違いは **キャッシュキーにリクエストボディが入るかどうか**。GET はボディをキーに含めないので、
    GET+body は「同じ URL なら同じ結果」というキャッシュの前提を壊す。
    `Accept-Query` というヘッダの存在自体を知らなかった。
  - 記事に書きたい気づき: 「QUERY = GET+body に名前が付いたもの」ではなく
    「**ボディをキャッシュキーに含めていい**と初めて決めたメソッド」。ここが 3行まとめの芯になる。

- [x] 1-2. Hono v4.13.0 リリースノートで使うAPIの署名を書き出す（見積もり 15分 → 実測 約1分）
  - 参照: https://github.com/honojs/hono/releases/tag/v4.13.0
  - 読み取れた API:
    ```javascript
    app.query('/search', async (c) => {
      const conditions = await c.req.json()
      return c.json(await search(conditions))
    })

    import { methodNotAllowed } from 'hono/method-not-allowed'
    app.use(methodNotAllowed({ app }))

    app.use(methodNotAllowed({
      app,
      onMethodNotAllowed: (c, methods) =>
        c.json({ error: 'Method Not Allowed' }, 405, { Allow: methods.join(', ') }),
    }))
    ```
  - `methodNotAllowed({ app })` は **app 自身を渡す**のが特徴（ルータを見て許可メソッドを算出する）。
  - Cache(#5119) / ETag(#5111) / CORS(#5115) は「QUERY 対応した」という記述のみで新APIは無い。
    ＝ 既存の書き方のまま挙動が変わるタイプの変更。
  - **要確認として残した項目**: `Accept-Query` を Hono が自動で付けるかはリリースノートから読み取れない。
    書かれているのは「`hono/utils/headers` を IANA レジストリに同期し `Accept-Query` を既知の
    フィールド名に追加した」だけ。→ フェーズ3-2 / 追加プローブで実測した（**自動では付かない**）。

- [x] 1-3. undici issue #5454 / PR #5459 を確認し、手元の undici と突き合わせて予想を立てる（見積もり 15分 → 実測 約1分）
  - 実行したコマンド:
    ```bash
    node -p "JSON.stringify(process.versions,null,2)"
    npm view undici version
    npm view undici time --json
    npm view hono version
    npm view @hono/node-server version
    ```
  - 確認できた事実:
    - issue #5454（2026-06-27 起票）: "Undici lacks HTTP QUERY RFC 10008 QUERY method support,
      blocking safe/idempotent requests with bodies."
    - PR #5459 は **2026-07-02 に mcollina がマージ**、**undici v8.6.0** に入った。
      変更ファイル: `lib/core/util.js`（normalized method records に QUERY）/
      `lib/core/request.js`（QUERY を既定で idempotent 扱い）/ `lib/handler/redirect-handler.js` /
      `lib/handler/retry-handler.js`（retryable methods に QUERY）/
      `lib/web/fetch/constants.js`（fetch API の safeMethods に QUERY）
    - 一度 `safeHTTPMethods` に入れたが follow-up commit で外した。理由は
      「QUERY のレスポンスはリクエストボディに依存する(RFC 10008 §2.7)のに、cache/deduplicate
      interceptor のキャッシュキーはボディを見ないから」
    - `npm view undici time` 実測: `8.6.0` = 2026-07-02、最新 `8.10.0` = 2026-08-03。
      6.x 系最新は `6.28.0`（2026-07-24）、7.x 系は `7.29.0`（2026-07-24）。
      **6.x / 7.x への backport の有無は未確認（記事では断定しない）**
  - **検証前に立てた予想（そのまま残す / 答え合わせ用）**:
    1. curl の QUERY → 通る … **当たり**
    2. Node 同梱 fetch の QUERY → **落ちる**（自信6割。素通しされる可能性も残した）… **外れ（200で通った）**
    3. undici 8.10.0 の QUERY → 通る … 当たり（ただし同梱版と差が出ず、比較の意味が薄れた）
    4. GET+body → クライアントで `TypeError: Request with GET/HEAD method cannot have body` … **当たり**
    5. ブラウザ同一オリジン → 通る … 当たり
    6. ブラウザ クロスオリジン / cors 無 → OPTIONS が飛んで CORS エラー … **当たり**
    7. ETag + QUERY で 304、ボディを変えれば ETag も変わる … **当たり**
  - 予想リストに入れ**忘れて**いたが自分で注意点として書き足していたこと:
    「Node の HTTP **サーバー**側（llhttp 9.3.0）が QUERY を知らなければ Hono に届く前に
    400 で切られるかもしれない」。→ 大文字 QUERY は通ったが、**小文字 `query` はまさにこれで 400 になった**。
    書き足しておいたメモが後半で当たった形。
  - 記事に書きたい気づき: 「新機能が入った PR を読むときは、
    **何ができるようになったのか（送信可否）と、何が正しくなったのか（意味論・正規化）を分けて読む**」。
    #5459 は前者ではなく後者だった。

### フェーズ2: 環境構築（見積もり 55分 → 実測 約2分）

- [x] 2-1. `npm init -y` → `hono@4.13.2` / `@hono/node-server@2.1.1` をバージョン固定で入れる（見積もり 15分 → 実測 8秒）
  - 実行したコマンド:
    ```bash
    npm init -y
    npm i hono@4.13.2 @hono/node-server@2.1.1
    npm ls
    ```
  - 出力（全文）:
    ```
    added 2 packages, and audited 3 packages in 2s

    found 0 vulnerabilities
    exit=0
    elapsed: 2s
    workspace@1.0.0 /Users/.../logs/run-hono-query-method-20260818-0412/workspace
    +-- @hono/node-server@2.1.1
    `-- hono@4.13.2
    ```
  - 警告なし。想定していた詰まりポイント #2（`app.query is not a function` / 古い lockfile を拾う）は
    **発生しなかった**。バージョン固定で入れたのが効いた（＝ 予防できた詰まり）。
  - 依存が2パッケージだけで済むのは Hono の売りどおり。記事の「環境構築」節はこの `npm ls` を貼るだけで足りる。

- [x] 2-2. `versions.txt` にバージョン台帳を作る（見積もり 10分 → 実測 20秒）
  - 実行したコマンド:
    ```bash
    node --version; npm --version; node -p "JSON.stringify(process.versions,null,2)"
    npx playwright --version; curl --version | head -1; sw_vers -productVersion; uname -m
    ```
  - 最重要値: `undici: 6.21.2`。あわせて **`llhttp: 9.3.0`** も台帳に入れた（後半で効いた）。
  - 小さなつまずき: `npm ls` の出力を `tr -d ' \`+--'` で整形したら `@hono/node-server` の
    ハイフンまで消えて `@hono/nodeserver` になった。`sed` で直した。
    ログ整形で情報を壊すと再現性が落ちるので、バージョン名は素の出力を残すのが正しい。
  - 記事に書きたい気づき: QUERY のようにバージョン依存が強いテーマでは、`process.versions` を
    **丸ごと**貼るのが一番安全。`undici` だけ抜くと `llhttp` を見落とす。

- [x] 2-3. `server-min.mjs`（`app.query('/search')` だけ）で起動確認（見積もり 20分 → 実測 20秒）
  - 書いたコード（`workspace/server-min.mjs` 全文）:
    ```javascript
    import { Hono } from 'hono'
    import { serve } from '@hono/node-server'

    const app = new Hono()

    app.query('/search', async (c) => {
      const conditions = await c.req.json()
      return c.json({ ok: true, received: conditions })
    })

    serve({ fetch: app.fetch, port: 3000 }, (info) => {
      console.log(`[server-min] listening on http://localhost:${info.port}`)
    })
    ```
  - 起動ログ:
    ```
    [server-min] listening on http://localhost:3000
    ```
  - `app.query is not a function` は出なかった。`lsof -i :3000 -i :3001` で事前に空きを確認したので
    詰まりポイント #5（`EADDRINUSE`）も踏まなかった。

- [x] 2-4. `curl -X QUERY` で疎通確認（見積もり 10分 → 実測 10秒）
  - 実行したコマンド:
    ```bash
    curl -sv -X QUERY http://localhost:3000/search -H 'Content-Type: application/json' --data '{"q":"hello"}'
    ```
  - 出力（`workspace/logs/curl-2-4-first.log` 全文）:
    ```
    * Host localhost:3000 was resolved.
    * IPv6: ::1
    * IPv4: 127.0.0.1
    *   Trying [::1]:3000...
    * Connected to localhost (::1) port 3000
    > QUERY /search HTTP/1.1
    > Host: localhost:3000
    > User-Agent: curl/8.7.1
    > Accept: */*
    > Content-Type: application/json
    > Content-Length: 13
    >
    } [13 bytes data]
    * upload completely sent off: 13 bytes
    < HTTP/1.1 200 OK
    < Content-Type: application/json
    < Content-Length: 36
    < Date: Mon, 17 Aug 2026 19:16:34 GMT
    < Connection: keep-alive
    < Keep-Alive: timeout=5
    <
    { [36 bytes data]
    * Connection #0 to host localhost left intact
    {"ok":true,"received":{"q":"hello"}}
    ```
  - **一発で200**。撤退ライン（60分）にはまるで届かなかった。
    ここで「llhttp 9.3.0 は QUERY を知っている（少なくとも大文字なら通す）」ことも同時に分かった。
  - 既存技術と比べて感じた違い: サーバーを書く手間は `app.get` を `app.query` に変えるだけ。
    「新しいHTTPメソッドを喋るサーバー」を作るのが3行で終わるのは正直あっけない。
  - **レスポンスに `Accept-Query` は無い**（要確認だった項目の1つ目の答え）。

### フェーズ3: 実装・検証【本編】（見積もり 175分 → 実測 約4分）

- [x] 3-1. `server.mjs` を完成させる（見積もり 30分 → 実測 約1分）
  - `workspace/server.mjs`。環境変数でミドルウェアを ON/OFF する形にした
    （`MNA=1` methodNotAllowed / `ETAG=1` etag / `CORS=1` cors / `AQ=1` Accept-Query 手付け / `PORT`）。
    「入れる前と入れた後」を同じコードで撮り比べるため。
  - 全ハンドラで受信メソッド・ボディ・Content-Type をサーバー側に出す `dump()` を入れた:
    ```javascript
    async function dump(c, label) {
      const method = c.req.method
      const ct = c.req.header('content-type') ?? '(none)'
      const cl = c.req.header('content-length') ?? '(none)'
      let raw
      try {
        raw = await c.req.text()
      } catch (e) {
        raw = `<<body read threw: ${e.name}: ${e.message}>>`
      }
      console.log(
        `[server] ${label} method=${method} content-type=${ct} content-length=${cl} ` +
        `bodyLen=${String(raw).length} body=${JSON.stringify(raw)}`
      )
      return { method, ct, cl, raw }
    }
    ```
  - 起動ログ:
    ```
    [server] flags MNA=0 ETAG=0 CORS=0 PORT=3000
    [server] listening on http://localhost:3000
    ```
  - **GET ハンドラでボディを読もうとしたときの挙動（記事の小ネタ）**: 例外は出ない。
    `await c.req.text()` は静かに `''` を返す。詳細は 3-2。
  - 途中で足した最重要パーツ: 一番手前に置いた素の受信ログ `[wire]`。
    ```javascript
    app.use('*', async (c, next) => {
      console.log(
        `[wire] <-- ${c.req.method} ${new URL(c.req.url).pathname}` +
          ` origin=${c.req.header('origin') ?? '(none)'}` +
          ` acrm=${c.req.header('access-control-request-method') ?? '(none)'}` +
          ` acrh=${c.req.header('access-control-request-headers') ?? '(none)'}`
      )
      await next()
      console.log(`[wire] --> ${c.req.method} ${new URL(c.req.url).pathname} ${c.res.status}`)
    })
    ```
    これを入れた理由は 4-1 に書いた（Playwright が OPTIONS を拾わなかったため）。

- [x] 3-2. `curl -v` で QUERY / GET+body / POST の3本（見積もり 25分 → 実測 30秒）
  - 実行したコマンド:
    ```bash
    curl -sv -X QUERY http://localhost:3000/search -H 'Content-Type: application/json' --data '{"q":"hello"}' > logs/curl-query.log 2>&1
    curl -sv -X GET   http://localhost:3000/search -H 'Content-Type: application/json' --data '{"q":"hello"}' > logs/curl-get-body.log 2>&1
    curl -sv -X POST  http://localhost:3000/search -H 'Content-Type: application/json' --data '{"q":"hello"}' > logs/curl-post.log 2>&1
    ```
  - ステータス: QUERY = **200** / GET+body = **200** / POST = **200**。3本とも通る。
  - **GET+body の全文（`workspace/logs/curl-get-body.log`）— ここが今回の一番の発見**:
    ```
    * Host localhost:3000 was resolved.
    * IPv6: ::1
    * IPv4: 127.0.0.1
    *   Trying [::1]:3000...
    * Connected to localhost (::1) port 3000
    > GET /search HTTP/1.1
    > Host: localhost:3000
    > User-Agent: curl/8.7.1
    > Accept: */*
    > Content-Type: application/json
    > Content-Length: 13
    >
    } [13 bytes data]
    * upload completely sent off: 13 bytes
    < HTTP/1.1 200 OK
    < Content-Type: application/json
    < Content-Length: 104
    < Date: Mon, 17 Aug 2026 19:17:16 GMT
    < Connection: keep-alive
    < Keep-Alive: timeout=5
    <
    { [104 bytes data]
    * Connection #0 to host localhost left intact
    {"handler":"get","receivedMethod":"GET","contentType":"application/json","contentLength":"13","body":""}
    ```
  - サーバー側ログ（3本ぶん、全文）:
    ```
    [server] QUERY /search method=QUERY content-type=application/json content-length=13 bodyLen=13 body="{\"q\":\"hello\"}"
    [server] GET /search method=GET content-type=application/json content-length=13 bodyLen=0 body=""
    [server] POST /search method=POST content-type=application/json content-length=13 bodyLen=13 body="{\"q\":\"hello\"}"
    ```
  - **GET+body がそもそも送信されるか**への答え: **送信される**。
    curl は `-X GET --data` でも POST に化けず GET のまま、`Content-Length: 13` を付けて
    `upload completely sent off: 13 bytes` と 13 バイトを送っている。
    サーバーも `content-length: 13` を受け取っている。
    にもかかわらず `await c.req.text()` は **`''`（bodyLen=0）**。つまり
    **ボディはワイヤ上を通ったのに、フレームワークに届く前に捨てられている**。
    エラーもログも出ない。「200 が返るのにデータが無い」という一番デバッグしにくい形。
  - つまずいた理由・分かっていなかった前提: 詰まりポイント表 #4 は
    「ボディが届かない／勝手に POST になる」を予想していたが、実際は
    **どちらでもなく「届いているのに黙って捨てられる」**だった。
    `@hono/node-server` は Node の `IncomingMessage` から Fetch API の `Request` を組み立てるが、
    Fetch 仕様が「GET/HEAD は body を持てない」と定めているため、body 抜きの `Request` になる。
    つまり Node の生の HTTP レイヤでは届いていて、Fetch 互換レイヤの境界で消える。
  - 既存技術と比べて感じた違い: これが「GET+body で代用すればいい」が通らない実演。
    QUERY なら同じ 13 バイトが `bodyLen=13` でハンドラまで届く。**差はステータスコードではなく、
    ボディが残るか消えるか**。
  - 記事に書きたい気づき: 「GET+body は落ちない。**黙って空になる**」。
    サーバー側で受信メソッドとボディ長をログに出しておかないと絶対に気づけない。
    `dump()` を最初に仕込んでおいた判断がここで報われた。

- [x] 3-3. `client-node.mjs` で Node 同梱 fetch から QUERY（見積もり 30分 → 実測 40秒）
  - 実行したコマンド:
    ```bash
    node client-node.mjs builtin QUERY GET POST > logs/node-fetch.log 2>&1
    ```
  - 出力（`workspace/logs/node-fetch.log` 全文）:
    ```
    === client-node.mjs ===
    node --version           : v22.17.0
    process.versions.undici  : 6.21.2
    fetch impl               : Node 同梱 fetch (process.versions.undici=6.21.2)
    targets                  : QUERY, GET, POST

    ---------- QUERY http://localhost:3000/search ----------
    [OK] status=200 OK
    [OK] response headers:
           connection: keep-alive
           content-length: 145
           content-type: application/json
           date: Mon, 17 Aug 2026 19:17:40 GMT
           keep-alive: timeout=5
    [OK] body: {"handler":"query","receivedMethod":"QUERY","contentType":"application/json","body":"{\"q\":\"hello\"}","parsed":{"q":"hello"},"parseError":null}

    ---------- GET http://localhost:3000/search ----------
    [ERROR] typeof : object
    [ERROR] name   : TypeError
    [ERROR] message: Request with GET/HEAD method cannot have body.
    [ERROR] code   : undefined
    [ERROR] cause  : undefined
    [ERROR] stack  :
    TypeError: Request with GET/HEAD method cannot have body.
        at node:internal/deps/undici/undici:13510:13
        at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
        at async file:///Users/.../workspace/client-node.mjs:36:17

    ---------- POST http://localhost:3000/search ----------
    [OK] status=200 OK
    [OK] response headers:
           connection: keep-alive
           content-length: 102
           content-type: application/json
           date: Mon, 17 Aug 2026 19:17:40 GMT
           keep-alive: timeout=5
    [OK] body: {"handler":"post","receivedMethod":"POST","contentType":"application/json","body":"{\"q\":\"hello\"}"}
    ```
  - **予想（1-3 の #2）と合っていたか: 合っていない。外れた。**
    undici 6.21.2 でも `method: 'QUERY'` は 200 OK で通った。issue #5454 が
    「未対応」と言っていたのは「送れない」という意味ではなかった。
  - 効いた対処 / 追加でやったこと: 「なぜ通るのか」を確かめないと記事が
    「なんとなく動いた」で終わるので、**メソッド正規化のプローブ**を足した:
    ```bash
    node -e "const r = await fetch('http://localhost:3000/search', { method: 'query', headers: {'Content-Type':'application/json'}, body: JSON.stringify({q:'hello'}) }); console.log('status =', r.status); console.log('body   =', await r.text());"
    ```
    結果（`workspace/logs/node-fetch-lowercase.log`）:
    ```
    process.versions.undici = 6.21.2
    status = 400
    body   =

    === 比較: 小文字 'post' の場合 ===
    status = 200
    body   = {"handler":"post","receivedMethod":"POST","contentType":"application/json","body":"{\"q\":\"hello\"}"}
    ```
    小文字 `'query'` は **400**、小文字 `'post'` は **200**。
    ＝ undici 6.21.2 は POST を `POST` に正規化するが、`query` は正規化せず素通しする。
  - 400 の出どころを curl で切り分けた（`workspace/logs/curl-lowercase-query.log` 全文）:
    ```
    > query /search HTTP/1.1
    > Host: localhost:3000
    > User-Agent: curl/8.7.1
    > Accept: */*
    > Content-Type: application/json
    > Content-Length: 13
    >
    } [13 bytes data]
    * upload completely sent off: 13 bytes
    < HTTP/1.1 400 Bad Request
    < Connection: close
    <
    { [0 bytes data]
    * Closing connection
    ```
    サーバー側ログに**1行も残らない**。＝ Hono ではなく Node の HTTP パーサ（llhttp 9.3.0）が
    小文字メソッドを 400 + `Connection: close` で切っている。
  - つまずいた理由・分かっていなかった前提: 「fetch が新メソッドに対応する」の意味を誤解していた。
    fetch がメソッド文字列を弾くのは forbidden method（CONNECT / TRACE / TRACK）だけで、
    それ以外の有効なトークンはそのまま送る。だから未対応でも大文字 QUERY は通る。
    PR #5459 が足したのは「送れるようにする」ではなく
    「**正規化・idempotent 判定・リダイレクト時のメソッド保持・リトライ可否**を正しくする」ほう。
  - 記事に書きたい気づき: 「issue が『未対応』と言っていても、
    **何が未対応なのか**を確かめないと結論を間違える」。予想を外した過程がそのまま読み物になる。

- [x] 3-4. 同じクライアントで GET+body / POST も実行（見積もり 20分 → 実測 3-3 に同梱）
  - 3-3 の出力に3メソッドまとめて含まれている（上記全文）。
  - GET+body のエラーは予想どおり `TypeError: Request with GET/HEAD method cannot have body.`。
    **重要な違い**: これは**リクエストが飛ぶ前**（`new Request` の構築時）に落ちる。
    curl と決定的に違うのはここで、curl は送ってしまってサーバー側で消えるが、
    fetch はそもそも送らせない。同じ「GET+body はダメ」でも失敗の起きる場所が違う。
  - POST との対比: POST は3経路すべてで無条件に通る。QUERY を使う動機は
    「通るかどうか」ではなく「safe / idempotent / cacheable のままボディを送れるか」。

- [x] 3-5. `methodNotAllowed({ app })` で 405 と `Allow` を確認（見積もり 25分 → 実測 40秒）
  - 実行したコマンド:
    ```bash
    # 導入前（MNA=0）
    curl -si -X POST  http://localhost:3000/only-get
    curl -si -X QUERY http://localhost:3000/only-get --data '{}'
    # 導入後（MNA=1 で再起動してから）
    curl -si -X POST   http://localhost:3000/only-get
    curl -si -X QUERY  http://localhost:3000/only-get --data '{}'
    curl -si -X DELETE http://localhost:3000/only-get
    curl -si -X DELETE http://localhost:3000/search
    curl -si -X POST   http://localhost:3000/nope
    ```
  - **導入前**（`workspace/logs/curl-405-before.log`）: POST も QUERY も
    ```
    HTTP/1.1 404 Not Found
    Content-Type: text/plain; charset=UTF-8
    Content-Length: 13

    404 Not Found
    ```
  - **導入後**（`workspace/logs/curl-405-after.log`）:
    ```
    --- POST /only-get ---
    HTTP/1.1 405 Method Not Allowed
    allow: GET, HEAD
    content-type: text/plain; charset=UTF-8
    content-length: 18

    Method Not Allowed

    --- QUERY /only-get ---
    HTTP/1.1 405 Method Not Allowed
    allow: GET, HEAD

    --- DELETE /only-get ---
    HTTP/1.1 405 Method Not Allowed
    allow: GET, HEAD

    --- GET /only-get（正常系）---
    HTTP/1.1 200 OK
    only-get ok

    --- DELETE /search（query/get/post 定義済みのパス）---
    HTTP/1.1 405 Method Not Allowed
    allow: QUERY, GET, HEAD, POST

    --- POST /nope（未定義パス）---
    HTTP/1.1 404 Not Found
    ```
  - `Allow` ヘッダの**実際の文字列**: `/only-get` は `GET, HEAD`、`/search` は
    **`QUERY, GET, HEAD, POST`**。
    - **`QUERY` はちゃんと入る**（`app.query()` で定義したものが `Allow` に反映される）
    - **`HEAD` は自動で入る**（`app.head()` は書いていない。Hono/ミドルウェア側が足している）
    - 並び順は登録順（`query` → `get` → `post`）で、`HEAD` は `GET` の直後に挿さる
  - 導入時のエラー: なし。`app.use(methodNotAllowed({ app }))` を
    ルート定義より前に1行置くだけで動いた。
  - つまずいた理由・分かっていなかった前提: 「パスは在るがメソッドが無い」を 404 ではなく 405 で返すのは、
    ミドルウェアを入れないと**やってくれない**。QUERY のような新メソッドを混ぜると
    クライアント側は「404 = パスが無い」と「405 = メソッドが無い」を区別したいので、
    このミドルウェアは QUERY と相性がいい。
  - 記事に書きたい気づき: `Allow: QUERY, GET, HEAD, POST` の1行が
    「このサーバーは QUERY を喋る」ことの一番きれいな証拠になる。スクショより貼りやすい。

- [x] 3-6. `page.html` + Playwright で同一オリジン検証（見積もり 45分 → 実測 40秒）
  - 実行したコマンド:
    ```bash
    node shot.mjs "http://localhost:3000/page.html" ../screenshots/01-browser-same-origin.png
    ```
  - Playwright スクリプト（`workspace/shot.mjs`）の要点:
    ```javascript
    page.on('console', (msg) => console.log(`[console:${msg.type()}] ${msg.text()}`))
    page.on('pageerror', (err) => console.log(`[pageerror] ${err.name}: ${err.message}`))
    page.on('request', (req) => console.log(`[request ] ${req.method()} ${req.url()}`))
    page.on('requestfailed', (req) =>
      console.log(`[reqfail ] ${req.method()} ${req.url()} :: ${req.failure()?.errorText}`))
    page.on('response', async (res) => { /* status と access-control-* / allow / etag を出す */ })

    await page.goto(url, { waitUntil: 'load' })
    await page.waitForSelector('#done:not([hidden])', { timeout: 15000 })  // 3本の fetch 完了を待つ
    await page.waitForTimeout(300)
    await page.screenshot({ path: out, fullPage: true })
    ```
  - 出力（`workspace/logs/browser-same-origin.log` 全文）:
    ```
    chromium version: 149.0.7827.55
    [request ] GET http://localhost:3000/page.html
    [response] GET http://localhost:3000/page.html -> 200
    [request ] QUERY http://localhost:3000/search
    [response] QUERY http://localhost:3000/search -> 200
    [request ] POST http://localhost:3000/search
    [response] POST http://localhost:3000/search -> 200
    screenshot saved: ../screenshots/01-browser-same-origin.png
    --- rendered #result text ---
    QUERY → OK
    status: 200 OK
    type: basic
    body: {"handler":"query","receivedMethod":"QUERY","contentType":"application/json","body":"{\"q\":\"hello\"}","parsed":{"q":"hello"},"parseError":null}
    GET → FAILED
    TypeError: Failed to execute 'fetch' on 'Window': Request with GET/HEAD method cannot have body.
    stack: TypeError: Request with GET/HEAD method cannot have body.
        at http://localhost:3000/page.html:45:29
    POST → OK
    status: 200 OK
    type: basic
    body: {"handler":"post","receivedMethod":"POST","contentType":"application/json","body":"{\"q\":\"hello\"}"}
    ```
  - **リクエストのメソッド一覧**: `GET(page.html)` → `QUERY` → `POST`。**OPTIONS は出ていない**
    （同一オリジンなのでプリフライトなし）。
  - **ブラウザがそもそも `method: 'QUERY'` を受け付けるか**: 受け付ける。TypeError にならない。
    Chromium 149 で `res.type = 'basic'`、ステータス 200。
  - GET+body のブラウザ側エラーは Node とほぼ同じ文言だが、
    Chromium は `Failed to execute 'fetch' on 'Window': ` の接頭辞が付く。並べると面白い。
  - スクショ: `screenshots/01-browser-same-origin.png`
    （3枚のカードが緑・赤・緑で並び、QUERY 200 / GET 失敗 / POST 200 が読める状態）
  - 詰まりポイント #6（真っ白スクショ）の予防: `#done` を fetch 3本が終わってから
    `hidden` 解除する設計にして `waitForSelector('#done:not([hidden])')` で待った。
    **一度も真っ白を踏まなかった**ので撮り直し比較の素材は作れていない（未達というより不発）。
    `npx playwright install chromium` も不要だった（既存のブラウザをそのまま使えた）。

### フェーズ4: 深掘り・比較（見積もり 85分 → 実測 約2分）

- [x] 4-1. クロスオリジンで CORS プリフライトを踏ませる（見積もり 35分 → 実測 約1分）
  - 実行したコマンド:
    ```bash
    node static-server.mjs &                     # 3001 から page.html を配る
    # cors 無し（3000 は MNA=1 CORS=0）
    node shot.mjs "http://localhost:3001/page.html?base=http://localhost:3000" ../screenshots/02-browser-cross-origin-no-cors.png
    # cors 有り（3000 を MNA=1 CORS=1 で再起動）
    node shot.mjs "http://localhost:3001/page.html?base=http://localhost:3000" ../screenshots/03-browser-cross-origin-with-cors.png
    # プリフライトのヘッダ実値を直接見る
    curl -si -X OPTIONS http://localhost:3000/search \
      -H 'Origin: http://localhost:3001' \
      -H 'Access-Control-Request-Method: QUERY' \
      -H 'Access-Control-Request-Headers: content-type'
    ```
  - **`cors()` 無しのときのコンソールエラー全文**（`workspace/logs/browser-cross-no-cors.log`）:
    ```
    [request ] GET http://localhost:3001/page.html?base=http://localhost:3000
    [response] GET http://localhost:3001/page.html?base=http://localhost:3000 -> 200
    [request ] QUERY http://localhost:3000/search
    [console:error] Access to fetch at 'http://localhost:3000/search' from origin 'http://localhost:3001' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.
    [reqfail ] QUERY http://localhost:3000/search :: net::ERR_FAILED
    [console:error] Failed to load resource: net::ERR_FAILED
    [request ] POST http://localhost:3000/search
    [console:error] Access to fetch at 'http://localhost:3000/search' from origin 'http://localhost:3001' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.
    [reqfail ] POST http://localhost:3000/search :: net::ERR_FAILED
    [console:error] Failed to load resource: net::ERR_FAILED
    ```
    ページ側に出た例外は `TypeError: Failed to fetch`（QUERY / POST とも同文）。
  - **詰まった点（今回いちばん手が止まったところ）**: Playwright の `page.on('request')` は
    **OPTIONS プリフライトを一切拾わなかった**。上のログを見ると `QUERY` の行はあるのに
    `OPTIONS` の行が無い。「プリフライトが飛んでいないのか、拾えていないのか」が区別できない。
    - 効いた対処: **サーバー側に素の受信ログ（`[wire]`）を足して、Hono の一番手前で
      全リクエストを記録するようにした**。これで初めてプリフライトが可視化できた。
    - `cors()` 無しのサーバー側ログ（`workspace/logs/server-cross-no-cors.log` 全文）:
      ```
      [server] flags MNA=1 ETAG=0 CORS=0 PORT=3000
      [server] listening on http://localhost:3000
      [wire] <-- OPTIONS /search origin=http://localhost:3001 acrm=QUERY acrh=content-type
      [wire] --> OPTIONS /search 405
      [wire] <-- OPTIONS /search origin=http://localhost:3001 acrm=POST acrh=content-type
      [wire] --> OPTIONS /search 405
      ```
      **`acrm=QUERY`（`Access-Control-Request-Method: QUERY`）で OPTIONS が確かに飛んでいる**。
      405 で返したので本リクエストは飛ばず、ハンドラのログ（`[server] QUERY /search ...`）は1行も無い。
      ＝ RFC 解説の「QUERY は CORS safelisted ではない」がそのまま観測できた。
    - `cors()` 有りのサーバー側ログ（`workspace/logs/server-cross-cors.log` 全文）:
      ```
      [server] flags MNA=1 ETAG=0 CORS=1 PORT=3000
      [server] listening on http://localhost:3000
      [wire] <-- OPTIONS /search origin=http://localhost:3001 acrm=QUERY acrh=content-type
      [wire] --> OPTIONS /search 204
      [wire] <-- QUERY /search origin=http://localhost:3001 acrm=(none) acrh=(none)
      [server] QUERY /search method=QUERY content-type=application/json content-length=13 bodyLen=13 body="{\"q\":\"hello\"}"
      [wire] --> QUERY /search 200
      [wire] <-- POST /search origin=http://localhost:3001 acrm=(none) acrh=(none)
      [server] POST /search method=POST content-type=application/json content-length=13 bodyLen=13 body="{\"q\":\"hello\"}"
      [wire] --> POST /search 200
      ```
      **OPTIONS → 204 → 本リクエスト QUERY → 200** の2段が並ぶ。
  - **`Access-Control-Allow-Methods` の実値**（`workspace/logs/curl-preflight-with-cors.log` 全文）:
    ```
    HTTP/1.1 204 No Content
    access-control-allow-headers: content-type
    access-control-allow-methods: GET,HEAD,PUT,POST,DELETE,PATCH,QUERY
    access-control-allow-origin: *
    vary: Access-Control-Request-Headers
    Date: Mon, 17 Aug 2026 19:20:40 GMT
    Connection: keep-alive
    Keep-Alive: timeout=5
    ```
    **`QUERY` が Hono の `cors()` の既定リストに入っている**（リリースノートの #5115 が実測で裏取りできた）。
    オプション指定は一切していない。素の `cors()` だけで QUERY が通る。
  - ブラウザ側で観測したレスポンス（`workspace/logs/browser-cross-with-cors.log`）:
    ```
    [request ] QUERY http://localhost:3000/search
    [response] QUERY http://localhost:3000/search -> 200
               access-control-allow-origin: *
    ...
    QUERY → OK
    status: 200 OK
    type: cors
    ```
    同一オリジンでは `type: basic` だったのが、クロスオリジンでは **`type: cors`** になる。
  - 予想外だった副産物: **POST も同じようにプリフライトを踏んでいた**
    （`acrm=POST`）。`Content-Type: application/json` が CORS safelisted な
    content-type（`text/plain` / `application/x-www-form-urlencoded` / `multipart/form-data`）でないため。
    「QUERY だけがプリフライトを要求する」わけではない、という補足を記事に入れないと誤解を招く。
  - スクショ: `screenshots/02-browser-cross-origin-no-cors.png`（3枚とも赤カード / QUERY・POST が
    `Failed to fetch`）、`screenshots/03-browser-cross-origin-with-cors.png`
    （QUERY 緑・GET 赤・POST 緑 / `type: cors`）。**同じコードでオリジンだけ変えた差分**が2枚で見える。
  - 記事に書きたい気づき: 「**ブラウザの開発ツールや Playwright の request イベントに
    OPTIONS は出てこない**。プリフライトを確かめたければサーバー側でログを取るのが確実」。
    これは QUERY に限らず使える教訓なので、記事の中で独立した小節にできる。

- [x] 4-2. undici を 8.10.0 に差し替えて再実行（見積もり 30分 → 実測 40秒）
  - 実行したコマンド:
    ```bash
    npm i undici@8.10.0
    node client-node.mjs undici QUERY GET POST > logs/node-fetch-undici8.log 2>&1
    node -e "const { fetch } = await import('undici'); const r = await fetch('http://localhost:3000/search', { method: 'query', headers: {'Content-Type':'application/json'}, body: JSON.stringify({q:'hello'}) }); console.log('status =', r.status); console.log('body   =', await r.text());"
    ```
  - **インストール時の警告（全文）** — 記事に使える小さな詰まり:
    ```
    npm warn EBADENGINE Unsupported engine {
    npm warn EBADENGINE   package: 'undici@8.10.0',
    npm warn EBADENGINE   required: { node: '>=22.19.0' },
    npm warn EBADENGINE   current: { node: 'v22.17.0', npm: '10.9.2' }
    npm warn EBADENGINE }

    added 1 package, and audited 4 packages in 5s

    found 0 vulnerabilities
    ```
    undici 8.10.0 は **Node >= 22.19.0** を要求する。手元は 22.17.0 なので engine 不一致。
    警告のみでインストールは成功し、**実行も問題なくできた**。
  - **同じコードでの結果差（大文字 QUERY）**: **差なし**。
    - Node 同梱（undici 6.21.2）: `status=200`、body は `receivedMethod: "QUERY"`
    - npm undici 8.10.0: `status=200`、body は同じ
    - GET+body: どちらも `TypeError: Request with GET/HEAD method cannot have body.`（同文言）。
      違いはスタックだけ:
      ```
      # 同梱
      at node:internal/deps/undici/undici:13510:13
      # npm 版
      at new Request (/.../workspace/node_modules/undici/lib/web/fetch/request.js:524:13)
          at fetch (/.../workspace/node_modules/undici/lib/web/fetch/index.js:171:21)
          at fetch (/.../workspace/node_modules/undici/index.js:157:10)
      ```
      npm 版のほうが「どのファイルの何行目で弾かれたか」まで出るので原因を追いやすい。
      これは「同梱 fetch のスタックが読みにくい」という別の実感として記事に書ける。
    - POST: どちらも 200。
  - **差が出た唯一の点（小文字プローブ）**:
    ```
    # undici 6.21.2（同梱）
    status = 400
    body   =
    # undici 8.10.0（npm）
    status = 200
    body   = {"handler":"query","receivedMethod":"QUERY","contentType":"application/json","body":"{\"q\":\"hello\"}","parsed":{"q":"hello"},"parseError":null}
    ```
    `method: 'query'` を渡すと、8.10.0 は `QUERY` に正規化してから送るので通る。
    6.21.2 は正規化せず `query` のまま送り、Node のパーサ側で 400 になる。
    **PR #5459 の `lib/core/util.js`（normalized method records に QUERY 追加）が
    そのまま観測できた形**。
  - 撤退ラインの適用: 対象タスクは「差が出なかった場合は結論を『もう通る』側に振り、
    検証の重心を 4-1 と 4-3 に移す」と決めていた。**この分岐を実際に採用した**
    （だから 4-1 のプリフライト検証を厚めにやり、`[wire]` ログまで作り込んだ）。
  - つまずいた理由・分かっていなかった前提: 「バージョンを上げれば結果が変わる」という
    分かりやすい比較になるはずが、**大文字で書いていれば最初から通っていた**。
    差を見つけるには「仕様上どこが変わったか」を PR の diff から読んで、
    それを狙い撃ちするプローブを自分で設計する必要があった。
  - 記事に書きたい気づき: 「バージョン比較記事は、
    **差が出ない可能性を織り込んでおく**と書き切れる」。差が出なかったこと自体が
    『2026年8月時点では Node 22 系でも QUERY はもう送れる』という有用な結論になる。

- [x] 4-3. `etag()` を有効にして QUERY の 304 を確認（見積もり 20分 → 実測 30秒）
  - 実行したコマンド:
    ```bash
    MNA=1 ETAG=1 node server.mjs &
    # 1回目: ETag を取る
    curl -si -X QUERY http://localhost:3000/search -H 'Content-Type: application/json' --data '{"q":"hello"}'
    # 2回目: 同じボディ + If-None-Match
    curl -si -X QUERY http://localhost:3000/search -H 'Content-Type: application/json' \
      -H 'If-None-Match: "e11f281396606dc47048206a3857cd8970a978f4"' --data '{"q":"hello"}'
    # 3回目: ボディを変える
    curl -si -X QUERY http://localhost:3000/search -H 'Content-Type: application/json' --data '{"q":"world"}'
    # 4回目: ボディ違いに古い ETag を付ける（誤って304にならないか）
    curl -si -X QUERY http://localhost:3000/search -H 'Content-Type: application/json' \
      -H 'If-None-Match: "e11f281396606dc47048206a3857cd8970a978f4"' --data '{"q":"world"}'
    ```
  - 出力（`workspace/logs/curl-etag-1.log` / `curl-etag-2.log`）:
    ```
    === 1回目 QUERY {"q":"hello"} ===
    HTTP/1.1 200 OK
    content-type: application/json
    etag: "e11f281396606dc47048206a3857cd8970a978f4"
    content-length: 145

    === 2回目 同じボディ + If-None-Match ===
    HTTP/1.1 304 Not Modified
    etag: "e11f281396606dc47048206a3857cd8970a978f4"

    === 3回目 ボディを {"q":"world"} に変える ===
    HTTP/1.1 200 OK
    content-type: application/json
    etag: "a24aa2e69354ea6ff555d32d2c6214e7d00aafb0"
    content-length: 145

    === 4回目 ボディ違い(q=world) に q=hello の ETag を付ける ===
    HTTP/1.1 200 OK
    content-type: application/json
    etag: "a24aa2e69354ea6ff555d32d2c6214e7d00aafb0"
    content-length: 145

    === 参考: GET /search の ETag ===
    HTTP/1.1 200 OK
    etag: "962c8f34f839951e5f7912aa0b0a22ae7766114e"
    content-length: 98
    ```
  - `ETag` の実値: `"e11f281396606dc47048206a3857cd8970a978f4"`（`{"q":"hello"}` のとき）。
    2回目のステータスは **304 Not Modified**。QUERY でも条件付きリクエストが効く。
  - **ボディを変えたら ETag も変わるか**: 変わった
    （`e11f2813...` → `a24aa2e6...`）。さらに 4回目で「別ボディに古い ETag を付けても
    304 にならず 200 が返る」ことも確認した。＝ 取り違えは起きていない。
  - ただし注意して書くべき点: Hono の `etag()` は**レスポンス本文のハッシュ**から ETag を作る。
    今回はハンドラがリクエストボディをそのままレスポンスに含めているので、
    「ボディが違えば ETag も違う」が自動的に成立している。
    **「リクエストボディがキャッシュキーに入っている」ことの証明にはなっていない**。
    RFC 10008 が言うキャッシュキー（URI + リクエスト内容）の話とは層が違うので、
    記事では「レスポンスが違えば ETag が違う、という当たり前の確認まで」と限定する。
    リリースノートの #5119（Cache ミドルウェアがリクエスト内容の SHA-256 をキーにする）は
    **今回未検証**。
  - 既存技術と比べて感じた違い: POST では 304 も条件付きリクエストも普通は成立しない。
    「ボディを送るのに 304 が返る」のは QUERY ならではの光景で、
    `curl -si` の2行を並べるだけで伝わる。

### フェーズ5: 振り返り・記事化準備（見積もり 45分 → 実測 約2分）

- [x] 5-1. 3経路 × 3メソッドの結果表を作る（見積もり 20分 → 実測 約1分）
  - 上記「最終成果の結果表」。6行すべて実測で埋まった。
  - 表を作る過程で気づいて追加実行したもの:
    - 小文字メソッドのプローブ（undici 6 / undici 8 / curl の3通り）→ 唯一のバージョン差を発見
    - `curl -X OPTIONS` で `Access-Control-Allow-Methods` の実値を直接確認
    - `Accept-Query` を手で付けた場合の確認（下記）
    - `/search` へ DELETE を投げて `Allow: QUERY, GET, HEAD, POST` を確認
- [x] 5-2. 詰まった点の棚卸しと「記事への写像」の割り当て（見積もり 25分 → 実測 約1分）
  - 下記「詰まった点と解決過程」「記事への写像」の各表。

### 追加実測: `Accept-Query` ヘッダ（詰まりポイント #7 の答え）

- Hono 4.13.2 は `Accept-Query` を**自動では付けない**。
  `workspace/logs/curl-query.log`（素の QUERY レスポンス）を `grep -ic 'accept-query'` すると **0**。
- ハンドラで手で付ければ普通に出る（`AQ=1` で有効化）:
  ```javascript
  if (process.env.AQ === '1') {
    c.header('Accept-Query', 'application/json')
  }
  ```
  ```
  HTTP/1.1 200 OK
  accept-query: application/json
  content-type: application/json
  ```
  （`workspace/logs/curl-accept-query.log`）
- 記事では断定せず「手元では付かなかったので自分で付けた」と書く。
  リリースノートにあったのは「`hono/utils/headers` を IANA レジストリに同期して
  `Accept-Query` を既知のフィールド名に追加した」＝ 型・定数に入っただけ、という理解で整合する。

## 詰まった点と解決過程（記事の核）

| # | 詰まった点 | 原因 | 効いた対処 | 所要 | 解決/撤退 | 記事での活かし方 |
|---|---|---|---|---|---|---|
| 1 | **予想が外れた**: Node 同梱 fetch（undici 6.21.2）で QUERY が普通に 200 で通ってしまい、記事の柱にする予定だった「送れないギャップ」が消えた | fetch がメソッド文字列を弾くのは forbidden method（CONNECT/TRACE/TRACK）だけ。それ以外の有効なトークンは未対応でもそのまま送る。PR #5459 が足したのは「送信可否」ではなく正規化・idempotent 判定・リダイレクト保持・リトライ可否 | PR #5459 の変更ファイル一覧を読み、`lib/core/util.js`（メソッド正規化）を狙って**小文字 `'query'` プローブ**を自作。undici 6 = 400 / undici 8 = 200 という差を掘り出した | 約2分 | 解決 | **記事の山場**。予想 → 外れ → なぜ外れたか → 狙い撃ちで差を見つける、の流れをそのまま書く。「issue が『未対応』と言っていても何が未対応かを確かめる」 |
| 2 | **GET+body が「落ちずに黙って消える」**。curl は 13 バイト送り、サーバーも `Content-Length: 13` を受けているのに、ハンドラの `await c.req.text()` は `''` | `@hono/node-server` は Node の `IncomingMessage` から Fetch API の `Request` を組み立てる。Fetch 仕様が「GET/HEAD は body を持てない」と定めているため body 抜きの `Request` になる。生の HTTP レイヤには届いていて、Fetch 互換レイヤの境界で捨てられる | 全ハンドラに `dump()`（受信メソッド・Content-Type・Content-Length・**実際に読めたボディ長**をログ出力）を最初から仕込んでおいた。クライアント側の意図とサーバー側の実測を突き合わせて初めて分かった | 約1分（仕込みがあったので即判明） | 解決 | 「GET+body は代用にならない」の一番強い実演。**200 が返るのにデータが無い**という最悪のデバッグ体験。curl（送ってから消える）と fetch（送る前に例外）の失敗位置の違いも並べる |
| 3 | **Playwright の `page.on('request')` が OPTIONS プリフライトを拾わない**。ログに `QUERY` の行はあるが `OPTIONS` の行が無く、「飛んでいないのか拾えていないのか」が区別できなかった | プリフライトはブラウザが内部で発行するもので、ページのネットワークイベントとして公開されない（DevTools でも既定では見えないことがある） | **サーバー側の一番手前に素の受信ログ `[wire]` ミドルウェアを追加**し、`Origin` / `Access-Control-Request-Method` / `Access-Control-Request-Headers` を全リクエストで出す。これで `acrm=QUERY` の OPTIONS が可視化できた | 約2分 | 解決 | QUERY に限らず使える教訓なので独立した小節にする。「プリフライトを確かめたければサーバー側でログを取る」 |
| 4 | 小文字 `method: 'query'` で **400 Bad Request**。しかもサーバー側ログに1行も残らないので原因が分からない | HTTP メソッドは大文字小文字を区別するトークン。Node の HTTP パーサ（llhttp 9.3.0）が知らないメソッド名として 400 + `Connection: close` で切っている。Hono には到達しない | `curl -X query` で同じ 400 を再現し、「クライアント固有ではなくサーバー側パーサの挙動」と切り分けた。小文字 `'post'` は 200 になることと対比して「正規化されるメソッドとされないメソッドがある」と特定 | 約1分 | 解決 | undici 6 と 8 の差を見せる装置として使う。「ログに何も残らない 400 は、アプリより手前を疑う」 |
| 5 | undici 8.10.0 のインストールで `EBADENGINE`（required `node: >=22.19.0` / current `v22.17.0`） | undici 8.10.0 が Node 22.19.0 以降を engine 要求している。手元は 22.17.0 | 警告のみでインストールは成功し、実行も通ったのでそのまま進めた。**警告全文をログに残して「動いたが engine 不一致のまま」と明記** | 約10秒 | 解決（許容して進行） | 「新しい undici を古い Node に入れて試す」ときの現実。動いたが公式にサポートされた組み合わせではない、と断りを入れる材料 |

### 想定していたのに起きなかった詰まり（予測との差分 / これも素材）

| 詰まりポイント表の # | 予測 | 実際 |
|---|---|---|
| #1 | Node の fetch で QUERY が送れない = **記事の主題** | **起きなかった**。200 OK。主題を差し替える必要があった（→ 上の #1） |
| #2 | `app.query is not a function` / `hono/method-not-allowed` が解決できない | 起きなかった。最初からバージョン固定（`hono@4.13.2`）で入れたので予防できた |
| #4 | `curl -X GET --data` でボディが届かない／勝手に POST になる | **どちらでもなかった**。GET のまま送信され、届いてから捨てられた（→ 上の #2） |
| #5 | ポート 3000/3001 の `EADDRINUSE` | 起きなかった。事前に `lsof -i :3000 -i :3001` で空きを確認した |
| #6 | Playwright のブラウザ起動失敗 / スクショが真っ白 | 起きなかった。`npx playwright install chromium` も不要（既存ブラウザを流用）。`#done` セレクタ待ちで真っ白も予防。**撮り直し前後の比較スクショは作れていない** |
| #3 | クロスオリジンで CORS で落ちる | **起きた（予測どおり）**。ただし「拾えない OPTIONS」という別の詰まりが上に乗った（→ 上の #3） |

## スクリーンショット一覧

| ファイル | 何を示すか | 使う見出し |
|---|---|---|
| `screenshots/01-browser-same-origin.png` | 同一オリジン（3000 → 3000）。QUERY 緑=200 / GET+body 赤=`Request with GET/HEAD method cannot have body.` / POST 緑=200。`type: basic`。プリフライトなし | 5. 実際に試したこと（ブラウザ経路） |
| `screenshots/02-browser-cross-origin-no-cors.png` | クロスオリジン（3001 → 3000）で `cors()` 無し。3枚とも赤。QUERY / POST は `TypeError: Failed to fetch` | 6. 詰まった点（CORS）／7. 結果表の補足 |
| `screenshots/03-browser-cross-origin-with-cors.png` | 同じページ・同じコードで `cors()` 有り。QUERY 緑=200 / POST 緑=200、`type: cors` に変わる | 6. 詰まった点（CORS の解決）／9. 今すぐ使えるのか |

02 と 03 は**ページのコードを1文字も変えずサーバー側のミドルウェアだけ切り替えた**ので、
並べると「同じコードがサーバー設定次第で結果が変わる」が一目で分かる。

## 記事への写像（実績で埋める）

| 記事の見出し | 使う記録 / スクショ | 書くこと（メモ） |
|---|---|---|
| 1. はじめに | 前提・動機 / `phase1-notes.md` | 「RFC 10008 で QUERY が標準化された」を見て手元で確かめたくなった。**予想を先に書いて後で答え合わせする構成**にすると宣言しておく |
| 2. なぜQUERYメソッドを試すのか | 1-1 の3行まとめ（本ログ フェーズ1 / `phase1-notes.md`） | GET+body と POST の穴。芯は「**ボディをキャッシュキーに含めていいと初めて決めたメソッド**」。safe / idempotent / cacheable の3語 |
| 3. 事前に調べたこと | 1-1 / 1-2 / 1-3。特に **1-3 の予想7項目をそのまま貼る** | http.dev/query の原文引用、Hono リリースノートの API 3ブロック、PR #5459 の変更ファイル一覧と v8.6.0（2026-07-02）。undici 6.21.2 との突き合わせ。**「Node の fetch では落ちると思う（自信6割）」を明記して伏線に** |
| 4. 環境構築 | 「バージョン台帳」ブロック丸ごと / 2-1 の `npm ls` 出力 / 2-3 の `server-min.mjs` 全文 | `npm i hono@4.13.2 @hono/node-server@2.1.1` と `npm ls`（依存2つ）。`process.versions` を丸ごと貼る（`undici` だけでなく `llhttp` も必要になる、と理由つきで） |
| 5. 実際に試したこと（curl → Node fetch → ブラウザ） | 2-4 と 3-2 の `curl -v` 全文（`logs/curl-2-4-first.log` / `curl-query.log` / `curl-get-body.log`）、3-3 の `logs/node-fetch.log` 全文、3-6 の `shot.mjs` 抜粋と `logs/browser-same-origin.log`、`screenshots/01` | **通った順に並べる**: curl QUERY → Node fetch QUERY → ブラウザ QUERY、全部 200。「サーバーを書くのは `app.get` を `app.query` にするだけで終わった」というあっけなさを先に置く |
| 6. 詰まった点 | 「詰まった点と解決過程」表の #1〜#5＋「起きなかった詰まり」表。エラー全文は 3-2 / 3-3 / 4-1 / 4-2 のブロック | 厚く書くのは **#2（GET+body が黙って消える）と #3（OPTIONS が Playwright に出ない）**。当初の想定（#1 = undici 未対応）が空振りしたことも正直に。`[wire]` ミドルウェアのコードを貼る |
| 7. 触ってみて分かったこと（3経路の結果表） | 「最終成果の結果表」＋「追加プローブ」の小表 | 表を貼り、各セルの理由を1行ずつ。**小文字プローブの表が結論の証拠**なので必ずセットで |
| 8. GET+body / POST と比べて感じたこと | 3-2（curl の GET+body 全文とサーバー側 `bodyLen=0`）、3-4、4-3（ETag 304） | GET+body は「落ちない、空になる」。curl は送ってから消える / fetch は送る前に例外。ETag は QUERY でも 304 が返る（**ただし「リクエストボディがキャッシュキー」の証明ではない**と限定して書く。#5119 は未検証） |
| 9. どんな人に向いていそうか | 4-2 の比較（差なし＋小文字プローブの差）、4-1 の `cors()` 結果、3-5 の `Allow` | 「**サーバー側は今すぐ書ける**」（`app.query` 3行 + `Allow: QUERY, GET, HEAD, POST`）「**クライアントは大文字で書けば Node 22 系でも既に送れる**」「クロスオリジンなら `cors()` を入れるだけ（QUERY は既定リストに入っている）」。断定しない |
| 10. まとめ | 「未達・撤退した項目」「再現性メモ」 | 未検証範囲を明記: **プロキシ・CDN・HTTP/2以降の中継、Cache ミドルウェア(#5119)、undici 6.x/7.x への backport の有無、Chromium 以外のブラウザ**。結果は `node v22.17.0` / `undici 6.21.2` / `Chromium 149` に依存する、と限定 |

## 未達・撤退した項目

**完了条件はすべて達成。撤退ラインの発動もなし。** ただし以下は「やっていない／確かめられなかった」ので
記事では未検証と明記する。

- **Cache ミドルウェア（#5119、リクエスト内容の SHA-256 をキャッシュキーにする）**: 未検証。
  対象タスクの完了条件には含まれておらず、4-3 は ETag のみを対象としていたため。
  そのため「リクエストボディがキャッシュキーに入っている」ことは**今回証明できていない**
  （4-3 で確認できたのはレスポンス本文ハッシュ由来の ETag の挙動まで）。
- **undici 6.x / 7.x への PR #5459 backport の有無**: `npm view undici time` でリリース日は取れたが、
  6.28.0 / 7.29.0 に QUERY 対応が入っているかは確認していない。記事では断定しない。
- **Chromium 以外のブラウザ**: Playwright の Chromium 149 のみ。Firefox / WebKit は未検証。
- **プロキシ・CDN・HTTP/2 以降の中継**: すべて `localhost` の HTTP/1.1 直結。未検証。
- **詰まりポイント #6 の「真っ白スクショ撮り直し前後の比較」**: 予防策（`#done` セレクタ待ち）が
  最初から効いてしまい、失敗スクショを撮れなかった。記事には「予防した」として1行で書くしかない。
- **`Accept-Query` の正しい使い方**: 手で付けられることは確認したが（RFC 上サーバーが宣言するヘッダ）、
  どのレスポンス（200 / OPTIONS / 415）に付けるのが適切かは調べていない。

## 再現性メモ（記事に転記する用）

- OS / ランタイム / 主要ライブラリのバージョン:
  - macOS 26.5 / arm64（Darwin 25.5.0）
  - Node v22.17.0（同梱 undici **6.21.2** / llhttp **9.3.0**）/ npm 10.9.2
  - hono **4.13.2** / @hono/node-server **2.1.1** / undici（npm 追加）**8.10.0**
  - curl 8.7.1 / Playwright 1.61.1（Chromium 149.0.7827.55）
- 実行コマンドの並び（最短の再現手順）:
  ```bash
  mkdir query-demo && cd query-demo
  npm init -y
  npm i hono@4.13.2 @hono/node-server@2.1.1
  # server.mjs を置く（app.query('/search') + app.get/post + methodNotAllowed + cors + etag）
  node server.mjs &

  # 1. curl: QUERY / GET+body / POST
  curl -sv -X QUERY http://localhost:3000/search -H 'Content-Type: application/json' --data '{"q":"hello"}'
  curl -sv -X GET   http://localhost:3000/search -H 'Content-Type: application/json' --data '{"q":"hello"}'   # 200 だが bodyLen=0
  curl -sv -X POST  http://localhost:3000/search -H 'Content-Type: application/json' --data '{"q":"hello"}'

  # 2. 405 と Allow
  MNA=1 node server.mjs & curl -si -X DELETE http://localhost:3000/search   # allow: QUERY, GET, HEAD, POST

  # 3. Node fetch（大文字 QUERY は通る / 小文字 query は 400）
  node -e "const r = await fetch('http://localhost:3000/search',{method:'QUERY',headers:{'Content-Type':'application/json'},body:'{\"q\":\"hello\"}'}); console.log(r.status)"
  node -e "const r = await fetch('http://localhost:3000/search',{method:'query',headers:{'Content-Type':'application/json'},body:'{\"q\":\"hello\"}'}); console.log(r.status)"

  # 4. プリフライトのヘッダ実値
  CORS=1 node server.mjs &
  curl -si -X OPTIONS http://localhost:3000/search -H 'Origin: http://localhost:3001' \
    -H 'Access-Control-Request-Method: QUERY' -H 'Access-Control-Request-Headers: content-type'

  # 5. ETag で 304
  ETAG=1 node server.mjs &
  curl -si -X QUERY http://localhost:3000/search -H 'Content-Type: application/json' --data '{"q":"hello"}'
  curl -si -X QUERY http://localhost:3000/search -H 'Content-Type: application/json' \
    -H 'If-None-Match: "<1回目のETag>"' --data '{"q":"hello"}'
  ```
- 注意点（読者に関係する再現性情報）:
  - **HTTP メソッドは大文字で書く**。`method: 'query'`（小文字）は Node の HTTP パーサに
    400 Bad Request で切られ、アプリのログには何も残らない。undici 8.6.0 以降は正規化されるので通る。
  - **GET+body は 200 が返るがボディは消える**。サーバー側で受信ボディ長をログに出さないと気づけない。
  - **プリフライト（OPTIONS）は Playwright の `page.on('request')` や
    ブラウザのネットワークイベントには出てこない**。サーバー側でログを取る。
  - **`cors()` は素の呼び出しで QUERY を許可する**（既定の `Access-Control-Allow-Methods` が
    `GET,HEAD,PUT,POST,DELETE,PATCH,QUERY`）。オプション指定は不要。
  - **`Accept-Query` は Hono が自動で付けない**。必要なら `c.header('Accept-Query', ...)` で自分で付ける。
  - **`Content-Type: application/json` を付けると POST でもプリフライトが飛ぶ**。
    プリフライトは QUERY 固有の話ではない。
  - undici 8.10.0 は engine が `node >= 22.19.0`。Node 22.17.0 では `EBADENGINE` 警告が出る
    （今回は動いたが、サポートされた組み合わせではない）。
  - ポートは 3000（API）/ 3001（クロスオリジン用の静的配信）。占有されていれば読み替える。
  - 結論はすべて `node v22.17.0` / `undici 6.21.2` / `Chromium 149` / HTTP/1.1 直結での結果。

## 次のアクション（記事化）

- [ ] この execution-log.md の「記事への写像」に沿って `articles/hono-query-method-*.md` を作成する
      （`/draft-article`）。**記事の主題は「送れなかった」ではなく
      「もう送れる。落ちるのは GET+body と CORS だった」**に振る
- [ ] スクショ3枚を `images/<slug>/` に移し、`![](/images/<slug>/01-*.png)` の形で参照する
- [ ] 完了条件・詰まった点（#1〜#5）・結果表・追加プローブの小表を本文に落とす
- [ ] 「未達・撤退した項目」の未検証リストをまとめ節にそのまま書く（断定を避けるため）
