---
title: "Deno 2.9のdeno taskキャッシュをhit・復元・無効化まで試す"
emoji: "🦕"
type: tech
topics: ["deno", "typescript", "cache"]
published: true
---

## 対象読者

- `deno task`でビルド処理をまとめている方
- キャッシュが効いたかを実行時間ではなく、実行回数や生成物で確かめたい方
- 入力、引数、環境変数、依存taskのどれが再実行につながるのか知りたい方

## 検証したこと

Deno 2.9では、`deno task`に入力ベースのキャッシュが追加されました。公式リリースとtask referenceでは、`files`でキャッシュを有効にし、command、引数、該当ファイルの内容、列挙した環境変数、依存taskなどをfingerprintへ反映する仕組みが説明されています。`output`を指定すると、cache hit時に生成物も復元されます（[Deno 2.9リリース](https://deno.com/blog/v2.9)、[`deno task` reference](https://docs.deno.com/runtime/reference/cli/task/)）。

今回は小さなTypeScript fixtureを作り、次を対照検証しました。

1. `files`のないtaskと、`files`を持つtaskの2回目の挙動
2. 宣言した`output`を削除した後の復元
3. source、追加引数、列挙した環境変数、依存taskの入力、command文字列による無効化
4. sourceのmtimeだけ、未列挙の環境変数だけを変えた場合の境界挙動
5. 0件matchのglob、失敗task、`output`未指定taskの挙動

判定には処理時間を使わず、task bodyが追記するinvocation ledger、生成物の有無とSHA-256、Denoが出したcache表示を使いました。

## 環境

| 項目 | 検証値 |
|---|---|
| OS / architecture | macOS Darwin 25.5.0 / arm64 |
| 検証対象 | Deno 2.9.0 |
| V8 | 14.9.207.2-rusty |
| TypeScript | 6.0.3 |
| 比較用system Deno | 2.8.3（記録のみ、検証には未使用） |
| task cache | run専用の`DENO_DIR` |

Deno 2.9.0は公式のmacOS arm64 archiveをrun directoryへ取得し、公式SHA-256 checksumに一致したbinaryだけを使いました。object形式taskの`files`、`output`、`env`を受理するschema probeも先にexit 0で通過しています。

このテーマはCLIだけで完結するため、ブラウザやPlaywrightは使っていません。

## 再現手順

### 1. 実行回数を記録するfixtureを作る

sourceは、後で`alpha`から`beta`へ変更できる1行だけにしました。

```ts
// src/message.ts
export const message = "alpha";
```

build scriptは、task名、追加引数、`MODE`、sourceの値、依存taskの出力をJSONへ保存します。同時に、bodyが実行された証拠を`evidence/invocations.jsonl`へ1行追記します。

```ts
// build.ts
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
```

依存task用には`config/prefix.txt`を`generated/prefix.txt`へコピーするscriptを用意しました。

```ts
// prepare.ts
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
```

失敗caseはledgerへ追記してから意図的にexit 1にします。

```ts
// fail.ts
await Deno.mkdir("evidence", { recursive: true });
await Deno.writeTextFile(
  "evidence/invocations.jsonl",
  `${JSON.stringify({ task: "failure", aboutToExit: 1 })}\n`,
  { append: true, create: true },
);
console.error("intentional failure");
Deno.exit(1);
```

初期値として`config/prefix.txt`には`prefix-one`を書きました。

### 2. taskごとにキャッシュ条件を変える

`deno.json`では、比較対象以外のcommandと権限をできるだけそろえました。

```json
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
```

### 3. cache hitと生成物復元を確認する

`DENO_DIR`を空の専用directoryへ向け、fixture directoryから次の順で実行しました。

```bash
export DENO_DIR=/absolute/path/to/run-local-deno-dir

deno task baseline
deno task baseline

deno task main
deno task main
cp dist/main.json evidence/main.first.json
shasum -a 256 dist/main.json > evidence/main.first.sha256
rm dist/main.json
deno task main
shasum -a 256 dist/main.json > evidence/main.restored.sha256
cmp evidence/main.first.json dist/main.json
```

各commandの直前と直後に、対象taskのledger行数、生成物の有無、生成物のSHA-256を記録しました。

### 4. 無効化条件を1軸ずつ変える

sourceでは、まず内容を変えずにmtimeだけを更新し、その後`message`を`beta`へ変更しました。

```bash
touch src/message.ts
deno task main

# src/message.tsのalphaをbetaへ変更
deno task main
```

引数と環境変数は値を1つずつ変えました。

```bash
deno task arguments foo
deno task arguments foo
deno task arguments bar

MODE=dev deno task listed-env
MODE=dev deno task listed-env
MODE=prod deno task listed-env

UNRELATED=A deno task unlisted-env
UNRELATED=B deno task unlisted-env
```

依存taskでは、無変更の2回目を実行した後、`config/prefix.txt`を`prefix-one`から`prefix-two`へ変えました。

```bash
deno task dependency
deno task dependency
# config/prefix.txtをprefix-twoへ変更
deno task dependency
```

command文字列のcaseでは、`command-v1`のまま2回実行した後、`deno.json`内の末尾引数だけを`command-v2`へ変更して3回目を実行しました。

```bash
deno task command-key
deno task command-key
# command-keyのcommand-v1をcommand-v2へ変更
deno task command-key
```

### 5. 境界caseを実行する

0件matchのglob、失敗task、`output`未指定taskも同じledgerで観測しました。

```bash
deno task zero-match
deno task zero-match

deno task failure || true
deno task failure || true

deno task no-output
deno task no-output
rm dist/no-output.json
deno task no-output
test ! -e dist/no-output.json
```

実際の検証では`|| true`でexit codeを消さず、記録helperで2回ともexit 1だったことを保存したうえで、期待した非0終了として次へ進めました。

## 観測結果

### cache hitと復元

| case | ledger count | 生成物 | 観測 |
|---|---:|---|---|
| `baseline` 1回目→2回目 | 0→1→2 | 生成 | 2回ともbodyを実行 |
| `main` 初回 | 0→1 | 生成 | bodyを実行 |
| `main` 無変更 | 1→1 | hash不変 | `(cached, inputs unchanged)` |
| `main` 生成物削除後 | 1→1 | 同じhashで復元 | `(cached, inputs unchanged)` |

`main`の初回生成物と復元後のSHA-256は、どちらも次の値でした。`cmp`もexit 0です。

```text
9cb4a393d42a1aa03c0e42bb50cf855fd6d01907587f18cb8932096cf002e4a2
```

つまり、このfixtureでは`files`があるtaskは無変更時にbodyをskipし、`output`で宣言した生成物は削除後もbodyを再実行せず復元されました。

### 無効化matrix

| 変更軸 | 変更内容 | ledgerの変化 | 結果 |
|---|---|---:|---|
| source content | `alpha`→`beta` | `main` 1→2 | bodyを再実行、生成物hashも変化 |
| appended argument | `foo`→`bar` | `arguments` 1→2 | bodyを再実行、markerも変化 |
| listed env | `MODE=dev`→`prod` | `listed-env` 1→2 | bodyを再実行、modeも変化 |
| dependency input | `prefix-one`→`prefix-two` | `prepare` 1→2、`dependency` 1→2 | 上流・下流とも再実行 |
| command definition | `command-v1`→`command-v2` | `command-key` 1→2 | bodyを再実行、markerも変化 |

同じ値での2回目は、各taskともledgerが増えず、Denoの出力に`(cached, inputs unchanged)`が現れました。一方、各軸を変更した実行では明示的なmiss文言は出ず、bodyのstdoutとledger増分で再実行を判定しました。

### 境界case

| case | 1回目→2回目のledger | 観測結果 |
|---|---:|---|
| sourceのmtimeだけ変更 | `main` 1→1 | cache hit |
| 未列挙の`UNRELATED`を`A`→`B` | `unlisted-env` 1→1 | cache hit |
| `files`が0件match | `zero-match` 0→1→2 | 2回ともbodyを実行 |
| exit 1のtask | `failure` 0→1→2 | 2回ともexit 1 |
| `output`未指定、無変更 | `no-output` 0→1→1 | 2回目はbodyをskip |
| `output`未指定、生成物削除後 | `no-output` 1→1 | bodyをskipし、生成物は欠けたまま |

mtime-onlyと未列挙envは、このfixtureでの探索的な観測です。すべてのファイルシステムや、taskが実際に読む未列挙envへ一般化はできません。

`no-output`の結果からは、少なくとも今回の条件では「task bodyをskipすること」と「削除したartifactを復元すること」は別だと分かります。復元が必要な生成物は`output`へ宣言する必要があります。

## 失敗と修正

予期しない機能失敗、blocker、再試行、設定修正はありませんでした。Deno 2.9.0の取得、checksum、version、object task schemaの各gateは最初の実行で通過し、全29 commandは期待したexit classになりました。

`failure` taskの2回のexit 1は、失敗結果が成功としてcacheされないかを見るための意図した負例です。どちらもledgerへ追記され、bodyが再実行されたため、成功に直す変更は加えていません。

fixtureと記録helperは計画上のshell heredocではなく、workspaceのpatch機構で作成しました。ファイル内容、task定義、権限、実行順は計画どおりであり、観測内容への影響はありません。

## 制限事項

今回の結果はDeno 2.9.0、macOS arm64、単一のローカルfixture、run専用`DENO_DIR`に限定されます。次は検証していません。

- 他のDeno patch version、OS、CPU、filesystem
- shared cache、remote cache、CI間のcache共有
- 並行実行やcache内部形式
- performanceや所要時間の改善
- 宣言していないがtask bodyから実際に読む入力の網羅性
- ブラウザ上の動作

公式リリースはOS、CPU architecture、Deno versionもfingerprintの要素として説明していますが、今回はそれらを切り替えた比較をしていません（[Deno 2.9リリース](https://deno.com/blog/v2.9)）。そのため、別環境へのcache portabilityは結論に含めません。

また、0件matchと失敗taskはそれぞれ2回だけの観測です。安全側の挙動を確認できましたが、あらゆる失敗形式やglob patternを網羅したものではありません。

## まとめ

Deno 2.9.0の小さなfixtureでは、`files`がキャッシュ利用の境界として働き、無変更のtaskはledgerを増やさずskipされました。宣言済み`output`を削除すると、bodyを再実行せず初回と同じSHA-256の生成物が復元されました。

source、追加引数、列挙した環境変数、依存taskの入力、command定義を変えたcaseでは、それぞれbodyが再実行されました。一方、0件matchと失敗taskは2回とも実行され、`output`未指定taskではskipはされても削除済み生成物は復元されませんでした。

キャッシュの確認では実行時間だけを見ず、cache表示、bodyの実行回数、生成物のhashを組み合わせると、hit、miss、artifact復元を分けて判断できます。

## 参考資料

- [Deno 2.9リリース](https://deno.com/blog/v2.9)
- [`deno task` reference](https://docs.deno.com/runtime/reference/cli/task/)
