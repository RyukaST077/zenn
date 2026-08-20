---
title: "Hono 4.13 の app.query() で QUERY メソッドを試したら、詰まったのは別の場所だった"
emoji: "🔎"
type: "tech"
topics: ["hono", "nodejs", "http", "undici", "cors"]
published: false
---

<!-- 前提: 出典ログ logs/run-hono-query-method-20260818-0412/execution-log.md / 記事タイプ: 試してみた・検証ログ / slug: hono-query-method-curl-fetch-browser / published: false -->

## はじめに

HTTP に QUERY メソッドが標準化された（RFC 10008）という話を見て、Hono 4.13 に `app.query()` が入ったと知ったので手元で試してみました。GET にボディを付けたいという場面は前からあって、そのたびに POST で誤魔化していたので、専用のメソッドがあるならどう違うのか見たかったのがきっかけです。

試す前に予想をメモに書き出してから始めました。記事の柱にするつもりで、6割くらいの自信で立てていたのが「サーバー（Hono）は書けるけど、手元の Node 22.17.0 の `fetch` からは送れないだろう」という予想でした。これが外れます。Node からも普通に 200 が返ってきて、実際に詰まったのは GET+body とクロスオリジンの CORS プリフライトのほうでした。

この記事では、curl / Node の `fetch` / ブラウザの `fetch` という3経路から QUERY・GET+body・POST を投げて、どこで何が起きたかを記録します。

:::message
筆者は新人で、新しい HTTP メソッドを扱うのは初めてです。以下はすべて手元の Mac・`localhost` の HTTP/1.1 直結で確かめた範囲の話で、プロキシや CDN を挟んだ場合は分かりません。
:::

## 使ったもの・環境

- macOS 26.5 / arm64（Darwin 25.5.0）
- Node v22.17.0（同梱 undici 6.21.2 / llhttp 9.3.0）/ npm 10.9.2
- hono 4.13.2 / @hono/node-server 2.1.1
- undici 8.10.0（npm から追加。比較用）
- curl 8.7.1
- Playwright 1.61.1（Chromium 149.0.7827.55）

確かめたかったのは次の5つです。

1. `curl -X QUERY` で 200 と JSON が返るか
2. Node の `fetch(..., { method: 'QUERY' })` はどうなるか
3. `methodNotAllowed` を入れたときの 405 と `Allow` の実値
4. ブラウザから投げたときのプリフライトの有無
5. 3経路 × 3メソッドの結果表を全部埋める

## 事前に調べたこと

### RFC 10008 の QUERY

