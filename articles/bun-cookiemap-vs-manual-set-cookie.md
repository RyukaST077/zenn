---
title: "Bunのcookie(CookieMap)と手動Set-Cookieを書き比べてみた"
emoji: "🍪"
type: "tech"
topics: ["bun", "typescript", "cookie", "http", "playwright"]
published: true
---

<!-- 前提: 出典ログ logs/run-bun-cookiemap-20260720-0406/execution-log.md / 記事タイプ: 検証ログ・書き比べ / slug: bun-cookiemap-vs-manual-set-cookie / published: false -->

## はじめに

Express や Hono でセッション cookie を扱うとき、`Set-Cookie` の文字列を自分で組み立てたり、`Cookie` ヘッダを `split` してパースしたりを何度か書いた記憶があります。属性の付け忘れや削除の書き方で毎回ちょっと悩むところで、正直あまり得意ではありませんでした。

Bun 1.3 系には `Bun.serve()` の `routes` ハンドラで `request.cookies`（`Bun.CookieMap`）が使えるようになっていて、外部ライブラリなしで cookie を読み書きできると知りました。そこで「組込 API で書いた版」と「昔ながらに手動で `Set-Cookie` を組む版」を並べて、同じ挙動になるまで書き比べてみたのがこの記事です。

やったことは小さく、`/sign-in`・`/whoami`・`/sign-out` の3エンドポイントを両方式で作り、`curl -i` で `Set-Cookie` を突き合わせ、最後に Playwright でブラウザ側の見え方も確認しました。結論から言うと両版とも同じ `Set-Cookie` 値になり、ブラウザからの見え方も一致しました。ただし手動版を合わせにいく過程で、Bun の cookie 削除の挙動など「へえ」と思う点がいくつか出てきたので、そこを中心に書きます。

:::message
筆者はまだ経験の浅いエンジニアで、Bun の cookie API を触るのは初めてです。手元の Mac で一通り試した範囲のメモなので、抜けや勘違いがあるかもしれません。実行環境: macOS (Darwin 25.5.0, arm64) / Bun 1.3.14 / Playwright 1.61.1。
:::

## 使ったもの・環境

- ランタイム: Bun 1.3.14 (0d9b296a)
- 対象 API: `Bun.serve()` の `routes` ハンドラで使える `request.cookies`（`Bun.CookieMap`）
- ブラウザ確認: Playwright 1.61.1（chromium v1228 / Chrome for Testing 149）
- OS: macOS (arm64)、参考までに Node は v22.17.0

`request.cookies` は Bun 1.3 系で入った API で、1.2 以前には無いようです。手元の `bun --version` が `1.3.14` だったのでそのまま進められました。

公式ドキュメントはこちら。

https://bun.com/docs/runtime/cookies

「できたと言える完了条件」は自分の中で3つ決めておきました。

1. `/sign-in` `/whoami` `/sign-out` が両版で同じ挙動になる
2. `curl -i` で見た `Set-Cookie` 文字列が両版で一致する
3. Playwright で cookie の状態をスクショに残す

## 環境構築

まず最小プロジェクトを作ります。`bun init` は対話プロンプトが出るので `-y` を付けました。

```bash
bun init -y
```

```text
 + .gitignore
 + CLAUDE.md
 + index.ts
 + tsconfig.json (for editor autocomplete)
 + README.md

bun install v1.3.14 (0d9b296a)
Resolved, downloaded and extracted [5]
Saved lockfile
+ @types/bun@1.3.14
+ typescript@5.9.3 (v7.0.2 available)
5 packages installed [746.00ms]
```

`Bun.serve` が動くかだけ先に Hello World で確認します。

```bash
bun run hello.ts &   # routes: { "/": () => new Response("ok") }, port 3000
curl -i -s localhost:3000/
```

```text
HTTP/1.1 200 OK
content-type: text/plain;charset=utf-8
Date: Sun, 19 Jul 2026 19:07:24 GMT
Content-Length: 2

ok
```

最後にブラウザ確認用の Playwright を入れます。

