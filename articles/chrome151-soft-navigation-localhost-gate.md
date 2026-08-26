---
title: "Chrome 151 Soft Navigation検証がlocalhost gateで止まった記録"
emoji: "🧭"
type: tech
topics: [chrome, javascript, playwright, performance]
published: true
---

## 対象読者

- SPAのルート遷移をPerformance Timelineで計測したい方
- 新しいブラウザAPIをPlaywrightで検証するとき、どこにcapability gateを置くか知りたい方
- ブラウザ起動後のlocalhost接続失敗と、API未対応を混同したくない方

この記事はChrome 151のSoft Navigation APIを観測できた成功例ではありません。実ブラウザを使った検証を開始したものの、localhost fixtureへのnavigationで`ERR_CONNECTION_REFUSED`となり、必須ゲートで停止した記録です。

結論を先に書くと、この実行から`soft-navigation`や`interaction-contentful-paint`の対応状況、発火条件、entryの形は判断できません。一方で、ブラウザのversion情報だけをAPI対応の証拠にせず、失敗した工程より後を「未検証」のまま残すための手順は確認できました。

## 検証したこと

Chrome 151の公式リリースノートでは、SPAのsame-document navigationをPerformance Timelineで扱うための`soft-navigation`と、interaction後のcontentful paintを扱う`interaction-contentful-paint`が追加項目として紹介されています。[^chrome151-release] 公式の計測ガイドではfeature detectionを行い、Soft NavigationとICPの対応付けには`interactionId`を使う方法が案内されています。[^soft-navigation-guide]

そこで、フレームワークを使わないlocalhost上のSPAに次の4ケースを用意し、Playwrightからsystem Chromeを操作する計画にしました。

| ケース | interaction | URL / History変更 | contentfulなDOM更新 |
| --- | --- | --- | --- |
| A | trusted click | あり | あり |
| B | trusted click | あり | なし |
| C | trusted click | なし | あり |
| D | synthetic click | あり | あり |

WICGのdraftでは、user interaction、URL/historyの更新、contentfulなDOM更新をSoft Navigationの検出モデルに含めています。[^wicg-soft-navigation] ただし、これは対照ケースを設計した根拠であり、今回4ケースを実測できたという意味ではありません。

本試行では、ケース実行前に次のcapability gateを置きました。

1. system Chromeをheadlessで起動する
2. BrowserContextを1件作る
3. localhost fixtureへnavigateする
4. 実ブラウザ上で`PerformanceObserver.supportedEntryTypes`を確認する
5. `soft-navigation`と`interaction-contentful-paint`が両方ある場合だけ、12試行へ進む

実際には3で停止したため、4以降は実行していません。

## 環境

実行時に保存した値は次のとおりです。

| 項目 | 記録値 |
| --- | --- |
| 実行日時 | 2026-08-25 09:40:27〜09:44:14 JST |
| OS | macOS 26.5（25F71）、Darwin 25.5.0、arm64 |
| Node.js | v22.17.1 |
| npm | 10.9.2 |
| Playwright | 1.61.1 |
| system Chromeのplist値 | 151.0.7922.174 |
| sandbox mode | `danger-full-access` |
| server | `127.0.0.1`のOS割当port |

Playwrightはrun専用の`work/`へ固定versionで導入し、browser downloadを無効にしました。Chromeの値は`Info.plist`から読んだものであり、`browser.version()`の実測値ではありません。fixtureのnavigationが完了しなかったため、UA、UA-CH、page側のAPI supportも取得できていません。

`danger-full-access`だったため、実ブラウザの起動自体は許可されていました。ただし、権限があることはブラウザやlocalhost serverが正常に動く証拠にはならないため、実行結果で判定しました。

## 再現可能な手順

検証用ファイルと証拠は次のrun directoryに隔離しました。

```text
logs/run-chrome151-soft-navigation-20260825-094027/
├── execution-log.md
└── work/
    ├── fixture/
    │   ├── index.html
    │   ├── app.js
    │   └── server.mjs
    ├── harness/
    │   ├── gate.mjs
    │   ├── experiment.mjs
    │   └── check.mjs
    └── evidence/
        ├── environment/
        ├── gate/
        ├── cases/
        ├── console/
        ├── screenshots/
        └── server/
```

最初にPlaywrightをrun directoryだけへ導入し、5ファイルの構文を確認しました。

```bash
cd logs/run-chrome151-soft-navigation-20260825-094027/work

npm init -y

env PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
  npm install --save-dev --save-exact --ignore-scripts playwright@1.61.1

node --check fixture/server.mjs
node --check fixture/app.js
node --check harness/gate.mjs
node --check harness/experiment.mjs
node --check harness/check.mjs
```

次に、Node.js serverを`127.0.0.1`のport `0`で起動しました。serverが保存したJSONから、そのrunで割り当てられたURLを読みます。

```bash
env SERVER_INFO_PATH="$PWD/evidence/server/server-info.json" \
  node fixture/server.mjs \
  > evidence/server/stdout.log \
  2> evidence/server/stderr.log &

SERVER_PID=$!
printf '%s\n' "$SERVER_PID" > evidence/server/pid.txt

for WAIT_INDEX in 1 2 3 4 5 6 7 8 9 10; do
  test -s evidence/server/server-info.json && break
  sleep 0.5
done

test -s evidence/server/server-info.json
test "$(/usr/bin/jq -r '.pid' evidence/server/server-info.json)" = "$SERVER_PID"
BASE_URL="$(/usr/bin/jq -r '.baseUrl' evidence/server/server-info.json)"
```