[http.dev の QUERY の解説](https://http.dev/query)を読みました。拾えたのはこのあたり。

```
Safe / Idempotent / Cacheable いずれも yes
"sends query content in the request body while preserving the safe and idempotent semantics of GET"
Accept-Query: "declares the media types a server accepts for QUERY requests"
"Cross-origin QUERY requests require a preflight OPTIONS request before the browser sends the actual request."
キャッシュキー: "the request content and related metadata in addition to the target URI"
```

読む前は「GET にボディを付ければ実質同じでしょ」と思っていました。決定的に違うのはキャッシュキーにリクエストボディが入るかどうかで、GET はボディをキーに含めないので、GET+body は「同じ URL なら同じ結果」というキャッシュの前提を壊します。QUERY は GET+body に名前が付いたものではなく、ボディをキャッシュキーに含めていいと初めて決めたメソッド、という理解になりました。`Accept-Query` というヘッダの存在自体も知りませんでした。

### Hono v4.13.0 のリリースノート

[v4.13.0 のリリースノート](https://github.com/honojs/hono/releases/tag/v4.13.0)から、使う API を書き出しました。

```javascript
app.query('/search', async (c) => {
  const conditions = await c.req.json()
  return c.json(await search(conditions))
})

import { methodNotAllowed } from 'hono/method-not-allowed'
app.use(methodNotAllowed({ app }))
```

`methodNotAllowed({ app })` は app 自身を渡すのが特徴で、ルータを見て許可メソッドを算出する作りになっています。Cache（#5119）/ ETag（#5111）/ CORS（#5115）は「QUERY 対応した」という記述だけで新しい API はありませんでした。既存の書き方のまま挙動が変わるタイプの変更です。

`Accept-Query` を Hono が自動で付けるかは、リリースノートからは読み取れませんでした（書かれているのは `hono/utils/headers` を IANA レジストリに同期して `Accept-Query` を既知のフィールド名に追加した、というところまで）。ここは後で実測しました。

### undici 側の状況

undici の issue #5454（2026-06-27 起票）が "Undici lacks HTTP QUERY RFC 10008 QUERY method support, blocking safe/idempotent requests with bodies." という内容で、対応する PR #5459 が 2026-07-02 にマージされ、undici v8.6.0 に入っています。変更ファイルはこのあたり。

```
lib/core/util.js              … normalized method records に QUERY
lib/core/request.js           … QUERY を既定で idempotent 扱い
lib/handler/redirect-handler.js
lib/handler/retry-handler.js  … retryable methods に QUERY
lib/web/fetch/constants.js    … fetch API の safeMethods に QUERY
```

一度 `safeHTTPMethods` に入れたものを follow-up commit で外していて、理由は「QUERY のレスポンスはリクエストボディに依存する（RFC 10008 §2.7）のに、cache/deduplicate interceptor のキャッシュキーはボディを見ないから」でした。

`npm view undici time` で見たリリース日は、8.6.0 が 2026-07-02、最新の 8.10.0 が 2026-08-03。6.x 系の最新は 6.28.0（2026-07-24）、7.x 系は 7.29.0（2026-07-24）です。6.x / 7.x に backport されているかは確認していません。

手元の Node 22.17.0 が同梱している undici は 6.21.2 なので、8.6.0 より前です。ここから立てた予想が次の7つ。

1. curl の QUERY → 通る
2. Node 同梱 fetch の QUERY → 落ちる（自信6割）
3. undici 8.10.0 の QUERY → 通る
4. GET+body → クライアントで `TypeError: Request with GET/HEAD method cannot have body`
5. ブラウザ同一オリジン → 通る
6. ブラウザ クロスオリジン / cors 無 → OPTIONS が飛んで CORS エラー
7. ETag + QUERY で 304、ボディを変えれば ETag も変わる

予想リストには入れ忘れていたけれど注意点として書き足していたのが「Node の HTTP サーバー側（llhttp 9.3.0）が QUERY を知らなければ Hono に届く前に 400 で切られるかもしれない」でした。これが後半で一部当たります。

## 環境構築

```bash
npm init -y
npm i hono@4.13.2 @hono/node-server@2.1.1
npm ls
```

```
added 2 packages, and audited 3 packages in 2s

found 0 vulnerabilities
workspace@1.0.0 /.../workspace
+-- @hono/node-server@2.1.1
`-- hono@4.13.2
```

依存は2つだけ。バージョンを固定して入れたので、`app.query is not a function` になる心配はありませんでした。

バージョン台帳は `process.versions` を丸ごと残しました。`undici` だけ抜き出すと `llhttp` を見落とすので、丸ごと貼るのが安全です（実際あとで llhttp のバージョンを見る場面が来ました）。以下は記事用に4キーだけ抜き出したもので、手元の台帳には全キーを残しています。

```json
{
  "node": "22.17.0",
  "llhttp": "9.3.0",
  "undici": "6.21.2",
  "v8": "12.4.254.21-node.26"
}
```

ここで一つ小さいミスをしました。`npm ls` の出力を `tr -d ' \`+--'` で整形したら `@hono/node-server` のハイフンまで消えて `@hono/nodeserver` になっていて、`sed` で直しました。バージョン名は素の出力を残すべきでした。

## まず最小構成で

`app.query('/search')` だけのサーバーを書いて起動確認しました。

```javascript:server-min.mjs
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

```bash
curl -sv -X QUERY http://localhost:3000/search -H 'Content-Type: application/json' --data '{"q":"hello"}'
```

```
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
{"ok":true,"received":{"q":"hello"}}
```

一発で 200。`app.get` を `app.query` に変えるだけで新しい HTTP メソッドを喋るサーバーができてしまうので、正直あっけなかったです。llhttp 9.3.0 が QUERY を（少なくとも大文字なら）通すことも、ここで同時に分かりました。レスポンスに `Accept-Query` は付いていません。

## 検証用サーバーを組む

比較のために、ミドルウェアを環境変数で ON/OFF できる1ファイルのサーバーにしました。同じコードのまま「入れる前／入れた後」を撮り比べたかったからです。

```javascript:server.mjs
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { methodNotAllowed } from 'hono/method-not-allowed'
import { etag } from 'hono/etag'
import { cors } from 'hono/cors'

const PORT = Number(process.env.PORT ?? 3000)
const app = new Hono()

if (process.env.CORS === '1') app.use('*', cors())
if (process.env.ETAG === '1') app.use('*', etag())
if (process.env.MNA === '1') app.use(methodNotAllowed({ app }))

// 受信したメソッド・ボディ・Content-Type をサーバー側で必ず出す
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

app.query('/search', async (c) => {
  const info = await dump(c, 'QUERY /search')
  let parsed = null
  let parseError = null
  try {
    parsed = JSON.parse(info.raw)
  } catch (e) {
    parseError = `${e.name}: ${e.message}`
  }
  return c.json({ handler: 'query', receivedMethod: info.method, contentType: info.ct, body: info.raw, parsed, parseError })
})

// app.get('/search') / app.post('/search') も同じ dump() を通す
// app.get('/only-get') は 405 + Allow の確認用に GET だけ定義

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[server] listening on http://localhost:${info.port}`)
})
```

この `dump()`、つまり「サーバーが実際に読めたボディの長さを出す」部分が、後で一番役に立ちました。

## curl から3メソッド

```bash
curl -sv -X QUERY http://localhost:3000/search -H 'Content-Type: application/json' --data '{"q":"hello"}'
curl -sv -X GET   http://localhost:3000/search -H 'Content-Type: application/json' --data '{"q":"hello"}'
curl -sv -X POST  http://localhost:3000/search -H 'Content-Type: application/json' --data '{"q":"hello"}'
```

ステータスは QUERY / GET+body / POST すべて 200。3本とも通ります。ところがサーバー側のログを見ると様子が違いました。

```
[server] QUERY /search method=QUERY content-type=application/json content-length=13 bodyLen=13 body="{\"q\":\"hello\"}"
[server] GET /search   method=GET   content-type=application/json content-length=13 bodyLen=0  body=""
[server] POST /search  method=POST  content-type=application/json content-length=13 bodyLen=13 body="{\"q\":\"hello\"}"
```

GET だけ `bodyLen=0` です。これが今回いちばん驚いたところなので、後で詳しく書きます。

## Node の fetch から

`client-node.mjs` を書いて、Node 同梱の `fetch` から3メソッド投げました。先頭にバージョンを印字しておくのが大事だと思ったので、`process.versions.undici` を出しています。

```javascript:client-node.mjs
let fetchImpl = globalThis.fetch
let implLabel = `Node 同梱 fetch (process.versions.undici=${process.versions.undici})`
if (which === 'undici') {
  const undici = await import('undici')
  fetchImpl = undici.fetch
}

