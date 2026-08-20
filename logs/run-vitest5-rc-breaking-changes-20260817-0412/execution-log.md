# 検証ログ: Vitest 5 RC に上げて、4.1 で通っていたテストが落ちる箇所を1つずつ踏む

> Zenn記事の素材。実行の一次情報（コマンド・エラー全文・所要時間・ログ）を記録。
> 記事本文は未執筆。「記事への写像」を見て articles/*.md に展開する。

## 実行の前提（採用した前提）

- 対象タスク: `practice/practice-vitest5-rc-breaking-changes-20260817-0408.md`
- 出典レポート: `research/search-topic-20260817-0404.md`
- 対象技術: Vitest `5.0.0-rc.1`（比較対象: Vitest `4.1.10`）
- 実行者: AIエージェント単独（非対話） <!-- 内部メタ: 記事に転記しない -->
- 実行日時 / 所要時間: 2026-08-17 04:12〜04:24 JST / 見積もり 435分（約7時間15分）→ 実測 約12分
  <!-- 実測はAI単独の値。記事にそのまま書かない -->
- 実行環境: macOS 26.5 (Darwin 25.5.0 arm64) / Node.js v22.17.0 / npm 10.9.2 / Vite 8.2.1
- 採用した撤退ライン: 対象タスクの「想定リスク・注意点」記載のもの
  （フェーズ2でバージョン要件を満たせず起動しない→その記録を成果にする／
  8項目中4項目以上を4.1で緑にできない→緑にできた項目に絞る／合計7時間超過→4-2・4-3・3-7を落とす）
  いずれも発動せず。全フェーズを実行した。
- 判断方針: `/run-practice` の引数は対象タスクファイルのパスのみ。実行時間・撤退ライン・成果物置き場は
  未指定のため、対象タスクファイル記載の前提をそのまま採用した。
  成果物コードの置き場のみ、対象タスクファイルの指定に従い既定の `logs/**/workspace/` ではなく
  `fixtures/vitest5-rc-breaking-changes/` とした（`workspace/` には before/after のスナップショットを保存）。
- 実行環境の制約の遵守: 全工程が npm と `npx vitest`（CLI）とローカルファイル操作のみ。
  課金・認証・手動操作・外部SaaSは一切なし。テーマの置き換えも発生していない。
  ブラウザ表示を伴わないため Playwright は使用せず、完了判定は CLI 出力と終了コードで行った（対象タスクの明示方針どおり）。

## 結果サマリー

- 完了条件の判定: **達成**（4条件すべて充足。4.1で全緑 → 5RCで差分取得 → 修正して5RCで全緑、A〜H の表も充填）
- 作ったもの: 破壊的変更 A〜H を1項目1ファイルで踏む最小テスト fixture
  （`fixtures/vitest5-rc-breaking-changes/`。before/after は `workspace/test-v4-baseline/` と `workspace/test-v5-fixed/`）
- スクショ: 0 枚（CLI 完結のため。完了判定は `npx vitest run` の出力と終了コードで実施）
- 詰まった点: 4 件（うち解決 3 / 未解決・仕様確認どまり 1）
- knowledge 記録: `knowledge/2026-08-17-npm-edgesout-crash-installing-vitest5.md`（新規1件）

### 一番の収穫（記事の山場）

1. **本題に入る前に npm が壊れた**。`npm i -D vitest@5.0.0-rc.1` が
   `Cannot read properties of null (reading 'edgesOut')` で落ちる。空ディレクトリでも再現し、
   4.1.10 は通るので **npm 10.9.2 では vitest 5 系がそのまま入らない**。`--legacy-peer-deps` で回避。
2. **予想が外れた項目が3つ**（B の履歴が消える挙動は当たったが、A の警告・H の POOL_ID・G の `.vitest`）。
   特に **`VITEST_POOL_ID` は 4.1 の時点ですでに `1` 始まり**で、5 で変わったのは `VITEST_WORKER_ID` だけだった。
3. **項目 G（`.vitest` ディレクトリ）は3つの経路を試して再現しなかった**。落ちなかったものは落ちなかったと書く。

## 完了条件の検証

| # | 完了条件 | 判定 | 根拠（ログ） |
|---|---|---|---|
| 1 | `vitest@4.1.10` で `npx vitest run` が全テスト緑になるログがある | **達成** | `v4-green.log`（`Test Files 8 passed (8) / Tests 8 passed (8)`、別途 `exit=0` を確認） |
| 2 | `vitest@5.0.0-rc.1` で同じコマンドを流し、項目ごとの落ちた/落ちないが判定でき、エラー全文がある | **達成** | `v5-first-run.log`（`Test Files 5 failed \| 3 passed (8)`、`exit=1`。A/B/D/E/F のエラー全文を収録） |
| 3 | 落ちた項目を移行ガイドどおりに直し、5RC で再び全テスト緑になるログがある | **達成** | `v5-fixed-green.log`（`Test Files 8 passed (8) / Tests 9 passed (9)`、別途 `exit=0`）。修正差分は `migration.diff` |
| 4 | A〜H の8項目すべてが「4.1の結果／5RCの結果／ガイドの該当記述／直し方」の1枚表に埋まっている | **達成** | 後述「項目別の結果表」。G は「再現せず」を根拠付きで記載 |

## タスク実行ログ（フェーズ別）

### フェーズ1: 事前調査（見積もり 45分 → 実測 約2分）

- [x] 1-1. 移行ガイドの破壊的変更を全項目書き出す（見積もり 20分 → 実測 1分）
  - 参照: `https://main.vitest.dev/guide/migration`
  - **破壊的変更は全24項目**。本検証はそのうち **8項目（A〜H）** に絞った。
    絞った理由は「新人が普通に書くテストが影響を受けるもの」で、Browser Mode / Benchmark API /
    Vitest UI 認証 / `resolveConfig` などブラウザ・ベンチ・プログラマティックAPI寄りの項目は外した。
  - 検証対象8項目とガイド上の見出し（原文）:

    | # | ガイドの見出し（原文） | ガイド原文の要旨 |
    |---|---|---|
    | A | Unawaited Asynchronous Assertions Fail the Test | "Asynchronous assertions ... now fail the test if they are not awaited" |
    | B | `clearMocks` is Enabled by Default | "Vitest calls `vi.clearAllMocks()` before every test, clearing the recorded history" |
    | C | `testNamePattern` Matches the `>`-Joined Full Name | "now matches against the test's full name with the suite chain and test name joined by `' > '`" |
    | D | Hoisted Mocking Calls Must Be at the Top Level | "Calling them inside a function, block, or `describe`/`test` callback ... now throws" |
    | E | Removed `test.sequential`, `describe.sequential`, and `sequential` Options | "Use `concurrent: false` when you need a test or suite to opt out" |
    | F | `toThrow("")` Matches Any Error Message | "an empty string is contained in every message" |
    | G | Generated Reports and Artifacts Use the `.vitest` Directory | "uses a single `.vitest` directory at the project root as the shared artifact root" |
    | H | Worker and Concurrency Ids Are 1-based | "identifiers now start at `1` instead of `0`" |
  - ガイド記載の前提: **Vite >= 6.4.0 / Node.js >= 22.12.0**
  - 記事に書きたい気づき: 「24項目もあるのか」で怯むが、ブラウザ・ベンチ関連を外すと
    普通のユニットテストに効くのは8項目程度。**絞る基準を書けること自体が記事の価値**。

