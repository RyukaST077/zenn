---
title: "Chrome 150のfocusgroup検証がproperty gateで止まった記録"
emoji: "⌨️"
type: tech
topics: [html, chrome, accessibility, playwright]
published: true
---

## 対象読者

- Chrome 150の`focusgroup`を実ブラウザで試したい方
- 新しいブラウザ機能を、未対応時に結果を推測せず検証したい方
- roving `tabindex`との比較を計画している方

この記事は`focusgroup`のキーボード操作を確認できた成功例ではありません。Chrome for Testing Stable 150を起動してlocalhostへ移動できたものの、必須のproperty-based capability gateが`false`になり、そこで検証を停止した記録です。

## 検証したこと

`focusgroup`は、複合ウィジェット内の矢印キー移動、単一のTab stop、最後にフォーカスした項目の記憶を宣言的に扱う機能としてChrome 150の公式記事で紹介されています。[^chrome150]

そこで、同じtoolbarを次の2方式で比較する計画を立てました。

1. JavaScriptで実装するroving `tabindex`
2. `focusgroup="toolbar wrap"`を使う宣言的なfocus navigation

比較予定だったのは、Tabによる出入り、矢印キー、Home/End、wrap、再入場時のmemory、RTL、disabled/hidden item、focusとselectionの責務、fallback、accessibility treeです。複合ウィジェットをTab sequence上では1つとして扱い、内部をTab以外のキーで移動する考え方はW3C APGにも示されています。[^apg]

ただし、これらの操作へ進む前に次の3条件を必須ゲートにしました。

1. 実ブラウザを起動できる
2. ブラウザのmajor versionが150以上である
3. localhostで`'focusgroup' in HTMLElement.prototype`が`true`になる

今回通過したのは最初の2条件までです。したがって、この記事では`focusgroup`のキー操作やアクセシビリティ上の挙動を実測済みとして扱いません。

## 環境

実行時に記録した環境は次のとおりです。

| 項目 | 記録値 |
| --- | --- |
| OS | macOS 26.5（Build 25F71）、Darwin 25.5.0、arm64 |
| Node.js | v22.17.0 |
| npm | 10.9.2 |
| `playwright-core` | 1.61.1 |
| Chrome for Testing | Stable 150.0.7871.115、mac-arm64 |
| 実行方式 | headless |
| 配信先 | `127.0.0.1`のephemeral port |

Chrome for Testingは公式Stable manifestから実行ディレクトリ内へ取得しました。manifestは更新されるため、再実行時には同じバージョンが選ばれるとは限りません。Chrome for Testingの配布JSONは公式のavailability manifestで確認できます。[^cft]

## 再現に使った手順の抜粋

以下は実行した手順のうち、依存取得、Stable manifestの選択、capability gateに関する抜粋です。単独で実行できる完全な手順ではありません。実際にはリポジトリ直下から新しいrun-local `work/`ディレクトリを作成し、そこへ`playwright-core` 1.61.1を固定した`package.json`、fixture、server、gateを用意しました。archiveの取得と展開、実行ファイルの設定、localhost serverの起動、環境変数の設定を含む実行順序は、保存した`logs/run-focusgroup-chrome150-20260713-103650/execution-log.md`の「Chronological commands」を参照してください。

今回の生成物のうち、主なファイルは次の隔離ディレクトリへ保存しました。これは完全な一覧ではありません。

```text
logs/run-focusgroup-chrome150-20260713-103650/
├── execution-log.md
└── work/
    ├── browser/
    ├── downloads/
    ├── evidence/
    ├── fixture/
    ├── gate.mjs
    ├── run.mjs
    ├── server.mjs
    └── ...
```

依存は`playwright-core`だけを固定し、install scriptを無効にして取得しました。

```bash
npm install --ignore-scripts --no-audit --no-fund
```

続いて、公式Stable manifestを取得し、major versionが150以上のmac-arm64版のversionとURLを選びました。

```bash
curl --fail --location --silent --show-error \
  https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json \
  --output downloads/cft.json

jq -er '
  .channels.Stable as $s
  | select(($s.version | split(".")[0] | tonumber) >= 150)
  | [$s.version, ($s.downloads.chrome[] | select(.platform == "mac-arm64") | .url)]
  | @tsv
' downloads/cft.json > evidence/cft-stable.tsv
```

localhost serverを起動した後、Playwrightから取得した実行ファイルを指定してゲートを実行しました。

```bash
node gate.mjs \
  --executable "$CFT_EXECUTABLE" \
  --url "$BASE_URL" \
  > evidence/gate-stdout.txt \
  2> evidence/gate-stderr.txt

jq -e '
  (.launch == "ok") and
  (.browserMajor >= 150) and
  (.focusgroupPropertySupport == true)
' evidence/capability.json > /dev/null
```

