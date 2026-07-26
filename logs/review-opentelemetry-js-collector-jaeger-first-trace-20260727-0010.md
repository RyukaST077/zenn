# 公開前レビュー: OpenTelemetryを初めて計装して、ローカルのCollector＋Jaegerでトレースを1本見るまで / opentelemetry-js-collector-jaeger-first-trace

## レビューの前提

- 対象記事: `articles/opentelemetry-js-collector-jaeger-first-trace.md`（引数で明示）
- 出典ログ: `logs/run-opentelemetry-20260726-2317/execution-log.md`（引数で明示）
- レビュー日時: 2026-07-27 00:10
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準
- 位置づけ: **再レビュー**（初回 `logs/review-...-20260727-0007.md` 判定=公開不可 → `logs/revise-...-20260727-0009.md` で修正済み）

## 判定

**判定: 公開可**

- blocker: 0 件 / warning: 0 件 / suggestion: 3 件
- 根拠:
  - 初回レビューの blocker 1件（resource 属性ブロックに実名入り `host.name`）は伏せ字化され、`grep -n "katayama\|MacBook"` は 0 件。個人パスも `/Users/.../bin/node` にマスク済み。
  - 初回レビューの warning 2件（`nosample` 起動コマンドの欠落 / 初回 Collector 設定が Docker サービス名である文脈の不足）は、いずれも出典ログの一次情報の範囲で補われている（記事 L541-550、L135・L171）。
  - `published: false` を維持。slug は 45 文字・汎用語なし・`articles/` 内で重複なし。
  - 出典ログとの事実整合は下記「事実整合の照合結果」のとおり、確認した全項目で一致。創作の疑いのある記述は検出されなかった。
  - 残る 3 件はいずれも suggestion（公開を止める性質のものではない）。

## 最優先で直すべき指摘（上位3件）

blocker / warning は 0 件。以下は任意対応の suggestion です。

1. [suggestion] 「使ったもの・環境」L31 — 完了条件1 が「Collector と Jaeger がローカルで起動している」と一般化されている。出典ログの原文は「`docker compose ps` で2コンテナが `running`」。L37 で逸脱は開示されているので誤りではないが、L31 を「Collector と Jaeger が Docker Compose で起動している」と原文どおりにすると、L37 の「1 だけ想定と違う形になった」がより明確に読める。
2. [suggestion] 「計装が黙って失敗するのが一番怖かった」L566-607 — この節にスクショがない（無言失敗の証跡が本文ログのみ）。ただし出典ログの `screenshots/` に該当素材が存在せず、**新規作成は捏造になるため文章のみで留めるのが正しい**。将来 `/run-practice` を再実行する機会があれば「トレースが増えていない Jaeger UI」を1枚撮っておくと補強できる。
3. [suggestion] 「まとめ・環境」L627-640 のバージョン一覧 — スクショ取得に使った `playwright 1.61.1` と、使用できなかった `docker 28.5.1 / compose v2.40.3-desktop.1` が落ちている（出典ログ L784-785）。特に Docker は「使えなかった」ことが本文の主要トピックなので、バージョンを併記すると再現条件が締まる。

## 指摘一覧（重大度順）

### blocker

なし。

### warning

なし。

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | L31（使ったもの・環境） | 完了条件1 の表現が出典ログの原文（Docker Compose 前提）より一般化されている | L37 の「1 だけ当初の想定と違う形になった」との対応が明確になり、自己採点の透明性が上がる |
| 2 | L566-607（計装が黙って失敗する節） | 節にスクショがない | 視覚的な証跡が加わる。**ただし素材が存在しないため今回は適用不可**（捏造になる）。次回の実践で取得する運用メモに留めるのが正しい |
| 3 | L627-640（バージョン一覧） | `playwright 1.61.1` / `docker 28.5.1・compose v2.40.3-desktop.1（使用できず）` が未掲載 | 「Docker が使えなかった」話の再現条件が具体化する |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | `published: false` / 秘密情報なし / 実名・個人パスはマスク済み / slug 45文字・重複なし |
| Front Matter | OK | title 55字（誇大表現なし）・emoji 🔭・type tech・topics 5個（全て英小文字） |
| 事実性（ログ照合） | OK | 確認した数値・コマンド・エラー・コード・span 数がすべて出典ログに一致。創作なし |
| 画像 | OK | 5枚すべて実在・alt あり・孤立画像なし（`images/<slug>/` は5ファイルちょうど） |
| Markdown構造 | OK | コードフェンス 78行（偶数）/ `:::` 4行（偶数）/ H1 なし・H2→H3 の階層のみ / リンク4本すべて実在ドメイン、プレースホルダなし |
| 文章品質・トーン | OK | 経験談トーン維持。詰まった点6件を本文に反映。環境（OS/Node/全ライブラリ版）明記。冒頭 L15 に結論あり |
| 完成度 | OK | `要素材` 0件・プレースホルダ 0件・末尾空白 0件・内部メタの前提コメントは削除済み |

