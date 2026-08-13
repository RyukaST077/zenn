# 検証ログ: Deno 2.9 の `Deno.test.each()` / `t.assertSnapshot()` を node:test と書き比べる

> Zenn記事の素材。実行の一次情報（コマンド・エラー全文・所要時間・スクショ）を記録。
> 記事本文は未執筆。「記事への写像」を見て articles/*.md に展開する。

## 実行の前提（採用した前提）

- 対象タスク: `practice/practice-deno29-test-each-snapshot-20260814-0406.md`
- 出典レポート: `research/search-topic-20260814-0402.md`
- 対象技術: Deno 2.9 のテストランナー（`Deno.test.each()` / `t.assertSnapshot()`）と、比較対象の Node.js `node:test`
- 実行者: AIエージェント単独（非対話）
- 実行日時 / 所要時間: 2026-08-14 04:10〜04:19 / 見積もり 4h30m → 実測 約9分（AI単独・待ち時間なしの値）
- 実行環境: macOS 26.5 (Build 25F71) / arm64 / deno 2.8.3 → **2.9.5** / Node **v26.7.0** と **v22.17.0**（nvm） / npm 11.19.0
- 採用した撤退ライン: 対象タスク記載のものを採用（環境構築60分で 2.9 に到達できなければ「上げられなかった記録」に切替 / Playwright の Chromium DL 10分超なら撤退 / 1タスク30分で撤退）。**いずれも発動せず**
- 判断方針: 引数は「対象タスクファイル」のみ指定。時間・撤退ラインは対象タスクのデフォルトを採用
- 作業ディレクトリ: `logs/run-deno29-test-each-snapshot-20260814-0410/workspace/`（対象タスクの `tmp-deno29-test/` を、Skill 既定の workspace 配下に置き換えた。理由: `.gitignore` の `logs/**/workspace/` で除外済みでリポジトリを汚さないため）

## 結果サマリー

- 完了条件の判定: **達成**（5条件すべてを一次ログで確認）
- 作ったもの: 同一対象コードに対する Deno 版テスト4本 / Node 版テスト4本と、両者の実行ログ・スナップショットファイル一式（`workspace/`）
- スクショ: **1** 枚（`screenshots/01-render-header.png`）
- 詰まった点: **6** 件（うち解決 6 / 未解決・撤退 0）
- knowledge 記録: `knowledge/2026-08-14-deno-upgrade-built-without-upgrade-feature.md` / `knowledge/2026-08-14-deno-test-each-testcontext-arg-order.md`
- 生ログ: `commands.log`（1308行 / `workspace/logs/*.txt` を連結）

### 事前の予測と実測がズレた点（記事の核）

| # | 事前の予測 | 実測 | 
|---|---|---|
| A | `deno upgrade` は「パッケージマネージャ経由なので拒否」される | 拒否理由が違った。**「このdenoはupgrade機能なしでビルドされている」** |
| B | Node **22.17.0** では `t.assert.snapshot()` に `--experimental-test-snapshots` が要る | **要らなかった。フラグ無しで比較まで動く**（v22.3.0追加・v23.4.0 stable だが 22.17.0 時点で既にフラグ不要） |
| C | Deno のスナップショットは初回実行で自動生成される | **されない。`-u` が必須**（初回は `AssertionError: Missing snapshot file.` で落ちる） |
| D | 未使用エントリはフル実行で自動 prune される | **`-u` 付きフル実行のときだけ** prune された |
| E | Deno と Node で同じ `.ts` は共有できない | **Node 26.7.0 なら共有できた**。落ちたのは Node 22.17.0（`ERR_UNKNOWN_FILE_EXTENSION`） |

## 完了条件の検証

| # | 完了条件 | 判定 | 根拠（ログ / スクショ） |
|---|---|---|---|
| 1 | `deno --version` が 2.9 系になった出力を保存できている | **達成** | `workspace/logs/02-after-versions.txt`（`deno 2.9.5 (stable, release, aarch64-apple-darwin)`） |
| 2 | `deno test` で `.each()` のケースがケース単位の個別テスト名で出力される | **達成** | `logs/10-deno-each-array.txt`（`add(1, 2) = 3 ... ok` 等4件 / `ok | 4 passed`）、`logs/10b-deno-filter.txt`（`--filter "add(1, 2)"` で `1 passed | 3 filtered out`） |
| 3 | `__snapshots__/*.snap` が生成され、出力を変えると失敗し差分が出て、`-u` で更新して再パスするまでのログが揃っている | **達成** | `12-deno-snapshot-create.txt`（初回=Missing）→ `12b-deno-snap-create-u.txt`（`> 3 snapshots updated.`）→ `13-deno-snap-content.txt`（.snap 中身）→ `14-deno-snap-mismatch.txt`（Diff 表示）→ `15-deno-snap-update.txt` → `16-deno-snap-repass.txt`（`ok | 3 passed`）→ `17-snap-after.txt`（ファイル差分） |
| 4 | Node 26.7.0 で同等シナリオが動き、`*.snapshot` が生成され `--test-update-snapshots` で更新できている | **達成** | `22-node-snap-26.txt`（生成前ERR_INVALID_STATE → 更新フラグで3 pass → `render.test.js.snapshot` の中身）、`22b-node-snap-repass.txt` |
| 5 | 4観点（行数 / テスト名 / 失敗時出力 / 更新フロー）の比較表が埋まっている | **達成** | 本ファイル「4観点の比較表」節 / `21-loc-compare.txt` |

## タスク実行ログ（フェーズ別）

### フェーズ1: 事前調査（見積もり 30分 → 実測 約1分）

- [x] deno.com/blog/v2.9 の該当節を読む
  - 分かったこと（公式に明記）:
    - 配列ケースは**位置引数として展開**され、名前は printf 風トークン（`%s` `%i`/`%d` `%f` `%j` `%o`）で補間。ケース番号は `%#`
    - オブジェクトケースは**単一引数で渡り**、`$key` / `$key.nested` で補間
    - `Deno.test.only.each` / `Deno.test.ignore.each` もある
    - `t.assertSnapshot()` は **import 不要**。保存先は `__snapshots__/<test file>.snap`
    - 不一致時は差分を出し `deno test --update-snapshots [files]...` を案内。既定の場所なら read/write 権限フラグ不要。フル実行で stale を prune
  - 実際に確かめたいと思った点: (1) `%#` は本当に使えるか (2) `$a.b` のネストは効くか (3) 配列ケースに `$key`／オブジェクトケースに `%s` を書いたらどうなるか (4) 「権限フラグ不要」は本当か (5) 「フル実行で prune」の"フル実行"に `-u` は要るのか
- [x] nodejs.org/api/test.html のスナップショット節を読む
  - 控えた事実: `context.assert.snapshot(value[, options])` は **v22.3.0 追加 / v23.4.0 で stable**。保存先はテストファイル名 + `.snapshot`。更新は `--test-update-snapshots`。`context.assert.fileSnapshot(value, path)` あり。`snapshot.setResolveSnapshotPath()` / `setDefaultSnapshotSerializers()` で挙動を差し替えられる
  - **node:test に `test.each()` 相当のパラメータ化APIは存在しない**（公式ドキュメントに該当APIなし）。出典: https://nodejs.org/api/test.html
  - 仮説: Node 22.17.0 は v22.3.0 より新しいが v23.4.0 より古いので、`--experimental-test-snapshots` を要求されるかもしれない → **後述のとおり要求されなかった**

### フェーズ2: 環境構築（見積もり 45分 → 実測 約3分）

- [x] 現状のバージョンを記録する（見積もり 5分 → 実測 <1分）
  - 実行したコマンド:
    ```bash
    { deno --version; which -a deno; node --version; npm --version; sw_vers; uname -m; } 2>&1 | tee logs/00-before-versions.txt
    ```
  - 出力（全文）:
    ```
    deno 2.8.3 (stable, release, aarch64-apple-darwin)
    v8 14.9.207.2-rusty
    typescript 6.0.3
    --- which -a deno ---
    /opt/homebrew/bin/deno
    --- node ---
    v22.17.0
    --- npm ---
    10.9.2
    --- os ---
    ProductName:		macOS
    ProductVersion:		26.5
    BuildVersion:		25F71
    arm64
    ```
  - 気づき: `deno --version` だけでは導入経路が分からない。`which -a deno` を先に見ておくと次の詰まりの原因が即わかる

- [x] `deno upgrade` を素直に実行する（見積もり 10分 → 実測 <1分）【詰まり #1】
  - 実行したコマンド:
    ```bash
    deno upgrade 2>&1 | tee logs/01-deno-upgrade.txt
    ```
  - 出たエラー（全文）:
    ```
    error: This deno was built without the "upgrade" feature. Please upgrade using the installation method originally used to install Deno.
    exit=1
    ```
  - つまずいた理由・分かっていなかった前提: 事前の予測は「Homebrew 管理を検出して拒否される」だったが、実際の理由は違った。**Homebrew の deno バイナリは upgrade 機能そのものを外してビルドされている**。「導入元と同じ方法で上げ直せ」とだけ言われる
  - 記事に書きたい気づき: 公式ブログの手順（`deno upgrade`）が、自分の導入経路では最初から使えない。エラーが「拒否」ではなく「その機能が入っていない」なのがポイント

- [x] 代替手段で 2.9 系を用意する（見積もり 20分 → 実測 約4分）
  - 実行したコマンド:
    ```bash
    brew update && brew upgrade deno
    deno --version 2>&1 | tee logs/02-after-versions.txt
    ```
  - 出力（要点。全文は `logs/01b-brew-upgrade.txt`）:
    ```
    ==> Upgrading deno
      2.8.3 -> 2.9.5
    🍺  /opt/homebrew/Cellar/deno/2.9.5: 12 files, 157.4MB
    ...
    ==> Upgraded 2 outdated packages
    deno    2.8.3    -> 2.9.5
    yt-dlp  2026.6.9 -> 2026.7.4
    exit=0
    --- after ---
    deno 2.9.5 (stable, release, aarch64-apple-darwin)
    v8 15.0.245.2-rusty
    typescript 6.0.3
    ```
  - 効いた対処: 手段A（`brew update && brew upgrade deno`）で一発。2.9.5 が入ったので手段B（公式インストーラ）は不要だった
  - 所要時間の内訳: 大半は `brew update`（portable-ruby 4.0.6 の引き直しと 3 tap の更新）。deno 本体の pour 自体は速い
  - 副作用として `yt-dlp` も上がり、依存（jpeg-turbo / giflib / libpng / webp / libtiff / sqlite）も更新された。`brew upgrade <formula>` は依存も巻き込む点は記事に一言添える価値あり

- [x] Node 26.7.0 を使える状態にする（見積もり 5分 → 実測 <1分）
  - 実行したコマンド:
    ```bash
    source ~/.nvm/nvm.sh && nvm use 26.7.0 && node --version | tee logs/03-node-version.txt
    ```
  - 出力（全文）:
    ```
    Now using node v26.7.0 (npm v11.19.0)
    v26.7.0
    ```
  - 記録すべき差分: 出典レポートには `nvm install 26` とあったが、**実際は導入済みで `nvm use` だけでよかった**（DL ゼロ）

- [x] 対象コードを作り、両ランタイムから読める形にする（見積もり 5分 → 実測 約2分）
  - 作ったファイル: `src/add.ts` `src/render.ts`（Deno 用）、`src/add.js` `src/render.js`（Node 用）
    ```ts
    // src/add.ts
    export function add(a: number, b: number): number {
      return a + b;
    }
    // src/render.ts
    export function renderHeader({ title }: { title: string }): string {
      return `<header><h1>${title}</h1></header>`;
    }
    ```
  - **ランタイム間で書き分けが必要になった箇所**: 最初は「Node は `.ts` を読めないだろう」と決め打ちして `.js` を別に用意した。ところが後で試したら **Node 26.7.0 は `.ts` をそのまま `--test` できた**（フェーズ4で検証、`logs/24-node-ts-shared.txt`）。一方 **Node 22.17.0 は `ERR_UNKNOWN_FILE_EXTENSION`** で落ちる。つまり「共有できるかは Node の版数次第」だった

### フェーズ3: 実装・検証【本編】（見積もり 120分 → 実測 約3分）

- [x] Deno 側: 配列ケースで `add()` のテストを書く（見積もり 20分 → 実測 約1分）
  - コード（`tests_deno/add_test.ts`、12行）:
    ```ts
    import { assertEquals } from "jsr:@std/assert@1";
    import { add } from "../src/add.ts";

    Deno.test.each([
      [1, 2, 3],
      [0, 0, 0],
      [-1, 1, 0],
      [10, 32, 42],
    ])("add(%i, %i) = %i", (a, b, expected) => {
      assertEquals(add(a, b), expected);
    });
    ```
  - 実行したコマンド:
    ```bash
    deno test tests_deno/add_test.ts 2>&1 | tee logs/10-deno-each-array.txt
    deno test --filter "add(1, 2)" tests_deno/add_test.ts 2>&1 | tee logs/10b-deno-filter.txt
    ```
  - 出力（全文 / JSR の Download 行は省略せず `logs/10-deno-each-array.txt` にあり）:
    ```
    running 4 tests from ./tests_deno/add_test.ts
    add(1, 2) = 3 ... ok (1ms)
    add(0, 0) = 0 ... ok (103µs)
    add(-1, 1) = 0 ... ok (94µs)
    add(10, 32) = 42 ... ok (79µs)

    ok | 4 passed | 0 failed (13ms)
    ```
    ```
    $ deno test --filter "add(1, 2)" tests_deno/add_test.ts
    running 1 test from ./tests_deno/add_test.ts
    add(1, 2) = 3 ... ok (1ms)

    ok | 1 passed | 0 failed | 3 filtered out (12ms)
    ```
  - 確認できたこと: **4件が独立したテストとしてカウントされる**（`4 passed`）。`--filter` に補間後の名前を渡すと **1ケースだけ実行でき、残りは `3 filtered out`** になる。「ケース単位で実テストとして登録される」は本当だった
  - 記事に書きたい気づき: `--filter` が補間後の名前で効くのが実用上いちばん嬉しい。手書きループでも同じことはできるが、テンプレート文字列を自分で組む必要がある

- [x] Deno 側: オブジェクトケース / `$key` / `%#` / 取り違えパターンを試す（見積もり 20分 → 実測 約1分）
  - 実行したコマンド:
    ```bash
    deno test tests_deno/each_object_test.ts 2>&1 | tee logs/10c-deno-each-object.txt
    ```
  - 出力（全文）:
    ```
    running 10 tests from ./tests_deno/each_object_test.ts
    1 + 1 = 2 ... ok (2ms)
    2 + 3 = 5 ... ok (110µs)
    case 0: 7 + 3 ... ok (155µs)
    case 1: 8 + 4 ... ok (77µs)
    nested 1 + 2 = 3 ... ok (181µs)
    nested 5 + 5 = 10 ... ok (97µs)
    MISUSE array-case with undefined + undefined = undefined ... ok (114µs)
    MISUSE object-case with [object Object] and NaN ... ok (146µs)
    idx=0 json={"x":1} obj=one str=undefined ... ok (126µs)
    idx=1 json={"x":2} obj=two str=undefined ... ok (82µs)

    ok | 10 passed | 0 failed (16ms)
    ```
  - 分かったこと（実測でしか分からない部分）:
    - `$a + $b = $sum` はそのまま名前になる（`1 + 1 = 2`）
    - **`$input.a` のネストは効く**（`nested 1 + 2 = 3`）
    - `%#` はオブジェクトケースでも使えて **0始まり**（`case 0:` / `case 1:`）
    - **取り違えは静かに壊れる**: 配列ケースに `$a` を書くと `undefined`、オブジェクトケースに `%s` を書くと `[object Object]`、`%i` は `NaN`。**エラーにはならず、名前が壊れたまま緑になる**
    - printf トークンは**位置引数を順に消費する**。`idx=%# json=%j obj=%o str=%s` に `[{x:1}, "one"]` を渡すと `%j`→`{"x":1}`、`%o`→`one`（オブジェクトではなく2番目の引数）、`%s`→引数切れで `undefined`。`%#` は引数を消費しない
  - 記事に書きたい気づき: 「配列ケース＝`%`系 / オブジェクトケース＝`$`系」を取り違えても**テストは通ってしまう**。名前が `undefined` や `NaN` になっていたら補間記法を疑う、という読み方を書きたい

- [x] Deno 側: わざと1ケースだけ落として失敗時出力を採る（見積もり 15分 → 実測 <1分）
  - 実行したコマンド:
    ```bash
    deno test tests_deno/add_fail_test.ts 2>&1 | tee logs/11-deno-each-fail.txt
    ```
  - 出力（全文 / ANSI 除去済み）:
    ```
    running 4 tests from ./tests_deno/add_fail_test.ts
    add(1, 2) = 3 ... ok (1ms)
    add(0, 0) = 0 ... ok (109µs)
    add(-1, 1) = 99 ... FAILED (73ms)
    add(10, 32) = 42 ... ok (120µs)

     ERRORS 

    add(-1, 1) = 99 => ./tests_deno/add_fail_test.ts:10:2
    error: AssertionError: Values are not equal.


        [Diff] Actual / Expected


    -   0
    +   99

      throw new AssertionError(message);
            ^
        at assertEquals (https://jsr.io/@std/assert/1.0.19/equals.ts:67:9)
        at file:///.../tests_deno/add_fail_test.ts:11:3

     FAILURES 

    add(-1, 1) = 99 => ./tests_deno/add_fail_test.ts:10:2

    FAILED | 3 passed | 1 failed (86ms)

    error: Test failed
    exit=1
    ```
  - 確認できたこと: **落ちたケースが「どの入力か」名前だけで特定できる**（`add(-1, 1) = 99`）。行番号は `.each()` の呼び出し位置（10:2）を指すので、ケース配列の何行目かまでは教えてくれない
  - 既存技術と比べて感じた違い: 手書き `for` ループでも同じ名前は作れる。ただしそれは自分でテンプレート文字列を書いた場合のみ。`.each()` は「名前を書き忘れて `test("adds", ...)` を4回登録してしまう」事故が起きにくい

- [x] Deno 側: `t.assertSnapshot()` で `__snapshots__/*.snap` の生成を確認する（見積もり 20分 → 実測 約2分）【詰まり #2, #3】
  - **最初に書いたコード（誤り）** と型エラー全文:
    ```ts
    Deno.test.each([
      { title: "Hello" },
      { title: "こんにちは" },
    ])("renderHeader $title", async (t, { title }) => {
      await t.assertSnapshot(renderHeader({ title }));
    });
    ```
    ```
    Check tests_deno/render_test.ts
    TS2339 [ERROR]: Property 'title' does not exist on type 'TestContext'.
    ])("renderHeader $title", async (t, { title }) => {
                                          ~~~~~
        at file:///.../tests_deno/render_test.ts:10:39

    TS2339 [ERROR]: Property 'assertSnapshot' does not exist on type '{ readonly title: "Hello"; } | { readonly title: "こんにちは"; }'.
      await t.assertSnapshot(renderHeader({ title }));
              ~~~~~~~~~~~~~~
        at file:///.../tests_deno/render_test.ts:11:11

    Found 2 errors.

    error: Type checking failed.

      info: The program failed type-checking, but it still might work correctly.
      hint: Re-run with --no-check to skip type-checking.
    exit=1
    ```
  - 効いた対処: **ケース引数が先、`TestContext` が最後**。`async ({ title }, t) => ...` に直したら通った
  - つまずいた理由・分かっていなかった前提: 素の `Deno.test("name", async (t) => ...)` は `t` が第1引数なので、`.each()` でもそうだと思い込んでいた。エラーメッセージは「TestContext に title が無い」としか言わず、引数順が逆だとは教えてくれない。2件目の「case オブジェクトに `assertSnapshot` が無い」が実質のヒント
  - knowledge に記録: `knowledge/2026-08-14-deno-test-each-testcontext-arg-order.md`
  - **修正後の初回実行（`-u` なし）** の出力（全文 / 抜粋なし部分は `logs/12-deno-snapshot-create.txt`）:
    ```
    running 3 tests from ./tests_deno/render_test.ts
    renders the header ... FAILED (6ms)
    renderHeader Hello ... FAILED (985µs)
    renderHeader こんにちは ... FAILED (811µs)

     ERRORS 

    renders the header => ./tests_deno/render_test.ts:3:6
    error: AssertionError: Missing snapshot file.
      await t.assertSnapshot(renderHeader({ title: "Deno 2.9" }));
              ^
        at assertSnapshot (ext:cli/40_test_snapshot.js:353:11)
        at TestContext.assertSnapshot (ext:cli/40_test.js:772:14)
        at file:///.../tests_deno/render_test.ts:4:11
    （renderHeader Hello / こんにちは も同じ Missing snapshot file.）

    FAILED | 0 passed | 3 failed (21ms)

    error: Test failed
    exit=1
    ```
    ```
    $ ls -la tests_deno/__snapshots__/
    ls: tests_deno/__snapshots__/: No such file or directory
    ```
  - **予測とのズレ（重要）**: 「初回は自動生成される」と思っていたが、**生成されない**。しかも `Missing snapshot file.` は `-u` を案内してくれない（不一致時は案内してくれるのに）
  - `-u` を付けて生成:
    ```bash
    deno test -u tests_deno/render_test.ts 2>&1 | tee logs/12b-deno-snap-create-u.txt
    ```
    ```
    running 3 tests from ./tests_deno/render_test.ts
    renders the header ... ok (1ms)
    renderHeader Hello ... ok (164µs)
    renderHeader こんにちは ... ok (79µs)

     > 3 snapshots updated.

    ok | 3 passed | 0 failed (28ms)
    exit=0
    ```
  - 生成された `.snap` の中身（`logs/13-deno-snap-content.txt`）:
    ```js
    export const snapshot = {};

    snapshot[`renders the header 1`] = `"<header><h1>Deno 2.9</h1></header>"`;

    snapshot[`renderHeader Hello 1`] = `"<header><h1>Hello</h1></header>"`;

    snapshot[`renderHeader こんにちは 1`] = `"<header><h1>こんにちは</h1></header>"`;
    ```
  - **権限フラグの検証結果**: `--allow-write` / `--allow-read` は**一度も要求されなかった**。公式の「既定の場所なら権限フラグ不要」は実測どおり
  - 気づき: `.each()` で作ったケースのスナップショットも、キーが補間後の名前（`renderHeader Hello 1`）になる。日本語もそのままキーになる

- [x] Deno 側: 変更 → 失敗 → `-u` → 再パスを一気通貫でログに残す（見積もり 20分 → 実測 約1分）
  - 実行したコマンド:
    ```bash
    # src/render.ts の出力に class="site-header" を追加してから
    deno test    tests_deno/render_test.ts 2>&1 | tee logs/14-deno-snap-mismatch.txt
    deno test -u tests_deno/render_test.ts 2>&1 | tee logs/15-deno-snap-update.txt
    deno test    tests_deno/render_test.ts 2>&1 | tee logs/16-deno-snap-repass.txt
    git --no-pager diff --no-index logs/snap-before.snap tests_deno/__snapshots__/render_test.ts.snap > logs/17-snap-after.txt
    ```
  - 不一致時の出力（1件ぶん全文。3件とも同形式。全文は `logs/14-deno-snap-mismatch.txt`）:
    ```
    renders the header => ./tests_deno/render_test.ts:3:6
    error: AssertionError: Snapshot does not match:

        [Diff] Actual / Expected

    +   '<header class="site-header"><h1>Deno 2.9</h1></header>'
    -   "<header><h1>Deno 2.9</h1></header>"

    To update snapshots, run
        deno test --update-snapshots [files]...

      await t.assertSnapshot(renderHeader({ title: "Deno 2.9" }));
              ^
        at assertSnapshot (ext:cli/40_test_snapshot.js:365:9)
        at TestContext.assertSnapshot (ext:cli/40_test.js:772:14)
        at file:///.../tests_deno/render_test.ts:4:11
    ```
  - 更新と再パス:
    ```
    $ deno test -u tests_deno/render_test.ts
     > 3 snapshots updated.
    ok | 3 passed | 0 failed (14ms)
    exit=0

    $ deno test tests_deno/render_test.ts
    ok | 3 passed | 0 failed (14ms)
    exit=0
    ```
  - `.snap` の差分（`logs/17-snap-after.txt` 全文）:
    ```diff
    --- a/logs/snap-before.snap
    +++ b/tests_deno/__snapshots__/render_test.ts.snap
    @@ -1,7 +1,7 @@
     export const snapshot = {};
     
    -snapshot[`renders the header 1`] = `"<header><h1>Deno 2.9</h1></header>"`;
    +snapshot[`renders the header 1`] = `'<header class="site-header"><h1>Deno 2.9</h1></header>'`;
     
    -snapshot[`renderHeader Hello 1`] = `"<header><h1>Hello</h1></header>"`;
    +snapshot[`renderHeader Hello 1`] = `'<header class="site-header"><h1>Hello</h1></header>'`;
     
    -snapshot[`renderHeader こんにちは 1`] = `"<header><h1>こんにちは</h1></header>"`;
    +snapshot[`renderHeader こんにちは 1`] = `'<header class="site-header"><h1>こんにちは</h1></header>'`;
    ```
  - 気づき: 値に `"` が含まれると **囲みが `'` に切り替わり、エスケープしない**。`.snap` が **そのまま読める JS** なので、レビューで差分を目で追いやすい（後述の Node 側との差）

- [x] Deno 側（追加検証）: 未使用エントリの prune を確かめる（計画外・実測 約1分）
  - 手順: `.snap` に使われないエントリ ``snapshot[`obsolete entry 1`] = `"stale"`;`` を手で追記 → フル実行 → `-u` 付きフル実行
  - 出力（`logs/18-deno-snap-prune.txt`）:
    ```
    $ deno test tests_deno/          # -u なしフル実行 → obsolete entry 1 は残ったまま
    FAILED | 20 passed | 1 failed (382ms)
    （.snap に obsolete entry 1 が残存）

    $ deno test -u tests_deno/       # -u 付きフル実行
     > 1 snapshot removed.
       • obsolete entry 1
    FAILED | 20 passed | 1 failed (384ms)
    （.snap から obsolete entry 1 が消えた）
    ```
  - **予測とのズレ**: 公式の「フル実行時に未使用エントリは自動 prune」は、正確には **`-u` を付けたフル実行のとき**。読み取り専用の実行では消さない（安全側）。また、**他のテストが落ちていても prune は実行された**（`1 failed` のまま `1 snapshot removed.`）

- [x] Node 側: `for...of` + `test()` で手書きし、行数とテスト名の出方を比べる（見積もり 25分 → 実測 約2分）【詰まり #4, #5】
  - コード（`tests_node/add.test.js`、17行）:
    ```js
    import { test } from "node:test";
    import assert from "node:assert/strict";
    import { add } from "../src/add.js";

    // node:test には test.each 相当が無いので for...of で手書きする
    const cases = [
      [1, 2, 3],
      [0, 0, 0],
      [-1, 1, 0],
      [10, 32, 42],
    ];

    for (const [a, b, expected] of cases) {
      test(`add(${a}, ${b}) = ${expected}`, () => {
        assert.equal(add(a, b), expected);
      });
    }
    ```
  - **詰まり #4**: 最初の実行で警告が出た（全文）:
    ```
    (node:88836) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///.../tests_node/add.test.js is not specified and it doesn't parse as CommonJS.
    Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
    To eliminate this warning, add "type": "module" to /Users/katayamaryuunosuke/workspace/024_zenn/package.json.
    (Use `node --trace-warnings ...` to show where the warning was created)
    ```
    - 原因: workspace に `package.json` が無く、Node がリポジトリ直下の `package.json`（`type` 未指定）まで遡って解決した
    - 効いた対処: workspace に `echo '{ "type": "module", "private": true }' > package.json` を置く。警告消滅。**リポジトリ本体の package.json は触っていない**
  - **詰まり #5（予測どおり実際に踏んだ）**: 上の対処後の再実行で、出力が TAP 形式になり `=== node v22.17.0 ===` と表示された。**`nvm use 26.7.0` が次の Bash 呼び出しに引き継がれておらず、default の 22.17.0 に戻っていた**
    - 効いた対処: 毎コマンドの先頭で `source ~/.nvm/nvm.sh && nvm use 26.7.0` を実行し、ログ先頭に `node --version` を必ず出す運用にした
    - **副産物**: このミスのおかげで **v22 と v26 でレポータの既定が違う**ことが分かった。v22.17.0 = **TAP 形式**（`TAP version 13` / `ok 1 - ...`）、v26.7.0 = **spec 形式**（`✔` / `ℹ tests 4`）。「出力の見た目が違ったらまず `node --version`」という判断材料になる
  - v26.7.0 での実行（全文）:
    ```
    === node v26.7.0 ===
    $ node --test tests_node/add.test.js
    ✔ add(1, 2) = 3 (2.28875ms)
    ✔ add(0, 0) = 0 (0.289792ms)
    ✔ add(-1, 1) = 0 (0.258792ms)
    ✔ add(10, 32) = 42 (3.68575ms)
    ℹ tests 4
    ℹ suites 0
    ℹ pass 4
    ℹ fail 0
    ℹ cancelled 0
    ℹ skipped 0
    ℹ todo 0
    ℹ duration_ms 225.799875
    exit=0
    ```
  - Node 側の失敗時出力（v26.7.0 / 全文は `logs/20b-node-loop-fail.txt`）:
    ```
    ✔ add(1, 2) = 3 (0.906209ms)
    ✔ add(0, 0) = 0 (0.12025ms)
    ✖ add(-1, 1) = 99 (1.439125ms)
    ✔ add(10, 32) = 42 (8.124459ms)
    ℹ tests 4
    ℹ pass 3
    ℹ fail 1

    ✖ failing tests:

    test at tests_node/add_fail.test.js:13:3
    ✖ add(-1, 1) = 99 (1.439125ms)
      AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
      
      0 !== 99
      
          at TestContext.<anonymous> (file:///.../tests_node/add_fail.test.js:14:12)
          ...
        generatedMessage: true,
        code: 'ERR_ASSERTION',
        actual: 0,
        expected: 99,
        operator: 'strictEqual',
        diff: 'simple'
      }
    exit=1
    ```
  - 行数比較（`logs/21-loc-compare.txt` 全文）:
    ```
    $ wc -l  各テストファイル
          12 tests_deno/add_test.ts
          17 tests_node/add.test.js
          13 tests_deno/render_test.ts
          13 tests_node/render.test.js
          55 total
    ```
  - **「同じことをやるのに自分で書く必要があったもの」**（node:test 側）:
    1. `for (const [a, b, expected] of cases)` のループ本体（3行）
    2. テスト名のテンプレート文字列 `` `add(${a}, ${b}) = ${expected}` ``（＝Deno の `"add(%i, %i) = %i"` に相当）
    3. ケース配列を `const cases = [...]` として外出しする手間（`.each()` は引数に直接渡せる）
    4. `import assert from "node:assert/strict"`（Deno 側は `jsr:@std/assert` を import するので、ここは相殺）
  - 記事に書きたい気づき: 差は5行。**行数そのものは劇的な差ではない**。効いているのは「名前を組み立てる責任が自分から外れる」ことと、`--filter` がケース名で効くこと

### フェーズ4: 深掘り・比較（見積もり 45分 → 実測 約2分）

- [x] Node 側スナップショットを 26.7.0 と 22.17.0 の両方で実行する（見積もり 20分 → 実測 約2分）
  - コード（`tests_node/render.test.js`、13行）:
    ```js
    import { test } from "node:test";
    import { renderHeader } from "../src/render.js";

    test("renders the header", (t) => {
      t.assert.snapshot(renderHeader({ title: "Deno 2.9" }));
    });

    // パラメータ化も自前ループ
    for (const title of ["Hello", "こんにちは"]) {
      test(`renderHeader ${title}`, (t) => {
        t.assert.snapshot(renderHeader({ title }));
      });
    }
    ```
  - **v26.7.0 / 更新フラグ無しの初回**（Deno と同じく生成されない）。エラー全文の要点:
    ```
    ✖ renders the header (3.590417ms)
      Error [ERR_INVALID_STATE]: Invalid state: Cannot read snapshot file '/.../tests_node/render.test.js.snapshot.' Missing snapshots can be generated by rerunning the command with the --test-update-snapshots flag.
          at throwReadError (node:internal/test_runner/snapshot:253:17)
          at SnapshotFile.readFile (node:internal/test_runner/snapshot:114:7)
          at TestContext.snapshotAssertion (node:internal/test_runner/snapshot:206:22)
          ... 5 lines matching cause stack trace ...
          at startSubtestAfterBootstrap (node:internal/test_runner/harness:387:17) {
        code: 'ERR_INVALID_STATE',
        cause: Error: ENOENT: no such file or directory, open '/.../tests_node/render.test.js.snapshot'
            at readFileSync (node:fs:539:20)
            ...
          errno: -2,
          code: 'ENOENT',
          syscall: 'open',
          path: '/.../tests_node/render.test.js.snapshot'
        },
        filename: '/.../tests_node/render.test.js.snapshot'
      }
    （3件とも同形式。全文は logs/22-node-snap-26.txt）
    ℹ pass 0
    ℹ fail 3
    exit=1
    ```
    → **Deno との差**: Node は `Missing snapshots can be generated by rerunning the command with the --test-update-snapshots flag.` と**初回から更新方法を案内してくれる**。Deno の `Missing snapshot file.` は案内なし
  - `--test-update-snapshots` で生成:
    ```
    $ node --test --test-update-snapshots tests_node/render.test.js
    ✔ renders the header (3.3265ms)
    ✔ renderHeader Hello (0.387917ms)
    ✔ renderHeader こんにちは (0.399709ms)
    ℹ tests 3
    ℹ pass 3
    ℹ fail 0
    exit=0
    ```
  - 生成された `tests_node/render.test.js.snapshot` の中身（全文）:
    ```js
    exports[`renderHeader Hello 1`] = `
    "<header class=\\"site-header\\"><h1>Hello</h1></header>"
    `;

    exports[`renderHeader こんにちは 1`] = `
    "<header class=\\"site-header\\"><h1>こんにちは</h1></header>"
    `;

    exports[`renders the header 1`] = `
    "<header class=\\"site-header\\"><h1>Deno 2.9</h1></header>"
    `;
    ```
  - **`.snap` と `.snapshot` のフォーマット差**:

    | | Deno `__snapshots__/render_test.ts.snap` | Node `tests_node/render.test.js.snapshot` |
    |---|---|---|
    | 置き場所 | テストファイル隣の `__snapshots__/` サブディレクトリ | **テストファイルと同じ階層に並ぶ**（`.js.snapshot`） |
    | モジュール形式 | `export const snapshot = {}` （ESM） | `exports[...]` （CJS） |
    | 値の囲み | 単一行。`"` を含むと `'` に切り替えてエスケープ回避 | 前後に改行を入れた複数行。`"` は `\\"` にエスケープ |
    | 並び順 | **テストの登録順** | **キーのアルファベット順**（`renderHeader Hello` → `こんにちは` → `renders the header`） |
    | 読みやすさ | 差分がそのまま HTML として読める | エスケープが混ざるので目視レビューが少し重い |

  - **v22.17.0 での実行（仮説の検証）**:
    ```
    === node v22.17.0 ===
    $ node --test tests_node/render.test.js
    TAP version 13
    # Subtest: renders the header
    ok 1 - renders the header
    ...
    # tests 3
    # pass 3
    # fail 0
    exit=0

    $ node --test --experimental-test-snapshots tests_node/render.test.js
    TAP version 13
    ...
    # pass 3
    # fail 0
    exit=0
    ```
  - **仮説は外れた**: v22.17.0 は `--experimental-test-snapshots` **無しで通った**。ただし「フラグが無いから比較をスキップして緑になっただけでは？」を疑い、追加で検証した（`logs/23b-node22-snap-mismatch.txt`）:
    ```
    ### 検証: v22 でスナップショットが本当に比較されているか（出力をわざと変えた）
    === node v22.17.0 ===
    not ok 1 - renders the header
      error: |-
        Expected values to be strictly equal:
        + actual - expected
        
        + '\n"<header class=\\\\"CHANGED\\\\"><h1>Deno 2.9</h1></header>"\n'
        - '\n"<header class=\\\\"site-header\\\\"><h1>Deno 2.9</h1></header>"\n'
        
      code: 'ERR_ASSERTION'
      stack: |-
        TestContext.snapshotAssertion (node:internal/test_runner/snapshot:206:9)
        assert.<computed> [as snapshot] (node:internal/test_runner/test:320:18)
    # pass 0
    # fail 3
    exit=1
    ```
    → **v22.17.0 でも実際に比較している**（緑の空振りではない）。v22.3.0 追加・v23.4.0 stable だが、22.17.0 の時点で既にフラグ不要になっている
  - v26.7.0 で同じ不一致を出した場合（`logs/23c-node26-snap-mismatch.txt`）: 内容は同じ AssertionError で、表示が spec 形式になるだけ
  - 記事に書きたい気づき: **「stable 化バージョン = それまではフラグが要る」ではなかった**。ドキュメントの Added/Stable 表記だけで判断せず、手元の版数で実際に叩くのが早い。ただし「フラグ無しで緑」を見たら**わざと壊して赤くなるか確認する**べき、という教訓もセットで書ける

- [x] （計画外の追加検証）Deno と Node で同じ `.ts` を共有できるか（実測 約1分）
  - 実行したコマンド:
    ```bash
    nvm use 26.7.0 && node --test tests_node/add_ts.test.ts 2>&1 | tee logs/24-node-ts-shared.txt
    nvm use 22.17.0 && node --test tests_node/add_ts.test.ts 2>&1 | tee logs/24b-node22-ts-shared.txt
    ```
  - v26.7.0（`src/add.ts` を直接 import。**拡張子付き `../src/add.ts`**）:
    ```
    === node v26.7.0 ===
    ✔ add(1, 2) = 3 (2.067959ms)
    ✔ add(10, 32) = 42 (0.394334ms)
    ℹ tests 2
    ℹ pass 2
    ℹ fail 0
    exit=0
    ```
  - v22.17.0（エラー全文）:
    ```
    === node v22.17.0 ===
    TAP version 13
    # node:internal/modules/esm/get_format:219
    #   throw new ERR_UNKNOWN_FILE_EXTENSION(ext, filepath);
    #         ^
    # TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".ts" for /.../tests_node/add_ts.test.ts
    #     at Object.getFileProtocolModuleFormat [as file:] (node:internal/modules/esm/get_format:219:9)
    #     at defaultGetFormat (node:internal/modules/esm/get_format:245:36)
    #     at defaultLoad (node:internal/modules/esm/load:120:22)
    #     at async ModuleLoader.loadAndTranslate (node:internal/modules/esm/loader:580:32)
    #     at async ModuleJob._link (node:internal/modules/esm/module_job:154:19) {
    #   code: 'ERR_UNKNOWN_FILE_EXTENSION'
    # }
    # Node.js v22.17.0
    not ok 1 - tests_node/add_ts.test.ts
      code: 'ERR_TEST_FAILURE'
    # fail 1
    exit=1
    ```
  - 分かったこと: **Node 26.7.0 なら Deno と完全に同じ `.ts` ソースを共有できる**（拡張子付き import もそのまま通る）。比較の公平性を保つ手間は、Node の版数次第で大きく変わる。今回は 22 での比較も残したかったので `.js` 版を併置した（＝**この二重管理自体が「条件を揃えるコスト」**）

- [x] `renderHeader()` の HTML を Playwright でスクショ（見積もり 15分 → 実測 約1分）
  - 実行したコマンド:
    ```bash
    npx --yes playwright@latest install chromium
    npx --yes playwright@latest screenshot --viewport-size=800,200 "file://$PWD/preview.html" ../screenshots/01-render-header.png
    ```
  - 出力:
    ```
    Navigating to file:///.../workspace/preview.html
    Capturing screenshot into ../screenshots/01-render-header.png
    elapsed=14s
    -rw-r--r--@ 1 katayamaryuunosuke  staff  12004 Aug 14 04:17 01-render-header.png
    ```
  - スクショ: `screenshots/01-render-header.png`（黒背景に白文字の "Deno 2.9" ヘッダーと、下に日本語の説明行。`renderHeader({ title: "Deno 2.9" })` が返す HTML の実際の見た目）
  - Chromium DL は 14秒で完了。撤退ライン（10分）には遠く及ばず

- [x] 4観点の比較表（見積もり 10分 → 実測 約5分）→ 後述の「4観点の比較表」節

### フェーズ5: 振り返り・記事化準備（見積もり 30分 → 実測 約10分）

- [x] `logs/` を頭から見返して詰まった点を時系列で棚卸し → 後述の「詰まった点と解決過程」節
- [x] 記事への写像を実績で埋める → 後述の「記事への写像」節

## 4観点の比較表（Deno 2.9.5 / Node 26.7.0・22.17.0 での実測）

| 観点 | Deno 2.9.5 (`Deno.test.each` / `t.assertSnapshot`) | Node `node:test` (26.7.0) | 根拠ログ |
|---|---|---|---|
| **行数**（add の4ケース） | **12行**。ケース配列を `.each()` の引数に直接渡せる | **17行**。`const cases` の外出し＋`for...of`＋名前テンプレートで +5行 | `21-loc-compare.txt` |
| **テスト名の出方** | `"add(%i, %i) = %i"` を書くだけで `add(1, 2) = 3` に展開。オブジェクトケースは `$a + $b = $sum` / `$input.a` のネストも可。`%#` でケース番号（0始まり） | 名前は**自分でテンプレート文字列を組む**（`` `add(${a}, ${b}) = ${expected}` ``）。書き忘れると全ケース同名になる | `10-deno-each-array.txt` / `10c-deno-each-object.txt` / `20-node-loop-params.txt` |
| **失敗時出力** | 落ちたケース名で特定可（`add(-1, 1) = 99 ... FAILED`）。`[Diff] Actual / Expected` を色付きで表示。行番号は `.each()` の呼び出し位置を指す | 同じく名前で特定可（`✖ add(-1, 1) = 99`）＋ `test at tests_node/add_fail.test.js:13:3` と**ループ内の行番号**まで出る。`AssertionError` オブジェクトを丸ごとダンプするので情報量は多いが縦に長い | `11-deno-each-fail.txt` / `20b-node-loop-fail.txt` |
| **スナップショット更新フロー** | ①初回は `Missing snapshot file.` で失敗（**更新方法の案内なし**）②`deno test -u` で `> 3 snapshots updated.` ③不一致時は差分＋`deno test --update-snapshots [files]...` を案内 ④**`-u` 付きフル実行のときだけ** stale を prune（`> 1 snapshot removed.` と名前を表示）⑤権限フラグ不要 | ①初回は `ERR_INVALID_STATE` で失敗するが**その場で `--test-update-snapshots` を案内**②`--test-update-snapshots` で生成 ③不一致時は `AssertionError` の actual/expected ④prune 相当の表示は**今回は確認していない**（範囲外） | `12〜18-deno-*.txt` / `22-node-snap-26.txt` |
| （おまけ）**ケース単位のフィルタ** | `deno test --filter "add(1, 2)"` → `1 passed \| 3 filtered out` | `node --test --test-name-pattern` で同等のことは可能だが**今回は未検証**（範囲外） | `10b-deno-filter.txt` |
| （おまけ）**バージョン差の踏みやすさ** | 2.8.3 → 2.9.5 に上げる時点で `deno upgrade` が使えないという壁 | v22 と v26 で**レポータ既定（TAP / spec）**も**`.ts` を読めるか**も違う | `01-deno-upgrade.txt` / `20-*` / `24*-node-ts-shared.txt` |

### どちらを使いたいと思ったか（新人視点・今回試した範囲では）

今回の範囲では **表が増えるほど Deno 側に寄りたくなった**。決め手は行数（12 vs 17）ではなく、**テスト名を組み立てる責任が自分から外れること**だった。`node:test` の手書きループでも同じ名前は作れるが、それは「名前をちゃんとテンプレート化する」と自分で決めた場合の話で、雑に書くと4ケース全部が同名になる。`.each()` は名前を書く場所が最初から用意されている。

一方で、`node:test` を捨てる理由にはならないとも思った。今回いちばん怖かったのは **Deno の名前補間を取り違えても静かに通ってしまう**こと（`MISUSE array-case with undefined + undefined = undefined ... ok`）で、これは手書きテンプレート文字列では起きない事故。スナップショット単体で見れば、初回に更新方法を案内してくれる `node:test` のほうが親切だった。

## 詰まった点と解決過程（記事の核）

| # | 詰まった点 | 原因 | 効いた対処 | 所要 | 解決/撤退 | 記事での活かし方 |
|---|---|---|---|---|---|---|
| 1 | `deno upgrade` が `This deno was built without the "upgrade" feature.` で拒否 | Homebrew の deno は upgrade 機能を外してビルドされている（`which -a deno` → `/opt/homebrew/bin/deno`） | `brew update && brew upgrade deno` → 2.8.3 → 2.9.5 | 約4分（大半は `brew update`） | 解決 | 「公式ブログの手順どおり叩いたら断られた」＝最初の詰まり。**予測していた拒否理由（パッケージマネージャ検出）と実際の理由が違った**のがオチになる |
| 2 | `.each()` + `t.assertSnapshot()` で TS2339 × 2 | **`.each()` のコールバックはケース引数が先、`TestContext` が最後**。素の `Deno.test()` と逆に見える | `async (t, { title })` → `async ({ title }, t)` | 約2分 | 解決 | エラーメッセージが「TestContext に title が無い」としか言わないので、引数順だと気づきにくい。knowledge にも記録済み |
| 3 | スナップショットが初回実行で生成されず `AssertionError: Missing snapshot file.` | Deno は初回でも `-u` を要求する。しかもこのメッセージは**更新方法を案内しない**（不一致時は案内する） | `deno test -u` を付ける | 約1分 | 解決 | 「公式ブログを読んだだけだと初回自動生成だと思い込む」典型。Node 側は同じ状況で `--test-update-snapshots` を案内してくれる、という対比が効く |
| 4 | `MODULE_TYPELESS_PACKAGE_JSON` 警告 | workspace に `package.json` が無く、リポジトリ直下の `package.json`（`type` 未指定）まで遡って解決された | workspace に `{ "type": "module", "private": true }` を置く | 約1分 | 解決 | 「検証用の作業ディレクトリを親リポジトリの中に作ると設定を引きずる」話。比較の条件を揃える工夫のひとつとして書ける |
| 5 | Node 26 で試したつもりが 22 で走っていた | `nvm use` はシェル関数で、次のコマンド実行には引き継がれない。default の 22.17.0 に戻っていた | 毎コマンド先頭で `source ~/.nvm/nvm.sh && nvm use 26.7.0`、ログ先頭に `node --version` を必ず出す | 約2分 | 解決 | **事前の詰まりポイント表で予測していたものを本当に踏んだ**。副産物として v22=TAP / v26=spec というレポータ差を発見。「出力の見た目が違ったらまず `node --version`」 |
| 6 | 検証の最後に**リポジトリ直下に `deno.lock` が生えていた** | workspace に置いた `package.json`（詰まり #4 の対処）を起点に、Deno がリポジトリ直下まで遡って workspace root と判定し、そこに lock を書いた。中身は `jsr:@std/assert@1` → 1.0.19 など | `rm -f deno.lock`（リポジトリ本体の成果物ではないため削除）。workspace 側の `deno.lock` はそのまま残す | 約1分 | 解決 | 詰まり #4 の**対処が別の副作用を生んだ**という連鎖。「親リポジトリの中に検証ディレクトリを作ると、ツールが設定もロックファイルも上まで見に行く」話として #4 と1セットで書ける。最後に `git status` を見る習慣の話にも繋がる |

### 予測（詰まりポイント表）との差分

- 予測 #1（`deno upgrade` が通らない）→ **踏んだ。ただし拒否理由が予測と違った**
- 予測 #2（Node 22 でスナップショットがフラグを要求する）→ **踏まなかった**。22.17.0 はフラグ無しで動き、わざと壊すと赤くなることまで確認した（＝空振りの緑ではない）
- 予測 #3（`nvm use` がシェルごとに要る）→ **踏んだ**
- 予測 #4（名前補間が期待どおりに展開されない）→ 正しく書けば全部効いた（`%#` も `$key.nested` も）。**むしろ「取り違えても静かに通る」ほうが問題**だった
- 予測 #5（スナップショットの差分が読めない / 更新して良いか迷う）→ 差分は読みやすかった。**迷いどころは「初回に `-u` が要る」と「prune がいつ走るか」**だった
- 予測 #6（Deno と Node で同じ `.ts` を共有できない）→ **Node 26.7.0 では共有できた**。共有できないのは 22.17.0 のほう
- **予測になかった詰まり**: #2（`.each()` の引数順）、#4（MODULE_TYPELESS_PACKAGE_JSON）、#6（リポジトリ直下に `deno.lock` が生えた）

## スクリーンショット一覧

| ファイル | 何を示すか | 使う見出し |
|---|---|---|
| `screenshots/01-render-header.png` | `renderHeader({ title: "Deno 2.9" })` が返す HTML を最小ページに埋めて表示したもの。スナップショットテストが実際に守っている見た目 | 5. 実際に試したこと（スナップショット節の導入）|

## 記事への写像（実績で埋める）

| 記事の見出し | 使う記録 / スクショ | 書くこと（メモ） |
|---|---|---|
| 1. はじめに | 「実行の前提」節 / `logs/00-before-versions.txt` `02-after-versions.txt` | macOS 26.5 / deno 2.8.3→2.9.5 / Node 22.17.0 と 26.7.0。新人が試した範囲であることの明示。過去記事 `deno29-task-cache-boundaries` / `deno29-package-lock-seed-ci-check` との切り分け（今回は**テスト機能**） |
| 2. なぜこの技術を試すのか | フェーズ3最終タスクの「自分で書く必要があったもの」4項目 | node:test では毎回 `for...of` と名前テンプレートを書いていた、という具体的な痛みから入る。行数差は5行しかないが、痛みは行数ではないと繋げる |
| 3. 事前に調べたこと | フェーズ1の記録 | Deno 2.9 の補間トークン表と、`node:test に test.each 相当が無い`（出典 https://nodejs.org/api/test.html）。`t.assert.snapshot` は v22.3.0 追加 / v23.4.0 stable という**ドキュメント上の事実**をここで置き、あとで実測に裏切られる伏線にする |
| 4. 環境構築 | 詰まり #1 / `logs/01-deno-upgrade.txt` `01b-brew-upgrade.txt` `03-node-version.txt` | `deno upgrade` のエラー全文（`built without the "upgrade" feature`）→ `brew upgrade deno` で 2.9.5。`nvm install` は不要で `nvm use` だけで済んだ話 |
| 5. 実際に試したこと | フェーズ3の全ログ（`10` / `10b` / `10c` / `11` / `12` / `12b` / `13` / `14` / `15` / `16` / `17` / `18`）+ `screenshots/01-render-header.png` | 配列ケース→オブジェクトケース→`%#`/`$key.nested`→わざと落とす→`__snapshots__` 生成→不一致→`-u`→再パス→prune、の順。コードは12行版をそのまま貼る。スクショはスナップショット節の頭に置く |
| 6. 詰まった点 | 「詰まった点と解決過程」表（6件）+ 各エラー全文 | 特に #1（upgrade）と #2（引数順の TS2339）と #3（初回は `-u` が要る）を独立した小見出しに。#5（`nvm use` が引き継がれない）は「新人あるある」枠。#4 と #6 は「親リポジトリの中で検証するときの副作用」として1セットで |
| 7. 触ってみて分かったこと | フェーズ3・4の気づき欄 / `10b-deno-filter.txt` / `10c-deno-each-object.txt` / `18-deno-snap-prune.txt` | ケース単位で実テストになるので `--filter` が効く利点。逆に**補間記法を取り違えても静かに緑になる**落とし穴（`undefined + undefined = undefined ... ok` の出力を貼る）。prune は `-u` 付きフル実行のときだけ |
| 8. node:testと比べて感じたこと | 「4観点の比較表」節 + `21-loc-compare.txt` + `22-node-snap-26.txt` `23-node-snap-22.txt` `23b-node22-snap-mismatch.txt` `24*-node-ts-shared.txt` | 4観点の表をそのまま。**Node 22.17.0 でフラグ不要だった＝仮説が外れた**話と、「緑を疑ってわざと壊して確かめた」手順。`.snap` と `.snapshot` のフォーマット差表。v22=TAP / v26=spec の既定差。条件を揃えるために `.js` を併置した（＝Node 26 なら `.ts` 共有できた）話 |
| 9. どんな人に向いていそうか | 「どちらを使いたいと思ったか」段落 | 表が多いテストを書く人 / スナップショットを標準機能だけで回したい人。ただし「今回試した範囲では」と限定する |
| 10. まとめ | 「予測との差分」節 / 未検証項目 | 予測5件のうち当たったのは2件、という振り返り。今回試していない範囲（`node --test --test-name-pattern` での比較、Node 側の stale prune、`fileSnapshot`、`Deno.test.only.each` / `ignore.each`、CSS module imports 等）を明記 |

## 未達・撤退した項目

なし。完了条件5件すべて達成、撤退ラインは1件も発動しなかった。

範囲外として意図的に触らなかったもの（記事では「今回試していない範囲」として明記する）:

- `node --test --test-name-pattern` によるケース単位フィルタ（Deno の `--filter` との対称比較）
- Node 側のスナップショット stale prune 挙動
- `t.assert.fileSnapshot()` / `snapshot.setResolveSnapshotPath()` / `setDefaultSnapshotSerializers()`
- `Deno.test.only.each` / `Deno.test.ignore.each`
- Deno 2.9 のその他の新機能（CSS module imports 等）

## 再現性メモ（記事に転記する用）

- OS / ランタイム: macOS 26.5 (Build 25F71, arm64) / deno **2.9.5** (v8 15.0.245.2-rusty, typescript 6.0.3) / Node **v26.7.0** (npm 11.19.0) と **v22.17.0** (npm 10.9.2) / nvm / Homebrew
- 依存: `jsr:@std/assert@1`（実際に解決されたのは 1.0.19、`@std/internal` 1.0.14 を巻き込む）。Node 側は標準モジュールのみで追加依存ゼロ
- 実行コマンドの並び（最短の再現手順）:
  ```bash
  # 1. Deno を 2.9 系へ（Homebrew 管理の場合）
  which -a deno                    # 導入経路を先に確認する
  deno upgrade                     # → built without the "upgrade" feature で失敗する
  brew update && brew upgrade deno
  deno --version                   # 2.9.5

  # 2. 作業場
  mkdir -p work/{src,tests_deno,tests_node,logs} && cd work
  echo '{ "type": "module", "private": true }' > package.json   # MODULE_TYPELESS_PACKAGE_JSON 回避

  # 3. Deno 側（テストコードは本文参照）
  deno test tests_deno/add_test.ts
  deno test --filter "add(1, 2)" tests_deno/add_test.ts
  deno test tests_deno/render_test.ts     # 初回は Missing snapshot file. で落ちる
  deno test -u tests_deno/render_test.ts  # ここで __snapshots__/*.snap が生まれる
  # renderHeader の出力を変えてから
  deno test tests_deno/render_test.ts     # 差分表示
  deno test -u tests_deno/render_test.ts  # 更新
  deno test -u tests_deno/                # フル実行 + -u で stale が prune される

  # 4. Node 側（毎回 nvm use を打つ / ログ先頭に node --version を出す）
  source ~/.nvm/nvm.sh && nvm use 26.7.0 && node --version
  node --test tests_node/add.test.js
  node --test tests_node/render.test.js                          # 初回は ERR_INVALID_STATE
  node --test --test-update-snapshots tests_node/render.test.js
  ```
- 注意点（ハマりどころ）:
  - **`deno upgrade` は導入経路によって使えない**。`which -a deno` を先に見る
  - **`.each()` のコールバックはケース引数が先、`TestContext` が最後**（`({ title }, t) => ...`）
  - **Deno のスナップショットは初回でも `-u` が必要**。`Missing snapshot file.` は更新方法を案内しない
  - **stale entry の prune は `-u` 付きフル実行のときだけ**走る
  - **補間記法の取り違えはエラーにならない**。テスト名に `undefined` / `NaN` / `[object Object]` が出たら疑う
  - printf トークンは位置引数を順に消費する（`%#` は消費しない）
  - **`nvm use` は次のコマンドに引き継がれない**。スクリプト実行のたびに `source ~/.nvm/nvm.sh && nvm use <ver>`
  - **Node の既定レポータは版数で違う**（22.17.0 = TAP、26.7.0 = spec）。出力の見た目が違ったら `node --version`
  - **`.ts` を直接 `node --test` できるのは Node 26.7.0。22.17.0 は `ERR_UNKNOWN_FILE_EXTENSION`**
  - 親リポジトリの中に作業ディレクトリを作ると `package.json` の解決が上に抜ける（`MODULE_TYPELESS_PACKAGE_JSON`）。さらに `package.json` を置くと今度は **Deno がリポジトリ直下を workspace root と判定して `deno.lock` をそこに書く**ので、終わったら `git status` を見る
  - `brew upgrade deno` は依存パッケージも巻き込んで更新する（今回は jpeg-turbo / giflib / libpng / webp / libtiff / sqlite / yt-dlp も更新された）

## 次のアクション（記事化）

- [ ] この execution-log.md の「記事への写像」に沿って `articles/deno29-test-each-snapshot.md` を作成する（`/draft-article`）
- [ ] `screenshots/01-render-header.png` を `images/deno29-test-each-snapshot/01-render-header.png` に移し、本文から `![renderHeader の出力](/images/deno29-test-each-snapshot/01-render-header.png)` で参照する
- [ ] 完了条件・詰まった点（5件）・4観点の比較表を本文に落とす
- [ ] 「予測との差分」5件を軸に、経験談としての起伏を作る（特に Node 22 のフラグ仮説が外れた件）
