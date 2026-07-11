---
title: "TypeScript 7と6の併用検証がtscのbin衝突で止まった記録"
emoji: "🧪"
type: tech
topics: [typescript, npm, nodejs]
published: true
---

## 対象読者

- TypeScript 7のCLIとTypeScript 6を1つのプロジェクトで併用したい人
- npmでパッケージのversionは合っているのに、`node_modules/.bin`から別のversionが起動する問題を切り分けたい人
- 比較ベンチマークの前にversion gateを置きたい人

## 何を検証したか

TypeScript公式は、TypeScript 7にはprogrammatic APIがないことと、TypeScript 6を必要とする処理のために`@typescript/typescript6`を併用する構成を案内しています。そこで、`typescript@7.0.2`と`@typescript/typescript6@6.0.2`をexact versionで入れ、ローカルの`tsc`と`tsc6`がそれぞれ期待したversionで起動するかを最初のgateとして確認しました。

公式のside-by-side運用の説明は[Announcing TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)で確認できます。

当初はversion gateの後に、同じfixtureで診断、emit、Compiler API、実行時間を比較する予定でした。しかしgateが失敗したため、以降は実行していません。この記事では、インストールとbin解決の観測結果だけを扱います。

## 検証環境

2026-07-11に次の環境で実行しました。

```text
OS: Darwin 25.5.0 arm64
Node.js: v22.17.0
npm: 10.9.2
logical CPUs: 10
memory: 17179869184 bytes
```

install scriptを無効化し、npm cacheを検証用の隔離ディレクトリ内に置いて実行しました。

## 再現手順

まず、registryが返すversionを確認します。

```bash
VERIFY_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/typescript7-side-by-side.XXXXXX")"
cd "$VERIFY_ROOT"
WORK_DIR="$(pwd)"
mkdir -p "$WORK_DIR/npm-cache"
npm_config_cache="$WORK_DIR/npm-cache" \
  npm view typescript@7.0.2 version --json
npm_config_cache="$WORK_DIR/npm-cache" \
  npm view @typescript/typescript6@6.0.2 version --json
```

この検証では、それぞれ`"7.0.2"`と`"6.0.2"`が返りました。次にこの作業ディレクトリで、両方をexact versionで入れます。

```bash
npm init -y
npm pkg set private=true
npm_config_cache="$WORK_DIR/npm-cache" npm install \
  --save-dev \
  --save-exact \
  --ignore-scripts \
  --no-audit \
  --no-fund \
  typescript@7.0.2 \
  @typescript/typescript6@6.0.2
npm ls --depth=0 --json
```

`npm ls`で観測したトップレベルのversionは次のとおりで、problemは報告されませんでした。

```text
typescript -> 7.0.2
@typescript/typescript6 -> 6.0.2
problems -> none
```

この状態でローカルCLIのversionを確認します。

```bash
./node_modules/.bin/tsc --version
./node_modules/.bin/tsc6 --version
```

## 観測結果

両コマンドとも終了コードは`0`でしたが、出力はどちらも`6.0.3`でした。

```text
$ ./node_modules/.bin/tsc --version
Version 6.0.3
$ ./node_modules/.bin/tsc6 --version
Version 6.0.3
```

期待値は`tsc`が`7.0.2`、`tsc6`が`6.0.2`です。実行結果を検査する次のassertionは、どちらも失敗しました。

```bash
./node_modules/.bin/tsc --version | grep -Eq '7\.0\.2'
./node_modules/.bin/tsc6 --version | grep -Eq '6\.0\.2'
```

そのため、予定していたfixtureの作成、診断比較、emit比較、Compiler APIテスト、ベンチマークには進みませんでした。

## 失敗の切り分け

インストール済みのpackage manifestとbin symlinkを調べると、次の関係になっていました。

```text
typescript package version: 7.0.2
typescript package bin: { "tsc": "./bin/tsc" }

@typescript/typescript6 package version: 6.0.2
@typescript/typescript6 dependency: { "@typescript/old": "npm:typescript@^6" }
@typescript/typescript6 bin: { "tsc6": "./bin/tsc6" }

@typescript/old installed version: 6.0.3
tsc  -> ../@typescript/old/bin/tsc
tsc6 -> ../@typescript/typescript6/bin/tsc6
```

さらに、トップレベルのTypeScript 7をpackage内のentrypointから直接起動すると、7.0.2と出力されました。

```text
$ node node_modules/typescript/bin/tsc --version
Version 7.0.2

$ node node_modules/@typescript/typescript6/bin/tsc6 --version
Version 6.0.3
```

ここまでは観測事実です。これらから、この依存グラフでは次の2つが重なったと解釈しました。

1. `@typescript/typescript6@6.0.2`の`@typescript/old`への依存は`npm:typescript@^6`であり、npmは`6.0.3`を選択した。
2. ローカルの`.bin/tsc`はトップレベルの`typescript`ではなく、依存先の`@typescript/old`を指した。

ただし、この解釈をすべてのnpm versionや既存lockfileに一般化はできません。今回は依存の上書きやbin symlinkの手作業修正を行わず、この結果を理由に検証を止めました。したがって、この記事に「修正後の成功手順」はありません。

## 制限事項

- TypeScript 6/7の診断が一致するかは未検証です。
- emit結果とCompiler APIの挙動は未検証です。
- TypeScript 6/7の性能差は測定していません。
- 最初の複合gate実行で`tsc-version.txt`が空になった原因は未解決です。ただし、再実行した2つのCLIはいずれも終了コード`0`で、繰り返し`6.0.3`を出力しました。
- 将来のwrapper release、異なる依存range、別のnpmで同じ結果になるかは調べていません。
- 現時点のregistry解決は将来変わる可能性があるため、この実行と同じ依存グラフを調べるには保存済みのlockfileが必要です。

## まとめ

2026-07-11のこの検証では、`typescript@7.0.2`と`@typescript/typescript6@6.0.2`のexact top-level installには成功しました。しかし、ローカルの`tsc`と`tsc6`はどちらも`6.0.3`を返し、side-by-side比較の前提を満たせませんでした。

依存一覧のversionだけでなく、比較に使う実際のCLIそれぞれに`--version`を実行し、期待値と照合するgateが必要だと分かりました。このgateにより、TypeScript 6を2回起動した結果をTypeScript 6/7の比較として誤って扱うことを防げました。

## 参考資料

- [Announcing TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)（2026-07-11閲覧）
