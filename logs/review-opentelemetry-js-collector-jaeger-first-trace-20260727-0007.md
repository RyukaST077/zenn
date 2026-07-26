# 公開前レビュー: OpenTelemetryを初めて計装して、ローカルのCollector＋Jaegerでトレースを1本見るまで / opentelemetry-js-collector-jaeger-first-trace

## レビューの前提

- 対象記事: `articles/opentelemetry-js-collector-jaeger-first-trace.md`（引数で明示）
- 出典ログ: `logs/run-opentelemetry-20260726-2317/execution-log.md`（引数で明示）
- レビュー日時: 2026-07-27 00:07
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準

## 判定

**判定: 公開不可（blocker 1件）**

- blocker: 1 件 / warning: 2 件 / suggestion: 4 件
- 根拠（判定を決めた主な指摘）:
  - blocker-1: L363 の `host.name: Str(katayamaryuunosukes-MacBook-Pro.local)` に筆者の実名を含むマシン名が入っている（個人情報の公開）
  - warning-1: サンプラー節（L541-552）の証跡に、本文で一度も出てこない `nosample` が現れる
  - warning-2: 最初の Collector 設定（L148）が Docker 前提の `endpoint: jaeger:14250` のままで、リリースバイナリ構成に切り替えた文脈と噛み合わない

事実整合（ログ照合）は良好で、記事の主張・コマンド・エラー・数値はほぼすべて出典ログに裏付けがあった。
blocker は事実性ではなく公開安全（個人情報）1点のみ。ここを潰せば warning 2件の修正で公開可に届く。

## 最優先で直すべき指摘（上位3件）

1. [blocker] L363（「auto-instrumentation だけで何が見えたか」の resource 属性ブロック） —
   `-> host.name: Str(katayamaryuunosukes-MacBook-Pro.local)` を
   `-> host.name: Str(<マシン名>.local)` に伏せる（同ブロックの `process.command_args` は既に `/Users/.../` へマスク済みなので、それと同じ方針に揃える）。
   なお `host.name` が自動で付くこと自体は記事の見どころなので、行を消すのではなく値だけ伏せて、
   「マシン名やプロセス引数まで勝手に付くので、外部に送るなら resource 属性は確認したほうがよさそう」の1文を添えると読者価値がむしろ上がる。
