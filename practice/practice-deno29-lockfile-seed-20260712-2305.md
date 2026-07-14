# Deno 2.9 の package-lock seed と `deno ci` を対照検証する実践計画

## Source report

- 入力: `research/search-topic-20260712-2301.md`
- 選定テーマ: 小さな npm/Node.js fixture の `package-lock.json` から Deno 2.9 が生成する `deno.lock`について、直接・推移依存の version と integrity、実行互換、lockfile drift 時の `deno ci` の失敗、npm への rollback を同一 fixture で対照検証する。
- この計画は上記レポートの選定テーマだけを扱う。snapshot testing、minimum dependency age、browser UI は検証しない。

## Objective

Deno 2.9.0 を隔離取得し、固定した npm fixture に対して次を再現可能な証拠として残す。

1. `package-lock.json` だけがある状態での初回 `deno install` の実出力と生成ファイル。
2. npm lock と Deno lock に記録された direct/transitive dependency の package、version、integrity の正規化比較。
3. `node`、`npm test`、`deno task test`、`deno ci` 後の test の exit code と出力。
4. `package.json` だけを変更した drift に対して `deno ci` が非 0 で止まるか。
5. `deno.lock` を除去して元の `package-lock.json` から `npm ci` に戻せるか。

単一 fixture の結果をすべての npm project に一般化せず、観測値、公式仕様、解釈を分離する。

## Hypothesis

- H1: Deno 2.9.0 の初回 `deno install` は既存 `package-lock.json` を seed として `deno.lock` を生成する。
- H2: fixture の direct dependency と transitive dependencies は、package/version と正規化可能な integrity algorithm/value が npm baseline と一致する。
- H3: 同じ fixture の test は `npm test` と `deno task test` で成功し、`deno ci` による再構築後も成功する。
- H4: `package.json` の依存 version だけを変更して `deno.lock` を更新しない場合、`deno ci` は非 0 で終了する。
- H5: `deno.lock` と Deno が作った `node_modules` を除去し、保存済み `package-lock.json` で `npm ci` を行えば baseline test が再度成功する。

H1〜H5 の一つでも観測と異なれば、仮説を守るために操作や出力を読み替えず、その不一致を結果として残す。

## Environment

計画時の read-only 観測（2026-07-12 23:05 JST）:

- sandbox mode: `danger-full-access`（run を含む全段階）
- OS/architecture: macOS (`Darwin`) / `arm64`
- Deno: `/opt/homebrew/bin/deno`, `2.8.3`（対象外なので検証には使わない）
- Node.js: `/usr/local/bin/node`, `v22.17.1`
- npm: `/usr/local/bin/npm`, `10.9.2`
- 利用可能: `curl`, `shasum`, `unzip`, `jq`, `git`, `diff`, `cmp`

run では Deno 2.9.0 の公式 release archive を `work/tools/` に取得し、その絶対 path だけを使う。Homebrew の Deno を upgrade しない。`danger-full-access` のため real browser と Playwright の起動自体は禁止しないが、この CLI テーマには不要なので計画に含めない。途中で browser 検証を追加してはならない。後続判断で必須になった場合は、launch と context 作成を capability gate とし、失敗時は結果を推測せず run を停止する。

## Prerequisites and capability gates

- 無料・認証不要の public npm registry と `dl.deno.land` だけへ通信する。
- Deno は `2.9.0` に固定する。取得、checksum 検証、展開、version gate のどれかが失敗したら停止する。
- npm registry gate は `npm view string-width@7.2.0 version --json` を最大2回だけ実行する。2回とも失敗、または返値が `"7.2.0"` でなければ停止する。
- fixture は `string-width@7.2.0` 一件だけを direct dependency にする。生成された `package-lock.json` に transitive dependency が一件もなければ fixture 不適合として停止する。
- `npm ci --ignore-scripts` を使う。依存 graph が install script、native build、認証付き registry を要求する兆候があれば、別 package を推測で追加せず停止する。
- Deno lock parser が実際の schema を認識できなければ raw lockfile を保存したまま parser を一度だけ修正してよい。ただし package/version/integrity の direct/transitive 双方を2時間以内に抽出できなければ核心未達として停止する。
- capability gate の失敗は検証結果の fail ではなく run の blocker として execution log に記録する。古い Deno、cache、公式記事から結果を補完しない。

