---
title: "ArkTypeの型主導構文でZodと同じschemaを書き比べてみた"
emoji: "🦖"
type: "tech"
topics: ["arktype", "zod", "typescript", "validation"]
published: true
---

<!-- 前提: 出典ログ logs/run-arktype-20260718-0407/execution-log.md / 記事タイプ 検証ログ・書き比べ / slug arktype-vs-zod-type-syntax-try / published:false（ドラフト） -->

## はじめに

バリデーションといえば Zod しか使ったことがなくて、ArkType は名前だけ知っている状態でした。「Zod の代替として速い」「型をそのまま文字列で書く」みたいな話は目にするものの、実際どう書くのかは分かっていません。そこで、同じ「ユーザー登録フォーム」の schema を Zod v4 と ArkType 2.2 の両方で書いて、正常系1件と異常系3件を突き合わせてみました。

やってみた結論だけ先に書くと、schema 自体はどちらでも書けました。ただ ArkType 側は「型を文字列で表現する」という発想の切り替えが要るのと、tsconfig の前提が Zod より厳しくて最初に少しつまずきました。あと、`exactOptionalPropertyTypes: true` を入れると両者の推論型がぴったり一致しない、という細かい差も見つかりました。

想定読者は、私と同じく Zod は書けるけど ArkType は未経験、くらいの人です。

:::message
筆者は実務経験の浅い新人で、ArkType を触るのは初めてです。実行環境は macOS 26.5 / Node v22.17.0 / TypeScript 7.0.2 / arktype 2.2.3 / zod 4.4.3。手元の Mac で一通り試しました。
:::

## 使ったもの・環境

- **ArkType 2.2.3**（比較対象は Zod 4.4.3）
- Node v22.17.0（`--experimental-strip-types` で `.ts` を直接実行）
- TypeScript 7.0.2

作るものは「ユーザー登録フォーム」の schema です。フィールドはこの5つに固定しました。

- `name`: 1文字以上の文字列
- `email`: メール形式
- `age`: 0以上の数値
- `role`: `"admin" | "user"`
- `tags?`: `string[]`（optional）

「できた」と言える条件は3つに決めました。

1. `npx tsc --noEmit` が両 schema とも型エラーなしで通る
2. `node --experimental-strip-types src/run.ts` で正常系1件・異常系3件について Zod / ArkType 双方の結果とエラーメッセージが出る
3. `.infer` で取り出した型への代入テストが通る（ズレがあれば記録する）

結果としてはこの3つとも確認できました（3番目はズレを記録という形で）。

## 事前に調べたこと

書き始める前に、Zod と違いそうなポイントを3つだけ当たりを付けておきました。

1. **文字列DSL**: Zod はメソッドチェーン（`z.string().min(1)`）だけど、ArkType は型を文字列で表す（`"string >= 1"`）。
2. **成功/失敗の分岐**: Zod は `safeParse().success` を見る。ArkType は戻り値が成功データそのものか、失敗なら `type.errors` で、`out instanceof type.errors` で判定する。
3. **静的型の取り出し**: Zod は `z.infer<typeof S>`、ArkType は `typeof T.infer`。

この3点は実装で全部そのまま効いてきました。特に「型がそのまま文字列」という発想が最初の壁だったので、そこは後で詳しく書きます。

## 環境構築

まず普通に初期化して入れました。

```bash
npm init -y
npm pkg set type=module
npm i arktype zod typescript
npm ls arktype zod typescript
```

`npm ls` の出力はこうでした。

```
added 7 packages, and audited 8 packages in 13s
found 0 vulnerabilities

workspace@1.0.0
+-- arktype@2.2.3
+-- typescript@7.0.2
`-- zod@4.4.3
```

ここで一つ想定外だったのが、`typescript@latest` を入れたら **TypeScript が 7.0.2** で入ったことです。`npx tsc --version` も `Version 7.0.2` でした。latest が TS7 系（ネイティブ移植版）を指すようになっていたんですね。ArkType は TS 5.1 以上が要件なので動作自体は問題なかったのですが、この後 TS7 特有の挙動で少し引っかかったので、後半に書きます。

tsconfig はこうしました。

```json:tsconfig.json
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

`allowImportingTsExtensions` は後述の理由で途中から追加したものです。`exclude` に入れている `type-error-demo.ts` は「わざと型エラーになるデモ」なので本ビルドから外しています。

