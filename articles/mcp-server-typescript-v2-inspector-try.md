---
title: "MCPサーバーをTypeScriptで初めて作ってInspectorで叩いてみた（v2ベータ）"
emoji: "🔌"
type: "tech"
topics: ["mcp", "typescript", "zod", "nodejs"]
published: true
---

## はじめに

MCP（Model Context Protocol）という単語はよく見かけるものの、自分でサーバーを書いたことはありませんでした。ちょうど TypeScript SDK の v2 がベータで出ていたので、これを機に一番小さいサーバーを作って、動くところまで見てみることにしました。

やったのは、`add`（2つの数を足す）と `echo`（渡した文字列を返す）だけの、副作用のないツールを2つ持った stdio サーバーです。それを [MCP Inspector](https://github.com/modelcontextprotocol/inspector) で叩いて、ツール一覧が出る・呼び出せる・型に合わない入力はちゃんと弾かれる、というところまで確認しました。結論から言うと、参考にした最小コードがベータ版でもそのまま動いて、思っていたより素直でした。ただ、事前に「詰まりそう」と予想していたポイントの一つが、実際には逆の挙動で拍子抜けした、というのが今回一番の収穫です。

想定読者は、MCP をこれから触ってみたい新人〜2年目くらいのエンジニアです。

:::message
筆者は MCP サーバーを書くのは初めてです。実行環境は macOS 26.5 / Node v22.17.0。SDK は **v2 のベータ版**（`@modelcontextprotocol/server@2.0.0-beta.5`）を使っています。ベータなので、この記事の時点の版に固定して試しています。
:::

## なぜ今 MCP を試したのか

MCP は AI アプリケーションに外部ツールやデータをつなぐためのプロトコルで、対応クライアントが増えてきています。TypeScript SDK は今 v1 系（`@modelcontextprotocol/sdk`）から v2 系への移行期で、v2 はまだベータでした。ネット上の記事はほぼ v1 前提で、そのままだと import 先が変わっていて動きません。だったら v2 の最小構成を自分で一度組んでおくと、あとで移行するときに迷わないだろう、という動機です。

:::message alert
使ったのはベータ版（`2.0.0-beta.5`）です。RC やリリースで API 名が変わる可能性があります。実際に試すときは版を固定して、その版のドキュメント・型定義を見てください。
:::

## 事前に調べたこと（v2 で何が変わったか）

いきなり書き始める前に、そもそも「今インストールできる版」と「どこから import するのか」を `npm view` で確認しました。ネットの解説を鵜呑みにすると v1 前提でハマるので、まず一次情報を取りに行った感じです。

```bash
npm view @modelcontextprotocol/server dist-tags versions
npm view @modelcontextprotocol/sdk dist-tags   # v1 系
npm view @modelcontextprotocol/inspector version
npm view @modelcontextprotocol/server@beta exports type engines dependencies
```

出力を整理するとこうでした。

```
@modelcontextprotocol/server dist-tags = { latest: '2.0.0-beta.5', beta: '2.0.0-beta.5' }
@modelcontextprotocol/sdk (v1)         = { latest: '1.29.0' }
@modelcontextprotocol/inspector version = 1.0.0
server: type = 'module' / engines = { node: '>=20' }
        dependencies = { zod: '^4.2.0', '@modelcontextprotocol/core': '2.0.0-beta.5' }
```

分かったこと:

- v2 はパッケージが **server / client / core に分割**されている。v1 の単一 `@modelcontextprotocol/sdk` とはパッケージ名レベルで違う。
- `type: 'module'` で Node は `>=20`。
- 依存に `zod@^4.2.0` が入っている。ツールの入力スキーマを Zod で書く前提のようでした。

一点、事前に「v2 は ESM 専用」と読んでいたのですが、`exports` を見ると `import`（`.mjs`）だけでなく `require`（`.cjs`）も定義されていました。

```
'.': {
  import: { types: './dist/index.d.mts', default: './dist/index.mjs' },
  require: { types: './dist/index.d.cts', default: './dist/index.cjs' }
}
```

パッケージ単位では ESM/CJS の両対応（dual publish）に見えます。「ESM 専用」というのは推奨や既定が ESM、という意味に受け取るのがよさそうだと感じました（この点は exports からの読み取りなので、正確なところは公式の案内で確認したいです）。

## 使ったもの・環境

再現できるように版を控えておきます。

| 種類 | バージョン |
|---|---|
| OS | macOS 26.5 (Darwin 25.5.0) |
| Node | v22.17.0 |
| TypeScript | 7.0.2 |
| `@modelcontextprotocol/server` | 2.0.0-beta.5（＋ core 同版） |
| zod | 4.4.3 |
| `@modelcontextprotocol/inspector` | 1.0.0 |

「できた」と言える条件は次の4つに置きました。

1. Inspector CLI の `tools/list` に `add` が出る
2. `tools/call add a=2 b=3` の結果に `5` が含まれる
3. 型に反する入力（`a=foo`）でバリデーションエラーが返る
4. Inspector の UI 画面で tool 呼び出しが成功しているところをスクショで残す

## 環境構築

`npm init` から。ESM 前提なので `package.json` に `"type": "module"` を足しておきます。

```bash
npm init -y
# package.json に "type": "module" を追記
npm i @modelcontextprotocol/server@beta zod
npm i -D typescript @types/node
```

インストール後の依存はこうなりました。

```
mcp-playground@0.0.1
+-- @modelcontextprotocol/server@2.0.0-beta.5
| +-- @modelcontextprotocol/core@2.0.0-beta.5
| | `-- zod@4.4.3 deduped
| `-- zod@4.4.3 deduped
+-- @types/node@26.1.1
+-- typescript@7.0.2
`-- zod@4.4.3
```

`zod` は自分で入れたものと server 内部の依存が同じ 4.4.3 に dedup されていました。あと地味に驚いたのが TypeScript が **7.0.2**（`tsc` も v7）だったこと。

`tsconfig.json` は最小限で、`module`/`moduleResolution` を `NodeNext` にしています。ESM 出力にそろえるためです。

```json:tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "build",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"]
}
```

空の `src/index.ts` を一度 `npx tsc` して `build/index.js` が出ることだけ先に確認しました（exit=0）。ここは特に詰まらず。

## 最小サーバーを実装する（本編）

本体はこれだけです。`McpServer` を作って `registerTool` でツールを登録し、`StdioServerTransport` でつなぐ、という流れ。

```ts:src/index.ts
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import * as z from "zod";