## Isolation directory

run の全生成物は、新規の `logs/run-deno29-lockfile-seed-<timestamp>/work/` 以下に置く。repository 直下の既存ファイル、lockfile、`node_modules`、記事、practice plan は変更しない。Git branch、commit、stash、checkout は行わない。

run 開始時に repository root で、同じ shell session 内から次を実行する。

```sh
set -eu
RUN_TS="$(date '+%Y%m%d-%H%M%S')"
RUN_DIR="$PWD/logs/run-deno29-lockfile-seed-$RUN_TS"
WORK_DIR="$RUN_DIR/work"
test ! -e "$RUN_DIR"
mkdir -p "$WORK_DIR"/{tools,evidence,fixture-npm,fixture-deno,branches,scripts}
export RUN_DIR WORK_DIR
```

以後、すべての command は `$WORK_DIR` 以下を cwd または出力先にする。

## Ordered steps and commands

### 0. 環境記録と Deno 2.9.0 gate（20分）

環境値を保存する。ここでは system Deno の version は比較情報としてだけ記録し、後続 command では使わない。

```sh
cd "$WORK_DIR"
{
  date -u '+utc=%Y-%m-%dT%H:%M:%SZ'
  date '+local=%Y-%m-%dT%H:%M:%S%z'
  printf 'cwd=%s\n' "$PWD"
  uname -a
  command -v node
  node --version
  command -v npm
  npm --version
  command -v deno || true
  deno --version || true
} > evidence/environment.txt 2>&1

DENO_ARCHIVE="deno-aarch64-apple-darwin.zip"
curl --fail --location --retry 1 --retry-delay 2 \
  --output "tools/$DENO_ARCHIVE" \
  "https://dl.deno.land/release/v2.9.0/$DENO_ARCHIVE"
curl --fail --location --retry 1 --retry-delay 2 \
  --output "tools/$DENO_ARCHIVE.sha256sum" \
  "https://dl.deno.land/release/v2.9.0/$DENO_ARCHIVE.sha256sum"
(cd tools && shasum -a 256 -c "$DENO_ARCHIVE.sha256sum") \
  > evidence/deno-checksum.txt 2>&1
unzip -q "tools/$DENO_ARCHIVE" -d tools/deno-2.9.0
chmod u+x tools/deno-2.9.0/deno
DENO_BIN="$WORK_DIR/tools/deno-2.9.0/deno"
export DENO_BIN
"$DENO_BIN" --version > evidence/deno-target-version.txt 2>&1
grep -Eq '^deno 2\.9\.0 ' evidence/deno-target-version.txt
```

npm registry gate は2回を上限とし、成功した response を保存する。

```sh
set +e
npm view string-width@7.2.0 version --json \
  > evidence/npm-registry-gate-1.stdout 2> evidence/npm-registry-gate-1.stderr
REGISTRY_RC=$?
set -e
if [ "$REGISTRY_RC" -ne 0 ]; then
  set +e
  npm view string-width@7.2.0 version --json \
    > evidence/npm-registry-gate-2.stdout 2> evidence/npm-registry-gate-2.stderr
  REGISTRY_RC=$?
  set -e
  test "$REGISTRY_RC" -eq 0
  REGISTRY_OUT=evidence/npm-registry-gate-2.stdout
else
  REGISTRY_OUT=evidence/npm-registry-gate-1.stdout
fi
test "$(jq -r '.' "$REGISTRY_OUT")" = '7.2.0'
```

