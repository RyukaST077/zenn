---
title: "Vitest 5 RC に上げてみたら、テストより先に npm が落ちた"
emoji: "🧪"
type: "tech"
topics: ["vitest", "npm", "typescript", "testing", "vite"]
published: false
---

<!-- 前提: 出典ログ logs/run-vitest5-rc-breaking-changes-20260817-0412/execution-log.md / 記事タイプ: 検証ログ・詰まった点まとめ / slug: vitest5-rc-breaking-changes / published: false -->

## はじめに

Vitest 5 が RC になっていたので、手元に小さな fixture を作って、移行ガイドに載っている破壊的変更を1つずつ踏んでみました。

`npm view` で dist-tags を見るとこんな状況です。

```console
$ npm view vitest dist-tags
{
  V3: '3.2.7',
  latest: '4.1.10',
  beta: '5.0.0-beta.7',
  rc: '5.0.0-rc.1'
}
```

公開日は 4.1.10 が 2026-07-06、5.0.0-rc.1 が 2026-08-11。安定版が出てから慌てるより、RC のうちに自分のテストがどこで落ちるか知っておきたいと思って触りました。

やったことは単純で、

1. Vitest 4.1.10 で全部緑になるテスト fixture を作る
2. そのまま 5.0.0-rc.1 に上げて、何が落ちるか見る
3. 移行ガイドどおりに直して、また全部緑にする

の3ステップです。結果としては 8 項目中 5 項目が落ちて、全部直せました。ただ、いちばん時間を食ったのはテストコードではなく `npm i` でした。

:::message
筆者はテストフレームワークの移行をちゃんとやるのは初めてです。RC 時点の挙動なので、安定版で変わる可能性があります（検証日: 2026-08-17）。
:::

## 破壊的変更は24項目、そこから8項目に絞った