for (const method of targets) {
  const init = {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: 'hello' }),
  }
  try {
    const res = await fetchImpl('http://localhost:3000/search', init)
    console.log(`[OK] status=${res.status} ${res.statusText}`)
    console.log('[OK] body:', await res.text())
  } catch (err) {
    console.log('[ERROR] name   :', err?.name)
    console.log('[ERROR] message:', err?.message)
    console.log('[ERROR] stack  :\n' + (err?.stack ?? '(no stack)'))
  }
}
```

結果です。

```
node --version           : v22.17.0
process.versions.undici  : 6.21.2

---------- QUERY http://localhost:3000/search ----------
[OK] status=200 OK
[OK] body: {"handler":"query","receivedMethod":"QUERY","contentType":"application/json","body":"{\"q\":\"hello\"}","parsed":{"q":"hello"},"parseError":null}

---------- GET http://localhost:3000/search ----------
[ERROR] name   : TypeError
[ERROR] message: Request with GET/HEAD method cannot have body.
[ERROR] stack  :
TypeError: Request with GET/HEAD method cannot have body.
    at node:internal/deps/undici/undici:13510:13
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    at async file:///.../client-node.mjs:36:17

---------- POST http://localhost:3000/search ----------
[OK] status=200 OK
[OK] body: {"handler":"post","receivedMethod":"POST","contentType":"application/json","body":"{\"q\":\"hello\"}"}
```

QUERY が 200 で通ってしまいました。予想2は外れです。undici 6.21.2 は PR #5459 が入る前のバージョンなのに、`method: 'QUERY'` が普通に送れています。

記事の柱にする予定だった「Hono 側は書けるのに Node からは送れないギャップ」が消えたので、ここでしばらく手が止まりました。

## ブラウザから

`page.html` を作って、QUERY / GET / POST を順に投げてカードに結果を並べる形にしました。Playwright で開いてスクショを撮ります。

```javascript:page.html
// script 部分の抜粋
for (const method of ['QUERY', 'GET', 'POST']) {
  const init = {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: 'hello' }),
  }
  try {
    const res = await fetch(`${base}/search`, init)
    const text = await res.text()
    add(method, true, [`status: ${res.status} ${res.statusText}`, `type: ${res.type}`, `body: ${text}`])
  } catch (err) {
    add(method, false, [`${err.name}: ${err.message}`, `stack: ${err.stack ?? '(none)'}`])
  }
}