- [x] 1-2. npm でバージョン要件を実測確認（見積もり 10分 → 実測 1分）
  - 実行したコマンド:
    ```bash
    npm view vitest dist-tags
    npm view vitest@rc engines peerDependencies
    npm view vitest@4.1.10 peerDependencies.vite engines
    npm view vite dist-tags
    ```
  - 出力（全文）:
    ```
    === npm view vitest dist-tags ===
    {
      V3: '3.2.7',
      latest: '4.1.10',
      beta: '5.0.0-beta.7',
      rc: '5.0.0-rc.1'
    }
    === npm view vitest@rc engines peerDependencies ===
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
    === npm view vitest@4.1.10 peerDependencies.vite engines ===
    peerDependencies.vite = '^6.0.0 || ^7.0.0 || ^8.0.0'
    engines = { node: '^20.0.0 || ^22.0.0 || >=24.0.0' }
    === npm view vite dist-tags ===
    {
      alpha: '6.0.0-alpha.24',
      previous: '7.3.6',
      beta: '8.2.0-beta.0',
      latest: '8.2.1'
    }
    === 公開日 ===
    4.1.10: 2026-07-06T06:44:42.684Z
    5.0.0-rc.1: 2026-08-11T23:45:21.455Z
    ```
  - 記事に書きたい気づき: この時点で **peerDependencies が13個**あるのが見えている。
    後で npm が落ちる伏線がここに全部出ていた（当時は気づかなかった）。
  - ログ: `commands.log`

- [x] 1-3. 手元環境と要件の照合表（見積もり 10分 → 実測 1分未満）
  - 実行したコマンド: `node -v` / `npm -v` / `npx vite --version` / `sw_vers` / `uname -srm`
  - 出力（全文）:
    ```
    uname: Darwin 25.5.0 arm64
    sw_vers: macOS 26.5
    node: v22.17.0
    npm: 10.9.2
    npx vite --version: npm error npx canceled due to missing packages and no YES option: ["vite@8.2.1"]
    (not installed)
    ```
  - 照合表:

    | 項目 | 要件（Vitest 5） | 手元 | 判定 |
    |---|---|---|---|
    | Node.js | `^22.12.0 \|\| ^24.0.0 \|\| >=26.0.0` | v22.17.0 | ✅ 満たす |
    | Vite | `^6.4.0 \|\| ^7.0.0 \|\| ^8.0.0` | 未導入 → 後に 8.2.1 を導入 | ✅ 満たす |
    | npm | （engines 指定なし） | 10.9.2 | ⚠️ **ここが後で問題になった** |
  - つまずいた理由・分かっていなかった前提: 事前チェックで見るべきは Node と Vite だと思い込んでいた。
    **npm 自身のバージョンは誰もチェック項目に挙げていない**が、今回の実際の障害はそこだった。
  - 記事に書きたい気づき: 「事前にバージョン要件を確認したから大丈夫」と思った直後に、
    要件表に載っていない npm で止まる。**engines に書かれていない依存が落とし穴**という教訓。

- [x] 1-4. A〜H の検証前の予想を立てる（見積もり 5分 → 実測 1分未満）
  - **検証前の自分の予想**（後述の実測と突き合わせる）:

    | 項目 | 4.1 はこうなるはず | 5 はこうなるはず |
    |---|---|---|
    | A | 自動awaitされ、**警告つきで**緑 | 失敗する |
    | B | 履歴が残り `1` | クリアされて `0` |
    | C | `'math adds'` がマッチ | `'math > adds'` がマッチ |
    | D | **警告つきで**緑 | エラーで失敗 |
    | E | 動く（deprecation 警告が出るかも） | 削除されて失敗 |
    | F | `toThrow('')` は空メッセージのみ一致 | 任意のメッセージに一致 |
    | G | `.vitest/` は作られない | `.vitest/` が作られる |
    | H | WORKER_ID / POOL_ID とも **`0` 始まり** | とも `1` 始まり |

### フェーズ2: 環境構築（見積もり 60分 → 実測 約2分）

- [x] 2-1. fixture 作成と `npm init -y`（見積もり 10分 → 実測 1分未満）
  - 実行したコマンド:
    ```bash
    mkdir -p fixtures/vitest5-rc-breaking-changes
    cd fixtures/vitest5-rc-breaking-changes
    npm init -y
    ```
  - 生成された `package.json`（全文）:
    ```json
    {
      "name": "vitest5-rc-breaking-changes",
      "version": "1.0.0",
      "main": "index.js",
      "scripts": { "test": "echo \"Error: no test specified\" && exit 1" },
      "keywords": [], "author": "", "license": "ISC", "description": ""
    }
    ```
  - `"type": "module"` を**追加した**（ESM のテストファイルを素直に書くため）。あわせて
    `"private": true` と `"scripts.test": "vitest run"` も設定した（2-6 を前倒し）。

