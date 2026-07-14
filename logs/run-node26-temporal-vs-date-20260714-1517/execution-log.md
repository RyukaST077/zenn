# 検証ログ: Node 26のTemporalを既定で触り、Dateと同じ処理を書き比べて詰まる

> Zenn記事の素材。実行の一次情報（コマンド・エラー全文・所要時間）を記録。
> 記事本文は未執筆。「記事への写像」を見て articles/*.md に展開する。
> 完了確認は CLI 標準出力のみ（ブラウザ不要のため Playwright スクショは対象外）。

## 実行の前提（採用した前提）

- 対象タスク: `practice/practice-node26-temporal-vs-date-20260714-1514.md`
- 出典レポート: `research/search-topic-20260714-1511.md`
- 対象技術: Node.js 26 の `Temporal` API（既定有効） / 比較対象は組み込み `Date`
- 実行者: AIエージェント単独（非対話） <!-- 内部メタ: 記事に転記しない -->
- 実行日時 / 所要時間: 2026-07-14 15:17〜15:20 / 見積もり 約4h → 実測 約0.3h <!-- 実測はAI単独の値。記事にそのまま書かない -->
- 実行環境: macOS（Darwin 25.5.0）/ Node v26.5.0（V8 14.6.202.34-node.24, npm 11.17.0） / 切替前 Node v22.17.0 / バージョン管理 nvm
- 採用した撤退ライン: 対象タスクの想定リスク準拠（Node26切替が30分で終わらなければ `npx node@26`/Docker `node:26`、それも不可なら次候補へ）。今回は nvm に v26.5.0 が導入済みで撤退不要。
- 判断方針: 引数で対象タスクファイルのみ指定。時間・撤退ラインは対象ファイルの前提を採用（デフォルト）。

## 結果サマリー

- 完了条件の判定: **達成**（4条件すべて客観ログで確認。詳細は下表）
- 作ったもの: Date版/Temporal版の書き比べスクリプト6本（`workspace/01-date.mjs`〜`06-extra.mjs`）と実行ログ（`commands.log`）
- スクショ: 0 枚（ブラウザ表示なし。CLI標準出力で完了確認するタスクのため対象外）
- 詰まった点: 5 件（うち解決 5 / 未解決・撤退 0）
- knowledge 記録: `knowledge/2026-07-14-temporal-duration-total-week-needs-relativeto.md`（新規1件）

## 完了条件の検証

対象タスクの「できたと言える完了条件」を1つずつ客観的に検証した結果。

| # | 完了条件 | 判定 | 根拠（ログ） |
|---|---|---|---|
| 1 | Node 26 で `typeof Temporal` が `object` | 達成 | commands.log「Phase2: switch to Node 26」→ `object 2026-07-14T15:17:48...` |
| 2 | `01-date.mjs`/`02-temporal.mjs` が両方エラーなく実行、対比結果が出る | 達成 | commands.log の 01/02 実行ブロック（両方 exit=0） |
| 3 | Jan 31 +1か月で **Date は3月に転がり / Temporal は2月末にクランプ** | 達成 | 01: `2026-03-03` / 02: `2026-02-28` |
| 4 | 詰まった点が最低3件、記録テンプレに埋まっている | 達成 | 「詰まった点と解決過程」表に5件記録 |

## タスク実行ログ（フェーズ別）

### フェーズ1: 事前調査

- [x] Node 26 で Temporal が既定有効・V8 バージョンを確認（見積もり 15分 → 実測 実行時に併せて確認）
  - 実行したコマンド:
    ```bash
    node -p "process.versions.v8"   # Node v26.5.0 で
    ```
  - 出力:
    ```
    14.6.202.34-node.24
    ```
  - 一次情報メモ: Temporal は Node 26 で既定有効（フラグ不要）。V8 は実機で **14.6.202.34-node.24**。
    出典レポート/リリースノートの記載は「V8 14.6.202.33」だったが、実機の 26.5.0 では末尾が `.34-node.24` 
    だった（パッチ差）。**記事には実機で観測した値を書く**。
  - 出典URL（レポートから引き継ぎ・記事に載せる）: Node.js v26.0.0 リリースノート
    https://nodejs.org/en/blog/release/v26.0.0 、MDN Temporal
    https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal
  - 記事に書きたい気づき: 「既定有効=フラグ不要」を実際に `typeof Temporal === 'object'` で確認できた。

- [x] Temporal の主要型と今回使うAPIを洗い出す（見積もり 15分）
  - 使った型: `Temporal.Now`（現在時刻）/ `PlainDate`（暦日）/ `PlainDateTime`（TZなし日時）/
    `ZonedDateTime`（TZ付き日時）/ `Instant`（絶対時刻=epoch）/ `Duration`（期間）。
  - 今回触ったAPI: `PlainDate.from` / `.add({months:1})` / `Instant.from` /
    `Instant.fromEpochMilliseconds` / `.toZonedDateTimeISO()` / `.since()` / `Duration.total()` /
    `Date.prototype.toTemporalInstant()`。
  - 予想との差: 「Date のように1つの型で済む」と予想していたが、TZの有無・絶対/暦で型が分かれる。

### フェーズ2: 環境構築

- [x] Node 26 を用意して切り替える（見積もり 30分 → 実測 <5分）
  - 実行したコマンド:
    ```bash
    nvm ls                 # v26.5.0 が導入済みだった
    nvm use 26
    node --version
    ```
  - 出力（全文）:
    ```
    Now using node v26.5.0 (npm v11.17.0)
    v26.5.0
    ```
  - つまずいた理由・分かっていなかった前提: タスクは「v22 のため要アップデート」を警告していたが、
    実機の nvm には既に v26.5.0 が入っており切替のみで済んだ（`nvm install` 不要）。撤退ライン発動なし。

- [x] Temporal が既定で使えることを確認（見積もり 5分）
  - 実行したコマンド:
    ```bash
    # v22（切替前）
    node -e "console.log(typeof Temporal)"                       # → undefined（例外にはならない）
    node -e "console.log(Temporal.Now.plainDateTimeISO().toString())"  # → ReferenceError
    # v26（切替後）
    node -e "console.log(typeof Temporal, Temporal.Now.plainDateTimeISO().toString())"
    ```
  - 出力 / エラー（全文）:
    ```
    # v22.17.0
    $ node -e "console.log(typeof Temporal)"
    undefined
    exit=0

    $ node -e "console.log(Temporal.Now.plainDateTimeISO().toString())"
    [eval]:1
    console.log(Temporal.Now.plainDateTimeISO().toString())
                ^
    ReferenceError: Temporal is not defined
        at [eval]:1:13
        ...
    Node.js v22.17.0
    exit=1

    # v26.5.0
    object 2026-07-14T15:17:48.449033936
    exit=0
    ```
  - つまずいた理由: タスクは「v22 では `typeof Temporal` が `ReferenceError` になる」と予想していたが、
    **実際は `undefined` が返って落ちない**。`typeof` は未定義識別子に対して例外を投げない JS の仕様。
    ReferenceError を出したいなら `Temporal.Now...` のように**直接参照**する必要がある。
  - 記事に書きたい気づき: 「v22 では Temporal is not defined」を臨場感で見せるなら、`typeof` ではなく
    `Temporal.Now.plainDateTimeISO()` を直接叩くコマンドを冒頭に置くとよい（予想と実挙動のズレも小ネタ）。

- [x] 作業ディレクトリと空スクリプトを作る（見積もり 10分）
  - `logs/run-node26-temporal-vs-date-20260714-1517/workspace/` に `01`〜`06` の `.mjs` を作成。
  - ESM/CJS メモ: Temporal はグローバルなので `import` 不要。拡張子 `.mjs` にしたが `import` は書いていない
    （今回は ESM/CJS どちらでも同じ）。

### フェーズ3: 実装・検証【本編】

- [x] `01-date.mjs`：Date で「Jan 31 に1か月加算」→ 壊れ方（見積もり 25分 → 実測 数分）
  - 実行したコマンド:
    ```bash
    node workspace/01-date.mjs
    ```
  - 出力（全文）:
    ```
    元の日付      : 2026-01-31T00:00:00.000Z
    setMonth 後   : 2026-03-03T00:00:00.000Z (UTC)
      -> 元の d が変化した?（可変性）: 2026-01-31T00:00:00.000Z => 2026-03-03T00:00:00.000Z
    ローカル版     : Tue Mar 03 2026 00:00:00 GMT+0900 (Japan Standard Time)
    自前で月末クランプ: 2026-02-28
    exit=0
    ```
  - 既存技術と比べて感じた違い: `setMonth` は **破壊的**（元の `d` が `2026-01-31`→`2026-03-03` に変わる）。
    2/31 が存在しないため 2月末を越えて **3/03 に転がる**。月末クランプは自前計算（翌々月の0日）が必要。
  - 記事に書きたい気づき: 「Dateが壊れる」主役の証拠。`2026-03-03` をそのまま貼れる。

- [x] `02-temporal.mjs`：`PlainDate.add({months:1})` でクランプ確認（見積もり 25分 → 実測 数分）
  - 実行したコマンド:
    ```bash
    node workspace/02-temporal.mjs
    ```
  - 出力 / エラー（全文）:
    ```
    元の日付      : 2026-01-31
    add(+1month)  : 2026-02-28 (既定 overflow:constrain で2月末にクランプ)
      -> 元の jan31 は不変?: 2026-01-31
    overflow:reject => 例外: RangeError: Temporal error: not a valid ISO date.
    overflow:constrain: 2026-02-28
    exit=0
    ```
  - 既存技術と比べて感じた違い: `add` は **非破壊**（`jan31` は `2026-01-31` のまま）で新インスタンスを返す。
    既定 `overflow:'constrain'` で **2月末(2026-02-28)にクランプ**。`overflow:'reject'` を付けると
    `RangeError: Temporal error: not a valid ISO date.` で明示的に弾ける。
  - 記事に書きたい気づき: Date の `2026-03-03` と Temporal の `2026-02-28` を並べると差が一目瞭然。

- [x] `03-tz.mjs`：TZ跨ぎ変換を Date版 / Temporal版で書き比べ（見積もり 30分 → 実測 数分）
  - 実行したコマンド:
    ```bash
    node workspace/03-tz.mjs
    ```
  - 出力 / エラー（全文）:
    ```
    [Date] UTC        : 2026-07-14T12:00:00.000Z
    [Date] New York   : 7/14/2026, 8:00:00 AM
    [Date] Tokyo      : 7/14/2026, 9:00:00 PM
    [Temporal] Instant: 2026-07-14T12:00:00Z
    [Temporal] NewYork: 2026-07-14T08:00:00-04:00[America/New_York]
    [Temporal] Tokyo  : 2026-07-14T21:00:00+09:00[Asia/Tokyo]
      -> ny.timeZoneId: America/New_York / ny.hour: 8
    [Temporal] PlainDateTime.toZonedDateTime() => 例外: TypeError: Temporal error: Time zone must be string or ZonedDateTime object.
    [Temporal] toZonedDateTime("Asia/Tokyo"): 2026-07-14T12:00:00+09:00[Asia/Tokyo]
    exit=0
    ```
  - 既存技術と比べて感じた違い: Date は TZ を保持できず `toLocaleString` の**文字列変換に頼る**だけ
    （オブジェクトは常にUTC epoch）。Temporal は `ZonedDateTime` が **型としてTZを持ち**、
    `.timeZoneId` / `.hour` 等で構造化アクセスできる。
  - つまずいた理由: `PlainDateTime.toZonedDateTime()` を**引数なし**で呼ぶと落ちる。タスクの予想は
    `RangeError` だったが、実際は **`TypeError: Time zone must be string or ZonedDateTime object.`**。
    正しくは `.toZonedDateTime('Asia/Tokyo')` のように TZ を渡す。
  - 記事に書きたい気づき: 「TZ変換にはTZ必須」を型エラーで体感できる。予想(RangeError)と実際(TypeError)のズレも素材。

- [x] `04-diff.mjs`：差分を Date（ms引き算）と Temporal（since/Duration）で（見積もり 20分 → 実測 数分）
  - 実行したコマンド:
    ```bash
    node workspace/04-diff.mjs
    ```
  - 出力（全文）:
    ```
    [Date] 差(ms)     : 14212800000
    [Date] 差(日)     : 164.5
    [Date] 差(日,整数): 164
    [Temporal] since()（既定）   : P164DT12H
    [Temporal] since(largestUnit:day): P164DT12H
      -> days: 164 / hours: 12 / minutes: 0
    [Temporal] since(largestUnit:month): P5M14DT12H => months: 5 days: 14
    [Temporal] Instant.since(hour): PT3948H => total days: 164.5
    exit=0
    ```
  - 既存技術と比べて感じた違い: Date は `a - b` でミリ秒に暗黙変換 → `/86400000` を自前で割る。
    Temporal は `since` が **ISO8601形式の Duration**（`P164DT12H` 等）を返し、`.days`/`.hours` で
    構造化取得できる。`largestUnit:'month'` にすると `P5M14DT12H`（5か月14日12時間）に分解。
  - つまずいた理由（予想との差）: タスクは「largestUnit 未指定だと単位が小さく出る」と予想していたが、
    `PlainDateTime.since` の**既定でも `P164DT12H`（日+時）**が返り、`largestUnit:'day'` と同じだった
    （※`06-extra.mjs` では `PlainDate.since` 既定が `P164D`。型で既定 largestUnit が変わる）。
  - 記事に書きたい気づき: `largestUnit` を変えると同じ差分が「日」でも「か月+日」でも表現できる柔軟さ。

- [x] `05-convert.mjs`：Date ⇔ Temporal 相互変換（見積もり 20分 → 実測 数分）
  - 実行したコマンド:
    ```bash
    node workspace/05-convert.mjs
    ```
  - 出力（全文）:
    ```
    Date               : 2026-07-14T12:34:56.789Z
    -> Instant         : 2026-07-14T12:34:56.789Z
       epochMilliseconds: 1784032496789
    Instant -> Date     : 2026-07-14T12:34:56.789Z
       往復一致?         : true
    typeof Date.prototype.toTemporalInstant: function
    now.toTemporalInstant(): 2026-07-14T12:34:56.789Z
    Instant -> ZonedDateTime(Tokyo): 2026-07-14T21:34:56.789+09:00[Asia/Tokyo]
    ZonedDateTime -> Date: 2026-07-14T12:34:56.789Z
    exit=0
    ```
  - 既存技術と比べて感じた違い: `Date`↔`Instant` は **epochミリ秒経由**で往復一致（`true`）。
    TZ付きにするには `Instant.toZonedDateTimeISO(tz)` で `ZonedDateTime` を挟む。
  - 確認できたこと: タスクが「環境依存・要確認」としていた `Date.prototype.toTemporalInstant` は
    **この環境（v26.5.0）に実装済み**（`typeof` が `function`、呼ぶと `Instant` を返す）。
  - 記事に書きたい気づき: 既存の Date 資産を捨てずに Temporal と橋渡しできる（共存前提）。

### フェーズ4: 深掘り・比較

- [x] 予想外だった挙動を掘る（`06-extra.mjs`）（見積もり 10分 → 実測 数分）
  - 実行したコマンド:
    ```bash
    node workspace/06-extra.mjs
    ```
  - 出力 / エラー（全文）:
    ```
    [1] add(+1M) 既定       : 2026-02-28 (overflow指定なし)
    [2] from(2026-02-30, reject): RangeError: Temporal error: Parsed day value not in a valid range.
    [2] from(2026-02-30, constrain): 2026-02-28
    [3] PlainDate.since 既定 : P164D (largestUnit未指定)
    [3] PlainDate.since month: P5M14D
    [4] Temporal.Now.timeZoneId(): Asia/Tokyo
    [4] Temporal.Now.zonedDateTimeISO(): 2026-07-14T15:19:43.290044922+09:00[Asia/Tokyo]
    file:///.../workspace/06-extra.mjs:28
    console.log('[5] Duration.total(week) :', dur.total({ unit: 'week' }));
                                                  ^

    RangeError: Temporal error:
        at Duration.total (<anonymous>)
        at file:///.../workspace/06-extra.mjs:28:47
        ...
    Node.js v26.5.0
    exit=1
    ```
  - 予想外だった挙動（記事の「へぇ」）:
    1. `overflow` の既定は `'constrain'`（明示しなくても月末クランプ）。
    2. `PlainDate.since` の**既定 largestUnit は型で変わる**（`PlainDate` は `P164D`、`PlainDateTime` は `P164DT12H`）。
    3. `Temporal.Now.timeZoneId()` は実行環境の IANA 名（`Asia/Tokyo`）を返す。
    4. **`Duration.total({unit:'week'})` が空メッセージの `RangeError` で落ちた**（後述の詰まり参照）。

- [x] Duration.total({week}) の詰まりと対処（追加検証）
  - 実行したコマンド:
    ```bash
    node -e "
    const a = Temporal.PlainDate.from('2026-07-14');
    const b = Temporal.PlainDate.from('2026-01-31');
    const dur = a.since(b, { largestUnit: 'day' });
    console.log('total(day)          :', dur.total({ unit: 'day' }));
    console.log('total(week,relativeTo):', dur.total({ unit: 'week', relativeTo: b }));
    "
    ```
  - 出力（全文）:
    ```
    total(day)          : 164
    total(week,relativeTo): 23.428571428571427
    exit=0
    ```
  - 効いた対処: 暦単位（week/month/year）へ total するには基準日 `relativeTo` が必須。
    day 以下（固定長）なら不要。→ `knowledge/2026-07-14-temporal-duration-total-week-needs-relativeto.md` に記録。

#### 4処理の比較表（実行ログの事実に基づく）

| 検証 | Date（コードと落とし穴） | Temporal（コードと挙動） | 気づき |
|---|---|---|---|
| 月末＋1か月（Jan 31） | `d.setMonth(d.getMonth()+1)` → `2026-03-03`。**破壊的**・翌月に転がる | `PlainDate.from('2026-01-31').add({months:1})` → `2026-02-28`。**非破壊**・既定constrainでクランプ | Dateは3月へ暴走 / Temporalは2月末に丸め |
| TZ跨ぎ変換 | `d.toLocaleString('en-US',{timeZone})` → `7/14/2026, 8:00:00 AM`。**文字列だけ**・型にTZを持てない | `Instant.toZonedDateTimeISO('America/New_York')` → `...08:00:00-04:00[America/New_York]`。型がTZ保持 | Temporalは`.timeZoneId`/`.hour`で構造化取得 |
| 差分(Duration) | `(a-b)/86400000` → `164.5`。数値のみ | `a.since(b,{largestUnit:'day'})` → `P164DT12H`（`.days`/`.hours`） | largestUnitで日/か月表現を切替可 |
| 相互変換 | `new Date(instant.epochMilliseconds)` | `Instant.fromEpochMilliseconds(date.getTime())` / `date.toTemporalInstant()` | epochミリ秒経由で往復一致(`true`)。共存できる |

## 詰まった点と解決過程（記事の核）

実行中に実際に詰まった点。予測（詰まりポイント表）と実際の差分も書く。

| # | 詰まった点 | 原因 | 効いた対処 | 所要 | 解決/撤退 | 記事での活かし方 |
|---|---|---|---|---|---|---|
| 1 | v22 で `typeof Temporal` が **例外にならず `undefined`** | `typeof` は未定義識別子に例外を投げない仕様。予想は ReferenceError | 直接参照 `Temporal.Now.plainDateTimeISO()` を叩くと `ReferenceError: Temporal is not defined` | 数分 | 解決 | 「v22では動かない」を冒頭に。予想と実挙動のズレも小ネタ |
| 2 | Jan31+1か月が Date と Temporal で食い違う | Date の setMonth は溢れ日を翌月へ転がす／Temporal は既定 constrain で月末クランプ | 同入力で両方実行し出力を並べる。`overflow:'reject'` は RangeError | 数分 | 解決 | 記事の主役。`2026-03-03` vs `2026-02-28` |
| 3 | `PlainDateTime.toZonedDateTime()` 引数なしで落ちる | TZ変換にはTZ必須。**実際は TypeError**（予想は RangeError） | `.toZonedDateTime('Asia/Tokyo')` とTZを渡す | 数分 | 解決 | 「TZ必須」あるある。例外種別が予想と違う点も |
| 4 | `since` の既定 largestUnit が分かりづらい | 型で既定が変わる（PlainDate=P164D / PlainDateTime=P164DT12H） | `largestUnit:'day'`/`'month'` を明示して意図した単位に | 数分 | 解決 | largestUnit の指定を勧める節に |
| 5 | `Duration.total({unit:'week'})` が**空メッセージの RangeError** | week/month/year は暦単位で日数可変 → 基準 `relativeTo` が必須 | `dur.total({unit:'week', relativeTo: b})` で `23.42...` | 数分 | 解決 | 「Temporalの RangeError はメッセージが空のことがある」注意喚起。knowledge化済 |

## スクリーンショット一覧

（ブラウザ表示を伴わない検証のため、スクショは取得していない。完了確認はすべて CLI 標準出力。）

| ファイル | 何を示すか | 使う見出し |
|---|---|---|
| （なし） | CLI標準出力（`commands.log`）が完了確認の証拠 | 5.〜8.（コードブロックとして貼る） |

## 記事への写像（実績で埋める）

| 記事の見出し | 使う記録 / ログ | 書くこと（メモ） |
|---|---|---|
| 1. はじめに | 前提・動機 | 新人がNode 26でTemporalを試す動機。Dateの日時計算で困った経験 |
| 2. なぜTemporalを試すのか | フェーズ1 | Node 26で既定有効になった話題性。月末計算などDateの落とし穴の普遍性 |
| 3. 事前に調べたこと | フェーズ1の記録 | 既定有効(フラグ不要)・V8 14.6.202.34-node.24（実機値）・型/API一覧。公式/MDNリンク |
| 4. 環境 | フェーズ2ログ | `nvm use 26`、`typeof Temporal → object` 確認、**v22での ReferenceError 全文**（予想=typeofとのズレも） |
| 5. Dateで書いた処理 | `01`/`03`/`04`/`05` の Date版出力 | setMonthの破壊性・`2026-03-03` ロールオーバー、`toLocaleString`頼み、ms引き算 |
| 6. Temporalで書き直し | `02`〜`05` の Temporal版出力 | 不変・`2026-02-28`クランプ・`ZonedDateTime`のTZ保持・`since`/`Duration`・相互変換(往復一致 true) |
| 7. 詰まった点 | 「詰まった点」表・エラー全文 | 5件（typeof/ロールオーバー/TZ必須TypeError/largestUnit/total week RangeError）。全文を貼る |
| 8. Dateと比べて分かったこと | フェーズ4の比較表 | 4処理の対比表。どこがラクでどこが面倒か |
| 9. どんな人に向くか | フェーズ5の棚卸し | 新人が今から触る価値・**共存前提**（Dateを捨てない。相互変換で橋渡し） |
| 10. まとめ | 結果サマリー | 学んだこと・次に試すこと（`Duration`のrelativeTo/`PlainYearMonth`等） |

## 未達・撤退した項目

- なし（全フェーズ達成。撤退ライン発動なし。Node26は nvm 導入済みで切替のみ）。

## 再現性メモ（記事に転記する用）

- OS / ランタイム: macOS（Darwin 25.5.0）/ Node **v26.5.0**（V8 14.6.202.34-node.24, npm 11.17.0）/ 切替は nvm
- 実行コマンドの並び（最短の再現手順）:
  ```bash
  nvm use 26
  node -e "console.log(typeof Temporal, Temporal.Now.plainDateTimeISO().toString())"  # object ...
  node 01-date.mjs   # Date: Jan31+1M → 2026-03-03
  node 02-temporal.mjs  # Temporal: → 2026-02-28
  node 03-tz.mjs 04-diff.mjs 05-convert.mjs 06-extra.mjs
  ```
- 注意点:
  - Temporal は **Node 26 以降で既定有効**（v22 等では `Temporal is not defined`）。
  - v22 での確認は `typeof Temporal`（→undefined、落ちない）ではなく `Temporal.Now...` の**直接参照**で。
  - `PlainDateTime.toZonedDateTime()` は TZ 引数必須（省略で TypeError）。
  - `Duration.total()`/`round()` を **暦単位(week/month/year)** で行うときは `relativeTo` 必須。
  - `since` の既定 largestUnit は型依存（PlainDate=day、PlainDateTime=day+time）。意図する単位は明示する。

## 次のアクション（記事化）

- [ ] この execution-log.md の「記事への写像」に沿って articles/<slug>.md を作成する（`/draft-article`）
- [ ] 画像なし（CLIログ中心）。コードブロックとして出力全文を貼る
- [ ] 完了条件・詰まった点(5件)・比較表を本文に落とす
