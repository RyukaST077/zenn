# npm v12 `allowScripts` の実践計画

## 出典と選定テーマ

- 出典レポート: `research/search-topic-20260712-0342.md`
- 選定テーマ: **npm v12 で install script が明示許可制になった挙動を、自作の無害な dependency で確認し、`approve-scripts` による version 固定承認、更新時の再審査、`npm ci` での再現まで検証する。**
- 対象読者: npm の依存管理を学び始めた新人 Web エンジニア
- この文書は実行計画だけを定義する。検証、記事執筆、Git 操作は行わない。

### 参照する一次情報

- [npm install-time security and GAT bypass2fa deprecation](https://github.blog/changelog/2026-07-08-npm-install-time-security-and-gat-bypass2fa-deprecation/)
- [Upcoming breaking changes for npm v12](https://github.blog/changelog/2026-06-09-upcoming-breaking-changes-for-npm-v12/)
- [npm approve-scripts](https://docs.npmjs.com/cli/v11/commands/npm-approve-scripts/)

## 目的

run directory 内だけに marker file を作る local dependency を用い、npm 11.18.x と npm 12.0.xについて、未許可 install、version 固定承認、dependency 更新時の再審査、name-only 承認、明示 deny、`npm ci` を比較する。install の終了コードだけでなく、warning、pending 一覧、`package.json` の policy 差分、marker の内容、runtime test を一次証拠として残す。

検証結果は自作 local dependency と実行時に確定した exact npm version に限定する。native addon、Git / remote dependency、global install、`npx`、第三者 package 全般へ一般化しない。

## 仮説

1. 同一 fixture の未許可 install では、npm 11.18.x は `postinstall` を実行する一方、npm 12.0.x は install 自体が成功しても script を実行せず、marker は生成されない。
2. npm 12 で `fixture-installer@1.0.0` を version 固定承認すると `package.json` に `allowScripts` policy が記録され、clean install 後に marker と runtime test が成功する。
3. dependency を `1.0.1` へ更新すると `1.0.0` の固定承認は継承されず、再び pending となる。新 version の承認後だけ `1.0.1` marker が生成される。
4. name-only 承認は更新後 version にも適用され、version 固定承認より広い trust boundary になる。
5. 承認済み `package.json` と lockfile を clean copy に渡した `npm ci` は marker を再生成するが、`allowScripts` を除いた copy では install が 0 終了しても marker と runtime test は成功しない。
6. 別の無害な local dependency を明示 deny すると、許可済み dependency と同じ install に含めても deny 対象の marker は生成されない。

仮説と異なる結果も有効な観測として保存する。exit code 0 だけを script 実行成功とは扱わない。

## 確認済み環境

計画作成時（2026-07-12 03:45 JST）に、install や対象実験を行わず次を確認した。

- host Node.js: `v22.17.0`
- host npm: `10.9.2`
- Docker CLI: `28.5.1`
- 証拠整理に使用可能: `shasum`、`jq`、`script`

host npm は対象 version ではない。実行時は公開 npm registry から npm 11.18.x / 12.0.x の exact version と tarball を一度だけ確定し、run directory 内へ展開して host Node.js から直接起動する。global install や repository の package-manager 設定変更は行わない。host Node.js が npm 12 の engine gate を満たさない場合だけ、公式 `node:26-bookworm` Docker image を fallback とする。

## 前提条件と停止条件

- 認証、token、private registry、OAuth、CAPTCHA、課金、GUI、実 browser、system package install は使わない。
- 外部通信は公開 npm registry から npm CLI tarball を得ることと、fallback 時に Docker Hub から公式 Node image を得ることだけに限定する。fixture dependency はすべて自作 local package とする。
- npm 12 の registry `latest` が 12.0.x であること、選んだ npm 11 が 11.18.x であることを version gate で確認できなければ停止する。npm 11 の warning から npm 12 の結果を推測しない。
- npm CLI の取得または registry 接続は 1 回だけ再試行できる。再失敗したら停止する。
- fixture script は自身の install directory に固定文字列の marker を 1 個書くだけとする。network、subprocess、native build、環境変数参照、親 directory への書き込みは禁止する。
- third-party dependency の install script を承認しない。実行時に自作 2 package 以外が pending に現れたら停止する。
- npm config 全量、`env`、token、cookie、private hostname、username を含む絶対 path を証拠へ保存しない。
- local `file:` dependency が policy 対象にならない場合は、同じ自作 package を `npm pack --ignore-scripts` した local tarball dependency へ 1 回だけ置き換える。それでも pending / policy を観測できなければ停止し、外部 package へ対象を広げない。

## 隔離ディレクトリ

repository root から次を実行する。既存 directory は再利用、削除、上書きしない。

```bash
set -euo pipefail
REPO="$PWD"
RUN_STAMP="$(date +%Y%m%d-%H%M)"
RUN_DIR="$REPO/logs/run-npm12-allow-scripts-$RUN_STAMP"
WORK="$RUN_DIR/work"
test ! -e "$RUN_DIR"
mkdir -p "$WORK"/{tools,fixtures,cases,evidence,.cache/npm-bootstrap,.cache/npm11,.cache/npm12}
cd "$WORK"
export WORK RUN_DIR
export NO_COLOR=1
export npm_config_update_notifier=false
export npm_config_fund=false
export npm_config_audit=false
```

以後の source、cache、policy、lockfile、生成物、証拠は `$WORK` 以下だけに置く。repository の `articles/`、`practice/`、`research/`、他の `logs/` を変更しない。`git init` や `git diff` を含む Git command は一切実行しない。差分には `diff -u` を使う。

## 記録方法

実行者は `tools/run-recorded.sh` を `apply_patch` で次の内容として作り、`chmod +x tools/run-recorded.sh` を実行する。

```bash
#!/usr/bin/env bash
set -o pipefail
label=$1
shift
evidence_dir=${EVIDENCE_DIR:?EVIDENCE_DIR is required}
date -Iseconds > "$evidence_dir/${label}.started"
printf '%q ' "$@" > "$evidence_dir/${label}.command"
printf '\n' >> "$evidence_dir/${label}.command"
"$@" > >(tee "$evidence_dir/${label}.stdout") 2> >(tee "$evidence_dir/${label}.stderr" >&2)
code=$?
printf '%s\n' "$code" > "$evidence_dir/${label}.exit"
date -Iseconds > "$evidence_dir/${label}.finished"
exit "$code"
```

各 case で `EVIDENCE_DIR` を絶対 path に設定する。すべての command、stdout、stderr、exit code、開始・終了時刻、fallback、再試行、計画との差を `$RUN_DIR/execution-log.md` に時系列で記録する。意図的失敗だけ `set +e` で囲み、直後に期待 exit code を assertion する。file 一覧は `find ... -type f -print | LC_ALL=C sort`、fixture source は `shasum -a 256` で記録する。公開前に絶対 path は `$WORK` へ置換する。

## 手順 1: npm 11.18.x と 12.0.x を隔離取得する（30分）

まず version metadata を保存し、各 minor で得られた最高 patch を exact version としてこの run に固定する。

```bash
export npm_config_cache="$WORK/.cache/npm-bootstrap"
npm view 'npm@11.18' version --json > evidence/npm11-candidates.json
npm view 'npm@12.0' version --json > evidence/npm12-candidates.json
npm view npm dist-tags --json > evidence/npm-dist-tags.json
NPM11_VERSION="$(jq -r 'if type == "array" then .[-1] else . end' evidence/npm11-candidates.json)"
NPM12_VERSION="$(jq -r 'if type == "array" then .[-1] else . end' evidence/npm12-candidates.json)"
LATEST_VERSION="$(jq -r '.latest' evidence/npm-dist-tags.json)"
printf '%s\n' "$NPM11_VERSION" | grep -Eq '^11\.18\.[0-9]+$'
printf '%s\n' "$NPM12_VERSION" | grep -Eq '^12\.0\.[0-9]+$'
test "$LATEST_VERSION" = "$NPM12_VERSION"
npm view "npm@$NPM11_VERSION" dist.integrity > evidence/npm11-registry-integrity.txt
npm view "npm@$NPM12_VERSION" dist.integrity > evidence/npm12-registry-integrity.txt
npm pack "npm@$NPM11_VERSION" --pack-destination tools > evidence/npm11-pack-filename.txt
npm pack "npm@$NPM12_VERSION" --pack-destination tools > evidence/npm12-pack-filename.txt
mkdir tools/npm11 tools/npm12
tar -xzf "tools/$(tail -n 1 evidence/npm11-pack-filename.txt)" -C tools/npm11 --strip-components=1
tar -xzf "tools/$(tail -n 1 evidence/npm12-pack-filename.txt)" -C tools/npm12 --strip-components=1
shasum -a 256 tools/*.tgz > evidence/npm-cli-tarball-sha256.txt
NODE_BIN="$(command -v node)"
NPM11_CLI="$WORK/tools/npm11/bin/npm-cli.js"
NPM12_CLI="$WORK/tools/npm12/bin/npm-cli.js"
export NODE_BIN NPM11_CLI NPM12_CLI
export EVIDENCE_DIR="$WORK/evidence"
tools/run-recorded.sh 00-node-version "$NODE_BIN" --version
tools/run-recorded.sh 01-npm11-version "$NODE_BIN" "$NPM11_CLI" --version
tools/run-recorded.sh 02-npm12-version "$NODE_BIN" "$NPM12_CLI" --version
test "$(cat evidence/01-npm11-version.stdout)" = "$NPM11_VERSION"
test "$(cat evidence/02-npm12-version.stdout)" = "$NPM12_VERSION"
uname -s > evidence/os.txt
uname -m > evidence/arch.txt
```

engine error の場合だけ `docker pull node:26-bookworm` を記録し、image digest と `docker run --rm node:26-bookworm node --version` を保存する。後続 npm command は `docker run --rm -u "$(id -u):$(id -g)" -e NO_COLOR=1 -e npm_config_update_notifier=false -e npm_config_fund=false -e npm_config_audit=false -v "$WORK:/work" -w <case-path-under-/work> node:26-bookworm node /work/tools/npm11/bin/npm-cli.js ...` または npm12 CLI に置き換える。bind mount、image version、npm CLI version gate のいずれかが失敗したら停止する。host npm 10 へは切り替えない。

## 手順 2: 無害な fixture を作る（35分）

`fixtures/fixture-installer/package.json`、`postinstall.cjs`、`index.cjs` を `apply_patch` で作る。

```json
{
  "name": "fixture-installer",
  "version": "1.0.0",
  "main": "index.cjs",
  "scripts": { "postinstall": "node postinstall.cjs" }
}
```

```js
// postinstall.cjs
require("node:fs").writeFileSync("postinstall-marker.txt", "fixture-installer@1.0.0\n", "utf8");
```

```js
// index.cjs
const fs = require("node:fs");
const path = require("node:path");
exports.status = () => ({
  marker: fs.existsSync(path.join(__dirname, "postinstall-marker.txt")),
  content: fs.existsSync(path.join(__dirname, "postinstall-marker.txt"))
    ? fs.readFileSync(path.join(__dirname, "postinstall-marker.txt"), "utf8").trim()
    : null
});
```

同じ構造の `fixtures/fixture-denied` も作る。package name は `fixture-denied`、version は `1.0.0`、marker 名は `denied-marker.txt`、固定内容は `fixture-denied@1.0.0\n` とする。app template は次の 3 file とする。

```json
{
  "name": "allow-scripts-app",
  "version": "1.0.0",
  "private": true,
  "scripts": { "test": "node test.cjs" },
  "dependencies": { "fixture-installer": "file:../../fixtures/fixture-installer" }
}
```

```js
// test.cjs
const assert = require("node:assert/strict");
const { status } = require("fixture-installer");
const actual = status();
console.log(JSON.stringify(actual));
assert.deepEqual(actual, { marker: true, content: "fixture-installer@1.0.0" });
```

```js
// observe.cjs
const { status } = require("fixture-installer");
console.log(JSON.stringify(status()));
```

template を baseline 2 件へ複製し、source hash が一致することを確認する。

```bash
mkdir -p fixtures/app-template
# 上記 package.json、test.cjs、observe.cjs は apply_patch で fixtures/app-template に作る
cp -R fixtures/app-template cases/npm11-baseline
cp -R fixtures/app-template cases/npm12-baseline
(cd fixtures && find fixture-installer fixture-denied app-template -type f -print | LC_ALL=C sort | xargs shasum -a 256) > evidence/fixture-source-sha256.txt
diff -ru cases/npm11-baseline cases/npm12-baseline > evidence/baseline-source.diff || true
test ! -s evidence/baseline-source.diff
```

## 手順 3: npm 11 / 12 の未許可 baseline を比較する（45分）

case ごとに専用 cache を使い、clean state から install する。

```bash
export EVIDENCE_DIR="$WORK/cases/npm11-baseline/evidence"
mkdir -p "$EVIDENCE_DIR"
cd "$WORK/cases/npm11-baseline"
export npm_config_cache="$WORK/.cache/npm11"
../../tools/run-recorded.sh npm11-install "$NODE_BIN" "$NPM11_CLI" install
../../tools/run-recorded.sh npm11-observe "$NODE_BIN" observe.cjs
../../tools/run-recorded.sh npm11-test "$NODE_BIN" "$NPM11_CLI" test
find . -type f -print | LC_ALL=C sort > evidence/files-after.txt
cp package-lock.json evidence/package-lock.json

export EVIDENCE_DIR="$WORK/cases/npm12-baseline/evidence"
mkdir -p "$EVIDENCE_DIR"
cd "$WORK/cases/npm12-baseline"
export npm_config_cache="$WORK/.cache/npm12"
../../tools/run-recorded.sh npm12-install "$NODE_BIN" "$NPM12_CLI" install
../../tools/run-recorded.sh npm12-pending "$NODE_BIN" "$NPM12_CLI" approve-scripts --allow-scripts-pending
../../tools/run-recorded.sh npm12-observe "$NODE_BIN" observe.cjs
set +e
../../tools/run-recorded.sh npm12-test "$NODE_BIN" "$NPM12_CLI" test
code=$?
set -e
test "$code" -ne 0
find . -type f -print | LC_ALL=C sort > evidence/files-after.txt
cp package-lock.json evidence/package-lock.json
```

両 install は exit 0 であることを要求する。npm 11 marker / test と npm 12 marker / test の結果は仮説どおりかを判定するが、差異があっても記録を優先する。npm 12 baseline で marker が生成された場合は安全上停止し、承認手順へ進まない。pending command の exit code や表示形式が想定と異なる場合は `npm help approve-scripts` と `npm approve-scripts --help` を保存し、公式 syntax であることを確認して 1 回だけ修正する。

## 手順 4: version 固定承認と clean reinstall を確認する（45分）

baseline を policy case へ複製し、生成物を除去してから pending、承認、差分を記録する。

```bash
cd "$WORK"
cp -R fixtures/app-template cases/version-pinned
export EVIDENCE_DIR="$WORK/cases/version-pinned/evidence"
mkdir -p "$EVIDENCE_DIR"
cd cases/version-pinned
export npm_config_cache="$WORK/.cache/npm12"
../../tools/run-recorded.sh 10-initial-install "$NODE_BIN" "$NPM12_CLI" install
cp package.json evidence/package.before-approval.json
../../tools/run-recorded.sh 11-pending "$NODE_BIN" "$NPM12_CLI" approve-scripts --allow-scripts-pending
../../tools/run-recorded.sh 12-approve-pinned "$NODE_BIN" "$NPM12_CLI" approve-scripts fixture-installer@1.0.0
cp package.json evidence/package.after-approval.json
diff -u evidence/package.before-approval.json evidence/package.after-approval.json > evidence/approval.diff || true
grep -q 'allowScripts' package.json
rm -rf node_modules
../../tools/run-recorded.sh 13-clean-install "$NODE_BIN" "$NPM12_CLI" install
../../tools/run-recorded.sh 14-observe "$NODE_BIN" observe.cjs
../../tools/run-recorded.sh 15-test "$NODE_BIN" "$NPM12_CLI" test
```

`package.json` の実際の key / value を証拠として判定し、期待 shape を手作業で補わない。version 固定 entry が作られない場合は help と公式 docs を照合し、documented non-interactive syntax を 1 回だけ再実行する。それでも固定できなければこの比較を停止する。

## 手順 5: dependency 1.0.1 への更新と再審査を確認する（45分）

`fixture-installer` source を複製して `fixtures/fixture-installer-1.0.1` とし、version、marker 固定内容、app の dependency path、`test.cjs` の期待内容だけを `1.0.1` へ変更する。変更前後 hash と diff を保存する。case では承認済み policy を維持しつつ local dependency と lockfile を更新する。

```bash
cd "$WORK"
cp -R fixtures/fixture-installer fixtures/fixture-installer-1.0.1
# apply_patch で version、marker 内容を 1.0.1 に変更する
diff -ru fixtures/fixture-installer fixtures/fixture-installer-1.0.1 > evidence/fixture-version-update.diff || true
cp -R cases/version-pinned cases/version-update
rm -rf cases/version-update/node_modules cases/version-update/evidence
mkdir cases/version-update/evidence
# apply_patch で dependency path と test.cjs の期待内容を 1.0.1 に変更する
export EVIDENCE_DIR="$WORK/cases/version-update/evidence"
cd cases/version-update
export npm_config_cache="$WORK/.cache/npm12"
cp package.json evidence/package.before-update-install.json
../../tools/run-recorded.sh 20-update-lock "$NODE_BIN" "$NPM12_CLI" install --package-lock-only
../../tools/run-recorded.sh 21-install-unapproved-update "$NODE_BIN" "$NPM12_CLI" install
../../tools/run-recorded.sh 22-pending-update "$NODE_BIN" "$NPM12_CLI" approve-scripts --allow-scripts-pending
../../tools/run-recorded.sh 23-observe-unapproved "$NODE_BIN" observe.cjs
set +e
../../tools/run-recorded.sh 24-test-unapproved "$NODE_BIN" "$NPM12_CLI" test
code=$?
set -e
test "$code" -ne 0
cp package.json evidence/package.before-reapproval.json
../../tools/run-recorded.sh 25-approve-update "$NODE_BIN" "$NPM12_CLI" approve-scripts fixture-installer@1.0.1
cp package.json evidence/package.after-reapproval.json
diff -u evidence/package.before-reapproval.json evidence/package.after-reapproval.json > evidence/reapproval.diff || true
rm -rf node_modules
../../tools/run-recorded.sh 26-clean-install-approved-update "$NODE_BIN" "$NPM12_CLI" install
../../tools/run-recorded.sh 27-test-approved-update "$NODE_BIN" "$NPM12_CLI" test
```

未承認更新で marker が生成された場合は停止する。pending へ戻らない場合も重要な反証として記録するが、自動継承の理由を推測しない。

## 手順 6: name-only 承認と明示 deny を比較する（50分）

### name-only

1.0.0 template の clean copy で package name だけを承認し、`package.json` の policy を保存する。その policy を保ったまま手順 5 と同じ 1.0.1 local dependency へ更新する。

```bash
cd "$WORK"
cp -R fixtures/app-template cases/name-only
export EVIDENCE_DIR="$WORK/cases/name-only/evidence"
mkdir -p "$EVIDENCE_DIR"
cd cases/name-only
export npm_config_cache="$WORK/.cache/npm12"
../../tools/run-recorded.sh 30-initial-install "$NODE_BIN" "$NPM12_CLI" install
../../tools/run-recorded.sh 31-approve-name "$NODE_BIN" "$NPM12_CLI" approve-scripts fixture-installer
cp package.json evidence/package.name-only.json
rm -rf node_modules
../../tools/run-recorded.sh 32-install-name-approved "$NODE_BIN" "$NPM12_CLI" install
../../tools/run-recorded.sh 33-test-name-approved "$NODE_BIN" "$NPM12_CLI" test
# apply_patch で dependency path と test.cjs の期待内容を 1.0.1 に変更する
rm -rf node_modules
../../tools/run-recorded.sh 34-update-name-only-lock "$NODE_BIN" "$NPM12_CLI" install --package-lock-only
../../tools/run-recorded.sh 35-install-updated-name-only "$NODE_BIN" "$NPM12_CLI" install
../../tools/run-recorded.sh 36-test-updated-name-only "$NODE_BIN" "$NPM12_CLI" test
```

### explicit deny

別 case の dependencies に `fixture-denied` を追加する。installer は version 固定承認し、denied package は明示 deny する。

```bash
cd "$WORK"
cp -R fixtures/app-template cases/explicit-deny
# apply_patch で fixture-denied の file dependency と denied marker 観測を追加する
export EVIDENCE_DIR="$WORK/cases/explicit-deny/evidence"
mkdir -p "$EVIDENCE_DIR"
cd cases/explicit-deny
export npm_config_cache="$WORK/.cache/npm12"
../../tools/run-recorded.sh 40-initial-install "$NODE_BIN" "$NPM12_CLI" install
../../tools/run-recorded.sh 41-pending "$NODE_BIN" "$NPM12_CLI" approve-scripts --allow-scripts-pending
../../tools/run-recorded.sh 42-approve-installer "$NODE_BIN" "$NPM12_CLI" approve-scripts fixture-installer@1.0.0
../../tools/run-recorded.sh 43-deny-other "$NODE_BIN" "$NPM12_CLI" deny-scripts fixture-denied@1.0.0
cp package.json evidence/package.with-allow-and-deny.json
rm -rf node_modules
../../tools/run-recorded.sh 44-clean-install "$NODE_BIN" "$NPM12_CLI" install
../../tools/run-recorded.sh 45-installer-test "$NODE_BIN" "$NPM12_CLI" test
test -f node_modules/fixture-installer/postinstall-marker.txt
test ! -e node_modules/fixture-denied/denied-marker.txt
```

`deny-scripts` syntax が help / official CLI docs と一致しない場合は help を保存し、documented non-interactive syntax で 1 回だけ修正する。blanket approval や `--all` は使わない。時間超過時は explicit deny を省略し、name-only 比較を残す。

## 手順 7: `npm ci` の再現性を確認する（40分）

承認済み 1.0.0 case の `package.json`、lockfile、test / observe source だけを clean copy へ複製する。`node_modules` と cache は複製しない。

```bash
cd "$WORK"
mkdir -p cases/ci-approved cases/ci-no-policy
cp cases/version-pinned/package.json cases/version-pinned/package-lock.json cases/version-pinned/test.cjs cases/version-pinned/observe.cjs cases/ci-approved/
cp -R cases/ci-approved/. cases/ci-no-policy/
# apply_patch で cases/ci-no-policy/package.json から allowScripts policy だけを削除する
export npm_config_cache="$WORK/.cache/npm12"
export EVIDENCE_DIR="$WORK/cases/ci-approved/evidence"
mkdir -p "$EVIDENCE_DIR"
cd cases/ci-approved
../../tools/run-recorded.sh 50-ci-approved "$NODE_BIN" "$NPM12_CLI" ci
../../tools/run-recorded.sh 51-ci-approved-observe "$NODE_BIN" observe.cjs
../../tools/run-recorded.sh 52-ci-approved-test "$NODE_BIN" "$NPM12_CLI" test

export EVIDENCE_DIR="$WORK/cases/ci-no-policy/evidence"
mkdir -p "$EVIDENCE_DIR"
cd ../ci-no-policy
../../tools/run-recorded.sh 53-ci-no-policy "$NODE_BIN" "$NPM12_CLI" ci
../../tools/run-recorded.sh 54-ci-no-policy-observe "$NODE_BIN" observe.cjs
set +e
../../tools/run-recorded.sh 55-ci-no-policy-test "$NODE_BIN" "$NPM12_CLI" test
code=$?
set -e
test "$code" -ne 0
```

`ci-no-policy` で marker が生成された場合は仮説不成立として記録する。`npm ci` 自体が非ゼロなら、script policy と lockfile / manifest 不整合を分けるため stderr と `package.json` diff を確認し、成功扱いしない。

## 観測として保存するもの

- OS / architecture / Node.js / npm 11 / npm 12 の exact version、registry metadata、CLI tarball hash、fallback image digest
- fixture source、version 更新 diff、source hash
- 全 command の内容、stdout、stderr、exit code、開始・終了時刻
- 各条件の warning、pending 一覧、`package.json` の allow / deny policy 差分、lockfile
- npm 11 / 12 未許可、version 固定承認、1.0.1 更新前後、name-only、explicit deny、`npm ci` の marker path / 内容と runtime test
- 各 case の install 前後 file 一覧、cache 分離、retry、fallback、手順省略、公式仕様との差
- 最終的に `npm version × policy × dependency version × install command × exit code × pending × marker × runtime test` を 1 行 1 条件にした TSV または Markdown table

## 成功条件

必須成功条件は次のすべてとする。

1. npm 11.18.x と npm 12.0.x の exact version を固定し、同一 1.0.0 fixture の未許可 install について exit code、warning、marker、runtime test を記録できる。
2. npm 12 の pending 一覧と、version 固定承認による `package.json` 差分、clean reinstall 後の marker / test を記録できる。
3. dependency 1.0.1 更新時に旧固定承認が継承されるか、pending に戻るかを記録し、再承認後の marker / test まで確認できる。
4. name-only 承認または explicit deny の少なくとも一方を version 固定承認と比較できる。
5. 承認 policy あり / なしの clean copy で npm 12 `npm ci` の exit code、marker、runtime test を比較できる。
6. すべてが run directory 内、無料、認証不要、GUI / browser 不使用で完結し、秘密情報を記録していない。

仮説と異なる marker や warning は実験失敗ではなく重要な結果である。ただし marker を観測できないまま script 実行可否を断定すること、exact version を固定できないこと、policy 差分を保存できないことは失敗とする。

## 失敗条件

- npm 11.18.x / 12.0.x を取得・実行できない、npm 12 `latest` gate が成立しない、または npm major を取り違える。
- local package / local tarball のどちらでも pending と承認 policy を観測できない。
- 未承認 npm 12 install が run directory 外へ書く、未知の script を実行する、または第三者 package の承認を要求する。
- baseline install、承認後の clean install、再承認後の install、承認済み `npm ci` のいずれかが成立せず、marker / runtime test の比較ができない。
- version 更新後の dependency source / lockfile を確定できず、1.0.0 と 1.0.1 を区別できない。
- stdout / stderr / exit code、policy 差分、marker のいずれかが欠け、install 成功と script 成功を分離できない。
- run directory 外への変更、credential 混入、費用、手動 signup、GUI、system install が必要になる。

## セキュリティ・コスト制限

- 費用上限は 0 円。npm account、publish、private registry、cloud resource は使わない。
- lifecycle script は `node:fs.writeFileSync` による固定 marker 1 個だけとし、network、shell download、subprocess、native compiler、credential / environment 読み取りを禁止する。
- npm cache、CLI、fixture、policy、marker、証拠を `$WORK` に閉じ込める。global npm、user config、repository config は変更しない。
- `npm config list`、`env`、private URL、token、cookie、personal path を保存しない。log に混入した場合は公開 artifact へ転記する前に伏せる。
- command 出力が予期しない install script、外部接続、run directory 外 path を示した時点で直ちに停止する。

## cleanup

通常は再現用 evidence として `$RUN_DIR` を保持する。cleanup が明示された場合だけ、execution log に対象 path と保持済み evidence を記録し、repository root から次を実行する。

```bash
test -n "${RUN_DIR:-}"
case "$RUN_DIR" in "$REPO"/logs/run-npm12-allow-scripts-*) ;; *) exit 1 ;; esac
rm -rf "$RUN_DIR/work/.cache" "$RUN_DIR/work/cases"/*/node_modules
```

他の `logs/`、research report、practice plan、repository file、global npm は削除・変更しない。Docker fallback を使った場合も image 削除は要求しない。

## timebox

全体を 4〜6 時間で打ち切る。

- 環境 gate / CLI 隔離取得: 30分
- fixture と記録基盤: 35分
- npm 11 / 12 baseline: 45分
- version 固定承認: 45分
- 1.0.1 更新 / 再審査: 45分
- name-only / explicit deny: 50分
- `npm ci`: 40分
- 証拠表、秘密情報 scan、execution log 整理: 50分

6時間を超える場合は explicit deny、次に name-only の追加比較を省略する。baseline、version 固定承認、version 更新、`npm ci` は省略しない。これら必須範囲が成立しなければ未完了として終了する。

## fallback scope

1. npm CLI が host Node.js の engine gate で動かない場合だけ公式 `node:26-bookworm` image を使用する。browser、Homebrew、global install には切り替えない。
2. `file:` dependency が policy 対象外なら、自作 package を local tarball 化して 1 回だけやり直す。第三者 package、Git dependency、remote tarball へは広げない。
3. JSON output が未提供なら human-readable pending output と `package.json` diff を保存する。非公開 option や output parser を推測しない。
4. explicit deny が CLI syntax / timebox で成立しなければ name-only 比較だけを残す。両方できなければ成功条件 4 を満たさない。
5. native addon、暗黙の `node-gyp rebuild`、Git / remote dependency、global / `npx` は公式仕様の未検証事項として execution log に明記し、実験へ追加しない。

## 想定する記事の要点

- npm 12 の install 成功と install script 実行成功は別に観測する必要があり、marker と runtime test が不足を可視化する。
- pending 確認、version 固定承認、dependency 更新時の再審査を一続きにすると、`allowScripts` の trust boundary を具体的に説明できる。
- name-only と version 固定の差は、将来 version を自動的に信頼するかという運用上の trade-off になる。
- `package.json` の policy と lockfile を揃えた `npm ci` の実測により、local 開発だけでなく CI での再現条件を示せる。
- 結論は exact npm version と自作 fixture の観測範囲に限定し、native addon や第三者 package は未検証と明記する。
