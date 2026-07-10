---
title: "CSS Gap Decorations検証がブラウザ起動で止まった記録"
emoji: "🧱"
type: tech
topics: [css, chrome, playwright]
published: true
---

## 対象読者

- CSS Gap Decorationsをローカルで検証しようとしている方
- Playwrightのブラウザ起動に失敗したとき、未検証の結果をどう切り分けるか知りたい方

この記事はCSS Gap Decorationsの成功例ではありません。Grid/Flexの区切り線を従来の`border`実装と比較する予定でしたが、必須のブラウザ起動ゲートで停止しました。何を確認でき、何を確認できなかったのかを再現手順とともに残します。

## 検証したこと

同一のGrid/Flexマークアップに対して、次の2方式を比較するfixtureとPlaywrightの検証runnerを隔離ディレクトリに作成しました。

- `border`と`nth-child`を使う従来方式
- `row-rule`と`column-rule`を使うCSS Gap Decorations方式

CSS Gap Decorationsは、公式情報ではGrid、Flex、multi-columnのgapを装飾する機能として説明されています。また、Chrome/Edge 149から利用可能と案内されています。[^chrome-gap]

ただし今回の実行では、比較処理へ進む前に次の必須ゲートを設けました。

1. Chromium系ブラウザのコンテキストを起動できる
2. 起動中のブラウザでmajor version 149以上を確認できる
3. `CSS.supports()`で`row-rule`と`column-rule`の対応を確認できる

結果は1で停止しました。そのため、この記事ではCSSの対応状況や描画結果を実測済みとは扱いません。

## 環境

実行ディレクトリ内で記録できた環境は次のとおりです。

| 項目 | 記録値 |
| --- | --- |
| OS | Darwin / arm64 |
| Node.js | v22.17.1 |
| npm | 10.9.2 |
| Playwright | 1.61.1 |
| system Chromeの実行ファイルが報告したバージョン | 149.0.7827.201 |

リポジトリルートの事前確認ではNode.js v22.17.0、実際にrunnerを解析・実行した`work/`ではv22.17.1が解決されました。また、Chromeのバージョンコマンドが成功したことは、実行ファイルの存在と報告バージョンを示すだけです。ブラウザの起動成功やCSS機能の対応を示す証拠ではありません。

## 今回記録した実行手順

検証用ファイルは次のディレクトリに作成しました。

```text
logs/run-css-gap-decorations-20260711-0622/work/
├── index.html
├── styles.css
└── verify.cjs
```

runnerは構文確認を行ってから、ゲート専用モードで実行しました。以下は今回の実行で記録されたコマンドであり、保存済みの証拠を変更しないよう、このディレクトリでは再実行しないでください。再検証するときは、新しい隔離ディレクトリにfixtureとrunnerを用意し、その実行の出力を別途保存します。

```bash
cd logs/run-css-gap-decorations-20260711-0622/work
node --check verify.cjs
node verify.cjs --gate-only
```

`node --check verify.cjs`は終了コード0でした。ゲートではsystem Chromeを先に試し、失敗後に計画で許可したbundled Chromiumを1回だけ試しました。

再試行回数を増やしたり、別のブラウザをダウンロードしたり、macOSのセキュリティ境界を変更したりはしていません。新しい環境で再検証する場合も、過去の実行結果を上書きせず、新しい隔離ディレクトリへ証拠を保存する必要があります。

## 観測結果

system Chromeではpersistent browser contextを作れず、次のトップレベルエラーが記録されました。

```text
Error: browserType.launchPersistentContext: Target page, context or browser has been closed
```

このメッセージだけでは、system Chrome側の原因を特定できません。

続くbundled Chromiumもbrowser contextを作れませんでした。標準エラーには次の要点が記録され、プロセスは`SIGTRAP`で終了しました。

```text
FATAL:base/apple/mach_port_rendezvous_mac.cc:159]
Check failed: kr == KERN_SUCCESS.
bootstrap_check_in ... Permission denied (1100)
```

