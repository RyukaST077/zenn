# Deno 2.9 組み込みテスト機能の実践計画

## 出典と選定テーマ

- 出典レポート: `research/search-topic-20260711-0148.md`
- 選定テーマ: **Deno 2.9 の組み込みテストランナーだけで、文字列整形 CLI に snapshot・table test・retry・coverage gate を導入し、成功と失敗の出力を記録する。**
- 対象読者: Web 開発を始めたばかりの新人エンジニア
- この文書は実行計画だけを定義する。検証の実行、記事本文の作成、Git 操作は行わない。

### 参照する一次情報

- [Deno 2.9 release](https://deno.com/blog/v2.9)
- [Deno Docs: Snapshot testing](https://docs.deno.com/runtime/test/snapshots/)
- [Deno Docs: Testing](https://docs.deno.com/runtime/test/)

## 目的

決定的な入力だけを扱う小さな文字列整形 CLI を作り、Deno 2.9 の次の挙動を CLI 出力と終了コードで確認する。

1. `Deno.test.each` がケースごとに独立したテスト名を表示し、`--filter` で 1 ケースに絞れること。
2. `t.assertSnapshot()` の初回生成、古い entry の整理、差分失敗、更新後成功を確認できること。
3. 初回だけ決定的に失敗する専用テストが `retry: 1` で成功し、summary に `flaky` が残ること。
4. `--repeats=3` が決定的なテストを繰り返し、すべて成功すること。
5. 同じ `--coverage-threshold=100` に対し、未検証 branch があると非ゼロ、テスト追加後は 0 になること。
6. 時間が残れば、`--related` と `--shard` が選んだテスト集合を記録すること。

## 仮説

- Deno 2.9.0 なら外部テストライブラリなしで必須 4 項目（table test、snapshot、retry、coverage gate）を再現できる。
- snapshot の通常実行では変更差分と非ゼロ終了が観測でき、`--update-snapshots` 後の通常実行は成功する。
- retry 後に通ったテストは成功扱いになっても `flaky` と表示される。
- branch を 1 本追加で通すだけで、同一コード・同一閾値の coverage gate が失敗から成功へ変わる。

仮説に反する結果も一次証拠として残し、公式説明と観測結果を分ける。小規模 CLI の結果を Jest、Vitest 等の全面代替へ一般化しない。

## 確認済みローカル環境

計画作成時（2026-07-11 01:52 JST）に、インストールや検証をせず次だけを確認した。

- OS / architecture: Darwin / arm64
- 既存 Deno: `/opt/homebrew/bin/deno`, `deno 2.8.3`
- 補助コマンド: Bash、`tee`、`script` が利用可能
- 既存 Deno 2.8.3 は対象の 2.9 系ではないため、検証には使わない。

再現性のため、実行時は既存 Deno の `upgrade --output` を使い、公式配布元から Deno 2.9.0 を隔離ディレクトリ内へ取得する。グローバル Deno は更新しない。

## 前提条件と停止条件

- ネットワーク利用は Deno 2.9.0 バイナリを公式配布元から取得する 1 回だけ許可する。
- サインアップ、認証、API キー、OAuth、CAPTCHA、課金、GUI、物理デバイスは使わない。
- 外部 JavaScript / TypeScript パッケージは追加しない。テストコードも Deno 組み込み API と自作 assertion だけを使う。
- Deno 2.9.0 の取得と `deno --version` 確認に 30 分以内で到達できなければ中止する。
- exact version が `2.9.0` でなければ必須検証を開始しない。
- credential、token、cookie、個人情報、private hostname、環境変数一覧を求める手順に遭遇したら直ちに中止する。

## 隔離ディレクトリ

リポジトリルートから次を実行し、全生成物を新しい run directory 配下へ限定する。`RUN_DIR` が既に存在する場合は時刻を取り直し、既存ディレクトリを再利用・削除しない。

```bash
set -euo pipefail
REPO="$PWD"
RUN_STAMP="$(date +%Y%m%d-%H%M)"
RUN_DIR="$REPO/logs/run-deno29-built-in-testing-$RUN_STAMP"
WORK="$RUN_DIR/work"
test ! -e "$RUN_DIR"
mkdir -p "$WORK"/{src,tests,evidence,tools,.tools,.deno-cache}
cd "$WORK"
export DENO_DIR="$WORK/.deno-cache"
export NO_COLOR=1
```

以後の作成・変更・実行は必ず `$WORK` 内で行う。リポジトリの `articles/`、`practice/`、`research/`、他の `logs/` は変更しない。`git init`、`git diff` を含む Git コマンドは一切使わない。

## 記録方法

各コマンドは stdout / stderr と exit code を分離して保存する。`tools/run-recorded.sh` を次の内容で作り、実行可能にする。

```bash
#!/usr/bin/env bash
set -o pipefail
label=$1
shift
"$@" 2>&1 | tee "evidence/${label}.log"
code=${PIPESTATUS[0]}
printf '%s\n' "$code" > "evidence/${label}.exit"
exit "$code"
```

```bash
chmod +x tools/run-recorded.sh
```

意図的失敗は `set +e` で囲み、直後に期待した非ゼロかを検査してから `set -e` に戻す。実行者は `$RUN_DIR/execution-log.md` に、実行順、コマンド、開始・終了時刻、exit code、観測結果、計画との差を追記する。

## 手順 1: Deno 2.9.0 を隔離取得する（20 分）

> 注: 当初案の `/opt/homebrew/bin/deno upgrade --output ...` は Homebrew 版 deno が
> upgrade 機能無効でビルドされているため使用不可（検証済み）。`deno upgrade` と同じ
> 公式リリース CDN（dl.deno.land）から直接取得する方式に差し替えた。

```bash
set +e
curl -fsSL "https://dl.deno.land/release/v2.9.0/deno-aarch64-apple-darwin.zip" \
  -o "$WORK/.tools/deno-2.9.0.zip" 2>&1 | tee evidence/00-deno-download.log
code=${PIPESTATUS[0]}
printf '%s\n' "$code" > evidence/00-deno-download.exit
set -e
test "$code" -eq 0
unzip -o "$WORK/.tools/deno-2.9.0.zip" -d "$WORK/.tools" 2>&1 | tee -a evidence/00-deno-download.log
chmod +x "$WORK/.tools/deno"
DENO="$WORK/.tools/deno"
"$DENO" --version 2>&1 | tee evidence/01-deno-version.log
"$DENO" --version | sed -n '1p' | grep -Eq '^deno 2\.9\.0 '
uname -s > evidence/01-os.txt
uname -m > evidence/01-arch.txt
```

`DENO` 変数は後続の同じ shell session で保持する。公式取得が失敗した場合は 1 回だけ同じコマンドを再実行し、それでも失敗したら実践を中止する。非公式 mirror、コンテナ、グローバル更新への切り替えはしない。

## 手順 2: 決定的な CLI とテスト fixture を作る（45 分）

実行者は `apply_patch` で次のファイルを `$WORK` に作る。

### `src/normalize.ts`

```ts
export type Mode = "lower" | "upper";

export function normalize(input: string, mode: Mode = "lower"): string {
  const compact = input.trim().replace(/\s+/g, " ");
  return mode === "upper" ? compact.toUpperCase() : compact.toLowerCase();
}
```

### `src/render.ts`

```ts
import { normalize } from "./normalize.ts";

export interface RecordInput {
  title: string;
  tags: string[];
}

export function render(input: RecordInput): string {
  const title = normalize(input.title, "upper");
  const tags = input.tags.map((tag) => normalize(tag)).join(", ");
  return [`title: ${title}`, `tags: ${tags}`].join("\n");
}
```

### `src/classify.ts`

```ts
export function classifyLength(value: string): "short" | "long" {
  return value.length >= 8 ? "long" : "short";
}
```

### `main.ts`

```ts
import { render, type RecordInput } from "./src/render.ts";

const fallback = '{"title":"  Deno  2.9 ","tags":[" Test ","CLI"]}';
const input = JSON.parse(Deno.args[0] ?? fallback) as RecordInput;
console.log(render(input));
```

### `tests/normalize_test.ts`

```ts
import { normalize, type Mode } from "../src/normalize.ts";

const cases: Array<{
  name: string;
  input: string;
  mode: Mode;
  expected: string;
}> = [
  { name: "normal", input: "Hello", mode: "lower", expected: "hello" },
  { name: "empty", input: "   ", mode: "lower", expected: "" },
  { name: "Japanese", input: "  こんにちは  ", mode: "lower", expected: "こんにちは" },
  { name: "extra spaces", input: "A   B", mode: "lower", expected: "a b" },
  { name: "upper", input: "Deno", mode: "upper", expected: "DENO" },
];

Deno.test.each(cases)("normalize: $name", ({ input, mode, expected }) => {
  const actual = normalize(input, mode);
  if (actual !== expected) {
    throw new Error(`expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`);
  }
});
```

### `tests/render_test.ts`

```ts
import { render } from "../src/render.ts";

Deno.test("render record", async (t) => {
  await t.assertSnapshot(render({
    title: "  Deno  2.9 ",
    tags: [" Snapshot ", "TABLE   TEST"],
  }));
});

Deno.test("temporary snapshot entry", async (t) => {
  await t.assertSnapshot(render({ title: "Temporary", tags: [] }));
});
```

### `tests/retry_test.ts`

```ts
let attempts = 0;

Deno.test({
  name: "first attempt fails deterministically",
  retry: 0,
  fn() {
    attempts += 1;
    if (attempts === 1) throw new Error("planned first-attempt failure");
  },
});
```

### `tests/repeat_test.ts`

```ts
import { normalize } from "../src/normalize.ts";

Deno.test("deterministic repeat target", () => {
  if (normalize("  Repeat  ") !== "repeat") throw new Error("unexpected result");
});
```

### `tests/classify_test.ts`

```ts
import { classifyLength } from "../src/classify.ts";

Deno.test("classifies short values", () => {
  if (classifyLength("short") !== "short") throw new Error("unexpected result");
});
```

作成後に次を実行する。

```bash
"$DENO" fmt src tests main.ts 2>&1 | tee evidence/02-fmt.log
"$DENO" fmt --check src tests main.ts 2>&1 | tee evidence/02-fmt-check.log
"$DENO" run main.ts 2>&1 | tee evidence/03-cli-smoke.log
```

期待値は `03-cli-smoke.log` に `title: DENO 2.9` と `tags: snapshot, table test` が含まれ、どの Deno permission も要求されないこと。

## 手順 3: `Deno.test.each` と filter を確認する（35 分）

```bash
./tools/run-recorded.sh 10-table-pass "$DENO" test tests/normalize_test.ts
./tools/run-recorded.sh 11-table-filter "$DENO" test \
  --filter "normalize: Japanese" tests/normalize_test.ts
```

`10-table-pass.log` では 5 ケースが独立した名前で表示され、`11-table-filter.log` では Japanese ケースだけが実行されることを記録する。

次の差分を `apply_patch` で入れ、1 ケースだけ意図的に壊す。

```diff
-  { name: "Japanese", input: "  こんにちは  ", mode: "lower", expected: "こんにちは" },
+  { name: "Japanese", input: "  こんにちは  ", mode: "lower", expected: "不一致" },
```

```bash
set +e
./tools/run-recorded.sh 12-table-planned-failure "$DENO" test \
  --filter "normalize: Japanese" tests/normalize_test.ts
code=$?
set -e
test "$code" -ne 0
```

`expected: "こんにちは"` へ `apply_patch` で戻し、同じ filter コマンドが 0 になることを `13-table-restored` として記録する。意図的失敗が 0、または復元後が非ゼロなら table test 項目は失敗判定とする。

## 手順 4: snapshot の生成・整理・差分・更新を確認する（55 分）

```bash
./tools/run-recorded.sh 20-snapshot-create "$DENO" test \
  --update-snapshots tests/render_test.ts
test -f tests/__snapshots__/render_test.ts.snap
cp tests/__snapshots__/render_test.ts.snap evidence/20-snapshot-created.snap
./tools/run-recorded.sh 21-snapshot-baseline "$DENO" test tests/render_test.ts
```

`tests/render_test.ts` から `temporary snapshot entry` テスト全体を `apply_patch` で削除し、古い entry の整理を確認する。

```bash
./tools/run-recorded.sh 22-snapshot-prune "$DENO" test \
  --update-snapshots tests/render_test.ts
cp tests/__snapshots__/render_test.ts.snap evidence/22-snapshot-pruned.snap
set +e
diff -u evidence/20-snapshot-created.snap evidence/22-snapshot-pruned.snap \
  > evidence/22-snapshot-prune.diff
diff_code=$?
set -e
test "$diff_code" -eq 1
```

次に `src/render.ts` の tag separator を `", "` から `" / "` へ `apply_patch` で変更する。

```diff
-  const tags = input.tags.map((tag) => normalize(tag)).join(", ");
+  const tags = input.tags.map((tag) => normalize(tag)).join(" / ");
```

```bash
set +e
./tools/run-recorded.sh 23-snapshot-mismatch "$DENO" test tests/render_test.ts
code=$?
set -e
test "$code" -ne 0
cp tests/__snapshots__/render_test.ts.snap evidence/23-snapshot-before-update.snap
./tools/run-recorded.sh 24-snapshot-update "$DENO" test \
  --update-snapshots tests/render_test.ts
cp tests/__snapshots__/render_test.ts.snap evidence/24-snapshot-after-update.snap
set +e
diff -u evidence/23-snapshot-before-update.snap evidence/24-snapshot-after-update.snap \
  > evidence/24-snapshot-update.diff
diff_code=$?
set -e
test "$diff_code" -eq 1
./tools/run-recorded.sh 25-snapshot-final-pass "$DENO" test tests/render_test.ts
```

`23-snapshot-mismatch.log` に読み取れる差分がなくても非ゼロなら証拠は残すが、「diff が分かりやすい」とは結論しない。`--update-snapshots` は正しさを証明せず、保存差分の人間による確認が必要だと扱う。

## 手順 5: retry と repeats を確認する（35 分）

まず `retry: 0` で専用テストが失敗することを確認する。

```bash
set +e
./tools/run-recorded.sh 30-retry-disabled "$DENO" test tests/retry_test.ts
code=$?
set -e
test "$code" -ne 0
```

`tests/retry_test.ts` の `retry: 0` を `retry: 1` へ `apply_patch` で変更し、同じテストを実行する。

```bash
./tools/run-recorded.sh 31-retry-enabled-first "$DENO" test tests/retry_test.ts
./tools/run-recorded.sh 31-retry-enabled-second "$DENO" test tests/retry_test.ts
grep -i "flaky" evidence/31-retry-enabled-first.log \
  > evidence/31-flaky-first-match.txt
grep -i "flaky" evidence/31-retry-enabled-second.log \
  > evidence/31-flaky-second-match.txt
./tools/run-recorded.sh 32-repeats "$DENO" test \
  --repeats=3 tests/repeat_test.ts
```

`31-retry-enabled-first.exit` と `31-retry-enabled-second.exit` が 0 かつ両ログに `flaky` 表示があること、`32-repeats.exit` が 0 で summary から繰り返し回数を説明できることを成功条件にする。counter が 2 回連続で同じ結果にならない場合は retry の結論を中止する。

## 手順 6: coverage gate を失敗から成功へ変える（45 分）

```bash
set +e
./tools/run-recorded.sh 40-coverage-before "$DENO" test \
  --coverage=evidence/coverage-before --coverage-threshold=100 \
  tests/classify_test.ts
code=$?
set -e
test "$code" -ne 0
```

`tests/classify_test.ts` 末尾へ次を `apply_patch` で追加する。

```ts
Deno.test("classifies long values", () => {
  if (classifyLength("12345678") !== "long") throw new Error("unexpected result");
});
```

```bash
./tools/run-recorded.sh 41-coverage-after "$DENO" test \
  --coverage=evidence/coverage-after --coverage-threshold=100 \
  tests/classify_test.ts
```

両実行の Deno version、対象ファイル、threshold は同じに保つ。`40` が非ゼロで不足 metric を表示し、`41` が 0 なら成功。追加後も 0 にならない場合は閾値を下げず、ログを残して coverage gate 項目を未達とする。

## 手順 7: 全必須項目の再実行（20 分）

retry 用の意図的 flaky test と coverage 用の専用 test は分け、最終の通常 suite には flaky test を含めない。

```bash
./tools/run-recorded.sh 50-required-suite "$DENO" test \
  tests/normalize_test.ts tests/render_test.ts tests/repeat_test.ts tests/classify_test.ts
./tools/run-recorded.sh 51-coverage-final "$DENO" test \
  --coverage=evidence/coverage-final --coverage-threshold=100 \
  tests/classify_test.ts
```

両方の exit code が 0 でなければ全体成功とはしない。

## 手順 8: `--related` と `--shard`（任意、最大 35 分）

必須項目がすべて完了し、開始から 5 時間以内の場合だけ実施する。

```bash
./tools/run-recorded.sh 60-related-render "$DENO" test \
  --related=src/render.ts tests/
./tools/run-recorded.sh 61-shard-1 "$DENO" test \
  --shard=1/2 tests/normalize_test.ts tests/render_test.ts \
  tests/repeat_test.ts tests/classify_test.ts
./tools/run-recorded.sh 62-shard-2 "$DENO" test \
  --shard=2/2 tests/normalize_test.ts tests/render_test.ts \
  tests/repeat_test.ts tests/classify_test.ts
```

`60` では `render_test.ts` だけが選ばれたかをテスト名で判断する。`61` と `62` は実行されたテストファイル集合を表に転記し、重複なく和集合が全 4 ファイルと一致するか確認する。小規模すぎて分割効果は測らず、集合が説明できない場合は観測不能として扱う。

## 観測・保存する証拠

- Deno exact version、OS、architecture。ホームパス、ユーザー名、hostname、環境変数一覧は保存しない。
- すべてのコマンド、stdout / stderr、exit code。
- table test の全ケース名、filter 後のケース名、意図的失敗の error。
- snapshot の生成場所、生成・prune・更新前後の `.snap` と `diff -u`。
- retry 無効時の失敗、retry 有効時の成功と `flaky` 行、repeats summary。
- 同じ threshold における coverage 失敗前とテスト追加後の出力・exit code。
- 任意項目では `--related` / 各 shard が実行したテストファイル名。
- 想定外の失敗は省略せず、原因未確定なら未確定と記録する。

## 成功基準

次をすべて満たしたときだけ実践全体を成功とする。

1. Deno 2.9.0 の exact version が記録されている。
2. `Deno.test.each` の 5 ケース成功、1 ケース filter、意図的失敗、復元後成功が記録されている。
3. snapshot の初回生成、古い entry 整理、差分による非ゼロ、更新、更新後成功が記録されている。
4. retry 無効時は非ゼロ、`retry: 1` 時は 0 かつ `flaky` 表示がある。
5. repeats 実行が 0 で、summary を記録できている。
6. coverage threshold 100 が追加テスト前は非ゼロ、追加後は 0 である。
7. 最終必須 suite と最終 coverage gate がともに 0 である。
8. 全必須検証がローカル・無料・認証なしで完了し、既存リポジトリファイルと Git state を変更していない。

`--related` と `--shard` は任意のため、未実施・観測不能でも全体成功を妨げない。ただし記事では未検証と明示する。

## 失敗基準

- Deno 2.9.0 を公式手段で隔離取得できない、または exact version を固定できない。
- 意図的失敗が 0 になる、復元・更新・テスト追加後も期待した成功へ戻らない。
- retry の結果が 2 回続けて再現しない、または成功しても `flaky` の有無を判定できない。
- 同一コード・同一コマンドで snapshot や coverage metric が不安定になる。
- credential、課金、外部サービス、過剰な Deno permission が必要になる。
- 必須 4 項目のいずれかが未完のまま 6 時間を超える。

失敗時は成功へ見せかけず、最後に成功した手順、失敗コマンド、exit code、未確定事項を execution log に残す。

## セキュリティ・コスト制限

- 費用上限は 0 円。課金サービスは使用しない。
- 取得元は Deno 公式 updater が使う公式配布先だけとし、非公式 binary、任意 install script、外部 package を実行しない。
- `deno run` と `deno test` に `--allow-all`、`-A`、`--allow-env`、`--allow-net`、`--allow-read`、`--allow-write` を付けない。default snapshot location はテストランナー管理に任せる。
- 入力は文書内の固定ダミーデータだけを使う。実在する氏名、メールアドレス、token、cookie を入れない。
- `env`、`printenv`、hostname、ユーザー名、ホームディレクトリの列挙をログへ出さない。
- ログを記事へ移す前に秘密らしき文字列とローカル絶対パスを目視・検索し、必要なら `<REDACTED>` へ置換する。検出結果自体に秘密値を複製しない。

## Cleanup

グローバル環境には何もインストールしないため、通常は run directory を証拠として保持する。execution log と必要証拠を確定した後だけ、再取得可能な runtime と cache を削除できる。

```bash
cd "$REPO"
rm -rf "$WORK/.tools" "$WORK/.deno-cache"
```

既存の別 run directory は削除しない。今回の run 自体を破棄する場合も、自動削除せず人間または orchestrator の明示判断に委ねる。

## Timebox

- 環境固定: 20 分
- fixture 作成と smoke test: 45 分
- table test / filter: 35 分
- snapshot: 55 分
- retry / repeats: 35 分
- coverage gate: 45 分
- 最終再実行と証拠整理: 50 分
- 任意の related / shard: 最大 35 分
- 必須合計: 約 4 時間 45 分、全体上限: 6 時間

5 時間時点で必須項目が残る場合は任意項目を中止する。6 時間で必須項目が未完なら実践を打ち切る。

## Fallback scope

- snapshot、table test、retry、coverage を必須範囲として維持し、`--related` と `--shard` を最初に削る。
- snapshot の stale entry 整理だけが再現しない場合、生成・差分失敗・更新後成功を残し、整理機能は未確認とする。ただし全体成功基準 3 は未達として記録する。
- coverage の metric 名や表示形式が想定と違っても、同じ threshold の exit code が失敗から成功へ変わればその観測範囲だけ扱う。数値が安定しなければ数値比較を捨てる。
- Deno 2.9.0 を公式手段で用意できない場合、2.8.3 で代替検証せず中止する。
- 追加ライブラリ、Docker、Git 履歴依存の `--changed`、ブラウザ検証へ範囲を広げない。

## 想定される記事の持ち帰り

実行ログが成功基準を満たした場合に限り、後続の記事では次を持ち帰り候補にする。

- Deno 2.9 の組み込み機能だけで、小さな CLI に table test、snapshot、retry、coverage gate を導入できたか。
- table test のケース単位 filter と snapshot の更新前後で、どの出力・終了コードを確認すべきか。
- retry は失敗を消す機能ではなく、通過後も `flaky` signal を残すか。
- coverage threshold を下げず、未検証 branch へのテスト追加で gate を通す手順が再現できたか。
- snapshot 更新は正しさの証明ではなく、保存差分を人間が確認する必要があること。
- `--related` と `--shard` は実測できた場合だけ、小規模 suite で観測した対象集合として紹介すること。

結論はこの隔離 CLI と Deno 2.9.0 の観測範囲に限定し、未実施機能、他 OS、他 runner、大規模プロジェクトへ一般化しない。
