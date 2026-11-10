---
title: "MCP SDK v1→v2、公式codemodが直したのは17箇所だけ。手で残った範囲と移行チェックリスト"
emoji: "🔧"
type: "tech"
topics: ["mcp", "typescript", "aiagent", "nodejs", "zod"]
published: false
---

<!-- 前提: 出典ログ logs/run-mcp-sdk-v2-migration-20261003-0000/execution-log.md / 記事タイプ: 検証ログ（移行チェックリスト） / published: false -->

## はじめに

自分で書いた MCP サーバーを `@modelcontextprotocol/sdk@1.x` で動かしていて、v2 に上げるかどうか決めかねていました。SDK は 2.2.0 が GA になっていて、仕様側も 2026-07-28 版に改訂されている。公式には `v1-to-v2` の codemod まで用意されている。だったらコマンド一発で終わるのでは、と思って実際にやってみた記録です。

結果から書くと、codemod は `src/server.ts` 約50行を含む3ファイル構成の最小サーバーに対して 17箇所を数秒で書き換えてくれました。ただ、それで 2026-07-28 仕様の適合テストが改善したかというと、1件も改善しませんでした。移行前と codemod 適用後で、適合テストのサマリが1バイトも変わらなかった。数字が動いたのは、codemod が一切触らない `createMcpHandler` への載せ替えを自分でやった後です。

この記事では、v1 の古い書き方をわざと7種類混ぜた最小サーバーを用意して、

- codemod が自動で直した範囲
- codemod の後に手で直す範囲（型エラーと、型に出ないワイヤの変化）
- codemod では原理的に直らない範囲（設計変更）

の3つを、公式の適合テスト（conformance）の数字つきで切り分けました。最後に、自分のリポジトリにそのまま当てられる形のチェックリストを置いています。

:::message
筆者は MCP サーバーを触りはじめて日が浅い新人です。以前このZennで「MCPサーバーをTypeScriptで初めて作ってInspectorで叩いてみた（v2ベータ）」という記事を書きましたが、あれは「v2 でゼロから作る」話でした。今回は「すでに v1 で動いているものを v2 に移す」話なので、見るところがまるで違います。実行環境は macOS 15 (Darwin 25.5.0, arm64) / Node v22.17.0。
:::

:::message alert
適合テストに使った `@modelcontextprotocol/conformance` は `0.2.0-alpha.12`、つまり alpha 版です。この記事の pass/fail の数字は将来変わる可能性があります。
:::

## この記事で決められること

読んでいる人が決めたいのは、たぶん「今 v2 に上げるか、据え置くか」だと思います。この記事はそれを次の2つの量で判断できるようにすることを狙っています。

1. 自動で直る量（codemod の diff の大きさ）
2. 手で残る量（tsc のエラー、ワイヤの挙動変化、設計変更の有無）

先に結論の表だけ出しておきます。詳細は後ろの各節に根拠があります。

| あなたのサーバー | この検証から言えること |
|---|---|
| ステートレス HTTP（`sessionIdGenerator: undefined`）で 2026-07-28 に対応したい | 段階Bまで行く価値がある。HTTP エントリの 12行削除・6行追加（正味 -6行）で適合が跳ねた |
| セッションフル HTTP で、2026-07-28 は急がない | 段階Aで止めるのが無難。段階Bは前段ルーティングの設計変更になる（今回未検証） |
| 2026-07-28 は要らない、v2 の型・API 改善だけ欲しい | 段階Aのみ。codemod + zod 4 上げ + `z.record` 修正で済む可能性が高い |
| Node 18 から動けない | 据え置き。v2 は `node>=20` |
| 既存クライアントの互換が心配 | 少なくともステートレス構成では、v1.31.0 のクライアントが無改造で繋がった |

「段階A」「段階B」と書いているのは、この検証で分けた2つのステップです。段階A が v1 パッケージ → v2 パッケージ、段階B が 2026-07-28 仕様への明示的なオプトイン。この2つが別物だというのが、今回いちばん効いた発見でした。

## 検証に使った構成とバージョン

まずパッケージのバージョンと bin 名を実測しました。`npx` で非対話実行する都合で bin 名も要るので、まとめて見ています。

```bash
for p in @modelcontextprotocol/{sdk,server,client,core,codemod,conformance}; do
  npm view $p version dist-tags engines bin; done
```

```
=== @modelcontextprotocol/sdk ===
version = '1.31.0'
dist-tags = { latest: '1.31.0' }
engines = { node: '>=18' }
=== @modelcontextprotocol/server ===
version = '2.2.0'
dist-tags = { latest: '2.2.0' }
engines = { node: '>=20' }
=== @modelcontextprotocol/client ===
version = '2.2.0'
dist-tags = { latest: '2.2.0' }
engines = { node: '>=20' }
=== @modelcontextprotocol/core ===
version = '2.2.0'
dist-tags = { latest: '2.2.0' }
engines = { node: '>=20' }
=== @modelcontextprotocol/codemod ===
version = '2.2.0'
dist-tags = { latest: '2.2.0' }
engines = { node: '>=20' }
bin = { 'mcp-codemod': 'dist/cli.mjs' }
=== @modelcontextprotocol/conformance ===
version = '0.1.16'
dist-tags = { latest: '0.1.16', alpha: '0.2.0-alpha.12' }
bin = { conformance: 'dist/index.js' }
```

ここで2つ引っかかりました。

ひとつは conformance の `latest` が `0.1.16` で、2026-07-28 を知らないこと。素直に `npx @modelcontextprotocol/conformance@latest` と打つと、新仕様のシナリオが1件も出てこなくて「おかしいな」となります。`dist-tags` を見て `alpha: 0.2.0-alpha.12` を明示指定する必要がありました。

