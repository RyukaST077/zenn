---
title: "Node.js 26 package maps検証がpnpmのstore設定gateで止まった記録"
emoji: "🛑"
type: tech
topics: ["nodejs", "pnpm", "パッケージ管理"]
published: true
---

## 対象読者

- Node.js 26のexperimental package mapsをpnpmで試したい方
- monorepoのphantom dependencyを検出する検証に関心がある方
- 本題へ到達できなかった検証を、未確認事項と分けて記録したい方

## 何を検証しようとしたか

Node.jsのpackage mapsは、静的なJSONを使ってbare specifierを解決するexperimental機能です。Node.js公式ドキュメントでは、monorepoでdependencyを明示することやphantom dependencyを拒否することが目的として説明されています。

https://nodejs.org/api/packages.html#package-maps

pnpm 11.8.0のリリースでは、`node_modules/.package-map.json`の生成と、`standard` / `loose`のmap typeを選ぶ設定が追加されています。

https://github.com/pnpm/pnpm/releases/tag/v11.8.0

そこで、小さなpnpm workspaceに次の4条件を用意し、未宣言dependencyのimport結果を比較する計画を立てました。

1. package mapなし
2. `loose` package map
3. `standard` package map
4. 不足していたdependencyを宣言した後の`standard` package map

しかし、実行はfixtureを作る前のpnpm store設定確認で停止しました。この記事はpackage mapsの挙動を比較した結果ではなく、前提条件のgateで止まったnegative runの記録です。

## 検証環境

すべて新しいrun directory内に隔離し、globalのNode.jsやpnpmは変更していません。

| 項目 | 観測値 |
|---|---|
| OS | Darwin |
| Architecture | arm64 |
| Node.js | v26.5.0 |
| pnpm | 11.8.0 |
| Node.js archive | `node-v26.5.0-darwin-arm64.tar.gz` |
| Node.js archive SHA-256 | `ee920559aaa2391569cff4d737e3b83963430e3a14dedd91bfe0ff53171b5af9` |
| pnpm tarball SHA-256 | `1e963a5c4ca5168550ba03fc4ee8d873a772b072b7fce63b48fff27d720e2e98` |
| effective sandbox mode | `danger-full-access` |

Node.js archiveは公式の`SHASUMS256.txt`と照合し、`OK`になりました。展開したNode.jsは`v26.5.0`、同じ隔離Node.jsで起動したpnpmは`11.8.0`を返しました。

また、`node --help`には次のflagが存在しました。

```text
--experimental-package-map=...
```

このflagはNode.js 26.4.0で追加されたStability 1のexperimental機能です。

https://nodejs.org/api/cli.html#--experimental-package-mappath

## 実行手順の抜粋

Node.js v26.5.0の公式archiveと`pnpm@11.8.0`のtarballを隔離ディレクトリへ展開した後、pnpm storeもrun directory内へ置くため、次の環境変数を設定しました。`<WORK>`は実際のrun directory内の作業パスを表します。

```bash
export npm_config_store_dir="<WORK>/.cache/pnpm-store"
```

以下はgate周辺の抜粋であり、実行手順全体ではありません。実行時には`XDG_CONFIG_HOME`などをrun directory内へ向ける隔離用export群も設定し、`run-recorded.sh`で各コマンドのstdout、stderr、終了コードを保存しました。完全な環境dumpは採取していないため、ここで省略した隔離設定が`config get`の結果へ影響した可能性は除外できません。

続いて、隔離したNode.jsでpnpm CLIのversionと設定値を確認しました。記録wrapperを通した実際の形を、絶対pathだけ`<WORK>`へ置き換えると次のとおりです。

```bash
"<WORK>/tools/run-recorded.sh" node-version \
  "<WORK>/tools/node/bin/node" --version
"<WORK>/tools/run-recorded.sh" pnpm-version \
  "<WORK>/tools/node/bin/node" "<WORK>/tools/pnpm/bin/pnpm.cjs" --version
"<WORK>/tools/run-recorded.sh" pnpm-store-dir \
  "<WORK>/tools/node/bin/node" "<WORK>/tools/pnpm/bin/pnpm.cjs" config get store-dir
```

このwrapperにより、最後のコマンドのstdoutは`<WORK>/evidence/toolchain/pnpm-store-dir.stdout`へ保存されました。計画では、その内容が`<WORK>/.cache/pnpm-store`と一致することを必須条件にしていました。実行したassertionは、改行を除いた出力との完全一致です。

