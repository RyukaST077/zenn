---
title: "ESLintしか知らない新人がoxlintに移行してJSプラグイン(alpha)まで試してみた"
emoji: "🦀"
type: "tech"
topics: ["oxlint", "eslint", "typescript", "react", "oxc"]
published: true
---

<!-- 前提: 出典ログ logs/run-oxlint-eslint-migration-20260709-0407/execution-log.md / 記事タイプ: 検証ログ・試してみた / slug は汎用衝突を避けて具体化 -->

## はじめに

普段は ESLint しか触ったことがなくて、Rust 製リンタの oxlint は名前だけ知っている状態でした。「50〜100倍速い」という触れ込みを何度か目にしていたのと、2026年3月に JS プラグイン（alpha）が出て「既存の ESLint プラグインが動くらしい」という話が気になっていたので、実際に手を動かして確かめてみました。

やったことは、React + TypeScript の小さなサンプルに ESLint flat config を用意し、`@oxlint/migrate` で oxlint に移行して、検出結果・実行速度・自動修正の範囲を突き合わせる、というものです。最後に JS プラグイン（alpha）で ESLint プラグインを1つ読み込ませて発火するかも試しました。

結論から書くと、この規模・このルールセットでは検出結果も自動修正もほぼ完全に一致し、速度は環境依存ながら数十倍という差が出ました。ただ移行にたどり着く前に、oxlint とは関係のないところ（TypeScript のバージョン）で ESLint が起動しなくなる罠を踏んだので、そこも含めて書いておきます。

:::message
筆者は ESLint は使えるものの oxlint は初めての新人です。実行環境: macOS 15 (arm64) / Node v22.17.0 / pnpm 10.13.1。
:::

## 使ったもの・環境

再現できるようにバージョンを残しておきます。

- OS: macOS 15 (Darwin 25.5.0, arm64)
- Node v22.17.0 / pnpm 10.13.1
- eslint 10.6.0 / typescript-eslint 8.63.0
- **typescript 5.9.3**（後述しますが 7.x を掴むと ESLint が起動しません）
- oxlint 1.73.0 ＋ `@oxlint/migrate`
- eslint-plugin-jsdoc 63.0.12（JS プラグイン検証用）

作ったのは、わざと lint に引っかかるコードを混ぜた React + TypeScript の最小サンプルです。「ESLint で7件検出される状態」を作り、それを oxlint に移行して同じように検出できるかを見ました。

## 事前に調べたこと

いきなり動かす前に、oxc.rs の公式ドキュメントを読みました（いずれも 2026-07-09 閲覧）。

- Migrate from ESLint: https://oxc.rs/docs/guide/usage/linter/migrate-from-eslint.html
- JS Plugins Alpha ブログ（2026-03-11）: https://oxc.rs/blog/2026-03-11-oxlint-js-plugins-alpha.html

読んで頭に入れておいたのは次あたりです。

- 移行は `npx @oxlint/migrate <flat-config-path>` が基本で、生成物は `.oxlintrc.json`。
- migrate は **ESLint v9/v10 の flat config 専用**。旧来の `.eslintrc.*`（v8 legacy）だと先に flat config へ変換しておく必要がある。
- oxlint は ESLint コア＋主要プラグインの700超ルールを実装済み。未対応ルールは移行時にスキップされ、**カスタムプラグインは自動移行されない**。
- JS プラグイン（alpha）は `["eslint-plugin-xxx"]` か `{ "name": ..., "specifier": ... }` のエイリアス記法で指定する。既知の制約として、フレームワーク独自ファイル（`.vue`/`.svelte`）は限定的、Windows で OOM、type-aware なカスタムルールは非対応、とあった。

最初に「migrate は flat config 専用」と知れていたのは結果的に効きました。今回は最初から flat config で用意したので、ここでは手戻りしていません。あと JS プラグインが alpha（semver の対象外）という位置づけは、記事にするうえで明記しておくべきだと思いました。