```bash
bun add -d playwright                  # playwright@1.61.1
bunx playwright install chromium       # chromium-1228
```

手元は chromium が既にキャッシュ済みだったのでダウンロードは走りませんでしたが、初回環境だと Chrome for Testing の DL が走るはずです（`bunx playwright install --dry-run chromium` で `Chrome for Testing 149.0.7827.55` と出ました）。

## 事前に調べたこと

コードを書く前に公式 docs を読んで、`CookieMap` の使い方と既定値を控えておきました。メモしたのは次のあたりです。

- `set(name, value)` の既定は `{ path: "/", sameSite: "lax" }`。ほかに `secure` / `httpOnly` / `maxAge` / `expires` / `domain` / `partitioned` を渡せる。
- `delete()` は「空値＋過去の expiry を付与」して削除する、という説明。
- `Bun.serve()` では `req.cookies` への変更が自動で `Set-Cookie` に反映される（自分でレスポンスヘッダに詰め直さなくていい）。
- docs の例は `routes` ハンドラのものだけ。`fetch` ハンドラでも使えるかは書いていなかったので、これは後で自分で試すことにしました。

手動版で揃えるべき属性は `HttpOnly` / `SameSite=Strict` / `Max-Age=3600` / `Path=/` の4つ。削除が `Max-Age=0` なのか過去 `Expires` なのかは、Bun の実出力を見てから合わせることにしました。

## CookieMapで書いてみる

`routes` ハンドラの中で `req.cookies` を直接触ります。`set` / `get` / `delete` がそのまま生えていて、`set` した内容は自動で `Set-Cookie` として返るので、レスポンスは普通に本文だけ返せば済みます。ついでに「`fetch` ハンドラでも `req.cookies` が使えるのか」を確かめる `/fetch-whoami` も足しました。

```ts:server.ts
// CookieMap版: Bun.serve の routes ハンドラで request.cookies (Bun.CookieMap) を使う
import { randomUUIDv7 } from "bun";

const server = Bun.serve({
  port: 3000,
  routes: {
    "/sign-in": (req) => {
      const sessionId = randomUUIDv7();
      req.cookies.set("sessionId", sessionId, {
        httpOnly: true,
        sameSite: "strict",
        maxAge: 3600,
        path: "/",
      });
      // req.cookies への変更は自動でレスポンスヘッダに反映される
      return new Response(`signed in: ${sessionId}`);
    },
    "/whoami": (req) => {
      const sessionId = req.cookies.get("sessionId");
      return new Response(sessionId ? `you are: ${sessionId}` : "not signed in");
    },
    "/sign-out": (req) => {
      req.cookies.delete("sessionId");
      return new Response("signed out");
    },
  },
  // routes に該当しないパスは fetch ハンドラへ。ここで request.cookies が使えるか試す
  fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/fetch-whoami") {
      // @ts-expect-error: fetch ハンドラで cookies が存在するかを実地検証
      const hasCookies = typeof req.cookies;
      // @ts-expect-error
      const sessionId = req.cookies?.get?.("sessionId");
      return new Response(`fetch handler: typeof req.cookies=${hasCookies}, sessionId=${sessionId}`);
    }
    return new Response("not found", { status: 404 });
  },
});
console.log(`CookieMap版 listening on ${server.url}`);
```

`curl -i` で cookie jar を使いながら3連で叩いた結果です。

```bash
curl -i -c j.txt localhost:3000/sign-in
curl -i -b j.txt localhost:3000/whoami
curl -i -b j.txt localhost:3000/sign-out
curl -i localhost:3000/fetch-whoami
```

