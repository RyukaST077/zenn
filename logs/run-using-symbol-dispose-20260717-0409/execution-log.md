# 検証ログ: `using`/`Symbol.dispose` を try/finally と同じ処理で書き比べてみた

> Zenn記事の素材。実行の一次情報（コマンド・エラー全文・所要時間・スクショ）を記録。
> 記事本文は未執筆。「記事への写像」を見て articles/*.md に展開する。

## 実行の前提（採用した前提）

- 対象タスク: `practice/practice-using-symbol-dispose-20260717-0407.md`
- 出典レポート: `research/search-topic-20260717-0403.md`
- 対象技術: ES2026 明示的資源管理（`using` / `await using` / `Symbol.dispose` / `Symbol.asyncDispose`）
- 実行者: AIエージェント単独（非対話） <!-- 内部メタ: 記事に転記しない -->
- 実行日時 / 所要時間: 2026-07-17 04:09〜04:13 JST / 見積もり 約3.8h → 実測 約0.4h（AI単独値・記事にそのまま書かない）
- 実行環境: OS macOS (Darwin 25.5.0, arm64) / Node **切替が本質**: 既定は v22.17.0 だが `using` 非対応。nvm で **v26.5.0** に切替して検証
- 採用した撤退ライン: 1タスク30分。フェーズ1で `using` が動かない場合は Node 24+/26 へ切替（詰まりポイント#1）
- 判断方針: 引数は対象タスクファイルパスのみ。テーマ・時間・スキルレベルはタスク前提とデフォルトを採用

## 結果サマリー

- 完了条件の判定: **達成**（4条件すべてCLI出力で客観確認）
- 作ったもの: `Symbol.dispose`/`Symbol.asyncDispose` を実装した自作リソースクラスと、同じ題材を try/finally 版 / using 版で書いた比較スクリプト群（`workspace/*.mjs` 全7本）
- スクショ: 0 枚（ブラウザ表示を伴わないCLI検証のため。完了確認は標準出力ログ＝`commands.log`）
- 詰まった点: 2 件（うち解決 2 / 未解決・撤退 0）
- knowledge 記録: なし（既知の版差問題で、nvm 切替のみで解決したため新規記録は不要と判断）

## 完了条件の検証

| # | 完了条件 | 判定 | 根拠（ログ） |
|---|---|---|---|
| 1 | `using` 版と try/finally 版が同じ後始末結果になる | 達成 | commands.log「フェーズ3A」: 両版とも `open db / use db / close db / done` で完全一致 |
| 2 | 複数 `using` の LIFO 解放順がログで確認できる | 達成 | commands.log「フェーズ3B-LIFO」: `open a,b,c` → `dispose c,b,a` |
| 3 | 例外時・early return 時にも解放される | 達成 | 「フェーズ3B-throw」`dispose x`→`caught: boom` / 「フェーズ3B-return」early return 側も `dispose y` が出る |
| 4 | `await using` + `Symbol.asyncDispose` の非同期解放 | 達成 | 「フェーズ4」`asyncDispose start`→`asyncDispose end`→`after block` の順（await されている） |

## タスク実行ログ（フェーズ別）

### フェーズ1: 事前調査

- [x] `node -v` で実行環境を記録（見積もり5分 → 実測1分）
  - 実行したコマンド:
    ```bash
    node -v
    uname -a
    ```
  - 出力（全文）:
    ```
    v22.17.0
    Darwin katayamaryuunosukes-MacBook-Pro.local 25.5.0 Darwin Kernel Version 25.5.0: ... arm64
    ```
  - つまずいた理由・分かっていなかった前提: 既定シェルの Node は **v22.17.0**。タスク前提（Node 26）と食い違う。
  - 記事に書きたい気づき: 「Node 26 の新機能」ではなく、**実行環境のバージョンが本質**という導入に使える。

- [x] `using` の機能検出（見積もり15分 → 実測3分）
  - 実行したコマンド:
    ```bash
    node --input-type=module -e "using x = { [Symbol.dispose](){ console.log('disposed') } }; console.log('ok')"
    ```
  - 出力 / エラー（全文・v22.17.0）:
    ```
    file:///Users/katayamaryuunosuke/workspace/024_zenn/[eval1]:1
    using x = { [Symbol.dispose](){ console.log('disposed') } }; console.log('ok')
          ^

    SyntaxError: Unexpected identifier 'x'
        at compileSourceTextModule (node:internal/modules/esm/utils:344:16)
        at ModuleLoader.createModuleWrap (node:internal/modules/esm/loader:252:12)
        at ModuleLoader.eval (node:internal/modules/esm/loader:291:23)
        at node:internal/process/execution:72:24
        at asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:117:11)
        at Object.runEntryPointWithESMLoader (node:internal/modules/run_main:139:19)
        at evalModuleEntryPoint (node:internal/process/execution:71:47)
        at node:internal/main/eval_string:38:3

    Node.js v22.17.0
    ```
  - 効いた対処 / 試したこと: `nvm ls` で確認したところ **v26.5.0 が導入済み**。`nvm use 26` で切替 → 同じスニペットを再実行:
    ```bash
    export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 26
    node -v   # v26.5.0
    node --input-type=module -e "using x = { [Symbol.dispose](){ console.log('disposed') } }; console.log('ok')"
    # => ok
    #    disposed
    ```
  - つまずいた理由: `using` は構文なので、未対応版では実行時ではなく**パース段階で SyntaxError**（`Unexpected identifier 'x'`）になる。フラグ（`--harmony-*`）ではなくバージョンそのものが必要だった。
  - 既存技術と比べて感じた違い: try/finally はどの版でも動くが、`using` は構文レベルの対応版が要る。

- [x] MDN 要件メモ（見積もり10分 → 実測、タスク前提から転記）
  - 記事の「事前に調べたこと」用の要点（出典タスク＋MDN）:
    - `Symbol.dispose` は例外を投げると「解放失敗」を意味する
    - 複数回呼ばれても例外を投げない（冪等）べき
    - **戻り値に Promise を返してはいけない（`using` は await しない）** → 非同期解放は `await using` + `Symbol.asyncDispose`
    - MDN は `Symbol.dispose` を「Limited availability（Baseline 未到達）」と表記。ブラウザというより Node/TS でまず使う機能。
  - 参照URL: MDN `Symbol.dispose` / `Symbol.asyncDispose` / `await using`、nodejs.org v26.0.0 リリースノート（`using` 未記載）、TC39 Explicit Resource Management。

### フェーズ2: 環境構築

- [x] 使い捨てディレクトリと最小リソースクラス（見積もり30分 → 実測3分）
  - 実行したコマンド:
    ```bash
    node workspace/resource.mjs   # Node 26
    ```
  - 出力（全文）:
    ```
    --- enter block ---
    open A
    using inside block
    dispose A
    --- left block ---
    ```
  - 気づき: `using inside block` の直後、**ブロックを抜けた瞬間に `dispose A`** が出る。`--- left block ---` より前。スコープ終端＝解放タイミングが目で見える。

### フェーズ3: 実装・検証【本編】

- [x] 【題材A】try/finally 版（見積もり20分 → 実測、まとめて実行）
  - 実行: `node workspace/a-finally.mjs`
  - 出力（全文）:
    ```
    open db
    use db
    close db
    done
    ```
  - 感じた手数: `finally { c.close() }` を手で書く必要がある。close の書き忘れが後始末漏れに直結。

- [x] 【題材A】using 版（見積もり20分 → 実測、まとめて実行）
  - 実行: `node workspace/a-using.mjs`
  - 出力（全文）: try/finally 版と**完全一致**
    ```
    open db
    use db
    close db
    done
    ```
  - before/after 差分の要点: `close()` メソッドは `[Symbol.dispose]()` に置換、呼び出し側は `const c = ...; try{}finally{c.close()}` → `using c = ...` の1行に。**close 呼び出しと finally が消えた**。

- [x] 【解放順】LIFO（見積もり25分 → 実測、まとめて実行）
  - 実行: `node workspace/b-lifo.mjs`
  - 出力（全文）:
    ```
    --- using: 確保 a,b,c ---
    open a
    open b
    open c
    body
    dispose c
    dispose b
    dispose a
    --- 参考: try/finally で同じ LIFO を手で再現 ---
    open a2
    open b2
    open c2
    body2
    dispose c2
    dispose b2
    dispose a2
    ```
  - 気づき: `using` は宣言を3行並べるだけで `c→b→a` の LIFO。try/finally で同じ順序を出すには **3段ネスト**が要る（コード量の差が明確）。

- [x] 【例外時】throw しても解放（見積もり20分 → 実測、まとめて実行）
  - 実行: `node workspace/c-throw.mjs`
  - 出力（全文）:
    ```
    open x
    before throw
    dispose x
    caught: boom
    after catch
    ```
  - 気づき: `throw` の後に **`dispose x` が先に出て**、その後で例外が呼び出し側に伝播（`caught: boom`）。finally 相当が自動で効く。

- [x] 【early return】return 時も解放（見積もり15分 → 実測、まとめて実行）
  - 実行: `node workspace/d-return.mjs`
  - 出力（全文）:
    ```
    open y
    before return check
    early return
    dispose y
    result = early
    ---
    open y
    before return check
    normal path
    dispose y
    result = normal
    ```
  - 気づき: early return / 通常 return のどちらでも `dispose y` が出る。**return を足しても手当て不要**。

### フェーズ4: 深掘り・比較

- [x] 【非同期】await using + asyncDispose と誤用の対比（見積もり25分 → 実測、まとめて実行）
  - 実行: `node workspace/e-async.mjs`
  - 出力（全文）:
    ```
    === (1) await using + asyncDispose ===
    open async
    body (async)
    asyncDispose start async
    asyncDispose end async
    after block (async) <- ここは asyncDispose end の後に出るはず
    ---
    === (2) using + dispose が Promise を返す（誤用） ===
    open bad
    body (bad)
    dispose start bad (returns a Promise)
    after block (bad) <- dispose end より前に出てしまう
    dispose end bad (too late!)
    === end (bad の dispose end はここまでの間に遅れて出る) ===
    ```
  - 気づき（記事の核）: (1) `await using` は `asyncDispose end` を待ってから `after block` に進む＝**解放が await される**。(2) 同期 `using` の `Symbol.dispose` が Promise を返しても await されず、`after block` の**後**に `dispose end (too late!)` が遅れて出る。「同期/非同期の解放取り違え」の before/after がそのまま撮れた。

- [x] 【比較表】（見積もり15分 → 実測、下記に作成）

  | 観点 | try/finally 版 | using 版 |
  |---|---|---|
  | コード量 | `const c=...; try{}finally{c.close()}` と定型が要る | `using c = ...` の1行。finally 不要 |
  | close の書き忘れリスク | 手で書くので忘れ得る（後始末漏れ） | スコープ終端で自動。忘れようがない |
  | 解放順の明示性 | 複数資源は手動ネストで順序を作る | 宣言順の逆＝LIFO が自動保証（`dispose c,b,a`） |
  | 例外時 | finally に書けば解放される（書けば） | 自動で解放→例外伝播（`dispose x`→`caught`） |
  | early return | return ごとに finally 相当が効く（1本なら可） | return を足しても自動解放 |
  | 非同期 | `await` を finally に手書き | `await using` + `Symbol.asyncDispose` で await される。同期 `dispose` に Promise は禁止（await されない） |

## 詰まった点と解決過程（記事の核）

| # | 詰まった点 | 原因 | 効いた対処 | 所要 | 解決/撤退 | 記事での活かし方 |
|---|---|---|---|---|---|---|
| 1 | `using` が `SyntaxError: Unexpected identifier 'x'` | 既定 Node が v22.17.0 で `using` 構文非対応。フラグでなくバージョンが本質 | `nvm ls` で v26.5.0 導入済みを確認 → `nvm use 26` で切替後、`ok`/`disposed` が出て解決 | 約3分 | 解決 | 「Node 26 の新機能と思ったら実行環境の版差が本質」を冒頭に。SyntaxError 全文を貼る |
| 2 | 同期 `dispose` に Promise を返すと解放が待たれない | `using` は戻り値を await しない（MDN 明記） | わざと Promise を返させ、`after block` の後に `dispose end (too late!)` が出るのを観察 → `await using`+`asyncDispose` に直す | 約5分 | 解決 | 「同期/非同期の解放取り違え」典型ミスの before/after |

> 予測（詰まりポイント表）との差分: #1 は予測通り発生し、切替先の Node 26 が既に導入済みだったため即解決（`nvm install` すら不要だった）。TS down-compile（予測#4）は素の `.mjs` で完結したため今回は踏まず。

## スクリーンショット一覧

（ブラウザ表示を伴わないCLI検証のため取得なし。完了確認はすべて標準出力＝`commands.log` に全文保存済み）

## 記事への写像（実績で埋める）

| 記事の見出し | 使う記録 / スクショ | 書くこと（メモ） |
|---|---|---|
| 1. はじめに | 前提・動機 | try/finally の後始末を自動化したくて試した |
| 2. なぜ試すのか | フェーズ1・裏取り | ES2026 明示的資源管理。Node 26 固有ではない点 |
| 3. 事前に調べたこと | フェーズ1 MDN要点4行 | 冪等・Promiseを返さない・例外＝解放失敗・Baseline未到達 |
| 4. 環境構築 | フェーズ1(SyntaxError全文→nvm use 26)・フェーズ2(resource.mjs出力) | 版差の詰まり#1と最小リソースクラス |
| 5. try/finally版 | フェーズ3A `a-finally.mjs` 出力 | 手で close を書く従来コードと出力 |
| 6. using版に書き換え | フェーズ3A `a-using.mjs` 差分と一致出力 | before/after 差分、close/finally が消えた書き味 |
| 7. 解放順・例外時の挙動 | フェーズ3B `b-lifo`/`c-throw`/`d-return` 出力全文 | LIFO・throw後解放・return後解放の実測ログ |
| 8. 詰まった点 | 「詰まった点」表・SyntaxError全文・詰まり#2 | 版差・async 取り違え |
| 9. 使いどころ | フェーズ4 `e-async.mjs` 出力・比較表 | ファイル/DB/一時資源、`await using` の場面 |
| 10. まとめ | 結果サマリー・比較表 | 乗り換えの是非・向く人・次にやること |

## 未達・撤退した項目

- なし（完了条件4つすべて達成、撤退・スキップなし）

## 再現性メモ（記事に転記する用）

- OS / ランタイム: macOS (Darwin 25.5.0, arm64) / Node **v26.5.0**（`using` 対応版。v22.17.0 では SyntaxError）
- 実行コマンドの並び（最短の再現手順）:
  ```bash
  nvm use 26                         # using 対応版へ（v24+/26）
  node -v                            # v26.5.0
  node resource.mjs                  # 最小 dispose
  node a-finally.mjs && node a-using.mjs   # 同じ出力になるか
  node b-lifo.mjs                    # LIFO
  node c-throw.mjs                   # 例外時
  node d-return.mjs                  # early return
  node e-async.mjs                   # await using / asyncDispose
  ```
- 注意点: `using` は構文なので未対応版では**パース時に SyntaxError**（フラグでは救えない）。同期 `Symbol.dispose` は Promise を返さない（await されない）。非同期解放は `await using` + `Symbol.asyncDispose`。素の `.mjs` で確認すると TS の down-compile 差に惑わされない。

## 次のアクション（記事化）

- [ ] この execution-log.md の「記事への写像」に沿って articles/using-symbol-dispose.md を作成する
- [ ] スクショは無し（CLI検証）。コード抜粋と出力ログを本文に貼る
- [ ] 完了条件・詰まった点（版差 SyntaxError / async 取り違え）・比較表を本文に落とす
