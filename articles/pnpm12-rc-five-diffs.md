---
title: "pnpm 12 RC に上げて、公式が挙げた「5つの差分」を1つずつ踏んでみた"
emoji: "📦"
type: "tech"
topics: ["pnpm", "nodejs", "npm", "monorepo", "rust"]
published: false
---

<!-- 前提: 出典ログ logs/run-pnpm12-rc-five-diffs-20260816-0411/execution-log.md / 記事タイプ: 検証ログ / slug: pnpm12-rc-five-diffs / published: false -->

## はじめに

pnpm 12 は本体が Rust で書き直されたバージョンです。公式ブログの [What's different in pnpm 12](https://pnpm.io/blog/whats-different-in-pnpm-12) が「11 から何が変わるか」を5点にまとめていて、それがそのままチェックリストとして使える形になっていたので、11 と 12 RC を同じプロジェクトに当てて1つずつ確かめてみました。

速度の話は測っていません。Rust リライトというと真っ先にベンチマークを取りたくなりますが、それは他の人がやってくれるだろうと思って、「書いてある差分が手元で本当に見えるか」だけに絞りました。

結果を先に書くと、5点のうち 11→12 の差分として再現できたのは1点だけでした。残りは「12 は公式の記述どおりだけど 11 でも同じ」が2点、「12 で公式どおりの挙動を確認できなかった」が2点です。ただしこれは「公式が嘘を書いている」という話ではなくて、比較対象に選んだ pnpm 11 のパッチをどれにするか、という話でした。

:::message
筆者は pnpm 11 しか触ったことがない状態で試しています。検証日は 2026-08-16、pnpm 12 はまだ RC（`12.0.0-rc.5`）なので、GA では挙動が変わる可能性があります。
:::

## なぜこの技術を試すのか

普段は pnpm 11 を使っていて、メジャーが上がると聞いてもピンときていませんでした。「Rust になっただけで使い勝手は同じ」なのか、それとも移行時に踏む地雷があるのか。公式ブログが差分を5点に絞って書いてくれているので、GA を待つ前に RC で1回踏んでおけば、実際に上げるときの判断材料になると思って試しました。

もう一つ、公式ブログの5点がそのまま検証項目の形をしていたのが大きかったです。「〜が変わりました」ではなく「11 ではこう、12 ではこう」という書き方なので、fixture を1個作れば全部同じプロジェクトで確認できます。

## 事前に調べたこと（公式が挙げる差分5点）

公式ブログから、検証項目にした5点の原文です。

```
① "A globally installed `node`, `deno`, or `bun` now follows the version the current
   project pins, instead of always running the globally installed one."

② "All of these name the same dependency and resolve identically" /
   "Each resolves through the host's canonical HTTPS URL, and pnpm never records an
   SSH URL for those hosts."
   （11以前: "the resolver probed transports and could record
     `git@github.com:owner/repo.git`, which then failed for everyone whose machine
     had no key for that host."）

③ pnpm 12 では `pnpm add -g yarn` が "installs the current Yarn line"（11 は
   "installs Yarn Classic"）／ "a globally installed package manager" が
   "defers to a project's pin where there is one"

④ "pnpm breaks dependency cycles at a fixed place instead of wherever the
   installation happens to walk into them." /
   "the lockfile is a function of the dependency graph alone."

⑤ "`pnpm install --resolution-only` is gone" / "pnpm 12 does not implement this flag
   and rejects it."
```

正直に書くと、読んだ時点で意味が取れていない言葉がいくつかありました。①に出てくる `globalShims`（後で設定名として探すことになる）、②の identity、④の「固定点でサイクルを切る（breaks cycles at a fixed place）」あたりです。分からないまま「とりあえず手を動かせば何か見えるだろう」で検証に入りました。結果として `globalShims` は最後まで実体を確認できませんでした。

導入手段は [公式の Installation ページ](https://pnpm.io/installation) を見て `pnpm self-update next-12` にしました。すでに pnpm 11.22.0（11.10.0 以上）が入っていれば、これが一番短い手順です。

Corepack を使う手（`corepack use pnpm@next-12`）もあるのですが、`Cannot find module .../bin/pnpm.mjs` で落ちるという issue #13018 が Closed as not planned のまま残っていたので、地雷を踏みに行くのはやめて `self-update` にしました。これが後で空振りします（後述）。

## 環境構築（11と12 RCの同居、fixtureの構成）

手元の環境を壊したくなかったので Docker のコンテナで隔離しました。ホストは macOS 26.5（arm64, Build 25F71）/ Docker 28.5.1 / Node v22.17.0 です。

```bash
docker run -d --name pnpm12lab -v "$PWD":/work -w /work node:24 sleep infinity
docker exec pnpm12lab bash -lc 'node --version; npm --version; git --version; uname -a'
```

```
v24.18.0
11.16.0
git version 2.39.5
Linux cf263e6a3b35 6.10.14-linuxkit #1 SMP Tue Oct 14 07:32:13 UTC 2025 aarch64 GNU/Linux
```

`node:24` は Debian 12 bookworm で、git が最初から入っていました。`apt-get install git` を書いていたのですが不要でした。

fixture は、循環依存・Git依存の3表記・`devEngines.runtime` を全部1つのワークスペースに詰め込んだものにしました。ルート＋`packages/a`＋`packages/b` の3プロジェクトです。

```json:package.json
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

```yaml:pnpm-workspace.yaml
packages:
  - 'packages/*'
```

```json:packages/a/package.json
{ "name": "@fixture/a", "version": "1.0.0", "private": true,
  "dependencies": { "@fixture/b": "workspace:*", "is-positive-short": "kevva/is-positive" } }
```

```json:packages/b/package.json
{ "name": "@fixture/b", "version": "1.0.0", "private": true,
  "dependencies": { "@fixture/a": "workspace:*", "is-positive-github": "github:kevva/is-positive" } }
```

`@fixture/a` → `@fixture/b` → `@fixture/a` で2ノードの循環を作っています。Git依存は短縮 `kevva/is-positive` / `github:kevva/is-positive` / `git+https://github.com/kevva/is-positive.git` の3表記を別々のパッケージに割り振り、エイリアス名を分けました。同じパッケージを3経路で同時に引かせて、lockfile に3行並んで見えるようにするためです。

基準取りとして先に pnpm 11 を入れます。

```bash
$ npm i -g pnpm@11
added 1 package in 2s
$ pnpm --version
11.22.0
$ which pnpm
/usr/local/bin/pnpm
```

### 避けたはずの corepack が、試したら普通に動いた

上で「issue #13018 があるから corepack は避けた」と書きましたが、検証の途中で念のため叩いてみたら、何事もなく通りました。

```
$ corepack --version
0.35.0
$ corepack use pnpm@next-12
Installing pnpm@12.0.0-rc.6 in the project...

Downloading the pnpm 12.0.0-rc.6 binary for linux-arm64...
Already up to date
Done in 2.5s using pnpm v12.0.0-rc.6
exit=0
```

Closed as not planned の issue を根拠に手段を1つ避けたのに、実際は動いた、という話です。ついでに気になったのが、同じ日に `self-update next-12` は rc.5 を、`corepack use pnpm@next-12` は rc.6 を持ってきたこと。タグの向き先なのかキャッシュなのかは調べきれていません。以降の検証は `self-update` 側で入った rc.5 で進めています。

## 実際に試したこと（差分5点を1つずつ）

まず結果の一覧です。判定は3値で書き分けました。「再現」＝11 と 12 で挙動が違い公式どおり、「差分として未再現」＝12 は公式どおりだが 11.22.0 でも同じ、「未再現」＝12 で公式どおりの挙動を確認できず、です。

| # | 差分 | 判定 |
|---|---|---|
| ① | グローバルの `node` がプロジェクトのピンに従う | 未再現 |
| ② | Git依存の表記ゆれが正規HTTPS URLに正規化される | 差分として未再現（11.22.0で既に成立） |
| ③ | `pnpm add -g yarn` が現行 Yarn を入れる | 未再現 |
| ④ | 循環依存があっても lockfile が依存グラフだけで決まる | 差分として未再現（11でも順序非依存）／12は公式どおり |
| ⑤ | `pnpm install --resolution-only` の廃止 | 再現 |

以下、1つずつ。再現できたものから順に書きます。

### ⑤ `--resolution-only` は確かに消えていた（唯一の再現）

11 でしか取れない出力なので、12 を入れる前に基準を取っておきました。

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

12 では拒否されます。

```
$ pnpm --version
12.0.0-rc.5
$ pnpm install --resolution-only
error: unexpected argument '--resolution-only' found

Usage: pnpm install [OPTIONS]

For more information, try '--help'.
exit=2

$ pnpm install --help | grep -i -n resolution
102:          URL of a pnpr server to offload resolution and file fetching to. `node_modules` is still linked locally from the server-produced lockfile
```

終了コードが 2 なのが地味に効きます。0 でも 1 でもないので、CI で `pnpm install --resolution-only || true` みたいな逃がし方をしていないと素直に落ちます。それと、エラー文は代替の `pnpm peers check` を案内してくれません。公式ブログを読んでいないと、何に置き換えればいいのか分からないまま止まると思います。

`pnpm peers check` 自体は 11.22.0 にも 12 にもあって、どちらも `No peer dependency issues found` / `exit=0` でした。終了コードの仕様は公式ドキュメントで見つけられなかったのですが、11 のヘルプには書いてありました。

```
      check                Checks for unmet or missing peer dependency issues by
                           reading the lockfile. Exits with a non-zero exit code
                           when issues are found.
```

12 のヘルプからはこの終了コードの記載が消えていました。

### ② Git依存の正規化は、11.22.0 の時点で既に終わっていた

`pnpm install` 後の lockfile を grep しただけです。

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
```

3表記とも同じ commit SHA の codeload URL に落ちています。ここまでは公式の記述どおりなんですが、この出力は 11.22.0 と 12.0.0-rc.5 で完全に同一でした。「11 では表記ごとに別々に記録される」と予想して fixture を組んだのに、11 の時点で既に正規化されていた形です。

②の核心は「11 は SSH URL を lockfile に記録しうる」という部分なので、そこを確かめないと判定できません。当初は「SSH は鍵が要るから範囲外」と決めていたのですが、相手が公開リポジトリなら、鍵が無い状態で失敗するのか成功するのかを見ること自体が検証になると気づいて、`git+ssh://` だけの fixture を追加しました。

```bash
GIT_TERMINAL_PROMPT=0 \
GIT_SSH_COMMAND="ssh -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=10" \
pnpm install
```

```
### ssh key present?
ls: cannot access '/root/.ssh': No such file or directory

=== pnpm 11 (11.22.0) ===
+ is-positive-ssh <- is-positive 3.1.0
Done in 1.9s using pnpm v11.22.0
--- lock (v11) ---
12:        specifier: git+ssh://git@github.com/kevva/is-positive.git
13:        version: is-positive@https://codeload.github.com/kevva/is-positive/tar.gz/97edff6f...2678

=== pnpm 12 (12.0.0-rc.5) ===
+ is-positive-ssh <- is-positive 3.1.0
Done in 1.4s using pnpm v12.0.0-rc.5
--- lock (v12) ---
12:        specifier: git+ssh://git@github.com/kevva/is-positive.git
13:        version: is-positive@https://codeload.github.com/kevva/is-positive/tar.gz/97edff6f...2678
```

SSH 鍵が1つも無い環境で 11 も 12 も成功して、両方とも lockfile の `version:` / `resolution:` 行は HTTPS の codeload URL でした（`specifier:` には自分が書いたとおりの `git+ssh://git@github.com/kevva/is-positive.git` がそのまま残ります）。`grep -c ssh` / `grep -c git@` が 0 件だったのは、`git+ssh://` を含まない3表記 fixture の lockfile の方です。

公式が書いている「11 以前は `git@github.com:owner/repo.git` を記録しうる」という挙動は、少なくとも 11 系の最終盤である 11.22.0 では既に直っていたことになります。「12 で直った」と読める書き方と実測のズレですが、公式が想定している「11」はもっと前のパッチなんだと思います。

### ④ lockfile の決定性は、11 でも既に順序非依存だった

依存の記述順を入れ替えて再インストールし、`sha256sum` を比べました。まず 11 側。

```
### run1 (original order) hash
041735468d7af7cc2a1a032bcf05e7dd692b9977d0ca8038f34c14b3e8ed8665  pnpm-lock.yaml
### run2 (reordered) hash
1aa7d0aa01bf59c710785c8b6ef2094fc63e362667e15eb3d57b5315cff6e20d  pnpm-lock.yaml
```

ハッシュが違ったので一瞬「11 は順序非決定なんだ」と思ったのですが、これは早合点でした（詳しくは後述の「詰まった点」）。同じ条件で取り直すと 11 でも一致します。

12 側。

```
### run1 (original order) hash
041735468d7af7cc2a1a032bcf05e7dd692b9977d0ca8038f34c14b3e8ed8665  pnpm-lock.yaml
### run2 (reordered) hash
041735468d7af7cc2a1a032bcf05e7dd692b9977d0ca8038f34c14b3e8ed8665  pnpm-lock.yaml
### run3 (back to original order) hash
041735468d7af7cc2a1a032bcf05e7dd692b9977d0ca8038f34c14b3e8ed8665  pnpm-lock.yaml
```

3回とも同じです。12 は公式の記述どおりに動いていますが、11.22.0 も同じように動くので、差分としては観測できませんでした。

### ③ `pnpm add -g yarn` は rc.5 でもまだ Yarn Classic

```
=== pnpm 11 ===
global:
+ yarn 1.22.22
Done in 788ms using pnpm v11.22.0
$ yarn --version     ->  1.22.22

=== pnpm 12 ===
Ignored build scripts: yarn@1.22.22.
Run "pnpm approve-builds" to pick which dependencies should be allowed to run scripts.
dependencies:
+ yarn 1.22.22
Done in 222ms using pnpm v12.0.0-rc.5
$ yarn --version     ->  1.22.22
```

公式は 12 なら "the current Yarn line" が入ると書いていますが、rc.5 では 11 と同じく Yarn Classic の 1.22.22 でした。ローカルの `pnpm add yarn` でも `"dependencies":{"yarn":"^1.22.22"}` が書かれるだけで、`packageManager` にも `devEngines.packageManager` にも何も入りません（これは 11 も同じ）。

関連しそうな `pnpm shim` サブコマンドも探しましたが、ありませんでした。

```
$ pnpm shim --help      # v12
Error: ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL

  × Command "shim" not found

$ pnpm --help | grep -i -E 'shim|pnx'   # v12
(該当なし / grep-exit=1)
```

ただし `pnx` というファイル自体は実在していて、PATH を 12 優先にすると動きます。

```
$ pnx --help
Run a package in a temporary environment

Usage: pnpm dlx [OPTIONS] [COMMAND]...
```

### ① グローバルの node がプロジェクトのピンに従う、は入口にすら届かなかった

5点の中で一番派手な触れ込みだと思っていたのですが、ここが一番何も観測できませんでした。

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

fixture の中でも外でも `node --version` はイメージ同梱の v24.18.0 のままです。`pnpm add -g node` は `node@26.7.0` を入れたと言うのに `$PNPM_HOME/bin` に `node` の実行ファイルが現れないので、そもそも「globally installed node を PATH 経由で呼ぶ」状態を作れませんでした。これは 11 でも同じで、`$PNPM_HOME/bin` に `node` が現れないところまで同じでした。なお 12 の `pnpm ls -g` には `node@26.7.0` がちゃんと並びます。

```
$ pnpm ls -g            # v12
/root/p12home/global/v11 (PRIVATE)
│   dependencies:
├── node@26.7.0
└── yarn@1.22.22
```

一方、`devEngines.runtime` のピン自体は効いていて、`node_modules/.bin/node --version` は v22.11.0 でした。プロジェクトローカルには効くけれど、グローバルの node には波及していない、という状態です。これも 11 と 12 で同じでした。

公式ブログに出てくる `globalShims` は `pnpm config get` でも `pnpm config list` でも見つからず、設定名の実体を最後まで確認できていません。なので①が未再現なのが「rc.5 に未実装だから」なのか「有効化の手段を見つけられなかっただけ」なのかは切り分けられていません。`pnpm add -g node` が bin を作らないのがバグか仕様かも、issue を探すところまではやっていないので分からないままです。

## 詰まった点

### `self-update` が成功したのにバージョンが上がらない

一番混乱したのがこれです。

```
$ pnpm self-update next-12
Checking for updates...
Switching pnpm from v11.22.0 to v12.0.0-rc.5...
Successfully updated pnpm to v12.0.0-rc.5
exit=0

$ hash -r; pnpm --version
11.22.0
exit=0

$ which -a pnpm
/usr/local/bin/pnpm
```

`Successfully updated` と言われて、シェルのハッシュもクリアしたのに 11.22.0 のまま。`which -a` を使っても候補は1件しか出てこないので、そこから先に進めませんでした。

最近書かれたファイルを探せば実体が見つかるはず、と思って `find / -name "pnpm*" -newermt "-10 minutes"` を叩いたら出てきました。

```
$ /root/.local/share/pnpm/bin/pnpm --version
12.0.0-rc.5
$ ls -la /root/.local/share/pnpm/bin
-rwxr-xr-x 1 root root 1761 Aug 15 19:14 pn
-rwxr-xr-x 1 root root 1112 Aug 15 19:14 pnpm
-rwxr-xr-x 1 root root 1773 Aug 15 19:14 pnpx
-rwxr-xr-x 1 root root 1767 Aug 15 19:14 pnx
```

`PNPM_HOME` を設定していなかったので `~/.local/share/pnpm/bin` が PATH に入っておらず、npm 経由で入れた `/usr/local/bin/pnpm`（11 系）が勝ち続けていた、というだけの話でした。`pnpm self-update` は npm でグローバル導入した pnpm を置き換えるのではなく、別の場所に書きます。以降は `export PATH="/root/.local/share/pnpm/bin:$PATH"` を明示して実行しました。

ちなみに `pnpm` 本体は `#!/bin/sh` のラッパースクリプトで、そこからネイティブバイナリを呼ぶ形になっていました。`pn` / `pnx` / `pnpx` の shim も同時に置かれます。

### `PNPM_HOME` を分けたら global bin が PATH に無いと怒られた

ホストの環境を汚さないために `PNPM_HOME` を検証用に分けたら、今度はこれ。

```
$ PNPM_HOME=/root/p11home pnpm add -g yarn
[ERROR] The configured global bin directory "/root/p11home/bin" is not in PATH
Run "pnpm setup" to update your shell configuration.
exit=1
```

PATH に入れるのは `$PNPM_HOME` ではなく `$PNPM_HOME/bin` です。`export PATH="$PNPM_HOME/bin:$PATH"` で通りました。エラー文は `pnpm setup` を案内してきますが、隔離した検証環境でシェル設定を書き換えられるのは避けたかったので、自分で PATH を通しています。

### ハッシュが違う＝非決定、と早合点した

④で pnpm 11 のハッシュが1回目と2回目で違ったとき、「11 は順序非決定だ、差分が再現できた」と一瞬思いました。`diff` の中身を見たらそうではありませんでした。

```
40c40
<     resolution: {gitHosted: true, integrity: sha512-ImoN9vdC+9CSDxbHJIcYwImhox3/lvLNqKpX5dNXT9O5Vawb+c4wddQ6KXq8FsFMm4WuSc3nxaWG2Q3iBRcFdA==, tarball: https://codeload.github.com/kevva/is-positive/tar.gz/97edff6f...2678}
---
>     resolution: {gitHosted: true, tarball: https://codeload.github.com/kevva/is-positive/tar.gz/97edff6f...2678}
```

違いは `integrity:` の有無だけで、依存の記述順とは関係ありませんでした。pnpm 11 では、1回目はネットワークからダウンロードしたので integrity を書けて、2回目はストアから再利用したので書けなかった、ということのようです。同じウォームストア条件で取り直したら 11 でも一致しました。

```
### run1b (original order, warm store) hash
1aa7d0aa01bf59c710785c8b6ef2094fc63e362667e15eb3d57b5315cff6e20d  pnpm-lock.yaml
### diff order1-warm vs order2
diff-exit=0
```

## 触ってみて分かったこと（lockfileの決定性は本当に効いたか）

11 で作った lockfile と 12 で作った lockfile を丸ごと比べたら、差分がありませんでした。

```
$ wc -l pnpm-lock.yaml
179 pnpm-lock.yaml
$ sha256sum pnpm-lock.yaml
041735468d7af7cc2a1a032bcf05e7dd692b9977d0ca8038f34c14b3e8ed8665  pnpm-lock.yaml

$ diff lock-v11.yaml lock-v12.yaml | wc -l
0
```

179行で同一、sha256 も一致です。公式は 12 に上げた初回に一度きりの diff が出る（peer bindings や Git 依存の URL が書き換わる）と説明していて、実際 issue #13320 では 600 行規模の差分が報告されているのですが、依存2個・ワークスペース3個のこの fixture では1行も出ませんでした。600行差は vercel/next.js 規模の話なので、この大きさでは差が出る余地がなかった、と読むのが妥当だと思います。

`lockfileVersion` は `'9.0'` のまま、ストアも 11 と 12 で同じ `/work/.pnpm-store/v11` を共用していました。「lockfile 形式は据え置き」は手元でも確認できています。

代わりに見つかったのが、④と「詰まった点」で触れた `integrity` の件です。ハッシュ比較の表にすると分かりやすくて、

| ツール | 1回目 | 依存順を入れ替えた2回目 | 一致 |
|---|---|---|---|
| pnpm 11.22.0（コールド→ウォーム） | `041735...` | `1aa7d0...` | ✗ |
| pnpm 11.22.0（ウォーム同士で再測定） | `1aa7d0...` | `1aa7d0...` | ✓ |
| pnpm 12.0.0-rc.5 | `041735...` | `041735...` | ✓ |

1行目だけが不一致で、原因は依存の順序ではなくストアが温まっているかどうかでした。「lockfile のハッシュが CI とローカルで違う」を調べるとき、真っ先に疑うべきは依存の記述順ではなく、`integrity` を書けるだけの情報があったか、つまりストアの状態かもしれません。ただし 12 は同じウォームストア条件でも `integrity` を書いていて（3行目の2回目も `041735...` 側）、この非決定性自体が 11 側の挙動である可能性はあります。

## pnpm 11と比べて感じたこと

公式は「コマンドとフラグは 11 から据え置き」と説明していて、それ自体は概ねそのとおりでした。ただ、ヘルプの見た目は別物になっています。11 は Node の yargs 系で `--filter` 関連のフラグがずらりと並ぶのに対して、12 は Rust の clap 形式。`pnpm peers --help` の先頭を見比べると、12 側には `--filter` 系が出てきません（先頭30行の範囲での話です）。⑤のエラー文 `error: unexpected argument '--resolution-only' found` も clap 由来の文言です。「フラグは据え置き」は、ヘルプの体裁やフラグの網羅性まで同じ、という意味ではなさそうです。

公式の5点に載っていないところでも、いくつか違いに気づきました。

一つは循環依存の警告。11 は毎回これを出します。

```
[WARN] There are cyclic workspace dependencies: /work/fixtures/pnpm12-five-diffs/packages/a, /work/fixtures/pnpm12-five-diffs/packages/b
```

12 では同じ fixture で1度も出ませんでした（`grep -c cyclic` が 11 の2ログで各1回、12 の2ログで各0回）。④の「固定点でサイクルを切る」と関係があるのかもしれませんが、そこまでは追えていません。

もう一つは、`ERR_PNPM_IGNORED_BUILDS` で失敗したときの `package.json` です。11 は依存を書き込んだ状態でエラーになる（`"dependencies":{"yarn":"^1.22.22"}` が残る）のに対して、12 は `package.json` を書き換えずにエラーになりました。失敗したら元の状態、のほうが個人的には好みです。

あとは、`devEngines.runtime` に `onFail: "download"` を書くと Node 22.11.0 を実際にダウンロードして `devDependencies: + node 22.11.0` として扱う挙動。これを 12 の新機能だと思い込んでいたのですが、11 の時点で動いていました。lockfile にも `node: specifier: runtime:22.11.0` の行が入ります。

## どんな人に向いていそうか（移行を待つ判断材料）

今回の範囲で言えることだけ書きます。

すでに pnpm 11.22.0 まで上げている人は、②と④の恩恵はもう手元にあります。Git 依存を `git+ssh://` で書いていても 11.22.0 の時点で lockfile には HTTPS が記録されるので、「SSH URL が lockfile に混ざって他のメンバーが壊れる」を理由に急いで 12 に上げる必要は無さそうです。逆に 11 の古いパッチを使っているなら、この2点は 11 の最新に上げるだけで解決するかもしれません。

①（グローバル node がプロジェクトのピンに従う）や③（現行 Yarn が入る）を目当てにしているなら、rc.5 の時点では待ちだと思います。少なくとも私は動いている様子を観測できませんでした。

⑤の `--resolution-only` は、使っている人は移行前に置換先を決めておく必要があります。終了コード 2 で落ちるうえ、エラーが代替を案内してくれないので、CI で使っていると気づいた時にはビルドが止まっています。

## まとめ

公式が挙げた5点のうち、11.22.0 → 12.0.0-rc.5 の差分として再現できたのは `--resolution-only` の廃止1点だけでした。②④は「12 は公式どおりだが 11 でも同じ」、①③は「12 で公式どおりの挙動を確認できず」です。

ここで大事なのは、比較対象を「pnpm 11」と一括りにしてしまうと数が変わるということでした。公式ブログが暗黙に想定している 11 は、私が使った 11.22.0 よりもっと前のパッチなんだと思います。次にやるなら 11.0.x あたりと比べてみたいです。そうすれば②④は本当に「差分」として見えるはずで、今回の判定が「公式が間違っている」ではなく「比較対象の取り方の問題」だったことも確かめられます。

RC を触っているので、①③については GA で普通に動く可能性が高いです。`globalShims` が何なのかも分からないままなので、rc.6 や GA が出たら測り直したいところです。

Rust リライトの速度については今回まったく測っていません。ただ、同じ fixture のクリーンインストールが 11 のコールドストアで 14.6 秒、12 のウォームストアで 4.7 秒だったので、条件を揃えて測る価値はありそうだと思いました。

## 参考リンク

https://pnpm.io/blog/whats-different-in-pnpm-12

https://pnpm.io/installation

https://pnpm.io/settings

## 再現手順

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

ハマりどころをいくつか。

- `pnpm self-update` は npm でグローバル導入した `/usr/local/bin/pnpm` を置き換えません。`~/.local/share/pnpm/bin` を PATH の先頭に置かないとバージョンが上がったように見えません。
- `PNPM_HOME` を分けて隔離する場合、PATH に入れるのは `$PNPM_HOME` ではなく `$PNPM_HOME/bin` です。
- lockfile のハッシュを比べるときは、両方をウォームストア（または両方コールド）に揃えてください。片方だけコールドだと `integrity:` の有無で1行ずれます。
- `git+ssh://` 表記を試すときは `GIT_TERMINAL_PROMPT=0` と `GIT_SSH_COMMAND="ssh -o BatchMode=yes ..."` を付けないと、鍵が無い環境でプロンプト待ちになりえます。
- 比較対象の pnpm 11 をどのパッチにするかで「差分」の数が変わります。この検証は 11.22.0 との比較です。
