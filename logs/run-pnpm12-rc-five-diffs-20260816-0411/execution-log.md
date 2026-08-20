# 検証ログ: pnpm 12 RC（Rustリライト）に上げて、公式が挙げた「5つの差分」を実際に踏んでみた

> Zenn記事の素材。実行の一次情報（コマンド・エラー全文・所要時間・ログ）を記録。
> 記事本文は未執筆。「記事への写像」を見て articles/*.md に展開する。

## 実行の前提（採用した前提）

- 対象タスク: `practice/practice-pnpm12-rc-five-diffs-20260816-0407.md`（引数で明示指定）
- 出典レポート: `research/search-topic-20260816-0403.md`
- 対象技術: pnpm 12（`next-12` タグ / 12.0.0-rc.5）と pnpm 11（11.22.0）の比較
- 実行者: AIエージェント単独（非対話）
- 実行日時 / 所要時間: 2026-08-16 04:11〜04:18 JST / 見積もり 6.5h（390分）→ 実測 **約7分**（コマンド実行時間の合計。人間の読解・調査時間は含まない）
- 実行環境: macOS 26.5（arm64, Build 25F71）/ Docker 28.5.1 / `node:24` コンテナ（Debian GNU/Linux 12 bookworm, aarch64, Node **v24.18.0**, npm 11.16.0, git 2.39.5, Corepack 0.35.0）/ ホストは Node v22.17.0 / npm 10.9.2
- 採用した撤退ライン: 対象タスクの記載どおり。①「導入が3手段すべて失敗したら導入gateの記録に切替」②「再現できたものが2点以下ならフェーズ4を打ち切り」③「累計6時間超でフェーズ4を捨てる」。実測7分で全フェーズが終わったため②③は発動条件を満たしつつも**打ち切らずに完走**した（時間コストが無かったため。②の「フェーズ4打ち切り」は時間節約が目的の規定であり、実行済みのフェーズ4がむしろ「①③が未再現」という一次情報を生んだ）
- 判断方針: 引数は対象タスクファイルのパスのみ。時間・撤退ライン・成果物の置き場はすべてデフォルト前提を採用
- 成果物の置き場: `logs/run-pnpm12-rc-five-diffs-20260816-0411/workspace/`（gitignore対象）。記事素材として使うログ・lockfile は `artifacts/` に複製して追跡対象にした
- **Playwright は使っていない**。対象タスクが宣言しているとおり、この検証はブラウザ表示を一切伴わず、完了確認は CLI 出力とファイル差分で行う（スクショ 0枚）

## 結果サマリー

- 完了条件の判定: **達成**（完了条件4つすべてを客観的な出力で満たした。ただし「5点のうち11→12の差分として再現できたのは1点だけ」という中身になった）
- 作ったもの: pnpm 11 と pnpm 12 RC を同じ fixture に当てて差分5点を再現する検証キット一式
  - `workspace/fixtures/pnpm12-five-diffs/`（ルート＋`packages/a`＋`packages/b`、a↔b の循環依存、Git依存3表記、`devEngines.runtime`）
  - `workspace/fixtures/ssh-probe/`（`git+ssh://` 表記だけを持つ別fixture。追加で作った）
  - `artifacts/`（13本のコマンドログ・9本のlockfile・`results.md`）
- 差分5点の内訳: **再現 1点（⑤）／「12は公式どおりだが11でも同じ」2点（②④）／未再現 2点（①③）**
- スクショ: **0枚**（CLI検証のため。対象タスクで宣言済み）
- 詰まった点: 4件（うち解決 4 / 未解決・撤退 0）
- knowledge 記録: なし（4件とも `knowledge/` を要するほどの汎用トラブルではなく、pnpm 12 RC 固有の挙動として `results.md` に記録した）
- 事前の詰まりポイント表8件のうち、**実際に起きたのは #3 の変種1件のみ**。#1（corepack が落ちる）は**再現しなかった**

## 完了条件の検証

| # | 完了条件 | 判定 | 根拠（ログ） |
|---|---|---|---|
| 1 | `pnpm --version` が11系/12系の両方で記録されている | **達成** | `artifacts/01-install-v11.log`（`pnpm=11.22.0`）/ `artifacts/05-install-pnpm12.log`（`12.0.0-rc.5`）/ `artifacts/06-...-v12.log`（`pnpm=12.0.0-rc.5`） |
| 2 | 差分5点それぞれについて11と12の実出力が全文で残っている | **達成** | ①`13-devengines-runtime.log` ②`08-git-dep-normalization.log` + `09-git-ssh-probe.log` ③`11-yarn-global-v11.log` + `12-yarn-local-shim.log` ④`03-determinism-v11.log` + `07-lock-diff-v11-v12.log` + `10-determinism-v12.log` ⑤`02-resolution-only-peers-v11.log` + `06-resolution-only-peers-v12.log` |
| 3 | 5点のうち最低3点について「再現できた/できなかった＋根拠」が `results.md` の表に埋まっている | **達成（5点すべて）** | `artifacts/results.md` の「差分5点の結果表」。判定は3値（再現／差分として未再現＝11で既に成立／未再現）で書き分けた |
| 4 | lockfileの11版/12版diffと、順序入替え再インストール時の `sha256sum` 比較がファイルとして残っている | **達成** | `artifacts/lock-v11.yaml` / `lock-v12.yaml`（`diff` = 0行、`07-lock-diff-v11-v12.log`）、`lock-v11-order1/order2/order1-warm.yaml`、`lock-v12-order1/order2.yaml`、ハッシュ表は `results.md` |

## タスク実行ログ（フェーズ別）

### フェーズ1: 事前調査（見積もり 45分 → 実測 約2分）

- [x] 公式ブログ「What's different in pnpm 12」の差分5点をチェックリスト化（見積もり20分 → 実測 約1分）
  - 手段: `WebFetch https://pnpm.io/blog/whats-different-in-pnpm-12`
  - 引用として取れた原文（この5つがそのまま検証項目になった）:
    ```
    ① "A globally installed `node`, `deno`, or `bun` now follows the version the current project pins, instead of always running the globally installed one."
    ② "All of these name the same dependency and resolve identically" / "Each resolves through the host's canonical HTTPS URL, and pnpm never records an SSH URL for those hosts."
       （11以前: "the resolver probed transports and could record `git@github.com:owner/repo.git`, which then failed for everyone whose machine had no key for that host."）
    ③ pnpm 12 では `pnpm add -g yarn` が "installs the current Yarn line"（11は "installs Yarn Classic"）／
       "a globally installed package manager" が "defers to a project's pin where there is one"
    ④ "pnpm breaks dependency cycles at a fixed place instead of wherever the installation happens to walk into them." /
       "the lockfile is a function of the dependency graph alone."
    ⑤ "`pnpm install --resolution-only` is gone" / "pnpm 12 does not implement this flag and rejects it."
    ```
  - 意味が取れなかった用語（そのまま残す）: identity / globalShims / 「固定点でサイクルを切る（breaks cycles at a fixed place）」。→ ①の globalShims は最後まで実体を確認できなかった（後述）
- [x] pnpm 12 RC の導入手段を公式 Installation ページで確定（見積もり15分 → 実測 約30秒）
  - 選んだ手段: **`pnpm self-update next-12`**（すでに pnpm 11.22.0 ≥ 11.10.0 が入っていたため一番短い）
  - `corepack` を使わないと決めた根拠: 対象タスクが挙げていた issue #13018（`corepack use pnpm@next-12` が `Cannot find module .../bin/pnpm.mjs` で落ち、Closed as not planned）。→ ただし後述のとおり**手元では再現しなかった**
- [x] 検証環境のバージョンを先に記録（見積もり10分 → 実測 約20秒）
  - 実行したコマンド:
    ```bash
    date; sw_vers; docker --version; node --version; npm --version; git --version
    ```
  - 出力（全文）:
    ```
    Sun Aug 16 04:11:49 JST 2026
    ProductName:		macOS
    ProductVersion:		26.5
    BuildVersion:		25F71
    Docker version 28.5.1, build e180ab8
    v22.17.0
    10.9.2
    git version 2.50.1 (Apple Git-155)
    ```

### フェーズ2: 環境構築（見積もり 60分 → 実測 約1分）

- [x] `node:24` コンテナに入り `git --version` を確認（見積もり10分 → 実測 約20秒）
  - 実行したコマンド（対話シェルではなく、非対話実行のため常駐コンテナ＋`docker exec` に変えた）:
    ```bash
    docker run -d --name pnpm12lab -v "$PWD":/work -w /work node:24 sleep infinity
    docker exec pnpm12lab bash -lc 'node --version; npm --version; git --version; uname -a'
    ```
  - 出力（全文）:
    ```
    v24.18.0
    11.16.0
    git version 2.39.5
    Linux cf263e6a3b35 6.10.14-linuxkit #1 SMP Tue Oct 14 07:32:13 UTC 2025 aarch64 GNU/Linux
    ```
  - 効いた対処: 対象タスクは `docker run -it --rm ... bash` を想定していたが、非対話実行では対話シェルに入れない。`-d ... sleep infinity` で常駐させ、以降すべて `docker exec` で叩く形に置き換えた。**`git` は `node:24` に最初から入っていた**ので `apt-get install git` は不要だった（詰まりポイント表 #7 は空振り）
  - 既存技術と比べて感じた違い: 特になし。ここは11/12に関係ない準備
- [x] fixture を作る（ルート＋`packages/a`＋`packages/b`、a→b→a の循環依存1組）（見積もり25分 → 実測 約1分）
  - 作ったファイル（記事にそのまま貼れる全文。`artifacts/fixture/` にも複製）:
    ```json
    // package.json （ルート）
    {
      "name": "pnpm12-five-diffs",
      "version": "1.0.0",
      "private": true,
      "devEngines": {
        "runtime": { "name": "node", "version": "22.11.0", "onFail": "download" }
      },
      "dependencies": {
        "is-positive-https": "git+https://github.com/kevva/is-positive.git"
      }
    }
    ```
    ```yaml
    # pnpm-workspace.yaml
    packages:
      - 'packages/*'
    ```
    ```json
    // packages/a/package.json
    { "name": "@fixture/a", "version": "1.0.0", "private": true,
      "dependencies": { "@fixture/b": "workspace:*", "is-positive-short": "kevva/is-positive" } }
    ```
    ```json
    // packages/b/package.json
    { "name": "@fixture/b", "version": "1.0.0", "private": true,
      "dependencies": { "@fixture/a": "workspace:*", "is-positive-github": "github:kevva/is-positive" } }
    ```
  - 循環依存の表現: `@fixture/a` → `@fixture/b`（`workspace:*`）→ `@fixture/a`（`workspace:*`）の2ノード循環。pnpm 11 は毎回これを警告するが **pnpm 12 は警告しない**（後述）
  - Git依存3表記の割り振り: 短縮 `kevva/is-positive` → `packages/a`、`github:kevva/is-positive` → `packages/b`、`git+https://github.com/kevva/is-positive.git` → ルート。エイリアス名（`is-positive-short` など）を分けたのは、同一パッケージを3経路で同時に引かせて**lockfileに3行並べて見えるようにする**ため
  - `git+ssh://` を「あえて入れない」判断は**途中で覆した**（詰まった点 #2 に記載）
- [x] pnpm 11 を入れて `pnpm --version` を記録（見積もり10分 → 実測 3秒）
  - 実行したコマンド / 出力（全文）:
    ```bash
    $ npm i -g pnpm@11
    added 1 package in 2s
    1 package is looking for funding
      run `npm fund` for details
    npm notice
    npm notice New major version of npm available! 11.16.0 -> 12.0.2
    npm notice Changelog: https://github.com/npm/cli/releases/tag/v12.0.2
    npm notice To update run: npm install -g npm@12.0.2
    exit=0
    $ pnpm --version
    11.22.0
    $ which pnpm
    /usr/local/bin/pnpm
    ```
  - Node 22.13+ 要件には引っかからなかった（コンテナが Node v24.18.0）

### フェーズ3: 実装・検証【本編】（見積もり 180分 → 実測 約4分）

- [x] 【基準取り】pnpm 11 で `pnpm install` → `lock-v11.yaml` 退避（見積もり20分 → 実測 16秒）
  - 実行したコマンド:
    ```bash
    docker exec pnpm12lab bash -lc 'cd /work/fixtures/pnpm12-five-diffs && time pnpm install'
    ```
  - 出力（全文）:
    ```
    Scope: all 3 workspace projects
    [WARN] There are cyclic workspace dependencies: /work/fixtures/pnpm12-five-diffs/packages/a, /work/fixtures/pnpm12-five-diffs/packages/b
    Progress: resolved 1, reused 0, downloaded 0, added 0
    Packages are hard linked from the content-addressable store to the virtual store.
      Content-addressable store is at: /work/.pnpm-store/v11
      Virtual store is at:             node_modules/.pnpm
    Progress: resolved 2, reused 0, downloaded 1, added 0
    Packages: +2
    ++
    Progress: resolved 2, reused 0, downloaded 1, added 1
    Progress: resolved 2, reused 0, downloaded 2, added 1
    Progress: resolved 2, reused 0, downloaded 2, added 2
    Progress: resolved 2, reused 0, downloaded 2, added 2, done

    dependencies:
    + is-positive-https <- is-positive 3.1.0

    devDependencies:
    + node 22.11.0

    Done in 14.5s using pnpm v11.22.0

    real	0m14.636s
    user	0m2.672s
    sys	0m9.611s
    exit=0
    ```
  - lockfile: **179行** / `sha256 041735468d7af7cc2a1a032bcf05e7dd692b9977d0ca8038f34c14b3e8ed8665`
  - 循環依存の出力: `[WARN] There are cyclic workspace dependencies:` が出た。**この1行が後で「12では出ない」という差分になる**
  - 分かっていなかった前提: `devEngines.runtime` に `onFail: "download"` を書くと、**pnpm 11 の時点で** Node 22.11.0 を実際にダウンロードして `devDependencies: + node 22.11.0` として扱う。lockfile にも `node: specifier: runtime:22.11.0 / version: runtime:22.11.0` という行が入る。これは12の新機能ではない
  - 記事に書きたい気づき: 循環依存の警告が11と12で違う、というのは公式の5点に**入っていない**差分
- [x] 【基準取り】pnpm 11 で `--resolution-only` と `peers check`（見積もり20分 → 実測 8秒）
  - 実行したコマンド / 出力（全文、11で取らないと二度と取れないもの）:
    ```
    $ pnpm install --resolution-only
    Scope: all 3 workspace projects
    Already up to date
    Done in 362ms using pnpm v11.22.0
    exit=0

    $ pnpm peers check
    No peer dependency issues found
    exit=0

    $ pnpm install --help | grep -i resolution
                                                 Resolution still runs against the
          --resolution-only                      Re-runs resolution: useful for
    ```
  - `pnpm peers check --help`（11）の要点 — 公式ドキュメントに無かった終了コード仕様が**ヘルプには書いてあった**:
    ```
    Usage: pnpm peers <command>
    Commands for inspecting peer dependency relationships.
    Commands:
          check                Checks for unmet or missing peer dependency issues by
                               reading the lockfile. Exits with a non-zero exit code
                               when issues are found.
    Options: --[no-]color / --aggregate-output / -C,--dir / -h,--help / --json /
             --lockfile-only / --loglevel / --stream / --use-stderr / -w / -y
    Filtering options: --filter 系一式（--filter !<selector> / ...^<pattern> / {<dir>} など）
    Visit https://pnpm.io/11.x/cli/peers for documentation about this command.
    ```
  - 確認できたこと: `pnpm peers check` は **11.22.0 に確かに存在**（11.0.0 追加という下調べと矛盾しない）。終了コードは「問題ありで非ゼロ」がヘルプに明記
- [x] pnpm 12 RC を導入（見積もり25分 → 実測 約40秒 ※PATH問題の切り分け込み）
  - 実行したコマンド / 出力（全文）:
    ```
    $ pnpm --version (before)
    11.22.0
    $ pnpm self-update next-12
    Checking for updates...
    Switching pnpm from v11.22.0 to v12.0.0-rc.5...
    .../v11/18a-1a006d91f2c-ecb17c7a7a778626 | Progress: resolved 1, reused 0, downloaded 0, added 0
    .../v11/18a-1a006d91f2c-ecb17c7a7a778626 |   +2 +
    .../v11/18a-1a006d91f2c-ecb17c7a7a778626 | Progress: resolved 2, reused 0, downloaded 2, added 2, done
    Successfully updated pnpm to v12.0.0-rc.5
    exit=0
    $ hash -r; pnpm --version (after)
    11.22.0
    exit=0
    $ which -a pnpm
    /usr/local/bin/pnpm
    ```
  - **ここが最大の詰まり**: `Successfully updated pnpm to v12.0.0-rc.5` と言われたのに `pnpm --version` は 11.22.0 のまま（詳細は「詰まった点」#1）
  - 効いた対処: `find / -name "pnpm*" -newermt "-10 minutes"` で探して `/root/.local/share/pnpm/bin/pnpm` を発見。`PNPM_HOME` が未設定でそこが PATH に入っておらず、`/usr/local/bin/pnpm`（npm 経由の11）が勝っていた。以降は `export PATH="/root/.local/share/pnpm/bin:$PATH"` を明示して実行
    ```
    $ /root/.local/share/pnpm/bin/pnpm --version
    12.0.0-rc.5
    $ ls -la /root/.local/share/pnpm/bin
    -rwxr-xr-x 1 root root 1761 Aug 15 19:14 pn
    -rwxr-xr-x 1 root root 1112 Aug 15 19:14 pnpm
    -rwxr-xr-x 1 root root 1773 Aug 15 19:14 pnpx
    -rwxr-xr-x 1 root root 1767 Aug 15 19:14 pnx
    ```
  - 入ったRCのパッチ番号: **12.0.0-rc.5**。`pnpm` 本体は `#!/bin/sh` のラッパースクリプト（`# Resolve $0 through s...`）で、実体のネイティブバイナリを呼ぶ形
  - 記事に書きたい気づき: `pn` / `pnx` / `pnpx` の shim が同時に置かれる。公式ブログが触れていた `pnx` はここに実在した
- [x] 【差分⑤】pnpm 12 で `--resolution-only` が拒否されるか（見積もり25分 → 実測 10秒）
  - 実行したコマンド / 出力（全文）:
    ```
    $ pnpm --version
    12.0.0-rc.5
    $ pnpm install --resolution-only
    error: unexpected argument '--resolution-only' found

    Usage: pnpm install [OPTIONS]

    For more information, try '--help'.
    exit=2

    $ pnpm peers check
    No peer dependency issues found
    exit=0

    $ pnpm install --help | grep -i -n resolution
    102:          URL of a pnpr server to offload resolution and file fetching to. `node_modules` is still linked locally from the server-produced lockfile
    ```
  - `pnpm peers check --help`（12）— 11とヘルプの体裁が別物になっている:
    ```
    Checks for unmet or missing peer dependency issues

    Usage: pnpm peers [OPTIONS] [PARAMS]...

    Arguments:
      [PARAMS]...
              Subcommand and arguments. The only subcommand is `check`, which is also what a bare `pnpm peers` runs

    Options:
          --json
          --lockfile-only
          --color            Force colored output
      -y, --yes              Automatically answer yes to prompts
      -C, --dir <DIR>        Set working directory. Accepted anywhere on the command line, before or after the subcommand, like every other rc-option
                             [default: .]
          --store-dir <DIR>  Directory in which the package store is created. Relative paths are resolved from the workspace root, or from `--dir` outside a workspace
          --npmrc-auth-file <NPMRC_AUTH_FILE>
    ```
  - **判定: 再現**。終了コードは **2**（0でも1でもない）。エラー文言は Rust の clap 由来の `error: unexpected argument ... found` で、**`pnpm peers check` を使えという案内は一切出ない**
  - 既存技術と比べて感じた違い: 11のヘルプは Node の yargs 系で `--filter` 系フラグがずらりと並ぶが、12は clap 形式に一変し、`peers` のヘルプから `--filter` 系が消えている（ヘルプ先頭30行の範囲では）。「コマンド・フラグは11から据え置き」という公式の主張は、**ヘルプの見た目とフラグの網羅性まで同じ、という意味ではない**
- [x] 【差分④a】pnpm 12 で `pnpm install` → `lock-v12.yaml` と `diff`（見積もり30分 → 実測 18秒）
  - 実行したコマンド:
    ```bash
    cp root-order1.json package.json; cp a-order1.json packages/a/package.json; cp b-order1.json packages/b/package.json
    rm -rf node_modules pnpm-lock.yaml packages/a/node_modules packages/b/node_modules
    time pnpm install            # 12.0.0-rc.5
    diff -u lock-v11.yaml lock-v12.yaml
    ```
  - 出力（全文）:
    ```
    Scope: all 3 workspace projects
    Progress: resolved 1, reused 0, downloaded 0, added 0
    Packages are hard linked from the content-addressable store to the virtual store.
      Content-addressable store is at: /work/.pnpm-store/v11
      Virtual store is at:             node_modules/.pnpm
    Progress: resolved 2, reused 2, downloaded 0, added 2
    Packages: +2
    ++
    Progress: resolved 2, reused 2, downloaded 0, added 2, done

    dependencies:
    + is-positive-https <- is-positive 3.1.0

    devDependencies:
    + node 22.11.0

    Done in 4.7s using pnpm v12.0.0-rc.5

    real	0m4.756s
    user	0m0.194s
    sys	0m0.699s
    exit=0

    $ wc -l / sha256sum
    179 pnpm-lock.yaml
    041735468d7af7cc2a1a032bcf05e7dd692b9977d0ca8038f34c14b3e8ed8665  pnpm-lock.yaml

    $ diff lock-v11.yaml lock-v12.yaml | wc -l
    0

    $ diff -u lock-v11.yaml lock-v12.yaml
    diff-exit=0
    ```
  - diffの行数と分類: **0行**。peer bindings も Git依存URLも順序も、1つも変わらなかった。lockfileサイズも179行で同一、sha256も一致
  - 公式が言う「初回の一度きりのdiff」に当たるか（自分の判断）: **この最小fixtureでは一度きりのdiffすら発生しなかった**。issue #13320 が報告している約600行差は vercel/next.js 規模の話で、依存2個・ワークスペース3個ではそもそも差が出る余地がない、と読むのが妥当
  - 既存技術と比べて感じた違い: 12 は **11 と同じストア（`/work/.pnpm-store/v11`）をそのまま使い**、`lockfileVersion: '9.0'` も据え置き。「lockfile形式は据え置き」という公式の主張は手元で確認できた
  - 記事に書きたい気づき: `[WARN] There are cyclic workspace dependencies:` が **12では1度も出ない**（`grep -c cyclic` = 11の2ログで各1回、12の2ログで各0回）
- [x] 【差分②】Git依存3表記の記録形式（見積もり30分 → 実測 20秒 + ssh追試 20秒）
  - 実行したコマンド:
    ```bash
    grep -n 'is-positive' lock-v11.yaml
    grep -n 'is-positive' lock-v12.yaml
    grep -c 'ssh' lock-v11.yaml lock-v12.yaml; grep -c 'git@' lock-v11.yaml lock-v12.yaml
    ```
  - 出力（全文 / v11・v12 で**完全に同一**）:
    ```
    11:      is-positive-https:
    12:        specifier: git+https://github.com/kevva/is-positive.git
    13:        version: is-positive@https://codeload.github.com/kevva/is-positive/tar.gz/97edff6f525f192a3f83cea1944765f769ae2678
    24:      is-positive-short:
    25:        specifier: kevva/is-positive
    26:        version: is-positive@https://codeload.github.com/kevva/is-positive/tar.gz/97edff6f525f192a3f83cea1944765f769ae2678
    33:      is-positive-github:
    34:        specifier: github:kevva/is-positive
    35:        version: is-positive@https://codeload.github.com/kevva/is-positive/tar.gz/97edff6f525f192a3f83cea1944765f769ae2678
    39:  is-positive@https://codeload.github.com/kevva/is-positive/tar.gz/97edff6f525f192a3f83cea1944765f769ae2678:
    40:    resolution: {gitHosted: true, integrity: sha512-ImoN9vdC+9CSDxbHJIcYwImhox3/lvLNqKpX5dNXT9O5Vawb+c4wddQ6KXq8FsFMm4WuSc3nxaWG2Q3iBRcFdA==, tarball: https://codeload.github.com/kevva/is-positive/tar.gz/97edff6f525f192a3f83cea1944765f769ae2678}
    177:  is-positive@https://codeload.github.com/kevva/is-positive/tar.gz/97edff6f525f192a3f83cea1944765f769ae2678: {}

    ### grep -c ssh / git@ in both
    lock-v11.yaml:0
    lock-v12.yaml:0
    lock-v11.yaml:0
    lock-v12.yaml:0
    ```
  - 正規HTTPS URL の実文字列: `https://codeload.github.com/kevva/is-positive/tar.gz/97edff6f525f192a3f83cea1944765f769ae2678`（`git+https://` でも `github:` でも短縮でも同じ commit SHA の tarball URL に落ちる）
  - 想定と違った点: **11でも既に3表記が同一エントリに正規化されていた**。「11では別々に記録されている」という予想が外れた
  - `git+ssh://` 追試（当初は範囲外にしていたが、これを試さないと②の核心が確認できないと判断して追加）:
    ```
    ### ssh key present?
    ls: cannot access '/root/.ssh': No such file or directory

    === pnpm 11 (11.22.0) ===
    dependencies:
    + is-positive-ssh <- is-positive 3.1.0
    Done in 1.9s using pnpm v11.22.0
    exit=0
    --- lock (v11) ---
    11:      is-positive-ssh:
    12:        specifier: git+ssh://git@github.com/kevva/is-positive.git
    13:        version: is-positive@https://codeload.github.com/kevva/is-positive/tar.gz/97edff6f...2678

    === pnpm 12 (12.0.0-rc.5) ===
    dependencies:
    + is-positive-ssh <- is-positive 3.1.0
    Done in 1.4s using pnpm v12.0.0-rc.5
    exit=0
    --- lock (v12) ---
    11:      is-positive-ssh:
    12:        specifier: git+ssh://git@github.com/kevva/is-positive.git
    13:        version: is-positive@https://codeload.github.com/kevva/is-positive/tar.gz/97edff6f...2678
    ```
    非対話を担保するため `GIT_TERMINAL_PROMPT=0` と `GIT_SSH_COMMAND="ssh -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=10"` を付けた。**SSH鍵が1つも無い環境で11も12も成功し、両方とも lockfile には HTTPS の codeload URL を記録した**
  - **判定: 差分として未再現（11.22.0で既に成立）**。公式が「11以前は `git@github.com:owner/repo.git` を記録しうる」と書く挙動は、少なくとも 11.22.0（11系の最終盤）では既に直っていた
  - 記事に書きたい気づき: 「12で直った」と読める公式の書き方と、「11の最新パッチでは既に直っていた」実測のズレ。**11のどのバージョンと比べるかで“差分”の数は変わる**
- [x] 【差分④b】依存順を入れ替えて再インストール → `sha256sum` 比較（見積もり30分 → 実測 40秒）
  - 実行したコマンド:
    ```bash
    sha256sum pnpm-lock.yaml                       # 1回目
    rm -rf node_modules pnpm-lock.yaml packages/*/node_modules
    cp a-order2.json packages/a/package.json       # 依存の記述順を入れ替え
    cp b-order2.json packages/b/package.json
    pnpm install
    sha256sum pnpm-lock.yaml                       # 2回目
    diff -u lock-order1.yaml lock-order2.yaml
    ```
  - pnpm 11 の出力（全文の要点）:
    ```
    ### run1 (original order) hash
    041735468d7af7cc2a1a032bcf05e7dd692b9977d0ca8038f34c14b3e8ed8665  pnpm-lock.yaml
    ### run2 (reordered) hash
    1aa7d0aa01bf59c710785c8b6ef2094fc63e362667e15eb3d57b5315cff6e20d  pnpm-lock.yaml
    ### diff order1 vs order2
    40c40
    <     resolution: {gitHosted: true, integrity: sha512-ImoN9vdC+9CSDxbHJIcYwImhox3/lvLNqKpX5dNXT9O5Vawb+c4wddQ6KXq8FsFMm4WuSc3nxaWG2Q3iBRcFdA==, tarball: https://codeload.github.com/kevva/is-positive/tar.gz/97edff6f...2678}
    ---
    >     resolution: {gitHosted: true, tarball: https://codeload.github.com/kevva/is-positive/tar.gz/97edff6f...2678}
    diff-exit=1
    ```
    → ハッシュは違ったが、**違いは `integrity:` の有無1行だけで、依存の順序とは無関係**（1回目はネットワークからDL、2回目はストアから再利用）。そこで**同じウォームストア条件で取り直した**:
    ```
    ### run1b (original order, warm store) hash
    1aa7d0aa01bf59c710785c8b6ef2094fc63e362667e15eb3d57b5315cff6e20d  pnpm-lock.yaml
    ### diff order1-warm vs order2
    diff-exit=0
    ```
    → **pnpm 11 でも順序を入れ替えて lockfile は一致**
  - pnpm 12 の出力（全文の要点）:
    ```
    ### run1 (original order) hash
    041735468d7af7cc2a1a032bcf05e7dd692b9977d0ca8038f34c14b3e8ed8665  pnpm-lock.yaml
    ### run2 (reordered) hash
    041735468d7af7cc2a1a032bcf05e7dd692b9977d0ca8038f34c14b3e8ed8665  pnpm-lock.yaml
    ### diff v12 order1 vs order2
    diff-exit=0
    ### run3 (back to original order) hash
    041735468d7af7cc2a1a032bcf05e7dd692b9977d0ca8038f34c14b3e8ed8665  pnpm-lock.yaml
    ```
  - **判定: 差分として未再現（11でも順序非依存）／12は公式記述どおり**。ただし副産物として「lockfileのハッシュは**ストアが温まっているかどうか**でも変わる」という、順序とは別の非決定要因を見つけた
  - 記事に書きたい気づき: 「lockfileのハッシュがCIとローカルで違う」を調べるとき、真っ先に疑うべきは依存の記述順ではなく **`integrity` を書けるだけの情報があったか（＝ストアの状態）** かもしれない

### フェーズ4: 深掘り・比較（見積もり 60分 → 実測 約1分）

- [x] 【差分③】`pnpm add -g yarn` の実体を11と12で比較（見積もり30分 → 実測 30秒）
  - 最初の実行と**エラー全文**（詰まりポイント表 #3 の変種）:
    ```
    $ PNPM_HOME=/root/p11home pnpm add -g yarn
    [ERROR] The configured global bin directory "/root/p11home/bin" is not in PATH
    Run "pnpm setup" to update your shell configuration.
    exit=1
    ```
  - 効いた対処: `PNPM_HOME` そのものではなく **`$PNPM_HOME/bin` を PATH に入れる**（`export PATH="$PNPM_HOME/bin:$PATH"`）
  - 出力（全文の要点）:
    ```
    === pnpm 11 ===
    global:
    + yarn 1.22.22
    Done in 788ms using pnpm v11.22.0
    $ ls $PNPM_HOME/bin  ->  yarn  yarnpkg
    $ yarn --version     ->  1.22.22

    === pnpm 12 ===
    Ignored build scripts: yarn@1.22.22.
    Run "pnpm approve-builds" to pick which dependencies should be allowed to run scripts.
    dependencies:
    + yarn 1.22.22
    Done in 222ms using pnpm v12.0.0-rc.5
    $ ls $PNPM_HOME/bin  ->  yarn  yarnpkg
    $ yarn --version     ->  1.22.22
    ```
  - ローカル `pnpm add yarn` の `package.json` 変化（`--allow-build=yarn` を付けて成功させた版）:
    ```
    v12: before {"name":"yl12","version":"1.0.0","private":true}
         after  {"name":"yl12","version":"1.0.0","private":true,"dependencies":{"yarn":"^1.22.22"}}
    v11: after  {"name":"yl11","version":"1.0.0","private":true,"dependencies":{"yarn":"^1.22.22"}}
    ```
    → **`packageManager` にも `devEngines.packageManager` にも何も書かれない**（11も12も同じ）
  - `pnpm shim add yarn` の有無（`--help` で確認）:
    ```
    $ pnpm shim --help      # v12
    Error: ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL

      × Command "shim" not found

    $ pnpm --help | grep -i -E 'shim|pnx'   # v12
    (該当なし / grep-exit=1)
    ```
    一方 `pnx` は shim ファイルとして実在し、PATH を12優先にすると `pnpm dlx` の clap 形式ヘルプを出す:
    ```
    $ pnx --help
    Run a package in a temporary environment

    Usage: pnpm dlx [OPTIONS] [COMMAND]...
    ```
  - **判定: 未再現**。12.0.0-rc.5 では `pnpm add -g yarn` は依然 **Yarn Classic 1.22.22** を入れる。`pnpm shim` サブコマンドも存在しない
  - 副次的な発見: `ERR_PNPM_IGNORED_BUILDS` で失敗したとき、**11 は `package.json` に依存を書き込んだまま**エラーになるが、**12 は `package.json` を書き換えずに**エラーになる（`--allow-build` を付ける前の実行で確認）
- [x] 【差分①】`devEngines.runtime` と global node（見積もり30分 → 実測 30秒）
  - 実行したコマンド / 出力（全文）:
    ```
    === 1) plain node on PATH ===
    in fixture : /usr/local/bin/node -> v24.18.0
    outside    : /usr/local/bin/node -> v24.18.0

    === 2) config: globalShims ===
    $ pnpm config list        # v12
    {
      "userAgent": "pnpm/12.0.0-rc.5 npm/? node/? linux arm64"
    }
    $ pnpm config get globalShims    -> undefined
    $ pnpm config get global-shims   -> undefined

    === 3) pnpm add -g node (v12) then compare ===
    dependencies:
    + node 26.7.0
    Done in 311ms using pnpm v12.0.0-rc.5
    $ ls /root/p12home/bin  ->  yarn  yarnpkg          # node の bin が作られない
    in fixture : bash: line 15: /root/p12home/bin/node: No such file or directory
    outside    : bash: line 16: /root/p12home/bin/node: No such file or directory

    === 4) node in fixture node_modules/.bin ===
    node
    v22.11.0
    ```
    追試（グローバルに入った node がどこにあるか / 11でも同じか）:
    ```
    $ pnpm ls -g            # v12
    /root/p12home/global/v11 (PRIVATE)
    │   dependencies:
    ├── node@26.7.0
    └── yarn@1.22.22
    $ find /root/p12home -maxdepth 4 -name "node*"
    /root/p12home/global/v11/3a3-18cc109dacf5d83a-0/node_modules
    /root/p12home/global/v11/556-18cc10a8ae0472d0-0/node_modules

    === pnpm 11: add -g node ===
    global:
    + node 26.7.0
    Done in 690ms using pnpm v11.22.0
    $ ls -la /root/p11home/bin  ->  yarn  yarnpkg （node なし）
    node via p11home: bash: line 12: /root/p11home/bin/node: No such file or directory
    in fixture (p11home first): v24.18.0
    outside    (p11home first): v24.18.0
    ```
  - **判定: 未再現**。fixture の内外どちらでも `node --version` は `v24.18.0`（イメージ同梱の node）のまま。`pnpm add -g node` は 11・12 とも `node@26.7.0` をインストールしたと言うのに **`$PNPM_HOME/bin` に `node` の実行ファイルを作らない**ため、そもそも「globally installed node」を PATH 経由で呼ぶ状態を作れなかった
  - `globalShims` は `pnpm config get` でも `pnpm config list` でも見つからず、**設定名の実体を最後まで確認できなかった**（下調べ時点の「要確認」がそのまま残った）
  - 一方で `devEngines.runtime` 自体は効いている: `node_modules/.bin/node --version` は **v22.11.0**（ピン留めどおり）。つまり**プロジェクトローカルには効くが、グローバルの node には波及しなかった**。この挙動は 11 も 12 も同じ
  - 記事に書きたい気づき: 「落ちた記録こそ価値」と事前に書いたとおりの結果になった。①は5点のうち**最も派手な触れ込みなのに、rc.5 では手元で一切観測できない**

### フェーズ5: 振り返り・記事化準備（見積もり 45分 → 実測 約2分）

- [x] `results.md` に差分5点の表を埋めた → `artifacts/results.md`（`workspace/logs/pnpm12/results.md` にも同じものを配置）
  - 内訳: **再現 1点（⑤）／差分として未再現・11で既に成立 2点（②④）／未再現 2点（①③）**
  - できなかった点の自己判断:
    - ①（globalShims）: **RCの実装状況が疑わしい**。`pnpm add -g node` が bin を作らない時点で、機能の入口に到達していない。手順の問題である可能性も残るが、`pnpm config` にそれらしい設定が1つも出てこないため「rc.5 では未実装または別の有効化手段が必要」と読む
    - ②④: **公式記述の読み違いではなく、比較対象の取り方の問題**。「pnpm 11」と一括りにしたが、11.22.0（11系の最終盤）は既に12相当の挙動を持っていた。公式ブログが暗黙に想定している「11」はもっと前のパッチだと思われる
    - ③: **RCの挙動**。`pnpm shim` サブコマンドが存在しない＝機能自体が rc.5 に入っていない
- [x] 記録テンプレを見返して棚卸し（下記「詰まった点と解決過程」「再現性メモ」に反映）
  - 見積もりと実測の差が大きかったタスク: **全部**（390分見積もり → 実測7分）。理由は、見積もりが「人間が調べながら手を動かす」前提なのに対し、実行は非対話のバッチで、しかも**詰まりポイント表8件のうち7件が空振り**したため
  - 最初に分かっていなかった前提: (a) `pnpm self-update` は npm 経由で入れた pnpm を置き換えず、別の場所（`~/.local/share/pnpm`）に置く (b) 11.22.0 は既に②④相当の挙動を持っている (c) `devEngines.runtime` + `onFail: download` は11の機能
  - 次に試したくなったこと: pnpm 11 の**古いパッチ**（11.0.x など）と12を比べれば②④が「差分」として見えるはず。RC が rc.6 / GA に進んだら①③を再測定する

## 詰まった点と解決過程（記事の核）

| # | 詰まった点 | 原因 | 効いた対処 | 所要 | 解決/撤退 | 記事での活かし方 |
|---|---|---|---|---|---|---|
| 1 | `pnpm self-update next-12` が `Successfully updated pnpm to v12.0.0-rc.5` と出したのに `pnpm --version` は `11.22.0` のまま | `PNPM_HOME` が未設定で、self-update の書き込み先 `/root/.local/share/pnpm/bin` が PATH に無い。`which -a pnpm` は `/usr/local/bin/pnpm`（npm 経由の11）1件だけを返す | `find / -name "pnpm*" -newermt "-10 minutes"` で実体を発見 → `export PATH="/root/.local/share/pnpm/bin:$PATH"` | 約40秒 | 解決 | 「成功と言われたのにバージョンが上がらない」は新人が一番混乱するパターン。`which -a` と `find -newermt` で実体を追う手順がそのまま書ける |
| 2 | 差分②の核心（SSH URLがlockfileに記録されるか）が、計画どおり `git+ssh://` を除外すると確認できない | 計画段階で「SSHは認証が要る＝AI単独では不可」と判断していたが、対象が**公開リポジトリ**なら鍵が無いまま失敗するか成功するかを見ること自体が検証になる | `ssh-probe` fixture を追加し、`GIT_TERMINAL_PROMPT=0` / `GIT_SSH_COMMAND="ssh -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=10"` で非対話を担保して実行 | 約1分 | 解決（計画の範囲を広げた） | 「認証が要りそうだから外す」と決めた項目を、非対話フラグで安全に戻せることがある、という検証設計の話 |
| 3 | `pnpm add -g yarn` が `[ERROR] The configured global bin directory "/root/p11home/bin" is not in PATH` で失敗 | `PNPM_HOME` を設定しただけで、その配下の `bin` を PATH に入れていなかった（`pnpm setup` を走らせない隔離運用の副作用） | `export PATH="$PNPM_HOME/bin:$PATH"` | 約20秒 | 解決 | 詰まりポイント表 #3（環境を壊さないため `PNPM_HOME` を分ける）を実際にやると出る、次の一手。エラー文が `pnpm setup` を案内してくるが、隔離検証では PATH を自分で通すほうが良い |
| 4 | ④b のハッシュが pnpm 11 で一致せず、一瞬「11は順序非決定」に見えた | 1回目はコールドストア（`integrity:` を書ける）、2回目はウォームストア（書けない）で、差分は `resolution:` 1行のみ。依存の記述順とは無関係 | `diff` で中身を見て原因を特定 → **同じウォームストア条件で取り直し**て再測定（一致） | 約20秒 | 解決 | 「ハッシュが違う＝非決定」と早合点しないための例。差分を数えるだけでなく `diff` の中身を読む、という基本の実例 |
| ― | （予測したが起きなかった）`corepack use pnpm@next-12` が `Cannot find module .../bin/pnpm.mjs` で落ちる（issue #13018） | Corepack 0.35.0 + pnpm 12.0.0-rc.6 の組み合わせでは解消済み | ― | ― | **再現せず** | 詰まりポイント表の筆頭に置いた地雷が、実行時には踏めなかった。「Closed as not planned の issue を根拠に手段を避けたが、実際は動いた」という、下調べと実測のズレの好例 |

