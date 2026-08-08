---
title: "Node 26.7の--test-coverage-include-allを試したら、正直になったのはlineだけだった"
emoji: "📉"
type: "tech"
topics: ["nodejs", "testing", "coverage", "c8"]
published: true
---

<!-- 前提: 出典ログ logs/run-node-test-coverage-include-all-20260809-0410/execution-log.md / 記事タイプ: 検証ログ（試してみた）/ slug: node26-test-coverage-include-all-line-only / published: false -->

## はじめに

Node.js v26.7.0 のリリースノートを眺めていたら、Notable Changes の最後に `--test-coverage-include-all` という1行がありました。「カバレッジレポートに、一度も読み込まれなかったソースファイルを含める」というフラグです。

これがなぜ必要なのかは、リンクされていた [Issue #58887](https://github.com/nodejs/node/issues/58887) を読んで分かりました。`node --test` の既定のカバレッジは「テスト実行中に読み込まれたファイル」しか表に出しません。つまりテストが1行も無いファイルを追加しても、そのファイルは分母に載らないので、カバレッジ率は下がらない。むしろ上がることすらある。

そこで、最小の検証リポジトリを作って、フラグの有無で数字がどう変わるかを見てみました。狙いどおり総カバレッジは 78.95% → 26.79% と大きく落ちたのですが、同時に、落ちたのは line だけで branch と funcs は 1pt も動かない、という予想外のところに突き当たりました。この記事はその記録です。

以前も `node --test` のシード値まわりを触った記事を書いたのですが、今回は同じ `node --test` でも軸はカバレッジです。

:::message
筆者は実務経験の浅いエンジニアで、Node 標準のカバレッジ機能をちゃんと触るのは初めてです。実行環境は macOS 26.5 / arm64（Apple Silicon）/ Node **v26.7.0**（比較用に **v26.5.0**）/ c8 **12.0.0**。以下の数値はすべてこのサンプル構成での観測値で、構成が変わればまったく別の数字になります。
:::

## 使ったもの・環境

- Node.js **v26.7.0**（`--test-coverage-include-all` は 26.7.0 で追加。リリース日は 2026-08-05、PR は [#64830](https://github.com/nodejs/node/pull/64830) で SEMVER-MINOR）
- 比較用に Node.js **v26.5.0**（nvm で切り替え）
- 比較対象として **c8 12.0.0**（`--all` オプションを持つ既存ツール）
- 追加の依存は c8 だけ。検証本体は Node 標準機能のみ

確かめたかったのは次の5点です。

1. フラグ**なし**の出力に、どこからも参照されていないファイルが現れないこと
2. フラグ**あり**の出力に、それが 0% で現れること
3. その2パターンで `all files` 行の数字がどれだけ動くか
4. 26.7.0 未満で同じコマンドを叩いたらどうなるか
5. しきい値オプション（`--test-coverage-lines` 等）と組み合わせたときの終了コード

### 事前に `node --help` を比べた

まず、v26.5.0 と v26.7.0 で `node --help` のカバレッジ関連行を diff しました。

```bash
~/.nvm/versions/node/v26.7.0/bin/node --help 2>&1 | grep -i coverage > help-26.7.txt
~/.nvm/versions/node/v26.5.0/bin/node --help 2>&1 | grep -i coverage > help-26.5.txt
diff help-26.5.txt help-26.7.txt
```

v26.7.0 側の出力（全文）:

```
  --experimental-test-coverage
                              enable code coverage in the test runner
  --test-coverage-branches=...
                              the branch coverage minimum threshold
  --test-coverage-exclude=... exclude files from coverage report that
  --test-coverage-functions=...
                              the function coverage minimum threshold
  --test-coverage-include=... include files in coverage report that
  --test-coverage-include-all include source files that were never
                              loaded in the coverage report
  --test-coverage-lines=...   the line coverage minimum threshold
NODE_V8_COVERAGE            directory to output v8 coverage JSON to
```

diff（全文）:

```
8a9,10
>   --test-coverage-include-all include source files that were never
>                               loaded in the coverage report
```

増えているのはこの1オプションだけでした。ここで一つ気づいたのは、カバレッジ本体は v26.7.0 でも `--experimental-test-coverage` のままだということです。新フラグの側には `--experimental-` が付いていないのに、それを使うには experimental なフラグが必要という状態でした。

## 環境構築（最小プロジェクトの構成）

「テストされていない度合い」が3段階並ぶように、意図的にファイルを配置しました。

```
./package.json
./src/dead-branch.js
./src/format.js
./src/greet.js
./src/legacy-report.js
./test/greet.test.js
```

`package.json` は `{"type":"module"}` だけです。`.mjs` にせず `.js` のまま `import` を書きたかったので、ESM 指定にしました。行数は合計 67 行です。

```
      24 src/dead-branch.js
      11 src/format.js
       8 src/greet.js
      13 src/legacy-report.js
      11 test/greet.test.js
      67 total
```

テスト対象になるのは `greet.js` だけです。分岐を1つ持たせています。

```js:src/greet.js
import { capitalize } from './format.js';

export function greet(name) {
  if (!name) {
    return 'Hello, world';
  }
  return `Hello, ${capitalize(name)}`;
}
```

`format.js` は `greet.js` から import されますが、`shout` は誰も呼びません。「読み込まれてはいるが一部未カバー」の役です。

```js:src/format.js
// greet.js から使われるのは capitalize だけ。shout はどこからも呼ばれない。
export function capitalize(s) {
  if (s.length === 0) {
    return s;
  }
  return s[0].toUpperCase() + s.slice(1);
}

export function shout(s) {
  return `${s.toUpperCase()}!!!`;
}
```

残り2つが今回の主役、どこからも import されていない置き去りファイルです。

```js:src/legacy-report.js
// どこからも import されていない「置き去りファイル」その1。
export function buildHeader(title) {
  return `=== ${title} ===`;
}

export function buildRow(label, value) {
  return `${label}: ${value}`;
}

export function buildReport(title, rows) {
  const body = rows.map(([l, v]) => buildRow(l, v)).join('\n');
  return `${buildHeader(title)}\n${body}`;
}
```

```js:src/dead-branch.js
// どこからも import されていない「置き去りファイル」その2。
// if/else と switch を含め、branch / function カバレッジが 0% になることを見せる。
export function classify(n) {
  if (n < 0) {
    return 'negative';
  } else if (n === 0) {
    return 'zero';
  } else {
    return 'positive';
  }
}

export function toLabel(kind) {
  switch (kind) {
    case 'negative':
      return 'マイナス';
    case 'zero':
      return 'ゼロ';
    case 'positive':
      return 'プラス';
    default:
      return '不明';
  }
}
```

`dead-branch.js` にわざわざ `if/else` と `switch` を入れたのは、branch と funcs が 0% になるところを見たかったからです。結果としてはこれが一番いい判断でした（後述）。

本当にどこからも参照されていないことは grep で確認しています。

```bash
grep -rn "legacy-report\|dead-branch" --include='*.js' .
# → 0 hits
```

テストは2本だけです。あえて `format.js` と未参照2ファイルのテストは書きませんでした。

```js:test/greet.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { greet } from '../src/greet.js';

test('名前があれば先頭を大文字にして挨拶する', () => {
  assert.equal(greet('taro'), 'Hello, Taro');
});

test('名前が空なら world にする', () => {
  assert.equal(greet(''), 'Hello, world');
});
```

`node --test` は緑になりました。

```
✔ 名前があれば先頭を大文字にして挨拶する (2.080125ms)
✔ 名前が空なら world にする (0.378ms)
ℹ tests 2
ℹ suites 0
ℹ pass 2
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 242.202917
```

実行する前に、期待するカバレッジをメモしておきました。`greet.js` は 100/100/100、`format.js` は funcs 50% 前後で lines 70% 前後、未参照2ファイルは 0/0/0。このうち最後の予想を思いきり外します。

## 実際に試したこと（パターン比較）

以下すべて検証リポジトリを cwd として、`~/.nvm/versions/node/v26.7.0/bin/node` で実行しています。

### A: ベースライン

```bash
node --test --experimental-test-coverage
```

```
ℹ start of coverage report
ℹ -----------------------------------------------------------
ℹ file       | line % | branch % | funcs % | uncovered lines
ℹ -----------------------------------------------------------
ℹ src        |        |          |         |
ℹ  format.js |  63.64 |    66.67 |   50.00 | 4-5 10-11
ℹ  greet.js  | 100.00 |   100.00 |  100.00 |
ℹ -----------------------------------------------------------
ℹ all files  |  78.95 |    83.33 |   66.67 |
ℹ -----------------------------------------------------------
ℹ end of coverage report
```

終了コードは 0。`legacy-report.js` と `dead-branch.js` は1行も出ません。表に載っているのは読み込まれた2ファイルだけで、`all files` は 78.95%。24行と13行の未テストコードが転がっているのに 78.95% と表示されるのが、Issue が言っていた状況そのものです。

`format.js` の未カバー行が `4-5 10-11`（`capitalize` の早期 return と `shout` 全体）と具体的に出るのは素直に便利でした。予想では 90% くらいかと思っていましたが、`shout` が丸ごと未カバーな分だけ低くなりました。

### B: `--test-coverage-include` を足す

「対象を明示すれば拾ってくれるのでは」と思って `--test-coverage-include` を付けました。

```bash
node --test --experimental-test-coverage --test-coverage-include='src/**'
```

結果は A とまったく同じ、`all files | 78.95 | 83.33 | 66.67`。diff を取ると差分はテスト実行時間の行だけでした。

```
1,2c1,2
< ✔ 名前があれば先頭を大文字にして挨拶する (1.257584ms)
< ✔ 名前が空なら world にする (0.166375ms)
---
> ✔ 名前があれば先頭を大文字にして挨拶する (2.771833ms)
> ✔ 名前が空なら world にする (0.157375ms)
10c10
< ℹ duration_ms 287.306125
---
> ℹ duration_ms 236.276708
```

カバレッジ表は1文字も違いません。`--test-coverage-include` は「読み込まれたファイルの絞り込み」であって、読み込まれていないファイルを連れてくるものではない、ということでした。ここを取り違えていたので、A と B の diff が実行時間だけになったのを見てようやく納得しました。

なお、glob をクォートで囲んでいるのは理由があります（後述の詰まった点）。

### C: `--test-coverage-include-all` を足す

```bash
node --test --experimental-test-coverage --test-coverage-include='src/**' --test-coverage-include-all
```

```
ℹ start of coverage report
ℹ ------------------------------------------------------------------
ℹ file              | line % | branch % | funcs % | uncovered lines
ℹ ------------------------------------------------------------------
ℹ src               |        |          |         |
ℹ  dead-branch.js   |   0.00 |   100.00 |  100.00 | 1-24
ℹ  format.js        |  63.64 |    66.67 |   50.00 | 4-5 10-11
ℹ  greet.js         | 100.00 |   100.00 |  100.00 |
ℹ  legacy-report.js |   0.00 |   100.00 |  100.00 | 1-13
ℹ ------------------------------------------------------------------
ℹ all files         |  26.79 |    83.33 |   66.67 |
ℹ ------------------------------------------------------------------
ℹ end of coverage report
```

表の行数は 2 → 4 に増え、`all files` の line % は 78.95% から 26.79% へ、52.16pt 落ちました。ここは期待どおりです。

ただ、未参照ファイルの行をよく見てください。`0.00 / 100.00 / 100.00` です。0/0/0 だと思っていました。`uncovered lines` は `1-24` / `1-13` とファイル全体を指しているのに、branch と funcs だけ満点になっています。

その結果、`all files` の branch 83.33% と funcs 66.67% は B から 1pt も動いていません。line だけが落ちて、他の2つは何も変わらない。

自分が分かっていなかったのは、「ファイルが読み込まれていない＝分岐も関数も0回実行」なら 0% になるはず、という思い込みでした。実際は分母（そのファイル内の分岐数・関数数）も 0 として扱われて、0/0 が 100% に丸められているように見えます。V8 のカバレッジ情報がそもそも生成されていないファイルについて、行数だけ後から数えて足しているような挙動です。あくまで出力からの推測なので、実装をちゃんと読んだわけではありません。

### D: `--test-coverage-include` なしで include-all だけ

```bash
node --test --experimental-test-coverage --test-coverage-include-all
```

C と完全一致（差分は実行時間の2行だけ）でした。今回のサンプルでは `src/` の外に `.js` が無いので当然です。`test/greet.test.js` は表に出ないので、テストファイルは既定で除外というドキュメントの記述も実測と一致しました。

では探索範囲はどこまでなのか気になったので、ルート直下に `stray-root.js`、それと `scripts/tool.js`（どちらも3行のダミー）を置いて D を再実行しました。

```
ℹ file              | line % | branch % | funcs % | uncovered lines
ℹ scripts           |        |          |         |
ℹ  tool.js          |   0.00 |   100.00 |  100.00 | 1-3
ℹ src               |        |          |         |
ℹ  dead-branch.js   |   0.00 |   100.00 |  100.00 | 1-24
ℹ  format.js        |  63.64 |    66.67 |   50.00 | 4-5 10-11
ℹ  greet.js         | 100.00 |   100.00 |  100.00 |
ℹ  legacy-report.js |   0.00 |   100.00 |  100.00 | 1-13
ℹ stray-root.js     |   0.00 |   100.00 |  100.00 | 1-3
ℹ all files         |  24.19 |    83.33 |   66.67 |
```

`src/` の外の雑多な `.js` も全部 0% で計上され、率は 26.79% → 24.19% へさらに下がりました。探索は本当に cwd 全体のようです。

この状態で `--test-coverage-include='src/**'` を戻すと、表は `src/` の4ファイルだけになり `all files 26.79%` に戻りました。include-all で集めた候補にも include フィルタが AND で効くということで、これはドキュメントどおりです。

`node_modules/` も気になったので、後述の c8 を入れたあと（`node_modules` 配下に `.js` が 280 個ある状態）で D を再実行しましたが、表は `src/` の4ファイルのみ、`all files 26.79%` のままでした。ここは確実に除外されるようです。

### E: Node 26.5.0 で同じコマンド

```bash
~/.nvm/versions/node/v26.5.0/bin/node --test --experimental-test-coverage \
  --test-coverage-include='src/**' --test-coverage-include-all
```

出力（全文）:

```
~/.nvm/versions/node/v26.5.0/bin/node: bad option: --test-coverage-include-all
```

```
exit=9
```

これで終わりです。テストは1件も走りません。終了コードは 9（Node の invalid argument）。

読者が最初に踏むのはたぶんここだと思います。エラーは1行だけでカバレッジの話は一切出てこないので、バージョンが原因だと気づきにくいです。`node -v` を先に確認するのが早いです。

### 5パターンまとめ

| パターン | line % | branch % | funcs % | 表に出たファイル数 | exit |
|---|---|---|---|---|---|
| A ベースライン | 78.95 | 83.33 | 66.67 | 2 | 0 |
| B + `--test-coverage-include` | 78.95 | 83.33 | 66.67 | 2 | 0 |
| C + `--test-coverage-include-all` | 26.79 | 83.33 | 66.67 | 4 | 0 |
| D include-all だけ | 26.79 | 83.33 | 66.67 | 4 | 0 |
| E Node 26.5.0 | 実行不可（`bad option`） | - | - | - | 9 |

## 詰まった点

### `grep --include=*.js` が grep に届く前に死んだ

未参照であることを確認しようとして、こう叩きました。

```bash
grep -rn "legacy-report\|dead-branch" --include=*.js .
```

返ってきたのはこれです。

```
(eval):4: no matches found: --include=*.js
```

grep のエラーではなく、zsh のエラーでした。zsh は `nomatch` が既定 on なので、`--include=*.js` という語全体を glob として評価して、マッチするファイルが無いと**コマンドを実行する前に**落とします。bash なら素通しされる書き方です。オプションの一部が glob に見えるとこうなるのは知りませんでした。

シングルクォートで囲めば通ります。

```bash
grep -rn "legacy-report\|dead-branch" --include='*.js' .
```

このトラブルは knowledge に記録しました。

### 同じ理由で `--test-coverage-include=src/**` も死ぬ

上と同じ話で、Node のオプションのほうもクォートしないと zsh で落ちます。せっかくなので zsh と bash で対照実験しました。

```
$ node --test --experimental-test-coverage --test-coverage-include=src/** --test-coverage-include-all   # zsh, クォート無し
zsh:1: no matches found: --test-coverage-include=src/**
exit=1
```

```
$ bash -c "... --test-coverage-include=src/** ..."   # bash, クォート無し
ℹ start of coverage report
ℹ ------------------------------------------------------------------
ℹ file              | line % | branch % | funcs % | uncovered lines
ℹ ------------------------------------------------------------------
ℹ src               |        |          |         |
ℹ  dead-branch.js   |   0.00 |   100.00 |  100.00 | 1-24
ℹ  format.js        |  63.64 |    66.67 |   50.00 | 4-5 10-11
ℹ  greet.js         | 100.00 |   100.00 |  100.00 |
ℹ  legacy-report.js |   0.00 |   100.00 |  100.00 | 1-13
ℹ ------------------------------------------------------------------
ℹ all files         |  26.79 |    83.33 |   66.67 |
ℹ ------------------------------------------------------------------
ℹ end of coverage report
exit=0
```

bash では素通しでちゃんと動きます。macOS の既定シェルは zsh なので、記事やREADMEにコマンド例を書くならクォートを付けておいたほうが親切だと思いました。

### しきい値 80 で比較しようとしたら、比較対象のほうも落ちた

「include-all を入れると CI が赤くなる」を見せたくて `--test-coverage-lines=80` を B と C の両方にかけたのですが、B（78.95%）も落ちてしまって差が出ませんでした。サンプルの baseline が 80% を割っていたのに気づいていませんでした。`shout` を未使用にした分だけ、想定より低くなっていたわけです。

しきい値を 70 に変えたら意図した比較になりました。

```bash
node --test --experimental-test-coverage --test-coverage-include='src/**' --test-coverage-lines=70
node --test --experimental-test-coverage --test-coverage-include='src/**' --test-coverage-include-all --test-coverage-lines=70
```

| コマンド | all files line % | exit |
|---|---|---|
| B + `--test-coverage-lines=70` | 78.95 | 0（緑） |
| C + `--test-coverage-lines=70` | 26.79 | 1（赤） |
| C + `--test-coverage-lines=26` | 26.79 | 0 |
| C + `--test-coverage-lines=27` | 26.79 | 1 |
| B + `--test-coverage-lines=80` | 78.95 | 1 |
| C + `--test-coverage-lines=80` | 26.79 | 1 |

境界も 26 で通る / 27 で落ちる、と素直でした。未達時のメッセージはこれです。

```
ℹ Error: 26.79% line coverage does not meet threshold of 70%.
```

出力位置が少し意外で、`duration_ms` の直後、カバレッジ表の**前**に出ます。表を見て原因を探すつもりでスクロールすると、エラーはその上にあります。

## 触ってみて分かったこと

一番の収穫は、C の表で未参照ファイルが `0.00 / 100.00 / 100.00` と出ていたところです。line だけが 0% になり、branch と funcs は満点扱いになる。だから `all files` の branch/funcs は include-all の有無で動きません。

これが実務でどう効くかを確かめるため、`--test-coverage-functions` でしきい値を張ってみました。

| コマンド | funcs % | exit |
|---|---|---|
| B + `--test-coverage-functions=60` | 66.67 | 0 |
| C + `--test-coverage-functions=60` | 66.67 | 0 |

include-all を入れても funcs しきい値では落ちません。「include-all を入れた瞬間に CI が赤くなる」は lines しきい値でだけ起きる話でした。逆に言うと、関数カバレッジのしきい値を運用しているプロジェクトでは、include-all を入れても水増しは直らないことになります。

もう一つは、`--test-coverage-include` を付けないと探索が cwd 全体になる点です。D2 の実験で `stray-root.js` や `scripts/tool.js` まで拾われました。既存プロジェクトに include-all だけ足すと、ビルドスクリプトや設定ファイルが分母に入ってきます。実務では `--test-coverage-include` とセットで使うのが前提だと思います。

## c8 の `--all` と比べてみた

同じことは c8 が `--all` でずっとやっているので、同じ構成にかけて比べました。インストールは 9 秒でした（55 packages / `node_modules` は 9.6M）。

```bash
npm install -D c8
npx c8 --src src node --test
npx c8 --all --src src node --test
```

`--all` なし:

```
-----------|---------|----------|---------|---------|-------------------
File       | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-----------|---------|----------|---------|---------|-------------------
All files  |   78.94 |    83.33 |   66.66 |   78.94 |
 format.js |   63.63 |    66.66 |      50 |   63.63 | 4-5,10-11
 greet.js  |     100 |      100 |     100 |     100 |
-----------|---------|----------|---------|---------|-------------------
```

`--all` あり:

```
------------------|---------|----------|---------|---------|-------------------
File              | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
------------------|---------|----------|---------|---------|-------------------
All files         |   26.78 |     62.5 |      40 |   26.78 |
 dead-branch.js   |       0 |        0 |       0 |       0 | 1-24
 format.js        |   63.63 |    66.66 |      50 |   63.63 | 4-5,10-11
 greet.js         |     100 |      100 |     100 |     100 |
 legacy-report.js |       0 |        0 |       0 |       0 | 1-13
------------------|---------|----------|---------|---------|-------------------
```

未参照ファイルが `0 / 0 / 0` です。こちらは自分の予想どおりの表示でした。

| | Node 標準（パターンC） | c8 12.0.0 `--all` |
|---|---|---|
| 出るファイル | 同じ4ファイル | 同じ4ファイル |
| line (stmts) % | 26.79 | 26.78 |
| branch % | 83.33 | 62.5 |
| funcs % | 66.67 | 40 |
| 未参照ファイルの行 | `0.00 / 100.00 / 100.00` | `0 / 0 / 0` |
| `--functions 60` しきい値 | 通る（exit 0） | 落ちる（exit 1） |
| 小数の丸め | 26.79（四捨五入） | 26.78（切り捨て） |
| 追加インストール | 不要 | 55 packages / 9.6M |
| 除外指定 | `--test-coverage-exclude` | `--exclude` |
| 対象の指定 | cwd 探索 + `--test-coverage-include` | `--src` + `--include` |

`c8 --all --check-coverage --functions 60` は funcs 40% なので exit 1 で落ちました。Node 標準の `--test-coverage-functions=60` は通ります。同じ「未参照ファイルを表に出す」機能なのに、しきい値の判定結果が逆になります。

「どのファイルを表に出すか」は両者で同じ結果になり、line の数字もほぼ一致しました（26.79 vs 26.78 で、違いは丸め方だけ）。なので、lines しきい値だけを見ているなら c8 を標準機能に置き換えられそうです。functions や branches のしきい値も見ているなら、現時点ではまだ差があります。カバレッジ本体は experimental なので、この挙動が意図されたものなのか将来変わるのかは分かりませんでした。

実行時間は、この規模だとどちらも1秒未満で差を感じられませんでした（`duration_ms` は Node 標準 265〜305ms、c8 経由 265〜297ms）。

## どんな人に向いていそうか

`node --test` を使っていて、表示されているカバレッジの数字をそのまま信じている人には、一度 include-all を付けて見てみる価値があると思います。自分のサンプルでは 78.95% が 26.79% になりました。

既存プロジェクトに入れるなら、いきなり CI に足すと lines しきい値で赤くなるので、まず現状値を測って、include-all 有りの値までしきい値を一度下げてから徐々に上げていく、という順番が現実的だと思います。それと `--test-coverage-include` は必ずセットで書いたほうがよさそうです。

## まとめ

- `--test-coverage-include` だけでは何も変わらない。読み込まれていないファイルを連れてくるのは `--test-coverage-include-all` のほう
- include-all で正直になるのは line だけ。未参照ファイルは `0.00 / 100.00 / 100.00` で計上されるので、branch と funcs の数字は動かない。c8 の `--all` は `0/0/0` で計上するのでここが違う
- 探索は cwd 基準で、`src/` の外の `.js` も分母に入る（`node_modules/` とテストファイルは既定で除外）

`0/0` を 100% として扱っているように見える理由は、出力を眺めているだけでは分からなかったので、余裕があれば実装を追いかけてみたいところです。次は同じ v26 系で追加された `context.log()` / `test:log` あたりを触ってみようと思っています。

## 参考リンク

https://github.com/nodejs/node/releases/tag/v26.7.0

https://github.com/nodejs/node/issues/58887

https://github.com/nodejs/node/pull/64830

https://nodejs.org/api/test.html#collecting-code-coverage

https://github.com/bcoe/c8

## 再現手順

```bash
mkdir -p node-coverage-include-all/{src,test} && cd node-coverage-include-all
echo '{"type":"module"}' > package.json
# src/greet.js, src/format.js, src/legacy-report.js, src/dead-branch.js,
# test/greet.test.js は本文のコードをそのまま

# A: ベースライン
node --test --experimental-test-coverage
# B: include だけ（A と同じ結果になる）
node --test --experimental-test-coverage --test-coverage-include='src/**'
# C: include-all を足す（ここで line % が落ちる）
node --test --experimental-test-coverage --test-coverage-include='src/**' --test-coverage-include-all
# しきい値で CI が赤くなるのを見る
node --test --experimental-test-coverage --test-coverage-include='src/**' --test-coverage-include-all --test-coverage-lines=70; echo "exit=$?"
```

:::message alert
- `--experimental-test-coverage` は v26.7.0 でも必須です。`--test-coverage-include-all` だけでは表が出ません
- v26.7.0 未満では `node: bad option: --test-coverage-include-all` で exit 9。テストは1件も走りません
- glob は必ずシングルクォートで囲んでください。zsh（macOS 既定）はクォート無しだと `no matches found` でコマンド自体を実行しません
- 上のカバレッジ率はこのサンプル構成に完全依存する数字です。カバレッジ本体は experimental なので、出力形式も将来変わり得ます
:::