各検証 command の cwd、時刻、exit code、stdout、stderr を分離保存する helper を作る。第1引数は label、第2引数は期待種別（`zero` または `nonzero`）、残りが command である。

```sh
cat > scripts/run-and-record.sh <<'SH'
#!/bin/sh
set -u
label=$1
expect=$2
shift 2
evidence_dir=${EVIDENCE_DIR:?EVIDENCE_DIR is required}
mkdir -p "$evidence_dir"
meta="$evidence_dir/$label.meta"
stdout="$evidence_dir/$label.stdout"
stderr="$evidence_dir/$label.stderr"
{
  printf 'cwd=%s\n' "$PWD"
  printf 'start_utc=%s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  printf 'command='
  printf '%s ' "$@"
  printf '\n'
} > "$meta"
"$@" > "$stdout" 2> "$stderr"
rc=$?
{
  printf 'end_utc=%s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  printf 'exit_code=%s\n' "$rc"
  printf 'expected=%s\n' "$expect"
} >> "$meta"
case "$expect" in
  zero) test "$rc" -eq 0 ;;
  nonzero) test "$rc" -ne 0 ;;
  *) printf 'invalid expectation: %s\n' "$expect" >&2; exit 2 ;;
esac
SH
chmod u+x scripts/run-and-record.sh
```

### 1. npm baseline fixture（45分）

fixture を決定的に作る。

```sh
cd "$WORK_DIR/fixture-npm"
cat > package.json <<'JSON'
{
  "name": "deno29-lockfile-seed-fixture",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node src/index.js",
    "test": "node --test"
  },
  "dependencies": {
    "string-width": "7.2.0"
  }
}
JSON
mkdir -p src test
cat > src/index.js <<'JS'
import stringWidth from "string-width";

const sample = "A界🙂";
console.log(JSON.stringify({ sample, width: stringWidth(sample) }));
JS
cat > test/index.test.js <<'JS'
import test from "node:test";
import assert from "node:assert/strict";
import stringWidth from "string-width";

test("ASCII, full-width, and emoji width", () => {
  assert.equal(stringWidth("A界🙂"), 5);
});
JS

export EVIDENCE_DIR="$WORK_DIR/evidence/npm-baseline"
"$WORK_DIR/scripts/run-and-record.sh" npm-install zero \
  npm install --package-lock-only --ignore-scripts --no-audit --no-fund
cp package-lock.json "$WORK_DIR/evidence/package-lock.baseline.json"
"$WORK_DIR/scripts/run-and-record.sh" npm-ci zero \
  npm ci --ignore-scripts --no-audit --no-fund
"$WORK_DIR/scripts/run-and-record.sh" node-entry zero node src/index.js
"$WORK_DIR/scripts/run-and-record.sh" npm-test zero npm test
"$WORK_DIR/scripts/run-and-record.sh" node-test zero node --test
npm ls --all --json > "$WORK_DIR/evidence/npm-baseline-tree.json"
```

npm lock の全 registry package を package/name/version/integrity に正規化する。重複 package version を path で区別する必要が生じた場合は核心比較を停止し、parser 修正の可否を判断する。