document.getElementById('done').hidden = false
```

Playwright 側は、3本の fetch が終わってから `#done` の `hidden` を外す設計にして、それを待ってから撮っています。

```javascript:shot.mjs
page.on('console', (msg) => console.log(`[console:${msg.type()}] ${msg.text()}`))
page.on('request', (req) => console.log(`[request ] ${req.method()} ${req.url()}`))
page.on('requestfailed', (req) =>
  console.log(`[reqfail ] ${req.method()} ${req.url()} :: ${req.failure()?.errorText}`))

await page.goto(url, { waitUntil: 'load' })
await page.waitForSelector('#done:not([hidden])', { timeout: 15000 })
await page.screenshot({ path: out, fullPage: true })
```

同一オリジン（3000 → 3000）の結果。

```
chromium version: 149.0.7827.55
[request ] GET http://localhost:3000/page.html
[response] GET http://localhost:3000/page.html -> 200
[request ] QUERY http://localhost:3000/search
[response] QUERY http://localhost:3000/search -> 200
[request ] POST http://localhost:3000/search
[response] POST http://localhost:3000/search -> 200
```

```
QUERY → OK
status: 200 OK
type: basic
GET → FAILED
TypeError: Failed to execute 'fetch' on 'Window': Request with GET/HEAD method cannot have body.
POST → OK
status: 200 OK
type: basic
```

![同一オリジンで QUERY 200 / GET+body 失敗 / POST 200 が並んだ画面](/images/hono-query-method-curl-fetch-browser/01-browser-same-origin.png)

Chromium 149 も `method: 'QUERY'` を受け付けます。`res.type` は `basic`、同一オリジンなので OPTIONS は出ていません。GET+body のエラー文言は Node とほぼ同じで、`Failed to execute 'fetch' on 'Window': ` の接頭辞が付くだけでした。

## 詰まった点

### 予想が外れて、記事の柱がなくなった

undici 6.21.2 で QUERY が通った理由をちゃんと確かめないと「なんとなく動いた」で終わってしまうので、PR #5459 の変更ファイル一覧を読み直しました。

分かったのは、fetch がメソッド文字列を弾くのは forbidden method（CONNECT / TRACE / TRACK）だけで、それ以外の有効なトークンは知らないメソッドでもそのまま送るということ。だから対応前でも大文字 `QUERY` は送れます。PR #5459 が足したのは送信可否ではなく、正規化・idempotent 判定・リダイレクト時のメソッド保持・リトライ可否のほうでした。

それなら `lib/core/util.js` のメソッド正規化を狙えば差が出るはずなので、小文字 `'query'` を投げるプローブを書きました。

```bash
node -e "const r = await fetch('http://localhost:3000/search', { method: 'query', headers: {'Content-Type':'application/json'}, body: JSON.stringify({q:'hello'}) }); console.log('status =', r.status); console.log('body   =', await r.text());"
```

```
process.versions.undici = 6.21.2
status = 400
body   =

=== 比較: 小文字 'post' の場合 ===
status = 200
body   = {"handler":"post","receivedMethod":"POST","contentType":"application/json","body":"{\"q\":\"hello\"}"}
```

小文字 `'query'` は 400、小文字 `'post'` は 200。undici 6.21.2 は POST を `POST` に正規化するけれど、`query` は正規化せずそのまま送っていました。

400 がどこから出ているのかは curl で切り分けました（接続確立までの行は省略した抜粋）。

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