最後に、system Chromeの絶対pathと生成したlocalhost URLを明示し、30秒の上限付きでgateを実行しました。

```bash
CHROME_BIN='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

env CHROME_BIN="$CHROME_BIN" BASE_URL="$BASE_URL" \
  /opt/homebrew/bin/timeout 30s node harness/gate.mjs \
  > evidence/gate/stdout.json \
  2> evidence/gate/stderr.log
```

このrunは保存済みの一次証拠です。同じdirectoryで再実行して上書きするのではなく、再検証時は新しいrun directoryを作り、別の実行として記録する必要があります。

## 観測結果

静的検査、Playwrightの導入、Chrome executableの存在確認、server metadataの作成までは成功しました。serverはPID `7899`と`http://127.0.0.1:62639/`を記録しました。

gateは`chromium.launch()`、`browser.newContext()`の次にある`page.goto()`へ到達しましたが、そこで次のエラーになりました。

```text
page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:62639/
Call log:
  - navigating to "http://127.0.0.1:62639/", waiting until "load"
```

gateの終了コードは1でした。cleanup時には記録済みPIDのserver processが存在せず、serverのstdoutとstderrも空でした。

| 確認項目 | 結果 |
| --- | --- |
| fixture / harnessの構文 | 5ファイルとも成功 |
| Playwright 1.61.1の隔離install | 成功 |
| Chrome executableの確認 | 成功 |
| server metadataの作成 | 成功 |
| Chrome launch / contextの処理 | navigationまで到達 |
| localhost fixtureへのnavigation | `ERR_CONNECTION_REFUSED` |
| 実ブラウザのversion / UA | 未取得 |
| 2つのentry typeのsupport | 未検証 |
| A〜D、合計12試行 | 未実行 |
| entry、ID、timing | 未取得 |
| スクリーンショット | 0枚 |

「navigationまで到達した」という制御フローから、Chrome launchとcontext作成はそれ以前に完了したと解釈できます。一方、server processがmetadata作成後のどの時点で、なぜ終了したかは、この証拠だけでは特定できません。

## 失敗と修正

### localhost serverがnavigation時には応答しなかった

直接観測できた失敗は、生成済みURLへの`page.goto()`が`ERR_CONNECTION_REFUSED`になったことです。server metadataは作成されていましたが、cleanup時にはそのPIDが存在しませんでした。

この2点だけから、server実装の不具合、process crash、起動方法、実行環境のいずれが原因だったかを断定することはできません。stderrが空だったことも、特定の原因を支持する十分な証拠にはなりません。

### retryやfallbackは適用しなかった

実行中に既知事例を検索しましたが、近かったのは`workspace-write`環境でbrowser context作成に失敗した記録でした。今回は`danger-full-access`で、context作成より後のlocalhost navigationで失敗しているため、適用できる修正ではありませんでした。

計画ではfixture navigationの失敗を停止条件としていました。そのため、serverの再起動、別port、別browser、別channel、feature flag、bundled Chromiumへの切り替えは行っていません。これは原因を直せたという意味ではなく、異なる条件の結果を同じ実験へ混ぜないための停止です。

## 制約と未検証事項

今回の実行から安全に言えるのは、特定のmacOS環境とrunで、Playwrightからの処理がlocalhost navigationへ到達したものの、接続を拒否されたことまでです。

次の内容はすべて未検証です。

- Chrome 151がこの環境で`soft-navigation`を公開していたか
- `interaction-contentful-paint`を公開していたか
- `PerformanceSoftNavigation`と`InteractionContentfulPaint`のconstructorが見えたか
- trusted click、URL/history変更、DOM更新のどの組み合わせでentryが出たか
- `navigationId`と`interactionId`がどのような値になったか
- ICPとinteractionを`interactionId`で対応付けられたか
- timing値や試行間の再現性
- Chrome以外のブラウザでの対応や挙動

公式資料がAPIを説明していることは、今回のpage上でsupportを観測した証拠の代わりにはなりません。また、entryが0件だったのではなく、entryを観測するpage自体を読み込めていません。「未発火」や「未対応」と表現しない点が重要です。

## まとめ

このrunでは、Chrome 151のSoft Navigation APIに関する中心仮説を検証できませんでした。capability gateはlocalhost fixtureへのnavigationで停止し、対象entry typeのfeature detectionも4ケースの比較も未実行です。

一方、失敗位置を工程ごとに分けたことで、Chrome executableの存在、Playwrightの導入、browser処理がnavigationへ到達したこと、page側API supportの未検証を区別できました。新しいブラウザ機能を検証するときは、`launch → context → navigation → feature detection → behavior`の順に証拠を残し、前段が失敗したら後段の結果を公式情報から補わないことが大切です。

次の検証は、server lifecycleの原因を別の新規runで切り分け、localhost navigationが通った場合に限って、同じfeature detectionと固定12試行へ進む必要があります。

## 参考資料

[^chrome151-release]: [Chrome 151 release notes](https://developer.chrome.com/release-notes/151)（2026-08-25参照）
[^soft-navigation-guide]: [Measuring soft navigations](https://developer.chrome.com/docs/web-platform/soft-navigations)（2026-08-25参照）
[^wicg-soft-navigation]: [Soft Navigations and Interaction Contentful Paint](https://wicg.github.io/soft-navigations/)（2026-08-25参照）