2. [warning] L541-552（「サンプリングを 0% にする」） — 起動コマンドに
   `OTEL_SERVICE_NAME=otel-practice-nosample \` を追記する。
   現状は起動コマンドが `OTEL_TRACES_SAMPLER=always_off` だけなのに、出力側のコメントが
   「（nosample は出てこない）」となっており、`nosample` が何を指すか読者に分からない。
   出典ログ L646-651 のコマンドどおりに直せば整合する。
3. [warning] L139-157（「`jaeger` exporter はもう無かった」の最初の設定） — `endpoint: jaeger:14250` の直前か直後に
   「この時点では Docker Compose 前提だったので、送り先はサービス名 `jaeger` のまま」の1文を入れる。
   記事はこの節より前（L106）で「Docker は諦めてリリースバイナリ」に切り替えているため、
   ホストで動かしているのに Docker のサービス名が出てきて読者が混乱する。

## 指摘一覧（重大度順）

### blocker

| # | 箇所（節/行） | 指摘 | 具体的な直し方 | 根拠 |
|---|---|---|---|---|
| 1 | L363 / 「auto-instrumentation だけで何が見えたか」 | `host.name: Str(katayamaryuunosukes-MacBook-Pro.local)` が筆者の実名を含むローカルマシン名。公開すると個人が特定できる | 値を `Str(<マシン名>.local)` 等に伏せる。同ブロック L367 の `process.command_args` は既に `/Users/.../` にマスクされており、方針を揃えるだけでよい | チェックリスト「公開安全: 個人情報が無い」。出典ログ L428 にも同じ値があるが、ログは非公開・記事は公開なので記事側でマスクが必要 |

### warning

| # | 箇所 | 指摘 | 具体的な直し方 | 根拠 |
|---|---|---|---|---|
| 1 | L541-552 / 「サンプリングを 0% にする」 | 出力に `(nosample は出てこない)` とあるが、`nosample` という語が本文・コマンドのどこにも出ていないため証跡が読めない | 起動コマンド（L541 の説明文の下）に `OTEL_SERVICE_NAME=otel-practice-nosample` を含む形でコードブロックを置く。出典ログ L646-651 のコマンドをそのまま採用する | 出典ログ L646-651（実際は `OTEL_SERVICE_NAME=otel-practice-nosample` を付けて起動している） |
| 2 | L139-157 / 「`jaeger` exporter はもう無かった」 | 最初の設定が `endpoint: jaeger:14250`（Docker のサービス名）。直前の節でホスト直起動に切り替えた記述があるため矛盾して見え、そのまま真似すると別の理由で失敗する | L137 の「参考にした手順のとおりに `jaeger` exporter で書きました」に「（送り先も Docker Compose 前提のサービス名 `jaeger` のまま）」を足す。あわせて L173 の修正説明で「ホスト起動なので送り先も実アドレスに変える」と繋げる | 出典ログ L115-135（この設定は Docker 構成時に書いたもの＝「意図的に古い書き方」） |

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | L9 | 内部メタの前提コメント `<!-- 前提: 出典ログ ... -->` が残っている | 公開記事に内部パイプラインの痕跡を残さない。消しても本文に影響しない |
| 2 | L165 / L246 など | Collector のエラー・warn 引用で `{...}` に省略した箇所が複数あり、どこを省いたのかの断りがない | 「（resource 部分は省略）」の一言があると、引用の改変が意図的だと読者に伝わる |
| 3 | L296 | `6 high severity vulnerabilities` を出力に含めているが本文で触れていない | 「自動計装を入れると依存が195増え、監査警告もその分付いてくる」の1文を足すと、貼った出力が本文と繋がる |
| 4 | 「計装が黙って失敗するのが一番怖かった」節（L557-598） | この節にだけスクショがない（他の主要節は全て画像あり） | 200 が返っている curl 出力や UI 側でトレースが増えていない画面が1枚あると「無言で失敗」の説得力が上がる。ただし出典ログにその素材は無いため、**新規にスクショを作るのは不可**（捏造になる）。文章のみで留めるのが正しく、あくまで将来の検証時のメモ |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | NG | published:false / slug は問題なし。個人マシン名 1件が blocker |
| Front Matter | OK | title 55字・type tech・topics 5個・emoji 🔭・published false すべて妥当 |
| 事実性（ログ照合） | OK | 主張・コマンド・エラー全文・数値・span 数・スクショ内容がすべてログに一致（下記照合結果） |
| 画像 | OK | 5枚すべて `images/<slug>/` に実在。全画像に説明的な alt あり。孤立画像なし |
| Markdown構造 | OK | フェンス76行（偶数）/ `:::` 4行（偶数）/ H1 なし・H2→H3 の階層も正常。リンクは実在の公式ドキュメント4本 |
| 文章品質・トーン | 要修正 | 経験談トーン・詰まった点・環境明記は十分。warning 1・2 の可読性のみ |
| 完成度 | 要修正 | プレースホルダ・`要素材` 残存なし。前提コメントの消し忘れのみ（suggestion 1） |

## 事実整合の照合結果（ログとの突合）

- 結論（達成/一部/未達）: 記事「結果は 2〜5 が満たせて、1 だけ当初の想定（Docker）と違う形になりました」（L39）
  ↔ ログ「**一部達成**（5項目のうち4項目達成。Docker前提の1項目のみ代替手段で満たした）」（L22）→ **一致**
- 主要な数値の裏付け（すべて一致）:
  - Docker Pull が 18 分停止 → ログ L142「これ以降18分間まったく進まない」
  - `hello-world` も exit=124 / registry 401 / github 200 → ログ L150-163
  - リリースバイナリのダウンロード各3秒・otelcol 45MB / jaeger 57MB → ログ L176
  - span 数の表（`/`=4 / `/users`=10 / `/slow`=4）→ ログ L466-470
  - 手動 span 前後 4 → 5、traceID `c355eea7...` / `c2d67d8e...` → ログ L568-569
  - `/users` の 10 span の親子関係（spanID まで一致）→ ログ L679-688
  - サービス名が出るまで約12秒 → ログ L507-508
  - `OTEL_LOG_LEVEL=debug` の出力 387 行 → ログ L637
  - 直接送信 `0.813021s` / batches 2→2 で変化なし → ログ L589-596
  - バージョン一覧（node v22.17.0 / express 5.2.1 / otelcol 0.157.0 / jaeger v2.20.0 / telemetry.sdk 2.10.0 等）→ ログ L770-786
- エラー全文の引用（`unknown type: "jaeger"` / `bind: address already in use` / `Addr: "[::1]:4317"`）は
  ログ L191-193・L203-207・L223 と逐語一致。**創作は検出されず**。
- コード（`app.js` / `instrumentation.js` / 手動 span / 最終 `otel-collector-config.yaml`）は
  ログ L318-336・L380-396・L521-534・L230-263 の workspace 由来。**創作コードなし**。
- スクショ 4枚の記述内容（Total Spans 4 / Depth 4 / 802ms、Total Spans 5 / Depth 5、`/api/services` が空、10 span）は
  ログのスクショ一覧 L731-735 の説明と一致。
- ログにあって記事が**正しく落としている**もの（望ましい判断）: AI 単独の実測所要時間（約37分）、
  実行者がAIエージェントである旨、コンテスト関連の記述。記事は作業時間を数値で断定しておらず適切。
- 記事がログを超えた断定: 検出されず。「〜だろうな」「想像がつきました」等、未検証部分は推測として明示されている。
- 残存する `要素材` マーカー: 0 件

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
[PASS] コードフェンスが閉じている: フェンス行=76
[PASS] ::: ブロックが閉じている: 4 行
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[WARN] 秘密情報の疑い [user-path] (散文か目視確認) at line 367
SUMMARY fail=0 warn=1
```

機械チェックの切り分け:

- L367 の `user-path` 検出は **false positive**。`Slice(["/Users/.../bin/node",...])` と既にマスク済みのため重大度を下げた。
- 一方、機械チェックが**拾えていない** L363 の `host.name`（実名入りマシン名）を目視で検出し blocker とした。
  秘密情報パターンにホスト名 `*-MacBook-Pro.local` が含まれていないため。スクリプト側の検出パターン追加は別途検討の余地あり。
- slug 重複: `articles/` 内に同名・類似 slug なし（`opentelemetry` を含むファイルは本記事のみ）。
- 末尾空白: 0 件。

## 適用した修正

なし（レポートのみの非破壊レビュー。`published: false` は維持）。

## 次のアクション

- [ ] blocker 1件（L363 の `host.name` マスク）を直す ← これが公開の必須条件
- [ ] warning 2件（`nosample` の起動コマンド追記 / `jaeger:14250` の文脈補足）を直す
- [ ] suggestion（L9 の前提コメント削除ほか）を任意で反映する
- [ ] 直したら `/review-article` で再レビューする（`/revise-article` で自動修正も可）
- [ ] 判定が「公開可」になったら Front Matter を `published: true` に変えて `git push`
      （「サイト内で既に使用されています」が出たら slug を具体化。
       `knowledge/2026-07-01-zenn-slug-already-used.md`）
