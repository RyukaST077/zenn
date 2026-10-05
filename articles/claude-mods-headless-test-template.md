---
title: "Claude Mods のテストをセッション抜きで回す最小テンプレートと、残った1つの穴"
emoji: "🧪"
type: "tech"
topics: ["claudecode", "aiagent", "cli", "typescript"]
published: false
---

<!-- 前提: 出典ログ logs/run-claude-mods-headless-test-template-20261003-0753/execution-log.md / 記事タイプ: 検証ログ（持ち帰りテンプレート付き） / published: false -->

## はじめに

Claude Mods の入門記事を読んで、`register.js` を書いて、`--plugin-dir` を付けて `claude` を立ち上げて、`/tally` を叩いて、閉じて、また直して……というのを何周かやりました。1行直すたびにこれをやるのがしんどくて、「このループ、どこまで自動化できるんだろう」と思ったのがこの記事のきっかけです。

Claude Code 2.1.287 には `claude plugin test` と `claude plugin validate` という、セッションを立ち上げずに mod を確かめるコマンドがあります。入門記事は「作って動かす」までで終わっていて、この2つにはほとんど触れていません。なので実際に最小の mod を1個書いて、8項目を手元で試しました。

結果から書くと、フック側のロジックはほぼ全部テストキットに乗せられました。描画（Spinner の差し替えや pane）は乗りません。そして1つだけ、ローカルで閉じていると思っていた前提が崩れました。mods のロードはサーバ側のスイッチに握られていて、検証の最中にそれを踏みました。これは今も直し方が分かっていません。

この記事に置くもの:

- コピーすればそのまま `claude plugin test` が通る mod 一式（7ファイル全文）
- サーフェス別に「フックが動くか・描画が出るか・テストで再現できるか」を埋めた表（実測と未検証をラベルで分けたもの）
- 試した8項目の出力全文と、詰まった5箇所

:::message
筆者は新人で、Claude Mods は触り始めたばかりです。実行環境は macOS Darwin 25.5.0 (arm64) / Node v22.17.0 / Claude Code 2.1.287（native installer）。手元の MacBook で一通り試した範囲の話で、Desktop アプリや VS Code 拡張は環境が無く踏めていません。
:::

## 環境構築でいきなり3回つまずいた

### `npm i -g` が空振りする

最初、バージョンを上げようとして `npm i -g @anthropic-ai/claude-code@latest` を打ったんですが、何も変わりませんでした。見てみたら、そもそも npm 経由で入っていませんでした。

```
=== npm ls -g @anthropic-ai/claude-code ===
/Users/<user>/.nvm/versions/node/v22.17.0/lib
└── (empty)
```

native installer で `~/.local/share/claude/versions/<version>` に入っていて、`~/.local/bin/claude` からシンボリックリンクが張られている形です。`ls -la $(command -v claude)` を先に見ていれば一発だったので、バージョンの話をする前にインストール方式を確かめる、というのをここで覚えました。更新は `claude update` です。

### 「2.1.287 以降が必須」は半分だけ正しかった

更新前の 2.1.284 では `claude plugin --help` の `Commands:` に `test` の行がありません。2.1.287 だと出ます。

```
  test [dir]                           Run a mod's tests
  validate [options] <path>            Validate a plugin or marketplace
```

これを見て「2.1.287 がバージョン境界だ」と判断したんですが、旧バイナリが `~/.local/share/claude/versions/2.1.284` に残っていたので直接叩いてみたら、サブコマンド自体は存在しました。help に出ないだけです。

```
claude plugin test: hooks modules are not turned on in this build yet (early access); set CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 to run a plugin's tests
```

言われたとおり `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1` を付けたら、2.1.284 でも 7 pass 0 fail で通りました。`--plugin-dir` でセッションにロードする側も同じで、環境変数なしだとこうなります。

```
first-mod: hooks module not loaded: hooks modules are not turned on for installed plugins in this process (early access: set CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 in its environment to load them); built-in plugins load regardless
first-mod registered /tally but no command.run hook answered it: add on("command.run", { command: "tally" }, ($, e) => ({ text: ... })) to the plugin.
```

環境変数を付けると `first-mod: Claude has made 0 tool calls since this mod loaded` に変わります。2.1.287 以降はこの変数を無視する、と公式にも書いてあるので、新しく始めるなら気にしなくていい話ではあります。ただ「help に無い＝機能が無い」と決めつけると、このあと出てくるもっと厄介な原因を見失います（実際に見失いました。後述）。