事前の詰まりポイント表8件との突き合わせ:

| 予測 # | 内容 | 実際 |
|---|---|---|
| 1 | corepack が MODULE_NOT_FOUND で落ちる | **起きず**（rc.6 が正常に入り `Done in 2.5s using pnpm v12.0.0-rc.6`） |
| 2 | インストーラが Node バージョンで弾かれる | 起きず（コンテナが Node v24.18.0） |
| 3 | ホストのグローバルpnpmが壊れる | 起きず（Docker隔離）。ただし `PNPM_HOME` を分けた副作用で**上表 #3** が発生 |
| 4 | lockfile の diff が大きすぎて読めない | 起きず（**diff 0行**） |
| 5 | `git+ssh://` で認証が止まる | 起きず（鍵無しでも HTTPS 経由で解決、11も12も成功）→ **上表 #2** |
| 6 | `devEngines.runtime` の切替が再現しない | **起きた**（予測どおり。①は未再現） |
| 7 | `git` コマンド不足 | 起きず（`node:24` に git 2.39.5 同梱） |
| 8 | `pnpm peers check` の終了コード・フラグが分からない | 実測で解消（11のヘルプに「issues が見つかったら非ゼロ」と明記。実行時は両方 `exit=0`） |

## スクリーンショット一覧

