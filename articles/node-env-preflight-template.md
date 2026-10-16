---
title: "Node.jsの環境変数ミスを起動前に止める、依存ゼロのTypeScript検査テンプレート"
emoji: "🧰"
type: "tech"
topics: ["nodejs", "typescript", "security", "testing", "configuration"]
published: true
---

`.env` に `PORT=abc` と書いても、TypeScriptの型注釈だけでは実行時の値を検査できません。必須値の欠落やキー名のtypoも、値を使う場所まで進んで初めて発覚しがちです。

この記事では、次の5項目をアプリ本体の開始前に確認する小さなテンプレートを示します。

- 必須値が存在する
- URL、ポート番号、真偽値、列挙値の形式が正しい
- `.env` に未知のキーがない
- 同名の実行時環境変数を `.env` より優先する
- エラー出力へsecret値を含めない

外部パッケージは使いません。Node.js標準の `util.parseEnv()` で `.env` をオブジェクト化し、検査後にreadonly相当の設定オブジェクトへ変換します。

## このテンプレートが合う範囲

対象は、Node.js 24 LTS以降を使う小規模なサービスで、環境変数のschemaがまだ小さい場合です。この記事の実装は、次の5キーへ意図的に固定しています。

| キー | 条件 | 変換後 |
|---|---|---|
| `DATABASE_URL` | 必須の絶対URL | `URL` |
| `PORT` | 1〜65535の10進整数 | `number` |
| `DEBUG` | `true` または `false` | `boolean` |
| `MODE` | `development` / `test` / `production` | union相当 |
| `API_TOKEN` | 必須の空でない文字列 | `string` |

