---
title: "pnpm 11のminimumReleaseAge既定24hを踏みに行ったら、手元では通ってCIだけ落ちた"
emoji: "⏳"
type: "tech"
topics: ["pnpm", "nodejs", "npm", "security", "ci"]
published: false
---

<!-- 前提: 出典ログ logs/run-pnpm11-minimum-release-age-20260808-0411/execution-log.md / 記事タイプ 検証ログ（試してみた） / slug pnpm11-minimum-release-age-ci-only-failure / published: false -->

## はじめに

`npm view pnpm dist-tags` を眺めていたら `latest` が 11.20.0 になっていました。

```
{
  "next-10": "10.34.5",
  "latest-10": "10.34.5",
  "latest": "11.20.0",
  "next-11": "11.20.0",
  "latest-11": "11.20.0",
  "next-12": "12.0.0-rc.1"
}
```

pnpm 11 の目玉として紹介されているのが `minimumReleaseAge` の既定値変更です。公開されてから24時間経っていないバージョンは入れない、というサプライチェーン対策の設定が既定でオンになった、という話でした。

それなら「昨日リリースされたばかりのバージョンを指定したら install が失敗するはず」と思って、実際に24時間以内に公開された版を探して踏みに行きました。結果、予想は外れました。素の既定では**入ります**。そのうえで、同じ状態を CI 相当（`--frozen-lockfile`）で回すと落ちます。

この記事は、`@types/node@26.2.0`（検証時点で公開から1.37時間）を実データとして使い、pnpm 11.20.0 と pnpm 10 系で挙動を突き合わせた検証ログです。うまく踏めなかった過程も含めて書きます。

:::message
筆者は新人で、pnpm の新しい既定値をちゃんと追ったのは初めてです。実行環境は macOS 26.5 (Darwin 25.5.0, arm64) / Node.js v22.17.0。pnpm はすべて `npx --yes pnpm@<version>` で版を固定しています。
:::

以前 npm 12 の install scripts 既定無効化（`allowScripts`）を試した記事を書きましたが、あちらが「スクリプトを走らせない」方向の締め付けなのに対し、pnpm 11 の `minimumReleaseAge` は「新しすぎるバージョンを入れない」という時間軸の締め付けです。

## pnpm 11 で変わった既定値