```bash
test "$(tr -d '\r\n' < "<WORK>/evidence/toolchain/pnpm-store-dir.stdout")" \
  = "<WORK>/.cache/pnpm-store"
```

## 観測結果

toolchain取得から停止までの結果は次のとおりです。

| Gate | 期待値 | 実測値 | 結果 |
|---|---|---|---|
| Node.js archive checksum | 公式SHA-256との照合成功 | `OK` | pass |
| Node.js exact version | `v26.5.0` | `v26.5.0` | pass |
| package map flag | helpにflagが存在 | `--experimental-package-map=...` | pass |
| pnpm exact version | `11.8.0` | `11.8.0` | pass |
| pnpm store設定のreadback | `<WORK>/.cache/pnpm-store` | `undefined` | fail |

記録した3つのコマンド出力は次のとおりです。

```text
$ <WORK>/tools/node/bin/node --version
v26.5.0

$ <WORK>/tools/node/bin/node <WORK>/tools/pnpm/bin/pnpm.cjs --version
11.8.0

$ <WORK>/tools/node/bin/node <WORK>/tools/pnpm/bin/pnpm.cjs config get store-dir
undefined
```

3コマンド自体の終了コードはいずれも`0`で、stderrは空でした。その後の完全一致assertionが終了コード`1`になり、`set -e`によって計画が停止しました。

したがって、今回観測できたのは「この実行で環境変数をexportした後も、計画が要求した`config get store-dir`のreadbackは`undefined`だった」という一点です。pnpm 11.8.0全般で同じ結果になるとは一般化できません。

## 失敗と対処

### pnpm store設定のreadback gate

計画では、設定keyを期待したpathとして読み返せない場合は、その時点で停止することにしていました。実際に`undefined`だったため、`.npmrc`の追加、環境変数名の変更、installの強行といったfallbackは試していません。

停止後、repository内の既知事例を`pnpm`、`store-dir`、`undefined`、`config get`、`npm_config_store_dir`で検索しましたが、適用できる確認済みの対処は見つかりませんでした。見つかったpnpm関連事例はTypeScriptのpeer dependency問題で、今回の症状とは異なりました。

今回の記録だけでは、環境変数がstoreの実動作には使われるが`config get`には現れないのか、設定形式が誤っていたのか、それ以外の理由なのかを判定できません。原因の説明は推測になるため、ここでは`undefined`という観測と停止条件だけを残します。

## 制限事項

- workspace fixtureは作成していません。
- dependency installは実行していません。
- `node_modules/.package-map.json`は生成していません。
- package mapなし、`loose`、`standard`の比較はすべて未実行です。
- declared dependency、phantom dependency、relative import、`node:` builtinのprobeはすべて未実行です。
- dependency宣言追加前後のmap差分も存在しません。
- pnpm script経由とNode.jsのflag明示経由の比較もしていません。
- store設定が`undefined`になった原因は未診断です。
- 結果はDarwin arm64、Node.js v26.5.0、pnpm 11.8.0で行った1回の実行に限られます。

特に、phantom dependencyが`standard`で拒否される、`loose`では成功する、dependency宣言追加後に成功するといった結果は、今回の実行からは何も言えません。これらは計画時の仮説であり、観測結果ではありません。

## まとめ

今回の検証では、Node.js v26.5.0とpnpm 11.8.0の隔離取得、Node.js archiveのchecksum、package map CLI flagまでは確認できました。一方、`pnpm config get store-dir`が期待した隔離pathではなく`undefined`を返したため、明示していたcapability gateに従って停止しました。

package mapsのcore matrixへ進まなかったことで、phantom dependencyの許可・拒否について都合のよい結果を補完せずに済みました。次に再計画するなら、pnpm 11.8.0でstore設定を隔離し、その設定をどのコマンドで検証すべきかを一次情報から確定する工程が先です。そのgateを通過するまでは、package mapsの挙動検証とは切り分けて扱う必要があります。

## 参考資料

- [Node.js v26.4.0 release](https://nodejs.org/en/blog/release/v26.4.0)（2026-07-13閲覧）
- [Node.js Packages: Package maps](https://nodejs.org/api/packages.html#package-maps)（2026-07-13閲覧）
- [Node.js CLI: `--experimental-package-map`](https://nodejs.org/api/cli.html#--experimental-package-mappath)（2026-07-13閲覧）
- [pnpm 11.8.0 release](https://github.com/pnpm/pnpm/releases/tag/v11.8.0)（2026-07-13閲覧）