## 環境構築

まず ESLint 側のベースラインを作ります。React + TypeScript のサンプルに flat config を入れました。

```js:eslint.config.js
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default [
  { ignores: ["node_modules/**", "dist/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser },
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "no-var": "error",
      "eqeqeq": "error",
      "no-console": "warn",
    },
  },
];
```

わざと引っかけるためのサンプルコードはこんな感じです。

```tsx:src/App.tsx
import React, { useEffect, useState } from "react";

// 意図的に lint 対象になるコードを混ぜたサンプル
export function App() {
  const [count, setCount] = useState(0);
  var unused = 42; // no-unused-vars / no-var 狙い

  useEffect(() => {
    console.log("mounted", count);
  }, []); // react-hooks/exhaustive-deps 狙い（count 未指定）

  if (count == 0) { // eqeqeq 狙い
    setCount(1);
  }

  return <div onClick={() => setCount(count + 1)}>count: {count}</div>;
}
```

```ts:src/utils.ts
export function add(a: number, b: number) {
  let result = a + b;
  return result;
}

export const dead = () => {
  const x = 1;
  const y = 2; // no-unused-vars 狙い
  return x;
};
```

依存を入れて `npx eslint .` を実行……したところで、いきなり動きませんでした（このハマりは「詰まった点」に詳しく書きます）。TypeScript のバージョンを固定して解決したあと、ようやくベースラインが出ました。

```bash
pnpm add -D eslint @eslint/js typescript-eslint eslint-plugin-react-hooks globals typescript
pnpm add -D typescript@5.9.3   # ← これがないと起動しなかった
npx eslint .
```