### 自分の環境で mods が動くかを1コマンドで判定する

空のディレクトリで `claude plugin test` を1回叩くだけで、mods がロードできる状態かが分かります。

```bash
cd "$(mktemp -d)" && claude plugin test; echo "exit=$?"
```

```
claude plugin test: /private/var/folders/.../tmp.rLJqidZomG: no hooks module to load; there is no hooks/hooks.json naming one in "modules"
exit=1
```

`no hooks module to load` は「mods は使える。ただしこのディレクトリに mod が無い」という意味なので、これが出れば OK です。ここで出うるメッセージには他に `hooks modules are turned off here (disableAllHooks ...)` 系（設定で止まっている）と `the rollout switch served off`（サーバ側で止まっている）があって、後者が今回の一番の落とし穴でした。

## 最小 mod テンプレート（本体3ファイル）

テスト対象として、入門記事の例を少し広げた mod を1個書きました。ツール呼び出しを数えて `/tally` で報告し、Spinner に件数を出し、`rm -rf` を含む Bash を拒否し、モデルに採点させる `/grade` と、タイマーを使う `/countdown` を持っています。この5つで、テストしたい種類のフックが一通り入ります。

ビルドは要りません。`npm install` も `tsc` も走らせていない状態で `.js` がそのまま動きます。

```json:first-mod/.claude-plugin/plugin.json
{
  "name": "first-mod",
  "version": "0.1.0",
  "description": "Counts Claude's tool calls, shows the count beside the spinner, and adds a /tally command",
  "author": { "name": "RyukaST077" }
}
```

```json:first-mod/hooks/hooks.json
{
  "description": "The first-mod hooks module",
  "modules": ["./register.js"]
}
```

```js:first-mod/hooks/register.js
// The count, shared by the hooks below
let calls = 0

// Claude Code calls this once when the mod loads
export function register(on) {
  // Runs when the session starts, before your first prompt
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'tally',
      description: 'Show how many tool calls Claude has made',
    })
    await $.command.register({
      name: 'grade',
      description: 'Grade a sentence with a model',
    })
    await $.command.register({
      name: 'countdown',
      description: 'Count down N seconds and toast at zero',
    })
    $.ui.log('first-mod: session.start hook ran', { to: 'debug' })
    return next(e)
  })

  // Runs each time Claude is about to use a tool: counts it
  on('tool.call', async ($, e, next) => {
    calls += 1
    $.ui.log('first-mod: tool.call #' + calls + ' tool=' + e.tool, { to: 'debug' })
    // Ask Claude Code to draw the interface again, so the new count shows
    $.ui.invalidate('ui.render')
    // Let the tool run as usual
    return next(e)
  })

  // Guard: refuse a Bash call that contains rm -rf
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    if (typeof e.command === 'string' && e.command.includes('rm -rf')) {
      return { deny: 'first-mod: rm -rf is not allowed' }
    }
    return next(e)
  })

  // Runs when you type /tally, and only then, because of the matcher
  on('command.run', { command: 'tally' }, async () => {
    return { text: 'Claude has made ' + calls + ' tool calls since this mod loaded' }
  })

  // /grade: send the sentence to a model and report whether it starts with PASS
  on('command.run', { command: 'grade' }, async ($, e) => {
    const reply = await $.model.complete({
      model: 'haiku',
      system: 'Grade the sentence. Start your reply with PASS or FAIL.',
      prompt: e.args,
    })
    const passed = reply.isAnswered && reply.text.startsWith('PASS')
    return { text: passed ? 'Passed' : 'Try again' }
  })

  // /countdown N: tick once a second and toast at zero
  on('command.run', { command: 'countdown' }, async ($, e) => {
    let left = Number(e.args)
    const timer = $.clock.every(1000, () => {
      left -= 1
      if (left === 0) {
        timer.cancel()
        $.ui.toast('Time is up')
      }
    })
    return {}
  })

  // Runs each time Claude Code draws the spinner
  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    return next({ ...e, props: { ...e.props, suffix: ' · tool calls: ' + calls + '…' } })
  })
}
```

ロードの確認は1往復で済みます。

```bash
claude -p "/tally" --plugin-dir ./first-mod --debug-file ./mod-debug.log
```