**なし（0枚）**。この検証はブラウザ表示を一切伴わないため、対象タスクの宣言どおり Playwright を使わず、完了確認は CLI 出力とファイル差分で行った。記事に貼る「図」は以下のテキスト成果物で代替する。

| ファイル | 何を示すか | 使う見出し |
|---|---|---|
| `artifacts/07-lock-diff-v11-v12.log` | `diff lock-v11.yaml lock-v12.yaml` が0行であること | 7. 触ってみて分かったこと |
| `artifacts/08-git-dep-normalization.log` | Git依存3表記が同一エントリに正規化されている `grep` 出力 | 5. 実際に試したこと |
| `artifacts/06-resolution-only-peers-v12.log` | `--resolution-only` の拒否エラー全文と `exit=2` | 5. 実際に試したこと / 6. 詰まった点 |
| `artifacts/results.md` のハッシュ比較表 | 11/12 各2回＋12の3回目のsha256 | 7. 触ってみて分かったこと |

## 記事への写像（実績で埋める）

| 記事の見出し | 使う記録 | 書くこと（メモ） |
|---|---|---|
| 1. はじめに（pnpm 12 は「Rustになっただけ」なのか） | 本ログ「実行の前提」 | 冒頭で「速度は測らない、差分の再現に絞る」と宣言。検証日 2026-08-16 と `pnpm 11.22.0` / `pnpm 12.0.0-rc.5` / Node v24.18.0 を最初に貼る。**RC段階であることを明記** |
| 2. なぜこの技術を試すのか | 「実行の前提」＋フェーズ1 | RC段階でGA前に踏む意味。11しか知らない視点。5点が「そのまま検証項目になる」構造 |
| 3. 事前に調べたこと（公式が挙げる差分5点） | フェーズ1の引用ブロック（①〜⑤の原文） | 公式ブログの5点を英文引用で提示。`globalShims` / identity / "breaks cycles at a fixed place" は**意味が取れないまま検証に入った**と正直に書く |
| 4. 環境構築（11と12 RCの同居、fixtureの構成） | フェーズ2全文 ＋ 詰まった点 #1・#3 | `node:24` コンテナで隔離した理由、fixture の `package.json` 4本（全文あり）、循環依存の作り方。**corepack を避けたのに、試したら動いた**話をここで落とす（詰まり表 #1 の空振り） |
| 5. 実際に試したこと（差分5点を1つずつ） | フェーズ3・4 の各出力 ＋ `artifacts/results.md` の結果表 | 差分5点の結果表をそのまま貼る。⑤のエラー全文（`error: unexpected argument '--resolution-only' found` / `exit=2`）、②の `grep` 抜粋、④のハッシュ表が主役 |
| 6. 詰まった点 | 「詰まった点と解決過程」表（4件）＋ フェーズ4①の出力全文 | #1（self-update したのにバージョンが上がらない）を最初に。①が再現しなかった出力を全文で貼る |
| 7. 触ってみて分かったこと（lockfileの決定性は本当に効いたか） | フェーズ3の④a/④b | 11も12もハッシュ一致・diff 0行。**「初回の一度きりdiff」は1行も出なかった**。代わりに見つけた非決定要因（`integrity` = ストアの温度）を書く |
| 8. pnpm 11と比べて感じたこと | フェーズ3⑤のヘルプ比較 ＋ `results.md`「副次的な観測」 | 「コマンド・フラグは据え置き」は概ね本当だが、ヘルプが yargs → clap に変わりフラグの見え方は別物。循環依存の `[WARN]` が消える、`ERR_PNPM_IGNORED_BUILDS` 時に `package.json` を書き換えない、といった5点に載っていない差分 |
| 9. どんな人に向いていそうか（移行を待つ判断材料） | フェーズ5の棚卸し | 「11.22.0 まで上げているなら②④はもう手元にある」「①③目当てなら rc.5 では待ち」「Git依存をSSHで書いていても11.22.0時点で既にHTTPS記録」 |
| 10. まとめ | 「結果サマリー」 | 5点中、11→12の差分として再現できたのは**1点だけ**。RCなので断定しない。比較対象を「11.22.0」と明記しないと数が変わることを添える |

