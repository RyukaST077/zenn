# 検証ログ: pnpm 11 の `minimumReleaseAge` 既定24hを、公開直後のバージョンで実際に踏む

> Zenn記事の素材。実行の一次情報（コマンド・エラー全文・所要時間）を記録。
> 記事本文は未執筆。「記事への写像」を見て articles/*.md に展開する。

## 実行の前提（採用した前提）

- 対象タスク: `practice/practice-pnpm11-minimum-release-age-20260808-0407.md`
- 出典レポート: `research/search-topic-20260808-0402.md`（候補2）
- 対象技術: pnpm 11.20.0（`minimumReleaseAge` / `minimumReleaseAgeStrict` / `minimumReleaseAgeExclude` / `blockExoticSubdeps` / `strictDepBuilds` / `allowBuilds` / `verifyDepsBeforeRun` / SQLiteストア）。比較対象 pnpm 10.13.1 と pnpm 10.34.5
- 実行者: AIエージェント単独（非対話）
- 実行日時 / 所要時間: 2026-08-08 04:11〜04:25 JST（= 2026-08-07 19:11〜19:25 UTC） / 見積もり 385分 → 実測 約14分
- 実行環境: macOS 26.5 (Darwin 25.5.0, arm64) / Node.js v22.17.0 / npm 10.9.2 / グローバル pnpm 10.13.1（`/opt/homebrew/bin/pnpm`、検証中は一切使わず書き換えもしていない）
- 採用した撤退ライン: 対象タスク記載のものを採用（24h以内公開版が30分見つからなければ閾値側を動かす／ケースD が90分で再現できなければ未検証として切り離す）。**どちらも発動せず**
- 判断方針: 引数で渡されたのは対象タスクファイルのパスのみ。時間・撤退ラインはタスクファイルの記載をそのまま採用
- 実行都合の置き換え: 作業ディレクトリはタスク記載どおり `mktemp -d`（`/tmp/pnpm11-OSh1ra`）配下。fixture・ケース別ログは `workspace/` と `case-logs/` にコピー済み。ストアを消す計測はユーザーのグローバルストアを壊さないよう `--store-dir` で一時ディレクトリに逃がした（タスク記載の「ストアを消す」を等価な形に置換）

## 結果サマリー

- **完了条件の判定: 達成（8項目すべて / うち1項目は前提そのものを訂正して達成）**
- 作ったもの: 依存1〜3個の極小 fixture 16ケース（`workspace/fixtures/`）と、コマンド別の生ログ30本（`case-logs/`）
- スクショ: 0 枚（すべて CLI 出力のため。タスク計画どおり Playwright 不使用）
- 詰まった点: 5 件（うち解決 5 / 未解決・撤退 0）
- knowledge 記録: なし（`knowledge/` に該当なし、かつ今回のものは pnpm 固有の仕様理解であってプロジェクト横断のトラブルではないため未記録）

### この検証の一番の収穫（記事の主題）

**「pnpm 11 では新しすぎる版が入らない」は間違い。素の既定では*入る*。そして手元では入るのに CI で落ちる。**

| 場面 | pnpm 11.20.0 の素の既定での挙動 | 終了コード |
|---|---|---|
| `pnpm add <pkg>@<24h以内の版>`（exact） | **成功する**。しかも `pnpm-workspace.yaml` を勝手に作って `minimumReleaseAgeExclude` にその版を書き足す | 0 |
| `pnpm add <pkg>@^x.y.z`（range） | **成功する**。警告なしで24h以上前の古い版に落ちる | 0 |
| 上記で作られた `pnpm-lock.yaml` だけを持って `pnpm install --frozen-lockfile`（＝CI） | **失敗する**。`ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` | 1 |

つまり、`pnpm add` が自動生成した `pnpm-workspace.yaml` をコミットし忘れると、ローカルで通ったものが CI だけ落ちる。

## 完了条件の検証

| # | 完了条件 | 判定 | 根拠 |
|---|---|---|---|
| 1 | `npx pnpm@10.13.1 --version` / `npx pnpm@11.20.0 --version` が期待した版を出力する | 達成 | commands.log `[P1-4] version gate`（GATE-11: OK / GATE-10: OK） |
| 2 | registry API で24h以内公開の版を実データで1件以上特定し publish 時刻を保存 | 達成 | commands.log `[P3-1b]`。`@types/node@26.2.0` publish=2026-08-07T17:52:06.875Z（検証時点 age=1.37h）、`nanoid@3.3.18` age=2.55h |
| 3 | その版を exact 指定して pnpm 11 で install し `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` を含むエラー全文と終了コードを保存 | **達成（ただし前提を訂正）** | 素の `pnpm add` では**エラーにならない**。このコードが出るのは**ロックファイル検証**の経路。`case-logs/logs-case-f4-default-lockcheck.log`（exit=1）。解決時のエラーは別コード `ERR_PNPM_NO_MATURE_MATCHING_VERSION`（`case-logs/logs-case-f3-nolock.log`, exit=1） |
| 4 | 同じ指定を pnpm 10 で実行し成功することを対比として保存 | 達成 | `case-logs/logs-case-a2-pnpm10.log`（exit=0, 26.2.0 が入る） |
| 5 | range 指定でエラーか黙ってフォールバックかを、解決された実際の版で示す | 達成 | `case-logs/logs-case-b-range-pnpm11.log`。**警告ゼロで 26.1.2**（最新は 26.2.0） |
| 6 | `.npmrc` が効かず `pnpm-workspace.yaml` が効くことを同一コマンドの出力差で示す | 達成 | `case-logs/logs-case-c-discriminate-pnpm11-npmrc.log`(26.1.2) vs `logs-case-c-discriminate-pnpm11-yaml.log`(26.2.0)。加えて同じ `.npmrc` が pnpm 10.34.5 では効く（`logs-case-c-discriminate-pnpm10-npmrc.log`, 26.2.0） |
| 7 | `blockExoticSubdeps` に引っかかる transitive 依存をローカル fixture で再現し出力を保存 | 達成 | `case-logs/logs-case-d4-github-tarball.log`（`ERR_PNPM_EXOTIC_SUBDEP`, exit=1）。`false` で通ることも確認（`logs-case-d5-false.log`） |
| 8 | SQLiteストア（`$STORE/index.db`）の実在を確認し、コールド/ウォームの install 時間を各3回計測 | 達成 | commands.log `[P4]`。`index.db` は SQLite 3.x、テーブル `package_index`。計測は各3回実施（値のブレは下に明記） |

## タスク実行ログ（フェーズ別）

### フェーズ1: 事前調査（見積もり 45分 → 実測 約3分）

- [x] pnpm の latest 版と Node 要件を記録（見積もり10分 → 実測1分）
  - 実行したコマンド:
    ```bash
    npm view pnpm dist-tags --json
    npm view pnpm@latest engines --json
    node -v; npm -v; pnpm --version; which pnpm; sw_vers -productVersion
    ```
  - 出力（抜粋。全文は commands.log の `[P1-1]`）:
    ```
    {
      "next-10": "10.34.5",
      "latest-10": "10.34.5",
      "latest": "11.20.0",
      "next-11": "11.20.0",
      "latest-11": "11.20.0",
      "next-12": "12.0.0-rc.1"
    }
    {
      "node": ">=22.13"
    }
    v22.17.0
    10.9.2
    10.13.1
    /opt/homebrew/bin/pnpm
    26.5
    ```
  - 気づき: `latest` は 11.20.0、`next-12` に `12.0.0-rc.1` がもういる。ローカルのグローバル pnpm は 10.13.1 のままなので、何もしなければ pnpm 11 の既定は踏まない。

- [x] pnpm 11 で既定が変わった設定を一次情報で表にする（見積もり20分 → 実測1分）
  - 出典: [pnpm 11.0 リリースブログ](https://pnpm.io/blog/releases/11.0) / [Settings: Dependency Resolution](https://pnpm.io/settings/dependency-resolution) / [Settings: Build](https://pnpm.io/settings/build)

    | 設定 | 既定（pnpm 11） | ドキュメントの記述 |
    |---|---|---|
    | `minimumReleaseAge` | `1440`（分＝24h）。v11 より前は `0` | "To reduce the risk of installing compromised packages, you can delay the installation of newly published versions." |
    | `minimumReleaseAgeStrict` | **`minimumReleaseAge` を明示設定したときのみ true、そうでなければ false** | "Controls how pnpm behaves when no version of a dependency satisfies the minimumReleaseAge constraint within the requested range." |
    | `minimumReleaseAgeExclude` | `undefined` | "If you set minimumReleaseAge but need certain dependencies to always install the newest version immediately, you can list them under minimumReleaseAgeExclude." |
    | `minimumReleaseAgeIgnoreMissingTime` | `true` | "When true, pnpm skips the minimumReleaseAge check for a package whose registry metadata does not include the time field." |
    | `blockExoticSubdeps` | `true` | "only direct dependencies may use exotic sources. All transitive dependencies must be resolved from a trusted source, such as the configured registry." |
    | `strictDepBuilds` | `true` | — |
    | `verifyDepsBeforeRun` | `install` | — |
    | `optimisticRepeatInstall` | `true` | — |
    | `allowBuilds` | （旧5設定 `onlyBuiltDependencies` / `onlyBuiltDependenciesFile` / `neverBuiltDependencies` / `ignoredBuiltDependencies` / `ignoreDepScripts` を置き換え） | **map 形式**。例: `allowBuilds:\n  esbuild: true\n  core-js: false` |
    | Node | `>=22.13`（"Node.js 22 or newer — pnpm itself is now pure ESM."） | — |
  - **設定の置き場所**（記事の核）: "pnpm no longer reads non-auth settings from `.npmrc`. Configuration is split into two categories." — auth/registry 系は INI（`.npmrc` / `~/.config/pnpm/auth.ini`）、pnpm 固有設定は YAML（`pnpm-workspace.yaml` / `~/.config/pnpm/config.yaml`）。加えて `npm_config_*` 環境変数も読まれなくなり `pnpm_config_*` になった。

- [x] 予測3つを検証前に固定（見積もり5分 → 実測1分） → `predictions.md`
  - ① exact 指定すると install が失敗する（`ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` が出る）
  - ② `.npmrc` に `minimum-release-age=0` を書けば緩む
  - ③ 同じ exact 指定を pnpm 10.13.1 で実行すると成功する

- [x] 版ゲート（見積もり10分 → 実測10秒）
  - 実行したコマンド:
    ```bash
    V11=$(npx --yes pnpm@11.20.0 --version); V10=$(npx --yes pnpm@10.13.1 --version)
    echo "$V11" | grep -qx '11.20.0' && echo "GATE-11: OK"
    echo "$V10" | grep -qx '10.13.1' && echo "GATE-10: OK"
    ```
  - 出力（全文）:
    ```
    npx --yes pnpm@11.20.0 --version -> 11.20.0 (exit=0) elapsed=3s
    npx --yes pnpm@10.13.1 --version -> 10.13.1 (exit=0) elapsed=5s
    GATE-11: OK
    GATE-10: OK
    global pnpm --version -> 10.13.1  path=/opt/homebrew/bin/pnpm
    ```

### フェーズ2: 環境構築（見積もり 45分 → 実測 約2分）

- [x] 作業ルートとケース別ディレクトリ（実測1分）
  - 作業ルート: `/tmp/pnpm11-OSh1ra`（`mktemp -d`）。ログ規約は `logs-<case>-<pnpm版>.log` に stdout+stderr、末尾に `exit=<code> elapsed_ms=<ms>`。
- [x] 実行を包むシェル関数（実測1分） → `workspace/runner.sh`
  - macOS の `date` は `%3N` 非対応なので、ミリ秒は `python3 -c 'import time;print(int(time.time()*1000))'` で取った（過去記事で踏んだ既知の罠を回避）。
    ```bash
    now_ms() { python3 -c 'import time;print(int(time.time()*1000))'; }
    run() {           # run <logfile> <dir> <cmd...>
      local log="$1"; shift; local dir="$1"; shift
      { echo "### $(date -u +%FT%TZ) cwd=$dir"; echo "\$ $*"; } >> "$log"
      local s=$(now_ms); ( cd "$dir" && "$@" ) >> "$log" 2>&1; local code=$?; local e=$(now_ms)
      echo "exit=$code elapsed_ms=$((e-s))" >> "$log"
    }
    ```
- [x] 依存1個だけの `package.json` を各ケースに置き、`pnpm-workspace.yaml` は置かない（実測1分）
    ```json
    { "name": "fixture-case-a-exact", "version": "1.0.0", "private": true }
    ```
- [x] ストア位置の確認（実測1分）
  - 出力（全文）:
    ```
    pnpm11 store path: /Users/katayamaryuunosuke/Library/pnpm/store/v11
    pnpm10 store path: /Users/katayamaryuunosuke/Library/pnpm/store/v10
    --- ls -la ~/Library/pnpm/store/v11 ---
    ls: /Users/katayamaryuunosuke/Library/pnpm/store/v11: No such file or directory
    --- ls -la ~/Library/pnpm/store/v10 ---
    drwxr-xr-x@ 258 katayamaryuunosuke  staff  8256 Jul 12  2025 files
    drwxr-xr-x@ 258 katayamaryuunosuke  staff  8256 Jul 12  2025 index
    ```
  - **pnpm 10 と 11 でストアパスが違う**（`store/v10` と `store/v11`）。pnpm 11 のストアはこの時点でまだ存在せず、最初の install で作られた。→ 記事では「10 と 11 の install 時間は同じストアを共有していないので、初回は必ずコールドになる」と書ける。

### フェーズ3: 実装・検証【本編】（見積もり 170分 → 実測 約6分）

- [x] 24時間以内公開の版を registry API で特定（見積もり30分 → 実測2分。**ここで1回詰まった**）
  - 実行したコマンド（`workspace/find-fresh.mjs`）:
    ```bash
    node find-fresh.mjs 24 @types/node typescript esbuild rollup vite eslint prettier zod nanoid tslib @biomejs/biome oxlint
    ```
  - **1回目の出力（全パッケージで versions=0。原因が分からず止まった）**:
    ```
    @types/node: latest=26.2.0 versions=0 fresh(<24h)=0
    typescript: latest=7.0.2 versions=0 fresh(<24h)=0
    ...
    ---FRESH_JSON---
    []
    ```
  - 原因切り分けに使ったコマンドと出力（全文）:
    ```
    $ curl -s -H 'accept: application/vnd.npm.install-v1+json' https://registry.npmjs.org/tslib | node -e '...'
    keys: name,dist-tags,versions,modified
    has time: false
    $ curl -s https://registry.npmjs.org/tslib  # full packument
    has time: true time entries: 50
    ```
  - 効いた対処: `accept: application/vnd.npm.install-v1+json`（abbreviated metadata）を外して full packument を取る。**abbreviated metadata には `time` フィールドが無い**。
  - 2回目の出力（該当部分。全文は commands.log `[P3-1b]`）:
    ```
    @types/node: latest=26.2.0 versions=2346 fresh(<24h)=1
      @types/node@26.2.0  published=2026-08-07T17:52:06.875Z  age=1.37h
    nanoid: latest=6.0.1 versions=132 fresh(<24h)=1
      nanoid@3.3.18  published=2026-08-07T16:41:05.696Z  age=2.55h
    vite:  newest-stable: vite@8.2.1 published=2026-08-06T13:47:48.588Z age=29.44h
    ```
  - 検証対象に選んだのは `@types/node@26.2.0`（**選定条件は公開日時のみ**。安全性の評価は一切していない）。同じ 26.x の他の版:
    ```
    26.0.0  2026-06-19T07:14:52.347Z 1188.01h
    26.0.1  2026-06-24T20:33:01.352Z 1054.71h
    26.1.0  2026-07-01T11:04:10.429Z  896.19h
    26.1.1  2026-07-08T06:47:46.733Z  732.47h
    26.1.2  2026-07-27T17:32:14.992Z  265.72h
    26.2.0  2026-08-07T17:52:06.875Z    1.39h   ← 24h以内
    ```
  - つまずいた理由: registry に2種類のメタデータ形式（full packument / abbreviated）があることを知らなかった。`minimumReleaseAgeIgnoreMissingTime` の既定が `true` なのは、まさにこの `time` が無いケースを想定した設定だと後から腑に落ちた。

- [x] 【ケースA】pnpm 11 で exact 指定（見積もり25分 → 実測30秒）**予測①が外れた**
  - 実行したコマンド:
    ```bash
    cd case-a-exact && npx --yes pnpm@11.20.0 add @types/node@26.2.0
    ```
  - 出力（全文 / `case-logs/logs-case-a-exact-pnpm11.log`）:
    ```
    Progress: resolved 1, reused 0, downloaded 0, added 0
    Packages: +2
    ++
    Packages are cloned from the content-addressable store to the virtual store.
      Content-addressable store is at: /Users/katayamaryuunosuke/Library/pnpm/store/v11
      Virtual store is at:             node_modules/.pnpm
    Progress: resolved 2, reused 0, downloaded 2, added 2, done

    dependencies:
    + @types/node 26.2.0

    Added 1 entry to minimumReleaseAgeExclude in pnpm-workspace.yaml (set minimumReleaseAgeStrict to true to gate these updates with a prompt):
      @types/node@26.2.0
    Done in 2.8s using pnpm v11.20.0
    exit=0 elapsed_ms=5130
    ```
  - **エラーが出るどころか成功し、pnpm が勝手に `pnpm-workspace.yaml` を作った**:
    ```yaml
    minimumReleaseAgeExclude:
      - '@types/node@26.2.0'
    ```
    ```
    $ ls -a case-a-exact
    node_modules  package.json  pnpm-lock.yaml  pnpm-workspace.yaml
    $ node -p "require('./node_modules/@types/node/package.json').version"
    26.2.0
    ```
  - 追加検証（`pnpm add` ではなく `pnpm install` でも同じか / `case-logs/logs-case-a3-install-pnpm11.log`）: `package.json` にあらかじめ `"@types/node": "26.2.0"` を書いた状態で `pnpm install` しても**同じく成功し、同じく `pnpm-workspace.yaml` が自動生成された**（exit=0）。
  - 記事に書きたい気づき: 「明示的に頼んだ版は通す。ただし通したことを設定ファイルに書き残す」という設計。**この自動生成ファイルをコミットし忘れると CI が落ちる**（フェーズ4のケースFで実証）。

- [x] 【ケースA'】同じ exact 指定を pnpm 10.13.1 で（見積もり15分 → 実測20秒）**予測③は当たり**
  - 実行したコマンド:
    ```bash
    cd case-a-pnpm10 && npx --yes pnpm@10.13.1 add @types/node@26.2.0
    ```
  - 出力（全文 / `case-logs/logs-case-a2-pnpm10.log`）:
    ```
    Progress: resolved 1, reused 0, downloaded 0, added 0
    Packages: +2
    ++
    Progress: resolved 2, reused 0, downloaded 2, added 2, done

    dependencies:
    + @types/node 26.2.0

    Done in 1.4s using pnpm v10.13.1
    exit=0 elapsed_ms=3651
    ```
  - 差分: pnpm 10.13.1 は `pnpm-workspace.yaml` を作らない（`ls -a` に無い）。「Content-addressable store is at:」の行も出ない。

- [x] 【ケースB】range 指定（見積もり30分 → 実測30秒）**ここが本題**
  - 実行したコマンド:
    ```bash
    cd case-b-range && npx --yes pnpm@11.20.0 add '@types/node@^26.0.0'
    ```
  - 出力（全文 / `case-logs/logs-case-b-range-pnpm11.log`）:
    ```
    Progress: resolved 1, reused 0, downloaded 0, added 0
    Packages: +2
    ++
    Packages are cloned from the content-addressable store to the virtual store.
      Content-addressable store is at: /Users/katayamaryuunosuke/Library/pnpm/store/v11
      Virtual store is at:             node_modules/.pnpm
    Progress: resolved 2, reused 1, downloaded 1, added 2, done

    dependencies:
    + @types/node 26.1.2

    Done in 1.5s using pnpm v11.20.0
    exit=0 elapsed_ms=3614
    ```
  - 解決された版: **26.1.2**（publish 2026-07-27T17:32:14.992Z＝265.72h前）。最新の 26.2.0（1.39h前）ではない。差は約11日。
  - `package.json` に書き込まれた specifier も落ちた版に合わせて `"^26.1.2"`:
    ```json
    { "dependencies": { "@types/node": "^26.1.2" } }
    ```
  - `pnpm-workspace.yaml` は**作られない**（`ls: No such file or directory`）。
  - **警告・注記は一切出ない**。「最新が入らなかった」ことを知る手掛かりが出力に無い。
  - 予測①（exact でエラー）は外れ、一次情報どおり「`minimumReleaseAgeStrict` が未設定＝false なので黙ってフォールバック」が起きた。

- [x] 【ケースB'】`minimumReleaseAgeStrict: true` を明示（見積もり20分 → 実測30秒）
  - `pnpm-workspace.yaml`:
    ```yaml
    minimumReleaseAgeStrict: true
    ```
  - B'-1: 範囲内に代替が無い（exact 26.2.0）。実行コマンドと出力（全文 / `case-logs/logs-case-b-strict-exact-pnpm11.log`）:
    ```bash
    cd case-b-strict-exact && npx --yes pnpm@11.20.0 install --no-color
    ```
    ```
    Progress: resolved 1, reused 0, downloaded 0, added 0
    [ERR_PNPM_NO_MATURE_MATCHING_VERSION] 1 version does not meet the minimumReleaseAge constraint:
      @types/node@26.2.0 was published at 2026-08-07T17:52:06.875Z, within the minimumReleaseAge cutoff (2026-08-06T19:16:07.950Z)
    exit=1 elapsed_ms=3503
    ```
  - B'-2: 範囲内に代替がある（`^26.0.0`）。出力（全文 / `case-logs/logs-case-b-strict-range-pnpm11.log`）:
    ```
    dependencies:
    + @types/node 26.1.2

    Done in 1.1s using pnpm v11.20.0
    exit=0 elapsed_ms=2907
    ```
  - **重要な訂正**: 実践計画が想定していた `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` は、この「解決の失敗」経路では出ない。ここで出るのは `ERR_PNPM_NO_MATURE_MATCHING_VERSION`。VIOLATION の方は**ロックファイル検証**で出る別のコード（ケースF参照）。
  - つまり `strict: true` は「範囲内に条件を満たす版が1つも無いとき失敗にする」スイッチであって、「新しい版を拒む」スイッチではない。B'-2 で 26.1.2 に落ちる挙動は strict でも変わらない。

- [x] 【ケースC】`.npmrc` vs `pnpm-workspace.yaml`（見積もり30分 → 実測2分）**予測②が外れた**
  - C-1: `.npmrc` に `minimum-release-age=0`、`pnpm-workspace.yaml` に `minimumReleaseAgeStrict: true`、依存は exact 26.2.0。
    ```bash
    cd case-c-npmrc && npx --yes pnpm@11.20.0 install --no-color
    ```
    出力（全文 / `case-logs/logs-case-c-npmrc-pnpm11.log`）:
    ```
    Progress: resolved 1, reused 0, downloaded 0, added 0
    [ERR_PNPM_NO_MATURE_MATCHING_VERSION] 1 version does not meet the minimumReleaseAge constraint:
      @types/node@26.2.0 was published at 2026-08-07T17:52:06.875Z, within the minimumReleaseAge cutoff (2026-08-06T19:16:29.531Z)
    exit=1 elapsed_ms=3515
    ```
    **「その設定は無視した」という警告は出ない。完全に沈黙する。**
  - C-2: `.npmrc` はそのまま残し、`pnpm-workspace.yaml` に `minimumReleaseAge: 0` を足して**同じコマンドを再実行**。出力（全文 / `case-logs/logs-case-c-workspaceyaml-pnpm11.log`）:
    ```
    dependencies:
    + @types/node 26.2.0

    Done in 1.3s using pnpm v11.20.0
    exit=0 elapsed_ms=3500
    ```
  - C-4（判別テスト。ここが一番きれいな before/after）: 依存を `^26.0.0` にして、**設定の置き場所だけ**を変えて同じ `pnpm install` を3回走らせた。効いていれば 26.2.0、無視されていれば 26.1.2 になる。

    | # | 設定の中身 | 置き場所 | pnpm | 解決された版 | ログ |
    |---|---|---|---|---|---|
    | C-4a | `minimum-release-age=0` | `.npmrc` | 11.20.0 | **26.1.2**（無視された） | `case-logs/logs-case-c-discriminate-pnpm11-npmrc.log` |
    | C-4b | `minimum-release-age=0` | `.npmrc` | 10.34.5 | **26.2.0**（効いた） | `case-logs/logs-case-c-discriminate-pnpm10-npmrc.log` |
    | C-4c | `minimumReleaseAge: 0` | `pnpm-workspace.yaml` | 11.20.0 | **26.2.0**（効いた） | `case-logs/logs-case-c-discriminate-pnpm11-yaml.log` |

  - 副次的な発見（pnpm 10 系との出力差 / `case-logs/logs-case-c-pnpm10.34.5.log`）: pnpm 10.34.5 は落ちた版を教えてくれる。
    ```
    dependencies:
    + @types/node 26.1.2 (26.2.0 is available)
    ```
    pnpm 11.20.0 の同条件の出力は `+ @types/node 26.1.2` だけで、`(26.2.0 is available)` に相当する注記が無い。
  - 記事に書きたい気づき: ネット上の記事や LLM の回答はまだ `.npmrc` 前提。**同じ内容を同じ意味で書いても、置き場所だけで結果が割れる**のを3行の表で見せられる。

- [x] 【ケースD】`blockExoticSubdeps`（見積もり20分 → 実測3分。**3回空振りした**）
  - D-1（空振り）: 親 → `file:./child`（ローカルディレクトリ）→ 子の依存が `https://registry.npmjs.org/tslib/-/tslib-2.8.1.tgz`。
    ```
    dependencies:
    + fixture-d-child 1.0.0
    Done in 1.4s using pnpm v11.20.0
    exit=0
    ```
    → 弾かれない。
  - D-2（空振り）: 子を `npm pack` して `file:./fixture-d-child-1.0.0.tgz` にし、本物の推移依存にした。→ それでも exit=0。
  - D-3（空振り）: `pnpm-workspace.yaml` に `blockExoticSubdeps: true` を**明示**しても exit=0。
  - 原因調査（`npm pack pnpm@11.20.0` して dist を読んだ）:
    ```js
    if (ctx.blockExoticSubdeps && options.currentDepth > 0 && pkgResponse.body.resolvedVia != null &&
    isExoticDep(pkgResponse.body.resolvedVia)) {
      const error = new PnpmError("EXOTIC_SUBDEP", `Exotic dependency "${...}" (resolved via ${...}) is not allowed in subdependencies when blockExoticSubdeps is enabled`);
    ```
    ```js
    NON_EXOTIC_RESOLVED_VIA = new Set([
      "custom-resolver", "github.com/denoland/deno", "github.com/oven-sh/bun",
      "jsr-registry", "local-filesystem", "named-registry", "nodejs.org",
      "npm-registry", "workspace"
    ]);
    ```
    → **`https://registry.npmjs.org/...tgz` は `npm-registry` 扱いで exotic ではない**。`file:` も `local-filesystem` で exotic ではない。つまり「tarball URL なら何でも exotic」ではない。
  - D-4（再現成功）: 子の依存を**レジストリ外の** tarball URL に変えた。
    ```json
    // child-src/package.json
    { "name": "fixture-d-child", "version": "1.0.0",
      "dependencies": { "inherits": "https://codeload.github.com/isaacs/inherits/tar.gz/refs/tags/v2.0.4" } }
    ```
    ```json
    // 親 package.json
    { "name": "fixture-d4-parent", "version": "1.0.0", "private": true,
      "dependencies": { "fixture-d-child": "file:./fixture-d-child-1.0.0.tgz" } }
    ```
    ```bash
    cd case-d-exotic4 && npx --yes pnpm@11.20.0 install --no-color   # 設定ファイルなし＝素の既定
    ```
    出力（全文 / `case-logs/logs-case-d4-github-tarball.log`）:
    ```
    Progress: resolved 0, reused 0, downloaded 1, added 0
    [ERR_PNPM_EXOTIC_SUBDEP] Exotic dependency "inherits" (resolved via url) is not allowed in subdependencies when blockExoticSubdeps is enabled

    This error happened while installing the dependencies of fixture-d-child@1.0.0
    exit=1 elapsed_ms=3496
    ```
  - D-5（`false` にして通ることの確認 / `case-logs/logs-case-d5-false.log`）:
    ```yaml
    blockExoticSubdeps: false
    ```
    ```
    dependencies:
    + fixture-d-child 1.0.0
    Done in 1.7s using pnpm v11.20.0
    exit=0 elapsed_ms=3969
    ```
  - D-6（直接依存なら許される / `case-logs/logs-case-d6-direct-exotic.log`）: **同じ URL** を親の直接依存に置いた。
    ```
    dependencies:
    + inherits 2.0.4
    Done in 1.6s using pnpm v11.20.0
    exit=0 elapsed_ms=3345
    ```
  - D-7（pnpm 10.13.1 との対比 / `case-logs/logs-case-d7-pnpm10.log`）: D-4 と同じ fixture が pnpm 10.13.1 では通る（exit=0）。
  - 記事に書きたい気づき: 仕様文の「直接はOK・推移はNG」は実測で確認できた。ただし**「exotic とは何か」の線引きは URL の形ではなく `resolvedVia` の分類**で、レジストリのホスト上の tarball URL は exotic に入らない。ここは仕様文だけ読んでも分からず、fixture を3回作り直して初めて掴めた。

### フェーズ4: 深掘り・比較（見積もり 80分 → 実測 約3分）

- [x] SQLiteストアの実体確認とコールド/ウォーム計測（見積もり45分 → 実測2分）
  - ストアの中身（グローバルストア。全文は commands.log `[P4]`）:
    ```
    --- ls -la ~/Library/pnpm/store/v11 ---
    drwxr-xr-x@   3 ... file+fixture-d-child-1.0.0.tgz
    drwxr-xr-x@ 258 ... files
    -rw-r--r--@   1 ...  61440 Aug  8 04:20 index.db
    drwxr-xr-x@  14 ... projects
    --- ls -la ~/Library/pnpm/store/v10 ---
    drwxr-xr-x@ 258 ... files
    drwxr-xr-x@ 258 ... index          ← v10 は JSON ファイルのディレクトリ
    --- file index.db ---
    SQLite 3.x database, last written using SQLite version 3050000, ...
    --- sqlite3 .tables ---
    package_index
    --- sqlite3 .schema ---
    CREATE TABLE package_index (
              key TEXT PRIMARY KEY,
              data BLOB NOT NULL
            ) WITHOUT ROWID
          ;
    CREATE TABLE sqlite_stat1(tbl,idx,stat);
    ```
  - 計測（fixture は `express@^5 / chalk@^5 / date-fns@^4`、`minimumReleaseAge: 0` を明示して版のブレを消した。ストアは `--store-dir` で一時ディレクトリに逃がし、コールドは毎回そのディレクトリごと削除）:
    ```bash
    for mode in cold warm; do for i in 1 2 3; do
      rm -rf node_modules pnpm-lock.yaml
      [ "$mode" = cold ] && rm -rf "$STORE"
      npx --yes pnpm@"$V" install --store-dir "$STORE" --no-color
    done; done
    ```
    | pnpm | mode | run1 | run2 | run3 | 平均 | 中央値 |
    |---|---|---|---|---|---|---|
    | 11.20.0 | cold | 7833ms | 7562ms | 7517ms | 7637ms | 7562ms |
    | 11.20.0 | warm | 9810ms | 6283ms | 6127ms | 7407ms | 6283ms |
    | 10.13.1 | cold | 8467ms | 8751ms | 8328ms | 8515ms | 8467ms |
    | 10.13.1 | warm | 10714ms | 5891ms | 6228ms | 7611ms | 6228ms |
    - 全12回とも exit=0、`node_modules/.pnpm` のエントリ数は 70 で一致。
    - **warm の1回目が両バージョンとも突出（9810ms / 10714ms）**。原因は特定できていない（`npx` のキャッシュ検証か、直前にストアを消した影響と思われる）。1回計測なら「ウォームの方が遅い」という誤った結論になっていた。
    - 中央値で見ると warm ≈ 6.2s / cold ≈ 7.6〜8.5s。ただし**このマシンのこの回線での参考値**。install 全体が pnpm 本体の起動＋レジストリ解決に支配されており、ストア形式の差を測れているとは言えない。
  - ストアのサイズ（同一 fixture、同一 70 パッケージ）:
    ```
    pnpm 11: store-11/v11/index.db  1,208,320 bytes（単一 SQLite ファイル / package_index に 68 行）
    pnpm 10: store-10/v10/index/    JSON ファイル 68 個
    ```
    ```
    $ sqlite3 store-11/v11/index.db 'select key from package_index limit 5;'
    sha512-+1UMbeh68lH1SegH83CGWwpb6OHHbpSgr3+s5Eww5M4CAgswBpoWS0AjTOfEJ33HiYKz1hdj/KTFprzXHmq/6w==	date-fns@4.4.0
    sha512-+ys997U96po4Kx/ABpBCqhA9EuxJaQWDQg7295H4hBphv3IZg0boBKuwYpt4YXp6MZ5AmZQnU/tyMTlRpaSejg==	call-bound@1.0.4
    sha512-/IXtbwEk5HTPyEwyKX6hGkYXxM9nbj64B+ilVJnC/R6B0pH5G4V3b0pVbL7DBj4tkhBAppbQUlf6F6Xl9LHu1g==	math-intrinsics@1.1.0
    sha512-/Nf7TyzTx6S3yRJObOAV7956r8cr2+Oj8AC5dt8wSP3BQAoeX58NoHyCU8P8zGkNXStjTSi6fzO6F0pBdcYbEg==	bytes@3.1.2
    sha512-0KI/607xoxSToH7GjN1FfSbLoU0+btTicjsQSWQlh/hZykN8KpmMf7uYwPW3R+akZ6R/w18ZlXSHBYXiYUPO3g==	ipaddr.js@1.9.1
    ```
    → 68個のJSONファイルが1個のSQLiteテーブル（`key` = integrity + name@version）に畳まれている、という対応が実データで見える。

- [x] 他の新既定を拾い上げる（見積もり20分 → 実測1分）
  - E-1 `strictDepBuilds: true`（既定）。`esbuild@^0.28.0` を install しただけで落ちる（`case-logs/logs-case-e1-strictDepBuilds.log`）:
    ```
    dependencies:
    + esbuild 0.28.1

    [ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: esbuild@0.28.1

    Run "pnpm approve-builds" to pick which dependencies should be allowed to run scripts.
    exit=1 elapsed_ms=4854
    ```
  - E-2 旧設定名 `onlyBuiltDependencies` を `pnpm-workspace.yaml` に書いた場合（`case-logs/logs-case-e2-onlyBuiltDependencies.log`）:
    ```yaml
    onlyBuiltDependencies:
      - esbuild
    ```
    → **非推奨警告も未知キー警告も出ず、まったく同じ `ERR_PNPM_IGNORED_BUILDS` で落ちる**（exit=1）。沈黙して無視される。
  - E-3 `allowBuilds` をリスト形式で書いた場合（`case-logs/logs-case-e3-allowBuilds.log`）:
    ```yaml
    allowBuilds:
      - esbuild
    ```
    → これも**沈黙して無視**され `ERR_PNPM_IGNORED_BUILDS`（exit=1）。ドキュメントを読み直したら `allowBuilds` は**リストではなく map**だった。
  - E-5 map 形式に直したら通った（`case-logs/logs-case-e5-allowBuilds-map.log`）:
    ```yaml
    allowBuilds:
      esbuild: true
    ```
    ```
    .../esbuild@0.28.1/node_modules/esbuild postinstall$ node install.js
    .../esbuild@0.28.1/node_modules/esbuild postinstall: Done

    dependencies:
    + esbuild 0.28.1

    Done in 2.3s using pnpm v11.20.0
    exit=0 elapsed_ms=4784
    ```
  - E-4 `verifyDepsBeforeRun: install`（既定）。`node_modules` を消してから `pnpm run hello` を実行すると、**スクリプトの前に install が自動で走る**（`case-logs/logs-case-e4-verifyDepsBeforeRun.log`）:
    ```
    ✓ Lockfile passes supply-chain policies (verified 3s ago)
    Lockfile is up to date, resolution step is skipped
    ...
    [ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: esbuild@0.28.1
    ...
    [ERROR] Command failed with exit code 1: pnpm install

    pnpm: Command failed with exit code 1: pnpm install
        at getFinalError (file:///Users/.../pnpm/dist/pnpm.mjs:89001:14)
        ...
        at runDepsStatusCheck (file:///Users/.../pnpm/dist/pnpm.mjs:254302:7)
    exit=1 elapsed_ms=4200
    ```
    → `pnpm run` が install の失敗を巻き込んで落ちる。スタックトレースまで出るので初見だと何が起きたか読みにくい。
  - **未検証**: `optimisticRepeatInstall`、`minimumReleaseAgeExclude` の手書き（自動生成のみ確認）、`minimumReleaseAgeIgnoreMissingTime` の false 側、`~/.config/pnpm/config.yaml` 経由の設定。推測で書かない。

- [x] 既知の Issue と自分の観測を突き合わせる（見積もり15分 → 実測1分）← **ここで一番大きい発見が出た**
  - [#10438](https://github.com/pnpm/pnpm/issues/10438)「ロックに既にある依存には効かない」を確かめるため、ケースAが作った `pnpm-lock.yaml`（26.2.0 入り）と `package.json` だけを新しいディレクトリにコピーして install した。
  - F-4: **設定ファイルを一切置かない＝pnpm 11 の素の既定**で `--frozen-lockfile`（`case-logs/logs-case-f4-default-lockcheck.log`）:
    ```
    ? Verifying lockfile against supply-chain policies (2 entries)...
    Lockfile is up to date, resolution step is skipped
    Progress: resolved 1, reused 0, downloaded 0, added 0
    Packages: +2
    ++
    Packages are cloned from the content-addressable store to the virtual store.
      Content-addressable store is at: /Users/katayamaryuunosuke/Library/pnpm/store/v11
      Virtual store is at:             node_modules/.pnpm
    Progress: resolved 2, reused 2, downloaded 0, added 2, done
    ✗ Lockfile failed supply-chain policy check (2 entries in 547ms)
    [ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION] 1 lockfile entries failed verification:
      @types/node@26.2.0 was published at 2026-08-07T17:52:06.875Z, within the minimumReleaseAge cutoff (2026-08-06T19:25:05.568Z)

    The lockfile contains entries that the active policies reject. This can mean the lockfile is stale, or that someone committed a lockfile that bypassed the policy locally — inspect recent changes to pnpm-lock.yaml before trusting it. If the changes look expected, run "pnpm clean --lockfile" and then "pnpm install" to rebuild from a fresh resolution. Alternatively, relax the policy that flagged them.
    exit=1 elapsed_ms=3888
    ```
  - F-5: 同じ状態に**ケースAが自動生成した `pnpm-workspace.yaml` を足すだけ**で通る（`case-logs/logs-case-f5-with-exclude.log`）:
    ```yaml
    minimumReleaseAgeExclude:
      - '@types/node@26.2.0'
    ```
    ```
    ✓ Lockfile passes supply-chain policies (2 entries in 302ms)

    dependencies:
    + @types/node 26.2.0

    Done in 1.2s using pnpm v11.20.0
    exit=0 elapsed_ms=3673
    ```
  - F-1（`--frozen-lockfile` なしの `pnpm install`）でも同じ VIOLATION で exit=1（`case-logs/logs-case-f1-lockfile-bypass.log`）。ただし**エラーを出す前に `node_modules` は書かれている**（`node_modules/@types/node/package.json` が 26.2.0 で存在した）。
  - F-3（ロックを消して同条件）は解決経路のエラーになる（`case-logs/logs-case-f3-nolock.log`）:
    ```
    [ERR_PNPM_NO_MATURE_MATCHING_VERSION] 1 version does not meet the minimumReleaseAge constraint:
      @types/node@26.2.0 was published at 2026-08-07T17:52:06.875Z, within the minimumReleaseAge cutoff (2026-08-06T19:24:44.826Z)
    exit=1 elapsed_ms=6028
    ```
  - Issue 突き合わせの結論:
    | Issue | 再現条件 | 今回の観測 |
    |---|---|---|
    | [#10438](https://github.com/pnpm/pnpm/issues/10438) ロックに既にある依存には効かない | ロックに載った依存が素通りする | **当てはまらなかった**。pnpm 11.20.0 は `Verifying lockfile against supply-chain policies` という専用ステップを持ち、ロック上のエントリを publish 時刻で検証して落とす |
    | [#11982](https://github.com/pnpm/pnpm/issues/11982) ロック無し fresh install で固定版指定が latest タグを見る | fresh install での解決ずれ | **この版では確認できなかった**。ロック無し exact 指定は狙いどおり 26.2.0 を解決している（F-3） |
    | [#10100](https://github.com/pnpm/pnpm/issues/10100) 新しい major が出たときフォールバックしない | major 跨ぎ | **未検証**。今回の fixture は同一 major 内（26.x）でしか試していない |

### フェーズ5: 振り返り（見積もり 45分 → 実測 記録作成に集約）

## 予測の当否表（フェーズ1で固定した3つ）

| # | 検証前の予測 | 実測 | なぜ外れたか |
|---|---|---|---|
| ① | 24h以内の版を exact 指定すると install が失敗する（`ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`） | **外れ**。`pnpm add` も `pnpm install` も exit=0 で成功し、pnpm が `pnpm-workspace.yaml` を自動生成して `minimumReleaseAgeExclude` に書き足した | `minimumReleaseAgeStrict` の既定が「`minimumReleaseAge` を明示設定したときのみ true」。素の既定では失敗しない。さらに `pnpm add` は「明示的に頼まれた版」を除外リストに自動登録して通す設計だった |
| ② | `.npmrc` に `minimum-release-age=0` を書けば緩む | **外れ**。pnpm 11.20.0 は完全に無視し、警告も出さない。同じ `.npmrc` が pnpm 10.34.5 では効く | pnpm 11 から `.npmrc` は auth/registry 専用。pnpm 固有設定は `pnpm-workspace.yaml`（camelCase）へ移動した |
| ③ | 同じ exact 指定が pnpm 10.13.1 では成功する | **当たり**（exit=0、26.2.0 が入る） | — |

外れた①②が記事の導入になる。特に①は「入らない」ではなく「**手元では入るのに CI で落ちる**」という形で外れた。

## 「どの設定を、どこに書くと、どう効くか」対応表（実測のみ）

| 設定名 | 書いた場所 | pnpm | 結果 | 根拠ログ |
|---|---|---|---|---|
| `minimum-release-age=0` | `.npmrc` | 11.20.0 | **無視。警告なし**（`^26.0.0` → 26.1.2） | `logs-case-c-discriminate-pnpm11-npmrc.log` |
| `minimum-release-age=0` | `.npmrc` | 10.34.5 | 効く（`^26.0.0` → 26.2.0） | `logs-case-c-discriminate-pnpm10-npmrc.log` |
| `minimumReleaseAge: 0` | `pnpm-workspace.yaml` | 11.20.0 | 効く（`^26.0.0` → 26.2.0） | `logs-case-c-discriminate-pnpm11-yaml.log` |
| `minimumReleaseAgeStrict: true` | `pnpm-workspace.yaml` | 11.20.0 | 効く（代替が無い範囲で `ERR_PNPM_NO_MATURE_MATCHING_VERSION`） | `logs-case-b-strict-exact-pnpm11.log` |
| `minimumReleaseAgeExclude`（pnpm が自動生成） | `pnpm-workspace.yaml` | 11.20.0 | 効く（ロック検証を通す） | `logs-case-f5-with-exclude.log` |
| `blockExoticSubdeps: false` | `pnpm-workspace.yaml` | 11.20.0 | 効く（推移 exotic 依存が通る） | `logs-case-d5-false.log` |
| `onlyBuiltDependencies:`（旧名・リスト） | `pnpm-workspace.yaml` | 11.20.0 | **無視。警告なし** | `logs-case-e2-onlyBuiltDependencies.log` |
| `allowBuilds:`（リスト形式・書式ミス） | `pnpm-workspace.yaml` | 11.20.0 | **無視。警告なし** | `logs-case-e3-allowBuilds.log` |
| `allowBuilds:`（map 形式・正しい） | `pnpm-workspace.yaml` | 11.20.0 | 効く（postinstall が走る） | `logs-case-e5-allowBuilds-map.log` |

**沈黙が3件**（`.npmrc` / 旧設定名 / 書式ミス）。pnpm 11 は「設定が効かないこと」を教えてくれない、というのがこの表の一番の中身。

## エラーコードの整理（実測で確認したもの）

| コード | いつ出るか | 終了コード | ログ |
|---|---|---|---|
| `ERR_PNPM_NO_MATURE_MATCHING_VERSION` | **解決時**。要求範囲内に `minimumReleaseAge` を満たす版が1つも無く、かつ `minimumReleaseAgeStrict` が true | 1 | `logs-case-b-strict-exact-pnpm11.log` / `logs-case-f3-nolock.log` |
| `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` | **ロックファイル検証時**。ロックに載っているエントリが cutoff より新しい。**素の既定でも出る** | 1 | `logs-case-f4-default-lockcheck.log` / `logs-case-f1-lockfile-bypass.log` |
| `ERR_PNPM_EXOTIC_SUBDEP` | 推移依存が exotic（`resolved via url` など）で `blockExoticSubdeps` が有効 | 1 | `logs-case-d4-github-tarball.log` |
| `ERR_PNPM_IGNORED_BUILDS` | `strictDepBuilds: true`（既定）で、許可されていない postinstall がある | 1 | `logs-case-e1-strictDepBuilds.log` |

> 補足: `npm pack pnpm@11.20.0` した dist を `grep ERR_PNPM_` すると VIOLATION が出てこないが、これは `PnpmError("NO_MATURE_MATCHING_VERSION", ...)` のようにソース側では `ERR_PNPM_` 接頭辞なしで書かれているため。VIOLATION は `resolving/npm-resolver/lib/violationCodes.js` の `MINIMUM_RELEASE_AGE_VIOLATION_CODE` として別経路で定義されている。**dist の grep 結果だけで「そのコードは存在しない」と判断しないこと**（実際に一度そう判断しかけた）。

## 詰まった点と解決過程（記事の核）

| # | 詰まった点 | 原因 | 効いた対処 | 所要 | 解決/撤退 | 記事での活かし方 |
|---|---|---|---|---|---|---|
| 1 | registry を叩いても全パッケージで `versions=0`。24h以内の版が1つも見つからない | `accept: application/vnd.npm.install-v1+json`（abbreviated metadata）には `time` フィールドが無い | accept ヘッダを外して full packument を取る | 約2分 | 解決 | 「registry のメタデータには2種類ある」。`minimumReleaseAgeIgnoreMissingTime` の既定 true と繋げて書ける |
| 2 | pnpm 11 なのに exact 指定が普通に通ってしまう。予測が根本から外れた | `minimumReleaseAgeStrict` の既定が条件付き false。さらに `pnpm add` は明示指定版を `minimumReleaseAgeExclude` に自動登録して通す | 「失敗させる」方向を諦め、①range で黙って落ちる ②ロック検証で落ちる の2経路を切り分けて検証しなおした | 約2分 | 解決 | **記事の主題**。「入らない」と思って始めた前提が崩れる導入にそのまま使える |
| 3 | `blockExoticSubdeps` を踏ませようとして3回空振り（file: ディレクトリ / registry の tarball URL / 明示 true） | exotic の判定は URL の形ではなく `resolvedVia`。`npm-registry` と `local-filesystem` は非exotic | pnpm の dist を読んで `NON_EXOTIC_RESOLVED_VIA` の定義を確認し、レジストリ外（codeload.github.com）の tarball URL に変えた | 約3分 | 解決 | 仕様文の「直接OK・推移NG」だけでは足りない。**exotic の線引きを実測で示す** |
| 4 | `allowBuilds` に `esbuild` を書いたのに効かない。エラーメッセージは何も変わらない | `allowBuilds` はリストではなく **map**（`esbuild: true`）。書式が違っても pnpm は警告を出さず沈黙して無視する | ドキュメントの YAML 例を見て map 形式に直した | 約1分 | 解決 | 「設定が効かないときに pnpm は黙っている」パターンの3例目。旧設定名 `onlyBuiltDependencies` も同じく沈黙 |
| 5 | dist を grep して `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` が見つからず「存在しないコード」と判断しかけた | ソース側では `PnpmError("NO_MATURE_MATCHING_VERSION", ...)` のように接頭辞なし。VIOLATION はさらに別ファイル（`violationCodes.js`）の定数 | ロック検証の経路を実際に走らせたら普通に出た。その後 grep のかけ方を直して出どころを特定 | 約2分 | 解決 | 「grep で出ないから無い、と決めない」。実行して確かめる、という検証の型として短く書ける |

## スクリーンショット一覧

なし（すべて CLI 出力のため。タスク計画どおりターミナル出力を全文で保存した。`case-logs/` に30本、`commands.log` に通し記録）。

## 記事への写像（実績で埋める）

| 記事の見出し | 使う記録 | 書くこと（メモ） |
|---|---|---|
| 1. はじめに | `predictions.md` / 予測の当否表 | 「pnpm 11 なら昨日出た版は入らないはず」で始めて、①②が外れた話。`npm view pnpm dist-tags` で latest が 11.20.0 だと気づいた入り |
| 2. pnpm 11 で変わった既定値 | フェーズ1の設定表（一次情報の引用つき） | `minimumReleaseAge` 1440 / `minimumReleaseAgeStrict` の条件付き既定 / `blockExoticSubdeps` / `strictDepBuilds` / `verifyDepsBeforeRun` / Node >=22.13 / **設定の置き場所が `pnpm-workspace.yaml` に移った**こと |
| 3. 検証環境 | フェーズ2の環境ブロックと版ゲート | macOS 26.5 / Node v22.17.0 / npm 10.9.2 / pnpm 11.20.0・10.13.1・10.34.5・検証日時。`npx --yes pnpm@<version>` で版を固定した理由（グローバル 10.13.1 と混ざらないため）と `grep -qx` によるゲート |
| 4. 「新しすぎるバージョン」を入れようとした結果 | ケースA（`logs-case-a-exact-pnpm11.log`）/ ケースA'（`logs-case-a2-pnpm10.log`）/ registry 走査の詰まり#1 | `time` が無くて空振りした話 → 24h以内の版の特定（`@types/node@26.2.0`, age=1.37h）→ **成功してしまった**出力全文 → 自動生成された `pnpm-workspace.yaml` |
| 5. エラーにならないケースがあった（本題） | ケースB（`logs-case-b-range-pnpm11.log`）/ ケースB'（`logs-case-b-strict-*.log`） | `^26.0.0` が警告ゼロで 26.1.2（11日前）に落ちる。`package.json` の specifier まで `^26.1.2` に書き換わる。`minimumReleaseAgeStrict: true` は「代替が無いときだけ落とす」スイッチだと分かる before/after |
| 6. 設定で緩める方法と、その置き場所 | ケースC-4 の3行表（`logs-case-c-discriminate-*.log` 3本）/ pnpm 10.34.5 の `(26.2.0 is available)` | 同じ内容の設定が `.npmrc`（無視・沈黙）と `pnpm-workspace.yaml`（効く）で割れる。緩めると24hの待機が守っていたものを捨てることになる旨も併記 |
| 7. blockExoticSubdeps を踏む | ケースD-1〜D-7 / `NON_EXOTIC_RESOLVED_VIA` の抜粋 | 3回空振りした過程 → `resolved via url` で `ERR_PNPM_EXOTIC_SUBDEP` → `false` で通る → 直接依存なら同じURLでもOK。fixture の両方の `package.json` を貼る |
| 8. SQLiteストアでinstall時間はどうなったか | フェーズ4の計測表 / `sqlite3 .schema` 出力 | `index.db` は `package_index(key, data BLOB) WITHOUT ROWID`。68行 vs pnpm 10 の JSON 68ファイル。計測はwarm 1回目が両版とも外れ値で、**1回計測なら逆の結論になっていた**という書き方にする。回線差の断り書き必須 |
| 9. CIで気をつけたいこと（記事の山場その2） | ケースF-4 / F-5 / F-1 / F-3 | **素の既定でも `--frozen-lockfile` はロックを検証して落ちる**（`ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`）。`pnpm add` が自動生成した `pnpm-workspace.yaml` をコミットし忘れると、ローカルで通ったのに CI だけ落ちる。#10438 は当てはまらなかった／#11982・#10100 は未検証、と切り分けて書く |
| 10. まとめ | 予測当否表 / 対応表 / エラーコード表 | 「入らない」より「黙って古いのが入る」「手元で通って CI で落ちる」。pnpm 11 は設定が効かないとき沈黙する（3例）。未検証項目を列挙 |

## 未達・撤退した項目

なし（完了条件8項目すべて達成、撤退ラインは未発動）。

ただし以下は**未検証**として明示する（推測で書かない）:

- `optimisticRepeatInstall: true` の効果
- `minimumReleaseAgeIgnoreMissingTime` を false にした場合の挙動
- `~/.config/pnpm/config.yaml`（グローバル YAML）経由の設定（グローバル環境を汚さない方針のため触っていない）
- Issue [#11982](https://github.com/pnpm/pnpm/issues/11982) / [#10100](https://github.com/pnpm/pnpm/issues/10100) の再現（major 跨ぎのフォールバックは未検証）
- pnpm 12.0.0-rc.1 の挙動
- Dependabot / Renovate など実運用ツールとの組み合わせ

## 再現性メモ（記事に転記する用）

- OS / ランタイム: macOS 26.5 (Darwin 25.5.0, arm64) / Node.js v22.17.0 / npm 10.9.2
- pnpm: 11.20.0（`latest`）、10.13.1、10.34.5（`latest-10`）。すべて `npx --yes pnpm@<version>` で固定。グローバル pnpm は 10.13.1 のまま変更していない
- 検証日時: 2026-08-08 04:11〜04:25 JST（2026-08-07 19:11〜19:25 UTC）
- 対象パッケージ: `@types/node@26.2.0`（publish 2026-08-07T17:52:06.875Z、検証時点で age 1.37h）。**選定条件は公開日時のみ**
- 最短の再現手順:
  ```bash
  # 0) 版ゲート
  npx --yes pnpm@11.20.0 --version   # -> 11.20.0

  # 1) 24h以内に公開された版を探す（full packument を取ること。abbreviated には time が無い）
  curl -s https://registry.npmjs.org/@types/node \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);const n=Date.now();Object.entries(j.time).forEach(([v,t])=>{const h=(n-Date.parse(t))/3.6e6; if(h<24)console.log(v,t,h.toFixed(2)+"h")})})'

  # 2) 素の既定：range 指定は黙って古い版に落ちる
  mkdir -p /tmp/b && cd /tmp/b && echo '{"name":"b","version":"1.0.0","private":true}' > package.json
  npx --yes pnpm@11.20.0 add '@types/node@^26.0.0'
  node -p "require('./node_modules/@types/node/package.json').version"   # -> 最新ではない版

  # 3) 素の既定：exact 指定は通るが pnpm-workspace.yaml が自動生成される
  mkdir -p /tmp/a && cd /tmp/a && echo '{"name":"a","version":"1.0.0","private":true}' > package.json
  npx --yes pnpm@11.20.0 add @types/node@<24h以内の版>
  cat pnpm-workspace.yaml     # -> minimumReleaseAgeExclude に書かれている

  # 4) その pnpm-workspace.yaml を持たずに CI 相当を回すと落ちる
  mkdir -p /tmp/ci && cp /tmp/a/package.json /tmp/a/pnpm-lock.yaml /tmp/ci/ && cd /tmp/ci
  npx --yes pnpm@11.20.0 install --frozen-lockfile
  # -> [ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION] ... exit=1

  # 5) 設定の置き場所（同じ内容でも .npmrc は効かない）
  echo 'minimum-release-age=0' > .npmrc                    # pnpm 11 では無視・警告なし
  echo 'minimumReleaseAge: 0'  > pnpm-workspace.yaml       # こちらが効く
  ```
- 注意点:
  - pnpm 11 は `engines: node >=22.13`。Node 18〜21 では起動しない
  - pnpm 10 と 11 でストアパスが違う（`~/Library/pnpm/store/v10` と `.../v11`）。11 に上げた直後の install は必ずコールドになる
  - `pnpm-workspace.yaml` は**単一パッケージのプロジェクトでも** pnpm 11 が勝手に作ることがある。`.gitignore` していると CI が壊れる
  - install 時間の計測は最低3回。warm の1回目は両バージョンとも外れ値になった
  - `pnpm add` は解決結果に合わせて `package.json` の specifier も書き換える（`^26.0.0` → `^26.1.2`）

## 次のアクション（記事化）

- [ ] この execution-log.md の「記事への写像」に沿って `articles/pnpm11-minimum-release-age.md`（仮）を作成する
- [ ] スクショは無いので、ターミナル出力のコードブロックを見出しごとに貼る
- [ ] 予測の当否表・設定の対応表・エラーコード表の3つはそのまま本文の表として使える
- [ ] 既存記事 `articles/npm12-allowscripts-local-fixture.md` との差分（npm 12 の install scripts 既定無効化 vs pnpm 11 の release age）を冒頭で1〜2行明示する
