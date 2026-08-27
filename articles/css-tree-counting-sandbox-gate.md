---
title: "CSS tree counting検証は3エンジンの起動ゲートで止まった"
emoji: "🚧"
type: tech
topics: [css, playwright, browser, codex]
published: true
---

## 対象読者

この記事は、CSSの`sibling-index()` / `sibling-count()`を採用できるか確かめたい方と、Codexの`workspace-write` sandbox内でPlaywrightの複数エンジン検証を計画している方を対象にします。

先に結論を書くと、今回の環境ではChromium、Firefox、WebKitのすべてがページを開く前に終了しました。したがって、CSS tree countingの対応状況やDOM更新後の挙動は確認できていません。一方で、依存関係とmanaged browserの取得までは成功し、browser起動を必須ゲートにする必要性を具体的なログで確認できました。

## 検証したこと

検証の狙いは、次の3方式を同一fixtureで比較することでした。

1. CSSの`sibling-index()` / `sibling-count()`を直接使う方式
2. HTMLへ固定の`--index` / `--count`を持たせる方式
3. JavaScriptでdirect child elementを走査し、custom propertyを再設定する方式

計画したnative CSSは次の形です。

```css
.native > .item {
  z-index: sibling-index();
  width: calc(500px / sibling-count());
  animation-delay: calc((sibling-index() - 1) * 100ms);
}
```

外部情報として、MDNは`sibling-index()`を1始まりの兄弟位置、`sibling-count()`を自身を含む直接の兄弟要素数を返す関数として説明しています。また、調査時点のMDNでは2026年8月からBaseline Newly availableとされていました（[MDN: sibling-index()](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/sibling-index)、[MDN: sibling-count()](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/sibling-count)、2026-08-26参照）。Firefox 154のリリースノートにも両関数の追加が記載されています（[Firefox 154 developer release notes](https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/154)、2026-08-26参照）。

ただし、これらは期待値を組み立てるための外部情報です。今回の実測結果ではありません。

## 実行環境

実行ログに記録された環境は次のとおりです。

| 項目 | 値 |
|---|---|
| 実行日 | 2026-08-26 |
| OS | Darwin 25.5.0 arm64 |
| Codex sandbox | `workspace-write` |
| Node.js | v22.17.0 |
| npm | 10.9.2 |
| Playwright | 1.62.1（exact pin） |
| 初期空き容量 | 61,335,320 KiB |

生成物、npm cache、Playwrightのbrowser bundle、temporary directory、XDG関連pathは、すべて`logs/run-css-tree-counting-20260826-085849/work/`以下へ向けました。`HOME`と`CODEX_HOME`は変更していません。また、継承した`ASTRO_TELEMETRY_DISABLED=1`を最初と終了時に確認しました。

## 記録した実行手順（抜粋）

以下は、今回の実行ログから主要commandを抜粋したもので、単独で完結する再現手順ではありません。実際のrunでは、新規の隔離directoryと必要なsubdirectoryを作成してそこへ移動し、exact pinした`package.json`、fixture、検証programを配置してから実行しました。完全な実行順序は`logs/run-css-tree-counting-20260826-085849/execution-log.md`、使用したsourceは同runの`work/package.json`、`work/fixture/index.html`、`work/tools/{probe,verify,compare}.mjs`に記録され、execution logには各fileのSHA-256もあります。保存済みrun directoryの再利用を勧めるものではありません。

次の環境変数設定では、`<WORK>`はそのrun専用に新規作成した隔離directoryを表します。

```bash
test "${ASTRO_TELEMETRY_DISABLED:-}" = "1"

export NO_COLOR=1
export CI=1
export npm_config_update_notifier=false
export npm_config_fund=false
export npm_config_audit=false
export npm_config_ignore_scripts=true
export npm_config_cache="<WORK>/.cache/npm"
export PLAYWRIGHT_BROWSERS_PATH="<WORK>/.cache/ms-playwright"
export TMPDIR="<WORK>/.tmp"
export XDG_CACHE_HOME="<WORK>/.cache/xdg"
export XDG_CONFIG_HOME="<WORK>/.config"
export XDG_DATA_HOME="<WORK>/.local/share"
```

隔離directoryの`package.json`では、`playwright`を`1.62.1`へ固定しました。そのうえで、次の順序でlockfile、dependency、managed browserを取得しました。

```bash
npm install --package-lock-only
npm ci
npx --no-install playwright --version
npx --no-install playwright --help
npx --no-install playwright install --help
npx --no-install playwright install chromium firefox webkit
```

取得後、fixtureと検証programの構文を確認し、3エンジンを順に起動するsemantic gateを実行しました。

```bash
node --check tools/probe.mjs
node --check tools/verify.mjs
node --check tools/compare.mjs
node tools/probe.mjs
```

`probe.mjs`は、各エンジンの起動後に`CSS.supports()`と5要素のcomputed valueを確認する設計でした。3エンジンのうち1つでも起動またはcontrolに失敗したら、main experimentへ進まない停止規則にしています。