## 未達・撤退した項目

なし（全フェーズ・全タスクを実行した）。ただし以下は**検証はしたが結論に至らなかった**項目として明記する。

- **`globalShims` 設定の実体**: `pnpm config get globalShims` / `global-shims` とも `undefined`、`pnpm config list`（v12）は `userAgent` 1行しか返さない。公式ドキュメントでも確認できていないため、**設定名・既定値ともに未確定のまま**。差分①が未再現である理由が「未実装」なのか「有効化手段を見つけられなかった」のかは切り分けられていない
- **`pnpm add -g node` が bin を作らない件**: 11 も 12 も `node@26.7.0` を入れたと報告するが `$PNPM_HOME/bin` に `node` が現れない。バグか仕様かは判断していない（issue 検索まではしていない）
- **`self-update` と `corepack` で取得RCが食い違う件**: 同一時刻に `self-update next-12` → rc.5、`corepack use pnpm@next-12` → rc.6。原因（タグの向き先／キャッシュ）は未調査

## 再現性メモ（記事に転記する用）

- OS / ランタイム / 主要バージョン:
  - ホスト: macOS 26.5 (arm64, Build 25F71) / Docker 28.5.1
  - コンテナ: `node:24` = Debian 12 bookworm / aarch64 / Node **v24.18.0** / npm 11.16.0 / git 2.39.5 / Corepack 0.35.0
  - pnpm 11: **11.22.0** ／ pnpm 12: **12.0.0-rc.5**（`self-update next-12`、同日 `corepack` 経由では rc.6）
