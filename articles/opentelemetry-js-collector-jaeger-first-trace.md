---
title: "OpenTelemetryを初めて計装して、ローカルのCollector＋Jaegerでトレースを1本見るまで"
emoji: "🔭"
type: "tech"
topics: ["opentelemetry", "jaeger", "nodejs", "express", "observability"]
published: false
---

## はじめに

OpenTelemetry は分散トレーシングの標準になりつつある、という話はよく見かけるのですが、自分では一度も計装したことがありませんでした。ログ（`console.log`）で困った経験はあっても、トレースの画面を自分の手で出したことがない状態です。

そこで、SaaS には送らずにローカルだけで完結させて、Express の小さなAPIに計装を入れて Jaeger の画面でトレースを1本開くところまでをやってみました。範囲はトレースだけで、メトリクスとログは触っていません。

先に結果を書くと、トレースは出ました。ただ、そこに至るまでに設定ファイルで3回続けて別の理由で止まっていて、記録として面白かったのはむしろそちらでした。あと最後に計装をわざと壊してみたら、アプリが何も言わずに200を返し続けるのを見て少し怖くなりました。

:::message
筆者は実務経験の浅いエンジニアで、OpenTelemetry を触るのは初めてです。実行環境は macOS 26.5 (Darwin 25.5.0, arm64) / Node.js v22.17.0。バージョン一覧は最後にまとめています。
:::

## 使ったもの・環境

作ったのは、3つのエンドポイント（`/`・`/users`・`/slow`）を持つ Express 5 の最小APIと、そこから OTLP でトレースを送る構成です。送り先は OpenTelemetry Collector で、Collector から Jaeger に流します。

```
Express API ──OTLP/HTTP──> OTel Collector ──OTLP/gRPC──> Jaeger ──> Jaeger UI (16686)
```

「できた」と言える条件は自分で先に決めておきました。

1. Collector と Jaeger がローカルで起動している
2. `curl localhost:3000/slow` が 200 を返す
3. Collector のログに span が流れている
4. Jaeger UI でサービス名を検索して `/slow` のトレース詳細が開ける
5. 手動 span を足したら、同じ `/slow` のトレースに子 span が1本増える

結果は 2〜5 が満たせて、1 だけ当初の想定（Docker）と違う形になりました（後述）。

## 事前に調べたこと：SDKが1個じゃない

