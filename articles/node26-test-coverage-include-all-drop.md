---
title: "Node 26.7の--test-coverage-include-allで100%が16.95%になった"
emoji: "📉"
type: "tech"
topics: ["nodejs", "testing", "coverage", "nodetest"]
published: true
---

<!-- 前提: 出典ログ logs/run-node26-test-coverage-include-all-20260807-1357/execution-log.md / 記事タイプ: 検証ログ（試してみた） / slug: node26-test-coverage-include-all-drop / published: false -->

## はじめに

`node:test` でテストを書き始めて、`--experimental-test-coverage` を付けたら `all files | 100.00` と出た。そのときは素直に嬉しかったのですが、あとで気づきました。テストを1行も書いていないファイルは、そもそもこの表に出てきません。100%というのは「測った範囲の100%」でした。

Node.js 26.7.0 に `--test-coverage-include-all` というフラグが入っていたので、これを手元の最小プロジェクトで試した記録です。結果として、同じプロジェクトの同じテストで総合カバレッジが 100.00% から 16.95% になりました。

以前 `--test-randomize` の記事を書きましたが、あれはテストの実行順の話で、今回はカバレッジの集計対象の話なので別物です。

:::message
筆者はテストを書き始めたばかりで、カバレッジ計測もほとんど触ったことがありません。手元の Mac で一通り試した範囲の記録で、数値はこの検証用プロジェクト固有のものです。
:::

## なぜこのフラグを試したのか

`node:test` のカバレッジは、既定では「テスト実行中に読み込まれたファイル」しか表に出しません。公式ドキュメントの `run()` の `coverageIncludeAll` の説明が、そのまま裏返しの答えになっています。

