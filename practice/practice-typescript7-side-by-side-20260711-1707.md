# 実践計画: TypeScript 7正式版をTypeScript 6とside-by-sideで安全に比較する

## 出典レポート

- `research/search-topic-20260711-1705.md`
- 選定テーマ: 「TypeScript 7正式版へ安全に移行する第一歩: `tsc`と`tsc6`を併用し、診断・ツール互換性・速度を手元で比較する」
- 本計画はレポートで1件に選定された上記テーマだけを扱う。実験実行や記事執筆はこの段階では行わない。

## 目的

小さなNode向けTypeScript fixtureを用意し、TypeScript 7.0.2のCLIとTypeScript 6.0.2互換パッケージを同居させて、次の3点を再現可能なログで確認する。

1. `tsc`が7系、`tsc6`が6系として同じインストール内で起動するか。
2. 同一入力に対する診断と正常系emit、およびTypeScript 6のCompiler APIを使う最小ツールの挙動を比較できるか。
3. TS 6、TS 7既定、TS 7 `--singleThreaded`、TS 7 `--checkers 1/2/4`の実行時間に、この小規模fixture上でどの程度の差が出るか。

全面移行の可否や一般的な性能倍率は結論にせず、このfixtureと実行環境で観測できた範囲だけを成果とする。

## 仮説

- `typescript@7.0.2`と`@typescript/typescript6@6.0.2`をexact versionで導入すると、`tsc`と`tsc6`を衝突せず起動できる。
- 公式が示す互換条件（TS 7側で`stableTypeOrdering`を有効化し、`ignoreDeprecations`を使わない）を満たす小さなfixtureでは、TS 6/7の正規化済み診断とemitは一致する可能性が高い。ただし差分が出た場合は差分自体を結果とする。
- TypeScript 7はこのfixtureでもTS 6より短時間になる可能性があるが、小規模入力では起動コストと測定ノイズが支配的になり、並列度を増やしても改善しない可能性がある。
- TypeScript 7には安定したprogrammatic APIがないため、API依存処理は`@typescript/typescript6`を明示的に読み込む構成なら実行できる可能性がある。

## 環境とローカル事前確認

- 計画作成時に存在だけを確認したツール: Node.js `v22.17.0`、npm `10.9.2`、Docker `28.3.0`、`jq`、`shasum`、`awk`、`sed`、`diff`、`find`、`sort`、`xargs`。
- `hyperfine`は見つからなかったため使わず、Node.jsの`process.hrtime.bigint()`を使う計測スクリプトで各条件を直列に5回測る。
- 実行時の実バージョン、OS、CPU論理コア数、メモリ概要を必ず再記録する。環境変数全量やユーザー名入り絶対パスは記録しない。
- ブラウザは起動しない。`brew`、システム領域へのインストール、Docker、Git操作も不要であり、計画しない。

## 前提条件

- npm public registryへの読み取りと依存取得が可能であること。認証、手動サインアップ、OAuth、CAPTCHAは使わない。
- 必須パッケージはレポート記載の`typescript@7.0.2`と`@typescript/typescript6@6.0.2`だけとし、install scriptは無効化する。
- 実行時刻を`YYYYMMDD-HHMMSS`で生成し、既存ディレクトリを再利用しない。
- すべての作業ファイル、npm cache、出力、計測値は隔離ディレクトリ内だけに置く。

## 隔離ディレクトリ

リポジトリルートから次を実行し、以後は必ず`$WORK_DIR`内で作業する。

```bash
set -eu
TOPIC=typescript7-side-by-side
STAMP="$(date '+%Y%m%d-%H%M%S')"
RUN_DIR="$PWD/logs/run-${TOPIC}-${STAMP}"
WORK_DIR="$RUN_DIR/work"
test ! -e "$RUN_DIR"
mkdir -p "$WORK_DIR/evidence" "$WORK_DIR/npm-cache"
printf '%s\n' "$RUN_DIR" > /tmp/zenn-typescript7-run-dir
cd "$WORK_DIR"
```