```
first-mod: Claude has made 0 tool calls since this mod loaded
exit=0
elapsed=2s
```

公式ドキュメントの期待出力と一字一句同じでした。debug log 側にはロードの詳細が出ます（ホームディレクトリはマスクしています）。

```
[DEBUG] hooks module first-mod@inline loaded (worker, environment 2, tier user); events: session.start,tool.call,command.run,ui.render
[DEBUG] plugin.register: first-mod (user, first-mod@inline), judged by cc-plugin-sec-default: admitted
[DEBUG] type root of first-mod at <REPO>/.../first-mod/.claude-plugin/types: entries claude-code, claude-code-tools, claude-code-mcp; wrote .claude-plugin/types/claude-code/index.d.ts, ...
[DEBUG] $.command.register (first-mod): /tally listed
[DEBUG] [first-mod] $.ui.log (to debug): first-mod: session.start hook ran
[DEBUG] hooks module first-mod@inline session.start settled in 7.3ms (worker hop, next() included)
```

この行で気づいたんですが、`--plugin-dir` でロードすると `.claude-plugin/types/claude-code/index.d.ts` が自動生成されます。14,916 行ありました。このあと `$.tool.call` の仕様で迷ったとき、公式ページより先にこのファイルを読んで解決したので、1回はセッションにロードして型定義を出しておく価値があります。

なお `claude plugin test` のほうは型定義を生成しません。生成するのは `--plugin-dir` でロードしたときだけなので、配布物に `.claude-plugin/types/` を含める必要はありません（公式も `.gitignore` を一緒に置いてくれます）。

## 実行せずに素性を読む：`claude plugin validate`

`claude plugin validate ./first-mod` は、コードを実行せずに `register.js` を静的に読んで「何のイベントを取るか」「`$` の何を呼ぶか」を列挙します。

```
  ❯ ./register.js hooks: session.start, tool.call, tool.call{tool=Bash}, command.run{command=tally}, command.run{command=grade}, command.run{command=countdown}, ui.render{component=Spinner}
  ❯ ./register.js calls: $.clock.every, $.command.register, $.model.complete, $.ui.invalidate, $.ui.log, $.ui.toast
✔ Validation passed
exit=0
```

`calls:` の行が思ったより使えます。「この mod は何に手を伸ばすか」の一覧なので、他人の mod を入れる前にこれだけ見れば、モデルを呼ぶのか・ネットワークに出るのか・何を書き換えるのかの当たりが付きます。

静的解析のルールを故意に破ると、こういうエラーが出ます。

| 破ったルール | エラー文言 |
|---|---|
| `on('tool.calls', ...)`（綴り違い） | `register.js:25: "tool.calls" is not an event; $ is always spelled $.noun.event(...) at the call site, on is always on("<event>", hook), and next.to always next.to(e, "<tier>")` |
| `on(EVENT, ...)`（変数） | `register.js:8: the event name passed to on() is not a string literal; $ is always spelled $.noun.event(...) at the call site, on is always on("<event>", hook), and next.to always next.to(e, "<tier>")` |
| `const ui = $.ui`（フック内） | `register.js:26: $.ui is used as a value (a noun of $ bound, passed or read); $ is always spelled $.noun.event(...) at the call site, on is always on("<event>", hook), and next.to always next.to(e, "<tier…` |
| `const on = 1`（シャドウ） | `register.js does not parse: Identifier 'on' has already been declared (6:8)` |
| `import('./other.js')`（動的 import） | `register.js:6: a dynamic import(); a hooks module imports its own files with an import declaration, as in import { name } from "./file.js"; ...` |

3つ目で1回つまずきました。公式に「`const ui = $.ui` は落ちる」と書いてあるので試そうとして、`register()` の直下（フックの外）に書いたんですが、`✔ Validation passed` で通ってしまいました。しばらく「公式と違うぞ」と悩んだんですが、`$` はフックの引数なので、フックの外に書いた `$` は静的解析から見ればただの未定義識別子で、mods API とは見なされていなかっただけでした。フックの中に移したら、ちゃんと公式どおりのエラーが出ました。公式の一文を自分で確かめるときは、どのスコープの話なのかまで読む必要があります。

## `claude plugin test` を8項目で試す

テストは `tests/*.test.ts` に置きます。4ファイル書いて、素の実行がこうなりました。