- [x] 2-2. `npm i -D vitest@4.1.10 vite`（見積もり 15分 → 実測 18秒）
  - 実行したコマンド: `npm i -D vitest@4.1.10 vite`
  - 出力（全文）:
    ```
    added 44 packages, and audited 45 packages in 18s

    17 packages are looking for funding
      run `npm fund` for details

    found 0 vulnerabilities
    ```
  - **peer dependency の警告は1件も出なかった**。
  - 実際に入ったバージョン:
    ```
    $ npx vitest --version
    vitest/4.1.10 darwin-arm64 node-v22.17.0
    $ npm ls vitest vite
    +-- vite@8.2.1
    `-- vitest@4.1.10
      +-- @vitest/mocker@4.1.10
      | `-- vite@8.2.1 deduped
      `-- vite@8.2.1 deduped
    ```
    想定どおり Vite は最新の `8.2.1`。詰まりポイント表 #1（古い Vite を掴んで 5 で不適合）は**発生しなかった**。

- [x] 2-3. smoke テストで緑を確認（見積もり 10分 → 実測 1分未満）
  - 実行したコマンド: `npx vitest run`（`test/smoke.test.ts` に `expect(1 + 1).toBe(2)` のみ）
  - 出力（全文）:
    ```
     RUN  v4.1.10 /Users/.../fixtures/vitest5-rc-breaking-changes

     Test Files  1 passed (1)
          Tests  1 passed (1)
       Start at  04:14:50
       Duration  512ms (transform 66ms, setup 0ms, import 106ms, tests 7ms, environment 0ms)
    ```
    終了コード `0`。初回実行 512ms。

- [x] 2-4. `.gitignore` 追加と `.vitest/` 不在の確認（見積もり 5分 → 実測 1分未満）
  - `.gitignore` に `node_modules/` `.vitest/` `*.log` `reports/` を記載。
  - **項目 G の before として、この時点で `.vitest/` が存在しないことを確認**:
    ```
    $ ls -la
    .gitignore  node_modules  package-lock.json  package.json  test
    $ find . -maxdepth 2 -name '.vitest' -not -path './node_modules/*'
    (出力なし = .vitest は存在しない)
    ```

- [x] 2-5. `versions.log` の保存（見積もり 5分 → 実測 1分未満）
  - `versions.log`（全文。記事の「再現環境」節にそのまま貼れる）:
    ```
    # versions.log (baseline: Vitest 4.1.10)
    date: 2026-08-17 04:14:57 JST
    os: macOS 26.5 / Darwin 25.5.0 arm64
    node: v22.17.0
    npm: 10.9.2
    vitest: vitest/4.1.10 darwin-arm64 node-v22.17.0
    vite: vite/8.2.1 darwin-arm64 node-v22.17.0
    --- npm ls vitest vite ---
    vitest5-rc-breaking-changes@1.0.0 /Users/.../fixtures/vitest5-rc-breaking-changes
    +-- vite@8.2.1
    `-- vitest@4.1.10
      +-- @vitest/mocker@4.1.10
      | `-- vite@8.2.1 deduped
      `-- vite@8.2.1 deduped
    ```

- [x] 2-6. `npm test` で動作確認（見積もり 15分 → 実測 1分未満）
  - `npm test` と `npx vitest run` の**出力に差はなかった**（npm のバナー2行が増えるのみ）。
    ```
    > vitest5-rc-breaking-changes@1.0.0 test
    > vitest run

     RUN  v4.1.10 ...
     Test Files  1 passed (1)
          Tests  1 passed (1)
    ```

### フェーズ3: 実装・検証【本編】（見積もり 180分 → 実測 約5分）

方針どおり **1項目 = 1テストファイル**で作成。ソースは `workspace/test-v4-baseline/` に保存。

- [x] 3-1. 項目A: 未await の非同期assertion（見積もり 20分 → 実測 1分未満）
  - コード: `test('A: resolves without await', () => { expect(Promise.resolve(1)).resolves.toBe(1) })`
  - 4.1.10 での結果（全文）:
    ```
     RUN  v4.1.10 ...
     Test Files  1 passed (1)
          Tests  1 passed (1)
       Duration  593ms (transform 83ms, setup 0ms, import 135ms, tests 27ms, environment 0ms)
    ```
  - **予想と実測のズレ**: 「4.1 は自動awaitして**警告を出す**」と予想したが、**警告は一切出なかった**。
    全項目の 4.1 実行ログ（`v4-per-item.log`）を `grep -i warn` しても、ヒットするのは
    **項目D の `vi.mock` 警告 1件だけ**。つまり 4.1.10 の時点では、未await の assertion は
    **無言で通る**。これは記事の見どころ。
  - 記事に書きたい気づき: 「4.1 でも警告が出ていたなら気づけたはず」と思いきや出ていない。
    **警告なしで挙動だけ変わる**ので、5 に上げるまで自分のテストが await 漏れしていることに気づけない。
  - ログ: `v4-per-item.log`

- [x] 3-2. 項目B: `clearMocks` 既定 true（見積もり 20分 → 実測 1分未満）
  - 詰まりポイント表 #4 の指示どおり、**`vitest.config.ts` を作らない**（既定値の変化を見るため）、
    かつモック呼び出しは `beforeEach` ではなく **`beforeAll`** に置いた。
  - 4.1.10 での結果: `expect(spy.mock.calls.length).toBe(1)` が**緑**（履歴が残る）。
    ```
     Test Files  1 passed (1)
          Tests  1 passed (1)
    ```

- [x] 3-3. 項目C: `-t` の区切り（見積もり 20分 → 実測 1分未満）
  - 実行したコマンド:
    ```bash
    npx vitest run test/c-filter.test.ts -t 'math adds'
    npx vitest run test/c-filter.test.ts -t 'math > adds'
    ```
  - 4.1.10 での出力（全文）:
    ```
    ### -t 'math adds'
     RUN  v4.1.10 ...
     Test Files  1 passed (1)
          Tests  1 passed (1)
       Duration  464ms
    ### -t 'math > adds'
     RUN  v4.1.10 ...
     Test Files  1 skipped (1)
          Tests  1 skipped (1)
       Duration  232ms
    ```
  - **マッチ0件のときの出力文言は `1 skipped (1)`**。エラーにならず終了コードも `0` のまま。
    → CI で `-t` を使っていて、5 に上げてパターンがマッチしなくなっても
    **「テストが1件も実行されていない」ことに気づかず緑で通過する**。これは実務上いちばん怖い。
  - ログ: `v4-filter.log`

- [x] 3-4. 項目D: `vi.mock` を関数内で呼ぶ（見積もり 20分 → 実測 1分未満）
  - 4.1.10 での出力（全文。**警告文全文**）:
    ```
     RUN  v4.1.10 ...

    Warning: A vi.mock("./fixtures/greeter.ts") call in "/Users/.../test/d-vimock-inline.test.ts" is not at the top level of the module. Although it appears nested, it will be hoisted and executed before any tests run. Move it to the top level to reflect its actual execution order. This will become an error in a future version.
    See: https://vitest.dev/guide/mocking/modules#how-it-works

     Test Files  1 passed (1)
          Tests  1 passed (1)
    ```
  - **警告つきで緑**。予想どおり。しかも警告文に
    **"This will become an error in a future version." と予告が入っている**（8項目中これだけ）。

