# 検証ログ: Node 26.7 の `--test-coverage-include-all` を付けたら、カバレッジ率が 100% から 16.95% になった

> Zenn記事の素材。実行の一次情報（コマンド・エラー全文・所要時間）を記録。
> 記事本文は未執筆。「記事への写像」を見て articles/*.md に展開する。

## 実行の前提（採用した前提）

- 対象タスク: `practice/practice-node26-test-coverage-include-all-20260807-1354.md`
- 出典レポート: `research/search-topic-20260807-1349.md`
- 対象技術: Node.js 26.7.0 の `node:test` コードカバレッジ（`--experimental-test-coverage` + `--test-coverage-include-all`）
- 実行者: AIエージェント単独（非対話） <!-- 内部メタ: 記事に転記しない -->
- 実行日時 / 所要時間: 2026-08-07 13:57〜14:02 / 見積もり 375分（6h15m） → 実測 約5分 <!-- 実測はAI単独の値。記事にそのまま書かない -->
- 実行環境: macOS 26.5 (Darwin 25.5.0, arm64) / Node.js v26.7.0（対照実験に v26.5.0） / npm 11.19.0 / **依存パッケージ ゼロ**
- 採用した撤退ライン: 対象タスクの記載（1タスク30分／フェーズ3-2で90分／`nvm install` 失敗なら別テーマ）。**いずれにも到達しなかった**
- 判断方針: 引数で指定されたのは対象タスクファイルのパスのみ。時間・撤退ラインは未指定のため対象タスクの記載をそのまま採用。ブラウザ表示が無いため Playwright は使わず、CLI出力の全文保存を一次情報とした（対象タスクの明示どおり）

### 成果物の置き場（注意）

`logs/**/workspace/` は `.gitignore` で除外されるため、記事化で必要になる**ログ全文とコードを追跡対象にコピー**してある。

- `raw-logs/` … 検証で取った出力の全文（`without-flag.txt` など18ファイル）
- `code/` … 検証プロジェクトのソース（`src/` 7ファイル / `test/` 3ファイル / `runner.mjs` / `package.json`）
- `workspace/coverage-lab/` … 実行時の作業ディレクトリ本体（gitignore対象）

## 結果サマリー

- 完了条件の判定: **達成**（5条件すべてを一次ログで確認。下記「完了条件の検証」参照）
- 作ったもの: 依存ゼロの最小Nodeプロジェクト `coverage-lab`（`src/` 純関数7本 / `test/` テスト3本）。`code/` に全文あり
- スクショ: 0枚（ブラウザ表示が無い検証のため。**ログ全文が唯一のエビデンス**）
- 詰まった点: 3件（うち解決3 / 未解決・撤退 0）。ただし**「詰まった」より「事前の裏取りが実測で覆った」ことが本検証の中心**
- knowledge 記録: なし（環境エラー・ビルド失敗の類は一度も発生しなかったため、`save-knowledge` すべき新規トラブルなし。`consult-knowledge` を呼ぶ場面も発生しなかった）

### ヘッドラインの数値

| | 総合 line % |
|---|---|
| `node --test --experimental-test-coverage` | **100.00** |
| `+ --test-coverage-include-all` | **16.95** |

**△83.05ポイント。** テストを1行も書いていない3ファイル（計98行）が分母に入っただけ。

## 完了条件の検証

| # | 完了条件 | 判定 | 根拠（ログ） |
|---|---|---|---|
| 1 | `node --version` が `v26.7.0` を返す | 達成 | `commands.log`（`nvm install 26.7.0` → `Now using node v26.7.0 (npm v11.19.0)`） |
| 2 | フラグ無しの出力全文が保存され、テスト無しの3ファイルが表に現れない | 達成 | `raw-logs/without-flag.txt`。表は `add.js` / `formatDate.js` / `slugify.js` の3行のみ。`deepMerge.js` / `parseQuery.js` / `retry.js` は不在 |
| 3 | フラグ有りの出力全文が保存され、同3ファイルが 0% 行として現れる | 達成 | `raw-logs/with-flag.txt`。3ファイルとも `0.00` / `uncovered lines 1-34`, `1-32`, `1-32` |
| 4 | 2つの総合カバレッジ%を並べた差分表が `diff.md` にある | 達成 | `raw-logs/diff.md`（生diffは `raw-logs/diff.txt`） |
| 5 | `run()` API の `coverageIncludeAll: true` の出力があり、3と一致/不一致を判定できている | 達成 | `raw-logs/run-api.txt`。**数値は 15.04% で 16.95% と不一致**。ただし原因は判明済み（後述: `runner.mjs` 自身が対象に入るため）。挙動としては一致 |

## タスク実行ログ（フェーズ別）

### フェーズ1: 事前調査（見積もり45分 → 実測 約2分）

- [x] **1-1. v26.7.0 リリースノートの test_runner 項を原文で控える**
  - 参照: https://nodejs.org/en/blog/release/v26.7.0
  - Notable Changes / Commits の原文（そのまま引用可）:
    ```
    [a646319f61] - (SEMVER-MINOR) test_runner: add support for --test-coverage-include-all (avivkeller) #64830
    ```
  - 同リリースの他の test_runner コミット（記事の文脈用）:
    ```
    [4368303e01] - test_runner: wait for filtered suite build (semimikoh) #64208
    [70d11241a3] - test_runner: convert to uint during deserialization (Aviv Keller) #64706
    ```
  - 記事に書きたい気づき: `--test-coverage-include-all` は 26.7.0 の Notable Changes に**単独で載っている唯一の test_runner 項目**。SEMVER-MINOR 表記＝新機能追加である

- [x] **1-2. ドキュメントの既定値・説明文・"Added in" を控える**
  - `run()` の `coverageIncludeAll`（https://nodejs.org/api/test.html）— 原文:
    ```
    coverageIncludeAll <boolean> Includes source files that were never loaded by the test run
    in the coverage report, where they are reported as having zero coverage. Candidate files are
    searched for in cwd, and are subject to the same coverageIncludeGlobs and coverageExcludeGlobs
    filtering as the rest of the report. This property is only applicable when coverage was set to
    true. Default: false.
    ```
    → **この項目には固有の "Added in" 注記が無い**（HTMLをテキスト化して前後500文字を確認。`logs-doccheck.txt`）
  - CLI フラグ（https://nodejs.org/api/cli.html）— 原文:
    ```
    --test-coverage-include-all
    Added in: v26.7.0
    Stability: 1 - Experimental
    Includes source files that were never loaded by the test run in the coverage report, where they
    are reported as having zero coverage. Candidate files are searched for in the current working
    directory, and are subject to the same --test-coverage-include and --test-coverage-exclude
    filtering as the rest of the report.
    ```
  - include/exclude 同時指定の記述（原文）:
    ```
    If both coverageExcludeGlobs and coverageIncludeGlobs are provided, files must meet both
    criteria to be included in the coverage report.
    ```
  - **つまずいた理由・分かっていなかった前提**: 計画段階の裏取りでは「ドキュメントに `Added in: v23.0.0` とある」と読んでいた。実際に HTML を取得して当該箇所の前後を切り出したところ、**`coverageIncludeAll` に "Added in" は付いておらず、CLI 側は明確に `Added in: v26.7.0`** だった。v23.0.0 は近くにある別項目の注記を拾ってしまった可能性が高い。**「ドキュメントとリリースノートが矛盾している」という計画時の前提そのものが誤読だった**
  - 保存したログ: `logs-doccheck.txt`

- [x] **1-3. フラグの実在と正式名を `node --help` で確定させる**
  - 実行したコマンド:
    ```bash
    nvm install 26.7.0
    nvm use 26.7.0 && node --version && node --help | grep -i coverage
    nvm use 26.5.0 && node --version && node --help | grep -i coverage
    ```
  - 出力（全文 / v26.7.0）:
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
  - 出力（全文 / v26.5.0）:
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
  - **確定した3点**:
    1. `--test-coverage-include-all` は **26.7.0 に在り、26.5.0 に無い**（この2つの grep 出力の差分がそのまま証拠）
    2. 絞り込みフラグの正式名は **`--test-coverage-include` / `--test-coverage-exclude`**。**`-globs` は付かない**（計画で表記が割れていた点の決着。ただし `run()` API 側のオプション名は `coverageIncludeGlobs` / `coverageExcludeGlobs` で **`Globs` が付く** — CLI と API で名前が違うのが混乱の元）
    3. `--experimental-test-coverage` は **26.7 時点でもまだ必要**（`--test-coverage-include-all` は単体では効かない）
  - 記事に書きたい気づき: フラグ名の確定は `node --help | grep` 15秒で終わる。ネットの表記揺れを追うより速い

### フェーズ2: 環境構築（見積もり45分 → 実測 約1分）

- [x] **2-1 / 2-2. `coverage-lab/` と `src/` 6ファイルを作る**
  - `package.json` は `{"type":"module"}` の1行のみ。**`npm install` は一度も実行していない**（依存ゼロ）
  - `wc -l src/*.js`（フェーズ3時点 = 6ファイル）:
    ```
           7 src/add.js
          34 src/deepMerge.js
           6 src/formatDate.js
          32 src/parseQuery.js
          32 src/retry.js
           7 src/slugify.js
         118 total
    ```
  - 内訳: **テスト有り 3本**（`add.js` 7行 / `formatDate.js` 6行 / `slugify.js` 7行 = 計20行）、**テスト無し 3本**（`deepMerge.js` 34行 / `parseQuery.js` 32行 / `retry.js` 32行 = 計98行）
  - 記事に書きたい気づき: **この行数比（20 : 98）がそのまま下落幅を決める**。20/118 ≒ 16.95% で、実測値と一致する。構成を載せないと下落%の意味が伝わらない

- [x] **2-3. `node --test` が緑で通ることを確認**
  - 実行したコマンド:
    ```bash
    nvm use 26.7.0
    node --test 2>&1 | tee logs/tests-only.txt
    ```
  - 出力（全文）:
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
  - この時点では**カバレッジテーブルが一切出ていない**。詰まりポイント表#5（`--experimental-test-coverage` 付け忘れ）の「差分で気づく」ためのベースラインとして有効だった
  - 保存したログ: `raw-logs/tests-only.txt`

### フェーズ3: 実装・検証【本編】（見積もり165分 → 実測 約2分）

- [x] **3-1. フラグ無しでカバレッジを取る**
  - 実行したコマンド:
    ```bash
    node --test --experimental-test-coverage 2>&1 | tee logs/without-flag.txt
    ```
  - 出力（カバレッジ部の全文）:
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
  - **表に現れなかった3ファイル**: `src/deepMerge.js` / `src/parseQuery.js` / `src/retry.js`（＝ソースの98/118行、全体の83%）
  - つまずいた理由・分かっていなかった前提: 「カバレッジ 100.00%」と出ているのに、**ソースの83%が測定対象ですらない**。表に無い＝そのファイルは存在しない、と読んでしまうのが罠
  - 保存したログ: `raw-logs/without-flag.txt`

- [x] **3-2. `--test-coverage-include-all` を付けて再実行**
  - 実行したコマンド:
    ```bash
    node --test --experimental-test-coverage --test-coverage-include-all 2>&1 | tee logs/with-flag.txt
    ```
  - 出力（カバレッジ部の全文）:
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
  - 詰まりポイント表#3（cwd依存で出てこない）は**発生しなかった**。プロジェクトルートから実行し、glob指定なしの単体で一発で効いた
  - **記事に書きたい気づき（重要）**: 追加された3行は line 0.00% だが、**branch % と funcs % は 100.00 のまま**。一度も読み込まれていないので分岐も関数も1つも数えられておらず、「0/0 = 100%」扱いになる。**`include-all` が下げるのは line % だけ**（フェーズ4-2で終了コードにも影響することを確認）
  - 保存したログ: `raw-logs/with-flag.txt`

- [x] **3-3. 差分表を作る**
  - 実行したコマンド:
    ```bash
    diff -u logs/without-flag.txt logs/with-flag.txt | tee logs/diff.txt
    ```
  - 差分の要点（カバレッジ表部分のみ抜粋。テスト実行時間の行はノイズなので除外）:
    ```
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
  - **総合カバレッジの下落幅: 100.00% → 16.95%（△83.05ポイント）**。増えたファイル数: 3
  - 詰まりポイント表#6（%が毎回変わって差分がノイズだらけ）は**部分的に的中**。`✔ add (0.968916ms)` と `duration_ms` の行が毎回変わるので `diff -u` の先頭が丸ごとノイズになる。比較は `all files` 行とファイル名の集合に絞るのが正解だった
  - 保存したログ: `raw-logs/diff.txt` / `raw-logs/diff.md`

- [x] **3-4. 対照実験: v26.5.0 で同じコマンド**
  - 実行したコマンド:
    ```bash
    nvm use 26.5.0
    node --test --experimental-test-coverage --test-coverage-include-all 2>&1 | tee logs/2650-with-flag.txt
    echo "exit=$?"
    ```
  - 出力（全文。これが出力のすべて）:
    ```
    node: bad option: --test-coverage-include-all
    ```
  - 終了コード: **9**
  - **これが「26.7 で入った」ことの手元の一次証拠**。エラーは1行だけで、フラグ名の綴りミスなのか未対応バージョンなのかを区別する情報が無い（詰まりポイント表#1・#4がまさにこれ）
  - 保存したログ: `raw-logs/2650-with-flag.txt`

- [x] **3-5. `run()` API 版（`coverageIncludeAll: true`）— ここで計画の前提が覆った**
  - 書いたコード（`code/runner.mjs` 全文）:
    ```js
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
  - reporter の繋ぎ方（`stream.compose(new spec()).pipe(process.stdout)`）は**一発で通った**。詰まらなかった
  - 実行したコマンド:
    ```bash
    nvm use 26.7.0 && node runner.mjs 2>&1 | tee logs/run-api.txt
    nvm use 26.5.0 && node runner.mjs 2>&1 | tee logs/2650-run-api.txt
    ```
  - **v26.7.0 の出力**（カバレッジ部）:
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
  - **v26.5.0 の出力**（カバレッジ部）— エラーにならず、しかし**何も起きなかった**:
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
  - **CLI版（16.95%）と run() 版（15.04%）の数値が一致しなかった**。原因は判明済み: run() 版は `runner.mjs`（15行）自身がプロジェクトルートに居るため、`include-all` の候補ファイルとして拾われる。分母が 118→133 に増えて 20/133 ≒ 15.04%。**挙動としては一致しており、数値差は「実行スクリプト自身が対象に入る」ことによるもの**
  - 保存したログ: `raw-logs/run-api.txt` / `raw-logs/2650-run-api.txt`

- [x] **3-5補. 追加の対照実験（計画外・上の結果を切り分けるために追加）**
  - 26.5.0 で `coverageIncludeAll: true` が効かなかったのが「未実装だから」なのか「オプションが無視されたから」なのか、他の理由なのかを3本の対照実験で切り分けた。
  - **CONTROL A**: 26.7.0 で `coverageIncludeAll` を**外した** run()（`code`は同じで当該行のみ削除、`raw-logs/run-api-noflag-2670.txt`）
    ```
    ℹ  add.js        | 100.00 |   100.00 |  100.00 |
    ℹ  formatDate.js | 100.00 |   100.00 |  100.00 |
    ℹ  slugify.js    | 100.00 |   100.00 |  100.00 |
    ℹ all files      | 100.00 |   100.00 |  100.00 |
    ```
    → 26.7.0 では**このオプションの有無が結果を決めている**ことを確認
  - **CONTROL B**: 26.5.0 で存在しないオプション（`thisOptionDoesNotExistAtAll: true`）を渡す
    → **エラーにならず終了コード 0**。つまり `run()` は未知のオプションを**黙って無視する**。「エラーが出ないから対応している」とは言えない
  - **CONTROL C**: 26.5.0 で `coverageExcludeGlobs: ['src/slugify.js']` を渡す
    ```
    ℹ  add.js          | 100.00 |   100.00 |  100.00 |
    ℹ test             |        |          |         |
    ℹ  add.test.js     | 100.00 |   100.00 |  100.00 |
    ℹ  slugify.test.js | 100.00 |   100.00 |  100.00 |
    ```
    → `slugify.js` が消えており、**26.5.0 は coverage 系オプションを一般には尊重している**。つまり無視されたのは `coverageIncludeAll` 固有
  - **v26.5.0 のドキュメント**（https://nodejs.org/docs/v26.5.0/api/test.html）を確認 → `run()` のオプション一覧に `coverageIncludeAll` は**存在しない**（`coverage` / `coverageExcludeGlobs` / `coverageIncludeGlobs` / `lineCoverage` / `branchCoverage` / `functionCoverage` のみ）
  - **結論（計画の前提が覆った点）**: 計画段階で立てた「`run()` の `coverageIncludeAll` は 26.7 より前から存在していた／26.7 の新規性は CLI フラグ化だけ」という裏取りは、**この環境の実測では成り立たなかった**。26.5.0 では CLI フラグも run() オプションも使えず、**両方 26.7.0 で入った**と見るのが手元の観測と整合する。したがって計画にあった記事タイトル案3（「新機能ではなかった — CLIフラグ化されただけ」）は**採用できない**

- [x] **3-6. ログの点検（`ls -l logs/`）**
  - 18ファイルが揃っていることを確認。完了条件1〜5に必要なログはすべて存在
  - `grep -rl '/Users/' logs/` → **一致なし**。カバレッジ表は `src` グループ + 相対ファイル名で出るため、**絶対パスは1つも混入していない**（想定リスクの「公開前に絶対パス確認」は不要と判明）

### フェーズ4: 深掘り・比較（見積もり75分 → 実測 約1分）

- [x] **4-1. glob 絞り込みとの併用（フラグ名は 1-3 で確定した `-globs` 無しを使用）**
  - (a) include を `src/**` に絞る:
    ```bash
    node --test --experimental-test-coverage --test-coverage-include-all --test-coverage-include='src/**'
    ```
    → 結果は 3-2 と**完全に同一**（6ファイル / 16.95%）。既定でもテストファイルは除外されるため差が出なかった
  - (b) exclude で `src/retry.js` だけ除外:
    ```bash
    node --test --experimental-test-coverage --test-coverage-include-all --test-coverage-exclude='src/retry.js'
    ```
    → **予想外の結果。カバレッジが下がるどころか 28.30% に上がった**:
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
    → **`--test-coverage-exclude` を明示すると、既定のテストファイル除外が上書きされて消える**。`test/*.test.js` が100%で表に入ってきたため総合%が上がった。ドキュメントの「By default all the matching test files are excluded from the coverage report. Exclusions can be overridden by using the `--test-coverage-exclude` flag.」がそのまま起きている。**「除外を1つ足したらカバレッジが上がる」は直感に反する**ので記事の材料として強い
  - (c) include と exclude を同時指定（AND条件の実測）:
    ```bash
    node --test --experimental-test-coverage --test-coverage-include-all \
      --test-coverage-include='src/**' --test-coverage-exclude='src/retry.js'
    ```
    → 表は `src/` の5ファイル（`retry.js` のみ消えた）/ **23.26%**。`include` で `src/**` に絞られ、かつ `exclude` で `retry.js` が落ちている＝**両方の条件を満たすものだけが残る（AND）**というドキュメントの記述どおりに振る舞った
  - 保存したログ: `raw-logs/glob-include.txt` / `raw-logs/glob-exclude.txt` / `raw-logs/glob-both.txt`

- [x] **4-2. 閾値フラグと併用 — CI が落ちるか**
  - 比較の公平性のため、両方に `--test-coverage-include='src/**'` を付けて対象範囲を固定した（4-1(b)以降、プロジェクトルートに `runner*.mjs` が増えていて素の実行だと結果が動くため。理由は下の「副次的発見」参照）
  - 実行したコマンドと終了コード:
    ```bash
    # (a) フラグ無し
    node --test --experimental-test-coverage --test-coverage-include='src/**' --test-coverage-lines=80
    echo "exit=$?"   # → 0
    ```
    ```bash
    # (b) include-all 有り
    node --test --experimental-test-coverage --test-coverage-include-all \
      --test-coverage-include='src/**' --test-coverage-lines=80
    echo "exit=$?"   # → 1
    ```
  - **(b) の失敗メッセージ（全文）**:
    ```
    ℹ Error: 16.95% line coverage does not meet threshold of 80%.
    ```
  - **フラグ無し = 通る（exit 0） / 有り = 落ちる（exit 1）**。「率が下がる」が「CIが落ちる」に直結することを実測できた
  - **追加実験（計画外）**: 3-2 で気づいた「branch/funcs は 100% のまま」が閾値にどう効くか:
    ```bash
    node --test --experimental-test-coverage --test-coverage-include-all \
      --test-coverage-include='src/**' --test-coverage-functions=80 --test-coverage-branches=80
    echo "exit=$?"   # → 0
    ```
    → **funcs/branch の閾値は 80 でも通ってしまう**。`include-all` を入れて CI を締めるつもりなら、**効くのは `--test-coverage-lines` だけ**。これは実務に直結する落とし穴
  - 保存したログ: `raw-logs/threshold-without.txt` / `raw-logs/threshold-with.txt` / `raw-logs/threshold.txt` / `raw-logs/threshold-funcs-branches.txt`

- [x] **4-3. テスト無しファイルを1本増やして再測定**
  - 追加: `src/chunk.js`（26行 / 関数3本 / テスト無し）。ソース合計 118行 → 144行
  - 実行したコマンド:
    ```bash
    node --test --experimental-test-coverage --test-coverage-include-all --test-coverage-include='src/**' \
      2>&1 | tee logs/with-flag-7files.txt
    ```
  - 結果: 表に7ファイル / **all files 13.89%**（`chunk.js` は `0.00` / `uncovered lines 1-26`）
  - **数値2点で示せる**: 16.95%（6ファイル・118行） → 13.89%（7ファイル・144行）。**下落幅はテスト無しファイルの行数比でしかなく、この検証プロジェクト固有**。20/118 ≒ 16.95%、20/144 ≒ 13.89% と、素朴な行数比の計算とほぼ一致する
  - 保存したログ: `raw-logs/with-flag-7files.txt`

- [x] **副次的発見（計画外 / 記事に入れる価値あり）: `include-all` は自分のツールスクリプトまで拾う**
  - 3-5 で `runner*.mjs` をプロジェクトルートに作った後、**3-2 とまったく同じコマンドを再実行**した:
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
  - **同じコマンドが 16.95% → 12.05% に変わった。ソースは1行も触っていない。** 候補ファイルの探索起点が cwd なので、**プロジェクトルートに置いた雑多な `.mjs`（自作スクリプト、設定ファイル、使い捨てのデバッグコード）が全部 0% として分母に入る**
  - 記事に書きたい気づき: 実プロジェクトに `--test-coverage-include-all` をいきなり入れると、**`--test-coverage-include='src/**'` で範囲を絞らない限り数値が意味を持たない**。これは詰まりポイント表#3（cwd依存）の裏返しで、「出てこない」ではなく「出すぎる」側の罠
  - 保存したログ: `raw-logs/with-flag-after-runners.txt`

### フェーズ5: 振り返り（見積もり45分 → 実測 記録作成に集約）

- [x] **5-1. 詰まった点・前提の修正の棚卸し** → 下記「詰まった点と解決過程」
- [x] **5-2. 記事への写像を埋める** → 下記「記事への写像」

## 数値記録シート（対象タスク指定・すべて実測で埋まった）

| 条件 | 表に現れたファイル数 | 総合 line % | 総合 branch % | 総合 func % | 終了コード | ログ |
|---|---|---|---|---|---|---|
| フラグ無し | 3 | 100.00 | 100.00 | 100.00 | 0 | `raw-logs/without-flag.txt` |
| `--test-coverage-include-all` 有り | 6 | **16.95** | 100.00 | 100.00 | 0 | `raw-logs/with-flag.txt` |
| `run()` API `coverageIncludeAll: true`（26.7.0） | 7（`runner.mjs` 込み） | 15.04 | 100.00 | 100.00 | 0 | `raw-logs/run-api.txt` |
| `run()` API `coverageIncludeAll: true`（**26.5.0**） | 3 | **100.00**（効かない） | 100.00 | 100.00 | 0 | `raw-logs/2650-run-api.txt` |
| CLI フラグ（**26.5.0**） | — | — | — | — | **9**（`bad option`） | `raw-logs/2650-with-flag.txt` |
| include glob で `src/**` に絞る | 6 | 16.95 | 100.00 | 100.00 | 0 | `raw-logs/glob-include.txt` |
| exclude で `src/retry.js` のみ除外 | 12 | **28.30**（上がる） | 100.00 | 100.00 | 0 | `raw-logs/glob-exclude.txt` |
| include + exclude 同時（AND） | 5 | 23.26 | 100.00 | 100.00 | 0 | `raw-logs/glob-both.txt` |
| 閾値 `--test-coverage-lines=80`（フラグ無し） | 3 | 100.00 | 100.00 | 100.00 | **0** | `raw-logs/threshold-without.txt` |
| 閾値 `--test-coverage-lines=80`（フラグ有り） | 6 | 16.95 | 100.00 | 100.00 | **1** | `raw-logs/threshold-with.txt` |
| 閾値 `--test-coverage-functions=80 --test-coverage-branches=80`（フラグ有り） | 6 | 16.95 | 100.00 | 100.00 | **0**（通る） | `raw-logs/threshold-funcs-branches.txt` |
| テスト無しを1本追加（7ファイル / 144行） | 7 | **13.89** | 100.00 | 100.00 | 0 | `raw-logs/with-flag-7files.txt` |
| ルートに `runner*.mjs` がある状態で 3-2 を再実行 | 10 | **12.05** | 100.00 | 100.00 | 0 | `raw-logs/with-flag-after-runners.txt` |

## 詰まった点と解決過程（記事の核）

環境エラーやビルド失敗は一度も起きなかった。**詰まったのはコマンドではなく「事前に調べた前提が実測と違った」ところ**。

| # | 詰まった点 | 原因 | 効いた対処 | 所要 | 解決/撤退 | 記事での活かし方 |
|---|---|---|---|---|---|---|
| 1 | 「`run()` の `coverageIncludeAll` は 26.7 より前から使えた／新規性は CLI フラグ化だけ」という**事前の裏取りが実測で覆った** | 26.5.0 の `run()` は `coverageIncludeAll` を渡してもエラーを出さず**黙って無視**するため、ドキュメントだけ見ていると「あるのに効かない」のか「無い」のか判別できない | 3本の対照実験で切り分け: (A) 26.7.0 でオプションを外すと 100% に戻る、(B) 26.5.0 は存在しないオプションを exit 0 で黙殺する、(C) 26.5.0 でも `coverageExcludeGlobs` は効く。さらに v26.5.0 版ドキュメントを引いて `coverageIncludeAll` が一覧に無いことを確認 | 数分 | 解決（結論を反転） | **記事の山場。**「調べた前提が実測で覆った」ときに何をしたか＝対照実験の組み方そのものが再利用価値のある話。断定は避け「自分の環境ではこうだった」に留める |
| 2 | 「ドキュメントに `Added in: v23.0.0` と書いてある」と思い込んでいた（＝リリースノートとの矛盾があると思っていた） | ドキュメントページの近接した別項目の注記を拾った**読み違い**。`coverageIncludeAll` の項には固有の "Added in" が付いていない | HTMLを取得してタグを剥がし、`coverageIncludeAll` の**前後500文字を機械的に切り出して**目視。あわせて `cli.html` 側を見たら `--test-coverage-include-all # Added in: v26.7.0` と明記されていた | 数分 | 解決（矛盾は存在しなかった） | 「公式が矛盾している」と思ったら、まず**自分の読み違いを疑って原文を機械的に切り出す**。ドキュメントは項目が密に並んでいて注記の帰属を間違えやすい |
| 3 | `--test-coverage-exclude` を1つ足したら、カバレッジが**下がるどころか 16.95% → 28.30% に上がった** | 明示的な exclude を指定すると、**既定のテストファイル除外が上書きされて無効になる**。`test/*.test.js`（いずれも100%）が表に入って総合%を押し上げた | ドキュメントの「Exclusions can be overridden by using the `--test-coverage-exclude` flag.」の一文に該当。exclude を使うなら既定で除外されていたものを自分で書き直す必要がある | 数分 | 解決 | 直感に反する挙動なので読者の実益が大きい。「除外したのに数値が上がった」は覚えやすい |

### 予測（詰まりポイント表）と実際の差分

| 予測 | 実際 |
|---|---|
| #1 バージョン違いで `bad option` | **的中**（26.5.0 で `node: bad option: --test-coverage-include-all` / exit 9）。ただし対照実験として意図的に踏んだので「詰まり」にはならなかった |
| #2 ドキュメントとリリースノートの矛盾 | **外れ（前提が誤り）**。矛盾は存在せず、`cli.html` は `Added in: v26.7.0` と明記していた。矛盾していたのは事前の読み方のほう |
| #3 フラグを付けても出てこない（cwd依存） | **発生せず**。プロジェクトルートから glob 無しで一発で効いた。むしろ**逆方向（拾いすぎ）**で刺さった（副次的発見） |
| #4 絞り込みフラグ名の取り違え | **回避**。`node --help \| grep -i coverage` で先に確定させたので `bad option` を踏まずに済んだ。なお **CLI は `--test-coverage-include`（`-globs` 無し）／ run() API は `coverageIncludeGlobs`（`Globs` 付き）** と名前が違う点は要注意 |
| #5 `--experimental-test-coverage` 付け忘れ | **発生せず**。フェーズ2-3で「テストだけ」の出力を先に取っておいたのが効いた |
| #6 %のブレで diff がノイズだらけ | **的中**。`✔ add (0.968916ms)` と `duration_ms` が毎回変わる。比較は `all files` 行とファイル名の集合に絞った |

## スクリーンショット一覧

なし（0枚）。ブラウザ表示を伴わない CLI 検証のため、対象タスクの指定どおり**ログ全文が一次エビデンス**。記事にはコードブロックとして貼る。

## 記事への写像（実績で埋める）

対象タスクの写像表（全10節）を引き継ぎ、実際の記録を紐づけた。※ここでは素材を指し示すだけ。本文は書かない。

| 記事の見出し | 使う記録 | 書くこと（メモ） |
|---|---|---|
| 1. はじめに | 前提・動機 | Node 26.7 が出たばかりであること。テストを書き始めた立場で「カバレッジ100%」の数字を疑ったことがなかった、という動機。既出 `articles/node-test-randomize-seed-extraction.md` とは対象機能が違う（実行順シード vs カバレッジ集計）ことを冒頭で明示 |
| 2. なぜこの機能を試すのか（カバレッジの分母問題） | フェーズ1-2 の `coverageIncludeAll` 原文 / フェーズ3-1 | 「テストが1行も無いファイルは表に出ない＝分母に入っていない」。既定が `false` であることを原文で引用。**フェーズ3-1の出力（100.00%）とファイル構成（ソース118行中98行が測定対象外）を並べると一撃で伝わる** |
| 3. 事前に調べたこと | フェーズ1-1 / 1-2 / 1-3 の全文 | リリースノートの原文1行（`a646319f61` / #64830 / avivkeller / SEMVER-MINOR）。`cli.html` の `Added in: v26.7.0`。`node --help \| grep -i coverage` で確定させた正式名（**`-globs` は付かない**）。**「矛盾していると思ったのは自分の読み違いだった」を正直に書く**（詰まった点#2） |
| 4. 環境構築（Node 26.7 と最小プロジェクト） | フェーズ2 / `code/` | `nvm install 26.7.0`。`package.json` は `{"type":"module"}` の1行、**`npm install` ゼロ**。`wc -l src/*.js` の出力をそのまま貼る（テスト有り20行 : テスト無し98行）。**この比を出さないと下落%の意味が伝わらない** |
| 5. フラグ無しのカバレッジ結果 | `raw-logs/without-flag.txt` | 出力テーブル全文。**表に現れなかった3ファイル名**（`deepMerge.js` / `parseQuery.js` / `retry.js`）を明示。ここで「見えない分母」を可視化 |
| 6. `--test-coverage-include-all` を付けた結果 | `raw-logs/with-flag.txt` / `raw-logs/diff.md` / `raw-logs/diff.txt` | 出力全文と差分。**100.00% → 16.95%（△83.05pt）**。タイトルの数値はここから。**branch/funcs が 100% のまま**である点も必ず触れる（フェーズ3-2の気づき） |
| 7. 詰まった点 | 「詰まった点」表 / `raw-logs/2650-with-flag.txt` / フェーズ3-5補 | `node: bad option: --test-coverage-include-all`（exit 9）の全文。**26.5.0 の run() が黙ってオプションを無視した話と、それを切り分けた3つの対照実験**（CONTROL A/B/C）。exclude で数値が上がった話 |
| 8. glob と併用したときの挙動 | フェーズ4-1（`glob-*.txt`）/ 4-2（`threshold-*.txt`） | include+exclude が**AND条件**で振る舞った実測（23.26%）。**exclude 明示で既定のテスト除外が消えて 28.30% に上がる**罠。閾値との併用: line=80 は落ちる（exit 1、`Error: 16.95% line coverage does not meet threshold of 80%.`）が、**funcs/branch=80 は通ってしまう（exit 0）** |
| 9. どんなプロジェクトで効きそうか | フェーズ4-3 / 副次的発見 / フェーズ3-5 | 16.95% → 13.89%（ファイル1本追加）で「下落幅はプロジェクト固有」を数字2点で示す。**ルートに `.mjs` を置いただけで同じコマンドが 16.95%→12.05% になる**ので `--test-coverage-include='src/**'` 併用が実質必須。`run()` API との一致/不一致（15.04% の差は `runner.mjs` 自身が入るため） |
| 10. まとめ | 結果サマリー / フェーズ5-1 | 新人が試した範囲であることの明示。**カバレッジ機能自体が experimental (Stability 1) であること**。数値がこの検証プロジェクト固有で一般化できないこと。**「26.7 の新機能は CLI フラグ化だけ」という当初の見立ては手元の実測では成り立たなかった**（＝計画時のタイトル案3は使えない）。次に試したいこと |

### 記事タイトル案（実測値を埋めたもの）

1. `Node 26.7 の --test-coverage-include-all を付けたら、カバレッジ率が 100% から 16.95% になった`
2. `カバレッジ100%だと思っていたら、そもそも数えられていないファイルが83%あった話（Node 26.7）`
3. ~~`--test-coverage-include-all は「新機能」ではなかった — CLIフラグ化されただけ`~~ → **実測と食い違うため不採用**（26.5.0 では run() API 経由でも使えなかった）
4. （追加案）`--test-coverage-include-all で下がるのは line % だけ。funcs/branch の閾値はすり抜ける`

## 未達・撤退した項目

なし。フェーズ1〜5のすべてのタスクを実行し、完了条件5件すべてを一次ログで確認した。撤退ラインには一度も到達していない。

計画からの**変更点**（捏造ではなく実測に基づく修正）:

- 計画の「裏取りで分かったこと」1（run() API は以前から使えた）は**実測で否定された**。記事では逆の結論を書く必要がある
- 計画の「裏取りで分かったこと」2（ドキュメントが `Added in: v23.0.0` でリリースノートと矛盾）は**誤読だった**。`cli.html` は `Added in: v26.7.0` と明記
- フェーズ4-2 では、実行のたびに結果が動くのを避けるため両条件に `--test-coverage-include='src/**'` を付けて対象範囲を固定した（理由は「副次的発見」に記載）

## 再現性メモ（記事に転記する用）

- OS: macOS 26.5（Darwin 25.5.0 / arm64）
- ランタイム: Node.js **v26.7.0**（対照実験に **v26.5.0**）/ npm 11.19.0 / nvm
- **依存パッケージ: ゼロ**（`package.json` は `{"type":"module"}` の1行のみ。`npm install` 不要）
- ファイル構成（下落%の再現に必須）: `src/` 6ファイル計118行（テスト有り `add.js` 7 / `formatDate.js` 6 / `slugify.js` 7 = 20行、テスト無し `deepMerge.js` 34 / `parseQuery.js` 32 / `retry.js` 32 = 98行）、`test/` 3ファイル計25行
- 最短の再現手順:
  ```bash
  nvm install 26.7.0 && nvm use 26.7.0 && node --version   # v26.7.0
  node --help | grep -i coverage                            # フラグの実在と正式名を先に確定
  mkdir -p coverage-lab/src coverage-lab/test && cd coverage-lab
  echo '{"type":"module"}' > package.json
  # src に純関数6本、test にそのうち3本分のテストを置く（code/ 参照）
  node --test --experimental-test-coverage                     2>&1 | tee without-flag.txt
  node --test --experimental-test-coverage --test-coverage-include-all 2>&1 | tee with-flag.txt
  diff -u without-flag.txt with-flag.txt
  ```
- 注意点:
  - `--test-coverage-include-all` は **単体では効かない**。`--experimental-test-coverage` が必須（カバレッジ機能自体が Stability 1 - Experimental）
  - CLI と `run()` API で**オプション名が違う**: CLI は `--test-coverage-include` / `--test-coverage-exclude`（`-globs` なし）、API は `coverageIncludeGlobs` / `coverageExcludeGlobs`（`Globs` あり）
  - 候補ファイルの探索起点は **cwd**。プロジェクトルートに置いた自作スクリプトや使い捨ての `.mjs` も 0% として拾われるため、実質 `--test-coverage-include='src/**'` の併用が必要
  - `--test-coverage-exclude` を**明示すると既定のテストファイル除外が上書きされて消える**。テストファイルが表に入り、総合%が**上がる**ことがある
  - 一度も読み込まれなかったファイルは line 0% でも **branch/funcs は 100%**。CI の閾値で捕まえられるのは `--test-coverage-lines` だけ
  - v26.5.0 以前では CLI フラグは `node: bad option:`（exit 9）、`run()` の `coverageIncludeAll` は**エラーも出さず黙って無視される**
  - 出力に絶対パスは含まれない（`src` グループ + 相対ファイル名）。ログをそのまま貼っても個人パスは漏れない
  - 測定値はこの検証プロジェクト固有。**一般化できない**（ファイル1本追加で 16.95% → 13.89% に動いた）

## 次のアクション（記事化）

- [ ] この execution-log.md の「記事への写像」に沿って `articles/<slug>.md` を作成する（`/draft-article`）
- [ ] スクショは無いので、コードブロックとして `raw-logs/*.txt` の全文を貼る
- [ ] 完了条件・詰まった点（特に**前提が実測で覆った経緯**）・glob/閾値の比較を本文に落とす
- [ ] **計画時のタイトル案3は使わない**（実測と矛盾）。案1（数値入り）か新案4を採る
