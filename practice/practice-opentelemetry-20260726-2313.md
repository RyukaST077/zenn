# 実践タスク: OpenTelemetryを初めて計装して、ローカルCollector＋Jaegerでトレースを1本見るまで

## このタスクの前提

- 出典レポート: `research/search-topic-20260726-2305.md`
- 元テーマ: テーマ1 / 「OpenTelemetryを初めて触って、ローカルCollector＋Jaegerに小さなAPIのトレースを出すまで（詰まった点つき）」（レポートの「最初に試すべき1本」をそのまま採用）
- 対象技術: OpenTelemetry JS SDK（`@opentelemetry/sdk-node` 系）+ OpenTelemetry Collector + Jaeger v2 / Express
- 記事の方向性（記事タイプ）: 「試してみた」＋「検証ログ」＋「詰まった点まとめ」
- 想定筆者 / 想定読者: Web系の新人エンジニア（計装は未経験） / 新人〜実務2年目で計装をやったことがない人
- 検証に使える想定時間: **1日（約6時間30分）**（引数で時間指定が無かったため、レポートの見積り「環境構築2h/計装1h/手動span1h/記録1h」に深掘りを足した1日枠をデフォルト採用）
- 判断方針: 引数は「対象レポート」のみ指定。テーマ・時間・スキルレベル・成果物は**すべてデフォルト前提**を採用した。
- 実行環境の担保: **テーマの置き換えは不要**。Collector・Jaegerはローカル Docker、アプリは Node のみ、可視化確認は Playwright でスクリーンショット。SaaS登録・課金APIキー・手動デプロイ・ダッシュボード手動操作は一切含まない。レポートの注意点どおり **Splunk部門（サインアップ必須）には触れない**、OpenTelemetry部門のみを対象にする。

### 裏取りで判明した「レポートとのズレ」（重要）

このプランを作る過程で一次情報を確認したところ、出典レポートの記述に**そのままでは動かない箇所**が2つ見つかった。ここは記事の目玉になるので、あえて修正済みの手順とせず「詰まる前提のタスク」として組み込んである。