もうひとつは bin 名がパッケージ名と違うこと（`mcp-codemod` と `conformance`）。CI やスクリプトから確実に回すなら `npx -y -p <pkg>@<ver> <bin>` の形にしておいたほうが安全でした。

検証環境はこうです。

- macOS 15（Darwin 25.5.0, arm64）/ Node v22.17.0 / npm 10.9.2 / TypeScript 7.0.2
- `@modelcontextprotocol/sdk@1.31.0` → `@modelcontextprotocol/server@2.2.0` + `@modelcontextprotocol/node@2.1.0`
- zod 3.25.76 → 4.6.5 / express 5.2.1 / tsx 4.23.15
- 計測日 2026-10-02〜03

TypeScript は `npm i typescript` でそのまま入った 7.0.2 です。TS6 以前だとエラーの文言が違う可能性があります。

対象は、v1 の古いイディオムを7種類わざと混ぜた最小サーバーです。

```ts:src/server.ts（v1 ベースライン）
// v1 最小 MCP サーバー。codemod の効き目を見るため、v1 の古いイディオムをわざと混ぜてある。
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { z } from 'zod';

export function buildServer(): McpServer {
  const server = new McpServer({ name: 'migration-demo', version: '1.0.0' });

  // 仕掛け1: 旧メソッド名 .tool() + inputSchema に raw shape（z.object() で包まない）
  server.tool('add', { a: z.number(), b: z.number() }, async ({ a, b }) => ({
    content: [{ type: 'text' as const, text: String(a + b) }],
  }));

  // 仕掛け2: extra パラメータを使うハンドラ
  server.tool('echo', { msg: z.string() }, async ({ msg }, extra) => {
    const id = extra.requestId;
    return { content: [{ type: 'text' as const, text: `${String(id)}:${msg}` }] };
  });

  // 仕掛け3: 旧メソッド名 .resource()
  server.resource('greeting', 'demo://greeting', async (uri) => ({
    contents: [{ uri: uri.href, text: 'hello from v1' }],
  }));

  return server;
}

// 仕掛け4: z.record() を1引数で（zod 3→4 のアリティ変更の観測用）
export const metaShape = z.record(z.number());

// 仕掛け5: McpError / ErrorCode を catch で使う
export function toError(e: unknown): never {
  if (e instanceof McpError) throw e;
  throw new McpError(ErrorCode.InternalError, String(e));
}

// 仕掛け6: setRequestHandler のスキーマ第1引数形式（low-level Server）
export function attachLowLevel(low: Server): void {
  low.setRequestHandler(ListToolsRequestSchema, async (_req, extra: RequestHandlerExtra<any, any>) => {
    void extra.signal;
    return { tools: [] };
  });
}

// 仕掛け7: ResourceTemplate ヘルパークラス
export const tmpl = new ResourceTemplate('demo://item/{id}', { list: undefined });
```

これに Streamable HTTP のエントリ（`src/http.ts`、ステートレス）と stdio のエントリを足して、`localhost:3000/mcp` に立てた状態からスタートします。

## 移行前のベースライン：新仕様で何件落ちるのか

まず「何もしない状態」の数字を取りました。

```bash
npx -y -p @modelcontextprotocol/conformance@0.2.0-alpha.12 conformance server \
  --url http://localhost:3000/mcp --requirements 2026-07-28 -o artifacts/conformance-before
```

出力は `Running requirements 2026-07-28 (50 scenarios)` → `Total: 11 passed, 146 failed`、そして `Not scored for 2026-07-28: 13 scenario(s) run, 12 failing.` でした。

この `Total:` をそのまま記事に書こうとして、途中で手が止まりました。`--requirements` 付きで走らせると、採点対象でないシナリオも実行されるんです。50件のうち 13件（tasks 拡張10件と pending 3件）は走るけど採点されない。なので `checks.json` を全件パースして数え直しました。

- 採点対象シナリオ PASS: 1 / 37（通ったのは `input-required-result-validate-input` だけ）
- `wire-schema-valid`（送った JSON-RPC が交渉済み仕様版のスキーマに合っているか）: SUCCESS 1 / 45

これが出発点です。なお 2026-07-28 のシナリオ数について、事前に読んだ情報では「約90件」とありましたが、実測は 69件（うちサーバー側として走るのが50件、採点対象37件）でした。

## 公式 codemod をかける

### dry-run の警告がいちばん価値がある

公式の手順は「適用 → `@mcp-codemod-error` を grep → tsc → formatter」という流れで紹介されています。ただ実際にやってみると、`--dry-run` の出力を読む時間が一番割に合いました。

```bash
npx -y -p @modelcontextprotocol/codemod@2.2.0 mcp-codemod v1-to-v2 . --dry-run --verbose
```

```
@modelcontextprotocol/codemod — v1-to-v2

Scanning .../workspace...
(dry run — no files will be modified)

Changes: 17 across 3 file(s)

Files modified:
  .../src/http.ts (1 change(s))
  .../src/server.ts (15 change(s))
  .../src/stdio.ts (1 change(s))

Warnings (2):
  .../src/server.ts:1 - [WARNING] ErrorCode split into ProtocolErrorCode and SdkErrorCode. Verify the migration is correct.
  .../src/server.ts:4 - [WARNING] RequestHandlerExtra renamed to ServerContext. Generic type arguments removed. Verify the migration is correct.

Info (2):
  .../src/server.ts:15 - [INFO] Raw object literal wrapped with z.object().
  .../src/server.ts:10 - [INFO] Raw object literal wrapped with z.object().

package.json changes (dry run — not applied):
  package.json
    Removed: @modelcontextprotocol/sdk
    Added:   @modelcontextprotocol/node, @modelcontextprotocol/server
    Warning: zod range '^3.25.76' cannot satisfy v2's floor: zod >=4.2.0 is required. An older range installs cleanly and then, depending on the zod entry point your code imports, fails type-checking (zod/v4 subpath) or only fails at runtime (main-entry imports: the server starts normally and the first tools/list reports the failure).

Run without --dry-run to apply changes.
```