## 事実整合の照合結果（ログとの突合）

- **結論**: 記事「トレースは出ました／結果は 2〜5 が満たせて、1 だけ当初の想定（Docker）と違う形になりました」(L15, L37) ↔ ログ「**一部達成**（5項目のうち4項目達成。Docker前提の1項目のみ代替手段で満たした）」(L22) → **一致**
- **創作の疑いがある記述**: 検出なし。以下は個別に突合済み。

| 記事の記述 | ログの裏付け |
|---|---|
| 公式インストールは5パッケージ / 起動は `node --import` / サンプルは `ConsoleSpanExporter`（L43-55） | ログ L49-61 |
| exporter 3種の表・クラス名が全部 `OTLPTraceExporter`（L57-63） | ログ L67-74 |
| Jaeger 公式 docker コマンド全文・`cr.jaegertracing.io`（L67-73） | ログ L79-86 |
| 「Collector を挟む意味」の引用ブロック（L77） | ログ L91-93 の原文どおり |
| `docker compose` が2行で18分停止 / `hello-world` も exit=124 / 401・401・200（L85-100） | ログ L142-164 |
| リリースバイナリ取得コマンド・`otelcol 0.157.0` / `gitVersion v2.20.0` / 3秒・45MB・57MB（L106-118） | ログ L166-177 |
| `curl localhost:16686/api/services` → `{"data":[],"total":0,...}`（L125-126） | ログ L288 |
| 旧設定 YAML 全文（`jaeger:14250`）（L137-155） | ログ L117-135（「意図的に古い書き方」と明記） |
| `unknown type: "jaeger"` エラー全文＋`valid values` 一覧（L161-164） | ログ L191-195 |
| v0.85.0 以降で削除／公式移行ブログ（L167） | ログ L197-198 |
| 8888 bind エラー全文・`lsof` 出力2件（L174-190） | ログ L203-215 |
| receiver 4418 / 内部メトリクス 8889（L194） | ログ L218 |
| gRPC `[::1]:4317` connection refused の warn 全文（L199） | ログ L223 |
| 最終 `otel-collector-config.yaml` 全文（L208-241） | ログ L230-263（コメント含め一致） |
| 起動成功ログ4行・`"otlp" alias is deprecated`（L246-252） | ログ L265-270 |
| `app.js` 全文（L258-278）・3本 curl の応答・`time_total=0.802873`（L280-285） | ログ L318-336, L308-315 |
| `added 195 packages` / `6 high severity vulnerabilities` / `npm ls --depth=0` 5行（L294-304） | ログ L350-358 |
| `instrumentation-express` の `>=4.0.0 <6` grep 出力（L310-318） | ログ L365-372 |
| `instrumentation.js` 全文（L324-341） | ログ L380-397（コメント含め一致） |
| 起動ログ2行・警告なし・`--import` 一発（L343-354） | ログ L411-417 |
| resource 属性11行（`telemetry.sdk.version 2.10.0` 等）（L361-374） | ログ L426-438（`host.name` のみ記事側でマスク、L376 に断り書きあり） |
| HTTP server span 全文（Trace ID `25be211b...`）（L380-403） | ログ L442-464 |
| span 数の表（`/`=4 / `/users`=10 / `/slow`=4）（L409-413） | ログ L466-470 |
| 「12秒ほどかかった」＋誤診しかけた（L428） | ログ L507-509 |
| `{"data":["jaeger","otel-practice-api"],"total":2,...}`（L434） | ログ L510 |
| 手動 span コード（L441-454）・debug ログ全文（`Kind: Internal` / `practice.wait_ms: Int(800)`）（L462-474） | ログ L521-534, L537-549 |
| before/after の traceID 2行（spans=5 / spans=4）（L481-482） | ログ L568-569 |
| 属性はタイムラインに出ず詳細パネル（L491） | ログ L575-576 |
| 直接送信の env 3行・`0.813021s`・total 3・spans=5（L497-506） | ログ L583-591 |
| Collector batches = 2 → 2（変化なし）（L512-513） | ログ L594-597 |
| `/users` の10 span 親子ツリー全文（L523-533） | ログ L679-688 |
| `always_off` 起動コマンド・出力（nosample が出ない）（L546-561） | ログ L648-663 |
| `/v1/trace` / ポート4999 で無言失敗・200・0.81s（L571-582） | ログ L605-624 |
| `OTEL_LOG_LEVEL=debug` の ECONNREFUSED 抜粋・出力387行（L589-600） | ログ L627-637 |
| バージョン一覧（L628-639） | ログ L772-783（playwright / docker の2行のみ記事で省略） |
| 最短の再現手順（L645-667） | ログ L789-811（一致） |
| ハマりどころのメモ6項目（L672-677） | ログ L814-826 |

