---
title: "npm v12のallowScriptsを無害なlocal fixtureで試す"
emoji: "🔐"
type: tech
topics: ["npm", "nodejs", "security"]
published: true
---

## 対象読者

- npm 12への更新を検討している方
- `npm install`が成功したのに、依存パッケージの生成物が見つからない状況を切り分けたい方
- install scriptの許可方針を`package.json`で管理したい方

## 検証したこと

npm 12では、install時のscriptを`allowScripts`で明示的に扱う変更が有効になりました。GitHubの公式発表では、npm 12の一般提供とinstall時セキュリティの既定値変更が案内されています。また、事前の公式告知では、`allowScripts`の既定offと、`approve-scripts` / `deny-scripts`で方針を記録する方法が説明されています。

- [npm install-time security and GAT bypass2fa deprecation](https://github.blog/changelog/2026-07-08-npm-install-time-security-and-gat-bypass2fa-deprecation/)
- [Upcoming breaking changes for npm v12](https://github.blog/changelog/2026-06-09-upcoming-breaking-changes-for-npm-v12/)
- [npm approve-scripts](https://docs.npmjs.com/cli/v11/commands/npm-approve-scripts/)

そこで、`postinstall`が固定文字列のmarker fileを1個作るだけのlocal `file:` dependencyを用意し、次を比較しました。

1. npm 11とnpm 12の未許可install
2. `approve-scripts`による許可前後
3. dependencyの参照先を1.0.0用fixtureから1.0.1用fixtureへ変更した場合
4. 明示deny
5. policyの有無による`npm ci`の差

installの終了コードだけではscriptが動いたか判断せず、warning、pending一覧、`package.json`の差分、marker、runtime testを別々に記録しました。

## 環境

| 項目 | 検証値 |
|---|---|
| OS / architecture | Darwin / arm64 |
| Node.js | v22.17.0 |
| npm 11 | 11.18.0 |
| npm 12 | 12.0.1 |

重要な制約があります。npm 12.0.1は毎回、Node.js v22.17.0が非対応であり、対応範囲は`^22.22.2 || ^24.15.0 || >=26.0.0`だとwarningを出しました。以下のnpm 12の結果は、CLI command自体は完了したものの、非対応の組み合わせで得た観測です。

## 再現手順

### 1. 無害なdependencyを作る

検証用dependencyの`package.json`は次の内容です。

```json
{
  "name": "fixture-installer",
  "version": "1.0.0",
  "main": "index.cjs",
  "scripts": {
    "postinstall": "node postinstall.cjs"
  }
}
```

`postinstall.cjs`は、dependency自身のdirectoryに固定文字列を書くだけです。

```js
require("node:fs").writeFileSync(
  "postinstall-marker.txt",
  "fixture-installer@1.0.0\n",
  "utf8",
);
```

runtimeからmarkerを確認できるように`index.cjs`も用意しました。

```js
const fs = require("node:fs");
const path = require("node:path");

exports.status = () => {
  const marker = path.join(__dirname, "postinstall-marker.txt");
  return {
    marker: fs.existsSync(marker),
    content: fs.existsSync(marker)
      ? fs.readFileSync(marker, "utf8").trim()
      : null,
  };
};
```

app側では、このpackageをlocal `file:` dependencyとして参照しました。

```json
{
  "name": "allow-scripts-app",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "test": "node test.cjs"
  },
  "dependencies": {
    "fixture-installer": "file:../../fixtures/fixture-installer"
  }
}
```

`test.cjs`では、markerの有無と内容をassertしました。

```js
const assert = require("node:assert/strict");
const { status } = require("fixture-installer");

const actual = status();
console.log(JSON.stringify(actual));
assert.deepEqual(actual, {
  marker: true,
  content: "fixture-installer@1.0.0",
});
```

実際の検証ではnpm 11.18.0と12.0.1のtarballを隔離directoryへ展開し、hostの`node`から各`npm-cli.js`を直接起動しました。以降の`$NPM11_CLI`と`$NPM12_CLI`は、それぞれの`bin/npm-cli.js`を指します。

### 2. 未許可状態を比較する

npm 11用とnpm 12用に同じfixtureをcopyし、それぞれclean stateで実行しました。

```bash
node "$NPM11_CLI" install
node observe.cjs
node "$NPM11_CLI" test
```

local `file:` dependencyはこの検証環境ではsymlinkになり、`postinstall`が作るmarkerはfixture source側へ残ります。そのため、npm 11の実行後に`node_modules`を消すだけでは不十分です。有効なnpm 12 baselineでは、npm 12用のcaseを分けたうえで、fixture sourceに生成されたmarkerだけを削除してからinstallしました。

```bash
rm -f ../../fixtures/fixture-installer/postinstall-marker.txt
node "$NPM12_CLI" install
node "$NPM12_CLI" approve-scripts --allow-scripts-pending
node observe.cjs
node "$NPM12_CLI" test
```

npm 12の未許可installでは、install自体はexit 0でしたが、次のwarningとpending表示が記録されました。

```text
npm warn install-scripts 1 package had install scripts blocked because they are not covered by allowScripts:
npm warn install-scripts   fixture-installer@1.0.0 (postinstall: node postinstall.cjs)
1 package has install scripts blocked because they are not covered by allowScripts:
  fixture-installer@1.0.0 (postinstall: node postinstall.cjs)
```

### 3. pending packageを許可する

検証では次のcommandを実行し、続けて`node_modules`を削除してclean installしました。

```bash
node "$NPM12_CLI" approve-scripts fixture-installer@1.0.0
rm -rf node_modules
node "$NPM12_CLI" install
node observe.cjs
node "$NPM12_CLI" test
```

commandには`fixture-installer@1.0.0`を渡しましたが、このlocal dependencyについて実際に追加されたpolicyはversion付きpackage名ではなく、正規化されたlocal file identityでした。

```json
{
  "allowScripts": {
    "file:../../../fixtures/fixture-installer": true
  }
}
```

### 4. 別のlocal pathへの変更を試す

fixtureを複製してversionとmarkerを1.0.1へ変え、appのdependency pathも`fixture-installer-1.0.1`へ変更しました。lockfileを更新してinstallすると、新しい参照先は再びpendingになりました。

```bash
node "$NPM12_CLI" install --package-lock-only
node "$NPM12_CLI" install
node "$NPM12_CLI" approve-scripts --allow-scripts-pending
node observe.cjs
node "$NPM12_CLI" test
```

新しい参照先を許可してclean installすると、1.0.1のmarkerとtestが成功しました。

```bash
node "$NPM12_CLI" approve-scripts fixture-installer@1.0.1
rm -rf node_modules
node "$NPM12_CLI" install
node "$NPM12_CLI" test
```

### 5. 明示denyとnpm ciを確認する

別の無害なfixtureもdependencyへ追加し、一方を許可、もう一方をdenyしました。記録されたpolicyは次の形です。

```json
{
  "allowScripts": {
    "file:../../../fixtures/fixture-installer": true,
    "file:../../../fixtures/fixture-denied": false
  }
}
```

また、許可済みpolicyとlockfileを持つclean copy、およびpolicyだけを除いたclean copyで、npm 12の`ci`を実行しました。

明示denyのcaseでは、2つのfixtureがpendingであることを確認し、一方を許可、もう一方をdenyしてからmarkerを消したclean installを行いました。

```bash
node "$NPM12_CLI" install
node "$NPM12_CLI" approve-scripts --allow-scripts-pending
node "$NPM12_CLI" approve-scripts fixture-installer@1.0.0
node "$NPM12_CLI" deny-scripts fixture-denied@1.0.0
rm -rf node_modules
rm -f ../../fixtures/fixture-installer/postinstall-marker.txt
rm -f ../../fixtures/fixture-denied/postinstall-marker.txt
node "$NPM12_CLI" install
node "$NPM12_CLI" test
node observe-denied.cjs
```

`npm ci`は、同じlockfileと許可policyを持つcaseを2つのclean directoryへcopyして比較しました。許可ありのcaseはそのまま実行しました。

```bash
rm -rf node_modules
rm -f ../../fixtures/fixture-installer/postinstall-marker.txt
node "$NPM12_CLI" ci
node observe.cjs
node "$NPM12_CLI" test
```

policyなしのcaseでは、dependencyとlockfileは変えず、`package.json`から`allowScripts`だけを削除しました。その後、同じくmarkerがないclean stateで`ci`を実行しました。

```bash
node -e 'const fs=require("node:fs");const p=JSON.parse(fs.readFileSync("package.json","utf8"));delete p.allowScripts;fs.writeFileSync("package.json",JSON.stringify(p,null,2)+"\n")'
rm -rf node_modules
rm -f ../../fixtures/fixture-installer/postinstall-marker.txt
node "$NPM12_CLI" ci
node observe.cjs
node "$NPM12_CLI" test
```

## 観測結果

| npm | 条件 | install / ci | marker | runtime test |
|---|---|---:|---|---:|
| 11.18.0 | policyなし、1.0.0 | install: 0 | `fixture-installer@1.0.0` | pass: 0 |
| 12.0.1 | policyなし、1.0.0 | install: 0 | なし | fail: 1（想定内） |
| 12.0.1 | local fileを許可、1.0.0 | install: 0 | `fixture-installer@1.0.0` | pass: 0 |
| 12.0.1 | 古いlocal-file policy、別pathの1.0.1 | install: 0 | なし | fail: 1（想定内） |
| 12.0.1 | 新しいlocal fileを許可、1.0.1 | install: 0 | `fixture-installer@1.0.1` | pass: 0 |
| 12.0.1 | 許可policyあり、1.0.0 | ci: 0 | `fixture-installer@1.0.0` | pass: 0 |
| 12.0.1 | policyなし、1.0.0 | ci: 0 | なし | fail: 1（想定内） |

明示denyのcaseでは、許可したfixtureのmarkerは生成され、denyしたfixtureのmarkerは生成されませんでした。

この結果から、このfixtureではinstall / `ci`のexit 0とlifecycle scriptの成功を分けて確認する必要がある、と解釈できます。CIでinstall stepだけを見ていると、scriptに依存する生成物の不足を見逃す可能性があります。markerに依存するruntime testを併用すると、今回の差を検出できました。

## 失敗と修正

### command recorderがsandboxで動かなかった

最初のrecorderはBashのprocess substitutionを使っていましたが、`/dev/fd/62`へのaccessが`Operation not permitted`となり、実commandの前に失敗しました。stdoutとstderrをそれぞれfileへredirectし、終了後に`cat`で再生する方式へ変更しました。このため、各streamの内容、時刻、command、exit codeは残っていますが、stdoutとstderrのliveなinterleaveは保存されていません。

### local file dependencyのmarkerが別caseへ混入した

最初のnpm 12 baselineは、local `file:` dependencyがsymlinkになり、先にnpm 11がfixture sourceへ書いたmarkerを再利用していました。このcaseは結果から除外しました。以後はfixture source側の生成markerを削除してからclean installし、有効な比較を取り直しました。

### 想定したversion固定・name-only policyにならなかった

`approve-scripts`へ`fixture-installer@1.0.0`を渡した場合も、package名だけを渡した場合も、このlocal dependencyでは`file:...` keyが記録されました。別pathの1.0.1 fixtureへ変更すると旧policyは適用されませんでした。

したがって、この検証からregistry packageのname-only承認とversion固定承認の差は結論できません。仮説と異なりましたが、実際のpolicy差分をそのまま結果として採用しました。

## 制約

- npm 12.0.1とNode.js v22.17.0は非対応の組み合わせでした。
- 検証対象は自作の無害なlocal `file:` dependencyです。registry packageへ一般化していません。
- native addon、Git / remote dependency、global install、`npx`、第三者packageは検証していません。
- dependency更新時の観測にはversion変更だけでなくlocal path変更も含まれます。再審査の原因をversionだけに帰属させていません。
- `install --package-lock-only`では1.0.0と1.0.1の両方に触れるwarningが出た後、実installのpending表示はactiveな1.0.1 sourceだけになりました。理由は推測していません。
- 1回のwarm cache環境での実行であり、性能比較ではありません。

## まとめ

今回のlocal fixtureでは、npm 12.0.1の未許可installとpolicyなしの`npm ci`はいずれもexit 0でしたが、`postinstall`のmarkerは生成されず、marker依存testは失敗しました。許可policyがあるclean install / `npm ci`ではmarkerが生成され、testも成功しました。

また、`approve-scripts`へversion付きまたはname-onlyの引数を渡しても、この`file:` dependencyではlocal file identityのpolicyになりました。別pathへ変更すると再承認が必要でした。この点をregistry packageの承認粒度と混同せず、実際に生成された`package.json`を確認することが重要です。

## 参考資料

- [npm install-time security and GAT bypass2fa deprecation](https://github.blog/changelog/2026-07-08-npm-install-time-security-and-gat-bypass2fa-deprecation/)
- [Upcoming breaking changes for npm v12](https://github.blog/changelog/2026-06-09-upcoming-breaking-changes-for-npm-v12/)
- [npm approve-scripts](https://docs.npmjs.com/cli/v11/commands/npm-approve-scripts/)