const server = new McpServer({ name: "playground", version: "0.0.1" });

server.registerTool(
  "add",
  {
    description: "add two numbers",
    inputSchema: z.object({ a: z.number(), b: z.number() }),
  },
  async ({ a, b }) => ({ content: [{ type: "text", text: String(a + b) }] })
);

server.registerTool(
  "echo",
  {
    description: "echo back the given text",
    inputSchema: z.object({ text: z.string() }),
  },
  async ({ text }) => ({ content: [{ type: "text", text }] })
);

await server.connect(new StdioServerTransport());
```

書く前に `node_modules/@modelcontextprotocol/server` の型定義（`dist/index.d.mts` / `stdio.d.mts`）で `McpServer`・`StdioServerTransport`・`registerTool` の実際のシグネチャを見てから書きました。ベータ版だと「ネットの例が今の版と合っているか」が不安になりますが、型定義を直接読むとその不安が消えるのでおすすめです。

一つ気づいたのが、`inputSchema` に渡すスキーマの形です。型定義を見ると、v1 で定番だった生シェイプ形式（`{ a: z.number() }`）は `@deprecated` で「Wrap with `z.object({...})` instead」と書かれていました。なので上のように `z.object({...})` で渡しています。

`npx tsc` は型エラーなしで通りました（exit=0）。

## Inspector で叩く

ここからが確認パートです。MCP Inspector には UI モードと CLI モードがあって、機械的に確認するなら CLI が楽でした（後述しますが UI はトークンが要ります）。

まず `tools/list`。版を固定して起動します。

```bash
npx @modelcontextprotocol/inspector@1.0.0 --cli node build/index.js --method tools/list
```

出力（依存の deprecated 警告が先に出ますが実害はなかったです）:

```json
{
  "tools": [
    {
      "name": "add",
      "description": "add two numbers",
      "inputSchema": {
        "type": "object",
        "properties": { "a": { "type": "number" }, "b": { "type": "number" } },
        "required": ["a", "b"],
        "$schema": "https://json-schema.org/draft/2020-12/schema"
      }
    },
    {
      "name": "echo",
      "description": "echo back the given text",
      "inputSchema": {
        "type": "object",
        "properties": { "text": { "type": "string" } },
        "required": ["text"],
        "$schema": "https://json-schema.org/draft/2020-12/schema"
      }
    }
  ]
}
```

`z.object({...})` で書いたスキーマが JSON Schema（draft 2020-12）に自動変換されてツール定義に出ていました。手書きの JSON Schema を書かずに済むのは体験として気持ちよかったです。疎通 OK の瞬間。

次に実際に呼び出します。

```bash
npx @modelcontextprotocol/inspector@1.0.0 --cli node build/index.js \
  --method tools/call --tool-name add --tool-arg a=2 --tool-arg b=3