`/tmp/zenn-typescript7-run-dir`は実行中の場所を再取得するためのポインタだけで、成果物はすべて`$RUN_DIR`配下に保存する。

## 手順と正確なコマンド

### 1. 環境ゲートとパッケージ存在確認（30分）

```bash
set -eu
RUN_DIR="$(cat /tmp/zenn-typescript7-run-dir)"
WORK_DIR="$RUN_DIR/work"
cd "$WORK_DIR"
{
  date '+observed_at=%Y-%m-%dT%H:%M:%S%z'
  uname -srm
  node --version
  npm --version
  node -e 'const os=require("node:os"); console.log(`logical_cpus=${os.cpus().length}`); console.log(`total_memory_bytes=${os.totalmem()}`)'
} > evidence/environment.txt
npm_config_cache="$WORK_DIR/npm-cache" npm view typescript@7.0.2 version --json > evidence/typescript7-registry.json
npm_config_cache="$WORK_DIR/npm-cache" npm view @typescript/typescript6@6.0.2 version --json > evidence/typescript6-registry.json
test "$(jq -r . evidence/typescript7-registry.json)" = '7.0.2'
test "$(jq -r . evidence/typescript6-registry.json)" = '6.0.2'
```

どちらかの`npm view`が通信エラーなら同じ隔離cacheで1回だけ再試行する。versionが存在しない、値が一致しない、または再試行も失敗した場合は停止し、後続の成功を推測しない。

### 2. exact versionのside-by-side導入（30分）

```bash
set -eu
RUN_DIR="$(cat /tmp/zenn-typescript7-run-dir)"
WORK_DIR="$RUN_DIR/work"
cd "$WORK_DIR"
npm init -y > evidence/npm-init.txt
npm pkg set private=true
npm_config_cache="$WORK_DIR/npm-cache" npm install --save-dev --save-exact --ignore-scripts --no-audit --no-fund typescript@7.0.2 @typescript/typescript6@6.0.2 > evidence/npm-install.txt 2>&1
npm ls --depth=0 --json > evidence/npm-ls.json
./node_modules/.bin/tsc --version > evidence/tsc-version.txt
./node_modules/.bin/tsc6 --version > evidence/tsc6-version.txt
grep -Eq '7\.0\.2' evidence/tsc-version.txt
grep -Eq '6\.0\.2' evidence/tsc6-version.txt
```

`tsc`/`tsc6`のどちらかが存在しない、または期待したmajor/versionでない場合はここで停止する。非公式なbin linkの手作業や依存上書きは行わない。

### 3. 同一入力fixtureの作成とハッシュ記録（45分）

次の構成を`apply_patch`で`$WORK_DIR`配下に作る（リポジトリ直下のソースや設定は変更しない）。

```text
tsconfig.json
tsconfig.base.json
packages/core/tsconfig.json
packages/core/src/index.ts
packages/app/tsconfig.json
packages/app/src/index.ts
errors/tsconfig.json
errors/type-errors.ts
tools/compiler-api.mjs
tools/benchmark.mjs
```

ファイル内容は以下に固定する。

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "target": "ES2022",
    "rootDir": "src"
  }
}
```

`tsconfig.json`:

```json
{
  "files": [],
  "references": [
    { "path": "./packages/core" },
    { "path": "./packages/app" }
  ]
}
```

`packages/core/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "../../dist/core" },
  "include": ["src/**/*.ts"]
}
```

`packages/core/src/index.ts`:

```ts
export type User = Readonly<{ id: number; name: string }>;
export const formatUser = (user: User): string => `${user.id}:${user.name}`;
```

`packages/app/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "../../dist/app" },
  "references": [{ "path": "../core" }],
  "include": ["src/**/*.ts"]
}
```

`packages/app/src/index.ts`:

```ts
import { formatUser, type User } from "../../core/src/index.js";
const user: User = { id: 1, name: "Ada" };
console.log(formatUser(user));
```

`errors/tsconfig.json`:

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": { "composite": false, "declaration": false, "noEmit": true, "rootDir": "." },
  "include": ["type-errors.ts"]
}
```