- [x] 3-5. 項目E: `test.sequential`（見積もり 15分 → 実測 1分未満）
  - 4.1.10 での結果: **警告なしで緑**。deprecation 警告は出なかった。
    ```
     Test Files  1 passed (1)
          Tests  1 passed (1)
    ```

- [x] 3-6. 項目F: `toThrow('')`（見積もり 20分 → 実測 1分未満）
  - 詰まりポイント表 #3 の想定どおり、素直に `expect(boom).toThrow('')` と書くと 4.1 で落ちる。
    **4.1 のベースラインを緑にするため `.not.toThrow('')` の形で書いた**（意味の反転を 5 で観測する狙い）。
    ```ts
    function boom(): never { throw new Error('boom happened') }
    test("F: toThrow('') against a non-empty message", () => {
      expect(boom).not.toThrow('')
    })
    ```
  - 4.1.10 での結果: **緑**（空文字は空メッセージにしか一致しないので `.not` が成立）。
  - 記事に書きたい気づき: 「ベースラインを全部緑にする」という制約のせいで、
    項目Fだけ **`.not` を挟んだ不自然な書き方**になる。この工夫の説明自体が読者の役に立つ。

- [x] 3-7. 項目G+H: 成果物ディレクトリと worker/pool ID（見積もり 25分 → 実測 2分）
  - 最初に書いたコードは `expect(worker).toBe('0')` / `expect(pool).toBe('0')`。4.1 で**落ちた**。
  - エラー全文:
    ```
    stdout | test/gh-env.test.ts > GH: worker and pool ids are 0-based on 4.1
    [GH] VITEST_WORKER_ID=0 VITEST_POOL_ID=1

     ❯ test/gh-env.test.ts (1 test | 1 failed) 10ms
       × GH: worker and pool ids are 0-based on 4.1 9ms

    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  test/gh-env.test.ts > GH: worker and pool ids are 0-based on 4.1
    AssertionError: expected '1' to be '0' // Object.is equality

    Expected: "0"
    Received: "1"

     ❯ test/gh-env.test.ts:11:16
          9|   console.log(`[GH] VITEST_WORKER_ID=${worker} VITEST_POOL_ID=${pool}`)
         10|   expect(worker).toBe('0')
         11|   expect(pool).toBe('0')
           |                ^
         12| })
         13|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

     Test Files  1 failed (1)
          Tests  1 failed (1)
    ```
  - **予想が外れた**: 4.1.10 の実測は `VITEST_WORKER_ID=0` だが **`VITEST_POOL_ID=1`**。
    POOL_ID は 4.1 の時点ですでに 1 始まりだった。「両方 0 始まり」という前提が誤りだった。
  - 効いた対処: テストを「値を `console.log` で記録し、定義されていることだけを検証する」形に書き換えて
    両バージョンで緑を保ち、**値の比較は `--maxWorkers=1` の単独実行ログで行う**方式に変更した
    （suite 全体を並列実行すると worker id はファイル数に応じて変わり、比較が不安定になるため）。
  - つまずいた理由: 環境変数の値をそのまま assert すると、並列実行数に依存して結果が変わる。
    詰まりポイント表 #7（pool 設定に依存して再現しない）が的中した形。
  - JSON reporter の出力先（4.1.10）:
    ```
    $ npx vitest run test/c-filter.test.ts --reporter=json --outputFile=reports/v4.json
    JSON report written to /Users/.../fixtures/vitest5-rc-breaking-changes/reports/v4.json
    $ ls -la reports/
    -rw-r--r--  1 ... 857 Aug 17 04:17 v4.json
    ```
    指定したパスにそのまま出力される。この時点でも `.vitest/` は**作られない**（`find` の結果が空）。
  - ログ: `v4-gh-single.log`

- [x] 3-8. **ベースライン確定**（見積もり 15分 → 実測 1分未満）
  - 実行したコマンド: `npx vitest run 2>&1 | tee logs/.../v4-green.log`
  - 出力（全文）:
    ```
     RUN  v4.1.10 /Users/.../fixtures/vitest5-rc-breaking-changes

    Warning: A vi.mock("./fixtures/greeter.ts") call in "/Users/.../test/d-vimock-inline.test.ts" is not at the top level of the module. Although it appears nested, it will be hoisted and executed before any tests run. Move it to the top level to reflect its actual execution order. This will become an error in a future version.
    See: https://vitest.dev/guide/mocking/modules#how-it-works

     Test Files  8 passed (8)
          Tests  8 passed (8)
       Start at  04:17:37
       Duration  1.45s (transform 983ms, setup 0ms, import 1.61s, tests 166ms, environment 17ms)
    ```
    終了コード `0`。**8ファイル / 8テストすべて緑**（smoke 1 + 項目 A〜G+H の 7）。
  - 緑にできなかった項目: **なし**。撤退ライン（4項目以上が緑にできない）には触れなかった。
  - ログ: `v4-green.log`

