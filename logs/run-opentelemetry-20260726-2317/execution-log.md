# 検証ログ: OpenTelemetryを初めて計装して、ローカルCollector＋Jaegerでトレースを1本見るまで

> Zenn記事の素材。実行の一次情報（コマンド・エラー全文・所要時間・スクショ）を記録。
> 記事本文は未執筆。「記事への写像」を見て articles/*.md に展開する。

## 実行の前提（採用した前提）

- 対象タスク: `practice/practice-opentelemetry-20260726-2313.md`
- 出典レポート: `research/search-topic-20260726-2305.md`
- 対象技術: OpenTelemetry JS SDK（`@opentelemetry/sdk-node` 系）+ OpenTelemetry Collector 0.157.0 + Jaeger v2.20.0 / Express 5
- 実行者: AIエージェント単独（非対話） <!-- 内部メタ: 記事に転記しない -->
- 実行日時 / 所要時間: 2026-07-26 23:17〜23:54 / 見積もり 6.5h → 実測 約37分 <!-- 実測はAI単独の値。記事にそのまま書かない -->
- 実行環境: macOS 26.5 (Darwin 25.5.0, arm64) / Node v22.17.0 / npm / Docker 28.5.1（**使用できず**）
- 採用した撤退ライン: 対象タスク記載のものを採用（1タスク30分／フェーズ2が90分超なら直接送信構成に切替）
- 判断方針: 引数は「対象タスクファイル」のみ指定。時間・撤退ライン・成果物の置き場は**すべてデフォルト前提**を採用した。
- **重要な置き換え**: Docker が使えなかったため（後述の詰まった点1）、Collector と Jaeger を
  **Docker イメージではなく公式リリースバイナリ（darwin arm64）としてホストで起動**した。
  バージョンは当初の予定（otelcol 0.157.0 / Jaeger v2.20.0）と同一で、検証内容は変えていない。

## 結果サマリー

- 完了条件の判定: **一部達成**（5項目のうち4項目達成。Docker前提の1項目のみ代替手段で満たした）
- 作ったもの: Express 5 の最小API（`/`・`/users`・`/slow`）＋ OTel 自動計装 ＋ 手動span ＋
  Collector → Jaeger のトレースパイプライン（`workspace/otel-practice/`）
- スクショ: **5枚**（`screenshots/`）
- 詰まった点: **6件**（うち解決 6 / 未解決・撤退 0。ただし1件は代替手段による回避）
- knowledge 記録: 2件
  - `knowledge/2026-07-26-docker-desktop-vm-no-egress-use-release-binaries.md`
  - `knowledge/2026-07-26-jaeger-v2-is-a-collector-port-and-ipv6-conflicts.md`
- 生ログ: `commands.log`（440行）/ `otelcol-debug.log`（868行）/ `jaeger.log`

## 完了条件の検証

| # | 完了条件 | 判定 | 根拠（ログ / スクショ） |
|---|---|---|---|
| 1 | `docker compose ps` で collector と jaeger の2コンテナが `running` | **未達（代替で達成）** | `docker pull` がレジストリに到達できずイメージ取得不能（commands.log 23:45:00）。代替として公式リリースバイナリ2プロセスが running であることを `ps` で確認（`15082 ./jaeger` / `15661 ../bin/otelcol`、commands.log 23:53:18） |
| 2 | `curl localhost:3000/slow` が 200 を返す | 達成 | `HTTP/1.1 200 OK` / `{"slow":true,"waited_ms":800}`（commands.log 23:53:18） |
| 3 | Collector のログ（`debug` exporter）に span が流れている | 達成 | `ResourceSpans` バッチが 2→3 に増加。`slow-business-logic` span を属性つきで確認（`otelcol-debug.log`、commands.log 23:53:51） |
| 4 | Jaeger UI でサービス名 `otel-practice-api` のトレースが検索でき、`/slow` の詳細が開ける | 達成 | `/api/services` → `["jaeger","otel-practice-api","otel-practice-direct"]` / `screenshots/02-trace-list.png` / `screenshots/03-trace-detail-auto.png`（タイトル `c2d67d8: GET /slow (otel-practice-api)`） |
| 5 | 手動span追加後、同じ `/slow` のトレースに子spanが1本増えている | 達成 | span 数 **4 → 5**、`slow-business-logic` が追加。`screenshots/03-trace-detail-auto.png`（Total Spans 4）と `screenshots/04-trace-detail-manual.png`（Total Spans 5）の対比 |

## タスク実行ログ（フェーズ別）

### フェーズ1: 事前調査（見積もり 45分 → 実測 約3分）

- [x] **公式 Getting Started（Node.js）を読み、必要パッケージと起動方法を書き出す**
  - 実行: WebFetch で <https://opentelemetry.io/docs/languages/js/getting-started/nodejs/>
  - 分かったこと（一次情報）:
    - 公式が挙げるインストールは **5パッケージ**:
      ```
      npm install @opentelemetry/sdk-node \
        @opentelemetry/api \
        @opentelemetry/auto-instrumentations-node \
        @opentelemetry/sdk-metrics \
        @opentelemetry/sdk-trace-node
      ```
    - 起動は **`node --import ./instrumentation.mjs app.js`**（TS版は `npx tsx --import ./instrumentation.ts app.ts`）
    - **公式サンプルの traceExporter は `ConsoleSpanExporter`**（+ `ConsoleMetricExporter`）。
      OTLP 送信はこのページには無く、別ページ（exporters）扱い。
    - Node 要件の記述: 「`--import instrumentation.ts`（TypeScript）は Node.js v20 以降が必要。
      v18 なら JavaScript の例を使え」
  - 記事に書きたい気づき: 「まず何を入れるのか」が1行で終わらない。`api` と `sdk-node` が別、
    自動計装も別、メトリクスとトレースでさらに別。**最初の `npm install` の時点で「モノリシックではない」と分かる。**

- [x] **OTLP exporter のページで、パッケージ名と既定エンドポイントを確認する**
  - 実行: WebFetch で <https://opentelemetry.io/docs/languages/js/exporters/>
  - 分かったこと: 3種類あり、クラス名は**全部同じ `OTLPTraceExporter`**。
    | パッケージ | 既定エンドポイント |
    |---|---|
    | `@opentelemetry/exporter-trace-otlp-proto`（HTTP/protobuf） | `http://localhost:4318/v1/traces` |
    | `@opentelemetry/exporter-trace-otlp-http`（HTTP/JSON） | `http://localhost:4318/v1/traces` |
    | `@opentelemetry/exporter-trace-otlp-grpc`（gRPC） | `http://localhost:4317` |
  - 記事に書きたい気づき: **クラス名が同じでパッケージだけ違う**ので、import 文を見ても
    どの転送方式か分からない。迷ったのは事実で、今回は計画どおり `-proto` を選んだ。

- [x] **Jaeger 公式の Getting Started で、v2 all-in-one のイメージ名とポートを確認する**
  - 実行: WebFetch で <https://www.jaegertracing.io/docs/latest/getting-started/>
  - 分かったこと（公式のコマンド全文）:
    ```
    docker run --rm --name jaeger \
      -p 16686:16686 -p 4317:4317 -p 4318:4318 -p 5778:5778 -p 9411:9411 \
      cr.jaegertracing.io/jaegertracing/jaeger:2.20.0
    ```
    - イメージは Docker Hub ではなく **`cr.jaegertracing.io` の専用レジストリ**
    - ポート: 16686=UI / 4317=OTLP gRPC / 4318=OTLP HTTP / 5778=frontend / 9411=Zipkin互換
    - **Jaeger 自身が OTLP を直接受けられる**（4317/4318 を持っている）
  - 記事に書きたい気づき: ここで「じゃあ Collector 要らないのでは？」という疑問が湧いた。

- [x] **「Collector を挟む意味」を自分の言葉で1〜3行に書く**
  - 書いたもの（フェーズ4で答え合わせした）:
    > Jaeger が OTLP を直接受けられるので、**トレースを見るだけなら Collector は無くても成立する**。
    > それでも挟むのは、アプリ側の設定を変えずに送り先を差し替えられる（アプリは常に Collector を向く）、
    > 加工・サンプリング・複数バックエンドへの分岐を一箇所に寄せられる、という運用側の都合だと理解した。
  - → フェーズ4で実測して**この理解が正しかったことを確認できた**（見え方は同じ／変えやすさが違う）。

### フェーズ2: 環境構築（見積もり 60分 → 実測 約28分。うち Docker の切り分けに約20分）

- [x] **作業ディレクトリを作り、Node と Docker のバージョンを記録する**（見積もり 5分 → 実測 1分）
  - 実行したコマンド:
    ```bash
    mkdir -p logs/run-opentelemetry-20260726-2317/workspace/otel-practice
    cd logs/run-opentelemetry-20260726-2317/workspace/otel-practice
    npm init -y && node -v && docker --version && docker compose version
    ```
  - 出力（全文）:
    ```
    v22.17.0
    Docker version 28.5.1, build e180ab8
    Docker Compose version v2.40.3-desktop.1
    ```
  - つまずいた理由・分かっていなかった前提: 出典レポートは Node 26 前提だったが、
    このマシンは **v22.17.0**。OTel JS の要件は Node 20 以上なので問題なし。
    **レポートの前提を実測で上書きする必要があった**。

- [x] **`otel-collector-config.yaml` を、レポート記載どおり `jaeger` exporter で書く**（見積もり 10分 → 実測 2分）
  - 書いた設定（**意図的に古い書き方**。直す前の状態）:
    ```yaml
    receivers:
      otlp:
        protocols:
          http:
            endpoint: 0.0.0.0:4318

    exporters:
      jaeger:
        endpoint: jaeger:14250
        tls:
          insecure: true

    service:
      pipelines:
        traces:
          receivers: [otlp]
          exporters: [jaeger]
    ```

- [x] **`compose.yaml` を書いて `docker compose up -d` する**（見積もり 15分 → 実測 20分 / **予定と違う形で詰まった**）
  - 実行したコマンド:
    ```bash
    docker compose up -d && docker compose ps && docker compose logs collector
    ```
  - 出力（全文。これ以降18分間まったく進まない）:
    ```
     jaeger Pulling
     collector Pulling
    ```
  - **予定していた「Collector の起動失敗」ではなく、その前段のイメージ取得で止まった。**
    切り分けの実測値:
    ```
    $ timeout 60 docker pull hello-world          # 数十KBのイメージでも進まない
    Using default tag: latest
    exit=124

    $ timeout 90 docker pull hello-world          # サンドボックス無効化しても同じ
    Using default tag: latest
    exit=124

    $ docker version                              # デーモンには到達できている
    -> 正常応答

    $ curl -s -o /dev/null -w "%{http_code}" https://registry-1.docker.io/v2/   -> 401
    $ curl -s -o /dev/null -w "%{http_code}" https://github.com                 -> 200
    $ curl -s -o /dev/null -w "%{http_code}" https://cr.jaegertracing.io/v2/    -> 401
    ```
  - 効いた対処: **Docker を諦め、公式リリースバイナリをホストで動かす**方式に切り替えた。
    ```bash
    curl -sSL -o otelcol.tar.gz \
      https://github.com/open-telemetry/opentelemetry-collector-releases/releases/download/v0.157.0/otelcol_0.157.0_darwin_arm64.tar.gz
    tar xzf otelcol.tar.gz && ./otelcol --version      # -> otelcol version 0.157.0

    curl -sSL -o jaeger.tar.gz \
      https://github.com/jaegertracing/jaeger/releases/download/v2.20.0/jaeger-2.20.0-darwin-arm64.tar.gz
    tar xzf jaeger.tar.gz && ./jaeger-2.20.0-darwin-arm64/jaeger version
    # -> {"gitVersion":"v2.20.0","buildDate":"2026-07-20T03:41:33Z"}
    ```
    ダウンロードは各3秒程度で完了（otelcol 45MB / jaeger 57MB のアーカイブ）。
    **バージョンはイメージと同一に揃えられたので、検証内容は変えずに続行できた。**
  - つまずいた理由: ホストのネットワークは正常なので「ネットが壊れている」ようには見えない。
    Docker Desktop の VM からの外向き通信だけが不通、という切り分けに時間がかかった。
  - 記事に書きたい気づき: 記事の再現手順としては Docker compose を載せる価値があるが、
    **「Docker が使えないときはリリースバイナリで同じことができる」**のは読者にも有用。
  - knowledge: `knowledge/2026-07-26-docker-desktop-vm-no-egress-use-release-binaries.md`

- [x] **Collector を起動して `jaeger` exporter の削除を踏む → `otlp/jaeger` に直す**（見積もり 15分+15分 → 実測 3分）
  - **(1) 旧 `jaeger` exporter → 設定を読めずに即死**（記事の一番の見どころ）
    ```bash
    ../bin/otelcol --config=./otel-collector-config.yaml
    ```
    エラー全文:
    ```
    Error: failed to get config: cannot unmarshal the configuration: decoding failed due to the following error(s):

    'exporters' unknown type: "jaeger" for id: "jaeger" (valid values: [otlp_grpc otlp otlp_http otlphttp kafka prometheus nop file prometheus_remote_write prometheusremotewrite zipkin debug])
    exit=1
    ```
    → **`valid values` に `jaeger` が無い**ことがそのまま証拠になる。予測どおりの詰まりポイント。
    原因: Collector の `jaeger` exporter は **v0.85.0 以降の公式ディストリから削除済み**
    （Jaeger が OTLP をネイティブ対応したため / [公式移行ブログ](https://opentelemetry.io/blog/2023/jaeger-exporter-collector-migration/)）。

  - **(2) exporter を直したら、今度は内部テレメトリの 8888 で bind 失敗**（**予測していなかった**）
    エラー全文（抜粋。スタックトレースは `commands.log` に全文あり）:
    ```
    error   service@v0.157.0/service.go:183  error found during service initialization
    {"resource": {...,"service.name": "otelcol", "service.version": "0.157.0"},
     "error": "failed to create meter provider: binding address localhost:8888 for Prometheus exporter: listen tcp 127.0.0.1:8888: bind: address already in use"}
    ...
    Error: failed to create meter provider: binding address localhost:8888 for Prometheus exporter: listen tcp 127.0.0.1:8888: bind: address already in use
    ```
    占有プロセスを確認:
    ```
    $ lsof -nP -iTCP:8888 -sTCP:LISTEN
    jaeger  15082 ... TCP 127.0.0.1:8888 (LISTEN)
    $ lsof -nP -iTCP:4318 -sTCP:LISTEN
    jaeger  15082 ... TCP 127.0.0.1:4318 (LISTEN)
    ```
    → **Jaeger v2 が 8888 と 4318 の両方を握っている。Jaeger v2 自身が OTel Collector
    ディストリビューションなので、既定ポートがまるごとぶつかる。**
    対処: receiver を **4418**、内部テレメトリを **8889** にずらした。

  - **(3) ポートを直したら Jaeger への送信が接続拒否**（**予測していなかった**）
    エラー全文（同じ warn が1秒間隔で繰り返される）:
    ```
    2026-07-26T23:46:39.848+0900  warn  grpc@v1.82.1/clientconn.go:1534  [core] [Channel #1 SubChannel #2] grpc: addrConn.createTransport failed to connect to {Addr: "[::1]:4317", ServerName: "localhost:4317", }. Err: connection error: desc = "transport: Error while dialing: dial tcp [::1]:4317: connect: connection refused"  {"resource": {"service.instance.id": "a2c87d5f-26d4-448a-9ac3-174437359ebf", "service.name": "otelcol", "service.version": "0.157.0"}, "grpc_log": true}
    ```
    → `endpoint: localhost:4317` が **`[::1]`（IPv6）に解決**されるが、Jaeger は
    **`127.0.0.1`（IPv4）のみ**で待ち受けている。
    対処: `endpoint: 127.0.0.1:4317` と IPv4 を明示。

  - 最終的に動いた `otel-collector-config.yaml`（全文）:
    ```yaml
    receivers:
      otlp:
        protocols:
          http:
            # Jaeger v2 が 4318 を既に持っているので、Collector は 4418 で受ける
            endpoint: 0.0.0.0:4418

    exporters:
      # Collector の `jaeger` exporter は v0.85.0 以降で削除された。
      # Jaeger が OTLP をネイティブに受けられるので、OTLP で Jaeger に送る。
      otlp/jaeger:
        # localhost だと [::1] に解決されて Jaeger(IPv4のみ)に繋がらない。IPv4 を明示する
        endpoint: 127.0.0.1:4317
        tls:
          insecure: true # ローカルのプロセス間通信限定。本番でこれは書かない
      debug:
        verbosity: detailed

    service:
      telemetry:
        metrics:
          # 既定の 8888 も Jaeger v2 が使っているのでずらす
          readers:
            - pull:
                exporter:
                  prometheus:
                    host: localhost
                    port: 8889
      pipelines:
        traces:
          receivers: [otlp]
          exporters: [otlp/jaeger, debug]
    ```
  - 起動成功時のログ（接続エラー 0 件）:
    ```
    warn  builders/builders.go:40  "otlp" alias is deprecated; use "otlp_grpc" instead  {...,"otelcol.component.id": "otlp/jaeger", "otelcol.component.kind": "exporter", "otelcol.signal": "traces"}
    info  service@v0.157.0/service.go:259  Starting otelcol...  {..., "Version": "0.157.0", "NumCPU": 10}
    info  otlpreceiver@v0.157.0/otlp.go:175  Starting HTTP server  {..., "otelcol.component.id": "otlp", "otelcol.component.kind": "receiver", "endpoint": "[::]:4418"}
    info  service@v0.157.0/service.go:282  Everything is ready. Begin running and processing data.
    ```
    ```
    $ grep -c "createTransport failed" otelcol.log
    0
    ```
  - 記事に書きたい気づき: **1つ直すと次が出る、が3回続いた。**「参考手順が古い」→
    「ポートが衝突する」→「localhost が IPv6 に解決される」で、原因の層が全部違う。
    しかも2つ目と3つ目は **Jaeger v2 が Collector そのものである**という1つの事実から来ている。
  - knowledge: `knowledge/2026-07-26-jaeger-v2-is-a-collector-port-and-ipv6-conflicts.md`

- [x] **Jaeger UI が開くことを Playwright で確認（計装前の空の状態）**（見積もり 15分 → 実測 2分）
  - 実行したコマンド:
    ```bash
    curl -s localhost:16686/api/services
    node otel-shot.mjs http://localhost:16686/search ../../screenshots/01-jaeger-empty.png 3000
    ```
  - 出力:
    ```
    {"data":[],"total":0,"limit":0,"offset":0,"errors":null}
    saved .../01-jaeger-empty.png
    title: Jaeger UI
    ```
  - スクショ: `screenshots/01-jaeger-empty.png`（Service プルダウンが `-`、右側は Jaeger のゴーファー画像だけ。トレースゼロの状態）
  - 効いた工夫: プルダウン操作は使わず **URL直打ち**（`/search?service=...`、`/trace/<traceID>`）で
    撮ることにした。セレクタ特定で詰まらず、既存ナレッジの `channel: 'chrome'` への切替も不要だった
    （**同梱Chromiumで描画は問題なし**）。

### フェーズ3: 実装・検証【本編】（見積もり 180分 → 実測 約6分）

- [x] **Express の最小API（3エンドポイント）を書き、計装なしで動かす**（見積もり 30分 → 実測 2分）
  - 実行したコマンド:
    ```bash
    npm i express && npm ls express
    node app.js
    curl -s -i localhost:3000/ ; curl -s -i localhost:3000/users ; curl -s -i localhost:3000/slow
    curl -o /dev/null -s -w 'time_total=%{time_total} http_code=%{http_code}\n' localhost:3000/slow
    ```
  - 出力（全文は commands.log 23:24:37）:
    ```
    otel-practice@1.0.0
    └── express@5.2.1

    GET /      -> 200  {"ok":true}
    GET /users -> 200  {"inner":{"ok":true},"users":[{"id":1,"name":"alice"},{"id":2,"name":"bob"}]}
    GET /slow  -> 200  {"slow":true,"waited_ms":800}
    time_total=0.802873 http_code=200
    ```
  - `app.js`（計装なしの時点。`/users` は自分の `/` へ内部 fetch する）:
    ```js
    const express = require('express');
    const app = express();
    const PORT = process.env.PORT ?? 3000;

    app.get('/', (req, res) => { res.json({ ok: true }); });

    app.get('/users', async (req, res) => {
      const r = await fetch(`http://localhost:${PORT}/`);
      const inner = await r.json();
      res.json({ inner, users: [{ id: 1, name: 'alice' }, { id: 2, name: 'bob' }] });
    });

    app.get('/slow', async (req, res) => {
      await new Promise((r) => setTimeout(r, 800));
      res.json({ slow: true, waited_ms: 800 });
    });

    app.listen(PORT, () => { console.log(`listening on http://localhost:${PORT}`); });
    ```

- [x] **OTel のパッケージを入れ、入った版を記録する**（見積もり 15分 → 実測 1分）
  - 実行したコマンド:
    ```bash
    npm i @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-trace-otlp-proto
    npm ls --depth=0
    npm ls @opentelemetry/instrumentation-express
    ```
  - 出力（全文）:
    ```
    npm warn deprecated node-domexception@1.0.0: Use your platform's native DOMException instead
    npm warn deprecated glob@10.5.0: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, ...
    added 195 packages, and audited 263 packages in 6s
    6 high severity vulnerabilities

    otel-practice@1.0.0
    ├── @opentelemetry/api@1.9.1
    ├── @opentelemetry/auto-instrumentations-node@0.79.0
    ├── @opentelemetry/exporter-trace-otlp-proto@0.221.0
    ├── @opentelemetry/sdk-node@0.221.0
    └── express@5.2.1

    otel-practice@1.0.0
    └─┬ @opentelemetry/auto-instrumentations-node@0.79.0
      └── @opentelemetry/instrumentation-express@0.69.0
    ```
  - **Express 5 対応の確認（詰まりポイント4の事前確認）**: 名前だけで判断せず、実際の対応範囲を読んだ。
    ```
    $ grep -n "InstrumentationNodeModuleDefinition" -A4 node_modules/@opentelemetry/instrumentation-express/build/src/instrumentation.js
    25: new InstrumentationNodeModuleDefinition('express', ['>=4.0.0 <6'], moduleExports => {
    26:   const isExpressWithRouterPrototype = typeof moduleExports?.Router?.prototype?.route === 'function';
    27:   const routerProto = isExpressWithRouterPrototype
    28:     ? moduleExports.Router.prototype // Express v5
    29:     : moduleExports.Router;          // Express v4
    ```
    → 対応範囲は **`>=4.0.0 <6`** で Express 5 を含み、**コード内に v5 専用の分岐がある**。
    **予測した詰まりポイント（Express 5 で route span が出ない）は起きなかった**。実際に span も出た（後述）。
  - 記事に書きたい気づき: 4つ入れたはずが `node_modules` は **195パッケージ**増える。
    「入れるものが4つに分かれている」実感と、`npm ls --depth=0` が5行で済む見た目のギャップ。

- [x] **`instrumentation.js` を書き、OTLP exporter で Collector に送る設定にする**（見積もり 30分 → 実測 2分）
  - `instrumentation.js`（全文）:
    ```js
    const { NodeSDK } = require('@opentelemetry/sdk-node');
    const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
    const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-proto');

    // 送り先は Collector の OTLP/HTTP。既定値も http://localhost:4318/v1/traces だが、
    // どこに送っているのかを明示したいのであえて url を書いている。
    const sdk = new NodeSDK({
      traceExporter: new OTLPTraceExporter({
        url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
          ?? 'http://localhost:4318/v1/traces',
      }),
      instrumentations: [getNodeAutoInstrumentations()],
    });

    sdk.start();
    console.log('[instrumentation] OTel SDK started');
    ```
  - つまずいた理由・分かっていなかった前提: **公式 Getting Started のサンプルは `ConsoleSpanExporter`**
    なので、OTLP に差し替える部分は exporters ページを自分で読んで組み立てる必要があった。
    「Getting Started を読み終えても、まだバックエンドには何も送れていない」のが素直な感想。
  - サービス名: **`OTEL_SERVICE_NAME` 環境変数が効いた**（resource に明示しなくてよかった）。
    debug ログの resource 属性に `service.name: Str(otel-practice-api)` が出ている。

- [x] **`--import` で計装を読み込んで起動し、自動計装だけで何が出るか確認**（見積もり 30分 → 実測 1分）
  - 実行したコマンド:
    ```bash
    OTEL_SERVICE_NAME=otel-practice-api \
    OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4418/v1/traces \
    node --import ./instrumentation.js app.js
    ```
  - 起動ログ（全文。**警告は一切出なかった**）:
    ```
    [instrumentation] OTel SDK started
    listening on http://localhost:3000
    ```
  - `--import` と `--require` のどちらを使ったか: **`--import` を使い、一発で動いた**。
    公式サンプルは `.mjs` だが、**CommonJS の `instrumentation.js` でも Node 22 の `--import` で問題なく読み込めた**。
  - 3本 curl の結果:
    ```
    GET /      -> 200 0.010709s
    GET /users -> 200 0.022812s
    GET /slow  -> 200 0.802518s
    ```
  - **Collector の debug exporter に届いた span の中身**（resource 属性。`otelcol-debug.log` より）:
    ```
    ResourceSpans #0
    Resource attributes:
         -> host.name: Str(katayamaryuunosukes-MacBook-Pro.local)
         -> host.arch: Str(arm64)
         -> process.pid: Int(15892)
         -> process.executable.name: Str(node)
         -> process.command_args: Slice(["/Users/.../bin/node","--import","./instrumentation.js",".../app.js"])
         -> process.runtime.version: Str(22.17.0)
         -> process.runtime.name: Str(nodejs)
         -> service.name: Str(otel-practice-api)
         -> telemetry.sdk.language: Str(nodejs)
         -> telemetry.sdk.name: Str(opentelemetry)
         -> telemetry.sdk.version: Str(2.10.0)
    ```
    HTTP server span の中身（**プランで見たかった属性が全部出ている**）:
    ```
    InstrumentationScope @opentelemetry/instrumentation-http 0.221.0
    Span #0
        Trace ID       : 25be211bc34a7a471de867f6fbe25c4a
        Parent ID      :
        ID             : 6d575b1cc53abf5d
        Name           : GET /
        Kind           : Server
        Start time     : 2026-07-26 14:48:03.91 +0000 UTC
        End time       : 2026-07-26 14:48:03.917510375 +0000 UTC
        Status code    : Unset
    Attributes:
         -> http.request.method: Str(GET)
         -> url.scheme: Str(http)
         -> server.address: Str(localhost)
         -> network.peer.address: Str(::1)
         -> network.protocol.version: Str(1.1)
         -> user_agent.original: Str(curl/8.7.1)
         -> url.path: Str(/)
         -> client.address: Str(::1)
         -> server.port: Int(3000)
         -> http.response.status_code: Int(200)
         -> http.route: Str(/)
    ```
  - **1リクエストで span がいくつ出たか**（Jaeger API で確定した実測値）:
    | エンドポイント | span 数 | span 名の内訳 |
    |---|---|---|
    | `GET /` | **4** | `GET /` / `middleware - patched` / `request handler - /` ×2 |
    | `GET /users` | **10** | `GET /users` / `GET /` / `GET`(クライアント) / `tcp.connect` / `middleware - patched` ×2 / `request handler - /users` ×2 / `request handler - /` ×2 |
    | `GET /slow` | **4** | `GET /slow` / `middleware - patched` / `request handler - /slow` ×2 |
  - 出てきた計装スコープ（debug ログの `InstrumentationScope`）:
    `@opentelemetry/instrumentation-http 0.221.0` / `@opentelemetry/instrumentation-express`（`request handler` / `middleware`） / `instrumentation-net`（`tcp.connect`）
  - 記事に書きたい気づき: **アプリのコードを1行も変えずに、4〜10本の span が出た**。
    ただし `request handler - /` が2本、`middleware - patched` という中身の分からない名前が混ざるので、
    **「自動計装は情報が多いが、意味のある名前が付いているとは限らない」**。

- [x] **Jaeger UI をPlaywrightで開き、サービス検索 → トレース詳細をスクショする**（見積もり 45分 → 実測 1分）
  - 実行したコマンド:
    ```bash
    curl -s localhost:16686/api/services
    node otel-shot.mjs "http://localhost:16686/search?service=otel-practice-api&lookback=1h&limit=20" ../../screenshots/02-trace-list.png 3500
    node otel-shot.mjs "http://localhost:16686/trace/c2d67d8e4fa3d261243cc752a3547f91" ../../screenshots/03-trace-detail-auto.png 3500
    ```
  - `otel-shot.mjs`（全文）:
    ```js
    // Jaeger UI のスクショを撮る。使い方: node otel-shot.mjs <url> <出力パス> [待ちms]
    import { chromium } from 'playwright';

    const url = process.argv[2];
    const out = process.argv[3];
    const waitMs = Number(process.argv[4] ?? 3000);

    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(waitMs);
    await page.screenshot({ path: out, fullPage: true });
    console.log('saved', out);
    console.log('title:', await page.title());
    if (errors.length) console.log('console errors:', errors.slice(0, 5).join(' | '));
    await browser.close();
    ```
  - **サービス名がプルダウンに出るまでの待ち**: curl 直後は空。**約12秒待ってから** `/api/services` が
    `["jaeger","otel-practice-api"]` を返した（`NodeSDK` 既定の BatchSpanProcessor の送信間隔）。
    リロードは必要だったが、**待てば出る**。ここを待たずに「トレースが出ない」と誤診しかけた。
  - `/api/services` の出力: `{"data":["jaeger","otel-practice-api"],"total":2,...}`
    → **`jaeger` 自身もサービスとして出てくる**（Jaeger v2 が自分のトレースも記録している）。
  - スクショ:
    - `screenshots/02-trace-list.png`（トレース一覧）
    - `screenshots/03-trace-detail-auto.png`（`/slow` の詳細。**Total Spans 4 / Depth 4 / Duration 802ms**。
      4本のバーが全部ほぼ同じ長さで端から端まで伸びていて、**「中で何に800ms使ったか」が分からない**）
  - 効いた工夫: Service プルダウンをクリックせず **URLクエリで直接検索状態を開く**。
    trace 詳細も `/trace/<traceID>` で直接開いた。traceID は `/api/traces?service=...` から `jq` で取得。

- [x] **`/slow` の中に手動spanを1つ足す**（見積もり 30分 → 実測 1分）
  - 差分コード:
    ```js
    const { trace } = require('@opentelemetry/api');
    const tracer = trace.getTracer('otel-practice-api');

    app.get('/slow', async (req, res) => {
      // 手動span。自動計装だと「ただ800ms遅い」だけで中身が見えないので、
      // 遅い処理そのものに名前を付けて子spanにする。
      await tracer.startActiveSpan('slow-business-logic', async (span) => {
        span.setAttribute('practice.wait_ms', 800);
        await new Promise((r) => setTimeout(r, 800));
        span.end();
      });
      res.json({ slow: true, waited_ms: 800 });
    });
    ```
  - debug ログに出た手動span（属性つき）:
    ```
    InstrumentationScope otel-practice-api
    Span #0
        Trace ID       : c355eea75a81cd8f9a50820712b991a4
        Parent ID      : 4150356811cc0d73
        ID             : 9a776395b3983270
        Name           : slow-business-logic
        Kind           : Internal
        Start time     : 2026-07-26 14:49:39.127 +0000 UTC
        End time       : 2026-07-26 14:49:39.929004417 +0000 UTC
        Status code    : Unset
    Attributes:
         -> practice.wait_ms: Int(800)
    ```
    → `Kind` が **`Internal`**（自動計装の HTTP span は `Server`）。`InstrumentationScope` が
    自分で付けた名前 `otel-practice-api` になり、**自動計装の span と出自が区別できる**。
  - `span.end()` を書き忘れる実験: **省略した**（プランの但し書きどおり、時間を本編に寄せた）。
  - 記事に書きたい気づき: `startActiveSpan` の**第2引数がコールバック**という書き味は最初戸惑う。
    「span を作る」というより「span の中でこの処理を走らせる」という書き方で、
    `span.end()` を自分で呼ぶ責任が残る（`try/finally` が要る設計だと分かる）。

- [x] **手動span追加後のトレースを再取得し、自動計装のみのスクショと並べる**（見積もり 20分 → 実測 1分）
  - 実行したコマンド:
    ```bash
    curl -s -o /dev/null -w 'GET /slow -> %{http_code} %{time_total}s\n' localhost:3000/slow
    curl -s "localhost:16686/api/traces?service=otel-practice-api&operation=GET%20%2Fslow&limit=5&lookback=10m" \
      | jq -r '.data[] | "traceID=\(.traceID) spans=\(.spans|length) names=\(.spans|map(.operationName)|sort|join(", "))"'
    node otel-shot.mjs "http://localhost:16686/trace/c355eea75a81cd8f9a50820712b991a4" ../../screenshots/04-trace-detail-manual.png 3500
    ```
  - 出力（**before/after が1回のクエリで並ぶ**）:
    ```
    traceID=c355eea75a81cd8f9a50820712b991a4 spans=5 names=GET /slow, middleware - patched, request handler - /slow, request handler - /slow, slow-business-logic
    traceID=c2d67d8e4fa3d261243cc752a3547f91 spans=4 names=GET /slow, middleware - patched, request handler - /slow, request handler - /slow
    ```
  - スクショ（**対で使う**）:
    - `screenshots/03-trace-detail-auto.png` … **Total Spans 4 / Depth 4**
    - `screenshots/04-trace-detail-manual.png` … **Total Spans 5 / Depth 5**、最下段に
      `otel-practice-api  slow-business-l...` の子span が1本増えている
  - 属性がUI上どこに表示されるか: 一覧のタイムライン上には出ず、**span をクリックして開く詳細パネル**に
    `practice.wait_ms` が並ぶ（今回はタイムライン全体のスクショなので、属性は debug ログ側を証跡にした）。

### フェーズ4: 深掘り・比較（見積もり 90分 → 実測 約4分）

- [x] **Collector を経由せず、アプリから Jaeger の 4318 へ直接送って比較**（見積もり 30分 → 実測 1分）
  - Jaeger は既に 4318 を持っているので、**変更は環境変数1つだけ**だった:
    ```bash
    OTEL_SERVICE_NAME=otel-practice-direct \
    OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces \
    node --import ./instrumentation.js app.js
    ```
  - 出力:
    ```
    GET /slow -> 200 0.813021s
    {"data":["jaeger","otel-practice-api","otel-practice-direct"],"total":3,...}
    traceID=d1a05fecf8d1ed5713a71275d54ece7c spans=5 names=GET /slow, middleware - patched, request handler - /slow, request handler - /slow, slow-business-logic
    ```
  - Collector を通っていないことの証拠:
    ```
    送信前の collector ResourceSpans batches = 2
    送信後の collector ResourceSpans batches = 2   (変化なし)
    ```
  - **結果: トレースの見え方は完全に同じ**（5 span、同じ span 名、手動span も出る）。
    違いは「アプリの設定を書き換えたかどうか」だけ。
  - **フェーズ1で書いた「Collector を挟む意味」の答え合わせ**: 予想どおりだった。
    トレースを見るだけなら Collector は不要。挟む価値は**アプリを触らずに送り先や加工を変えられる**点で、
    今回の直接送信は「アプリ側の環境変数を書き換える」形になった＝**アプリの再デプロイが必要**という差になる。

- [x] **エクスポータのエンドポイントをわざと間違えて、失敗時のログを見る**（見積もり 20分 → 実測 2分）
  - **(a) 末尾の `s` を落とす（`/v1/trace`）**:
    ```bash
    OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4418/v1/trace node --import ./instrumentation.js app.js
    curl -s -i localhost:3000/slow
    ```
    アプリ側ログ（**全文。これで全部**）:
    ```
    [instrumentation] OTel SDK started
    listening on http://localhost:3000
    ```
    レスポンス: `HTTP/1.1 200 OK`（正常）
    → **エラーが1行も出ない。完全に無言で失敗する。**
  - **(b) 存在しないポート（4999 / ECONNREFUSED）**:
    アプリ側ログ（**これも全文**）:
    ```
    [instrumentation] OTel SDK started
    listening on http://localhost:3000
    ```
    レスポンス: `GET /slow -> 200 0.812332s`（正常）
    → **接続拒否でも無言。**
  - **(c) `OTEL_LOG_LEVEL=debug` を付けると見えるか** → **見える**:
    ```
    @opentelemetry/instrumentation-http outgoingRequest on request error() AggregateError [ECONNREFUSED]:
      code: 'ECONNREFUSED',
      [errors]: [
        Error: connect ECONNREFUSED ::1:4999
            at createConnectionError (node:net:1678:14)
          code: 'ECONNREFUSED',
        Error: connect ECONNREFUSED 127.0.0.1:4999
            at createConnectionError (node:net:1678:14)
          code: 'ECONNREFUSED',
    ```
    ただし**ログ総行数は387行**で、この4行を見つけるには grep が必要だった。
  - **アプリのレスポンス自体は正常に返り続けるか**: **返り続ける**。3ケースすべて 200 で、
    レイテンシも通常どおり（0.81s）。**計装の失敗はユーザー影響にならない。**
  - 記事に書きたい気づき: これは**運用目線で一番怖い**。「Jaeger にトレースが出ない」とき、
    アプリは健康そのものに見える。既定のログレベルでは何も教えてくれないので、
    **`OTEL_LOG_LEVEL=debug` は切り分けの必須ツール**だと分かった。
    「監視の仕組み自体が黙って壊れる」ことを、壊してから知れたのは良かった。

- [x] **サンプリングを 0% にして、span が止まることを確認**（見積もり 20分 → 実測 1分）
  - 実行したコマンド（**環境変数名は実測で確認。`OTEL_TRACES_SAMPLER=always_off` が効いた**）:
    ```bash
    OTEL_TRACES_SAMPLER=always_off \
    OTEL_SERVICE_NAME=otel-practice-nosample \
    OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4418/v1/traces \
    node --import ./instrumentation.js app.js
    ```
  - 出力:
    ```
    GET /slow  -> 200
    GET /users -> 200
    GET /      -> 200

    送信前の collector ResourceSpans batches = 2
    送信後の collector ResourceSpans batches = 2      (何も来ていない)

    {"data":["jaeger","otel-practice-api","otel-practice-direct"],"total":3,...}
                                                      (nosample は出てこない)
    ```
  - → **SDK 側で設定を書かず、環境変数だけで span が完全に止まった**。
    Collector にも Jaeger にも一切届かず、アプリは3本すべて 200 を返し続けた。
  - 記事に書きたい気づき: サービス名・送り先・サンプラーが**全部環境変数で差し替えられる**。
    つまり「コードは1つで、環境ごとに挙動を変える」前提の設計になっている。
    裏を返すと**環境変数を1つ間違えるだけでトレースが消える**（しかも無言）。

- [x] **`/users` の内部 fetch がトレースで繋がっているか確認**（見積もり 20分 → 実測 1分）
  - 実行したコマンド:
    ```bash
    curl -s "localhost:16686/api/traces/$USERS" \
      | jq -r '.data[0].spans[] | "\(.spanID) parent=\((.references[0].spanID)//"ROOT") \(.operationName)"'
    ```
  - 出力（span の親子関係。**1トレース10 span**）:
    ```
    1f8aa66c9dc0a863 parent=ROOT              GET /users
    6b10971882816416 parent=1f8aa66c9dc0a863  middleware - patched
    03e749d40f2fa31c parent=6b10971882816416  request handler - /users
    bd12b3632b0d1d32 parent=03e749d40f2fa31c  request handler - /users
    aebf60b49926a0d1 parent=bd12b3632b0d1d32  tcp.connect
    ab9c187b5f4aa5bf parent=bd12b3632b0d1d32  GET               ← HTTPクライアント側
    04f896668a842c2e parent=ab9c187b5f4aa5bf  GET /             ← 内部fetchで叩かれたサーバ側
    bc91f465b1233b0e parent=04f896668a842c2e  middleware - patched
    09bf380820eaa330 parent=bc91f465b1233b0e  request handler - /
    601cf0923865def1 parent=09bf380820eaa330  request handler - /
    ```
  - → **繋がっていた。** `GET /users`（Server）→ `GET`（Client）→ `GET /`（Server）と
    **1つの trace ID の中で親子関係が続いている**。
    **自動計装は HTTP クライアント側も拾っており**（`instrumentation-http` が `fetch` を計装）、
    さらに `tcp.connect` まで span になっていた。トレースコンテキストの伝播もコード変更なしで動いた。
  - スクショ: `screenshots/05-trace-users.png`（10 span の階層。1リクエストが内部で自分を呼ぶ様子）
  - 記事に書きたい気づき: **`console.log` との決定的な差がここ**。ログだと「/users が来た」「/ が来た」の
    2行が並ぶだけで関係が分からないが、トレースは**呼び出し関係が構造として残る**。

### フェーズ5: 振り返り・記事化準備

- [x] 詰まった点の棚卸し（下記の表）
- [x] 「記事への写像」を実績で埋める（下記）
- [x] 新規トラブルを `knowledge/` に記録（2件。上記サマリー参照）

## 詰まった点と解決過程（記事の核）

| # | 詰まった点 | 原因 | 効いた対処 | 所要 | 解決/撤退 | 記事での活かし方 |
|---|---|---|---|---|---|---|
| 1 | `docker compose pull` が進捗0行のまま18分以上止まる。`hello-world` すら取得できない（exit 124） | Docker Desktop の **VM からの外向き通信のみ不通**。ホストの `curl` はレジストリに到達できる（401）ため気づきにくい。サンドボックスは無関係（無効化しても同じ） | Docker を諦め、**公式リリースバイナリ（darwin arm64）を curl 取得してホストで起動**。バージョンは同一に揃えた | 約20分 | 解決（代替手段） | 「環境構築」の注記。**Docker が使えなくてもリリースバイナリで同じ検証ができる**という実用情報。読者の再現手段が1つ増える |
| 2 | Collector が設定を読めずに即死。`unknown type: "jaeger"` | Collector の `jaeger` exporter は **v0.85.0 以降の公式ディストリから削除済み**。Jaeger の OTLP ネイティブ対応が理由。ネット上の古い手順が残っている | `exporters.jaeger` → **`exporters.otlp/jaeger`** に変更し、`endpoint: <jaeger>:4317` + `tls.insecure: true` | 約1分 | 解決 | **記事の中心（新設セクション）**。`valid values` 一覧に `jaeger` が無いエラー全文＋公式移行ブログを引用。「参考にした手順が古かった」という新人が最も踏む型 |
| 3 | exporter を直したら `bind: address already in use`（**localhost:8888**） | **Jaeger v2 自身が OTel Collector ディストリビューション**なので、Collector の内部テレメトリ既定ポート 8888 を先に握っている。`lsof` で `jaeger` プロセスの保持を確認 | `service.telemetry.metrics.readers` の prometheus port を **8889** にずらす | 約1分 | 解決 | 予測していなかった詰まり。「Collector と Jaeger の役割が最初は分からなかった」に直結する。**Jaeger v2 が Collector そのもの**という発見はここが一番効く |
| 4 | ポート 4318 も衝突（Jaeger が保持） | 同上。Jaeger v2 all-in-one が 4317/4318 を持つ。Docker なら公開しなければ済むが、**同一ホストに2プロセス並べると必ずぶつかる** | Collector の receiver を **4418** にし、アプリの送り先も `http://localhost:4418/v1/traces` に合わせた | 上記に含む | 解決 | プランが予測していた詰まりポイント2が、**Docker ではなくホスト起動で別の形で現実化**した話。ポート設計の図を1枚描くと効く |
| 5 | Collector → Jaeger が `connection refused`。`Addr: "[::1]:4317"` | `endpoint: localhost:4317` が **IPv6 `[::1]` に解決**されるが、Jaeger は **IPv4 `127.0.0.1` のみ**で待ち受け | endpoint を **`127.0.0.1:4317`** と IPv4 で明示。修正後 `createTransport failed` は 0 件 | 約1分 | 解決 | 「トレースが見えない」の切り分け手順として実用的。**エラー文の `Addr:` を読めば IPv6/IPv4 の食い違いが分かる**という具体的な読み方を示せる |
| 6 | Jaeger UI にサービス名が出ない（最初の数秒） | `NodeSDK` 既定の BatchSpanProcessor がバッチ送信するため、curl 直後は `/api/services` が空 | **約12秒待つ**とサービスが現れた。慌てて設定を疑う前に待つ | 約1分 | 解決 | 「トレースが見えない」の最頻トラブル。**まず待つ**→アプリ/Collector/Jaeger のどの層で止まっているかを切り分ける手順として書く |

### 予測（詰まりポイント表）と実際の差分

| 予測していた詰まり | 実際どうだったか |
|---|---|
| 1. Collector の `jaeger` exporter 削除 | **予測どおり起きた**（詰まった点2）。エラー全文も想定どおり `unknown type: "jaeger"` |
| 2. ホストの 4318 衝突 | **形を変えて起きた**（詰まった点4）。Docker ではなくホスト2プロセス構成だったため、**8888 の衝突という予測外のものも追加で発生**（詰まった点3） |
| 3. Jaeger UI にサービスが出てこない | **軽度に起きた**（詰まった点6）。原因はバッチ送信の遅延のみ。`OTEL_SERVICE_NAME` は問題なく効いた |
| 4. Express 5 で route span が出ない | **起きなかった**。`instrumentation-express@0.69.0` の対応範囲は `>=4.0.0 <6` で、コード内に Express v5 専用分岐がある。実際に `request handler - /slow` 等の span も出た |
| 5. `--import` / `--require` で迷う | **迷わなかった**。`--import ./instrumentation.js`（**CJS ファイル**）が Node 22.17.0 で一発で動き、警告も出なかった |
| 6. 計装が黙って失敗する | **予測どおり、かつ想像以上だった**（フェーズ4）。URL ミスも接続拒否も**アプリ側ログは0行**。`OTEL_LOG_LEVEL=debug` で初めて見えた |
| （予測外） | **Docker のイメージ取得自体ができなかった**（詰まった点1）。フェーズ2の最大の時間食い |

## スクリーンショット一覧

| ファイル | 何を示すか | 使う見出し |
|---|---|---|
| `screenshots/01-jaeger-empty.png` | 計装前の Jaeger UI。Service プルダウンが `-`、トレース0件（`/api/services` も `[]`） | 4. 環境構築 / 6. before の対 |
| `screenshots/02-trace-list.png` | `otel-practice-api` のトレース一覧が引けた状態 | 6. auto-instrumentation だけで何が見えたか |
| `screenshots/03-trace-detail-auto.png` | `/slow` の詳細（**Total Spans 4 / Depth 4 / Duration 802ms**）。バーが全部同じ長さで「ただ遅い」だけに見える | 6 と 7（**before**） |
| `screenshots/04-trace-detail-manual.png` | 同じ `/slow` に手動span追加後（**Total Spans 5 / Depth 5**）。`slow-business-l...` の子spanが1本増えている | 7. 手動spanを1つ足して見えた差分（**after**） |
| `screenshots/05-trace-users.png` | `/users` の10 span。内部 fetch が同一トレースで親子に繋がっている | 9. Collectorを挟む/挟まないを比べた（自動計装の射程） |

## 記事への写像（実績で埋める）

| 記事の見出し | 使う記録 / スクショ | 書くこと（メモ） |
|---|---|---|
| 1. はじめに | 「実行の前提」 | 計装未経験の新人が**ローカルだけで**トレースを1本見るまで。検証範囲は**トレースのみ**（メトリクス/ログは範囲外）。Splunk部門には触れていない |
| 2. なぜOpenTelemetryを試すのか | フェーズ1（動機） | 業界標準化とコンテスト（〜2026-08-10）。SaaSに送らずローカル完結でやる方針 |
| 3. 事前に調べたこと（SDKがモノリシックでない話） | フェーズ1の4タスク全部 | 公式が挙げるのは**5パッケージ**（install コマンド全文を貼る）。exporter が `-proto`/`-http`/`-grpc` の3種で**クラス名は全部 `OTLPTraceExporter`**（表で貼る）。公式サンプルは `ConsoleSpanExporter` で**OTLP は別ページ**。Jaeger が OTLP を直接受けられるのに Collector を挟む理由（自分の言葉の3行をそのまま） |
| 4. 環境構築（Collector + Jaeger をローカルに） | フェーズ2 / `screenshots/01` | 最終版 `otel-collector-config.yaml` **全文**。Jaeger のイメージが専用レジストリ `cr.jaegertracing.io` なこと。**ポート設計**（Jaeger=16686/4317、Collector=4418/8889）と**なぜずらす必要があったか**。`tls.insecure: true` はローカル限定と明記。Docker が使えず**リリースバイナリで代替した**注記＋その curl コマンド |
| 5. `jaeger` exporter はもう無かった【新設】 | 詰まった点2 のエラー全文 | **起動失敗ログ全文**（`valid values` の一覧が効く）→ 公式移行ブログ → `otlp/jaeger` への修正diff。「参考にした手順が古かった」という文脈まで。さらに**その後2連続で別の壁**（8888衝突→IPv6）が来た流れも書くと「1つ直すと次が出る」実感が伝わる |
| 6. auto-instrumentationだけで何が見えたか | フェーズ3の起動〜UIスクショ / `screenshots/02`,`03` | 起動ログは**2行だけ**（警告なし）。debug exporter の span 全文（resource 属性 + HTTP span の `http.route` / `http.request.method` / `http.response.status_code`）。**1リクエストあたりの span 数の表**（`/`=4、`/users`=10、`/slow`=4）。`request handler` が2本出る・`middleware - patched` という名前の話 |
| 7. 手動spanを1つ足して見えた差分 | フェーズ3の手動spanタスク / `screenshots/03`+`04` | `startActiveSpan` のコード。**before/after スクショを並置**（Total Spans 4 → 5）。debug ログの手動span（`Kind: Internal` / `practice.wait_ms: Int(800)` / `InstrumentationScope` が自分の名前）。自動計装だけでは `/slow` が「ただ遅い」に見えていた話 |
| 8. 詰まった点（パッケージ選び / endpoint / サービス名） | 「詰まった点」表 + フェーズ4の壊す実験 | 表形式で6件の「症状/原因/対処」。**「トレースが見えない」の切り分け手順**（まず12秒待つ → `/api/services` → Collector の debug ログ → アプリの `OTEL_LOG_LEVEL=debug`）。**計装が黙って失敗する**（URLミスも接続拒否もアプリ側ログ0行、レスポンスは200のまま） |
| 9. Collectorを挟む/挟まないを比べた | フェーズ4の3タスク / `screenshots/05` | **見え方は完全に同じ**（5 span で一致、Collector の batch 数が増えないのが証拠）。違うのは変えやすさ。`always_off` で完全に止まること。`/users` の内部 fetch が**同一トレースで親子に繋がった**span ツリー（10 span の出力をそのまま貼る）＝`console.log` との決定的な差 |
| 10. 触ってみて分かったこと / どんな人に向いていそうか | フェーズ5の棚卸し | 「アプリのコードを1行も変えずに4〜10 span 出る」体験。向いている人＝**ログだけでは呼び出し関係が追えなくなってきた人**。逆に「環境変数1つで無言で全部消える」怖さも一緒に書く |
| 11. まとめ・次にやること | 「再現性メモ」 | バージョン一覧を全部掲載。次はメトリクス/ログ、あるいは複数サービス間のコンテキスト伝播 |

> 出典レポートの構成案に無い **「5. `jaeger` exporter はもう無かった」** は、予定どおり素材が揃った。
> さらに**8888 衝突と IPv6 の2件が想定外の素材として増えた**ので、この見出しは
> 「古い手順を踏む → 直す → まだ動かない × 2」の3段構成にすると密度が上がる。

## 未達・撤退した項目

- **完了条件1（`docker compose ps` で2コンテナ running）**: 未達。
  `docker pull` がレジストリに到達できずイメージを取得できなかったため（詰まった点1）。
  **公式リリースバイナリ2プロセスの起動で代替**し、バージョンは当初予定と同一（otelcol 0.157.0 / Jaeger v2.20.0）。
  証跡: `commands.log` 23:45:00（切り分け）/ 23:53:18（`ps` で2プロセス確認）。
  書いた `compose.yaml` は `workspace/otel-practice/compose.yaml` に残してある（未検証の設定であることに注意）。
- **`span.end()` を書き忘れる実験**: 実施せず。対象タスクの但し書き（フェーズ3が押した場合は省略）に従った。
  完了条件には影響しない。
- **コンテストの参加条件・タグの確認**: 未実施（このSkillの担当範囲外）。記事化・公開前に募集ページで要確認。

## 再現性メモ（記事に転記する用）

- OS / ランタイム / 主要ライブラリのバージョン:
  ```
  macOS 26.5 (Darwin 25.5.0, arm64)
  node v22.17.0
  express 5.2.1
  @opentelemetry/api 1.9.1
  @opentelemetry/sdk-node 0.221.0
  @opentelemetry/auto-instrumentations-node 0.79.0
  @opentelemetry/exporter-trace-otlp-proto 0.221.0
  @opentelemetry/instrumentation-express 0.69.0  (対応 express 範囲: >=4.0.0 <6)
  @opentelemetry/instrumentation-http 0.221.0
  telemetry.sdk.version 2.10.0                   (span の resource 属性より)
  otelcol 0.157.0                                (公式リリースバイナリ darwin arm64)
  jaeger v2.20.0                                 (公式リリースバイナリ darwin arm64)
  playwright 1.61.1                              (同梱 Chromium で描画OK)
  docker 28.5.1 / compose v2.40.3-desktop.1      (今回は使用できず)
  ```
- 実行コマンドの並び（最短の再現手順）:
  ```bash
  # 1. Jaeger と Collector を用意（Docker が使えるならイメージでよい）
  curl -sSL -o jaeger.tar.gz https://github.com/jaegertracing/jaeger/releases/download/v2.20.0/jaeger-2.20.0-darwin-arm64.tar.gz
  curl -sSL -o otelcol.tar.gz https://github.com/open-telemetry/opentelemetry-collector-releases/releases/download/v0.157.0/otelcol_0.157.0_darwin_arm64.tar.gz
  tar xzf jaeger.tar.gz && tar xzf otelcol.tar.gz

  # 2. Jaeger を起動（16686=UI, 4317=OTLP gRPC, 4318=OTLP HTTP, 8888 も握る）
  ./jaeger-2.20.0-darwin-arm64/jaeger &

  # 3. Collector を起動（receiver 4418 / 内部テレメトリ 8889 / exporter は 127.0.0.1:4317）
  ./otelcol --config=./otel-collector-config.yaml &

  # 4. アプリ
  npm init -y && npm i express
  npm i @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-trace-otlp-proto
  OTEL_SERVICE_NAME=otel-practice-api \
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4418/v1/traces \
  node --import ./instrumentation.js app.js &

  # 5. トラフィックを出して 12秒ほど待ってから確認
  curl -s localhost:3000/slow
  sleep 12
  curl -s localhost:16686/api/services
  curl -s "localhost:16686/api/traces?service=otel-practice-api&operation=GET%20%2Fslow&limit=1&lookback=5m" | jq '.data[0].spans|length'
  ```
- 注意点（ポート・OS差・バージョン依存・ハマりどころ）:
  - **Collector の `jaeger` exporter は存在しない**（v0.85.0 で削除）。`otlp/jaeger` を使う。
    0.157.0 では `"otlp" alias is deprecated; use "otlp_grpc" instead` の warn が出るので、
    新しく書くなら `otlp_grpc/jaeger` の方が良い。
  - **Jaeger v2 は OTel Collector ディストリビューション**。同一ホストに Collector と並べると
    **4317 / 4318 / 8888 が衝突する**。Collector 側の receiver と `service.telemetry.metrics` をずらす。
  - **ローカルの endpoint は `127.0.0.1` を明示する**。`localhost` は `[::1]` に解決され、
    IPv4 のみで待ち受けるプロセスに繋がらない。
  - **span はバッチ送信なので即座には見えない**。UI を確認する前に10秒ほど待つ。
  - **計装の失敗は無言**。アプリは 200 を返し続ける。切り分けには `OTEL_LOG_LEVEL=debug`
    （ただし出力は数百行になるので grep 前提）。
  - `OTEL_SERVICE_NAME` / `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` / `OTEL_TRACES_SAMPLER` は
    **すべて環境変数だけで効く**（コード変更不要）。
  - Playwright は**同梱 Chromium で Jaeger UI が問題なく描画できた**（`channel: 'chrome'` は不要）。
    UI の操作は避け、`/search?service=...` と `/trace/<traceID>` の**URL直打ち**が安定。

## 次のアクション（記事化）

- [ ] この execution-log.md の「記事への写像」に沿って `articles/<slug>.md` を作成する（`/draft-article`）
- [ ] スクショを Zenn 用に `images/opentelemetry-first-instrumentation/` へ移し、`![](/images/...)` で参照する
- [ ] 完了条件・詰まった点（6件）・Collector 有無の比較を本文に落とす
- [ ] **完了条件1が Docker 前提のままなので、記事では「リリースバイナリで代替した」ことを明記する**
- [ ] コンテスト募集ページで参加条件とタグを確認する（締切 2026-08-10）
