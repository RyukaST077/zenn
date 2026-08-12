---
title: "Node 26.6のt.log()を試したら、ログに帰属が付くのはイベント側だけだった"
emoji: "🪵"
type: "tech"
topics: ["nodejs", "testing", "test", "javascript"]
published: true
---

<!-- 前提: 出典ログ logs/run-node-test-context-log-20260812-1603/execution-log.md / 記事タイプ: 検証ログ（試してみた）/ slug: node26-context-log-test-log-attribution / published: false -->

## はじめに

Node.js v26.6.0 のリリースノートを眺めていたら、Notable Changes が4件しかないのに、そのうち2件が `test_runner` でした。ひとつが `context.log()` と `test:log` イベントの追加（[PR #64389](https://github.com/nodejs/node/pull/64389)）、もうひとつが `TestStream` イベントへの `entryFile` 追加（[PR #64309](https://github.com/nodejs/node/pull/64309)）。しかも作者が同じ人です。

`t.log()` は、テストの中から「このログはこのテストのものだ」という情報付きでメッセージを流せる API です。すでに `console.log` も `t.diagnostic()` もあるのに何が違うのか、という一点だけを確かめたくて、依存ゼロの小さなプロジェクトで一通り触ってみました。

結果としていちばん効いたのは、この機能の説明として自分が最初に思っていた「並行実行でもログが読めるようになる」が、そのままでは正しくないと分かったところです。イベントには帰属情報が載っていますが、組み込み reporter はそれを捨てて描画します。読めるようにするには reporter を自分で書く必要がありました。

:::message
筆者は実務経験の浅いエンジニアで、`node --test` の reporter を自作するのは初めてです。実行環境は macOS 26.5 / arm64（Apple Silicon）/ Node.js **v26.7.0**（26.6 で入った機能を含むバージョン）と、対照として **v26.5.0**。以下は全部この構成での観測値です。
:::

## 使ったもの・環境

- Node.js v26.7.0（本命）と v26.5.0（`t.log` が無い側の対照）。nvm で切り替え
- 追加ライブラリなし。`package.json` は `{"type":"module"}` の1行だけで、`npm install` は一度も実行していません
- OS は macOS 26.5 / arm64

確かめたかったのは次の4点です。

1. `console.log` / `t.diagnostic()` / `t.log()` が、組み込みの spec・tap・dot reporter でどう出るか
2. `test:log` イベントと `test:diagnostic` イベントで、実際に載っているフィールドがどう違うか
3. サブテスト・`describe`/`it`・失敗テスト・並行実行で、ログの帰属先がどう記録されるか
4. 26.6 未満で `t.log()` を呼ぶとどうなるか

## なぜこの技術を試すのか

PR 本文に動機がはっきり書かれていました。

> This gives reporters that render the test tree unbuffered a **live**, attributed logging channel that captured stdout cannot provide under concurrency

「並行実行下では、キャプチャした stdout では提供できない、ライブで帰属付きのログ経路」。抽象的に読めますが、実際に並行実行のテストを組み込み reporter で流すと言いたいことがすぐ分かります。3本のテストを並行に走らせて、それぞれが `step1` `step2` `step3` とログを吐いた spec 出力がこれです。

```
[console] alpha step1
[console] beta step1
[console] gamma step1
  ℹ step1
  ℹ step1
  ℹ step1
[console] beta step2
  ℹ step2
[console] gamma step2
  ℹ step2
[console] beta step3
  ℹ step3
[console] alpha step2
  ℹ step2
[console] gamma step3
  ℹ step3
[console] alpha step3
  ℹ step3
▶ concurrent suite
  ✔ alpha (63.711375ms)
  ✔ beta (23.522375ms)
  ✔ gamma (41.877084ms)
✔ concurrent suite (64.188417ms)
```

`ℹ step1` が3行並んでいるのが `t.log()` の出力です。どれがどのテストのものか、この画面からは分かりません。`[console]` の行のほうは追えていますが、それはテストコードの中で `` `[console] ${name} step1` `` と自分で名前を埋め込んでいるからです。つまり毎回手で帰属を書いています。

## 事前に調べたこと

まずリリースノートで該当コミットを確認しました。

```bash
curl -sS https://raw.githubusercontent.com/nodejs/node/main/doc/changelogs/CHANGELOG_V26.md -o /tmp/chg26.md
grep -n "64389" /tmp/chg26.md
```

```
## 2026-08-03, Version 26.6.0 (Current), @aduh95

### Notable Changes

* \[[`5a36018abc`](https://github.com/nodejs/node/commit/5a36018abc)] - **doc**: add MikeMcC399 as collaborator (Mike McCready) [#64656](https://github.com/nodejs/node/pull/64656)
* \[[`9b04f82d7b`](https://github.com/nodejs/node/commit/9b04f82d7b)] - **(SEMVER-MINOR)** **ffi**: add `getCurrentEventLoop` (Paolo Insogna) [#64323](https://github.com/nodejs/node/pull/64323)
* \[[`bb51f2c960`](https://github.com/nodejs/node/commit/bb51f2c960)] - **(SEMVER-MINOR)** **test\_runner**: add `context.log()` and `test:log` event (Moshe Atlow) [#64389](https://github.com/nodejs/node/pull/64389)
* \[[`56ce83b3ee`](https://github.com/nodejs/node/commit/56ce83b3ee)] - **(SEMVER-MINOR)** **test\_runner**: report `entryFile` in `TestStream` events (Moshe Atlow) [#64309](https://github.com/nodejs/node/pull/64309)
```

次に API ドキュメントです。バージョンを固定した raw を取りました。

```bash
curl -sS https://raw.githubusercontent.com/nodejs/node/v26.7.0/doc/api/test.md -o /tmp/test-doc.md
grep -n "context.log\|test:log" /tmp/test-doc.md
```

該当箇所（`doc/api/test.md` @ v26.7.0 より引用）:

```
### `context.log(message[, data])`

<!-- YAML
added: v26.6.0
-->

* `message` {string} Message to be reported.
* `data` {any} Optional structured payload attached to the message. The test
  runner passes it through untouched. When tests run with process isolation,
  this value must be compatible with the [HTML structured clone algorithm][].

This function is used to write a log message to the output. Unlike
[`context.diagnostic`][], the resulting [`'test:log'`][] event is emitted
immediately, in the order that the tests execute, rather than being buffered
until the test reports its results. This function does not return a value.
```

同じドキュメントに、どのイベントが宣言順（バッファされる）でどれが実行順（即時）かの表があります。

```
| Declaration ordered (buffered) | Execution ordered (immediate)                         |
| ------------------------------ | ----------------------------------------------------- |
| [`'test:start'`][]             | [`'test:enqueue'`][] followed by [`'test:dequeue'`][] |
| [`'test:pass'`][]              | [`'test:complete'`][] (`details.passed` is `true`)    |
| [`'test:fail'`][]              | [`'test:complete'`][] (`details.passed` is `false`)   |
| [`'test:plan'`][]              |                                                       |
| [`'test:diagnostic'`][]        |                                                       |
|                                | [`'test:log'`][]                                      |
```

調べる前は「新しく入った API だから Experimental だろう」と思っていました。実際には `context.log` のセクションに Stability 表記はなく、YAML ブロックは `added: v26.6.0` だけです。同じ `test.md` の中で `context.tags` には `> Stability: 1.0 - Early development` が付いているので、付くものには付いている、ということになります。`test_runner` 本体が `> Stability: 2 - Stable` なので、個別表記が無い `context.log` はそれを継承する扱いのようです。

ここでひとつ失敗しました。最初は公式ドキュメントをブラウズ経由（要約されたページ）で読んでいて、`context.log` の説明に `Added in: v18.9.0, v16.19.0` とか `data.args` という配列フィールドが書かれているのを見ていました。追加されたばかりの API に v18 の記載があるのは変なので raw を取り直したら、全部食い違っていました。おそらく `context.diagnostic` の記述から埋められたものです。以降、一次情報は `raw.githubusercontent.com/nodejs/node/v26.7.0/doc/api/test.md` のように、バージョンを URL に入れて直接取ることにしました。

## 環境構築とバージョンゲート

作業ディレクトリはこれだけです。

```bash
mkdir -p workspace/{results,reporters}
cd workspace
echo '{"type":"module"}' > package.json
```

3種のログを1本のテストに並べたファイルを用意しました。

```js:probe.test.mjs
import { test } from 'node:test';

test('probe', (t) => {
  console.log('via console.log');
  t.diagnostic('via t.diagnostic');
  t.log('via context.log');
});
```

v26.7.0 と v26.5.0 で同じものを走らせます。

```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
nvm use 26.5.0
node --test --test-reporter=spec probe.test.mjs
```

26.5.0 側の出力（`node --test` 以降の抜粋）:

```
via console.log
✖ probe (0.811042ms)
ℹ via t.diagnostic
ℹ tests 1
ℹ suites 0
ℹ pass 0
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 55.841833

✖ failing tests:

test at probe.test.mjs:3:1
✖ probe (0.811042ms)
  TypeError: t.log is not a function
      at TestContext.<anonymous> (file:///path/to/workspace/probe.test.mjs:6:5)
      at Test.runInAsyncScope (node:async_hooks:226:14)
      at Test.run (node:internal/test_runner/test:1382:25)
      at Test.start (node:internal/test_runner/test:1242:17)
      at startSubtestAfterBootstrap (node:internal/test_runner/harness:387:17)
```

`--experimental-何か` を促すヒントは一切出ません。ただの `TypeError: t.log is not a function` なので、初見だと自分のタイポを疑って `node -v` に辿り着くまで時間を溶かしそうです。フラグで有効化できる類のものでもなさそうです。いずれにせよ 26.6 未満をサポートするプロジェクトでは単純に使えません。

ちなみに `node --test` 自体は 26.5.0 でも動きますし、`typeof test` は両方 `function` です。差が出るのは `t.log` のところだけでした。

環境まわりでひとつ予想が外れたところがあります。`package.json` に `type: module` を書き忘れて `.js` 拡張子でテストを書いたら、昔の記憶では import 構文で落ちるはずでした。Node 26 では落ちず、警告付きで通ってしまいます。

```
(node:61886) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///private/tmp/nomodule/probe.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /private/tmp/nomodule/package.json.
```

exit code は 0 で、テストもふつうに通りました。

## 3種のログを組み込み reporter で比べる

本命の v26.7.0 で spec reporter を走らせた出力（全文）:

```
via console.log
ℹ via context.log
✔ probe (0.614875ms)
ℹ via t.diagnostic
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 56.677
```

コードの記述順は `console.log` → `t.diagnostic` → `t.log` です。出力は `console.log` → `t.log` → `✔ probe` → `t.diagnostic` の順になりました。`t.log` は結果行の前、`t.diagnostic` は結果行の後です。しかも接頭辞はどちらも `ℹ` で見た目が同じなので、並べて出さないと違いに気づきません。ドキュメントの buffered / immediate の表が、この6行のコードでそのまま観察できます。

3つの reporter を回してみます。

```bash
for r in spec tap dot; do node --test --test-reporter=$r probe.test.mjs > results/reporter-$r.txt 2>&1; done
```

tap の全文:

```
TAP version 13
# via console.log
# via context.log
# Subtest: probe
ok 1 - probe
  ---
  duration_ms: 0.633375
  type: 'test'
  ...
# via t.diagnostic
1..1
# tests 1
# suites 0
# pass 1
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 54.726542
```

dot の全文:

```
.
```

まとめるとこうなりました。

| reporter | `console.log` | `t.diagnostic()` | `t.log()` | 結果行との位置関係 |
|---|---|---|---|---|
| spec | 素のまま先頭に出る | `ℹ via t.diagnostic` | `ℹ via context.log` | log は `✔ probe` の前、diagnostic は後 |
| tap | `# via console.log`（TAPコメント化される） | `# via t.diagnostic` | `# via context.log` | log は `# Subtest: probe` の前、diagnostic は `ok 1` の後 |
| dot | 消える | 消える | 消える | 出力は `.` のみ |

`console.log` は常に素のまま流れると思っていたら、tap では `#` コメントに変換されていました。素のまま出るのは spec のときだけです。dot は3種とも全部捨てます。

PR 本文には「Built-in reporters render it the same way they render `test:diagnostic`」とあります。接頭辞という意味では確かにそうですが、出力位置は違いました。

## 詰まった点

### reporter のパスに `./` が必要

`test:log` と `test:diagnostic` を JSON で吐くだけの reporter を書きました。

```js:reporters/dump.mjs
export default async function* dump(source) {
  for await (const event of source) {
    if (event.type === 'test:log' || event.type === 'test:diagnostic') {
      yield JSON.stringify(event) + '\n';
    }
  }
}
```

素直に相対パスで渡したら落ちました。

```bash
node --test --test-reporter=reporters/dump.mjs probe.test.mjs
```

```
node:internal/test_runner/harness:124
      throw err;
      ^

Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'reporters' imported from /path/to/workspace/
    at Object.getPackageJSONURL (node:internal/modules/package_json_reader:301:9)
    at packageResolve (node:internal/modules/esm/resolve:784:25)
    at moduleResolve (node:internal/modules/esm/resolve:873:18)
    at defaultResolve (node:internal/modules/esm/resolve:1006:11)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:708:20)
    at #resolveAndMaybeBlockOnLoaderThread (node:internal/modules/esm/loader:728:38)
    at ModuleLoader.resolveSync (node:internal/modules/esm/loader:766:56)
    at #resolve (node:internal/modules/esm/loader:690:17)
    at ModuleLoader.getOrCreateModuleJob (node:internal/modules/esm/loader:610:35)
    at node:internal/modules/esm/loader:639:32 {
  code: 'ERR_MODULE_NOT_FOUND'
}

Node.js v26.7.0
```

終了コードは 7 でした。`./reporters/dump.mjs` にすれば通ります。`--test-reporter` の値はただの ESM 指定子として解決されるので、`./` が無いと npm パッケージ名として探しに行きます。エラーが `Cannot find package 'reporters'` になるので、素直に読むと「reporters というパッケージを入れろ」と言われている気がして、しばらく npm を検索しかけました。

### サマリ行まで `test:diagnostic` で流れてくる

`./` を付けて成功した出力が、テスト1本ぶんでこれです。

```
{"type":"test:log","data":{"name":"probe","nesting":0,"testId":1,"parentId":0,"message":"via context.log","line":3,"column":1,"file":"/path/to/probe.test.mjs","entryFile":"/path/to/probe.test.mjs"}}
{"type":"test:diagnostic","data":{"nesting":0,"message":"via t.diagnostic","level":"info","line":3,"column":1,"file":"/path/to/probe.test.mjs","entryFile":"/path/to/probe.test.mjs"}}
{"type":"test:diagnostic","data":{"nesting":0,"message":"tests 1","level":"info"}}
{"type":"test:diagnostic","data":{"nesting":0,"message":"suites 0","level":"info"}}
{"type":"test:diagnostic","data":{"nesting":0,"message":"pass 1","level":"info"}}
{"type":"test:diagnostic","data":{"nesting":0,"message":"fail 0","level":"info"}}
{"type":"test:diagnostic","data":{"nesting":0,"message":"cancelled 0","level":"info"}}
{"type":"test:diagnostic","data":{"nesting":0,"message":"skipped 0","level":"info"}}
{"type":"test:diagnostic","data":{"nesting":0,"message":"todo 0","level":"info"}}
{"type":"test:diagnostic","data":{"nesting":0,"message":"duration_ms 58.06925","level":"info"}}
```

`tests 1` `pass 1` といった末尾のサマリも `test:diagnostic` として流れてきます。10件のうち8件がサマリでした。自作 reporter で診断メッセージを集計しようとすると、まずここでノイズを踏むことになります。

### `JSON.stringify` した時点で情報が落ちていた

`t.log('msg', data)` の第2引数がどう届くかを見たくて、いろんな型を混ぜたペイロードを渡しました。

```js:data.test.mjs
import { test } from 'node:test';

const payload = {
  userId: 42,
  nested: { deep: { arr: [1, 2, { three: true }] } },
  when: new Date('2026-08-12T07:00:00.000Z'),
  map: new Map([['k', 'v']]),
  buf: Uint8Array.from([1, 2, 3]),
  nil: null,
  undef: undefined,
};

test('structured payload passes through', (t) => {
  t.log('fetched user', payload);
  t.log('no payload at all');
  t.log('primitive payload', 123);
  t.log('array payload', ['a', 'b']);
});
```

さきほどの `dump.mjs` で見たら `map: {}` と `buf: {"0":1,"1":2,"2":3}` と出たので、「`Map` と `Uint8Array` はランナーが潰すのか」と結論を書きかけました。潰していたのは自分の `JSON.stringify` のほうです。`util.inspect` で見る reporter を別に作って見直しました。

```js:reporters/inspect.mjs
import { inspect } from 'node:util';

export default async function* dump(source) {
  for await (const event of source) {
    if (event.type === 'test:log') {
      yield inspect(event.data, { depth: null, breakLength: 200 }) + '\n';
    }
  }
}
```

出力は4件のうち1件目（`fetched user`）のみ抜粋します。

```
{
  name: 'structured payload passes through',
  nesting: 0,
  testId: 1,
  parentId: 0,
  message: 'fetched user',
  data: {
    userId: 42,
    nested: {
      deep: { arr: [ 1, 2, { three: true } ] }
    },
    when: 2026-08-12T07:00:00.000Z,
    map: Map(1) { 'k' => 'v' },
    buf: Uint8Array(3) [ 1, 2, 3 ],
    nil: null,
    undef: undefined
  },
  line: 13,
  column: 1,
  file: '/path/to/data.test.mjs',
  entryFile: '/path/to/data.test.mjs'
}
```

`Map(1) { 'k' => 'v' }` と `Uint8Array(3) [ 1, 2, 3 ]` のまま届いていました。プロセス分離越しに structured clone されているので、考えてみれば当然です。ダンプ手段そのものが観測結果を変えていた、というのが今回いちばん実務に効きそうな教訓でした。

残り3件も同じ reporter で見ています。`data` を渡さない場合はイベントに `data` キー自体が付きません（`JSON.stringify` の出力に `"data"` が現れず、`inspect` では `data: undefined`）。プリミティブの `123` や配列の `['a','b']` もそのまま載ります。

```
  message: 'no payload at all',
  data: undefined,
...
  message: 'primitive payload',
  data: 123,
...
  message: 'array payload',
  data: [ 'a', 'b' ],
```

### 関数を混ぜたらテストファイルまるごと落ちた

ドキュメントの `data` の説明に「When tests run with process isolation, this value must be compatible with the HTML structured clone algorithm」とありました。制約として読み流していたのですが、実際に踏んでみると挙動が思ったより激しいです。

```js:data-fn.test.mjs
import { test } from 'node:test';

test('function payload', (t) => {
  t.log('with a function', { cb: () => 'nope' });
});
```

:::details エラー全文（関数を渡した場合・デフォルトのプロセス分離）
```
node:internal/test_runner/harness:131
      throw err;
      ^

Error: () => 'nope' could not be cloned.
    at v8Reporter (node:internal/test_runner/reporter/v8-serializer:28:16)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
    at async nextAsync (node:internal/streams/from:193:33)
Emitted 'error' event on Duplex instance at:
    at emitErrorNT (node:internal/streams/destroy:170:8)
    at emitErrorCloseNT (node:internal/streams/destroy:129:3)
    at process.processTicksAndRejections (node:internal/process/task_queues:90:21)

Node.js v26.7.0
✖ data-fn.test.mjs (49.9145ms)
ℹ tests 1
ℹ suites 0
ℹ pass 0
ℹ fail 1
...
✖ failing tests:

test at data-fn.test.mjs:1:1
✖ data-fn.test.mjs (49.9145ms)
  'test failed'
```
:::

落ちるのは該当テストではなく、テストファイルまるごとです。しかもスタックが `harness` と `v8-serializer` なので、自分が書いたログ行が原因だと気づくのに少し考えました。`console.log` に同じオブジェクトを渡すぶんには落ちないので、既存の `console.log` を機械的に `t.log` へ置き換えると踏みます。

循環参照でも落ちました。こちらは structured clone の仕様上は扱えるはずなので、正直まだ納得できていません。

```js:data-circular.test.mjs
import { test } from 'node:test';

test('circular payload', (t) => {
  const a = { name: 'a' };
  a.self = a;
  t.log('circular', a);
});
```

```
✖ data-circular.test.mjs (48.164208ms)
ℹ tests 1
ℹ suites 0
ℹ pass 0
ℹ fail 1
...
✖ failing tests:

test at data-circular.test.mjs:1:1
✖ data-circular.test.mjs (48.164208ms)
  Error: Unable to deserialize cloned data.
      at #processRawBuffer (node:internal/test_runner/runner:490:33)
      at FileTest.parseMessage (node:internal/test_runner/runner:396:29)
      at Socket.<anonymous> (node:internal/test_runner/runner:544:15)
      at Socket.emit (node:events:514:20)
      at addChunk (node:internal/streams/readable:568:12)
      at readableAddChunkPushByteMode (node:internal/streams/readable:519:3)
      at Readable.push (node:internal/streams/readable:399:5)
      at Pipe.onStreamRead (node:internal/stream_base_commons:189:23)
```

失敗しているのは親プロセス側のデシリアライズです。`--test-isolation=none` を付けるとどちらのケースも通ります（関数は `data: { cb: [Function: cb] }` として届き、循環参照のテストは成功します）。Node 側の実装都合なのだろうと思いますが、追いきれていないので「こう出た」までにしておきます。

### `concurrency: true` の付け場所

冒頭に貼った並行実行の出力を作るときにも一度つまずきました。最初は各トップレベル `test()` に `{ concurrency: true }` を付けたのですが、ログはまったくインターリーブせず、alpha の step1→step2→step3 が終わってから beta が始まる直列の出力になりました。

`concurrency` は「その test のサブテストをどれだけ並行に走らせるか」の指定で、兄弟テストの並行度ではありません。`describe` 側に付けて書き直したらインターリーブしました。

```js:conc.test.mjs
import { describe, it } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';

describe('concurrent suite', { concurrency: true }, () => {
  for (const [name, delay] of [['alpha', 30], ['beta', 10], ['gamma', 20]]) {
    it(name, async (t) => {
      console.log(`[console] ${name} step1`);
      t.log('step1');
      await sleep(delay);
      console.log(`[console] ${name} step2`);
      t.log('step2');
      await sleep(delay);
      console.log(`[console] ${name} step3`);
      t.log('step3');
    });
  }
});
```

## 自作 reporter で分かったこと

### `test:log` と `test:diagnostic` のフィールド差分

6ファイル分のイベントを `events.jsonl` に集めて、`Object.keys()` を機械的に突き合わせました（目視ではありません）。

```bash
: > results/events.jsonl
for f in probe tree suite conc data entry; do
  node --test --test-reporter=./reporters/dump.mjs $f.test.mjs 2>/dev/null >> results/events.jsonl
done
node field-diff.mjs | tee results/field-diff.md
```

:::details field-diff.mjs（全文）
```js:field-diff.mjs
// results/events.jsonl を読み、test:log と test:diagnostic の data キー集合を突き合わせる
import { readFileSync } from 'node:fs';

const lines = readFileSync('results/events.jsonl', 'utf8').trim().split('\n');
const keys = { 'test:log': new Set(), 'test:diagnostic': new Set() };
const counts = { 'test:log': 0, 'test:diagnostic': 0 };

for (const line of lines) {
  const ev = JSON.parse(line);
  if (!keys[ev.type]) continue;
  counts[ev.type]++;
  for (const k of Object.keys(ev.data)) keys[ev.type].add(k);
}

const all = [...new Set([...keys['test:log'], ...keys['test:diagnostic']])].sort();
console.log(`events: test:log=${counts['test:log']} test:diagnostic=${counts['test:diagnostic']}`);
console.log('');
console.log('| field | test:log | test:diagnostic |');
console.log('|---|---|---|');
for (const k of all) {
  console.log(`| \`${k}\` | ${keys['test:log'].has(k) ? '✅' : '—'} | ${keys['test:diagnostic'].has(k) ? '✅' : '—'} |`);
}
console.log('');
console.log('test:log only     :', all.filter((k) => keys['test:log'].has(k) && !keys['test:diagnostic'].has(k)).join(', '));
console.log('test:diagnostic only:', all.filter((k) => !keys['test:log'].has(k) && keys['test:diagnostic'].has(k)).join(', '));
```
:::

76行のイベント（`test:log` 26件 / `test:diagnostic` 50件）から出た表です。

| field | test:log | test:diagnostic |
|---|---|---|
| `column` | ✅ | ✅ |
| `data` | ✅ | — |
| `entryFile` | ✅ | ✅ |
| `file` | ✅ | ✅ |
| `level` | — | ✅ |
| `line` | ✅ | ✅ |
| `message` | ✅ | ✅ |
| `name` | ✅ | — |
| `nesting` | ✅ | ✅ |
| `parentId` | ✅ | — |
| `testId` | ✅ | — |

`test:log` だけが持つのは `data` / `name` / `parentId` / `testId` の4つ、`test:diagnostic` だけが持つのは `level` の1つでした。事前に予想していたときは帰属3点セット（`name` / `testId` / `parentId`）だけを数えていて、`data` を数え落としていました。「帰属情報と構造化ペイロード」対「深刻度」という設計の違いが、この1枚に出ています。ドキュメントの記載とも一致しました。

### 帰属先を復元してみる

冒頭の読めない出力を、`testId` で束ね直す reporter に通します。

```js:reporters/group.mjs
// test:log を testId でグルーピングし直して、並行実行で混ざったログを復元する
export default async function* group(source) {
  const byTest = new Map();
  for await (const event of source) {
    if (event.type !== 'test:log') continue;
    const { testId, name, message } = event.data;
    if (!byTest.has(testId)) byTest.set(testId, { name, messages: [] });
    byTest.get(testId).messages.push(message);
  }
  for (const [testId, { name, messages }] of byTest) {
    yield `[testId=${testId}] ${name}\n`;
    for (const m of messages) yield `    ${m}\n`;
  }
}
```

同じテストの出力がこうなります。

```
[testId=2] alpha
    step1
    step2
    step3
