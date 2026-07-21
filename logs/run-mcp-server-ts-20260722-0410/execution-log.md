# 検証ログ: ローカルMCPサーバーをTypeScriptで初めて作り、MCP Inspectorで叩いてみた（SDK v2ベータ / stdio）

> Zenn記事の素材。実行の一次情報（コマンド・エラー全文・所要時間・スクショ）を記録。
> 記事本文は未執筆。「記事への写像」を見て articles/*.md に展開する。

## 実行の前提（採用した前提）

- 対象タスク: `practice/practice-mcp-server-ts-20260722-0408.md`
- 出典レポート: `research/search-topic-20260722-0404.md`
- 対象技術: MCP TypeScript SDK v2ベータ（`@modelcontextprotocol/server@beta` = **2.0.0-beta.5**）＋ MCP Inspector **1.0.0** ＋ Zod **4.4.3**
- 実行者: AIエージェント単独（非対話） <!-- 内部メタ: 記事に転記しない -->
- 実行日時 / 所要時間: 2026-07-22 04:10〜04:16 / 見積もり 約4h15m → 実測 約6分（AI単独・非対話。記事にはそのまま書かない） <!-- 実測はAI単独の値 -->
- 実行環境: macOS 26.5 (Darwin 25.5.0) / Node **v22.17.0** / npm 10.9.2 / TypeScript **7.0.2** / Google Chrome 150.0.7871.129（Playwright は channel:'chrome'）
- 採用した撤退ライン: 対象タスク既定。「v2ベータのAPI名変動で30分以上詰まったら `tools/list` の疎通確認までを成果とし、v1系に切替」。実際には撤退不要で全完了条件を達成。
- 判断方針: 引数で対象タスクファイルのみ指定。テーマ・時間・スキルレベルは無指定のためデフォルト前提（テーマ1 / 半日 / 新人）を採用。

## 結果サマリー

- 完了条件の判定: **達成**（4条件すべて客観確認。CLIのJSON出力3件＋UIスクショ1件）
- 作ったもの: stdio で動く最小MCPサーバー（`add` / `echo` の副作用なし2 tool）。コード: `workspace/src/index.ts`（ビルド後 `workspace/build/index.js`）
- スクショ: 4 枚（`screenshots/`）
- 詰まった点: 実質1件（予測した「`--tool-arg` の型で弾かれる」は**実際には起きず**、Inspector CLI が数値文字列を自動でJSON値に変換した）。予測との差分あり。
- knowledge 記録: なし（新規トラブルなし。既存 `knowledge/2026-07-21-playwright-bundled-chromium-lags-use-channel-chrome.md` を参照し channel:'chrome' を採用）

## 完了条件の検証

| # | 完了条件 | 判定 | 根拠（ログ / スクショ） |
|---|---|---|---|
| 1 | `--cli ... --method tools/list` で `add` が一覧に出る | 達成 | commands.log 「Phase3: Inspector CLI tools/list」。`add`・`echo` 2件のJSONを取得 |
| 2 | `tools/call add a=2 b=3` の結果に `5` が含まれる | 達成 | commands.log 「tools/call add a=2 b=3」→ `{"content":[{"type":"text","text":"5"}]}` |
| 3 | 型に反する入力（`a=foo`）でバリデーションエラーが返る | 達成 | commands.log 「validation error」→ `"Input validation error: ... a: Invalid input: expected number, received null"`, `isError:true` |
| 4 | Inspector UI(:6274) で tool call 実行画面を Playwright でスクショ | 達成 | `screenshots/04-tool-call-result.png`（a=2,b=3 / **Tool Result: Success** / History に tools/call） |

## タスク実行ログ（フェーズ別）

### フェーズ1: 事前調査（v1/v2差分・Inspector）

- [x] SDK v2ベータと v1系の差分を調べる（見積もり 15分 → 実測 約2分）
  - 実行したコマンド:
    ```bash
    npm view @modelcontextprotocol/server dist-tags versions
    npm view @modelcontextprotocol/client dist-tags
    npm view @modelcontextprotocol/sdk dist-tags
    npm view @modelcontextprotocol/inspector version
    npm view @modelcontextprotocol/server@beta exports type engines dependencies
    ```
  - 出力 / エラー（全文）:
    ```
    @modelcontextprotocol/server dist-tags = { latest: '2.0.0-beta.5', beta: '2.0.0-beta.5' }
    @modelcontextprotocol/client dist-tags = { latest: '2.0.0-beta.5', beta: '2.0.0-beta.5' }
    @modelcontextprotocol/sdk (v1)         = { latest: '1.29.0' }
    @modelcontextprotocol/inspector version = 1.0.0
    server type = 'module' / engines = { node: '>=20' } / dependencies = { zod: '^4.2.0', '@modelcontextprotocol/core': '2.0.0-beta.5' }
    exports: '.' → { import: dist/index.mjs, require: dist/index.cjs }, './stdio' → { import: dist/stdio.mjs, require: dist/stdio.cjs }, ほか './validators/ajv' 等
    ```
  - 効いた対処 / 試したこと: 記事の「裏取り」に頼らず、`npm view` で**実在する版と import 元**を先に確定させた。
  - つまずいた理由・分かっていなかった前提: v2 はパッケージ分割済み（server / client / core）。v1 は単一 `@modelcontextprotocol/sdk`。beta.5 が最新の beta かつ latest。
  - 既存技術と比べて感じた違い: import 元がパッケージ名レベルで変わる（`@modelcontextprotocol/sdk/server/mcp.js` → `@modelcontextprotocol/server`）。ネットの v1 前提記事はそのままでは動かない。
  - スクショ: なし（CLI出力で足りる）
  - 記事に書きたい気づき: **`type:'module'` かつ `engines node>=20`。ただし exports には `require`（.cjs）も存在**＝package 単位では厳密なESM専用ではなく dual publish。「v2はESM専用」という前情報は"推奨/既定がESM"の意味で受け取るのが正確（要確認だが exports は dual）。

- [x] Inspector の UI/CLI モードを把握する（見積もり 15分 → 実測 起動時に確認）
  - 記録: UIモードは `http://localhost:6274/?MCP_PROXY_AUTH_TOKEN=<token>`（起動時に Session token 自動生成・UI接続に必要）。CLIモードは `--cli ... --method <m> [--tool-name <n> --tool-arg k=v]` でトークン壁なし・JSON直出力。プロキシは :6277。
  - 記事に書きたい気づき: **機械検証は CLI モードが正解**（トークン不要・JSON即取得）。UIは人が触る用でトークン必須。

### フェーズ2: 環境構築（npm init / install / tsconfig / build）

- [x] `npm init -y` ＋ `"type":"module"` 追加（見積もり 10分 → 実測 約1分）
  - 実行したコマンド:
    ```bash
    npm init -y
    # package.json に "type":"module" と "build":"tsc" を追記
    ```
  - つまずいた理由: ESM専用前提のため `"type":"module"` は必須。忘れると `Cannot use import statement` 系になる想定（今回は先に付けたので未発生）。

- [x] 依存インストール（見積もり 20分 → 実測 約12秒）
  - 実行したコマンド:
    ```bash
    npm i @modelcontextprotocol/server@beta zod
    npm i -D typescript @types/node
    npm ls @modelcontextprotocol/server zod typescript @types/node
    ```
  - 出力 / エラー（全文）:
    ```
    added 3 packages ... (server + core + zod dedup)
    added 4 packages ... (typescript, @types/node ほか)
    mcp-playground@0.0.1
    +-- @modelcontextprotocol/server@2.0.0-beta.5
    | +-- @modelcontextprotocol/core@2.0.0-beta.5
    | | `-- zod@4.4.3 deduped
    | `-- zod@4.4.3 deduped
    +-- @types/node@26.1.1
    +-- typescript@7.0.2
    `-- zod@4.4.3
    ```
  - つまずいた理由・分かっていなかった前提: `zod` は server の依存にも入っており重複解決（dedup）される。**TypeScript は 7.0.2**（tsc も v7）。
  - 既存技術と比べて感じた違い: `zod@4.2.0+` 前提。手書きJSON Schema用の追加ライブラリは不要（Standard Schema）。

- [x] 空 `src/index.ts` を `tsc` でビルド（見積もり 15分 → 実測 約1分）
  - 実行したコマンド:
    ```bash
    # tsconfig.json: target ES2022 / module NodeNext / moduleResolution NodeNext / outDir build / strict
    npx tsc && ls -la build/
    ```
  - 出力 / エラー（全文）:
    ```
    exit=0
    build/index.js が生成（空 export）
    ```
  - つまずいた理由: 特になし。`NodeNext` で ESM 出力になり整合。

### フェーズ3: 最小サーバー実装と Inspector CLI 検証【本編】

- [x] stdio サーバー骨格＋`add`（Zod v4 inputSchema）を実装しビルド（見積もり 50分 → 実測 約2分）
  - 実装（`workspace/src/index.ts` 抜粋）:
    ```ts
    import { McpServer } from "@modelcontextprotocol/server";
    import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
    import * as z from "zod";

    const server = new McpServer({ name: "playground", version: "0.0.1" });

    server.registerTool(
      "add",
      { description: "add two numbers", inputSchema: z.object({ a: z.number(), b: z.number() }) },
      async ({ a, b }) => ({ content: [{ type: "text", text: String(a + b) }] })
    );
    // echo も同様に registerTool（text:z.string()）
    await server.connect(new StdioServerTransport());
    ```
  - 出力 / エラー（全文）:
    ```
    npx tsc → exit=0（型エラーなし）
    ```
  - 効いた対処 / 試したこと: import 元は型定義（`node_modules/@modelcontextprotocol/server/dist/index.d.mts` / `stdio.d.mts`）で `McpServer`・`StdioServerTransport`・`registerTool` の実シグネチャを確認してから記述。`inputSchema` は `z.object({...})`（StandardSchema）で受かる。
  - つまずいた理由・分かっていなかった前提: `zod/v4` サブパスも存在するが、zod 4.x では素の `import * as z from "zod"` が既に v4。どちらでも動く。
  - 既存技術と比べて感じた違い: v2 型定義で **raw shape 形式（`{ a: z.number() }`）は `@deprecated`「Wrap with z.object({...}) instead」**。v1 の定番だった生シェイプ渡しは非推奨化され、`z.object()` に寄せる方向。
  - スクショ: なし（ビルド成否で判定）
  - 記事に書きたい気づき: 参考実装（タスク記載）が beta.5 でそのまま通った。型定義を先に読むと版差の不安が消える。

- [x] Inspector CLI `tools/list`（見積もり 20分 → 実測 約20秒※初回 npx DL含む）
  - 実行したコマンド:
    ```bash
    npx @modelcontextprotocol/inspector@1.0.0 --cli node build/index.js --method tools/list
    ```
  - 出力 / エラー（全文）:
    ```
    npm warn exec ... will install @modelcontextprotocol/inspector@1.0.0
    npm warn deprecated inflight@1.0.6 / glob@7.2.3 / node-domexception@1.0.0（依存の非推奨警告のみ・実害なし）
    {
      "tools": [
        { "name": "add", "description": "add two numbers",
          "inputSchema": { "type": "object",
            "properties": { "a": {"type":"number"}, "b": {"type":"number"} },
            "required": ["a","b"], "$schema": "https://json-schema.org/draft/2020-12/schema" } },
        { "name": "echo", "description": "echo back the given text",
          "inputSchema": { "type": "object",
            "properties": { "text": {"type":"string"} },
            "required": ["text"], "$schema": "https://json-schema.org/draft/2020-12/schema" } }
      ]
    }
    exit=0
    ```
  - 効いた対処: 版を `@1.0.0` で固定して起動（再現性）。
  - 既存技術と比べて感じた違い: **Zod で書いた `z.object` が JSON Schema（draft 2020-12）へ自動変換**されて tool 定義に出る＝手書きJSON Schemaが消える体験。疎通OKの瞬間。

- [x] Inspector CLI `tools/call add a=2 b=3`（見積もり 20分 → 実測 約10秒）
  - 実行したコマンド:
    ```bash
    npx @modelcontextprotocol/inspector@1.0.0 --cli node build/index.js \
      --method tools/call --tool-name add --tool-arg a=2 --tool-arg b=3
    ```
  - 出力 / エラー（全文）:
    ```
    { "content": [ { "type": "text", "text": "5" } ] }
    exit=0
    ```
  - つまずいた理由・分かっていなかった前提: **予測（詰まりポイント#4）に反して、文字列 `a=2` はエラーにならず数値 2 として通り `5` が返った**。Inspector CLI は `--tool-arg` の値を JSON 値として解釈し、数値文字列を number に変換している。
  - 記事に書きたい気づき: 「CLIの引数は文字列だから number スキーマで弾かれる」という予想は外れ。Inspector 側の型変換で吸収された。予測と実測の差分がそのまま素材。

- [x] Inspector CLI `tools/call add a=foo b=3`（バリデーションエラー）（見積もり 15分 → 実測 約10秒）
  - 実行したコマンド:
    ```bash
    npx @modelcontextprotocol/inspector@1.0.0 --cli node build/index.js \
      --method tools/call --tool-name add --tool-arg a=foo --tool-arg b=3
    ```
  - 出力 / エラー（全文）:
    ```
    {
      "content": [
        { "type": "text",
          "text": "Input validation error: Invalid arguments for tool add: a: Invalid input: expected number, received null" }
      ],
      "isError": true
    }
    exit=0
    ```
  - つまずいた理由・分かっていなかった前提: `foo` は number へ変換できず **`null` 扱い**になり、Standard Schema（Zod）が `expected number, received null` で弾いた。エラーは例外ではなく `isError:true` の tool 結果として返る（プロセスの exit=0）。
  - 既存技術と比べて感じた違い: バリデーション失敗が「ツール結果の中のエラー」として構造化されて返る。Zod のメッセージがそのまま透過。

- [x] Inspector UI(:6274) を Playwright でスクショ（見積もり 15分 → 実測 約1分）
  - 実行したコマンド:
    ```bash
    # UIモードをバックグラウンド起動（トークンをログから取得）
    MCP_AUTO_OPEN_ENABLED=false npx @modelcontextprotocol/inspector@1.0.0 node build/index.js > inspector-ui.log 2>&1 &
    # inspector-ui.log から http://localhost:6274/?MCP_PROXY_AUTH_TOKEN=<token> を取得
    node shot.mjs "<token>" ../screenshots   # playwright chromium.launch({ channel: 'chrome' })
    ```
  - 出力 / エラー（全文）:
    ```
    Starting MCP inspector...
    ⚙️ Proxy server listening on localhost:6277
    🔑 Session token: a3d1efca...（マスク不要な検証用ローカルトークン。プロセス終了で無効）
       Use this token to authenticate requests or set DANGEROUSLY_OMIT_AUTH=true to disable auth
    🚀 MCP Inspector is up and running at:
       http://localhost:6274/?MCP_PROXY_AUTH_TOKEN=a3d1efca...
    ---- Playwright ----
    shot 01 saved / clicked Connect / shot 02 saved / clicked Tools tab / clicked List Tools /
    [page] log [AppsTab] Filtered app tools: {totalTools: 2, ...} / shot 03 saved /
    clicked add tool / number inputs found: 2 / filled args / clicked Run Tool / shot 04 saved / done
    exit=0
    ```
  - 効いた対処 / 試したこと: 起動ログから**トークン付きURL**を機械的に取り出して Playwright に渡す。既存 knowledge（Playwright 同梱Chromium が古い）に従い `channel:'chrome'`（ローカル Chrome 150）で起動。`MCP_AUTO_OPEN_ENABLED=false` で自動ブラウザ起動を抑止。
  - つまずいた理由・分かっていなかった前提: UIは**トークン必須**。Playwright で素の `localhost:6274` を開くと弾かれるので、起動ログのトークンをURLに付ける必要がある。
  - スクショ: `screenshots/01-inspector-loaded.png`（接続前）/ `02-connected.png`（Connected）/ `03-tools-listed.png`（add・echo 一覧）/ `04-tool-call-result.png`（**add a=2,b=3 → Tool Result: Success**、History に tools/call）
  - 記事に書きたい気づき: 「トークン壁」は UI だけの話で、検証自体は CLI に寄せると迷わない。UIスクショは記事の"動いてる絵"に有効。

### フェーズ4: 深掘り・比較（v1 vs v2 書き比べ / echo）

- [x] v1 vs v2 書き比べ（見積もり 20分 → 実測 約1分・公式メタ/型定義ベース、v1未実行）
  - 実行したコマンド:
    ```bash
    npm view @modelcontextprotocol/sdk@1.29.0 type engines exports
    ```
  - 出力（全文・抜粋）:
    ```
    v1 sdk type = 'module' / engines = { node: '>=18' }
    exports './server' → import: dist/esm/server/index.js（McpServer は ./server/mcp.js, Stdio は ./server/stdio.js）
    ```
  - 書き比べ表:

    | 観点 | v1 (`@modelcontextprotocol/sdk@1.29.0`) | v2 (`@modelcontextprotocol/server@2.0.0-beta.5`) |
    |---|---|---|
    | パッケージ | 単一 `@modelcontextprotocol/sdk` | server/client/core に分割（`@modelcontextprotocol/server` 等） |
    | McpServer の import | `@modelcontextprotocol/sdk/server/mcp.js` | `@modelcontextprotocol/server` |
    | Stdio の import | `@modelcontextprotocol/sdk/server/stdio.js` | `@modelcontextprotocol/server/stdio` |
    | Node engines | `>=18` | `>=20` |
    | inputSchema | 生シェイプ `{ a: z.number() }` が定番 | `z.object({...})`（Standard Schema）推奨。生シェイプは `@deprecated` |
    | スキーマ対応 | Zod 前提 | Standard Schema（Zod v4 / Valibot / ArkType 等） |
  - 注意（要確認）: v1 は本検証で**実行していない**（版差で崩れやすいため）。import 元・生シェイプ非推奨は npm exports と v2 型定義の `@deprecated` 記述からの推定。`workspace/v1-reference-NOT-RUN.ts` に比較用コードを置いた（未実行）。
  - 記事に書きたい気づき: 「消えた記述」は**手書きJSON Schema**（v2 は Zod→JSON Schema 自動変換）と、生シェイプ→`z.object()` への統一。

- [x] （任意）`echo` tool 追加（見積もり 10分 → 実測 約1分）
  - 記録: `registerTool("echo", { inputSchema: z.object({ text: z.string() }) }, ...)` を足すだけ。`tools/list` に2件（`screenshots/03-tools-listed.png` に add・echo）。tool 追加の手数は1ブロック。

### フェーズ5: 振り返り・記事化準備

- [x] 詰まった点の棚卸し（下表）／[x] 記事への写像を実績で更新（後述）

## 詰まった点と解決過程（記事の核）

| # | 詰まった点 | 原因 | 効いた対処 | 所要 | 解決/撤退 | 記事での活かし方 |
|---|---|---|---|---|---|---|
| 1 | （予測1）UIがトークン必須でPlaywrightで開けない | UI接続に Session token 必須 | 起動ログの `?MCP_PROXY_AUTH_TOKEN=` 付きURLをそのまま開く。判定は CLI で実施 | 数分 | 解決 | 「UIはトークン壁・機械検証はCLI」の実例 |
| 2 | （予測4・**外れ**）`--tool-arg a=2` が文字列で弾かれる想定だった | 実際は Inspector CLI が数値文字列を number に変換。むしろ `a=foo` は `null` 化されて弾かれる | そのまま通ったので対処不要。挙動を記録 | 0分 | 解決（予測と差分） | 「予想が外れた」実録。CLIの型変換の実挙動 |
| 3 | Playwright 同梱 Chromium が最新Chromeより古い懸念 | 既知（knowledge 参照） | 最初から `channel:'chrome'`（Chrome 150）で起動 | 0分 | 回避 | 既存knowledgeの再利用例 |
| 4 | 「v2はESM専用」の理解 | 実際は exports に require(.cjs)もある dual publish。ただし `type:module`・`node>=20` | 事実として dual と記録（要確認扱い） | 0分 | 記録 | 前情報を鵜呑みにせず一次確認する作法 |

> 予測（詰まりポイント表）と実際の差分: 予測#2(ESM)・#3(パッケージ名)・#5(ベータ版差) は**先に版と import 元を固定したため未発生**。予測#4(`--tool-arg`型) は**逆に何もせず通った**のが最大の発見。

## スクリーンショット一覧

| ファイル | 何を示すか | 使う見出し |
|---|---|---|
| screenshots/01-inspector-loaded.png | Inspector UI 初期画面（STDIO / command node / args build/index.js） | 6. Inspectorで叩く |
| screenshots/02-connected.png | Connect 後（左下 Connected 緑） | 6. Inspectorで叩く |
| screenshots/03-tools-listed.png | List Tools 後、add・echo が並ぶ | 6. Inspectorで叩く / 8. 比較(echo追加) |
| screenshots/04-tool-call-result.png | add a=2,b=3 実行 → Tool Result: Success、History に tools/call | 6. Inspectorで叩く（動いてる絵） |

## 記事への写像（実績で埋める）

| 記事の見出し | 使う記録 / スクショ | 書くこと（メモ） |
|---|---|---|
| 1. はじめに | 前提・動機 | 新人が鍵なし・ローカルでMCPを試す動機 |
| 2. なぜMCPを試すのか | フェーズ1 | 07-28 RC前の旬・開発ツール標準化。※記事化時に最新性は再確認 |
| 3. 事前に調べたこと（v2変更点） | フェーズ1ログ（npm view 出力） | パッケージ分割 / stateless / Standard Schema。**dual publish の一次確認**も添える |
| 4. 環境構築 | フェーズ2ログ | 正確な版（server 2.0.0-beta.5 / zod 4.4.3 / TS 7.0.2 / Node 22.17）・`type:module`・tsconfig(NodeNext) |
| 5. 最小サーバー実装 | フェーズ3前半ログ / `workspace/src/index.ts` | stdio 骨格・`add`・`z.object` inputSchema・ビルド exit=0 |
| 6. Inspectorで叩く | フェーズ3後半ログ / screenshots 01-04 | CLIの tools/list・tools/call JSON全文・UIスクショ・トークンURLの組み立て |
| 7. 詰まった点 | 「詰まった点」表 / エラー全文 | トークン壁 / `--tool-arg` 型が**逆に通った** / channel:'chrome' / dual publish |
| 8. 触って分かったこと（比較） | フェーズ4ログ / 書き比べ表 / `v1-reference-NOT-RUN.ts` | v1↔v2 import・生シェイプ非推奨・JSON Schema自動変換 |
| 9. どんな人に向くか | フェーズ5棚卸し | MCP入門したい新人〜2年目 |
| 10. まとめ | 結果サマリー | 向いている人・次にやること（HTTP/createMcpHandler 等） |

## 未達・撤退した項目

- なし（4完了条件すべて達成）。v1系の実行検証のみ意図的に未実施（タスクの指示どおり公式/型定義ベースの比較に留めた。`workspace/v1-reference-NOT-RUN.ts` は未実行）。

## 再現性メモ（記事に転記する用）

- OS / ランタイム / 主要ライブラリ: macOS 26.5 / Node v22.17.0 / TypeScript 7.0.2 / `@modelcontextprotocol/server@2.0.0-beta.5`（＋core 同版）/ zod 4.4.3 / `@modelcontextprotocol/inspector@1.0.0` / Google Chrome 150（Playwright channel:'chrome'）
- 最短の再現手順:
  ```bash
  npm init -y                    # package.json に "type":"module" を追記
  npm i @modelcontextprotocol/server@beta zod
  npm i -D typescript @types/node
  # tsconfig.json: target ES2022 / module NodeNext / moduleResolution NodeNext / outDir build
  # src/index.ts に McpServer + StdioServerTransport + registerTool(add) を実装
  npx tsc
  npx @modelcontextprotocol/inspector@1.0.0 --cli node build/index.js --method tools/list
  npx @modelcontextprotocol/inspector@1.0.0 --cli node build/index.js \
    --method tools/call --tool-name add --tool-arg a=2 --tool-arg b=3
  ```
- 注意点:
  - **ベータ版**（2.0.0-beta.5）。RC(2026-07-28)前後で API 変動しうる。版を固定し「検証時点の版」を明記する。
  - UIモードは Session token 必須。CLIモードはトークン不要で JSON 即取得（機械検証向き）。
  - `--tool-arg` の値は Inspector 側で JSON 値として解釈される（数値文字列→number、変換不能→null）。
  - Node は 20+（v2 engines）。`"type":"module"` 必須。
  - Playwright は同梱 Chromium が古い場合があるため `channel:'chrome'` でローカル Chrome を使う。

## 次のアクション（記事化）

- [ ] この execution-log.md の「記事への写像」に沿って `articles/<slug>.md` を作成する
- [ ] スクショを Zenn 用に `images/mcp-server-ts/` へ移し `![説明](/images/mcp-server-ts/04-...png)` で参照する
- [ ] 完了条件・詰まった点（特に `--tool-arg` が逆に通った件）・v1↔v2 比較を本文に落とす