```

```json
{ "content": [ { "type": "text", "text": "5" } ] }
```

`2 + 3 = 5` が返ってきました。ここで一つ予想が外れた話があるのですが、それは次の節にまとめます。

UI 側も見ておきました。CLI で確認できていても、記事に載せる「動いてる絵」としてスクショが欲しかったからです。UI は Session token が必須で、起動ログに出るトークン付き URL でアクセスします（この起動まわりも次の節に書きます）。

`List Tools` を押すと `add` と `echo` が並びます。

![Inspector の Tools 一覧に add と echo が出ている画面](/images/mcp-server-typescript-v2-inspector-try/03-tools-listed.png)

`add` を選んで `a=2`・`b=3` を入れて `Run Tool` すると、右下に `Tool Result: Success` が出て、History に `tools/call` が積まれました。

![add に a=2, b=3 を入れて実行し Tool Result: Success が出ている画面](/images/mcp-server-typescript-v2-inspector-try/04-tool-call-result.png)

## 詰まった点と、予想が外れた話

今回まったくのノートラブルではなかったのと、事前に「ここで詰まりそう」と挙げていた予想がいくつか外れたので、そのあたりを書きます。

一番の「へえ」は `--tool-arg` の型でした。CLI の引数は文字列だから、`a=2` は文字列 `"2"` として渡って、`z.number()` のスキーマに弾かれるだろう、と予想していました。ところが上のとおり普通に `5` が返ってきます。試しに、数値に変換できない値を渡すとどうなるか見てみました。

```bash
npx @modelcontextprotocol/inspector@1.0.0 --cli node build/index.js \
  --method tools/call --tool-name add --tool-arg a=foo --tool-arg b=3
```

```json
{
  "content": [
    {
      "type": "text",
      "text": "Input validation error: Invalid arguments for tool add: a: Invalid input: expected number, received null"
    }
  ],
  "isError": true
}
```

これで腑に落ちました。Inspector CLI は `--tool-arg` の値を JSON 値として解釈するようで、`2` は数値の `2` に変換されて通り、`foo` は数値にできないので `null` 扱いになって Zod に `expected number, received null` で弾かれた、ということのようです。「文字列だから弾かれる」という予想はハズレで、Inspector 側の型変換に吸収されていました。ちなみにバリデーション失敗は例外ではなく、`isError: true` を持ったツール結果として返り、プロセス自体は exit=0 でした。エラーがツール結果の中に構造化されて返ってくるのは、Zod のメッセージがそのまま透けて見えて分かりやすかったです。

もう一つ、UI を開くところで少しつまずきました。素の `http://localhost:6274` を開くと接続できず、UI は Session token が必須でした。起動時のログにトークン付き URL が出るので、それをそのまま開く必要があります。