`errors/type-errors.ts`:

```ts
const count: number = "three";
const label: string = 42;
console.log(count, label);
```

`tools/compiler-api.mjs`:

```js
import ts6 from "@typescript/typescript6";
const configPath = ts6.findConfigFile("./errors", ts6.sys.fileExists, "tsconfig.json");
if (!configPath) throw new Error("tsconfig not found");
const configFile = ts6.readConfigFile(configPath, ts6.sys.readFile);
const parsed = ts6.parseJsonConfigFileContent(configFile.config, ts6.sys, "./errors");
const program = ts6.createProgram(parsed.fileNames, parsed.options);
const diagnostics = ts6.getPreEmitDiagnostics(program);
console.log(JSON.stringify({ apiVersion: ts6.version, diagnosticCount: diagnostics.length }));
if (ts6.version !== "6.0.2" || diagnostics.length !== 2) process.exitCode = 1;
```

`tools/benchmark.mjs`:

```js
import { spawnSync } from "node:child_process";
import { appendFileSync, writeFileSync } from "node:fs";
const conditions = [
  ["ts6", "./node_modules/.bin/tsc6", ["-b", "--force", "--pretty", "false"]],
  ["ts7-default", "./node_modules/.bin/tsc", ["-b", "--force", "--pretty", "false", "--stableTypeOrdering"]],
  ["ts7-single", "./node_modules/.bin/tsc", ["-b", "--force", "--pretty", "false", "--stableTypeOrdering", "--singleThreaded"]],
  ["ts7-c1", "./node_modules/.bin/tsc", ["-b", "--force", "--pretty", "false", "--stableTypeOrdering", "--checkers", "1"]],
  ["ts7-c2", "./node_modules/.bin/tsc", ["-b", "--force", "--pretty", "false", "--stableTypeOrdering", "--checkers", "2"]],
  ["ts7-c4", "./node_modules/.bin/tsc", ["-b", "--force", "--pretty", "false", "--stableTypeOrdering", "--checkers", "4"]]
];
writeFileSync("evidence/timings.csv", "condition,run,elapsed_ms,status\n");
for (const [name, command, args] of conditions) {
  for (let run = 1; run <= 5; run++) {
    const start = process.hrtime.bigint();
    const result = spawnSync(command, args, { encoding: "utf8" });
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
    appendFileSync("evidence/timings.csv", `${name},${run},${elapsedMs.toFixed(3)},${result.status}\n`);
    appendFileSync("evidence/benchmark-output.txt", `## ${name} run=${run} status=${result.status}\n${result.stdout}${result.stderr}\n`);
    if (result.status !== 0) process.exit(1);
  }
}
```

作成後、入力を証拠化する。

```bash
set -eu
RUN_DIR="$(cat /tmp/zenn-typescript7-run-dir)"
WORK_DIR="$RUN_DIR/work"
cd "$WORK_DIR"
find tsconfig.json tsconfig.base.json packages errors tools -type f -print | LC_ALL=C sort > evidence/input-files.txt
xargs shasum -a 256 < evidence/input-files.txt > evidence/input-sha256.txt
```

### 4. 診断とemitの互換性（60分）

意図的エラーの終了コードは非0が期待値なので、`set -e`で失わず明示的に記録する。

```bash
set -u
RUN_DIR="$(cat /tmp/zenn-typescript7-run-dir)"
WORK_DIR="$RUN_DIR/work"
cd "$WORK_DIR"
set +e
./node_modules/.bin/tsc6 -p errors/tsconfig.json --pretty false > evidence/diagnostics-ts6.raw.txt 2>&1
TS6_STATUS=$?
./node_modules/.bin/tsc -p errors/tsconfig.json --pretty false --stableTypeOrdering > evidence/diagnostics-ts7.raw.txt 2>&1
TS7_STATUS=$?
set -e
printf 'ts6=%s\nts7=%s\n' "$TS6_STATUS" "$TS7_STATUS" > evidence/diagnostic-status.txt
test "$TS6_STATUS" -ne 0
test "$TS7_STATUS" -ne 0
sed "s#${WORK_DIR}#<WORK>#g" evidence/diagnostics-ts6.raw.txt > evidence/diagnostics-ts6.txt
sed "s#${WORK_DIR}#<WORK>#g" evidence/diagnostics-ts7.raw.txt > evidence/diagnostics-ts7.txt
diff -u evidence/diagnostics-ts6.txt evidence/diagnostics-ts7.txt > evidence/diagnostics.diff || true
rm -rf dist
./node_modules/.bin/tsc6 -b --force --pretty false > evidence/emit-ts6.txt 2>&1
find dist -type f ! -name '*.tsbuildinfo' -print | LC_ALL=C sort > evidence/emit-ts6-files.txt
find dist -type f ! -name '*.tsbuildinfo' -exec shasum -a 256 {} + | sed "s#${WORK_DIR}/##" | LC_ALL=C sort > evidence/emit-ts6-sha256.txt
mv dist dist-ts6
./node_modules/.bin/tsc -b --force --pretty false --stableTypeOrdering > evidence/emit-ts7.txt 2>&1
find dist -type f ! -name '*.tsbuildinfo' -print | LC_ALL=C sort > evidence/emit-ts7-files.txt
find dist -type f ! -name '*.tsbuildinfo' -exec shasum -a 256 {} + | sed "s#${WORK_DIR}/##" | LC_ALL=C sort > evidence/emit-ts7-sha256.txt
diff -ru --exclude='*.tsbuildinfo' dist-ts6 dist > evidence/emit.diff || true
```

診断またはemitに差分が出ても実験失敗とはしない。`stableTypeOrdering`と`ignoreDeprecations`不使用を再確認し、fixtureを一度だけ最小化して差分を再現する。解明できなければ差分と両方の生ログをそのまま残し、「互換」とは結論しない。

### 5. Compiler API依存処理（30分）

```bash
set -eu
RUN_DIR="$(cat /tmp/zenn-typescript7-run-dir)"
WORK_DIR="$RUN_DIR/work"
cd "$WORK_DIR"
node tools/compiler-api.mjs > evidence/compiler-api.json 2> evidence/compiler-api.stderr.txt
jq -e '.apiVersion == "6.0.2" and .diagnosticCount == 2' evidence/compiler-api.json > /dev/null
node -e 'for (const name of ["typescript", "@typescript/typescript6"]) { const p=require.resolve(`${name}/package.json`); const v=require(p).version; console.log(`${name}\t${v}\t${p.replace(process.cwd(),"<WORK>")}`) }' > evidence/package-resolution.txt
```

ここで確認するのは「任意の既存ツールがすべて互換」ではなく、TS 7 CLIと同居した環境でTS 6 Compiler APIを明示利用する最小処理が起動するかだけである。失敗時に`node_modules`を書き換えず、stderrと解決先を証拠として残す。

### 6. 速度と並列度の計測（60〜90分）

他の重い処理を止め、条件を交互ではなくスクリプト記載順で各5回、直列実行する。小規模fixtureのためウォームアップ値も捨てず全件保存する。

```bash
set -eu
RUN_DIR="$(cat /tmp/zenn-typescript7-run-dir)"
WORK_DIR="$RUN_DIR/work"
cd "$WORK_DIR"
: > evidence/benchmark-output.txt
node tools/benchmark.mjs
node - <<'NODE' > evidence/timing-summary.tsv
const fs = require("node:fs");
const rows = fs.readFileSync("evidence/timings.csv", "utf8").trim().split("\n").slice(1).map(line => {
  const [condition, run, elapsed, status] = line.split(",");
  return { condition, run: Number(run), elapsed: Number(elapsed), status: Number(status) };
});
console.log("condition\tmedian_ms\tmin_ms\tmax_ms\truns");
for (const condition of [...new Set(rows.map(row => row.condition))]) {
  const values = rows.filter(row => row.condition === condition).map(row => row.elapsed).sort((a, b) => a - b);
  console.log(`${condition}\t${values[2].toFixed(3)}\t${values[0].toFixed(3)}\t${values[4].toFixed(3)}\t${values.length}`);
}
NODE
```

いずれかのTS 7オプションがCLIで拒否された場合、公式発表URLと`tsc --help --all`の出力を照合して誤記か環境差かを記録し、その条件だけを失敗観測として残す。未確認の代替フラグは推測しない。swap増加、プロセス強制終了、顕著なthermal throttlingが疑われる場合は`--checkers 2/4`を中止する。倍率は算出可能でも一般化せず、中央値・最小・最大と環境条件を提示する。

### 7. 証拠索引と最終確認（30分）

```bash
set -eu
RUN_DIR="$(cat /tmp/zenn-typescript7-run-dir)"
WORK_DIR="$RUN_DIR/work"
cd "$WORK_DIR"
find evidence -type f -print | LC_ALL=C sort > evidence/index.txt
find evidence -type f -exec shasum -a 256 {} + | sed "s#${WORK_DIR}/##" | LC_ALL=C sort > evidence/evidence-sha256.txt
test -s evidence/environment.txt
test -s evidence/diagnostic-status.txt
test -s evidence/compiler-api.json
test -s evidence/timings.csv
test -s evidence/timing-summary.tsv
```

実行ログ作成時は、各コマンド、終了コード、stdout/stderr、観測、失敗と切り分けを`$RUN_DIR/execution-log.md`に記録する。記事本文はまだ作らない。

## 記録する観測

- 観測日時、OS、Node/npm、CPU論理コア数、メモリ概要。
- registryで確認した2パッケージのversion、lockfile、`npm ls`。
- `tsc --version`と`tsc6 --version`、bin衝突の有無。
- fixtureのファイル一覧とSHA-256。
- TS 6/7それぞれの診断、終了コード、正規化差分。
- 正常系emitのファイル一覧、SHA-256、内容差分。
- Compiler APIスクリプトが読み込んだversion、診断件数、パッケージ解決先。
- 全30計測の生値・終了コードと、条件別の中央値・最小・最大。
- 試した切り分け、失敗、未解明の差異、打ち切った条件。

## 成功基準

必須成功基準は次のとおり。

1. 隔離ディレクトリ内で`tsc`が7.0.2、`tsc6`が6.0.2を返す。
2. 意図的エラーに対する両CLIの終了コードと診断全文を取得し、差分の有無を判定できる。
3. 正常系project referencesを両CLIでemitし、出力一覧と内容差分を取得できる。
4. `@typescript/typescript6`を明示した最小Compiler API処理について、成功または説明可能な失敗ログを取得できる。
5. TS 6とTS 7の最低3条件（TS 6、TS 7既定、TS 7 `--singleThreaded`）で各5回の時間を取得し、環境条件とともに中央値・最小・最大を算出できる。

診断不一致、emit差分、API処理の非互換は、ログが完全なら有効な検証結果であり、それ自体を「計画失敗」とは扱わない。

## 失敗・停止基準

- 入力2パッケージのexact versionが存在しない、または隔離cacheでの1回の再試行後も取得不能。
- `tsc`/`tsc6`が期待versionで起動せず、公式のside-by-side構成を成立させられない。
- fixtureの同一入力を保証できない、ログが欠落した、または秘密情報を安全に除去できない。
- すべてのコンパイラ条件が起動不能で、診断・emit・最低3条件の計測証拠を取得できない。
- 6時間を超えた時点で必須成功基準を満たしていない。

停止時も成功を推測せず、取得済みのコマンド、出力、終了コード、原因候補と未確認事項をexecution logに残す。

## セキュリティ・コスト制限

- 無料の公開npmパッケージだけを使用し、課金サービス、クラウド、外部API、ブラウザ、Dockerは使わない。
- npm token、cookie、資格情報、private registry、private hostname、個人情報を使わない。`npm config list`や環境変数全量は出力しない。
- `--ignore-scripts`を付け、依存パッケージのinstall scriptを実行しない。
- ネットワークは`npm view`と`npm install`だけに限定し、1回の再試行を除いて反復取得しない。
- 絶対パスは保存前に`<WORK>`へ正規化し、ログに混入したtokenやユーザー名は公開artifactへ入れる前に伏せる。
- Gitコマンド、リポジトリ設定変更、リポジトリ外への書き込みは行わない（例外は一時ポインタ`/tmp/zenn-typescript7-run-dir`のみ）。

## クリーンアップ

検証中は再現証拠を保持する。レビュー後に破棄する場合だけ、記録したパスが期待形式かを確認してから隔離ディレクトリと一時ポインタを削除する。

```bash
set -eu
RUN_DIR="$(cat /tmp/zenn-typescript7-run-dir)"
case "$RUN_DIR" in
  "$PWD"/logs/run-typescript7-side-by-side-*/work) exit 1 ;;
  "$PWD"/logs/run-typescript7-side-by-side-*) ;;
  *) echo 'unexpected run directory' >&2; exit 1 ;;
