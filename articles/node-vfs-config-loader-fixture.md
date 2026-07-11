---
title: "Node.js標準VFSでconfig loaderを試す：境界テストで止まった記録"
emoji: "🗂️"
type: tech
topics: ["nodejs", "testing", "filesystem"]
published: true
---

## 対象読者

- ファイルを読む処理を、実ディスク上の一時ファイルに頼らずテストしたい方
- Node.jsの実験的な`node:vfs`で、MemoryProviderとRealFSProviderの違いを知りたい方
- 成功例だけでなく、境界テストが想定どおりにならなかった実測も確認したい方

この記事はNode.js v26.5.0で行った1回の検証記録です。MemoryProviderを使ったconfig loaderのテストは通りましたが、RealFSProviderへの`..`入力が「拒否される」という想定は外れました。その時点で検証を止めたため、外部を指すsymlinkと5回反復は未確認です。

## 試したこと

`stat`と`readFile`だけに依存する小さなJSON config loaderを作り、次の3種類のファイルシステムで動かしました。

1. hostの`node:fs`
2. `create()`が生成するMemoryProvider-backed VFSを2つ
3. 専用ディレクトリをrootにしたRealFSProvider

`node:vfs`はNode.js v26.4.0で追加された実験的機能です（[Node.js 26.4.0 release](https://nodejs.org/en/blog/release/v26.4.0)、2026-07-11閲覧）。公式ドキュメントには、利用に`--experimental-vfs`が必要なことや、MemoryProvider、RealFSProvider、read-only、symlink、watchなどのAPIが記載されています（[Node.js Virtual File System](https://nodejs.org/api/vfs.html)、2026-07-11閲覧）。

検証では、成功系に加えてmissing file、壊れたJSON、ディレクトリの読み込み、read-only後の書き込み、instance間の隔離、symlink、watch、RealFSProviderのroot境界を確認しました。

## 検証環境

| 項目 | 実測値 |
|---|---|
| host | macOS 26.5（Darwin 25.5.0）、arm64 |
| Docker CLI | 28.5.1 |
| 計画したimage | `node:26.5.0-bookworm-slim` |
| 実際のruntime | 公式`node-v26.5.0-darwin-arm64.tar.gz` |
| Node.js | v26.5.0 |
| platform / arch | darwin / arm64 |
| archive SHA-256 | `ee920559aaa2391569cff4d737e3b83963430e3a14dedd91bfe0ff53171b5af9` |

Docker imageのpullが約6分10秒進まなかったため中断し、計画していた公式archiveへ切り替えました。archiveのSHA-256は、同じ配布ディレクトリの公式`SHASUMS256.txt`と一致しました。そのため、以下はLinux containerではなくdarwin/arm64での観測です。

## 再現手順

以下の各stepに載せる短いコードは、実行した`verify.mjs`から要点を抜き出したexcerptです。省略なしの`verify.mjs`と、実行時の配置・commandはstep 7にまとめます。

### 1. config loaderを作る

`config-loader.mjs`は`fsLike`を引数に取ります。hostの`fs`とVFSのどちらでも、loader自体は変更しません。

```js
export async function loadConfig(fsLike, path) {
  const stat = await fsLike.promises.stat(path);
  const source = await fsLike.promises.readFile(path, 'utf8');
  const value = JSON.parse(source);

  if (
    stat.isFile() !== true ||
    value === null ||
    Array.isArray(value) ||
    typeof value !== 'object' ||
    typeof value.name !== 'string' ||
    value.name.length === 0
  ) {
    throw new TypeError('config.name must be a non-empty string');
  }

  return value;
}
```

### 2. flagの有無を確認する

同じNode.js v26.5.0で、別processとして次を実行しました。

```bash
node --experimental-vfs -e \
  "import('node:vfs').then(v => console.log(Object.keys(v).sort().join('\\n')))"

node -e "import('node:vfs')"
```

flag付きはexit code 0で、`MemoryProvider`、`RealFSProvider`、`VirtualFileSystem`、`VirtualProvider`、`create`、`default`が出力されました。flagなしはexit code 1となり、`ERR_UNKNOWN_BUILTIN_MODULE`でした。

### 3. MemoryProviderの隔離と失敗系をテストする

`create()`で2つのVFSを作り、片方だけへ同じpathのconfigを書きます。

```js
import assert from 'node:assert/strict';
import { create } from 'node:vfs';
import { loadConfig } from './config-loader.mjs';

const first = create();
const second = create();

first.writeFileSync('/config.json', '{"name":"first"}\n');
assert.deepEqual(await loadConfig(first, '/config.json'), { name: 'first' });
await assert.rejects(loadConfig(second, '/config.json'), { code: 'ENOENT' });
```

実行したsuiteでは、1つ目からの読み込みは成功し、2つ目は`ENOENT`になりました。また、sync APIで書いた内容をpromise APIでそのまま読めました。

失敗系では、壊れたJSONが`SyntaxError`、ディレクトリをファイルとして読む操作が`EISDIR`になりました。

### 4. seed後にread-onlyへ切り替える

```js
import { MemoryProvider, create } from 'node:vfs';

const provider = new MemoryProvider();
const vfs = create(provider);

vfs.writeFileSync('/config.json', '{"name":"readonly"}\n');
provider.setReadOnly();

await loadConfig(vfs, '/config.json');
await assert.rejects(
  vfs.promises.writeFile('/blocked.json', '{}'),
  { code: 'EROFS' },
);
```

seed済みconfigの読み込みは成功し、新しいファイルへの書き込みは`EROFS`になりました。

### 5. symlinkとwatchを確認する

MemoryProvider内で`/target.json`へのsymlinkを作りました。1回の実行で、`readlink`と`realpath`はいずれも`/target.json`を返し、symlink経由で`{ name: "linked" }`を読み込めました。

watchは5秒の上限を設け、`finally`でcloseするテストにしました。この実行ではtimeoutせず、次の2 eventを受け取りました。

```text
rename renamed.json
rename watched.json
```

これは1回の観測値です。event名、件数、順序が常に同じとは結論づけていません。

### 6. RealFSProviderの境界を確認する

隔離した作業ディレクトリ内の`realfs-root`をproviderのrootにしました。

```js
import { RealFSProvider, create } from 'node:vfs';

const provider = new RealFSProvider(realfsRoot);
const vfs = create(provider);

vfs.writeFileSync('/config.json', '{"name":"realfs"}\n');
vfs.writeFileSync('/../escape.json', '{"name":"escape"}\n');
```

`/config.json`は想定どおり`realfs-root/config.json`へ対応しました。一方、`/../escape.json`はerrorにならず、`realfs-root/escape.json`へ正規化されて作成されました。作業ディレクトリ直下の`escape.json`は作られておらず、今回の入力でprovider root外への書き込みは観測していません。

ただし、テストの期待値は「`..`入力を拒否する」ことでした。実際には受け入れられたため、harnessは`ROOT_ESCAPE_SUSPECTED`を出して即時停止しました。ここでの失敗は、root外へ脱出したという意味ではなく、拒否を期待したassertが満たされなかったという意味です。


### 7. 完全なtest harnessを実行する

実行時は、同じ作業ディレクトリにstep 1の`config-loader.mjs`と次の`verify.mjs`を置きました。`host-fixture`と`realfs-root`はharness内で作成します。次のsourceは実行前に保存したものと同一です。

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { MemoryProvider, RealFSProvider, create } from 'node:vfs';
import { loadConfig } from './config-loader.mjs';

const workDir = process.cwd();

function observed(label, value) {
  console.log(JSON.stringify({ observation: label, ...value }));
}

async function captureError(label, operation) {
  let caught;
  try {
    await operation();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught, `${label} must fail`);
  observed(label, {
    name: caught.name,
    code: caught.code ?? null,
    message: caught.message,
  });
  return caught;
}

test('host baseline: valid, missing, and invalid JSON', async () => {
  const root = path.join(workDir, 'host-fixture');
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, 'config.json'), '{"name":"host"}\n');
  fs.writeFileSync(path.join(root, 'invalid.json'), '{invalid');

  assert.deepEqual(await loadConfig(fs, path.join(root, 'config.json')), { name: 'host' });
  const missing = await captureError('host-missing', () =>
    loadConfig(fs, path.join(root, 'missing.json')),
  );
  assert.equal(missing.code, 'ENOENT');
  const invalid = await captureError('host-invalid-json', () =>
    loadConfig(fs, path.join(root, 'invalid.json')),
  );
  assert.equal(invalid.name, 'SyntaxError');
});

