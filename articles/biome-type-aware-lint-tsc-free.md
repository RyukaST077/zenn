---
title: "ESLint/oxlintしか知らない新人がBiomeの型認識lintを試してみた"
emoji: "🧹"
type: "tech"
topics: ["biome", "typescript", "lint", "oxlint", "eslint"]
published: true
---

<!-- 前提: 出典ログ logs/run-biome-type-aware-lint-20260711-0408/execution-log.md / 記事タイプ: 検証ログ・試してみた / slug: biome-type-aware-lint-tsc-free / published: false -->

## はじめに

普段は ESLint と oxlint しか触ってこなかった新人です。最近 Biome に「型認識lint（type-aware linting）」が入ったと知って、しかもそれが TypeScript コンパイラ（`tsc`）に依存しない自前のエンジンで動く、という話が気になって手元で試してみました。

やったことはシンプルで、「型情報がないと検出できない」バグを3種類仕込んだ小さな TypeScript プロジェクトを作り、Biome の型認識lintで本当に拾えるかを確認しました。ついでに、同じファイルを oxlint と ESLint(typescript-eslint) にも通して、検出結果と「型情報の出どころ」の違いを見比べています。

結論としては、3種類とも Biome で検出できました。ただ、そこに至るまでに設定でわりと詰まったので、その過程も含めて残しておきます。

:::message
筆者は新人で、Biome の型認識lintを触るのは初めてです。実行環境: macOS 26.5 (Darwin 25.5.0) / Node v22.17.0 / npm 10.9.2。
:::

## 使ったもの・環境

- 対象: Biome の型認識lint（`types` ドメイン）
- バージョン: @biomejs/biome 2.5.3 / TypeScript 7.0.2
  - 比較用: oxlint 1.73.0（+ oxlint-tsgolint）/ eslint 10.6.0 + typescript-eslint 8.63.0

確かめたかったのは次の3点です。

1. `types` を有効にすると型依存バグが検出される
2. 型認識なしだと同じバグは検出されない
3. oxlint / ESLint との検出差を残す

## 事前に調べたこと（oxlintとの違い）

試す前に公式ドキュメントを読んで、いくつか前提を更新しました。

