# Node.js `node:vfs` config loader fixture 検証計画

## Source report

- `research/search-topic-20260711-1138.md`
- 選定テーマ: Node.js 26.4+ の実験的 `node:vfs` を使い、実ディスクを汚さない config loader のテスト fixture を作って、MemoryProvider・read-only・watch・RealFSProvider の境界を確認する。
- 関連する一次情報（調査レポート記録済み、閲覧日 2026-07-11）:
  - Node.js 26.4.0 release: https://nodejs.org/en/blog/release/v26.4.0
  - Node.js Virtual File System documentation: https://nodejs.org/api/vfs.html

## Objective

Node.js 26.5.0 の公式 Docker imageを固定して `--experimental-vfs` を有効化し、同一の小さな JSON config loader を host filesystem、独立した2つの MemoryProvider、RealFSProvider で動かす。成功系・失敗系・隔離・read-only・symlink・watch・root境界を、終了コード、標準出力、標準エラー、テスト結果、作成ファイル一覧として再現可能に記録する。記事本文は作らない。

## Hypothesis

- `node:vfs` は Node.js 26.5.0 で `--experimental-vfs` を付けたときだけ load できる。
- MemoryProvider 上の config loader は host側に fixture を作らず、別々の VFS instance は同じ `/config.json` を共有しない。
- seed 後に read-only にした MemoryProvider では read は成功し、write は `EROFS` で失敗する。
- MemoryProvider は symlink と watch を扱えるが、watch の event名・回数・順序は実測結果以上に一般化できない。
- RealFSProvider は専用 root 配下へ対応する host file を作る。一方、VFS は security sandbox ではないため、root脱出入力が拒否されることを成功条件に含め、拒否されなければ即時停止する。

## Environment

- 計画作成時 host: Darwin arm64
- 計画作成時に確認できた tool: Docker 28.5.1、host Node.js v22.17.0
- host Node.js は対象版未満なので検証には使わない。
- primary runtime: 公式 image `node:26.5.0-bookworm-slim`（tagを実行ログへ記録し、pull後に image ID も記録する）
- browser、Homebrew、global package、外部 SaaS、認証、GUI は使わない。

## Prerequisites and environment gate

- Docker daemon が利用でき、公式 `node:26.5.0-bookworm-slim` を取得できること。
- network は image取得だけに使い、検証開始後は `--network none` にする。
- gateは Node version、flag付きimport、公開export、MemoryProvider最小read/writeの順で判定する。
- docsと実行版のAPI差があり、公開exportを確認しても `create()` と MemoryProvider の最小read/writeが構成できなければ停止する。別機能へすり替えない。

## Isolation directory

全作業は、新規の `logs/run-node-vfs-config-fixture-<timestamp>/work/` の下だけで行う。`<timestamp>` はrun開始時の `YYYYMMDD-HHMMSS`。repository内の既存ファイル、`articles/`、`practice/`、`.git/` は変更しない。

```sh
set -eu
cd /Users/katayamaryuunosuke/workspace/024_zenn
RUN_ID="$(date '+%Y%m%d-%H%M%S')"
RUN_DIR="$PWD/logs/run-node-vfs-config-fixture-$RUN_ID"
WORK_DIR="$RUN_DIR/work"
mkdir -p "$WORK_DIR/evidence" "$WORK_DIR/host-fixture" "$WORK_DIR/realfs-root"
printf '%s\n' "$RUN_DIR" > "$WORK_DIR/evidence/run-dir.txt"
```

以降の各shell blockは同じshell sessionで実行し、`RUN_DIR` と `WORK_DIR` を維持する。実行器は各command、stdout、stderr、exit code、開始・終了時刻を `logs/run-node-vfs-config-fixture-<timestamp>/execution-log.md` に時系列で残す。

## Ordered steps and exact commands

### 1. Runtimeを固定して必須gateを確認する（20分）