まず公式の [Getting Started (Node.js)](https://opentelemetry.io/docs/languages/js/getting-started/nodejs/) を読みました。最初の `npm install` がこれです。

```bash
npm install @opentelemetry/sdk-node \
  @opentelemetry/api \
  @opentelemetry/auto-instrumentations-node \
  @opentelemetry/sdk-metrics \
  @opentelemetry/sdk-trace-node
```

5個あります。`api` と `sdk-node` が別、自動計装がまた別、メトリクスとトレースでさらに別。「OpenTelemetry を入れる」が1行で終わらないというのが、最初のインストールコマンドの時点で分かります。この分かれ方に慣れるまでは、どのパッケージを import するのが正しいのか毎回迷いました。

起動方法は `node --import ./instrumentation.mjs app.js` で、アプリ本体より先に計装を読み込ませる形です。TypeScript の例（`--import instrumentation.ts`）は Node.js v20 以降が必要、v18 なら JavaScript の例を使えと書かれていました。

そして、このページのサンプルの exporter は `ConsoleSpanExporter` でした。つまり Getting Started を最後まで読んでも、まだバックエンドには何も送れていません。OTLP 送信は [exporters のページ](https://opentelemetry.io/docs/languages/js/exporters/) 側にあって、そこには3種類ありました。

| パッケージ | 転送方式 | 既定エンドポイント |
|---|---|---|
| `@opentelemetry/exporter-trace-otlp-proto` | HTTP/protobuf | `http://localhost:4318/v1/traces` |
| `@opentelemetry/exporter-trace-otlp-http` | HTTP/JSON | `http://localhost:4318/v1/traces` |
| `@opentelemetry/exporter-trace-otlp-grpc` | gRPC | `http://localhost:4317` |

ここで一瞬固まったのが、エクスポートされるクラス名が3つとも `OTLPTraceExporter` で同じことです。import 文だけ見ても、そのコードが HTTP/protobuf なのか gRPC なのか分かりません。ネットのサンプルを写すときに事故りそうだなと思いました。今回は `-proto` を選びました。

Jaeger 側も [Getting Started](https://www.jaegertracing.io/docs/latest/getting-started/) を読みました。公式のコマンドはこれです。

```bash
docker run --rm --name jaeger \
  -p 16686:16686 -p 4317:4317 -p 4318:4318 -p 5778:5778 -p 9411:9411 \
  cr.jaegertracing.io/jaegertracing/jaeger:2.20.0
```

イメージが Docker Hub ではなく `cr.jaegertracing.io` という専用レジストリなのと、ポートに 4317 と 4318 が並んでいるのが目に入りました。4317/4318 は OTLP の受け口です。つまり Jaeger 自身が OTLP を直接受けられる。

そうすると「Collector 要らないんじゃないか？」という疑問が出てきます。手を動かす前に、自分の理解を先に書いておきました。

> Jaeger が OTLP を直接受けられるので、トレースを見るだけなら Collector は無くても成立する。それでも挟むのは、アプリ側の設定を変えずに送り先を差し替えられる（アプリは常に Collector を向く）、加工・サンプリング・複数バックエンドへの分岐を一箇所に寄せられる、という運用側の都合だと理解した。

これは後で実際に両方を試して答え合わせしています（記事の後半）。

## 環境構築：Docker が使えなくてリリースバイナリに逃げた

最初は Docker Compose で Collector と Jaeger を起動する予定でした。`compose.yaml` を書いて `docker compose up -d` を叩いた結果がこれです。

```
 jaeger Pulling
 collector Pulling
```

この2行のまま18分止まりました。`docker version` は正常に応答するのでデーモンには届いています。切り分けにいちばん効いたのは、数十KBしかない `hello-world` でも取得できないことでした。

```bash
$ timeout 60 docker pull hello-world
Using default tag: latest
exit=124

$ curl -s -o /dev/null -w "%{http_code}" https://registry-1.docker.io/v2/   # -> 401
$ curl -s -o /dev/null -w "%{http_code}" https://cr.jaegertracing.io/v2/    # -> 401
$ curl -s -o /dev/null -w "%{http_code}" https://github.com                 # -> 200
```

ホストから `curl` するとレジストリには到達できています（401 は認証が要るという応答なので、通信自体は成立しています）。ホストのネットワークは生きていて、Docker Desktop の VM からの外向き通信だけが不通、という状況でした。ホスト側で普通にブラウザも通るので「ネットが壊れている」ようには見えず、ここに気づくまでが長かったです。

結局 Docker は諦めて、両方とも公式のリリースバイナリを落としてホストで直接動かしました。

```bash
curl -sSL -o otelcol.tar.gz \
  https://github.com/open-telemetry/opentelemetry-collector-releases/releases/download/v0.157.0/otelcol_0.157.0_darwin_arm64.tar.gz
tar xzf otelcol.tar.gz && ./otelcol --version
# -> otelcol version 0.157.0

curl -sSL -o jaeger.tar.gz \
  https://github.com/jaegertracing/jaeger/releases/download/v2.20.0/jaeger-2.20.0-darwin-arm64.tar.gz
tar xzf jaeger.tar.gz && ./jaeger-2.20.0-darwin-arm64/jaeger version
# -> {"gitVersion":"v2.20.0","buildDate":"2026-07-20T03:41:33Z"}
```

ダウンロードはそれぞれ3秒ほど（アーカイブは otelcol 45MB / jaeger 57MB）で終わりました。バージョンは当初予定していたイメージと同じ 0.157.0 / v2.20.0 に揃えられたので、検証したい内容は変えずに進められました。Docker が使えない環境でも同じことは試せる、というのは結果的に収穫でした。

なお、このあと出てくる詰まりのうち2件（ポート衝突）は、Docker で動かしていれば起きなかったものです。ホストに2プロセス並べたせいで踏んだ、という点は差し引いて読んでください。

Jaeger を起動して、まず空の状態の UI を見ておきました。

```bash
$ curl -s localhost:16686/api/services
{"data":[],"total":0,"limit":0,"offset":0,"errors":null}
```

![計装前のJaeger UI。Serviceプルダウンが「-」でトレースは0件](/images/opentelemetry-js-collector-jaeger-first-trace/01-jaeger-empty.png)

Service のプルダウンが `-` のまま、右側に Jaeger のゴーファーがいるだけの画面です。ここに何か出るのがゴールになります。

## `jaeger` exporter はもう無かった（そのあと2連続で別の壁）

Collector の設定は、参考にした手順のとおりに `jaeger` exporter で書きました（この時点では Docker Compose 前提だったので、送り先も サービス名 `jaeger` のままです）。

```yaml:otel-collector-config.yaml
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

これで起動すると、設定を読む段階で即死しました。

```bash
$ ../bin/otelcol --config=./otel-collector-config.yaml
Error: failed to get config: cannot unmarshal the configuration: decoding failed due to the following error(s):

'exporters' unknown type: "jaeger" for id: "jaeger" (valid values: [otlp_grpc otlp otlp_http otlphttp kafka prometheus nop file prometheus_remote_write prometheusremotewrite zipkin debug])
exit=1
```

エラーが親切で、`valid values` に使える exporter が全部並んでいます。そこに `jaeger` がありません。調べたら、Collector の `jaeger` exporter は v0.85.0 以降の公式ディストリビューションから削除済みでした。Jaeger 側が OTLP をネイティブに受けられるようになったので要らなくなった、という経緯が[公式の移行ブログ](https://opentelemetry.io/blog/2023/jaeger-exporter-collector-migration/)に書かれています。

参考にした手順が古かった、というだけの話ではあります。ただ「動かない原因が自分の書き間違いではなく、世の中の手順の賞味期限だった」というのは、初めて触る技術だと自力では気づきにくいところだと思いました。

`exporters.jaeger` を `exporters.otlp/jaeger` に直して、送り先を Jaeger の OTLP gRPC（4317）に向けます。ホストで直接動かしているので、送り先も Docker のサービス名ではなく実際のアドレスに変えます。これで動くだろうと思ったら、次はこれでした。

```
error   service@v0.157.0/service.go:183  error found during service initialization
{"resource": {...,"service.name": "otelcol", "service.version": "0.157.0"},
 "error": "failed to create meter provider: binding address localhost:8888 for Prometheus exporter: listen tcp 127.0.0.1:8888: bind: address already in use"}
...
Error: failed to create meter provider: binding address localhost:8888 for Prometheus exporter: listen tcp 127.0.0.1:8888: bind: address already in use
```

（以降の Collector ログ引用の `{...}` は、毎回同じ resource 部分を省略したものです。）

8888 は Collector が自分の内部メトリクスを出すポートです。まだ何も起動していないつもりだったので、誰が握っているのか見ました。

```
$ lsof -nP -iTCP:8888 -sTCP:LISTEN
jaeger  15082 ... TCP 127.0.0.1:8888 (LISTEN)
$ lsof -nP -iTCP:4318 -sTCP:LISTEN
jaeger  15082 ... TCP 127.0.0.1:4318 (LISTEN)
```

Jaeger でした。8888 も 4318 も持っています。ここで、Jaeger v2 自体が OpenTelemetry Collector のディストリビューションだということを知りました。だから Collector と同じ既定ポートをまるごと使う。Collector の隣に置く相手ではなく、中身が同じものだったわけです。

Collector 側をずらして回避しました。receiver を 4418、内部メトリクスを 8889 に変更。

これで3回目の起動。今度は接続拒否の warn が1秒間隔で流れ続けました。

```
2026-07-26T23:46:39.848+0900  warn  grpc@v1.82.1/clientconn.go:1534  [core] [Channel #1 SubChannel #2] grpc: addrConn.createTransport failed to connect to {Addr: "[::1]:4317", ServerName: "localhost:4317", }. Err: connection error: desc = "transport: Error while dialing: dial tcp [::1]:4317: connect: connection refused"  {"resource": {"service.instance.id": "a2c87d5f-26d4-448a-9ac3-174437359ebf", "service.name": "otelcol", "service.version": "0.157.0"}, "grpc_log": true}
```

読みどころは `Addr: "[::1]:4317"` の部分です。設定には `localhost:4317` と書いたのに、実際の接続先は IPv6 の `[::1]` になっています。一方さきほどの `lsof` を見返すと、Jaeger は `127.0.0.1` でしか待っていません。IPv4 で待っているところに IPv6 で行っていたので、当然つながらない。`endpoint: 127.0.0.1:4317` と明示して解決しました。

3回とも原因の層が違います（手順が古い／ポートが衝突／名前解決が IPv6）。しかも後半の2つは「Jaeger v2 が Collector そのもの」という1つの事実から出ていて、それを知らないまま個別に潰していたのが遠回りでした。

最終的に動いた設定はこれです。

```yaml:otel-collector-config.yaml
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

起動時のログ。接続エラーは 0 件になりました。

```
warn  builders/builders.go:40  "otlp" alias is deprecated; use "otlp_grpc" instead  {...,"otelcol.component.id": "otlp/jaeger", "otelcol.component.kind": "exporter", "otelcol.signal": "traces"}
info  service@v0.157.0/service.go:259  Starting otelcol...  {..., "Version": "0.157.0", "NumCPU": 10}
info  otlpreceiver@v0.157.0/otlp.go:175  Starting HTTP server  {..., "otelcol.component.id": "otlp", "otelcol.component.kind": "receiver", "endpoint": "[::]:4418"}
info  service@v0.157.0/service.go:282  Everything is ready. Begin running and processing data.
```

`"otlp" alias is deprecated; use "otlp_grpc" instead` という warn が出ているので、0.157.0 でこれから書くなら `otlp_grpc/jaeger` の方がよさそうです。

## auto-instrumentation だけで何が見えたか

アプリ側です。まず計装なしの Express 5 を書きました。

```js:app.js
const express = require('express');
const app = express();
const PORT = process.env.PORT ?? 3000;

app.get('/', (req, res) => { res.json({ ok: true }); });

app.get('/users', async (req, res) => {
  // 内部で自分の / を叩く。span が2階層になる材料にする
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

```
GET /      -> 200  {"ok":true}
GET /users -> 200  {"inner":{"ok":true},"users":[{"id":1,"name":"alice"},{"id":2,"name":"bob"}]}
GET /slow  -> 200  {"slow":true,"waited_ms":800}
time_total=0.802873 http_code=200
```

ここに OTel を入れます。今回は4パッケージだけにしました（メトリクスは触らないので `sdk-metrics` は入れていません）。

```bash
npm i @opentelemetry/api @opentelemetry/sdk-node \
  @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-trace-otlp-proto
```

```
added 195 packages, and audited 263 packages in 6s
6 high severity vulnerabilities

otel-practice@1.0.0
├── @opentelemetry/api@1.9.1
├── @opentelemetry/auto-instrumentations-node@0.79.0
├── @opentelemetry/exporter-trace-otlp-proto@0.221.0
├── @opentelemetry/sdk-node@0.221.0
└── express@5.2.1
```

`npm ls --depth=0` は5行で済むのに、`node_modules` には195パッケージ増えます。増えたぶんの監査警告（`6 high severity vulnerabilities`）も一緒に付いてきました。自動計装が対応ライブラリぶんの計装パッケージを引き連れてくるからで、`npm ls` で辿ると `@opentelemetry/instrumentation-express@0.69.0` などが下に並んでいました。

Express 5 で route の span が出るのか不安だったので、入った計装パッケージのコードを直接見ました。

```
$ grep -n "InstrumentationNodeModuleDefinition" -A4 \
    node_modules/@opentelemetry/instrumentation-express/build/src/instrumentation.js
25: new InstrumentationNodeModuleDefinition('express', ['>=4.0.0 <6'], moduleExports => {
26:   const isExpressWithRouterPrototype = typeof moduleExports?.Router?.prototype?.route === 'function';
27:   const routerProto = isExpressWithRouterPrototype
28:     ? moduleExports.Router.prototype // Express v5
29:     : moduleExports.Router;          // Express v4
```

対応範囲が `>=4.0.0 <6` で、v5 専用の分岐までコードに入っていました。ここは心配しなくてよかったです（実際 span も出ました）。

計装の読み込みファイルはこれだけです。

```js:instrumentation.js
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

公式サンプルは `.mjs` でしたが、CommonJS の `instrumentation.js` でも Node 22 の `--import` でそのまま読み込めました。`--require` と `--import` のどちらにすべきか迷う話をよく見かけたので身構えていたのですが、今回は `--import` 一発で警告もなしでした。

```bash
OTEL_SERVICE_NAME=otel-practice-api \
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4418/v1/traces \
node --import ./instrumentation.js app.js
```

```
[instrumentation] OTel SDK started
listening on http://localhost:3000
```

起動ログは2行だけです。サービス名は `OTEL_SERVICE_NAME` で効いたので、コード側の resource には何も書いていません。

curl を叩くと、Collector の debug exporter に span が流れてきました。resource 属性は勝手にこれだけ付いています。

```
ResourceSpans #0
Resource attributes:
     -> host.name: Str(<マシン名>.local)
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

（`host.name` と `process.command_args` は実際の値をこの記事用に伏せています。）マシン名やプロセス引数まで勝手に付くので、外部に送るなら resource 属性は一度確認したほうがよさそうです。

HTTP サーバの span はこうなっていました。

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

`http.route` や `http.response.status_code` まで入っていて、アプリのコードは1行も変えていません。ここは素直に驚きました。

1リクエストで出た span の数を Jaeger の API で数えるとこうなります。

| エンドポイント | span 数 | span 名の内訳 |
|---|---|---|
| `GET /` | 4 | `GET /` / `middleware - patched` / `request handler - /` ×2 |
| `GET /users` | 10 | `GET /users` / `GET /` / `GET`(クライアント) / `tcp.connect` / `middleware - patched` ×2 / `request handler - /users` ×2 / `request handler - /` ×2 |
| `GET /slow` | 4 | `GET /slow` / `middleware - patched` / `request handler - /slow` ×2 |

多いです。ただ中身を見ると `request handler - /` が同じ名前で2本並んでいたり、`middleware - patched` という何のミドルウェアか分からない名前が混ざっています。自動計装は量は出るけれど、意味のある名前が付いているとは限らない、という感じでした。

Jaeger UI 側です。Service のプルダウンを操作せず、`/search?service=...` を URL 直打ちで開きました（セレクタ探しで詰まりたくなかったので）。

![otel-practice-apiのトレース一覧が引けた状態](/images/opentelemetry-js-collector-jaeger-first-trace/02-trace-list.png)

`/slow` の詳細も `/trace/<traceID>` で直接開きます。

![/slowのトレース詳細。Total Spans 4 / Depth 4 / Duration 802ms](/images/opentelemetry-js-collector-jaeger-first-trace/03-trace-detail-auto.png)

Total Spans 4、Duration 802ms。4本のバーが全部ほぼ同じ長さで端から端まで伸びています。つまり「このリクエストは 802ms かかった」ことは分かるけれど、その中で何に 800ms 使ったのかは分かりません。自動計装だけだと `/slow` は「ただ遅い」としか見えない、というのが正直な感想でした。

:::message
UI を見る前に少し待つ必要があります。curl した直後は `/api/services` が空のままで、サービス名が出るまで12秒ほどかかりました（`NodeSDK` 既定の BatchSpanProcessor がまとめて送るため）。ここで慌てて設定を疑いはじめて、一度誤診しかけました。
:::

余談ですが、`/api/services` の応答には `jaeger` 自身も入ってきます。Jaeger v2 が自分のトレースも記録しているためでした。

```
{"data":["jaeger","otel-practice-api"],"total":2,...}
```

## 手動 span を1つ足して見えた差分

`/slow` の中の 800ms 待つ処理に、名前を付けて span にしてみます。

```js:app.js
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

`startActiveSpan` の第2引数がコールバックなのは、最初ちょっと戸惑いました。「span を作る」というより「span の中でこの処理を走らせる」という書き方で、しかも `span.end()` は自分で呼ぶ責任が残ります。実際のコードでは `try/finally` にしないと、例外が出たときに span が終わらないままになりそうです（今回は素直な形のまま試しました）。

debug ログに出た手動 span はこれです。

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

`Kind` が `Internal`（自動計装の HTTP span は `Server`）で、`InstrumentationScope` が `getTracer()` に渡した自分の名前になっています。どの span が自動計装由来でどれが自分の書いたものか、出自で区別できるようになっていました。

Jaeger の API で before / after を並べて数えます。

```
traceID=c355eea75a81cd8f9a50820712b991a4 spans=5 names=GET /slow, middleware - patched, request handler - /slow, request handler - /slow, slow-business-logic
traceID=c2d67d8e4fa3d261243cc752a3547f91 spans=4 names=GET /slow, middleware - patched, request handler - /slow, request handler - /slow
```

4 → 5 になりました。画面でも最下段に1本増えています。

![手動span追加後の/slow。Total Spans 5 / Depth 5、最下段にslow-business-lの子spanが増えている](/images/opentelemetry-js-collector-jaeger-first-trace/04-trace-detail-manual.png)

さっきの Total Spans 4 の画面と比べると、増えたのは1本だけです。それでも「802ms のうち、名前を付けた処理が最初から最後まで占めている」という形が見えるようになりました。実務では、この1本を足す場所を決めることのほうが難しそうだなと思います。

`practice.wait_ms` の属性はタイムライン上には出ず、span をクリックして開く詳細パネルに並びます。今回のスクショはタイムライン全体なので、属性の証跡は debug ログ側で見ています。

## Collectorを挟む/挟まないを比べた

Jaeger は最初から 4318 を持っているので、アプリの送り先をそこに変えれば Collector を通さない構成になります。変更は環境変数1つだけでした。

```bash
OTEL_SERVICE_NAME=otel-practice-direct \
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces \
node --import ./instrumentation.js app.js
```

```
GET /slow -> 200 0.813021s
{"data":["jaeger","otel-practice-api","otel-practice-direct"],"total":3,...}
traceID=d1a05fecf8d1ed5713a71275d54ece7c spans=5 names=GET /slow, middleware - patched, request handler - /slow, request handler - /slow, slow-business-logic
```

Collector を通っていないことは、Collector 側のバッチ数が動かないことで確認しました。

```
送信前の collector ResourceSpans batches = 2
送信後の collector ResourceSpans batches = 2   (変化なし)
```

トレースの見え方は完全に同じでした。5 span、同じ span 名、手動 span も出ます。違いは「アプリの設定を書き換えたかどうか」だけ。事前に書いた理解のとおりで、Collector の価値はトレースの見え方ではなく、送り先や加工をアプリを触らずに変えられる点にありました。今回の直接送信は、実務なら再デプロイが必要な変更にあたります。

### `/users` の内部 fetch は繋がっていた

`/users` は自分の `/` を fetch しています。これが1つのトレースになるのか見ました。

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

`GET /users`（Server）→ `GET`（Client）→ `GET /`（Server）が、1つの trace ID の中で親子として続いていました。`instrumentation-http` が `fetch` 側も計装していて、`tcp.connect` まで span になっています。トレースコンテキストの伝播もコード変更なしで動きました。

![/usersの10 span。内部fetchが同一トレースで親子に繋がっている](/images/opentelemetry-js-collector-jaeger-first-trace/05-trace-users.png)

`console.log` との差が一番はっきり出たのはここでした。ログだと「/users が来た」「/ が来た」の2行が別々に並ぶだけで、後者が前者の内側で起きたことは分かりません。トレースだと呼び出し関係が構造として残ります。

### サンプリングを 0% にする

`OTEL_TRACES_SAMPLER=always_off` を付けて起動してみました。サービス名も分けて、Jaeger 側に新しい名前が出てこないことで確認します。

```bash
OTEL_TRACES_SAMPLER=always_off \
OTEL_SERVICE_NAME=otel-practice-nosample \
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4418/v1/traces \
node --import ./instrumentation.js app.js
```

```
GET /slow  -> 200
GET /users -> 200
GET /      -> 200

送信前の collector ResourceSpans batches = 2
送信後の collector ResourceSpans batches = 2      (何も来ていない)

{"data":["jaeger","otel-practice-api","otel-practice-direct"],"total":3,...}
                                                  (nosample は出てこない)
```

コードは一切変えずに、span が完全に止まりました。サービス名・送り先・サンプラーが全部環境変数で差し替えられる設計なんだなと分かる一方で、環境変数を1つ間違えるだけでトレースが消えるということでもあります。

## 計装が黙って失敗するのが一番怖かった

最後に、送り先をわざと間違えて何が起きるか見ました。まず末尾の `s` を落として `/v1/trace` にした場合。

```bash
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4418/v1/trace \
  node --import ./instrumentation.js app.js
```

アプリ側のログはこれで全文です。

```
[instrumentation] OTel SDK started
listening on http://localhost:3000
```

`curl localhost:3000/slow` は `HTTP/1.1 200 OK`。エラーは1行も出ません。存在しないポート（4999、つまり ECONNREFUSED）に向けても同じで、ログは上の2行のまま、レスポンスは 200 の 0.81 秒でした。

つまり、Jaeger にトレースが出ていないとき、アプリは完全に健康そうに見えます。ユーザー影響が出ないのは設計としては正しいのですが、切り分ける側からするとヒントがゼロです。

`OTEL_LOG_LEVEL=debug` を付けると見えました。

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

ただ出力は387行あって、この4行を見つけるのに grep が必要でした。監視のための仕組み自体が黙って壊れる、というのを壊してから知れたのは良かったです。

今回の経験から、「トレースが見えない」ときに自分が次にやる順番はこうなりました。

1. まず10〜15秒待つ（バッチ送信なので即座には出ない）
2. `curl localhost:16686/api/services` にサービス名が出ているか
3. Collector の `debug` exporter のログに span が来ているか（来ていればアプリ→Collector はOK）
4. 来ていなければアプリを `OTEL_LOG_LEVEL=debug` で起動して grep

## 触ってみて分かったこと

いちばん印象に残ったのは、アプリのコードを1行も変えないまま1リクエストで4〜10本の span が出たことです。ログを仕込む発想とはだいぶ違いました。一方でその span 名は `request handler - /` が2本並んだり `middleware - patched` だったりで、意味のある名前は自分で足す必要があります。手動 span を1本足しただけで `/slow` の見え方が変わったのが、その具体例になりました。

向いていそうなのは、ログだけでは呼び出し関係が追えなくなってきた人だと思います。`/users` の span ツリーが、そこの差をいちばん分かりやすく示していました。

逆に、環境変数1つで全部が無言で消える点は先に知っておいた方がいいです。自分が本番で使うなら、「トレースが来ていること自体」を監視する必要があるんだろうな、というところまでは想像がつきました（どうやるのかは分かっていません）。

Collector と Jaeger の役割も、始める前は正直あいまいでした。Jaeger v2 が Collector のディストリビューションだと知ってからは、ポート衝突も含めて納得がいきました。

## まとめ・環境

ローカルだけで、計装 → Collector → Jaeger → UI でトレース1本、までは到達しました。作業時間の大半は Collector の設定ファイルで3回続けて止まったところと、Docker の切り分けに消えました。手を動かす部分（Express、instrumentation.js、手動 span）は驚くほど短かったです。

次はメトリクスとログ、あるいは複数サービスにまたがるコンテキスト伝播を試したいと思っています。

バージョン一覧（この記事の出力はすべてこの環境のものです）:

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
```

最短の再現手順:

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

ハマりどころのメモ:

- Collector の `jaeger` exporter は存在しない（v0.85.0 で削除）。`otlp/jaeger` を使う。0.157.0 では `"otlp" alias is deprecated; use "otlp_grpc" instead` の warn が出るので、新しく書くなら `otlp_grpc/jaeger`
- Jaeger v2 は OTel Collector ディストリビューション。同一ホストに Collector と並べると 4317 / 4318 / 8888 が衝突する
- ローカルの endpoint は `127.0.0.1` を明示する。`localhost` は `[::1]` に解決される
- span はバッチ送信なので、UI を見る前に10秒ほど待つ
- 計装の失敗は無言。アプリは 200 を返し続ける。切り分けには `OTEL_LOG_LEVEL=debug`（出力は数百行になるので grep 前提）
- `tls.insecure: true` はローカルのプロセス間通信限定の設定です

## 参考リンク

- OpenTelemetry / Getting Started (Node.js)
https://opentelemetry.io/docs/languages/js/getting-started/nodejs/
- OpenTelemetry / JS Exporters
https://opentelemetry.io/docs/languages/js/exporters/
- Jaeger / Getting Started
https://www.jaegertracing.io/docs/latest/getting-started/
- Jaeger exporter の削除と移行について（OpenTelemetry ブログ）
https://opentelemetry.io/blog/2023/jaeger-exporter-collector-migration/