[testId=3] beta
    step1
    step2
    step3
[testId=4] gamma
    step1
    step2
    step3
```

14行でここまで来るのは気持ちよかったのですが、同時に、この記事で書き方を間違えそうになった点でもあります。`t.log()` を使えば並行実行のログが読めるようになる、のではありません。組み込み reporter は帰属情報を捨てて描画するので、正しくは「イベントには帰属が載っているので、reporter 側で復元できる」です。読める出力を得るには自分で束ね直すコードが必要でした。

### `testId` は連番ではない

サブテスト・`describe`/`it`・失敗テストを1ファイルに詰めて、帰属の記録を見ました。

```js:tree.test.mjs
import { test, describe, it } from 'node:test';

test('parent', async (t) => {
  t.log('in parent');
  await t.test('child', (t2) => { t2.log('in child'); });
  await t.test('grandparent-of', async (t2) => {
    t2.log('in child2');
    await t2.test('grandchild', (t3) => { t3.log('in grandchild'); });
  });
});

describe('a suite', () => {
  it('an it', (t) => { t.log('in it'); });
});

test('failing test', (t) => {
  t.log('right before throwing');
  throw new Error('boom');
});
```

| file | name | message | nesting | testId | parentId |
|---|---|---|---|---|---|
| tree.test.mjs | parent | in parent | 0 | 1 | 0 |
| tree.test.mjs | child | in child | 1 | 5 | 1 |
| tree.test.mjs | grandparent-of | in child2 | 1 | 6 | 1 |
| tree.test.mjs | grandchild | in grandchild | 2 | 7 | 6 |
| tree.test.mjs | an it | in it | 1 | 3 | 2 |
| tree.test.mjs | failing test | right before throwing | 0 | 4 | 0 |

宣言順は parent → a suite → an it → failing test → child → … ですが、`child` が 5、`an it` が 3、`failing test` が 4 です。トップレベルとサブテストで採番のタイミングが違うようで、サブテストは実行時に番号が振られています。ドキュメントには「A numeric identifier」としか書かれていないので、ダンプを見るまで気づきませんでした。`testId` を画面に出す通し番号として使うと読者が混乱するので、ツリー復元のキーとしてだけ使うのが無難だと思います。

`nesting` は素直にネスト深さ（0 / 1 / 2）で、`parentId` で親を辿れます（grandchild の 7 → grandparent-of の 6 → parent の 1）。`an it` の `parentId` が 2 なのは `describe('a suite')` 自身の `testId` で、`describe` もテストツリー上のノードとして採番されていることが分かります。

`failing test` の、throw する直前の `t.log()` もちゃんと `failing test` に帰属して残りました。イベントが即時発火なので、テストが落ちてもログが失われません。

### ドキュメントと食い違ったところ

`Event: 'test:log'` の `parentId` は、ドキュメントでは「The `testId` of the enclosing test, or `undefined` for top-level tests」となっています。ですが今回の全実行で、トップレベルテストの `parentId` は常に `0` でした。`undefined` は一度も観測できていません。プロセス分離あり・`--test-isolation=none` の両方で `0` です。

```
=== doc says parentId is undefined for top-level tests. observed: ===
--- process isolation (default) ---
{"type":"test:log","data":{"name":"probe","nesting":0,"testId":1,"parentId":0,"message":"via context.log",...}}
--- --test-isolation=none ---
{"type":"test:log","data":{"name":"probe","nesting":0,"testId":1,"parentId":0,"message":"via context.log",...}}
```

`0` はルート（ファイルレベル）のノードを指しているのだろうと想像していますが、断定はできません。実用上は、トップレベル判定を `parentId === undefined` で書くと動かない、という注意になります。

## 既存の手段と比べて感じたこと

### `SuiteContext` の `log()`

`describe` のコールバックが受け取るコンテキストにも `log()` があります。

```js:suite.test.mjs
import { describe, it } from 'node:test';

