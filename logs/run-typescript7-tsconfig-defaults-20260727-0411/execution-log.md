# 検証ログ: 旧世代のtsconfigを TypeScript 5.9 → 6.0 → 7.0 に通して、警告がハードエラーに変わる境界を見る

> Zenn記事の素材。実行の一次情報（コマンド・エラー全文・終了コード・所要時間）を記録。
> 記事本文は未執筆。「記事への写像」を見て articles/*.md に展開する。

## 実行の前提（採用した前提）

- 対象タスク: `practice/practice-typescript7-tsconfig-defaults-20260727-0408.md`
- 出典レポート: `research/search-topic-20260727-0402.md`
- 対象技術: TypeScript 7.0.2（Go実装ネイティブ tsc）の tsconfig 互換性。比較対象 6.0.3 / 5.9.3
- 実行者: AIエージェント単独（非対話）
- 実行日時 / 所要時間: 2026-07-27 04:11〜04:19 / 見積もり 420分（7h） → 実測 約8分
  （実測はAI単独・非対話での値。人が手で追う場合の時間ではないので記事にそのまま書かない）
- 実行環境: macOS 26.5 (Build 25F71, arm64) / Node v22.17.0 / npm 10.9.2
- 採用した撤退ライン: 対象タスク記載のもの（版ゲート15分 / エラー潰し45分 / フェーズ4は任意）。**いずれも発動せず**
- 判断方針: 引数で渡されたのは対象タスクファイルのパスのみ。時間・撤退ラインはタスクファイルの記載を採用

## 結果サマリー

- **完了条件の判定: 達成（4条件すべて）**
- 作ったもの: 旧世代 tsconfig fixture（6ファイル / 45行）と、それを 5.9.3 / 6.0.3 / 7.0.2 の
  独立3ディレクトリ＋side-by-side用1ディレクトリで型チェックした出力一式
  （`workspace/` に 27本の `*.log`）
- スクショ: 0 枚（本検証はCLI完結。ブラウザ表示なしのため Playwright 不使用 = 対象タスクの想定どおり）
- 詰まった点: 4 件（うち解決 4 / 未解決・撤退 0）
- knowledge 記録: なし（新規の未記録トラブルに該当するものが出なかった。詳細は「詰まった点」表）

### 一番の発見（記事の核）

**「TS6は警告で通る」という検証設計の前提そのものが外れた。**
TS 6.0.3 は deprecation を `warning` ではなく **`error TS5101` / `error TS5107` として出し、
終了コード 2 で落ちる**。つまり旧世代 tsconfig は **TS7を待たずに 6.0 の時点で既にビルドが止まる**。
TS7 で変わるのは「落ちるかどうか」ではなく「逃げ道があるかどうか」だった。

## 完了条件の検証

| # | 完了条件 | 判定 | 根拠（ログ） |
|---|---|---|---|
| 1 | 3ディレクトリすべてで `tsc --version` が期待した版を出力（版ゲート通過） | **達成** | `workspace/versions.txt`（`GATE OK: ts59/ts60/ts70` / `GATE_FAIL=0`） |
| 2 | 同一 fixture に対する3世代の出力全文が保存されている | **達成** | `ts59-baseline.log`(exit 0) / `ts60-baseline.log`(exit 2) / `ts70-baseline.log`(exit 1) |
| 3 | 「どの設定が、どの版で、警告かハードエラーか」の対応表が埋まっている | **達成** | 下記「設定 → 3世代での扱い 対応表」。全行が実測ログ裏付きで、推測欄なし |
| 4 | TS7 で `tsc --noEmit` が終了コード0で通る最終 tsconfig に到達し、初期版との diff が取れている | **達成** | `ts70-final.log`(exit=0 / error_lines=0) / `tsconfig-before.json` → `tsconfig-after.json` の diff |

## タスク実行ログ（フェーズ別）

### フェーズ1: 事前調査（見積もり 45分 → 実測 約2分）

- [x] 破壊的変更を検証可能なチェックリストに落とす / 予測表を作る
  - 成果物: `workspace/predictions.md`（**3ディレクトリの install より前に書いた**。後出しではない）
  - fixture に入れた項目: `target: es5` / `moduleResolution: node` / `baseUrl`+`paths` /
    `downlevelIteration` / `esModuleInterop: false` / `strict` 未指定 / `types` 未指定
  - 入れなかった項目と理由: `moduleResolution: classic`（実務で使われない、node で代表）/
    `module: amd,umd,systemjs,none`（新人の題材から外れる、commonjs を採用）/
    `allowSyntheticDefaultImports: false`（esModuleInterop と連動、後者で代表）。
    `alwaysStrict: false` は fixture 本体には入れず、フェーズ4で単独プローブした

- [x] registry の実バージョンを確認しピン留め表を作る
  - 実行したコマンド:
    ```bash
    npm view typescript dist-tags --json
    npm view typescript versions --json
    npm view @typescript/typescript6 dist-tags --json
    ```
  - 出力（全文 / dist-tags）:
    ```
    {
      "dev": "3.9.4",
      "tag-for-publishing-older-releases": "4.1.6",
      "insiders": "4.6.2-insiders.20220225",
      "beta": "6.0.0-beta",
      "rc": "7.0.1-rc",
      "latest": "7.0.2",
      "next": "7.1.0-dev.20260726.1"
    }
    ```
  - `@typescript/typescript6` dist-tags: `{ "latest": "6.0.2" }`
  - 5.9系の最新 = `5.9.3` / 6系の最新 = `6.0.3` / 7系 = `7.0.2`（`7.1.0-dev.*` は next）
  - 記事に書きたい気づき: **`latest` がもう `7.0.2`**。`npm i -D typescript` と打つだけで
    TS7 が入る。移行を「まだ先」と思っていても、新規プロジェクトは既に7から始まっている

### フェーズ2: 環境構築（見積もり 60分 → 実測 約2分）

- [x] 版ごとに独立した3ディレクトリを用意 + fixture 作成 + exact install + 版ゲート
  - 実行したコマンド:
    ```bash
    cd logs/run-typescript7-tsconfig-defaults-20260727-0411/workspace
    for pair in "ts59:5.9.3" "ts60:6.0.3" "ts70:7.0.2"; do
      d=${pair%%:*}; v=${pair##*:}
      mkdir -p "$d"; cp -R fixture/tsconfig.json fixture/src "$d"/
      (cd "$d" && npm init -y >/dev/null && npm pkg set private=true \
        && npm i -D --save-exact --ignore-scripts --no-audit --no-fund \
             "typescript@$v" "@types/node@22.18.13")
    done
    # 版ゲート
    for pair in "ts59:5.9.3" "ts60:6.0.3" "ts70:7.0.2"; do
      d=${pair%%:*}; v=${pair##*:}
      out=$(cd "$d" && node node_modules/typescript/bin/tsc --version)
      echo "$out" | grep -q "Version $v" && echo "GATE OK: $d" || echo "GATE NG: $d"
    done
    ```
  - 出力（版ゲート / 全文は `workspace/versions.txt`）:
    ```
    ===== ts59 expect 5.9.3 =====
    Version 5.9.3
    GATE OK: ts59
    ===== ts60 expect 6.0.3 =====
    Version 6.0.3
    GATE OK: ts60
    ===== ts70 expect 7.0.2 =====
    Version 7.0.2
    GATE OK: ts70
    GATE_FAIL=0
    ```
  - **版ゲートは一発で通った**（前回記事のような bin 衝突は起きず）。理由は版を同居させなかったから
  - `ls -l node_modules/.bin/` の観察（**ここに発見あり**）:
    ```
    # ts59 / ts60 は同じ
    tsc -> ../typescript/bin/tsc
    tsserver -> ../typescript/bin/tsserver
    # ts70 は tsserver が無い
    tsc -> ../typescript/bin/tsc
    ```
    → **TS7 の `typescript` パッケージは `tsserver` を持たない**。エディタ用サーバが同梱されない
  - `npm ls --depth=0` は3ディレクトリとも `@types/node@22.18.13` + `typescript@<期待版>` のみ
  - 既存技術と比べて感じた違い: ts70 だけ `added 4 packages`（他は3）。TS7 はプラットフォーム別
    ネイティブバイナリ（`@typescript/typescript-darwin-arm64`）を optionalDependencies で引く
  - 記事に書きたい気づき: 比較検証では**測る前に「本当にその版を測っているか」を機械的に検証する**
    ステップ（版ゲート）を置くべき。前回はこれが無くてTS6を2回測る事故になりかけた

- fixture の規模: `src/*.ts` 6ファイル / 合計 45行

### フェーズ3: 実装・検証【本編】（見積もり 180分 → 実測 約3分）

計測用ラッパ `workspace/run-tsc.sh` を作り、終了コード・所要時間・エラー行数を各ログ末尾に
`--- meta ---` として追記する形にした。

- [x] TS 5.9.3 で基準値を取る
  - 実行したコマンド: `(cd ts59 && node node_modules/typescript/bin/tsc --noEmit)`
  - 出力（全文 / `ts59-baseline.log`）:
    ```
    --- meta ---
    cmd: (cd ts59 && node node_modules/typescript/bin/tsc --noEmit )
    exit=0
    elapsed_ms=5336
    error_lines=0
    ```
  - **出力ゼロ・終了コード0**。旧世代設定は 5.9 では本当に無警告で通る。基準線として成立

- [x] TS 6.0.3 で deprecation を採る（**予測が外れた箇所**）
  - 出力（全文 / `ts60-baseline.log`）:
    ```
    tsconfig.json(3,15): error TS5107: Option 'target=ES5' is deprecated and will stop functioning in TypeScript 7.0. Specify compilerOption '"ignoreDeprecations": "6.0"' to silence this error.
    tsconfig.json(5,25): error TS5107: Option 'moduleResolution=node10' is deprecated and will stop functioning in TypeScript 7.0. Specify compilerOption '"ignoreDeprecations": "6.0"' to silence this error.
      Visit https://aka.ms/ts6 for migration information.
    tsconfig.json(6,5): error TS5101: Option 'baseUrl' is deprecated and will stop functioning in TypeScript 7.0. Specify compilerOption '"ignoreDeprecations": "6.0"' to silence this error.
      Visit https://aka.ms/ts6 for migration information.
    tsconfig.json(10,5): error TS5101: Option 'downlevelIteration' is deprecated and will stop functioning in TypeScript 7.0. Specify compilerOption '"ignoreDeprecations": "6.0"' to silence this error.
    tsconfig.json(11,24): error TS5107: Option 'esModuleInterop=false' is deprecated and will stop functioning in TypeScript 7.0. Specify compilerOption '"ignoreDeprecations": "6.0"' to silence this error.
    --- meta ---
    exit=2
    elapsed_ms=1117
    error_lines=5
    ```
  - **予測との食い違い（記事の山場）**: 「TS6は警告付きで通る（exit 0）」と予測したが、実際は
    `error` として出て **exit=2 で落ちる**。メッセージ自身も "deprecated" と言いながら
    "to silence this **error**" と書いている。deprecation = 非致命、という思い込みが崩れた
  - エラーコードが2種類に分かれている点も予測外: **値が問題なら `TS5107`（`target=ES5` のように
    `オプション=値` 表記）、オプションの存在自体が問題なら `TS5101`（`baseUrl` / `downlevelIteration`）**
  - **型エラーが1件も出ていない**（`src/` 由来の行がゼロ）。設定エラーで型チェックに到達していない

- [x] TS 7.0.2 でハードエラー全文を採る
  - 出力（全文 / `ts70-baseline.log`）:
    ```
    tsconfig.json(3,15): error TS5108: Option 'target=ES5' has been removed. Please remove it from your configuration.
    tsconfig.json(5,25): error TS5108: Option 'moduleResolution=node10' has been removed. Please remove it from your configuration.
    tsconfig.json(6,5): error TS5102: Option 'baseUrl' has been removed. Please remove it from your configuration.
      Use '"paths": {"*": ["./*"]}' instead.
    tsconfig.json(8,18): error TS5090: Non-relative paths are not allowed. Did you forget a leading './'?
    tsconfig.json(10,5): error TS5102: Option 'downlevelIteration' has been removed. Please remove it from your configuration.
    tsconfig.json(11,24): error TS5108: Option 'esModuleInterop=false' has been removed. Please remove it from your configuration.
    --- meta ---
    exit=1
    elapsed_ms=364
    error_lines=6
    ```
  - 観察1: エラーコードが **TS5101→TS5102 / TS5107→TS5108** と1つずつ繰り上がっている
    （deprecated → removed の対応関係が番号に現れている）
  - 観察2: **終了コードが TS6 は 2、TS7 は 1**。同じ「設定エラーで落ちた」でも値が違う。
    `if [ $? -eq 2 ]` のような判定を書いていると TS7 で挙動が変わる
  - 観察3: TS7 だけ `TS5090`（`paths` の非相対パス）が増えて 6件。TS6 は `baseUrl` を
    deprecated と言うだけで `paths` の中身までは見ていない
  - 観察4: **TS7 でも型エラーはゼロ行**。設定エラーで型チェックに到達しないのは6.0と同じ
  - 記事に書きたい気づき: エラー全文が「何をどう直せばいいか」まで書いてある
    （`baseUrl` は `Use '"paths": {"*": ["./*"]}' instead.`、`TS5090` は `Did you forget a leading './'?`）。
    TS7 の設定エラーは**メッセージを読むだけで直せる**設計になっている

- [x] 3世代の対応表を作る → 下記「設定 → 3世代での扱い 対応表」

- [x] エラーを1件ずつ潰して TS7 で終了コード0まで持っていく
  - 1回の変更＝1つの設定を守り、毎回残りエラー件数を記録した（`ts70-step0..8-*.log`）

  | step | 変更内容 | 残りエラー件数 | exit |
  |---|---|---|---|
  | 0 | （初期状態） | 6 | 1 |
  | 1 | `"target": "es5"` → `"es2022"` | 5 | 1 |
  | 2 | `"moduleResolution": "node"` を削除 | 4 | 1 |
  | 3 | `"baseUrl": "."` を削除 | 3 | 1 |
  | 4 | `"downlevelIteration": true` を削除 | 2 | 1 |
  | 5 | `"esModuleInterop": false` を削除 | 1 | 1 |
  | 6 | `paths` を `["src/lib/*"]` → `["./src/lib/*"]` | **1 → 6（増えた）** | 1 |
  | 7 | `"types": ["node"]` を追加 | 3 | 1 |
  | 8 | `src/loose.ts` を strict 対応に修正（コード側） | **0** | **0** |

  - **単調減少しなかった瞬間（step 6）の出力全文**（`ts70-step6-paths-relative.log`）:
    ```
    src/interop.ts(2,23): error TS2591: Cannot find name 'path'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
    src/loose.ts(2,24): error TS7006: Parameter 'n' implicitly has an 'any' type.
    src/loose.ts(7,10): error TS18048: 'items' is possibly 'undefined'.
    src/loose.ts(10,5): error TS2322: Type 'null' is not assignable to type 'string'.
    src/node-env.ts(2,22): error TS2591: Cannot find name 'process'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
    src/node-env.ts(3,20): error TS2591: Cannot find name 'process'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
    --- meta ---
    exit=1
    elapsed_ms=1196
    error_lines=6
    ```
    → 最後の**設定エラー1件を潰した瞬間に、隠れていた型エラー6件が一斉に現れた**。
    エラー件数は 6 → 5 → 4 → 3 → 2 → 1 → **6** と跳ね返る
  - **予測が外れた点**: 「`baseUrl` を消すと `paths` 解決が全滅する」と予測したが、実際は
    step 3 で `baseUrl` を消しても `paths` 由来の新規エラーは出なかった。`TS5090` は
    step 0 の時点から出ており、`baseUrl` の有無と無関係だった。
    **TS7 の `paths` は `baseUrl` に依存せず、tsconfig の位置基準で解決される**
  - つまずいた理由・分かっていなかった前提: `baseUrl` は「`paths` の基準点」だと思っていたが、
    TS7 では `paths` の値を `./` 始まりの相対パスにすれば基準点は不要になっていた
  - 最終 tsconfig の diff（`tsconfig-before.json` → `tsconfig-after.json`）:
    ```diff
     {
       "compilerOptions": {
    -    "target": "es5",
    +    "target": "es2022",
         "module": "commonjs",
    -    "moduleResolution": "node",
    -    "baseUrl": ".",
         "paths": {
    -      "@lib/*": ["src/lib/*"]
    +      "@lib/*": ["./src/lib/*"]
         },
    -    "downlevelIteration": true,
    -    "esModuleInterop": false,
    -    "outDir": "dist"
    +    "outDir": "dist",
    +    "types": ["node"]
       },
       "include": ["src"]
     }
    ```
  - 最終確認（`ts70-final.log`）: `exit=0` / `error_lines=0`

- [x] `strict` 既定ONで出た型エラーを分類する
  - **設定エラーと型エラーは別カウントすべき**（同じ fixture で、設定エラーを潰すまで型エラーは0件と表示される）

  | 分類 | エラーコード | 件数 | 由来 |
  |---|---|---|---|
  | 設定エラー | TS5108 / TS5102 / TS5090 | 6 | TS7 の removal（TS6では TS5107/TS5101 で5件） |
  | 型エラー（`types: []` 由来） | TS2591 | 3 | **TS6.0 からの既定変更**。TS7固有ではない |
  | 型エラー（`strict` 由来） | TS7006 / TS18048 / TS2322 | 3 | **TS6.0 からの既定変更**。TS7固有ではない |

  - TS7006 = 暗黙の any / TS18048 = possibly 'undefined' / TS2322 = null 非代入 / TS2591 = 名前が見つからない（node型）
  - 逃げ道の比較: `"strict": false` を入れると TS7006/TS18048/TS2322 が消えて exit 0 になる
    （`ts70-alt-strict-false.log`）。ただし本検証の本線は**コード側を直す**方を最終形にした

### フェーズ4: 深掘り・比較（見積もり 90分 → 実測 約2分）

- [x] `ignoreDeprecations: "6.0"` が TS7 で通用するか（**読者の需要が最も高い箇所**）
  - TS 6.0.3 に入れた場合（`ts60-ignoredep.log`）: **deprecation 5件がすべて消えた**。
    そして代わりに隠れていた型エラー6件が出た:
    ```
    src/interop.ts(2,23): error TS2591: Cannot find name 'path'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
    src/loose.ts(2,24): error TS7006: Parameter 'n' implicitly has an 'any' type.
    src/loose.ts(7,10): error TS18048: 'items' is possibly 'undefined'.
    src/loose.ts(10,5): error TS2322: Type 'null' is not assignable to type 'string'.
    src/node-env.ts(2,22): error TS2591: Cannot find name 'process'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
    src/node-env.ts(3,20): error TS2591: Cannot find name 'process'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
    --- meta ---
    exit=2
    ```
  - TS 7.0.2 に入れた場合（`ts70-ignoredep.log`）: **6件のエラーが1件も減らない**（exit=1 のまま）
    ```
    tsconfig.json(3,15): error TS5108: Option 'target=ES5' has been removed. Please remove it from your configuration.
    tsconfig.json(5,25): error TS5108: Option 'moduleResolution=node10' has been removed. Please remove it from your configuration.
    tsconfig.json(6,5): error TS5102: Option 'baseUrl' has been removed. Please remove it from your configuration.
      Use '"paths": {"*": ["./*"]}' instead.
    tsconfig.json(9,9): error TS5090: Non-relative paths are not allowed. Did you forget a leading './'?
    tsconfig.json(12,5): error TS5102: Option 'downlevelIteration' has been removed. Please remove it from your configuration.
    tsconfig.json(13,24): error TS5108: Option 'esModuleInterop=false' has been removed. Please remove it from your configuration.
    ```
  - **予測との違い**: 「オプション自体が未知として弾かれる」と予測したが外れた。
    TS7 は `ignoreDeprecations` を**未知オプションとして怒りもしない代わりに、何の効果もない**。
    エラーメッセージも「この逃げ道はもう無い」とは言ってくれない
  - 記事に書きたい気づき: **これがTS6とTS7の本質的な差**。TS6 は「落ちるが逃げ道がある」、
    TS7 は「落ちて逃げ道が無い」。移行を先延ばしにできる期限が `ignoreDeprecations` の寿命

- [x] `types: []` 既定と `@types/node` の関係（3版でA/B）
  - 同一 fixture・`types` 未指定・`@types/node@22.18.13` インストール済みで比較:

  | 版 | `types` 未指定 | 結果 | ログ |
  |---|---|---|---|
  | 5.9.3 | 自動探索される | **exit=0 / エラー0件** | `probe-ts59-types-removed.log` |
  | 6.0.3 | 自動探索されない | exit=2 / **TS2591 が3件** | `probe-ts60-types-removed.log` |
  | 7.0.2 | 自動探索されない | exit=1 / **TS2591 が3件** | `probe-types-removed.log` |

  - `"types": ["node"]` を明示すると 6.0 / 7.0 とも TS2591 が3件とも消える（step7 で確認済み）
  - **`@types/node` を入れているのに `process` が見つからない、は 6.0 で始まった挙動**であり、
    TS7 の新機能ではない。ここを取り違えている解説が多い
  - エラーメッセージ自身が対処を書いている: ``Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.``
    （すでに入れている人には後半の "add 'node' to the types field" が答え）

- [x] `alwaysStrict: false` を単独プローブ（`probe-alwaysStrict-false.log`）
  ```
  tsconfig.json(14,21): error TS5108: Option 'alwaysStrict=false' has been removed. Please remove it from your configuration.
  exit=1
  ```
  → `esModuleInterop: false` と同じく **`false` を明示すること自体が禁止**（TS5108）

- [x] 型チェック所要時間を3世代で比較（各版5回 / 同一 tsconfig・同一 src で公平化）
  - 計測前に3版とも `exit=0` になる状態に揃えた（エラー有無で経路が変わるのを避けるため）
  - **生データ（ms）**:

  | 版 | 1 | 2 | 3 | 4 | 5 | 中央値 | 最小 |
  |---|---|---|---|---|---|---|---|
  | 5.9.3 | 5336 | 5610 | 5223 | 5550 | 5478 | **5478** | 5223 |
  | 6.0.3 | 5629 | 5598 | 5333 | 5563 | 5525 | **5563** | 5333 |
  | 7.0.2 | 1393 | 1343 | 1289 | 1322 | 1173 | **1322** | 1173 |

  - 中央値比: 5.9.3 / 7.0.2 = **約4.1倍**、6.0.3 / 7.0.2 = **約4.2倍**
  - `--singleThreaded` を1回: **1643ms**（通常の中央値1322msより遅いが、桁は変わらない）
  - 題材の規模: `src/*.ts` **6ファイル / 45行**
  - **予測が外れた点**: 「題材が小さすぎてプロセス起動が支配的、差は出ない」と予測したが、
    45行の題材でも **4倍の差が出た**。5.9 と 6.0 の間にはほぼ差がない（同じJS実装なので当然）ため、
    差はGo実装ネイティブ化そのものに由来する
  - ただし**公称の8〜12倍には届かない**。45行のプロジェクトで5秒かかっている時点で、
    測っているのは自分のコードではなく **`lib.*.d.ts` と `@types/node` の読み込み＋起動コスト**が主。
    そこがネイティブ化で速くなった分が4倍として現れた、という読み方が妥当
  - 記事に書くときの限定: 「6ファイル45行という極小の題材での参考値」と明記する。数字は盛らない

- [x] side-by-side 併用を公式推奨のエイリアス構成で再検証（前回記事の宿題）
  - 4つ目の隔離ディレクトリ `sbs/` で実施
  - 実行したコマンド:
    ```bash
    npm i -D --ignore-scripts --no-audit --no-fund \
      "@typescript/native@npm:typescript@^7.0.2" \
      "typescript@npm:@typescript/typescript6@^6.0.2"
    ```
  - `package.json` の devDependencies:
    ```json
    {
      "@typescript/native": "npm:typescript@^7.0.2",
      "typescript": "npm:@typescript/typescript6@^6.0.2"
    }
    ```
  - `ls -l node_modules/.bin/` の出力全文（**前回記事との差分がここ**）:
    ```
    tsc -> ../@typescript/native/bin/tsc
    tsc6 -> ../typescript/bin/tsc6
    tsserver -> ../@typescript/old/bin/tsserver
    ```
  - 各 bin の版検証:
    ```
    ./node_modules/.bin/tsc --version   → Version 7.0.2
    ./node_modules/.bin/tsc6 --version  → Version 6.0.3
    ```
  - **前回の bin 衝突は再現しなかった＝公式構成では解決している**。理由が構造から分かった:
    - `@typescript/typescript6` が提供する bin は **`tsc6` だけで、`tsc` が無い**
      （`ls node_modules/typescript/bin/` → `tsc6` のみ）。だから `tsc` の名前を奪い合わない
    - `@typescript/old`（= `typescript@6.0.3` の実体）は依然として存在するが、
      `.bin/tsc` ではなく **`.bin/tsserver` の供給元**になっている。
      これは ts70 単体で観察した「TS7 は tsserver を持たない」と辻褄が合う
  - 実際に両方で型チェック（同一 fixture / TS7を通った最終tsconfig）:
    ```
    ./node_modules/.bin/tsc --noEmit   → exit=0
    ./node_modules/.bin/tsc6 --noEmit  → exit=0
    ```
  - 依存グラフの観察: `@typescript/native@npm:typescript@7.0.2` は20個のプラットフォーム別
    optionalDependencies を持ち、実環境（darwin-arm64）以外はすべて `UNMET OPTIONAL DEPENDENCY`。
    `npm ls` の出力が UNMET だらけになるが**これは正常**（見た目に驚くポイント）
  - 記事に書きたい気づき: 前回「素の同居」で踏んだ衝突は、**公式が bin 名を `tsc6` に分けることで
    設計として回避していた**。同居させたいなら自己流で `npm i typescript@6 typescript@7` せず、
    公式のエイリアス構成をそのまま使う

### フェーズ5: 振り返り（見積もり 45分 → 実測 記録作成に集約）

- [x] 「移行を止める条件」の整理 → 下記セクション
- [x] 記事への写像を実績で埋める → 下記セクション

## 設定 → 3世代での扱い 対応表（全行が実測ログ裏付き）

| 設定 | TS 5.9.3 | TS 6.0.3 | TS 7.0.2 | 予測は当たったか |
|---|---|---|---|---|
| `"target": "es5"` | 無警告で通る | `error TS5107`（`ignoreDeprecations` で抑制可） | `error TS5108` removed | △ TS6が「警告」でなく error だった |
| `"moduleResolution": "node"` | 無警告で通る | `error TS5107`（node10 と表示） | `error TS5108` removed | △ 同上 |
| `"baseUrl": "."` | 無警告で通る | `error TS5101` | `error TS5102` removed | △ 同上 |
| `paths` の非相対値 `["src/lib/*"]` | 通る | **指摘なし** | `error TS5090` 非相対パス禁止 | ✗ 予測になかった。TS7だけが値まで見る |
| `"downlevelIteration": true` | 無警告で通る | `error TS5101` | `error TS5102` removed | △ |
| `"esModuleInterop": false` | 無警告で通る | `error TS5107` | `error TS5108` removed | △ |
| `"alwaysStrict": false` | 通る | （未計測） | `error TS5108` removed | ○ |
| `"module": "commonjs"` | 通る | 通る | **通る** | ○ 廃止されていない |
| `strict` 未指定 | 非strict（型エラー0） | strict 既定ON → TS7006/TS18048/TS2322 | 同左 | ○ TS6由来と特定できた |
| `types` 未指定 + `@types/node` | 自動探索され通る | `types: []` 既定 → TS2591 ×3 | 同左 | ○ TS6由来と特定できた |
| `ignoreDeprecations: "6.0"` | — | **効く**（5件すべて抑制） | **無視される**（エラー据え置き・警告も無し） | ✗ 「未知オプションで弾かれる」と予測して外した |
| 終了コード（設定エラー時） | 0 | **2** | **1** | ✗ 予測していなかった差 |
| `tsserver` バイナリ | あり | あり | **無い** | ✗ 予測していなかった |

### 予測 vs 実測のまとめ（記事の山場）

| 外した予測 | 実際 |
|---|---|
| TS6 は deprecation 警告で **exit 0** で通る | `error` として出て **exit 2 で落ちる**。TS7を待たずTS6で既に止まる |
| `baseUrl` を消すと `paths` 解決が全滅する | 全滅しない。`paths` は `baseUrl` に依存しない。別軸で `TS5090`（非相対）を怒られる |
| `ignoreDeprecations` は TS7 で未知オプションとして弾かれる | 弾かれない。**黙って無視される**（一番タチが悪い） |
| 題材が小さすぎて速度差は出ない | 45行でも **約4.1倍**出た（ただし公称8〜12倍には届かない） |
| — （予測していなかった） | 終了コードが 6.0=2 / 7.0=1 と違う |
| — （予測していなかった） | TS7 の `typescript` パッケージに `tsserver` が無い |
| 当たった予測 | `strict` / `types: []` は **TS6由来でTS7固有ではない**（＝この記事の主張の核）を実測で確定できた |

## 詰まった点と解決過程

| # | 詰まった点 | 原因 | 効いた対処 | 所要 | 解決/撤退 | 記事での活かし方 |
|---|---|---|---|---|---|---|
| 1 | 計測スクリプトが `(eval):10: bad math expression: operator expected at 'N'` で落ち、終了コードと所要時間が全部欠測 | macOS の `date` は GNU 拡張の `%3N`（ミリ秒）に非対応で、`date +%s%3N` が `1769...N` を返す | `python3 -c 'import time;print(int(time.time()*1000))'` に置換し、`run-tsc.sh` に切り出した | 約2分 | 解決 | 「macOSでミリ秒計測」の定番の罠。検証ログを取る記事なら1コラムになる |
| 2 | TS6 の出力を見て「warning が出るはず」の前提が崩れ、検証設計の言葉を組み替える必要が出た | deprecation を warning と決めつけていた。実際は `error` + exit 2 | 設計を変えず、**外れた予測をそのまま記録**する方針に切り替えた | 約1分 | 解決 | **記事の核**。予測を外した過程ごと書く |
| 3 | TS6/TS7 とも型エラーが1件も出ず、strict/types の検証ができない状態になった | 設定エラーで型チェックに到達しないため（事前に想定していた詰まりポイント#4が的中） | TS6 は `ignoreDeprecations: "6.0"` で設定エラーを黙らせ、TS7 は設定を1件ずつ潰して到達させた | 約2分 | 解決 | 「エラーN件」の数え方の落とし穴。設定エラーと型エラーは別カウントすべき |
| 4 | side-by-side の `sbs/` で `error TS2688: Cannot find type definition file for 'node'` | `sbs/` にだけ `@types/node` を入れ忘れた（`types: ["node"]` は tsconfig に入っている） | `npm i -D @types/node@22.18.13` を追加 | 約1分 | 解決 | `types: ["node"]` を書いたのに型定義が無いと **TS2591 ではなく TS2688** になる、という区別 |

- **knowledge への記録は行っていない**: #1 は macOS の `date` 仕様、#2〜#3 は本検証の題材そのもの
  （＝ここに書くのが本体）、#4 は自分の入れ忘れで、いずれも「未記録の再発しうる環境トラブル」に
  当たらないと判断した。既存の `knowledge/2026-07-05-npx-tsc-resolves-squatter-package.md`
  （`npx tsc` を使わない）は**事前に適用**しており、全実行で `node node_modules/typescript/bin/tsc`
  を直接叩いたため、当該トラブルは再発しなかった

## スクリーンショット一覧

なし（0枚）。本検証はCLI完結でブラウザ表示を伴わないため、対象タスクの「完了確認の方法: すべて
CLI 出力。Playwright は不要」に従い Playwright を使用していない。完了確認の証拠はすべて
`workspace/*.log` のテキスト（終了コード付き）。記事にはターミナル出力をコードブロックで貼る。

## 記事への写像（実績で埋める）

| 記事の見出し | 使う記録 | 書くこと（メモ） |
|---|---|---|
| 1. はじめに（`latest` がもう7.0.2） | `workspace/registry-check.log` の dist-tags 全文 | `npm i -D typescript` で今はTS7が入る。移行は「先の話」ではない |
| 2. 調べたら前提が間違っていた（既定値変更はTS6の話） | `predictions.md` + 対応表の `strict`/`types` 行 + `probe-ts59/60-types-removed.log` の3版A/B | **主張の核**。`strict`/`types: []` は6.0の変更で、TS7固有ではないことを3版の実測で示す |
| 3. 検証設計（なぜ3版を別ディレクトリに分けたか） | `versions.txt`（GATE OK×3）+ `ls -l node_modules/.bin/` | 前回のbin衝突を引き、版ゲートを置いた理由。「測る前に版を機械検証する」 |
| 4. 旧世代 tsconfig fixture | `workspace/fixture/`（tsconfig 全文 + `src/*.ts` 6本45行） | 仕込んだ罠の一覧表。1罠1ファイルにした設計判断 |
| 5. TS 5.9 では通る（基準線） | `ts59-baseline.log`（exit=0 / error_lines=0） | 出力ゼロ。基準線が成立していることの確認 |
| 6. TS 6.0 は「警告」ではなく落ちる ← **見出しを変更** | `ts60-baseline.log` 全文（TS5107/TS5101 ×5 / exit=2） | 元の見出し案「TS6.0は警告で通す」は実測と食い違うので改題。deprecation が error で exit 2 |
| 7. TS 7.0 で何がハードエラーになったか | `ts70-baseline.log` 全文（TS5108/TS5102/TS5090 ×6 / exit=1） | エラー全文。番号が5101→5102 / 5107→5108 に繰り上がる話。終了コードが2→1に変わる話 |
| 8. 設定 → 3世代での扱い 対応表 | 本ログの対応表 + 「予測 vs 実測」表 | 表そのもの。外した予測4件を隠さず載せる |
| 9. 1件ずつ潰して通すまで（件数は単調減少しない） | step0〜8 の推移表 + `ts70-step6-paths-relative.log` 全文 | **1→6 に跳ね返る瞬間**が図になる。`baseUrl` 削除で `paths` が壊れなかった予測外し |
| 10. strict既定ONの型エラー内訳 | 設定/型エラー別カウント表（TS7006/TS18048/TS2322/TS2591） | コード別件数。**TS7固有ではない**と明記。件数の数え方（設定と型を分ける）も書く |
| 11. `ignoreDeprecations` はTS7で効くのか | `ts60-ignoredep.log` / `ts70-ignoredep.log` 全文 | TS6では5件全部消える / TS7では**黙って無視**。「落ちるが逃げ道あり」→「逃げ道なし」が本質差 |
| 12. 型チェックは本当に速いのか | 5回×3版の生データ表 + `--singleThreaded` 1643ms | 約4.1倍。**6ファイル45行の参考値**と限定を明記。公称8〜12倍には届かない、と正直に書く |
| 13. side-by-side 併用の続報 | `sbs/` の `.bin/` 全文 + `tsc`=7.0.2 / `tsc6`=6.0.3 + 両方 exit=0 | 前回記事の宿題への回答。`tsc6` に bin 名を分けることで設計的に衝突回避されている |
| 14. 移行を止める条件 | 下記「移行を止める条件」 | TS7に `tsserver` が無い実測、埋め込み言語未対応、typescript-eslintクラッシュ |
| 15. まとめ（どんなプロジェクトなら上げてよいか） | 下記判定リスト | 断定を避け、判断材料の提示に留める |

> 記事タイトル案は、実測を踏まえると **「TypeScript 6で『警告』だと思っていた設定は、6の時点で既に
> ビルドを止めていた」** 系が一番実態に合う（元案1の「7で何個ハードエラーになったか」は、
> TS6も落ちる事実を落としてしまうため要調整）。

## 移行を止める条件（フェーズ5の整理 / 実測＋既存の一次情報）

**上げてよい判断材料**
- `tsc --noEmit` / `tsc` によるビルドだけで完結している（本検証は6ファイルで exit 0 まで到達できた）
- 設定の直し方はエラーメッセージがそのまま教えてくれる（`Use '"paths": ...' instead.` 等）
- 型チェックは実測で約4倍速い

**上げてはいけない / 保留すべき判断材料**
- **`tsserver` が同梱されない**（本検証で `ls node_modules/.bin/` により実測）。エディタ体験を
  TS7単独で賄えない。公式の side-by-side 構成では `tsserver` が `@typescript/old`（6.0.3）から
  供給されていた ＝ **エディタは実質まだTS6で動く**
- プログラマティックAPI（Compiler API）が 7.0 には無く 7.1 予定 → API依存のツールは動かない
- Vue / Svelte / Astro / MDX / Angularテンプレートなど埋め込み言語は未対応
- `typescript-eslint` が TS7 でクラッシュする（自リポジトリの一次情報:
  `knowledge/2026-07-09-typescript-eslint-typescript7-cjs-crash.md`）。本検証は
  この脱線を避けるため意図的に lint を入れず `tsc` 単体に閉じた
- `ignoreDeprecations` による猶予は **6.0 まで**。7.0 では黙って無視されるので、
  「TS6で警告を消して先送り」した分は**TS7で一括請求される**

## 未達・撤退した項目

なし。撤退ライン（版ゲート15分 / エラー潰し45分 / フェーズ4は任意）はいずれも発動しなかった。
フェーズ1〜5のすべてのチェックボックスを実行済み。

計測を省略した項目（意図的、記事に影響なし）:
- `alwaysStrict: false` の TS 6.0.3 での挙動（TS7 のみプローブ。fixture 本体に入れない方針だったため）
- `moduleResolution: classic` / `module: amd,umd,systemjs,none`（フェーズ1で「入れない」と決めて記録済み）

## 再現性メモ（記事に転記する用）

- OS / ランタイム: macOS 26.5 (Build 25F71, arm64) / Node v22.17.0 / npm 10.9.2
- 主要ライブラリ: typescript 5.9.3 / 6.0.3 / 7.0.2、@types/node 22.18.13、@typescript/typescript6 6.0.2
- 最短の再現手順:
  ```bash
  mkdir -p ts70 && cd ts70
  npm init -y && npm pkg set private=true
  npm i -D --save-exact typescript@7.0.2 @types/node@22.18.13
  # 版ゲート（npx tsc は使わない）
  node node_modules/typescript/bin/tsc --version   # → Version 7.0.2
  # 旧世代 tsconfig を置いて
  node node_modules/typescript/bin/tsc --noEmit; echo "exit=$?"
  ```
- 注意点:
  - **`npx tsc` を使わない**。npm に同名スクワッター `tsc@2.0.4` があり別パッケージに解決される
    （`knowledge/2026-07-05-npx-tsc-resolves-squatter-package.md`）。
    必ず `node node_modules/typescript/bin/tsc` を直接叩く
  - **複数版を1つの `node_modules` に同居させない**。比較するなら版ごとにディレクトリを分け、
    実行前に `--version` を `grep -q` で機械検証する（版ゲート）
  - 同居させたい場合は自己流でなく公式のエイリアス構成
    （`@typescript/native` = TS7 / `typescript` = `@typescript/typescript6`、bin は `tsc` と `tsc6`）を使う
  - **終了コードは版で違う**。設定エラー時に 6.0 は `2`、7.0 は `1` を返す。CIで `$?` を
    値で判定していると挙動が変わる
  - macOS の `date` は `%3N`（ミリ秒）非対応。時間計測は `python3 -c 'import time;...'` などで行う
  - `npm ls` で TS7 のプラットフォーム別 optionalDependencies が `UNMET OPTIONAL DEPENDENCY`
    と大量に出るのは正常
  - 測定値（約4.1倍）は **6ファイル45行**という極小題材での参考値。実プロジェクトの値ではない

## 次のアクション（記事化）

- [ ] この execution-log.md の「記事への写像」に沿って `articles/<slug>.md` を作成する（`/draft-article`）
- [ ] 見出し6・記事タイトルは「TS6は警告で通る」前提を捨てた形に改題する
- [ ] スクショは無いので、ターミナル出力のコードブロックと2つの表（推移表 / 対応表）を図の代わりにする