```sh
IMAGE='node:26.5.0-bookworm-slim'
docker pull "$IMAGE"
docker image inspect "$IMAGE" --format '{{.Id}}' | tee "$WORK_DIR/evidence/image-id.txt"
docker run --rm --network none "$IMAGE" node --version | tee "$WORK_DIR/evidence/node-version.txt"
docker run --rm --network none "$IMAGE" node -p 'JSON.stringify({platform:process.platform,arch:process.arch,versions:process.versions},null,2)' | tee "$WORK_DIR/evidence/runtime.json"
docker run --rm --network none "$IMAGE" node --experimental-vfs -e "import('node:vfs').then(v=>console.log(Object.keys(v).sort().join('\\n')))" >"$WORK_DIR/evidence/vfs-exports.txt" 2>"$WORK_DIR/evidence/vfs-exports.stderr"
```

flagなしimportは失敗が期待値なので、`set -e` の対象外として終了コードを明示保存する。

```sh
set +e
docker run --rm --network none "$IMAGE" node -e "import('node:vfs').then(()=>console.log('unexpected-success'))" >"$WORK_DIR/evidence/no-flag.stdout" 2>"$WORK_DIR/evidence/no-flag.stderr"
NO_FLAG_STATUS=$?
set -e
printf '%s\n' "$NO_FLAG_STATUS" > "$WORK_DIR/evidence/no-flag.exit-code"
test "$NO_FLAG_STATUS" -ne 0
```

ここでflag付きimportが失敗、versionが26.4.0未満、または必要APIのexportが存在しない場合は停止する。実験APIの警告自体はstderrへ保存し、失敗とはみなさない。

### 2. 検証scriptをrun directory内に作る（45分）

`$WORK_DIR/config-loader.mjs` に、`fsLike.promises.readFile(path, 'utf8')` と `fsLike.promises.stat(path)` だけを使う `loadConfig(fsLike, path)` を作る。JSON objectの `name` が空でないstringであることを検証し、結果を返す。`$WORK_DIR/verify.mjs` には `node:assert/strict` と `node:test` を使い、次のcaseを実装する。

1. host baseline: `host-fixture/config.json` の成功、missing fileの `ENOENT`、invalid JSONの `SyntaxError`。
2. MemoryProvider: `create()` で2 instanceを作り、片方の `/config.json` だけ成功し、もう片方は `ENOENT`。
3. sync APIでwriteし、promise APIでreadする各1操作。
4. invalid JSON、directoryをfileとして読む失敗と、その `code` / `name` / `message` の構造化出力。
5. seed後に `setReadOnly()` を呼び、read成功、writeが `EROFS`。
6. targetとsymlinkを作り、`readlink`、`realpath`、symlink経由readをassert。
7. `watch` を開始後にwriteとrenameを行い、最大5秒でeventを収集し、`finally` でwatcherをclose。timeout時は `WATCH_UNCONFIRMED` を出して他caseを続行。
8. `new RealFSProvider('/work/realfs-root')` 相当の公開APIを使い、VFS上の `/config.json` が専用rootへ対応することをassert。
9. `..` とroot外を指すsymlinkをそれぞれ1回だけ試し、拒否をassert。どちらかがroot外へ到達した疑いがあれば `ROOT_ESCAPE_SUSPECTED` をstderrへ出し、直ちに非0終了する。

公開APIの正確なconstructor引数・providerのVFSへの渡し方は、step 1のexportと実行版の公式versioned docsで照合する。照合結果と採用したsignatureをexecution logへ記録し、推測で互換shimを作らない。ファイル作成後に次を実行する。

```sh
find "$WORK_DIR" -maxdepth 2 -type f -print | LC_ALL=C sort > "$WORK_DIR/evidence/files-before-run.txt"
sed -n '1,260p' "$WORK_DIR/config-loader.mjs" > "$WORK_DIR/evidence/config-loader.source.txt"
sed -n '1,420p' "$WORK_DIR/verify.mjs" > "$WORK_DIR/evidence/verify.source.txt"
```

### 3. host baselineとVFS suiteを実行する（60分）

containerにはrunの `work/` だけを `/work` としてmountする。repository root全体はmountしない。

```sh
docker run --rm --network none \
  --mount "type=bind,src=$WORK_DIR,dst=/work" \
  --workdir /work \
  "$IMAGE" \
  node --experimental-vfs --test verify.mjs \
  >"$WORK_DIR/evidence/test.stdout" \
  2>"$WORK_DIR/evidence/test.stderr"
printf '%s\n' '0' > "$WORK_DIR/evidence/test.exit-code"
```

