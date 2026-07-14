# Node.js 26 package mapsでphantom dependencyを可視化する実践計画

## 出典と選定テーマ

- 出典レポート: `research/search-topic-20260713-1359.md`
- 選定テーマ: **Node.js 26.4+のexperimental package mapsを、pnpm 11.8+が生成する`standard` / `loose` mapで比較する。同じ小規模workspaceに宣言済みdependencyとphantom dependencyを作り、通常の`node_modules`探索では成功するimportが`standard` mapで拒否されるか、`loose`では互換挙動へ戻るかを、生成JSON・resolved version・終了codeで検証する。**
- 対象読者: monorepoと依存宣言を学び始めた新人Webエンジニア
- この文書はrun stageの実行計画だけを定義する。ここでは検証、dependency取得、記事執筆、Git操作を行わない。

### 参照する公式・一次情報

- [Node.js v26.4.0 release](https://nodejs.org/en/blog/release/v26.4.0)
- [Node.js Packages: Package maps](https://nodejs.org/api/packages.html#package-maps)
- [Node.js CLI: `--experimental-package-map`](https://nodejs.org/api/cli.html#--experimental-package-mappath)
- [pnpm 11.8.0 release](https://github.com/pnpm/pnpm/releases/tag/v11.8.0)
- [Yarn configuration: `nodeExperimentalPackageMap`](https://yarnpkg.com/configuration/yarnrc/#nodeExperimentalPackageMap)

公式仕様は期待値の根拠として使い、実測結果と分けて記録する。package mapsはStability 1のexperimental featureであり、現行のexact versionを越えて一般化しない。

## 目的

pnpm workspaceに、`package.json`で宣言した`is-number@7.0.0`を読む`app-a`と、rootにhoistされた同packageを未宣言のまま読む`app-b`を作る。`node-linker=hoisted`を固定し、次の4条件で同じprobeを実行する。

1. package mapなしのbaseline
2. pnpm生成の`loose` package map
3. pnpm生成の`standard` package map
4. `app-b`へ不足dependencyを宣言した後の`standard` package map

各条件でcommand、stdout、stderr、終了code、Node / pnpm exact version、生成mapのraw JSON・正規化JSON・SHA-256、設定差分を保存する。終了code 0だけでなく、resolved URL、package version、relative import、`node:` builtinの結果を一次証拠にする。

## 仮説

1. mapなしでは、`node-linker=hoisted`でrootから見える`is-number`を未宣言の`app-b`もimportできる。
2. `loose` mapではhoisted `node_modules` layoutに近い互換解決となり、同じphantom importが成功する。
3. `standard` mapでは`app-a`の宣言済みbare specifierは成功する一方、`app-b`の未宣言bare specifierはnon-zeroで拒否される。
4. relative specifierと`node:` builtinはpackage mapの対象外なので、全条件で成功する。
5. `app-b/package.json`へ`is-number@7.0.0`を追加しmapを再生成すると、`standard`でも同じprobeが成功し、map JSONにbefore / after差分が現れる。
6. pnpm script経由で注入されたmapと、同じmap pathをNode CLI flagへ明示した実行は、成功 / 失敗の判定が一致する。

仮説と異なる結果も破棄せず記録する。期待する差を作るためのmanual symlink、生成mapの手編集、error出力の補完は行わない。

## 計画作成時に確認した環境

2026-07-13 14:04 JSTに、installや対象featureの実行をせず次をread-onlyで確認した。

- effective Codex sandbox mode: `danger-full-access`
- host OS / architecture: Darwin / arm64
- host Node.js: `v22.17.0`
- host npm: `10.9.2`
- host pnpm: `10.13.1`
- 利用可能: `curl 8.7.1`、`shasum 6.02`、`jq 1.7.1`、GNU `timeout 9.11`、Docker CLI `28.5.1`、`tar`、`rg`
- repositoryの既存worktreeには、この入力レポートを含むuntracked fileがある。run stageはそれらを変更、削除、退避しない。

host Node / pnpmは対象versionを満たさない。run stageでは公式Node.js v26.5.0 archiveと`pnpm@11.8.0` packageを新しいrun directory内だけへ取得し、global runtime、Homebrew、既存repository設定を変更しない。

## 前提条件・capability gate・停止条件

- 実行場所は新規`logs/run-node26-package-maps-<timestamp>/work/`だけとする。既存run directoryを再利用しない。
- `danger-full-access`のためreal browser / Playwrightは許可される。ただし本テーマはbrowser非依存であり、browser工程を追加しない。後からbrowser観測へ広げる場合は最初にreal browser launchと対象feature detectionを独立したcapability gateとして実行し、どちらかが失敗した時点で停止してDOM、screen、挙動を推測しない。
- Node.js v26.5.0 archive、公式`SHASUMS256.txt`、`pnpm@11.8.0` tarball、`is-number@7.0.0`だけpublic networkから取得できる。認証、token、private registry、課金serviceは使わない。
- Node archiveのSHA-256照合、`node --version`のexact match、`node --help`内の`--experimental-package-map`確認のいずれかが失敗したら停止する。
- `pnpm --version`がexactly `11.8.0`でない、設定keyを読み返せない、または`node_modules/.package-map.json`が生成されない場合は停止する。手書きmapへテーマをすり替えない。
- baselineでphantom importが成功しなければfixture不成立として停止する。manual symlinkや非公式patchは使わない。
- `standard`でphantom importが成功した場合は、config、map hash、command lineを保存して停止する。「拒否された」結果を推測しない。
- pnpm script経由と明示flag経由で判定が異なる場合は両方を保存し、`process.execArgv`と`NODE_OPTIONS`を確認する。1回のclean installで再現しても不一致なら停止し、片方だけを採用しない。
- install / probeは各command 5分、archive / package取得は各10分でtimeoutする。timeout、crash、nondeterministic resultが出たら一度だけclean stateで再実行し、再発時は停止する。
- public registryへ2回連続で到達できない場合は停止する。cache hitを成功扱いにせず、local packageだけの別テーマへ変更しない。

## 隔離ディレクトリ

repository rootから次を実行する。`RUN_STAMP`は秒まで含め、既存pathなら停止する。

```bash
set -euo pipefail
REPO="$PWD"
RUN_STAMP="$(date +%Y%m%d-%H%M%S)"
RUN_DIR="$REPO/logs/run-node26-package-maps-$RUN_STAMP"
WORK="$RUN_DIR/work"
test ! -e "$RUN_DIR"
mkdir -p "$WORK"/{tools,workspace,evidence,.cache/pnpm-store,.cache/npm-bootstrap,.cache/xdg,.config,.local/share}
cd "$WORK"
export REPO RUN_DIR WORK
export NO_COLOR=1
export CI=1
export npm_config_update_notifier=false
export npm_config_fund=false
export npm_config_audit=false
export npm_config_cache="$WORK/.cache/npm-bootstrap"
export npm_config_store_dir="$WORK/.cache/pnpm-store"
export PNPM_HOME="$WORK/.pnpm-home"
export XDG_CACHE_HOME="$WORK/.cache/xdg"
export XDG_CONFIG_HOME="$WORK/.config"
export XDG_DATA_HOME="$WORK/.local/share"
```

以後のtoolchain、fixture、package manager store、`node_modules`、map、source、evidenceはすべて`$WORK`以下に置く。repositoryの`articles/`、`practice/`、`research/`、既存`logs/`を変更しない。`git init`、`git status`、`git diff`を含めGit commandは実行しない。fixture差分には`diff -u`を使う。

## 記録方法

run stageは`$WORK/tools/run-recorded.sh`を`apply_patch`で次の内容として作り、`chmod +x tools/run-recorded.sh`を実行する。

```bash
#!/usr/bin/env bash
set -o pipefail
label=$1
shift
evidence_dir=${EVIDENCE_DIR:?EVIDENCE_DIR is required}
mkdir -p "$evidence_dir"
date -Iseconds > "$evidence_dir/${label}.started"
printf '%q ' "$@" > "$evidence_dir/${label}.command"
printf '\n' >> "$evidence_dir/${label}.command"
"$@" > >(tee "$evidence_dir/${label}.stdout") 2> >(tee "$evidence_dir/${label}.stderr" >&2)
code=$?
printf '%s\n' "$code" > "$evidence_dir/${label}.exit"
date -Iseconds > "$evidence_dir/${label}.finished"
exit "$code"
```

各意図的失敗だけ`set +e`で囲み、直後に保存済みexit codeをassertする。すべてのcommand、stdout、stderr、exit code、開始・終了時刻、再試行、fallback、計画との差を`$RUN_DIR/execution-log.md`へ時系列で記録する。`env`、npm / pnpm config全量、token、cookie、private hostnameは出力しない。公開用素材では`$WORK`のabsolute pathを`<WORK>`へ置換するが、raw evidenceは改変せず残す。

## 手順1: Node.js 26.5.0とpnpm 11.8.0を隔離取得する（35分）

OS / architectureに対応する公式Node archive名を確定し、checksumを照合する。想定外platformでは停止する。

```bash
cd "$WORK"
NODE_VERSION=26.5.0
case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) NODE_PLATFORM=darwin-arm64 ;;
  Darwin-x86_64) NODE_PLATFORM=darwin-x64 ;;
  Linux-aarch64|Linux-arm64) NODE_PLATFORM=linux-arm64 ;;
  Linux-x86_64) NODE_PLATFORM=linux-x64 ;;
  *) printf 'unsupported platform: %s-%s\n' "$(uname -s)" "$(uname -m)" >&2; exit 1 ;;
esac
NODE_ARCHIVE="node-v${NODE_VERSION}-${NODE_PLATFORM}.tar.gz"
NODE_BASE_URL="https://nodejs.org/dist/v${NODE_VERSION}"
gtimeout 10m curl --fail --location --retry 1 --output "tools/$NODE_ARCHIVE" "$NODE_BASE_URL/$NODE_ARCHIVE"
gtimeout 10m curl --fail --location --retry 1 --output tools/SHASUMS256.txt "$NODE_BASE_URL/SHASUMS256.txt"
(cd tools && grep "  $NODE_ARCHIVE\$" SHASUMS256.txt > node-checksum.txt)
(cd tools && shasum -a 256 -c node-checksum.txt)
mkdir tools/node
tar -xzf "tools/$NODE_ARCHIVE" -C tools/node --strip-components=1
NODE_BIN="$WORK/tools/node/bin/node"
export NODE_BIN
test "$($NODE_BIN --version)" = "v$NODE_VERSION"
$NODE_BIN --help > evidence/node-help.txt
grep -q -- '--experimental-package-map' evidence/node-help.txt
printf '%s\n' "$NODE_VERSION" > evidence/node-version.expected
uname -s > evidence/os.txt
uname -m > evidence/arch.txt
```

次にhost npmをtarball取得だけに使い、pnpm CLIは隔離Nodeで起動する。

```bash
cd "$WORK"
PNPM_VERSION=11.8.0
gtimeout 10m npm view "pnpm@$PNPM_VERSION" dist.integrity > evidence/pnpm-registry-integrity.txt
gtimeout 10m npm pack "pnpm@$PNPM_VERSION" --pack-destination tools --json > evidence/pnpm-pack.json
PNPM_TGZ="$(basename "$(jq -r '.[0].filename' evidence/pnpm-pack.json)")"
test -n "$PNPM_TGZ"
mkdir tools/pnpm
tar -xzf "tools/$PNPM_TGZ" -C tools/pnpm --strip-components=1
PNPM_CLI="$WORK/tools/pnpm/bin/pnpm.cjs"
export PNPM_CLI
test -f "$PNPM_CLI"
export PATH="$WORK/tools/node/bin:$PATH"
hash -r
export EVIDENCE_DIR="$WORK/evidence/toolchain"
tools/run-recorded.sh node-version "$NODE_BIN" --version
tools/run-recorded.sh pnpm-version "$NODE_BIN" "$PNPM_CLI" --version
tools/run-recorded.sh pnpm-store-dir "$NODE_BIN" "$PNPM_CLI" config get store-dir
test "$(tr -d '\r\n' < "$EVIDENCE_DIR/node-version.stdout")" = "v26.5.0"
test "$(tr -d '\r\n' < "$EVIDENCE_DIR/pnpm-version.stdout")" = "11.8.0"
test "$(tr -d '\r\n' < "$EVIDENCE_DIR/pnpm-store-dir.stdout")" = "$WORK/.cache/pnpm-store"
shasum -a 256 "tools/$NODE_ARCHIVE" "tools/$PNPM_TGZ" > evidence/toolchain-tarball-sha256.txt
```

Node archive取得またはchecksum照合が失敗した場合は停止する。この計画ではDockerへ途中で実行方式を変えず、host archive実行とcontainer実行の差を混ぜない。pnpm tarballやfixture dependencyの取得失敗にも別packageへのfallbackを設けない。

## 手順2: 最小workspace fixtureを作る（45分）

`$WORK/workspace`へ移動し、次のtreeを`mkdir`と`apply_patch`で作る。

```text
workspace/
├── .npmrc
├── package.json
├── pnpm-workspace.yaml
├── apps/
│   ├── app-a/
│   │   ├── package.json
│   │   └── declared.mjs
│   └── app-b/
│       ├── package.json
│       ├── phantom.mjs
│       ├── relative.mjs
│       └── builtin.mjs
└── packages/shared/
    ├── package.json
    └── value.mjs
```

初期`.npmrc`はmapなしbaseline用とする。`node-linker=hoisted`以外のhoist調整は加えない。

```ini
node-linker=hoisted
node-experimental-package-map=false
node-package-map-type=loose
ignore-scripts=true
strict-peer-dependencies=true
```

root `package.json`:

```json
{
  "name": "package-map-fixture-root",
  "version": "1.0.0",
  "private": true,
  "packageManager": "pnpm@11.8.0",
  "dependencies": {
    "is-number": "7.0.0"
  }
}
```

`pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

`apps/app-a/package.json`は`is-number`を正しく宣言する。

```json
{
  "name": "app-a",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": { "probe:declared": "node declared.mjs" },
  "dependencies": { "is-number": "7.0.0" }
}
```

`apps/app-b/package.json`は初期状態ではdependenciesを持たない。

```json
{
  "name": "app-b",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "probe:phantom": "node phantom.mjs",
    "probe:relative": "node relative.mjs",
    "probe:builtin": "node builtin.mjs"
  }
}
```

`packages/shared/package.json`と`value.mjs`:

```json
{
  "name": "@fixture/shared",
  "version": "1.0.0",
  "private": true,
  "type": "module"
}
```

```js
export const value = "relative-ok";
```

`apps/app-a/declared.mjs`と`apps/app-b/phantom.mjs`は`kind`だけ変え、次の形にする。`phantom.mjs`では`kind`を`"phantom"`にする。

```js
import isNumber from "is-number";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const packageJsonPath = require.resolve("is-number/package.json");
const version = JSON.parse(readFileSync(packageJsonPath, "utf8")).version;
const observed = {
  kind: "declared",
  accepted42: isNumber(42),
  resolved: import.meta.resolve("is-number"),
  version,
  execArgv: process.execArgv,
  nodeOptions: process.env.NODE_OPTIONS ?? null
};
console.log(JSON.stringify(observed));
if (observed.accepted42 !== true || version !== "7.0.0") process.exitCode = 1;
```

`apps/app-b/relative.mjs`:

```js
import { value } from "../../packages/shared/value.mjs";
const observed = { kind: "relative", value, resolved: import.meta.resolve("../../packages/shared/value.mjs") };
console.log(JSON.stringify(observed));
if (value !== "relative-ok") process.exitCode = 1;
```

`apps/app-b/builtin.mjs`:

```js
import path from "node:path";
const observed = { kind: "builtin", basename: path.basename("/tmp/example.txt"), resolved: import.meta.resolve("node:path") };
console.log(JSON.stringify(observed));
if (observed.basename !== "example.txt" || observed.resolved !== "node:path") process.exitCode = 1;
```

source treeとhashをinstall前に保存する。

```bash
cd "$WORK/workspace"
find . -type f -not -path './node_modules/*' -print | LC_ALL=C sort > "$WORK/evidence/fixture-files.txt"
find . -type f -not -path './node_modules/*' -print | LC_ALL=C sort | xargs shasum -a 256 > "$WORK/evidence/fixture-source-sha256.txt"
cp .npmrc "$WORK/evidence/npmrc.baseline"
cp apps/app-b/package.json "$WORK/evidence/app-b.before.json"
```

## 手順3: mapなしbaselineを確立する（35分）

clean installし、phantom dependencyが通常探索で本当に見えることをcapability gateにする。

```bash
cd "$WORK/workspace"
export EVIDENCE_DIR="$WORK/evidence/baseline"
gtimeout 5m "$WORK/tools/run-recorded.sh" install "$NODE_BIN" "$PNPM_CLI" install --no-frozen-lockfile
test ! -e node_modules/.package-map.json
gtimeout 5m "$WORK/tools/run-recorded.sh" declared "$NODE_BIN" apps/app-a/declared.mjs
gtimeout 5m "$WORK/tools/run-recorded.sh" phantom "$NODE_BIN" apps/app-b/phantom.mjs
gtimeout 5m "$WORK/tools/run-recorded.sh" relative "$NODE_BIN" apps/app-b/relative.mjs
gtimeout 5m "$WORK/tools/run-recorded.sh" builtin "$NODE_BIN" apps/app-b/builtin.mjs
for f in declared phantom relative builtin; do test "$(cat "$EVIDENCE_DIR/$f.exit")" = 0; done
cp pnpm-lock.yaml "$WORK/evidence/pnpm-lock.baseline.yaml"
find node_modules -maxdepth 2 -type d -print | LC_ALL=C sort > "$WORK/evidence/baseline/node-modules-layout.txt"
```

phantom probeがnon-zeroならここで停止する。結果を作るためにsymlinkや別の外部packageを追加しない。

## 手順4: `loose` package mapを生成して比較する（45分）

`.npmrc`の`node-experimental-package-map`だけを`true`に`apply_patch`で変更し、clean installする。`node-package-map-type=loose`は維持する。

```bash
cd "$WORK/workspace"
cp .npmrc "$WORK/evidence/npmrc.loose"
diff -u "$WORK/evidence/npmrc.baseline" "$WORK/evidence/npmrc.loose" > "$WORK/evidence/npmrc-baseline-loose.diff" || true
rm -rf node_modules
export EVIDENCE_DIR="$WORK/evidence/loose"
gtimeout 5m "$WORK/tools/run-recorded.sh" install "$NODE_BIN" "$PNPM_CLI" install --frozen-lockfile
test -s node_modules/.package-map.json
cp node_modules/.package-map.json "$WORK/evidence/package-map.loose.raw.json"
jq -S . node_modules/.package-map.json > "$WORK/evidence/package-map.loose.normalized.json"
shasum -a 256 node_modules/.package-map.json > "$WORK/evidence/package-map.loose.sha256"
$NODE_BIN "$PNPM_CLI" config get node-experimental-package-map > "$WORK/evidence/loose/config-enabled.txt"
$NODE_BIN "$PNPM_CLI" config get node-package-map-type > "$WORK/evidence/loose/config-type.txt"
test "$(tr -d '\r\n' < "$WORK/evidence/loose/config-enabled.txt")" = true
test "$(tr -d '\r\n' < "$WORK/evidence/loose/config-type.txt")" = loose
MAP="$WORK/workspace/node_modules/.package-map.json"
gtimeout 5m "$WORK/tools/run-recorded.sh" declared-direct "$NODE_BIN" "--experimental-package-map=$MAP" apps/app-a/declared.mjs
gtimeout 5m "$WORK/tools/run-recorded.sh" phantom-direct "$NODE_BIN" "--experimental-package-map=$MAP" apps/app-b/phantom.mjs
gtimeout 5m "$WORK/tools/run-recorded.sh" relative-direct "$NODE_BIN" "--experimental-package-map=$MAP" apps/app-b/relative.mjs
gtimeout 5m "$WORK/tools/run-recorded.sh" builtin-direct "$NODE_BIN" "--experimental-package-map=$MAP" apps/app-b/builtin.mjs
gtimeout 5m "$WORK/tools/run-recorded.sh" phantom-pnpm "$NODE_BIN" "$PNPM_CLI" --filter app-b run probe:phantom
for f in declared-direct phantom-direct relative-direct builtin-direct phantom-pnpm; do test "$(cat "$EVIDENCE_DIR/$f.exit")" = 0; done
```

pnpm scriptとdirect flagのJSON出力はpath表記を正規化して比較する。判定が一致しなければ停止条件に従う。

## 手順5: `standard` package mapでphantom dependency拒否を観測する（55分）

`.npmrc`の`node-package-map-type=loose`を`standard`へ`apply_patch`で変更し、clean installする。

```bash
cd "$WORK/workspace"
cp .npmrc "$WORK/evidence/npmrc.standard"
diff -u "$WORK/evidence/npmrc.loose" "$WORK/evidence/npmrc.standard" > "$WORK/evidence/npmrc-loose-standard.diff" || true
rm -rf node_modules
export EVIDENCE_DIR="$WORK/evidence/standard-before-fix"
gtimeout 5m "$WORK/tools/run-recorded.sh" install "$NODE_BIN" "$PNPM_CLI" install --frozen-lockfile
test -s node_modules/.package-map.json
cp node_modules/.package-map.json "$WORK/evidence/package-map.standard-before-fix.raw.json"
jq -S . node_modules/.package-map.json > "$WORK/evidence/package-map.standard-before-fix.normalized.json"
shasum -a 256 node_modules/.package-map.json > "$WORK/evidence/package-map.standard-before-fix.sha256"
diff -u "$WORK/evidence/package-map.loose.normalized.json" "$WORK/evidence/package-map.standard-before-fix.normalized.json" > "$WORK/evidence/map-loose-standard.diff" || true
MAP="$WORK/workspace/node_modules/.package-map.json"
gtimeout 5m "$WORK/tools/run-recorded.sh" declared-direct "$NODE_BIN" "--experimental-package-map=$MAP" apps/app-a/declared.mjs
gtimeout 5m "$WORK/tools/run-recorded.sh" relative-direct "$NODE_BIN" "--experimental-package-map=$MAP" apps/app-b/relative.mjs
gtimeout 5m "$WORK/tools/run-recorded.sh" builtin-direct "$NODE_BIN" "--experimental-package-map=$MAP" apps/app-b/builtin.mjs
for f in declared-direct relative-direct builtin-direct; do test "$(cat "$EVIDENCE_DIR/$f.exit")" = 0; done
set +e
gtimeout 5m "$WORK/tools/run-recorded.sh" phantom-direct "$NODE_BIN" "--experimental-package-map=$MAP" apps/app-b/phantom.mjs
phantom_direct_code=$?
gtimeout 5m "$WORK/tools/run-recorded.sh" phantom-pnpm "$NODE_BIN" "$PNPM_CLI" --filter app-b run probe:phantom
phantom_pnpm_code=$?
set -e
test "$phantom_direct_code" -ne 0
test "$phantom_pnpm_code" -ne 0
```

stderrのexact error name / codeをそのまま保存する。公式説明の`MODULE_NOT_FOUND`と表記が異なっても書き換えず、non-zeroになった原因がmap適用であることをcommandと生成mapから判定する。phantomが成功した場合は修正後caseへ進まない。

## 手順6: dependency宣言追加のbefore / afterを確認する（45分）

`apps/app-b/package.json`へ`"dependencies": { "is-number": "7.0.0" }`を`apply_patch`で追加する。source code、root dependency、hoist設定は変えない。

```bash
cd "$WORK/workspace"
cp apps/app-b/package.json "$WORK/evidence/app-b.after.json"
diff -u "$WORK/evidence/app-b.before.json" "$WORK/evidence/app-b.after.json" > "$WORK/evidence/app-b-dependency-fix.diff" || true
rm -rf node_modules
export EVIDENCE_DIR="$WORK/evidence/standard-after-fix"
gtimeout 5m "$WORK/tools/run-recorded.sh" install "$NODE_BIN" "$PNPM_CLI" install --no-frozen-lockfile
test -s node_modules/.package-map.json
cp node_modules/.package-map.json "$WORK/evidence/package-map.standard-after-fix.raw.json"
jq -S . node_modules/.package-map.json > "$WORK/evidence/package-map.standard-after-fix.normalized.json"
shasum -a 256 node_modules/.package-map.json > "$WORK/evidence/package-map.standard-after-fix.sha256"
cp pnpm-lock.yaml "$WORK/evidence/pnpm-lock.after-fix.yaml"
diff -u "$WORK/evidence/package-map.standard-before-fix.normalized.json" "$WORK/evidence/package-map.standard-after-fix.normalized.json" > "$WORK/evidence/map-standard-before-after.diff" || true
diff -u "$WORK/evidence/pnpm-lock.baseline.yaml" "$WORK/evidence/pnpm-lock.after-fix.yaml" > "$WORK/evidence/lock-before-after.diff" || true
MAP="$WORK/workspace/node_modules/.package-map.json"
gtimeout 5m "$WORK/tools/run-recorded.sh" declared-direct "$NODE_BIN" "--experimental-package-map=$MAP" apps/app-a/declared.mjs
gtimeout 5m "$WORK/tools/run-recorded.sh" phantom-direct "$NODE_BIN" "--experimental-package-map=$MAP" apps/app-b/phantom.mjs
gtimeout 5m "$WORK/tools/run-recorded.sh" relative-direct "$NODE_BIN" "--experimental-package-map=$MAP" apps/app-b/relative.mjs
gtimeout 5m "$WORK/tools/run-recorded.sh" builtin-direct "$NODE_BIN" "--experimental-package-map=$MAP" apps/app-b/builtin.mjs
gtimeout 5m "$WORK/tools/run-recorded.sh" phantom-pnpm "$NODE_BIN" "$PNPM_CLI" --filter app-b run probe:phantom
for f in declared-direct phantom-direct relative-direct builtin-direct phantom-pnpm; do test "$(cat "$EVIDENCE_DIR/$f.exit")" = 0; done
```

`standard-before-fix`の失敗と`standard-after-fix`の成功、app-b manifest差分、map差分の3点が揃わなければ修正効果を断定しない。

## 手順7: 証拠を集計する（35分）

次の表を`$RUN_DIR/execution-log.md`へ実測値で作る。空欄を期待値で埋めない。

| probe | no map | loose direct | loose pnpm | standard before direct | standard before pnpm | standard after direct | standard after pnpm |
|---|---|---|---|---|---|---|---|
| declared bare dependency | exit / version / resolved | exit / version / resolved | 対象外 | exit / version / resolved | 対象外 | exit / version / resolved | 対象外 |
| phantom bare dependency | exit / version / resolved or error | exit / version / resolved or error | exit / version / resolved or error | exit / exact error | exit / exact error | exit / version / resolved | exit / version / resolved |
| relative import | exit / resolved | exit / resolved | 対象外 | exit / resolved | 対象外 | exit / resolved | 対象外 |
| `node:` builtin | exit / resolved | exit / resolved | 対象外 | exit / resolved | 対象外 | exit / resolved | 対象外 |

合わせて以下を記録する。

- Node / pnpm exact version、OS / architecture、effective sandbox mode
- fixture source hash、lockfile before / after、`.npmrc`の全3条件差分
- loose / standard-before / standard-after mapのsize、SHA-256、top-level keys
- map内でapp-bのdependency mappingがbefore / afterにどう変化したかを示す最小の`jq`抽出結果
- 全command、stdout、stderr、exit code、開始・終了時刻
- retry、停止したcapability gate、計画からの逸脱、未検証範囲

map schemaは実測前に仮定しない。top-level keyを`jq 'keys'`で記録してから、実際のschemaに沿うread-only `jq` queryをexecution logへ残す。map全文を記事へ貼らず、local absolute pathは公開素材で`<WORK>`へredactする。

## 成功条件

- Node.js `v26.5.0`とpnpm `11.8.0`のversion gate、および`--experimental-package-map` flag gateが通っている。
- mapなし、`loose`、`standard-before-fix`、`standard-after-fix`の4条件で同一source probeを実行している。
- declared bare dependency、phantom bare dependency、relative import、`node:` builtinの各終了codeとstdout / stderrが保存されている。
- baselineと`loose`でphantom importが成功し、`standard-before-fix`でnon-zero、dependency宣言追加後の`standard-after-fix`で成功するbefore / afterが得られている。
- loose、standard-before、standard-afterの生成map raw JSON、正規化JSON、SHA-256と設定差分が保存されている。
- pnpm script経由と明示Node flag経由のphantom判定が一致し、実際に使われたCLI optionまたは`NODE_OPTIONS`が記録されている。
- 公式仕様、仮説、実測、未検証範囲を明確に分離している。

## 失敗条件

次のいずれかならrun stageは成功扱いにせず、停止理由と得られた証拠だけをexecution logへ残す。

- toolchain / checksum / flag / config / map生成のcapability gateに失敗する。
- supportedな`node-linker=hoisted`でもbaseline phantom importが成功しない。
- `standard`でphantom importが拒否されない、または宣言追加後も成功しない。
- pnpm経由とdirect flag経由の結果がclean rerun後も一致しない。
- timeout、crash、network failure、nondeterministic resultが許可した1回の再試行後も続く。
- evidenceにsecret、workspace外への書き込み、予期しないinstall script、手作業で作られたmap / symlinkが見つかる。

仮説の一部が外れても、capability gateを通過し、条件差を再現可能な一次証拠として説明できる場合は「仮説と異なる観測」として完了できる。ただしphantom dependencyの核心比較が成立しない場合は失敗とする。

## セキュリティ・コスト制限

- 無料のlocal実験だけとし、cloud resource、account、API key、課金操作を使わない。
- external packageは固定した`pnpm@11.8.0`とpure JavaScriptの`is-number@7.0.0`だけに限定し、`ignore-scripts=true`を維持する。unexpected lifecycle scriptが実行対象になったら停止する。
- `sudo`、Homebrew、system install、global npm / pnpm install、既存runtime切替、repository設定変更は禁止する。
- `danger-full-access`でもself-imposed境界として`$WORK`外へ生成物を書かない。container、追加mount、privileged modeは使わない。
- 環境変数全量、credential file、npmrc全量のglobal / user config、private registry情報を収集しない。
- package mapsはdependency resolution機能でありsecurity sandboxではない。「malicious packageを安全にする」と結論づけない。

## cleanup

証拠確認までは`$RUN_DIR`を保持する。検証途中のclean stateは対象caseの`node_modules`だけを削除し、他のrunやrepository fileを触らない。run全体を破棄する場合だけ、repository rootとRUN_DIR prefixをassertしてから実行する。

```bash
cd "$REPO"
test "$(pwd -P)" = "$(cd "$REPO" && pwd -P)"
case "$RUN_DIR" in
  "$REPO"/logs/run-node26-package-maps-*) ;;
  *) printf 'refusing cleanup: %s\n' "$RUN_DIR" >&2; exit 1 ;;
esac
test "$RUN_DIR" != "$REPO"
rm -rf "$RUN_DIR"
```

通常の成功時はcleanup commandを実行せず、`execution-log.md`と`work/evidence/`を次stageの一次証拠として残す。global runtimeやrepositoryにはcleanup対象を作らない。

## timeboxとfallback scope

- toolchain / capability gate: 35分
- fixture作成: 45分
- no-map baseline: 35分
- loose: 45分
- standard before fix: 55分
- dependency修正before / after: 45分
- 証拠集計: 35分
- 予備: 25分
- 合計上限: 5時間20分

4時間30分を超えた時点で、同一packageの複数versionとCommonJS追加caseは実施しない。core matrix、standard拒否、dependency宣言による修正、map diffを優先する。5時間20分で新しいcommandを止め、未完了条件を明記する。別のpackage manager、Yarn比較、performance benchmark、複数package ID、browser、手書きmap、Node v26.5.0以外のversion matrixへscopeを広げない。

## 想定される記事の持ち帰り

- hoisted layoutで「たまたま読める」未宣言dependencyを、pnpm生成`standard` package mapがどのように表面化させるかを終了codeと生成JSONで示せる。
- `loose`はmigration時の互換挙動、`standard`はdependency graphに沿う厳格な挙動として、同一fixtureの差で説明できる。
- `standard`で壊れたimportはrootへの追加ではなくconsumer自身のdependency宣言を直し、mapを再生成するbefore / afterで説明できる。
- relative / builtin specifierはbare package specifierと分けて考える必要がある。
- experimental featureのため、本番採用や将来互換性を推奨せず、Node.js v26.5.0 / pnpm 11.8.0で観測した範囲と停止条件を明記できる。
