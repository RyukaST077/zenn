# 実践タスク: Node 26のTemporalを既定で触り、Dateと同じ処理を書き比べて詰まる

## このタスクの前提

- 出典レポート: `research/search-topic-20260714-1511.md`
- 元テーマ: テーマ1「Node 26のTemporalを既定で触り、Dateと同じ処理を書き比べて詰まる」（レポートの「最初に試すべき1本」）
- 対象技術: Node.js 26（`Temporal` API・既定有効） / 比較対象は組み込みの `Date`
- 記事の方向性（記事タイプ）: 試してみた / 検証ログ / 詰まった点まとめ
- 想定筆者 / 想定読者: Web系の新人エンジニア / 新人〜実務2年目
- 検証に使える想定時間: 半日（約3〜4時間）
- 判断方針: 引数で対象レポートのみ指定。テーマ・時間・スキルレベルは無指定のためデフォルト前提を採用（テーマはレポート推奨1本、時間は半日、想定筆者は新人）
- 実行環境の担保: `node` スクリプト実行のみで完結する。サーバ・ブラウザ・課金・認証は一切不要。完了確認は CLI の標準出力（実行ログ）で判定でき、AIエージェント単独で最後まで実行・検証できる。ブラウザ確認が無いため Playwright も不要。

> ⚠️ 実行前提の注意（run-practice へ申し送り）: このマシンのローカル Node は現状 `v22.17.0`。**Temporal は Node 26 以降でないと既定有効にならない**（v22 では `Temporal is not defined` になる）。フェーズ2で必ず Node 26 を用意してから本編に入ること。用意できない場合の撤退ラインは「想定リスク」に記載。

## 完成イメージ（成果物）

- 作るもの: `Date` 版と `Temporal` 版で同じ日時処理を書いた検証用スクリプト一式（`.mjs`）と、その実行ログ。中心は「月末＋1か月」「タイムゾーン跨ぎ変換」「差分(Duration)」「Date⇔Temporal相互変換」の4点の書き比べ。
- 「できた」と言える完了条件:
  1. Node 26 で `node -e "console.log(typeof Temporal)"` が `object` を返す（既定有効を確認）
  2. `01-date.mjs`（Date版）と `02-temporal.mjs`（Temporal版）が両方エラーなく実行でき、標準出力に対比できる結果が出る
  3. 「Jan 31 に1か月足す」で **Date は3月に転がり、Temporal は2月末にクランプする**差が実行ログで確認できる
  4. 詰まった点（メソッド名・不変性・TZ必須・RangeError等）が最低3件、記録テンプレに埋まっている
- 完了確認の方法: すべて CLI 標準出力（実行ログ）。ブラウザ不要のため Playwright スクショは対象外。
- 記事タイトル案（そのまま使える形）:
  1. Node 26でTemporalが既定になったので、Dateと同じ処理を書き比べてみた
  2. 「月末＋1か月」でDateが壊れる問題をNode 26のTemporalで確かめてみた
  3. 新人がNode 26のTemporalを触って、Dateとの違いに詰まった点まとめ

## 事前準備チェックリスト

- [ ] 認証・APIキー: 不要（完全ローカル・組み込みAPIのみ。トークン不要）
- [ ] ローカル環境（言語・ランタイム・バージョン）: Node.js **26系**（`node --version` が `v26.x`）。現状 v22 のため要アップデート
- [ ] インストールするもの: なし（`Temporal` は Node 26 で標準・追加パッケージ不要。※どうしても26を用意できない場合のみ `temporal-polyfill` 等を検討＝ただし本記事の趣旨は「既定有効」なので極力実機で）
- [ ] 無料枠 / コストの確認: コストなし（ランタイム同梱機能のみ）
- [ ] 記録用の準備（リポジトリ・スクショ・ログの置き場）: 作業ディレクトリ（例 `tmp/temporal-try/`）に `01-date.mjs` 〜 `05-convert.mjs` と `run.log`（実行結果貼り付け用）を用意

## 実践タスク（フェーズ別）

### フェーズ1: 事前調査（目安: 30分）

- [ ] Node 26 リリースノートで Temporal が既定有効・追加された V8 API を確認する（目安: 15分）
  - 記録すること: 「Temporal は Node 26 で既定有効（PR #61806）」「V8 は 14.6.202.33 / Chromium 146」という一次情報の出典URLと日付。フラグが不要である旨のメモ。