```
tests/clock.test.ts:
(pass) the countdown ends with a toast [21.27ms]

tests/first-mod.test.ts:
(pass) /tally reports the tool calls the mod has seen [19.07ms]
(pass) session.start registers the three commands [9.03ms]

tests/guard.test.ts:
(pass) the guard refuses a Bash call that contains rm -rf [19.08ms]
(pass) the guard lets a harmless Bash call through [9.41ms]

tests/model.test.ts:
(pass) a passing grade is reported [18.49ms]
(pass) a failing grade is reported [9.14ms]

 7 pass
 0 fail
Ran 7 tests across 4 files. [0.21s]
exit=0
```

### カウントと `session.start` のテスト

`/tally` のテストで引っかかったのが、`session.start` はテストキットでは自動では走らないことです。テストの中で `$.session.start(...)` を明示的に呼ばないと、コマンドの登録が走りません。

```ts:first-mod/tests/first-mod.test.ts
import { expect, test } from 'claude-code/testing'

test('/tally reports the tool calls the mod has seen', async ($, on) => {
  // The counting hook writes to the debug log, so that call needs a stub too
  on('ui.log', () => ({ value: undefined }))
  // Answer each tool call in Claude Code's place, so no tool runs
  on('tool.call', () => ({ result: 'ok' }))

  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await $.tool.call({ tool: 'Read', file_path: 'README.md' })

  const answer = await $.command.run({ command: 'tally', args: '' })
  expect(answer.text).toBe('Claude has made 2 tool calls since this mod loaded')
})

test('session.start registers the three commands', async ($, on) => {
  const registered: string[] = []
  on('ui.log', () => ({ value: undefined }))
  on('command.register', ($, e) => {
    registered.push(e.name)
    return { value: undefined }
  })
  on('session.start', () => ({ cwd: '/work' }))

  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  expect(registered).toEqual(['tally', 'grade', 'countdown'])
})
```

### サインイン無し・ネットワーク遮断で通るか

公式は「no session, sign-in, or network」と言っています。`sudo` 無しで再現できる範囲で近似して、4条件で比べました。

| 条件 | コマンド | 結果 | 全体時間 |
|---|---|---|---|
| 素 | `claude plugin test` | 7 pass 0 fail / `exit=0` | 0.21s |
| ネットワーク遮断相当 | `ANTHROPIC_BASE_URL=http://127.0.0.1:1 HTTPS_PROXY=http://127.0.0.1:1 HTTP_PROXY=http://127.0.0.1:1 claude plugin test` | 7 pass 0 fail / `exit=0` | 0.20s |
| サインイン無し相当 | `CLAUDE_CONFIG_DIR=$(mktemp -d) claude plugin test` | 7 pass 0 fail / `exit=0` | 0.19s |
| 両方同時 | 上の2つを合わせる | 7 pass 0 fail / `exit=0` | 0.19s |

ここは正直に書いておきたいんですが、これは OS レベルの遮断ではなく、死にポートに向けた proxy による近似です。しかも後述のロールアウトスイッチを踏んだので、「本当にネットワークと無関係か」までは言い切れません。この近似条件では再現できた、というところまでが実測で言えることです。

公式の例は1テストで `[0.19s]` でした。こちらは7テスト4ファイルで `[0.21s]`。テストが増えてもほとんど変わらないのは、ファイルごとの子プロセス起動が支配的だからだと思います。

### `$.model.complete` を stub してモデルを呼ばずにテストする

`/grade` はモデルに投げるコマンドなので、素直にテストすると課金が発生します。`on('model.complete', ...)` で答えを固定すれば、モデルには届きません。

```ts:first-mod/tests/model.test.ts
import { expect, test } from 'claude-code/testing'

const USAGE = {
  input_tokens: 10,
  output_tokens: 5,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0,
}

test('a passing grade is reported', async ($, on) => {
  // Answer the mod's $.model.complete call with a fixed reply, so no model runs
  on('model.complete', () => ({
    value: { isAnswered: true, text: 'PASS\nNice sentence.', usage: USAGE },
  }))

  const answer = await $.command.run({ command: 'grade', args: 'The cat sat on the mat.' })
  expect(answer.text).toBe('Passed')
})

test('a failing grade is reported', async ($, on) => {
  on('model.complete', () => ({
    value: { isAnswered: true, text: 'FAIL\nTry a verb.', usage: USAGE },
  }))

  const answer = await $.command.run({ command: 'grade', args: 'cat mat' })
  expect(answer.text).toBe('Try again')
})
```

