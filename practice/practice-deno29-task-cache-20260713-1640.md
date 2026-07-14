# Deno 2.9 の `deno task` キャッシュを境界条件まで対照検証する実践計画

## Source report

- 入力: `research/search-topic-20260713-1634.md`
- 選定テーマ: Deno 2.9 の `deno task` input-based cache を小さな TypeScript build fixture へ導入し、初回実行、cache hit、生成物削除後の復元、source・argument・env・dependency・command による invalidation、0 件 glob と失敗 task の安全側挙動を、command 出力・invocation ledger・hash で対照検証する。
- 公式一次資料:
  - [Deno 2.9 release](https://deno.com/blog/v2.9)
  - [`deno task` reference](https://docs.deno.com/runtime/reference/cli/task/)
- この計画はレポートが一意に選定した上記テーマだけを扱う。Deno Desktop、lockfile 移行、browser UI、performance benchmark、cache 内部形式の解析は行わない。

## Objective

run-local の Deno 2.9.0 と外部依存のない単一 fixture を使い、次を再現可能な一次証拠として残す。

1. `files` のない baseline task が毎回実行されること。
2. `files` を宣言した task の初回実行と無変更再実行を、stdout/stderr だけでなく append-only invocation ledger の増分で区別すること。
3. 宣言済み `output` を削除した後、task body を再実行せず同一 hash の生成物が復元されるか。
4. source content、appended argument、列挙した env、dependency fingerprint、command definition の変更がそれぞれ cache を無効化するか。
5. mtime だけの変更と無関係な未列挙 env の変更が、fixture 内で不要な再実行を起こすか。
6. 0 件 match の `files`、非 0 終了 task、`output` 未指定 task が安全側にどう振る舞うか。

duration は補助情報としてだけ保存し、cache 効果の判定には使わない。結論は Deno 2.9.0、macOS arm64、この fixture の観測範囲に限定する。

## Hypothesis

- H1: `files` のない task は 2 回とも body を実行し、ledger count は 2 になる。
- H2: cacheable task は初回だけ body を実行し、無変更の 2 回目は ledger count を増やさない。
- H3: `output` 宣言済み生成物を削除して再実行すると、ledger count を増やさず初回と同じ SHA-256 の生成物が復元される。
- H4: source content、appended argument、列挙 env、dependency input、command definition を一軸ずつ変えると、それぞれ ledger count が 1 増える。
- H5: source の mtime だけ、または task が読まない未列挙 env だけを変えても ledger count は増えない。異なる場合は実測結果を優先し、理由を推測しない。
- H6: 0 件 match の `files` と失敗 task は 2 回とも body を実行し、失敗 task は 2 回とも非 0 で終了する。
- H7: cacheable だが `output` 未指定の task は body を skip できても、削除済み生成物は復元しない。

H1〜H7 の不一致は隠さず、`fail` または `unexpected` として残す。H5 は境界観測であり、記事化の必須成功条件にはしない。

## Environment

計画時の非破壊観測（2026-07-13 16:40 JST）:

- effective sandbox mode: `danger-full-access`（run を含む全 pipeline stage）
- OS/architecture: macOS (`Darwin`) / `arm64`
- system Deno: `/opt/homebrew/bin/deno`, `2.8.3`（対象外のため検証には使わない）
- 利用可能: `/usr/bin/curl`, `/usr/bin/unzip`, `/usr/bin/shasum`, `/usr/bin/jq`, `/usr/bin/awk`, `/usr/bin/cmp`, `/usr/bin/find`, `/usr/bin/touch`, `/usr/bin/env`, `/usr/bin/git`, `/usr/local/bin/docker`
- browser: `danger-full-access` のため real browser と Playwright は許可される。ただし選定テーマの核心は CLI だけで検証できるため使用しない。

run では Deno 2.9.0 の公式 release archive を `work/tools/` に取得し、その binary だけを使う。system Deno の upgrade、Homebrew 操作、user-level Deno cache の利用・削除はしない。

## Prerequisites and capability gates

1. repository root から開始し、`research/search-topic-20260713-1634.md` が存在することを確認する。
2. `uname -s` が `Darwin`、`uname -m` が `arm64` でなければ、別 archive 名を推測せず停止する。
3. `curl`、`unzip`、`shasum`、`jq`、`awk`、`cmp`、`find`、`touch`、`env` が一つでもなければ停止する。install は行わない。
4. `https://dl.deno.land/release/v2.9.0/` から archive と公式 checksum を最大 2 回の HTTP attempt で取得する。取得、checksum、展開、起動のいずれかが失敗したら停止する。
5. run-local binary の先頭 version 行が `deno 2.9.0` でなければ停止する。system Deno 2.8.3 の挙動から補完しない。
6. 最小 schema probe で object task の `files`、`output`、`env` が受理されなければ、exact config、stdout/stderr、exit code を保存して停止する。別 schema を推測で試さない。
7. fixture 作成後は network を使わない。外部 package、registry、認証、API key、signup は不要とする。
8. browser 検証をこの run へ追加しない。後続の別計画で browser が必須になった場合だけ、browser launch と context 作成を最初の capability gate にし、失敗時は screenshot、描画、操作結果を推測せず停止する。

gate failure は機能仮説の fail ではなく run blocker として execution log に記録する。

## Isolation directory

全生成物は新規の `logs/run-deno29-task-cache-<timestamp>/work/` 以下に置く。repository 直下の既存 article、practice、research、lockfile、`node_modules` は変更しない。Git branch、commit、stash、checkout、add は行わない。

repository root で、同じ shell session から開始する。

```sh
set -eu
test -f research/search-topic-20260713-1634.md
REPO_ROOT="$PWD"
RUN_TS="$(date '+%Y%m%d-%H%M%S')"
RUN_DIR="$REPO_ROOT/logs/run-deno29-task-cache-$RUN_TS"
WORK_DIR="$RUN_DIR/work"
test ! -e "$RUN_DIR"
mkdir -p "$WORK_DIR"/{tools,deno-dir,evidence/commands,evidence/states,fixture,scripts}
export REPO_ROOT RUN_DIR WORK_DIR
```

以降の cwd と書込先は `$WORK_DIR` 以下に限定する。fixture 内の相対 path を使う task は `$WORK_DIR/fixture` を cwd とする。

## Ordered steps and commands

### 0. 環境記録と Deno 2.9.0 gate（20分）

```sh
cd "$WORK_DIR"
for command_name in curl unzip shasum jq awk cmp find touch env; do
  command -v "$command_name" >/dev/null
done
test "$(uname -s)" = Darwin
test "$(uname -m)" = arm64
{
  date -u '+utc=%Y-%m-%dT%H:%M:%SZ'
  date '+local=%Y-%m-%dT%H:%M:%S%z'
  printf 'cwd=%s\n' "$PWD"
  uname -a
  command -v deno || true
  deno --version || true
  command -v curl
  command -v unzip
  command -v shasum
  command -v jq
} > evidence/environment.txt 2>&1

DENO_ARCHIVE=deno-aarch64-apple-darwin.zip
curl --fail --location --retry 1 --retry-delay 2 \
  --output "tools/$DENO_ARCHIVE" \
  "https://dl.deno.land/release/v2.9.0/$DENO_ARCHIVE"
curl --fail --location --retry 1 --retry-delay 2 \
  --output "tools/$DENO_ARCHIVE.sha256sum" \
  "https://dl.deno.land/release/v2.9.0/$DENO_ARCHIVE.sha256sum"
(cd tools && shasum -a 256 -c "$DENO_ARCHIVE.sha256sum") \
  > evidence/deno-checksum.txt 2>&1
mkdir tools/deno-2.9.0
unzip -q "tools/$DENO_ARCHIVE" -d tools/deno-2.9.0
chmod u+x tools/deno-2.9.0/deno
DENO_BIN="$WORK_DIR/tools/deno-2.9.0/deno"
export DENO_BIN
"$DENO_BIN" --version > evidence/deno-target-version.txt 2>&1
grep -Eq '^deno 2\.9\.0 ' evidence/deno-target-version.txt
export DENO_DIR="$WORK_DIR/deno-dir"
export PATH="$(dirname "$DENO_BIN"):$PATH"
```

command ごとに cwd、UTC 開始・終了時刻、exit code、期待種別、stdout、stderr を保存する helper を作る。`nonzero` は非 0 終了を期待する負例用であり、実 exit code 自体は `.meta` に残す。

```sh
cd "$WORK_DIR"
cat > scripts/run-and-record.sh <<'SH'
#!/bin/sh
set -u
label=$1
expect=$2
shift 2
root=${WORK_DIR:?WORK_DIR is required}
meta="$root/evidence/commands/$label.meta"
stdout="$root/evidence/commands/$label.stdout"
stderr="$root/evidence/commands/$label.stderr"
{
  printf 'cwd=%s\n' "$PWD"
  printf 'start_utc=%s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  printf 'command='
  printf '%s ' "$@"
  printf '\n'
} > "$meta"
set +e
"$@" > "$stdout" 2> "$stderr"
rc=$?
set -e
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

cat > scripts/capture-state.sh <<'SH'
#!/bin/sh
set -eu
task=$1
output=$2
ledger=evidence/invocations.jsonl
if test -f "$ledger"; then
  count=$(jq -sc --arg task "$task" '[.[] | select(.task == $task)] | length' "$ledger")
else
  count=0
fi
if test "$output" != '-' && test -f "$output"; then
  exists=true
  hash=$(shasum -a 256 "$output" | awk '{print $1}')
  jq -n --arg task "$task" --arg output "$output" --arg hash "$hash" \
    --argjson count "$count" \
    '{task:$task, invocation_count:$count, output:$output, output_exists:true, sha256:$hash}'
else
  jq -n --arg task "$task" --arg output "$output" --argjson count "$count" \
    '{task:$task, invocation_count:$count, output:$output, output_exists:false, sha256:null}'
fi
SH
chmod u+x scripts/capture-state.sh

cat > scripts/run-task-case.sh <<'SH'
#!/bin/sh
set -eu
label=$1
expect=$2
task=$3
output=$4
shift 4
root=${WORK_DIR:?WORK_DIR is required}
"$root/scripts/capture-state.sh" "$task" "$output" \
  > "$root/evidence/states/$label.before.json"
"$root/scripts/run-and-record.sh" "$label" "$expect" "$@"
"$root/scripts/capture-state.sh" "$task" "$output" \
  > "$root/evidence/states/$label.after.json"
SH
chmod u+x scripts/run-task-case.sh
```

### 1. 外部依存なし fixture と schema probe（40分）

```sh
cd "$WORK_DIR/fixture"
mkdir -p src config evidence dist generated
cat > src/message.ts <<'TS'
export const message = "alpha";
TS
cat > config/prefix.txt <<'TXT'
prefix-one
TXT
cat > build.ts <<'TS'
import { message } from "./src/message.ts";

const [task, marker = "default"] = Deno.args;
if (!task) throw new Error("task label is required");
const mode = Deno.env.get("MODE") ?? "unset";
const prefix = task === "dependency"
  ? (await Deno.readTextFile("generated/prefix.txt")).trim()
  : "unused";
const payload = { task, marker, mode, message, prefix };
await Deno.mkdir("dist", { recursive: true });
await Deno.mkdir("evidence", { recursive: true });
await Deno.writeTextFile(`dist/${task}.json`, `${JSON.stringify(payload)}\n`);
await Deno.writeTextFile(
  "evidence/invocations.jsonl",
  `${JSON.stringify({ task, marker, mode, message, prefix })}\n`,
  { append: true, create: true },
);
console.log(JSON.stringify({ executed: true, ...payload }));
TS
cat > prepare.ts <<'TS'
const prefix = await Deno.readTextFile("config/prefix.txt");
await Deno.mkdir("generated", { recursive: true });
await Deno.mkdir("evidence", { recursive: true });
await Deno.writeTextFile("generated/prefix.txt", prefix);
await Deno.writeTextFile(
  "evidence/invocations.jsonl",
  `${JSON.stringify({ task: "prepare", prefix: prefix.trim() })}\n`,
  { append: true, create: true },
);
console.log(JSON.stringify({ executed: true, task: "prepare", prefix: prefix.trim() }));
TS
cat > fail.ts <<'TS'
await Deno.mkdir("evidence", { recursive: true });
await Deno.writeTextFile(
  "evidence/invocations.jsonl",
  `${JSON.stringify({ task: "failure", aboutToExit: 1 })}\n`,
  { append: true, create: true },
);
console.error("intentional failure");
Deno.exit(1);
TS
cat > deno.json <<'JSON'
{
  "tasks": {
    "baseline": "deno run --allow-read=src --allow-write=dist,evidence --allow-env=MODE build.ts baseline",
    "main": {
      "command": "deno run --allow-read=src --allow-write=dist,evidence --allow-env=MODE build.ts main",
      "files": ["build.ts", "src/**/*.ts"],
      "output": ["dist/main.json"]
    },
    "arguments": {
      "command": "deno run --allow-read=src --allow-write=dist,evidence --allow-env=MODE build.ts arguments",
      "files": ["build.ts", "src/**/*.ts"],
      "output": ["dist/arguments.json"]
    },
    "listed-env": {
      "command": "deno run --allow-read=src --allow-write=dist,evidence --allow-env=MODE build.ts listed-env",
      "files": ["build.ts", "src/**/*.ts"],
      "output": ["dist/listed-env.json"],
      "env": ["MODE"]
    },
    "unlisted-env": {
      "command": "deno run --allow-read=src --allow-write=dist,evidence --allow-env=MODE build.ts unlisted-env",
      "files": ["build.ts", "src/**/*.ts"],
      "output": ["dist/unlisted-env.json"]
    },
    "prepare": {
      "command": "deno run --allow-read=config --allow-write=generated,evidence prepare.ts",
      "files": ["prepare.ts", "config/prefix.txt"],
      "output": ["generated/prefix.txt"]
    },
    "dependency": {
      "command": "deno run --allow-read=src,generated --allow-write=dist,evidence --allow-env=MODE build.ts dependency",
      "dependencies": ["prepare"],
      "files": ["build.ts", "src/**/*.ts"],
      "output": ["dist/dependency.json"]
    },
    "command-key": {
      "command": "deno run --allow-read=src --allow-write=dist,evidence --allow-env=MODE build.ts command-key command-v1",
      "files": ["build.ts", "src/**/*.ts"],
      "output": ["dist/command-key.json"]
    },
    "zero-match": {
      "command": "deno run --allow-read=src --allow-write=dist,evidence --allow-env=MODE build.ts zero-match",
      "files": ["missing/**/*.ts"],
      "output": ["dist/zero-match.json"]
    },
    "failure": {
      "command": "deno run --allow-write=evidence fail.ts",
      "files": ["fail.ts"]
    },
    "no-output": {
      "command": "deno run --allow-read=src --allow-write=dist,evidence --allow-env=MODE build.ts no-output",
      "files": ["build.ts", "src/**/*.ts"]
    }
  }
}
JSON
```

schema probe は専用 cache で一度だけ実行し、成功後に本番観測用 cache と ledger を空から開始する。

```sh
cd "$WORK_DIR/fixture"
export DENO_DIR="$WORK_DIR/deno-dir-probe"
export WORK_DIR
"$WORK_DIR/scripts/run-and-record.sh" schema-probe zero \
  "$DENO_BIN" task main
cp deno.json "$WORK_DIR/evidence/deno.initial.json"
rm -rf "$WORK_DIR/deno-dir-probe" dist generated evidence/invocations.jsonl
mkdir -p dist generated evidence "$WORK_DIR/deno-dir"
export DENO_DIR="$WORK_DIR/deno-dir"
```

### 2. baseline、cache hit、output 復元（35分）

```sh
cd "$WORK_DIR/fixture"
export WORK_DIR DENO_DIR

"$WORK_DIR/scripts/run-task-case.sh" baseline-1 zero baseline dist/baseline.json \
  "$DENO_BIN" task baseline
"$WORK_DIR/scripts/run-task-case.sh" baseline-2 zero baseline dist/baseline.json \
  "$DENO_BIN" task baseline

"$WORK_DIR/scripts/run-task-case.sh" main-first zero main dist/main.json \
  "$DENO_BIN" task main
cp dist/main.json "$WORK_DIR/evidence/main.first.json"
shasum -a 256 dist/main.json > "$WORK_DIR/evidence/main.first.sha256"
"$WORK_DIR/scripts/run-task-case.sh" main-hit zero main dist/main.json \
  "$DENO_BIN" task main
rm -f dist/main.json
test ! -e dist/main.json
"$WORK_DIR/scripts/run-task-case.sh" main-restore zero main dist/main.json \
  "$DENO_BIN" task main
shasum -a 256 dist/main.json > "$WORK_DIR/evidence/main.restored.sha256"
cmp "$WORK_DIR/evidence/main.first.json" dist/main.json \
  > "$WORK_DIR/evidence/main-restore-cmp.txt" 2>&1
```

期待証拠: baseline の count は `0→1→2`、main は初回 `0→1`、hit と restore は `1→1`。復元後は file が存在し、2 つの SHA-256 と `cmp` が一致する。Deno の cache 表示は command の stdout/stderr に実際に現れた文字列だけを引用する。

### 3. source content と mtime の境界（25分）

main task の既存 cache をそのまま使い、まず内容を変えず mtime だけを変更し、その後 content を一度だけ変える。

```sh
cd "$WORK_DIR/fixture"
cp src/message.ts "$WORK_DIR/evidence/message.before.ts"
touch src/message.ts
"$WORK_DIR/scripts/run-task-case.sh" main-mtime-only zero main dist/main.json \
  "$DENO_BIN" task main
cat > src/message.ts <<'TS'
export const message = "beta";
TS
"$WORK_DIR/scripts/run-task-case.sh" main-source-change zero main dist/main.json \
  "$DENO_BIN" task main
cp src/message.ts "$WORK_DIR/evidence/message.after.ts"
shasum -a 256 dist/main.json > "$WORK_DIR/evidence/main.after-source.sha256"
```

mtime-only の count は増えないと予想するが、必須 assertion にはしない。source content 変更では count が 1 増え、output hash と JSON 内 `message` が変わることを確認する。

### 4. argument と env の invalidation（35分）

```sh
cd "$WORK_DIR/fixture"
"$WORK_DIR/scripts/run-task-case.sh" arguments-foo-first zero arguments dist/arguments.json \
  "$DENO_BIN" task arguments foo
"$WORK_DIR/scripts/run-task-case.sh" arguments-foo-hit zero arguments dist/arguments.json \
  "$DENO_BIN" task arguments foo
"$WORK_DIR/scripts/run-task-case.sh" arguments-bar-miss zero arguments dist/arguments.json \
  "$DENO_BIN" task arguments bar

"$WORK_DIR/scripts/run-task-case.sh" listed-env-dev-first zero listed-env dist/listed-env.json \
  env MODE=dev "$DENO_BIN" task listed-env
"$WORK_DIR/scripts/run-task-case.sh" listed-env-dev-hit zero listed-env dist/listed-env.json \
  env MODE=dev "$DENO_BIN" task listed-env
"$WORK_DIR/scripts/run-task-case.sh" listed-env-prod-miss zero listed-env dist/listed-env.json \
  env MODE=prod "$DENO_BIN" task listed-env

"$WORK_DIR/scripts/run-task-case.sh" unlisted-env-a-first zero unlisted-env dist/unlisted-env.json \
  env UNRELATED=A "$DENO_BIN" task unlisted-env
"$WORK_DIR/scripts/run-task-case.sh" unlisted-env-b-hit zero unlisted-env dist/unlisted-env.json \
  env UNRELATED=B "$DENO_BIN" task unlisted-env
```

期待証拠: `arguments` は `foo` 初回と `bar` で計 2 回、`listed-env` は `dev` 初回と `prod` で計 2 回実行される。`unlisted-env` は計 1 回と予想する。output JSON の `marker` と `mode` も各 command の引数・env と対応させる。

### 5. dependency fingerprint と command definition（35分）

```sh
cd "$WORK_DIR/fixture"
"$WORK_DIR/scripts/run-task-case.sh" dependency-first zero dependency dist/dependency.json \
  "$DENO_BIN" task dependency
"$WORK_DIR/scripts/run-task-case.sh" dependency-hit zero dependency dist/dependency.json \
  "$DENO_BIN" task dependency
cat > config/prefix.txt <<'TXT'
prefix-two
TXT
"$WORK_DIR/scripts/run-task-case.sh" dependency-input-change zero dependency dist/dependency.json \
  "$DENO_BIN" task dependency

"$WORK_DIR/scripts/run-task-case.sh" command-v1-first zero command-key dist/command-key.json \
  "$DENO_BIN" task command-key
"$WORK_DIR/scripts/run-task-case.sh" command-v1-hit zero command-key dist/command-key.json \
  "$DENO_BIN" task command-key
jq '.tasks["command-key"].command = "deno run --allow-read=src --allow-write=dist,evidence --allow-env=MODE build.ts command-key command-v2"' \
  deno.json > deno.json.next
mv deno.json.next deno.json
cp deno.json "$WORK_DIR/evidence/deno.command-v2.json"
"$WORK_DIR/scripts/run-task-case.sh" command-v2-miss zero command-key dist/command-key.json \
  "$DENO_BIN" task command-key
```

期待証拠: `prepare` と `dependency` は初回各 1、無変更時は増加なし、`config/prefix.txt` 変更後に各 1 増える。`dependency` output の `prefix` も変わる。`command-key` は v1 初回と v2 で計 2 回実行され、output の `marker` が変わる。`deno.json` 自体は `files` に含めていないため、ここでは command fingerprint を観測対象にする。

### 6. 0 件 glob、失敗 task、`output` 未指定（30分）

```sh
cd "$WORK_DIR/fixture"
test ! -e missing
"$WORK_DIR/scripts/run-task-case.sh" zero-match-1 zero zero-match dist/zero-match.json \
  "$DENO_BIN" task zero-match
"$WORK_DIR/scripts/run-task-case.sh" zero-match-2 zero zero-match dist/zero-match.json \
  "$DENO_BIN" task zero-match

"$WORK_DIR/scripts/run-task-case.sh" failure-1 nonzero failure - \
  "$DENO_BIN" task failure
"$WORK_DIR/scripts/run-task-case.sh" failure-2 nonzero failure - \
  "$DENO_BIN" task failure

"$WORK_DIR/scripts/run-task-case.sh" no-output-first zero no-output dist/no-output.json \
  "$DENO_BIN" task no-output
"$WORK_DIR/scripts/run-task-case.sh" no-output-hit zero no-output dist/no-output.json \
  "$DENO_BIN" task no-output
rm -f dist/no-output.json
test ! -e dist/no-output.json
"$WORK_DIR/scripts/run-task-case.sh" no-output-after-delete zero no-output dist/no-output.json \
  "$DENO_BIN" task no-output
```

期待証拠: `zero-match` と `failure` は各 2 回 body を実行し、failure の `.meta` は 2 件とも非 0 を記録する。`no-output` は初回だけ body を実行し、削除後の再実行でも count は増えず、生成物は missing のままと予想する。異なる場合も cache 表示と ledger/file 状態の組をそのまま残す。

### 7. 証拠集約と判定（20分）

```sh
cd "$WORK_DIR/fixture"
jq -s '.' "$WORK_DIR"/evidence/states/*.json \
  > "$WORK_DIR/evidence/state-snapshots.json"
jq -s '.' evidence/invocations.jsonl \
  > "$WORK_DIR/evidence/invocations.json"
jq -r 'group_by(.task)[] | [.[0].task, length] | @tsv' \
  "$WORK_DIR/evidence/invocations.json" \
  > "$WORK_DIR/evidence/invocation-counts.tsv"
find "$WORK_DIR/evidence" -type f -print | LC_ALL=C sort \
  > "$WORK_DIR/evidence/manifest.txt"
shasum -a 256 "$WORK_DIR/evidence/invocations.json" \
  "$WORK_DIR/evidence/state-snapshots.json" \
  > "$WORK_DIR/evidence/core-evidence.sha256"
```

execution log には各 command の実行順、cwd、開始・終了時刻、exit code、stdout/stderr と、次の列を持つ case matrix を記録する。

| case | changed axis | expected | before count | after count | output before/after | observed cache text | verdict |
| --- | --- | --- | ---: | ---: | --- | --- | --- |
| baseline | no `files` | rerun |  |  |  |  |  |
| main hit | none | hit |  |  |  |  |  |
| restore | output deletion | hit + restore |  |  |  |  |  |
| mtime | mtime only | exploratory hit |  |  |  |  |  |
| source | content | miss |  |  |  |  |  |
| arguments | appended arg | miss by value |  |  |  |  |  |
| listed env | `MODE` | miss by value |  |  |  |  |  |
| unlisted env | `UNRELATED` | exploratory hit |  |  |  |  |  |
| dependency | upstream input | upstream + downstream miss |  |  |  |  |  |
| command | command string | miss |  |  |  |  |  |
| zero match | no matched files | rerun |  |  |  |  |  |
| failure | exit 1 | rerun + nonzero |  |  |  |  |  |
| no output | delete undeclared output | hit + no restore |  |  |  |  |  |

公式資料の claim、local observation、そこからの限定的解釈を別々に書く。観測していない shared/remote cache、別 OS/CPU、別 Deno patch version、速度向上は主張しない。

## Observations to capture

- OS、architecture、system Deno、run-local Deno、cwd、`DENO_DIR` の隔離先。
- Deno archive checksum gate と schema probe の成否。
- 全 command の開始・終了時刻、cwd、exact argv、exit code、stdout、stderr。
- case ごとの invocation count before/after と delta。
- 生成物の有無、JSON 内容、SHA-256、削除後の復元有無。
- source、config、`deno.json` の変更前後コピー。
- Deno が実際に出した cache hit/miss 関連文言。文言がない場合は `none observed` とする。
- expectation と異なる結果、相互矛盾、未確認項目、fixture 固有の制限。

## Success criteria

記事化に必要な core success は次のすべてを満たすこと。

1. Deno 2.9.0 gate と object task schema probe が成功する。
2. baseline は 2 回実行され、cacheable main は無変更時に ledger count が増えない。
3. main output 削除後に body を再実行せず、同じ SHA-256 の生成物が復元される。
4. source、argument、listed env、dependency の 4 軸で expected miss と ledger count 増加を記録できる。
5. 0 件 glob と failure task が false hit せず、failure は 2 回とも非 0 になる。
6. すべての一次証拠が単一 run directory 内にあり、既存 repository file と global Deno 環境を変更していない。

command definition と `output` 未指定の結果も記事の境界表へ含めるが、一方だけが予想外でも core 6 条件を満たし、矛盾を正直に限定記述できれば記事化可能とする。mtime-only と unlisted env は exploratory observation であり、その結果単独では全体を fail にしない。

## Failure criteria and stop conditions

- Deno 2.9.0 の取得、checksum、展開、起動、schema probe の失敗は blocker。2.8.3 や docs から結果を推測せず停止する。
- ledger が壊れた JSONL になる、task body が run directory 外へ書く、または `DENO_DIR` が run-local でない場合は停止する。
- cache 表示、ledger delta、output hash が矛盾した場合は成功扱いにしない。同じ run 内で該当 case を一度だけ最小再実行し、矛盾が残れば blocker として停止する。
- core success 2〜5 のいずれかを再現できなければ article-ready success ではない。exact version と evidence を保持し、機能不一致または fixture 不備を区別する。
- 4 時間時点で core の hit、復元、source/env invalidation が未完なら拡張 case を中止する。core が揃わなければ成功扱いにしない。
- browser launch は本計画に含まれない。別計画で launch/context gate が失敗した場合は、その場で停止し visual result を推測しない。

## Security and cost limits

- 費用上限は 0 円。paid service、cloud resource、API key、signup、OAuth は使わない。
- network は Deno 2.9.0 の公式 archive/checksum 取得だけに限定し、各 URL は初回 + retry 1 回まで。fixture 実行時は network permission を付与しない。
- Deno scripts の権限は fixture 内の必要な read/write と `MODE` read に限定する。`--allow-all`、`--allow-run`、`--allow-net` は使わない。
- system Deno、Homebrew、user cache、repository の Git state、既存 logs を変更・削除しない。
- 削除 command の対象は `$WORK_DIR/fixture/dist/` 内の個別生成物、probe cache、明示した run-local cache/tool だけに限定する。
- duration を benchmark として解釈しない。cache directory の reverse engineering、CI cache 共有、cross-platform portability へ範囲を広げない。
- `danger-full-access` は必要な local capability を許可する条件であり、書込範囲や network 範囲を拡張する理由にはしない。

## Cleanup

run 完了時は一次証拠を保つため自動削除しない。記事 draft/review が証拠を参照し終えた後、容量を解放する場合だけ次を実行し、fixture と `evidence/` は残す。

```sh
set -eu
test -n "${RUN_DIR:-}"
test "$WORK_DIR" = "$RUN_DIR/work"
case "$RUN_DIR" in
  "$REPO_ROOT"/logs/run-deno29-task-cache-*) ;;
  *) exit 2 ;;
esac
rm -rf "$WORK_DIR/deno-dir" "$WORK_DIR/tools"
```

途中失敗でも run directory を削除せず、blocker の stdout/stderr と environment 記録を保持する。

## Timebox

- 環境・version gate: 20分
- fixture と schema probe: 40分
- baseline、hit、復元: 35分
- source/mtime: 25分
- argument/env: 35分
- dependency/command: 35分
- 負例: 30分
- 証拠集約、最小再確認、execution log: 20〜40分
- 合計上限: 4時間

3 時間時点で遅延している場合は mtime-only、unlisted env、command definition の順に省略できる。baseline、main hit、output 復元、source・argument・listed env・dependency invalidation、0 件 glob、failure task は省略しない。

## Fallback scope

- Deno 2.9.0 archive gate が失敗しても system Deno 2.8.3、latest 2.9.x、非公式 binary へ切り替えない。blocker として終了する。
- schema が公式例と異なる場合、syntax を推測で変えず raw config と stderr を保存して終了する。
- 個別 case の証拠が曖昧なら、その case だけ同じ入力状態から一度再実行してよい。cache を都合よく全消去した再試行は別 case として扱う。
- timebox 超過時は exploratory 3 軸を削る。core 軸を減らして「境界条件を検証した」とはしない。
- CLI 検証が成立しない場合に browser 候補へ切り替えない。browser topic は source report の別候補であり、別 pipeline が必要である。

## Expected article takeaways

- `files` の宣言が cache opt-in の境界であり、cache hit は速度感ではなく ledger delta で判定できる。
- `output` 宣言が「task を skip すること」と「削除した artifact を復元すること」を分ける。
- source、argument、列挙 env、dependency、command のどの変更が fixture の cache key を変えたかを一つの比較表で示せる。
- 0 件 glob と失敗 task の安全側挙動を成功 case と同じ測定方法で説明できる。
- mtime-only と未列挙 env は、公式 claim と fixture の実測を混同せず境界観測として提示できる。
- Deno version、OS/CPU、run-local cache を固定し、global 環境を変更しない再現手順を新人向けに示せる。