- [ ] Temporal の主要型と「今回使うAPI」を洗い出す（目安: 15分）
  - 記録すること: `Temporal.Now` / `PlainDate` / `PlainDateTime` / `ZonedDateTime` / `Instant` / `Duration` の役割を1行ずつ。今回触る `PlainDate.from` / `.add({months:1})` / `Instant.fromEpochMilliseconds` / `.toZonedDateTimeISO()` / `.since()` を一覧化。「調べる前に予想していた使い方」との差もメモ（記事の"詰まり"素材）。

### フェーズ2: 環境構築（目安: 45分）

- [ ] Node 26 を用意して切り替える（目安: 30分）
  - 記録すること: 使ったバージョン管理ツール（nvm / fnm / volta 等）と実行コマンド全文。`nvm install 26 && nvm use 26` などの出力。切り替え前の `v22.17.0` → 切り替え後の `v26.x` の対比。**インストール／切り替えで詰まった点は全文で残す**。
- [ ] Temporal が既定で使えることを確認する（目安: 5分）
  - 記録すること: `node -e "console.log(typeof Temporal, Temporal.Now.plainDateTimeISO().toString())"` の出力。`object` と現在時刻ISO文字列が出れば成功。v22 で同じコマンドを打った場合の `ReferenceError: Temporal is not defined` も（比較のため）記録すると記事が締まる。
- [ ] 作業ディレクトリと空スクリプトを作る（目安: 10分）
  - 記録すること: 作成したファイル構成。`type: module` を使うか `.mjs` にするか（`import` は不要だが ESM/CJS の書き味メモ）。最初の `console.log` が通ったことを確認。

### フェーズ3: 実装・検証【本編】（目安: 120分）

- [ ] `01-date.mjs`：`Date` で「Jan 31 に1か月加算」を書き、壊れ方をログする（目安: 25分）
  - 記録すること: `const d = new Date('2026-01-31T00:00:00Z'); d.setMonth(d.getMonth()+1); console.log(d.toISOString())` 系のコード全文と出力。**3月にロールオーバーする**結果（例: `2026-03-03`）をそのまま貼る。`setMonth` が元オブジェクトを破壊的に書き換える点（可変性）に気づいたらメモ。
- [ ] `02-temporal.mjs`：同じ加算を `PlainDate.add({months:1})` で書き、クランプを確認する（目安: 25分）
  - 記録すること: `Temporal.PlainDate.from('2026-01-31').add({months:1}).toString()` の出力（`2026-02-28`）。Date版との差分を並べて記録。`overflow:'reject'` を付けると `RangeError` になることも試して出力を残す（詰まり素材）。元の `PlainDate` が変化しない（不変）ことの確認ログ。
- [ ] `03-tz.mjs`：タイムゾーン跨ぎ変換を Date 版 / Temporal 版で書き比べる（目安: 30分）
  - 記録すること: Date 版（`toLocaleString('en-US',{timeZone:'America/New_York'})` など）と Temporal 版（`ZonedDateTime` / `Instant.toZonedDateTimeISO('America/New_York')`）のコードと出力。「Date だと文字列変換に頼るしかない／Temporal は型として TZ を持てる」差を1〜2行で言語化。`PlainDateTime` から TZ 無しで `toZonedDateTime()` を呼んで `RangeError` になる詰まりも記録。
- [ ] `04-diff.mjs`：2日付の差分を Date（ミリ秒引き算）と Temporal（`since`/`Duration`）で出す（目安: 20分）
  - 記録すること: Date 版の `(a - b) / 86400000` と、Temporal 版 `a.since(b, {largestUnit:'day'})` の出力比較。`Duration` が `days`/`hours` 等の構造を持つこと、`largestUnit` を指定しないと単位が小さく出る挙動を記録。
- [ ] `05-convert.mjs`：`Date` ⇔ `Temporal` 相互変換を確認する（目安: 20分）
  - 記録すること: `Temporal.Instant.fromEpochMilliseconds(new Date().getTime())` と、逆向き `new Date(instant.epochMilliseconds)` のコード・出力。`Date` には `toTemporalInstant()` が生えているか（環境依存・要確認）を実際に叩いて結果を記録。相互変換で「型がどこで切り替わるか」を1行メモ。