サーバー側のログには1行も残りません。Hono に届く前に、Node の HTTP パーサ（llhttp 9.3.0）が知らないメソッド名として 400 + `Connection: close` で切っていました。「ログに何も残らない 400 はアプリより手前を疑う」というのを覚えました。書き足しておいた注意点がここで当たった形です。

issue が「未対応」と言っていても、何が未対応なのかを確かめないと結論を間違える、というのが一番の学びでした。

### GET+body は落ちない。黙って空になる

curl の GET+body を全文で見ると、こうなっています。

:::details curl -X GET --data の全文
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
:::

curl は `-X GET --data` でも POST に化けず GET のまま、`Content-Length: 13` を付けて `upload completely sent off: 13 bytes` と 13 バイト送っています。サーバーも `content-length: 13` を受け取っています。にもかかわらず `await c.req.text()` は空文字列で、`bodyLen=0`。

つまりボディはワイヤ上を通ったのに、フレームワークに届く前に捨てられています。例外もログも出ません。200 が返るのにデータが無い、というのが一番デバッグしにくい形だと思いました。

`@hono/node-server` は Node の `IncomingMessage` から Fetch API の `Request` を組み立てますが、Fetch 仕様が「GET/HEAD は body を持てない」と定めているので body 抜きの `Request` になります。Node の生の HTTP レイヤには届いていて、Fetch 互換レイヤの境界で消えていました。

同じ 13 バイトが QUERY だと `bodyLen=13` でハンドラまで届きます。差はステータスコードではなく、ボディが残るか消えるかでした。GET+body で代用すればいい、が通らない実演になりました。

失敗する場所も経路によって違います。curl は送ってからサーバー側で消える。fetch は `new Request` の構築時、つまりリクエストが飛ぶ前に例外になります。同じ「GET+body はダメ」でも起きる場所が違うので、サーバー側で受信ボディ長をログに出しておかないと気づけません。`dump()` を最初に仕込んでおいてよかったです。

### Playwright に OPTIONS が出てこない

クロスオリジンを試すため、3001 から `page.html` を配る静的サーバーを別に立てて、3000 の API を叩かせました。まず `cors()` 無しで。

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

![クロスオリジンで cors() 無し。QUERY と POST が Failed to fetch になった画面](/images/hono-query-method-curl-fetch-browser/02-browser-cross-origin-no-cors.png)

ページ側の例外は QUERY / POST とも `TypeError: Failed to fetch`。ここで手が止まったのは、ログに `QUERY` の行はあるのに `OPTIONS` の行が無いことでした。プリフライトが飛んでいないのか、Playwright が拾えていないのかが区別できません。

`page.on('request')` は OPTIONS プリフライトを拾ってくれませんでした。プリフライトはブラウザが内部で発行するもので、ページのネットワークイベントとしては公開されないようです。

解決策として、Hono の一番手前に素の受信ログを足しました。

```javascript:server.mjs
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

これで初めてプリフライトが見えました。`cors()` 無しのとき。

```
[server] flags MNA=1 ETAG=0 CORS=0 PORT=3000
[server] listening on http://localhost:3000
[wire] <-- OPTIONS /search origin=http://localhost:3001 acrm=QUERY acrh=content-type
[wire] --> OPTIONS /search 405
[wire] <-- OPTIONS /search origin=http://localhost:3001 acrm=POST acrh=content-type
[wire] --> OPTIONS /search 405
```

`acrm=QUERY`、つまり `Access-Control-Request-Method: QUERY` で OPTIONS が確かに飛んでいます。405 を返したので本リクエストは飛ばず、ハンドラのログは1行もありません。RFC 解説にあった「QUERY は CORS safelisted ではない」がそのまま観測できました。

`CORS=1` で `cors()` を有効にして再起動すると、2段になります（QUERY の分だけ抜粋。この後 POST も同じ2段を踏んでいます）。

```
[server] flags MNA=1 ETAG=0 CORS=1 PORT=3000
[server] listening on http://localhost:3000
[wire] <-- OPTIONS /search origin=http://localhost:3001 acrm=QUERY acrh=content-type
[wire] --> OPTIONS /search 204
[wire] <-- QUERY /search origin=http://localhost:3001 acrm=(none) acrh=(none)
[server] QUERY /search method=QUERY content-type=application/json content-length=13 bodyLen=13 body="{\"q\":\"hello\"}"
[wire] --> QUERY /search 200
```

![同じページで cors() 有り。QUERY と POST が 200、type が cors になった画面](/images/hono-query-method-curl-fetch-browser/03-browser-cross-origin-with-cors.png)

ページのコードは1文字も変えていません。サーバー側のミドルウェアを切り替えただけで、2枚のスクショの差になっています。ブラウザ側で見えるレスポンスも `type: basic` から `type: cors` に変わりました。

プリフライトのヘッダ実値も直接見ました。

```bash
curl -si -X OPTIONS http://localhost:3000/search \
  -H 'Origin: http://localhost:3001' \
  -H 'Access-Control-Request-Method: QUERY' \
  -H 'Access-Control-Request-Headers: content-type'