末尾の `package.json changes` の `Warning:` を見てください。zod のレンジが v2 の下限（4.2.0）に届かないと、適用する前に教えてくれています。あとで tsc が5件のエラーで落ちるんですが、その原因はここに全部書いてあった。公式の TL;DR どおり「適用 → grep → tsc」で進むと、これに気づくのが tsc の段階になります。

本番適用時はこれに加えて、formatter を当てろという案内が出ました。

```
This codemod doesn't reformat its output. Run your formatter on the changed file(s):
  e.g. prettier --write src/http.ts src/server.ts src/stdio.ts

Run your package manager to install the new packages.

Migration complete. Review the changes and run your build/tests.
```

変更内容自体は dry-run と本番で同一でした。

:::message
codemod はパッケージルート（`.`）で走らせます。`./src` を指定すると `package.json` が書き換わりません。
:::

### 実際に書き換わった17箇所

`git diff --stat` はこうなりました。

```
 package.json  |  5 +++--
 src/http.ts   |  4 ++--
 src/server.ts | 34 +++++++++++++++-------------------
 src/stdio.ts  |  2 +-
 4 files changed, 21 insertions(+), 24 deletions(-)
```

diff を transform ごとに分類すると11項目です。

| # | 仕掛けた v1 の書き方 | codemod 後 | 担当 transform |
|---|---|---|---|
| 1 | `sdk/server/mcp.js` など5本の import | `@modelcontextprotocol/server` の1本に集約 | `imports` |
| 2 | `StreamableHTTPServerTransport` | `NodeStreamableHTTPServerTransport`（`@modelcontextprotocol/node`） | `imports` + `symbols` |
| 3 | `StdioServerTransport`（`sdk/server/stdio.js`） | 同名のまま `@modelcontextprotocol/server/stdio` へ | `imports` |
| 4 | `server.tool('add', {...}, h)` | `server.registerTool('add', { inputSchema: ... }, h)` | `mcpserver-api` |
| 5 | `server.resource('greeting', uri, h)` | `server.registerResource('greeting', uri, {}, h)`（第3引数に `{}` 挿入） | `mcpserver-api` |
| 6 | raw shape `{ a: z.number() }` | `z.object({ a: z.number() })` に自動で包まれた | `mcpserver-api` |
| 7 | `McpError` / `ErrorCode.InternalError` | `ProtocolError` / `ProtocolErrorCode.InternalError` | `symbols` + `removed-apis` |
| 8 | `setRequestHandler(ListToolsRequestSchema, h)` | `setRequestHandler('tools/list', h)`（文字列メソッド名） | `handlers` |
| 9 | `extra.requestId` / `extra.signal` | `ctx.mcpReq.id` / `ctx.mcpReq.signal` | `context` |
| 10 | `RequestHandlerExtra<any, any>` | `ServerContext`（ジェネリクス引数は削除） | `context` |
| 11 | `package.json` の `@modelcontextprotocol/sdk` | 実際に import しているものだけ `/node` と `/server` を追加 | — |

実際の diff から、分かりやすい部分を抜いておきます。

```diff:src/server.ts
-import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
-import { Server } from '@modelcontextprotocol/sdk/server/index.js';
-import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
-import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
-import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
+import { McpServer, ResourceTemplate, Server, ProtocolError, ProtocolErrorCode, ServerContext } from "@modelcontextprotocol/server";

-  server.tool('add', { a: z.number(), b: z.number() }, async ({ a, b }) => ({
-    content: [{ type: 'text' as const, text: String(a + b) }],
-  }));
+  server.registerTool('add', { inputSchema: z.object({ a: z.number(), b: z.number() }) }, async ({ a, b }) => ({
+            content: [{ type: 'text' as const, text: String(a + b) }],
+          }));

-  low.setRequestHandler(ListToolsRequestSchema, async (_req, extra: RequestHandlerExtra<any, any>) => {
-    void extra.signal;
+  low.setRequestHandler('tools/list', async (_req, ctx: ServerContext) => {
+    void ctx.mcpReq.signal;
```

インデントが崩れているのは、codemod が AST だけ書き換えて整形しないからです。formatter はコミットを分けてから当てたほうが diff が読めました。

ここで予想が外れました。事前に調べた段階では「zod の raw shape を `z.object()` で包む作業は手で残る」と思っていたんですが、codemod が自動でやってくれていました（上の #6、`[INFO] Raw object literal wrapped with z.object().` が2件）。手作業リストから1項目減ったのは嬉しい誤算でした。

細かいところだと、`extra.requestId` の移行先が `ctx.mcpReq.requestId` ではなく `ctx.mcpReq.id` だったこと、`.resource()` → `registerResource` で引数の数が変わる（第3引数に `{}` が挿入される）ことは、自分で手書きしていたら間違えていたと思います。

### 発火しなかった transform

`--list` で見ると transform は9個あります。

```
  imports              Import path rewrites
  symbols              Symbol renames
  removed-apis         Removed API handling
  mcpserver-api        McpServer API migration
  handlers             Handler registration migration
  schema-params        Schema parameter removal
  context              Context type rewrites
  completable-nesting  Completable optional-nesting inversion
  mock-paths           Mock and dynamic import path rewrites
```

このうち `schema-params` / `completable-nesting` / `mock-paths` の3つは、今回の最小構成に該当コードが無くて発火しませんでした。大きいコードベースなら効くはずですが、今回は観測できていません。

### マーカーが0件でも安心できない

公式手順では、codemod が「認識したけど直せない」箇所に `@mcp-codemod-error` というコメントを埋めるので、それを grep しろとあります。

