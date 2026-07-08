# 検証ログ: `node app.ts` が普通に動く時代を新人が試す — tsx/ts-node を卒業できるか、どこで詰まるか

> Zenn記事の素材。実行の一次情報（コマンド・エラー全文・所要時間）を記録。
> 記事本文は未執筆。「記事への写像」を見て articles/*.md に展開する。
> ブラウザ表示は発生しないため Playwright は不使用（完了判定は CLI 出力＋終了コード）。

## 実行の前提（採用した前提）

- 対象タスク: `practice/practice-node-native-typescript-20260705-0214.md`
- 出典レポート: `research/search-topic-20260705-0212.md`（候補#1・合計28点・「最初に試すべき1本」）
- 対象技術: Node.js ネイティブ TypeScript（type stripping / strip-only mode）
- 実行者: AIエージェント単独（非対話）
- 実行日時 / 所要時間: 2026-07-05 02:17〜02:22 JST / 見積もり 約3.8h → 実測 約0.4h（AI単独・非対話のため人の粒度とは異なる。draft-article 側で調整）
- 実行環境:
  - ローカルホスト: macOS 26.5 (Darwin 25.5.0, arm64) / **Node v22.17.0** / npm 10.9.2 / TypeScript 5.9.2
  - Docker: `node:24` イメージ = **Node v24.18.0** / npm 11.16.0（stable 領域の検証用）
- 採用した撤退ライン: 手元 Node が 22.18 未満のため、タスクの撤退ラインに従い (a) フラグ運用 `--experimental-strip-types` と (b) Docker `node:24`（stable）を併用して続行。1タスク30分超で詰まればスキップ（今回は該当なし）。
- 判断方針: 引数はタスクパスのみ。時間・スキルレベルは無指定 → デフォルト（半日 / 新人）を採用。手元 Node が想定（24.12+）より低かったため、**「バージョン境界を実演する」方向に振って**ローカル(22.17)とDocker(24.18)の両方で実行した。

## 結果サマリー

- 完了条件の判定: **達成**（4条件すべて客観ログで確認。うち条件1は stable 環境=Docker v24.18.0 で達成、ローカル v22.17.0 ではフラグ必須という境界も実演）
- 作ったもの: `node-native-ts-lab/`（動く最小 `.ts` ＋ 詰まる `.ts` 各種 ＋ 各実行ログ）。`workspace/node-native-ts-lab/`
- スクショ: 0 枚（ブラウザ表示なしのタスク。CLI 出力＋終了コードで判定）
- 詰まった点: 3 件（うち解決 3 / 未解決・撤退 0）
  1. ローカル Node が 22.18 未満で flagless 実行が SyntaxError（→ フラグ / Docker で解決）
  2. `npx tsc` が別パッケージ tsc@2.0.4 に解決され型チェック不可（→ `-p typescript` で解決）
  3. `.tsx` / decorator / 型import が想定と違う形で落ちる（→ 挙動を確認・記録）
- knowledge 記録: `knowledge/2026-07-05-npx-tsc-resolves-squatter-package.md`（`npx tsc` スクワッター問題を新規記録）

## 完了条件の検証

| # | 完了条件 | 判定 | 根拠（ログ） |
|---|---|---|---|
| 1 | `node app.ts` がフラグなしで実行でき期待文字列が出る | 達成（stable環境） | `logs/01-run-ok.txt`：Docker v24.18.0 で `hello, node native ts` / exit=0・警告なし。ローカル v22.17.0 は flagless で `SyntaxError: Unexpected token ':'`、`--experimental-strip-types` 付きで成功（ExperimentalWarning あり） |
| 2 | enum / 値namespace / パラメータプロパティ / 拡張子なしimport の4種で `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` 等を実際に踏みエラー全文を保存 | 達成 | `logs/enum.txt`・`logs/namespace.txt`・`logs/param-prop.txt`・`logs/import-ext.txt`（+ bonus: `logs/decorator.txt`・型importは `import-ext.txt`・`.tsx` は `logs/tsx-unsupported.txt`） |
| 3 | 型エラーのある `.ts` が node では素通りし、`tsc --noEmit` でだけ検出される | 達成 | `logs/type-check.txt`：`node type-error.ts` → `str` / exit=0、`tsc --noEmit` → `TS2322` / exit=2 |
| 4 | `tsx app.ts` と `node app.ts` の起動時間を計測して比較表にできる | 達成 | `logs/time-node.txt`（node 中央値0.05s）・`logs/time-tsx.txt`（tsx 初回1.89s→定常0.58〜0.61s）。下表参照 |

## タスク実行ログ（フェーズ別）

### フェーズ1: 事前調査（見積もり 30分 → 実測 数分）

- [x] 公式ドキュメントの要点整理（非対応構文・型チェックしない旨・拡張子必須）
  - 一次情報URL:
    - Node.js「Modules: TypeScript」 https://nodejs.org/api/typescript.html
    - Node.js Learn「Running TypeScript Natively」 https://nodejs.org/en/learn/typescript/run-natively
  - 要点（タスクの一次情報裏取り済みバージョン注記を採用）:
    - type stripping は「消せる型だけ」を空白置換で除去する **strip-only mode**。実行時コード生成が要る構文（enum / 値 namespace / パラメータプロパティ / 一部 decorator）は非対応。
    - node は**型チェックを行わない**（型エラーはそのまま実行される）。型検査は `tsc --noEmit` 等を別途回す。
    - import は**拡張子必須**（`./util` ではなく `./util.ts`）、型のみの import は **`import type` 必須**。
- [x] 手元バージョンの領域判定
  - `node -v` → **v22.17.0**。既定化（22.18+）**未満**＝flagless では動かない領域。stable（24.12/25.2+）にも当然未達。
  - 対応: フラグ `--experimental-strip-types` と Docker `node:24`(v24.18.0=stable領域) を併用。
- [x] 検証項目の確定: 最小実行 / 非対応構文（enum・namespace・param prop・拡張子import・型import・.tsx・decorator）/ 型エラー非検出 / node vs tsx 比較。

### フェーズ2: 環境構築（見積もり 40分 → 実測 数分）

- [x] 作業ディレクトリ `node-native-ts-lab/` と `logs/` 作成、`logs/versions.txt` にバージョン保存
  - `logs/versions.txt` にローカル(v22.17.0 / npm10.9.2 / TS5.9.2)と Docker(v24.18.0) を記録。
- [x] 最小 `app.ts` 作成・実行（見積もり 25分 → 実測 数分）
  - 実行したコマンド:
    ```bash
    # ローカル v22.17.0
    node app.ts                              # flagless
    node --experimental-strip-types app.ts   # フォールバック
    # Docker v24.18.0 (stable)
    docker run --rm -v "$PWD:/app" -w /app node:24 sh -c 'node app.ts; echo "exit=$?"'
    ```
  - 出力 / エラー（全文, `logs/01-run-ok.txt`）:
    ```
    # LOCAL v22.17.0 flagless
    $ node app.ts   (flagless)
    /.../app.ts:2
    function greet(name: string): string {
                       ^
    SyntaxError: Unexpected token ':'
        at wrapSafe (node:internal/modules/cjs/loader:1662:18)
        ...
    Node.js v22.17.0
    exit=1

    # LOCAL v22.17.0 with flag
    $ node --experimental-strip-types app.ts
    hello, node native ts
    (node:66143) ExperimentalWarning: Type Stripping is an experimental feature and might change at any time
    (Use `node --trace-warnings ...` to show where the warning was created)
    exit=0

    # DOCKER v24.18.0 (stable) flagless
    $ node app.ts
    hello, node native ts
    exit=0
    ```
  - つまずいた理由・分かっていなかった前提: 「Node 24 なら黙って動く」と思っていたが、手元は v22.17.0 で **22.18 未満**。既定化の境界は 0.01 刻みでシビア（22.**17**→NG、22.**18**→既定、24.12/25.2→stable=警告も消える）。
  - 既存技術との違い: tsx/ts-node は追加ランタイムなので Node バージョンにこの手の敏感さがない。ネイティブは「Nodeのバージョンそのもの」が対応表になる。
  - 記事に書きたい気づき: **冒頭で `node -v` を貼れ**。22.18/24.12/25.2 の3つの境界を1枚の図にすると新人に効く。「動いた瞬間のログ」は stable(Docker) の警告なし出力が一番きれい。

### フェーズ3: 実装・検証【本編】（見積もり 120分 → 実測 十数分）

すべて Docker `node:24`(v24.18.0) で実行（stable の代表挙動）。コマンドは
`docker run --rm -v "$PWD:/app" -w /app node:24 sh -c '<cmd>; echo "exit=$?"'`。

- [x] `enum`（`logs/enum.txt`）
  - 出力（全文）:
    ```
    /app/bad-enum.ts:2
    ...
    enum Color { Red, Green, Blue }
    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]: TypeScript enum is not supported in strip-only mode
        at parseTypeScript (node:internal/modules/typescript:68:40)
        ...
      code: 'ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX'
    Node.js v24.18.0
    exit=1
    ```
  - 気づき: enum は実行時に値オブジェクトを生成する＝「消せない」ので strip-only では原理的に不可。`const enum` でも不可（値生成が要る）。
- [x] `namespace`（値→NG / 型のみ→OK）（`logs/namespace.txt`）
  - 値namespace: `SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]: TypeScript namespace declaration is not supported in strip-only mode` / exit=1
  - 型のみnamespace(`ok-namespace.ts`): `ok` / exit=0
  - 気づき: **「namespace 全部ダメ」ではなく「値を持つ namespace だけダメ」**。型だけの namespace は消せるので動く。誤解しやすい境界。
- [x] パラメータプロパティ（`logs/param-prop.txt`）
  - 出力: `SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]: TypeScript parameter property is not supported in strip-only mode`（`constructor(private x: number ...)` の `private` を指す）/ exit=1
  - 気づき: 新人が最も無意識に書く構文。`constructor(private x)` は実行時に `this.x = x` を生成する＝消せない。回避は明示フィールド＋代入。
- [x] 拡張子なし import / 型を値として import / 修正版（`logs/import-ext.txt`）
  - 拡張子なし(`main-bad-ext.ts`, `import { version } from "./util"`):
    ```
    Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/app/util' imported from /app/main-bad-ext.ts
      code: 'ERR_MODULE_NOT_FOUND', url: 'file:///app/util'
    exit=1
    ```
  - 型を値として import(`main-bad-type.ts`, `import { Id } from "./util.ts"` で `Id` は型):
    ```
    SyntaxError: The requested module './util.ts' does not provide an export named 'Id'
    exit=1
    ```
  - 修正版(`main-ok.ts`, `import { version } from "./util.ts"` ＋ `import type { Id } ...`): `1.0.0 abc` / exit=0
  - 気づき: bundler/tsx は拡張子を暗黙補完し、型 import も自動判別してくれる。ネイティブは**両方とも手で正しく書く必要**があり、tsx 慣れした人が一番ハマる差分。
- [x] 型エラー非検出（node素通り vs tsc検出）（`logs/type-check.txt`）【記事の核心】
  - `node type-error.ts`（`const n: number = "str"`）→ `str` / **exit=0**（型を見ず whitespace 置換のみ）
  - `tsc --noEmit` → `type-error.ts(2,7): error TS2322: Type 'string' is not assignable to type 'number'.` / exit=2
  - **詰まった点（gotcha）**: 最初 `npx -y tsc --noEmit type-error.ts` を叩いたら別パッケージ `tsc@2.0.4` が取得され `This is not the tsc command you are looking for` で型チェックされなかった（下の「詰まった点」表 #2）。`npx -y -p typescript tsc ...` で解決。ローカル(TS5.9.2)でも同じ TS2322 を再現。
  - 気づき: 運用結論「**実行=node / 型チェック=tsc --noEmit（or エディタ/CI）**」。node が黙って動くので「型チェックされた」と誤解する危険が実際に体験できた。
- [x] `.tsx`（`logs/tsx-unsupported.txt`）
  - `node app.tsx` → `SyntaxError: Missing initializer in const declaration`（`const msg: string` の `: string` で失敗）/ exit=1
  - 気づき: node の strip-only は `.ts/.mts/.cts` が対象で、**`.tsx` は型を剥がさない**（JSX変換が必要なため）。だから型注釈がそのまま構文エラーになる。React 系新人が「なぜ .tsx が動かないか」を先回りできる。
- [x] （追加）decorator（`logs/decorator.txt`）
  - `node bad-decorator.ts` → `@log` の位置で `SyntaxError: Invalid or unexpected token` / exit=1
  - 気づき: レガシー(experimental) decorator も非対応。エラーコードは `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` ではなく素の Syntax( `@` を解釈できない)。可否表の穴埋めのため実測。

### フェーズ4: 深掘り・比較（見積もり 30分 → 実測 数分）

- [x] node vs tsx 起動時間（各3回, `/usr/bin/time -p`, ローカルホスト）
  - 公平性のためローカルホストで実行（Docker のコンテナ起動オーバーヘッドを timing に載せない）。ローカル node は v22.17.0 のため `--experimental-strip-types` を付与（stripping のコード経路は stable と同一・フラグは可否ゲートのみ）。
  - `logs/time-node.txt` / `logs/time-tsx.txt` の real 時間:

    | ランナー | run1 | run2 | run3 | 中央値 |
    |---|---|---|---|---|
    | `node --experimental-strip-types app.ts` | 0.08s | 0.05s | 0.05s | **0.05s** |
    | `npx tsx app.ts` | 1.89s | 0.61s | 0.58s | **0.61s** |

  - 注意（恣意的に盛らない）: tsx 側は `npx` の解決コストを含む。ローカルに tsx を入れて直接叩けば差は縮むが、それでも tsx はトランスパイル分の起動コストがある。初回1.89sは npx のパッケージ解決/キャッシュ warmup 込み。
- [x] node で動くもの/動かないものの対応表（`logs/tsx-coverage.txt` で tsx 側を実測）
  - tsx は enum/param-prop/値namespace を**すべて実行できた**（`0` / `Point { x: 1, y: 2 }` / `1`）。tsx は full transpile、node は strip-only という差が数字で出た。

  | 構文 / ケース | node (strip-only) v24.18.0 | tsx | 回避策 |
  |---|---|---|---|
  | 型注釈つき関数 (`app.ts`) | ✅ 動く | ✅ | — |
  | `enum` | ❌ ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX | ✅ (`0`) | union型/object as const、or tsx |
  | 値を持つ `namespace` | ❌ ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX | ✅ (`1`) | ESM module に置換、or tsx |
  | 型のみ `namespace` | ✅ 動く (`ok`) | ✅ | そのまま可 |
  | パラメータプロパティ | ❌ ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX | ✅ (`Point {x:1,y:2}`) | 明示フィールド＋代入、or tsx |
  | decorator (legacy) | ❌ SyntaxError (`@`) | （未計測 / tsx は設定次第） | 使わない、or tsx＋設定 |
  | 拡張子なし import (`./util`) | ❌ ERR_MODULE_NOT_FOUND | ✅（暗黙補完） | `./util.ts` と書く |
  | 型を値として import | ❌ SyntaxError(no export) | ✅（自動判別） | `import type` を使う |
  | `.tsx` | ❌ SyntaxError（型を剥がさない） | ✅ | tsx/bundler を使う |
  | 型エラー (`n: number = "str"`) | ⚠️ 素通り実行 (exit0) | ⚠️ 素通り（実行系は同じ） | `tsc --noEmit` を別途 |
  | 起動速度 (中央値) | 0.05s | 0.61s(npx込) | — |

## 詰まった点と解決過程（記事の核）

| # | 詰まった点 | 原因 | 効いた対処 | 所要 | 解決/撤退 | 記事での活かし方 |
|---|---|---|---|---|---|---|
| 1 | `node app.ts` が flagless で `SyntaxError: Unexpected token ':'` | 手元が **v22.17.0**（既定化 22.18 未満）で type stripping が無効 | `--experimental-strip-types` 付与、及び stable 検証は Docker `node:24`(v24.18.0) | 数分 | 解決 | 「必要バージョン」章。22.18/24.12/25.2 の3境界と `node -v` を冒頭に |
| 2 | `npx tsc --noEmit` が型チェックせず `This is not the tsc command you are looking for` | TypeScript 未インストール環境で `npx tsc` が同名スクワッター `tsc@2.0.4` を取得 | `npx -y -p typescript tsc ...`（パッケージ明示）。恒久策は `npm i -D typescript` | 数分 | 解決 | headless/CI 小ネタ＋型チェック運用の注意。knowledge にも記録 |
| 3 | `.tsx` / decorator / 型import が想定と違う落ち方 | `.tsx` は strip 対象外・decorator は `@` 非対応・型を値 import すると export 無し | それぞれ回避策（tsx使用 / decorator回避 / `import type`）を確認 | 数分 | 解決 | 「詰まった点集」でエラー全文＋境界の説明に使う |

予測（タスクの詰まりポイント表）との差分:
- 予測通り: enum/namespace/param-prop の `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`、拡張子/型 import、型エラー非検出、npx の非対話（`-y` 必要）。
- **予測外**: (a) 手元 Node が 22.18 **未満**でそもそも flagless が動かなかった（タスクは 24.12+ を想定）。(b) `npx tsc` がスクワッター別パッケージに解決される罠（`-y` だと黙って通る）。(c) `.tsx` のエラーが `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` ではなく素の SyntaxError（型を剥がさないため）。

## スクリーンショット一覧

なし（ブラウザ表示を伴わない CLI 検証タスク。完了判定は各 `logs/*.txt` の出力＋終了コード）。

## 記事への写像（実績で埋める）

| 記事の見出し | 使う記録 / ログ | 書くこと（メモ） |
|---|---|---|
| 1. はじめに（tsx/ts-node前提） | 前提・動機 / `logs/versions.txt` | なぜ今ネイティブTSを試すか。手元が v22.17.0 で「動くと思ったら動かなかった」導入が効く |
| 2. `node app.ts` を動かす（最小例＋必要バージョン） | `logs/01-run-ok.txt` / `logs/versions.txt` | flagless失敗(22.17)→フラグ→Docker(24.18 stable)成功の3段。22.18/24.12/25.2 の境界図。動いた瞬間の警告なしログ |
| 3. 詰まった点集（enum/namespace/param prop/拡張子/型import/.tsx/decorator） | `logs/enum.txt`・`namespace.txt`・`param-prop.txt`・`import-ext.txt`・`tsx-unsupported.txt`・`decorator.txt` | エラー全文＋原因。「値namespaceだけNG」「.tsxは剥がさない」など誤解しやすい境界 |
| 4. 型エラーは検出されない → tsc の運用 | `logs/type-check.txt` | node素通り(exit0) vs tsc TS2322(exit2)。`npx tsc` スクワッター罠と `-p typescript` の注意 |
| 5. tsx との比較（起動速度・カバー範囲） | `logs/time-node.txt`・`time-tsx.txt`・`tsx-coverage.txt` / 可否対応表 | 0.05s vs 0.61s の比較表（npx込の注記）。tsx は enum等も動く=full transpile の違い。使い分け結論 |
| 6. まとめ：新人が今から始めるなら | 結果サマリー / 詰まった点表 | 向いている人・運用結論（実行=node/型=tsc）・バージョン注意・回避策一覧 |

## 未達・撤退した項目

なし（4完了条件すべて達成）。
- 注記: 条件1「flagless 実行」は手元 v22.17.0 では成立せず、stable 環境(Docker v24.18.0)で達成。これは撤退ではなく、タスクの撤退ライン（フラグ運用 / Docker 併用）に沿った代替実行であり、かつバージョン境界という記事価値に転化した。

## 再現性メモ（記事に転記する用）

- OS / ランタイム / 主要ライブラリ:
  - macOS 26.5 (arm64) / Node **v22.17.0**（ローカル）・Node **v24.18.0**（Docker `node:24`）/ TypeScript **5.9.2** / tsx（`npx` 経由・都度取得）
- 実行コマンドの並び（最短の再現手順）:
  ```bash
  mkdir node-native-ts-lab && cd node-native-ts-lab
  # 動く最小例（Node 24.12+ ならフラグ不要 / 22.18〜24.11 は動くが警告 / 22.18未満は要 --experimental-strip-types）
  printf 'function greet(n: string): string { return `hi ${n}`; }\nconsole.log(greet("x"));\n' > app.ts
  node app.ts

  # 詰まる例（strip-only 非対応）
  printf 'enum C { A, B }\nconsole.log(C.A);\n' > bad-enum.ts && node bad-enum.ts   # ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX

  # 型エラーは node では素通り、tsc でだけ検出
  printf 'const n: number = "s";\nconsole.log(n);\n' > type-error.ts
  node type-error.ts                       # 素通り (exit 0)
  npx -y -p typescript tsc --noEmit type-error.ts   # TS2322 (exit 2) ※ -p typescript を必ず付ける
  ```
- 注意点（読者に関係する再現性情報）:
  - **バージョン境界**: 既定化=22.18+ / stable(警告なし)=24.12・25.2+。それ未満は `--experimental-strip-types` が要る（22.6〜22.17）。`node -v` を必ず確認・記事に明記。
  - **`npx tsc` はスクワッター注意**: TypeScript 未インストール環境では別パッケージが取得される。`npx -p typescript tsc` か `npm i -D typescript` を使う。
  - import は拡張子必須（`./util.ts`）、型は `import type`。`.tsx` は node の strip 対象外。
  - node は型を見ない。型検査は `tsc --noEmit`（またはエディタ/CI）を別途。

## 次のアクション（記事化）

- [ ] この execution-log.md の「記事への写像」に沿って `articles/<slug>.md` を作成する（`/draft-article`）
- [ ] スクショなしのため画像配置は不要。コード/ログの引用が中心
- [ ] 完了条件・詰まった点・比較表を本文に落とす（バージョン境界と `npx tsc` 罠は独自性が高い）