まず一次情報を表にしました。出典は [pnpm 11.0 リリースブログ](https://pnpm.io/blog/releases/11.0)、[Settings: Dependency Resolution](https://pnpm.io/settings/dependency-resolution)、[Settings: Build](https://pnpm.io/settings/build) です。

| 設定 | 既定（pnpm 11） | ドキュメントの記述 |
|---|---|---|
| `minimumReleaseAge` | `1440`（分＝24h）。v11 より前は `0` | "To reduce the risk of installing compromised packages, you can delay the installation of newly published versions." |
| `minimumReleaseAgeStrict` | `minimumReleaseAge` を明示設定したときのみ true、そうでなければ false | "Controls how pnpm behaves when no version of a dependency satisfies the minimumReleaseAge constraint within the requested range." |
| `minimumReleaseAgeExclude` | `undefined` | "If you set minimumReleaseAge but need certain dependencies to always install the newest version immediately, you can list them under minimumReleaseAgeExclude." |
| `minimumReleaseAgeIgnoreMissingTime` | `true` | "When true, pnpm skips the minimumReleaseAge check for a package whose registry metadata does not include the time field." |
| `blockExoticSubdeps` | `true` | "only direct dependencies may use exotic sources. All transitive dependencies must be resolved from a trusted source, such as the configured registry." |
| `strictDepBuilds` | `true` | — |
| `verifyDepsBeforeRun` | `install` | — |
| `optimisticRepeatInstall` | `true` | — |
| `allowBuilds` | 旧5設定（`onlyBuiltDependencies` / `onlyBuiltDependenciesFile` / `neverBuiltDependencies` / `ignoredBuiltDependencies` / `ignoreDepScripts`）を置き換え。map 形式 | — |
| Node | `>=22.13`（"Node.js 22 or newer — pnpm itself is now pure ESM."） | — |

読んでいて一番引っかかったのが `minimumReleaseAgeStrict` の既定です。「`minimumReleaseAge` を明示設定したときのみ true」なので、素の既定（何も設定ファイルを置かない状態）では false になります。この時点では意味が分かっていませんでした。

もうひとつ大きいのが設定の置き場所です。ドキュメントには "pnpm no longer reads non-auth settings from `.npmrc`. Configuration is split into two categories." と書かれていて、auth / registry 系は INI（`.npmrc` や `~/.config/pnpm/auth.ini`）、pnpm 固有の設定は YAML（`pnpm-workspace.yaml` や `~/.config/pnpm/config.yaml`）に分かれました。`npm_config_*` 環境変数も読まれなくなり `pnpm_config_*` になっています。

検証前に予測を3つ固定しておきました。

1. 24h以内の版を exact 指定すると install が失敗する（`ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` が出る）
2. `.npmrc` に `minimum-release-age=0` を書けば緩む
3. 同じ exact 指定を pnpm 10.13.1 で実行すると成功する

結果は 1 と 2 が外れました。

## 検証環境

| 項目 | 値 |
|---|---|
| OS | macOS 26.5 (Darwin 25.5.0, arm64) |
| Node.js | v22.17.0 |
| npm | 10.9.2 |
| pnpm（検証対象） | 11.20.0 |
| pnpm（比較） | 10.13.1 / 10.34.5 |
| 検証日時 | 2026-08-08 04:11〜04:25 JST |

手元のグローバル pnpm は `/opt/homebrew/bin/pnpm` の 10.13.1 のままです。これと混ざると「どっちの pnpm が動いたのか」が分からなくなるので、全部 `npx --yes pnpm@<version>` で呼び、実行前に版のゲートを置きました。

```bash
V11=$(npx --yes pnpm@11.20.0 --version); V10=$(npx --yes pnpm@10.13.1 --version)
echo "$V11" | grep -qx '11.20.0' && echo "GATE-11: OK"
echo "$V10" | grep -qx '10.13.1' && echo "GATE-10: OK"
```

```
npx --yes pnpm@11.20.0 --version -> 11.20.0 (exit=0) elapsed=3s
npx --yes pnpm@10.13.1 --version -> 10.13.1 (exit=0) elapsed=5s
GATE-11: OK
GATE-10: OK
global pnpm --version -> 10.13.1  path=/opt/homebrew/bin/pnpm
```

`grep -qx` で完全一致にしているのは、`11.20.0` を期待して `11.2.0` が来ても気づけるようにしたかったからです。

fixture は依存1〜3個の極小プロジェクトをケースごとに作り、`pnpm-workspace.yaml` は「置かない」状態から始めました。ログは1ケース1ファイルで stdout+stderr をまとめ、末尾に `exit=<code> elapsed_ms=<ms>` を追記する関数で包みました。

```bash
now_ms() { python3 -c 'import time;print(int(time.time()*1000))'; }
run() {           # run <logfile> <dir> <cmd...>
  local log="$1"; shift; local dir="$1"; shift
  { echo "### $(date -u +%FT%TZ) cwd=$dir"; echo "\$ $*"; } >> "$log"
  local s=$(now_ms); ( cd "$dir" && "$@" ) >> "$log" 2>&1; local code=$?; local e=$(now_ms)
  echo "exit=$code elapsed_ms=$((e-s))" >> "$log"
}
```

ミリ秒を Python で取っているのは、macOS の `date` が `%3N` に対応していないからです（前に一度これで詰まりました）。

あと環境の話でひとつ。ストアのパスが pnpm 10 と 11 で違います。

```
pnpm11 store path: /Users/<user>/Library/pnpm/store/v11
pnpm10 store path: /Users/<user>/Library/pnpm/store/v10
--- ls -la ~/Library/pnpm/store/v11 ---
ls: /Users/<user>/Library/pnpm/store/v11: No such file or directory
--- ls -la ~/Library/pnpm/store/v10 ---
drwxr-xr-x@ 258 <user>  staff  8256 Jul 12  2025 files
drwxr-xr-x@ 258 <user>  staff  8256 Jul 12  2025 index
```

`store/v11` はこの時点で存在せず、最初の install で作られました。11 に上げた直後の install は必ずコールドになります。

## 「新しすぎるバージョン」を入れようとした結果

### 24時間以内に公開された版を探す

まず実データが必要です。npm registry の packument から `time` を見て、24時間以内のものを拾うスクリプトを書きました。

```bash
node find-fresh.mjs 24 @types/node typescript esbuild rollup vite eslint prettier zod nanoid tslib @biomejs/biome oxlint
```

1回目の出力がこれです。

```
@types/node: latest=26.2.0 versions=0 fresh(<24h)=0
typescript: latest=7.0.2 versions=0 fresh(<24h)=0
...
---FRESH_JSON---
[]
```

`versions=0`。パッケージ名を間違えたわけでもないのに、全部ゼロです。ここで数分止まりました。

切り分けに使ったのがこれです。

```
$ curl -s -H 'accept: application/vnd.npm.install-v1+json' https://registry.npmjs.org/tslib | node -e '...'
keys: name,dist-tags,versions,modified
has time: false
$ curl -s https://registry.npmjs.org/tslib  # full packument
has time: true time entries: 50
```

原因は accept ヘッダでした。`application/vnd.npm.install-v1+json`（abbreviated metadata）には `time` フィールドが入っていません。registry のメタデータに2種類の形式があることを知らずに、install が使う軽い方を投げていました。ヘッダを外して full packument を取ったら通りました。

これで `minimumReleaseAgeIgnoreMissingTime` の既定が `true` な理由も腑に落ちました。`time` が取れないケースが現実にある、という前提の設定なんですね。

2回目の出力（該当部分）:

```
@types/node: latest=26.2.0 versions=2346 fresh(<24h)=1
  @types/node@26.2.0  published=2026-08-07T17:52:06.875Z  age=1.37h
nanoid: latest=6.0.1 versions=132 fresh(<24h)=1
  nanoid@3.3.18  published=2026-08-07T16:41:05.696Z  age=2.55h
vite:  newest-stable: vite@8.2.1 published=2026-08-06T13:47:48.588Z age=29.44h
```

検証対象は `@types/node@26.2.0`（公開から1.37時間）にしました。同じ 26.x の他の版はこう並んでいて、直前の 26.1.2 とは11日ほど離れています。

```
26.0.0  2026-06-19T07:14:52.347Z 1188.01h
26.0.1  2026-06-24T20:33:01.352Z 1054.71h
26.1.0  2026-07-01T11:04:10.429Z  896.19h
26.1.1  2026-07-08T06:47:46.733Z  732.47h
26.1.2  2026-07-27T17:32:14.992Z  265.72h
26.2.0  2026-08-07T17:52:06.875Z    1.39h   ← 24h以内
```

（この一覧は先ほどの探索より少しあとに走らせたので、同じ 26.2.0 の経過時間が 1.37h → 1.39h とずれています。）

:::message
選定条件は公開日時だけです。このバージョンの安全性を評価したわけではありません。
:::

### exact 指定で踏みに行く

設定ファイルを一切置かない状態（＝pnpm 11 の素の既定）で、公開1.37時間のバージョンを exact 指定しました。

```bash
cd case-a-exact && npx --yes pnpm@11.20.0 add @types/node@26.2.0
```

```
Progress: resolved 1, reused 0, downloaded 0, added 0
Packages: +2
++
Packages are cloned from the content-addressable store to the virtual store.
  Content-addressable store is at: /Users/<user>/Library/pnpm/store/v11
  Virtual store is at:             node_modules/.pnpm
Progress: resolved 2, reused 0, downloaded 2, added 2, done

dependencies:
+ @types/node 26.2.0

Added 1 entry to minimumReleaseAgeExclude in pnpm-workspace.yaml (set minimumReleaseAgeStrict to true to gate these updates with a prompt):
  @types/node@26.2.0
Done in 2.8s using pnpm v11.20.0
exit=0 elapsed_ms=5130
```

通りました。exit=0 で、`@types/node@26.2.0` が入っています。

しかも最後の行が予想外でした。pnpm が `pnpm-workspace.yaml` を勝手に作って、そこに除外リストを書き足しています。

```yaml
minimumReleaseAgeExclude:
  - '@types/node@26.2.0'
```

```
$ ls -a case-a-exact
node_modules  package.json  pnpm-lock.yaml  pnpm-workspace.yaml
$ node -p "require('./node_modules/@types/node/package.json').version"
26.2.0
```

`pnpm add` だからかと思って、`package.json` に `"@types/node": "26.2.0"` を先に書いた状態で `pnpm install` も試しましたが、こちらも同じく exit=0 で、同じように `pnpm-workspace.yaml` が自動生成されました。

「明示的に頼んだ版は通す。ただし通したことを設定ファイルに書き残す」という設計に見えます。この自動生成されるファイルが後で問題になります（後述の CI の節）。

比較として同じコマンドを pnpm 10.13.1 で:

```bash
cd case-a-pnpm10 && npx --yes pnpm@10.13.1 add @types/node@26.2.0
```

```
Progress: resolved 1, reused 0, downloaded 0, added 0
Packages: +2
++
Progress: resolved 2, reused 0, downloaded 2, added 2, done

dependencies:
+ @types/node 26.2.0

Done in 1.4s using pnpm v10.13.1
exit=0 elapsed_ms=3651
```

pnpm 10.13.1 はそもそも `pnpm-workspace.yaml` を作りません（`ls -a` に出てこない）。`Content-addressable store is at:` の行も出ません。

## エラーにならないケースがあった

exact でエラーにならないなら、range 指定はどうなるのか。ここが本題でした。

```bash
cd case-b-range && npx --yes pnpm@11.20.0 add '@types/node@^26.0.0'
```

```
Progress: resolved 1, reused 0, downloaded 0, added 0
Packages: +2
++
Packages are cloned from the content-addressable store to the virtual store.
  Content-addressable store is at: /Users/<user>/Library/pnpm/store/v11
  Virtual store is at:             node_modules/.pnpm
Progress: resolved 2, reused 1, downloaded 1, added 2, done

dependencies:
+ @types/node 26.1.2

Done in 1.5s using pnpm v11.20.0
exit=0 elapsed_ms=3614
```

入ったのは 26.1.2 です。最新は 26.2.0 なので、11日前の版に落ちています。`minimumReleaseAge` が効いた証拠なんですが、出力を見ても「新しい版を避けました」という警告も注記も一切ありません。`pnpm-workspace.yaml` も作られません。

`package.json` に書き込まれた specifier も、解決結果に合わせて書き換わっていました。

```json
{ "dependencies": { "@types/node": "^26.1.2" } }
```

`^26.0.0` と書いたつもりが `^26.1.2` になっている。これは差分を見ないと気づかないと思います。

### minimumReleaseAgeStrict を明示すると何が変わるか

ここで `minimumReleaseAgeStrict` の意味を確かめました。`pnpm-workspace.yaml` に明示します。

```yaml:pnpm-workspace.yaml
minimumReleaseAgeStrict: true
```

範囲内に代替が無いケース（exact 26.2.0）:

```bash
cd case-b-strict-exact && npx --yes pnpm@11.20.0 install --no-color
```

```
Progress: resolved 1, reused 0, downloaded 0, added 0
[ERR_PNPM_NO_MATURE_MATCHING_VERSION] 1 version does not meet the minimumReleaseAge constraint:
  @types/node@26.2.0 was published at 2026-08-07T17:52:06.875Z, within the minimumReleaseAge cutoff (2026-08-06T19:16:07.950Z)
exit=1 elapsed_ms=3503
```

今度は落ちました。ただしエラーコードが `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` ではなく `ERR_PNPM_NO_MATURE_MATCHING_VERSION` です。予測①で想定していたコードと違います。

範囲内に代替があるケース（`^26.0.0`）を同じ `strict: true` で:

```
dependencies:
+ @types/node 26.1.2

Done in 1.1s using pnpm v11.20.0
exit=0 elapsed_ms=2907
```

こちらは strict でも普通に 26.1.2 へ落ちて成功します。つまり `minimumReleaseAgeStrict` は「新しい版を拒む」スイッチではなく、「範囲内に条件を満たす版が1つも無いときに、黙って諦めずエラーにする」スイッチでした。黙ってフォールバックする挙動自体は strict にしても変わりません。

そして最初に想定していた `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` は、解決の経路ではなく別の場所で出ます（CI の節で出てきます）。

## 設定で緩める方法と、その置き場所

`.npmrc` に `minimum-release-age=0` を書けば緩む、というのが予測②でした。まず `.npmrc` に `minimum-release-age=0`、`pnpm-workspace.yaml` に `minimumReleaseAgeStrict: true`、依存は exact 26.2.0 という組み合わせ。

```bash
cd case-c-npmrc && npx --yes pnpm@11.20.0 install --no-color
```

```
Progress: resolved 1, reused 0, downloaded 0, added 0
[ERR_PNPM_NO_MATURE_MATCHING_VERSION] 1 version does not meet the minimumReleaseAge constraint:
  @types/node@26.2.0 was published at 2026-08-07T17:52:06.875Z, within the minimumReleaseAge cutoff (2026-08-06T19:16:29.531Z)
exit=1 elapsed_ms=3515
```

緩みません。しかも「その設定は無視しました」という警告も出ません。`.npmrc` を残したまま `pnpm-workspace.yaml` に `minimumReleaseAge: 0` を足して同じコマンドを打つと通ります。

```
dependencies:
+ @types/node 26.2.0

Done in 1.3s using pnpm v11.20.0
exit=0 elapsed_ms=3500
```

もっと分かりやすい形にしたくて、依存を `^26.0.0` にして「設定の中身は同じまま、置き場所と pnpm の版だけを変える」判別テストをやりました。設定が効いていれば最新の 26.2.0、無視されていれば 26.1.2 になります。

| # | 設定の中身 | 置き場所 | pnpm | 解決された版 |
|---|---|---|---|---|
| C-4a | `minimum-release-age=0` | `.npmrc` | 11.20.0 | 26.1.2（無視された） |
| C-4b | `minimum-release-age=0` | `.npmrc` | 10.34.5 | 26.2.0（効いた） |
| C-4c | `minimumReleaseAge: 0` | `pnpm-workspace.yaml` | 11.20.0 | 26.2.0（効いた） |

同じ内容の設定が、置き場所と pnpm の版で結果が割れます。手元で試すまでは `.npmrc` に書くものだと思い込んでいたので、これは素直に驚きました。ネット上の記事や LLM の回答もまだ `.npmrc` 前提のものが多いので、pnpm 11 に上げたときは全部読み替えが必要そうです。

副次的な発見として、pnpm 10.34.5 は落ちた版を教えてくれます。

```
dependencies:
+ @types/node 26.1.2 (26.2.0 is available)
```

pnpm 11.20.0 の同条件の出力は `+ @types/node 26.1.2` だけで、`(26.2.0 is available)` に相当する注記がありません。既定でフォールバックするようになった版の方が情報が少ない、というのは少し不思議でした。

:::message alert
`minimumReleaseAge: 0` を書けば従来の挙動に戻せますが、それは24時間の待機が防いでいたもの（公開直後に差し込まれた版を掴んでしまうリスク）を自分で捨てることになります。緩める前に、なぜこの既定が入ったのかを確認したほうがいいと思います。
:::

## blockExoticSubdeps を踏むまでに3回空振りした

`minimumReleaseAge` のついでに、もうひとつの新既定 `blockExoticSubdeps: true` も試しました。仕様文には「直接依存なら exotic なソースを使ってよいが、推移依存はすべて信頼できるソース（設定済み registry など）から解決されなければならない」と書かれています。

素直に読んで、こう組みました。親 → `file:./child`（ローカルディレクトリ）→ 子の依存が `https://registry.npmjs.org/tslib/-/tslib-2.8.1.tgz`。tarball の URL 直指定なら exotic だろう、という読みです。

```
dependencies:
+ fixture-d-child 1.0.0
Done in 1.4s using pnpm v11.20.0
exit=0
```

通ってしまいました。`file:` のディレクトリだと推移依存として扱われていないのかと思い、子を `npm pack` して `file:./fixture-d-child-1.0.0.tgz` にしてみましたが、これも exit=0。`pnpm-workspace.yaml` に `blockExoticSubdeps: true` を明示しても exit=0。3回空振りです。

仕様文を読み直しても分からなかったので、`npm pack pnpm@11.20.0` して dist を読みました。

```js
if (ctx.blockExoticSubdeps && options.currentDepth > 0 && pkgResponse.body.resolvedVia != null &&
isExoticDep(pkgResponse.body.resolvedVia)) {
  const error = new PnpmError("EXOTIC_SUBDEP", `Exotic dependency "${...}" (resolved via ${...}) is not allowed in subdependencies when blockExoticSubdeps is enabled`);
```

```js
NON_EXOTIC_RESOLVED_VIA = new Set([
  "custom-resolver", "github.com/denoland/deno", "github.com/oven-sh/bun",
  "jsr-registry", "local-filesystem", "named-registry", "nodejs.org",
  "npm-registry", "workspace"
]);
```

判定は URL の形ではなく `resolvedVia` の分類でした。`https://registry.npmjs.org/...tgz` は `npm-registry` 扱いなので exotic ではない。`file:` も `local-filesystem` なので exotic ではない。「tarball URL なら何でも exotic」ではなかったわけです。

そこで子の依存を、registry の外にある tarball URL に変えました。

```json:child-src/package.json
{ "name": "fixture-d-child", "version": "1.0.0",
  "dependencies": { "inherits": "https://codeload.github.com/isaacs/inherits/tar.gz/refs/tags/v2.0.4" } }
```

```json:package.json
{ "name": "fixture-d4-parent", "version": "1.0.0", "private": true,
  "dependencies": { "fixture-d-child": "file:./fixture-d-child-1.0.0.tgz" } }
```

```bash
cd case-d-exotic4 && npx --yes pnpm@11.20.0 install --no-color   # 設定ファイルなし＝素の既定
```

```
Progress: resolved 0, reused 0, downloaded 1, added 0
[ERR_PNPM_EXOTIC_SUBDEP] Exotic dependency "inherits" (resolved via url) is not allowed in subdependencies when blockExoticSubdeps is enabled

This error happened while installing the dependencies of fixture-d-child@1.0.0
exit=1 elapsed_ms=3496
```

`resolved via url` で落ちました。ここまで来て、`blockExoticSubdeps: false` を置けば同じ fixture が通ること（exit=0）、そして同じ URL を親の直接依存に置くと通ること（`+ inherits 2.0.4`, exit=0）も確認しました。仕様文の「直接OK・推移NG」は実測で確認できた、ということになります。

同じ fixture を pnpm 10.13.1 で回すと exit=0 で通ります。

## SQLiteストアでinstall時間はどうなったか

pnpm 11 のもうひとつの変更として、ストアのインデックスが SQLite になりました。まず実体を確認しました。

```
--- ls -la ~/Library/pnpm/store/v11 ---
drwxr-xr-x@   3 ... file+fixture-d-child-1.0.0.tgz
drwxr-xr-x@ 258 ... files
-rw-r--r--@   1 ...  61440 Aug  8 04:20 index.db
drwxr-xr-x@  14 ... projects
--- ls -la ~/Library/pnpm/store/v10 ---
drwxr-xr-x@ 258 ... files
drwxr-xr-x@ 258 ... index          ← v10 は JSON ファイルのディレクトリ
--- file index.db ---
SQLite 3.x database, last written using SQLite version 3050000, ...
--- sqlite3 .tables ---
package_index
--- sqlite3 .schema ---
CREATE TABLE package_index (
          key TEXT PRIMARY KEY,
          data BLOB NOT NULL
        ) WITHOUT ROWID
      ;
CREATE TABLE sqlite_stat1(tbl,idx,stat);
```

`package_index(key, data BLOB) WITHOUT ROWID` の1テーブルだけです。同じ fixture（`express@^5 / chalk@^5 / date-fns@^4`、70パッケージ）で両方のストアを作ると、対応が実データで見えます。

```
pnpm 11: store-11/v11/index.db  1,208,320 bytes（単一 SQLite ファイル / package_index に 68 行）
pnpm 10: store-10/v10/index/    JSON ファイル 68 個
```

`node_modules/.pnpm` のエントリは 70 なのにストアの索引は 68 行／68 個で、2つずれています（直接依存分の差だと思っています）。

```
$ sqlite3 store-11/v11/index.db 'select key from package_index limit 5;'
sha512-+1UMbeh68lH1SegH83CGWwpb6OHHbpSgr3+s5Eww5M4CAgswBpoWS0AjTOfEJ33HiYKz1hdj/KTFprzXHmq/6w==	date-fns@4.4.0
sha512-+ys997U96po4Kx/ABpBCqhA9EuxJaQWDQg7295H4hBphv3IZg0boBKuwYpt4YXp6MZ5AmZQnU/tyMTlRpaSejg==	call-bound@1.0.4
sha512-/IXtbwEk5HTPyEwyKX6hGkYXxM9nbj64B+ilVJnC/R6B0pH5G4V3b0pVbL7DBj4tkhBAppbQUlf6F6Xl9LHu1g==	math-intrinsics@1.1.0
sha512-/Nf7TyzTx6S3yRJObOAV7956r8cr2+Oj8AC5dt8wSP3BQAoeX58NoHyCU8P8zGkNXStjTSi6fzO6F0pBdcYbEg==	bytes@3.1.2
sha512-0KI/607xoxSToH7GjN1FfSbLoU0+btTicjsQSWQlh/hZykN8KpmMf7uYwPW3R+akZ6R/w18ZlXSHBYXiYUPO3g==	ipaddr.js@1.9.1
```

68個の JSON ファイルが1個のテーブルに畳まれていて、`key` は integrity と `name@version` の組でした。

install 時間も測ってみました。版のブレを消すため `minimumReleaseAge: 0` を明示し、ストアはグローバルを壊さないよう `--store-dir` で一時ディレクトリに逃がして、コールドは毎回そのディレクトリごと削除しています。

```bash
for mode in cold warm; do for i in 1 2 3; do
  rm -rf node_modules pnpm-lock.yaml
  [ "$mode" = cold ] && rm -rf "$STORE"
  npx --yes pnpm@"$V" install --store-dir "$STORE" --no-color
done; done
```

| pnpm | mode | run1 | run2 | run3 | 平均 | 中央値 |
|---|---|---|---|---|---|---|
| 11.20.0 | cold | 7833ms | 7562ms | 7517ms | 7637ms | 7562ms |
| 11.20.0 | warm | 9810ms | 6283ms | 6127ms | 7407ms | 6283ms |
| 10.13.1 | cold | 8467ms | 8751ms | 8328ms | 8515ms | 8467ms |
| 10.13.1 | warm | 10714ms | 5891ms | 6228ms | 7611ms | 6228ms |

全12回とも exit=0 で、`node_modules/.pnpm` のエントリ数は 70 で一致しました。

面白かったのは warm の1回目です。両バージョンとも突出しています（9810ms / 10714ms）。原因は特定できていません（`npx` のキャッシュ検証か、直前にストアを消した影響あたりだと思っていますが確認していません）。もし1回しか測っていなかったら「ウォームの方が遅い」という逆の結論を出していました。

中央値で見ると warm が 6.2s 前後、cold が 7.6〜8.5s。ただしこれはこのマシンのこの回線での値で、install 全体が pnpm 本体の起動とレジストリ解決に支配されているので、ストア形式の差を測れているとは言えません。SQLite 化の効果を知りたい人には、この計測は答えになっていないです。

## CIで気をつけたいこと

ここが一番大きい発見でした。

きっかけは [pnpm/pnpm#10438](https://github.com/pnpm/pnpm/issues/10438)「ロックに既にある依存には効かない」という Issue です。これを確かめようと、最初のケースAが作った `pnpm-lock.yaml`（26.2.0 が入っている）と `package.json` だけを新しいディレクトリにコピーして、設定ファイルを一切置かずに（＝pnpm 11 の素の既定で）`--frozen-lockfile` を回しました。CI でよくやる形です。

```
? Verifying lockfile against supply-chain policies (2 entries)...
Lockfile is up to date, resolution step is skipped
Progress: resolved 1, reused 0, downloaded 0, added 0
Packages: +2
++
Packages are cloned from the content-addressable store to the virtual store.
  Content-addressable store is at: /Users/<user>/Library/pnpm/store/v11
  Virtual store is at:             node_modules/.pnpm
Progress: resolved 2, reused 2, downloaded 0, added 2, done
✗ Lockfile failed supply-chain policy check (2 entries in 547ms)
[ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION] 1 lockfile entries failed verification:
  @types/node@26.2.0 was published at 2026-08-07T17:52:06.875Z, within the minimumReleaseAge cutoff (2026-08-06T19:25:05.568Z)

The lockfile contains entries that the active policies reject. This can mean the lockfile is stale, or that someone committed a lockfile that bypassed the policy locally — inspect recent changes to pnpm-lock.yaml before trusting it. If the changes look expected, run "pnpm clean --lockfile" and then "pnpm install" to rebuild from a fresh resolution. Alternatively, relax the policy that flagged them.
exit=1 elapsed_ms=3888
```

探していた `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` がここで出ました。解決の経路ではなく、ロックファイル検証の経路のコードでした。`Verifying lockfile against supply-chain policies` という専用のステップがあって、ロックに載っているエントリを publish 時刻で検証しています。

そして同じ状態に、ケースAで pnpm が自動生成した `pnpm-workspace.yaml` を足すだけで通ります。

```yaml:pnpm-workspace.yaml
minimumReleaseAgeExclude:
  - '@types/node@26.2.0'
```

```
✓ Lockfile passes supply-chain policies (2 entries in 302ms)

dependencies:
+ @types/node 26.2.0

Done in 1.2s using pnpm v11.20.0
exit=0 elapsed_ms=3673
```

つまり、`pnpm add @types/node@26.2.0` を叩いた人の手元では install が成功して、pnpm が `pnpm-workspace.yaml` を作る。その人が `pnpm-lock.yaml` だけコミットして `pnpm-workspace.yaml` をコミットし忘れると（あるいは `.gitignore` していると）、CI では `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` で落ちる。単一パッケージのプロジェクトでも、pnpm 11 は exact 指定の `pnpm add` のときに `pnpm-workspace.yaml` を作ることがある（今回のケースBのような range 指定では作られませんでした）ので、「モノレポじゃないから要らないファイル」だと思っていると踏みます。

いくつか周辺も確認しました。`--frozen-lockfile` なしの `pnpm install` でも同じ VIOLATION で exit=1 になりますが、エラーを出す前に `node_modules` は書かれていました（`node_modules/@types/node/package.json` が 26.2.0 で存在）。ロックを消して同条件にすると、解決経路のエラー（`ERR_PNPM_NO_MATURE_MATCHING_VERSION`, exit=1）に変わります。

Issue との突き合わせ結果:

| Issue | 今回の観測 |
|---|---|
| [#10438](https://github.com/pnpm/pnpm/issues/10438) ロックに既にある依存には効かない | 当てはまらなかった。pnpm 11.20.0 はロック検証の専用ステップを持ち、ロック上のエントリを publish 時刻で落とす |
| [#11982](https://github.com/pnpm/pnpm/issues/11982) ロック無し fresh install で固定版指定が latest タグを見る | この版では確認できなかった。ロック無しの exact 指定は狙いどおり 26.2.0 を解決している |
| [#10100](https://github.com/pnpm/pnpm/issues/10100) 新しい major が出たときフォールバックしない | 未検証。今回の fixture は同一 major 内（26.x）でしか試していない |

## 設定が効かないときpnpmは黙っている

`minimumReleaseAge` から少し離れますが、検証中に同じパターンを3回踏んだので書いておきます。

`strictDepBuilds: true`（既定）のせいで、`esbuild@^0.28.0` を install しただけで落ちます。

```
dependencies:
+ esbuild 0.28.1

[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: esbuild@0.28.1

Run "pnpm approve-builds" to pick which dependencies should be allowed to run scripts.
exit=1 elapsed_ms=4854
```

そこで許可を書くわけですが、旧設定名の `onlyBuiltDependencies` を `pnpm-workspace.yaml` に書いた場合:

```yaml:pnpm-workspace.yaml
onlyBuiltDependencies:
  - esbuild
```

非推奨警告も未知キー警告も出ず、まったく同じ `ERR_PNPM_IGNORED_BUILDS` で落ちます。新設定名の `allowBuilds` に直しても、リスト形式で書くと同じです。

```yaml:pnpm-workspace.yaml
allowBuilds:
  - esbuild
```

エラーメッセージが1文字も変わらないので、書式が悪いのか場所が悪いのか分かりませんでした。ドキュメントを読み直したら `allowBuilds` はリストではなく map でした。

```yaml:pnpm-workspace.yaml
allowBuilds:
  esbuild: true
```

```
.../esbuild@0.28.1/node_modules/esbuild postinstall$ node install.js
.../esbuild@0.28.1/node_modules/esbuild postinstall: Done

dependencies:
+ esbuild 0.28.1

Done in 2.3s using pnpm v11.20.0
exit=0 elapsed_ms=4784
```

`.npmrc` に書いた設定、旧設定名、書式ミス。3つとも「無視しました」の一言もなく沈黙します。実測した対応表がこれです。

| 設定名 | 書いた場所 | pnpm | 結果 |
|---|---|---|---|
| `minimum-release-age=0` | `.npmrc` | 11.20.0 | 無視。警告なし（`^26.0.0` → 26.1.2） |
| `minimum-release-age=0` | `.npmrc` | 10.34.5 | 効く（`^26.0.0` → 26.2.0） |
| `minimumReleaseAge: 0` | `pnpm-workspace.yaml` | 11.20.0 | 効く（`^26.0.0` → 26.2.0） |
| `minimumReleaseAgeStrict: true` | `pnpm-workspace.yaml` | 11.20.0 | 効く（代替が無い範囲で `ERR_PNPM_NO_MATURE_MATCHING_VERSION`） |
| `minimumReleaseAgeExclude`（pnpm が自動生成） | `pnpm-workspace.yaml` | 11.20.0 | 効く（ロック検証を通す） |
| `blockExoticSubdeps: false` | `pnpm-workspace.yaml` | 11.20.0 | 効く（推移 exotic 依存が通る） |
| `onlyBuiltDependencies:`（旧名・リスト） | `pnpm-workspace.yaml` | 11.20.0 | 無視。警告なし |
| `allowBuilds:`（リスト形式・書式ミス） | `pnpm-workspace.yaml` | 11.20.0 | 無視。警告なし |
| `allowBuilds:`（map 形式・正しい） | `pnpm-workspace.yaml` | 11.20.0 | 効く（postinstall が走る） |

もうひとつ、`verifyDepsBeforeRun: install`（既定）の挙動も見ました。`node_modules` を消してから `pnpm run hello` を実行すると、スクリプトの前に install が自動で走ります。

```
✓ Lockfile passes supply-chain policies (verified 3s ago)
Lockfile is up to date, resolution step is skipped
...
[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: esbuild@0.28.1
...
[ERROR] Command failed with exit code 1: pnpm install

pnpm: Command failed with exit code 1: pnpm install
    at getFinalError (file:///Users/.../pnpm/dist/pnpm.mjs:89001:14)
    ...
    at runDepsStatusCheck (file:///Users/.../pnpm/dist/pnpm.mjs:254302:7)
exit=1 elapsed_ms=4200
```

`pnpm run` が install の失敗を巻き込んで落ちます。スタックトレースまで出るので、初見だと何が起きたか読みにくいと思いました。

## 実測で確認したエラーコードの整理

| コード | いつ出るか | 終了コード |
|---|---|---|
| `ERR_PNPM_NO_MATURE_MATCHING_VERSION` | 解決時。要求範囲内に `minimumReleaseAge` を満たす版が1つも無く、かつ `minimumReleaseAgeStrict` が true | 1 |
| `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` | ロックファイル検証時。ロックに載っているエントリが cutoff より新しい。素の既定でも出る | 1 |
| `ERR_PNPM_EXOTIC_SUBDEP` | 推移依存が exotic（`resolved via url` など）で `blockExoticSubdeps` が有効 | 1 |
| `ERR_PNPM_IGNORED_BUILDS` | `strictDepBuilds: true`（既定）で、許可されていない postinstall がある | 1 |

ひとつ反省を書いておきます。途中で `npm pack pnpm@11.20.0` した dist を `grep ERR_PNPM_` したら VIOLATION が出てこなくて、「このコードは存在しないのでは」と判断しかけました。実際はソース側が `PnpmError("NO_MATURE_MATCHING_VERSION", ...)` のように `ERR_PNPM_` 接頭辞なしで書かれていて、VIOLATION は `resolving/npm-resolver/lib/violationCodes.js` の `MINIMUM_RELEASE_AGE_VIOLATION_CODE` として別経路で定義されていました。grep で出ないから無い、と決めなくてよかったです。

## まとめ

検証前に立てた予測の当否です。

| # | 予測 | 実測 |
|---|---|---|
| ① | 24h以内の版を exact 指定すると install が失敗する | 外れ。`pnpm add` も `pnpm install` も exit=0 で成功し、pnpm が `pnpm-workspace.yaml` を自動生成して `minimumReleaseAgeExclude` に書き足した |
| ② | `.npmrc` に `minimum-release-age=0` を書けば緩む | 外れ。pnpm 11.20.0 は完全に無視し、警告も出さない。同じ `.npmrc` が pnpm 10.34.5 では効く |
| ③ | 同じ exact 指定が pnpm 10.13.1 では成功する | 当たり（exit=0、26.2.0 が入る） |

「pnpm 11 では新しすぎる版が入らない」という理解で始めたんですが、素の既定で起きることは違いました。exact で頼んだ版は入る。range だと警告ゼロで古い版に落ちる。そして手元で通った状態を CI で回すとロック検証で落ちる。「入らない」より「黙って古いのが入る」「手元で通って CI で落ちる」の方が実態に近いと思います。

pnpm 11 に上げるなら、まず `pnpm-workspace.yaml` が `.gitignore` に入っていないか確認するのが一番効くと感じました。あとは `.npmrc` に書いてある pnpm 固有の設定を洗い出して YAML に移すこと。どちらも「エラーにならないまま挙動が変わる」種類の問題なので、CI が落ちてから気づくことになりそうです。

計測については、SQLite ストアの効果を測れたとは言えません。install 全体が起動とレジストリ解決に支配されていて、warm の1回目が両バージョンとも外れ値になった理由も分かっていません。

今回触れなかったものを列挙しておきます。

- `optimisticRepeatInstall: true` の効果
- `minimumReleaseAgeIgnoreMissingTime` を false にした場合の挙動
- `minimumReleaseAgeExclude` を手書きした場合（自動生成しか見ていません）
- `~/.config/pnpm/config.yaml`（グローバル YAML）経由の設定
- major を跨いだフォールバック（[#10100](https://github.com/pnpm/pnpm/issues/10100)）
- pnpm 12.0.0-rc.1 の挙動
- Dependabot / Renovate と組み合わせたときにどうなるか

最後に、手元で試すなら最短でこの流れです。

```bash
# 0) 版ゲート
npx --yes pnpm@11.20.0 --version   # -> 11.20.0

# 1) 24h以内に公開された版を探す（full packument を取る。abbreviated には time が無い）
curl -s https://registry.npmjs.org/@types/node \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);const n=Date.now();Object.entries(j.time).forEach(([v,t])=>{const h=(n-Date.parse(t))/3.6e6; if(h<24)console.log(v,t,h.toFixed(2)+"h")})})'

# 2) 素の既定：range 指定は黙って古い版に落ちる
mkdir -p /tmp/b && cd /tmp/b && echo '{"name":"b","version":"1.0.0","private":true}' > package.json
npx --yes pnpm@11.20.0 add '@types/node@^26.0.0'
node -p "require('./node_modules/@types/node/package.json').version"   # -> 最新ではない版

# 3) 素の既定：exact 指定は通るが pnpm-workspace.yaml が自動生成される
mkdir -p /tmp/a && cd /tmp/a && echo '{"name":"a","version":"1.0.0","private":true}' > package.json
npx --yes pnpm@11.20.0 add @types/node@<24h以内の版>
cat pnpm-workspace.yaml     # -> minimumReleaseAgeExclude に書かれている

# 4) その pnpm-workspace.yaml を持たずに CI 相当を回すと落ちる
mkdir -p /tmp/ci && cp /tmp/a/package.json /tmp/a/pnpm-lock.yaml /tmp/ci/ && cd /tmp/ci
npx --yes pnpm@11.20.0 install --frozen-lockfile
# -> [ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION] ... exit=1

# 5) 設定の置き場所（同じ内容でも .npmrc は効かない）
echo 'minimum-release-age=0' > .npmrc                    # pnpm 11 では無視・警告なし
echo 'minimumReleaseAge: 0'  > pnpm-workspace.yaml       # こちらが効く
```

注意点として、pnpm 11 は `engines: node >=22.13` なので Node 18〜21 では起動しません。ストアパスも pnpm 10 とは別（`~/Library/pnpm/store/v10` と `.../v11`）なので、11 に上げた直後の install は必ずコールドになります。`pnpm add` は解決結果に合わせて `package.json` の specifier も書き換える（`^26.0.0` → `^26.1.2`）ので、差分は毎回見たほうがいいです。

## 参考リンク

- [pnpm 11.0 リリースブログ](https://pnpm.io/blog/releases/11.0)
- [pnpm Settings: Dependency Resolution](https://pnpm.io/settings/dependency-resolution)
- [pnpm Settings: Build](https://pnpm.io/settings/build)
- [pnpm/pnpm#10438](https://github.com/pnpm/pnpm/issues/10438)
- [pnpm/pnpm#11982](https://github.com/pnpm/pnpm/issues/11982)
- [pnpm/pnpm#10100](https://github.com/pnpm/pnpm/issues/10100)