- [x] 3-9. `npm i -D vitest@5.0.0-rc.1` に上げる（見積もり 10分 → 実測 3分）→ **ここで最大の詰まり**
  - 実行したコマンド: `npm i -D vitest@5.0.0-rc.1`
  - **エラー全文**:
    ```
    npm error Cannot read properties of null (reading 'edgesOut')
    npm error A complete log of this run can be found in: /Users/.../.npm/_logs/2026-08-16T19_17_52_168Z-debug-0.log
    ```
    終了コード `1`、所要 7秒。`npx vitest --version` は `4.1.10` のまま（node_modules は無変更）。
  - デバッグログのスタックトレース（全文）:
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
    クラッシュ直前の行が原因を示している:
    ```
    185 silly fetch manifest vitest@*
    189 silly fetch manifest @vitest/browser-playwright@4.1.10
    191 verbose stack TypeError: Cannot read properties of null (reading 'edgesOut')
    ```
    → vitest 5 の optional peer（`@vitest/browser-webdriverio` の `^5.0.0-beta.5 || >=5.0.0` など）を
    再帰的に辿るうちに `vitest@*` に戻り、ツリーに未登録のノード（null）を触って落ちている。
  - **試したこと（効かなかったものも含む）**:

    | 試したこと | 結果 |
    |---|---|
    | `consult-knowledge` で `knowledge/` を検索 | 該当なし（`SCORE=1/3` の無関係な1件のみ） |
    | `npm i -D vitest@5.0.0-rc.1 --legacy-peer-deps` | ✅ **成功**（3秒） |
    | `rm -rf node_modules package-lock.json` → クリーンインストール | ❌ 同じエラー（**効かなかった**） |
    | **空の一時ディレクトリ**で `npm init -y` → `npm i -D vitest@5.0.0-rc.1` | ❌ 同じエラー（最小再現に成功） |
    | 同じ空ディレクトリで `npm i -D vitest@4.1.10` | ✅ 成功（4.1 は問題なし） |
    | 同じ空ディレクトリで `npm i -D vitest@5.0.0-beta.7` | ❌ 同じエラー（5系全体の問題と確定） |
  - **効いた解決方法**: `--legacy-peer-deps` を付ける。
    ```bash
    npm i -D vitest@5.0.0-rc.1 vite@8.2.1 --legacy-peer-deps
    ```
    ```
    added 37 packages, and audited 38 packages in 5s
    found 0 vulnerabilities
    ```
    ```
    $ npx vitest --version
    vitest/5.0.0-rc.1 darwin-arm64 node-v22.17.0
    $ npm ls vitest vite
    +-- vite@8.2.1
    `-- vitest@5.0.0-rc.1
      +-- @vitest/mocker@5.0.0-rc.1
      | `-- vite@8.2.1 deduped
      `-- vite@8.2.1 deduped
    ```
    Vite は 8.2.1 のまま（上がらない）。インストール後の実行は完全に正常。
  - つまずいた理由・分かっていなかった前提: **エラー文が npm 内部の TypeError で、
    何が悪いのか一切示していない**。最初は自分の package.json か既存ツリーが壊れていると思い込み、
    クリーンインストールを試して外した。**空ディレクトリでの最小再現**を取って初めて、
    プロジェクト側ではなく npm と vitest 5 の組み合わせの問題だと確定できた。
  - 4.1 と比べて感じた違い: 4.1.10 は peer 警告ゼロで素直に入る。5 は peer が13個に増えており、
    その解決が npm 10.9.2 の手に負えていない。**「RC を試す」の最初の壁がテストコードではなく npm だった**。
  - knowledge に記録: `knowledge/2026-08-17-npm-edgesout-crash-installing-vitest5.md`
  - ログ: `npm-edgesout-error.log`（npm デバッグログ全文と切り分けの全試行を収録）

- [x] 3-10. **本番差分取り**（見積もり 15分 → 実測 1分未満）
  - 実行したコマンド: `npx vitest run 2>&1 | tee logs/.../v5-first-run.log`
  - **出力全文（要約なし）**:
    ```
     RUN  v5.0.0-rc.1 /Users/.../fixtures/vitest5-rc-breaking-changes

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
    終了コード `1`。
  - **落ちた項目**: A, B, D, E, F の5項目。**落ちなかった項目**: C, G+H, smoke。
  - **予想と実測のズレ**:
    - 項目 D・E は「テストが失敗する」と予想したが、実際は **Failed Suites（ファイルごと読み込み失敗）**。
      `(0 test)` と表示され、テスト件数にすら計上されない（`Tests` の分母が 8 → 6 に減っている）。
      **ファイル単位で丸ごと落ちるので、影響範囲が想定より大きい**。
    - 項目 A のエラーメッセージが **`await expect(actual).resolves.toBe(expected)` という直し方を
      そのまま提示してくれる**。ここは想定より親切だった。
  - ログ: `v5-first-run.log`

### フェーズ4: 深掘り・比較（見積もり 90分 → 実測 約3分）

- [x] 4-1. 落ちた項目を移行ガイドどおりに1つずつ直す（見積もり 45分 → 実測 2分）
  - 修正差分の全文は `migration.diff`。修正後ソースは `workspace/test-v5-fixed/`。
  - 項目ごとの before / after と、直し方の出どころ:

    | 項目 | before | after | 直し方の出どころ |
    |---|---|---|---|
    | A | `test('...', () => { expect(p).resolves.toBe(1) })` | `test('...', async () => { await expect(p).resolves.toBe(1) })` | **エラーメッセージ本文**が修正形をそのまま提示。ガイドを見る必要すらなかった |
    | B | `beforeAll` で呼んで `toBe(1)` | 新既定に合わせ `toBe(0)`、履歴が要るならテスト内で呼ぶ | ガイド記載（`vi.clearAllMocks()` が毎テスト前に走る）。**旧挙動維持は config に `clearMocks: false`** |
    | D | 関数内で `vi.mock(...)` | モジュールのトップレベルへ移動 | エラー本文＋ガイド。4.1 の警告文と同じ文面 |
    | E | `test.sequential('...', fn)` | `test('...', { concurrent: false }, fn)` | **ガイド記載**（"Use `concurrent: false`"）。エラーは `is not a function` だけで直し方を示さない |
    | F | `expect(boom).not.toThrow('')` | `expect(boom).toThrow('')` ＋ 厳密一致は `toThrow(/^$/)` | ガイド記載（"an empty string is contained in every message"）。**正規表現での代替は自分で考えた** |
  - **`clearMocks: false` の逃げ道を実測で確認した**:
    - CLI フラグは**存在しない**。エラー全文:
      ```
      CACError: Unknown option `--clearMocks`
          at Command.checkUnknownOptions (.../node_modules/vitest/dist/chunks/cac.CM6y_f_i.js:405:17)
          at CAC.runMatchedCommand (.../cac.CM6y_f_i.js:605:13)
          at CAC.parse (.../cac.CM6y_f_i.js:546:12)
      ```
    - 設定ファイルなら効く:
      ```ts
      import { defineConfig } from 'vitest/config'
      export default defineConfig({ test: { clearMocks: false } })
      ```
      ```
      $ npx vitest run test/tmp-escape.test.ts --config vitest.escape.config.ts
       Test Files  1 passed (1)
            Tests  1 passed (1)
      ```
      → `beforeAll` の履歴が復活し、旧挙動に戻る。**移行が間に合わないときの現実的な避難先**。
  - ログ: `v5-filter-and-artifacts.log` / `migration.diff`

- [x] 4-2. `-t` を 5 RC で再実行して 2×2 表にする（見積もり 15分 → 実測 1分未満）
  - **4セルすべての実測結果**:

    | `-t` のパターン | Vitest 4.1.10 | Vitest 5.0.0-rc.1 |
    |---|---|---|
    | `-t 'math adds'` | ✅ `1 passed (1)` | ⬜ `1 skipped (1)` |
    | `-t 'math > adds'` | ⬜ `1 skipped (1)` | ✅ `1 passed (1)` |

    きれいに反転した。5RC 側の出力全文:
    ```
    ### -t 'math adds'
     RUN  v5.0.0-rc.1 ...
     Test Files  1 skipped (1)
          Tests  1 skipped (1)
       Duration  728ms (import 59%, transform 31%, worker 9%)
    ### -t 'math > adds'
     RUN  v5.0.0-rc.1 ...
     Test Files  1 passed (1)
          Tests  1 passed (1)
       Duration  351ms (transform 63%, import 23%, worker 8%, tests 6%)
    ```
  - **どちらのバージョンも終了コードは `0`**。マッチ0件でもエラーにならない。
    → CI で `-t` を使っている場合、5 に上げた瞬間に**テストが1件も走らないまま緑で通過する**。
    今回いちばん実務的に危ない発見。
  - ログ: `v4-filter.log` / `v5-filter-and-artifacts.log`