Hello World は `type({ name: "string" })({ name: "x" })` を実行するだけの `src/hello.ts` を作って動かしました。

```bash
npx tsc --noEmit
node --experimental-strip-types src/hello.ts
```

出力はこうです。

```
(node:83231) ExperimentalWarning: Type Stripping is an experimental feature and might change at any time
(node:83231) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file .../src/hello.ts is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to .../package.json.
hello arktype: { name: 'x' }
```

`MODULE_TYPELESS_PACKAGE_JSON` の警告は、package.json に `"type"` が無くて ESM/CJS の再パースが走ることが原因でした。実際、最初に package.json の `"type"` を未設定のまま `hello.ts` を動かしたのでこの警告が出ています。`npm pkg set type=module` で `"type": "module"` を入れると再パースが不要になり、以後は `ExperimentalWarning` だけになりました。

なお環境構築中に一番びっくりしたのは `strict` の扱いです。試しに tsconfig の `strict` を外したら ArkType の型が壊れました。ArkType は `strict`（または `strictNullChecks`）が必須で、無効だと「`'strict' or 'strictNullChecks' must be set to true...` に相当するエラーが**型として**返ってくる」んです。Zod は strict が緩くても動くので、ここは対比になりました。この話も後でもう少し書きます。

## 同じ schema を Zod と ArkType で書く

まず Zod v4 版。

```ts:src/zod-schema.ts
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

Zod v4 では `z.email()` がトップレベル関数になっていました（v3 の `z.string().email()` から移行済み）。メソッドチェーンで補完も効くので、迷うところはほぼ無かったです。

次が ArkType 2.2 版。同じ内容を文字列 DSL で書きます。

```ts:src/arktype-schema.ts
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

フィールドごとに並べるとこうなります。

| フィールド | Zod | ArkType | 迷った点 |
|---|---|---|---|
| name (1文字以上) | `z.string().min(1)` | `"string >= 1"` | 当初 `"string > 0"` か `"string >= 1"` か迷った → `>= 1` で `tsc` 通過 |
| email | `z.email()` | `"string.email"` | Zod v4 は `z.email()`（トップレベル）。ArkType は `string.email` サブタイプ |
| age (0以上) | `z.number().min(0)` | `"number >= 0"` | 比較演算子をそのまま文字列に書く |
| role (union) | `z.enum(["admin","user"])` | `"'admin' \| 'user'"` | 内側クォートが必須。ここが一番の壁 |
| tags? (optional) | `tags: z.array(z.string()).optional()` | `"tags?": "string[]"` | optional は値ではなくキー側に `?` |

書いていて一番戸惑ったのが `role` の union です。JS の感覚で `"admin" | "user"` と書きたくなるんですが、ArkType では文字列の内側にクォートを付けて `"'admin' | 'user'"` と書きます。ここが発想の切り替えが要るポイントでした。`tags?` の optional も、Zod だと値側に `.optional()` を付けるのに対して、ArkType はキー側に `?` を付ける（`"tags?": "string[]"`）ので、付ける場所が逆で最初は手が止まりました。

逆に、このルール（クォートの位置・比較演算子・optional はキー側）さえ覚えてしまえば、ArkType のほうが schema 全体が短くて1画面に収まる感じはありました。

## 正常系1件・異常系3件を流す

両 schema に同じ4ケースを流す `run.ts` を書きました。分岐の書き方が Zod と ArkType で違うところが見どころです。

```ts:src/run.ts
for (const c of cases) {
  // --- Zod ---
  const zodResult = UserSchema.safeParse(c.data);
  if (zodResult.success) {
    console.log("  Zod    : OK ", JSON.stringify(zodResult.data));
  } else {
    console.log("  Zod    : NG ");
    for (const issue of zodResult.error.issues) {
      console.log(`           - [${issue.path.join(".")}] ${issue.message}`);
    }
  }

  // --- ArkType ---
  const arkResult = UserType(c.data);
  if (arkResult instanceof type.errors) {
    console.log("  ArkType: NG ");
    console.log("           - summary:", arkResult.summary.replace(/\n/g, " / "));
  } else {
    console.log("  ArkType: OK ", JSON.stringify(arkResult));
  }
}
```

Zod は `safeParse().success` で分岐して `error.issues` を回す形。ArkType は戻り値をそのまま使い、失敗のときだけ `arkResult instanceof type.errors` になる、という判定です。この `instanceof` を知らないと最初ちょっと詰まるかもしれません。