test('MemoryProvider instances are isolated and support sync write plus promise read', async () => {
  const first = create();
  const second = create();
  first.writeFileSync('/config.json', '{"name":"first"}\n');
  assert.deepEqual(await loadConfig(first, '/config.json'), { name: 'first' });
  assert.equal(await first.promises.readFile('/config.json', 'utf8'), '{"name":"first"}\n');

  const missing = await captureError('memory-second-instance-missing', () =>
    loadConfig(second, '/config.json'),
  );
  assert.equal(missing.code, 'ENOENT');
  observed('memory-isolation', { first: 'read-success', second: missing.code });
});

test('MemoryProvider reports invalid JSON and directory-as-file failures', async () => {
  const vfs = create();
  vfs.writeFileSync('/invalid.json', '{invalid');
  vfs.mkdirSync('/directory');

  const invalid = await captureError('memory-invalid-json', () =>
    loadConfig(vfs, '/invalid.json'),
  );
  assert.equal(invalid.name, 'SyntaxError');
  const directory = await captureError('memory-directory-read', () =>
    loadConfig(vfs, '/directory'),
  );
  assert.equal(directory.code, 'EISDIR');
});

test('MemoryProvider becomes irreversibly read-only after seeding', async () => {
  const provider = new MemoryProvider();
  const vfs = create(provider);
  vfs.writeFileSync('/config.json', '{"name":"readonly"}\n');
  provider.setReadOnly();

  assert.deepEqual(await loadConfig(vfs, '/config.json'), { name: 'readonly' });
  const writeError = await captureError('memory-readonly-write', () =>
    vfs.promises.writeFile('/blocked.json', '{}'),
  );
  assert.equal(writeError.code, 'EROFS');
  observed('memory-readonly-read', { result: 'success', readonly: vfs.readonly });
});