- [x] 4-3. `.vitest/` の生成確認（見積もり 15分 → 実測 1分）→ **再現せず**
  - **3つの経路を試したが、5.0.0-rc.1 でも `.vitest/` は作られなかった**:

    | 試した経路 | 結果（5.0.0-rc.1） |
    |---|---|
    | `--reporter=json --outputFile=reports/v5.json` | 指定パス `reports/v5.json` にそのまま出力。`.vitest/` なし |
    | `--reporter=junit --outputFile=junit.xml` | プロジェクトルート直下 `./junit.xml` に出力。`.vitest/` なし |
    | `--coverage`（`@vitest/coverage-v8@5.0.0-rc.1` を追加） | `coverage/` に出力（`index.html` / `clover.xml` / `coverage-final.json` 等）。`.vitest/` なし |
    | キャッシュの置き場 | `node_modules/.vite`（4.1 と同じ。`.vitest/` は無い） |

    確認コマンドと出力:
    ```
    $ find . -maxdepth 3 -name '.vitest*' -not -path './node_modules/*'
    (出力なし)
    $ ls -la .vitest
    ls: .vitest: No such file or directory
    ```
  - **正直な結論**: 項目 G は本 fixture の範囲では**再現しなかった**。
    ガイドに "uses a single `.vitest` directory at the project root as the shared artifact root" とあるので、
    `--outputFile` を明示しない場合の既定パスや、Browser Mode / スナップショット等
    **今回触っていない成果物**が対象の可能性がある。**RC の実装途中である可能性も否定できない**（詰まりポイント表 #6）。
    「試した3経路では出なかった」以上のことは書かない。
  - `.gitignore` への示唆: 現時点では `.vitest/` を足しても害はないが、**実際に効いているのは
    `coverage/` と `node_modules/`**。CI 設定で成果物パスを直書きしている場合、
    今回の範囲では 4.1 と 5 で出力先は変わらなかった。
  - ログ: `v5-filter-and-artifacts.log`

- [x] 4-4. 修正後に 5RC で全テスト緑を確認（見積もり 15分 → 実測 1分未満）
  - 実行したコマンド: `npx vitest run 2>&1 | tee logs/.../v5-fixed-green.log`
  - 出力（全文）:
    ```
     RUN  v5.0.0-rc.1 /Users/.../fixtures/vitest5-rc-breaking-changes

     Test Files  8 passed (8)
          Tests  9 passed (9)
       Start at  04:22:39
       Duration  1.51s (transform 45%, import 32%, worker 13%, tests 11%)
    ```
    終了コード `0`。**8ファイル / 9テストすべて緑**（項目Fに厳密一致の検証を1件足したため 8 → 9）。
  - **4.1 ベースラインとの実行時間の差**:
    ```
    4.1.10 : Duration  1.45s (transform 983ms, setup 0ms, import 1.61s, tests 166ms, environment 17ms)
    5.0.0-rc.1 : Duration  1.51s (transform 45%, import 32%, worker 13%, tests 11%)
    ```
    1.45s → 1.51s。テスト1件増えた分を考えるとほぼ同等で、**この規模では速度差は語れない**。
  - 副次的な発見: **`Duration` の表示形式そのものが変わった**。4.1 は絶対値（`transform 983ms`）、
    5 は割合（`transform 45%`）。ログを機械パースしている場合はここも壊れる。

### フェーズ5: 振り返り・記事化準備（見積もり 60分 → 実測 約1分）

- [x] 5-1. A〜H の結果表を埋める（後述「項目別の結果表」）
- [x] 5-2. 詰まりポイント表との突き合わせ（後述「詰まった点と解決過程」）
- [x] 5-3. 移行チェックリストの作成（後述）
- [x] 5-4. 記事への写像の充填（後述）

## 項目別の結果表（完了条件4）

| 項目 | 破壊的変更 | 4.1.10 の結果 | 5.0.0-rc.1 の結果 | 落ちた理由 | 直し方 | ガイドの該当箇所 |
|---|---|---|---|---|---|---|
| A | 未await の非同期assertion | ✅ 緑。**警告も出ない** | ❌ 失敗（Failed Tests） | await されない assertion をテスト失敗として扱うようになった | テストを `async` にして `await expect(...)` | "Unawaited Asynchronous Assertions Fail the Test" |
| B | `clearMocks` 既定 true | ✅ 緑（履歴 `1`） | ❌ 失敗（`expected +0 to be 1`） | 各テスト前に `vi.clearAllMocks()` が走り `beforeAll` の履歴が消える | 新既定に合わせる or config に `clearMocks: false`（**CLI フラグは無い**） | "`clearMocks` is Enabled by Default" |
| C | `-t` の区切りが `' > '` | `'math adds'` ✅ / `'math > adds'` ⬜ skipped | `'math adds'` ⬜ skipped / `'math > adds'` ✅ | suite チェーンとテスト名を `' > '` で連結したフルネームに照合 | `-t` のパターンを `' > '` 区切りに書き換える | "`testNamePattern` Matches the `>`-Joined Full Name" |
| D | `vi.mock` トップレベル必須 | ⚠️ 緑だが**警告あり**（"will become an error in a future version"） | ❌ **Failed Suites**（ファイルごと読込失敗、`(0 test)`） | 関数内の `vi.mock` が警告からエラーに昇格 | `vi.mock` をモジュールのトップレベルへ移動 | "Hoisted Mocking Calls Must Be at the Top Level" |
| E | `test.sequential` 削除 | ✅ 緑。**deprecation 警告なし** | ❌ **Failed Suites**（`TypeError: test.sequential is not a function`） | API が削除された | `test('...', { concurrent: false }, fn)` | "Removed `test.sequential`, `describe.sequential`, and `sequential` Options" |
| F | `toThrow('')` が任意一致 | ✅ 緑（`.not.toThrow('')` の形で書いた） | ❌ 失敗（`expected [Function boom] to throw error not including ''`） | 空文字が全メッセージに含まれるため任意一致に変わった | 空文字マッチに頼らず `toThrow(/^$/)` 等で意図を明示 | "`toThrow(\"\")` Matches Any Error Message" |
| G | 成果物が `.vitest/` へ | `.vitest/` なし（reporter は指定パス、cache は `node_modules/.vite`） | **再現せず**。`.vitest/` は作られない（reporter / junit / coverage / cache の4経路で確認） | — | — | "Generated Reports and Artifacts Use the `.vitest` Directory"（記述はあるが今回の経路では観測できず） |
| H | worker/pool ID が1始まり | `VITEST_WORKER_ID=0` / **`VITEST_POOL_ID=1`** | `VITEST_WORKER_ID=1` / `VITEST_POOL_ID=1` | WORKER_ID が 0→1 始まりに。**POOL_ID は 4.1 の時点で既に 1 始まり**だった | ID を 0 前提で計算している箇所（配列添字・ポート番号採番など）を見直す | "Worker and Concurrency Ids Are 1-based" |

