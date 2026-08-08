# 検証ログ: Node 26.7 の `--test-coverage-include-all` で「テストされていないファイル」を炙り出す

> Zenn記事の素材。実行の一次情報（コマンド・エラー全文・所要時間・出力全文）を記録。
> 記事本文は未執筆。「記事への写像」を見て articles/*.md に展開する。

## 実行の前提（採用した前提）

- 対象タスク: `practice/practice-node-test-coverage-include-all-20260809-0407.md`
- 出典レポート: `research/search-topic-20260809-0403.md`
- 対象技術: Node.js v26.7.0 標準テストランナー（`node --test`）のコードカバレッジ / `--test-coverage-include-all`
- 実行者: AIエージェント単独（非対話） <!-- 内部メタ: 記事に転記しない -->
- 実行日時 / 所要時間: 2026-08-09 04:10〜04:5x / 見積もり 3h45m → 実測 約 45 分 <!-- 実測はAI単独の値。記事にそのまま書かない -->
- 実行環境: macOS 26.5 / arm64（Apple Silicon）/ Node v26.7.0 と v26.5.0（nvm）/ c8 12.0.0
- 採用した撤退ライン: 対象タスク記載のものを採用（パターンCで未参照ファイルが 0% で出ない場合は30分で打ち切り、c8 のインストールが15分超なら「未検証」と明記）。**いずれにも抵触しなかった**
- 判断方針: 引数は対象タスクファイルのパスのみ指定。実行時間・撤退ライン・成果物置き場は未指定のため、時間は対象タスクの「半日」、撤退ラインは対象タスク記載、成果物置き場は Skill 既定の `logs/run-<slug>-<日時>/workspace/` を採用した（対象タスクは `practice-work/` を提案していたが、リポジトリを汚さない Skill 既定を優先した）
- ブラウザ確認要素は無いため Playwright は使用していない。完了確認はすべて CLI 出力とテキスト差分

## 結果サマリー

- 完了条件の判定: **達成**（完了条件5点すべて客観的に確認。詳細は下表）
- 作ったもの: 最小の検証リポジトリ（`workspace/`）。`src/` に4ファイル（テスト有り / import されるがテスト無し / どこからも未参照×2）、`test/greet.test.js` に2テスト。パターン別カバレッジ出力の全文 19 本と差分表（`workspace/results/summary.md`）
- スクショ: 0 枚（CLI 検証のみ。ブラウザ表示要素なし）
- 詰まった点: 3 件（うち解決 3 / 未解決・撤退 0）
- knowledge 記録: `knowledge/2026-08-09-zsh-nomatch-glob-argument.md`（新規、INDEX.md にも追記）

### 一番の収穫（★★ 予想を完全に外した箇所）

`--test-coverage-include-all` で追加される未参照ファイルは、**line だけ 0.00%、branch と funcs は 100.00%** として表に載る。
結果、`all files` 行は **line 78.95% → 26.79%（-52.16pt）と激減する一方、branch 83.33% / funcs 66.67% は 1pt も動かない**。
同じ構成に c8 12.0.0 の `--all` をかけると未参照ファイルは `0 / 0 / 0` で計上され、`All files` は line 26.78% / **branch 62.5%** / **funcs 40%** になる。
つまり **Node 標準の `--test-coverage-include-all` は line カバレッジの水増しは解消するが、branch / function カバレッジの水増しは解消しない**（検証時点の v26.7.0 での実測）。

## 完了条件の検証

| # | 完了条件 | 判定 | 根拠（ログ） |
|---|---|---|---|
| 1 | `--test-coverage-include-all` **なし**の出力に `src/legacy-report.js` と `src/dead-branch.js` が現れない | **達成** | `workspace/results/A-baseline.txt` / `B-include.txt`（表は `format.js` と `greet.js` の2行のみ） |
| 2 | `--test-coverage-include-all` **あり**の出力に上記2ファイルが 0% で現れる | **達成（ただし部分的）** | `workspace/results/C-include-all.txt`（`dead-branch.js  0.00 / 100.00 / 100.00`、`legacy-report.js  0.00 / 100.00 / 100.00`）。**0% になるのは line のみ**という重要な差異を確認 |
| 3 | 上記2パターンの総カバレッジ率（all files 行）の数字の落差が記録されている | **達成** | `line 78.95% → 26.79%（-52.16pt）` / branch・funcs は不変。`workspace/results/summary.md` |
| 4 | Node 26.5.0 で同じコマンドを実行したときの `node: bad option: ...` が全文で記録されている | **達成** | `workspace/results/E-node26.5.txt`（全文＋`exit=9`） |
| 5 | `results/` に各パターンの出力全文（txt）と差分表が残っている | **達成** | `workspace/results/` に 19 ファイル（txt 18 + `summary.md`）。`commands.log` に全文を連結済み |

## タスク実行ログ（フェーズ別）

### フェーズ1: 事前調査（見積もり 25分 → 実測 約6分）

- [x] v26.7.0 のリリースノートで該当 PR (#64830) と SEMVER-MINOR 表記を確認（見積もり 10分 → 実測 約2分）
  - 実行: `https://github.com/nodejs/node/releases/tag/v26.7.0` を取得
  - 得られた一次情報:
    - リリース日: **2026-08-05**
    - Notable Changes（全項目）:
      - "support loading private keys through STORE loaders" (SEMVER-MINOR) [#63949]
      - "update root certificates to NSS 3.125" [#64746]
      - "add perfetto support" (SEMVER-MINOR) [#64565]
      - "implement `Symbol.dispose` in `ModuleHooks`" (SEMVER-MINOR) [#63928]
      - **"add support for `--test-coverage-include-all`" (SEMVER-MINOR) [#64830]**
  - 記事に書きたい気づき: 目玉は perfetto サポートで、カバレッジのフラグは Notable Changes の最後に1行あるだけ。地味だが CI の数字を直接動かすという意味では影響が大きい。

- [x] Issue #58887 を読み、問題を1〜2行にまとめる（見積もり 10分 → 実測 約2分）
  - 得られた一次情報（引用）:
    - > "the reported 'all files' coverage percentage can easily go up, even when actual coverage has gone down (i.e., because a new file was introduced with no tests at all)."
    - > "every file then gets run as a test file, which is a lot of extra overhead, as these files don't actually have any tests."（従来の回避策＝全ファイルを `node --test` に渡す、の欠点）
    - Istanbul / nyc の `--all` が参照モデルとして挙がっている
  - 自分の言葉での要約: **「テストが1行も無いファイルを追加すると、カバレッジ率が下がるどころか上がってしまう」**。分母に載らないファイルは存在しないのと同じ扱いになるため。
  - 記事に書きたい気づき: 「なぜこの技術を試すのか」にそのまま使える。カバレッジが上がったのに品質は下がっている、という反直感が導入になる。

- [x] `node --help | grep -i coverage` を 26.7.0 と 26.5.0 で実行し diff（見積もり 5分 → 実測 約2分）
  - 実行したコマンド:
    ```bash
    ~/.nvm/versions/node/v26.7.0/bin/node --help 2>&1 | grep -i coverage | tee results/help-26.7.txt
    ~/.nvm/versions/node/v26.5.0/bin/node --help 2>&1 | grep -i coverage | tee results/help-26.5.txt
    diff results/help-26.5.txt results/help-26.7.txt
    ```
  - 出力（26.7.0、全文）:
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
  - diff（全文）:
    ```
    8a9,10
    >   --test-coverage-include-all include source files that were never
    >                               loaded in the coverage report
    ```
  - 確認できた事実: **v26.7.0 でもカバレッジ本体は `--experimental-test-coverage` のまま**（experimental が外れていない）。一方 `--test-coverage-include-all` 自体には `--experimental-` 接頭辞が付いていない。
  - 保存したログ: `workspace/results/help-26.7.txt` / `help-26.5.txt`

### フェーズ2: 環境構築（見積もり 35分 → 実測 約8分）

- [x] 検証リポジトリの骨格を作る（見積もり 10分 → 実測 約3分）
  - `package.json` は `{"type":"module"}`。ESM で `import` を書くため（`.mjs` にせず `.js` のままにしたかった）。
  - ディレクトリツリー（`find . -type f`、`node_modules` 除く / `results/` 生成後）:
    ```
    ./package.json
    ./src/dead-branch.js
    ./src/format.js
    ./src/greet.js
    ./src/legacy-report.js
    ./test/greet.test.js
    ```
  - 行数（`wc -l`）:
    ```
          24 src/dead-branch.js
          11 src/format.js
           8 src/greet.js
          13 src/legacy-report.js
          11 test/greet.test.js
          67 total
    ```

- [x] 3種類のソースファイルを書く（見積もり 15分 → 実測 約3分）
  - `src/greet.js`（テスト対象・分岐1つ）:
    ```js
    import { capitalize } from './format.js';

    export function greet(name) {
      if (!name) {
        return 'Hello, world';
      }
      return `Hello, ${capitalize(name)}`;
    }
    ```
  - `src/format.js`（greet から import される。`shout` は誰も呼ばない）:
    ```js
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
  - `src/legacy-report.js`（どこからも未参照・関数3つ）:
    ```js
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
  - `src/dead-branch.js`（どこからも未参照・if/else と switch）:
    ```js
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
  - **実行前に書いた期待カバレッジ（予想）**（`workspace/NOTES.md` に記録済み）:
    - `src/greet.js`: 100 / 100 / 100
    - `src/format.js`: funcs 50% 前後、lines 70% 前後
    - `src/legacy-report.js`: **0 / 0 / 0**
    - `src/dead-branch.js`: **0 / 0 / 0** ← ここを外した（後述）
  - 未参照であることの確認:
    ```bash
    grep -rn "legacy-report\|dead-branch" --include='*.js' .
    # → 0 hits
    ```

- [x] `test/greet.test.js` を書いて `node --test` が緑になることを確認（見積もり 10分 → 実測 約2分）
  - コード:
    ```js
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
  - 出力（全文）:
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
  - 設計意図: **あえて `format.js` と未参照2ファイルのテストを書かない**。これで「テストされていない部分」の3段階（部分的にテスト済み / import されるが未テスト / そもそも未参照）が1つの表に並ぶ。

### フェーズ3: 実装・検証【本編】（見積もり 100分 → 実測 約15分）

すべて `workspace/` を cwd として実行。`node` は `~/.nvm/versions/node/v26.7.0/bin/node`。

- [x] パターンA: ベースライン（見積もり 15分 → 実測 約3分）
  - 実行したコマンド:
    ```bash
    node --test --experimental-test-coverage
    ```
  - 出力（カバレッジ部・全文）:
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
    exit=0
  - **未参照2ファイルは1行も出ない**（完了条件1）。`format.js` の未カバー行が `4-5 10-11`（`capitalize` の早期 return と `shout` 全体）と具体的に出るのは分かりやすい。
  - 予想 90% に対し実測 78.95%。`shout` が丸ごと未カバーな分だけ想定より低かった。
  - 保存したログ: `workspace/results/A-baseline.txt`

- [x] パターンB: `--test-coverage-include='src/**'` を足す（見積もり 15分 → 実測 約2分）
  - 実行したコマンド:
    ```bash
    node --test --experimental-test-coverage --test-coverage-include='src/**'
    ```
  - 結果: **A と完全に同じ**。`all files | 78.95 | 83.33 | 66.67`
  - `diff results/A-baseline.txt results/B-include.txt`（全文）:
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
    → **差分はテスト実行時間の行だけ**。カバレッジ表は1文字も違わない。
  - 記事に書きたい気づき: 「`--test-coverage-include` を書けば未テストファイルも拾ってくれるはず」という誤解が明確に否定される。**include は「読み込まれたファイルの絞り込み」でしかない**。これが Issue #58887 の核心。
  - glob のクォートについては後述の「詰まった点」#2 を参照（zsh ではクォート必須）。
  - 保存したログ: `workspace/results/B-include.txt`

- [x] パターンC: `--test-coverage-include-all` を足す（見積もり 20分 → 実測 約3分）
  - 実行したコマンド:
    ```bash
    node --test --experimental-test-coverage --test-coverage-include='src/**' --test-coverage-include-all
    ```
  - 出力（カバレッジ部・全文）:
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
    exit=0
  - **数字の落差（完了条件3）**: `all files` の line % が **78.95% → 26.79%（-52.16pt）**。表の行数は 2 → 4。
  - ★★ **予想を完全に外した点**: 未参照ファイルの表記は `0.00 / 0.00 / 0.00` ではなく **`0.00 / 100.00 / 100.00`**。`uncovered lines` は `1-24` / `1-13` とファイル全体を指しているのに、branch と funcs は満点。結果として `all files` の **branch 83.33% と funcs 66.67% は B から 1pt も動いていない**。
  - つまずいた理由・分かっていなかった前提: 「ファイルが読み込まれていない＝分岐も関数も0個実行」なら 0% だと思い込んでいた。実際は **分母（そのファイル内の分岐数・関数数）も 0 として扱われ、0/0 が 100% に丸められている**らしい挙動。V8 のカバレッジ情報がそもそも生成されていないファイルを、行数だけ後から数えて足しているように見える。
  - 記事に書きたい気づき: ここが記事の主役。「カバレッジが 78.95% → 26.79% に落ちた！」という見出しの裏で、**branch/funcs は嘘をつき続けている**。しきい値を lines だけでなく functions にも設定している CI では、include-all を入れても関数カバレッジの水増しは直らない。
  - 保存したログ: `workspace/results/C-include-all.txt`

- [x] パターンD: include を付けずに include-all だけ（見積もり 20分 → 実測 約4分）※ 対象タスクの「要確認」項目
  - 実行したコマンド:
    ```bash
    node --test --experimental-test-coverage --test-coverage-include-all
    ```
  - 結果: **C と完全一致**。`diff results/C-include-all.txt results/D-include-all-only.txt` の差分は実行時間の2行のみ:
    ```
    1,2c1,2
    < ✔ 名前があれば先頭を大文字にして挨拶する (2.784ms)
    < ✔ 名前が空なら world にする (0.306292ms)
    ---
    > ✔ 名前があれば先頭を大文字にして挨拶する (2.614958ms)
    > ✔ 名前が空なら world にする (0.314417ms)
    10c10
    < ℹ duration_ms 305.71175
    ---
    > ℹ duration_ms 280.96975
    ```
  - `test/greet.test.js` は表に出ない → **テストファイルは既定で除外**というドキュメントの記述と実測が一致。
  - **追加検証 D2（cwd 探索が本当に cwd 全体か）**: ルート直下に `stray-root.js`、`scripts/tool.js` を置いて D を再実行した。
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
    → **探索は本当に cwd 全体**。`src/` の外の雑多な `.js` も全部 0% で計上され、率がさらに下がる（26.79% → 24.19%）。
  - **追加検証 C2（include との AND 条件）**: 同じ野良ファイルがある状態で `--test-coverage-include='src/**'` を付けると、表は `src/` の4ファイルだけに戻り `all files 26.79%`。→ **include-all で集めた候補にも include フィルタが AND で効く**（ドキュメントどおり）。
  - **追加検証 K1（`node_modules/` の既定除外）**: c8 導入後、`node_modules` 配下に 280 個の `.js` がある状態で D を再実行 → 表は `src/` の4ファイルのみ、`all files 26.79%` のまま。**node_modules は確実に除外される**。
  - 記事に書きたい気づき: **既存プロジェクトにいきなり `--test-coverage-include-all` だけを付けると、ビルドスクリプトや設定ファイルまで分母に入る**。実務では `--test-coverage-include` とセットで使うのが前提。
  - 保存したログ: `workspace/results/D-include-all-only.txt` / `D2-cwd-scan.txt` / `C2-include-filters-stray.txt` / `K-branch-funcs.txt`

- [x] パターンE: Node 26.5.0 で同じコマンド（見積もり 15分 → 実測 約1分）
  - 実行したコマンド:
    ```bash
    ~/.nvm/versions/node/v26.5.0/bin/node --test --experimental-test-coverage \
      --test-coverage-include='src/**' --test-coverage-include-all
    ```
  - 出力（**全文**）:
    ```
    /Users/katayamaryuunosuke/.nvm/versions/node/v26.5.0/bin/node: bad option: --test-coverage-include-all
    ```
    ```
    exit=9
    ```
  - **終了コードは 9**（Node の "invalid argument"）。テストは1件も走らない。
  - 記事に書きたい気づき: 読者が最初に踏む壁。エラーは1行だけでカバレッジの話は一切出ないので、**バージョンが原因だと気づきにくい**。`node -v` を先に確認する導線を記事に置く。記事に貼るときはパスを `~/` に置換する（絶対パスにユーザー名が入るため）。
  - 保存したログ: `workspace/results/E-node26.5.txt`

- [x] 5パターンの差分表を `results/summary.md` に書き起こす（見積もり 15分 → 実測 約2分）
  - 保存したログ: `workspace/results/summary.md`（予想 vs 実測の★印つき表を含む）
  - 1行まとめ:
    - `パターンA: all files = lines 78.95% / branch 83.33% / funcs 66.67% / 出たファイル数 2`
    - `パターンB: all files = lines 78.95% / branch 83.33% / funcs 66.67% / 出たファイル数 2`
    - `パターンC: all files = lines 26.79% / branch 83.33% / funcs 66.67% / 出たファイル数 4`
    - `パターンD: all files = lines 26.79% / branch 83.33% / funcs 66.67% / 出たファイル数 4`
    - `パターンE: 実行不可（node: bad option: --test-coverage-include-all / exit 9）`

### フェーズ4: 深掘り・比較（見積もり 40分 → 実測 約10分）

- [x] `--test-coverage-lines` を B と C にかけて終了コードを比べる（見積もり 15分 → 実測 約4分）
  - 最初に 80 で試したが **B（78.95%）も落ちてしまい**、比較にならなかった。しきい値を 70 に変えて再実行。
  - 実行したコマンド:
    ```bash
    node --test --experimental-test-coverage --test-coverage-include='src/**' --test-coverage-lines=70
    node --test --experimental-test-coverage --test-coverage-include='src/**' --test-coverage-include-all --test-coverage-lines=70
    ```
  - 結果:

    | コマンド | all files line % | exit |
    |---|---|---|
    | B + `--test-coverage-lines=70` | 78.95 | **0（緑）** |
    | C + `--test-coverage-lines=70` | 26.79 | **1（赤）** |
    | C + `--test-coverage-lines=26` | 26.79 | 0 |
    | C + `--test-coverage-lines=27` | 26.79 | 1 |
    | B + `--test-coverage-lines=80` | 78.95 | 1 |
    | C + `--test-coverage-lines=80` | 26.79 | 1 |

  - しきい値未達時のメッセージ（全文の該当行）:
    ```
    ℹ Error: 26.79% line coverage does not meet threshold of 70%.
    ```
    出力位置は `duration_ms` の直後・カバレッジ表の**前**。表より先にエラーが出る。
  - ★ **funcs しきい値では落ちない**:

    | コマンド | funcs % | exit |
    |---|---|---|
    | B + `--test-coverage-functions=60` | 66.67 | 0 |
    | C + `--test-coverage-functions=60` | 66.67 | **0** |
    | c8 `--all --check-coverage --functions 60` | **40** | **1** |

  - 記事に書きたい気づき: 「include-all を入れた瞬間に CI が赤くなる」は **lines しきい値でだけ起きる**。段階的な導入としては、まず include-all 無しの現状値を測り、include-all 有りの値まで一度しきい値を下げてから徐々に上げる、という手順が現実的。
  - 保存したログ: `workspace/results/G-threshold.txt` / `H-threshold70-full.txt` / `K-branch-funcs.txt`

- [x] c8 との比較（見積もり 25分 → 実測 約6分）
  - インストール:
    ```bash
    npm install -D c8 --yes
    # added 55 packages, and audited 56 packages in 6s
    # 18 packages are looking for funding
    # found 0 vulnerabilities
    # elapsed: 9s
    ```
    c8 実バージョン **12.0.0**。`node_modules` は **9.6M / 55 packages**（撤退ラインの15分に対し9秒。余裕で通過）。
  - 実行したコマンド:
    ```bash
    npx c8 --src src node --test
    npx c8 --all --src src node --test
    ```
  - `npx c8 --src src node --test`（--all なし）:
    ```
    -----------|---------|----------|---------|---------|-------------------
    File       | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
    -----------|---------|----------|---------|---------|-------------------
    All files  |   78.94 |    83.33 |   66.66 |   78.94 |
     format.js |   63.63 |    66.66 |      50 |   63.63 | 4-5,10-11
     greet.js  |     100 |      100 |     100 |     100 |
    -----------|---------|----------|---------|---------|-------------------
    ```
  - `npx c8 --all --src src node --test`（--all あり）:
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
  - **比較表**:

    | | Node 標準（パターンC） | c8 12.0.0 `--all` |
    |---|---|---|
    | 出るファイル | 同じ4ファイル | 同じ4ファイル |
    | line (stmts) % | 26.79 | 26.78 |
    | branch % | **83.33** | **62.5** |
    | funcs % | **66.67** | **40** |
    | 未参照ファイルの行 | `0.00 / 100.00 / 100.00` | `0 / 0 / 0` |
    | `--functions 60` しきい値 | 通る（exit 0） | 落ちる（exit 1） |
    | 小数の丸め | 26.79（四捨五入） | 26.78（切り捨て） |
    | 追加インストール | 不要 | 55 packages / 9.6M / 9秒 |
    | 除外指定 | `--test-coverage-exclude` | `--exclude` |
    | 対象の指定 | cwd 探索 + `--test-coverage-include` | `--src` + `--include` |

  - **既存技術と比べて感じた違い（この記事の結論部）**: 「どのファイルを表に出すか」は Node 標準でも c8 `--all` でも同じ結果になり、line カバレッジの数字もほぼ一致した（26.79 vs 26.78、丸め方の違いのみ）。しかし **未参照ファイルの branch / funcs の扱いが真逆**で、`--test-coverage-functions` のようなしきい値を使っている場合は挙動が変わる。「c8 をやめて標準機能に置き換えられるか」は、**lines しきい値だけを見ているなら置き換えられそう / functions・branches しきい値も見ているなら現時点ではまだ差がある**、という所感（experimental なので将来変わる可能性あり。断定はしない）。
  - 実行時間の体感差: どちらも1秒未満で、この規模では差を感じられなかった（`duration_ms` は Node 標準 265〜305ms / c8 経由 265〜297ms でほぼ同じ）。
  - 保存したログ: `workspace/results/I-c8-install.txt` / `J-c8-compare.txt` / `K-branch-funcs.txt`

### フェーズ5: 振り返り・記事化準備（見積もり 25分 → 実測 約6分）

- [x] 詰まった点を時系列で棚卸し（下表）
- [x] 「記事への写像」を実績で埋める（下記）
- [x] 新規トラブルを knowledge に記録: `knowledge/2026-08-09-zsh-nomatch-glob-argument.md`

## 詰まった点と解決過程（記事の核）

| # | 詰まった点 | 原因 | 効いた対処 | 所要 | 解決/撤退 | 記事での活かし方 |
|---|---|---|---|---|---|---|
| 1 | `grep -rn "..." --include=*.js .` が `(eval):4: no matches found: --include=*.js` で、grep が起動すらせず落ちた | zsh の `nomatch` が既定 on。`--include=*.js` という語全体が glob として評価され、マッチしないためコマンド実行前にエラーになる（bash は素通し） | glob をシングルクォートで囲む → `--include='*.js'` | 約2分 | **解決** | 「詰まりポイント表 #3」の予測が、node ではなく先に grep で発現した。zsh/bash の差を対照実験で見せる |
| 2 | 同じ理由で `--test-coverage-include=src/**` もクォート無しだと zsh で死ぬ | 同上 | `--test-coverage-include='src/**'` | 約2分（#1 の知見をそのまま適用） | **解決** | 対照実験の全文を貼れる: zsh は `zsh:1: no matches found`（exit 1）、bash は素通しでカバレッジ表が出て exit 0。**macOS の既定シェルは zsh なので、記事のコマンド例はクォート必須** |
| 3 | `--test-coverage-lines=80` で B / C の差を見せようとしたら、**B（78.95%）も落ちて**しきい値比較にならなかった | サンプルの baseline が 80% を割っていた（`shout` 未使用の分だけ想定より低かった） | しきい値を 70 に変更。さらに 26 / 27 で境界も確認 | 約3分 | **解決** | 「実務インパクトを見せるつもりが、サンプルの数字が悪くて成立しなかった」失敗として書ける。境界値（26 通る / 27 落ちる）まで詰めた記録も残せる |

**予測（詰まりポイント表）と実際の差分**:
- 予測どおり踏んだ: #3（glob のクォート）。ただし node ではなく **grep で先に踏んだ**
- 予測したが踏まなかった: #1（`bad option`。意図的に E で再現しただけ）、#2（`--experimental-test-coverage` の付け忘れ）、#4（include-all で期待ファイルが出ない）、#7（出力が長すぎる）
- **予測していなかった大物**: #5「未参照ファイルが 0% 以外で出る」は、予測では「ESM の副作用で読み込まれている」を疑う想定だった。実際は **line だけ 0%、branch/funcs は 100%** という仕様側の挙動で、想定していた原因とはまったく別だった。★★ ここが記事の見せ場

## スクリーンショット一覧

なし（CLI 検証のみでブラウザ表示要素が無いため、Playwright は使用していない）。
完了確認の証拠はすべて `commands.log` と `workspace/results/*.txt` のテキスト出力。

## 記事への写像（実績で埋める）

| 記事の見出し | 使う記録 | 書くこと（メモ） |
|---|---|---|
| 1. はじめに | `workspace/results/env.txt` | Node v26.7.0 / macOS 26.5 / arm64 を明記。「新フラグを1つだけ試した」宣言。過去記事 `node-test-randomize-seed-extraction.md` との差分（同じ `node --test` だが軸はカバレッジ）を冒頭で1行 |
| 2. なぜこの技術を試すのか | フェーズ1・Issue #58887 の引用 | 「テストが1行も無いファイルを追加すると、カバレッジ率が下がるどころか上がる」を自分の言葉で。原文2箇所を引用 |
| 3. 事前に調べたこと | フェーズ1全体 / `results/help-26.7.txt` / `help-26.5.txt` の diff | リリース日 2026-08-05、PR #64830（SEMVER-MINOR）、`node --help` の1行説明の原文、**v26.7 でもカバレッジ本体は `--experimental-test-coverage` のまま**という事実、nyc `--all` との関係 |
| 4. 環境構築（最小プロジェクトの構成） | フェーズ2ログ / `results/tree.txt` / `loc.txt` | ディレクトリツリーと4ファイルのコード**全文**（execution-log に貼ってあるものをそのまま）。3種類を作った意図 |
| 5. 実際に試したこと（パターン比較） | フェーズ3の A〜E / `results/summary.md` | **主役は `78.95% → 26.79%（-52.16pt）`**。A→B の diff（実行時間の行だけ）を貼って「include だけでは何も変わらない」を示す。C の表全文。E の `bad option` 全文（パスは `~/` に置換） |
| 6. 詰まった点 | 「詰まった点」表 #1〜#3 | 実際に踏んだ3件だけ。zsh の `no matches found` 全文と zsh/bash 対照、しきい値 80 で比較が成立しなかった話。踏まなかった項目は書かない |
| 7. 触ってみて分かったこと | フェーズ3の★印 / `results/C-include-all.txt` / `D2-cwd-scan.txt` | ★★ **未参照ファイルは `0.00 / 100.00 / 100.00`**、だから all files の branch/funcs は動かない。★ 探索は本当に cwd 全体（`stray-root.js` が拾われる `D2` の表を貼る）。test ファイルと node_modules は既定除外 |
| 8. 既存技術と比べて感じたこと | フェーズ4の比較表 / `results/J-c8-compare.txt` / `K-branch-funcs.txt` | c8 `--all` は `0/0/0` で計上 → All files branch 62.5% / funcs 40%。**`--functions 60` を付けると Node は通り c8 は落ちる**という決定的な差。「置き換えられるかは、lines だけ見るか否かで変わる」（断定しない） |
| 9. どんな人に向いていそうか | フェーズ4のしきい値表 | `node --test` を使っていてカバレッジの数字を信じている人。既存プロジェクトへの導入は「まず現状値を測る → include-all 有りの値までしきい値を下げる → 徐々に上げる」。`--test-coverage-include` とセットで使わないと設定ファイルまで分母に入る |
| 10. まとめ | 結果サマリー | 分かったこと3点（include だけでは足りない / line だけが正直になる / 探索は cwd 基準）＋ 次に試したいこと（候補#4 Node 26.6 の `context.log()` / `test:log`） |

## 未達・撤退した項目

なし。完了条件5点すべて達成し、フェーズ4（c8 比較）も撤退ラインに抵触せず完走した。

## 再現性メモ（記事に転記する用）

- OS / ランタイム / 主要ライブラリ: macOS 26.5 / arm64（Apple Silicon）/ Node **v26.7.0**（比較用に **v26.5.0**）/ c8 **12.0.0**
- 最短の再現手順:
  ```bash
  mkdir -p node-coverage-include-all/{src,test} && cd node-coverage-include-all
  echo '{"type":"module"}' > package.json
  # src/greet.js, src/format.js, src/legacy-report.js, src/dead-branch.js, test/greet.test.js を作る（本文のコード参照）

  # A: ベースライン
  node --test --experimental-test-coverage
  # B: include だけ（A と同じ結果になる）
  node --test --experimental-test-coverage --test-coverage-include='src/**'
  # C: include-all を足す（ここで line % が落ちる）
  node --test --experimental-test-coverage --test-coverage-include='src/**' --test-coverage-include-all
  # しきい値で CI が赤くなるのを見る
  node --test --experimental-test-coverage --test-coverage-include='src/**' --test-coverage-include-all --test-coverage-lines=70; echo "exit=$?"
  ```
- 注意点:
  - **`--experimental-test-coverage` は v26.7.0 でも必須**。`--test-coverage-include-all` だけでは表が出ない
  - v26.7.0 未満では `node: bad option: --test-coverage-include-all` で **exit 9**（テストは1件も走らない）
  - **glob は必ずシングルクォートで囲む**。zsh（macOS 既定）はクォート無しだと `no matches found` でコマンド自体を実行しない
  - `--test-coverage-include` を付けないと **cwd 全体**が探索対象になり、`src/` の外の `.js` も分母に入る（`node_modules/` とテストファイルは既定で除外される）
  - カバレッジ率はサンプル構成に完全依存する数字。**カバレッジ本体は experimental** なので、出力形式は将来変わり得る

## 次のアクション（記事化）

- [ ] この execution-log.md の「記事への写像」に沿って `articles/<slug>.md` を作成する
- [ ] スクショは無いので画像配置は不要（表とコードブロックのみ）
- [ ] 完了条件・詰まった点・c8 比較を本文に落とす。特に「line だけが正直になる」を主軸に据える