「本当にモデルを呼んでいない」ことの根拠は2つ。stub が答えるので実装まで到達しないのと、死にポート proxy を向けた環境でも同じく pass することです（ネットワークに出ていれば落ちるはず）。

stub の形を間違えるとこうなります。`{ value: ... }` で包まずに生の値を返したケース:

```
tests/stub-a.test.ts:
(fail) A: a mods API stub that returns a bare value [16.58ms]
  HooksError: no implementation for command.run

  nothing beneath the plugins answers command.run: a test answers it with on('command.run', ...)

  the engine reported:
    test's model.complete hook was skipped: test: returned neither { value } nor { deny }
    first-mod's command.run hook was skipped: first-mod: HooksError: no implementation for model.complete

 0 pass
 1 fail
Ran 1 test across 1 file. [0.16s]
exit=1
```

mods API（`$.model.complete` のような呼び出し）の stub は `{ value }` で包む、イベント（`tool.call` など）の stub はそのイベントの結果をそのまま返す、という2種類のルールがあります。

### `mock.clock` でタイマーを実時間待たずにテストする

`/countdown 3` は 3 秒かかるコマンドですが、`mock.clock(on)` でテスト側が時計を握ると 21.27ms で検証できました。実時間待ちと比べて 140 倍くらいです。

```ts:first-mod/tests/clock.test.ts
import { expect, mock, test } from 'claude-code/testing'

test('the countdown ends with a toast', async ($, on) => {
  // Answer every $.clock call from a clock the test controls
  const clock = mock.clock(on)
  const toasts: string[] = []
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })

  await $.command.run({ command: 'countdown', args: '3' })
  await clock.advance(2000)
  expect(toasts).toEqual([])
  await clock.advance(1000)
  expect(toasts).toEqual(['Time is up'])
})
```

`mock.clock(on)` を書き忘れると、トップのアサーションだけ見ても原因が分かりません。

```
tests/stub-c.test.ts:
(fail) C: the countdown without mock.clock [16.63ms]
  AssertionError: expect(received).toEqual()

  Expected: ["Time is up"]
  Received: []

  the engine reported:
    first-mod: $.clock.every refused: no implementation for clock.every
```

本当の原因は `the engine reported:` ブロックの中だけに出ます。上だけ読んで「タイマーが動いてない」と誤読しかけました。

### `{ deny: reason }` のガードをテストで再現する

`tool.call` で `{ deny: '...' }` を返すガードが、テスト側からどう見えるのかが分かりませんでした。例外として throw されるのか、返り値として返るのか、公式の stub 表には書いていません。

調べ方として、わざと落ちるテストを1本書いて `Received:` に実物を出させました。

```
(fail) probe: what a denied tool call looks like [18.07ms]
  AssertionError: expect(received).toBe()

  Expected: "__SHOW_ME__"
  Received: "resolved: {\"deny\":\"first-mod: rm -rf is not allowed\"}"
```

reject ではなく、`{ deny: "..." }` に解決していました。try/catch で待ち構えていたら永久に通らないやつです。分かってしまえば2本で済みます。

```ts:first-mod/tests/guard.test.ts
import { expect, test } from 'claude-code/testing'

test('the guard refuses a Bash call that contains rm -rf', async ($, on) => {
  on('ui.log', () => ({ value: undefined }))
  // If the guard let it through, this stub would answer instead of the deny
  on('tool.call', () => ({ result: 'ok' }))

  const out = await $.tool.call({ tool: 'Bash', command: 'rm -rf /tmp/x' })
  expect(out).toEqual({ deny: 'first-mod: rm -rf is not allowed' })
})

test('the guard lets a harmless Bash call through', async ($, on) => {
  on('ui.log', () => ({ value: undefined }))
  on('tool.call', () => ({ result: 'ok' }))

  const out = await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect(out).toEqual({ result: 'ok' })
})
```

テストキットはツールを実行しないので（stub が答える）、`rm -rf /tmp/x` という文字列が流れただけで実際のコマンドは1度も走っていません。

### 失敗時の終了コードと、CI ゲートに使えるか

ガードのテストの期待値を1文字壊して、終了コードを見ました。

