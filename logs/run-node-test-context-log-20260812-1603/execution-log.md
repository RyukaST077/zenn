# 検証ログ: node:test の `context.log()` と `test:log` イベントで「このログはどのテストのものか」を取り戻す

> Zenn記事の素材。実行の一次情報（コマンド・エラー全文・所要時間・出力ファイル）を記録。
> 記事本文は未執筆。「記事への写像」を見て articles/*.md に展開する。

## 実行の前提（採用した前提）

- 対象タスク: `practice/practice-node-test-context-log-20260812-1600.md`（引数で明示指定）
- 出典レポート: `research/search-topic-20260812-1553.md`
- 対象技術: Node.js v26.6.0 で追加された `context.log(message[, data])` と `test:log` イベント（PR #64389 / SEMVER-MINOR）
- 実行者: AIエージェント単独（非対話） <!-- 内部メタ: 記事に転記しない -->
- 実行日時 / 所要時間: 2026-08-12 16:03〜16:08 JST / 見積もり 235分（約3h55m）→ 実測 約5分（AI単独の壁時計値） <!-- 実測はAI単独の値。記事にそのまま書かない -->
- 実行環境: macOS 26.5 / arm64 (Apple Silicon) / Node.js **v26.7.0**（本命）と **v26.5.0**（機能なしの対照）。追加依存パッケージ **ゼロ**
- 採用した撤退ライン: 対象タスク記載のもの（カスタム reporter が45分動かなければ tap テキスト読みに切替 / `entryFile` 調査は20分で切り上げ）。いずれも**発動せず**
- 判断方針: 引数は対象タスクファイルのパスのみ。実行時間・撤退ライン・成果物置き場は未指定のためデフォルト（対象タスクの想定時間、対象タスクの撤退ライン、`logs/run-<slug>-<日時>/workspace/`）を採用
- ブラウザ確認: **不要**（CLI と JSON ダンプのみで完了条件を判定できるため Playwright は未使用。スクショ 0 枚）
- 環境上の制約: `TaskCreate`（タスク管理ツール）が `ENOENT: .../\.claude/tasks/<id>/.lock` で使えず、ディレクトリ作成も `Operation not permitted` だったため、タスク管理は本ログ内のチェックリストで代替した（検証内容には影響なし）

## 結果サマリー

- 完了条件の判定: **達成**（4条件すべて客観的根拠つきで充足。詳細は下表）
- 作ったもの: 依存ゼロの最小 Node プロジェクト。3種ログを並べた `probe.test.mjs`、帰属検証用のテスト6本、自作 reporter 3本（`dump` / `inspect` / `group`）、出力全文 16ファイル
  - `logs/run-node-test-context-log-20260812-1603/workspace/`
- スクショ: 0 枚（CLI 検証のためブラウザ確認なし。`screenshots/` は空）
- 詰まった点: 6 件（うち解決 5 / 未解決・仕様として記録 1）
- knowledge 記録: なし（後述の通り「新規の環境トラブル」ではなく検証対象そのものの挙動だったため）

## 完了条件の検証

| # | 完了条件 | 判定 | 根拠 |
|---|---|---|---|
| 1 | `results/` に spec / tap / dot の3 reporter × 3種ログの出力全文が保存されている | 達成 | `results/reporter-spec.txt` / `reporter-tap.txt` / `reporter-dot.txt` |
| 2 | カスタム reporter の JSON ダンプで、`test:log` に `name` / `testId` / `parentId` があり `test:diagnostic` には無いことが自分の実行結果として示されている | 達成 | `results/events.jsonl`（76行）を `field-diff.mjs` で機械集計 → `results/field-diff.md` |
| 3 | 並行実行・サブテスト・失敗テストの3パターンでログの帰属先を示した比較表が埋まっている | 達成 | `results/attribution.md`（tree/suite の表）、`results/concurrency.txt`（並行実行の before/after） |
| 4 | Node 26.5.0 で `t.log()` を呼んだ失敗ログ（`TypeError`）が保存されている | 達成 | `results/fail-26.5.txt` |

## タスク実行ログ（フェーズ別）

### フェーズ1: 事前調査（見積もり 30分 → 実測 約2分）

- [x] v26.6.0 のリリースノートで該当コミットと SEMVER-MINOR 表記を確認
  - 実行したコマンド:
    ```bash
    curl -sS https://raw.githubusercontent.com/nodejs/node/main/doc/changelogs/CHANGELOG_V26.md -o /tmp/chg26.md
    grep -n "64389" /tmp/chg26.md
    ```
  - 出力（該当箇所・全文）:
    ```
    ## 2026-08-03, Version 26.6.0 (Current), @aduh95

    ### Notable Changes

    * \[[`5a36018abc`](https://github.com/nodejs/node/commit/5a36018abc)] - **doc**: add MikeMcC399 as collaborator (Mike McCready) [#64656](https://github.com/nodejs/node/pull/64656)
    * \[[`9b04f82d7b`](https://github.com/nodejs/node/commit/9b04f82d7b)] - **(SEMVER-MINOR)** **ffi**: add `getCurrentEventLoop` (Paolo Insogna) [#64323](https://github.com/nodejs/node/pull/64323)
    * \[[`bb51f2c960`](https://github.com/nodejs/node/commit/bb51f2c960)] - **(SEMVER-MINOR)** **test\_runner**: add `context.log()` and `test:log` event (Moshe Atlow) [#64389](https://github.com/nodejs/node/pull/64389)
    * \[[`56ce83b3ee`](https://github.com/nodejs/node/commit/56ce83b3ee)] - **(SEMVER-MINOR)** **test\_runner**: report `entryFile` in `TestStream` events (Moshe Atlow) [#64309](https://github.com/nodejs/node/pull/64309)
    ```
  - 記事に書きたい気づき: **v26.6.0 の Notable Changes 4件のうち2件が test_runner**（`context.log()` と `entryFile`）。しかも同じ作者（Moshe Atlow）。「テストログ周りが一度にまとめて強化されたリリース」という文脈で書ける。

- [x] 公式 API ドキュメントの `context.log(message[, data])` / `Event: 'test:log'` を verbatim 引用
  - 実行したコマンド:
    ```bash
    curl -sS https://raw.githubusercontent.com/nodejs/node/v26.7.0/doc/api/test.md -o /tmp/test-doc.md
    grep -n "context.log\|test:log" /tmp/test-doc.md
    ```
  - 出力（doc/api/test.md @ v26.7.0 より verbatim。全文は `results/doc-excerpts.md`）:
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
    ```
    | Declaration ordered (buffered) | Execution ordered (immediate)                         |
    | ------------------------------ | ----------------------------------------------------- |
    | [`'test:start'`][]             | [`'test:enqueue'`][] followed by [`'test:dequeue'`][] |
    | [`'test:pass'`][]              | [`'test:complete'`][] (`details.passed` is `true`)    |
    | [`'test:fail'`][]              | [`'test:complete'`][] (`details.passed` is `false`)   |
    | [`'test:plan'`][]              |                                                       |
    | [`'test:diagnostic'`][]        |                                                       |
    |                                | [`'test:log'`][]                                      |

    [`'test:log'`][] is deliberately execution ordered only: it is the live
    counterpart of [`'test:diagnostic'`][]'s buffered reporting.
    ```
  - **対象タスクで「要確認」だった stability 表記の答え**: `context.log` のセクションに **Stability 表記は無い**（YAML ブロックは `added: v26.6.0` のみ）。同じ `test.md` 内で `context.tags` には `> Stability: 1.0 - Early development` が付いており、**付くものには付いている**。したがって `context.log` はモジュール冒頭の `> Stability: 2 - Stable` を継承する扱い。→ **Experimental ではない**と実物で言い切れる。
  - つまずいた理由・分かっていなかった前提: 「新しい API＝Experimental だろう」と思い込んでいた。実際は `test_runner` 本体が Stable なので、個別表記が無いものは Stable 扱いになる。
  - 記事に書きたい気づき: ★ **`data` の説明に「When tests run with process isolation, this value must be compatible with the HTML structured clone algorithm」という制約が明記されている。**これが後のフェーズ3で実際に事故る（関数を渡すとテストファイルごと落ちる）。

- [x] PR #64389 本文を読み、設計意図をまとめる
  - 実行したコマンド:
    ```bash
    curl -sS "https://api.github.com/repos/nodejs/node/pulls/64389" -o /tmp/pr64389.json
    node -e "const p=require('/tmp/pr64389.json'); console.log(p.title, p.merged_at, p.labels.map(l=>l.name).join(',')); console.log(p.body)"
    ```
  - 出力（PR本文 verbatim / テンプレコメント部分は省略）:
    ```
    title: test_runner: add `context.log()` and `test:log` event
    merged_at: 2026-07-12T11:45:06Z
    merge_commit_sha: 892976d17a4060cf647eb9613ce643e6b597daaa
    labels: semver-minor,lib / src,notable-change,author ready,needs-ci
    --- BODY ---
    Add a log(message[, data]) method to `TestContext` and `SuiteContext` that emits a new `test:log `event.

    Unlike `test:diagnostic`, which is buffered so it is emitted in the order tests are defined, `test:log` is emitted **immediately**, in the order tests execute, including under process isolation where it bypasses the per-file declaration order buffer.

    ### Motivation for adding this

    This gives reporters that render the test tree unbuffered a **live**, attributed logging channel that captured stdout cannot provide under concurrency (see for example https://www.npmjs.com/package/@reporters/live and https://www.npmjs.com/package/@reporters/web).

    The event carries the message, an optional opaque structured payload that the runner passes through untouched, and the emitting test's name, testId, parentId, nesting, and location.

    Built-in reporters render it the same way they render `test:diagnostic`.
    ```
  - 自分の言葉でのまとめ（記事「なぜ試すのか」用）: テストが並行に走ると、`console.log` で吐いた行は「どのテストのものか」を持たないまま stdout に混ざる。`t.diagnostic()` は帰属を持たない上にバッファされ、テストが終わるまで出てこない。`context.log()` は**テスト名・testId 付きで即座に**流れるので、テストツリーをリアルタイム描画する reporter が「今どのテストが何を言ったか」を表示できる。
  - 効いた対処 / 試したこと: **最初 WebFetch（要約モデル経由）で公式ドキュメントを取得したところ、`context.log` の "Added in: v18.9.0, v16.19.0" や `data.args` という配列フィールドなど、実在しない内容が返ってきた。**raw の Markdown / GitHub API を `curl` で直接取り直して突き合わせたところ全部食い違っていたので、以降の一次情報はすべて raw ソースを採用した。
  - 記事に書きたい気づき: ★ 一次情報は「要約されたページ」ではなく `doc/api/test.md` の raw を読むほうが速くて正確。バージョン別 API を調べるなら `raw.githubusercontent.com/nodejs/node/v26.7.0/doc/api/test.md` が確実。

### フェーズ2: 環境構築（見積もり 25分 → 実測 約1分）

- [x] 作業ディレクトリと `{"type":"module"}` だけの `package.json` を作る
  - 実行したコマンド:
    ```bash
    mkdir -p logs/run-node-test-context-log-20260812-1603/workspace/{results,reporters}
    cd logs/run-node-test-context-log-20260812-1603/workspace
    echo '{"type":"module"}' > package.json
    ```
  - 記録: **追加依存は本当にゼロで済んだ**（`npm install` を一度も実行していない）。`package.json` は1行。

- [x] 26.7.0 / 26.5.0 の環境情報を `results/env.txt` に保存
  - 実行したコマンド:
    ```bash
    export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
    nvm use 26.7.0; node -v
    nvm use 26.5.0; node -v
    sw_vers -productVersion; uname -m
    ```
  - 出力（`results/env.txt` 全文）:
    ```
    === date ===
    Wed Aug 12 16:03:46 JST 2026
    === sw_vers ===
    26.5
    === uname -m ===
    arm64
    === node 26.7.0 ===
    v26.7.0
    typeof test: function
    === node 26.5.0 ===
    v26.5.0
    typeof test: function
    ```
  - 注意点: `node --test` を使うだけなら 26.5.0 でも動く（`typeof test` は両方 `function`）。**差が出るのは `t.log` だけ**。

- [x] 3種のログを並べた `probe.test.mjs` を 26.7.0 で実行
  - コード（全文 / `workspace/probe.test.mjs`）:
    ```js
    import { test } from 'node:test';

    test('probe', (t) => {
      console.log('via console.log');
      t.diagnostic('via t.diagnostic');
      t.log('via context.log');
    });
    ```
  - 実行したコマンド:
    ```bash
    node --test --test-reporter=spec probe.test.mjs
    ```
  - 出力（全文 / `results/reporter-spec.txt`）:
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
  - 記事に書きたい気づき: ★★ **コードの記述順は `console.log` → `t.diagnostic` → `t.log` なのに、出力は `console.log` → `t.log` → `✔ probe` → `t.diagnostic` の順になる。**`t.log` は結果行の**前**、`t.diagnostic` は結果行の**後**。同じ `ℹ` 接頭辞で見た目が同じなのに出る位置が違う。これがドキュメントの「buffered / immediate」表の実物。この6行のコードと12行の出力だけで記事の主張が1つ立つ。

- [x] 同じファイルを 26.5.0 で実行して失敗ログを保存
  - 実行したコマンド:
    ```bash
    nvm use 26.5.0
    node --test --test-reporter=spec probe.test.mjs
    ```
  - エラー（全文 / `results/fail-26.5.txt`）:
    ```
    v26.5.0
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
          at TestContext.<anonymous> (file:///.../workspace/probe.test.mjs:6:5)
          at Test.runInAsyncScope (node:async_hooks:226:14)
          at Test.run (node:internal/test_runner/test:1382:25)
          at Test.start (node:internal/test_runner/test:1242:17)
          at startSubtestAfterBootstrap (node:internal/test_runner/harness:387:17)
    ```
  - 記事に書きたい気づき: ★ `--experimental-*` フラグを促すようなヒントは一切出ない。**ただの `TypeError: t.log is not a function`** なので、「自分のタイポかな」と思って `node -v` を疑うまで時間を溶かしうる。26.6 未満をサポートするプロジェクトでは使えない、という制約の実物。

### フェーズ3: 実装・検証【本編】（見積もり 110分 → 実測 約2分）

- [x] spec / tap / dot の3 reporter で実行し出力全文を保存
  - 実行したコマンド:
    ```bash
    for r in spec tap dot; do node --test --test-reporter=$r probe.test.mjs > results/reporter-$r.txt 2>&1; done
    ```
  - 出力（tap 全文 / `results/reporter-tap.txt`）:
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
  - 出力（dot 全文 / `results/reporter-dot.txt`）:
    ```
    .
    ```
  - 3 reporter の比較（実測）:

    | reporter | `console.log` | `t.diagnostic()` | `t.log()` | 結果行との位置関係 |
    |---|---|---|---|---|
    | spec | 素のまま先頭に出る | `ℹ via t.diagnostic` | `ℹ via context.log` | log は `✔ probe` の**前**、diagnostic は**後** |
    | tap | `# via console.log`（TAPコメント化される） | `# via t.diagnostic` | `# via context.log` | log は `# Subtest: probe` の**前**、diagnostic は `ok 1` の**後** |
    | dot | **消える** | **消える** | **消える** | 出力は `.` のみ |
  - 既存技術と比べて感じた違い: PR 本文の「Built-in reporters render it the same way they render `test:diagnostic`」は**見た目（接頭辞）については成り立つが、出力位置は違う**。同一に見えて同一でない。
  - 記事に書きたい気づき: ★ **tap reporter では `console.log` が `#` コメントに変換される**（spec では素のまま）。つまり「reporter の構造に乗らないのは spec のときだけ」で、予想（console.log は常に素のまま）は外れた。dot は3種とも全部捨てる。

- [x] `test:log` / `test:diagnostic` を購読するカスタム reporter を書く（`reporters/dump.mjs`）
  - コード（全文 / 7行）:
    ```js
    export default async function* dump(source) {
      for await (const event of source) {
        if (event.type === 'test:log' || event.type === 'test:diagnostic') {
          yield JSON.stringify(event) + '\n';
        }
      }
    }
    ```
  - 実行したコマンド（`./` の有無で両方試した）:
    ```bash
    node --test --test-reporter=reporters/dump.mjs   probe.test.mjs   # ← 失敗
    node --test --test-reporter=./reporters/dump.mjs probe.test.mjs   # ← 成功
    ```
  - エラー（全文 / `./` なしのとき）:
    ```
    node:internal/test_runner/harness:124
          throw err;
          ^

    Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'reporters' imported from /Users/.../workspace/
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
    終了コード: `exit=7`
  - 効いた対処: `./` を付けて `--test-reporter=./reporters/dump.mjs` にする。**1回で解決**（対象タスクの詰まりポイント表#3の予測どおり）。
  - つまずいた理由: `--test-reporter` の値は**ただの ESM 指定子**として解決されるので、`./` が無いと npm パッケージ名として探しに行く。エラーメッセージが `Cannot find package 'reporters'` になるので「reporters という名のパッケージを入れろ」と読めてしまう。
  - 出力（成功時 / probe.test.mjs 1本ぶん・全文）:
    ```
    {"type":"test:log","data":{"name":"probe","nesting":0,"testId":1,"parentId":0,"message":"via context.log","line":3,"column":1,"file":".../probe.test.mjs","entryFile":".../probe.test.mjs"}}
    {"type":"test:diagnostic","data":{"nesting":0,"message":"via t.diagnostic","level":"info","line":3,"column":1,"file":".../probe.test.mjs","entryFile":".../probe.test.mjs"}}
    {"type":"test:diagnostic","data":{"nesting":0,"message":"tests 1","level":"info"}}
    {"type":"test:diagnostic","data":{"nesting":0,"message":"suites 0","level":"info"}}
    {"type":"test:diagnostic","data":{"nesting":0,"message":"pass 1","level":"info"}}
    {"type":"test:diagnostic","data":{"nesting":0,"message":"fail 0","level":"info"}}
    {"type":"test:diagnostic","data":{"nesting":0,"message":"cancelled 0","level":"info"}}
    {"type":"test:diagnostic","data":{"nesting":0,"message":"skipped 0","level":"info"}}
    {"type":"test:diagnostic","data":{"nesting":0,"message":"todo 0","level":"info"}}
    {"type":"test:diagnostic","data":{"nesting":0,"message":"duration_ms 58.06925","level":"info"}}
    ```
  - 記事に書きたい気づき: ★ **reporter は「async generator を default export するだけ」の7行。**そして予測どおり、`tests 1` / `pass 1` などの**サマリ行まで `test:diagnostic` として流れてくる**（10イベント中8つがサマリ）。自作 reporter で診断メッセージを集計しようとすると、まずここでノイズを踏む。

- [x] `test:log` / `test:diagnostic` のフィールド一覧を機械的に突き合わせる
  - 実行したコマンド:
    ```bash
    : > results/events.jsonl
    for f in probe tree suite conc data entry; do
      node --test --test-reporter=./reporters/dump.mjs $f.test.mjs 2>/dev/null >> results/events.jsonl
    done
    node field-diff.mjs | tee results/field-diff.md
    ```
  - 出力（全文 / `results/field-diff.md`）:
    ```
    events: test:log=26 test:diagnostic=50

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

    test:log only     : data, name, parentId, testId
    test:diagnostic only: level
    ```
  - 記事に書きたい気づき: ★★ **`test:log` だけが持つのは3つではなく4つ**（`name` / `testId` / `parentId` に加えて `data`）。逆に `test:diagnostic` だけが持つのは `level` の1つ。「帰属情報＋構造化ペイロード」対「深刻度」という設計の違いが1枚の表で出る。**この表が記事の中心図表。**
  - 補足: この表は 76 行のイベント（`test:log` 26 / `test:diagnostic` 50）から `Object.keys()` を機械集計したもの。目視ではない。公式ドキュメントの記載（`results/doc-excerpts.md`）とも一致した。

- [x] `t.log('msg', {...})` の第2引数が加工されず載ることを確認
  - 実行したコマンド:
    ```bash
    node --test --test-reporter=./reporters/inspect.mjs data.test.mjs
    ```
  - reporter コード（`reporters/inspect.mjs`）:
    ```js
    import { inspect } from 'node:util';

    export default async function* dump(source) {
      for await (const event of source) {
        if (event.type === 'test:log') {
          yield inspect(event.data, { depth: null, breakLength: 200 }) + '\n';
        }
      }
    }
    ```
  - 出力（抜粋 / 全文は `results/data-payload.txt`）:
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
      file: '.../data.test.mjs',
      entryFile: '.../data.test.mjs'
    }
    ```
  - **危うく誤読しかけた点（★記事のネタ）**: 最初 `JSON.stringify` するだけの `dump.mjs` で見ていたら `map: {}` / `buf: {"0":1,"1":2,"2":3}` / `when: "2026-08-12T07:00:00.000Z"` と出て、「`Map` と `Uint8Array` は潰される」と結論しかけた。**潰していたのは自分の `JSON.stringify` のほうで、ランナーは何もしていない。**`util.inspect` で見直したら `Map(1) { 'k' => 'v' }` と `Uint8Array(3) [ 1, 2, 3 ]` のまま届いていた。プロセス分離越しに structured clone されているので当然だった。
  - `data` を渡さない場合: イベントに `data` キー自体が付かない（`JSON.stringify` 出力に `"data"` が現れない / `inspect` では `data: undefined`）。プリミティブ（`123`）や配列（`['a','b']`）もそのまま載る。
  - 記事に書きたい気づき: ★★ 「reporter でイベントを見るとき、JSON にした時点で情報が落ちる」という一段メタな落とし穴。ダンプ手段そのものが観測結果を変える。

- [x] 壊れるペイロードを渡してみる（循環参照・関数）
  - 実行したコマンド:
    ```bash
    node --test --test-reporter=spec data-fn.test.mjs        # { cb: () => 'nope' } を渡す
    node --test --test-reporter=spec data-circular.test.mjs  # a.self = a を渡す
    node --test --test-isolation=none --test-reporter=spec data-circular.test.mjs
    ```
  - エラー（全文 / 関数を渡した場合・デフォルトのプロセス分離 / `results/data-payload-errors.txt`）:
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
  - エラー（全文 / 循環参照・デフォルトのプロセス分離）:
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
  - `--test-isolation=none` にすると **どちらも通る**（関数は `data: { cb: [Function: cb] }`、循環参照はテスト成功）。
  - 記事に書きたい気づき: ★★★ **`t.log()` の第2引数にうっかり関数を混ぜると、そのテストではなく「テストファイルまるごと」が落ちる。**しかもエラーは `Error: () => 'nope' could not be cloned.` と `harness.js` のスタックで出るので、自分のログ行が原因だと気づきにくい。循環参照は「structured clone 可能なはずなのに」`Unable to deserialize cloned data.` で落ちる（親プロセス側のデシリアライズ失敗）。**`console.log` ならどちらも普通に出せていたので、置き換えるときは要注意。**ドキュメントの structured clone 制約は飾りではなかった。

- [x] サブテスト・`describe`/`it`・失敗テストで帰属を確認
  - テストコード（`workspace/tree.test.mjs` 全文）:
    ```js
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
  - 出力（`results/attribution.md`）:

    | file | name | message | nesting | testId | parentId |
    |---|---|---|---|---|---|
    | tree.test.mjs | parent | in parent | 0 | 1 | 0 |
    | tree.test.mjs | child | in child | 1 | 5 | 1 |
    | tree.test.mjs | grandparent-of | in child2 | 1 | 6 | 1 |
    | tree.test.mjs | grandchild | in grandchild | 2 | 7 | 6 |
    | tree.test.mjs | an it | in it | 1 | 3 | 2 |
    | tree.test.mjs | failing test | right before throwing | 0 | 4 | 0 |
  - 分かったこと:
    - **`testId` は宣言順の連番ではない。** 宣言順は parent(1) → a suite → an it → failing test → child → ... なのに、`child` は 5、`an it` は 3、`failing test` は 4。トップレベルとサブテストで採番タイミングが違う（サブテストは実行時に採番される）。**`testId` を「テストの通し番号」として表示に使うと読者は混乱する。ツリー復元のキーとしてだけ使うべき。**
    - `nesting` は素直にネスト深さ（0 / 1 / 2）。`parentId` で親を辿れる（grandchild(7) → grandparent-of(6) → parent(1)）。
    - `an it` の `parentId` は 2 ＝ `describe('a suite')` 自身の testId。**`describe` もテストツリー上のノードとして採番されている。**
    - **失敗するテストの、throw 直前の `t.log()` もちゃんと `failing test` に帰属して出る**（イベントは即時発火なので、テストが落ちても失われない）。
  - 記事に書きたい気づき: ★ 「`testId` が連番じゃない」は実際にダンプを見るまで気づかない。仕様書には「A numeric identifier」としか書いていない。

- [x] `concurrency: true` でログがインターリーブしても帰属が復元できることを確認
  - **最初の失敗**: `test('alpha', { concurrency: true }, ...)` のように**各トップレベル test に** `concurrency: true` を付けたが、ログはまったくインターリーブしなかった（alpha step1→step2→beta step1→... と直列）。`concurrency` オプションは「その test の**サブテスト**をどれだけ並行に走らせるか」の指定であって、兄弟テストの並行度ではない。`describe('...', { concurrency: true }, () => { it(...) })` に書き直したらインターリーブした。
  - テストコード（修正後 / `workspace/conc.test.mjs`）:
    ```js
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
  - 出力（before ＝ 組み込み spec reporter / 全文 `results/concurrency.txt`）:
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
  - **重要な注意**: この `ℹ step1` が3行並ぶ状態は、**組み込み reporter が帰属情報を捨てて描画しているだけ**で、イベント自体は `name` / `testId` を持っている。「`context.log` を使えば読めるようになる」ではなく「**イベントには入っているので reporter 側で復元できる**」が正しい。ここを混同すると記事が嘘になる。
  - 出力（after ＝ 自作 `reporters/group.mjs` で `testId` ごとに束ね直す / 全文）:
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
  - reporter コード（`reporters/group.mjs` / 全文14行）:
    ```js
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
  - 記事に書きたい気づき: ★★★ **これが記事の山場。**`[console] beta step3` と `[console] alpha step2` が入れ替わって出る、実行ごとに順番が変わる出力が、14行の reporter でテストごとに束ね直せる。`console.log` の行では `[console] ${name}` と自分で名前を埋め込んでいるからかろうじて追えるが、それは「毎回手で帰属を書いている」ということ。`t.log` はそれをイベント側が持っている。

### フェーズ4: 深掘り・比較（見積もり 40分 → 実測 約1分）

- [x] `SuiteContext` の `log()` を確認
  - テストコード（`workspace/suite.test.mjs`）と出力（`results/attribution.md` の後半）:

    | name | message | nesting | testId | parentId |
    |---|---|---|---|---|
    | outer suite | log from SuiteContext | 0 | 1 | 0 |
    | nested suite | log from nested SuiteContext | 1 | 3 | 1 |
    | inner test | log from TestContext | 1 | 2 | 1 |
    | deep test | log from deep TestContext | 2 | 4 | 3 |
  - 分かったこと: `describe('outer suite', (suite) => { suite.log(...) })` で **suite 自身の名前に帰属したイベントが出る**（`name: 'outer suite'`）。テストではなくスイート単位の準備ログ（fixture の用意など）を、テストのログと同じ経路で流せる。
  - **出力順の注意**: dump 上は suite のログ2件が**先に**まとまって出て、その後にテストのログが出た。`describe` のコールバックは登録フェーズで同期実行されるため、`suite.log()` は「テストが1本も走る前」に発火する。
  - 対比: 同じ `suite.diagnostic('...')` は `test:diagnostic` として、**全テストが終わったあと**（サマリ直前）に流れた。ここでも buffered / immediate の差が出る。

- [x] `entryFile` が `file` と食い違うケースを作る（撤退ライン20分 → 実測 約30秒）
  - テストコード:
    ```js
    // entry.test.mjs
    import { test } from 'node:test';
    import { registerImportedTests } from './lib/imported-tests.mjs';
    test('test defined in the entry file', (t) => { t.log('logged from entry file'); });
    registerImportedTests();

    // lib/imported-tests.mjs
    import { test } from 'node:test';
    export function registerImportedTests() {
      test('test defined in an imported module', (t) => { t.log('logged from imported module'); });
    }
    ```
  - 実行したコマンド:
    ```bash
    node --test --test-reporter=./reporters/dump.mjs entry.test.mjs
    node --test --test-isolation=none --test-reporter=./reporters/dump.mjs entry.test.mjs
    ```
  - 出力（`results/entryfile.txt` / パスは末尾2階層に短縮して表示）:
    ```
    === entry.test.mjs, process isolation (default): file vs entryFile ===
    {"name":"test defined in the entry file","message":"logged from entry file","file":"workspace/entry.test.mjs","entryFile":"workspace/entry.test.mjs"}
    {"name":"test defined in an imported module","message":"logged from imported module","file":"lib/imported-tests.mjs","entryFile":"workspace/entry.test.mjs"}
    ```
  - **実測で言い切れること**:
    - `file` = そのテストが **定義されている** ファイル。`entryFile` = ランナーが**子プロセスのエントリとして実行した**ファイル。
    - テストを別モジュールに切り出して import すると、この2つが**食い違う**（`lib/imported-tests.mjs` vs `entry.test.mjs`）。ヘルパーで共通テストを生成している構成では実際に起こる。
    - `--test-isolation=none` で走らせると **`entryFile` フィールドがそもそも付かない**（ドキュメントの "Only present when tests run with process isolation" の実物）。
  - 記事に書きたい気づき: ★ 同じ v26.6.0 で入った `entryFile`（PR #64309）は、`context.log()` と組み合わせて初めて意味が出る。「どのテストが」（`name`/`testId`）＋「どのファイルで定義され」（`file`）＋「どのファイルを実行した子プロセスで」（`entryFile`）が1イベントで揃う。

- [x] 3手段の使い分け方針を実測から3行でまとめる
  - `console.log` … 帰属が要らない一時的なデバッグ。**dot reporter では消え、tap ではコメント化される**ので CI の恒久ログには向かない。ただし何でも渡せて絶対に落ちない。
  - `t.diagnostic(message)` … テスト結果の**あとに**、宣言順で読ませたい要約（計測値など）。`level` を持つが帰属情報は持たないので、機械集計には向かない。
  - `t.log(message[, data])` … **帰属（`name`/`testId`/`parentId`）と構造化データが要るとき。**reporter で機械処理する前提のログはこれ一択。ただし ①Node 26.6 未満では `TypeError` ②プロセス分離下では structured clone 可能な値しか渡せない（関数を渡すとファイルごと落ちる）。

### フェーズ5: 振り返り（見積もり 30分 → 実測 記録作成に集約）

- [x] 詰まった点の棚卸しと★付け → 下の「詰まった点と解決過程」
- [x] 記事への写像を実績で埋める → 下の「記事への写像」

## 詰まった点と解決過程（記事の核）

| # | 詰まった点 | 原因 | 効いた対処 | 所要 | 解決/撤退 | 記事での活かし方 |
|---|---|---|---|---|---|---|
| 1 | ★ 公式ドキュメントを要約経由で取得したら、`Added in: v18.9.0, v16.19.0` や `data.args` という**実在しないフィールド**が返ってきた | 要約モデルが `context.diagnostic` の記述から推測で埋めた | `curl` で `raw.githubusercontent.com/nodejs/node/v26.7.0/doc/api/test.md` を直接取得し、GitHub API で PR 本文を取り直して突き合わせた | 約2分 | 解決 | 「一次情報の取り方」の実例。バージョン付き raw URL を使う |
| 2 | `--test-reporter=reporters/dump.mjs` が `Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'reporters'` で exit=7 | `--test-reporter` の値は ESM 指定子として解決される。`./` が無いと npm パッケージ名として探す | `./reporters/dump.mjs` と `./` を付ける | 1分未満 | 解決（予測どおり） | 「reporter 自作の最初の壁」。エラーメッセージが誤誘導する点まで書く |
| 3 | ★★ `JSON.stringify` した dump を見て「`Map` と `Uint8Array` は潰される」と誤結論しかけた | 潰していたのは**自作 reporter の `JSON.stringify`**。ランナーは structured clone でそのまま渡していた | `util.inspect(event.data, { depth: null })` を使う reporter を別に作って見直した | 約1分 | 解決 | 「観測手段が観測結果を変える」話。記事の中でいちばん実務的な教訓 |
| 4 | ★★★ `t.log('msg', { cb: () => ... })` で**テストファイルまるごと**が `Error: () => 'nope' could not be cloned.` で落ちた | プロセス分離下では `data` が structured clone される。関数は clone 不可 | `--test-isolation=none` なら通ることを確認し、「clone 可能な値だけ渡す」を制約として記録 | 約1分 | 解決（仕様と確認） | `console.log` からの置き換えで踏む地雷。スタックが `harness.js` なので原因に辿り着きにくい点も書く |
| 5 | 循環参照を渡すと `Error: Unable to deserialize cloned data.` で落ちた（structured clone 自体は循環参照に対応しているはずなのに） | 親プロセス側の `#processRawBuffer` でのデシリアライズに失敗している。`--test-isolation=none` では通る | 撤退せず事実として記録。Node 側の実装都合と推測されるが、**断定できないので「こう出た」までに留める** | 約1分 | **未解決（挙動を記録するに留めた）** | 「調べきれなかったこと」として正直に書く。追試したい人向けの再現コードは載せる |
| 6 | ★ `test('name', { concurrency: true }, ...)` を並べてもログがまったくインターリーブしなかった | `concurrency` は**そのテストのサブテスト**の並行度。兄弟テストの並行度ではない | `describe('...', { concurrency: true }, () => { it(...) })` に書き直した | 約1分 | 解決 | 記事の山場（並行実行の before/after）を作るための前提。ここを間違えると「並行なのに混ざらないぞ？」で止まる |

### 予測（対象タスクの詰まりポイント表）と実際の差分

| 予測 | 実際 |
|---|---|
| #1 `TypeError: t.log is not a function` | **予測どおり**（26.5.0 で再現・全文保存済み） |
| #2 3種のログの出力順が想定と違う | **予測どおり**（`t.log` が結果行の前、`t.diagnostic` が後） |
| #3 カスタム reporter のパス解決 | **予測どおり**（`./` 無しで `ERR_MODULE_NOT_FOUND`） |
| #4 `test:diagnostic` に `name` が無い | **予測どおり**。ただし `test:log` 固有フィールドは3つでなく**4つ**（`data` を数え落としていた） |
| #5 サマリ行が自作 reporter に混ざる | **予測どおり**（probe 1本で `test:diagnostic` 10件中8件がサマリ） |
| #6 `type: module` 忘れで import 構文が落ちる | **外れた。** Node 26 では落ちず、`[MODULE_TYPELESS_PACKAGE_JSON] Warning ... Reparsing as ES module because module syntax was detected` の警告付きで**通ってしまう**（`results/type-module.txt`）。「昔のハマりどころが現行バージョンでは解消済み」という更新情報として書ける |
| #7 並行実行のログがインターリーブして読めない | **予測どおり**。ただし `concurrency: true` の付け場所を間違えるとそもそも並行にならない（上表#6）という前段の壁があった |
| （予測外）ペイロードの clone 制約でファイルごと落ちる | **新規**。上表#4・#5 |
| （予測外）`JSON.stringify` による観測バイアス | **新規**。上表#3 |

## ドキュメントと実測の食い違い（記事で正直に書く）

- 公式ドキュメントの `Event: 'test:log'` には `parentId` は「The `testId` of the enclosing test, or **`undefined` for top-level tests**」とある。しかし今回の全実行で、トップレベルテストの `parentId` は **常に `0`**（`undefined` は一度も観測できず）。プロセス分離あり・`--test-isolation=none` の両方で `0`（`results/parentid-check.txt`）。
- 記事では「ドキュメントは undefined と書いているが、自分の環境（v26.7.0）では 0 だった。`0` はルート（ファイルレベル）ノードを指すと思われるが、断定はできない」と範囲を明示して書く。**`parentId` の真偽判定を `=== undefined` で書くと動かない**、という実用上の注意にもなる。

## スクリーンショット一覧

なし（`screenshots/` は空）。本検証はブラウザ表示を伴わないため、完了確認はすべて CLI 出力と保存済みテキスト/JSON で行った。記事に貼るのは**コードブロック（出力全文）**であり、画像は不要。

## 記事への写像（実績で埋める）

| 記事の見出し | 使う記録 | 書くこと（メモ） |
|---|---|---|
| 1. はじめに | `results/env.txt` | Node 26.6 で入った小さな API を1つだけ試した宣言。**26.6.0 そのものではなく 26.7.0（26.6 の機能を含む）で検証し、26.5.0 を対照にした**ことを明記。macOS 26.5 / arm64 / 依存ゼロ |
| 2. なぜこの技術を試すのか | フェーズ1の PR #64389 引用、フェーズ3の `results/concurrency.txt` | PR 本文「a **live**, attributed logging channel that captured stdout cannot provide under concurrency」を引用。並行実行で `ℹ step1` が3行並ぶ出力を先に見せて問題提起 |
| 3. 事前に調べたこと | `results/doc-excerpts.md`、フェーズ1全体 | リリースノート（2026-08-03 / `bb51f2c960` / PR #64389 / SEMVER-MINOR）。**`context.log` に Stability 表記が無い＝モジュールの Stable を継承**（同じ doc の `context.tags` には `1.0 - Early development` が付いている、という対比で示す）。buffered / immediate の公式表を引用。詰まった点#1（要約経由の誤情報）もここで短く |
| 4. 環境構築（バージョンゲート） | フェーズ2、`results/fail-26.5.txt`、`results/type-module.txt` | `nvm use` 手順と `TypeError: t.log is not a function` 全文。「フラグを促すヒントは出ない」。`type: module` は Node 26 では警告のみで通る（昔の情報の更新）ことも1段落 |
| 5. 実際に試したこと（3種のログ比較） | `results/reporter-{spec,tap,dot}.txt`、`probe.test.mjs` | 6行のテストコードと spec 出力12行。**出力位置の違い**（`t.log` は結果行の前 / `t.diagnostic` は後）。3 reporter 比較表（tap は `console.log` を `#` 化、dot は全部消す） |
| 6. 詰まった点 | 「詰まった点と解決過程」表（#1〜#6）、`results/data-payload-errors.txt` | ★ 関数ペイロードでファイルごと落ちる（`could not be cloned.` 全文）、★ `JSON.stringify` の観測バイアス、reporter の `./` パス、`concurrency` の付け場所、サマリ行混入 |
| 7. 触ってみて分かったこと（自作 reporter） | `reporters/dump.mjs`（7行）、`results/field-diff.md`、`results/attribution.md` | reporter 実装全文。**フィールド差分表（`test:log` 固有 4 / `test:diagnostic` 固有 1）が中心図表。** `testId` が連番でないこと、`describe` も採番されること、失敗テストでも直前の `t.log` が帰属して残ること |
| 8. 既存技術と比べて感じたこと | フェーズ4の使い分け3行、`results/entryfile.txt` | 3手段の判断軸。`SuiteContext.log()` は登録フェーズで先に流れる。`file` と `entryFile` が食い違う実測（import 先で定義したテスト）と、`--test-isolation=none` では `entryFile` が付かないこと |
| 9. どんな人に向いていそうか | フェーズ3・4 | CI ログを機械処理している人、並行実行でログが読めない人。逆に 26.6 未満をサポートするなら使えない。**「reporter を自作する気がないなら旨味は薄い」**（組み込み reporter は帰属を捨てて描画する）という正直な線引き |
| 10. まとめ | 「ドキュメントと実測の食い違い」節、詰まった点#5 | 確かめられた範囲と、確かめきれなかったこと（`parentId` が `undefined` にならない理由、循環参照のデシリアライズ失敗）を正直に書く |

### 記事化時の注意（申し送り）

- `results/` の出力には絶対パス `/Users/katayamaryuunosuke/...` が含まれる。**記事に貼る前に `/path/to/` 等へマスクする**（このログ本文では一部を `.../` に短縮済みだが、`results/` の生ファイルは未マスク）。
- 「`context.log` を使えば並行実行のログが読めるようになる」と書くと**嘘になる**。組み込み reporter は帰属を捨てて描画するので、正しくは「イベントには帰属が載っているので、reporter 側で復元できる」。フェーズ3の注意書きを参照。
- 実測時間（約5分）は AI 単独実行の値なので、記事にそのまま書かない。

## 未達・撤退した項目

- なし（完了条件4件すべて達成、撤退ラインの発動なし）。
- ただし**未解決として残した事実が2件**あり、記事では「分からなかったこと」として書く:
  1. 循環参照ペイロードが `Unable to deserialize cloned data.` で落ちる理由（structured clone は循環参照に対応しているはず）
  2. ドキュメントが `parentId` を「`undefined` for top-level tests」としているのに、実測では常に `0` だった理由

## 再現性メモ（記事に転記する用）

- OS / ランタイム: macOS 26.5 / arm64（Apple Silicon）/ Node.js v26.7.0（本命）と v26.5.0（対照）
- 追加ライブラリ: **なし**（`package.json` は `{"type":"module"}` の1行のみ、`npm install` 未実行）
- 最短の再現手順:
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

  node --test --test-reporter=spec probe.test.mjs              # 出力位置の違いを見る
  node --test --test-reporter=./reporters/dump.mjs probe.test.mjs  # フィールドの違いを見る
  ```
- 注意点:
  - **Node 26.6.0 未満では `t.log` が存在せず `TypeError: t.log is not a function`。** フラグでは有効化できない。
  - `--test-reporter` に相対パスを渡すときは **`./` が必須**（無いと npm パッケージとして解決され `ERR_MODULE_NOT_FOUND`）。
  - `t.log()` の第2引数は、**デフォルト（プロセス分離あり）では structured clone 可能な値のみ**。関数を含めるとテストファイルごと落ちる。
  - reporter 内で `JSON.stringify` すると `Map` / `Uint8Array` / `Date` が変質する。ペイロードの中身を確認したいときは `util.inspect`。
  - 兄弟テストを並行に走らせるには `describe('...', { concurrency: true }, ...)`。個々の `test()` に付けても兄弟は並行にならない。
  - `entryFile` はプロセス分離時のみ付く（`--test-isolation=none` では欠落）。

## 次のアクション（記事化）

- [ ] この execution-log.md の「記事への写像」に沿って `articles/<slug>.md` を作成する（`/draft-article`）
- [ ] 画像は不要（スクショ 0 枚）。貼るのは `results/` の出力全文をコードブロックにしたもの
- [ ] 貼る前に絶対パスをマスクする
