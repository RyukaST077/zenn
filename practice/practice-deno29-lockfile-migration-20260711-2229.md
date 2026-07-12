# Deno 2.9 lockfile 移行の実践計画

## 出典と選定テーマ

- 出典レポート: `research/search-topic-20260711-2227.md`
- 選定テーマ: **Deno 2.9 の `deno install` で既存 Node.js プロジェクトを移行し、npm / pnpm の lockfile から解決済み version・integrity・workspace 構成がどこまで引き継がれるか確認する。**
- 対象読者: Node.js の依存管理を学び始めた新人 Web エンジニア
- この文書は実行計画だけを定義する。検証、記事執筆、Git 操作は行わない。

### 参照する一次情報

- [Deno 2.9 release](https://deno.com/blog/v2.9)
- [Deno Docs: Dependency management](https://docs.deno.com/runtime/packages/)
- [Deno Docs: `deno install`](https://docs.deno.com/runtime/reference/cli/install/)
- [Deno Docs: Workspaces and monorepos](https://docs.deno.com/runtime/fundamentals/workspaces/)

## 目的

同一の小さな `package.json` から npm 版と pnpm 版の fixture を作り、それぞれの lockfile を Deno 2.9.0 が初回 `deno install` で取り込む挙動を、終了コード、生成ファイル、依存 tree、version、integrity、テスト結果で比較する。続けて frozen install の成功・manifest 不整合時の失敗、2 package の pnpm workspace 移行、無害な lifecycle script の opt-in 境界を確認する。

検証対象はこの fixture と exact tool version に限定する。「任意の Node.js プロジェクトが完全互換で移行できる」とは一般化しない。

## 仮説

1. npm と pnpm の各 lockfile だけを残して `deno.lock` と `node_modules` を除いた状態で Deno 2.9.0 の `deno install` を実行すると、元 lockfile の解決済み package version と integrity が初回 `deno.lock` に seed される。
2. 移行後は、同じ自作テストが `npm test` / `pnpm test` と `deno task test` の双方で成功する。
3. 生成済み `deno.lock` と未変更 manifest に対する `deno install --frozen` は成功し、依存 range を変更した manifest では非ゼロ終了する。
4. 小さな pnpm workspace の package 間依存と単一 `catalog` は、Deno が生成または更新した設定差分として観測でき、移行後も workspace task が成功する。
5. run directory 内に marker を作るだけの local package の `postinstall` は通常 install では自動実行されず、明示承認した場合だけ実行される。

仮説に反する結果も一次証拠として残す。seed を示す message がなくても、version と integrity の対応が確認できなければ「引き継がれた」と判定しない。

## 確認済み環境

計画作成時（2026-07-11 22:29 JST）に、インストールや対象実験を行わず次を確認した。

- OS / architecture: Darwin / arm64
- Node.js: `v22.17.0`
- npm: `10.9.2`
- pnpm: `10.13.1` (`/opt/homebrew/bin/pnpm`)
- 既存 Deno: `2.8.3` (`/opt/homebrew/bin/deno`)
- Docker CLI: `28.5.1`

既存 Deno は対象外の 2.8.3 であり、Homebrew build の `deno upgrade` は使わない。実行時は Deno 公式配布 archive から `2.9.0` の arm64 macOS binary を run directory 内だけに取得する。取得不能時の fallback に限り、公式 Docker image `denoland/deno:2.9.0` を使う。

## 前提条件と停止条件

- 認証、API key、OAuth、CAPTCHA、課金、GUI、実 browser、system package install は使わない。
- 外部通信は公式 Deno 配布元、Docker Hub の公式 image fallback、公開 npm registry から fixture の公開 package を取得する範囲だけ許可する。
- npm registry や proxy の設定値、token、cookie、環境変数一覧は記録しない。`npm config list` や `env` は実行しない。
- Deno の exact version が `2.9.0` でなければ実験を開始しない。
- fixture は pure JavaScript package の `lodash@4.17.21`、`kleur@4.1.5`、dev dependency の `uvu@0.5.6` と `yaml@2.8.0` に固定し、native addon は使わない。
- Deno 取得または npm registry 接続が失敗した場合は同一手順を 1 回だけ再試行する。それでも失敗したら中止し、cache 済み結果を新規取得成功として扱わない。
- install が run directory 外への書き込み、private registry、credential、未知の lifecycle script 実行を要求した場合は直ちに中止する。

## 隔離ディレクトリ

リポジトリルートから次を実行する。`RUN_DIR` が存在した場合は時刻を取り直し、既存 directory を再利用、削除、上書きしない。

```bash
set -euo pipefail
REPO="$PWD"
RUN_STAMP="$(date +%Y%m%d-%H%M)"
RUN_DIR="$REPO/logs/run-deno29-lockfile-migration-$RUN_STAMP"
WORK="$RUN_DIR/work"
test ! -e "$RUN_DIR"
mkdir -p "$WORK"/{fixtures,evidence,tools,.tools,.cache}
cd "$WORK"
export NO_COLOR=1
export npm_config_cache="$WORK/.cache/npm"
export PNPM_HOME="$WORK/.cache/pnpm-home"
export DENO_DIR="$WORK/.cache/deno"
export EVIDENCE_DIR="$WORK/evidence"
```

以後の作成、変更、cache、実行は `$WORK` 以下に限定する。repository の `articles/`、`practice/`、`research/`、他の `logs/` を変更しない。`git init`、`git diff` を含む Git コマンドは一切実行しない。設定差分は `diff -u` で取る。

## 記録方法

実行者は `tools/run-recorded.sh` を次の内容で作成し、`chmod +x tools/run-recorded.sh` を実行する。

```bash
#!/usr/bin/env bash
set -o pipefail
label=$1
shift
evidence_dir=${EVIDENCE_DIR:?EVIDENCE_DIR is required}
started=$(date -Iseconds)
printf '%s\n' "$started" > "$evidence_dir/${label}.started"
"$@" > >(tee "$evidence_dir/${label}.stdout") 2> >(tee "$evidence_dir/${label}.stderr" >&2)
code=$?
printf '%s\n' "$code" > "$evidence_dir/${label}.exit"
date -Iseconds > "$evidence_dir/${label}.finished"
exit "$code"
```

すべての command、stdout、stderr、exit code、開始・終了時刻、観測結果、計画との差を `$RUN_DIR/execution-log.md` に時系列で記録する。意図的失敗だけ `set +e` で囲み、直後に exit code が非ゼロであることを assertion してから `set -e` に戻す。生成 file 一覧は `find . -type f -print | LC_ALL=C sort`、内容 hash は `shasum -a 256` で保存する。絶対 path は log 公開前に `$WORK` へ置換する。

## 手順 1: Deno 2.9.0 を隔離取得する（20 分）

```bash
curl -fsSL --retry 1 \
  "https://dl.deno.land/release/v2.9.0/deno-aarch64-apple-darwin.zip" \
  -o .tools/deno-2.9.0.zip
unzip -q .tools/deno-2.9.0.zip -d .tools
chmod +x .tools/deno
DENO="$WORK/.tools/deno"
tools/run-recorded.sh 00-deno-version "$DENO" --version
grep -Eq '^deno 2\.9\.0 ' evidence/00-deno-version.stdout
node --version > evidence/00-node-version.txt
npm --version > evidence/00-npm-version.txt
pnpm --version > evidence/00-pnpm-version.txt
uname -s > evidence/00-os.txt
uname -m > evidence/00-arch.txt
```

archive 取得が 2 回失敗した場合だけ、`docker pull denoland/deno:2.9.0` と `docker run --rm -v "$WORK:/work" -w /work denoland/deno:2.9.0 deno --version` を記録する。Docker daemon が利用不能、image version が 2.9.0 でない、または bind mount が失敗したら中止する。fallback 使用時は後続の `"$DENO" ...` を `docker run --rm -u "$(id -u):$(id -g)" -e DENO_DIR=/work/.cache/deno -v "$WORK:/work" -w /work denoland/deno:2.9.0 deno ...` に機械的に置き換え、その事実を log 冒頭に記載する。host Deno 2.8.3 へは切り替えない。

## 手順 2: 同一 source の npm / pnpm fixture を作る（35 分）

`fixtures/base/package.json`、`index.mjs`、`test.mjs` を `apply_patch` で作る。

```json
{
  "name": "lockfile-migration-fixture",
  "private": true,
  "type": "module",
  "scripts": { "test": "node test.mjs" },
  "dependencies": {
    "kleur": "4.1.5",
    "lodash": "4.17.21"
  },
  "devDependencies": {
    "uvu": "0.5.6",
    "yaml": "2.8.0"
  }
}
```

```js
// index.mjs
import { createRequire } from "node:module";
import kleur from "kleur";
const require = createRequire(import.meta.url);
const chunk = require("lodash/chunk.js");
export const format = (values) => kleur.green(JSON.stringify(chunk(values, 2)));
```

```js
// test.mjs
import { format } from "./index.mjs";
const actual = format([1, 2, 3]);
if (actual !== "[[1,2],[3]]") throw new Error(`unexpected: ${JSON.stringify(actual)}`);
console.log("fixture test: ok");
```

色 escape を決定的に無効化するため全 command で `NO_COLOR=1` を維持する。次に source を複製し、lockfile 生成前の同一性を記録する。

```bash
cp -R fixtures/base fixtures/npm
cp -R fixtures/base fixtures/pnpm
(cd fixtures/base && shasum -a 256 package.json index.mjs test.mjs) > evidence/01-base-hashes.txt
(cd fixtures/npm && shasum -a 256 package.json index.mjs test.mjs) > evidence/01-npm-hashes.txt
(cd fixtures/pnpm && shasum -a 256 package.json index.mjs test.mjs) > evidence/01-pnpm-hashes.txt
diff -u evidence/01-base-hashes.txt evidence/01-npm-hashes.txt || true
diff -u evidence/01-base-hashes.txt evidence/01-pnpm-hashes.txt || true
```

hash file の path prefix を除いた hash 値が 3 fixture で一致しなければ停止する。

## 手順 3: 元 package manager の baseline を固定する（45 分）

```bash
cd "$WORK/fixtures/npm"
../../tools/run-recorded.sh 02-npm-install npm install --ignore-scripts
../../tools/run-recorded.sh 03-npm-ci npm ci --ignore-scripts
../../tools/run-recorded.sh 04-npm-tree npm ls --all --json
../../tools/run-recorded.sh 05-npm-test npm test
cp package-lock.json "$WORK/evidence/npm-package-lock.json"

cd "$WORK/fixtures/pnpm"
../../tools/run-recorded.sh 06-pnpm-install pnpm install --ignore-scripts --lockfile-only=false
../../tools/run-recorded.sh 07-pnpm-frozen pnpm install --frozen-lockfile --ignore-scripts
../../tools/run-recorded.sh 08-pnpm-tree pnpm list --depth Infinity --json
../../tools/run-recorded.sh 09-pnpm-test pnpm test
cp pnpm-lock.yaml "$WORK/evidence/pnpm-lock.yaml"

rm -rf "$WORK/fixtures/npm/node_modules" "$WORK/fixtures/pnpm/node_modules"
test -f "$WORK/fixtures/npm/package-lock.json"
test -f "$WORK/fixtures/pnpm/pnpm-lock.yaml"
test ! -e "$WORK/fixtures/npm/deno.lock"
test ! -e "$WORK/fixtures/pnpm/deno.lock"
```

各 install、tree、test が exit 0 でなければ移行比較へ進まない。npm と pnpm 同士の解決結果が同一であることは要求せず、各 baseline と対応する Deno 結果だけを比較する。

## 手順 4: Deno 2.9 へ初回移行する（60 分）

```bash
cd "$WORK/fixtures/npm"
../../tools/run-recorded.sh 10-deno-npm-install "$DENO" install --node-modules-dir=auto
../../tools/run-recorded.sh 11-deno-npm-info "$DENO" info --json
../../tools/run-recorded.sh 12-deno-npm-test "$DENO" task test
cp deno.lock "$WORK/evidence/npm-deno.lock"

cd "$WORK/fixtures/pnpm"
../../tools/run-recorded.sh 13-deno-pnpm-install "$DENO" install --node-modules-dir=auto
../../tools/run-recorded.sh 14-deno-pnpm-info "$DENO" info --json
../../tools/run-recorded.sh 15-deno-pnpm-test "$DENO" task test
cp deno.lock "$WORK/evidence/pnpm-deno.lock"
```

初回 install 前後の file 一覧を記録し、stdout / stderr に seed または import を示す message があるかを引用ではなく短く要約する。message の有無だけで成功判定しない。

実行者は `yaml@2.8.0` を使う `tools/compare-locks.mjs` を作る。この script は、(a) `package-lock.json` の `packages[*].version` / `integrity`、(b) `pnpm-lock.yaml` の `packages` entry の version / `resolution.integrity`、(c) 対応する `deno.lock` の `npm`（format が異なる場合は実際の top-level key を記録）から `name@version` と integrity を抽出し、package ごとの TSV と JSON を出力する。比較時は integrity の algorithm と base64 値を分離せず完全一致で判定し、解析不能な entry は `unknown` とする。Deno lock format を推測で補完しない。

```bash
cd "$WORK"
node tools/compare-locks.mjs npm \
  evidence/npm-package-lock.json evidence/npm-deno.lock \
  > evidence/16-npm-lock-comparison.tsv
node tools/compare-locks.mjs pnpm \
  evidence/pnpm-lock.yaml evidence/pnpm-deno.lock \
  > evidence/17-pnpm-lock-comparison.tsv
```

少なくとも direct dependency 4 件と、存在する transitive dependency を package 単位で `version_match`、`integrity_match`、`missing`、`unknown` のいずれかに分類する。解析不能なら raw lockfile の該当 entry を残し、integrity 保持を断定しない。

## 手順 5: frozen install の成功と失敗を確認する（35 分）

npm fixture だけを使用し、変更前の manifest を必ず copy してから意図的失敗を作る。

```bash
cd "$WORK/fixtures/npm"
../../tools/run-recorded.sh 18-frozen-ok "$DENO" install --frozen --node-modules-dir=auto
cp package.json package.json.before-frozen-mismatch
node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync("package.json","utf8"));p.dependencies.kleur="^4.1.0";fs.writeFileSync("package.json",JSON.stringify(p,null,2)+"\n")'
set +e
../../tools/run-recorded.sh 19-frozen-mismatch "$DENO" install --frozen --node-modules-dir=auto
code=$?
set -e
test "$code" -ne 0
mv package.json.before-frozen-mismatch package.json
../../tools/run-recorded.sh 20-frozen-restored "$DENO" install --frozen --node-modules-dir=auto
../../tools/run-recorded.sh 21-restored-test "$DENO" task test
```

`18`、`20`、`21` が exit 0、`19` が非ゼロでなければ仮説不成立として記録する。失敗 message は Deno の保証一般ではなく、この exact fixture の観測として扱う。

## 手順 6: pnpm workspace と単一 catalog の境界を確認する（55 分）

`fixtures/workspace` に root `package.json`、`pnpm-workspace.yaml`、`packages/lib`、`packages/app` を作る。root は private、`packages: ["packages/*"]` とし、catalog は `kleur: 4.1.5` の 1 件だけにする。`lib` は `kleur: "catalog:"`、`app` は `@fixture/lib: "workspace:*"` に依存し、`app/test.mjs` が lib の返り値を確認する。複数 catalog は扱わない。

```bash
cd "$WORK/fixtures/workspace"
../../tools/run-recorded.sh 22-workspace-pnpm-install pnpm install --ignore-scripts
../../tools/run-recorded.sh 23-workspace-pnpm-test pnpm --filter @fixture/app test
rm -rf node_modules packages/*/node_modules
cp package.json package.json.before-deno
cp pnpm-workspace.yaml pnpm-workspace.yaml.before-deno
find packages -name package.json -exec sh -c 'cp "$1" "$1.before-deno"' _ {} \;
../../tools/run-recorded.sh 24-workspace-deno-install "$DENO" install --node-modules-dir=auto
diff -u package.json.before-deno package.json > "$WORK/evidence/24-root-package.diff" || true
if test -f deno.json; then cp deno.json "$WORK/evidence/24-generated-deno.json"; fi
diff -u pnpm-workspace.yaml.before-deno pnpm-workspace.yaml > "$WORK/evidence/24-workspace-yaml.diff" || true
for p in packages/*/package.json; do diff -u "$p.before-deno" "$p" || true; done > "$WORK/evidence/24-packages.diff"
../../tools/run-recorded.sh 25-workspace-deno-test "$DENO" task --cwd packages/app test
```

Deno が設定変更を提案するだけで自動変更しない場合は、その message と非対話 command の exit code を記録し、推測で設定を書き換えない。公式文書に記載された non-interactive option が message に示された場合だけ 1 回適用し、適用 command と再 diff を別 evidence に残す。workspace package 間依存、catalog、task のうち未移行のものを明示する。

## 手順 7: lifecycle script の安全境界を確認する（35 分）

`fixtures/lifecycle/local-marker` を自作し、その `postinstall` は `node -e 'require("fs").writeFileSync("marker.txt","ran\\n")'` だけにする。親 package は `"local-marker": "file:./local-marker"` に依存する。script は通信、shell 展開、環境変数参照、親 directory への書き込みを行わない。

```bash
cd "$WORK/fixtures/lifecycle"
rm -f local-marker/marker.txt marker.txt
../../tools/run-recorded.sh 26-lifecycle-default "$DENO" install --node-modules-dir=auto
test "$(find . -name marker.txt -print | wc -l | tr -d ' ')" -eq 0
../../tools/run-recorded.sh 27-lifecycle-approve "$DENO" install --allow-scripts=local-marker --node-modules-dir=auto
find . -name marker.txt -print | LC_ALL=C sort > "$WORK/evidence/27-marker-files.txt"
test "$(wc -l < "$WORK/evidence/27-marker-files.txt" | tr -d ' ')" -eq 1
```

`--allow-scripts` の package 指定 syntax が Deno 2.9.0 help と一致しない場合は、`"$DENO" install --help` を保存してこの任意手順を停止する。全 script を許可する option へ広げない。通常 install で marker ができた場合は異常として直ちに停止し、その path と内容だけを記録する。

## 観測として保存するもの

- exact OS / architecture / Node.js / npm / pnpm / Deno version
- 各 command の stdout、stderr、exit code、開始・終了時刻
- npm / pnpm baseline の dependency tree と test 結果
- 元 lockfile、生成 `deno.lock`、初回 install 前後の file 一覧
- package ごとの resolved version と integrity の一致、不一致、欠落、解析不能
- `deno task test` の結果
- frozen install の成功、manifest 不整合時の非ゼロ、復元後の再成功
- workspace / catalog の設定差分、package 間依存、task 結果
- lifecycle script の default 非実行と、限定承認後 marker の有無
- retry、fallback、手順省略、公式仕様と観測結果の差

## 成功条件

必須成功条件は次のすべてとする。

1. npm と pnpm の両 fixture で元 package manager の install、dependency tree、同一テスト結果、lockfile を記録できる。
2. Deno 2.9.0 の初回 install と生成 `deno.lock` を両 fixture で記録できる。
3. 各元 lockfile と対応する `deno.lock` について、direct dependency と確認できる transitive dependency の version / integrity を package 単位で判定できる。
4. 両 fixture で `deno task test` の結果を記録できる。
5. 未変更 manifest の frozen install 成功、意図的な manifest 不整合の非ゼロ、復元後の成功を記録できる。
6. workspace または lifecycle script の少なくとも一方を、公式仕様と実行 evidence の両方で判定できる。
7. 全作業が run directory 内、無料、認証不要、GUI 不使用で完結する。

version または integrity の不一致自体は実験失敗ではなく重要な結果である。ただし比較不能のまま「保持」を主張することは失敗とする。

## 失敗条件

- Deno 2.9.0 を取得・実行できない、または version gate を満たさない。
- npm / pnpm の baseline install または baseline test が成立しない。
- 両 lockfile と `deno.lock` の対応を package 単位で一件も判定できない。
- frozen mismatch が exit 0、または manifest 復元後も install / test が失敗する。
- run directory 外への書き込み、秘密情報、private endpoint、予期しない install script、課金や認証要求が発生する。
- 必須範囲を 6 時間以内に完了できない。

## Security・cost 制限

- 費用上限は 0 円。公開 registry と公式配布物以外の service を使わない。
- credential、token、cookie、private hostname、user 名を含む絶対 path、環境変数全量を artifact に保存しない。
- package scripts は baseline でも `--ignore-scripts` とし、自作 marker package だけを package 名指定で許可する。
- `sudo`、`brew`、global install、global upgrade、host 設定変更、Git 操作、browser 起動、Docker privileged mode は禁止する。
- downloaded archive と lockfile は hash を保存するが、cache 全体や environment dump は保存しない。

## Cleanup

検証中は evidence 保全のため削除しない。記事化に必要な execution log と evidence を確認した後、必要なら cache と `node_modules` だけを次で除去する。

```bash
cd "$WORK"
rm -rf .cache fixtures/*/node_modules fixtures/workspace/packages/*/node_modules
find . -type f -print | LC_ALL=C sort > evidence/final-files.txt
```

`RUN_DIR` 自体、lockfile、生成設定、比較表、stdout / stderr / exit code、execution log は残す。他の pipeline directory や repository file は cleanup しない。

## Timebox と fallback scope

総上限は 6 時間、目安は 4〜5 時間とする。

- 0:00〜0:20 environment gate と Deno 取得
- 0:20〜0:55 fixture 作成
- 0:55〜1:40 baseline
- 1:40〜2:40 Deno 移行と lock 比較
- 2:40〜3:15 frozen install
- 3:15〜4:10 workspace
- 4:10〜4:45 lifecycle script
- 残りを evidence 整理に使う

4 時間を超えたら lifecycle script の明示承認を切り、default 非実行だけを残す。5 時間を超えたら workspace の catalog を切り、package 間依存だけを残す。必須の npm / pnpm baseline、両 lockfile seed、version / integrity 比較、両テスト、frozen 成功・失敗は削らない。direct dependency 1 個へ単純化するのは lock parser の原因切り分けとして 1 回だけ許可し、単純化結果を元 fixture の成功として扱わない。Yarn、Bun、複数 catalog、native addon、性能 benchmark、browser 検証は scope 外とする。

## 想定する記事の持ち帰り

- Deno 2.9.0 が npm / pnpm lockfile を取り込んだ範囲を、seed message だけでなく package 単位の version / integrity で確認する方法。
- 元 package manager と Deno で同じテストを動かし、依存 graph の一致と実行互換性を分けて考える方法。
- `--frozen` が再現性の guard として成功・失敗する具体的な境界。
- pnpm workspace / catalog と lifecycle script は単一 package の lockfile seed とは別の移行論点であること。
- 成功、不一致、未対応、解析不能を分離し、exact version と小さな fixture の範囲で結論を書く姿勢。