```text
===== 1) sign-in =====
HTTP/1.1 200 OK
Set-Cookie: sessionId=019f7bc7-3e89-7000-86c7-e22b6142e7f1; Path=/; Max-Age=3600; HttpOnly; SameSite=Strict
content-type: text/plain;charset=utf-8
Date: Sun, 19 Jul 2026 19:08:03 GMT
Content-Length: 47

signed in: 019f7bc7-3e89-7000-86c7-e22b6142e7f1
===== 2) whoami (cookie送付) =====
HTTP/1.1 200 OK
content-type: text/plain;charset=utf-8
Date: Sun, 19 Jul 2026 19:08:03 GMT
Content-Length: 45

you are: 019f7bc7-3e89-7000-86c7-e22b6142e7f1
===== 3) sign-out (cookie送付) =====
HTTP/1.1 200 OK
Set-Cookie: sessionId=; Path=/; Expires=Fri, 1 Jan 1970 00:00:00 -0000; SameSite=Lax
content-type: text/plain;charset=utf-8
Date: Sun, 19 Jul 2026 19:08:03 GMT
Content-Length: 10

signed out
===== 4) fetch ハンドラで cookies が使えるか =====
HTTP/1.1 200 OK
content-type: text/plain;charset=utf-8
Date: Sun, 19 Jul 2026 19:08:03 GMT
Content-Length: 64

fetch handler: typeof req.cookies=undefined, sessionId=undefined
```

ここで実出力を見て気づいたことがいくつかありました。

- sign-in の `Set-Cookie` の属性順は `Path → Max-Age → HttpOnly → SameSite`。自分が渡した順（httpOnly, sameSite, maxAge, path）とは違う順で出てきました。
- sign-out の削除は `Max-Age=0` ではなく、過去日時の `Expires=Fri, 1 Jan 1970 00:00:00 -0000` で出ていました。docs の「過去の expiry を付与」はこれのことだったようです。
- しかも削除ヘッダは `SameSite=Lax` で、`HttpOnly` も付いていません。発行時に指定した `SameSite=Strict` や `HttpOnly` は引き継がれず、既定に戻る形でした。
- `/fetch-whoami` は `typeof req.cookies=undefined`。`request.cookies` は `routes` ハンドラ専用で、`fetch` ハンドラには生えていないことが実出力で確認できました。docs に例が `routes` しか無かったのは、たぶんこういうことなんだと思います。

## 手動Set-Cookieで同じことを書く

次に、同じ挙動を `fetch` ハンドラ＋手組みで再現します。`Cookie` ヘッダを自前でパースして、`Set-Cookie` は文字列で組み立てて `Headers` に詰めます。

```ts:server-manual.ts
// 手動版: Cookie ヘッダを自前パースし、Set-Cookie 文字列を手で組み立てる
import { randomUUIDv7 } from "bun";

// Cookie ヘッダ ("k1=v1; k2=v2") を手パースする
function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const pair of header.split("; ")) {
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    const name = pair.slice(0, eq);
    const value = pair.slice(eq + 1);
    out[name] = decodeURIComponent(value);
  }
  return out;
}

const server = Bun.serve({
  port: 3001,
  fetch(req) {
    const url = new URL(req.url);
    const cookies = parseCookies(req.headers.get("Cookie"));

    if (url.pathname === "/sign-in") {
      const sessionId = randomUUIDv7();
      const setCookie = `sessionId=${sessionId}; Path=/; Max-Age=3600; HttpOnly; SameSite=Strict`;
      const headers = new Headers();
      headers.set("Set-Cookie", setCookie);
      return new Response(`signed in: ${sessionId}`, { headers });
    }
    if (url.pathname === "/whoami") {
      const sessionId = cookies["sessionId"];
      return new Response(sessionId ? `you are: ${sessionId}` : "not signed in");
    }
    if (url.pathname === "/sign-out") {
      const setCookie = `sessionId=; Path=/; Expires=Fri, 1 Jan 1970 00:00:00 -0000; SameSite=Lax`;
      const headers = new Headers();
      headers.set("Set-Cookie", setCookie);
      return new Response("signed out", { headers });
    }
    return new Response("not found", { status: 404 });
  },
});
console.log(`手動版 listening on ${server.url}`);
```

最初に素朴に書いた第1版は、CookieMap版とはこう違っていました。

```text
set-cookie: sessionId=...; HttpOnly; SameSite=Strict; Max-Age=3600; Path=/   ← sign-in（属性順が逆）
set-cookie: sessionId=; Max-Age=0; Path=/                                    ← sign-out（Max-Age=0で消そうとした / SameSite欠落）
```