[移行ガイド](https://main.vitest.dev/guide/migration)を開くと破壊的変更が全24項目ありました。最初に見たときは正直ひるみました。

ただ、中身を読むと Browser Mode、Benchmark API、Vitest UI の認証、`resolveConfig` のようなプログラマティック API など、ブラウザ・ベンチ寄りの項目がかなりの割合を占めています。「普通にユニットテストを書いているだけの人が影響を受けるもの」という基準で選ぶと、8項目まで減りました。この記事ではその8項目を A〜H として扱います。

| # | ガイドの見出し（原文） |
|---|---|
| A | Unawaited Asynchronous Assertions Fail the Test |
| B | `clearMocks` is Enabled by Default |
| C | `testNamePattern` Matches the `>`-Joined Full Name |
| D | Hoisted Mocking Calls Must Be at the Top Level |
| E | Removed `test.sequential`, `describe.sequential`, and `sequential` Options |
| F | `toThrow("")` Matches Any Error Message |
| G | Generated Reports and Artifacts Use the `.vitest` Directory |
| H | Worker and Concurrency Ids Are 1-based |

検証する前に、それぞれどうなるか予想も書いておきました。あとで実測と突き合わせるためです。

| 項目 | 4.1 はこうなるはず | 5 はこうなるはず |
|---|---|---|
| A | 自動awaitされ、警告つきで緑 | 失敗する |
| B | 履歴が残り `1` | クリアされて `0` |
| C | `'math adds'` がマッチ | `'math > adds'` がマッチ |
| D | 警告つきで緑 | エラーで失敗 |
| E | 動く（deprecation 警告が出るかも） | 削除されて失敗 |
| F | `toThrow('')` は空メッセージのみ一致 | 任意のメッセージに一致 |
| G | `.vitest/` は作られない | `.vitest/` が作られる |
| H | WORKER_ID / POOL_ID とも `0` 始まり | とも `1` 始まり |

このうち3つ外しました。答え合わせは後半で。

## 事前に調べたバージョン要件

`npm view` で 5 RC の要件を見ます。

```console
$ npm view vitest@rc engines peerDependencies
engines = { node: '^22.12.0 || ^24.0.0 || >=26.0.0' }
peerDependencies = {
  vite: '^6.4.0 || ^7.0.0 || ^8.0.0',
  jsdom: '*',
  'happy-dom': '*',
  '@vitest/ui': '5.0.0-rc.1',
  '@types/node': '^22.0.0 || >=24.0.0',
  '@edge-runtime/vm': '*',
  '@opentelemetry/api': '^1.9.0',
  '@vitest/coverage-v8': '5.0.0-rc.1',
  '@vitest/browser-preview': '5.0.0-rc.1',
  '@vitest/coverage-istanbul': '5.0.0-rc.1',
  '@vitest/browser-playwright': '5.0.0-rc.1',
  '@vitest/browser-webdriverio': '^5.0.0-beta.5 || >=5.0.0'
}
```

4.1.10 のほうはこうです。

```console
$ npm view vitest@4.1.10 peerDependencies.vite engines
peerDependencies.vite = '^6.0.0 || ^7.0.0 || ^8.0.0'
engines = { node: '^20.0.0 || ^22.0.0 || >=24.0.0' }
```

Node の下限が 20 系から 22.12.0 に、Vite の下限が 6.0.0 から 6.4.0 に上がっています。手元と照合するとこうなりました。

| 項目 | 要件（Vitest 5） | 手元 | 判定 |
|---|---|---|---|
| Node.js | `^22.12.0 \|\| ^24.0.0 \|\| >=26.0.0` | v22.17.0 | 満たす |
| Vite | `^6.4.0 \|\| ^7.0.0 \|\| ^8.0.0` | 未導入 → 8.2.1 を導入 | 満たす |
| npm | （engines 指定なし） | 10.9.2 | ？ |

両方満たしているので大丈夫だろう、と思ってこの表を閉じました。npm 自身のバージョンは要件表のどこにも書かれていないので、チェック項目にすら入れていません。実際に止まったのはここです。

## 環境構築（4.1 のベースラインを作る）

普通の npm プロジェクトを作ります。

```bash
mkdir vitest5-check && cd vitest5-check
npm init -y
npm i -D vitest@4.1.10 vite
```

`package.json` には `"type": "module"` と `"scripts": { "test": "vitest run" }` を足しました。ESM でテストを書きたかったからです。

インストールはあっさり通ります。

```console
added 44 packages, and audited 45 packages in 18s

17 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
```

peer dependency の警告は1件も出ませんでした。Vite は指定なしで最新の 8.2.1 が入ったので、5 の要件（`^6.4.0 || ^7 || ^8`）も自動的に満たしています。

```console
$ npx vitest --version
vitest/4.1.10 darwin-arm64 node-v22.17.0
$ npm ls vitest vite
+-- vite@8.2.1
`-- vitest@4.1.10
  +-- @vitest/mocker@4.1.10
  | `-- vite@8.2.1 deduped
  `-- vite@8.2.1 deduped
```

再現環境はこれです。

```:versions.log
os: macOS 26.5 / Darwin 25.5.0 arm64
node: v22.17.0
npm: 10.9.2
vitest: vitest/4.1.10 darwin-arm64 node-v22.17.0
vite: vite/8.2.1 darwin-arm64 node-v22.17.0
```

ここから A〜H を「1項目 = 1テストファイル」で書いて、まず 4.1.10 で全部緑にします。落ちるところが見たいのに最初から赤があると、どれが 5 のせいか分からなくなるので。

なお、以降に貼る端末出力はホームディレクトリのパスを `/Users/.../` にマスクし、作業ディレクトリ名を上の再現手順に合わせて `vitest5-check` に揃えています。それ以外は実行時の出力そのままです。

```console
 RUN  v4.1.10 /Users/.../vitest5-check

Warning: A vi.mock("./fixtures/greeter.ts") call in "/Users/.../test/d-vimock-inline.test.ts" is not at the top level of the module. Although it appears nested, it will be hoisted and executed before any tests run. Move it to the top level to reflect its actual execution order. This will become an error in a future version.
See: https://vitest.dev/guide/mocking/modules#how-it-works

 Test Files  8 passed (8)
      Tests  8 passed (8)
   Start at  04:17:37
   Duration  1.45s (transform 983ms, setup 0ms, import 1.61s, tests 166ms, environment 17ms)
```

終了コード 0。8ファイル / 8テストすべて緑です。警告は項目D のものが1件だけ出ています。この時点で全項目のログを `grep -i warn` してみたのですが、ヒットするのはこの1件のみでした。他の項目は 4.1 では何も言ってくれません。

## テストより先に npm が落ちた

ベースラインができたので、上げます。

```bash
npm i -D vitest@5.0.0-rc.1
```

```console
npm error Cannot read properties of null (reading 'edgesOut')
npm error A complete log of this run can be found in: /Users/.../.npm/_logs/2026-08-16T19_17_52_168Z-debug-0.log
```

7秒で終了コード 1。`npx vitest --version` は `4.1.10` のままで、`node_modules` は何も変わっていません。

エラー文が完全に npm の内部エラーで、何が悪いのか一切教えてくれません。最初は自分の `package.json` か既存の依存ツリーが壊れているんだろうと思いました。デバッグログを開くとこうです。

:::details npm デバッグログのスタックトレース（全文）
```
191 verbose stack TypeError: Cannot read properties of null (reading 'edgesOut')
191 verbose stack     at #loadPeerSet (.../@npmcli/arborist/lib/arborist/build-ideal-tree.js:1289:38)
191 verbose stack     at async #loadPeerSet (.../build-ideal-tree.js:1297:11)
191 verbose stack     at async #loadPeerSet (.../build-ideal-tree.js:1297:11)
191 verbose stack     at async #loadPeerSet (.../build-ideal-tree.js:1297:11)
191 verbose stack     at async #loadPeerSet (.../build-ideal-tree.js:1308:23)
191 verbose stack     at async #buildDepStep (.../build-ideal-tree.js:904:11)
191 verbose stack     at async Arborist.buildIdealTree (.../build-ideal-tree.js:181:7)
191 verbose stack     at async Promise.all (index 1)
191 verbose stack     at async Arborist.reify (.../@npmcli/arborist/lib/arborist/reify.js:131:5)
191 verbose stack     at async Install.exec (.../npm/lib/commands/install.js:150:5)
192 error Cannot read properties of null (reading 'edgesOut')
```
:::

`#loadPeerSet` が自分自身を何度も呼んでいて、その途中で落ちています。クラッシュ直前の行を見ると何を辿っていたか分かりました。

```
185 silly fetch manifest vitest@*
189 silly fetch manifest @vitest/browser-playwright@4.1.10
191 verbose stack TypeError: Cannot read properties of null (reading 'edgesOut')
```

peer dependency を再帰的に解決していく途中で `vitest@*` に戻ってきていて、そこでツリーに登録されていないノード（null）を触っています。先ほど見た 5 RC の peerDependencies は12個あって、うち `@vitest/browser-webdriverio` は `^5.0.0-beta.5 || >=5.0.0` という範囲指定です。この辺りを辿るうちに循環したのだと思います。

切り分けに試したことを並べるとこうなりました。

| 試したこと | 結果 |
|---|---|
| `npm i -D vitest@5.0.0-rc.1 --legacy-peer-deps` | 成功（3秒） |
| `rm -rf node_modules package-lock.json` → クリーンインストール | 同じエラー |
| 空の一時ディレクトリで `npm init -y` → `npm i -D vitest@5.0.0-rc.1` | 同じエラー |
| 同じ空ディレクトリで `npm i -D vitest@4.1.10` | 成功 |
| 同じ空ディレクトリで `npm i -D vitest@5.0.0-beta.7` | 同じエラー |

クリーンインストールを先に試したのは完全に無駄でした。効いたのは、空の一時ディレクトリで最小再現を取ることです。`npm init -y` しかしていないディレクトリでも同じように落ちて、そこで 4.1.10 は通り、5 系（rc.1 も beta.7 も）は落ちる、と分かった時点で「自分のプロジェクトの問題ではない」と確定しました。

解決は `--legacy-peer-deps` を付けるだけです。

```bash
npm i -D vitest@5.0.0-rc.1 vite@8.2.1 --legacy-peer-deps
```

```console
added 37 packages, and audited 38 packages in 5s

found 0 vulnerabilities
```

```console
$ npx vitest --version
vitest/5.0.0-rc.1 darwin-arm64 node-v22.17.0
```

入ってしまえば実行は完全に正常です。Vite も 8.2.1 のまま動きます。

:::message alert
npm 10.9.2 では `vitest@5.0.0-rc.1` がそのままだと入りません。`--legacy-peer-deps` が必要です。5.0.0-beta.7 でも同様、4.1.10 は問題なし。npm を新しくすれば解消するかもしれませんが、そこは試していません。
:::

事前にバージョン要件表を作って「Node も Vite も満たしている」と確認した直後に、要件表に載っていない npm で止まりました。engines に書かれていない依存が落とし穴になる、というのが今回いちばん身に染みたところです。

## 何が落ちたか（無修正のまま 5 RC で流す）

`npx vitest run` をそのまま流します。

:::details 5.0.0-rc.1 での実行結果（全文）
```console
 RUN  v5.0.0-rc.1 /Users/.../vitest5-check

 ❯ test/f-tothrow-empty.test.ts (1 test | 1 failed) 19ms
   × F: toThrow('') against a non-empty message 14ms
 ❯ test/e-sequential.test.ts (0 test)
 ❯ test/d-vimock-inline.test.ts (0 test)
 ❯ test/a-unawaited.test.ts (1 test | 1 failed) 28ms
   × A: resolves without await 16ms
 ❯ test/b-clearmocks.test.ts (1 test | 1 failed) 13ms
   × B: mock call history survives into the test 10ms

⎯⎯⎯⎯⎯⎯ Failed Suites 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  test/d-vimock-inline.test.ts [ test/d-vimock-inline.test.ts ]
Error: 1 call in "test/d-vimock-inline.test.ts" was defined outside of the module's top level scope:

- vi.mock("./fixtures/greeter.ts") at test/d-vimock-inline.test.ts:8:3

Although it appears nested, it will be hoisted and executed before anything in this file. Move it to the top level to reflect its actual execution order.
See: https://vitest.dev/guide/mocking/modules#how-it-works
  Plugin: vitest:mocks
  File: /Users/.../test/d-vimock-inline.test.ts
 ❯ EnvironmentPluginContainer.transform node_modules/vite/dist/node/chunks/node.js:30851:51
 ❯ loadAndTransform node_modules/vite/dist/node/chunks/node.js:20619:26

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/5]⎯

 FAIL  test/e-sequential.test.ts [ test/e-sequential.test.ts ]
TypeError: test.sequential is not a function
 ❯ test/e-sequential.test.ts:6:6
      4| import { expect, test } from 'vitest'
      5|
      6| test.sequential('E: runs sequentially', () => {
       |      ^
      7|   expect(true).toBe(true)
      8| })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/5]⎯


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  test/a-unawaited.test.ts > A: resolves without await
Error: Promise returned by `expect(actual).resolves.toBe(expected)` was not awaited. This assertion is asynchronous and must be awaited; otherwise, it is not guaranteed to complete before the test finishes:

await expect(actual).resolves.toBe(expected)

 ❯ test/a-unawaited.test.ts:8:29
      6| test('A: resolves without await', () => {
      7|   // ここが意図的に await されていない
      8|   expect(Promise.resolve(1)).resolves.toBe(1)
       |                             ^
      9| })
     10|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/5]⎯

 FAIL  test/b-clearmocks.test.ts > B: mock call history survives into the test
AssertionError: expected +0 to be 1 // Object.is equality

- Expected
+ Received

- 1
+ 0

 ❯ test/b-clearmocks.test.ts:15:33
     13|   // 4.1: clearMocks 既定 false → 履歴が残るので 1
     14|   // 5:   clearMocks 既定 true  → 各テスト前に clearAllMocks されるので 0 になるはず
     15|   expect(spy.mock.calls.length).toBe(1)
       |                                 ^
     16| })
     17|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/5]⎯

 FAIL  test/f-tothrow-empty.test.ts > F: toThrow('') against a non-empty message
AssertionError: expected [Function boom] to throw error not including ''

- Expected
+ Received

+ boom happened

 ❯ test/f-tothrow-empty.test.ts:13:20
     11| test("F: toThrow('') against a non-empty message", () => {
     12|   // 4.1 でベースラインを緑にするため .not 側で書いている（5 でこの not が落ちる想定）
     13|   expect(boom).not.toThrow('')
       |                    ^
     14| })
     15|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/5]⎯


 Test Files  5 failed | 3 passed (8)
      Tests  3 failed | 3 passed (6)
   Start at  04:20:35
   Duration  1.27s (transform 47%, import 25%, worker 20%, tests 7%)
```
:::

終了コード 1。落ちたのは A・B・D・E・F の5項目、落ちなかったのは C・G+H と smoke です。

ここで予想と違ったのが2つありました。

1つは D と E の落ち方です。「テストが失敗する」と思っていたのですが、実際は Failed Suites、つまりファイルの読み込み自体が失敗しています。サマリの表示が `(0 test)` になっていて、`Tests` の分母が 8 から 6 に減っているのが分かります。テストが落ちるのではなく、そのファイルのテストが存在しないことになる。影響範囲が想定より大きいです。

もう1つは項目A のエラーメッセージで、

```
await expect(actual).resolves.toBe(expected)
```

と直した形をそのまま出してくれます。ガイドを開くまでもなく直せました。

## 項目ごとの直し方

### A: 未 await の非同期 assertion

```ts:test/a-unawaited.test.ts（before）
test('A: resolves without await', () => {
  // ここが意図的に await されていない
  expect(Promise.resolve(1)).resolves.toBe(1)
})
```

```ts:test/a-unawaited.test.ts（after）
test('A: resolves with await', async () => {
  await expect(Promise.resolve(1)).resolves.toBe(1)
})
```

4.1.10 ではこれが緑になります。予想では「自動 await されて警告が出る」だったのですが、警告は一切出ませんでした。無言で通ります。つまり 4.1 を使っている間は、自分のテストに await 漏れがあることに気づく手がかりがありません。5 に上げて初めて分かる。

### B: `clearMocks` の既定が true に

観測するには `vitest.config.ts` を書かない（既定値の変化を見たいので）ことと、モックの呼び出しを `beforeEach` ではなく `beforeAll` に置くことが条件でした。`beforeEach` だと毎回呼び直されるので履歴が復活してしまい、差が消えます。

```ts:test/b-clearmocks.test.ts（before）
const spy = vi.fn(() => 'called')

beforeAll(() => {
  spy()
})

test('B: mock call history survives into the test', () => {
  expect(spy.mock.calls.length).toBe(1)
})
```

5 では各テストの前に `vi.clearAllMocks()` が走るので、`beforeAll` で積んだ履歴が消えて 0 になります。履歴が必要ならテストの中で呼ぶ形に変えるのが素直です。

旧挙動を維持する逃げ道も実測しました。まず CLI フラグは存在しません。

```console
CACError: Unknown option `--clearMocks`
    at Command.checkUnknownOptions (.../node_modules/vitest/dist/chunks/cac.CM6y_f_i.js:405:17)
    at CAC.runMatchedCommand (.../cac.CM6y_f_i.js:605:13)
    at CAC.parse (.../cac.CM6y_f_i.js:546:12)
```

設定ファイルなら効きます。

```ts:vitest.escape.config.ts
import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { clearMocks: false } })
```

`vitest.config.ts` として置くと他の項目の検証条件（既定値のまま観測する）を壊すので、別名にして `--config` で読ませています。

```console
$ npx vitest run test/tmp-escape.test.ts --config vitest.escape.config.ts
 Test Files  1 passed (1)
      Tests  1 passed (1)
```

`beforeAll` の履歴が復活しました。移行が間に合わないときの避難先としては使えそうです。

### C: `-t` のマッチ先が入れ替わる

これは落ちた項目ではないのですが、個人的にいちばん怖いと思ったやつです。

```ts:test/c-filter.test.ts
describe('math', () => {
  test('adds', () => {
    expect(1 + 2).toBe(3)
  })
})
```

これに対して2パターンのフィルタを両バージョンで流すと、きれいに反転しました。

| `-t` のパターン | Vitest 4.1.10 | Vitest 5.0.0-rc.1 |
|---|---|---|
| `-t 'math adds'` | `1 passed (1)` | `1 skipped (1)` |
| `-t 'math > adds'` | `1 skipped (1)` | `1 passed (1)` |

問題は、マッチ0件のときの挙動です。エラーにならず `1 skipped (1)` と出るだけで、終了コードは両バージョンとも 0 でした。

CI で `-t` や `--testNamePattern` を使っていると、5 に上げた瞬間にパターンがマッチしなくなって、テストが1件も実行されないまま緑で通過します。落ちてくれないので気づけません。

### D: `vi.mock` はトップレベルへ

```ts:test/d-vimock-inline.test.ts（before）
function setupMock() {
  // トップレベルではなく関数の中で呼んでいる
  vi.mock('./fixtures/greeter.ts', () => ({ greet: () => 'mocked' }))
}

test('D: vi.mock called inside a function', async () => {
  setupMock()
  const mod = await import('./fixtures/greeter.ts')
  expect(typeof mod.greet).toBe('function')
})
```

```ts:test/d-vimock-inline.test.ts（after）
vi.mock('./fixtures/greeter.ts', () => ({ greet: () => 'mocked' }))

test('D: vi.mock at top level', async () => {
  const mod = await import('./fixtures/greeter.ts')
  expect(mod.greet()).toBe('mocked')
})
```

8項目の中でこれだけは 4.1 の時点で警告が出ます。しかも警告文に "This will become an error in a future version." と予告まで入っていました。4.1 の警告文をそのまま検索すれば移行対象が洗い出せるので、事前に潰しておける唯一の項目だと思います。

### E: `test.sequential` の削除

```ts:test/e-sequential.test.ts（before）
test.sequential('E: runs sequentially', () => {
  expect(true).toBe(true)
})
```

```ts:test/e-sequential.test.ts（after）
test('E: runs sequentially', { concurrent: false }, () => {
  expect(true).toBe(true)
})
```

エラーは `TypeError: test.sequential is not a function` だけで、直し方は教えてくれません。ガイドの "Use `concurrent: false` when you need a test or suite to opt out" を見て書き換えました。4.1 では deprecation 警告も出なかったので、事前に気づく手段はなさそうです。

### F: `toThrow('')` が任意一致に

この項目だけ fixture の書き方に少し悩みました。素直に `expect(boom).toThrow('')` と書くと 4.1 で落ちてしまうので、ベースラインを全部緑にするという自分ルールと衝突します。仕方なく 4.1 側は `.not` を挟んで書きました。

```ts:test/f-tothrow-empty.test.ts（before）
function boom(): never { throw new Error('boom happened') }

test("F: toThrow('') against a non-empty message", () => {
  // 4.1 でベースラインを緑にするため .not 側で書いている
  expect(boom).not.toThrow('')
})
```

5 では空文字がどのメッセージにも「含まれる」扱いになるので、この `.not` のほうが落ちます。直したあとはこうです。

```ts:test/f-tothrow-empty.test.ts（after）
function boom(): never { throw new Error('boom happened') }
function silent(): never { throw new Error('') }

test("F: toThrow('') now matches any error message", () => {
  expect(boom).toThrow('')
})

test('F: 「空メッセージだけに一致させたい」ときは正規表現で厳密に書く', () => {
  expect(silent).toThrow(/^$/)
  expect(boom).not.toThrow(/^$/)
})
```

`toThrow(/^$/)` の書き方はガイドには載っていなくて、自分で考えたものです。空メッセージ限定で一致させたいならこれで意図がはっきりします。

### G: `.vitest/` ディレクトリ → 再現しませんでした

ガイドには "uses a single `.vitest` directory at the project root as the shared artifact root" とあるので、成果物の出力先が `.vitest/` に変わるはずでした。4経路試しましたが、5.0.0-rc.1 でも `.vitest/` は作られませんでした。

| 試した経路 | 結果（5.0.0-rc.1） |
|---|---|
| `--reporter=json --outputFile=reports/v5.json` | 指定パスにそのまま出力。`.vitest/` なし |
| `--reporter=junit --outputFile=junit.xml` | プロジェクトルート直下の `./junit.xml` に出力。`.vitest/` なし |
| `--coverage`（`@vitest/coverage-v8@5.0.0-rc.1` を追加） | `coverage/` に出力。`.vitest/` なし |
| キャッシュの置き場 | `node_modules/.vite`（4.1 と同じ） |

```console
$ find . -maxdepth 3 -name '.vitest*' -not -path './node_modules/*'
（出力なし）
$ ls -la .vitest
ls: .vitest: No such file or directory
```

`--outputFile` を明示しない場合の既定パスが対象なのか、Browser Mode やスナップショットなど今回触っていない成果物の話なのか、それとも RC 時点でまだ実装されていないのか、そこまでは分かりませんでした。「試した4経路では出なかった」以上のことは言えません。

### H: worker/pool ID が1始まりに

ここは最初に書いたテストが 4.1 のベースラインで落ちました。

```console
stdout | test/gh-env.test.ts > GH: worker and pool ids are 0-based on 4.1
[GH] VITEST_WORKER_ID=0 VITEST_POOL_ID=1

 FAIL  test/gh-env.test.ts > GH: worker and pool ids are 0-based on 4.1
AssertionError: expected '1' to be '0' // Object.is equality

Expected: "0"
Received: "1"
```

4.1.10 の実測は `VITEST_WORKER_ID=0` / `VITEST_POOL_ID=1`。POOL_ID のほうは 4.1 の時点ですでに 1 始まりでした。「両方 0 始まり」という予想が外れたわけです。5.0.0-rc.1 では `VITEST_WORKER_ID=1` / `VITEST_POOL_ID=1` で、変わったのは `VITEST_WORKER_ID` だけ（0 → 1）でした。

もうひとつ、環境変数の値をそのまま assert したのも失敗でした。suite 全体を並列で流すと worker id はファイル数や実行状況で変わるので、比較が安定しません。結局、テストは「値を `console.log` に出して、定義されていることだけ検証する」形に変えて、値の比較は `--maxWorkers=1` の単独実行ログでやりました。

```ts:test/gh-env.test.ts
test('GH: worker/pool ids are exposed via env', () => {
  const worker = process.env.VITEST_WORKER_ID
  const pool = process.env.VITEST_POOL_ID
  console.log(`[GH] VITEST_WORKER_ID=${worker} VITEST_POOL_ID=${pool}`)
  expect(worker).toBeDefined()
  expect(pool).toBeDefined()
})
```

通常実行だと `console.log` が既定のレポータに出ないことがあるので、値を見たいときは `--reporter=verbose` を付けます。

## 直したあと

修正して流し直すと全部緑になりました。

```console
 RUN  v5.0.0-rc.1 /Users/.../vitest5-check

 Test Files  8 passed (8)
      Tests  9 passed (9)
   Start at  04:22:39
   Duration  1.51s (transform 45%, import 32%, worker 13%, tests 11%)
```

終了コード 0。テストが 8 から 9 に増えているのは、項目F に正規表現で厳密一致を見るテストを1件足したためです。

実行時間はこうでした。

```
4.1.10     : Duration  1.45s (transform 983ms, setup 0ms, import 1.61s, tests 166ms, environment 17ms)
5.0.0-rc.1 : Duration  1.51s (transform 45%, import 32%, worker 13%, tests 11%)
```

1.45s → 1.51s。テストが1件増えている分を考えるとほぼ同じで、この規模では速度の話はできません。

それより、この2行を並べていて気づいたのですが、`Duration` の表示形式そのものが変わっています。4.1 は `transform 983ms` と絶対値、5 は `transform 45%` と割合です。ログを機械的にパースして時間を取っている仕組みがあると、ここも壊れます。移行ガイドの項目にはなかったので、貼ってみて初めて気づきました。

## 8項目の結果まとめ

| 項目 | 破壊的変更 | 4.1.10 | 5.0.0-rc.1 | 直し方 |
|---|---|---|---|---|
| A | 未await の非同期assertion | 緑。警告も出ない | 失敗（Failed Tests） | テストを `async` にして `await expect(...)` |
| B | `clearMocks` 既定 true | 緑（履歴 `1`） | 失敗（`expected +0 to be 1`） | 新既定に合わせる、または config に `clearMocks: false`（CLI フラグは無い） |
| C | `-t` の区切りが `' > '` | `'math adds'` がマッチ | `'math > adds'` がマッチ | `-t` のパターンを `' > '` 区切りに書き換え |
| D | `vi.mock` トップレベル必須 | 緑だが警告あり | Failed Suites（ファイルごと読込失敗） | `vi.mock` をモジュールのトップレベルへ |
| E | `test.sequential` 削除 | 緑。警告なし | Failed Suites（`is not a function`） | `test('...', { concurrent: false }, fn)` |
| F | `toThrow('')` が任意一致 | 緑（`.not` の形で記述） | 失敗 | 空文字マッチに頼らず `toThrow(/^$/)` 等で意図を明示 |
| G | 成果物が `.vitest/` へ | `.vitest/` なし | 再現せず（4経路で確認） | — |
| H | worker/pool ID が1始まり | `WORKER_ID=0` / `POOL_ID=1` | `WORKER_ID=1` / `POOL_ID=1` | ID を 0 前提で計算している箇所を見直す |

8項目のうち実際に落ちたのは5項目でした。C は落ちるのではなくフィルタのマッチ先が入れ替わるだけ（しかも終了コード 0）で、予想どおりマッチ先が `'math adds'` から `'math > adds'` に入れ替わっています。

予想を外したのは A・G・H の3つです。A は 4.1 で警告が出ると思っていたのに無言だった、G は再現せず、H は変わったのが WORKER_ID の片方だけ。

事前に「起きそう」と書いていた詰まりのうち、Vite のバージョン要件で落ちる・Node で起動しない・項目B で差が出ない・項目C でマッチ0件になる、はどれも起きませんでした。代わりに起きたのが npm のクラッシュで、これは表に書いてすらいませんでした。

## 先に確認しておいたほうがいい人

優先度が高いと感じた順に。

1. **CI で `-t` / `--testNamePattern` を使っている人**。マッチ0件でも終了コード 0 で緑になるので、テストが1件も走っていないことに気づけません。落ちてくれないぶん、他の項目より厄介だと思います。
2. `beforeAll` でモックを呼んで、テスト内で呼び出し履歴を検証している人。`clearMocks` 既定 true で履歴が消えます。
3. `vi.mock` / `vi.hoisted` を関数や `describe` の中で呼んでいる人。ファイルごと読み込み失敗になります。ただしこれは 4.1 でも警告が出ているので、いま検索すれば見つかります。

## 4.1 → 5 のチェックリスト

自分用に作ったものをそのまま置いておきます。

```
□ npm i が edgesOut エラーで落ちたら --legacy-peer-deps を付ける（npm 10.9.2 で発生）
□ Node.js は 22.12.0 以上か（node -v）
□ Vite は 6.4.0 以上か（npm ls vite）
□ expect(...).resolves / .rejects / toMatchFileSnapshot に await が付いているか
   → grep -rn "expect(.*)\.\(resolves\|rejects\)" test/ で洗い出す
□ beforeAll でモックを呼んで、テスト内で呼び出し履歴を検証していないか
   → clearMocks 既定 true で履歴が消える。旧挙動が要るなら config に clearMocks: false
     （--clearMocks という CLI フラグは存在しない）
□ CI で -t / --testNamePattern を使っていないか
   → 'suite test' を 'suite > test' に直す。マッチ0件でも終了コード0で緑になるので要注意
□ vi.mock / vi.unmock / vi.hoisted が関数・ブロック・describe/test の中にないか
   → トップレベルへ移動。4.1 の警告文をそのまま検索すると見つかる
□ test.sequential / describe.sequential を使っていないか
   → test('...', { concurrent: false }, fn) に置換
□ toThrow('') と書いている箇所はないか
   → 5 では任意のエラーに一致する。空メッセージ限定なら toThrow(/^$/)
□ VITEST_WORKER_ID を 0 始まり前提で使っていないか（配列添字・ポート採番など）
   → 5 では 1 始まり。VITEST_POOL_ID は 4.1 から既に 1 始まりなので変化なし
□ ログを機械パースしている場合、Duration の表示形式が絶対値→割合に変わっている
```

## おわりに

8項目を1つずつ踏んで、落ちた5項目は全部直せました。ただ、移行ガイドを読んでいるときに想像していた作業とは大分違いました。いちばん時間を使ったのは npm のインストールが謎の TypeError で落ちる件で、テストコードの修正自体は最後の数分で終わっています。

`.vitest/` の項目は再現できないまま残っています。ガイドに書いてあるのに出ない、というのが RC の実装途中なのか自分の触り方が足りないのか、判断できませんでした。安定版が出たらもう一度同じ fixture を流してみようと思います。

再現手順はこれです。

```bash
mkdir vitest5-check && cd vitest5-check
npm init -y
# package.json に "type": "module" と "scripts": { "test": "vitest run" } を追加
npm i -D vitest@4.1.10 vite
# test/*.test.ts に項目 A〜H を1項目1ファイルで作成
npx vitest run                       # → 全緑 (exit 0) をベースラインとして保存

npm i -D vitest@5.0.0-rc.1           # → edgesOut エラーで落ちる
npm i -D vitest@5.0.0-rc.1 --legacy-peer-deps   # → こちらで入る
npx vitest run                       # → 5 failed | 3 passed (exit 1)

# 移行ガイドどおりに修正
npx vitest run                       # → 全緑 (exit 0)

# 項目C の 2x2
npx vitest run test/c-filter.test.ts -t 'math adds'
npx vitest run test/c-filter.test.ts -t 'math > adds'
# 項目H（並列だと値がぶれるので単独 + 単一ワーカーで）
npx vitest run test/gh-env.test.ts --maxWorkers=1 --reporter=verbose
```

検証環境は macOS 26.5 (Darwin 25.5.0, arm64) / Node.js v22.17.0 / npm 10.9.2 / Vite 8.2.1、Vitest は 4.1.10 と 5.0.0-rc.1。検証日は 2026-08-17 です。すべて RC 時点の挙動なので、安定版では変わっているかもしれません。

## 参考リンク

https://main.vitest.dev/guide/migration

https://vitest.dev/guide/mocking/modules