| # | レポートの記述 | 一次情報で判明した事実 | 本プランでの扱い |
|---|---|---|---|
| 1 | `otel-collector-config.yaml`（OTLP receiver 4318 → **Jaeger exporter**） | Collector の `jaeger` exporter は **v0.85.0 以降の公式ディストリビューションから削除済み**。Jaeger が OTLP をネイティブ対応したため、`otlp/jaeger` exporter で Jaeger の 4317 に送るのが現行の正解（[公式ブログ](https://opentelemetry.io/blog/2023/jaeger-exporter-collector-migration/)） | フェーズ2で**あえて `jaeger` exporter を書いて起動失敗を踏み**、`otlp/jaeger` に直す流れをタスク化（記事の「詰まった点」の中心） |
| 2 | Node 26系を使う | このマシンの Node は **v22.17.0**。OTel JS の公式 Getting Started の要件は **Node 20以上**なので v22 で問題ない | Node 26 前提を外し、**実際の `node -v` を記録する**タスクに変更 |

## 完成イメージ（成果物）

- 作るもの: **Express の最小HTTP API（3エンドポイント）＋ OpenTelemetry 自動計装 ＋ ローカル Collector → Jaeger のトレースパイプライン**
  - `GET /` … 即返す
  - `GET /users` … 配列JSONを返す（内部で `/`(自分) へ fetch し、span が2階層になる材料にする）
  - `GET /slow` … 人工的に約800ms待つ。ここに後から**手動span**を1つ足す
- 「できた」と言える完了条件:
  1. `docker compose ps` で collector と jaeger の2コンテナが `running`
  2. `curl localhost:3000/slow` が 200 を返す
  3. Collector のログ（`debug` exporter）に span が流れている
  4. **Jaeger UI（`http://localhost:16686`）でサービス名 `otel-practice-api` のトレースが検索でき、`/slow` のトレース詳細が開ける**
  5. 手動span追加後、同じ `/slow` のトレースに**自動計装だけのときには無かった子span**が1本増えている
- 完了確認の方法:
  - 1〜3: CLI出力（`docker compose ps` / `curl -i` / `docker compose logs collector`）
  - 4〜5: **Playwright で Jaeger UI を操作しスクリーンショット**（`images/` 配下に保存）。既存知見に従い、Jaeger UI は新しめのブラウザAPIに依存しないため同梱Chromiumで足りる見込みだが、描画が崩れるようなら `channel: 'chrome'` に切り替える（`knowledge/2026-07-21-playwright-bundled-chromium-lags-use-channel-chrome.md` 参照）
- 記事タイトル案（そのまま使える形）:
  1. OpenTelemetryを初めて触って、ローカルCollectorにトレースを出すまでにやったこと
  2. 計装未経験の新人が、ExpressのAPIをOpenTelemetryで計装してJaegerでトレースを1本見るまで
  3. Collectorの `jaeger` exporter はもう無い — OpenTelemetry初計装で踏んだ落とし穴の記録

## 事前準備チェックリスト

- [ ] 認証・APIキー: **不要**。使うのは Docker Hub / Jaeger の公開イメージと npm の公開パッケージのみ。`OTEL_EXPORTER_OTLP_HEADERS` などの認証ヘッダは使わない
- [ ] ローカル環境（言語・ランタイム・バージョン）: Node **v22.17.0**（`node -v` で実測値を記録。OTel JS の要件は Node 20以上）/ Docker **28.5.1** / macOS Darwin 25.5.0
- [ ] インストールするもの（裏取り済みの最新版。実際に入った版は `npm ls` で記録する）:
  - `express@5.2.1`
  - `@opentelemetry/api@1.9.1`
  - `@opentelemetry/sdk-node@0.221.0`
  - `@opentelemetry/auto-instrumentations-node@0.79.0`
  - `@opentelemetry/exporter-trace-otlp-proto@0.221.0`
  - `playwright`（Jaeger UI のスクショ用）
  - Docker イメージ: `otel/opentelemetry-collector:0.157.0` / `cr.jaegertracing.io/jaegertracing/jaeger:2.20.0`
- [ ] 無料枠 / コストの確認: **すべて無料・ローカル完結**。課金トリガーは無い
- [ ] 記録用の準備: 作業ディレクトリ `logs/run-<日時>/otel-practice/`、実行ログ `logs/run-<日時>/execution-log.md`、スクショ `images/opentelemetry-first-instrumentation/`

## 実践タスク（フェーズ別）

### フェーズ1: 事前調査（目安: 45分）

- [ ] **公式 Getting Started（Node.js）を読み、必要パッケージと起動方法を書き出す**（目安: 20分）
  - 実行: `WebFetch`/ブラウザで <https://opentelemetry.io/docs/languages/js/getting-started/nodejs/> を確認
  - 記録すること: 公式が挙げるパッケージ一覧（`sdk-node` / `api` / `auto-instrumentations-node` / `sdk-trace-node` / `sdk-metrics`）と、**「単一パッケージで完結しない」と感じた瞬間の素直な感想**。起動が `--import ./instrumentation.ts` 形式であること。公式サンプルの traceExporter が `ConsoleSpanExporter` で、**OTLP送信は別ページ扱い**になっている点
- [ ] **OTLP exporter のページで、パッケージ名と既定エンドポイントを確認する**（目安: 10分）
  - 実行: <https://opentelemetry.io/docs/languages/js/exporters/> を確認
  - 記録すること: `@opentelemetry/exporter-trace-otlp-proto` の `OTLPTraceExporter` を使うこと / 既定URLが `http://localhost:4318/v1/traces` であること / `-proto` と `-http` と `-grpc` の3種があって**どれを選ぶか迷った事実**
- [ ] **Jaeger 公式の Getting Started で、v2 all-in-one のイメージ名とポートを確認する**（目安: 10分）
  - 実行: <https://www.jaegertracing.io/docs/latest/getting-started/> を確認
  - 記録すること: イメージが `cr.jaegertracing.io/jaegertracing/jaeger:2.20.0`（Docker Hub ではなく **専用レジストリ**）であること / 公開ポート `16686`（UI）`4317`（OTLP gRPC）`4318`（OTLP HTTP）/ **Jaeger 自身が OTLP を直接受けられる**という事実
- [ ] **「Collector を挟む意味」を自分の言葉で1〜3行に書く**（目安: 5分）
  - 記録すること: Jaeger が OTLP を直接受けられるなら Collector は要らないのでは？という疑問と、それでも挟む理由（アプリ側の設定を変えずに送り先を差し替えられる / 加工・サンプリングを一箇所に寄せられる）。**この疑問は記事の「事前に調べたこと」でそのまま使える**

### フェーズ2: 環境構築（目安: 60分）

- [ ] **作業ディレクトリを作り、Node と Docker のバージョンを記録する**（目安: 5分）
  - 実行: `mkdir -p logs/run-<日時>/otel-practice && cd $_ && npm init -y && node -v && docker --version && docker compose version`
  - 記録すること: 出力そのまま（**Node 26 ではなく v22 系だった**ことを明記。記事の再現性情報になる）
- [ ] **`otel-collector-config.yaml` を、レポート記載どおり `jaeger` exporter で書く**（目安: 10分）
  - 内容: `receivers.otlp.protocols.http`（`0.0.0.0:4318`）→ `exporters.jaeger.endpoint: jaeger:14250` → `service.pipelines.traces`
  - 記録すること: 書いた設定ファイル全文。**ここは意図的に「古い書き方」を踏むタスク**なので、直す前の状態を必ず残す
- [ ] **`compose.yaml` を書いて `docker compose up -d` し、Collector の起動失敗を確認する**（目安: 15分）
  - 構成: `collector`（`otel/opentelemetry-collector:0.157.0`、host `4318:4318` を公開、config をマウント）/ `jaeger`（`cr.jaegertracing.io/jaegertracing/jaeger:2.20.0`、host `16686:16686` **のみ公開**。4317/4318 はホストに出さずコンテナ間通信で使う → Collector とのポート衝突を避ける）
  - 実行: `docker compose up -d && docker compose ps && docker compose logs collector`
  - 記録すること: **Collector が落ちたときのエラー全文**（`error decoding 'exporters'` / `unknown type: "jaeger"` 系のメッセージ）。`docker compose ps` の `exited` 表示。**このエラーが記事の一番の見どころ**
- [ ] **`jaeger` exporter を `otlp/jaeger` に直して起動し直す**（目安: 15分）
  - 修正: `exporters.otlp/jaeger.endpoint: jaeger:4317` + `tls.insecure: true`、`exporters.debug.verbosity: detailed` を併記し、`pipelines.traces.exporters: [otlp/jaeger, debug]` にする
  - 実行: `docker compose up -d --force-recreate collector && docker compose ps && docker compose logs collector | tail -30`
  - 記録すること: 修正前後の設定diff / 2コンテナが `running` になった `docker compose ps` 出力 / **「なぜ削除されたのか」を調べて分かったこと**（Jaeger の OTLP ネイティブ対応が理由。v0.85.0 以降で削除）
- [ ] **Jaeger UI が開くことを Playwright で確認する（計装前の空の状態）**（目安: 15分）
  - 実行: `npx playwright screenshot --wait-for-timeout=2000 http://localhost:16686 ../../../images/opentelemetry-first-instrumentation/01-jaeger-empty.png`（コマンド形は要確認。動かなければ短いスクリプトを書く）
  - 記録すること: スクショのパス / **サービス一覧に何も無い**状態（after と対にすると効く）/ 起動〜表示までに詰まった点

### フェーズ3: 実装・検証【本編】（目安: 180分）

- [ ] **Express の最小API（3エンドポイント）を書き、計装なしで動かす**（目安: 30分）
  - 実行: `npm i express` → `app.js` に `/`・`/users`・`/slow`（`await new Promise(r => setTimeout(r, 800))`）を実装 → `node app.js` → `curl -i localhost:3000/ localhost:3000/users localhost:3000/slow`
  - 記録すること: `app.js` 全文 / 3本の `curl -i` の応答（`/slow` は `curl -w '%{time_total}'` で所要時間も） / **express のバージョン**（`npm ls express`。5系であること）
- [ ] **OTel のパッケージを入れ、入った版を記録する**（目安: 15分）
  - 実行: `npm i @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-trace-otlp-proto` → `npm ls --depth=0`
  - 記録すること: `npm ls --depth=0` 出力全文 / `@opentelemetry/instrumentation-express` の実際の版（`npm ls @opentelemetry/instrumentation-express`。**Express 5 に対応しているかは要確認**。span が出ないときの一次容疑者になる）/ **入れるパッケージが4つに分かれている件の実感**
- [ ] **`instrumentation.js` を書き、OTLP exporter で Collector に送る設定にする**（目安: 30分）
  - 内容: `NodeSDK` に `traceExporter: new OTLPTraceExporter({ url: 'http://localhost:4318/v1/traces' })`、`instrumentations: [getNodeAutoInstrumentations()]`、サービス名は `OTEL_SERVICE_NAME=otel-practice-api` を使う（環境変数が効くかを実測。効かなければ resource で明示 → **これも記録対象**）
  - 記録すること: `instrumentation.js` 全文 / **公式サンプルは `ConsoleSpanExporter` なので、OTLP に差し替える部分は自分で調べた**という経緯 / サービス名の指定方法で迷った点
- [ ] **`--import` で計装を読み込んで起動し、自動計装だけで何が出るか確認する**（目安: 30分）
  - 実行: `OTEL_SERVICE_NAME=otel-practice-api node --import ./instrumentation.js app.js` → 別シェルで3本 `curl` → `docker compose logs collector | tail -60`
  - 記録すること: 起動時のログ（OTel の警告が出たらその全文）/ **Collector の debug exporter に届いた span の中身**（span 名・属性 `http.route` / `http.request.method` / `http.response.status_code`）/ **1リクエストで span がいくつ出たか** / `--import` と `--require` のどちらを使ったか
- [ ] **Jaeger UI をPlaywrightで開き、サービス検索 → トレース詳細をスクショする**（目安: 45分）
  - 実行: 短い Playwright スクリプト（`otel-shot.mjs`）を書く。Service セレクトで `otel-practice-api` を選び、`Find Traces` をクリック → 一覧スクショ → `/slow` のトレースをクリック → 詳細スクショ
  - 保存先: `images/opentelemetry-first-instrumentation/02-trace-list.png` / `03-trace-detail-auto.png`
  - 記録すること: スクリプト全文 / **サービス名がプルダウンに出てくるまでにリロードが必要だったか**（バッチ送信の遅延）/ span の階層構造がどう見えたか / セレクタ特定で詰まった点 / スクショのパス
- [ ] **`/slow` の中に手動spanを1つ足す**（目安: 30分）
  - 実行: `trace.getTracer('otel-practice-api')` → `tracer.startActiveSpan('slow-business-logic', async span => { ... span.setAttribute('practice.wait_ms', 800); span.end() })`。`span.end()` を**わざと最初は書かずに**挙動を見てから足すと素材が増える
  - 記録すること: 差分コード / `span.end()` 無しのときトレースがどう見えたか / **`startActiveSpan` の第2引数がコールバックという書き味**についての感想
- [ ] **手動span追加後のトレースを再取得し、自動計装のみのスクショと並べる**（目安: 20分）
  - 実行: アプリ再起動 → `curl localhost:3000/slow` → Playwright で `04-trace-detail-manual.png` を撮る
  - 記録すること: **子spanが1本増えたことが分かるスクショ2枚** / 自動計装だけでは `/slow` の中身が「ただ遅いだけ」に見えていた事実 / 属性がUI上どこに表示されるか

> フェーズ3の目安合計は200分。180分に収めるため、**押した場合は「`span.end()` を書き忘れる実験」を省略**して手動spanを一発で正しく書く（記録項目は減るが完了条件は満たせる）。

### フェーズ4: 深掘り・比較（目安: 90分）

- [ ] **Collector を経由せず、アプリから Jaeger の 4318 へ直接送って比較する**（目安: 30分）
  - 実行: `compose.yaml` で Jaeger の `4318` をホストの別ポート（例 `4319:4318`）に公開 → `instrumentation.js` の url を切り替えて起動 → 同じ `curl` → Jaeger UI で見え方を比較
  - 記録すること: 設定差分 / **トレースの見え方が変わるか（変わらないはず）** / Collector を挟む/挟まないの手間の差 / フェーズ1で書いた「Collector を挟む意味」の答え合わせ
- [ ] **エクスポータのエンドポイントをわざと間違えて、失敗時のログを見る**（目安: 20分）
  - 実行: url を `http://localhost:4318/v1/trace`（末尾sを落とす）や存在しないポートにして起動 → `curl` → アプリ側ログ
  - 記録すること: **アプリ側に出るエラー全文**（404 / ECONNREFUSED）/ **アプリのレスポンス自体は正常に返り続けるか**（計装の失敗がユーザー影響になるか）/ 「サイレントに失敗する」経験は記事価値が高い
- [ ] **サンプリングを 0% にして、span が止まることを確認する**（目安: 20分）
  - 実行: `OTEL_TRACES_SAMPLER=always_off` を付けて起動 → `curl` → Collector ログと Jaeger UI を確認（環境変数名は**要確認**。効かなければ SDK 側で `sampler` を明示）
  - 記録すること: 使った指定方法 / Collector ログに何も来ないこと / **環境変数で挙動が変わる範囲がどこまでか**
- [ ] **`/users` の内部 fetch がトレースで繋がっているか確認する**（目安: 20分）
  - 実行: `curl localhost:3000/users` → Jaeger UI で span 数と親子関係を確認 → `05-trace-users.png`
  - 記録すること: **自動計装が HTTP クライアント側も拾っているか** / span が繋がらなかった場合はその事実（推測で「繋がる」と書かない）

### フェーズ5: 振り返り・記事化準備（目安: 45分）

- [ ] **記録テンプレを見返して詰まった点を棚卸しする**（目安: 20分）
  - 記録すること: 詰まった点を「原因 / 効いた対処 / 費やした時間」の3列で表にする。特に **Collector の `jaeger` exporter 削除**は、レポート記載の手順が古かったという文脈込みで書く
- [ ] **「記事への写像」に沿って本文ドラフトの見出しを埋める**（目安: 15分）
  - 記録すること: 各見出しに貼る素材（コマンド・エラー全文・スクショパス）の対応が全部埋まっているか。空欄が残る見出しは、素材が取れていないので**書かない**
- [ ] **未記録の新規トラブルがあれば `save-knowledge` で `knowledge/` に残す**（目安: 10分）
  - 記録すること: 記録したナレッジのファイルパス（Collector の exporter 削除は有力候補）

> 目安時間の合計: **約 6 時間 30 分**（45 + 60 + 180 + 90 + 45 = 420分 = 7時間 … フェーズ3を180分に収める前提で調整。1日枠に収まっている）

## 詰まりそうなポイントと対処の指針

| # | 詰まりそうな点 | なぜ起きるか | 最初に試すこと | 記事での活かし方 |
|---|---|---|---|---|
| 1 | Collector が `unknown type: "jaeger"` 系のエラーで起動しない | Collector の `jaeger` exporter は **v0.85.0 以降の公式ディストリビューションから削除**（Jaeger が OTLP をネイティブ対応したため）。ネット上の記事・過去のサンプルは古い設定のまま | `exporters` を `otlp/jaeger:` に変え、`endpoint: jaeger:4317` + `tls.insecure: true` にする。`docker compose logs collector` を必ず読む | **記事の中心**。「参考にした手順が古かった」という新人が最も踏む型のトラブル。エラー全文＋公式の移行ブログを引用して直す |
| 2 | ホストのポート 4318 が衝突して片方が起動しない | Jaeger v2 all-in-one **自身が 4317/4318 を持っている**ので、Collector と同じホストポートを公開すると衝突する | Jaeger 側は `16686` だけホストに公開し、OTLP はコンテナ間通信（`jaeger:4317`）で受ける。`lsof -i :4318` で占有プロセスを見る | 「Collector と Jaeger の役割が最初は分からなかった」話に繋げる。構成図を1枚描くと読者に効く |
| 3 | Jaeger UI にサービス名が出てこない / トレースが空 | ① span がバッチ送信されるまで数秒待たされる ② サービス名が未設定で `unknown_service:node` になる ③ exporter の url パスが `/v1/traces` でない | 数秒待って UI をリロード → サービス一覧の実際の表示名を確認 → `OTEL_SERVICE_NAME` が効いているか、`docker compose logs collector` の span 属性で確認 | 「トレースが見えない」は初計装の最頻トラブル。**どの層（アプリ/Collector/Jaeger）で止まっているかの切り分け手順**として書くと実用性が高い |
| 4 | Express 5 で HTTP span は出るのに route/ミドルウェアの span が出ない | `@opentelemetry/instrumentation-express`（現行 0.69.0）の対応 Express バージョン範囲に **Express 5 が入っているかは要確認**。入っていなければ黙って何もしない（エラーにならない） | `npm ls @opentelemetry/instrumentation-express` で版を確認 → 出ないなら `express@4` を入れて同じ検証をし、差分を見る | 「エラーが出ないのに機能しない」型。バージョン範囲の確認手順として書く。既存ナレッジ（Playwright 同梱Chromium）と同じ**"名前ではなく実挙動で確認する"**教訓に繋がる |
| 5 | Node のバージョン要件と `--import` の可否で迷う | 公式 Getting Started は `--import`（Node 20以上）前提。古い記事は `--require ./instrumentation.js` 形式。TS版は `tsx` 併用 | `node -v` を先に記録し、**JS版（`--import ./instrumentation.js`）で始める**。動かなければ `--require` を試す | 「公式のサンプルがTSで、JSに落とすところで一手間かかった」という素直な記録にする |
| 6 | 計装が失敗してもアプリは正常に応答し続けるので気づけない | OTel SDK は送信失敗をアプリのエラーにしない設計 | エンドポイントをわざと壊して（フェーズ4）**失敗時に何がログに出るか**を先に知っておく | 「監視の仕組み自体が黙って壊れる」という運用目線の気づき。新人記事としては珍しい切り口になる |

## 記録テンプレ（実行中に埋める）

各タスクを実行しながら、以下を都度メモする。これがそのまま経験談の一次情報になる。

- 実行したコマンド:（コピペできる形で。`docker compose` 系は全文）
- 出たエラー（全文）:（**要約しない**。特に Collector の起動エラーと OTLP 送信失敗）
- 効いた解決方法 / 試したこと:（効かなかった試行も残す）
- 所要時間（見積もり → 実測）:（フェーズ単位で。ズレた理由も）
- つまずいた理由・分かっていなかった前提:（例: Collector と Jaeger の役割分担、OTel のパッケージ分割）
- 既存技術と比べて感じた違い:（`console.log` / APMサービス / 単なるアクセスログと比べてどうか）
- スクショを撮った箇所:（`images/opentelemetry-first-instrumentation/*.png` のパスと、何が写っているか）
- 記事に書きたい気づき:

### 必ず残すバージョン一覧（記事の再現性セクション用）

```
node -v
docker --version
npm ls --depth=0
npm ls @opentelemetry/instrumentation-express
docker images | grep -E 'opentelemetry-collector|jaeger'
```

## 記事への写像（タスク → 見出し）

出典レポートの「記事構成案」に対応させる。実行後、右列の記録を左の見出しに流し込む。

| 記事の見出し | 対応するタスク / 記録 | 書くこと |
|---|---|---|
| 1. はじめに | 前提・動機 | 計装をやったことがない新人が、ローカルだけでトレースを見るまでを試した、という宣言。検証範囲（トレースのみ。メトリクス/ログは範囲外）を明示 |
| 2. なぜOpenTelemetryを試すのか | フェーズ1（動機） | Zennのコンテスト（〜2026-08-10）と業界標準化。SaaSに送らずローカル完結でやる方針 |
| 3. 事前に調べたこと（SDKがモノリシックでない話） | フェーズ1の全タスク | 公式が挙げるパッケージが4〜5個に分かれていること / exporter が `-proto`/`-http`/`-grpc` に分かれていて迷ったこと / **Jaeger が OTLP を直接受けられるのに Collector を挟む理由** |
| 4. 環境構築（Collector + Jaeger をローカルに） | フェーズ2の全タスク | `compose.yaml` と `otel-collector-config.yaml` 全文。Jaeger のイメージが専用レジストリなこと。ポート設計（16686だけ公開する理由） |
| 5. `jaeger` exporter はもう無かった【新設】 | フェーズ2の失敗→修正タスク、詰まりポイント1 | **起動失敗のログ全文** → 公式の移行ブログ → `otlp/jaeger` への修正diff。参考手順が古かったという文脈まで書く |
| 6. auto-instrumentationだけで何が見えたか | フェーズ3の起動〜Jaeger UIスクショ | Collector の debug ログに出た span / トレース一覧・詳細のスクショ2枚 / 1リクエストで span が何本出たか |
| 7. 手動spanを1つ足して見えた差分 | フェーズ3の手動spanタスク | `startActiveSpan` のコード / **before/after のスクショ並置** / 自動計装だけでは中身が見えなかった話 |
| 8. 詰まった点（パッケージ選び / endpoint / サービス名） | 詰まりポイント表 + 記録テンプレ + フェーズ4の壊す実験 | 表形式で「症状 / 原因 / 対処」。特に「トレースが見えない」の切り分け手順と、**計装が黙って失敗する**話 |
| 9. Collectorを挟む/挟まないを比べた | フェーズ4の直接送信・サンプリング・`/users` | 見え方は同じで、変えやすさが違うという実測ベースの結論 |
| 10. 触ってみて分かったこと / どんな人に向いていそうか | フェーズ5の棚卸し | 「半日〜1日でここまで見える」という所要時間の実測。向いている人（ログだけで追いきれなくなってきた人） |
| 11. まとめ・次にやること | フェーズ5 | 使ったバージョン一覧を再現性情報として掲載。次はメトリクス/ログ、あるいは Vite+ 検証へ |

> 出典レポートの構成案には無い **「5. `jaeger` exporter はもう無かった」** を追加している。裏取りの段階で確実に踏むと分かった詰まりポイントで、レポートが挙げる差別化ポイント（「パッケージ構成でつまずいた具体的なエラーを載せる」）を最も強く満たすため。

## 経験談として書くときのコツ

- 「新人が試した範囲」を明示する。**トレースのみ / ローカル完結 / メトリクス・ログは範囲外 / Splunk部門には触っていない**をはっきり書く
- 「オブザーバビリティとはこうあるべき」といった一般論の断定は書かない。観測した事実と、そこから自分が思ったことを分けて書く
- **エラーは全文貼る**。Collector の起動エラーと OTLP 送信失敗の2つは要約しない
- Jaeger UI のスクショは**before/after を必ず対にする**（空 → 自動計装 → 手動span追加）
- 「エージェント自動検出」のように**観測できなかったことは推測で書かない**。Express 5 の span が出なかった場合は「出なかった」と書く
- 使ったバージョン（Node / Docker / 各パッケージ / 2つのDockerイメージのタグ）を全部載せる。OTel はパッケージが分かれていて版がズレやすいので、ここが読者の再現性を左右する
- 公式ドキュメントへのリンクを入れる（Getting Started / exporters / Jaeger / Collectorの移行ブログ）

## 参考リンク

- 公式ドキュメント（OTel JS Getting Started / Node.js）: <https://opentelemetry.io/docs/languages/js/getting-started/nodejs/>
- 公式ドキュメント（OTel JS Exporters）: <https://opentelemetry.io/docs/languages/js/exporters/>
- OpenTelemetry Collector Quick Start（イメージ `otel/opentelemetry-collector:0.157.0`）: <https://opentelemetry.io/docs/collector/quick-start/>
- **Collector の Jaeger exporter 移行ブログ（詰まりポイント1の一次情報）**: <https://opentelemetry.io/blog/2023/jaeger-exporter-collector-migration/>
- Jaeger が OTLP をネイティブ対応した経緯: <https://opentelemetry.io/blog/2022/jaeger-native-otlp/>
- Jaeger Getting Started（イメージ `cr.jaegertracing.io/jaegertracing/jaeger:2.20.0`）: <https://www.jaegertracing.io/docs/latest/getting-started/>
- Zenn 記事投稿コンテスト「OpenTelemetryの知見を、記事にしよう」（締切 2026-08-10）: <https://zenn.dev/contests/splunk-opentelemetry-2026>
- Encore「OpenTelemetry Node.js Setup Guide 2026」: <https://encore.dev/articles/opentelemetry-nodejs-guide>
- 既知の詰まりポイント（自リポジトリのナレッジ）: `knowledge/2026-07-21-playwright-bundled-chromium-lags-use-channel-chrome.md`

## 想定リスク・注意点

- **コスト**: ゼロ。公開Dockerイメージと公開npmパッケージのみ。課金トリガーとなる操作は含まない
- **ライセンス / 規約**: OpenTelemetry・Jaeger はいずれも Apache-2.0。コンテストの参加条件とタグは**投稿前に募集ページで必ず再確認する**（このプランでは確認していない）
- **セキュリティ**: APIキー・トークンは一切使わない。`tls.insecure: true` は**ローカルのコンテナ間通信限定**の設定であることを記事にも明記する（読者が本番にコピペしないよう）
- **ディスク**: Docker イメージ2つで数百MB。検証後は `docker compose down -v` で片付ける
- **撤退ライン**:
  - フェーズ2に**90分以上**かかったら、Collector を諦めて**アプリ → Jaeger 4318 に直接送る構成**に切り替える（フェーズ4の内容を本編に繰り上げ）。それでもトレースが見えるので成果物の完了条件は満たせる
  - Express 5 で route span が出ず、`express@4` でも解決しない場合は、**素の `node:http` サーバに切り替える**（自動計装の HTTP span は出る）。切り替えた事実をそのまま記事に書く
  - Playwright で Jaeger UI が操作できない場合は、`curl 'localhost:16686/api/traces?service=otel-practice-api'` のJSONレスポンスを証跡にする（スクショは全体表示のみ）

## 次のアクション

- [ ] フェーズ1から順に着手する（`/run-practice` でこのファイルを渡す）
- [ ] 記録テンプレを埋めながら進める（`logs/run-<日時>/execution-log.md`）
- [ ] 完了条件5つすべてを満たしたら「記事への写像」に沿って本文ドラフトへ展開する（`/draft-article`）
- [ ] コンテスト募集ページで参加条件とタグを確認する（**締切 2026-08-10**。逆算するとレビュー込みで余裕がないので着手を優先）