```bash
grep -rn '@mcp-codemod-error' --include='*.ts' --include='*.json' .
```

結果は0件。最初は「じゃあ全部直ったのか」と思ったんですが、そうではなくて「自分のコードがマーカーの出るパターンに当たらなかった」だけでした。確かめるために、公式が action-required と明記している名前空間インポートを別ディレクトリに置いて codemod をかけ直したところ、ちゃんと1件出ました。

```
src/probe.ts:2:/* @mcp-codemod-error Namespace import of @modelcontextprotocol/sdk/types.js is used to access Zod schema(s) (CallToolResultSchema, ListToolsResultSchema) that moved to @modelcontextprotocol/core. Import them with a named import (e.g. `import { CallToolResultSchema } from '@modelcontextprotocol/core'`) and update the qualified usages. | Namespace import of @modelcontextprotocol/sdk/types.js: exported symbol(s) ResourceTemplate were renamed in @modelcontextprotocol/client. Update qualified accesses manually. */
```

`import * as t from '@modelcontextprotocol/sdk/types.js'` して `t.CallToolResultSchema.parse()` のように使っていると出るやつです。grep が空振りしたら、それは「この手のパターンが無かった」という意味であって、移行が終わった合図ではない、ということになります。

## codemod の後に残ったもの（1）：zod

`npm install` して `tsc --noEmit` を回したら、5件落ちました。

:::details tsc の出力全文（zod を上げる前）
```
src/server.ts(9,32): error TS2769: No overload matches this call.
  The last overload gave the following error.
    Type 'ZodObject<{ a: ZodNumber; b: ZodNumber; }, "strip", ZodTypeAny, { a: number; b: number; }, { a: number; b: number; }>' is not assignable to type 'ZodRawShape'.
      Index signature for type 'string' is missing in type 'ZodObject<{ a: ZodNumber; b: ZodNumber; }, "strip", ZodTypeAny, { a: number; b: number; }, { a: number; b: number; }>'.
src/server.ts(9,100): error TS7031: Binding element 'a' implicitly has an 'any' type.
src/server.ts(9,103): error TS7031: Binding element 'b' implicitly has an 'any' type.
src/server.ts(14,33): error TS2769: No overload matches this call.
  The last overload gave the following error.
    Type 'ZodObject<{ msg: ZodString; }, "strip", ZodTypeAny, { msg: string; }, { msg: string; }>' is not assignable to type 'ZodRawShape'.
      Index signature for type 'string' is missing in type 'ZodObject<{ msg: ZodString; }, "strip", ZodTypeAny, { msg: string; }, { msg: string; }>'.
src/server.ts(14,88): error TS2339: Property 'msg' does not exist on type 'unknown'.
EXIT=1
```
:::

この `is not assignable to type 'ZodRawShape'` を最初に見たとき、「codemod が `z.object()` で包んだせいで壊れたのでは」と思ってしまいました。`ZodRawShape` は v1 側で見覚えのある型名なので、v1 の残骸が悪さをしているように読める。

実際は逆で、codemod が入れた `z.object()` が zod 3 の `ZodObject` を返していただけでした。`@modelcontextprotocol/server@2.2.0` は `zod@^4.2.0` を要求しているので、型が噛み合わない。codemod は `package.json` の zod のレンジを書き換えてくれません（dry-run で警告は出していた、というのが前節の話です）。

```bash
npm i zod@^4.2.0   # 実際に入ったのは 4.6.5
```

これで5件とも消えました。そして残ったのが1件だけ。

```
src/server.ts(28,28): error TS2554: Expected 2-3 arguments, but got 1.
```

`z.record(z.number())` のアリティが zod 4 で変わったやつです。`z.record(z.string(), z.number())` にして `tsc --noEmit` が EXIT=0 になりました。

結局ここでやった手作業は「zod を上げる」と「`z.record` の引数を足す」の2つだけです。どちらも zod 側の破壊的変更で、SDK の話ではありません。codemod は SDK の API しか直さないので、依存ライブラリの破壊は自分で被ることになります。自分のコードベースで移行コストを見積もるなら、SDK の diff より zod 3→4 の影響範囲を先に数えたほうが実態に近いかもしれません。

ちなみに事前に「`ZodRawShape` が Readonly になって引っかかるらしい」という情報も見ていたんですが、今回それはエラーとして観測できませんでした。zod 4 に上げた後に残ったのは上の1件だけです。

## codemod の後に残ったもの（2）：型に出ないワイヤの変化

`tsc` が通っても、クライアントに返る JSON は変わっています。ここは型チェックでは一切検知できないので、curl で前後を比べました。

### 未知のツールを呼んだとき

```bash
curl -s -X POST http://localhost:3000/mcp -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"nope","arguments":{}}}'
```

v1.31.0:

```
data: {"result":{"content":[{"type":"text","text":"MCP error -32602: Tool nope not found"}],"isError":true},"jsonrpc":"2.0","id":2}
```

v2（段階A後）:

```
data: {"jsonrpc":"2.0","id":2,"error":{"code":-32602,"message":"Tool nope not found"}}
```

`result.isError` で返っていたものが JSON-RPC の `error` に移りました。クライアント側で `isError` を見て分岐しているコードがあると、そこは静かに壊れます。

### リソースが見つからないとき

ここで予想がもうひとつ外れました。事前には「v1 は `-32002` を返していて、v2 で `-32602` になる」と思っていたんですが、

```
v1: {"error":{"code":-32602,"message":"MCP error -32602: Resource demo://missing not found"}}
v2: {"error":{"code":-32602,"message":"Resource not found: demo://missing","data":{"uri":"demo://missing"}}}
```

v1.31.0 の時点ですでに `-32602` でした。`-32002` → `-32602` という語り方は、少なくともこのバージョン間の差としては成立しません。実際の差は `data.uri` が増えたことと、メッセージ先頭の `MCP error -32602: ` という接頭辞が消えたことです。

