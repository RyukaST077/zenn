---
title: "TypeScript 7に上げたらeslintが1件も走らなくなった話と、公式のalias構成"
emoji: "⚡"
type: "tech"
topics: ["typescript", "eslint", "npm", "nodejs"]
published: true
---

<!-- 前提: 出典ログ logs/run-typescript7-alias-tsc6-20260818-1209/execution-log.md / 記事タイプ: 検証ログ・詰まった点まとめ / slug はログのスラッグを継承 / published: false -->

## はじめに

1ヶ月ほど前に、TypeScript 7と6を1つのプロジェクトで併用しようとして失敗した記録を書きました（「TypeScript 7と6の併用検証がtscのbin衝突で止まった記録」）。

前回（2026-07-11）は `typescript@7.0.2` と `@typescript/typescript6@6.0.2` を素直に両方 `devDependencies` に書いたのですが、`node_modules/.bin/tsc` も `node_modules/.bin/tsc6` も両方 `Version 6.0.3` を返してしまい、ベンチマークの土台が作れずに終わりました。

今回はその続きです。公式アナウンスに書かれている alias を使った併用構成をそのまま試して、

- `tsc` は本当に TypeScript 7 で走るのか
- `eslint`（typescript-eslint）は壊れないままでいられるのか

の2つを、同じ fixture の上で測ってみました。結果としては両方とも成立したのですが、その手前で「単純にアップグレードすると lint が静かに止まる」という、正直かなり怖い状態を踏みました。そこが今回いちばん書きたかったところです。

:::message
筆者は新人で、TypeScript 7 を触るのは今回が2回目です。ベンチマークもまだ慣れていないので、数字は「この fixture ではこうなった」という範囲で読んでください。
:::

## 使ったもの・環境

2026-08-18 に、以下の環境で試しました。

```text
OS:      macOS 26.5 (Darwin 25.5.0) arm64 / Apple Silicon・論理10コア
Node.js: v22.17.0
npm:     10.9.2
pnpm:    10.13.1
```

パッケージのバージョンは、当日の dist-tags を取って固定しました。

```bash
npm view typescript dist-tags --json
npm view @typescript/typescript6 dist-tags --json
npm view typescript-eslint dist-tags --json
npm view eslint dist-tags --json
```

```text
typescript:              latest 7.0.2 / rc 7.0.1-rc / beta 6.0.0-beta / next 7.1.0-dev.20260817.1
@typescript/typescript6: latest 6.0.2
typescript-eslint:       latest 8.67.0 / canary 8.67.1-alpha.4
eslint:                  latest 10.8.1 / next 10.0.0-rc.2 / maintenance 9.39.5
```

比べるのは次の3構成です。

| 構成 | 中身 |
|---|---|
| A | `typescript@6.0.3` + `typescript-eslint@8.67.0` + `eslint@10.8.1`（ベースライン） |
| B | Aの `typescript` を `7.0.2` に上げただけ |
| C | 公式の alias 併用構成（TS7 を `@typescript/native` に、`typescript` は `@typescript/typescript6` に） |

## なぜ TypeScript 7.0 を試すのか

TypeScript 7.0 は `tsc` を Go に移植したもので、公式アナウンス [Announcing TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) では実プロダクトのコードベースで 7.7x〜11.9x、メモリは -6%〜-26%、エディタのエラー検出が 17.5秒から 1.3秒（13倍超）になった、と書かれています。

この数字は「大きな実プロダクトで測った値」なので、この記事で出す自作 fixture の数字とは別物として扱います。あとで両方並べますが、比較していいものではないと思っています。

同じアナウンスに、7.0 には programmatic API が付いてこないこと、Compiler API が必要なツールのために `@typescript/typescript6` を並走させる構成が案内されています。前回はここを読み違えて素直に併記して失敗したので、今回は書かれている JSON をそのまま使いました。

```json
{
  "devDependencies": {
    "@typescript/native": "npm:typescript@^7.0.2",
    "typescript": "npm:@typescript/typescript6@^6.0.2"
  }
}
```

## 事前に調べたこと（実行前に書いた予測のうち主な2つ）

いきなり `npm i` する前に、レジストリのメタデータだけで「何が壊れるはずか」を確定させておこうと思いました。先に予測を書いておくと答え合わせが楽なので、次の2つをメモしてから始めています。