```

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

`QUERY` が `cors()` の既定リストに入っていました。オプション指定は一切していません。リリースノートの #5115 が実測で裏取りできた形です。

想定していなかったのは、POST も同じようにプリフライトを踏んでいたこと（`acrm=POST`）。`Content-Type: application/json` が CORS safelisted な content-type（`text/plain` / `application/x-www-form-urlencoded` / `multipart/form-data`）でないためです。プリフライトは QUERY 固有の話ではありません。

プリフライトを確かめたければサーバー側でログを取る、というのは QUERY に限らず使える教訓だと思いました。

### undici 8.10.0 の EBADENGINE

比較のため npm から undici 8.10.0 を入れたら警告が出ました。

```
npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   package: 'undici@8.10.0',
npm warn EBADENGINE   required: { node: '>=22.19.0' },
npm warn EBADENGINE   current: { node: 'v22.17.0', npm: '10.9.2' }
npm warn EBADENGINE }

added 1 package, and audited 4 packages in 5s

found 0 vulnerabilities
```

undici 8.10.0 は Node 22.19.0 以降を要求していて、手元は 22.17.0。警告だけでインストールは成功し、実行も通ったのでそのまま進めましたが、サポートされた組み合わせではありません。

## undici 6 と 8 の差はどこに出たか

大文字 `QUERY` で投げる限り、Node 同梱（6.21.2）と npm の 8.10.0 で結果に差はありませんでした。どちらも 200、body も同じ。GET+body はどちらも同じ文言の `TypeError` で、違いはスタックだけでした。

```
# 同梱
at node:internal/deps/undici/undici:13510:13

# npm 版
at new Request (/.../node_modules/undici/lib/web/fetch/request.js:524:13)
    at fetch (/.../node_modules/undici/lib/web/fetch/index.js:171:21)
    at fetch (/.../node_modules/undici/index.js:157:10)
```

npm 版のほうがどのファイルの何行目で弾かれたかまで出るので追いやすい、というのは別の実感として残りました。

差が出たのは小文字プローブだけです。

| クライアント | `method: 'query'`（小文字） | 結果 |
|---|---|---|
| Node 同梱 fetch（undici 6.21.2） | 正規化されず、ワイヤに `query` がそのまま出る | 400 Bad Request（Hono に到達しない） |
| undici 8.10.0 の fetch | `QUERY` に正規化される | 200 OK（`receivedMethod: "QUERY"`） |
| curl `-X query` | 文字列をそのまま送る | 400 Bad Request + `Connection: close` |

PR #5459 が `lib/core/util.js` の normalized method records に QUERY を足したこと、そのものの現れでした。

バージョンを上げれば結果が変わるという分かりやすい比較になるはずが、大文字で書いていれば最初から通っていた。差を見つけるには仕様上どこが変わったかを PR の diff から読んで、それを狙い撃ちするプローブを自分で設計する必要がありました。逆に、差が出なかったこと自体が「2026年8月時点では Node 22 系でも QUERY はもう送れる」という結論になったと思っています。

## 405 と Allow ヘッダ

`methodNotAllowed({ app })` を入れる前後で比べました。入れる前は、GET しか定義していない `/only-get` に POST や QUERY を投げても 404 が返ります（`Date` 以下のヘッダを落とした抜粋）。

```
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=UTF-8
Content-Length: 13

404 Not Found
```

`app.use(methodNotAllowed({ app }))` をルート定義より前に1行置くと、こうなります。

```
--- POST /only-get ---
HTTP/1.1 405 Method Not Allowed
allow: GET, HEAD

--- QUERY /only-get ---
HTTP/1.1 405 Method Not Allowed
allow: GET, HEAD