**8項目のうち、実際に落ちたのは A・B・D・E・F の5項目**。C は「落ちる」のではなくフィルタの
マッチ先が入れ替わる（**しかも終了コード0のまま**）。G は再現せず。H は挙動は変わったが片方だけだった。

## 詰まった点と解決過程（記事の核）

| # | 詰まった点 | 原因 | 効いた対処 | 所要 | 解決/撤退 | 記事での活かし方 |
|---|---|---|---|---|---|---|
| 1 | **`npm i -D vitest@5.0.0-rc.1` が `Cannot read properties of null (reading 'edgesOut')` で落ちる** | npm 10.9.2 の arborist が vitest 5 の13個の optional peer を再帰解決する途中で null ノードを触る。**空ディレクトリでも再現**し、4.1.10 は通る | `--legacy-peer-deps` を付ける（3秒で完了）。切り分けは npm デバッグログの `verbose stack` と、空の一時ディレクトリでの最小再現 | 3分 | **解決** | 記事の実質的な山場。「RC を試す最初の壁がテストコードではなく npm だった」。エラー文が npm 内部の TypeError で何も教えてくれない点、最小再現の取り方まで書く |
| 2 | 項目G+H で 4.1 のベースラインが落ちた（`expected '1' to be '0'`） | **`VITEST_POOL_ID` は 4.1 の時点で既に `1` 始まり**。「両方0始まり」という前提が誤りだった。加えて suite 並列実行だと worker id が実行状況に依存する | 値の assert をやめて `console.log` で記録し、比較は `--maxWorkers=1` の単独実行ログで行う方式に変更 | 2分 | **解決** | 「移行ガイドの記述を自分の環境で確かめると、変わったのは片方だけだった」という一次情報。詰まりポイント表 #7 の的中例 |
| 3 | 項目Fを素直に書くと 4.1 のベースラインが緑にならない | `toThrow('')` は 4.1 では空メッセージのみ一致するため、`boom` に当てると落ちる | 4.1 側を `.not.toThrow('')` の形で書き、5 でその `not` が落ちるのを観測する設計にした | 1分未満 | **解決**（事前予測どおり） | 詰まりポイント表 #3 が的中。「ベースラインを全部緑にする」という制約が fixture 設計を歪める話 |
| 4 | 項目G（`.vitest/`）が再現しない | ガイドには明記があるが、reporter（json / junit）・coverage・cache のどの経路でも `.vitest/` が作られなかった | 4経路を試して記録。**再現しなかったと正直に書く**方針に切替 | 1分 | **未解決（仕様確認どまり）** | 詰まりポイント表 #6 の「どこまでが仕様でどこからが RC の揺れか分からない」の実例。落ちなかったものを落ちたことにしない姿勢の見せ場 |

### 事前に予測していた詰まりと、実際に起きた詰まりのズレ

| 詰まりポイント表 | 予測 | 実際 |
|---|---|---|
| #1 Vite のバージョン要件で落ちる | 起きると予測 | **起きなかった**。`npm i -D vitest@4.1.10 vite` で最初から `vite@8.2.1` が入り、5 の要件も満たしていた |
| #2 Node のバージョンで起動しない | 起きると予測 | **起きなかった**。v22.17.0 が `>=22.12.0` を満たす |
| #3 項目Fを4.1で緑にできない | 起きると予測 | **的中**。`.not` を挟む工夫で回避 |
| #4 項目Bで差が出ない | 起きると予測 | **起きなかった**。config を書かず `beforeAll` に置く指針どおりにしたら一発で差が出た |
| #5 項目Cで常にマッチ0件 | 起きると予測 | **起きなかった**。`describe` でネストさせたのできれいに2×2が取れた |
| #6 RC の揺れと破壊的変更の区別がつかない | 起きると予測 | **的中**（項目G）。ガイドに記述はあるのに再現しない、という形で出た |
| #7 項目G/H が pool 設定に依存して再現しない | 起きると予測 | **的中**（詰まり#2）。並列実行で worker id が変わるため単独実行に切り替えた |
| **（表になかった）npm 自体がクラッシュする** | **予測できていなかった** | **最大の詰まりがこれ**。バージョン要件表は Node と Vite しか見ておらず、npm は盲点だった |

## 4.1 → 5 で自分のテストを直すときのチェックリスト（コピペ用）

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

> 注記: すべて `5.0.0-rc.1`（2026-08-11 公開）での実測。安定版で挙動が変わる可能性がある。

## スクリーンショット一覧

なし（0枚）。本タスクはブラウザ表示を伴わない CLI 検証のため、対象タスクファイルの明示方針どおり
Playwright は使わず、完了判定は `npx vitest run` の出力全文と終了コードで行った。
記事に貼るのは**ターミナル出力のコードブロック**になる。

## 記事への写像（実績で埋める）