ただ「サーバーが `-32002` をワイヤに出せない」こと自体は、別の方法で確かめられました。resource ハンドラから明示的に `-32002` を throw するツールを足して叩いてみると、

```
{"jsonrpc":"2.0","id":30,"error":{"code":-32602,"message":"deliberate -32002 from resource"}}
```

メッセージは手で書いたまま、コードだけ `-32602` に書き換わって出てきます。エンコード層が写像しているのが見えました。

同じ throw を tool ハンドラからやると、こうなります。

```
{"result":{"content":[{"type":"text","text":"deliberate -32002"}],"isError":true},"jsonrpc":"2.0","id":20}
```

JSON-RPC エラーにならず、結果のほうに畳まれる。tool と resource で例外の出方が違うのは、移行時に見落としやすそうだと思いました。

### `tools/list` の形

| 項目 | v1.31.0 | v2.2.0 |
|---|---|---|
| `$schema` | `http://json-schema.org/draft-07/schema#` | `https://json-schema.org/draft/2020-12/schema` |
| `additionalProperties` | `false` が付く | フィールドごと消える |
| `execution.taskSupport` | `"forbidden"` が付く | フィールドごと消える |

JSON Schema が 2020-12 になり、トップレベルの `additionalProperties: false` が落ちるのは事前に把握していたとおりでした。`execution.taskSupport` が消えるのは予想していなくて、SEP-2663 で experimental な tasks が削除されたことの表れのようです。

厳密な入力バリデーションをクライアント側で `additionalProperties` に頼っていると、ここは効いてきます。

## 機械的に直せないもの：2026-07-28 は明示的なオプトイン

ここが今回いちばん驚いたところです。

段階A（codemod + 手修正2箇所）が終わった状態で、もう一度 conformance を回しました。

```bash
npx -y -p @modelcontextprotocol/conformance@0.2.0-alpha.12 conformance server \
  --url http://localhost:3000/mcp --requirements 2026-07-28 -o artifacts/conformance-after-v2
```

`Total: 11 passed, 146 failed`。移行前と同じです。念のためサマリ部分だけ切り出して diff を取りました。

```bash
for f in before after-v2; do sed -n '/=== SUMMARY ===/,$p' artifacts/conformance-$f.log > /tmp/s-$f.txt; done
diff /tmp/s-before.txt /tmp/s-after-v2.txt && echo "*** SUMMARIES ARE IDENTICAL ***"
```

```
*** SUMMARIES ARE IDENTICAL ***
```

採点対象 PASS が 1/37 のまま、`wire-schema-valid` も 1/45 のまま。1バイトも違いませんでした。

これ自体は公式ドキュメントが先に書いていることではあります。`docs/migration/support-2026-07-28.md` の冒頭にこうあります。

> Nothing in v2 puts a 2026-07-28 byte on the wire by default: a hand-constructed `Client` / `Server` / `McpServer` keeps speaking the 2025-era protocol it was written for. Serving or speaking 2026-07-28 is always an explicit opt-in via one of the entries below.

読んだときは「そうなんだ」くらいだったんですが、数字が完全一致で出てくると納得の度合いが違いました。パッケージを上げる作業と、新仕様に対応する作業は、まったく別の工程として見積もる必要があります。

### `createMcpHandler` への載せ替え

実際にオプトインするには、HTTP のエントリを `createMcpHandler` に載せ替えます。これは codemod の9 transform のどれにも該当しないので、自分で書くしかありません。

```diff:src/http.ts
-import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
+import { createMcpHandler } from '@modelcontextprotocol/server';
+import { toNodeHandler } from '@modelcontextprotocol/node';

 const app = express();
-app.use(express.json());
-
-app.post('/mcp', async (req, res) => {
-  const server = buildServer();
-  const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
-  res.on('close', () => { void transport.close(); void server.close(); });
-  await server.connect(transport);
-  await transport.handleRequest(req, res, req.body);
-});
-app.get('/mcp', (_req, res) => { res.status(405).end(); });
-app.delete('/mcp', (_req, res) => { res.status(405).end(); });
+const handler = createMcpHandler(() => buildServer());
+app.all('/mcp', toNodeHandler(handler));
```

12行削除、6行追加。`src/server.ts` のほうは一切触っていません。

ただしこれで済んだのは、元の構成がステートレス（`sessionIdGenerator: undefined` でリクエストごとに transport を作る）だったからです。公式ドキュメントは、セッションフルな v1 構成はそのままでは載らないと明記していて、`createMcpHandler(factory, { legacy: 'reject' })` と `isLegacyRequest(request)` による前段ルーティングを指示しています。そちらは今回踏んでいません。

### `express.json()` を外さないと全リクエストが落ちる

載せ替えの途中で一番時間を使ったのがこれです。上の diff に `-app.use(express.json());` が混ざっていますが、最初これを残したままにしていて、全リクエストがこうなりました。

```
HTTP=400
{"jsonrpc":"2.0","error":{"code":-32700,"message":"Parse error: Invalid JSON"},"id":null}
```

`Parse error: Invalid JSON` なので、最初は curl の `-d` に渡している JSON が壊れていると思ってそっちを疑いました。実際は body parser が先にストリームを読み切ってしまって、`toNodeHandler` が生のボディを読めない、というのが原因です。v1 の `transport.handleRequest(req, res, req.body)` はパース済みの body を渡す設計だったので、v1 の express 構成をそのまま持ち越すと必ず踏みます。`express.json()` を外したら同じ curl がそのまま通りました（残した状態と外した状態の両方を実行して確認しています）。

公式の移行ドキュメント2本（計 180KB ほど）を検索した範囲では、この点の記述を見つけられませんでした。自分の探し方が悪いだけかもしれませんが、express で v1 のサーバーを書いている人はまず踏むと思うので、ここに書いておきます。

