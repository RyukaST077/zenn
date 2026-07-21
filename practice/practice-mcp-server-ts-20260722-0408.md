# 実践タスク: ローカルMCPサーバーをTypeScriptで初めて作り、MCP Inspectorで叩いてみた（SDK v2 / stateless）

## このタスクの前提

- 出典レポート: `research/search-topic-20260722-0404.md`
- 元テーマ: テーマ1（★最有力 / 「最初に試すべき1本」）
- 対象技術: MCP TypeScript SDK v2ベータ（`@modelcontextprotocol/server` / `@modelcontextprotocol/client`）＋ MCP Inspector
- 記事の方向性（記事タイプ）: 「試してみた」「初めて触ってみた」＋ v1系との「書き比べ」を一部添える
- 想定筆者 / 想定読者: Web系の新人エンジニア / MCPを名前だけ知っている新人〜実務2年目
- 検証に使える想定時間: 半日（約3〜4時間）
- 判断方針: 引数で対象レポートのみ指定。テーマ・時間・スキルレベルは無指定のためデフォルト前提（レポートの「最初に試すべき1本」＝テーマ1、半日、新人）を採用。
- 実行環境の担保: LLMのAPI鍵・サインアップ・手動デプロイ不要。サーバーは stdio でローカル起動し、動作確認は **Inspector の CLI モード（`--cli`）** でJSONを取得して判定する（機械判定・非対話）。UIのスクショは Playwright（channel Chrome）で取得する。すべて CLI / コード / Playwright だけで完結し、テーマ置き換えは不要。

> **裏取り済みの重要事実（2026-07-22 時点 / WebFetch で確認）**
> - v2ベータはパッケージ分割済み。サーバーは `@modelcontextprotocol/server@beta`、クライアントは `@modelcontextprotocol/client@beta`（v1系は `@modelcontextprotocol/sdk`）。
> - **ESM専用**・**Node.js 20+**（Bun / Deno も可）。
> - `inputSchema` は **Standard Schema** 対応。Zod v4 / Valibot / ArkType が使える（手書きJSON Schema不要）。
> - stateless コアが入り、HTTP では `createMcpHandler` が入口。stdio は従来どおり常駐トランスポート。
> - Inspector: `npx @modelcontextprotocol/inspector node build/index.js` でUIが `http://localhost:6274` に起動。**起動時にセッショントークンが自動生成され、UI接続に必要**。
> - Inspector CLIモード: `npx @modelcontextprotocol/inspector --cli node build/index.js --method tools/list` / `--method tools/call --tool-name <名> --tool-arg key=value` でJSON出力（トークン壁なし・自動化向き）。
> - 仕様RCは 2026-07-28。**ベータは破壊的変更が入りうるため、必ずバージョンを固定し「検証時点の版」を明記する**。

## 完成イメージ（成果物）

- 作るもの: stdio で動く最小のMCPサーバー（副作用のない tool を1〜2個）。
  - `add`（数値2つの加算）… 正常系・異常系（Standard Schema バリデーション）確認用
  - （任意）`echo`（文字列をそのまま返す）… tool 追加の型を掴む用
- 「できた」と言える完了条件:
  1. `npx @modelcontextprotocol/inspector --cli node build/index.js --method tools/list` で `add` が一覧に出る
  2. `--method tools/call --tool-name add --tool-arg a=2 --tool-arg b=3` の結果に `5` が含まれる
  3. 型に反する入力（例: `a=foo`）でバリデーションエラーが返る
  4. Inspector の UI（:6274）で tool call を実行した画面を Playwright でスクショ取得できる
- 完了確認の方法: Inspector CLIモードのJSON出力（1〜3）＋ Playwrightスクショ（4）
- 記事タイトル案（そのまま使える形）:
  1. MCPサーバーを初めてTypeScriptで作って、Inspectorで叩いてみた（鍵なし・ローカル完結）
  2. 鍵なしで試すMCP入門 — 最小のstdioサーバーをローカルで動かす
  3. MCP TS SDK v2ベータの新しい書き味（stateless / Standard Schema）を新人が触ってみた

## 事前準備チェックリスト

