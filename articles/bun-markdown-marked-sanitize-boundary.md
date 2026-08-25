---
title: "Bun 1.4のBun.markdownとmarkedを危険入力で比較した"
emoji: "🧪"
type: "tech"
topics: ["bun", "markdown", "javascript", "security", "playwright"]
published: true
---

<!-- 出典ログ: logs/run-bun-markdown-marked-20260824-1934/execution-log.md -->

## 対象読者

- Bun 1.4 の `Bun.markdown` で `marked` を置き換えられるか検討している人
- ユーザー入力の Markdown を HTML として表示したい人
- parser の比較と sanitizer の検証を分けて考えたい人

先に結論を書くと、今回の固定した7入力では、BunとMarkedのraw HTMLは5入力で異なりました。一方、危険なイベント属性については、どちらもraw出力に残し、同じallowlist型sanitizerを通すと両方から消えました。

ただし、用意した`javascript:` URLの入力は、両parserでリンクにならず、Markdownらしき文字列のまま出力されました。このため「rawでは危険なリンクが残り、sanitize後に消える」という仮説は再現できていません。本記事は成功例ではなく、この失敗を含めて、どこまで確認できたかを整理します。

## 何を検証したか

同じ7個のMarkdown fixtureを次の4経路へ流しました。

1. `Bun.markdown.html()`のraw出力
2. `marked.parse()`のraw出力
3. Bunのraw出力を`sanitize-html`へ渡した結果
4. Markedのraw出力を同じ`sanitize-html`設定へ渡した結果

fixtureの論点は、基本Markdown、GFM、重複heading、無害なraw HTML、`onerror`を持つ画像、`javascript:` URLを意図したリンク、閉じ忘れを含む不正形Markdownです。7入力×4経路で28個のHTMLを生成し、CLI assertionと差分を記録しました。