```:eslint-baseline.txt
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

これで「ESLint で7件（error 5 / warn 2）」というベースラインができました。

次に oxlint を入れます。

```bash
pnpm add -D oxlint    # oxlint 1.73.0 / Done in 4.7s
npx oxlint --version  # Version: 1.73.0
```

Rust 製バイナリと聞いていたので身構えていたのですが、pnpm で普通に、しかも 4.7 秒で入りました。設定を移行する前に素の状態で走らせると、検出は2件だけでした。

```:設定移行前（デフォルト挙動）
src/utils.ts:8:9: warning eslint(no-unused-vars): Variable 'y' is declared but never used...
src/App.tsx:6:7: warning eslint(no-unused-vars): Variable 'unused' is declared but never used...
```

設定なしの oxlint は `correctness` 中心の狭いルールセットが既定なので、ESLint recommended 相当（7件）に対してここでは 2件しか出ません。「あれ、oxlint って検出弱いの？」と一瞬不安になったのですが、これは守備範囲が違うだけで、設定を移行すれば揃うことが後で分かります。

## 移行と実測

### migrate で `.oxlintrc.json` を生成

flat config を指定して migrate を走らせます。

```bash
npx --yes @oxlint/migrate ./eslint.config.js
```

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

87ルールが移行され、スキップされたのは4件（nursery 2件と「実装予定なし」の2件）でした。生成された `.oxlintrc.json` を覗くと、思っていたより丁寧で、TypeScript ファイル向けの override で「TS では意味のないコアルール（`no-const-assign` など）」を自動で off にしてくれていました。react-hooks の2ルールも `react/rules-of-hooks`・`react/exhaustive-deps` にマッピングされています。

```json:.oxlintrc.json（抜粋）
{
  "plugins": ["typescript"],
  "categories": { "correctness": "off" },
  "env": { "builtin": true },
  "ignorePatterns": ["node_modules/**", "dist/**"],
  "rules": {
    "no-var": "error",
    "no-unused-vars": "error",
    "eqeqeq": "error"
    /* ...実際は 87 ルール... */
  },
  "overrides": [
    {
      "files": ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
      "rules": {
        "no-const-assign": "off",
        "no-var": "error",
        "prefer-const": "error"
      }
    },
    {
      "files": ["**/*.{ts,tsx}"],
      "rules": {
        "no-console": "warn",
        "react/rules-of-hooks": "error",
        "react/exhaustive-deps": "warn"
      },
      "env": { "es2022": true, "browser": true },
      "plugins": ["react"]
    }
  ]
}
```

なお公式が注意している「カスタムプラグインは自動移行されない」については、今回そもそもカスタムプラグインを使っていないので該当しませんでした。裏取りはできていないので、そこは正直に「未検証」です。

### 検出結果を突き合わせる

移行後に oxlint を走らせた出力です。

```:oxlint-postmigrate.txt
src/utils.ts:8:9: error eslint(no-unused-vars): Variable 'y' is declared but never used...
src/utils.ts:2:7: error eslint(prefer-const): `result` is never reassigned. help: Use `const` instead.
src/App.tsx:6:7: error eslint(no-unused-vars): Variable 'unused' is declared but never used...
src/App.tsx:6:3: error eslint(no-var): Unexpected var, use let or const instead...
src/App.tsx:9:28: warning react-hooks(exhaustive-deps): React Hook useEffect has a missing dependency: 'count'...
src/App.tsx:9:5: warning eslint(no-console): Unexpected console statement...
src/App.tsx:12:13: error eslint(eqeqeq): Expected === and instead saw ==...
```

ESLint のベースラインと並べると、件数・内訳ともに一致しました。

| ルール | ESLint | oxlint（移行後） |
|---|---|---|
| no-var | error (App 6) | error (App 6) |
| no-unused-vars | error (App/utils, `@typescript-eslint/`) | error (App/utils, `eslint(no-unused-vars)`) |
| prefer-const | error (utils 2) | error (utils 2) |
| eqeqeq | error (App 12) | error (App 12) |
| no-console | warn (App 9) | warn (App 9) |
| react-hooks/exhaustive-deps | warn (App) | warn (App, `react-hooks(...)`) |
| **合計** | **7（error 5 / warn 2）** | **7（error 5 / warn 2）＝完全一致** |

細かい違いとしては、no-unused-vars の帰属表記が ESLint 側は `@typescript-eslint/`、oxlint 側は `eslint(...)` になっていました。あと exhaustive-deps は設定に `react/exhaustive-deps` と書いたのに、oxlint は `react-hooks(...)` として発火していました（内部で react-hooks 実装に解決しているようです）。とはいえ、検出そのものはズレていません。

今回は「oxlint が実装済みのメジャールール」ばかりを選んだので差がゼロになったのだと思います。逆に言うと、ニッチなルールや nursery、カスタムルールに依存していると話が変わってくるはずで、そこは移行前に確認したほうがよさそうです。

### 実行速度

速度を測るために、`src/gen/` に 300 ファイルを生成して規模を **302ファイル / 2,127行** に拡大しました。warm-up 後に各5回、`time` で計測しています。

```bash
for i in 1..5; do /usr/bin/time -p node_modules/.bin/eslint . ; done
for i in 1..5; do /usr/bin/time -p node_modules/.bin/oxlint ; done
```

real 秒の実測値がこちらです。

| | 1 | 2 | 3 | 4 | 5 | min | median | 平均 |
|---|---|---|---|---|---|---|---|---|
| ESLint | 7.20 | 11.99 | 20.46 | 18.15 | 8.73 | 7.20 | 11.99 | 13.31 |
| oxlint | 0.44 | 0.22 | 0.21 | 0.21 | 0.16 | 0.16 | 0.21 | 0.25 |

比にすると median で約57倍、min で約45倍でした（この規模・この環境での簡易計測です）。印象的だったのは、ESLint 側が 7〜20秒とブレが大きかったのに対し、oxlint は 0.2 秒前後で安定していたことです。「50〜100倍」の触れ込みは、この小さな規模でも min 比 45倍だったので、方向性としては合っていそうです。ただ規模・キャッシュ・並列度でかなり変わるはずなので、鵜呑みにはしないでおきます。

ここまでの結果は1枚のサマリにまとめました。

![ESLint→oxlint 移行の検証サマリ（移行結果・検出差・速度比・JSプラグイン・--fix）](/images/oxlint-eslint-migration-js-plugins-try/01-summary.png)

## JSプラグイン(alpha)を試す

alpha の JS プラグイン機能で、ESLint プラグインを1つ読み込ませてみます。使ったのは `eslint-plugin-jsdoc` です。

最初、素直に `"jsPlugins": ["eslint-plugin-jsdoc"]` と直接指定したら、予約名エラーで弾かれました。oxlint には jsdoc の Rust 実装が内蔵されていて名前が衝突するためです。エラー全文がこちら。

```
npx oxlint -c .oxlintrc.direct.json src/plugin-test.ts
Failed to parse oxlint configuration file.
  x Plugin name 'jsdoc' is reserved, and cannot be used for JS plugins.
  | The 'jsdoc' plugin is already implemented natively in Rust within oxlint.
  | Using both the native and JS versions would create ambiguity about which rules to use.
  | To use an external 'jsdoc' plugin instead, provide a custom alias:
  | "jsPlugins": [{ "name": "jsdoc-js", "specifier": "eslint-plugin-jsdoc" }]