- [ ] 認証・APIキー: **LLMのAPI鍵は不要**。Inspectorのセッショントークンは起動時に自動生成（人手のサインアップ・課金なし）。
- [ ] ローカル環境: Node.js 20以上（`node -v` で確認）。ESM専用のため `package.json` に `"type": "module"` を付ける。
- [ ] インストールするもの: `@modelcontextprotocol/server@beta`（版を固定）、`zod`（v4）、`typescript` / `@types/node`。Inspector は `npx` 実行で常駐不要。
- [ ] 無料枠 / コストの確認: すべてローカル・OSSで完全無料。ネットワーク送信なし。
- [ ] 記録用の準備: リポジトリ内に作業ディレクトリ、`images/mcp-server-ts/` にスクショ、実行ログ・エラー全文を残すメモを用意。

## 実践タスク（フェーズ別）

### フェーズ1: 事前調査（目安: 30分）

- [ ] MCP TS SDK v2ベータのリリース記事とREADMEを読み、v1系（`@modelcontextprotocol/sdk`）との差分（パッケージ分割・stateless・Standard Schema）を3点メモする（目安: 15分）
  - 記録すること: v1とv2で「import元」「サーバー生成」「tool登録」がどう変わったか。参照した公式URLと確認した版。
- [ ] Inspector の README を読み、UIモードと `--cli` モードの起動コマンド・ポート(:6274)・セッショントークンの扱いを把握する（目安: 15分）
  - 記録すること: 「UIはトークン必須／CLIはトークン不要」という気づき。CLIの `--method` / `--tool-arg` の書式。

### フェーズ2: 環境構築（目安: 45分）

- [ ] 作業ディレクトリで `npm init -y` し、`package.json` に `"type": "module"` を追加する（目安: 10分）
  - 記録すること: 実行コマンドと、ESM専用ゆえの `"type": "module"` の必要性。
- [ ] `npm i @modelcontextprotocol/server@beta zod` と `npm i -D typescript @types/node` を実行し、`tsconfig.json` を作る（`module`/`moduleResolution` は `NodeNext`、`target` は `ES2022` 目安）（目安: 20分）
  - 記録すること: インストールした**正確な版**（`npm ls @modelcontextprotocol/server` の出力）。tsconfigの中身。
- [ ] 空の `src/index.ts` を `tsc` でビルドし `build/index.js` が出ることを確認する（目安: 15分）
  - 記録すること: ビルドコマンド（`npx tsc`）、出力先、最初のエラーがあれば全文。

### フェーズ3: 実装・検証【本編】（目安: 120分）

- [ ] `src/index.ts` に stdio トランスポートで起動する最小サーバー骨格を書き、`tsc` でビルドが通ることを確認する（目安: 30分）
  - 記録すること: `McpServer` と `StdioServerTransport`（`@modelcontextprotocol/server/stdio`）の import 行、`server.connect(transport)` までのコード。
  - 参考実装（裏取り済み・検証時に版に合わせて要確認）:
    ```ts
    import { McpServer } from "@modelcontextprotocol/server";
    import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
    import * as z from "zod/v4";

    const server = new McpServer({ name: "playground", version: "0.0.1" });

    server.registerTool(
      "add",
      { description: "add two numbers", inputSchema: z.object({ a: z.number(), b: z.number() }) },
      async ({ a, b }) => ({ content: [{ type: "text", text: String(a + b) }] })
    );

    await server.connect(new StdioServerTransport());
    ```
- [ ] `add` tool を Standard Schema（Zod v4）の inputSchema 付きで登録し、ビルドする（目安: 20分）
  - 記録すること: inputSchema の書き方。手書きJSON Schemaと比べた行数・可読性。
- [ ] `npx @modelcontextprotocol/inspector --cli node build/index.js --method tools/list` を実行し、`add` が一覧に出るJSONを取得する（目安: 20分）
  - 記録すること: 実行コマンドと**出力JSON全文**。tool一覧に出た＝疎通OKの瞬間。
- [ ] `--method tools/call --tool-name add --tool-arg a=2 --tool-arg b=3` を実行し、結果に `5` が含まれることを確認する（目安: 20分）
  - 記録すること: コマンドと出力JSON。`--tool-arg` の型（文字列→数値）まわりで詰まった点。