属性をHTMLへ書けることと、その機能をブラウザが実装していることは同じではありません。そのため、`hasAttribute("focusgroup")`ではなく、計画で定めたpropertyの存在を判定しました。`focusgroup`のfeature detectionに対応propertyを使う考え方は、実装例でも説明されています。[^feature-detection]

## 観測結果

`gate.mjs`が保存した結果は次のとおりです。

```json
{
  "launch": "ok",
  "browserVersion": "150.0.7871.115",
  "browserMajor": 150,
  "focusgroupPropertySupport": false,
  "navigation": "ok"
}
```

ブラウザ起動、browser contextとpageの作成、localhostへのnavigationは成功しました。一方、読み込んだページ上で次の式は`false`でした。

```js
'focusgroup' in HTMLElement.prototype
```

結果を工程別に分けると次のようになります。

| 確認項目 | 結果 |
| --- | --- |
| Chrome for Testingの起動 | 成功 |
| browser major 150以上 | 成功（150） |
| localhostへのnavigation | 成功 |
| `focusgroup` propertyの存在 | 失敗（`false`） |
| JavaScript版とのキー操作比較 | 未実行 |
| memory、RTL、disabled/hiddenの比較 | 未実行 |
| focusとselectionの責務比較 | 未実行 |
| fallback branch | 未実行 |
| accessibility tree | 未実行 |
| スクリーンショット | 未作成 |

`gate.mjs`自体の終了コードは0でした。これは`false`という観測値を正常にJSONへ保存できたためです。その直後、3条件を契約として検査した`jq -e`が終了コード1となり、後続処理を停止しました。

この区別により、「計測プログラムが壊れた」のではなく、「計測は成功したが必須条件を満たさなかった」と判断できます。

## 失敗と修正

### property gateが`false`になった

実行時の公式Stable artifactはChrome for Testing 150.0.7871.115でしたが、対象ページでは`focusgroup` propertyを確認できませんでした。

この不一致の原因は調査していません。実行計画ではproperty gateが`false`なら即停止すると定めていたためです。公式記事の説明をローカルの実測値へ読み替えたり、HTML上に属性が残ることを対応証拠にしたりはしていません。

### 回避策は適用しなかった

実行中に既知のブラウザ起動問題を検索しましたが、該当した記録は制限されたsandboxでのbrowser context起動失敗に関するものでした。今回は実ブラウザの起動、context作成、navigationがすべて成功しており、観測された`false`を変更できる修正ではありませんでした。

そのため、別channel、feature flag、system Chrome、cached Chromiumには切り替えていません。これらを試した結果をChrome 150 Stableの通常状態として混ぜないためです。

## 制約

今回の実行から判断できるのは、macOS arm64上のChrome for Testing Stable 150.0.7871.115で、指定したproperty-based gateが満たされなかったことだけです。

次の点はすべて未検証です。

- `focusgroup`によるArrowLeft/ArrowRight、Home/End、wrapの挙動
- single Tab stopとlast-focused memory
- `nomemory`、`focusgroupstart`、`focusgroup="none"`
- RTL、disabled/hidden item、動的な追加と削除
- JavaScript版から削除できるfocus-navigation code
- tablistにおけるfocusと`aria-selected`更新の分担
- 非対応時のJavaScript fallback
- accessibility tree上のrole、name、focused、selected
- Chrome for Testing以外のChromeや他ブラウザでの結果

Open UIのexplainerではfocus navigationとselectionを別の責務として扱っていますが、これは外部資料に記載された設計であり、今回のローカル実行で確認した結果ではありません。[^open-ui]

また、スクリーンショットがないのは取得失敗ではありません。必須ゲートより後の操作を実行しなかったため、0枚のままです。

## まとめ

Chrome for Testing Stable 150.0.7871.115はPlaywrightから正常に起動し、localhost fixtureも読み込めました。しかし、`'focusgroup' in HTMLElement.prototype`は`false`で、必須ゲートを通過できませんでした。

この実行では、Chrome 150というversion番号や公式の機能紹介だけを根拠に、キー操作やアクセシビリティの結果を補っていません。ブラウザ機能の検証では、browser launch、version、property support、実際の操作という証拠を段階に分け、前段が失敗したら後段を`not-run`のまま残すことが重要です。

次に再検証する場合も、新しい隔離ディレクトリで公式Stable artifactとproperty gateの結果を保存し、3条件がすべて通ったときだけキーボード操作とaccessibility treeの取得へ進みます。

## 参考資料

[^chrome150]: [New in Chrome 150](https://developer.chrome.com/blog/new-in-chrome-150)（2026-07-13参照）
[^apg]: [W3C ARIA Authoring Practices Guide: Developing a Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)（2026-07-13参照）
[^cft]: [Chrome for Testing availability manifest](https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json)（2026-07-13参照）
[^feature-detection]: [Testing browser support for focusgroup](https://adactio.com/journal/22445)（2026-07-13参照）
[^open-ui]: [Open UI: focusgroup Explainer](https://open-ui.org/components/focusgroup.explainer/)（2026-07-13参照）
