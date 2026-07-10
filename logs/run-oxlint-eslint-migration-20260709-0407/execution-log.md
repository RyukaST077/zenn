# 検証ログ: ESLintしか知らない新人がoxlintに移行し、JSプラグインalphaまで試してみた

> Zenn記事の素材。実行の一次情報（コマンド・エラー全文・所要時間・スクショ）を記録。
> 記事本文は未執筆。「記事への写像」を見て articles/*.md に展開する。

## 実行の前提（採用した前提）

- 対象タスク: `practice/practice-oxlint-eslint-migration-20260709-0404.md`
- 出典レポート: `research/search-topic-20260709-0400.md`
- 対象技術: oxlint（Rust製リンタ / oxc）1.73.0 ＋ `@oxlint/migrate` ＋ JS Plugins（alpha）
- 実行者: AIエージェント単独（非対話） <!-- 内部メタ: 記事に転記しない -->
- 実行日時 / 所要時間: 2026-07-09 04:07〜04:19 / 見積もり 約4.25h → 実測 約0.2h（12分。AI単独・最小構成のため大幅短縮） <!-- 実測はAI単独値。記事にそのまま書かない -->
- 実行環境: macOS 15 (Darwin 25.5.0, arm64) / Node v22.17.0 / pnpm 10.13.1 / eslint 10.6.0 / typescript-eslint 8.63.0 / oxlint 1.73.0 / eslint-plugin-jsdoc 63.0.12
- 採用した撤退ライン: 1タスク30分で詰まったら記録してスキップ or 等価手段に切替（対象タスクの想定リスク準拠）。migrate失敗時は手書き `.oxlintrc.json` に切替、jsPlugins不可時は「動かなかった事例」として記録
- 判断方針: 引数で対象タスクファイルのみ指定。時間・スキルレベル・撤退ラインはデフォルト前提を採用。手順は oxc.rs 公式（Migrate from ESLint / JS Plugins Alpha ブログ）で裏取り

## 結果サマリー

- 完了条件の判定: **達成**（3条件すべてを客観ログで確認）
- 作ったもの: React+TypeScript の最小サンプル（ESLint flat config → oxlint 移行）。`workspace/`
- スクショ: 1 枚（`screenshots/01-summary.png`：全結果サマリ）
- 詰まった点: 3 件（うち解決 3 / 未解決・撤退 0）
- knowledge 記録: `knowledge/2026-07-09-typescript-eslint-typescript7-cjs-crash.md`

## 完了条件の検証

| # | 完了条件 | 判定 | 根拠（ログ / スクショ） |
|---|---|---|---|
| 1 | `npx @oxlint/migrate` で `.oxlintrc.json` が生成され `pnpm lint` が完走し結果表示 | **達成** | `commands.log`（`✨ .oxlintrc.json created with 87 rules.`）→ `oxlint-postmigrate.txt`（7件検出して完走） |
| 2 | ESLint と oxlint の実行時間を計測し比較表が残っている | **達成** | `timing.txt`（各5回の real 値）/ 下記「速度比較」表 / `screenshots/01-summary.png` §3 |
| 3 | `jsPlugins` にESLintプラグインを1つ指定しルールの動作可否をログで確認 | **達成** | `jsplugin-test.txt`（`jsdoc-js(require-param)` 発火）/ 直接指定は予約名エラー |

## タスク実行ログ（フェーズ別）

### フェーズ1: 事前調査

- [x] oxc.rs 公式（Migrate from ESLint / JS Plugins Alpha 2026-03-11 / Config）を確認（見積もり20分 → 実測 約3分）
  - 参照 URL（2026-07-09 閲覧）:
    - Migrate from ESLint: `https://oxc.rs/docs/guide/usage/linter/migrate-from-eslint.html`
    - JS Plugins Alpha ブログ: `https://oxc.rs/blog/2026-03-11-oxlint-js-plugins-alpha.html`
  - 確認できた要点:
    - `npx @oxlint/migrate <flat-config-path>` が既定。生成物は `.oxlintrc.json`
    - migrate は **ESLint v9/v10 flat config 専用**。v8 legacy(`.eslintrc.*`) は先に `@eslint/migrate-config` で flat 化が必要
    - oxlint は「ESLintコア＋主要プラグインの700超ルール」を実装。未対応ルールは移行時スキップ。**custom plugin は自動移行されない**
    - jsPlugins（alpha）は `["eslint-plugin-xxx"]` または `{ "name":..., "specifier":... }` のエイリアス記法。既知制約＝FW独自ファイル(.vue/.svelte)は限定 / Windows で OOM / custom type-aware ルール非対応
  - 記事に書きたい気づき: 「migrate は flat config 専用」を最初に知っていたのが効いた（v8だったら手戻り）。alpha の位置づけ（semver対象外）は明記すべき
  - 動機メモ（新人視点）: ESLint は使えるが oxlint は未経験。「本当に既存の ESLint プラグインが動くのか」「速い速いと聞くが実測は？」が不安

### フェーズ2a: React+TS+ESLint flat config サンプル

- [x] React+TS最小サンプルに ESLint v10 flat config とプラグイン設定、`npx eslint .` が動く状態に（見積もり25分 → 実測 約4分。ただし後述のTSクラッシュ対応込み）
  - 実行したコマンド:
    ```bash
    pnpm add -D eslint @eslint/js typescript-eslint eslint-plugin-react-hooks globals typescript
    npx eslint .
    ```
  - **最初の出力（クラッシュ・全文）**:
    ```
    Oops! Something went wrong! :(
    ESLint: 10.6.0
    TypeError: Cannot read properties of undefined (reading 'Cjs')
        at Object.<anonymous> (.../@typescript-eslint+typescript-estree@8.63.0_typescript@7.0.2/node_modules/@typescript-eslint/typescript-estree/dist/create-program/shared.js:59:18)
        ...
    ```
  - 効いた対処: TypeScript を typescript-eslint の peer 範囲（`>=4.8.4 <6.1.0`）内に固定
    ```bash
    pnpm add -D typescript@5.9.3
    npx eslint .
    ```
  - 対処後の出力（全文, `eslint-baseline.txt`）:
    ```
    src/App.tsx
       6:3   error    Unexpected var, use let or const instead                     no-var
       6:7   error    'unused' is assigned a value but never used                  @typescript-eslint/no-unused-vars
       9:5   warning  Unexpected console statement                                no-console
      10:6   warning  React Hook useEffect has a missing dependency: 'count'...   react-hooks/exhaustive-deps
      12:13  error    Expected '===' and instead saw '=='                         eqeqeq
    src/utils.ts
      2:7  error  'result' is never reassigned. Use 'const' instead               prefer-const
      8:9  error  'y' is assigned a value but never used                          @typescript-eslint/no-unused-vars
    ✖ 7 problems (5 errors, 2 warnings)
    ```
  - つまずいた理由: `typescript@latest` が **7.0.2**（ネイティブ移植版）に到達しており、typescript-eslint 8.x がまだ未対応。`pnpm add` 時点で `unmet peer typescript ">=4.8.4 <6.1.0": found 7.0.2` の警告が出ていたが、これが「起動不能」という実害になった
  - 既存技術と比べて感じた違い: これは oxlint 以前の ESLint 側のハマり。peer 警告を軽視しないことの再確認
  - 記事に書きたい気づき: 「新人が最新を入れたら ESLint が起動しない」あるある。knowledge化した

### フェーズ2b: oxlint インストール

- [x] `pnpm add -D oxlint`、スクリプト追加、`oxlint --version`／素の `pnpm lint` 確認（見積もり20分 → 実測 約2分）
  - 実行したコマンド:
    ```bash
    pnpm add -D oxlint       # → oxlint 1.73.0 / Done in 4.7s
    # package.json: "lint":"oxlint", "lint:fix":"oxlint --fix", "lint:eslint":"eslint ."
    npx oxlint --version     # → Version: 1.73.0
    pnpm lint                # 設定移行前（デフォルト挙動）
    ```
  - 移行前デフォルトの出力（全文）:
    ```
    src/utils.ts:8:9: warning eslint(no-unused-vars): Variable 'y' is declared but never used...
    src/App.tsx:6:7: warning eslint(no-unused-vars): Variable 'unused' is declared but never used...
    ```
  - 既存技術と比べて感じた違い: 設定なし oxlint は既定で `correctness` 中心の狭いルールセット。ESLint recommended（7件）に対し 2件（no-unused-vars のみ）。移行前後で「デフォルトの守備範囲が違う」ことが明確
  - インストール所要: 約4.7秒（`Done in 4.7s`）。Rust製バイナリだが pnpm で軽量に入った

### フェーズ3a: @oxlint/migrate で移行

- [x] `npx @oxlint/migrate ./eslint.config.js` で `.oxlintrc.json` 生成、差分記録（見積もり40分 → 実測 約2分）
  - 実行したコマンド:
    ```bash
    npx --yes @oxlint/migrate ./eslint.config.js
    ```
  - 出力（全文）:
    ```
    ✨ .oxlintrc.json created with 87 rules.
       Skipped 4 rules:
         -   2 Nursery         (Experimental: no-undef, no-useless-assignment)
         -   2 Unsupported     (Won't be implemented: no-dupe-args, no-octal)
    👉 Re-run with flags to include more:
         npx @oxlint/migrate eslint.config.js --with-nursery
    🚀 Next:
         npx oxlint .
    ```
  - 生成 `.oxlintrc.json` の要点（全文は `workspace/.oxlintrc.json`）:
    - `plugins: ["typescript"]`、`categories: { correctness: off }`、`env: { builtin: true }`
    - `ignorePatterns` に flat config の `ignores`（node_modules/**, dist/**）を反映
    - トップレベル rules に 87 個（no-* コア + typescript/* ）
    - overrides:
      - `**/*.{ts,tsx,mts,cts}`：TS で無意味なコアルールを off（no-const-assign 等）、`no-var`/`prefer-const`/`prefer-rest-params`/`prefer-spread` を error
      - `**/*.{ts,tsx}`：`no-var`/`eqeqeq`/`no-console`/`react/rules-of-hooks`/`react/exhaustive-deps`、`plugins:["react"]`、`env:{es2022,browser}`
  - 移行された/されなかったルール:
    - **移行**: 87ルール。react-hooks プラグインの2ルールも `react/rules-of-hooks`・`react/exhaustive-deps` にマッピングされた
    - **スキップ**: nursery 2（no-undef, no-useless-assignment）/ unsupported 2（no-dupe-args, no-octal, "Won't be implemented"）
  - 「custom plugin は自動移行されない」は今回 custom plugin を使っていないため非該当（=公式注意の裏取りはできず。記事では「該当なし」と正直に）
  - 記事に書きたい気づき: 想像より綺麗に移行。TS向けに override で余計なコアルールを自動 off してくれるのが賢い

### フェーズ3b: 検出差の一覧化

- [x] 移行後 `pnpm lint`（oxlint）実行、ESLint 結果と突き合わせ（見積もり30分 → 実測 約1分）
  - oxlint 出力（全文, `oxlint-postmigrate.txt`）:
    ```
    src/utils.ts:8:9: error eslint(no-unused-vars): Variable 'y' is declared but never used...
    src/utils.ts:2:7: error eslint(prefer-const): `result` is never reassigned. help: Use `const` instead.
    src/App.tsx:6:7: error eslint(no-unused-vars): Variable 'unused' is declared but never used...
    src/App.tsx:6:3: error eslint(no-var): Unexpected var, use let or const instead...
    src/App.tsx:9:28: warning react-hooks(exhaustive-deps): React Hook useEffect has a missing dependency: 'count'...
    src/App.tsx:9:5: warning eslint(no-console): Unexpected console statement...
    src/App.tsx:12:13: error eslint(eqeqeq): Expected === and instead saw ==...
    ```
  - **検出差分表（同一サンプル）**:

    | ルール | ESLint | oxlint(移行後) |
    |---|---|---|
    | no-var | error(App 6) | error(App 6) |
    | no-unused-vars | error(App/utils, `@typescript-eslint/`) | error(App/utils, `eslint(no-unused-vars)`) |
    | prefer-const | error(utils 2) | error(utils 2) |
    | eqeqeq | error(App 12) | error(App 12) |
    | no-console | warn(App 9) | warn(App 9) |
    | react-hooks/exhaustive-deps | warn(App) | warn(App, `react-hooks(...)`) |
    | **合計** | **7（error5/warn2）** | **7（error5/warn2）＝完全一致** |

  - 差が出た理由の推測: 今回選んだルールは oxlint 実装済みのため差ゼロ。no-unused-vars の帰属だけ表記差（ESLint=`@typescript-eslint/`、oxlint=`eslint()`）。exhaustive-deps は設定に `react/exhaustive-deps` と書いたが oxlint は `react-hooks(...)` として発火（内部で react-hooks 実装に解決）
  - 記事に書きたい気づき: 「移行で何が失われるか」は選ぶルール次第。メジャールールならこの規模では実質ロスなし。ニッチ/nursery/custom は要注意

### フェーズ3c: 実行時間計測

- [x] ESLint と oxlint を `time` で計測、比較表化（見積もり30分 → 実測 約3分）
  - 対象規模: **302 ファイル / 2,127 行**（`src/gen/` に 300 ファイル生成して計測用に拡大）
  - 実行したコマンド（direct bin, 各5回・warm-up後, `timing.txt`）:
    ```bash
    for i in 1..5; do /usr/bin/time -p node_modules/.bin/eslint . ; done
    for i in 1..5; do /usr/bin/time -p node_modules/.bin/oxlint ; done
    ```
  - 計測値（real 秒）:

    | | 1 | 2 | 3 | 4 | 5 | min | median | 平均 |
    |---|---|---|---|---|---|---|---|---|
    | ESLint | 7.20 | 11.99 | 20.46 | 18.15 | 8.73 | 7.20 | 11.99 | 13.31 |
    | oxlint | 0.44 | 0.22 | 0.21 | 0.21 | 0.16 | 0.16 | 0.21 | 0.25 |

  - 速度比: median 比 ≈ **57倍**、min 比 ≈ **45倍**（この規模・この環境の簡易計測）
  - 注記: ESLint はブレが大きい（7〜20秒）。oxlint は安定して 0.2 秒前後。「50〜100倍」の触れ込みは、この小規模でも min比45倍で概ね方向性は正しい。ただし規模・キャッシュ・並列度で変わる旨は必ず併記
  - 既存技術と比べて感じた違い: 起動〜完了の体感が段違い。CI やエディタ保存時の待ちが消える将来像が見えた

### フェーズ3d: JSプラグイン(alpha)を試す

- [x] `jsPlugins` に ESLint プラグインを1つ指定し発火確認（見積もり20分 → 実測 約4分）
  - 使ったプラグイン: `eslint-plugin-jsdoc@63.0.12`。oxlint に **jsdoc の Rust 実装があり名前が衝突する**ため、公式が例示する**エイリアス記法**を採用
  - 設定（`.oxlintrc.json`）:
    ```json
    "jsPlugins": [{ "name": "jsdoc-js", "specifier": "eslint-plugin-jsdoc" }],
    "rules": { "jsdoc-js/require-param": "error" }
    ```
  - テスト対象（`@param b` を欠いた JSDoc）:
    ```ts
    /**
     * 2つの数を足す。
     * @param {number} a 最初の数
     */
    export function addDocumented(a: number, b: number): number { return a + b; }
    ```
  - 実行と出力（発火成功, `jsplugin-test.txt`）:
    ```
    npx oxlint src/plugin-test.ts
    src/plugin-test.ts:1:1: error jsdoc-js(require-param): Missing JSDoc @param "b" declaration.
    ```
  - 追加実験：直接指定（エイリアスなし）だとどうなるか → **エラー全文**:
    ```
    npx oxlint -c .oxlintrc.direct.json src/plugin-test.ts
    Failed to parse oxlint configuration file.
      x Plugin name 'jsdoc' is reserved, and cannot be used for JS plugins.
      | The 'jsdoc' plugin is already implemented natively in Rust within oxlint.
      | Using both the native and JS versions would create ambiguity about which rules to use.
      | To use an external 'jsdoc' plugin instead, provide a custom alias:
      | "jsPlugins": [{ "name": "jsdoc-js", "specifier": "eslint-plugin-jsdoc" }]
    ```
  - つまずいた理由: 「ESLint プラグイン名をそのまま書けば良い」と思い込むと、oxlint 内蔵と同名のプラグイン（jsdoc/import 等）で予約名エラーになる。エラーメッセージが対処法（エイリアス）まで提示してくれて親切
  - Node 版に関する注意: 設定スキーマ上 TS で書いた JS プラグインファイルの native 実行は Node **>=22.18.0 / ^20.19.0** が要件。今回は Node 22.17.0（下回る）だが、**JSパッケージ(eslint-plugin-jsdoc)を specifier 指定で使う分には問題なし**だった。自作 `.ts` プラグインを使うなら Node 更新が要る
  - 記事に書きたい気づき: 「alpha はどこまで動くか」→ **既存 ESLint プラグインが実際に読み込まれ発火した**。内蔵と同名なら `{name, specifier}` エイリアスが必須、というのが一次記録として価値

### フェーズ4: 深掘り・比較（--fix 範囲）

- [x] `oxlint --fix` と `eslint --fix` の自動修正範囲を比較（見積もり30分 → 実測 約2分）
  - 手順: `App.tsx`/`utils.ts` のコピーを2組作り、それぞれ `oxlint --fix` / `eslint --fix`（`fix-comparison.txt`）
  - 結果:
    - 両者とも **修正後ファイルが完全一致**（`diff` で差分なし）
    - 修正内容: `var unused = 42` → `const unused = 42`（no-var、未再代入なので const 化）、`let result` → `const result`（prefer-const）
    - 未修正（両者共通）: no-unused-vars, no-console, exhaustive-deps, eqeqeq（自動修正対象外）
  - 既存技術と比べて感じた違い: この範囲では自動修正の挙動も ESLint と等価。安心して `--fix` を置き換えられる
  - 記事に書きたい気づき: 検出だけでなく修正結果もバイト単位で一致したのは移行の安心材料

### フェーズ5: 振り返り・記録整備

- [x] 詰まりポイント表を実測で埋め、記事への写像を実績で紐付け、execution-log.md 保存（見積もり30分 → 実測 込み）

## 詰まった点と解決過程（記事の核）

| # | 詰まった点 | 原因 | 効いた対処 | 所要 | 解決/撤退 | 記事での活かし方 |
|---|---|---|---|---|---|---|
| 1 | `npx eslint .` が `Cannot read properties of undefined (reading 'Cjs')` でクラッシュ | `typescript@latest`=7.0.2 が typescript-eslint 8.x の peer 範囲外（<6.1.0）。TS7未対応 | `pnpm add -D typescript@5.9.3` に固定 | 約3分 | 解決 | 「新人が最新TSを入れると ESLint が起動しない」罠。peer 警告を無視しない教訓（knowledge化） |
| 2 | jsPlugins 直接指定 `"eslint-plugin-jsdoc"` が予約名エラー | oxlint 内蔵の jsdoc(Rust) と名前衝突 | `{ "name":"jsdoc-js", "specifier":"eslint-plugin-jsdoc" }` エイリアス記法 | 約2分 | 解決 | 「alpha で詰まる典型」。内蔵同名プラグインはエイリアス必須。エラーが解決策を提示 |
| 3 | 設定なし oxlint の検出が ESLint より少なく見え不安 | oxlint 既定は correctness 中心の狭いルールセット | migrate で ESLint 設定を移植（→87ルール）してから比較 | 約1分 | 解決 | 「移行前後でデフォルト守備範囲が違う」。素の oxlint だけ見て判断しないこと |

### 予測（詰まりポイント表）と実際の差分
- 予測#1（migrate が flat config でないと動かない）→ 最初から flat config で用意したので**踏まなかった**（事前調査が効いた）
- 予測#3（jsPlugins のエイリアス要否）→ **的中**。内蔵同名プラグインで実際にエイリアス必須だった
- 予測#5（速度が盛りすぎに見える）→ ESlint 側のブレが大きく、min比45〜median比57倍。3回以上計測＋環境併記の重要性を実感
- 予測#6（Windows OOM）→ macOS で検証のため非該当（記事では「未検証」と明記）
- **想定外**：詰まり#1（TS7 と typescript-eslint の非互換）は元の予測表に無かった新種

## スクリーンショット一覧

| ファイル | 何を示すか | 使う見出し |
|---|---|---|
| screenshots/01-summary.png | 移行結果・検出差・速度比・jsPlugin・--fix の全結果サマリ（環境情報付き） | 5.移行と実測 / 6.JSプラグイン / 9.ESLintと比べて |

## 記事への写像（実績で埋める）

| 記事の見出し | 使う記録 / スクショ | 書くこと（メモ） |
|---|---|---|
| 1. はじめに | フェーズ1 動機メモ | ESLintしか知らない新人が oxlint を試す動機・不安 |
| 2. なぜ今oxlintを試すのか | フェーズ1 調査メモ | 2026-03 JSプラグイン alpha・速度の話題性 |
| 3. 事前に調べたこと | フェーズ1 参照URL/要点 | migrate=flat config専用 / alpha制約（FW/Win OOM/type-aware） |
| 4. 環境構築 | フェーズ2a/2b ログ・**詰まり#1 全文** | サンプル準備・install・TS7クラッシュと `typescript@5.9.3` 固定 |
| 5. 移行と実測 | フェーズ3a/3b/3c・`.oxlintrc.json`・`timing.txt`・screenshots/01 | 87ルール移行・検出差ゼロ・速度45〜57倍表 |
| 6. JSプラグインを試す | フェーズ3d・`jsplugin-test.txt` | エイリアス記法で発火 / 直接指定は予約名エラー |
| 7. 詰まった点 | 「詰まった点」表・各エラー全文 | TS7クラッシュ・予約名エラーの解決過程 |
| 8. 分かったこと | フェーズ4・振り返り | メジャールールは実質ロスなし・--fix も一致・alphaは既存プラグイン動く |
| 9. ESLintと比べて | フェーズ3c/フェーズ4 | 速度・検出範囲・--fix・設定移行のしやすさ |
| 10. どんな人向けか | フェーズ5 棚卸し | 速度が欲しい人は今すぐ/ニッチ・custom plugin依存は要検証 |
| 11. まとめ | 結果サマリー | 次にやること・alpha の今後（semver対象外に注意） |

## 未達・撤退した項目

- なし（完了条件3件すべて達成）。※ Windows OOM（予測#6）と custom plugin 自動移行（migrate注意）は今回の環境・構成で非該当のため「未検証」として記事に明記する

## 再現性メモ（記事に転記する用）

- OS / ランタイム / 主要ライブラリ: macOS 15 (arm64) / Node v22.17.0 / pnpm 10.13.1 / eslint 10.6.0 / typescript-eslint 8.63.0 / **typescript 5.9.3（重要: 7.x は不可）** / oxlint 1.73.0 / eslint-plugin-jsdoc 63.0.12
- 最短の再現手順:
  ```bash
  pnpm add -D eslint @eslint/js typescript-eslint eslint-plugin-react-hooks globals
  pnpm add -D typescript@5.9.3          # ← 7.x を掴むと eslint がクラッシュする
  npx eslint .                          # ベースライン
  pnpm add -D oxlint
  npx @oxlint/migrate ./eslint.config.js   # → .oxlintrc.json（87ルール）
  npx oxlint .                          # 移行後
  # JSプラグイン(alpha):
  pnpm add -D eslint-plugin-jsdoc
  # .oxlintrc.json: "jsPlugins":[{"name":"jsdoc-js","specifier":"eslint-plugin-jsdoc"}], rules:{"jsdoc-js/require-param":"error"}
  npx oxlint src/plugin-test.ts
  ```
- 注意点:
  - `typescript@latest`(7.x) は typescript-eslint 8.x の peer 範囲外。ESLint 起動不能（`Cannot read ... 'Cjs'`）→ 5.9.x に固定
  - oxlint 内蔵と同名の ESLint プラグイン（jsdoc/import 等）は `{name, specifier}` エイリアス必須
  - 自作 `.ts` の JS プラグインを使うなら Node >=22.18.0 / ^20.19.0
  - 速度計測は規模・キャッシュ・並列度で変動。3回以上＋対象規模・環境併記
  - JS Plugins は alpha（semver 対象外）。Windows OOM の既知問題あり（本検証は macOS のみ）

## 次のアクション（記事化）

- [ ] この execution-log.md の「記事への写像」に沿って articles/<slug>.md を作成する
- [ ] スクショを Zenn 用に `images/<slug>/` へ配置する
- [ ] 完了条件・詰まった点（特にTS7クラッシュとエイリアス必須）・速度比較を本文に落とす