- [ ] 型違反の入力（例: `--tool-arg a=foo --tool-arg b=3`）でバリデーションエラーが返ることを確認する（目安: 15分）
  - 記録すること: エラー出力の全文。Standard Schema が弾いた挙動。
- [ ] Inspector をUIモード（`npx @modelcontextprotocol/inspector node build/index.js`）で起動し、コンソールに出るセッショントークンを読み取り、`http://localhost:6274/?...token...` を Playwright（channel Chrome）で開いて tool call 実行画面をスクショする（目安: 15分）
  - 記録すること: トークン付きURLの組み立て方（自動でブラウザが開く挙動と、Playwrightで開く場合の差）。スクショのパス。

### フェーズ4: 深掘り・比較（目安: 30分）

- [ ] v1系（`@modelcontextprotocol/sdk`）の同等サーバーの書き方を調べ、import元・tool登録APIの差を「書き比べ」表にする（目安: 20分）
  - 記録すること: v1 vs v2 の import・生成・登録の対比。手書きJSON Schema → Standard Schema で消えた記述。
  - 注意: v1コードの実行までは求めない（版差で崩れやすい）。差分は公式ドキュメント基準でよい。確認できない点は「要確認」と明記する。
- [ ] （任意）`echo` tool を1つ追加し、複数tool時の `tools/list` を確認する（目安: 10分）
  - 記録すること: tool追加の手数。増えたときのInspector表示。

### フェーズ5: 振り返り・記事化準備（目安: 30分）

- [ ] 記録テンプレを見返して詰まった点（トークン壁・ESM設定・ベータ版差・`--tool-arg` の型）を棚卸しする（目安: 15分）
- [ ] 「記事への写像」に沿って本文ドラフトの見出しを埋める（目安: 15分）

> 目安時間の合計: 約 4 時間 15 分（事前調査30＋環境構築45＋本編120＋深掘り30＋振り返り30）。半日枠にほぼ収まる。超過しそうならフェーズ4の任意タスクとv1書き比べを削る。

## 詰まりそうなポイントと対処の指針

| # | 詰まりそうな点 | なぜ起きるか | 最初に試すこと | 記事での活かし方 |
|---|---|---|---|---|
| 1 | Inspector UI が「トークン必須」で開けない／Playwrightで白画面 | 起動時に自動生成されるセッショントークンがURLに必要。自前ブラウザ(Playwright)ではトークン未付与で弾かれる | コンソールの `🔑 Session token:` を読み、`?MCP_PROXY_AUTH_TOKEN=...` 等を付けたURLで開く。判定自体は `--cli` モードで行う | 「UIはトークン壁、機械検証はCLIが正解」を新人視点で解説。CLIモード推しの根拠に |
| 2 | `Cannot use import statement` / ESM関連エラー | v2はESM専用。`"type": "module"` 無し・tsconfigの module 設定不一致で壊れる | `package.json` に `"type":"module"`、tsconfig を `NodeNext` に。Node 20+ を確認 | 「ESM専用の落とし穴」として設定例を丸ごと掲載 |
| 3 | パッケージ名が見つからない / v1の記事通りに動かない | v2でパッケージが分割（`@modelcontextprotocol/server`）。ネットの多くの記事は v1 の `@modelcontextprotocol/sdk` 前提 | `@modelcontextprotocol/server@beta` を明示インストール。import元を README の版に合わせる | v1→v2の書き比べ表がそのまま差別化ポイントになる |
| 4 | `--tool-arg a=2` が文字列として渡り数値スキーマで弾かれる | CLIの引数は文字列。Standard Schema の number と噛み合わない場合がある | 数値が通らなければ `--tool-arg` の型指定記法や JSON 渡しを確認（要確認）。まず `tools/list` で疎通を切り分け | 「型の受け渡し」でハマった実録として価値大 |
| 5 | ベータの破壊的変更でサンプルが動かない | RC(07-28)前後で仕様変動。API名が変わりうる | インストール版を固定し、README/リリースの当該版を参照。動かなければ版を README と合わせる | 「検証時点の版」を明記する再現性の作法として書く |

## 記録テンプレ（実行中に埋める）

各タスクを実行しながら、以下を都度メモする。これがそのまま経験談の一次情報になる。