```sh
cat > "$WORK_DIR/scripts/extract-npm-lock.mjs" <<'JS'
import fs from "node:fs";

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error("usage: extract-npm-lock.mjs INPUT OUTPUT");
const lock = JSON.parse(fs.readFileSync(input, "utf8"));
if (!lock.packages || typeof lock.packages !== "object") {
  throw new Error("unsupported package-lock schema: packages is missing");
}
const rows = [];
for (const [path, item] of Object.entries(lock.packages)) {
  if (!path.startsWith("node_modules/") || !item.version) continue;
  const marker = "/node_modules/";
  const tail = path.includes(marker) ? path.slice(path.lastIndexOf(marker) + marker.length) : path.slice("node_modules/".length);
  const name = item.name ?? tail;
  rows.push({ name, version: item.version, integrity: item.integrity ?? null, path });
}
rows.sort((a, b) => `${a.name}@${a.version}:${a.path}`.localeCompare(`${b.name}@${b.version}:${b.path}`));
if (rows.length < 2) throw new Error("fixture lacks a direct plus transitive dependency graph");
fs.writeFileSync(output, `${JSON.stringify(rows, null, 2)}\n`);
JS
node "$WORK_DIR/scripts/extract-npm-lock.mjs" \
  package-lock.json "$WORK_DIR/evidence/npm-lock.normalized.json"
jq -e '[.[] | select(.name == "string-width" and .version == "7.2.0")] | length == 1' \
  "$WORK_DIR/evidence/npm-lock.normalized.json" > /dev/null
jq -e 'length >= 2 and all(.[]; .integrity != null)' \
  "$WORK_DIR/evidence/npm-lock.normalized.json" > /dev/null
```

### 2. Deno 2.9 初回 seed（55分）

npm baseline を複製し、`node_modules` と `deno.lock` がない状態を証拠化してから一度だけ初回 install を行う。

```sh
cd "$WORK_DIR"
cp -R fixture-npm/. fixture-deno/
rm -rf fixture-deno/node_modules fixture-deno/deno.lock
find fixture-deno -maxdepth 2 -type f -print | LC_ALL=C sort \
  > evidence/deno-before-files.txt
test -f fixture-deno/package-lock.json
test ! -e fixture-deno/deno.lock
test ! -e fixture-deno/node_modules

cd fixture-deno
export EVIDENCE_DIR="$WORK_DIR/evidence/deno-seed"
"$WORK_DIR/scripts/run-and-record.sh" deno-install-first zero \
  "$DENO_BIN" install
test -f deno.lock
find . -maxdepth 2 -type f -print | LC_ALL=C sort \
  > "$WORK_DIR/evidence/deno-after-files.txt"
cp deno.lock "$WORK_DIR/evidence/deno.lock.first.json"
shasum -a 256 deno.lock > "$WORK_DIR/evidence/deno.lock.first.sha256"
```

実出力の seed 文言は stdout/stderr に存在する文言だけを採用し、期待文言へ言い換えない。Deno lock はまず schema を保存・観察し、Deno 2.9 の `npm` object から package/version/integrity を抽出する。

```sh
jq '{version, top_level_keys: (keys | sort), npm_entry_count: ((.npm // {}) | length)}' deno.lock \
  > "$WORK_DIR/evidence/deno-lock-schema-summary.json"
cat > "$WORK_DIR/scripts/extract-deno-lock.mjs" <<'JS'
import fs from "node:fs";

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error("usage: extract-deno-lock.mjs INPUT OUTPUT");
const lock = JSON.parse(fs.readFileSync(input, "utf8"));
if (!lock.npm || typeof lock.npm !== "object" || Array.isArray(lock.npm)) {
  throw new Error("unsupported deno.lock schema: npm object is missing");
}
const parseKey = (key) => {
  const match = key.match(/^(@[^/]+\/[^@]+|[^@]+)@([^_]+)(?:_.*)?$/);
  if (!match) throw new Error(`unsupported npm lock key: ${key}`);
  return { name: match[1], version: match[2] };
};
const rows = Object.entries(lock.npm).map(([key, item]) => {
  const { name, version } = parseKey(key);
  return { name, version, integrity: item.integrity ?? null, key };
});
rows.sort((a, b) => `${a.name}@${a.version}:${a.key}`.localeCompare(`${b.name}@${b.version}:${b.key}`));
if (rows.length < 2) throw new Error("Deno lock lacks the expected dependency graph");
fs.writeFileSync(output, `${JSON.stringify(rows, null, 2)}\n`);
JS
node "$WORK_DIR/scripts/extract-deno-lock.mjs" \
  deno.lock "$WORK_DIR/evidence/deno-lock.normalized.json"
jq -e 'length >= 2 and all(.[]; .integrity != null)' \
  "$WORK_DIR/evidence/deno-lock.normalized.json" > /dev/null
```