Bun公式は`Bun.markdown`のHTML出力をsanitizeしないと説明しています。Marked公式READMEにも、出力HTMLをsanitizeしないため、DOMPurifyなどを使うよう警告があります。つまり、今回の比較で「片方を選べばsanitize不要」とは想定していません（[Bun 1.4リリース](https://bun.com/blog/bun-v1.4)、[Marked README](https://github.com/markedjs/marked#usage)）。

## 検証環境

| 項目 | 固定した値 |
| --- | --- |
| OS | Darwin 25.5.0 arm64 |
| Node.js | v22.17.0 |
| npm | 10.9.2 |
| Bun | 1.4.0 |
| marked | 18.0.10 |
| sanitize-html | 2.17.7 |
| Playwright | 1.62.1 |
| Chromium | 151.0.7922.34 |

Bunは公式release archiveを隔離ディレクトリへ展開し、`Bun.version === "1.4.0"`と`typeof Bun.markdown?.html === "function"`を実行前のgateにしました。使用したarchiveのSHA-256は次です。

```text
c669e97f6164e1c96e0701748db98dfa77492908cbd8394c7557134a735de381
```

`Bun.markdown`は公式docsでUnstable APIとされています。そのため、別versionでも同じ出力になるとは扱わず、versionとAPIの両方を止める条件にしています（[Bun Markdown docs](https://bun.com/docs/runtime/markdown)）。

## 再現手順

この節では、実行したファイルと記事向けの説明を区別します。実行済みの完全版は、この記事と同じrepositoryにある`logs/run-bun-markdown-marked-20260824-1934/work/`配下の`fixtures/`と`scripts/`です。再実行ではそこを固定sourceとして新しい隔離ディレクトリへcopyします。以下のJavaScriptは、その実ファイルからの抜粋です。記事用に別の入力APIへ書き換えた例ではありません。

### 1. 隔離ディレクトリでversionと依存を固定する

今回のrunではnpm cache、Bun binary、Playwright browserをすべてrun専用ディレクトリへ置きました。Bun archiveの記録済みSHA-256は`c669e97f6164e1c96e0701748db98dfa77492908cbd8394c7557134a735de381`です。実runではhashをファイルへ記録してから展開しました。再取得時は、記録値との`test`も加えて一致しなければ停止できます。

```bash
SOURCE_WORK_DIR="$PWD/logs/run-bun-markdown-marked-20260824-1934/work"
RUN_DIR="$PWD/logs/repro-bun-markdown-marked"
WORK_DIR="$RUN_DIR/work"
test -d "$SOURCE_WORK_DIR/fixtures"
test -d "$SOURCE_WORK_DIR/scripts"
test ! -e "$RUN_DIR"
mkdir -p "$WORK_DIR/evidence" "$WORK_DIR/fixtures" \
  "$WORK_DIR/scripts" "$WORK_DIR/outputs" "$WORK_DIR/toolchain"
cp "$SOURCE_WORK_DIR"/fixtures/*.md "$WORK_DIR/fixtures/"
cp "$SOURCE_WORK_DIR"/scripts/*.mjs "$WORK_DIR/scripts/"
cd "$WORK_DIR"

curl -fL --retry 3 \
  https://github.com/oven-sh/bun/releases/download/bun-v1.4.0/bun-darwin-aarch64.zip \
  -o toolchain/bun-darwin-aarch64.zip \
  > evidence/bun-download.log 2>&1
shasum -a 256 toolchain/bun-darwin-aarch64.zip \
  > evidence/bun-archive-sha256.txt
test "$(cut -d ' ' -f 1 evidence/bun-archive-sha256.txt)" = \
  "c669e97f6164e1c96e0701748db98dfa77492908cbd8394c7557134a735de381"
unzip -q toolchain/bun-darwin-aarch64.zip -d toolchain
BUN_BIN="$WORK_DIR/toolchain/bun-darwin-aarch64/bun"
test -x "$BUN_BIN"
test "$("$BUN_BIN" --version)" = "1.4.0"
"$BUN_BIN" -e 'if (typeof Bun.markdown?.html !== "function") { console.error("Bun.markdown.html unavailable"); process.exit(42); } console.log("Bun.markdown.html=available")'

export npm_config_cache="$WORK_DIR/.npm-cache"
npm init -y
npm install --save-exact marked@18.0.10 sanitize-html@2.17.7 playwright@1.62.1
npm ls --depth=0 --json > evidence/npm-ls.json
npm pkg set type=module private=true
```

generator内にも、実際には次の二重gateを置きました。エラー文を含め、`work/scripts/generate.mjs`の実行版と同じです。

```js
if (Bun.version !== "1.4.0" || typeof Bun.markdown?.html !== "function") {
  throw new Error(`required Bun 1.4.0 markdown API unavailable (actual ${Bun.version})`);
}
```

### 2. 7 fixtureのbytesを固定する

結果を左右した入力は次の7ファイルです。特に`javascript-url.md`では、`void`と`0`の間の空白も入力の一部です。ここを修正した再実験はしていません。

`fixtures/basic.md`:

````markdown
# Basic heading

A paragraph with **strong text**, `inline code`, and a [safe link](https://example.test/safe).

```js
const answer = 42;
```
````

`fixtures/gfm.md`:

```markdown
| name | value |
| --- | ---: |
| alpha | 1 |

- [x] checked item
- [ ] unchecked item

~~removed~~

Visit www.example.test for details.
```

`fixtures/headings.md`:

```markdown
# 日本語 見出し

## Repeated heading

## Repeated heading
```

`fixtures/raw-html.md`:

```html
<details><summary>More</summary><span data-x="kept">Harmless raw HTML</span></details>
```

`fixtures/event-handler.md`:

```html
<img src="/__missing__.png" alt="probe" onerror="document.body.dataset.onerror='fired'">
```

`fixtures/javascript-url.md`:

```markdown
[run marker](javascript:document.body.dataset.jsurl='fired';void 0)
```

`fixtures/malformed.md`:

```markdown
<details><summary>Unclosed summary

This has an **emphasis boundary* and trailing text.
```

run終了時には、fixturesとscriptsのSHA-256を`work/evidence/input-sha256.txt`へ保存しました。同じrunを追う場合は、記事から手入力するより、このmanifestと`work/fixtures/*.md`のbytesを照合する方が確実です。

### 3. 実行版のparser設定とsanitizer policyを使う

暗黙のdefault同士ではなく、Bun側はGFM関連機能とheading ID、raw HTMLの扱いを明示しました。次は`work/scripts/generate.mjs`の実行版にある設定です。

```js
const fixtures = ["basic", "gfm", "headings", "raw-html", "event-handler", "javascript-url", "malformed"];
const bunOptions = {
  tables: true,
  strikethrough: true,
  tasklists: true,
  autolinks: true,
  headings: { ids: true },
  tagFilter: false,
};
const markedOptions = { gfm: true };
const sanitizerPolicy = {
  allowedTags: [
    "h1", "h2", "h3", "h4", "h5", "h6", "p", "strong", "em",
    "code", "pre", "a", "img", "del", "ul", "ol", "li", "table",
    "thead", "tbody", "tr", "th", "td", "details", "summary", "span",
    "input", "br",
  ],
  allowedAttributes: {
    "*": ["id", "data-x"],
    a: ["href", "title"],
    img: ["src", "alt", "title"],
    input: ["type", "checked", "disabled"],
    th: ["align"],
    td: ["align"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
};
```

入力と4出力を結ぶ部分も、単一fixtureを`process.argv`で受ける例ではなく、実際には次のloopでした。

```js
for (const fixture of fixtures) {
  const source = await readFile(`fixtures/${fixture}.md`, "utf8");
  const bunRaw = Bun.markdown.html(source, bunOptions);
  const markedRaw = await marked.parse(source, markedOptions);
  const bunSanitized = sanitizeHtml(bunRaw, sanitizerPolicy);
  const markedSanitized = sanitizeHtml(markedRaw, sanitizerPolicy);
  const outputDir = `outputs/${fixture}`;
  await mkdir(outputDir, { recursive: true });
  const outputs = { "bun-raw": bunRaw, "marked-raw": markedRaw, "bun-sanitized": bunSanitized, "marked-sanitized": markedSanitized };
  for (const [name, value] of Object.entries(outputs)) {
    await writeFile(path.join(outputDir, `${name}.html`), value);
  }
  // この後、raw差分、heading ID、各出力のSHA-256を記録
}
```

最後のコメントは記事上の省略箇所です。完全版は前述の`work/scripts/generate.mjs`にあり、`node:crypto`によるSHA-256、`diff -u`、`evidence/cli-results.json`の生成まで含みます。このpolicyは今回のfixtureに必要な要素を残すための固定条件であり、一般用途にそのまま推奨できる設定という意味ではありません。

### 4. 生成、CLI assertion、browser gateを順番に実行する

実行済みのfixtureと最終harnessを使う最小入口は次です。`assert-cli.mjs`は成功へ合わせて期待値を変えておらず、最終的にexit 1、60 pass / 6 failとなるのが今回の記録です。

```bash
cd "$WORK_DIR"
"$BUN_BIN" scripts/generate.mjs \
  > evidence/generate.stdout.log 2> evidence/generate.stderr.log

set +e
node scripts/assert-cli.mjs \
  > evidence/assert-cli.stdout.log 2> evidence/assert-cli.stderr.log
CLI_EXIT=$?
set -e
test "$CLI_EXIT" -eq 1

find outputs -type f -print | LC_ALL=C sort > evidence/output-files.txt
shasum -a 256 outputs/*/*.html > evidence/output-sha256.txt
```

PlaywrightのChromiumはrun専用パスへ導入しました。install後、最初に`chromium.launch({ headless: true })`、空page作成、browser version取得、closeだけを行う`browser-gate.mjs`を実行します。今回はgateが通り、Chromium 151.0.7922.34を起動できました（[Playwright Browsers](https://playwright.dev/docs/browsers)）。

```bash
export PLAYWRIGHT_BROWSERS_PATH="$WORK_DIR/.pw-browsers"
npx playwright install chromium > evidence/playwright-install.log 2>&1
npx playwright --version > evidence/playwright-version.txt 2>&1

set +e
node scripts/browser-gate.mjs \
  > evidence/browser-gate.stdout.log 2> evidence/browser-gate.stderr.log
BROWSER_GATE_EXIT=$?
set -e
printf '%s\n' "$BROWSER_GATE_EXIT" > evidence/browser-gate-exit.txt
test "$BROWSER_GATE_EXIT" -eq 0
```

gate成功後だけ、`127.0.0.1`のOS割り当てportでserverを起動し、loopback以外のrequestをabortするbrowser assertionへ進みます。今回の最終harnessはBun raw routeのanchor数0でexit 1になったため、後続3 routeは実行済みとして扱いません。

```bash
node scripts/server.mjs > evidence/server.stdout.log 2> evidence/server.stderr.log &
SERVER_PID=$!
cleanup_server() {
  kill "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
}
trap cleanup_server EXIT INT TERM

for attempt in 1 2 3 4 5; do
  test -s evidence/server.json && break
  sleep 1
done
test -s evidence/server.json

set +e
node scripts/assert-browser.mjs \
  > evidence/assert-browser.stdout.log 2> evidence/assert-browser.stderr.log
BROWSER_EXIT=$?
set -e
test "$BROWSER_EXIT" -eq 1

cleanup_server
trap - EXIT INT TERM
if kill -0 "$SERVER_PID" 2>/dev/null; then
  echo "server process still alive" >&2
  exit 43
fi
```

capability gateが失敗した場合はserverやbrowser assertionを実行せず、DOM、marker、browser versionを推測しません。また、CLI assertionが失敗したため、計画上その成功後にだけ行う2回目の生成とSHA-256比較も実施していません。

## 観測結果

### raw HTMLは7入力中5入力で異なった

BunとMarkedのraw出力がbyte単位で一致したのは`raw-html`と`event-handler`の2入力でした。差分が出たのは次の5入力です。

- `basic`
- `gfm`
- `headings`
- `javascript-url`
- `malformed`

たとえば重複headingでは、Bunが`repeated-heading`と`repeated-heading-1`というIDを出力しました。今回の`marked.parse(source, { gfm: true })`はheading IDを出力しませんでした。

一方、基本MarkdownとGFMについて用意したCLI assertionはすべて通りました。heading、strong、inline/fenced code、HTTPS link、table、2個のtask input、checked状態、strikethrough、`www` autolinkなど、必要な構造は4経路で確認できています。

ここから言えるのは、必要機能が両方に存在してもraw文字列は同じとは限らない、という範囲です。raw文字列の一致だけで置換可否やDOM同値を判断するのは難しそうです。

### イベント属性はrawに残り、同じpolicyで除去された

`onerror`を持つ画像fixtureでは、BunとMarkedの両raw出力にイベント属性とmarker codeが残りました。両方を同じsanitizer policyへ渡すと、許可した画像要素は残り、イベント属性とmarker codeは消えました。

```html
<img src="/__missing__.png" alt="probe" />
```

browserでBun raw routeを開くと、画像は意図したloopbackの404を受け、`body.dataset.onerror`が`fired`になりました。これは、少なくとも今回の固定入力・設定では、parserのraw出力をそのままDOMへ入れるとイベント属性が動作した、という観測です。

### `javascript:` fixtureはリンクにならなかった

CLI suiteは66 assertion中60件がpassし、6件がfailしました。6件はすべて、`javascript:` fixtureがリンクになるという前提から派生したものです。

実際には、BunもMarkedも`<a>`を生成しませんでした。両者ともMarkdown風の入力をparagraph内のリテラル文字列として残しています。そのため、raw出力に`javascript:`とmarker文字列は見えますが、実行可能なURL属性ではありません。sanitizerにも除去対象となる`href`がなく、リテラル文字列はそのまま残りました。

browserでもBun raw routeのanchor数は0でした。期待値1との不一致で停止したため、Marked raw routeと両sanitized routeのbrowser観測には進んでいません。

最も目につく境界はURL destination中の空白ですが、fixtureを書き換えた再実験はしていません。したがって、正しい危険URL fixtureの構文や、両parserが一般に`javascript:` URLをどう扱うかは、本結果からは結論にできません。

## 失敗と修正

今回の失敗を、期待値へ合わせて隠さないために、harnessだけを限定して修正しました。

1. 最初のCLI harnessは最初の失敗で止まりました。全assertionを集計してJSONへ残してからexit 1にするよう変更し、60 pass / 6 failを記録しました。
2. 最初のbrowser harnessは存在しないanchorを30秒待ってtimeoutしました。anchor数を即時に数えて、期待値1・実値0として失敗させるよう変更しました。
3. fixture、parser options、sanitizer policy、期待するanchor数は変更していません。
4. `bun --check scripts/generate.mjs`は、今回のBun binaryでは構文確認だけでなくgeneratorを実行しました。明示的な生成コマンドもその後に実行し、同じ固定入力からrun専用出力を上書きしています。

つまり、最終結果は「仮説どおり通った」ではなく、CLIはfailed、browserは起動可能だが最初のrouteでfailed、という分類です。

## 制限事項

- Marked rawと両sanitized routeはbrowserで未観測です。
- sanitized HTMLからイベント属性が消えたことはCLIで確認しましたが、sanitized routeでmarkerが発火しないことはbrowserで確認していません。
- 実行可能な`javascript:` anchorを作るfixtureは検証していません。
- CLI失敗時には行わない計画だったため、2回目の生成とSHA-256比較は未実施です。決定性は主張できません。
- sanitize結果は、固定したversion、7 fixture、allowlistの範囲だけの観測です。sanitizerの一般的な安全性は評価していません。
- `Bun.markdown`はUnstable APIです。別versionや別optionsへの一般化はできません。
- 見た目の同等性は検証していません。screenshotも撮っていません。

## まとめ

今回の結果から、`marked`から`Bun.markdown`への置換判断と、生成HTMLのsanitize判断は分ける必要があると分かりました。

- 7入力中5入力でraw HTMLが異なり、特にheading IDなどには移行時に確認すべき差がありました。
- raw HTMLのイベント属性は両parserで残り、今回の同一allowlistでは両方から除去されました。
- 用意した`javascript:` fixtureはリンクにならず、危険URLのsanitize仮説は再現できませんでした。
- browser launchが成功しても、assertion mismatch後の経路は未確認として残す必要があります。

実務で置換を検討するなら、自分の入力fixtureと必要なDOM構造を固定し、parser出力のsnapshotとsanitizer policyを別々にテストするのが次の一歩です。今回の結果だけで「互換」「安全」と判断することはできません。

## 参考資料

- [Bun 1.4 release notes](https://bun.com/blog/bun-v1.4)（2026-08-24閲覧）
- [Bun Markdown documentation](https://bun.com/docs/runtime/markdown)（2026-08-24閲覧）
- [Marked README: Usage](https://github.com/markedjs/marked#usage)（2026-08-24閲覧）
- [Playwright: Browsers](https://playwright.dev/docs/browsers)（2026-08-24閲覧）
