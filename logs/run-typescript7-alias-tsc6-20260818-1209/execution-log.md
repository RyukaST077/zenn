# 検証ログ: TypeScript 7.0 GA に上げて、typescript-eslint を生かしたまま `tsc` だけ速くする（`@typescript/typescript6` 併用構成）

> Zenn記事の素材。実行の一次情報（コマンド・エラー全文・所要時間・スクショ）を記録。
> 記事本文は未執筆。「記事への写像」を見て articles/*.md に展開する。

## 実行の前提（採用した前提）

- 対象タスク: `practice/practice-typescript7-alias-tsc6-20260818-1205.md`
- 出典レポート: `research/search-topic-20260818-1200.md`
- 対象技術: TypeScript 7.0.2（Goネイティブ `tsc`）/ `@typescript/typescript6` 6.0.2 / typescript-eslint 8.67.0 / ESLint 10.8.1
- 実行者: AIエージェント単独（非対話） <!-- 内部メタ: 記事に転記しない -->
- 実行日時 / 所要時間: 2026-08-18 12:09〜12:21 / 見積もり 7.0h → 実測 約0.2h（12分） <!-- 実測はAI単独の値。記事にそのまま書かない -->
- 実行環境: macOS 26.5（Darwin 25.5.0）arm64 / Apple Silicon・論理10コア / Node v22.17.0 / npm 10.9.2 / pnpm 10.13.1
- 採用した撤退ライン: 対象タスクの記載どおり（1タスク30分で撤退。fixture が1秒未満なら重くする。構成Cの install が通らなければA/Bの比較で成立させる）
- 判断方針: 引数で渡されたのは対象タスクファイルのパスのみ。実行時間・撤退ライン・成果物置き場は未指定のため、
  対象タスクの記載（1日 / 30分撤退）とSkillのデフォルト（`logs/run-<slug>-<日時>/`）を採用した。
- 成果物コードの置き場: fixture 本体は `fixtures/typescript7-alias-tsc6/`（対象タスクの指定）、
  記事に貼る抜粋と3構成の `package.json` は `logs/run-typescript7-alias-tsc6-20260818-1209/workspace/`

## 結果サマリー

- **完了条件の判定: 達成（5/5）**
- 作ったもの: 型チェックに約3.5秒かかる自作TS fixture（203ファイル / 13,841行）と、構成A/B/C の計測・破壊レポート
  - `fixtures/typescript7-alias-tsc6/`（生成器 `gen.mjs` + `src/` + `tsconfig.json` + `eslint.config.js` + `report.html`）
- スクショ: 1枚（`screenshots/01-benchmark.png`、`images/typescript7-alias-tsc6/benchmark.png` にコピー済み）
- 詰まった点: 4件（うち解決 4 / 未解決・撤退 0）
- knowledge 記録: `knowledge/2026-08-18-typescript7-eslint-alias-side-by-side.md`（`INDEX.md` にも追記）

### 一行でいうと

**`tsc` は素直に上げるだけで 9.3倍速くなったが、その瞬間に `eslint` が1件も走らなくなる。公式の alias 併用構成に書き換えると、9.3倍と lint 完全一致が両立した。前回止まった bin 衝突も alias 構成では起きなかった。**

## 完了条件の検証

| # | 完了条件 | 判定 | 根拠（ログ / スクショ） |
|---|---|---|---|
| 1 | 構成A/B/C それぞれで `tsc --noEmit` の実測秒数（3回ずつ）がログに残っている | **達成** | `commands.log`「PHASE2 構成A ベースライン: tsc」「PHASE3: 構成B の tsc 計測」「PHASE3: 構成C … 1) 型チェック」 |
| 2 | 構成B で `eslint .` が失敗したエラー全文が保存されている | **達成** | `eslint-ts7.log`（全文。`Error: typescript-eslint does not support TS 7.0.`） |
| 3 | 構成C で「`tsc` が 7.0.2 を名乗り、かつ `eslint .` が構成Aと同じ結果を返す」が両立するか否かの判定が出ている | **達成（両立した）** | `tsc --version` = `Version 7.0.2` / `eslint .` = `7 problems (7 errors, 0 warnings)`（構成Aと完全一致） |
| 4 | `ls -l node_modules/.bin/tsc*` と各バイナリの `--version` 出力が3構成ぶん残っている | **達成** | 構成A/B/C すべて `commands.log` に記録。**前回の bin 衝突は解消**（下記「詰まった点 #3」） |
| 5 | 3構成の比較表をローカルHTMLに出力し、Playwright のスクショが `images/` に保存されている | **達成** | `screenshots/01-benchmark.png` → `images/typescript7-alias-tsc6/benchmark.png` |

## 計測記録シート（実測で確定）

実行環境: OS **macOS 26.5 / Darwin 25.5.0 arm64** / CPU **Apple Silicon（論理コア数 10）** / Node **v22.17.0** / npm **10.9.2** / 実行日 **2026-08-18**

fixture: 自作TS **203ファイル / 13,841行**、`strict: true` / `noEmit` / `module: nodenext` / `skipLibCheck: true`
（TS6.0.3 の `--extendedDiagnostics`: Types 309,849 / Instantiations 1,843,316 / Check time 3.19s）

| 構成 | `tsc --version` | `tsc --noEmit` 1回目 | 2回目 | 3回目 | `eslint .` の結果 | 備考 |
|---|---|---|---|---|---|---|
| A: TS 6.0.3 | `Version 6.0.3` | **3.478s** | 3.535s | 3.424s | 7 errors（8.5s） | ベースライン。`.bin/tsc -> ../typescript/bin/tsc` |
| B: TS 7.0.2 単純アップ | `Version 7.0.2` | **0.365s** | 0.357s | 0.367s | **起動不能**（0.17s で throw） | install は ERESOLVE **警告のみで成功**してしまう |
| C: alias 併用 | `Version 7.0.2` | **0.392s** | 0.362s | 0.367s | 7 errors（8.9s）**Aと完全一致** | `.bin/tsc -> ../@typescript/native/bin/tsc` |
| C の `tsc6` | `Version 6.0.3` | 3.447s | — | — | — | `.bin/tsc6 -> ../typescript/bin/tsc6` |
| C + `--checkers 1` | 7.0.2 | 1.177s | 1.167s | 1.172s | — | 並列を1に落とすと3.2倍遅い |
| C + `--checkers 2` | 7.0.2 | 0.627s | 0.617s | 0.608s | — | |
| C + `--checkers 8` | 7.0.2 | 0.323s | 0.281s | 0.302s | — | 既定(4)より更に約1.2倍速い |
| C + `--singleThreaded` | 7.0.2 | 1.200s | 1.187s | 1.210s | — | `--checkers 1` とほぼ同値 |
| C（pnpm 10.13.1 で追試） | `Version 7.0.2` | 0.380s | 0.384s | 0.375s | 7 errors（9.3s） | npm と同じ `package.json` でそのまま成功 |

**この fixture での倍率: 3.478s → 0.372s（中央値）= 約 9.3倍速い。**
公式アナウンスの「7.7x〜11.9x」は実プロダクトのコードベースでの値なので、上の数字とは**別のもの**として扱う。

## タスク実行ログ（フェーズ別）

### フェーズ1: 事前調査（見積もり 45分 → 実測 約4分）

- [x] 当日の dist-tags を再取得して版を固定する（見積もり 10分 → 実測 1分）
  - 実行したコマンド:
    ```bash
    npm view typescript dist-tags --json
    npm view @typescript/typescript6 dist-tags --json
    npm view typescript-eslint dist-tags --json
    npm view eslint dist-tags --json
    ```
  - 出力（抜粋・全文は `commands.log`）:
    ```
    typescript:              latest 7.0.2 / rc 7.0.1-rc / beta 6.0.0-beta / next 7.1.0-dev.20260817.1
    @typescript/typescript6: latest 6.0.2
    typescript-eslint:       latest 8.67.0 / canary 8.67.1-alpha.4
    eslint:                  latest 10.8.1 / next 10.0.0-rc.2 / maintenance 9.39.5
    ```
  - 結果: 対象タスクの表と**完全一致**。差分なし。
  - 記事に書きたい気づき: 「記事を書いた日にインストールできた版」を最初に固定しておくと、後日の再現議論が一発で片づく。

- [x] 壊れる根拠をレジストリのメタデータで先に確定させる（見積もり 15分 → 実測 1分）
  - **実行前に書き留めた予測（2つ）**:
    1. `typescript@7.0.2` の `exports["."]` が `./lib/version.cjs` しか無いので、Compiler API を使うツールは全滅する
    2. typescript-eslint の peer は `<6.1.0` なので `npm i -D typescript@7.0.2` は **ERESOLVE エラーで止まる**
  - 実行したコマンド:
    ```bash
    npm view typescript@7.0.2 bin exports engines --json
    npm view typescript@7.0.2 dependencies optionalDependencies --json
    npm view @typescript/typescript6@6.0.2 bin main dependencies --json
    npm view typescript-eslint@8.67.0 peerDependencies --json
    npm view typescript@6.0.3 bin version --json
    ```
  - 出力（要点。全文は `commands.log`）:
    ```
    typescript@7.0.2 bin      = { "tsc": "bin/tsc" }                （tsc6 は入らない）
    typescript@7.0.2 exports  = { ".": "./lib/version.cjs", "./unstable/fs": ..., "./unstable/ast": ...,
                                  "./unstable/sync": ..., "./unstable/async": ..., "./unstable/proto": ...,
                                  "./unstable/ast/is|factory|utils|scanner|visitor|clone": ... }  ← 計13キー
    typescript@7.0.2 engines  = { "node": ">=16.20.0" }
    typescript@7.0.2 の Goバイナリ = @typescript/typescript-<os>-<arch> 20個を
                                     dependencies と optionalDependencies の【両方】に列挙
    @typescript/typescript6@6.0.2 bin  = { "tsc6": "bin/tsc6" }
    @typescript/typescript6@6.0.2 main = ./lib/typescript.js
    @typescript/typescript6@6.0.2 deps = { "@typescript/old": "npm:typescript@^6" }
    typescript-eslint@8.67.0 peer = { "eslint": "^8.57.0 || ^9.0.0 || ^10.0.0",
                                      "typescript": ">=4.8.4 <6.1.0" }
    typescript@6.0.3 bin = { "tsc": "bin/tsc", "tsserver": "bin/tsserver" }
    ```
  - 記事に書きたい気づき: **予測1は当たり、予測2は外れた**（詳細は「詰まった点 #1」）。
    `dependencies` と `optionalDependencies` の両方に同じ20個を書く配布方式は、実物を見ないと分からない。

- [x] 公式アナウンスの該当箇所を読み、alias 構成の JSON をそのまま控える（見積もり 10分 → 実測 1分）
  - 出典: <https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/>
  - 控えた JSON（記事にそのまま引用できる形）:
    ```json
    {
      "devDependencies": {
        "@typescript/native": "npm:typescript@^7.0.2",
        "typescript": "npm:@typescript/typescript6@^6.0.2"
      }
    }
    ```
  - API について: 7.0 は「does not ship with an API」。**7.1 で新しい（別物の）API を出す予定**で、それまでは 6.0 との
    side-by-side 運用を優先する、と書かれている。
  - CLI フラグ:
    - `--checkers` … 型チェックワーカー数（既定 4）。コア数の多い大規模コードベースで効くがメモリを食う
    - `--builders` … `--build` 時のプロジェクト参照ビルダー数。多数プロジェクトの monorepo 向け
    - `--singleThreaded` … 全体を単一スレッドで実行。デバッグ・性能比較・リソース制約向け
  - 7.0 でまだ動かないとされるもの: Vue / MDX / Astro / Svelte / Angular のテンプレート型チェック（埋め込み系）
  - 公式の速度: **7.7x〜11.9x**、メモリ -6%〜-26%、エディタのエラー検出は 17.5秒 → 1.3秒（13倍超）

- [x] 前回の失敗内容を読み返し、「今回どこが変わるはずか」を書く（見積もり 10分 → 実測 1分）
  - 出典: `articles/typescript7-tsc-bin-collision-log.md`（2026-07-11）
  - 前回の事実:
    ```
    typescript@7.0.2 と @typescript/typescript6@6.0.2 を素直に併記 →
    tsc  -> ../@typescript/old/bin/tsc        => Version 6.0.3
    tsc6 -> ../@typescript/typescript6/bin/tsc6 => Version 6.0.3
    （node node_modules/typescript/bin/tsc --version を直叩きすると 7.0.2 は出た）
    ```
  - **今回変わるはずと考えた理由**: 前回は `typescript` という名前を TS7 が占有し、`@typescript/typescript6` の依存先
    `@typescript/old`（= `typescript@6.0.3`）も同じ `tsc` という bin 名を持っていたため、`.bin/tsc` の取り合いが起きた。
    公式 alias 構成では TS7 を **`@typescript/native` という別名**に置き、`typescript` の名前は
    `@typescript/typescript6` に譲る。名前が衝突しなくなるので `.bin/tsc` は `@typescript/native` を指すはず。
  - → この予測は**当たった**（「詰まった点 #3」）。

### フェーズ2: 環境構築 ＋ 構成A（見積もり 60分 → 実測 約6分）

- [x] fixture プロジェクトを作る（見積もり 25分 → 実測 4分）
  - 実行したコマンド:
    ```bash
    mkdir -p fixtures/typescript7-alias-tsc6 && cd $_
    npm init -y && npm pkg set private=true && npm pkg set type=module
    node gen.mjs 200 90     # 生成器で src/ を作る
    ```
  - 生成物: `src/types.ts`（再帰的条件型ユーティリティ）＋ `src/mod0..199.ts` ＋ `src/index.ts` ＋ `src/lint-violations.ts`
    = **203ファイル / 13,841行**
  - 重くするために入れたもの（`workspace/types.ts`, `workspace/mod0.sample.ts` に実物あり）:
    - 再帰的条件型: `Split<S,D>` / `CamelCase<S>` / `DeepPartial<T>` / `DeepReadonly<T>` / `Paths<T,D>` / `PathValue<T,P>`
    - `UnionToIntersection<U>` を **90要素の union** に適用（`Merged${i}`）
    - 90メンバーの文字列リテラル union を key remapping で回す mapped type（`Camel${i}`）
    - テンプレートリテラル型 `` `${n}:${string}` `` を持つネストした interface
  - **タイムボックス内で3回作り直した**（下記「詰まった点 #2」）。最終形が 200モジュール × 90 union。
  - つまずいた理由・分かっていなかった前提: 「重い fixture」は**型チェックだけ重ければいい訳ではない**。
    型情報つき lint は同じ型を全部 JS ヒープに載せるので、tsc が耐える規模でも eslint が先に死ぬ。
  - 記事に書きたい気づき: `--extendedDiagnostics` の `Instantiations` を見ながら調整すると、闇雲に増やすより早い。

- [x] 構成A（TS6 + typescript-eslint）を入れて lint 設定を通す（見積もり 20分 → 実測 1分）
  - 実行したコマンド:
    ```bash
    export npm_config_cache="$PWD/npm-cache"   # cache を作業ディレクトリに隔離
    npm i -D --save-exact --ignore-scripts --no-audit --no-fund \
      typescript@6.0.3 typescript-eslint@8.67.0 eslint@10.8.1
    ```
  - 出力:
    ```
    added 87 packages in 3s
    ```
    peer 警告は**一切出ない**（6.0.3 は `>=4.8.4 <6.1.0` の範囲内）。
  - `npm ls --depth=0`:
    ```
    ├── eslint@10.8.1
    ├── typescript-eslint@8.67.0
    └── typescript@6.0.3
    ```
  - `ls -l node_modules/.bin/tsc*`:
    ```
    node_modules/.bin/tsc -> ../typescript/bin/tsc
    ```
    （この時点では `tsc` は1つだけ）
  - `eslint.config.js`（型情報つき / `projectService`。全文は `workspace/eslint.config.js`）:
    ```js
    import tseslint from 'typescript-eslint';
    export default tseslint.config(
      { ignores: ['gen.mjs', 'eslint.config.js', 'npm-cache/**', 'node_modules/**', 'shot.mjs'] },
      ...tseslint.configs.recommendedTypeChecked,
      { languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } } },
    );
    ```
  - 詰まった箇所: `eslint.config.js` 自身が `tsconfig.json` の `include` に入っておらず
    `Parsing error: ... was not found by the project service` が1件出た。`ignores` に足して解消。

- [x] ベースラインを計測する（見積もり 15分 → 実測 1分）
  - 実行したコマンド:
    ```bash
    ./node_modules/.bin/tsc --version
    for i in 1 2 3; do time ./node_modules/.bin/tsc --noEmit; done
    ./node_modules/.bin/tsc --noEmit --extendedDiagnostics
    time ./node_modules/.bin/eslint .
    ```
  - 出力:
    ```
    Version 6.0.3
    run 1:  6.96s user 0.23s system 145% cpu 3.478 total
    run 2:  5.08s user 0.20s system 149% cpu 3.535 total
    run 3:  4.88s user 0.18s system 147% cpu 3.424 total

    Types:                      309849
    Instantiations:            1843316
    Memory used:               570562K
    Check time:                  3.19s
    Total time:                  3.49s

    ✖ 7 problems (7 errors, 0 warnings)
    ./node_modules/.bin/eslint .  11.05s user 0.61s system 136% cpu 8.515 total
    ```
  - **初回と2回目以降で差が出ない**（3.478 / 3.535 / 3.424）。`--noEmit` で `incremental` を使っていないため、
    キャッシュ効果はほぼゼロ。3回計測しても値がほぼ動かないのは、逆に比較の土台としては都合がよかった。
  - CPU使用率が **145%** 程度＝10コアのうち実質1.5コアしか使えていない。これが後で効いてくる。

### フェーズ3: 実装・検証【本編】（見積もり 180分 → 実測 約5分）

- [x] 構成B: `typescript@7.0.2` に単純アップグレードして install の反応を見る（見積もり 30分 → 実測 1分）
  - 実行したコマンド:
    ```bash
    npm i -D --save-exact --no-audit --no-fund typescript@7.0.2
    ```
    ※ **`--ignore-scripts` を意図的に外した**（TS7 は Go バイナリ配布なので挙動差が出るかを見るため）。
  - 出力（全文）:
    ```
    npm warn ERESOLVE overriding peer dependency
    npm warn While resolving: typescript7-alias-tsc6@1.0.0
    npm warn Found: typescript@6.0.3
    npm warn node_modules/typescript
    npm warn   peer typescript@">=4.8.4 <6.1.0" from @typescript-eslint/eslint-plugin@8.67.0
    npm warn   node_modules/@typescript-eslint/eslint-plugin
    npm warn     @typescript-eslint/eslint-plugin@"8.67.0" from typescript-eslint@8.67.0
    npm warn     node_modules/typescript-eslint
    npm warn   9 more (@typescript-eslint/parser, ...)
    npm warn
    npm warn Could not resolve dependency:
    npm warn peer typescript@">=4.8.4 <6.1.0" from typescript-eslint@8.67.0
    npm warn node_modules/typescript-eslint
    npm warn   dev typescript-eslint@"8.67.0" from the root project
    npm warn ERESOLVE overriding peer dependency
    npm warn ERESOLVE overriding peer dependency
    npm warn ERESOLVE overriding peer dependency
    npm warn ERESOLVE overriding peer dependency
    npm warn ERESOLVE overriding peer dependency
    npm warn ERESOLVE overriding peer dependency
    npm warn ERESOLVE overriding peer dependency

    added 9 packages, removed 8 packages, and changed 1 package in 1s
    EXIT=0
    ```
  - **予測外し**: ERESOLVE **エラーで止まる**と予測したが、npm 10.9.2 は**警告8回を出しただけで exit 0**。
    `--legacy-peer-deps` も `--force` も使っていない。
  - Goバイナリの配布実態:
    ```
    $ ls node_modules/@typescript/
    typescript-darwin-arm64
    $ du -sh node_modules/@typescript/*
     26M	node_modules/@typescript/typescript-darwin-arm64
    $ du -sh node_modules
     49M	node_modules
    $ npm ls @typescript/typescript-darwin-arm64
    └─┬ typescript@7.0.2 invalid: ">=4.8.4 <6.1.0" from node_modules/typescript-eslint
      └── @typescript/typescript-darwin-arm64@7.0.2
    ```
    20プラットフォームぶん宣言されているうち、**自機向けの1つ（26MB）だけ**が落ちた。install は 1秒。
    `--ignore-scripts` の有無で差は出なかった（postinstall スクリプトではなく optional deps 方式のため）。
  - 記事に書きたい気づき: `npm ls` が `invalid: ">=4.8.4 <6.1.0"` と**はっきり書いている**。
    install の警告を読み飛ばしても、`npm ls` を一度叩けば気づける。

- [x] 構成B の型チェック速度を計測する（見積もり 25分 → 実測 1分）
  - 実行したコマンド:
    ```bash
    ./node_modules/.bin/tsc --version
    npx tsc --version
    for i in 1 2 3; do time ./node_modules/.bin/tsc --noEmit; done
    ```
  - 出力:
    ```
    Version 7.0.2       ← ./node_modules/.bin/tsc
    Version 7.0.2       ← npx tsc
    run 1:  1.47s user 0.11s system 434% cpu 0.365 total
    run 2:  1.43s user 0.09s system 425% cpu 0.357 total
    run 3:  1.42s user 0.08s system 410% cpu 0.367 total
    ```
  - **3.478s → 0.365s = 9.5倍速い。** ここで 6.x が出れば前回と同じ bin 衝突だったが、構成Bでは
    `typescript` パッケージが1つしか無いので衝突は起きない。
  - 既存技術と比べて感じた違い: CPU使用率が **145% → 434%**。TS6 は実質シングルスレッドだが、
    TS7 は既定で4チェッカーを回して10コア機の並列度を実際に使っている。
  - 診断メッセージ: この fixture は型エラー 0 件なので、6と7で文言差は観測できなかった（未検証）。

- [x] 構成B で `eslint .` を実行し、壊れ方を全文で保存する（見積もり 30分 → 実測 1分）★記事の山場
  - 実行したコマンド:
    ```bash
    ./node_modules/.bin/eslint .
    ```
  - 出力（**全文**。`eslint-ts7.log` にも保存）:
    ```
    typescript-eslint does not support TS 7.0.
    Please see https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6.0 to run typescript-eslint using the TS 6 API.
    See also https://github.com/typescript-eslint/typescript-eslint/issues/10940 for tracking typescript-eslint's support for TS >=7.1

    Oops! Something went wrong! :(

    ESLint: 10.8.1

    Error: typescript-eslint does not support TS 7.0.
        at Object.<anonymous> (/…/node_modules/typescript-eslint/dist/index.js:52:11)
        at Module._compile (node:internal/modules/cjs/loader:1730:14)
        at Object..js (node:internal/modules/cjs/loader:1895:10)
        at Module.load (node:internal/modules/cjs/loader:1465:32)
        at Function._load (node:internal/modules/cjs/loader:1282:12)
        at TracingChannel.traceSync (node:diagnostics_channel:322:14)
        at wrapModuleLoad (node:internal/modules/cjs/loader:235:24)
        at cjsLoader (node:internal/modules/esm/translators:266:5)
        at ModuleWrap.<anonymous> (node:internal/modules/esm/translators:200:7)
        at ModuleJob.run (node:internal/modules/esm/module_job:329:25)

    ./node_modules/.bin/eslint .  0.08s user 0.03s system 69% cpu 0.167 total
    ```
  - **予測との差**: `ERR_PACKAGE_PATH_NOT_EXPORTED` や `ts.createProgram is not a function` を予測していたが、
    実際は typescript-eslint 8.67.0 が**自前のバージョンガードで先に throw していた**。
    詰まる場所が「深いところで謎のエラー」ではなく「入口の明示的なメッセージ」なのは、8.67.0 での改善。
  - 過去ナレッジとの差分: `knowledge/2026-07-09-typescript-eslint-typescript7-cjs-crash.md` に記録した
    8.63.0 の挙動は `TypeError: Cannot read properties of undefined (reading 'Cjs')` という謎クラッシュだった。
    **同じ原因が、版が上がってメッセージに変わった。**
  - 記事に書きたい気づき: lint は 0.17秒で死ぬ。「速くなった！」の直後に、そもそも lint が1件も走っていないことに
    気づかないまま CI をグリーンにしてしまう危険がある。

- [x] 失敗の原因をコードで裏取りする（見積もり 20分 → 実測 1分）
  - 実行したコマンド:
    ```bash
    node -e "console.log(require.resolve('typescript'))"
    node -e "const ts=require('typescript'); console.log(Object.keys(ts))"
    node -e "const ts=require('typescript'); console.log(JSON.stringify(ts))"
    node -e "const ts=require('typescript'); console.log(typeof ts.createProgram)"
    cat node_modules/typescript/lib/version.cjs
    node -e "console.log(Object.keys(require('typescript/package.json').exports))"
    sed -n '40,60p' node_modules/typescript-eslint/dist/index.js
    ```
  - 出力（全文）:
    ```
    /…/node_modules/typescript/lib/version.cjs
    [ 'version', 'versionMajorMinor' ]
    {"version":"7.0.2","versionMajorMinor":"7.0"}
    undefined

    --- node_modules/typescript/lib/version.cjs の中身（全3行）---
    const { version } = require("../package.json");
    exports.version = version;
    exports.versionMajorMinor = "7.0";

    --- exports のキー ---
    [ './package.json', '.', './unstable/sync', './unstable/async', './unstable/fs',
      './unstable/proto', './unstable/ast', './unstable/ast/is', './unstable/ast/factory',
      './unstable/ast/utils', './unstable/ast/scanner', './unstable/ast/visitor', './unstable/ast/clone' ]

    --- typescript-eslint/dist/index.js の判定コード ---
    const ts = __importStar(require("typescript"));
    const [versionMajor, _versionMinor] = ts.versionMajorMinor
        .split('.')
        .map(Number);
    if (versionMajor >= 7) {
        console.error([
            'typescript-eslint does not support TS 7.0.',
            'Please see https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6.0 to run typescript-eslint using the TS 6 API.',
            "See also https://github.com/typescript-eslint/typescript-eslint/issues/10940 for tracking typescript-eslint's support for TS >=7.1",
        ].join('\n'));
        throw new Error('typescript-eslint does not support TS 7.0.');
    }
    ```
  - **`typescript@7.0.2` の `require('typescript')` は3行のファイルで、`version` と `versionMajorMinor` の2つしか返さない。**
    これが「7.0 には API が無い」の実物。
  - 記事に書きたい気づき: 「exports フィールドを読む」「`require.resolve` で実体を見る」「node_modules の中の
    判定コードを直接読む」の3手順は、TS7 に限らずどんなライブラリでも効く汎用の切り分け手順。

- [x] 構成C: 公式 alias 併用構成に切り替える（見積もり 30分 → 実測 1分）
  - `package.json` の diff（構成B → 構成C。実物は `workspace/package.B.json` / `workspace/package.C.json`）:
    ```diff
       "devDependencies": {
    +    "@typescript/native": "npm:typescript@^7.0.2",
    +    "typescript": "npm:@typescript/typescript6@^6.0.2",
         "eslint": "10.8.1",
    -    "typescript": "7.0.2",
         "typescript-eslint": "8.67.0"
       }
    ```
  - 実行したコマンド:
    ```bash
    rm -rf node_modules package-lock.json && npm i --no-audit --no-fund
    ```
  - 出力:
    ```
    added 90 packages in 2s
    EXIT=0
    ```
    **peer 警告が1件も出なくなった**（`typescript` という名前が 6.0.2 を指すため）。
  - `npm ls --depth=0`:
    ```
    ├── @typescript/native@npm:typescript@7.0.2
    ├── eslint@10.8.1
    ├── typescript-eslint@8.67.0
    └── typescript@npm:@typescript/typescript6@6.0.2
    ```
  - 記事に書きたい気づき: `npm ls` の `A@npm:B@version` という表示で alias が可視化される。ここが読めると
    「何の名前がどの実体を指しているか」が一目で分かる。

- [x] ★前回の宿題: bin の解決先を確定させる（見積もり 30分 → 実測 1分）
  - 実行したコマンド:
    ```bash
    ls -l node_modules/.bin/tsc*
    ./node_modules/.bin/tsc --version
    ./node_modules/.bin/tsc6 --version
    npx tsc --version
    node node_modules/@typescript/native/bin/tsc --version
    npm ls @typescript/old
    ```
  - 出力（全文）:
    ```
    node_modules/.bin/tsc  -> ../@typescript/native/bin/tsc
    node_modules/.bin/tsc6 -> ../typescript/bin/tsc6

    $ ./node_modules/.bin/tsc --version
    Version 7.0.2
    $ ./node_modules/.bin/tsc6 --version
    Version 6.0.3
    $ npx tsc --version
    Version 7.0.2
    $ node node_modules/@typescript/native/bin/tsc --version
    Version 7.0.2

    $ npm ls @typescript/old
    typescript7-alias-tsc6@1.0.0
    └─┬ typescript@npm:@typescript/typescript6@6.0.2
      └── @typescript/old@npm:typescript@6.0.3

    $ ls node_modules/@typescript/
    native  old  typescript-darwin-arm64

    $ node -p "require('./node_modules/typescript/package.json').name + ' ' + …version"
    @typescript/typescript6 6.0.2
    $ node -p "require('./node_modules/@typescript/native/package.json').name + ' ' + …version"
    typescript 7.0.2
    ```
  - **前回との比較（同じ形式で並べる）**:
    | | 2026-07-11（素直に併記） | 2026-08-18（公式 alias 構成） |
    |---|---|---|
    | `.bin/tsc` の指し先 | `../@typescript/old/bin/tsc` | `../@typescript/native/bin/tsc` |
    | `tsc --version` | `Version 6.0.3` ❌ | `Version 7.0.2` ✅ |
    | `.bin/tsc6` の指し先 | `../@typescript/typescript6/bin/tsc6` | `../typescript/bin/tsc6` |
    | `tsc6 --version` | `Version 6.0.3` | `Version 6.0.3` ✅ |
  - **回避策（フルパス指定など）は不要だった。** alias 構成にした時点で bin の取り合いが起きない。
  - 効いた理由: TS7 を `@typescript/native` に改名したことで、`typescript` という名前を
    `@typescript/typescript6` が単独で取れる。`@typescript/old`（実体 `typescript@6.0.3`）は
    `typescript` の**ネストした依存**になり、トップレベルの `.bin/tsc` を奪えなくなった。
  - `tsc6` が **6.0.2 ではなく 6.0.3** を返す点は前回と同じ。`@typescript/typescript6@6.0.2` は薄いラッパで、
    実際のコンパイラは `@typescript/old`（= `typescript@^6` → 6.0.3）だから。ここは記事でも注記が要る。

- [x] 構成C で「型チェックはTS7 / lint はTS6 API」が両立するか確かめる（見積もり 15分 → 実測 1分）
  - 実行したコマンド:
    ```bash
    for i in 1 2 3; do time ./node_modules/.bin/tsc --noEmit; done   # 7.0.2
    time ./node_modules/.bin/tsc6 --noEmit                            # 6.0.3
    time ./node_modules/.bin/eslint .
    node -e "console.log(require.resolve('typescript'))"
    node -e "const ts=require('typescript'); console.log('version=',ts.version,' createProgram=',typeof ts.createProgram)"
    ```
  - 出力:
    ```
    tsc  run 1:  1.46s user 0.13s system 405% cpu 0.392 total
    tsc  run 2:  1.44s user 0.09s system 423% cpu 0.362 total
    tsc  run 3:  1.49s user 0.10s system 431% cpu 0.367 total
    tsc6 run 1:  4.83s user 0.20s system 145% cpu 3.447 total

    ✖ 7 problems (7 errors, 0 warnings)
    ./node_modules/.bin/eslint .  11.70s user 0.76s system 140% cpu 8.889 total

    /…/node_modules/typescript/lib/typescript.js
    version= 6.0.3  createProgram= function
    ```
  - **判定: 両立した。** `tsc` は 7.0.2 で 0.37s、`eslint` は構成Aと**同じ7件**（ルール名・行番号まで完全一致）。
    lint 側が掴む `typescript` は `lib/typescript.js` で `createProgram` も `function`。
  - **実際に打つコマンド**（記事にそのまま載せられる形）:
    ```jsonc
    // package.json
    "scripts": {
      "typecheck": "tsc --noEmit",   // -> @typescript/native (7.0.2)
      "lint": "eslint ."             // -> typescript = @typescript/typescript6 (6.0 API)
    }
    ```
    同じ `tsc` / `eslint` のまま。**スクリプト側の書き換えは一切不要**だった。

### フェーズ4: 深掘り・比較（見積もり 90分 → 実測 約3分）

- [x] `--checkers` / `--singleThreaded` を振って計測差を出す（見積もり 30分 → 実測 1分）
  - **最初の実行は自分のシェルのミスで全滅した**（「詰まった点 #4」）。再実行後の値:
    ```
    --checkers 1     : 1.177 / 1.167 / 1.172   (135% cpu)
    --checkers 2     : 0.627 / 0.617 / 0.608   (245% cpu)
    既定(--checkers 4): 0.438 / 0.359 / 0.366   (381-426% cpu)
    --checkers 8     : 0.323 / 0.281 / 0.302   (569-611% cpu)
    --singleThreaded : 1.200 / 1.187 / 1.210   (116-118% cpu)
    ```
  - 10コア機での並列度の効き:
    - 1 → 2 で **1.9倍**、2 → 4 で **1.7倍**、4 → 8 で **1.2倍**。**4を超えると伸びが鈍る**
    - `--checkers 1` と `--singleThreaded` はほぼ同値（1.17s vs 1.19s）
    - **並列を切っても TS6 の 3.478s より 2.9倍速い。** つまり9.3倍の内訳は
      「Go移植そのもので約3倍」＋「並列化で約3倍」の掛け算に見える（この fixture では）
  - `--builders` は単体では使えない:
    ```
    $ tsc --noEmit --builders 2
    error TS5093: Compiler option '--builders' may only be used with '--build'.
    ```
  - TS6 は `--checkers` を知らない:
    ```
    $ tsc6 --noEmit --checkers 1
    error TS5025: Unknown compiler option '--checkers'. Did you mean 'checkJs'?
    ```
  - 記事に書きたい気づき: 「8〜12倍」の中身が**移植ぶんと並列ぶんに分けられる**のは自分で測らないと分からない。
    CI のように1コアしか割り当てられない環境なら、期待値は9倍ではなく3倍に近い。

- [x] TS7 の unstable API に何があるか覗く（見積もり 20分 → 実測 1分）
  - 実行したコマンド:
    ```bash
    node -p "Object.keys(require('@typescript/native/package.json').exports)"
    node --input-type=module -e "const m = await import('@typescript/native/unstable/<sub>'); console.log(Object.keys(m).length)"
    ```
  - 出力（全13サブパス中、実際に import を試した8つは**すべて成功**）:
    ```
    unstable/ast          OK  keys=409 : CharacterCodes, CommentDirectiveType, InternalSymbolName,
                                         LanguageVariant, ModifierFlags, NodeFlags, ScriptKind,
                                         SyntaxKind, TokenFlags, cast, ...
    unstable/fs           OK  keys=2   : createVirtualFileSystem, fsCallbackNames
    unstable/sync         OK  keys=44  : API, Checker, Emitter, InternalAPI, Program, Project,
                                         Signature, Snapshot, Symbol, SymbolFlags, TypeFlags,
                                         isUnionType, isTupleType, isConditionalType, ...
    unstable/async        OK  keys=44  : （sync と同じ顔ぶれ）
    unstable/proto        OK  keys=3   : resolveDocumentURI, resolveFileName, toUpdateSnapshotRequest
    unstable/ast/factory  OK  keys=370 : NodeObject, cloneNode, createArrayBindingPattern,
                                         createArrowFunction, createBinaryExpression, ...
    unstable/ast/scanner  OK  keys=25  : createScanner, computeLineStarts, getLeadingCommentRanges, ...
    unstable/ast/visitor  OK  keys=8   : visitEachChild, visitNode, visitNodes, visitNodesArray, ...
    ```
  - **「7.0 には API が無い」は正確には「既存ツールが使う安定版の `typescript` エントリに API が無い」。**
    `unstable/*` は実在して import でき、`Program` / `Checker` / `Emitter` まで見えている。
    ただし名前のとおり unstable であり、公式は 7.1 で「新しい（別物の）API」を出すと言っている。
  - 触ったが**やらなかったこと**: `unstable/sync` の `API` を使って実際に型チェックを走らせる所までは試していない（未検証）。

- [x] 3構成の比較表を作り、HTMLに出力して Playwright でスクショする（見積もり 25分 → 実測 1分）
  - 実行したコマンド:
    ```bash
    node logs/run-*/workspace/shot.mjs "file://$PWD/fixtures/typescript7-alias-tsc6/report.html" \
      "$PWD/logs/run-*/screenshots/01-benchmark.png"
    cp logs/run-*/screenshots/01-benchmark.png images/typescript7-alias-tsc6/benchmark.png
    ```
  - スクショ: `screenshots/01-benchmark.png` → `images/typescript7-alias-tsc6/benchmark.png`（1280x1200 / deviceScaleFactor 2 / fullPage）
  - 表に入れた列: 構成 / devDependencies / `.bin/tsc` の指し先 / `tsc --version` / 3回の秒数 / `eslint .` の結果、
    ＋「型チェック時間（構成A比）」の棒グラフ、＋「TS7 には API が無い」の実物比較
  - HTMLの元ファイル: `workspace/report.html`

- [x] 別パッケージマネージャでの挙動（見積もり 15分 → 実測 1分）
  - typescript-go#4368 を確認:
    - タイトル: 「@typescript/typescript6 compat package fails to install under Yarn (builtin TypeScript patch hard-errors on missing 'lib/_tsc.js')」
    - **状態: Closed**（対象タスクの表では「Open」と書いていたが、確認時点では閉じていた）
    - エラー: `ENOENT: no such file or directory, lstat '.../node_modules/typescript/lib/_tsc.js'`
    - 条件: Yarn 4.16.0（`nodeLinker: node-modules`）/ `@typescript/typescript6@6.0.1` / `typescript@7.0.1-rc`
    - 原因: Yarn の組み込み TypeScript 互換パッチが「`typescript` という識別子の依存」を実体に関係なく対象にする。
      `@typescript/typescript6` には `lib/_tsc.js` / `lib/_tsserver.js` が無いのでパッチ適用が hard error になる
    - 回避策: `@typescript/typescript6` に `lib/_tsc.js` / `lib/_tsserver.js` のスタブ再エクスポートを足す Yarn patch を当てる
  - **時間が余ったので pnpm 10.13.1 で追試した**（対象タスクの「余ったときだけ」条項）:
    ```bash
    pnpm install --store-dir ./.pnpm-store
    ```
    ```
    dependencies:
    + typescript <- @typescript/typescript6 6.0.2
    devDependencies:
    + @typescript/native <- typescript 7.0.2
    + eslint 10.8.1
    + typescript-eslint 8.67.0
    Done in 2.9s using pnpm v10.13.1

    $ ./node_modules/.bin/tsc --version   => Version 7.0.2
    $ ./node_modules/.bin/tsc6 --version  => Version 6.0.3
    $ tsc --noEmit x3  => 0.380 / 0.384 / 0.375
    $ eslint .         => ✖ 7 problems (7 errors, 0 warnings)
    ```
    **同じ `package.json` のまま pnpm でも成功した。** npm と違い `.bin/tsc` は symlink ではなく
    実行可能なシムスクリプト（1848 bytes）になる点だけ表示が違う。
  - **未検証の境界**: Yarn（この機で使えたのは corepack 経由の 1.22.22 のみ。issue の条件は Yarn 4.16.0 なので再現条件を満たせず、試していない）。

### フェーズ5: 振り返り・記事化準備（見積もり 45分 → 実測 約2分）

- [x] 見積もりと実測の差が大きかったタスク / 予測の当たり外れ（下記「詰まった点」「予測と実測の答え合わせ」に記載）
- [x] 「記事への写像」を実績で埋める（下記の表）
- [x] 「今このバージョンに上げてよい人／待つべき人」の判断軸を3行で書く:
  1. **上げてよい**: 型チェックが CI/ローカルの体感ボトルネックで、依存する型ツールが typescript-eslint 程度に留まるプロジェクト。
     公式 alias 構成なら `tsc` だけ差し替えられ、`package.json` の4行以外は触らずに済んだ。
  2. **待つべき**: Vue / Svelte / Astro / MDX / Angular テンプレート型チェックなど、Compiler API を埋め込んで使うツールが
     ビルドの必須経路にあるプロジェクト。7.0 の `typescript` は `version` しか返さないので回避の余地が薄い。
  3. **判断の前に**: 公式は 7.1 で新しい API を出す予定と書いている。急がないなら 7.1 待ちが素直。
     新人が試した範囲では、alias 構成の導入コスト自体は `package.json` 4行と `npm i` のやり直しだけだった。

## 詰まった点と解決過程（記事の核）

| # | 詰まった点 | 原因 | 効いた対処 | 所要 | 解決/撤退 | 記事での活かし方 |
|---|---|---|---|---|---|---|
| 1 | `npm i -D typescript@7.0.2` が**止まらずに成功してしまった**（ERESOLVE エラーを予測していた） | npm 10.9.2 は peer 不一致を `ERESOLVE overriding peer dependency` の**警告**として処理し exit 0 を返す | 警告を読み飛ばさず `npm ls` を叩く。`invalid: ">=4.8.4 <6.1.0"` と明示される | 1分 | 解決 | 「壁はインストールで止めてくれない」。予測が外れた記録として最初に書く。新人が一番踏みやすい罠 |
| 2 | fixture の規模調整に手間取り、**3回作り直した**。特に 80モジュール×200union のとき `eslint` が **JavaScript heap out of memory** で落ちた | 型情報つき lint は tsc と同じ型を全部 JS ヒープに載せる。`UnionToIntersection` を200要素 union に当てた型が爆発し、4GBのヒープを食い潰した | union のサイズを 200 → 90 に落とし、代わりにモジュール数を 80 → 200 に増やして「tsc は3.5秒／eslint は完走」の両立点を探した。`--extendedDiagnostics` の `Instantiations` を目安にした | 4分 | 解決 | 「ベンチ用の重い fixture」を作るときの実務ノウハウ。**型チェックが耐える規模と lint が耐える規模は違う**。エラー全文（`Mark-Compact 4038.8 → 4019.9 MB` / `FATAL ERROR: Ineffective mark-compacts near heap limit`）は `commands.log` にある |
| 3 | （前回の宿題）`.bin/tsc` が TS6 を指す bin 衝突 | 前回は `typescript`(7) と `@typescript/typescript6`(→`@typescript/old`=typescript@6.0.3) が**同じ `tsc` という bin 名**を取り合った | 公式 alias 構成で TS7 を `@typescript/native` に改名。`typescript` の名前を 6 側に譲ると衝突しない | 1分 | **解決** | 記事最大の見せ場。前回表と今回表を並べる。`ls -l node_modules/.bin/tsc*` → 実体を `--version` で確認、という切り分けは汎用 |
| 4 | `--checkers 1` などが全部 `error TS5023: Unknown compiler option '--checkers 1'.` になった | 自分のシェルスクリプトで `"--checkers 1"` を**1つの引数として**渡していた（`$opt` のクォート） | フラグと値を別の引数として渡すループに書き換えて再実行 | 1分 | 解決 | 自分のミスだが、`Unknown compiler option '--checkers 1'`（値まで含んだ引用符）はミスの見分け方として分かりやすい。エラーメッセージが引数を丸ごと引用していたら、まず自分の渡し方を疑う |

### 予測と実測の答え合わせ

| 予測（実行前に書いた） | 実測 | |
|---|---|---|
| `typescript@7.0.2` の `exports["."]` は `./lib/version.cjs` だけで、Compiler API を使うツールは壊れる | `require('typescript')` は `{version, versionMajorMinor}` の2キーのみ。`createProgram` は `undefined` | **当たり** |
| typescript-eslint の peer が `<6.1.0` なので `npm i` が ERESOLVE **エラーで止まる** | 警告8回で exit 0。止まらない | **外れ** |
| lint は `ERR_PACKAGE_PATH_NOT_EXPORTED` / `ts.createProgram is not a function` 系で落ちる | typescript-eslint 自身のバージョンガードで `Error: typescript-eslint does not support TS 7.0.` | **外れ（原因は同じ、出方が違う）** |
| alias 構成なら bin 衝突は起きない（名前が分かれるから） | `.bin/tsc -> ../@typescript/native/bin/tsc` = 7.0.2、`.bin/tsc6` = 6.0.3 | **当たり** |
| 小さい fixture では公式の「8〜12倍」ほどの倍率は出ないだろう | 9.3倍出た（既定 checkers 4）。`--checkers 8` なら 11.5倍 | **外れ（想定より速かった）** |
| Yarn には既知 issue がある（Open） | issue #4368 は確認時点で **Closed** | **外れ（情報が古かった）** |

## スクリーンショット一覧

| ファイル | 何を示すか | 使う見出し |
|---|---|---|
| `screenshots/01-benchmark.png`（= `images/typescript7-alias-tsc6/benchmark.png`） | 3構成の比較表 / 型チェック時間の棒グラフ（A比 1.0x〜11.5x）/ 「TS7 には API が無い」の実物比較 | 8. 数字の比較表 |

## 記事への写像（実績で埋める）

| 記事の見出し | 使う記録 / スクショ | 書くこと（メモ） |
|---|---|---|
| 1. はじめに（前回は bin 衝突で止まった） | フェーズ1「前回の失敗を読み返す」／`articles/typescript7-tsc-bin-collision-log.md` | 前回 `tsc` / `tsc6` が両方 `Version 6.0.3` を返して止まった話を1段落。今回の動機＝GA版と公式 alias 構成での再挑戦 |
| 2. なぜ TypeScript 7.0 を試すのか | フェーズ1「公式アナウンスを読む」 | GA の事実、Go移植、公式の 7.7x〜11.9x・メモリ -6%〜-26%。**自分の実測とは節を分ける** |
| 3. 事前に調べたこと（7.0にAPIが無い / 7.1で入る） | フェーズ1「レジストリのメタデータで裏取り」＋「予測と実測の答え合わせ」表 | `npm view typescript@7.0.2 exports --json` と `npm view typescript-eslint@8.67.0 peerDependencies --json` の出力。**予測2つを先に書いてから**実測へ |
| 4. 環境構築とベースライン計測 | フェーズ2 全タスク／`workspace/gen.mjs`, `workspace/types.ts`, `workspace/mod0.sample.ts`, `workspace/tsconfig.json`, `workspace/eslint.config.js` | fixture の作り方（何を入れたら重くなったか）、203ファイル/13,841行、`extendedDiagnostics` の数字、TS6 の 3.478/3.535/3.424、実行環境スペック。**fixture 調整で eslint が OOM した話（詰まった点 #2）もここ** |
| 5. 単純に上げてみる → 速い、しかし lint が落ちる | フェーズ3 前半3タスク／`eslint-ts7.log` | install が**警告だけで通る**全文、3.478s → 0.365s（9.5倍）、CPU 145% → 434%、`eslint` が 0.17秒で死ぬ全文 |
| 6. 詰まった点（エラー全文と原因） | フェーズ3「原因をコードで裏取り」＋詰まりポイント #1 #3 | `version.cjs` の中身3行、`Object.keys(require('typescript'))` の2キー、typescript-eslint の判定コード。**exports を読む→require.resolve で実体を見る→node_modules の判定コードを読む** の3手順 |
| 7. 公式の alias 併用構成にする | フェーズ3「構成Cに切り替え」＋「bin の解決先を確定」 | package.json の diff（4行）、`npm ls` の `A@npm:B@version` 表示、`ls -l node_modules/.bin/tsc*` の前回/今回の並置表、`tsc6` が 6.0.2 でなく 6.0.3 を返す理由 |
| 8. 数字の比較表（TS6 / TS7 / TS7+alias） | 計測記録シート ＋ `images/typescript7-alias-tsc6/benchmark.png` | 比較表とスクショ。`--checkers` の 1/2/4/8 と `--singleThreaded`。**9.3倍の内訳＝移植ぶん約3倍 × 並列ぶん約3倍** |
| 9. どんな人が今上げてよさそうか（7.1待ちの判断軸） | フェーズ5「判断軸3行」＋フェーズ4「PM差」＋「unstable API」 | 上げてよい条件／待つべき条件。npm と pnpm で成功、Yarn 4 は未検証（#4368 は Closed）。unstable API は実在するが 7.1 で別物が来る |
| 10. まとめ | 結果サマリー ＋「予測と実測の答え合わせ」 | 分かったこと3点、予測が外れた3つ、参考リンク（公式アナウンス / typescript-eslint#10940 / typescript-go#4368 / 前回記事） |

## 未達・撤退した項目

- **なし**（完了条件5項目はすべて達成）。以下は「意図的に手を出さなかった範囲」で、記事では未検証と明記する:
  - **Yarn での alias 構成**: この機で使えたのは corepack 経由の Yarn 1.22.22 のみ。issue #4368 の再現条件は
    Yarn 4.16.0 + `nodeLinker: node-modules` で、条件を満たせないため試していない。
  - **`unstable/sync` の API で実際に型チェックを走らせる**: import して export の顔ぶれを確認するところまで。
  - **TS6 と TS7 の診断メッセージ文言の差**: fixture に型エラーを仕込んでいないため観測していない。
  - **emit 結果の差**: `--noEmit` のみを扱ったため未検証。
  - **メモリ使用量の比較**: 公式は -6%〜-26% としているが、今回は時間（`time` の `real`）だけを測った。

## 再現性メモ（記事に転記する用）

- OS / ランタイム / 主要ライブラリのバージョン:
  - macOS 26.5（Darwin 25.5.0）arm64 / Apple Silicon・**論理10コア**
  - Node **v22.17.0** / npm **10.9.2** / pnpm **10.13.1**
  - `typescript` **6.0.3** および **7.0.2** / `@typescript/typescript6` **6.0.2**（実体は `@typescript/old` = typescript **6.0.3**）
  - `typescript-eslint` **8.67.0** / `eslint` **10.8.1**
  - 実行日 **2026-08-18**
- 実行コマンドの並び（最短の再現手順）:
  ```bash
  # 1) fixture（型チェックが数秒かかる規模のTSプロジェクト）を用意する
  npm init -y && npm pkg set private=true && npm pkg set type=module

  # 2) 構成A: ベースライン
  npm i -D --save-exact typescript@6.0.3 typescript-eslint@8.67.0 eslint@10.8.1
  ./node_modules/.bin/tsc --version          # Version 6.0.3
  for i in 1 2 3; do time ./node_modules/.bin/tsc --noEmit; done
  ./node_modules/.bin/eslint .

  # 3) 構成B: 単純アップ（警告は出るが install は通る／lint が死ぬ）
  npm i -D --save-exact typescript@7.0.2
  npm ls                                     # invalid: ">=4.8.4 <6.1.0" が出る
  ./node_modules/.bin/tsc --version          # Version 7.0.2
  ./node_modules/.bin/eslint .               # Error: typescript-eslint does not support TS 7.0.
  node -e "const ts=require('typescript'); console.log(Object.keys(ts), typeof ts.createProgram)"

  # 4) 構成C: 公式 alias 併用（package.json の devDependencies を書き換え）
  #    "@typescript/native": "npm:typescript@^7.0.2",
  #    "typescript":         "npm:@typescript/typescript6@^6.0.2"
  rm -rf node_modules package-lock.json && npm i
  ls -l node_modules/.bin/tsc*               # tsc -> ../@typescript/native/bin/tsc
  ./node_modules/.bin/tsc --version          # Version 7.0.2
  ./node_modules/.bin/tsc6 --version         # Version 6.0.3
  ./node_modules/.bin/eslint .               # 構成Aと同じ結果
  for i in 1 2 4 8; do time ./node_modules/.bin/tsc --noEmit --checkers $i; done
  ```
- 注意点（読者に関係する再現性情報）:
  - **`.bin` の実体を必ず `--version` で検証する。** 依存一覧のバージョンが正しくても、`.bin/tsc` が別実装を
    指していることがある（前回それで比較が丸ごと無効になった）。
  - **構成を変えるたびに `rm -rf node_modules package-lock.json && npm i`。** alias への書き換えは
    lockfile の解決結果を大きく変えるので、残骸があると結果が汚れる。
  - **`--checkers` はフラグと値を別々の引数で渡す。** `"--checkers 1"` を1引数で渡すと `error TS5023`。
  - **型チェックの倍率はコア数に強く依存する。** 10コア機の既定（checkers 4）で 9.3倍だが、
    `--checkers 1` / `--singleThreaded` では 2.9〜3.0倍。1コアしか使えない CI では期待値が変わる。
  - **`tsc6 --version` は 6.0.2 ではなく 6.0.3 を返す。** `@typescript/typescript6` は薄いラッパで、
    実体は依存の `@typescript/old`（`npm:typescript@^6`）。
  - **型情報つき lint のメモリ**。極端に重い型を含む fixture では tsc が通っても eslint が
    `JavaScript heap out of memory` で落ちる。ベンチ用コードを自作するときは lint 側も同時に確認する。
  - 実測は `time` の `real`。各3回。TS7 は `@typescript/typescript-darwin-arm64`（26MB）を optional deps で取得する。

## 次のアクション（記事化）

- [ ] この execution-log.md の「記事への写像」に沿って `articles/typescript7-alias-tsc6.md` を作成する
- [x] スクショを Zenn 用に配置する（`images/typescript7-alias-tsc6/benchmark.png` へコピー済み）
- [ ] 完了条件・詰まった点・比較を本文に落とす（特に「予測と実測の答え合わせ」表は経験談の核）

## 参考リンク

- [Announcing TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)（2026-08-18 閲覧）
- [typescript-eslint #10940 — TS >=7.1 サポートの追跡 issue](https://github.com/typescript-eslint/typescript-eslint/issues/10940)（エラーメッセージ内で案内されている）
- [typescript-go #4368 — Yarn での alias 構成失敗（**Closed**）](https://github.com/microsoft/typescript-go/issues/4368)
- 自分の過去記事: `articles/typescript7-tsc-bin-collision-log.md`
- 今回保存したナレッジ: `knowledge/2026-08-18-typescript7-eslint-alias-side-by-side.md`

## 添付ファイル

| パス | 中身 |
|---|---|
| `commands.log` | 全実行コマンドと出力の全文（1,125行） |
| `eslint-ts7.log` | 構成B の `eslint .` エラー全文 |
| `screenshots/01-benchmark.png` | 比較表のスクショ |
| `workspace/package.A.json` / `package.B.json` / `package.C.json` | 3構成の `package.json` |
| `workspace/gen.mjs` | fixture 生成器（`node gen.mjs 200 90`） |
| `workspace/types.ts` / `workspace/mod0.sample.ts` | fixture の型ユーティリティとモジュール1本の実物 |
| `workspace/tsconfig.json` / `workspace/eslint.config.js` | 設定ファイル |
| `workspace/report.html` | 比較表のHTML（スクショ元） |
| `workspace/shot.mjs` | Playwright スクショスクリプト |
| `workspace/pnpm-trial/` | pnpm 追試の作業ディレクトリ |
| `fixtures/typescript7-alias-tsc6/` | fixture 本体（構成C の状態で残置） |