describe('outer suite', (suite) => {
  suite.log('log from SuiteContext');
  suite.diagnostic('diagnostic from SuiteContext');

  it('inner test', (t) => {
    t.log('log from TestContext');
  });

  describe('nested suite', (s2) => {
    s2.log('log from nested SuiteContext');
    it('deep test', (t) => {
      t.log('log from deep TestContext');
    });
  });
});
```

| name | message | nesting | testId | parentId |
|---|---|---|---|---|
| outer suite | log from SuiteContext | 0 | 1 | 0 |
| nested suite | log from nested SuiteContext | 1 | 3 | 1 |
| inner test | log from TestContext | 1 | 2 | 1 |
| deep test | log from deep TestContext | 2 | 4 | 3 |

スイート自身の名前に帰属したイベントが出ます（`name: 'outer suite'`）。fixture の用意のようなスイート単位の準備ログを、テストのログと同じ経路に流せるのは便利そうです。

出力順には注意が必要でした。dump 上では suite のログ2件が先にまとまって出て、そのあとにテストのログが出ます。`describe` のコールバックは登録フェーズで同期実行されるので、`suite.log()` は「テストが1本も走る前」に発火しています。同じ `suite.diagnostic('...')` のほうは `test:diagnostic` として、全テストが終わったあと（サマリの直前）に流れました。ここでも buffered / immediate の差が出ます。

### `entryFile` と組み合わせる

同じ v26.6.0 で入った `entryFile` は、`context.log()` と一緒に使って初めて意味が分かりました。テストを別モジュールに切り出して import する構成を作ります。

```js:entry.test.mjs
import { test } from 'node:test';
import { registerImportedTests } from './lib/imported-tests.mjs';
test('test defined in the entry file', (t) => { t.log('logged from entry file'); });
registerImportedTests();
```

```js:lib/imported-tests.mjs
import { test } from 'node:test';
export function registerImportedTests() {
  test('test defined in an imported module', (t) => { t.log('logged from imported module'); });
}
```

※ 以下の出力は、パスを末尾2階層に短縮して表示しています。

```
=== entry.test.mjs, process isolation (default): file vs entryFile ===
{"name":"test defined in the entry file","message":"logged from entry file","file":"workspace/entry.test.mjs","entryFile":"workspace/entry.test.mjs"}
{"name":"test defined in an imported module","message":"logged from imported module","file":"lib/imported-tests.mjs","entryFile":"workspace/entry.test.mjs"}
```

`file` はそのテストが定義されているファイル、`entryFile` はランナーが子プロセスのエントリとして実行したファイルです。ヘルパーで共通テストを生成している構成では、この2つがふつうに食い違います。`--test-isolation=none` で走らせると `entryFile` フィールドはそもそも付きませんでした（ドキュメントの "Only present when tests run with process isolation" どおりです）。

「どのテストが」（`name` / `testId`）「どのファイルで定義され」（`file`）「どのファイルを実行した子プロセスで」（`entryFile`）出たログか、が1イベントで揃うのは、CI のログを機械処理する立場だと確かに嬉しいところだと思います。

### 3手段の使い分け

実測を踏まえて、今のところ自分はこう考えています。

- `console.log` … 帰属が要らない一時的なデバッグ。dot reporter では消えるし tap ではコメント化されるので、CI に残す恒久ログには向かない。ただし何でも渡せて絶対に落ちない
- `t.diagnostic(message)` … テスト結果のあとに、宣言順で読ませたい要約（計測値など）。`level` を持つが帰属情報が無いので、機械集計には向かない
- `t.log(message[, data])` … 帰属と構造化データが要るとき。reporter で機械処理する前提のログはこれ。ただし 26.6 未満では `TypeError`、プロセス分離下では structured clone 可能な値しか渡せない

## どんな人に向いていそうか

CI のテストログを機械処理している人、あるいは並行実行でログの帰属が分からなくて困っている人には効くと思います。逆に、26.6 未満をサポートするプロジェクトでは選択肢に入りません。

もうひとつ正直に書くと、reporter を自作する気がないなら旨味は薄いです。組み込み reporter は `test:diagnostic` と同じ見た目で描画するだけで帰属情報を捨てるので、`console.log` から `t.log` に置き換えても手元の画面は（出力位置が変わる以外）ほとんど変わりません。イベント側に情報が入っている、というのがこの API の本体です。

## まとめ

確かめられたのは、3種のログの出力位置の違い、`test:log` 固有のフィールドが4つ（`data` / `name` / `parentId` / `testId`）で `test:diagnostic` 固有が `level` の1つ、サブテストや失敗テストでもログが正しく帰属すること、14行の reporter で並行実行のログを束ね直せること、26.5.0 では `TypeError: t.log is not a function` で使えないこと、でした。

一方で分からないまま残ったことが2つあります。ひとつは循環参照のペイロードが `Unable to deserialize cloned data.` で落ちる理由（structured clone 自体は循環参照を扱えるはずです）。もうひとつは、ドキュメントが `parentId` を「`undefined` for top-level tests」としているのに、実測では常に `0` だった理由です。どちらも Node 側の実装を読むところまでは行けていません。

再現手順はこれだけです。

```bash
mkdir node-test-log && cd node-test-log
echo '{"type":"module"}' > package.json
mkdir reporters