--- DELETE /search（query/get/post 定義済みのパス）---
HTTP/1.1 405 Method Not Allowed
allow: QUERY, GET, HEAD, POST

--- POST /nope（未定義パス）---
HTTP/1.1 404 Not Found
```

`Allow: QUERY, GET, HEAD, POST` の1行が、このサーバーは QUERY を喋るという一番きれいな証拠になりました。`app.query()` で定義したものがちゃんと `Allow` に反映されています。`HEAD` は `app.head()` を書いていないのに自動で入り、並び順は登録順（query → get → post）で `HEAD` が `GET` の直後に挿さっていました。

「パスは在るがメソッドが無い」を 404 ではなく 405 で返すのは、ミドルウェアを入れないとやってくれません。QUERY のような新しいメソッドを混ぜるとクライアント側は 404 と 405 を区別したいので、相性がいい組み合わせだと思います。

## ETag と 304

`etag()` を有効にして、同じボディで2回投げました。応答は各回のステータス行と `etag` 行だけを抜粋しています。

```bash
# 1回目: ETag を取る
curl -si -X QUERY http://localhost:3000/search -H 'Content-Type: application/json' --data '{"q":"hello"}'
# 2回目: 同じボディ + If-None-Match
curl -si -X QUERY http://localhost:3000/search -H 'Content-Type: application/json' \
  -H 'If-None-Match: "e11f281396606dc47048206a3857cd8970a978f4"' --data '{"q":"hello"}'
```

```
=== 1回目 QUERY {"q":"hello"} ===
HTTP/1.1 200 OK
etag: "e11f281396606dc47048206a3857cd8970a978f4"

=== 2回目 同じボディ + If-None-Match ===
HTTP/1.1 304 Not Modified
etag: "e11f281396606dc47048206a3857cd8970a978f4"

=== 3回目 ボディを {"q":"world"} に変える ===
HTTP/1.1 200 OK
etag: "a24aa2e69354ea6ff555d32d2c6214e7d00aafb0"

=== 4回目 ボディ違い(q=world) に q=hello の ETag を付ける ===
HTTP/1.1 200 OK
etag: "a24aa2e69354ea6ff555d32d2c6214e7d00aafb0"
```

ボディを送るのに 304 が返るのは QUERY ならではの光景で、POST では普通こうなりません。4回目のように別ボディに古い ETag を付けても 304 にならず 200 が返るので、取り違えは起きていませんでした。

ただしここは限定して書きます。Hono の `etag()` はレスポンス本文のハッシュから ETag を作ります。今回のハンドラはリクエストボディをそのままレスポンスに含めているので、ボディが違えば ETag も違うのは自動的に成立してしまいます。RFC 10008 が言うキャッシュキー（URI + リクエスト内容）とは層が違う話なので、確かめられたのは「レスポンスが違えば ETag が違う」という当たり前のところまでです。リリースノートの #5119（Cache ミドルウェアがリクエスト内容の SHA-256 をキーにする）は今回試していません。

## Accept-Query は自動では付かなかった

素の QUERY レスポンスを `grep -ic 'accept-query'` すると 0 でした。Hono 4.13.2 は `Accept-Query` を自動では付けないようです。手で付ければ普通に出ます。

```javascript
c.header('Accept-Query', 'application/json')
```

```
HTTP/1.1 200 OK
accept-query: application/json
content-type: application/json
```

リリースノートにあったのは「`hono/utils/headers` を IANA レジストリに同期して `Accept-Query` を既知のフィールド名に追加した」だけなので、型・定数に入っただけという理解で整合しています。どのレスポンス（200 / OPTIONS / 415）に付けるのが適切なのかは調べていません。

## 3経路 × 3メソッドの結果表

「事前に調べたこと」で貼った予想の答え合わせをしておくと、7件中6件が当たりで、外れたのは #2（Node 同梱 fetch の QUERY は落ちる）だけでした。予想リストに入れ忘れて注意点として書き足した「llhttp が知らないメソッドを 400 で切るかも」は、小文字 `query` のところで当たっています。

対象は `http://localhost:3000/search`、ボディは `{"q":"hello"}`、`Content-Type: application/json`。