> coverageIncludeAll `<boolean>` Includes source files that were never loaded by the test run in the coverage report, where they are reported as having zero coverage. Candidate files are searched for in cwd, and are subject to the same coverageIncludeGlobs and coverageExcludeGlobs filtering as the rest of the report. This property is only applicable when coverage was set to true. **Default: false.**
>
> — [Node.js Test runner documentation](https://nodejs.org/api/test.html)

既定が `false`。つまり、一度も import されなかったファイルは分母に入らない。テストを書いていないファイルがあるほど、カバレッジの数字は良く見えることになります。

自分の検証プロジェクトだと、ソース118行のうち98行（83%）が測定対象の外にいました。その状態で出ていたのが `100.00` です。

## 事前に調べたこと

Node.js 26.7.0 のリリースノートの Notable Changes に、test_runner 関連ではこの1行だけが載っていました。

```
[a646319f61] - (SEMVER-MINOR) test_runner: add support for --test-coverage-include-all (avivkeller) #64830
```

同じリリースには他にも test_runner のコミットがあります（`test_runner: wait for filtered suite build` #64208、`test_runner: convert to uint during deserialization` #64706）が、Notable Changes に単独で挙がっているのは include-all だけでした。

CLI 側のドキュメントには、バージョンとStabilityが明記されています。

```
--test-coverage-include-all
Added in: v26.7.0
Stability: 1 - Experimental

Includes source files that were never loaded by the test run in the coverage report, where they
are reported as having zero coverage. Candidate files are searched for in the current working
directory, and are subject to the same --test-coverage-include and --test-coverage-exclude
filtering as the rest of the report.
```

ここで一つ、恥ずかしい勘違いをしていました。調べ始めた段階では「ドキュメントには `Added in: v23.0.0` と書いてあるのに、リリースノートは 26.7.0 になっている。公式が矛盾している」と思い込んでいたんです。実際に HTML を取ってきてタグを剥がし、`coverageIncludeAll` の前後500文字を機械的に切り出して読んだら、この項目には固有の "Added in" が付いていませんでした。近くに並んでいた別の項目の注記を自分が拾っていただけでした。ドキュメントは項目が密に並んでいるので、注記がどれに属しているかを目で追うのは思ったより危ないです。

もう一つ先に潰しておいて良かったのが、フラグ名の確定です。ネット上で `--test-coverage-include-globs` という表記も見かけて、どっちが正しいのか分からなかったので `node --help` を grep しました。

```bash
nvm use 26.7.0 && node --version && node --help | grep -i coverage
```

```
v26.7.0
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

同じことを 26.5.0 でも実行すると、`--test-coverage-include-all` の2行だけが無くなります。

```
v26.5.0
  --experimental-test-coverage
                              enable code coverage in the test runner
  --test-coverage-branches=...
                              the branch coverage minimum threshold
  --test-coverage-exclude=... exclude files from coverage report that
  --test-coverage-functions=...
                              the function coverage minimum threshold
  --test-coverage-include=... include files in coverage report that
  --test-coverage-lines=...   the line coverage minimum threshold
NODE_V8_COVERAGE            directory to output v8 coverage JSON to
```

この grep 2回で分かったことが3つあります。フラグは 26.7.0 にあって 26.5.0 に無い。絞り込みフラグの正式名は `--test-coverage-include` / `--test-coverage-exclude` で、`-globs` は付かない。そして `--experimental-test-coverage` は 26.7 でもまだ必要で、include-all を単体で付けても効きません。

ややこしいのは、CLI と `run()` API で名前が違うところです。CLI は `--test-coverage-include`、API は `coverageIncludeGlobs`。`Globs` が付くのは API 側だけでした。表記が割れていたのはこれが原因だと思います。

## 環境構築

Node は nvm で入れました。

```bash
nvm install 26.7.0
nvm use 26.7.0
node --version   # v26.7.0
```

検証用プロジェクトは依存ゼロです。`package.json` は1行だけで、`npm install` は一度も実行していません。

```json:coverage-lab/package.json
{"type":"module"}
```

`src/` に純関数を6本、`test/` にそのうち3本分のテストだけを置きました。

```
$ wc -l src/*.js
       7 src/add.js
      34 src/deepMerge.js
       6 src/formatDate.js
      32 src/parseQuery.js
      32 src/retry.js
       7 src/slugify.js
     118 total
```

テストがあるのは `add.js`（7行）/ `formatDate.js`（6行）/ `slugify.js`（7行）の計20行。テストが無いのは `deepMerge.js`（34行）/ `parseQuery.js`（32行）/ `retry.js`（32行）の計98行です。この 20 : 98 という比が、あとで出てくる下落幅をそのまま決めています。構成を書かずに「16.95%になった」とだけ言っても意味が伝わらないので、先に出しておきます。

テストがある側は、こんな短い関数です。

```js:coverage-lab/src/add.js
export function add(a, b) {
  return a + b;
}

export function sub(a, b) {
  return a - b;
}
```

```js:coverage-lab/test/add.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { add, sub } from '../src/add.js';

test('add', () => {
  assert.equal(add(1, 2), 3);
});

test('sub', () => {
  assert.equal(sub(5, 2), 3);
});
```

テストが無い側は、たとえば `retry.js` のようにそれなりに分岐のある関数です。

```js:coverage-lab/src/retry.js
export async function retry(fn, options = {}) {
  const attempts = options.attempts ?? 3;
  const delayMs = options.delayMs ?? 10;
  const factor = options.factor ?? 2;
  const shouldRetry = options.shouldRetry ?? (() => true);

  if (typeof fn !== 'function') {
    throw new TypeError('fn must be a function');
  }
  if (attempts < 1) {
    throw new RangeError('attempts must be >= 1');
  }

  let lastError;
  let wait = delayMs;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn(i);
    } catch (err) {
      lastError = err;
      if (!shouldRetry(err, i)) {
        break;
      }
      if (i === attempts - 1) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, wait));
      wait = wait * factor;
    }
  }
  throw lastError;
}
```

まず素の `node --test` が緑になることを確認しました。

```bash
node --test
```

```
✔ add (0.762667ms)
✔ sub (0.08575ms)
✔ formatDate (1.835041ms)
✔ slugify (0.495ms)
ℹ tests 4
ℹ suites 0
ℹ pass 4
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 79.261792
```

カバレッジの表はどこにも出ていません。この出力を先に取っておいたおかげで、後で `--experimental-test-coverage` を付け忘れたときにすぐ気づけました。

## フラグ無しのカバレッジ結果

```bash
node --test --experimental-test-coverage
```

```
ℹ start of coverage report
ℹ ---------------------------------------------------------------
ℹ file           | line % | branch % | funcs % | uncovered lines
ℹ ---------------------------------------------------------------
ℹ src            |        |          |         |
ℹ  add.js        | 100.00 |   100.00 |  100.00 |
ℹ  formatDate.js | 100.00 |   100.00 |  100.00 |
ℹ  slugify.js    | 100.00 |   100.00 |  100.00 |
ℹ ---------------------------------------------------------------
ℹ all files      | 100.00 |   100.00 |  100.00 |
ℹ ---------------------------------------------------------------
ℹ end of coverage report
```

`all files | 100.00`。気持ちのいい数字ですが、表に載っているのは3ファイルだけです。`src/deepMerge.js`、`src/parseQuery.js`、`src/retry.js` は行として存在しません。ソース118行のうち98行が、この表に一切関与していない状態です。

自分が引っかかっていたのは、表に無いファイルを「無いもの」として読んでしまうところでした。カバレッジレポートを見るときに、そこに列挙されているファイルの集合が正しいかを確認する習慣がありませんでした。

## `--test-coverage-include-all` を付けた結果

同じテスト、同じソースのまま、フラグを1つ足します。

```bash
node --test --experimental-test-coverage --test-coverage-include-all
```

```
ℹ start of coverage report
ℹ ---------------------------------------------------------------
ℹ file           | line % | branch % | funcs % | uncovered lines
ℹ ---------------------------------------------------------------
ℹ src            |        |          |         |
ℹ  add.js        | 100.00 |   100.00 |  100.00 |
ℹ  deepMerge.js  |   0.00 |   100.00 |  100.00 | 1-34
ℹ  formatDate.js | 100.00 |   100.00 |  100.00 |
ℹ  parseQuery.js |   0.00 |   100.00 |  100.00 | 1-32
ℹ  retry.js      |   0.00 |   100.00 |  100.00 | 1-32
ℹ  slugify.js    | 100.00 |   100.00 |  100.00 |
ℹ ---------------------------------------------------------------
ℹ all files      |  16.95 |   100.00 |  100.00 |
ℹ ---------------------------------------------------------------
ℹ end of coverage report
```

100.00% → 16.95%、83.05ポイントの下落です。`diff -u` を取ると、増えたのは3行と `all files` の書き換えだけでした。

```diff
 ℹ  add.js        | 100.00 |   100.00 |  100.00 |
+ℹ  deepMerge.js  |   0.00 |   100.00 |  100.00 | 1-34
 ℹ  formatDate.js | 100.00 |   100.00 |  100.00 |
+ℹ  parseQuery.js |   0.00 |   100.00 |  100.00 | 1-32
+ℹ  retry.js      |   0.00 |   100.00 |  100.00 | 1-32
 ℹ  slugify.js    | 100.00 |   100.00 |  100.00 |
 ℹ ---------------------------------------------------------------
-ℹ all files      | 100.00 |   100.00 |  100.00 |
+ℹ all files      |  16.95 |   100.00 |  100.00 |
```

ちなみに `diff -u` の出力の先頭は、`✔ add (0.968916ms)` や `duration_ms` の行が毎回変わるので丸ごとノイズになります。比較するときは `all files` の行と、表に載っているファイル名の集合だけを見るのが実用的でした。

数字が合っているかも確認しておきます。テストがあるのが20行、ソース合計が118行。20/118 ≒ 16.95% で、出力とほぼ一致しました。line % は素朴な行数比で読める、と考えて良さそうです。

もう一つ、これは見落としそうなところなのですが、追加された3行は line が 0.00 なのに branch % と funcs % は 100.00 のままです。一度も読み込まれていないファイルは分岐も関数も1つも数えられていないので、0/0 が 100% として扱われているのだと思います。つまりこのフラグで下がるのは line % だけです。これが後の閾値の話にそのまま効いてきました。

## 詰まった点

### 26.5.0 の `run()` は、知らないオプションを黙って無視する

「CLI フラグは 26.7 で入ったけれど、`run()` API の `coverageIncludeAll` はもっと前からあったのではないか」と思っていました。だとすると 26.7 の新規性は CLI フラグ化だけ、という話になります。これを確かめるために、`run()` を使ったスクリプトを書いて 26.7.0 と 26.5.0 の両方で走らせました。

```js:coverage-lab/runner.mjs
// run() API 版: coverageIncludeAll: true が CLI フラグと同じ結果になるか確かめる
import { run } from 'node:test';
import { spec } from 'node:test/reporters';

const stream = run({
  files: [
    './test/add.test.js',
    './test/slugify.test.js',
    './test/formatDate.test.js',
  ],
  coverage: true,
  coverageIncludeAll: true,
});

stream.compose(new spec()).pipe(process.stdout);
```

reporter の繋ぎ方（`stream.compose(new spec()).pipe(process.stdout)`）は一発で通りました。ここは詰まらず。

26.7.0 で実行すると、CLI と同じようにテスト無しの3ファイルが 0% で出てきます。

```
ℹ file           | line % | branch % | funcs % | uncovered lines
ℹ ---------------------------------------------------------------
ℹ runner.mjs     |   0.00 |   100.00 |  100.00 | 1-15
ℹ src            |        |          |         |
ℹ  add.js        | 100.00 |   100.00 |  100.00 |
ℹ  deepMerge.js  |   0.00 |   100.00 |  100.00 | 1-34
ℹ  formatDate.js | 100.00 |   100.00 |  100.00 |
ℹ  parseQuery.js |   0.00 |   100.00 |  100.00 | 1-32
ℹ  retry.js      |   0.00 |   100.00 |  100.00 | 1-32
ℹ  slugify.js    | 100.00 |   100.00 |  100.00 |
ℹ ---------------------------------------------------------------
ℹ all files      |  15.04 |   100.00 |  100.00 |
```

問題は 26.5.0 側です。CLI フラグのほうは、はっきり落ちてくれます。

```bash
nvm use 26.5.0
node --test --experimental-test-coverage --test-coverage-include-all
echo "exit=$?"
```

```
node: bad option: --test-coverage-include-all
```

終了コードは 9 でした。出力はこの1行だけです。フラグ名を打ち間違えたのか、このバージョンに無いのかを区別する情報が無いので、`node --help | grep` で先に名前を確定させておいたのはやはり正解でした。

一方、同じ 26.5.0 で `runner.mjs` を走らせると、エラーも警告も出ないまま 100% のままでした。

```
ℹ file           | line % | branch % | funcs % | uncovered lines
ℹ ---------------------------------------------------------------
ℹ src            |        |          |         |
ℹ  add.js        | 100.00 |   100.00 |  100.00 |
ℹ  formatDate.js | 100.00 |   100.00 |  100.00 |
ℹ  slugify.js    | 100.00 |   100.00 |  100.00 |
ℹ ---------------------------------------------------------------
ℹ all files      | 100.00 |   100.00 |  100.00 |
```

これが一番困りました。エラーが出ないので「オプションは受け付けられたが何かの条件で効いていない」のか「オプション自体が存在しない」のか、出力からは判断できません。ここで自分の当初の見立て（API は前からあった）を、この結果が支持しているのか否定しているのか分からなくなりました。

切り分けのために、計画に無かった対照実験を3本足しました。それぞれ `runner-noflag.mjs`（1つ目）/ `runner-bogus.mjs`（2つ目）/ `runner-excludeglobs.mjs`（3つ目）として、`runner.mjs` と同じくプロジェクトルートに置きました。この4本が後の出力に顔を出します。

1つ目。26.7.0 で `coverageIncludeAll` の行だけを消した `runner.mjs` を走らせると、100% に戻りました。26.7.0 では確かにこのオプションの有無が結果を決めています。

2つ目。26.5.0 で、絶対に存在しないオプション名 `thisOptionDoesNotExistAtAll: true` を渡してみました。エラーも出ず、終了コードは 0。`run()` は未知のオプションを黙って捨てる、ということです。「エラーにならないから対応している」という読み方はできません。

3つ目。では 26.5.0 が coverage 系オプション全般を無視しているのか。`coverageExcludeGlobs: ['src/slugify.js']` を渡すと、

```
ℹ  add.js          | 100.00 |   100.00 |  100.00 |
ℹ test             |        |          |         |
ℹ  add.test.js     | 100.00 |   100.00 |  100.00 |
ℹ  slugify.test.js | 100.00 |   100.00 |  100.00 |
```

`slugify.js` がちゃんと消えました。26.5.0 は coverage 系オプションを一般には尊重していて、無視されたのは `coverageIncludeAll` だけということになります。

最後に [v26.5.0 時点のドキュメント](https://nodejs.org/docs/v26.5.0/api/test.html) を引いたら、`run()` のオプション一覧に `coverageIncludeAll` はありませんでした（`coverage` / `coverageExcludeGlobs` / `coverageIncludeGlobs` / `lineCoverage` / `branchCoverage` / `functionCoverage` のみ）。

というわけで、最初の見立ては手元の実測では成り立ちませんでした。26.5.0 では CLI フラグも `run()` オプションも使えず、両方 26.7.0 で入ったと見るのが観測と整合します。他のバージョンや他の環境まで確かめたわけではないので「26.7 で新設された」と言い切るのは避けますが、少なくとも自分の手元では「新機能ではなくフラグ化だけ」という話は書けませんでした。

なお CLI 版（16.95%）と `run()` 版（15.04%）で数値がずれた理由も一応分かっています。`runner.mjs`（15行）自身がプロジェクトルートに置いてあるので、include-all の候補ファイルとして拾われていました。分母が 118 → 133 になって 20/133 ≒ 15.04%。挙動としては同じで、ずれは実行スクリプト自身が対象に入ったせいです。

### `--test-coverage-exclude` を1つ足したら、カバレッジが上がった

除外を足せばカバレッジの対象が1本減るので、数字も下がると思っていました。実際に `src/retry.js` だけを除外してみます。

```bash
node --test --experimental-test-coverage --test-coverage-include-all --test-coverage-exclude='src/retry.js'
```

```
ℹ runner-bogus.mjs         |   0.00 |   100.00 |  100.00 | 1-9
ℹ runner-excludeglobs.mjs  |   0.00 |   100.00 |  100.00 | 1-9
ℹ runner-noflag.mjs        |   0.00 |   100.00 |  100.00 | 1-15
ℹ runner.mjs               |   0.00 |   100.00 |  100.00 | 1-15
ℹ src                      |        |          |         |
ℹ  add.js                  | 100.00 |   100.00 |  100.00 |
ℹ  deepMerge.js            |   0.00 |   100.00 |  100.00 | 1-34
ℹ  formatDate.js           | 100.00 |   100.00 |  100.00 |
ℹ  parseQuery.js           |   0.00 |   100.00 |  100.00 | 1-32
ℹ  slugify.js              | 100.00 |   100.00 |  100.00 |
ℹ test                     |        |          |         |
ℹ  add.test.js             | 100.00 |   100.00 |  100.00 |
ℹ  formatDate.test.js      | 100.00 |   100.00 |  100.00 |
ℹ  slugify.test.js         | 100.00 |   100.00 |  100.00 |
ℹ ---------------------------------------------------------------
ℹ all files                |  28.30 |   100.00 |  100.00 |
```

この時点ではルートに `runner*.mjs` が4本ある状態で、exclude 無しの同じ状態は 12.05%（後述）でした。そこに除外を1つ足しただけで 28.30% に上がっています。よく見ると `test/*.test.js` が表に入っています。テストファイルは当然100%なので、これが総合%を押し上げていました。

ドキュメントを読み直したら書いてありました。

> By default all the matching test files are excluded from the coverage report. Exclusions can be overridden by using the `--test-coverage-exclude` flag.
>
> — [Node.js CLI documentation](https://nodejs.org/api/cli.html)

既定のテストファイル除外は、自分で exclude を書いた時点で上書きされて消えるということです。exclude を使うなら、既定で除外されていたものを自分で書き直す必要があります。「除外を足したらカバレッジが上がった」は直感に反するので、覚えておこうと思います。

## glob と閾値と併用したときの挙動

include で `src/**` に絞ると、結果はフラグだけのときと完全に同じ（6ファイル / 16.95%）でした。既定でテストファイルは除外されているので、差が出ないのは筋が通っています。

include と exclude を同時に指定した場合。

```bash
node --test --experimental-test-coverage --test-coverage-include-all \
  --test-coverage-include='src/**' --test-coverage-exclude='src/retry.js'
```

表は `src/` の5ファイル（`retry.js` だけが消えた）で 23.26%。ドキュメントの記述どおり、両方の条件を満たすものだけが残る AND として振る舞いました。

> If both coverageExcludeGlobs and coverageIncludeGlobs are provided, files must meet both criteria to be included in the coverage report.
>
> — [Node.js Test runner documentation](https://nodejs.org/api/test.html)

そして CI に直結する話が閾値との併用です。実行のたびに結果が動くのを避けたかったので、両方に `--test-coverage-include='src/**'` を付けて範囲を固定しました（理由は次の節）。

```bash
# フラグ無し
node --test --experimental-test-coverage --test-coverage-include='src/**' --test-coverage-lines=80
echo "exit=$?"   # → 0
```

```bash
# include-all 有り
node --test --experimental-test-coverage --test-coverage-include-all \
  --test-coverage-include='src/**' --test-coverage-lines=80
echo "exit=$?"   # → 1
```

後者の失敗メッセージはこれだけです。

```
ℹ Error: 16.95% line coverage does not meet threshold of 80%.
```

フラグ無しなら通り、有りなら落ちる。「率が下がる」がそのまま「CIが落ちる」になることが確認できました。

ここで、さきほどの branch/funcs が 100% のままという話が効いてきます。line ではなく funcs と branch に閾値を張ってみると、

```bash
node --test --experimental-test-coverage --test-coverage-include-all \
  --test-coverage-include='src/**' --test-coverage-functions=80 --test-coverage-branches=80
echo "exit=$?"   # → 0
```

通ってしまいました。テストが1行も無いファイルが3本あるのに、funcs 80% / branch 80% は満たされている扱いです。include-all で CI を締めるつもりなら、効くのは `--test-coverage-lines` だけということになります。

## どんなプロジェクトで効きそうか

下落幅がどれくらいプロジェクト依存なのかを見るために、テストの無いファイルを1本増やしてみました。`src/chunk.js`（26行 / 関数3本 / テスト無し）を足してソース合計を 118行 → 144行に。

この時点ではプロジェクトルートに `runner*.mjs` が増えていたので（後述）、範囲を `src/**` に固定して測りました。

```bash
node --test --experimental-test-coverage --test-coverage-include-all \
  --test-coverage-include='src/**'
```

結果は 7ファイルで 13.89%。16.95% から 13.89% に動きました。20/144 ≒ 13.89% で、こちらも行数比とほぼ一致します。要するに下落幅は「テストが無いファイルの行数比」でしかなく、この検証プロジェクト固有の数字です。他のプロジェクトで何%になるかは、そのプロジェクトのテスト状況次第です。

もう一つ、実プロジェクトに入れる前に知っておきたかったことがあります。`runner*.mjs` をプロジェクトルートに作った後で、前とまったく同じコマンドを再実行したときの結果です。

```bash
node --test --experimental-test-coverage --test-coverage-include-all
```

```
ℹ runner-bogus.mjs         |   0.00 |   100.00 |  100.00 | 1-9
ℹ runner-excludeglobs.mjs  |   0.00 |   100.00 |  100.00 | 1-9
ℹ runner-noflag.mjs        |   0.00 |   100.00 |  100.00 | 1-15
ℹ runner.mjs               |   0.00 |   100.00 |  100.00 | 1-15
...
ℹ all files                |  12.05 |   100.00 |  100.00 |
```

同じコマンドが 16.95% から 12.05% になりました。`src/` は1行も触っていません。候補ファイルの探索起点が cwd なので、プロジェクトルートに置いた自作スクリプトや使い捨てのデバッグコードが全部 0% として分母に入ります。実プロジェクトにいきなり入れると、`--test-coverage-include='src/**'` のような絞り込みを併用しない限り数値が安定しないと思います。

`run()` API から使う場合、挙動としては CLI と一致していました（数値が 16.95% と 15.04% でずれたのは、前述のとおり `runner.mjs` 自身が対象に入ったため）。ただしオプション名が CLI と違う（`coverageIncludeGlobs` / `coverageExcludeGlobs`）ので、そこは間違えやすいです。

## まとめ

テストを書き始めたばかりの立場で試した範囲ですが、`--test-coverage-include-all` を付けた前後の数字を並べたことで、それまで見ていた「カバレッジ100%」が何を測った100%だったのかがようやく分かりました。

手元で確認できたこと。

- 同じテスト・同じソースで 100.00% → 16.95%。下がった分は、テストを1行も書いていない3ファイル（98行）が分母に入っただけ
- 下がるのは line % だけ。読み込まれなかったファイルの branch/funcs は 100% 扱いなので、CI の閾値で捕まえられるのは `--test-coverage-lines`
- `--test-coverage-exclude` を明示すると既定のテストファイル除外が消え、総合%が上がることがある
- 候補ファイルは cwd から探されるので、ルートに置いた雑多な `.mjs` まで拾われる。`--test-coverage-include` で範囲を絞る前提の機能だと思う
- 26.5.0 では CLI フラグは `bad option`（exit 9）で落ちるが、`run()` の `coverageIncludeAll` はエラーも出さず黙って無視される

分からないまま残ったこと。当初「`run()` の `coverageIncludeAll` は 26.7 より前からあった」という見立てで調べ始めたのですが、26.5.0 では効かず、26.5.0 のドキュメントにも項目がありませんでした。26.6 系や他のプラットフォームは試していないので、どのバージョンで入ったのかを厳密には確かめられていません。

あと、カバレッジ機能自体がまだ Stability 1 - Experimental です（`--experimental-test-coverage` が必須なのもそれが理由だと思います）。出てくる数字を CI のゲートに使うなら、そのつもりで扱う必要がありそうです。

次は、実際にテストがそれなりに書かれているプロジェクトに入れて、`--test-coverage-include` の絞り方をどこまで詰められるかを試したいです。

## 再現手順

- OS: macOS 26.5（Darwin 25.5.0 / arm64）
- Node.js v26.7.0（対照実験に v26.5.0）/ npm 11.19.0 / nvm
- 依存パッケージ: なし（`package.json` は `{"type":"module"}` の1行のみ）

```bash
nvm install 26.7.0 && nvm use 26.7.0 && node --version   # v26.7.0
node --help | grep -i coverage                            # フラグの実在と正式名を先に確定

mkdir -p coverage-lab/src coverage-lab/test && cd coverage-lab
echo '{"type":"module"}' > package.json
# src に純関数6本、test にそのうち3本分のテストを置く

node --test --experimental-test-coverage                             2>&1 | tee without-flag.txt
node --test --experimental-test-coverage --test-coverage-include-all 2>&1 | tee with-flag.txt
diff -u without-flag.txt with-flag.txt
```

下落%を再現するには、ファイル構成（テスト有り20行 : テスト無し98行）を合わせる必要があります。

:::message
カバレッジ表は `src` グループ + 相対ファイル名で出るので、出力に絶対パスは含まれません。ログをそのまま貼っても手元のパスは漏れませんでした。
:::

## 参考リンク

https://nodejs.org/en/blog/release/v26.7.0

https://nodejs.org/api/cli.html

https://nodejs.org/api/test.html