1. `typescript@7.0.2` の `exports["."]` は `./lib/version.cjs` しか無いはずなので、Compiler API を使うツールは全滅する
2. typescript-eslint の peer は `<6.1.0` なので、`npm i -D typescript@7.0.2` は ERESOLVE エラーで止まる

叩いたのはこれだけです。

```bash
npm view typescript@7.0.2 bin exports engines --json
npm view typescript@7.0.2 dependencies optionalDependencies --json
npm view @typescript/typescript6@6.0.2 bin main dependencies --json
npm view typescript-eslint@8.67.0 peerDependencies --json
npm view typescript@6.0.3 bin version --json
```

要点だけ抜くとこうなりました。

```text
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

予測1は当たりです。予測2は、あとで見るとおり外れました。

ここで意外だったのが、Go バイナリの配布のしかたです。プラットフォーム別パッケージ20個が `dependencies` と `optionalDependencies` の両方に書いてあります。片方だけだと思い込んでいたので、実物のメタデータを見ないと分からない類だなと思いました。

## fixture を作る（型チェックに3.5秒かかるTSプロジェクト）

比較するには、そこそこ時間のかかるプロジェクトが要ります。手元に都合のいい実プロジェクトが無かったので、生成器で作りました。

入れたのは、再帰的な条件型と、大きい union に当てる型ユーティリティです。

```ts:src/types.ts
// type-level utilities (intentionally expensive to check)
export type Split<S extends string, D extends string> =
  string extends S ? string[] :
  S extends '' ? [] :
  S extends `${infer H}${D}${infer T}` ? [H, ...Split<T, D>] : [S];

export type CamelCase<S extends string> =
  S extends `${infer H}_${infer T}` ? `${H}${Capitalize<CamelCase<T>>}` : S;

export type DeepPartial<T> = T extends (infer E)[] ? DeepPartial<E>[]
  : T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;

export type DeepReadonly<T> = T extends (infer E)[] ? readonly DeepReadonly<E>[]
  : T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;

type Prev = [never, 0, 1, 2, 3, 4, 5];

export type Paths<T, D extends number = 5> = [D] extends [never] ? never
  : T extends object
    ? { [K in keyof T & string]: T[K] extends object ? K | `${K}.${Paths<T[K], Prev[D]>}` : K }[keyof T & string]
    : never;

export type PathValue<T, P extends string> =
  P extends `${infer K}.${infer R}` ? K extends keyof T ? PathValue<T[K], R> : never
  : P extends keyof T ? T[P] : never;