| クライアント \ メソッド | QUERY | GET + body | POST |
|---|---|---|---|
| curl 8.7.1 | 200 JSON。サーバーに `bodyLen=13` で届く | 200 だが body が消える。curl は 13 バイト送っている（`Content-Length: 13`）のにハンドラ側は `bodyLen=0` | 200 JSON。`bodyLen=13` |
| Node 同梱 fetch（undici 6.21.2） | 200 JSON | 送信前に例外 `TypeError: Request with GET/HEAD method cannot have body.` | 200 JSON |
| undici 8.10.0 の fetch | 200 JSON（同梱版と差なし） | 送信前に例外（同文言。スタックが `node_modules/undici/...` になるだけ） | 200 JSON |
| ブラウザ fetch（同一オリジン） | 200 JSON、`res.type = basic`、プリフライトなし | 送信前に例外 `TypeError: Failed to execute 'fetch' on 'Window': Request with GET/HEAD method cannot have body.` | 200 JSON |
| ブラウザ fetch（クロスオリジン / `cors()` 有） | 200 JSON、`res.type = cors`、OPTIONS プリフライトあり → 204 | 同上（プリフライト以前にクライアントで例外） | 200 JSON。POST も `Content-Type: application/json` のためプリフライトが飛ぶ |
| ブラウザ fetch（クロスオリジン / `cors()` 無） | 失敗 `TypeError: Failed to fetch`。OPTIONS は飛んだが 405 → 本リクエストは飛ばず | 同上（クライアントで例外） | 失敗 `TypeError: Failed to fetch`（QUERY と同じ理由） |

## どんな人に向いていそうか

手を動かして感じたのは、サーバー側は今すぐ書けるということでした。`app.query()` に置き換えるだけで動いて、`Allow: QUERY, GET, HEAD, POST` も勝手に出てきます。クライアント側も、大文字で書けば Node 22 系（undici 6.21.2）でも既に送れました。クロスオリジンなら `cors()` を素で入れるだけで、QUERY は既定の許可リストに入っています。

なので「ボディを付けた検索リクエストを POST で誤魔化している」ところがあって、かつ経路が自分の管理下（localhost や自前サーバー）に収まっているなら、試す価値はありそうに見えました。ただ検証範囲が狭いので、実サービスに入れていいかまでは何とも言えません。

## 分からないまま残ったこと

- Cache ミドルウェア（#5119、リクエスト内容の SHA-256 をキャッシュキーにする）は試していません。なので「リクエストボディがキャッシュキーに入る」ことは今回証明できていません。ETag で確かめられたのはレスポンス本文ハッシュ由来の挙動までです。
- PR #5459 が undici 6.x / 7.x に backport されているかは未確認です。リリース日は取れましたが、6.28.0 / 7.29.0 に QUERY 対応が入っているかは見ていません。
- ブラウザは Playwright の Chromium 149 だけ。Firefox / WebKit は試していません。
- すべて `localhost` の HTTP/1.1 直結です。プロキシ・CDN・HTTP/2 以降の中継は未検証で、ここが一番実運用と違うところだと思います。
- `Accept-Query` を「どのレスポンスに付けるのが正しいか」は調べていません。

## 再現手順

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

引っかかりやすいところをまとめておきます。

:::message alert
- HTTP メソッドは大文字で書く。`method: 'query'`（小文字）は Node の HTTP パーサに 400 Bad Request で切られ、アプリのログには何も残りません。undici 8.6.0 以降は正規化されるので通ります。
- GET+body は 200 が返るがボディは消えます。サーバー側で受信ボディ長をログに出さないと気づけません。
- プリフライト（OPTIONS）は Playwright の `page.on('request')` に出てきません。サーバー側でログを取るのが確実です。
- `Content-Type: application/json` を付けると POST でもプリフライトが飛びます。プリフライトは QUERY 固有の話ではありません。
- `Accept-Query` は Hono が自動で付けません。必要なら `c.header('Accept-Query', ...)` で自分で付けます。
- undici 8.10.0 は engine が `node >= 22.19.0`。Node 22.17.0 では `EBADENGINE` 警告が出ます。
:::

結論はすべて Node v22.17.0 / undici 6.21.2 / Chromium 149 / HTTP/1.1 直結での結果です。

## 参考リンク

https://http.dev/query

https://github.com/honojs/hono/releases/tag/v4.13.0

https://github.com/nodejs/undici/issues/5454

https://github.com/nodejs/undici/pull/5459