実行はこう。

```bash
npx tsc --noEmit
node --experimental-strip-types src/run.ts
```

出力（warning は除いています）:

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

エラーメッセージの文言を並べるとこうです。

| ケース | Zod v4 | ArkType 2.2 |
|---|---|---|
| 型違い(age) | `Invalid input: expected number, received string` | `age must be a number (was a string)` |
| 必須欠落(email) | `Invalid input: expected string, received undefined` | `email must be a string (was missing)` |
| email形式 | `Invalid email address` | `email must be an email address (was "not-an-email")` |

面白かったのは、ArkType のメッセージがフィールド名と実際の値を文中に含んでいること（`(was "not-an-email")` のように）。そのまま人向けに出しても読める感じがしました。Zod のほうはメッセージ本文がフィールド非依存で一貫している代わりに、どのフィールドかは `issue.path` を自分で組み立てる必要があります。欠落を Zod は「received undefined」、ArkType は「was missing」と表現するのも対比として分かりやすかったです。

## 詰まった点と解決

### strict を外すと ArkType の型が壊れる

さっき触れた話ですが、tsconfig の `strict` を外すと ArkType の型が正しく出なくなります。ArkType は `strict`（または `strictNullChecks`）が必須で、無効にすると「`'strict' or 'strictNullChecks' must be set to true...` に相当するエラーメッセージが型として現れる」という挙動でした。tsconfig に `strict: true` を入れておけば解決です。Zod は strict が緩くても動くので、そこと比べると ArkType は tsconfig の前提がやや厳しく、新人が最初にハマりそうなところだと感じました。型がエラー文を返してくるのはちょっと面白い体験でもありました。

### `.ts` 拡張子の import と TS7 のファイル直指定

`node --experimental-strip-types` で `.ts` を直接動かすには、import 先も `.ts` 付きで書く必要があります（`import { UserSchema } from "./zod-schema.ts"` のように）。ただ `.ts` 拡張子付き import は `allowImportingTsExtensions` が無いと `tsc` に弾かれるので、tsconfig に `allowImportingTsExtensions: true` を追加しました。

それとは別に TS7 の挙動でも引っかかりました。誤った代入で型エラーが出ることを確かめるデモ（`type-error-demo.ts`）を、tsconfig がある状態でファイル直指定で `tsc` にかけたら `TS5112` が出たんです。これは `--ignoreConfig` を付けて回避しました。

```bash
npx tsc --noEmit src/type-error-demo.ts --ignoreConfig --strict --skipLibCheck \
  --exactOptionalPropertyTypes --target ES2022 --module NodeNext \
  --moduleResolution NodeNext --allowImportingTsExtensions
```

このデモの中身はこれです。

```ts:src/type-error-demo.ts
import type { User as ArkUser } from "./arktype-schema.ts";

const wrongRole: ArkUser = {
  name: "Eve",
  email: "eve@example.com",
  age: 25,
  role: "superadmin", // union に無い値
};

const wrongAge: ArkUser = {
  name: "Frank",
  email: "frank@example.com",
  age: "old", // number のはずが string
  role: "user",
};
```

期待どおりちゃんとコンパイル失敗しました。

```
src/type-error-demo.ts(8,3): error TS2322: Type '"superadmin"' is not assignable to type '"admin" | "user"'.
src/type-error-demo.ts(14,3): error TS2322: Type 'string' is not assignable to type 'number'.
```

このあたりは ArkType 固有というより「TS7 × 型ストリップ実行」という今の事情の話で、ArkType を試すつもりが TypeScript の現状に寄り道した感じでした。

### `exactOptionalPropertyTypes: true` で推論型がズレる

これが個人的には一番「へえ」となったところです。`.infer` で取り出した型に正しい値を代入するテスト（`type-test.ts`）自体は両方通ったのですが、Zod 型と ArkType 型を相互に代入しようとすると型エラーになりました。

原因は optional の推論の違いです。`exactOptionalPropertyTypes: true` のもとで、

- Zod の推論: `tags?: string[] | undefined`
- ArkType の推論: `tags?: string[]`（`| undefined` を含まない）

となっていて、`| undefined` の有無が食い違うんですね。そのため Zod 型 → ArkType 型の代入がこのエラーになりました。