esac
rm -rf -- "$RUN_DIR"
rm -f /tmp/zenn-typescript7-run-dir
```

通常のpipeline実行では`$RUN_DIR`が一次証拠なので削除せず、npm cacheや`node_modules`も同ディレクトリ内に保持する。

## タイムボックス

- 環境ゲートと導入: 60分
- fixture作成: 45分
- 診断・emit比較: 60分
- Compiler API: 30分
- 性能計測: 60〜90分
- 証拠整理: 30分
- 合計: 約4時間15分〜4時間45分、上限6時間

6時間に達したら追加切り分けと高並列条件を打ち切る。side-by-side起動、診断、emit、Compiler API、最低3条件の速度比較を優先する。

## フォールバック範囲

- npm通信失敗時は隔離cacheで1回だけ再試行し、それ以上のregistry変更やミラー利用はしない。
- 診断差分はfixtureを一度だけ単純化して再現確認する。解明できなくても差分を消すための設定変更はしない。
- `--checkers 2/4`で資源問題が出たら停止し、TS 6、TS 7既定、TS 7 `--singleThreaded`の3条件だけを残す。
- project referencesの`--builders`追加比較は本計画の必須範囲外とし、時間が余っても実施しない。テーマを広げず、診断・API・速度の3軸を完了させる。
- typescript-eslintなど第三者ツールの追加導入は行わない。Compiler API互換性の観測は明示importする最小スクリプトに限定し、既存ツール一般の互換性へ結論を広げない。

## 期待する記事の要点

- TypeScript 7 CLIを先行導入しつつ、TS 6 CLI/APIを同居させる最小構成とversion確認手順。
- 同じfixtureを比較するとき、`stableTypeOrdering`、`ignoreDeprecations`不使用、入力ハッシュ、終了コードを揃える必要があること。
- 診断とemitの一致・不一致、およびAPI依存処理の実際の結果。未解明の差は未解明と明記する。
- 速度は「何倍」という一般論ではなく、CPU論理コア数、5回の生値、中央値・範囲とともに読むべきこと。
- 「CLI型チェックをTS 7へ置き換える判断」と「Compiler API依存処理をTS 6に残す判断」を分けて検討する移行の考え方。

## 公式・一次情報

- TypeScript 7.0正式版、side-by-side運用、互換条件、並列オプション、programmatic API不在: https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
- VS CodeチームによるTS 6移行後のTS 6/7並行CI: https://code.visualstudio.com/blogs/2026/06/26/iterating-faster-with-ts-7

いずれも出典レポートでは2026-07-11閲覧として記録されている。