### 2026-07-28 をしゃべっているかの確かめ方

載せ替えた後、実際に新仕様で応答しているかを手で確かめました。modern なリクエストは `_meta` のエンベロープが要ります。

```bash
META='"_meta":{"io.modelcontextprotocol/protocolVersion":"2026-07-28","io.modelcontextprotocol/clientInfo":{"name":"curl","version":"0"},"io.modelcontextprotocol/clientCapabilities":{}}'
curl -s -w '\nHTTP=%{http_code}\n' -X POST http://localhost:3000/mcp \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2026-07-28' -H 'Mcp-Method: tools/list' \
  -d "{\"jsonrpc\":\"2.0\",\"id\":10,\"method\":\"tools/list\",\"params\":{$META}}"
```

```
{"result":{"tools":[...],"resultType":"complete","ttlMs":0,"cacheScope":"private","_meta":{"io.modelcontextprotocol/serverInfo":{"name":"migration-demo","version":"1.0.0"}}},"jsonrpc":"2.0","id":10}
HTTP=200
```

`resultType` / `ttlMs` / `cacheScope` / `_meta.serverInfo` が付いていれば 2026-07-28 をしゃべっています。段階A の状態ではこれらが1つも付きませんでした。あと、modern のパスは SSE ではなく素の JSON で返ってきます。

このエンベロープ、最初 `protocolVersion` だけ入れて投げてハマりました。

```
{"jsonrpc":"2.0","error":{"code":-32602,"message":"Invalid _meta envelope for protocol revision 2026-07-28: io.modelcontextprotocol/clientCapabilities: missing","data":{"envelope":{"key":"io.modelcontextprotocol/clientCapabilities","problem":"missing"}}},"id":11}
HTTP=400
```

3キー全部必須です。ここで返るのは `-32602` で、後述のヘッダ検証の `-32020` とは別の仕組みでした。エンベロープ検証のほうが先に効きます。

ヘッダを本文と食い違わせるとこうなります。

```
# MCP-Protocol-Version ヘッダを落とす
{"jsonrpc":"2.0","error":{"code":-32020,"message":"Bad Request: the request headers and body disagree: the body envelope names protocol version 2026-07-28 but the required MCP-Protocol-Version header is absent","data":{"mismatch":{"header":"(missing)","body":"..."}}},"id":10}
HTTP=400

# body は tools/list、Mcp-Method ヘッダは tools/call
{"jsonrpc":"2.0","error":{"code":-32020,"message":"Bad Request: the request headers and body disagree: the body names method tools/list but the Mcp-Method header names tools/call","data":{"mismatch":{"header":"tools/call","body":"..."}}},"id":10}
HTTP=400
```

一方、notification を標準ヘッダ無しで POST すると 202 が返って本文なし。存在チェックが免除されるという公式の記述どおりでした。「ヘッダ検証が入ったから notification も弾かれるはず」と考えると間違えます。

なお、このヘッダ検証を裏づけるシナリオ `http-header-validation` は pending 扱いで、既定の `active` スイートでは走りません。`--requirements 2026-07-28` だと実行はされますが採点対象外（`Not scored` 側）に入ります。「全部 pass した」と言う前に、何が採点されていないかを数えたほうがよさそうです。

## 移行後の適合テスト結果

3点の比較です。採点対象37シナリオで数えています。

| 計測点 | 採点対象 PASS | 採点対象アサーション | `wire-schema-valid` | 全体 Total |
|---|---|---|---|---|
| 移行前 (v1.31.0) | 1 / 37 | 11 / 106 | 1 / 45 | 11 passed, 146 failed |
| 段階A後 (v2 + 手修正2箇所) | 1 / 37 | 11 / 106 | 1 / 45 | 11 passed, 146 failed |
| 段階B後 (`createMcpHandler`) | 7 / 37 | 75 / 108 | 46 / 46 | 103 passed, 69 failed |

段階Bで初めて ✓ になったのは6件です。`server-sse-multiple-streams` / `resources-list` / `sep-2164-resource-not-found` / `input-required-result-missing-input-response` / `input-required-result-unsupported-methods` / `input-required-result-ignore-extra-params`。採点対象外ですが `http-header-validation` も ✗ 0/5 から ✓ 14/14 になりました。`server-stateless` は 5/31 → 24/28 と大きく動いたものの、完全 pass には届いていません。

`wire-schema-valid` の 1/45 → 46/46 が、個人的には一番分かりやすい指標でした。送っているメッセージが交渉済み仕様版のスキーマに合っているかの判定なので、ここが揃うと「新仕様で喋れている」と言ってよさそうです。

残った30件の fail についても書いておきます。`checks.json` の `errorMessage` を読むと、`Failed: Tool test_image_content not found` / `Failed: Resource not found: test://static-text` / `Failed: Method not found`（prompts）といったものが大半でした。conformance が期待しているフィクスチャをデモサーバーが実装していないだけで、プロトコル不適合ではありません。自分のサーバーで走らせるときも、ここは分けて読む必要があります。「conformance が全部 pass しない＝まだ非適合」とは限りません。

## 旧クライアントは繋がるのか

移行をためらう理由として大きいのが「既存の利用者が切れるのでは」だと思います。別ディレクトリに `@modelcontextprotocol/sdk@1.31.0` のクライアントを置いて、段階B後のサーバーに繋いでみました。

```
CONNECTED. serverVersion = {"name":"migration-demo","version":"1.0.0"}
negotiated protocolVersion = {"resources":{"listChanged":true},"tools":{"listChanged":true}}
tools/list = ["add","echo","boom"]
tools/call add = {"content":[{"type":"text","text":"12"}]}
```