cat > probe.test.mjs <<'EOF'
import { test } from 'node:test';
test('probe', (t) => {
  console.log('via console.log');
  t.diagnostic('via t.diagnostic');
  t.log('via context.log');
});
EOF

cat > reporters/dump.mjs <<'EOF'
export default async function* dump(source) {
  for await (const event of source) {
    if (event.type === 'test:log' || event.type === 'test:diagnostic') {
      yield JSON.stringify(event) + '\n';
    }
  }
}
EOF

node --test --test-reporter=spec probe.test.mjs                   # 出力位置の違いを見る
node --test --test-reporter=./reporters/dump.mjs probe.test.mjs   # フィールドの違いを見る
```

引っかかりやすいところを最後に並べておきます。

:::message alert
- Node 26.6.0 未満では `t.log` が存在せず `TypeError: t.log is not a function`。`--experimental-*` を促すヒントも出ない（有効化する手段は見つからなかった）
- `--test-reporter` に相対パスを渡すときは `./` が必須。無いと npm パッケージとして解決され `ERR_MODULE_NOT_FOUND`
- `t.log()` の第2引数は、デフォルト（プロセス分離あり）では structured clone 可能な値のみ。関数を含めるとテストファイルごと落ちる
- reporter 内で `JSON.stringify` すると `Map` / `Uint8Array` / `Date` が変質する。中身を確認したいときは `util.inspect`
- 兄弟テストを並行に走らせるには `describe('...', { concurrency: true }, ...)`。個々の `test()` に付けても兄弟は並行にならない
- `entryFile` はプロセス分離時のみ付く（`--test-isolation=none` では欠落）
:::

## 参考リンク

- [Node.js v26.x Changelog（v26.6.0）](https://github.com/nodejs/node/blob/main/doc/changelogs/CHANGELOG_V26.md)
- [test_runner: add `context.log()` and `test:log` event（PR #64389）](https://github.com/nodejs/node/pull/64389)
- [test_runner: report `entryFile` in `TestStream` events（PR #64309）](https://github.com/nodejs/node/pull/64309)
- [Node.js ドキュメント: Test runner（v26.7.0 の doc/api/test.md）](https://github.com/nodejs/node/blob/v26.7.0/doc/api/test.md)