この実行については、bundled ChromiumがmacOSのMach service permissionエラーで停止したと解釈できます。一方、system Chromeにも同じ原因があったとは断定できません。

| 確認項目 | 結果 |
| --- | --- |
| `verify.cjs`の構文 | 成功 |
| system Chromeのcontext作成 | 失敗 |
| bundled Chromiumのcontext作成 | 失敗、`SIGTRAP` |
| 起動中ブラウザのmajor version | 未確認 |
| `CSS.supports('row-rule', ...)` | 未実行 |
| `CSS.supports('column-rule', ...)` | 未実行 |
| computed style・要素座標・overflow | 未計測 |
| スクリーンショット | 0枚 |

ページが成立しなかったため、正常に起動したページからの外部URLへのrequestはありませんでした。失敗したブラウザプロセス自体の通信を計測した結果ではありません。

## 失敗と修正

### zshの予約変数を使ってしまった

最初の事前確認用wrapperでは、終了コードの保存先に`status`を使いました。zshでは`status`が読み取り専用のため、wrapper自体が終了コード1になりました。

保存先を`rc`へ変更すると事前確認は終了コード0になりました。これは検証対象のCSSやブラウザの失敗ではなく、shell wrapperのミスです。

### ブラウザ起動失敗には追加の回避策を適用しなかった

リポジトリ内の既知事例を、`MachPortRendezvousServer`、`bootstrap_check_in`、`Permission denied (1100)`、`SIGTRAP`などで検索しましたが、一致する修正記録はありませんでした。

runnerが許可範囲内のfallbackをすでに使い切っていたため、そこで停止しました。起動失敗後に`CSS.supports()`の期待値や公式の対応表を実測結果として代用していない点が重要です。

## 制約と未検証事項

CSS Gap Decorationsの仕様はWorking Draftとして公開され、`row-rule`などを扱っています。[^w3c-spec] また、調査時点のbrowser compatibility dataでは`row-rule`がChrome 149で追加され、FirefoxとSafariは未対応と記録されていました。[^bcd]

これらは外部の一次・公式情報であり、今回のローカル実行結果ではありません。今回の実行からは、次のいずれも判断できません。

- CSS Gap Decorationsが対象Chromeで実際に有効だったか
- Grid/Flexのgapに線が描画されたか
- 装飾の有無でレイアウト寸法が変わらなかったか
- `border`方式よりCSS行数やレスポンシブ補正を減らせたか
- `@supports`によるfallbackが実ブラウザで切り替わったか
- FirefoxやWebKitでどのように動作するか

スクリーンショット、`gate.json`、`results.json`も生成されていません。したがって、CSS Gap Decorationsの使用感を結論づける材料はこの実行にはありません。

## まとめ

今回確認できたのは、検証fixtureとrunnerを作成し、Node.jsの構文確認を通過したところまでです。2つの許可済みブラウザ起動経路はいずれもcontext作成前に失敗しました。

ブラウザの実行ファイルがChrome 149と報告していても、起動中ブラウザでのversion確認や`CSS.supports()`の結果には置き換えられません。CSS機能の検証では、起動、feature detection、computed style、座標、画像という証拠の段階を分け、途中で止まった場合は後続を未検証のまま残す必要があります。

## 参考資料

[^chrome-gap]: [Gap decorations: Now available in Chromium](https://developer.chrome.com/blog/gap-decorations-stable)（2026-07-11参照）
[^w3c-spec]: [CSS Gap Decorations Module Level 1](https://www.w3.org/TR/css-gaps-1/)（2026-07-11参照）
[^bcd]: [MDN browser-compat-data: row-rule](https://chromium.googlesource.com/external/github.com/mdn/browser-compat-data/+/1c8d7073c8173fdc9c716517b7a21dc459afe3f0/css/properties/row-rule.json)（2026-07-11参照）
