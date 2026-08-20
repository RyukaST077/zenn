# pnpm 11 vs pnpm 12 RC ― 公式が挙げた「5つの差分」の再現結果

- 検証日時: 2026-08-16 04:11〜04:18 JST
- 実行環境: macOS 26.5 (arm64) / Docker 28.5.1 / `node:24` コンテナ（Debian 12, aarch64, Node v24.18.0, npm 11.16.0, git 2.39.5）
- pnpm 11: **11.22.0**（`npm i -g pnpm@11`）
- pnpm 12: **12.0.0-rc.5**（`pnpm self-update next-12`）
- fixture: `fixtures/pnpm12-five-diffs/`（ルート＋`packages/a`＋`packages/b`、a↔b の循環依存1組、Git依存3表記、`devEngines.runtime: node 22.11.0`）

> 判定の語義
> - **再現**: 11 と 12 で挙動が異なり、公式の記述どおりに 12 側が変わった
> - **差分として未再現（11で既に成立）**: 12 の挙動は公式記述どおりだが、11.22.0 でも同じ → 11→12 の差分としては観測できず
> - **未再現**: 12 で公式記述どおりの挙動が確認できなかった

## 差分5点の結果表

| # | 差分 | 公式の記述（pnpm.io/blog/whats-different-in-pnpm-12） | 実行コマンド | pnpm 11.22.0 の実出力 | pnpm 12.0.0-rc.5 の実出力 | 判定 |
|---|---|---|---|---|---|---|
| 1 | project-aware global bins | "A globally installed `node`, `deno`, or `bun` now follows the version the current project pins, instead of always running the globally installed one." | `node --version`（fixture内 / `/tmp`）、`pnpm add -g node`、`pnpm config get globalShims` | fixture内/外とも `/usr/local/bin/node -> v24.18.0`。`pnpm add -g node` は `+ node 26.7.0` を入れるが `$PNPM_HOME/bin` に `node` は作られない | fixture内/外とも `/usr/local/bin/node -> v24.18.0`。`pnpm add -g node` → `+ node 26.7.0`、`$PNPM_HOME/bin` は `yarn` `yarnpkg` のみで `node` なし。`pnpm config get globalShims` → `undefined`、`pnpm config list` は `{"userAgent": "pnpm/12.0.0-rc.5 npm/? node/? linux arm64"}` のみ | **未再現** |
| 2 | Git依存の正規化 | "All of these name the same dependency and resolve identically" / "Each resolves through the host's canonical HTTPS URL, and pnpm never records an SSH URL for those hosts." | `pnpm install` 後に `grep -n is-positive pnpm-lock.yaml`（`kevva/is-positive` / `github:...` / `git+https://...` / 別fixtureで `git+ssh://...`） | 3表記とも `version: is-positive@https://codeload.github.com/kevva/is-positive/tar.gz/97edff6f...2678` の同一エントリに解決。`grep -c ssh` = 0、`grep -c git@` = 0。**`git+ssh://git@github.com/...` 表記も** SSH鍵なし（`/root/.ssh` 不在）で成功し、lockfile には同じ codeload HTTPS URL を記録 | 11 と完全に同一（lockfile はバイト一致） | **差分として未再現（11.22.0で既に成立）** |
| 3 | パッケージマネージャ名の実体化 | pnpm 12 では `pnpm add -g yarn` が "installs the current Yarn line"（11 は "installs Yarn Classic"） | `pnpm add -g yarn` → `yarn --version` / `pnpm add yarn --allow-build=yarn` → `package.json` / `pnpm shim --help` | `+ yarn 1.22.22` → `yarn --version` = `1.22.22`。ローカル `pnpm add yarn` → `"dependencies":{"yarn":"^1.22.22"}` | `+ yarn 1.22.22` → `yarn --version` = `1.22.22`（**Yarn Classic のまま**）。ローカル `pnpm add yarn` → `"dependencies":{"yarn":"^1.22.22"}`、`packageManager` / `devEngines.packageManager` は書かれない。`pnpm shim --help` → `Error: ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL × Command "shim" not found`。ただし `pnx` shim は存在（`pnx --help` = `pnpm dlx` のヘルプ） | **未再現** |
| 4 | 循環依存lockfileの決定化 | "pnpm breaks dependency cycles at a fixed place instead of wherever the installation happens to walk into them." / "the lockfile is a function of the dependency graph alone." | `rm -rf node_modules pnpm-lock.yaml` → 依存の記述順を入れ替えて再install → `sha256sum pnpm-lock.yaml`／`diff lock-v11.yaml lock-v12.yaml` | ウォームストア同士なら順序入替えで lockfile は**一致**（`1aa7d0aa…` = `1aa7d0aa…`）。※コールド初回だけ `integrity:` 有無で1行差が出る（ストア由来のアーティファクトで順序とは無関係） | 順序入替え・戻し（計3回）すべて `041735…` で**一致**。lockfile は 11 のコールド初回とも**バイト一致**（`diff` 差分0行、179行） | **差分として未再現（11.22.0でも順序非依存）／12は公式記述どおり** |
| 5 | `--resolution-only` 廃止 | "`pnpm install --resolution-only` is gone" / "pnpm 12 does not implement this flag and rejects it."（代替は `pnpm peers check`） | `pnpm install --resolution-only; echo $?` / `pnpm peers check; echo $?` | `Scope: all 3 workspace projects` / `Already up to date` / `Done in 362ms using pnpm v11.22.0`、`exit=0`。`pnpm install --help` に `--resolution-only  Re-runs resolution: useful for` の記載あり | `error: unexpected argument '--resolution-only' found` / `Usage: pnpm install [OPTIONS]` / `For more information, try '--help'.`、**`exit=2`**。`pnpm install --help` に `--resolution-only` の記載なし。エラー文は **`pnpm peers check` を案内しない** | **再現** |