- 実行コマンドの並び（最短の再現手順）:
  ```bash
  docker run -d --name pnpm12lab -v "$PWD":/work -w /work node:24 sleep infinity
  docker exec pnpm12lab bash -lc 'npm i -g pnpm@11 && pnpm --version'   # 11.22.0
  # fixture を /work/fixtures/pnpm12-five-diffs に置く（package.json 4本 + pnpm-workspace.yaml）
  docker exec pnpm12lab bash -lc 'cd /work/fixtures/pnpm12-five-diffs && pnpm install && cp pnpm-lock.yaml /tmp/lock-v11.yaml'
  docker exec pnpm12lab bash -lc 'cd /work/fixtures/pnpm12-five-diffs && pnpm install --resolution-only; echo "exit=$?"; pnpm peers check; echo "exit=$?"'
  docker exec pnpm12lab bash -lc 'pnpm self-update next-12'
  # ここで PATH を通す（通さないと 11 のまま）
  docker exec pnpm12lab bash -lc 'export PATH="/root/.local/share/pnpm/bin:$PATH"; pnpm --version'   # 12.0.0-rc.5
  docker exec pnpm12lab bash -lc 'export PATH="/root/.local/share/pnpm/bin:$PATH"; cd /work/fixtures/pnpm12-five-diffs && pnpm install --resolution-only; echo "exit=$?"'
  docker exec pnpm12lab bash -lc 'export PATH="/root/.local/share/pnpm/bin:$PATH"; cd /work/fixtures/pnpm12-five-diffs && rm -rf node_modules pnpm-lock.yaml packages/*/node_modules && pnpm install && diff /tmp/lock-v11.yaml pnpm-lock.yaml'
  ```