比較 script は lock 固有の path/key を除外し、package/name/version/integrity の集合を比較する。integrity 表現が異なる場合は文字列差だけで dependency 変更と断定せず、algorithm と base64 digest に分けて一度だけ正規化を修正する。正規化不能な行は `unverified` として成功条件から外す。

```sh
cat > "$WORK_DIR/scripts/compare-locks.mjs" <<'JS'
import fs from "node:fs";

const [npmPath, denoPath, output] = process.argv.slice(2);
const npmRows = JSON.parse(fs.readFileSync(npmPath, "utf8"));
const denoRows = JSON.parse(fs.readFileSync(denoPath, "utf8"));
const compact = (rows) => rows.map(({ name, version, integrity }) => ({ name, version, integrity }))
  .sort((a, b) => `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`));
const npm = compact(npmRows);
const deno = compact(denoRows);
const result = {
  npm,
  deno,
  packageVersionEqual: JSON.stringify(npm.map(({ name, version }) => ({ name, version }))) === JSON.stringify(deno.map(({ name, version }) => ({ name, version }))),
  integrityEqual: JSON.stringify(npm) === JSON.stringify(deno)
};
fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
if (!result.packageVersionEqual || !result.integrityEqual) process.exitCode = 1;
JS
set +e
node "$WORK_DIR/scripts/compare-locks.mjs" \
  "$WORK_DIR/evidence/npm-lock.normalized.json" \
  "$WORK_DIR/evidence/deno-lock.normalized.json" \
  "$WORK_DIR/evidence/lock-comparison.json"
COMPARE_RC=$?
set -e
printf 'exit_code=%s\n' "$COMPARE_RC" > "$WORK_DIR/evidence/lock-comparison.meta"
```

`COMPARE_RC != 0` は隠さず H2 の fail 候補として保持する。schema/parser の問題でなく実データの不一致なら修正せず次の独立した観測へ進む。

### 3. 実行互換と再現性（50分）

初回 seed 後の同一 fixture で各入口を記録し、2回目 install 前後の lockfile hash を比較する。

```sh
cd "$WORK_DIR/fixture-deno"
export EVIDENCE_DIR="$WORK_DIR/evidence/runtime-compat"
"$WORK_DIR/scripts/run-and-record.sh" node-entry zero node src/index.js
"$WORK_DIR/scripts/run-and-record.sh" npm-test zero npm test
"$WORK_DIR/scripts/run-and-record.sh" deno-task-test zero \
  "$DENO_BIN" task test
cp deno.lock "$WORK_DIR/evidence/deno.lock.before-second.json"
"$WORK_DIR/scripts/run-and-record.sh" deno-install-second zero \
  "$DENO_BIN" install
cp deno.lock "$WORK_DIR/evidence/deno.lock.after-second.json"
set +e
cmp -s "$WORK_DIR/evidence/deno.lock.before-second.json" \
  "$WORK_DIR/evidence/deno.lock.after-second.json"
SECOND_LOCK_RC=$?
set -e
printf 'exit_code=%s\n' "$SECOND_LOCK_RC" \
  > "$WORK_DIR/evidence/second-install-lock-compare.meta"
diff -u "$WORK_DIR/evidence/deno.lock.before-second.json" \
  "$WORK_DIR/evidence/deno.lock.after-second.json" \
  > "$WORK_DIR/evidence/second-install-lock.diff" || true

rm -rf node_modules
"$WORK_DIR/scripts/run-and-record.sh" deno-ci-clean zero \
  "$DENO_BIN" ci
"$WORK_DIR/scripts/run-and-record.sh" npm-test-after-deno-ci zero npm test
"$WORK_DIR/scripts/run-and-record.sh" deno-task-after-deno-ci zero \
  "$DENO_BIN" task test
```