CookieMap版の `Set-Cookie` 行だけ抜き出して `diff` を取ると、ズレが見えます。

```text
< Set-Cookie: sessionId=<uuid>; Path=/; Max-Age=3600; HttpOnly; SameSite=Strict   (CookieMap版)
< Set-Cookie: sessionId=; Path=/; Expires=Fri, 1 Jan 1970 00:00:00 -0000; SameSite=Lax
---
> set-cookie: sessionId=<uuid>; HttpOnly; SameSite=Strict; Max-Age=3600; Path=/   (手動版 第1版)
> set-cookie: sessionId=; Max-Age=0; Path=/
```

ズレていたのは3か所でした。

1. ヘッダ名の大小（`Set-Cookie` と `set-cookie`）
2. sign-in の属性の並び順
3. sign-out の削除方式（`Max-Age=0` にしていた／`SameSite` が抜けていた）

削除を `Max-Age=0` で書くのはよくある手だと思っていたのですが、Bun 側は過去 `Expires` で出すので、値レベルで揃えるならそこも合わせる必要がありました。属性順を `Path; Max-Age; HttpOnly; SameSite` に並べ替え、sign-out を過去 `Expires`＋`SameSite=Lax` に直したのが上のコードです。

ヘッダ名の大小差（`Set-Cookie` / `set-cookie`）だけは残りますが、これは HTTP 的には等価なので、値で比較することにしました。属性を揃えた第2版の出力がこちらです。

```text
===== 1) sign-in =====
HTTP/1.1 200 OK
set-cookie: sessionId=019f7bc8-585c-7000-b57f-4e7c671b4e81; Path=/; Max-Age=3600; HttpOnly; SameSite=Strict
...
===== 3) sign-out =====
HTTP/1.1 200 OK
set-cookie: sessionId=; Path=/; Expires=Fri, 1 Jan 1970 00:00:00 -0000; SameSite=Lax
```

UUID をマスクして比べると、`Set-Cookie` の値は両版で完全一致になりました。

```text
sessionId=<UUID>; Path=/; Max-Age=3600; HttpOnly; SameSite=Strict
sessionId=; Path=/; Expires=Fri, 1 Jan 1970 00:00:00 -0000; SameSite=Lax
>>> 完全一致（Set-Cookie 値が両版で同一）
```

## 詰まった点

一番「なるほど」となったのは cookie 削除の挙動です。自分は削除といえば `Max-Age=0` を出すものだと思い込んでいたのですが、Bun の `delete()` は過去日時の `Expires` を吐きます。しかもそのとき `SameSite=Strict` や `HttpOnly` は引き継がれず、`SameSite=Lax`（既定）に戻った状態で出てきました。手動版で削除ヘッダを組むとき、発行時と同じ属性を付けたくなりますが、Bun に値を合わせるなら「削除は既定に戻る」前提で書く必要がありました。実出力を `curl -i` で見てから合わせにいったので気づけた、という感じです。

もう一つは `fetch` ハンドラの件です。`request.cookies` を `fetch` ハンドラでも使えると勝手に思っていたのですが、`typeof req.cookies` が `undefined` で、`routes` ハンドラ専用でした。cookie を触る処理は `routes` に置くか、`fetch` 側でやるなら結局自前パースが要る、ということになります。docs の例が `routes` だけだったのは伏線だったんだな、と後から思いました。

手パース自体は、今回は単一 cookie なので `"; "` で split して最初の `=` で名前と値に分け、値を `decodeURIComponent` する、で動きました。ただ複数 cookie や特殊文字が絡むと素朴な実装だと崩れやすそうで、このあたりを気にしなくていいのが組込 API の楽なところだと感じました。属性順やヘッダ名の大小まで完全一致を狙うと、細かい詰めが地味に面倒だったのも正直なところです。

## 書き比べて分かったこと

最後に Playwright で両版を開き、`context.cookies()` を取ってスクショに残しました。`HttpOnly` cookie は `document.cookie` からは見えませんが、`context.cookies()` なら取得できます。