:::details TS2375 全文
```
src/type-test.ts(30,7): error TS2375: Type '{ ...; tags?: string[] | undefined; }' is not assignable to type '{ ...; tags?: string[]; }' with 'exactOptionalPropertyTypes: true'. Consider adding 'undefined' to the types of the target's properties.
  Types of property '"tags?"' are incompatible.
    Type 'string[] | undefined' is not assignable to type 'string[]'.
      Type 'undefined' is not assignable to type 'string[]'.
```
:::

逆方向（ArkType 型 → Zod 型）は問題なく通りました。ここは片方向だけ通るという不思議な結果で、「同じ schema を書いても推論型が完全一致するわけではない」という学びになりました。厳密に一致させたいなら、どちらかに寄せる必要がありそうです。

## 触ってみて分かったこと・Zod と比べて

ArkType には Zod に無い体験として `type.fn` があって、関数の引数と戻り値をランタイムで検証できます。

```ts:src/type-fn.ts
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

まず `tsc` にかけると、こうなりました。

```
src/type-fn.ts(12,3): error TS2578: Unused '@ts-expect-error' directive.
```

`@ts-expect-error` を置いた行がエラーになっています。つまり型チェックでは `lengthOf(123)` はエラー扱いにならず、逆に「`@ts-expect-error` が未使用だ」と怒られたわけです。手元の ArkType 2.2 / TS7 の組み合わせでは、`type.fn` の引数の型不一致はコンパイル時には弾けていませんでした（弾いてくれる前提で書いていたので、ここは想定外でした）。

一方、実行するとこうなります。

```
=== type.fn 正常値 ===
lengthOf("hello") = 5
=== type.fn 不正な引数（number を渡す） ===
throw: value at [0] must be a string (was a number)
```

不正な引数を渡したとき、弾いてくれたのはランタイム側だけで、`value at [0] must be a string (was a number)` を throw しました。型でも弾かれると思い込んでいたので少し意外でしたが、関数の引数・戻り値を1行でランタイム検証できること自体は、Zod だと同じようには書けない体験でした。

書き味を比べた雑感としては、こんな感じです。

Zod のほうが楽だと感じたのは、メソッドチェーンで補完が効いて union / optional の書き方に迷わないところ（`.enum([...])` / `.optional()`）と、`safeParse().success` の分岐が素直で `instanceof` を知らなくても書けるところ。

ArkType が良いと思ったのは、schema が文字列 DSL で短くて1画面に収まること、エラーメッセージがフィールド名＋実値入りでそのまま人に見せられること、そして `type.fn` で関数のランタイム検証まで型定義に寄せられることです。

## どんな人に向いていそうか

あくまで新人が一通り書き比べた範囲での感想ですが、型を文字列でぎゅっと書くのが気持ちよさそうな人には ArkType は合いそうです。エラーメッセージをそのままユーザーに見せたい場面でも読みやすさで有利かなと思いました。一方で、すでに Zod の資産があってメソッドチェーンの補完に慣れているなら、無理に乗り換える理由は今のところ強くは感じませんでした。特に `exactOptionalPropertyTypes` 下で推論がズレる点は、Zod と混在させる場合に注意が要りそうです。

## まとめ

同じユーザー登録フォームの schema を Zod v4 と ArkType 2.2 で書いて、正常系・異常系を突き合わせるところまでやりました。決めた完了条件3つ（tsc が通る / run.ts が4ケース出力する / 推論型テスト）はすべて確認できて、3つ目は「推論がズレる」という差分を記録する形になりました。

つまずいたのは、ArkType では `strict` が必須なこと、union の内側クォートと optional のキー側 `?` という書き方の切り替え、それと `exactOptionalPropertyTypes` での推論の違いでした。あと ArkType とは直接関係ないところで、`typescript@latest` が TS7 系を入れてきてファイル直指定で `--ignoreConfig` が要る場面があったのも今どきの事情として記録しておきます。

次に試すなら、ArkType のもう少し複雑な型（narrow やモーフ、scope）や、Zod からの実際の移行がどれくらいの手間になるかを見てみたいです。

## 参考リンク

- ArkType 公式ドキュメント: https://arktype.io/
- Zod 公式ドキュメント: https://zod.dev/
- TypeScript `exactOptionalPropertyTypes`: https://www.typescriptlang.org/tsconfig/#exactOptionalPropertyTypes
- Node.js Type Stripping（`--experimental-strip-types`）: https://nodejs.org/api/typescript.html
