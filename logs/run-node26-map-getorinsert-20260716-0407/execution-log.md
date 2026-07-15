# 検証ログ: Node 26 の `Map.getOrInsert` と `Iterator.concat` で「get-or-set定型」を書き比べてみた

> Zenn記事の素材。実行の一次情報（コマンド・エラー全文・所要時間・スクショ）を記録。
> 記事本文は未執筆。「記事への写像」を見て articles/*.md に展開する。

## 実行の前提（採用した前提）

- 対象タスク: `practice/practice-node26-map-getorinsert-20260716-0404.md`
- 出典レポート: `research/search-topic-20260716-0400.md`
- 対象技術: Node.js 26（同梱 V8 14.6）の `Map.prototype.getOrInsert` / `getOrInsertComputed` と `Iterator.concat`
- 実行者: AIエージェント単独（非対話） <!-- 内部メタ: 記事に転記しない -->
- 実行日時 / 所要時間: 2026-07-16 04:07 / 見積もり 約4.3h → 実測 約0.6h（AI単独） <!-- 実測はAI単独の値。記事にそのまま書かない -->
- 実行環境: macOS 26.5 (Darwin 25.5.0, arm64) / 既定 Node v22.17.0・検証用 Node v26.5.0（nvm）/ playwright（chromium）
- 採用した撤退ライン: Node 26 導入が30分で通らなければ公式バイナリ直接展開 → それでも不可ならポリフィル比較で「導入に詰まったログ」を記事化（※今回は発動せず）
- 判断方針: 引数はタスクパスのみ指定。時間・撤退ラインは未指定のため対象タスク記載のデフォルト（半日 / タスク内の撤退ライン）を採用。

## 結果サマリー

- 完了条件の判定: **達成**（5つの完了条件すべてを客観確認）
- 作ったもの: `node` で動く検証スクリプト群（01〜05）＋ `report.html` ＋ 生成ログ。`logs/run-node26-map-getorinsert-20260716-0407/workspace/`
- スクショ: 1 枚（`screenshots/report.png`）
- 詰まった点: 3 件（うち解決 3 / 未解決・撤退 0）。うち1件は「予測と実際の挙動が違った」ポイント
- knowledge 記録: なし（新規の未記録トラブルに該当するものは発生せず。既知の nvm 運用の範囲内）

## 完了条件の検証

| # | 完了条件 | 判定 | 根拠（ログ / スクショ） |
|---|---|---|---|
| 1 | `02` の出力が `01` と完全一致（diff 差分ゼロ） | 達成 | `commands.log`「diff a.txt b.txt / diff exit code: 0」 |
| 2 | `03` で「コールバック呼び出し回数 = ユニークキー数」 | 達成 | `03-lazy-callback`: 呼び出し回数=5, ユニークキー=5, 一致 true |
| 3 | `04` が中間配列（`Array.from`）なしで期待値を出力 | 達成 | `04-iterator-concat`: `Array.from` 不使用、take(3)=[20,40,60]、source3 未評価 |
| 4 | `05` が両版で同じ集計結果を出し、時間・メモリの数値が出る | 達成 | `05-bench`: 「結果一致: OK (size=1000, sum=1000000)」＋中央値/heapUsed 数値 |
| 5 | `report.html` を Playwright で開いてスクショ保存 | 達成 | `screenshots/report.png`（79KB, 表2つが描画） |

## タスク実行ログ（フェーズ別）

### フェーズ1: 事前調査（見積もり30分 → 実測 約3分）

- [x] `node -v` を実行し現在のバージョンを記録
  - 実行したコマンド:
    ```bash
    node -v
    ```
  - 出力:
    ```
    v22.17.0
    ```
  - 気づき: 既定は v22.17.0。対象APIは Node 26 でしか動かない → 26未満だと `TypeError: ... is not a function` になる伏線。
- [x] 3APIのシグネチャと注意点を確認（タスクの裏取り済み前提を採用）
  - `Map.prototype.getOrInsert(key, defaultValue)`: あれば取得、なければ defaultValue を格納して返す。**第2引数は即時評価**。
  - `Map.prototype.getOrInsertComputed(key, callbackFn)`: コールバックは**未存在時のみ**実行、**戻り値がそのまま格納**（async を渡すと Promise が入る）。
  - `Iterator.concat(...iterables)`: 複数イテラブルを中間配列なしで遅延連結する**静的メソッド**。**同期専用**。
  - 参照URL: nodejs.org リリースノート / nodejsdesignpatterns.com / MDN（タスクの参考リンク）。
- [x] データセット決定
  - 単語配列のカウント（`Map<string, number>`）＋ `{team, name}` のチーム別グルーピング（`Map<string, string[]>`）。どちらも「あれば取得、なければ初期化して足す」実務定型の代表。`workspace/data.mjs`。

### フェーズ2: 環境構築（見積もり45分 → 実測 約5分）

- [x] Node 26 を導入し `node -v` が `v26.x` になることを確認（見積もり25分 → 実測 約2分）
  - 実行したコマンド:
    ```bash
    export NVM_DIR="$HOME/.nvm"; \. "$NVM_DIR/nvm.sh"
    nvm ls           # v26.5.0 が既にインストール済みと判明
    nvm use 26
    node -v
    ```
  - 出力:
    ```
    node -> stable (-> v26.5.0 *) (default)
    ...
    node: v26.5.0
    ```
  - 効いた対処: nvm に **v26.5.0 が既に入っていた**ため `nvm install` は不要、`nvm use 26` で切替のみ。撤退ライン（公式バイナリ直展開）は発動せず。
  - つまずいた理由・分かっていなかった前提: シェル既定は v22.17.0 のまま。**各コマンドで毎回 nvm を source して `nvm use 26` しないと v22 に戻る**（sub-shell では env が引き継がれない）。以降すべてのスクリプト実行を `export NVM_DIR...; \. nvm.sh; nvm use 26` で固定した。
- [x] 動作確認 Hello World（見積もり10分 → 実測 約1分）
  - 実行したコマンド:
    ```bash
    node -e "console.log(new Map().getOrInsert('a', 1))"
    node -e "console.log(new Map().getOrInsertComputed('a', () => 99))"
    node -e "console.log([...Iterator.concat([1,2],[3,4])])"
    ```
  - 出力:
    ```
    1
    99
    [ 1, 2, 3, 4 ]
    ```
  - 気づき: 3APIとも**フラグ不要で既定有効**。`1` が返れば対象APIが有効の判定に使える。
- [x] Playwright 用意（見積もり10分 → 実測 約1.5分・バックグラウンド）
  - 実行したコマンド:
    ```bash
    npm init -y
    npm i -D playwright
    npx playwright install chromium
    ```
  - 出力: exit code 0（chromium DL 完了）。初回DLはネットワーク次第で時間がかかる点はタスク予測どおり。

### フェーズ3: 実装・検証【本編】（見積もり120分 → 実測 約15分）

- [x] `01-group-old.mjs`（旧来の書き方）
  - 実行したコマンド:
    ```bash
    node workspace/01-group-old.mjs
    ```
  - 出力:
    ```
    == counts ==
    apple: 4
    banana: 3
    cherry: 2
    date: 2
    elderberry: 1
    == byTeam ==
    blue: Bob, Eve
    green: Dave, Grace
    red: Alice, Carol, Frank
    ```
  - 面倒に感じた箇所: グルーピングの `if (!m.has(k)) m.set(k, []); m.get(k).push(...)` の**3手順**。カウントは `m.set(k, (m.get(k) ?? 0)+1)` の1行で書けるが `get` が2回出る。
- [x] `02-group-new.mjs`（新API版）＋ diff 一致確認
  - 実行したコマンド:
    ```bash
    node workspace/01-group-old.mjs > workspace/a.txt
    node workspace/02-group-new.mjs > workspace/b.txt
    diff workspace/a.txt workspace/b.txt; echo "exit: $?"
    ```
  - 出力:
    ```
    exit: 0        # 差分ゼロ = 出力完全一致
    ```
  - 既存技術と比べて感じた違い: **グルーピングが 4行 → 1行**（`byTeam.getOrInsertComputed(team, () => []).push(name)`）。カウントは `getOrInsert(k, 0)` で `get` の二重呼び出しが消える。使い分けは「初期値が定数 → `getOrInsert(k, 0)` / 初期値を毎回 new する（配列・オブジェクト）→ `getOrInsertComputed(k, () => [])`」が自然だった。
  - 行数: 01=28行 / 02=27行（整形共通。差はグルーピングロジックの 4行→1行 が本質）。
- [x] `03-lazy-callback.mjs`（遅延評価の実証）
  - 出力:
    ```
    入力件数: 12, ユニークキー数: 5
    [getOrInsertComputed] コールバック呼び出し回数 = 5
      → ユニークキー数(5)と一致: true
    [getOrInsert(k, expensive())] expensive() 呼び出し回数 = 12
      → 入力件数(12)と一致（毎回評価される）: true
    ```
  - 気づき: `getOrInsertComputed` のコールバックは**未存在時のみ**（=ユニークキー数=5回）。対して `getOrInsert(k, expensive())` は第2引数が**毎回即時評価**され 12回呼ばれる。重い初期化・副作用のある初期値は必ず `getOrInsertComputed` を使うべき、という決定的な差。
- [x] `04-iterator-concat.mjs`（中間配列なし連結＋遅延）
  - 出力:
    ```
    == Iterator.concat + filter/map/take（遅延評価） ==
      source1 -> 1
      source1 -> 2
      source1 -> 3
      source1 -> 4
      source1 -> 5
      source2 -> 6
    take(3) の結果: [ 20, 40, 60 ]
    → source3 のログが出ていなければ、後続ソースは評価されていない（遅延）
    == Iterator.concat に async iterable を渡すと？ ==
    例外: TypeError [object AsyncGenerator] is not iterable
    ```
  - 気づき: `Array.from` 不使用で `Iterator.concat(...).filter().map().take(3)` が動く。`take(3)` で早期終了し **source3 は一度も評価されない**（遅延が効いている）。source2 も `6` を出した時点で止まる。
  - 予測と実際の差（重要）: タスクの詰まりポイント表では「async iterable を渡すと Promise が要素として入る」と予測していたが、**実際は `Iterator.concat(asyncGen())` の時点で `TypeError: [object AsyncGenerator] is not iterable` が throw された**。async generator は同期 iterable ではない（`Symbol.iterator` を持たない）ため、concat が受け付けない。予測より明確に弾かれる = 記事の訂正ポイント。

### フェーズ4: 深掘り・比較（見積もり45分 → 実測 約8分）

- [x] `05-bench.mjs`（100万件・簡易ベンチ、`--expose-gc`）
  - 実行したコマンド:
    ```bash
    node --expose-gc workspace/05-bench.mjs
    ```
  - 出力:
    ```
    結果一致: OK (size=1000, sum=1000000)

    入力件数=1,000,000, ユニークキー=1000, 試行=5（中央値）
      旧来 (get ?? 0)        中央値 93.7 ms  heapUsed 0.07 MB
      新 (getOrInsert)      中央値 107.2 ms  heapUsed 0.06 MB

    == 連結: スプレッド中間配列 vs Iterator.concat（合計を取るだけ） ==
      [...A, ...B]        84.9 ms  追加heap 29.13 MB  sum=999999000000
      Iterator.concat     172.2 ms  追加heap 21.53 MB  sum=999999000000

    ※ 単一環境の簡易計測。数値は参考値（JIT/GCでブレる）。
    ```
  - 気づき（断定しない）: グルーピング集計は**旧来 vs getOrInsert で速度差はほぼ誤差**（むしろ getOrInsert がわずかに遅い）。getOrInsert の価値は速度ではなく**可読性（has/get/set 分岐が消える）**。連結は `Iterator.concat` が**heap を約 7.6MB 節約**（中間配列を作らないため）する一方、要素アクセスのオーバーヘッドで**時間はスプレッドより長い**場合がある = メモリと時間のトレードオフ。両版の合計値は一致（assert 通過）。
- [x] `report.html` 生成＋ Playwright スクショ
  - 実行したコマンド:
    ```bash
    node workspace/gen-report.mjs      # bench の JSON から HTML 生成
    node workspace/shot.mjs            # playwright で report.png 保存
    ```
  - 出力:
    ```
    report.html generated
    screenshot saved: screenshots/report.png
    ```
  - スクショ: `screenshots/report.png`（2つの結果表が描画されているのを目視確認）

### フェーズ5: 振り返り・記事化準備

- [x] 詰まった点の棚卸し（下表）／記事への写像の割り当て（下節）を実施。

## 詰まった点と解決過程（記事の核）

| # | 詰まった点 | 原因 | 効いた対処 | 所要 | 解決/撤退 | 記事での活かし方 |
|---|---|---|---|---|---|---|
| 1 | 既定 `node -v` が v22.17.0 で対象APIが未定義になる恐れ | シェル既定が Node 22。対象APIは Node 26/V8 14.6 のみ | 各コマンド冒頭で `nvm.sh` を source し `nvm use 26` を固定。sub-shell では env が引き継がれない点に注意 | 約2分 | 解決 | 「まずランタイムの壁」。動かした `node -v`（v26.5.0）と実行日を明記する重要性 |
| 2 | `getOrInsert(k, expensive())` で重い初期値が毎回走る | 第2引数は**即時評価**。`getOrInsertComputed(k, fn)` の fn は未存在時のみ | 呼び出し回数カウンタで実測（12回 vs 5回）し使い分けを明文化 | 実装で確認 | 解決 | 記事の核。`getOrInsert` と `getOrInsertComputed` の使い分けを実測ログ付きで |
| 3 | `Iterator.concat(asyncGen())` が `TypeError: [object AsyncGenerator] is not iterable` | async generator は同期 iterable でない。concat は同期専用 | 同期ジェネレータで使う。非同期は自前 `async function*` で連結 | 即判明 | 解決 | 「予測（Promiseが入る）と実際（throw）が違った」訂正付きの経験談。できること/できないことの線引き |

## スクリーンショット一覧

| ファイル | 何を示すか | 使う見出し |
|---|---|---|
| screenshots/report.png | 05-bench の結果表（集計の時間/メモリ、連結のheap比較） | 7. 分かったこと / 8. 既存の書き方と比べて |

## 記事への写像（実績で埋める）

| 記事の見出し | 使う記録 / スクショ | 書くこと（メモ） |
|---|---|---|
| 1. はじめに | 前提・完成イメージ | get-or-set 定型は誰もが書く。Node 26 で何が変わったか |
| 2. なぜ試すか | 出典レポートの動機 | フラグ不要・既定・実務直結という旬さ |
| 3. 事前に調べたこと | フェーズ1ログ | 3APIのシグネチャと注意点（即時評価 vs 遅延、同期専用）、参照リンク |
| 4. 環境構築 | フェーズ2ログ / 詰まった点#1 | nvm で v26.5.0 に切替、Hello World（`1`が返る）、v22に戻る罠 |
| 5. 実際に試したこと（書き比べ） | フェーズ3ログ / 01〜04 のコード抜粋・出力 | before/after、`diff` exit 0 の一致、遅延評価の実証、Iterator.concat の take で早期終了 |
| 6. 詰まった点 | 「詰まった点」表 / 04 のエラー全文 | API名/ランタイム / 即時評価 vs 遅延 / async は throw（予測と実際の差） |
| 7. 分かったこと | フェーズ4ログ / report.png | 行数削減（4→1）・簡易計測の数値（速度は誤差と断る） |
| 8. 既存の書き方と比べて | 01 vs 02、`[...A,...B]` vs concat / report.png | コード量・可読性・heap 差（トレードオフ） |
| 9. どんな人向きか | 想定読者 | グルーピング/集計/キャッシュを書く新人〜2年目 |
| 10. まとめ | 結果サマリー / フェーズ5 | 使いどころ（getOrInsert=定数初期値 / Computed=毎回new・重い初期化）、注意点、次に試すこと |

## 未達・撤退した項目

- なし（全完了条件を達成。撤退ラインは未発動）。

## 再現性メモ（記事に転記する用）

- OS / ランタイム / 主要ライブラリ: macOS 26.5 (arm64) / Node **v26.5.0**（nvm、既定 v22.17.0 とは別）/ playwright（chromium）
- 実行コマンドの並び（最短の再現手順）:
  ```bash
  nvm use 26        # v26.x であること（対象APIは Node 26/V8 14.6 で既定有効）
  node -e "console.log(new Map().getOrInsert('a', 1))"   # 1 が返れば有効
  node 01-group-old.mjs > a.txt
  node 02-group-new.mjs > b.txt
  diff a.txt b.txt                                        # 差分ゼロで一致確認
  node 03-lazy-callback.mjs                               # 呼び出し回数=ユニークキー数
  node 04-iterator-concat.mjs                             # take で早期終了・async は TypeError
  node --expose-gc 05-bench.mjs                           # 簡易ベンチ
  ```
- 注意点: 対象APIは **Node 26 以上必須**（未満だと `TypeError: ... is not a function`）。`Iterator.concat` は**同期専用**で async generator は `TypeError` で弾かれる。`getOrInsert` の第2引数は**即時評価**なので重い初期値は `getOrInsertComputed` を使う。ベンチは単一環境の簡易計測（JIT/GC でブレる）で速度差は断定しない。

## 次のアクション（記事化）

- [ ] この execution-log.md の「記事への写像」に沿って articles/<slug>.md を作成する（`/draft-article`）
- [ ] スクショを Zenn 用に `images/<slug>/` へ配置する
- [ ] 完了条件・詰まった点（特に #2 使い分け・#3 async の throw）・比較を本文に落とす