無改造で繋がって、ツール呼び出しも通りました。`createMcpHandler` の既定が `legacy: 'stateless'` で、2025-era のリクエストも同じエンドポイントで捌いてくれるためです。

ただしこれはステートレス構成で確認した話です。セッションフルな構成で `legacy: 'reject'` を使う場合は、前段ルーティングを自分で書くことになるので、同じ結論にはならないはずです。

## 誰が何を直すか（3列対照表）

チェックリストに入る前に、ここまでで切り分けた3つの範囲を1枚にまとめておきます。この最小構成で**実際に観測できたものだけ**です。

| ① codemod が直す（自動） | ② codemod 後に手で直す（型・ワイヤ） | ③ 機械的に直せない（設計変更） |
|---|---|---|
| 5本の import を `@modelcontextprotocol/server` 1本に集約 | `zod` のレンジを `^4.2.0` 以上へ引き上げ（codemod は警告のみで package.json を書き換えない） | HTTP エントリを `createMcpHandler` + `toNodeHandler` へ載せ替え（12行削除・6行追加） |
| `server.tool()` → `registerTool()`（`inputSchema` へ） | `z.record(z.number())` → `z.record(z.string(), z.number())`（zod 3→4 のアリティ変更。SDK の守備範囲外） | `app.use(express.json())` の撤去（残すと全リクエストが `-32700`） |
| `server.resource()` → `registerResource()`（第3引数に `{}` 挿入） | 未知ツール `tools/call` が `isError: true` から JSON-RPC エラーに変わる、の受け側 | セッションフル構成の前段ルーティング（`legacy: 'reject'` + `isLegacyRequest`）※今回未検証 |
| raw shape を `z.object()` で自動的に包む | `tools/list` の `$schema` 2020-12 化 / `additionalProperties` ・ `execution.taskSupport` の消滅 | — |
| `McpError` / `ErrorCode` → `ProtocolError` / `ProtocolErrorCode` | — | — |
| `setRequestHandler(ListToolsRequestSchema, h)` → 文字列メソッド名 | — | — |
| `extra.requestId` / `extra.signal` → `ctx.mcpReq.id` / `ctx.mcpReq.signal` | — | — |

①は 17箇所・約7秒で終わります。②は `tsc --noEmit` が5件＋1件として出してくれる（ワイヤの変化は出ません）。③は conformance の数字が動くかどうかを決める部分で、ここをやるまで 1/37 のまま変わりませんでした。

## 移行チェックリスト

ここまでの手順を、自分のリポジトリでそのまま上から実行できる形にまとめました。段階Aと段階Bで分けています。

### 第1部：段階A（v1 パッケージ → v2 パッケージ）

#### A-0. 前提確認

```bash
node -v
npm view @modelcontextprotocol/server engines   # => { node: '>=20' }
```

v1 は `>=18` なので、移行でランタイム要件が上がります。Node 18 のままなら先にそちらを上げる。

```bash
git add -A && git commit -m "v1 baseline"
```

diff の基準点。これを打たないと codemod が何をしたか測れません。

```bash
npm view @modelcontextprotocol/codemod bin      # => { 'mcp-codemod': 'dist/cli.mjs' }
npm view @modelcontextprotocol/conformance bin  # => { conformance: 'dist/index.js' }
```

bin 名がパッケージ名と違います。CI から回すなら `npx -y -p <pkg>@<ver> <bin>` の形で。

#### A-1. codemod を当てる

```bash
# transform 一覧（全9個）
npx -y -p @modelcontextprotocol/codemod@2.2.0 mcp-codemod v1-to-v2 --list

# まず dry-run。package.json changes の Warning を必ず読む
npx -y -p @modelcontextprotocol/codemod@2.2.0 mcp-codemod v1-to-v2 . --dry-run --verbose

# 適用はパッケージルート（.）で。./src だと package.json が書き換わらない
npx -y -p @modelcontextprotocol/codemod@2.2.0 mcp-codemod v1-to-v2 . --verbose
git diff > codemod.diff
git diff --stat
```

formatter はコミットを分けてから当てる（codemod は整形しないのでインデントが崩れる）。

#### A-2. 手で残るものを回収する

```bash
grep -rn '@mcp-codemod-error' . --include='*.ts' --include='*.tsx'
```

0件は「このコードベースがそのパターンに当たらなかった」という意味です。移行完了の合図ではありません。

```bash
npm install            # codemod が書いた依存を入れる
npm i zod@^4.2.0       # ← これは手作業。codemod は上げてくれない
npm ls zod @modelcontextprotocol/server --depth=0
npx tsc --noEmit; echo "EXIT=$?"
```

`EXIT=0` が目標。残るエラーはほぼ zod 3→4 の破壊的変更で、SDK 由来ではありません。実測で出たのは `error TS2554: Expected 2-3 arguments, but got 1.`（`z.record(X)` → `z.record(z.string(), X)`）だけでした。

```bash
# tsc が通っても出力は変わる。目で見る
curl -s -X POST http://localhost:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# 未知ツール：result.isError → JSON-RPC error に変わる
curl -s -X POST http://localhost:3000/mcp -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"nope","arguments":{}}}'

# リソース未発見：-32602 + data.uri
curl -s -X POST http://localhost:3000/mcp -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":3,"method":"resources/read","params":{"uri":"demo://missing"}}'
```

クライアントが `isError` で分岐していたら壊れます。tsc では検知できません。受信側は `-32002` と `-32602` の両方を許容しておくのが無難です（ハンドラから `-32002` を throw しても、ワイヤには `-32602` が出ます）。

### 第2部：段階B（2026-07-28 にオプトイン）

#### B-0. 「v2 にしただけでは変わらない」を自分の目で確認する

```bash
npx -y -p @modelcontextprotocol/conformance@0.2.0-alpha.12 conformance server \
  --url http://localhost:3000/mcp --requirements 2026-07-28 -o ./conformance-after-v2
```