test の stdout、test件数、exit code を比較する。所要時間は記録しても性能比較には使わない。

### 4. drift 負例と npm rollback（55分）

成功状態を二つの branch directory に複製し、一方の変更が他方へ伝播しないようにする。

```sh
cd "$WORK_DIR"
cp -R fixture-deno/. branches/drift/
cp -R fixture-deno/. branches/rollback/
```

branch A は `package.json` だけを `7.2.0` から `7.1.0` へ変え、lockfile を一切更新せず `deno ci` の非 0 を期待する。変更前後と lockfile hash を保存する。

```sh
cd "$WORK_DIR/branches/drift"
cp package.json "$WORK_DIR/evidence/drift-package.before.json"
cp deno.lock "$WORK_DIR/evidence/drift-deno.lock.before.json"
node -e 'const fs=require("node:fs"); const p=JSON.parse(fs.readFileSync("package.json","utf8")); if(p.dependencies["string-width"]!=="7.2.0") throw new Error("unexpected baseline"); p.dependencies["string-width"]="7.1.0"; fs.writeFileSync("package.json", JSON.stringify(p,null,2)+"\n")'
cp package.json "$WORK_DIR/evidence/drift-package.after.json"
export EVIDENCE_DIR="$WORK_DIR/evidence/drift"
"$WORK_DIR/scripts/run-and-record.sh" deno-ci-drift nonzero \
  "$DENO_BIN" ci
shasum -a 256 deno.lock > "$WORK_DIR/evidence/drift-deno.lock.after.sha256"
diff -u "$WORK_DIR/evidence/drift-deno.lock.before.json" deno.lock \
  > "$WORK_DIR/evidence/drift-deno.lock.diff" || true
```

期待に反して exit code 0 なら helper が非 0 で止める。その事実と raw output を H4 fail として残し、別の drift を追加して成功を作らない。

branch B は Deno lock と modules を除去し、保存された npm lock が baseline と同一であることを確認して rollback する。

```sh
cd "$WORK_DIR/branches/rollback"
cmp -s package-lock.json "$WORK_DIR/evidence/package-lock.baseline.json"
rm -rf deno.lock node_modules
test ! -e deno.lock
export EVIDENCE_DIR="$WORK_DIR/evidence/rollback"
"$WORK_DIR/scripts/run-and-record.sh" npm-ci-rollback zero \
  npm ci --ignore-scripts --no-audit --no-fund
"$WORK_DIR/scripts/run-and-record.sh" npm-test-rollback zero npm test
"$WORK_DIR/scripts/run-and-record.sh" node-entry-rollback zero node src/index.js
cmp -s package-lock.json "$WORK_DIR/evidence/package-lock.baseline.json"
```

### 5. 証拠整理（50分）

raw evidence を削除せず、機械判定 summary と全ファイル manifest を作る。

```sh
cd "$WORK_DIR"
node - <<'JS' > evidence/summary.json
const fs = require("node:fs");
const readRc = (path) => Number(fs.readFileSync(path, "utf8").match(/exit_code=(\d+)/)?.[1]);
const cmpRc = readRc("evidence/lock-comparison.meta");
const secondRc = readRc("evidence/second-install-lock-compare.meta");
const driftMeta = fs.readFileSync("evidence/drift/deno-ci-drift.meta", "utf8");
const driftRc = Number(driftMeta.match(/exit_code=(\d+)/)?.[1]);
const summary = {
  denoVersionGate: /^deno 2\.9\.0 /m.test(fs.readFileSync("evidence/deno-target-version.txt", "utf8")),
  lockPackageVersionAndIntegrityEqual: cmpRc === 0,
  secondInstallKeptLockByteIdentical: secondRc === 0,
  driftCiExitedNonzero: Number.isInteger(driftRc) && driftRc !== 0,
  rollbackTestExitedZero: readRc("evidence/rollback/npm-test-rollback.meta") === 0,
  scope: "one fixed pure-JavaScript fixture; no native addon, lifecycle script, private registry, workspace, offline, browser, or performance claim"
};
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
JS
find . -type f -print | LC_ALL=C sort > evidence/file-manifest.txt
shasum -a 256 \
  evidence/package-lock.baseline.json \
  evidence/deno.lock.first.json \
  evidence/npm-lock.normalized.json \
  evidence/deno-lock.normalized.json \
  evidence/lock-comparison.json \
  evidence/summary.json \
  > evidence/core-evidence.sha256
```