test('MemoryProvider supports readlink, realpath, and reading through a symlink', async () => {
  const vfs = create();
  vfs.writeFileSync('/target.json', '{"name":"linked"}\n');
  vfs.symlinkSync('/target.json', '/config-link.json');

  const link = vfs.readlinkSync('/config-link.json');
  const resolved = vfs.realpathSync('/config-link.json');
  const config = await loadConfig(vfs, '/config-link.json');
  assert.equal(link, '/target.json');
  assert.equal(resolved, '/target.json');
  assert.deepEqual(config, { name: 'linked' });
  observed('memory-symlink', { readlink: link, realpath: resolved, config });
});

test('MemoryProvider watch produces bounded raw evidence and closes', async () => {
  const vfs = create();
  vfs.writeFileSync('/watched.json', '{"name":"before"}\n');
  const events = [];
  let timedOut = false;
  let watcher;

  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        timedOut = true;
        resolve();
      }, 5_000);
      watcher = vfs.watch('/', (eventType, filename) => {
        events.push({ eventType, filename: filename?.toString() ?? null });
        if (events.length >= 2) {
          clearTimeout(timer);
          resolve();
        }
      });
      watcher.on('error', reject);
      vfs.writeFileSync('/watched.json', '{"name":"after"}\n');
      vfs.renameSync('/watched.json', '/renamed.json');
    });
  } finally {
    watcher?.close();
  }

  if (timedOut) console.log('WATCH_UNCONFIRMED');
  observed('memory-watch', { events, count: events.length, timedOut, closed: true });
  if (!timedOut) assert.ok(events.length >= 1);
});