`latest`（0.1.16）は 2026-07-28 に対応していないので、`alpha` タグを明示指定します。移行前の結果と diff を取ると、この検証では1バイトも違いませんでした。

```bash
npx -y -p @modelcontextprotocol/conformance@0.2.0-alpha.12 conformance list --requirements 2026-07-28
```

末尾の `pending (3)` を確認。`json-schema-2020-12` / `http-header-validation` / `http-custom-header-server-validation` は既定の active スイートに入りません。

#### B-1. `createMcpHandler` に載せ替える

```typescript
import { createMcpHandler } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';

const handler = createMcpHandler(() => buildServer());
app.all('/mcp', toNodeHandler(handler));
```

そして `app.use(express.json())` を外す。残すと全リクエストが `-32700 Parse error: Invalid JSON` で落ちます。

セッションフルな構成はこれでは載りません。`createMcpHandler(factory, { legacy: 'reject' })` + `isLegacyRequest(request)` の前段ルーティングが要ります（今回は未検証）。

#### B-2. 2026-07-28 をしゃべっているか確認する

```bash
META='"_meta":{"io.modelcontextprotocol/protocolVersion":"2026-07-28","io.modelcontextprotocol/clientInfo":{"name":"curl","version":"0"},"io.modelcontextprotocol/clientCapabilities":{}}'

# (0) 正しいリクエスト → HTTP 200、resultType / ttlMs / cacheScope / _meta.serverInfo が付く
curl -s -w '\nHTTP=%{http_code}\n' -X POST http://localhost:3000/mcp \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2026-07-28' -H 'Mcp-Method: tools/list' \
  -d "{\"jsonrpc\":\"2.0\",\"id\":10,\"method\":\"tools/list\",\"params\":{$META}}"

# (1) MCP-Protocol-Version を落とす → HTTP 400 + -32020
curl -s -w '\nHTTP=%{http_code}\n' -X POST http://localhost:3000/mcp \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -H 'Mcp-Method: tools/list' \
  -d "{\"jsonrpc\":\"2.0\",\"id\":10,\"method\":\"tools/list\",\"params\":{$META}}"

# (2) Mcp-Method を本文と食い違わせる → HTTP 400 + -32020
curl -s -w '\nHTTP=%{http_code}\n' -X POST http://localhost:3000/mcp \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2026-07-28' -H 'Mcp-Method: tools/call' \
  -d "{\"jsonrpc\":\"2.0\",\"id\":10,\"method\":\"tools/list\",\"params\":{$META}}"

# (3) notification は標準ヘッダ無しでも通る → HTTP 202、本文なし
curl -s -w '\nHTTP=%{http_code}\n' -X POST http://localhost:3000/mcp \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","method":"notifications/cancelled","params":{"requestId":1,"_meta":{"io.modelcontextprotocol/protocolVersion":"2026-07-28"}}}'
```

エンベロープは3キー全部必須。1つでも欠けると `-32020` ではなく `-32602` で弾かれます。

```bash
npx -y -p @modelcontextprotocol/conformance@0.2.0-alpha.12 conformance server \
  --url http://localhost:3000/mcp --requirements 2026-07-28 -o ./conformance-after-modern
```

結果を読むときは、`conformance-after-modern/server-<scenario>-*/checks.json` の `errorMessage` を見て、プロトコル不適合と自サーバーの機能未実装を切り分けること。

#### B-3. 既存クライアントが切れないか確認する

```bash
mkdir v1client && cd v1client && npm init -y && npm i @modelcontextprotocol/sdk@1.31.0
# Client + StreamableHTTPClientTransport で http://localhost:3000/mcp へ connect
```

ステートレス構成であれば、無改造で繋がりました。

## まとめと、この検証の限界

やってみた感想としては、「codemod を走らせたら移行完了」ではまったくありませんでした。かといって codemod が役に立たないわけでもなく、17箇所の import とメソッド名の書き換えを数秒で正確にやってくれるので、手でやったら絶対に間違える部分（`ctx.mcpReq.id` とか `registerResource` の引数が1つ増えるとか）は任せられます。

移行コストを見積もるなら、この3つを別々に数えるのがよさそうです。

1. codemod が直す分 — ほぼゼロコスト
2. zod 3→4 の破壊的変更 — SDK とは無関係なので、自分のコードの zod 使用箇所の量で決まる
3. 2026-07-28 へのオプトイン — ステートレスなら数行、セッションフルなら設計変更

最後に、この検証でカバーできていないところを正直に書いておきます。

- `src/server.ts` 約50行を含む3ファイル構成の最小サーバーでしか試していません。大きいコードベースでは `schema-params` / `completable-nesting` / `mock-paths` の3 transform が効くはずですが、今回は発火していません。
- conformance が alpha（0.2.0-alpha.12）です。将来 pass/fail が変わりえます。
- セッションフル HTTP の段階B（`legacy: 'reject'` + `isLegacyRequest`）、stdio 側のオプトイン（`serveStdio`）、OAuth 周りの移行は踏んでいません。特にセッションフル構成の人にとっては、そこが一番知りたいところだと思うので、ここで止まっているのは心残りです。
- 段階B後に残った30件の fail のうち、本当にプロトコル不適合が混ざっていないかは `errorMessage` のレベルまでしか見ていません。

## 参考リンク

- [modelcontextprotocol/typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk) — `docs/migration/upgrade-to-v2.md` と `docs/migration/support-2026-07-28.md` が移行の一次情報。前者は 132KB ありますが、"What the codemod handles" と "What the codemod does NOT handle" の2節（計90行ほど）だけ先に読むと全体の地図が描けます
- [Model Context Protocol 仕様](https://modelcontextprotocol.io/specification)
- [MCP Inspector](https://github.com/modelcontextprotocol/inspector)