最後に `logs/run-deno29-lockfile-seed-<timestamp>/execution-log.md` を作成し、各 command の実行順、cwd、開始終了時刻、exit code、stdout/stderr path、capability gate、観測、仮説ごとの pass/fail/unverified、停止理由を evidence file への相対 path とともに記載する。記事本文は書かない。

## Observations to capture

- OS、architecture、Node/npm/system Deno/target Deno の version と executable path。
- Deno archive の URL、checksum 検証結果、npm registry gate の試行回数と raw response。
- 初回 `deno install` 前後の file list、stdout、stderr、exit code、実際の seed 関連文言。
- npm/Deno lock の raw file、schema summary、正規化 JSON、package/version/integrity の比較結果。
- direct dependency `string-width@7.2.0` と一件以上の transitive dependency が双方の lock に存在するか。
- Node entry、npm test、`deno task test`、clean `deno ci`、再 test の exit code と stdout/stderr。
- 2回目 `deno install` 前後の byte comparison、hash、diff。
- drift 前後の `package.json`、`deno ci` の非 0 exit、diagnostic、実行後の lock diff。
- rollback 前後の npm lock の byte comparison と test 結果。
- 仮説と異なる観測、parser で正規化不能だった項目、未確認範囲。

## Success criteria

検証全体を成功とするには、次のすべてを満たす。

1. checksum 済みの isolated Deno が正確に `2.9.0` と記録される。
2. npm registry gate、fixture 作成、npm baseline test が成功する。
3. npm lock と Deno lock の両方から direct/transitive dependency を抽出し、package/version/integrity の比較が機械的に exit 0 を返す。
4. 初回 seed の raw output と生成 file が残り、2回目 install で `deno.lock` が byte-identical である。
5. `npm test`、`deno task test`、clean `deno ci` 後の再 test がすべて exit 0 になる。
6. drift branch の `deno ci` が非 0 になり、diagnostic が保存される。
7. rollback branch の npm lock が baseline と一致し、`npm ci` と test が exit 0 になる。
8. 全 command の cwd、時刻、exit code、stdout/stderr と証拠 manifest が execution log から追跡できる。

## Failure and stop criteria

- Deno 2.9.0 の取得、checksum、展開、version gate が失敗する。
- npm registry gate が2回失敗する、または対象 version を返さない。
- fixture が direct + transitive graph を作れない、install script/native build/authentication を要求する。
- 初回 `deno install` が非 0、または `deno.lock` を生成しない。
- 2時間以内に両 lock の direct/transitive package/version/integrity を正規化できない。
- browser を追加で必須化した場合に browser launch または context 作成が失敗する。この場合は過去結果や静的推測で補わず停止する。
- 上記 capability failure は run blocker。これに対し、lock の不一致、test failure、2回目 install の lock 変更、drift での exit 0、rollback failure は重要な反証結果として raw evidence を保持し、成功扱いにしない。
- 4時間15分を超えたら新しい検証を開始しない。integrity 比較または drift 負例が未確認なら核心未達として停止する。

## Security and cost limits