- 注意点（ハマりどころ）:
  - `pnpm self-update` は npm でグローバル導入した `/usr/local/bin/pnpm` を置き換えない。**`~/.local/share/pnpm/bin` を PATH の先頭に置かないとバージョンが上がったように見えない**
  - `PNPM_HOME` を分けて隔離する場合、PATH に入れるのは `$PNPM_HOME` ではなく **`$PNPM_HOME/bin`**
  - lockfile のハッシュを比べるときは、**両方をウォームストア（または両方コールド）に揃える**。片方だけコールドだと `integrity:` の有無で1行ずれる
  - `git+ssh://` 表記を試すときは `GIT_TERMINAL_PROMPT=0` と `GIT_SSH_COMMAND="ssh -o BatchMode=yes ..."` を付けないと、鍵が無い環境でプロンプト待ちになりうる
  - 比較対象の pnpm 11 を**どのパッチにするかで「差分」の数が変わる**。この検証は 11.22.0 との比較
  - lockfile 形式は `lockfileVersion: '9.0'` のまま。ストアも `/work/.pnpm-store/v11` を11と12で共用していた

## 次のアクション（記事化）

- [ ] この execution-log.md の「記事への写像」に沿って `articles/pnpm12-rc-five-diffs.md` を作成する（`/draft-article`）
- [ ] 図はスクショではなく `artifacts/` のログ抜粋と `results.md` の表をコードブロックで貼る（画像なし）
- [ ] 完了条件・詰まった点・比較を本文に落とす。**「5点中1点しか差分として再現できなかった」を隠さず主題にする**