非0終了時もexit codeを必ず保存するため、実行器は実際には当該commandのみ `set +e` で包み、`STATUS=$?` を保存してから `set -e` に戻す。`ROOT_ESCAPE_SUSPECTED` があれば後続の攻撃的試行と反復測定を行わず停止する。

### 4. hostへの影響とRealFSProviderの境界を確認する（20分）

```sh
find "$WORK_DIR" -maxdepth 4 -print | LC_ALL=C sort > "$WORK_DIR/evidence/files-after-run.txt"
find "$WORK_DIR/realfs-root" -maxdepth 3 -type f -print -exec shasum -a 256 {} \; | LC_ALL=C sort > "$WORK_DIR/evidence/realfs-tree-and-hashes.txt"
find "$WORK_DIR/host-fixture" -maxdepth 3 -type f -print -exec shasum -a 256 {} \; | LC_ALL=C sort > "$WORK_DIR/evidence/host-tree-and-hashes.txt"
find "$WORK_DIR" -type f -name 'config.json' -print | LC_ALL=C sort > "$WORK_DIR/evidence/all-host-config-paths.txt"
```

MemoryProvider用の `/config.json` がhostに現れていないこと、host baselineとRealFSProviderの対応fileだけが所定directory内にあることを確認する。run directory外へ書いた疑いがあれば停止し、run directory外は削除しない。

### 5. 安定性だけを5回確認する（40分）

性能優位の検証には使わない。watch以外の決定的caseが5回とも同じ結果になるか、wall timeとともに記録する。watch eventはraw logとして残し、回数・順序の一致を要求しない。

```sh
: > "$WORK_DIR/evidence/repeats.tsv"
i=1
while test "$i" -le 5; do
  START="$(date +%s)"
  set +e
  docker run --rm --network none \
    --mount "type=bind,src=$WORK_DIR,dst=/work" \
    --workdir /work \
    "$IMAGE" node --experimental-vfs --test verify.mjs \
    >"$WORK_DIR/evidence/repeat-$i.stdout" \
    2>"$WORK_DIR/evidence/repeat-$i.stderr"
  STATUS=$?
  set -e
  END="$(date +%s)"
  printf '%s\t%s\t%s\n' "$i" "$STATUS" "$((END-START))" >> "$WORK_DIR/evidence/repeats.tsv"
  i=$((i+1))
done
```

### 6. 証拠を要約する（25分）

```sh
wc -c "$WORK_DIR"/evidence/* > "$WORK_DIR/evidence/byte-counts.txt"
shasum -a 256 "$WORK_DIR/config-loader.mjs" "$WORK_DIR/verify.mjs" > "$WORK_DIR/evidence/source-hashes.txt"
docker image inspect "$IMAGE" --format '{{json .RepoDigests}}' > "$WORK_DIR/evidence/image-digests.json"
```

execution logには各assertのpass/fail、error code、watchのevent名・回数・timeout有無、RealFSProviderの対応path、5回の終了コードを表でまとめる。観測されていない成功や一般的な性能差は書かない。

## Observations to capture

- exact Node version、platform、architecture、Docker image ID/digest。
- flag付き・flagなしimportのstdout、stderr、exit codeと公開export一覧。
- host、MemoryProvider、RealFSProviderごとのtest名、pass/fail、error `name` / `code` / `message`。
- 2つのVFS instanceの同一pathに対する独立した結果。
- read-only前後のread/write結果と `EROFS`。
- `readlink`、`realpath`、symlink経由readの値。
- watchのraw event、回数、順序、5秒timeout有無、watcher close結果。
- RealFSProviderが作ったhost pathとhash、root脱出入力の拒否結果。
- 実行前後のfile tree、MemoryProvider fixtureがhostにないこと。
- 5反復の終了コードとwall time。速度差は参考値に限定する。

## Success criteria