Node.jsのDotEnv utilitiesと `util.parseEnv()` はStableです。`util.parseEnv()` は `.env` 形式の文字列をパースしてオブジェクトを返すため、ここでは値を `process.env` 全体へ投入する前に未知キーと形式を検査します（[Environment Variables](https://nodejs.org/api/environment_variables.html)、[util.parseEnv](https://nodejs.org/api/util.html#utilparseenvcontent)）。

また、Node.jsのTypeScript type strippingは型消去可能な構文を直接実行できますが、型検査は行いません（[Modules: TypeScript](https://nodejs.org/api/typescript.html)）。この記事の実行時検査は、TypeScriptの型検査を置き換えるものではありません。

## `env.ts`：読み込み、検査、正規化を1か所に集める

次を `env.ts` として保存します。

```ts
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';

export type EnvConfig = Readonly<{
  databaseUrl: URL;
  port: number;
  debug: boolean;
  mode: 'development' | 'test' | 'production';
  apiToken: string;
}>;

type RuntimeEnv = Readonly<Record<string, string | undefined>>;
type FailureCase =
  | 'file-read'
  | 'file-parse'
  | 'unknown-file-key'
  | 'missing-required'
  | 'invalid-url'
  | 'invalid-port'
  | 'invalid-boolean'
  | 'invalid-mode';

const schemaKeys = [
  'DATABASE_URL',
  'PORT',
  'DEBUG',
  'MODE',
  'API_TOKEN',
] as const;
const schemaKeySet = new Set<string>(schemaKeys);

function fail(caseName: FailureCase, key: string, expected: string): never {
  throw new Error(`[${caseName}] ${key}: expected ${expected}`);
}

function required(
  values: Readonly<Record<string, string | undefined>>,
  key: (typeof schemaKeys)[number],
): string {
  const value = values[key];
  if (value === undefined || value === '') {
    fail('missing-required', key, 'a non-empty value');
  }
  return value;
}

export function loadConfig(filePath: string, runtime: RuntimeEnv = process.env): EnvConfig {
  let source: string;
  try {
    source = readFileSync(filePath, 'utf8');
  } catch {
    fail('file-read', 'ENV_FILE', 'a readable env file');
  }

  let fileValues: Record<string, string>;
  try {
    fileValues = parseEnv(source);
  } catch {
    fail('file-parse', 'ENV_FILE', 'valid Node.js .env syntax');
  }

  for (const key of Object.keys(fileValues)) {
    if (!schemaKeySet.has(key)) {
      fail('unknown-file-key', key, `one of ${schemaKeys.join(', ')}`);
    }
  }

  const merged: Record<string, string | undefined> = {};
  for (const key of schemaKeys) {
    merged[key] = runtime[key] !== undefined ? runtime[key] : fileValues[key];
  }

  const databaseUrlText = required(merged, 'DATABASE_URL');
  let databaseUrl: URL;
  try {
    databaseUrl = new URL(databaseUrlText);
  } catch {
    fail('invalid-url', 'DATABASE_URL', 'an absolute URL');
  }

  const portText = required(merged, 'PORT');
  if (!/^[0-9]+$/.test(portText)) {
    fail('invalid-port', 'PORT', 'a decimal integer from 1 through 65535');
  }
  const port = Number(portText);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    fail('invalid-port', 'PORT', 'a decimal integer from 1 through 65535');
  }

  const debugText = required(merged, 'DEBUG');
  if (debugText !== 'true' && debugText !== 'false') {
    fail('invalid-boolean', 'DEBUG', 'true or false');
  }

  const modeText = required(merged, 'MODE');
  if (modeText !== 'development' && modeText !== 'test' && modeText !== 'production') {
    fail('invalid-mode', 'MODE', 'development, test, or production');
  }

  const apiToken = required(merged, 'API_TOKEN');
  return Object.freeze({
    databaseUrl,
    port,
    debug: debugText === 'true',
    mode: modeText,
    apiToken,
  });
}

function runCli(): void {
  const filePath = process.argv[2];
  const markerPath = process.argv[3];
  if (filePath === undefined || markerPath === undefined) {
    console.error('[missing-required] CLI_ARGUMENTS: expected env-file and app-start-marker paths');
    process.exitCode = 2;
    return;
  }

  try {
    const config = loadConfig(filePath);
    writeFileSync(markerPath, 'app-started\n', 'utf8');
    console.log(JSON.stringify({
      databaseUrl: config.databaseUrl.href,
      port: config.port,
      debug: config.debug,
      mode: config.mode,
    }));
  } catch (error) {
    console.error(error instanceof Error ? error.message : '[preflight-failure] CONFIG: expected valid configuration');
    process.exitCode = 2;
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli();
}
```

重要なのは、`.env` と実行時環境を別々に扱うことです。

1. 未知キー検査の対象は `fileValues` だけにする
2. mergeするときはschemaにあるキーだけを見る
3. 同名のruntime値が `undefined` でない場合だけ上書きする
4. 検査完了後に型を変換して返す

これにより、`PATH` などOS由来のキーを未知キーとして拒否せず、`.env` 内の `DATABSE_URL` のようなtypoだけを止められます。また、エラー文はcase名、キー名、期待形式だけで組み立て、受け取った値を埋め込みません。

CLI部分は検証用です。設定が正しいときだけapp-start markerを書き、その後にsecretを除いたJSONを出します。サービスへ組み込む場合は、listenや外部接続より前に `loadConfig()` を呼び、その戻り値だけをアプリへ渡します。

## 最小の `.env.example`

ダミー値だけを置いた例です。

```dotenv
DATABASE_URL=https://example.com/app
PORT=3000
DEBUG=false
MODE=development
API_TOKEN=replace-with-a-development-only-dummy
```

## `node:test` で8ケースを固定する

次を `env.test.ts` として `env.ts` と同じディレクトリへ保存します。各ケースは専用ディレクトリを使い、子プロセスの環境も必要な値だけへ絞ります。

```ts
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const tmpRoot = process.env.ENV_PREFLIGHT_TMPDIR;
const evidenceRoot = process.env.ENV_PREFLIGHT_EVIDENCE_DIR;
if (tmpRoot === undefined || evidenceRoot === undefined) {
  throw new Error('test harness directories are required');
}
mkdirSync(tmpRoot, { recursive: true });
mkdirSync(evidenceRoot, { recursive: true });

const cliPath = path.join(import.meta.dirname, 'env.ts');
const canary = ['CANARY', '_SECRET', '_4D91'].join('');
const base = {
  DATABASE_URL: 'https://file.example/app',
  PORT: '3000',
  DEBUG: 'true',
  MODE: 'test',
  API_TOKEN: canary,
};

type SchemaKey = keyof typeof base;
type RunOptions = Readonly<{
  fileValues?: Readonly<Record<string, string>>;
  omit?: SchemaKey;
  runtime?: Readonly<Record<string, string>>;
}>;
type CaseResult = Readonly<{
  exitCode: number | null;
  sanitizedStdout: string;
  sanitizedStderr: string;
  markerExists: boolean;
}>;

function encodeEnv(values: Readonly<Record<string, string>>): string {
  return Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n') + '\n';
}

function runCase(name: string, options: RunOptions = {}): CaseResult {
  const caseDirectory = path.join(tmpRoot, name);
  mkdirSync(caseDirectory, { recursive: false });
  const envPath = path.join(caseDirectory, '.env');
  const markerPath = path.join(caseDirectory, 'app-started.marker');
  const values: Record<string, string> = { ...base, ...options.fileValues };
  if (options.omit !== undefined) delete values[options.omit];
  writeFileSync(envPath, encodeEnv(values), 'utf8');

  const child = spawnSync(
    process.execPath,
    ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', cliPath, envPath, markerPath],
    {
    encoding: 'utf8',
    env: {
      ASTRO_TELEMETRY_DISABLED: '1',
      PATH: '/usr/bin:/bin',
      ...options.runtime,
    },
    },
  );
  if (child.error !== undefined) throw child.error;
  const stdout = child.stdout;
  const stderr = child.stderr;
  assert.equal(stdout.includes(canary), false, `${name}: secret appeared in stdout`);
  assert.equal(stderr.includes(canary), false, `${name}: secret appeared in stderr`);

  const result: CaseResult = {
    exitCode: child.status,
    sanitizedStdout: stdout,
    sanitizedStderr: stderr,
    markerExists: existsSync(markerPath),
  };
  writeFileSync(path.join(evidenceRoot, `${name}.json`), JSON.stringify(result, null, 2) + '\n', 'utf8');
  return result;
}

function assertSafeFailure(
  result: CaseResult,
  key: string,
  expectedText: RegExp,
): void {
  assert.equal(result.exitCode, 2);
  assert.equal(result.markerExists, false);
  assert.equal(result.sanitizedStdout, '');
  assert.match(result.sanitizedStderr, new RegExp(key));
  assert.match(result.sanitizedStderr, expectedText);
}

test('valid-and-runtime-precedence', () => {
  const result = runCase('valid-and-runtime-precedence', { runtime: { PORT: '4100' } });
  assert.equal(result.exitCode, 0);
  assert.equal(result.sanitizedStderr, '');
  assert.equal(result.markerExists, true);
  assert.deepEqual(JSON.parse(result.sanitizedStdout), {
    databaseUrl: 'https://file.example/app',
    port: 4100,
    debug: true,
    mode: 'test',
  });
});

test('missing-required', () => {
  assertSafeFailure(runCase('missing-required', { omit: 'DATABASE_URL' }), 'DATABASE_URL', /non-empty value/);
});

test('invalid-url', () => {
  assertSafeFailure(runCase('invalid-url', { fileValues: { DATABASE_URL: 'not a url' } }), 'DATABASE_URL', /absolute URL/);
});

test('port-zero', () => {
  assertSafeFailure(runCase('port-zero', { fileValues: { PORT: '0' } }), 'PORT', /1 through 65535/);
});

test('port-overflow', () => {
  assertSafeFailure(runCase('port-overflow', { fileValues: { PORT: '65536' } }), 'PORT', /1 through 65535/);
});

test('port-nonnumeric', () => {
  assertSafeFailure(runCase('port-nonnumeric', { fileValues: { PORT: 'three-thousand' } }), 'PORT', /decimal integer/);
});

test('unknown-file-key-but-os-path-allowed', () => {
  const fileValues: Record<string, string> = { ...base, DATABSE_URL: base.DATABASE_URL };
  delete fileValues.DATABASE_URL;
  const result = runCase('unknown-file-key-but-os-path-allowed', {
    fileValues,
    omit: 'DATABASE_URL',
  });
  assertSafeFailure(result, 'DATABSE_URL', /one of DATABASE_URL/);
  assert.equal(result.sanitizedStdout.includes('PATH'), false);
  assert.equal(result.sanitizedStderr.includes('PATH'), false);
  assert.equal(result.sanitizedStdout.includes('/usr/bin:/bin'), false);
  assert.equal(result.sanitizedStderr.includes('/usr/bin:/bin'), false);
});

test('secret-redaction-on-failure', () => {
  assertSafeFailure(runCase('secret-redaction-on-failure', { fileValues: { PORT: 'invalid' } }), 'PORT', /decimal integer/);
});
```

canaryは完成文字列をsourceへ直書きせず、メモリ上で組み立てます。stdoutとstderrを保存する前に値一致で検査するため、漏えいした本文を証拠ファイルへ追加保存しません。

## 検証した実行方法

検証ではNode.js公式配布archiveを作業ディレクトリ内へ展開し、SHA-256を公式の `SHASUMS256.txt` と照合しました。公式index上で、対象はv24.22.0 LTSとv26.12.0 Currentでした（[Node.js distribution index](https://nodejs.org/dist/index.json)、[v24.22.0 release](https://nodejs.org/en/blog/release/v24.22.0)）。

各versionで使った最終的なコマンド形式は次のとおりです。`NODE_BIN` は対象versionのbinary、`CASE_TMP` と `CASE_EVIDENCE` は空のversion別ディレクトリです。

```sh
ASTRO_TELEMETRY_DISABLED=1 \
ENV_PREFLIGHT_TMPDIR="$CASE_TMP" \
ENV_PREFLIGHT_EVIDENCE_DIR="$CASE_EVIDENCE" \
  "$NODE_BIN" --test --test-concurrency=1 --test-reporter=tap env.test.ts > "evidence/tests-$VERSION.tap" 2>&1
test_status=$?
printf '%s\n' "$test_status" > "evidence/tests-$VERSION.exit"
```

同じcase名だけを比較するため、TAPからdurationなどを除いて正規化しました。

```sh
sed -E -n 's/^[[:space:]]*(ok|not ok)[[:space:]]+[0-9]+[[:space:]]+-[[:space:]]+/\1 /p' "evidence/tests-$VERSION.tap" > "evidence/tests-$VERSION-cases.txt"
diff -u evidence/tests-v24.22.0-cases.txt evidence/tests-v26.12.0-cases.txt > evidence/version-case-diff.txt
```

### 実測結果

検証環境はDarwin arm64です。公式checksumを通したv24.22.0とv26.12.0で、`util.parseEnv()` と同じ `api-gate.ts` の直接実行を先に確認しました。その後、同じ `env.ts` と `env.test.ts` を両方で実行しています。

| 検証項目 | v24.22.0 LTS | v26.12.0 Current |
|---|---:|---:|
| 全テスト | 8 passed / 0 failed | 8 passed / 0 failed |
| suite終了code | 0 | 0 |
| 正規化したcase差分 | なし | なし |

正常ケースでは、`PORT=3000` をfileへ置き、runtime側の `PORT=4100` だけを優先しました。出力は次の値になり、`API_TOKEN` は含まれませんでした。

```json
{
  "databaseUrl": "https://file.example/app",
  "port": 4100,
  "debug": true,
  "mode": "test"
}
```

失敗ケースの観測結果は次のとおりです。

| ケース | 観測結果 |
|---|---|
| 必須URL欠落 | exit 2、markerなし、stdoutなし |
| 不正URL | exit 2、markerなし、stdoutなし |
| port `0` | exit 2、markerなし、stdoutなし |
| port `65536` | exit 2、markerなし、stdoutなし |
| 非数port | exit 2、markerなし、stdoutなし |
| `.env` の `DATABSE_URL` | 未知キーとしてexit 2、`PATH` とその値は出力なし |
| 別項目を失敗させたsecret redaction | exit 2、markerなし、保存証拠のcanary一致0件 |

最終資産のSHA-256は次のとおりです。記事からコピーしたファイルを、検証対象と照合したい場合に使えます。

```text
318e31b1738e1ae6bd3e2990eac13c8fae9b91303f453759f9f4aad4654e4f74  env.ts
5b195ab765e2793ffd09a1a1a76e0786b1ef2cc86c069867ed726d4c45c8c3f0  env.test.ts
d6775b466834389292ea20cb4d386b0c8110994cf5e51ea2bf39f679700fda41  .env.example
0d910b5a2f3854a51ce0c73142ce40443445feb6399d8eab9e1747766a0b5e35  schema-checklist.md
```

## 検証中に直した2つの移植性問題

最初のtest loopでは、終了codeを `status=$?` へ保存しようとしてzshの `read-only variable: status` で停止しました。`status` はzshの特殊parameterなので、最終形ではローカル変数を `test_status` に変更しています。shellをまたぐスクリプトでは、一般的な名前でも予約済みかを意識する必要があります。

もう1つは、`.ts` の直接実行時に有効な子プロセスのstderrへ `MODULE_TYPELESS_PACKAGE_JSON` warningが出たことです。検査対象のstderrとwarningを混ぜないよう、子プロセスだけへ `--disable-warning=MODULE_TYPELESS_PACKAGE_JSON` を渡しました。また、比較可能な出力を得るためtest reporterを明示的にTAPへ固定しました。package、transpiler、`package.json` は追加していません。

## 自分のschemaへ移植するチェックリスト

次を `schema-checklist.md` として使えます。

```md
# Environment schema adoption checklist

- [ ] List every key added to or removed from the schema.
- [ ] Decide whether each key is required or optional.
- [ ] Document each string-to-runtime-type conversion rule.
- [ ] Set and test every numeric or string allow-list range.
- [ ] Decide whether the runtime environment overrides file values.
- [ ] Reject unknown file keys while ignoring unrelated runtime keys.
- [ ] Mark secret-bearing keys and keep their values out of output.
- [ ] Confirm failure happens before the app-start marker is created.
- [ ] Add a redaction test with a recognizable in-memory canary.
- [ ] Record and test every supported Node.js version.
```

schemaを変更するときは、`schemaKeys`、`EnvConfig`、変換処理、正常・失敗testを一緒に変更します。特にoptional値、default値、数値範囲を暗黙に決めず、testへ境界値を追加するのが重要です。

## 専用ライブラリへ移る境界

このテンプレートは固定した5キーを明示的に検査するため、挙動を追いやすい反面、汎用validatorではありません。次の条件が増えたら、ZodやEnvalidなどの専用ライブラリを比較する方が保守しやすくなります。

- nestedな設定や相互依存する条件が多い
- default値や変換規則を多数持つ
- 複数サービスでschemaを共有する
- エラーを集約して一度に表示したい
- 既にプロジェクト標準のvalidatorがある

判断の軸は「依存がゼロか」だけではありません。schema変更時にtestと実装を確実に同期できるか、チームが失敗メッセージとsecretの扱いをレビューできるかも含めて選びます。

## 限界

- 実測したのはDarwin arm64上のv24.22.0とv26.12.0だけです。他のOS、architecture、Node.js versionの互換性は確認していません。
- native TypeScriptはtype strippingであり、静的型検査ではありません。別途型検査が必要です。
- `Object.freeze()` はshallowです。返した `URL` object自体を意図的に変更することまでは防ぎません。
- secret canaryが今回のstdout、stderr、保存証拠へ出ないことは確認しましたが、あらゆるログ経路や将来の変更を保証するものではありません。
- この固定schemaの結果から、一般的なvalidation性能、障害削減率、セキュリティ保証は導けません。

小さなサービスなら、まず「読む」「検査する」「正規化した値だけを渡す」を1か所へ集めるだけでも、設定の境界が明確になります。この記事の8ケースを自分のschemaに合わせて維持できるかどうかが、この依存ゼロテンプレートを採用する目安です。
