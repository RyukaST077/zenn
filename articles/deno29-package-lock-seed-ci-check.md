---
title: "Deno 2.9でpackage-lockからdeno.lockを作り、deno ciまで試す"
emoji: "🦕"
type: tech
topics: ["deno", "npm", "nodejs", "lockfile"]
published: true
---

## 対象読者

- npmで管理している小さなNode.jsプロジェクトをDenoでも扱えるか試したい方
- `package-lock.json`から生成される`deno.lock`に、何が引き継がれるのか気になる方
- `deno ci`がlockfileのずれを検出する条件を、実際のログで確認したい方

## 検証したこと

Deno 2.9のリリースでは、`deno.lock`がまだないプロジェクトで`deno install`を実行すると、npmなど他のパッケージマネージャーのlockfileを読み込み、解決済みバージョンとintegrity hashを引き継ぐ機能が案内されています（[Deno 2.9リリース](https://deno.com/blog/v2.9)）。

今回は`string-width@7.2.0`だけを直接依存に持つ小さなESMプロジェクトを作り、次の5点を確認しました。

1. `package-lock.json`だけがある状態から、Deno 2.9.0の`deno install`で`deno.lock`が作られるか
2. npmとDenoのlockfileで、直接依存・推移依存の名前、バージョン、integrityが一致するか
3. 同じソースとテストが`node`、`npm test`、`deno task test`で動くか
4. `node_modules`を消した後、`deno ci`で再構築できるか
5. `package.json`だけを変更したとき、`deno ci`が古いlockfileを拒否するか

なお、Deno公式のnpm移行ガイドでは、Node.js runtimeを維持しながらDenoをパッケージマネージャーとして段階的に使う方法も説明されています（[Migrate from npm](https://docs.deno.com/runtime/migrate/migrate_from_npm/)）。今回もアプリの実行入口をNode.jsから完全に置き換えるのではなく、同じfixtureを両方から実行して比較しました。

## 環境

| 項目 | 検証値 |
|---|---|
| OS / architecture | Darwin 25.5.0 / arm64 |
| Node.js | v22.17.1 |
| npm | 10.9.2 |
| 検証対象のDeno | 2.9.0（公式archiveを隔離取得） |
| 比較用のsystem Deno | 2.8.3（検証には未使用） |

Deno 2.9.0は公式のmacOS arm64向けarchiveを取得し、配布されたSHA-256 checksumの検証に成功したbinaryだけを絶対pathで実行しました。npm registryへの接続確認も最初の1回で成功しています。ブラウザを使わないCLI検証のため、ブラウザやPlaywrightは起動していません。

## 再現手順

### 1. npmのfixtureとbaselineを作る

`package.json`は次の内容です。依存バージョンはrangeではなく`7.2.0`に固定しました。

```json
{
  "name": "deno29-lockfile-seed-fixture",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node src/index.js",
    "test": "node --test"
  },
  "dependencies": {
    "string-width": "7.2.0"
  }
}
```

entryではASCII、全角文字、絵文字を含む文字列の表示幅を出力します。

```js
import stringWidth from "string-width";

const sample = "A界🙂";
console.log(JSON.stringify({ sample, width: stringWidth(sample) }));
```

テストも同じ値を確認する1件だけです。

```js
import test from "node:test";
import assert from "node:assert/strict";
import stringWidth from "string-width";

test("ASCII, full-width, and emoji width", () => {
  assert.equal(stringWidth("A界🙂"), 5);
});
```

npm側では、install scriptを無効化してlockfile生成、clean install、実行、テストの順に進めました。

```bash
npm install --package-lock-only --ignore-scripts --no-audit --no-fund
npm ci --ignore-scripts --no-audit --no-fund
node src/index.js
npm test
node --test
```

ここまでの全commandはexit 0でした。entryの出力は次の通りです。

```text
{"sample":"A界🙂","width":5}
```

### 2. `package-lock.json`から`deno.lock`を作る

npm fixtureを別directoryへcopyし、`package-lock.json`、`package.json`、ソース、テストだけを残しました。`deno.lock`と`node_modules`が存在しないことを確認してから、隔離したDeno 2.9.0で次を実行しました。

```bash
/absolute/path/to/deno-2.9.0/deno install
```

commandはexit 0で、stderrには実際に次のseedメッセージが記録されました。

```text
Seeded deno.lock from .../fixture-deno/package-lock.json
```

続いて5パッケージが初期化され、`Installed 5 packages`と出力されました。生成された`deno.lock`はschema version 5で、`npm` entryは5件でした。

### 3. 2つのlockfileを機械比較する

`package-lock.json`の`packages`と、`deno.lock`の`npm` objectから、パッケージ名・バージョン・integrityをそれぞれJSONへ抽出しました。lockfile固有のpathやkeyを比較対象から外し、3項目を名前順に並べて機械比較しています。

比較対象になったのは次の5件です。

| 種別 | package | version |
|---|---|---|
| 直接依存 | `string-width` | 7.2.0 |
| 推移依存 | `ansi-regex` | 6.2.2 |
| 推移依存 | `emoji-regex` | 10.6.0 |
| 推移依存 | `get-east-asian-width` | 1.6.0 |
| 推移依存 | `strip-ansi` | 7.2.0 |

比較scriptは、名前とバージョンの集合が一致し、さらにintegrityを含む行全体も一致した場合だけexit 0にしました。このfixtureでは両方の判定が`true`で、比較もexit 0でした。

### 4. 実行互換とcleanな`deno ci`を試す

生成済みのDeno fixtureで、Node.jsとDenoの両方から同じテストを実行しました。

```bash
node src/index.js
npm test
/absolute/path/to/deno-2.9.0/deno task test
```

3つともexit 0で、entryはnpm baselineと同じ幅5を出力しました。次に2回目の`deno install`を実行し、その前後の`deno.lock`を`cmp`と`diff`で比較しました。結果はbyte単位で同一で、差分は0 byteでした。

その後、`node_modules`を削除してcleanな状態から再構築しました。

```bash
rm -rf node_modules
/absolute/path/to/deno-2.9.0/deno ci
npm test
/absolute/path/to/deno-2.9.0/deno task test
```

`deno ci`と後続の2つのテストはすべてexit 0でした。lockfileの一般的な役割やDenoでの扱いは、公式の[Lock dependencies with `deno.lock`](https://docs.deno.com/examples/dependency_lockfile_tutorial/)でも確認できます。

### 5. lockfile driftの負例を作る

成功したfixtureをcopyし、`package.json`の直接依存だけを次のように変更しました。

```diff
-    "string-width": "7.2.0"
+    "string-width": "7.1.0"
```

`deno.lock`は更新せず、そのまま`deno ci`を実行しました。

```bash
/absolute/path/to/deno-2.9.0/deno ci
```

今度は意図通りexit 1になり、次の診断が記録されました。

```text
error: The lockfile is out of date
```

診断には`string-width@7.2.0`から`7.1.0`への変更も表示されました。失敗後に保存済みlockfileと比較したところ、`deno.lock`自体はbyte単位で変化していませんでした。

## 観測結果

| 確認項目 | 観測結果 |
|---|---|
| 初回`deno install` | exit 0、seedメッセージあり、schema version 5の`deno.lock`を生成 |
| package/version比較 | 直接1件・推移4件が一致 |
| integrity比較 | 5件すべて一致 |
| Node.js / npm / Denoのテスト | すべて1件中1件pass |
| 2回目の`deno install` | `deno.lock`はbyte-identical |
| clean `deno ci` | exit 0、後続テストもpass |
| `package.json`だけ変更後の`deno ci` | exit 1、古いlockfileを診断、lockfileは未変更 |
| npmへのrollback | `npm ci`、テスト、entry実行がexit 0 |

npmへのrollbackでは、別copyから`deno.lock`と`node_modules`を削除し、保存していた`package-lock.json`で`npm ci --ignore-scripts --no-audit --no-fund`を実行しました。`package-lock.json`はbaselineとbyte単位で同じまま、テストとentryも再び成功しました。

この結果から、少なくとも今回の固定fixtureでは、npm lockからのseed、Denoでの再構築、npmへの切り戻しを一続きの手順として再現できた、と解釈できます。また、`deno ci`のexit codeをCIで確認すれば、`package.json`だけが変更された状態を見逃さずに止められました。

## 失敗と修正

予期しない失敗や、検証中に必要になった修正はありませんでした。Deno 2.9.0の取得・checksum・version gate、npm registry gate、lockfile parser、integrity比較はすべて最初の設計のまま通過しています。

唯一の非0終了は、driftを確認するために意図して作った負例です。`package.json`だけを7.1.0へ変えた状態で`deno ci`がexit 1になったため、別の変更を加えて成功を作ることはせず、その診断と変更されなかった`deno.lock`を結果として保存しました。

## 制限事項

今回確認したのは、install scriptを使わない純粋なJavaScript dependencyを1件だけ直接参照する、単一fixtureです。次は検証していません。

- native addon
- dependency lifecycle script
- private registry
- workspace
- offline / vendor運用
- performance
- browserでの動作
- snapshot testing
- minimum dependency age

そのため、「すべてのnpmプロジェクトが無修正でDenoへ移行できる」とは判断できません。また、観測対象はDeno 2.9.0、Node.js v22.17.1、npm 10.9.2の組み合わせであり、他のバージョンへ結果を一般化していません。依存関係の供給網に関するDenoの機能は、公式の[Supply chain management](https://docs.deno.com/runtime/packages/supply_chain/)を別途確認してください。

## まとめ

固定した小さなnpm fixtureでは、Deno 2.9.0の初回`deno install`が`package-lock.json`をseedに`deno.lock`を生成しました。直接依存1件と推移依存4件について、パッケージ名・バージョン・integrityはnpm側と機械的に一致しました。

同じfixtureはNode.js、npm script、Deno taskでテストを通過し、cleanな`deno ci`でも再構築できました。一方、`package.json`だけを変更すると`deno ci`は古いlockfileとしてexit 1で停止し、既存の`deno.lock`を書き換えませんでした。npmへ戻す手順も成功したため、全面移行を決める前の小さな対照実験として使える結果になりました。

## 参考資料

- [Deno 2.9](https://deno.com/blog/v2.9)
- [Migrate from npm](https://docs.deno.com/runtime/migrate/migrate_from_npm/)
- [Lock dependencies with `deno.lock`](https://docs.deno.com/examples/dependency_lockfile_tutorial/)
- [Supply chain management](https://docs.deno.com/runtime/packages/supply_chain/)