```ts:check.ts
import { chromium } from "playwright";

async function check(label: string, port: number) {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`http://localhost:${port}/sign-in`);
  const cookies = await context.cookies();

  await page.goto(`http://localhost:${port}/whoami`);
  const whoamiText = await page.textContent("body");
  // 取得した cookie を表に描画してスクショ（省略）
  console.log(`[${label}] context.cookies() =`, JSON.stringify(cookies, null, 2));
  await browser.close();
}

await check("01-cookiemap", 3000);
await check("02-manual", 3001);
```

`context.cookies()` の中身は両版で同じで、`httpOnly: true` / `secure: false` / `sameSite: "Strict"` / `path: "/"` でした。実際の戻り値は配列（`[ ... ]`）で、以下はその1要素を抜粋し `value` と `expires` を省略した整形イメージです。

```json
{
  "name": "sessionId", "domain": "localhost", "path": "/",
  "httpOnly": true, "secure": false, "sameSite": "Strict"
}
```

CookieMap版:

![CookieMap版: whoami応答とcontext.cookies()の中身。httpOnly:true, sameSite:Strict, path:/](/images/bun-cookiemap-vs-manual-set-cookie/01-cookiemap.png)

手動版:

![手動版: 同じ表示。ブラウザ側の見え方がCookieMap版と一致している](/images/bun-cookiemap-vs-manual-set-cookie/02-manual.png)

コード量と書き味の比較はこんな感じでした。行数自体は `server.ts`（CookieMap版）が44行、`server-manual.ts`（手動版）が47行とほとんど変わりませんが、本質的な差は手動版が `parseCookies()` ヘルパ（約12行）を自前で持つ点です。CookieMap版は読み取りに parse が要りません。

| 観点 | CookieMap版 | 手動版 |
|---|---|---|
| cookie の読み取り | `req.cookies.get()`（parse不要） | `parseCookies()` を自前実装（約12行） |
| Set-Cookie 生成 | `set()` が自動生成・自動付与 | 文字列を手組み・`Headers` に手動 set |
| 削除 | `delete("sessionId")` 1行 | 空値＋過去 `Expires` を手組み |
| `get` の型 | `string \| null`（null 判定を強制される） | `string \| undefined`（判定が緩くなりがち） |
| 属性の付け忘れ | 既定 `path:/` `sameSite:lax` が自動 | `HttpOnly`／順序／削除方式を落としやすい |
| 使える場所 | `routes` のみ（`fetch` は undefined） | `fetch` でも `routes` でも（自前なので） |

型についても少し触れておくと、`CookieMap.get()` の戻り値は `string | null` でした。試しに数値型に代入しようとしたら `bunx tsc` で `Type 'string | null' is not assignable to type 'number'` と怒られたので、null チェックを書かされます。手動版の `Record<string, string>` からの `cookies["sessionId"]` は型上 `string` になってしまい、キーが無いときの `undefined` を型で表現できないので、null/undefined チェックが甘くなりがちだなと感じました。

## まとめ

3エンドポイントを CookieMap版と手動版で書き比べて、最終的に `Set-Cookie` の値もブラウザ側の見え方も一致させることができました。当初の完了条件（同挙動 / `Set-Cookie` 一致 / スクショ取得）は満たせています。

やってみて感じたのは、cookie の読み取りに parse が要らない・削除が1行・既定属性が自動で付く、という組込 API の楽さでした。一方で「`routes` ハンドラ専用」「削除は過去 `Expires` で `SameSite=Lax` に戻る」といった、実出力を見ないと分からない細かい挙動もありました。Express や Hono で cookie を手動管理してきた人が Bun に移るとき、このあたりを最初に押さえておくと戸惑わずに済みそうです。

`secure` を付けた場合の挙動や、`domain` / `partitioned` を指定したときの `Set-Cookie`、複数 cookie を同時に扱ったときの手パースとの差など、今回試せていない部分も残っています。そのあたりはまた別の機会に触ってみたいです。

## 参考リンク

- Bun 公式ドキュメント: Cookies

https://bun.com/docs/runtime/cookies