### フェーズ4: 深掘り・比較（目安: 30分）

- [ ] Date と Temporal で同じ4処理を並べた比較表を作る（目安: 20分）
  - 記録すること: 「月末加算 / TZ変換 / 差分 / 相互変換」の4行 ×「Date のコードと落とし穴／Temporal のコードと挙動」列の表。各セルは実行ログの事実に基づいて埋める（推測で埋めない）。
- [ ] 追加で1つだけ「予想外だった挙動」を掘る（目安: 10分）
  - 記録すること: 例）`overflow` の既定が `constrain` であること、`RangeError` の閾値、`Temporal.Now.timeZoneId()` の戻り、など実際に叩いて確認した1件。記事の「へぇ」ポイントとして1段落分の素材にする。

### フェーズ5: 振り返り・記事化準備（目安: 30分）

- [ ] 記録テンプレを見返して詰まった点を棚卸しする（目安: 15分）
  - 記録すること: 詰まりポイント表の3件が実測で裏付けられているか確認。見積もり時間と実測の差もまとめる。
- [ ] 「記事への写像」に沿って本文ドラフトの見出しを埋める（目安: 15分）
  - 記録すること: 各見出しに流し込む素材（コード/ログ/表）が揃っているか、欠けている見出しがないかをチェック。

> 目安時間の合計: 約 4 時間 15 分（フェーズ1:30 + 2:45 + 3:120 + 4:30 + 5:30）。半日枠にほぼ収まる。オーバー気味なら深掘り(フェーズ4)を短縮する。

## 詰まりそうなポイントと対処の指針

| # | 詰まりそうな点 | なぜ起きるか | 最初に試すこと | 記事での活かし方 |
|---|---|---|---|---|
| 1 | `Temporal is not defined` になる | ローカルが Node 26 未満（このマシンは v22.17.0）。Temporal は26で既定有効 | `node --version` で確認 → nvm/fnm で 26 に切替 → `node -e "typeof Temporal"` | 「まず26じゃないと始まらない」導入。v22での失敗ログをそのまま冒頭に置くと臨場感が出る |
| 2 | 「1か月加算」の結果がDateとTemporalで食い違って驚く | Date の `setMonth` は溢れた日を翌月に転がす。Temporal は既定 `overflow:'constrain'` で月末にクランプ | 同じ入力（Jan 31）で両方を実行し出力を並べる。`overflow:'reject'` も試す | 記事の主役。「Dateが壊れる」具体例として最も刺さる。表とログを対比で見せる |
| 3 | Temporal で「メソッドが無い/引数が違う」で手が止まる | 型が細かく分かれ（PlainDate/ZonedDateTime/Instant）、可変ではなく毎回新インスタンスを返す。TZ変換にはTZ必須 | エラーメッセージ全文を読む → MDNで対象型のメソッドを確認 → `.add()`は破壊しないので戻り値を受け取る | 「Dateの感覚で書くと詰まる」あるある集。不変性・TZ必須・RangeErrorを箇条書きにできる |
| 4 | 相互変換で「どの型に変換すべきか」迷う | `Date`↔`Instant`はepochミリ秒経由、TZ付きにするには `ZonedDateTime` が要る、と経路が複数ある | `Instant.fromEpochMilliseconds` / `new Date(instant.epochMilliseconds)` の最小往復から試す | 「既存Date資産との橋渡し」節に。共存前提（Dateを捨てない）を示せる |

## 記録テンプレ（実行中に埋める）

各タスクを実行しながら、以下を都度メモする。これがそのまま経験談の一次情報になる。

- 実行したコマンド:
- 出たエラー（全文）:
- 効いた解決方法 / 試したこと:
- 所要時間（見積もり → 実測）:
- つまずいた理由・分かっていなかった前提:
- 既存技術（Date）と比べて感じた違い:
- 標準出力を残した箇所（run.log の該当行）:
- 記事に書きたい気づき:

## 記録テンプレ（4つの検証ごとのミニ表・任意）

| 検証 | Dateの結果 | Temporalの結果 | 気づき |
|---|---|---|---|
| 月末＋1か月（Jan 31） |  |  |  |
| TZ跨ぎ変換 |  |  |  |
| 差分(Duration) |  |  |  |
| 相互変換 |  |  |  |

