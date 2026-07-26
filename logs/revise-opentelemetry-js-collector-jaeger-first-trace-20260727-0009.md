# 修正レポート: OpenTelemetryを初めて計装して、ローカルのCollector＋Jaegerでトレースを1本見るまで / opentelemetry-js-collector-jaeger-first-trace

## 修正の前提

- 対象記事: `articles/opentelemetry-js-collector-jaeger-first-trace.md`（引数で明示 / リネームなし）
- レビューレポート: `logs/review-opentelemetry-js-collector-jaeger-first-trace-20260727-0007.md`（判定: 公開不可 / blocker 1・warning 2・suggestion 4）
- 出典ログ: `logs/run-opentelemetry-20260726-2317/execution-log.md`（引数で明示）
- 適用範囲: blocker + warning（+ 安全な suggestion 3件）
- slug リネーム: 既定（指摘なしのため実施せず）
- 修正日時: 2026-07-27 00:09
- 過去の修正レポート: なし（本記事の初回修正）

## 結果サマリー

- 適用: blocker 1 件 / warning 2 件 / suggestion 3 件
- 未解消: 1 件（suggestion 4 = 素材が存在せず適用不可。レビュー側も「適用不可が正しい」と明記）
- slug リネーム: なし
- セルフチェック: `SUMMARY fail=0 warn=1`（warn は既にマスク済み `/Users/.../bin/node` の false positive。レビューでも同判定）
- `published: false` を維持

## 適用した修正（指摘ごと）

| # | 元の指摘（重大度 / 箇所） | 分類 | 適用した修正（before → after の要点） | 素材の出典 |
|---|---|---|---|---|
| 1 | blocker / L363 resource 属性ブロックに実名入りマシン名 | E | `-> host.name: Str(katayamaryuunosukes-MacBook-Pro.local)` → `-> host.name: Str(<マシン名>.local)`。行は消さず値のみ伏せた。あわせてブロック直後に「`host.name` と `process.command_args` は伏せている」旨＋「マシン名やプロセス引数まで勝手に付くので、外部に送るなら resource 属性は一度確認したほうがよさそう」の1文を追記 | 匿名化（同ブロックの `process.command_args` のマスク方針に揃えた） |
| 2 | warning / L541-552 「サンプリングを 0% にする」で `nosample` の出所が不明 | B | 説明文の下に実際の起動コマンドのコードブロックを追加（`OTEL_TRACES_SAMPLER=always_off` / `OTEL_SERVICE_NAME=otel-practice-nosample` / `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4418/v1/traces` / `node --import ./instrumentation.js app.js`）。説明文に「サービス名も分けて、Jaeger 側に新しい名前が出てこないことで確認します」を追記 | 出典ログ L646-651 のコマンドをそのまま転記 |
| 3 | warning / L139-157 最初の設定が Docker のサービス名 `jaeger:14250` | C（文脈補足） | L137 を「参考にした手順のとおりに `jaeger` exporter で書きました（この時点では Docker Compose 前提だったので、送り先も サービス名 `jaeger` のままです）」に。あわせて修正説明（旧 L173）に「ホストで直接動かしているので、送り先も Docker のサービス名ではなく実際のアドレスに変えます」を追記 | 出典ログ L115-135（この設定は Docker 構成時に書いた「意図的に古い書き方」） |
| 4 | suggestion 1 / L9 内部メタの前提コメント | A | `<!-- 前提: 出典ログ ... -->` の行を削除（本文への影響なし） | 機械修正 |
| 5 | suggestion 2 / L165・L246 などの `{...}` 省略に断りがない | A | 最初の Collector ログ引用の直後に「（以降の Collector ログ引用の `{...}` は、毎回同じ resource 部分を省略したものです。）」を追記 | 機械修正（引用の改変が意図的であることの明示） |
| 6 | suggestion 3 / L296 の `6 high severity vulnerabilities` が本文と繋がっていない | A | 「`npm ls --depth=0` は5行で済むのに…195パッケージ増えます。」に「増えたぶんの監査警告（`6 high severity vulnerabilities`）も一緒に付いてきました。」を追記 | 記事内に既に貼られている `npm i` 出力（出典ログ由来） |

## 削除した記述（分類C で削ったもの）

- なし（内部メタの前提コメント1行の削除のみ。本文の事実記述は削っていない）

## 未解消の指摘

| # | 指摘（重大度） | 解消できない理由 | 推奨アクション |
|---|---|---|---|
| 1 | suggestion 4 / 「計装が黙って失敗するのが一番怖かった」節にスクショがない | 出典ログの `screenshots/` に該当素材（200 が返る curl 出力・トレースが増えていない UI）が存在しない。新規作成は捏造になるためレビュー側も「文章のみで留めるのが正しい」と明記している | 将来 `/run-practice` を再実行する際に、無言失敗時の画面を1枚取得する |

## 警告

- 出典ログ `logs/run-opentelemetry-20260726-2317/execution-log.md` L428 には実名入りマシン名が残っている（記事側はマスク済み）。ログは未コミット（`git status` で untracked）かつ非公開想定なので現時点で公開リスクはないが、`logs/` をコミット・公開する運用に変える場合は同様のマスクが必要。
- 記事ファイル自体も未コミットのため、今回のマスク対象が git 履歴に残る問題は発生していない。

## セルフチェック出力（check-article.sh）

```
== check-article: articles/opentelemetry-js-collector-jaeger-first-trace.md (slug=opentelemetry-js-collector-jaeger-first-trace) ==
[PASS] Front Matter を検出した
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=45 (12-50)
[PASS] slug は汎用語で始まっていない
[PASS] type=tech
[PASS] title あり: 55文字
[PASS] emoji あり: 🔭
[PASS] topics 5個
[PASS] 画像あり: /images/opentelemetry-js-collector-jaeger-first-trace/01-jaeger-empty.png
[PASS] 画像あり: /images/opentelemetry-js-collector-jaeger-first-trace/02-trace-list.png
[PASS] 画像あり: /images/opentelemetry-js-collector-jaeger-first-trace/03-trace-detail-auto.png
[PASS] 画像あり: /images/opentelemetry-js-collector-jaeger-first-trace/04-trace-detail-manual.png
[PASS] 画像あり: /images/opentelemetry-js-collector-jaeger-first-trace/05-trace-users.png
[PASS] コードフェンスが閉じている: フェンス行=78
[PASS] ::: ブロックが閉じている: 4 行
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[WARN] 秘密情報の疑い [user-path] (散文か目視確認) at line 367
SUMMARY fail=0 warn=1
```

補足: `grep -n "katayama\|MacBook"` の結果は 0 件（実名の残存なし）。L367 の WARN は `Slice(["/Users/.../bin/node",...])` で既にマスク済みのため false positive（レビューレポートでも同判定）。

## 次のアクション

- [ ] `/review-article articles/opentelemetry-js-collector-jaeger-first-trace.md` で再レビューする
- [ ] 判定が「公開可」になったら `/publish-pr` で公開準備する