```bash
claude plugin test; echo "exit=$?"                       # => exit=0
sed -i '' "s/rm -rf is not allowed/WRONG MESSAGE/" tests/guard.test.ts
claude plugin test; echo "exit=$?"                       # => exit=1
cp /tmp/guard.bak tests/guard.test.ts                    # 復元
claude plugin test; echo "exit=$?"                       # => exit=0
```

```
tests/guard.test.ts:
(fail) the guard refuses a Bash call that contains rm -rf [19.76ms]
  AssertionError: expect(received).toEqual()

  Expected: { deny: "first-mod: WRONG MESSAGE" }
  Received: { deny: "first-mod: rm -rf is not allowed" }
(pass) the guard lets a harmless Bash call through [8.91ms]
...
 6 pass
 1 fail
Ran 7 tests across 4 files. [0.20s]
exit=1
```

`test()` が1つも無い `.test.ts` を置いた場合も `exit=1` でした。

```
tests/stub-e.test.ts:
(fail) the file did not load
  it declares no test(): nothing ran

 0 pass
 1 fail
Ran 1 test across 1 file. [0.14s]
exit=1
```

終了コードとしては CI に入れられます。ただし、スイッチが off のときは `claude plugin test` 自体が走りません（今回 off を踏めたのは `claude -p` 側だけで、`claude plugin test` 側の終了コードは実測できていません）。終了コードだけで「テストが落ちた」と「mods が止められた」を区別する設計にはしないほうが安全です。

2.1.287 のバイナリには `claude plugin test` 専用の文言が入っていて、CI で grep するならこれが使えます。

```
hooks modules are turned off in this process: the rollout switch served off, and a plugin's tests run only while it is on
```

CI では終了コードに加えて、出力に `turned off` / `rollout switch` が含まれるかを別途見たほうがよさそうです。

## `claude -p` では何が動いて、何が動かないか

テストキットの外、非対話の `claude -p` でも mod は動きます。ただし描画は出ません。

```bash
claude -p "list the files in ./first-mod and read ./first-mod/hooks/hooks.json" \
  --plugin-dir ./first-mod --debug-file ../logs/mod-debug-headless.log
```

```
102: [DEBUG] hooks module first-mod@inline loaded (worker, environment 2, tier user); events: session.start,tool.call,command.run,ui.render
178: [DEBUG] [first-mod] $.ui.log (to debug): first-mod: session.start hook ran
189: [DEBUG] hooks module first-mod@inline session.start settled in 10.0ms (worker hop, next() included)
591: [DEBUG] [first-mod] $.ui.log (to debug): first-mod: tool.call #1 tool=Bash
624: [DEBUG] hooks module first-mod@inline tool.call settled in 867.5ms (worker hop, next() included)

=== count of first-mod tool.call debug lines ===  1
=== any ui.render dispatch to first-mod? ===      0
=== the spinner suffix string in the -p stdout? === 0
```

`session.start` と `tool.call` は確実に発火していて、`ui.render` は一度も dispatch されず、Spinner の suffix 文字列も stdout に現れませんでした。

フックが動いた証拠をどう取るかで最初に迷ったんですが、答えは `$.ui.log(..., { to: 'debug' })` と `--debug-file` の組み合わせでした。`--debug-file` を付けないと何も残りません。`/tally` のカウントで確かめようとしたのは失敗で、`-p` は毎回別プロセスなので何度叩いても `0 tool calls` のままです。

## 詰まった点：数分前まで通っていたコマンドが、突然落ちた

ここが今回いちばん時間を取られたところです。`claude -p` の検証をしている途中で、こういうエラーが出ました。

```
first-mod: hooks module not loaded: hooks modules are turned off for installed plugins in this process: the rollout switch served off; built-in plugins load regardless
```

数分前まで同じコマンドが通っていたのに、です。設定を変えた覚えも、バージョンを変えた覚えもありません。`the rollout switch served off` という文字列が手がかりだったので `strings` でバイナリを引いたら、2.1.287 のバイナリにそのまま入っていました。公式ドキュメントにも "Unless Anthropic has turned installed mods off remotely" という形で1箇所だけ書かれています。

つまり mods のロードは、ローカルの設定でもバージョンでもなく、サーバ側のスイッチに握られています。環境変数でも設定ファイルでも開けられません（2.1.287 は `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS` を無視します）。8分ほど待っていたら on に戻って、直後に10回連続でプローブしたら全部成功しました。何がトリガで off になるのか、アカウント単位なのかプロセス単位なのか時間帯なのかは、今も分かっていません。回避策も見つかっていません。