| 記事の見出し | 使う記録 / ログ | 書くこと（メモ） |
|---|---|---|
| 1. はじめに（Vitest 5 が RC になった） | フェーズ1-2 の `npm view` 出力全文 | `latest: 4.1.10` / `rc: 5.0.0-rc.1` の dist-tags をそのまま貼る。公開日は 4.1.10 が 2026-07-06、RC が 2026-08-11 |
| 2. なぜ RC のうちに踏んでおくのか | フェーズ1-1 / 1-4 | 破壊的変更は**全24項目**、そこから新人のテストに効く**8項目に絞った**基準。1-4 の予想表を先に見せて、後半で答え合わせにする |
| 3. 事前に調べたこと | フェーズ1-2 / 1-3 の照合表 | Node `^22.12.0 \|\| ^24 \|\| >=26` / Vite `^6.4.0 \|\| ^7 \|\| ^8` の要件表と手元環境の照合。**「npm は要件表に載っていない」を伏線として置く** |
| 4. 環境構築（4.1 の fixture を作る） | フェーズ2 全体 + `versions.log` + `v4-green.log` | `npm i -D vitest@4.1.10 vite` は peer 警告ゼロで通る。`versions.log` 全文を「再現環境」として貼る。ベースライン `8 passed (8)` / exit 0 |
| 5. 実際に試したこと（項目ごとの before/after） | フェーズ3-1〜3-7 + `v5-first-run.log` + `migration.diff` | 項目ごとに「テストコード → 4.1 の出力 → 5RC のエラー全文 → 修正 diff」。**D と E は Failed Suites でファイルごと落ちる**（`(0 test)`、テスト件数が 8→6 に減る）ことを強調 |
| 6. 詰まった点 | 「詰まった点」表 + `npm-edgesout-error.log` | **npm の edgesOut クラッシュを最大の山場として全文＋切り分け表で書く**。加えて項目F の `.not` の工夫（#3）と項目G の再現せず（#4） |
| 7. 触ってみて分かったこと | 「項目別の結果表」 | **8項目中、実際に落ちたのは5項目**。C は落ちずにフィルタが入れ替わるだけ（終了コード0）、G は再現せず、H は POOL_ID が元から1始まりで変化なし。**落ちなかったものを落ちたと書かない** |
| 8. 4.1 と比べて感じたこと | フェーズ4-2 / 4-3 / 4-4 | `-t` の 2×2 表（きれいに反転）、`.vitest/` が出なかった4経路の表、実行時間 1.45s → 1.51s（差は語れない）、**Duration の表示形式が絶対値→割合に変わった**副次発見 |
| 9. どんな人が先に確認しておくべきか | チェックリスト + 項目C の知見 | **CI で `-t` を使っている人が最優先**（マッチ0件でも緑で通るため事故に気づけない）。次に `beforeAll` でモック履歴を検証している人、`vi.mock` を関数内で呼んでいる人 |
| 10. まとめ（移行チェックリスト） | 「チェックリスト（コピペ用）」 | そのまま転記。**RC である旨・検証日 2026-08-17・検証バージョンの注記を必ず添える** |

## 未達・撤退した項目

- **項目G（成果物が `.vitest/` へ）: 未達（再現せず）**
  - 理由: reporter（json）・reporter（junit）・coverage・cache の4経路を試したが、
    5.0.0-rc.1 で `.vitest/` は生成されなかった。移行ガイドには記述がある。
    今回触っていない成果物（Browser Mode / スナップショット等）が対象か、RC 時点で未実装かは**未確認**。
  - 残したログ: `v5-filter-and-artifacts.log`（4経路すべての `find` / `ls` 出力を収録）

その他の撤退・スキップはなし。フェーズ1〜5のすべてのタスクを実行した
（時間超過による 4-2 / 4-3 / 3-7 の切り落としは発動しなかった）。

## 再現性メモ（記事に転記する用）

- OS / ランタイム / 主要ライブラリのバージョン:
  - macOS 26.5 (Darwin 25.5.0, arm64)
  - Node.js v22.17.0 / npm 10.9.2
  - Vite 8.2.1
  - Vitest 4.1.10（ベースライン） → 5.0.0-rc.1（検証対象）
  - `@vitest/coverage-v8` 5.0.0-rc.1（項目G の確認にのみ使用）
  - 検証日: 2026-08-17
- 実行コマンドの並び（最短の再現手順）:
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
- 注意点（バージョン依存・ハマりどころ）:
  - **npm 10.9.2 では `vitest@5.0.0-rc.1` がそのまま入らない**（`edgesOut` エラー）。`--legacy-peer-deps` が必要。
    5.0.0-beta.7 でも同様。4.1.10 は問題なく入る。npm を新しくすれば解消する可能性があるが未検証。
  - `VITEST_WORKER_ID` は**並列実行数に依存して変わる**。値を比較するなら `--maxWorkers=1` で単独実行すること。
  - 通常実行では `console.log` が既定レポータに出ないことがある。値を見たいときは `--reporter=verbose` を付ける。
  - `-t` のマッチが0件でも**終了コードは0**（`1 skipped` になるだけ）。CI で気づけないので注意。
  - `--clearMocks` という CLI フラグは存在しない。設定ファイル（`test.clearMocks`）で指定する。
  - 結論はすべて `5.0.0-rc.1` 時点のもの。安定版で変わる可能性がある。

## 次のアクション（記事化）

- [ ] この execution-log.md の「記事への写像」に沿って `articles/vitest5-rc-breaking-changes.md` を作成する
- [ ] スクショは無し。ターミナル出力のコードブロックを主軸に構成する
- [ ] 完了条件・詰まった点（特に npm の edgesOut）・4.1 との比較を本文に落とす
- [ ] RC である旨と検証日・検証バージョンの注記を忘れずに入れる

## 生成物の所在

```
logs/run-vitest5-rc-breaking-changes-20260817-0412/
├── execution-log.md                 ← 本ファイル（記事の素材）
├── commands.log                     ← フェーズ1〜2 の実行コマンドと生ログ
├── versions.log                     ← 再現環境（記事にそのまま貼る）
├── v4-per-item.log                  ← 4.1.10 での項目別実行ログ（項目A に警告が無い根拠）
├── v4-filter.log                    ← 4.1.10 での -t 2パターン
├── v4-gh-single.log                 ← 4.1.10 での worker/pool ID と JSON reporter
├── v4-green.log                     ← 【完了条件1】4.1.10 ベースライン全緑
├── npm-edgesout-error.log           ← 【詰まり#1】npm デバッグログ全文と切り分け6試行
├── v5-first-run.log                 ← 【完了条件2】5RC 無修正での失敗全文
├── v5-filter-and-artifacts.log      ← 5RC の -t 2パターン / .vitest 4経路 / clearMocks 逃げ道
├── v5-fixed-green.log               ← 【完了条件3】5RC 修正後の全緑
├── migration.diff                   ← 【完了条件3】項目ごとの before/after 差分
├── screenshots/                     ← 空（CLI 検証のため）
└── workspace/
    ├── test-v4-baseline/            ← 4.1 で全緑だったテストソース一式
    ├── test-v5-fixed/               ← 5RC で全緑にしたテストソース一式
    ├── package.v4.json
    └── package.v5.json

fixtures/vitest5-rc-breaking-changes/   ← 実際に動かした fixture（現在は 5RC 修正後の状態）
knowledge/2026-08-17-npm-edgesout-crash-installing-vitest5.md   ← 新規ナレッジ
```