- Node.js 26.4.0以上でflag付きimportがexit 0、flagなしimportが非0で記録される。
- config loaderのhost baselineとMemoryProvider成功系、missing、invalid JSONがassertされる。
- 独立した2 VFS instanceが同じpathの状態を共有しない。
- syncとpromise APIの各1操作が成功する。
- read-only後もreadでき、writeは `EROFS` になる。
- symlinkまたはwatchの少なくとも一方が公式仕様と実行証拠の両方で確認できる。watch timeout時は未確認と明記できる。
- RealFSProviderが専用rootにだけ対応fileを作り、`..` とroot外symlinkの脱出入力が拒否される。
- watchを除く決定的caseが5反復すべてexit 0。
- すべて無料・認証不要・CLIのみでrun directory配下に完結する。

## Failure and stop criteria

- Docker/image取得不可、Node.js 26.4.0未満、flag付きimport失敗: 対象機能を検証できないため即時停止。
- 実行版docsとAPIが合わず、`create()` とMemoryProvider最小read/writeを構成不能: errorとexportを保存して停止。
- flagなしimportが成功: 実測差として保存し、仮説不一致のため成功扱いにしない。
- read-only writeが `EROFS` 以外、instance間で状態共有、MemoryProvider fixtureがhostに出現: 失敗として停止。
- watchが5秒以内に届かない: watcherをcloseし当該項目だけ未確認として続行。無制限に待たない。
- root脱出が拒否されない、またはrun directory外への書込み疑い: 即時停止。追加攻撃を行わず、VFSをsandboxと説明しない。
- 5反復の結果が不安定: 性能結論を捨て、安定して観測できたAPI差と境界だけを採用する。
- secret、credential、private hostname、外部実データが必要: 即時停止。

## Security and cost limits

- 費用上限は0円。paid service、cloud API、signup、OAuth、credentialを使わない。
- fixtureは架空の `name` だけとし、repositoryやuserの実ファイルを読まない。
- containerは `--network none`、非privileged、work directoryのみbind mountする。Docker socketをmountしない。
- path traversalとroot外symlinkは各1caseだけ。拒否されなければ追加探索をしない。
- VFSをsecurity sandboxとして扱わない。
- repositoryにGit変更を加えるcommandは実行しない。

## Cleanup

証拠確認・article draftへの引継ぎが終わるまではrun directoryを保持する。cleanupが明示的に必要になった場合だけ、記録済みの完全な `$RUN_DIR` が `logs/run-node-vfs-config-fixture-` 配下であることを確認し、その1directoryだけを削除候補にする。Docker image削除やrun directory外の削除は計画しない。containerはすべて `--rm` で終了する。

```sh
test -n "$RUN_DIR"
case "$RUN_DIR" in
  /Users/katayamaryuunosuke/workspace/024_zenn/logs/run-node-vfs-config-fixture-*) ;;
  *) exit 1 ;;
esac
printf 'cleanup candidate: %s\n' "$RUN_DIR"
```

## Timebox

- 合計3時間30分を上限とする。
- runtime gate 20分、script作成45分、初回suite 60分、境界確認20分、5反復40分、証拠整理25分。
- watch待機は1回5秒、全体timeboxを越えて再試行しない。

## Fallback scope

- Docker pullだけが失敗した場合、公式 `nodejs.org/dist/v26.5.0/` のplatform一致archiveをrun workspaceへ取得し、checksumを公式 `SHASUMS256.txt` と照合した隔離binaryへ置き換えてよい。それ以外のversionやpackage manager installへは広げない。
- watchだけ未確認なら、MemoryProviderの隔離、read-only、symlink、RealFSProvider境界を続け、watchは未確認とする。
- RealFSProviderが安全に確認できなければhost baselineとMemoryProviderの証拠だけを残すが、計画全体は未達として扱う。
- API全体を構成できない場合、Package Mapsや別候補へ切り替えずabortする。

## Expected article takeaways

- Node.js標準の実験的VFSでconfig loaderのfilesystem依存を差し替える最小構成。
- MemoryProvider fixtureがhost diskを汚さず、instance単位で隔離されるかの実測。
- read-only、missing file、invalid JSON、directory readなど失敗系の具体的なerror。
- symlink/watchの対応範囲と、watch eventを一般化しない注意点。
- RealFSProviderとhost fsの対応、および `node:vfs` はsecurity sandboxではないという境界。
- 小さなfixtureの時間計測から一般的な性能優位を主張できないこと。