- 実行したコマンド:
- 出たエラー（全文）:
- 効いた解決方法 / 試したこと:
- 所要時間（見積もり → 実測）:
- つまずいた理由・分かっていなかった前提:
- 既存技術（v1系 / 手書きJSON Schema）と比べて感じた違い:
- スクショを撮った箇所:
- 記事に書きたい気づき:

## 記事への写像（タスク → 見出し）

出典レポートの「記事構成案」（テーマ1: 1.はじめに / 2.なぜMCPを試すのか / 3.事前に調べたこと / 4.環境構築 / 5.最小サーバー実装 / 6.Inspectorで叩く / 7.詰まった点 / 8.触って分かったこと / 9.どんな人に向くか / 10.まとめ）に対応させる。

| 記事の見出し | 対応するタスク / 記録 | 書くこと |
|---|---|---|
| 1. はじめに | 前提・動機 | 新人がMCPを鍵なし・ローカルで試す動機 |
| 2. なぜMCPを試すのか | フェーズ1 | 07-28仕様RCの旬・開発ツール標準化の流れ |
| 3. 事前に調べたこと（SDK v2の変更点） | フェーズ1の記録 | パッケージ分割 / stateless / Standard Schema |
| 4. 環境構築 | フェーズ2の記録 | インストール版・ESM/tsconfig設定・詰まった点2 |
| 5. 最小サーバー実装 | フェーズ3前半の記録 | stdioサーバー骨格・`add` tool・inputSchema |
| 6. Inspectorで叩く | フェーズ3後半の記録 | CLIモードのJSON・UIスクショ・トークンの話(詰まり1) |
| 7. 詰まった点 | 詰まりポイント表・記録テンプレ | トークン壁 / ESM / v1差 / `--tool-arg`型 / ベータ版差 |
| 8. 触って分かったこと（比較） | フェーズ4の記録 | v1 vs v2 書き比べ・Standard Schemaの効き |
| 9. どんな人に向くか | フェーズ5の棚卸し | MCP入門したい新人層 |
| 10. まとめ | フェーズ5の棚卸し | 向いている人・次にやること |

## 経験談として書くときのコツ

- 「新人が試した範囲」を明示し、専門家として断定しすぎない。
- うまくいった点だけでなく、トークン壁・ESM設定・ベータ版差などの詰まった点と解決過程を書く。
- Inspector CLIモードの**出力JSON全文**・UIスクショ・コードを残して貼る。
- 公式ドキュメント（下記）へのリンクを入れ、**検証時点の版**を必ず明記する。
- v1→v2の書き比べは、確認できた範囲だけ断定し、未確認は「要確認」と書く。

## 参考リンク

- 公式ドキュメント: https://github.com/modelcontextprotocol/typescript-sdk
- リリース/変更点: https://blog.modelcontextprotocol.io/posts/sdk-betas-2026-07-28/
- Inspector: https://github.com/modelcontextprotocol/inspector
- Standard Schema: https://standardschema.dev/
- 関連（既知の詰まり）: `research/search-topic-20260722-0404.md` の注意点、Playwright は bundled Chromium ではなく channel Chrome を使う（`knowledge/2026-07-21-playwright-bundled-chromium-lags-use-channel-chrome.md`）

## 想定リスク・注意点

- コスト: 完全無料・ローカル完結。課金トリガーなし。
- ライセンス / 規約: MCP SDK / Inspector は OSS（利用時にライセンス表記を確認）。
- セキュリティ: LLM鍵は不要。tool は**副作用のない安全なもの（add / echo）に限定**し、ファイル操作・ネットワーク送信するtoolは作らない。
- 破壊的変更: ベータ仕様は RC 前後で変わりうる。版を固定し「検証時点の版」を明記。
- 撤退ライン: v2ベータのAPI名変動で30分以上詰まったら、`tools/list` の疎通確認までを成果とし、v1系(`@modelcontextprotocol/sdk`)の最小サーバーに切り替えて「v2ベータでハマった記録」として記事化する。

## 次のアクション

- [ ] フェーズ1から順に着手する
- [ ] 記録テンプレを埋めながら進める
- [ ] 完了条件（CLIモードのtools/list・tools/call・バリデーションエラー・UIスクショ）を満たしたら「記事への写像」に沿って本文ドラフトへ展開する
- [ ] このタスクを `run-practice` に渡して検証ログを生成する