## 観測結果

runtime、network、diskの事前ゲートは通過しました。`playwright@1.62.1`のinstallも成功し、local CLIは`Version 1.62.1`を返しました。Playwrightが取得時に表示したbundle labelは次のとおりです。

| エンジン | 取得時のlabel |
|---|---|
| Chromium | Chrome for Testing 151.0.7922.34 / revision 1234 |
| Firefox | Firefox 153.0 / revision 1538 |
| WebKit | WebKit 26.5 / revision 2336 |

これらはinstall時の表示であり、`browser.version()`の実測値ではありません。browserが起動しなかったためです。さらにFirefoxのbundle labelは、計画で必須にしたmajor 154以上という条件を満たしていませんでした。

semantic gateのexit codeは`1`でした。エンジン別の観測は次のとおりです。

| エンジン | 観測した失敗 |
|---|---|
| Chromium | PID 213で起動後に`SIGTRAP`。Mach port rendezvous serverの`bootstrap_check_in`が`Permission denied (1100)` |
| Firefox | headless processがPID 270で起動後、usableなbrowser process/contextの確立前に`SIGABRT` |
| WebKit | wrapperがPID 293で起動し、childがusable contextの確立前にexit 134（`Abort trap: 6`） |

3エンジンともusableなpage/contextへ到達しませんでした。そのため、次の値や成果物は存在しません。

- browserが返すversionとuser agent
- `CSS.supports()`の結果
- computed `z-index`、`width`、`animation-delay`
- DOM append、prepend、remove後の比較結果
- 2回のmain runとdeep equality比較
- screenshot

この結果から言えるのは、「Darwin 25.5.0 arm64上の今回のCodex `workspace-write` sandboxでは、指定したPlaywright browserがpage作成前に終了した」という範囲までです。CSS機能の対応・非対応は判定できません。失敗パターンはsandboxがmacOS browser processに必要な能力を制限した状況と整合しますが、これはログからの解釈であり、製品仕様として確認した事実ではありません。

## 失敗と修正

### command recorderのprocess substitutionが拒否された

最初の`node --version`記録では、Bashのprocess substitutionを使った`tee`が次のエラーになりました。

```text
tools/run-recorded.sh: line 10: /dev/fd/62: Operation not permitted
```

実験command自体を変えず、stdoutとstderrを直接それぞれのevidence fileへ書き、その後`sed`で表示する方式へrecorderだけを変更しました。これによりcommand、開始・終了時刻、分離した出力、exit statusを引き続き保存できました。最初の失敗記録も`work/evidence/gate/failures/runner-process-substitution/`へ残しています。

### browser launchは迂回しなかった

browser起動失敗後は再試行していません。計画ではdownload失敗のみ同じcommandを1回再試行でき、launch失敗時には停止すると決めていたためです。system browser、別のPlaywright version、browser channel、Dockerへの切り替えも行いませんでした。

この停止規則により、取得できたbundleの存在だけからCSS対応を推測したり、1エンジンだけの記事へscopeを変更したりすることを避けました。

## 制約

今回の記録には次の制約があります。

1. browserがpageへ到達していないため、CSS tree countingの挙動は未検証です。
2. Firefoxはinstall labelだけを観測しており、runtime versionは取得できていません。
3. main experimentを実行していないため、static custom propertyとJavaScript fallbackの比較結果もありません。
4. sandboxが`ps`を`operation not permitted`で拒否したため、終了後のprocess tableを独立に確認できませんでした。各Playwright logにはprocess exitとtemporary-directory cleanup完了が記録されています。
5. WebKitの結果をSafariの実測として扱うことはできません。

なお、CSS仕様にはtree counting functionsの定義があります（[CSS Values and Units Level 5: Tree Counting Functions](https://drafts.csswg.org/css-values-5/#tree-counting)）。仕様やMDNの記述は再検証時の期待値には使えますが、今回欠けたbrowser実測の代わりにはなりません。

## まとめ

Playwright packageと3つのmanaged browser bundleをworkspace内へ取得できても、headless browserが実際にpage/contextを作れるとは限りません。browser機能の比較では、install成功と`CSS.supports()`の間に「対象binaryを起動し、既知のcomputed valueを確認するsemantic gate」を置く必要があります。

今回はそのゲートで正しく停止したため、`sibling-index()` / `sibling-count()`の採用判断には到達できませんでした。次に検証する場合も、Firefox 154以上を含む対象browser versionと起動能力を最初に確認し、3エンジンすべてのcontrolが通ったときだけDOM mutationやfallback比較へ進むのが安全です。

## 参考資料

- [MDN: sibling-index()](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/sibling-index)
- [MDN: sibling-count()](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/sibling-count)
- [Firefox 154 developer release notes](https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/154)
- [CSS Values and Units Level 5: Tree Counting Functions](https://drafts.csswg.org/css-values-5/#tree-counting)
- [Playwright: Browsers](https://playwright.dev/docs/browsers)