## 記事への写像（タスク → 見出し）

出典レポートの記事構成案（1.はじめに 2.なぜTemporalを試すのか 3.事前に調べたこと 4.環境 5.Dateで書いた処理 6.Temporalで書き直し 7.詰まった点 8.Dateと比べて分かったこと 9.どんな人に向くか 10.まとめ）に対応させる。

| 記事の見出し | 対応するタスク / 記録 | 書くこと |
|---|---|---|
| 1. はじめに | 前提・動機 | 新人がNode 26でTemporalを試す動機。Dateの日時計算で困った経験 |
| 2. なぜTemporalを試すのか | フェーズ1 | Node 26で既定有効になった話題性。Dateの落とし穴の普遍性 |
| 3. 事前に調べたこと | フェーズ1の記録 | 既定有効（PR #61806）・型一覧・今回使うAPI。公式リンク |
| 4. 環境 | フェーズ2の記録 | Node 26への切替手順、`typeof Temporal`確認ログ、v22での失敗 |
| 5. Dateで書いた処理 | フェーズ3 `01`/`03`/`04`/`05` Date版 | Dateのコードと出力。setMonthの破壊性・ロールオーバー |
| 6. Temporalで書き直し | フェーズ3 `02`〜`05` Temporal版 | 同処理のTemporalコードと出力。不変・クランプ・TZ必須 |
| 7. 詰まった点 | 詰まりポイント表・記録テンプレ | エラー全文と解決。メソッド名/不変性/RangeError |
| 8. Dateと比べて分かったこと | フェーズ4の比較表 | 4処理の対比表。どこがラクでどこが面倒か |
| 9. どんな人に向くか | フェーズ5の棚卸し | 新人が今から触る価値・共存前提の注意 |
| 10. まとめ | フェーズ5 | 学んだこと・次に試すこと（Duration/PlainYearMonth等） |

## 経験談として書くときのコツ

- 「新人が試した範囲」を明示し、専門家として断定しすぎない（「Dateはもう不要」はNG。共存前提）
- うまくいった点だけでなく、詰まった点（v22での失敗・RangeError・TZ必須）と解決過程を書く
- 実行ログ・コードをそのまま貼る（出力は要約せず全文）
- 公式ドキュメント（nodejs.org v26.0.0）とMDN Temporalへのリンクを入れる
- 手順の再現性（Node 26系・OS・切替ツール）を明記する

## 参考リンク

- 公式ドキュメント: Node.js v26.0.0 リリースノート https://nodejs.org/en/blog/release/v26.0.0 （Temporal既定有効=PR #61806 / V8 14.6.202.33 を確認済み）
- 公式ドキュメント: MDN `Temporal` https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal （型一覧・add・相互変換・RangeError・不変性を確認済み）
- 関連記事: InfoQ「Node.js 26 Temporal API Enabled by Default」 https://www.infoq.com/news/2026/07/nodejs-26-temporal/
- ポリフィル（26を用意できない場合の保険・要検討）: https://www.npmjs.com/package/temporal-polyfill

## 想定リスク・注意点

- コスト（無料枠の範囲・課金トリガー）: なし。ランタイム同梱機能のみで完全無料。
- ライセンス / 規約: Node.js（MIT系）。特別な制約なし。
- セキュリティ（APIキーの扱い等）: APIキー・秘密情報を扱わない。ログ貼付け時も秘匿情報なし。
- 撤退ライン（ここまで詰まったら別アプローチに切り替える）:
  - Node 26 の用意・切替が30分で終わらない場合 → `npx -y node@26 ...` 等の一時実行やDockerの `node:26` イメージでの実行を試す。それでも不可なら出典レポートの次候補（テーマ4「V8 14.6 Map.getOrInsert」＝同じくNode 26同梱・完全ローカル）へ切替。
  - Temporal が想定通り動かない（未対応/バージョン差）場合は、結果を推測で埋めず「対応状況を確認した事実」を記録して該当検証のみスキップする。

## 次のアクション

- [ ] フェーズ1から順に着手する
- [ ] 記録テンプレを埋めながら進める
- [ ] 完了条件を満たしたら「記事への写像」に沿って本文ドラフトへ展開する（`/run-practice` → `/draft-article`）