集計: **再現 1点（⑤）／差分として未再現・11で既に成立 2点（②④）／未再現 2点（①③）**

## `pnpm peers check` の実測（公式ドキュメントに記載が無かった項目）

| 項目 | pnpm 11.22.0 | pnpm 12.0.0-rc.5 |
|---|---|---|
| 存在するか | する（`Usage: pnpm peers <command>`） | する（`Usage: pnpm peers [OPTIONS] [PARAMS]...`） |
| 問題なしのときの出力 / 終了コード | `No peer dependency issues found` / `exit=0` | `No peer dependency issues found` / `exit=0` |
| 終了コードの仕様 | ヘルプに明記: "Exits with a non-zero exit code when issues are found." | ヘルプに終了コードの記載なし |
| サブコマンド | `check` のみ | `check` のみ（"which is also what a bare `pnpm peers` runs"） |
| 主なフラグ | `--json` / `--lockfile-only` / `--filter` 系一式 / `-C` / `-y` ほか | `--json` / `--lockfile-only` / `--color` / `-y` / `-C` / `--store-dir` / `--npmrc-auth-file`（**`--filter` 系はヘルプ先頭30行には出てこない**） |

## lockfileハッシュ比較表

| ツール | 1回目の `sha256sum` | 依存順を入れ替えた2回目 | 一致したか |
|---|---|---|---|
| pnpm 11.22.0（コールドストア初回 → ウォーム2回目） | `041735468d7af7cc2a1a032bcf05e7dd692b9977d0ca8038f34c14b3e8ed8665` | `1aa7d0aa01bf59c710785c8b6ef2094fc63e362667e15eb3d57b5315cff6e20d` | ✗（差分は `integrity:` 1行のみ。ストア状態の違いによるもの） |
| pnpm 11.22.0（ウォームストア同士で再測定） | `1aa7d0aa01bf59c710785c8b6ef2094fc63e362667e15eb3d57b5315cff6e20d` | `1aa7d0aa01bf59c710785c8b6ef2094fc63e362667e15eb3d57b5315cff6e20d` | ✓ |
| pnpm 12.0.0-rc.5 | `041735468d7af7cc2a1a032bcf05e7dd692b9977d0ca8038f34c14b3e8ed8665` | `041735468d7af7cc2a1a032bcf05e7dd692b9977d0ca8038f34c14b3e8ed8665` | ✓（順序を戻した3回目も同一） |

`diff lock-v11.yaml lock-v12.yaml` → **差分0行**（両方とも179行）。公式が言う「初回だけ一度きりのdiff」は、この最小fixtureでは**1行も出なかった**。

## 表に載らなかった副次的な観測

| 観測 | pnpm 11.22.0 | pnpm 12.0.0-rc.5 | 根拠ログ |
|---|---|---|---|
| 循環ワークスペース依存の警告 | `[WARN] There are cyclic workspace dependencies: .../packages/a, .../packages/b` を毎回出す | **出さない**（同じfixtureで0回） | `01-install-v11.log` / `03-determinism-v11.log` vs `07-lock-diff-v11-v12.log` / `10-determinism-v12.log` |
| `ERR_PNPM_IGNORED_BUILDS` 発生時の `package.json` | 依存を書き込んだうえでエラー（`"dependencies":{"yarn":"^1.22.22"}` が残る） | **`package.json` を書き換えない**（元のまま） | `12-yarn-local-shim.log` |
| クリーンインストール所要（同一fixture） | `real 0m14.636s`（コールドストア） | `Done in 4.7s`（ウォームストア）／再インストール時 4.5〜6.6s | `01-install-v11.log` / `07-lock-diff-v11-v12.log` |
| `corepack use pnpm@next-12`（Corepack 0.35.0） | ― | **成功**。`Installing pnpm@12.0.0-rc.6 in the project...` → `Done in 2.5s using pnpm v12.0.0-rc.6`（issue #13018 の `MODULE_NOT_FOUND` は再現せず） | `04-corepack-trap.log` |
| 取得できるRCパッチ番号 | ― | `self-update next-12` → **rc.5** / `corepack use pnpm@next-12` → **rc.6**（同じ日に導入手段で食い違う） | `04-corepack-trap.log` / `05-install-pnpm12.log` |
| ストアの共有 | `/work/.pnpm-store/v11` | 同じ `/work/.pnpm-store/v11` を使う（`store/v11` のまま） | `07-lock-diff-v11-v12.log` |