Biome の型認識ルールは [Linter Domains](https://biomejs.dev/linter/domains/) の `types` ドメインにまとまっています。ドキュメントを見た時点で、今回仕込もうとしている3バグに対応するルール（`noFloatingPromises` / `noUnsafePlusOperands` / `useExhaustiveSwitchCases`）が **全部 nursery グループ**に入っていることが分かりました。`types` ドメインの stable 側は `useArrayFind` や `noUnnecessaryConditions` などで、狙っているルールとは別物です。この「nursery だから `recommended` では拾えないかも」という予感は、あとで見事に的中しました。

もう一つ勘違いしていたのが oxlint との差別化点です。「型認識lintがあるか無いか」で差がつくと思っていたのですが、[oxlint も 2026 時点で type-aware linting を持っています](https://oxc.rs/docs/guide/usage/linter/type-aware.html)。ただし oxlint の型認識は tsgolint（Go）+ typescript-go に依存していて、`oxlint-tsgolint` という別バイナリと tsconfig が要ります。

なので Biome の独自性は「型認識lintの有無」ではなく、[Roadmap 2026](https://biomejs.dev/blog/roadmap-2026/) が言うところの

> First tool to ship type-aware lint rules that don't rely on the TypeScript compiler (commonly known as `tsc`), thanks to its inference engine, sponsored by Vercel

つまり「tsc（typescript-go）に依存せず、自前の inference engine でやる」という点なんだ、と理解し直しました。

## 環境構築

ここは詰まりませんでした。

```bash
npm init -y
npm i -D -E @biomejs/biome typescript
npx @biomejs/biome --version   # => Version: 2.5.3
npx tsc --version              # => Version 7.0.2
```

`npm i` は `added 4 packages ... found 0 vulnerabilities` で、特に問題なし。続けて設定ファイルを生成します。

```bash
npx @biomejs/biome init
```

事前に「init が対話で止まったら headless だと面倒だな」と身構えていたのですが、2.5.3 の `init` は完全に非対話で `biome.json` を吐き出してくれました。生成された `biome.json` は `linter.rules.preset: "recommended"`・`formatter.indentStyle: "tab"` が既定です。

動作確認に、なんでもない1ファイルを `check` してみます。

```ts:src/hello.ts
// フェーズ2 Hello World: Biome が動くか確認するだけの素直なファイル
export function greet(name: string): string {
  return `Hello, ${name}`;
}
```

```bash
npx @biomejs/biome check src/hello.ts
```

出力はフォーマット差分（スペース→タブ）だけでした。

```text
src/hello.ts format ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  × Formatter would have printed the following content:

    3   │ - ··return·`Hello,·${name}`;
      3 │ + → return·`Hello,·${name}`;

Checked 1 file in 86ms. No fixes applied.
Found 1 error.
```

Biome が動くことは確認できたので、本編に進みます。

## 実際に試したこと（本編）

型情報がないと検出できないバグを3つ仕込んだファイルを用意しました。

```ts:src/bugs.ts
// --- バグ1: 未await の Promise（noFloatingPromises） ---
async function fetchUser(): Promise<string> {
  return "alice";
}

function main(): void {
  fetchUser(); // ← await/then/catch されていない floating promise
}

// --- バグ2: number と bigint の混在加算（noUnsafePlusOperands） ---
function addAmount(count: number, big: bigint): number {
  // number + bigint は TypeError: Cannot mix BigInt and other types
  return (count + big) as unknown as number;
}

// --- バグ3: switch の網羅漏れ（useExhaustiveSwitchCases） ---
type Status = "draft" | "published" | "archived";

function render(status: Status): string {
  switch (status) {
    case "draft":
      return "下書き";
    case "published":
      return "公開";
    // "archived" のケースが無い（網羅漏れ）
  }
  return "unknown";
}

main();
console.log(addAmount(1, 2n));
console.log(render("draft"));
```

3つとも「その行のトークンだけ見ても分からない」のがポイントです。`fetchUser()` の戻り値が Promise かどうか、`count + big` の左右がどんな型か、`Status` の union に何メンバあるか——どれも型を解決して初めて「バグだ」と言えます。

設定でだいぶ回り道をしたのですが（後述）、最終的に効いた `biome.json` の linter 設定はこうなりました。

```json:biome.json
{
  "linter": {
    "enabled": true,
    "domains": {
      "types": "all"
    },
    "rules": {
      "preset": "recommended",
      "nursery": {
        "noFloatingPromises": "error",
        "noUnsafePlusOperands": "error",
        "useExhaustiveSwitchCases": "error"
      }
    }
  }
}
```

この状態で lint すると、3件すべて検出できました。

```bash
npx @biomejs/biome lint src/bugs.ts
```

```text
src/bugs.ts:12:2 lint/nursery/noFloatingPromises ━━━━━━━━━━━━━━━━━━━━

  × A "floating" Promise was found, meaning it is not properly handled and could lead to ignored errors or unexpected behavior.

  > 12 │ 	fetchUser(); // ← await/then/catch されていない floating promise

src/bugs.ts:22:10 lint/nursery/noUnsafePlusOperands ━━━━━━━━━━━━━━━━━

  × Numeric + operations must use either two bigint values or two number values.

  > 22 │ 	return (count + big) as unknown as number;

  i This operation mixes number with bigint.

src/bugs.ts:31:2 lint/nursery/useExhaustiveSwitchCases  FIXABLE  ━━━━

  × The switch statement is not exhaustive.

  i These cases are missing:
  - "archived"

Checked 1 file in 324ms. No fixes applied.
Found 3 errors.
```

3件検出できて exit code は 1。狙い通りの結果です。`useExhaustiveSwitchCases` は `FIXABLE` になっていて、`archived` ケースを追加する unsafe fix まで提案してくれました。

## 詰まった点と解決

ここが今回いちばん学びのあった部分です。

### `types` を有効にしても0件だった

最初は素直に `domains.types: "recommended"` を設定して lint したのですが、検出は0件（exit 0）でした。じゃあと思って `"all"` に上げても、やっぱり0件のまま。

```bash
npx @biomejs/biome lint src/bugs.ts
```

```text
Checked 1 file in 278ms. No fixes applied.
```

事前調査で「3バグのルールは全部 nursery だ」と分かっていたので、`recommended` で拾えないのは想定内でした。でも `"all"` にしても発火しなかったのは予想の一段上で、正直「あれ？」となりました。結局、`rules.nursery.<rule>: "error"` で3つのルールを個別に明示有効化したところ、上のとおり3件出てきました。ドメインを `all` にするだけでは足りず、nursery のルールは名指しで有効化する必要がある、というのがここでの学びです。この落とし穴は knowledge にも残しました。

### `number + string` を仕込んだのに検出されない

バグ2は、最初 `number + string` で作っていました。ところが `noUnsafePlusOperands` にはまったく引っかからない。おかしいなとルールの説明を読んだら、Biome の `noUnsafePlusOperands` は `number + string` を「文字列結合」として**許容**していて、`number + bigint` や symbol / object との混在だけを不正とする仕様でした。バグを `number + bigint` に直したら、ちゃんと検出されるようになりました。「型認識lintに引っかけたいなら、そのルールが何を不正とみなすのか定義まで読まないと空振りする」という当たり前のことを体で覚えました。

### ESLint 側の準備で ERESOLVE

比較のために ESLint を入れようとしたら、install の段階で転びました。

```bash
npm i -D eslint typescript-eslint
```

```text
npm error code ERESOLVE
Found: typescript@7.0.2
peer typescript@">=4.8.4 <6.1.0" from typescript-eslint@8.63.0
```

typescript@7.0.2 が typescript-eslint 8.x の peer 範囲（`>=4.8.4 <6.1.0`）から外れているのが原因です。これは以前にも別の検証で踏んだことがあって、対処も分かっていました。TypeScript を peer 範囲内に固定するだけです。

```bash
npm i -D -E typescript@5.9.3
npm i -D eslint typescript-eslint   # => 成功
```

逆に言うと、Biome / oxlint 側は TypeScript 7.0.2 のままで問題なく動いていました。Biome は自前エンジンなので TS 本体のバージョンに引っ張られない、というのがこういう地味なところで効くんだな、と実感した瞬間でした。

## 触ってみて分かったこと

ひとつ気をつけたいのが、「型認識のON/OFF比較」をどう取るかです。当初は `domains.types` を `"none"` に切り替えれば検出が消えると思っていたのですが、ルールを明示有効化したままだと `domains.types: "none"` にしても3件出続けました。ルールを有効化した時点で型推論エンジン（scanner）が起動するようで、正確なON/OFF対比はドメインのトグルではなく**ルール自体のON/OFF**で見る必要がありました。

`--verbose` を付けて挙動を見ると、型認識ONのときだけ `Scanned project folder in 100ms` の行が出ます。

```bash
npx @biomejs/biome lint --verbose src/bugs.ts
```

```text
Scanned project folder in 100ms.
Checked 1 file in 216ms. No fixes applied.
Found 3 errors.
```

素の recommended だと約250msで終わるのに対し、scan が走ると実行時間は最大950msくらいまで振れました。プロジェクト全体を舐める分のコストは確かにあります。今回は tsconfig 無しでも動きましたが、公式はプロジェクトscanを前提にしているので、実運用では tsconfig を置いた状態が素直だと思います。

## oxlint・ESLintと比べて感じたこと

同じ `src/bugs.ts` を3ツールに通した結果です。

| バグ | Biome(types) | oxlint 素 | oxlint --type-aware | ESLint+typescript-eslint |
|---|---|---|---|---|
| 未awaitPromise | ✓ | ✗ | ✓ | ✓ |
| number+bigint | ✓ | ✗ | ✓ | ✓ |
| switch網羅漏れ | ✓ | ✗ | ✓ | ✓ |

型認識を効かせれば3ツールとも3バグを拾えます。oxlint は素だと0件で、`--type-aware` を付けて初めて検出されました。ただし `--type-aware` を最初に叩いたときはこう言われました。

```bash
npx oxlint --type-aware src/bugs.ts
```

```text
Failed to find tsgolint executable. You may need to add the `oxlint-tsgolint` package to your project?
```

`npm i -D oxlint-tsgolint` を入れると動きます。この「別バイナリを足す」手順が Biome と対照的でした。また、素の `--type-aware` では `no-floating-promises` の1件しか出ず、残り2つは `-D typescript/restrict-plus-operands` のようにルールを明示指定して初めて3件になりました。

ESLint(typescript-eslint) は3バグに加えて `require-await` と `no-unnecessary-type-assertion` も拾って計5件でした。

```text
   7:1   error  Async function 'fetchUser' has no 'await' expression       @typescript-eslint/require-await
  12:2   error  Promises must be awaited ...                               @typescript-eslint/no-floating-promises
  22:9   error  This assertion is unnecessary ...                          @typescript-eslint/no-unnecessary-type-assertion
  22:10  error  Numeric '+' operations must either be both bigints ...     @typescript-eslint/restrict-plus-operands
  31:10  error  Switch is not exhaustive. Cases not matched: "archived"    @typescript-eslint/switch-exhaustiveness-check

✖ 5 problems (5 errors, 0 warnings)
```

検出の網の広さは ESLint が一枚上でした（今回のケースでは、ですが）。

いちばん見比べたかった「型情報の出どころ」の違いはこうなりました。

| 観点 | Biome | oxlint | ESLint(typescript-eslint) |
|---|---|---|---|
| 型情報の出どころ | 自前 inference engine（tsc非依存） | typescript-go（tsgolint経由） | tsc（TypeScript本体） |
| 追加で要る物 | @biomejs/biome のみ | oxlint + oxlint-tsgolint 別バイナリ | typescript + parser/plugin一式 |
| デフォルトで型認識バグを拾うか | 拾わない（domain+rule有効化が要る） | 拾わない（--type-aware必須） | recommendedTypeChecked で拾う |

## どんな人に向いていそうか

まだ触りだけの感想ですが、Biome の型認識lintは「フォーマッタ・リンタ・型認識lintまで単一パッケージで済ませたい」人には気持ちよさそうです。別バイナリも tsc 一式も足さずに、`@biomejs/biome` だけで型依存バグまで見てくれます。TS 本体のバージョン地雷（今回の TS7 × typescript-eslint のような）を踏みたくない、というのも地味に効くメリットでした。

一方で、狙ったルールが nursery にあると `domains.types` 任せでは発火せず、名指しの有効化が要ります。検出の網羅性という点では、今回のサンプルでは ESLint の方が余分に拾ってくれました。「導入は軽いが、有効化と網羅性は自分で詰める」くらいの温度感かなと感じています。

## まとめ

確かめたかった3点（型認識ONで検出 / OFFで非検出 / 他ツールとの差）はいずれも手元で確認できました。詰まったのはむしろ設定側で、「nursery ルールは `all` でも名指し有効化が要る」「`noUnsafePlusOperands` は number+string を許容する」あたりは、実際に空振りして初めて腹落ちしました。

一通り試すのに数時間くらい。まだ nursery ルールを数個触った程度なので、次は `noMisusedPromises` など他の型認識ルールや、tsconfig をちゃんと置いた状態でのプロジェクトscanの挙動も見てみたいです。

## 参考リンク

- Biome Linter Domains: https://biomejs.dev/linter/domains/
- Biome Roadmap 2026: https://biomejs.dev/blog/roadmap-2026/
- oxlint type-aware linting: https://oxc.rs/docs/guide/usage/linter/type-aware.html
- oxlint type-aware 発表: https://voidzero.dev/posts/announcing-oxlint-type-aware-linting