- **記事がログを超えている記述**: 検出なし。「10〜15秒待つ」(L604) はログの実測12秒・注意点「10秒ほど待つ」(L821) の範囲内で、幅を持たせた表現として妥当。
- **残存する `要素材` マーカー**: 0 件
- **記事に持ち込まれていない内部メタ**: 実行者（AIエージェント単独）・実測37分・出典レポート名・コンテスト関連は、ログ側で「記事に転記しない」とされているとおり本文に出ていない。**適切**。

## 機械チェック結果（scripts/check-article.sh）

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

### false positive の切り分け

- **L367 `[user-path]` WARN → false positive**。該当行は
  `-> process.command_args: Slice(["/Users/.../bin/node","--import","./instrumentation.js",".../app.js"])`
  で、ユーザー名部分は既に `...` にマスク済み。スクリプトは `/Users/` の文字列だけで検出しているため反応している。
  併せて `grep -n "katayama\|MacBook"` を実行し **0 件**（実名の残存なし）を確認したうえで、重大度を
  「指摘なし」に切り下げた。なお L376 に「`host.name` と `process.command_args` は実際の値をこの記事用に伏せています」
  という断り書きがあり、引用の改変が読者に開示されている点も適切。

## 適用した修正

なし（レポートのみ・記事本文は未変更）。

## 補足: 公開前に確認しておくとよいこと（記事の外の話）

- 出典ログ `logs/run-opentelemetry-20260726-2317/execution-log.md` L428 には実名入りマシン名が残っている（記事側はマスク済み）。ログは untracked かつ非公開想定なので現時点で公開リスクはないが、`logs/` をコミット・公開する運用に変える場合は同様のマスクが必要。**`/publish-pr` は記事＋`images/<slug>/` のみをコミットする仕様なので、既定の手順で公開する限り問題は起きない。**
- 出典ログ L766「コンテストの参加条件・タグの確認は未実施」。Zenn のコンテストに応募する意図がある場合は、募集ページで指定タグ（`topics`）の要件を公開前に確認すること。現在の topics は `["opentelemetry", "jaeger", "nodejs", "express", "observability"]`。

## 次のアクション

- [x] blocker / warning は 0 件（対応不要）
- [ ] suggestion 1・3 は任意対応（対応する場合は `/revise-article` → 再レビュー）
- [ ] `/publish-pr articles/opentelemetry-js-collector-jaeger-first-trace.md` で公開準備する
      （feature ブランチで `published: true` に変え、記事＋画像をコミットして PR 作成。
       main へのマージ＝公開）
- [ ] 公開時に「サイト内で既に使用されています」が出たら slug を具体化
      （`knowledge/2026-07-01-zenn-slug-already-used.md`）