- 費用上限は0円。account、API key、OAuth、CAPTCHA、cloud service は使わない。
- network destination は `https://dl.deno.land/` と public npm registry、および依存 tarball の public registry host に限定する。
- `sudo`、`brew install/upgrade`、global npm install、system file の変更、Docker、Git 操作を行わない。
- dependency lifecycle script は `--ignore-scripts` で無効化する。native addon と private registry は対象外。
- credential、environment secret、home directory の内容を収集しない。環境記録は version/path/OS/architecture に限定する。
- repository 既存成果物を fixture にせず、全 write と cleanup は新規 run directory 以下に限定する。
- download retry は各 `curl` 1回、npm registry gate は合計2回まで。無制限 retry をしない。

## Cleanup

証拠確認と後続 draft が完了するまでは run directory を保持する。cleanup が明示的に承認された場合だけ、repository root で対象 path と prefix を検証してから run directory 一つを削除する。

```sh
case "$RUN_DIR" in
  "$PWD"/logs/run-deno29-lockfile-seed-*) ;;
  *) printf 'refusing cleanup for unexpected path: %s\n' "$RUN_DIR" >&2; exit 1 ;;
esac
test -d "$RUN_DIR/work"
rm -rf -- "$RUN_DIR"
```

system Deno、Node/npm、global cache、repository の他の logs は cleanup 対象にしない。

## Timebox

- 環境・capability gate: 20分
- npm baseline fixture: 45分
- Deno 初回 seed と lock 比較: 55分
- 実行互換と再現性: 50分
- drift 負例と rollback: 55分
- 証拠整理: 50分
- 合計: 4時間15分

各枠を超過したら execution log に理由を残す。全体が4時間15分に達した時点で scope を広げず、未確認を明示して終了する。

## Fallback scope

- Deno 2.9.0、network、checksum、fixture graph の gate を満たせない場合は fallback 実行をしない。Deno 2.8.3、別 runtime、cache、公式記事の記述で結果を代用しない。
- lock schema 差だけが原因なら、raw file を保持したうえで extractor を一度だけ実 schema に合わせて修正できる。値そのものは編集しない。
- integrity の表記差は algorithm/value に正規化できた範囲だけ判定し、正規化不能ならその項目を `unverified` にする。「不一致」または「一致」と推測しない。
- lock 比較で実不一致が出ても、実行互換、drift、rollback は独立観測として時間内に継続できる。ただし全体成功にはしない。
- browser/UI、snapshot test、minimum dependency age、offline/vendor、performance、workspace、native addon、lifecycle script、private registry へ範囲を広げない。

## Expected article takeaways

実行が完了した場合、記事化で扱えるのは記録された証拠に基づく次の論点だけである。

- `package-lock.json` しかない固定 fixture に Deno 2.9.0 を初回適用したとき、実際に何が生成・変更され、どのメッセージが出たか。
- direct/transitive dependency の version と integrity が npm/Deno lock 間で一致したか、不一致または未確認だったか。
- Node/npm script/`deno task`/`deno ci` のどこまで同じ fixture が動いたか。
- drift 時に `deno ci` がどう停止したか、または停止しなかったか。
- npm baseline へ戻す操作が実測上可逆だったか。
- 一 fixture では判断できない native addon、lifecycle script、private registry、workspace、offline/vendor の境界。

## Official and relevant URLs preserved from the research report

- Deno 2.9 release: https://deno.com/blog/v2.9
- Migrate from npm: https://docs.deno.com/runtime/migrate/migrate_from_npm/
- Lock dependencies with `deno.lock`: https://docs.deno.com/examples/dependency_lockfile_tutorial/
- Supply chain management: https://docs.deno.com/runtime/packages/supply_chain/
- Deno 2.9 release archive used by this plan: https://dl.deno.land/release/v2.9.0/deno-aarch64-apple-darwin.zip
- 国内補助情報（週刊Deno）: https://uki00a.github.io/deno-weekly/articles/2026/06/21.html