```
🚀 MCP Inspector is up and running at:
   http://localhost:6274/?MCP_PROXY_AUTH_TOKEN=<token>
```

スクショは Playwright で撮ったのですが、このトークン付き URL を起動ログから取り出して渡す形にしました。トークンが要るのは UI だけの話で、確認そのものは CLI に寄せると迷わないな、というのが結論です。

なお Playwright は同梱 Chromium が最新の Chrome より古いことがあるので、今回は最初から `chromium.launch({ channel: 'chrome' })` でローカルの Chrome を使って撮っています（MCP の主題からは外れる小ネタですが、同梱ブラウザ待ちでハマらないための保険です）。

## 触って分かったこと（v1 と v2 の書き比べ）

移行のイメージをつかむために、v1 系（`@modelcontextprotocol/sdk@1.29.0`）だとどう書くかも並べてみました。

:::message alert
v1 側は今回**実行していません**。import 先や生シェイプ非推奨は、npm の `exports` と v2 型定義の `@deprecated` 記述からの読み取りです（要確認）。
:::

```ts:v1 の書き方（比較用・未実行）
// @modelcontextprotocol/sdk@1.29.0 想定
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "playground", version: "0.0.1" });

// v1 は inputSchema に「生のシェイプ」を直接渡すのが定番だった。
// v2 ではこの形式は @deprecated（"Wrap with z.object({...}) instead"）。
server.registerTool(
  "add",
  { description: "add two numbers", inputSchema: { a: z.number(), b: z.number() } },
  async ({ a, b }) => ({ content: [{ type: "text", text: String(a + b) }] })
);
```

違いをまとめると:

| 観点 | v1 (`@modelcontextprotocol/sdk@1.29.0`) | v2 (`@modelcontextprotocol/server@2.0.0-beta.5`) |
|---|---|---|
| パッケージ | 単一 `@modelcontextprotocol/sdk` | server / client / core に分割 |
| `McpServer` の import | `@modelcontextprotocol/sdk/server/mcp.js` | `@modelcontextprotocol/server` |
| Stdio の import | `@modelcontextprotocol/sdk/server/stdio.js` | `@modelcontextprotocol/server/stdio` |
| Node engines | `>=18` | `>=20` |
| inputSchema | 生シェイプ `{ a: z.number() }` が定番 | `z.object({...})` 推奨。生シェイプは `@deprecated` |

触ってみて「消えた/変わった」と感じたのは、手書きの JSON Schema（v2 は Zod から自動変換）と、生シェイプ渡しから `z.object()` への統一の2つでした。ネットに転がっている v1 前提のコードは、少なくとも import 行はそのままでは動かないので、移行時はまずそこを直すことになりそうです。

## まとめ

最小の MCP サーバー（`add` / `echo`）を v2 ベータで作って、Inspector の CLI と UI で叩くところまで一通りできました。完了条件に置いた4つ（一覧・呼び出し・バリデーションエラー・UI スクショ）はすべて確認できています。

やってみた印象:

- v2 ベータでも、参考にした最小コードはそのまま通った。型定義を先に読んでおくと版差の不安が消える。
- 確認は Inspector CLI が楽。UI はトークンが要るぶん一手間。
- `--tool-arg` は Inspector 側で JSON 値として解釈される（数値文字列は number、変換不能は null）。「文字列だから弾かれる」という予想は外れた。

向いているのは、MCP をこれから触ってみたい新人〜2年目くらいの人だと思います。次は stdio ではなく HTTP 経由のサーバー（`createMcpHandler` 系）や、ツールに実際の副作用を持たせるところを試してみたいです。ベータ版なので、RC 以降で API がどう変わるかは追いかけないといけませんが、最小構成を一度自分で組めたので、変更が来ても差分で追える気がしています。

## 参考リンク

- MCP 公式サイト: https://modelcontextprotocol.io/
- MCP Inspector（GitHub）: https://github.com/modelcontextprotocol/inspector
- Zod: https://zod.dev/