そして、これで前半の謎が解けました。2.1.284 の `claude plugin test` が、一度は 7 pass したのにその直後から `hooks modules are not turned on in this build yet (early access)` で落ち続けていたのも、同じスイッチが原因でした。2.1.284 のバイナリにも `overridden by the CLAUDE_CODE_ENABLE_FUNCTION_HOOKS environment variable` という文字列があります。環境変数はスイッチの上書きにすぎず、「2.1.284 だから落ちた」のではなかったわけです。スイッチが on に戻った時刻に 2.1.284 で3回続けて走らせたら、環境変数なしで全部 7 pass しました。

「バージョンが境界だ」という最初の思い込みで、だいぶ遠回りしました。`strings` でバイナリのメッセージを引いたのが抜け道でした。

## もう1つ：green なのに stub が足りていなかった

`$.ui.log` の stub を書き忘れたまま、テストが pass していた時期があります。気づけませんでした。

`$.ui.log` は `await` しない fire-and-forget な呼び出しなので、stub が無くて失敗してもフックは止まらず、「dropped」扱いで先に進みます。しかもその報告が出る `the engine reported:` ブロックは、テストが失敗したときしか表示されません。green のときは何も言ってくれません。

アサーションをわざと壊して engine report を出させたら、こう出ていました。

```
[first-mod] $.ui.log dropped: HooksError: no implementation for ui.log
```

これに懲りて、今は書いたテストを一度わざと落として engine report を読む、というのをやるようにしています。green の裏で何が落ちているか、それ以外に見る方法が見つかりませんでした。

## 3つの手段の使い分け

同じ mod に対して、3つの確かめ方を3回ずつ測りました。

| 手段 | 平均 | 捕まえられないもの |
|---|---|---|
| `claude plugin test` | 315ms | 実際の描画の見た目・色・折り返し。実セッションでの他 mod との相互作用 |
| `claude plugin validate` | 636ms | 実行時の挙動すべて（フックの中身は読まない。`hooks:` 行が出ても呼ばれるとは限らない） |
| `claude -p "/tally"`（セッション1往復の最小値） | 1477ms | 「コマンドが答えるか」だけ。実際に目視するなら本物のプロンプトを打つことになり、今回は11秒かかった |

意外だったのは、7テスト走る `claude plugin test` のほうが、静的解析だけの `claude plugin validate` より2倍速いことです。validate は manifest の検証も回しているぶん重いみたいです。

ループの長さで言うと、11秒 → 0.3秒 になりました。これが元々やりたかったことなので、ここは素直に効きました。

## 持ち帰り：サーフェス別の判断表

どこまでテストキットに乗せて、どこを実セッションでの目視に残すかの表です。手元で実際にコマンドを叩いた行と、環境が無くて公式の記載をそのまま引いただけの行をラベルで分けています。

| サーフェス | フックが動くか | 描画が出るか | `claude plugin test` で再現できるか | 実セッションでしか確かめられないこと | ラベル |
|---|---|---|---|---|---|
| `claude plugin test`（テストキット） | Yes（`session.start` は自動では走らない。`$.session.start` を明示発火する） | 描画は「ツリーの検証」まで。実際の塗りは見ない | — | 端末での見た目・色・折り返し・実際のレイアウト | 実測 |
| `claude -p` / Agent SDK | Yes。`session.start` と `tool.call` が発火し、`$.ui.log(..., { to: 'debug' })` が `--debug-file` に出る | No。`ui.render` は1回も dispatch されず、Spinner の suffix は stdout に現れない | ほぼ Yes（フック側のロジックは全部テストで再現できる） | 描画が無いので「見た目」は原理的に確認できない | 実測 |
| `claude` を端末で対話起動 | Yes | Yes | 描画ツリーは `$.ui.mount` で再現可。実際の塗りは不可 | Spinner / pane の実際の見た目、キー操作の体感、ホットリロードの挙動 | 未検証（公式記載のみ） |
| Desktop アプリの Code タブ | Yes | Yes（elements 表で terminal-only とされた要素を除く） | `$.ui.mount({ surface: 'desktop' })` でツリーは再現可 | terminal-only 要素のフォールバックが実際にどう見えるか | 未検証（公式記載のみ） |
| Desktop アプリの WSL セッション | No（WSL セッションではプラグインが使えない） | No | 再現しても意味が無い（そもそもロードされない） | 「ロードされない」こと自体 | 未検証（公式記載のみ） |
| VS Code 拡張のチャットパネル | Yes | No | フック側は Yes | 描画が無い前提でのフォールバック動作 | 未検証（公式記載のみ） |
| Remote Control（claude.ai / モバイル） | Yes（手元のマシン上のセッションで） | 手元のマシンの端末に出る | フック側は Yes | リモート操作時の実際の見え方 | 未検証（公式記載のみ） |
| クラウドセッション（Claude Code on the web） | Yes（クラウドに届くプラグインの場合） | No | フック側は Yes | プラグインがクラウドに届くかどうか | 未検証（公式記載のみ） |