export type UnionToIntersection<U> =
  (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void ? I : never;
```

各モジュールでは、90要素の文字列リテラル union を作って、それに `UnionToIntersection` を当てたり、key remapping の mapped type を回したり、テンプレートリテラル型を持つネストした interface を書いたりしています。

```ts:src/mod0.ts（抜粋）
import type { Split, CamelCase, DeepPartial, DeepReadonly, Paths, PathValue, UnionToIntersection } from './types.js';

export type Keys0 = 'entity_0_field_0' | 'entity_0_field_1' | /* ... 90要素 ... */ 'entity_0_field_89';

export interface Model0 {
  entity_0_field_0: { id: number; label: string; nested: { deep: { value: `entity_0_field_0:${string}` } } };
  entity_0_field_1: { id: number; label: string; nested: { deep: { value: `entity_0_field_1:${string}` } } };
  // ... 90フィールド
}
```

```json:tsconfig.json
{
  "compilerOptions": {
    "target": "es2022",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "verbatimModuleSyntax": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"]
}
```

最終形は 200モジュール × 90要素 union で、`src/` 全体で 203ファイル / 13,841行になりました。`--extendedDiagnostics` で見るとこのくらいです。

```text
Types:                      309849
Instantiations:            1843316
Memory used:               570562K
Check time:                  3.19s
Total time:                  3.49s
```

### ここで一度 eslint が落ちた

規模の当たりを付けるのに3回作り直しています。最初は「モジュール数を減らして union を大きくすれば重くなるだろう」と考えて、80モジュール × 200要素 union にしたのですが、`tsc` は通るのに `eslint .` が落ちました。

```text
<--- Last few GCs --->

[14361:0xa2a400000]    56349 ms: Mark-Compact 4038.8 (4134.4) -> 4019.9 (4132.7) MB, pooled: 12 MB, 1655.04 / 0.00 ms  (average mu = 0.093, current mu = 0.033) allocation failure; scavenge might not succeed
[14361:0xa2a400000]    59279 ms: Mark-Compact 4037.1 (4132.7) -> 4025.4 (4136.9) MB, pooled: 8 MB, 2890.67 / 0.00 ms  (average mu = 0.057, current mu = 0.014) allocation failure; scavenge might not succeed


<--- JS stacktrace --->

FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
```

型情報つきの lint は `tsc` と同じ型を全部 JS ヒープに載せるので、`UnionToIntersection` を200要素の union に当てた型が効いて 4GB のヒープを食い潰していました。「重い fixture を作る」というとき、型チェックが耐える規模と lint が耐える規模は別だと分かっていませんでした。

union を 200 から 90 に落として、代わりにモジュール数を 80 から 200 に増やしたら、`tsc` が3.5秒 / `eslint` が完走、という両立点に着地しました。闇雲に増やすより、`--extendedDiagnostics` の `Instantiations` を見ながら振ったほうが早かったです。

## 構成A: ベースラインを測る

```bash
npm i -D --save-exact --ignore-scripts --no-audit --no-fund \
  typescript@6.0.3 typescript-eslint@8.67.0 eslint@10.8.1
```

```text
added 87 packages in 3s
```

peer 警告は1件も出ません（6.0.3 は `>=4.8.4 <6.1.0` の範囲内なので当然ではあります）。

```text
$ ls -l node_modules/.bin/tsc*
node_modules/.bin/tsc -> ../typescript/bin/tsc
```

lint 設定は型情報つき（`projectService`）にしました。

```js:eslint.config.js
// @ts-check
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['gen.mjs', 'eslint.config.js', 'npm-cache/**', 'node_modules/**', 'shot.mjs'] },
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
```

`eslint.config.js` 自身が `tsconfig.json` の `include`（`src` だけ）に入っていないせいで `Parsing error: ... was not found by the project service` が1件出たので、`ignores` に足しています。

計測結果です。

```text
$ ./node_modules/.bin/tsc --version
Version 6.0.3

$ for i in 1 2 3; do time ./node_modules/.bin/tsc --noEmit; done
run 1:  6.96s user 0.23s system 145% cpu 3.478 total
run 2:  5.08s user 0.20s system 149% cpu 3.535 total
run 3:  4.88s user 0.18s system 147% cpu 3.424 total

$ time ./node_modules/.bin/eslint .
✖ 7 problems (7 errors, 0 warnings)
./node_modules/.bin/eslint .  11.05s user 0.61s system 136% cpu 8.515 total
```

`--noEmit` で `incremental` を使っていないので、1回目と2回目以降でほぼ差が出ません（3.478 / 3.535 / 3.424）。キャッシュが効かないのは普段なら嫌なところですが、比較の土台としてはむしろ扱いやすかったです。

CPU使用率が 145% 前後で、10コアあるうち実質1.5コアぶんしか使えていません。

## 構成B: 単純に上げてみる

```bash
npm i -D --save-exact --no-audit --no-fund typescript@7.0.2
```

ここで予測が外れました。ERESOLVE で止まると思っていたのに、警告を8回出して exit 0 で終わります。`--legacy-peer-deps` も `--force` も付けていません。

```text
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
（同じ警告があと7回）

added 9 packages, removed 8 packages, and changed 1 package in 1s
```

`npm ls` を叩くとちゃんと `invalid` と書いてあります。install の出力を読み飛ばしても、ここを一度見れば気づけます。

```text
$ npm ls @typescript/typescript-darwin-arm64
└─┬ typescript@7.0.2 invalid: ">=4.8.4 <6.1.0" from node_modules/typescript-eslint
  └── @typescript/typescript-darwin-arm64@7.0.2
```

Go バイナリは、20プラットフォームぶん宣言されているうち自機向けの1つ（26MB）だけが落ちてきました。install 自体は1秒です。

```text
$ ls node_modules/@typescript/
typescript-darwin-arm64
$ du -sh node_modules/@typescript/*
 26M	node_modules/@typescript/typescript-darwin-arm64
$ du -sh node_modules
 49M	node_modules
```

`--ignore-scripts` を意図的に外して試したのですが、有無で差は出ませんでした。postinstall スクリプトではなく optional deps でバイナリを取る方式だからだと思います。

型チェックは速くなりました。

```text
$ ./node_modules/.bin/tsc --version
Version 7.0.2
$ npx tsc --version
Version 7.0.2

$ for i in 1 2 3; do time ./node_modules/.bin/tsc --noEmit; done
run 1:  1.47s user 0.11s system 434% cpu 0.365 total
run 2:  1.43s user 0.09s system 425% cpu 0.357 total
run 3:  1.42s user 0.08s system 410% cpu 0.367 total
```

3.478s から 0.365s なので 9.5倍です。CPU使用率も 145% から 434% に上がっていて、既定の4チェッカーが実際に並列で回っているのが分かります。前回のような bin 衝突が起きないのは、この構成だと `typescript` パッケージが1つしか無いからです。

### そして eslint が0.17秒で死ぬ

```text
$ ./node_modules/.bin/eslint .
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

型チェックが9.5倍になった直後に、lint が0.17秒で死にました。ここが今回いちばん怖かったところです。install はエラーにならず、`tsc` は速くなって、lint だけが1件も走らない。CI の lint ステップが `continue-on-error` だったり、ローカルで `npm run lint` を最近叩いていなかったりすると、しばらく気づかないまま進めてしまいそうです。

エラーの出方は予測とは違いました。`ERR_PACKAGE_PATH_NOT_EXPORTED` や `ts.createProgram is not a function` あたりで落ちると思っていたのですが、実際は typescript-eslint 自身のバージョンガードが入口で throw していました。

以前 8.63.0 で同じことを試したときは `TypeError: Cannot read properties of undefined (reading 'Cjs')` という何が起きたか分からないクラッシュだったので、8.67.0 で明示的なメッセージに変わったのだと思います。案内リンクまで出るので、原因調べに時間を取られませんでした。

## エラーの根っこをコードで確かめる

メッセージは親切でしたが、なぜ typescript-eslint がそう判断したのかは自分で見ておきたかったので、`node_modules` を直接掘りました。

```bash
node -e "console.log(require.resolve('typescript'))"
node -e "const ts=require('typescript'); console.log(Object.keys(ts))"
node -e "const ts=require('typescript'); console.log(typeof ts.createProgram)"
cat node_modules/typescript/lib/version.cjs
sed -n '40,60p' node_modules/typescript-eslint/dist/index.js
```

```text
/…/node_modules/typescript/lib/version.cjs
[ 'version', 'versionMajorMinor' ]
undefined

--- node_modules/typescript/lib/version.cjs の中身（全3行）---
const { version } = require("../package.json");
exports.version = version;
exports.versionMajorMinor = "7.0";

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

`typescript@7.0.2` の `require('typescript')` は3行のファイルで、返ってくるのは `version` と `versionMajorMinor` の2つだけでした。「7.0 には API が無い」というのはこういう実体だったのか、と腑に落ちました。typescript-eslint はその `versionMajorMinor` を読んで先回りして止めているだけです。

exports フィールドを読む、`require.resolve` で実体のファイルを見る、`node_modules` の判定コードを直接読む。この3手順は TS7 に限らず使い回せそうなので覚えておこうと思いました。

## 構成C: 公式の alias 併用構成にする

`package.json` の差分はこれだけです。

```diff:package.json
   "devDependencies": {
+    "@typescript/native": "npm:typescript@^7.0.2",
+    "typescript": "npm:@typescript/typescript6@^6.0.2",
     "eslint": "10.8.1",
-    "typescript": "7.0.2",
     "typescript-eslint": "8.67.0"
   }
```

alias への書き換えは lockfile の解決結果を大きく変えるので、残骸を残さないように消してから入れ直します。

```bash
rm -rf node_modules package-lock.json && npm i --no-audit --no-fund
```

```text
added 90 packages in 2s
```

構成Bで8回出ていた peer 警告が1件も出なくなりました。`typescript` という名前が指す実体が 6.0.2 になったので、typescript-eslint の peer 範囲を満たすからです。

```text
$ npm ls --depth=0
├── @typescript/native@npm:typescript@7.0.2
├── eslint@10.8.1
├── typescript-eslint@8.67.0
└── typescript@npm:@typescript/typescript6@6.0.2
```

`npm ls` が `A@npm:B@version` という形で alias を表示してくれるので、どの名前がどの実体を指しているかがここで読めます。alias 構成を触るときは、まずこれを見るのが早そうです。

### 前回止まった bin の取り合いはどうなったか

前回の宿題がこれでした。

```text
$ ls -l node_modules/.bin/tsc*
node_modules/.bin/tsc  -> ../@typescript/native/bin/tsc
node_modules/.bin/tsc6 -> ../typescript/bin/tsc6

$ ./node_modules/.bin/tsc --version
Version 7.0.2
$ ./node_modules/.bin/tsc6 --version
Version 6.0.3
$ npx tsc --version
Version 7.0.2
```

前回と並べるとこうなります。

| | 2026-07-11（素直に併記） | 2026-08-18（公式 alias 構成） |
|---|---|---|
| `.bin/tsc` の指し先 | `../@typescript/old/bin/tsc` | `../@typescript/native/bin/tsc` |
| `tsc --version` | `Version 6.0.3` ❌ | `Version 7.0.2` ✅ |
| `.bin/tsc6` の指し先 | `../@typescript/typescript6/bin/tsc6` | `../typescript/bin/tsc6` |
| `tsc6 --version` | `Version 6.0.3` | `Version 6.0.3` ✅ |

前回はフルパス指定などの回避策を考えていたのですが、要りませんでした。前回 `.bin/tsc` を取られていたのは、`@typescript/typescript6` が依存している `@typescript/old`（実体は `typescript@6.0.3`）も `tsc` という bin 名を持っていて、TS7 の `tsc` と取り合いになっていたからです。

alias 構成では TS7 が `@typescript/native` という別名になるので、`typescript` という名前を `@typescript/typescript6` が単独で取れます。`@typescript/old` は `typescript` のネストした依存になり、トップレベルの `.bin/tsc` には出てこられません。

```text
$ npm ls @typescript/old
typescript7-alias-tsc6@1.0.0
└─┬ typescript@npm:@typescript/typescript6@6.0.2
  └── @typescript/old@npm:typescript@6.0.3

$ ls node_modules/@typescript/
native  old  typescript-darwin-arm64
```

ひとつ紛らわしいのは、`@typescript/typescript6` を `6.0.2` で入れているのに `tsc6 --version` が `6.0.3` を返すことです。これは前回も同じでした。`@typescript/typescript6` は薄いラッパで、実際のコンパイラは依存の `@typescript/old`（`npm:typescript@^6` なので 6.0.3）のほうだからです。バージョンを固定したいときは、この二段構造を意識しないと合いません。

### 型チェックはTS7 / lintはTS6 API、が両立するか

```text
$ for i in 1 2 3; do time ./node_modules/.bin/tsc --noEmit; done
run 1:  1.46s user 0.13s system 405% cpu 0.392 total
run 2:  1.44s user 0.09s system 423% cpu 0.362 total
run 3:  1.49s user 0.10s system 431% cpu 0.367 total

$ time ./node_modules/.bin/tsc6 --noEmit
4.83s user 0.20s system 145% cpu 3.447 total

$ time ./node_modules/.bin/eslint .
✖ 7 problems (7 errors, 0 warnings)
./node_modules/.bin/eslint .  11.70s user 0.76s system 140% cpu 8.889 total

$ node -e "console.log(require.resolve('typescript'))"
/…/node_modules/typescript/lib/typescript.js
$ node -e "const ts=require('typescript'); console.log('version=',ts.version,' createProgram=',typeof ts.createProgram)"
version= 6.0.3  createProgram= function
```

両立しました。`tsc` は 7.0.2 で 0.37秒、`eslint` は構成Aと同じ7件で、ルール名も行番号も完全に一致しています。lint 側が掴む `typescript` は `lib/typescript.js` で、`createProgram` もちゃんと関数として生えています。

`package.json` の scripts は書き換えなしで済みました。

```jsonc:package.json
"scripts": {
  "typecheck": "tsc --noEmit",   // -> @typescript/native (7.0.2)
  "lint": "eslint ."             // -> typescript = @typescript/typescript6 (6.0 API)
}
```

## 数字の比較

3構成をまとめるとこうなります。

| 構成 | `tsc --version` | `tsc --noEmit` 1回目 | 2回目 | 3回目 | `eslint .` |
|---|---|---|---|---|---|
| A: TS 6.0.3 | `Version 6.0.3` | 3.478s | 3.535s | 3.424s | 7 errors（8.5s） |
| B: TS 7.0.2 単純アップ | `Version 7.0.2` | 0.365s | 0.357s | 0.367s | 起動不能（0.17s で throw） |
| C: alias 併用 | `Version 7.0.2` | 0.392s | 0.362s | 0.367s | 7 errors（8.9s / Aと一致） |
| C の `tsc6` | `Version 6.0.3` | 3.447s | — | — | — |

中央値の 3.478s から、構成B/Cを通した代表値である約0.37sへ、この fixture では約9.3倍でした。冒頭に書いたとおり、公式の 7.7x〜11.9x は実プロダクトでの値なので、たまたま近い範囲に入っただけだと思っています。

比較表と棒グラフをHTMLに起こして、スクリーンショットを撮りました。

![3構成の比較表と、型チェック時間の構成A比グラフ、およびTS7のtypescriptエントリの中身](/images/typescript7-alias-tsc6/benchmark.png)

### `--checkers` を振ってみる

TypeScript 7 には型チェックワーカー数を指定する `--checkers`（既定4）と、全部を単一スレッドで走らせる `--singleThreaded` があります。10コアの手元マシンで振ってみました。

```text
--checkers 1     : 1.177 / 1.167 / 1.172   (135% cpu)
--checkers 2     : 0.627 / 0.617 / 0.608   (245% cpu)
既定(--checkers 4): 0.438 / 0.359 / 0.366   (381-426% cpu)
--checkers 8     : 0.323 / 0.281 / 0.302   (569-611% cpu)
--singleThreaded : 1.200 / 1.187 / 1.210   (116-118% cpu)
```

1→2 で1.9倍、2→4 で1.7倍、4→8 で1.2倍と、4を超えると伸びが鈍ります。`--checkers 1` と `--singleThreaded` はほぼ同じ値（1.17s と 1.19s）でした。

面白かったのは、並列を切っても TS6 の 3.478s より2.9倍速いことです。この fixture の9.3倍という数字は、Go への移植そのもので約3倍、並列化で約3倍、の掛け算に見えます。だとすると、1コアしか割り当てられない CI で期待していい倍率は9倍ではなく3倍くらいということになりそうで、そこは自分で測らないと分からない部分でした。

なお `--builders` は `--build` と一緒でないと使えません。TS6 側は `--checkers` を知りません。

```text
$ tsc --noEmit --builders 2
error TS5093: Compiler option '--builders' may only be used with '--build'.

$ tsc6 --noEmit --checkers 1
error TS5025: Unknown compiler option '--checkers'. Did you mean 'checkJs'?
```

ちなみにこの計測、最初の実行は全部こうなって全滅しました。

```text
error TS5023: Unknown compiler option '--checkers 1'.
```

自分のシェルスクリプトで `"--checkers 1"` を1つの引数として渡していたせいです。エラーメッセージが引数を丸ごと引用符で囲って返してきたら、まず自分の渡し方を疑うのがよさそうです。

## どんな人が今上げてよさそうか

新人が1日触った範囲での感触なので、そのつもりで読んでください。

上げてよさそうなのは、型チェックが CI やローカルの体感ボトルネックになっていて、型に依存するツールが typescript-eslint くらいに留まっているプロジェクトだと思いました。alias 構成なら `package.json` の4行と `npm i` のやり直しだけで、scripts も lint 設定も触らずに済みました。

待ったほうがよさそうなのは、Vue / Svelte / Astro / MDX / Angular のテンプレート型チェックのように、Compiler API を埋め込んで使うツールがビルドの必須経路にある場合です。公式アナウンスでもこれらはまだ動かないとされていますし、7.0 の `typescript` エントリは `version` しか返さないので、回避の余地が薄そうです。

急いでいないなら 7.1 待ちが素直だとも思います。公式は 7.1 で新しい（6.0 とは別物の）API を出す予定と書いていて、typescript-eslint 側も [#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940) で TS >= 7.1 のサポートを追跡しています。

### パッケージマネージャによる差

npm 以外だと、[typescript-go #4368](https://github.com/microsoft/typescript-go/issues/4368) に Yarn での失敗が上がっています。

- Yarn 4.16.0（`nodeLinker: node-modules`）で `@typescript/typescript6@6.0.1` + `typescript@7.0.1-rc`
- `ENOENT: no such file or directory, lstat '.../node_modules/typescript/lib/_tsc.js'`
- Yarn の組み込み TypeScript 互換パッチが「`typescript` という識別子の依存」を実体に関係なく対象にするため、`lib/_tsc.js` を持たない `@typescript/typescript6` でパッチ適用が hard error になる

このissueは確認した時点では Closed になっていました（試す前は Open だと思っていたので、情報の鮮度は見ておくべきでした）。手元で使えたのが corepack 経由の Yarn 1.22.22 だけで、issue の再現条件（Yarn 4.16.0）を満たせなかったので、Yarn での alias 構成は試せていません。

pnpm 10.13.1 では、同じ `package.json` のまま通りました。

```text
$ pnpm install --store-dir ./.pnpm-store
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

npm と違って `.bin/tsc` が symlink ではなく実行可能なシムスクリプト（1848 bytes）になる、という表示上の差はありましたが、結果は同じでした。

### 「APIが無い」の正確なところ

`typescript@7.0.2` の `exports` には `./unstable/*` が13キーあります。気になったので import できるか試したら、8つ試して全部通りました。keys は一部を抜粋しています（順不同）。

```text
unstable/ast          keys=409 : SyntaxKind, NodeFlags, ModifierFlags, cast, ...
unstable/fs           keys=2   : createVirtualFileSystem, fsCallbackNames
unstable/sync         keys=44  : API, Checker, Emitter, Program, Project, Symbol, TypeFlags, isUnionType, ...
unstable/async        keys=44  : （sync と同じ顔ぶれ）
unstable/proto        keys=3   : resolveDocumentURI, resolveFileName, toUpdateSnapshotRequest
unstable/ast/factory  keys=370 : createArrowFunction, createBinaryExpression, cloneNode, ...
unstable/ast/scanner  keys=25  : createScanner, computeLineStarts, getLeadingCommentRanges, ...
unstable/ast/visitor  keys=8   : visitEachChild, visitNode, visitNodes, ...
```

なので「7.0 には API が無い」は、正確には「既存ツールが使う安定版の `typescript` エントリに API が無い」ということのようです。`Program` や `Checker` や `Emitter` までは見えています。ただ名前のとおり unstable ですし、公式は 7.1 で別物の API を出すと言っているので、今から寄りかかる場所ではなさそうです。`unstable/sync` の `API` を使って実際に型チェックを走らせるところまでは試していません。

## まとめ

分かったのは3つです。

1. `typescript@7.0.2` に単純に上げると、npm は警告だけ出して通り、`tsc` は9.5倍速くなり、`eslint` は0.17秒で throw する。速くなった実感のほうが先に来るので、lint が動いていないことに気づかない可能性がある
2. 公式の alias 併用構成（`@typescript/native` と `typescript` の付け替え）にすると、`tsc` は 7.0.2、`eslint` は構成Aと完全に同じ7件、という両立ができた。前回止まった `.bin/tsc` の取り合いも起きなかった
3. この fixture での9.3倍は、移植ぶん約3倍 × 並列ぶん約3倍に分解できそうだった。使えるコア数が少ない環境では期待値が変わる

実行前の予測は、6つ書いて4つ外しました。install が ERESOLVE で止まると思ったら止まらなかったこと、lint の落ち方が予想と違ったこと、小さい fixture では倍率が出ないと思ったら9.3倍出たこと、そして Yarn の issue #4368 を Open だと思い込んでいたら確認時点では Closed だったこと。特に1つ目は、自分の中で「壁はインストールが止めてくれる」という前提があったのだと気づかされました。

試していないことも残っています。Yarn 4 での alias 構成、TS6 と TS7 の診断メッセージの文言差（fixture に型エラーを仕込んでいないので観測できていません）、emit 結果の差、メモリ使用量。公式はメモリ -6%〜-26% と言っていますが、今回測ったのは `time` の実時間だけです。

## 参考リンク

https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/

https://github.com/typescript-eslint/typescript-eslint/issues/10940

https://github.com/microsoft/typescript-go/issues/4368
