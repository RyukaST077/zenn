# 検証ログ: Zodしか知らない新人がArkTypeを型主導構文で書き比べてみた

> Zenn記事の素材。実行の一次情報（コマンド・エラー全文・所要時間）を記録。
> 記事本文は未執筆。「記事への写像」を見て articles/*.md に展開する。

## 実行の前提（採用した前提）

- 対象タスク: `practice/practice-arktype-20260718-0405.md`
- 出典レポート: `research/search-topic-20260718-0402.md`
- 対象技術: ArkType 2.2.3（比較対象 Zod v4.4.3）
- 実行者: AIエージェント単独（非対話）
- 実行日時 / 所要時間: 2026-07-18 04:07〜04:11 / 見積もり 約4h15m → 実測 約35分（AI単独・待ち時間ほぼなしのため短い）
- 実行環境: macOS 26.5 / Node v22.17.0 / TypeScript 7.0.2 / arktype 2.2.3 / zod 4.4.3
- 採用した撤退ライン: 1タスク30分で詰まったら記録してスキップ or 等価手段に切替（タスク既定を踏襲）。今回は撤退なし。
- 判断方針: 引数は対象タスクファイルのみ指定。時間・撤退ラインはタスク既定を採用。フェーズ1の事前調査はタスクファイルの裏取りメモを一次情報として引き継ぎ、構文の真偽は実装時の `tsc`/`node` 出力で客観判定した（非対話のため WebFetch は行わず、実挙動で答え合わせ）。

## 結果サマリー

- 完了条件の判定: **達成**（3条件すべて客観的に確認）
- 作ったもの: Zod v4 と ArkType 2.2 で同一の「ユーザー登録フォーム」schema を実装し、正常系1件＋異常系3件を突き合わせる最小プロジェクト。`workspace/`（`src/zod-schema.ts` / `src/arktype-schema.ts` / `src/run.ts` / `src/type-test.ts` / `src/type-error-demo.ts` / `src/type-fn.ts`）
- スクショ: 0 枚（CLI/API 完結のためスクショ不要。判定は CLI 出力で実施。`commands.log` に全出力あり）
- 詰まった点: 4 件（うち解決 4 / 未解決・撤退 0）
- knowledge 記録: なし（詰まった4点はいずれも公式仕様・エラーメッセージの指示どおりに即解決。既存 knowledge の再利用も不要）

## 完了条件の検証

| # | 完了条件 | 判定 | 根拠（ログ） |
|---|---|---|---|
| 1 | `npx tsc --noEmit` が両ファイルとも型エラーなしで通る | 達成 | `commands.log`「tsc final (full build)」で `tsc exit=0`。schema 2ファイル＋run.ts＋type-test.ts を含む build が通過 |
| 2 | `node --experimental-strip-types src/run.ts` で正常系1件・異常系3件の Zod / ArkType 双方の結果とエラーメッセージが出力される | 達成 | `commands.log`「node run.ts」に4ケース全出力（node exit=0） |
| 3 | 型推論の一致確認（`.infer` 型への代入テスト）が両ライブラリで通る（またはズレを記録） | 達成（ズレを記録） | `type-test.ts` は通過。ただし `exactOptionalPropertyTypes:true` 下で optional の推論がズレる点を検出・記録（下記 詰まった点#4） |

## タスク実行ログ（フェーズ別）

### フェーズ1: 事前調査（構文の違いメモ・フィールド確定）

- [x] Zodと違うと感じた点を3つ言語化（見積もり 20分 → 実測 数分・裏取りメモ引き継ぎ）
  - Zodと違う3点（実装前の当たり → 実装で答え合わせ済み）:
    1. **文字列DSL**: Zodはメソッドチェーン（`z.string().min(1)`）、ArkTypeは文字列（`"string >= 1"`）で型を表現する。
    2. **成功/失敗の分岐**: Zodは `safeParse().success`、ArkTypeは戻り値が成功データ or `type.errors` で `out instanceof type.errors` 判定。
    3. **静的型の取り出し**: Zodは `z.infer<typeof S>`、ArkTypeは `typeof T.infer`。
  - 記事に書きたい気づき: この3点はすべて実装で実際に効いた（後述）。特に「型がそのまま文字列」という発想の切り替えが最初の壁。
- [x] フィールド定義を確定（見積もり 10分 → 実測 即）
  - 確定した定義: `name: 1文字以上の文字列` / `email: メール形式` / `age: 0以上の数値` / `role: "admin" | "user"` / `tags?: string[]（optional）`

### フェーズ2: 環境構築（npm init / install / tsconfig / Hello World）

- [x] `npm init -y`（見積もり 5分 → 実測 即）
  - 実行したコマンド:
    ```bash
    npm init -y
    ```
  - 出力: `workspace@1.0.0` の package.json を生成（`main: index.js` 等の既定）。
- [x] `npm i arktype zod typescript` と実バージョン記録（見積もり 10分 → 実測 約15秒）
  - 実行したコマンド:
    ```bash
    npm i arktype zod typescript
    npm ls arktype zod typescript
    ```
  - 出力（全文）:
    ```
    added 7 packages, and audited 8 packages in 13s
    found 0 vulnerabilities

    workspace@1.0.0
    +-- arktype@2.2.3
    +-- typescript@7.0.2
    `-- zod@4.4.3
    ```
  - 既存技術と比べて感じた違い: **要確認事項の答え合わせ** → レポート記載の「arktype 2.2.3」は実インストールでも `2.2.3` で一致（公式BlogのGA表記2.2.0より新しいパッチが入る）。
  - 記事に書きたい気づき: **TypeScript が 7.0.2 で入った**（`npx tsc --version` も `Version 7.0.2`）。`typescript@latest` が TS7 系（ネイティブ移植版）を指すようになっていた。ArkType は TS 5.1以上要件なので問題なく動いたが、「latest を入れたら 7 が来た」は再現性メモに残す価値あり。
- [x] tsconfig 作成（見積もり 15分 → 実測 数分）
  - 作った tsconfig.json（全文）:
    ```json
    {
      "compilerOptions": {
        "strict": true,
        "skipLibCheck": true,
        "exactOptionalPropertyTypes": true,
        "target": "ES2022",
        "module": "NodeNext",
        "moduleResolution": "NodeNext",
        "noEmit": true,
        "allowImportingTsExtensions": true,
        "verbatimModuleSyntax": false
      },
      "include": ["src"],
      "exclude": ["src/type-error-demo.ts"]
    }
    ```
    ※ `allowImportingTsExtensions` はフェーズ3で `.ts` 拡張子 import が必要になり追加（詰まった点#2）。`exclude` は「わざと型エラーになるデモ」を本 build から外すため。
  - **`strict` を外すと ArkType が動かない**ことを実際に確認（詰まった点#1）。
- [x] Hello World（見積もり 15分 → 実測 数分）
  - 実行したコマンド:
    ```bash
    # src/hello.ts: type({ name: "string" })({ name: "x" }) を実行
    npx tsc --noEmit
    node --experimental-strip-types src/hello.ts
    ```
  - 出力（全文）:
    ```
    (node:83231) ExperimentalWarning: Type Stripping is an experimental feature and might change at any time
    (node:83231) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file .../src/hello.ts is not specified and it doesn't parse as CommonJS.
    Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
    To eliminate this warning, add "type": "module" to .../package.json.
    hello arktype: { name: 'x' }
    ```
  - 効いた対処: `npm pkg set type=module` で `MODULE_TYPELESS_PACKAGE_JSON` 警告を解消（詰まった点#3）。以後 `ExperimentalWarning` のみ。
  - つまずいた理由: Node v22 の型ストリップ実行は ESM/CJS 判定を package.json に依存する。`"type": "module"` 未指定だと毎回再パース警告が出る。

### フェーズ3: 実装・検証【本編】

- [x] `src/zod-schema.ts`（Zod v4）実装＋`z.infer` export（見積もり 25分 → 実測 数分）
  - コード全文:
    ```ts
    import { z } from "zod";
    export const UserSchema = z.object({
      name: z.string().min(1),
      email: z.email(),
      age: z.number().min(0),
      role: z.enum(["admin", "user"]),
      tags: z.array(z.string()).optional(),
    });
    export type User = z.infer<typeof UserSchema>;
    ```
  - 気づき: Zod v4 では `z.email()` がトップレベル関数（v3 の `z.string().email()` から移行済み）。メソッドチェーンで直感的に書けた。
- [x] `src/arktype-schema.ts`（ArkType 2.2）で同内容を文字列DSL実装＋`.infer` export（見積もり 35分 → 実測 約10分）
  - コード全文:
    ```ts
    import { type } from "arktype";
    export const UserType = type({
      name: "string >= 1",       // 1文字以上（文字列長は string >= N）
      email: "string.email",
      age: "number >= 0",
      role: "'admin' | 'user'",  // リテラルunionは内側にクォート
      "tags?": "string[]",       // optional は値ではなくキー側に ?
    });
    export type User = typeof UserType.infer;
    ```
  - Zodと1対1で対応しなかった書き方（迷った箇所）:
    - `name` 文字列長: 記録テンプレの当たりでは `"string > 0"` か `"string >= 1"` か未確定だった → **`"string >= 1"` で `tsc` 通過**を確認（1文字以上）。
    - `role` の union: JS的に `"admin" | "user"` と書きたくなるが、ArkTypeでは**文字列の内側にクォート**が必要（`"'admin' | 'user'"`）。ここが最大の発想の切り替え。
    - `tags?`: optional は**値ではなくキー側**に `?` を付ける（`"tags?": "string[]"`）。Zodの `.optional()` とは付け位置が逆。
  - 既存技術と比べて感じた違い: 一度ルール（クォート位置・比較演算子・optionalのキー側?）を覚えると、ArkTypeの方がスキーマ全体が短く1画面に収まる。
- [x] `src/run.ts` で正常系1件＋異常系3件を両schemaに流す（見積もり 40分 → 実測 約10分）
  - 実行したコマンド:
    ```bash
    npx tsc --noEmit
    node --experimental-strip-types src/run.ts
    ```
  - 出力（全文・warning除く）:
    ```
    ==============================
    [正常系]
    input: {"name":"Alice","email":"alice@example.com","age":30,"role":"admin","tags":["a","b"]}
      Zod    : OK  {"name":"Alice","email":"alice@example.com","age":30,"role":"admin","tags":["a","b"]}
      ArkType: OK  {"name":"Alice","email":"alice@example.com","age":30,"role":"admin","tags":["a","b"]}

    ==============================
    [異常系1: 型違い（age が文字列）]
    input: {"name":"Bob","email":"bob@example.com","age":"30","role":"user"}
      Zod    : NG
               - [age] Invalid input: expected number, received string
      ArkType: NG
               - summary: age must be a number (was a string)

    ==============================
    [異常系2: 必須欠落（email なし）]
    input: {"name":"Carol","age":20,"role":"user"}
      Zod    : NG
               - [email] Invalid input: expected string, received undefined
      ArkType: NG
               - summary: email must be a string (was missing)

    ==============================
    [異常系3: regex不一致（email がメール形式でない）]
    input: {"name":"Dave","email":"not-an-email","age":40,"role":"user"}
      Zod    : NG
               - [email] Invalid email address
      ArkType: NG
               - summary: email must be an email address (was "not-an-email")
    ```
  - エラーメッセージの文言・構造の違い（1件ずつ）:
    | ケース | Zod v4 | ArkType 2.2 |
    |---|---|---|
    | 型違い(age) | `Invalid input: expected number, received string` | `age must be a number (was a string)` |
    | 必須欠落(email) | `Invalid input: expected string, received undefined` | `email must be a string (was missing)` |
    | email形式 | `Invalid email address` | `email must be an email address (was "not-an-email")` |
  - 気づき: ArkTypeのメッセージは**フィールド名と実際の値を文中に含む**（`(was "not-an-email")`）ため、そのまま人向けに読みやすい。Zodは `issue.path` を自分で組み立てる必要がある一方、メッセージ本文はフィールド非依存で一貫。欠落を Zod は「received undefined」、ArkType は「was missing」と表現するのも対比になる。
- [x] 型推論の一致確認（正しい代入＋誤った代入で型テスト）（見積もり 20分 → 実測 約10分）
  - 正しい値の代入テスト（`type-test.ts`）: `tsc` 通過（両推論型に正常値を代入OK、optional 省略もOK）。
  - 誤った値の代入テスト（`type-error-demo.ts`、期待＝コンパイル失敗）:
    - 実行したコマンド:
      ```bash
      npx tsc --noEmit src/type-error-demo.ts --ignoreConfig --strict --skipLibCheck \
        --exactOptionalPropertyTypes --target ES2022 --module NodeNext \
        --moduleResolution NodeNext --allowImportingTsExtensions
      ```
    - 出力（全文）:
      ```
      src/type-error-demo.ts(8,3): error TS2322: Type '"superadmin"' is not assignable to type '"admin" | "user"'.
      src/type-error-demo.ts(14,3): error TS2322: Type 'string' is not assignable to type 'number'.
      ```
    - つまずいた点: TS7 では tsconfig がある状態でファイルを直接指定すると `TS5112` が出る → `--ignoreConfig` を付けて回避（詰まった点＝TS7の新挙動、下記#2に併記）。
  - **推論型のズレを検出（重要）**: `exactOptionalPropertyTypes: true` のもとで
    - Zod の推論: `tags?: string[] | undefined`
    - ArkType の推論: `tags?: string[]`（`| undefined` を含まない）
    のため、Zod型→ArkType型の相互代入が型エラーになった（詰まった点#4）。エラー全文:
      ```
      src/type-test.ts(30,7): error TS2375: Type '{ ...; tags?: string[] | undefined; }' is not assignable to type '{ ...; tags?: string[]; }' with 'exactOptionalPropertyTypes: true'. Consider adding 'undefined' to the types of the target's properties.
        Types of property '"tags?"' are incompatible.
          Type 'string[] | undefined' is not assignable to type 'string[]'.
            Type 'undefined' is not assignable to type 'string[]'.
      ```

### フェーズ4: 深掘り・比較

- [x] ArkType 2.2 の `type.fn`（ランタイム検証付き関数）を実行（見積もり 20分 → 実測 約10分）
  - コード全文（`type-fn.ts`）:
    ```ts
    import { type } from "arktype";
    const lengthOf = type.fn("string", ":", "number")((s) => s.length);
    console.log('lengthOf("hello") =', lengthOf("hello"));
    try {
      // @ts-expect-error 型でも弾かれる（コンパイルエラー）が、ランタイム検証も走ることを確認
      const bad = lengthOf(123);
      console.log("result:", bad);
    } catch (e) {
      console.log("throw:", (e as Error).message);
    }
    ```
  - 実行ログ（warning除く）:
    ```
    === type.fn 正常値 ===
    lengthOf("hello") = 5
    === type.fn 不正な引数（number を渡す） ===
    throw: value at [0] must be a string (was a number)
    ```
  - 不正引数を渡したときの挙動: **コンパイル時**は `@ts-expect-error` が有効（＝型でも弾かれる）、**ランタイム**でも `value at [0] must be a string (was a number)` を throw。Zodには無い「関数の引数/戻り値を1行でランタイム検証する」体験。
- [x] エラーメッセージ・書き味の比較メモ（見積もり 10分 → 実測 数分）
  - Zodのほうが楽だった点: ①メソッドチェーンで補完が効き、union/optionalの書き方に迷わない（`.enum([...])` / `.optional()`）。②`safeParse().success` の分岐が素直で `instanceof` を知らなくても書ける。
  - ArkTypeが良かった点: ①スキーマが文字列DSLで短く、1画面に収まる。②エラーメッセージが「フィールド名＋実値」入りで人にそのまま見せられる。③`type.fn` で関数のランタイム検証まで型定義に寄せられる。

### フェーズ5: 振り返り・記事化準備

- [x] 詰まった点トップ3の棚卸し（下記「詰まった点」表）
- [x] 記事への写像を実績で更新（下記表）

## 詰まった点と解決過程（記事の核）

| # | 詰まった点 | 原因 | 効いた対処 | 所要 | 解決/撤退 | 記事での活かし方 |
|---|---|---|---|---|---|---|
| 1 | `strict` を外すと ArkType の型が壊れる | ArkTypeは `strict`（または `strictNullChecks`）必須。無効だと型が正しく出ない | tsconfig に `strict: true`。実際に外すと **型レベルのエラーメッセージ**が出る（下記） | 数分 | 解決 | 「ArkTypeは tsconfig 前提が厳しい」新人の落とし穴。Zodは緩くても動く対比。型がエラー文を返す面白さ |
| 2 | `.ts` 拡張子 import が `tsc` で弾かれる／TS7でファイル直指定が弾かれる | `node --experimental-strip-types` は `.ts` 付き import が必要だが `allowImportingTsExtensions` 未設定だと TS5097。TS7 は tsconfig 併存でファイル直指定すると TS5112 | `allowImportingTsExtensions: true` を追加。ファイル直指定時は `--ignoreConfig` | 数分 | 解決 | 「TSをそのまま動かす」寄り道。ArkType固有ではなくTS7×型ストリップの現代事情 |
| 3 | `node` 実行で `MODULE_TYPELESS_PACKAGE_JSON` 警告 | package.json に `"type"` 未指定でESM/CJS再パース | `npm pkg set type=module` | 即 | 解決 | 環境構築セクションの小ネタ |
| 4 | 両ライブラリの推論型がズレて相互代入が型エラー | `exactOptionalPropertyTypes:true` で Zod は `tags?: string[] | undefined`、ArkType は `tags?: string[]` と optional の推論が違う | ズレとして記録（片方向は通る）。厳密一致を求めるなら片側に合わせる必要 | 約10分 | 解決（仕様差として記録） | 「推論は完全一致しない」核心。TS2375 全文を貼る |

> 予測（詰まりポイント表）との差分: 予測どおり詰まったのは #1（strict必須）・文字列DSL（クォート/optional位置）。予測に無く新たに出たのは **#2 のTS7挙動（TS5112 / latestでTS7が入る）** と **#4 の exactOptionalPropertyTypes 起因の推論ズレ**。文字列DSLは「30分以上詰まる」想定だったが、公式の当たり（`"string >= 1"` 等）が正しく、実測は迷いなく通過。

## スクリーンショット一覧

CLI/API 完結のためスクショなし。全出力は `commands.log`（106行）に保存。判定は CLI 出力で実施。

## 記事への写像（実績で埋める）

| 記事の見出し | 使う記録 / ログ | 書くこと（メモ） |
|---|---|---|
| 1. はじめに | 前提・動機 | Zodは使えるがArkTypeは名前だけ、という立ち位置 |
| 2. なぜArkTypeを試すのか | フェーズ1メモ / 出典レポート | fastest-growing / Zod代替 / TSKaigi文脈 |
| 3. 事前に調べたこと | フェーズ1の3点メモ / タスク裏取りメモ | 文字列DSL・`instanceof type.errors`・`.infer` の当たり |
| 4. 環境構築 | フェーズ2ログ / commands.log | install実バージョン(arktype2.2.3/zod4.4.3/**TS7.0.2**)・tsconfig全文・詰まった点#1〜#3 |
| 5. 同じschemaをZodとArkTypeで書く | `zod-schema.ts` / `arktype-schema.ts` 全文＋フィールド単位表 | 両コードと1対1対応（クォート/比較/optional位置） |
| 6. 詰まった点（文字列DSL・型エラー） | 詰まった点表 / TS2375・TS5097・TS5112 全文 | 内側クォート/optionalキー側?/strict必須（型がエラー文を返す） |
| 7. 触ってみて分かったこと | フェーズ3〜4ログ / `run.ts`出力 / `type-fn.ts` | `type.fn`の体験、推論のズレ(#4) |
| 8. Zodと比べて感じたこと | フェーズ4比較メモ / エラー文言比較表 | 書き味・エラー文言・向き不向き |
| 9. どんな人に向いていそうか | フェーズ5棚卸し | 型主導が好きな人 / Zod資産がある人 |
| 10. まとめ | 結果サマリー | 新人が試した範囲の明示、次に試すこと |

## フィールド単位の書き比べ表（実績で確定）

| フィールド | Zodの書き方 | ArkTypeの書き方 | 迷った点 |
|---|---|---|---|
| name (1文字以上) | `z.string().min(1)` | `"string >= 1"` | 当たりでは `> 0` か `>= 1` か未確定 → `>= 1` で通過 |
| email | `z.email()` | `"string.email"` | Zod v4は `z.email()`（トップレベル）。ArkTypeは `string.email` サブタイプ |
| age (0以上) | `z.number().min(0)` | `"number >= 0"` | 比較演算子をそのまま文字列に書く発想 |
| role (union) | `z.enum(["admin","user"])` | `"'admin' \| 'user'"` | **内側クォート**必須。ここが最大の壁 |
| tags? (optional) | `tags: z.array(z.string()).optional()` | `"tags?": "string[]"` | optional は値でなく**キー側**に `?`。推論は `| undefined` の有無でズレる(#4) |

## 未達・撤退した項目

なし（完了条件3つすべて達成。撤退・スキップなし）。

## 再現性メモ（記事に転記する用）

- OS / ランタイム / 主要ライブラリ: macOS 26.5 / Node v22.17.0 / TypeScript 7.0.2 / arktype 2.2.3 / zod 4.4.3
- 最短の再現手順:
  ```bash
  mkdir arktype-vs-zod && cd arktype-vs-zod
  npm init -y
  npm pkg set type=module
  npm i arktype zod typescript
  # tsconfig.json に strict / skipLibCheck / exactOptionalPropertyTypes /
  #   target ES2022 / module NodeNext / allowImportingTsExtensions / noEmit を設定
  # src/ に zod-schema.ts / arktype-schema.ts / run.ts を作成
  npx tsc --noEmit
  node --experimental-strip-types src/run.ts
  ```
- 注意点:
  - `typescript@latest` は現在 **TS7 系（7.0.2）** が入る。ArkTypeは TS5.1以上要件なので動くが、TS7ではファイル直指定時に `--ignoreConfig` が要る場面がある（TS5112）。
  - ArkTypeは `strict`（または `strictNullChecks`）が**必須**。外すと型が「'strict' or 'strictNullChecks' must be set to true...」というエラーメッセージ型になる。
  - `node --experimental-strip-types` を使うなら tsconfig に `allowImportingTsExtensions: true`、package.json に `"type": "module"`。
  - `exactOptionalPropertyTypes: true` では Zod と ArkType で optional プロパティの推論（`| undefined` の有無）がズレる。

## 次のアクション（記事化）

- [ ] この execution-log.md の「記事への写像」に沿って articles/<slug>.md を作成する
- [ ] スクショは無し（CLI出力を本文にコードブロックで貼る）
- [ ] 完了条件・詰まった点・比較を本文に落とす（特に #1 strict必須 / #4 推論ズレ / エラー文言比較表が刺さる素材）