test('RealFSProvider maps its root and rejects traversal and an outside symlink', async () => {
  const root = path.join(workDir, 'realfs-root');
  const outsideTraversal = path.join(workDir, 'escape.json');
  const outsideTarget = path.join(workDir, 'outside-target.json');
  const hostLink = path.join(root, 'outside-link.json');
  fs.mkdirSync(root, { recursive: true });
  fs.rmSync(outsideTraversal, { force: true });
  fs.writeFileSync(outsideTarget, '{"name":"outside"}\n');
  fs.rmSync(hostLink, { force: true });

  const provider = new RealFSProvider(root);
  const vfs = create(provider);
  vfs.writeFileSync('/config.json', '{"name":"realfs"}\n');
  assert.deepEqual(await loadConfig(vfs, '/config.json'), { name: 'realfs' });
  assert.equal(fs.readFileSync(path.join(root, 'config.json'), 'utf8'), '{"name":"realfs"}\n');

  let traversalError;
  try {
    vfs.writeFileSync('/../escape.json', '{"name":"escape"}\n');
  } catch (error) {
    traversalError = error;
  }
  observed('realfs-dotdot', {
    rejected: Boolean(traversalError),
    name: traversalError?.name ?? null,
    code: traversalError?.code ?? null,
    message: traversalError?.message ?? null,
  });
  if (!traversalError || fs.existsSync(outsideTraversal)) {
    console.error('ROOT_ESCAPE_SUSPECTED');
    process.exitCode = 70;
    throw new Error('RealFSProvider did not reject the traversal input');
  }

  fs.symlinkSync('../outside-target.json', hostLink);
  let symlinkError;
  try {
    vfs.readFileSync('/outside-link.json', 'utf8');
  } catch (error) {
    symlinkError = error;
  }
  observed('realfs-outside-symlink', {
    rejected: Boolean(symlinkError),
    name: symlinkError?.name ?? null,
    code: symlinkError?.code ?? null,
    message: symlinkError?.message ?? null,
  });
  if (!symlinkError) {
    console.error('ROOT_ESCAPE_SUSPECTED');
    process.exitCode = 71;
    throw new Error('RealFSProvider followed a symlink outside its root');
  }

  observed('realfs-mapping', {
    providerRoot: provider.rootPath,
    vfsPath: '/config.json',
    hostPath: path.join(root, 'config.json'),
  });
});
```

記録された実行では、run directory配下の`work`をcurrent directoryにし、checksumを照合したNode.js binaryで次のcommandを実行しました。

```bash
./node-v26.5.0-darwin-arm64/bin/node --experimental-vfs --test verify.mjs
```

このcommandはexit code 1でした。7つ目のtestで`/../escape.json`が拒否されなかったため、`ROOT_ESCAPE_SUSPECTED`を出してそこで停止する構造です。したがって、その後に書かれたoutside symlinkの処理は実行されず、5回反復も行っていません。

## 観測結果

| ケース | 結果 |
|---|---|
| flag付きimport | pass、exit code 0 |
| flagなしimport | 想定どおり失敗、`ERR_UNKNOWN_BUILTIN_MODULE` |
| hostのvalid / missing / invalid JSON | pass |
| 2つのMemoryProvider-backed VFS | 片方だけ成功、もう片方は`ENOENT` |
| sync write / promise read | pass |
| MemoryProviderのinvalid JSON / directory read | `SyntaxError` / `EISDIR` |
| read-only後のread / write | read成功 / writeは`EROFS` |
| MemoryProvider symlink | pass |
| MemoryProvider watch | timeoutなし、2 event、close済み |
| RealFSProviderの通常mapping | pass |
| RealFSProviderへの`..`入力 | 拒否されず、suite失敗 |

Node.js test runnerの集計は7 tests中6 passed、1 failed、exit code 1でした。実行後にhost上で見つかった`config.json`は、host baseline用とRealFSProvider用の2つだけでした。MemoryProviderへ書いた`/config.json`はhost側に現れませんでした。

## 失敗と対応

最初の問題はDocker pullの停止です。解決を確認できる情報がなかったため、公式のplatform一致archiveをdownloadし、公式checksumと照合して検証を続けました。これにより対象versionは固定できましたが、Linux containerと`--network none`の条件は満たせていません。

次の問題がRealFSProviderの境界テストです。`/../escape.json`は拒否されず、root内の`escape.json`へ正規化されました。追加の攻撃的な試行を避ける停止条件に従い、外部を指すsymlinkの読み込みテストと5回反復は行いませんでした。

## 制限事項

- 結果は公式Node.js v26.5.0 darwin-arm64版での1回の観測です。
- `node:vfs`は実験的機能であり、APIや挙動が変わる可能性があります。
- Linux版の挙動、外部を指すsymlinkの境界、5回反復での安定性は未確認です。
- watchのevent名、件数、順序は一般化できません。
- `..`入力がroot内へ正規化されたことは確認しましたが、これをsecurity sandboxの証明には使えません。
- 小さなfixtureしか実行していないため、host fsとの性能比較はしていません。

## まとめ

同じconfig loaderへfs-like objectを渡す構成にすると、MemoryProvider上でvalid、missing、invalid JSON、instance隔離、read-only、symlink、watchをテストできました。特にfixtureがhost側へ現れなかったことと、別instanceが同じpathの状態を共有しなかったことは、この実行で確認できた利点です。

一方、RealFSProviderへの`..`入力は拒否されず、root内のpathへ正規化されました。RealFSProviderの境界を期待だけで決めず、実際の作成先を検査し、想定と違えば停止するテストが必要だと解釈しています。

## 参考資料

- [Node.js 26.4.0 release](https://nodejs.org/en/blog/release/v26.4.0)（2026-07-11閲覧）
- [Node.js Virtual File System](https://nodejs.org/api/vfs.html)（2026-07-11閲覧）