```

エラーメッセージが対処法（エイリアス記法）まで丸ごと教えてくれたので、そのとおりに書き換えました。

```json:.oxlintrc.json（抜粋）
"jsPlugins": [{ "name": "jsdoc-js", "specifier": "eslint-plugin-jsdoc" }],
"rules": { "jsdoc-js/require-param": "error" }
```

テスト対象は `@param b` をわざと欠いた JSDoc です。

```ts:src/plugin-test.ts
/**
 * 2つの数を足す。
 * @param {number} a 最初の数
 */
export function addDocumented(a: number, b: number): number {
  return a + b;
}
```

実行すると、外部の ESLint プラグインがちゃんと読み込まれて発火しました。

```:jsplugin-test.txt
npx oxlint src/plugin-test.ts
src/plugin-test.ts:1:1: error jsdoc-js(require-param): Missing JSDoc @param "b" declaration.
```

alpha だしどこまで動くのか半信半疑でしたが、既存の ESLint プラグインが実際に読み込まれて発火したのは素直に「おお」となりました。内蔵と同名のプラグイン（jsdoc / import など）を使うときは `{ name, specifier }` のエイリアスが必須、というのが実際に踏んで分かった点です。

一点、Node のバージョンに関する注意があります。TypeScript で書いた自作の JS プラグインファイルを native 実行する場合は Node **>=22.18.0 / ^20.19.0** が要件でした。今回の Node は 22.17.0 でこれを下回っていましたが、`eslint-plugin-jsdoc` のような JS パッケージを specifier で使う分には問題ありませんでした。自作 `.ts` プラグインを動かしたいなら Node の更新が要りそうです。

## 詰まった点と解決

### `npx eslint .` がクラッシュして起動しない

一番つまずいたのは、実は oxlint 以前の ESLint 側でした。依存を入れて `npx eslint .` を走らせたら、lint 結果ではなくクラッシュが返ってきました。

:::details エラー全文
```
Oops! Something went wrong! :(
ESLint: 10.6.0
TypeError: Cannot read properties of undefined (reading 'Cjs')
    at Object.<anonymous> (.../@typescript-eslint+typescript-estree@8.63.0_typescript@7.0.2/node_modules/@typescript-eslint/typescript-estree/dist/create-program/shared.js:59:18)
    ...
```
:::

原因は TypeScript のバージョンでした。`pnpm add` で `typescript` の最新を掴んだら **7.0.2**（ネイティブ移植版）に到達していて、typescript-eslint 8.x がまだこれに対応していませんでした。よく見ると `pnpm add` の時点で `unmet peer typescript ">=4.8.4 <6.1.0": found 7.0.2` という peer 警告が出ていたのですが、それを見落としていて、これが「起動不能」という実害になっていました。

peer 範囲内に固定したら直りました。

```bash
pnpm add -D typescript@5.9.3
npx eslint .   # 正常にベースラインが出た
```

「新人が何も考えず最新を入れたら ESLint が起動しない」という、けっこう踏みそうな罠だと思います。peer 警告を軽視しないという当たり前の教訓を再確認しました（この件は knowledge にも残しました）。

### JSプラグインの直接指定が予約名エラー

これは「JSプラグインを試す」の節に書いたとおりで、`"eslint-plugin-jsdoc"` をそのまま指定したら内蔵の jsdoc(Rust) と名前が衝突して弾かれた、という話です。エラーメッセージがエイリアス記法を提示してくれたので、詰まった時間は短く済みました。

### 素の oxlint の検出が少なく見えて不安になった

移行前に素の oxlint を走らせたとき、ESLint で7件出ていたものが2件しか出ず、「検出弱いのでは」と不安になりました。これは oxlint 既定が correctness 中心の狭いルールセットだからで、migrate で ESLint 設定を移植（→87ルール）してから比べたら、ちゃんと揃いました。素の oxlint だけを見て判断しないほうがいい、というのが分かった点です。

## 分かったこと・ESLintと比べて

- **検出**: 今回のメジャールール構成では、移行後の検出が件数・内訳とも完全一致でした。「移行で何が失われるか」は選んでいるルール次第で、メジャールール中心ならこの規模では実質ロスなしでした。
- **速度**: この環境・この規模では min 45倍〜median 57倍。CI やエディタ保存時の待ちが消えそうな体感の差でした。ただし規模・キャッシュ・並列度で変わるはずなので、自分の環境で測るのがよさそうです。
- **自動修正**: `oxlint --fix` と `eslint --fix` を別々のコピーに当てて `diff` を取ったところ、修正後ファイルがバイト単位で一致しました。修正内容は `var unused = 42` → `const unused = 42`（no-var、未再代入なので const 化）と `let result` → `const result`（prefer-const）。no-unused-vars / no-console / exhaustive-deps / eqeqeq はどちらも自動修正の対象外で、そこも揃っていました。検出だけでなく修正結果まで一致したのは、移行の安心材料でした。
- **JS プラグイン（alpha）**: 既存の ESLint プラグインが実際に読み込まれて発火しました。内蔵と同名ならエイリアスが必須です。

一方で、今回の環境・構成では確認できていないこともあります。Windows での OOM（既知問題）は macOS 検証なので未確認、カスタムプラグインの自動移行も今回カスタムプラグインを使っていないので未検証です。ここは正直に「試せていない」と書いておきます。

## どんな人向けか・まとめ

完了条件にしていた3つ（migrate で `.oxlintrc.json` が生成され `pnpm lint` が完走する / ESLint と oxlint の速度を計測して比較表を残す / jsPlugins で ESLint プラグインの発火を確認する）は、いずれも達成できました。

触ってみた印象では、速度が欲しくてメジャールール中心の構成なら、oxlint への移行は今の時点でもかなり現実的に感じました。逆に、ニッチなルールや nursery、カスタムプラグインに依存している場合は、移行時にスキップされるものがないか事前に確認したほうがよさそうです。JS プラグインは既存資産を活かせる可能性が見えたものの、まだ alpha（semver の対象外）なので、本番投入は今後の安定を待ちつつ、という距離感でいます。

次は、もっとルール数の多い実プロジェクトで migrate のスキップ件数がどうなるか、カスタムプラグイン依存があるとどこで詰まるかを試してみたいです。

## 参考リンク

- oxlint: Migrate from ESLint
  https://oxc.rs/docs/guide/usage/linter/migrate-from-eslint.html
- oxlint JS Plugins Alpha（2026-03-11）
  https://oxc.rs/blog/2026-03-11-oxlint-js-plugins-alpha.html