この表に収まらなかった前提が1つあります。サーフェス以前の問題として、mods のロード自体がサーバ側のロールアウトスイッチに握られていて、どのサーフェスでも落ちうる、ということです。公式の "Where mods run" の表には出てきません。

## 配れる形になっているか

生成物（`.claude-plugin/types/` と `tsconfig.json`）を除いた7ファイルだけを別ディレクトリにコピーして、そこで validate と test を走らせました。

```
--- claude plugin validate ---
  ❯ ./register.js hooks: session.start, tool.call, tool.call{tool=Bash}, ...
✔ Validation passed
--- claude plugin test ---
 7 pass
 0 fail
Ran 7 tests across 4 files. [0.20s]
exit=0
```

`grep -rn "/Users/"` は0件で、絶対パス依存もありませんでした。この7ファイルをそのままコピーして始められます。

## 最短の再現手順

```bash
# 0) mods が動く環境かを1コマンドで判定する
cd "$(mktemp -d)" && claude plugin test
#    no hooks module to load  -> OK
#    the rollout switch served off -> 今は使えない（待つしかない）
#    disableAllHooks / allowManagedHooksOnly -> 設定で止まっている

# 1) 3ファイルを作る
mkdir -p first-mod/.claude-plugin first-mod/hooks first-mod/tests
#    plugin.json / hooks/hooks.json / hooks/register.js

# 2) 実行せずに素性を見る
claude plugin validate ./first-mod

# 3) セッションを立てずにテストする
cd first-mod && claude plugin test; echo "exit=$?"

# 4) ロードまで確かめたいときだけセッションを1往復させる
cd .. && claude -p "/tally" --plugin-dir ./first-mod --debug-file ./mod-debug.log
```

踏んでおいたほうがいい注意点:

- テストキットのルールは3つ。stub は `$` の最初の呼び出しより前に全部登録する／mods API の stub は `{ value }` で包み、イベントの stub はそのイベントの結果を返す／`session.start` は自動では走らない
- `$.ui.log` のように `await` しない呼び出しは、stub が無くてもテストを落とさない
- `claude plugin test` は型定義を生成しない。型が欲しければ1回 `--plugin-dir` でロードする
- 2.1.287 以降は `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS` を無視する（2.1.284 までは上書きとして効く）
- `--debug-file` のログには絶対パスや環境情報が含まれる。記事やイシューに貼る前にマスクする

## まとめ

やりたかった「1行直すたびにセッションを立ち上げ直すループ」は、だいたい潰せました。フック側のロジック（コマンド、ツールのガード、モデル呼び出し、タイマー）は全部テストキットに乗って、11秒が0.3秒になりました。描画は乗らないので、Spinner や pane の見た目は結局セッションで見るしかありません。`$.ui.mount` でツリーの検証まではできるようですが、そこは今回触っていません。

公式の「no session, sign-in, or network」は、手元で作れる近似の範囲では再現できました。ただし「ローカルで完結している」とは言い切れません。ロールアウトスイッチの件があるからです。CI に `claude plugin test` を入れるなら、落ちたときに「テストが失敗した」のか「mods が止まっている」のかを出力の文字列で見分ける仕組みを一緒に入れておかないと、原因不明の赤を食らうことになると思います。

スイッチの発火条件は分からないままです。何か分かったら追記します。

## 参考リンク

- [Mods overview — Claude Code Docs](https://code.claude.com/docs/en/plugins/mods/overview)
- [Where mods run](https://code.claude.com/docs/en/plugins/mods/overview#where-mods-run)
- [Create a mod](https://code.claude.com/docs/en/plugins/mods/create)
