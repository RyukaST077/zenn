---
title: "Node.jsの依存脆弱性検査をnpm audit・OSV-Scannerから選ぶ"
emoji: "🔐"
type: "tech"
topics: ["security", "nodejs", "npm", "cli", "supplychain"]
published: false
---

Node.jsプロジェクトの依存脆弱性検査をCIへ入れるとき、`npm audit`だけでよいのか、OSV-Scannerを使うのか、両方を動かすのかは悩みどころです。

そこで、固定した脆弱版・修正版のlockfileをnpm 12.2.3とOSV-Scanner 2.7.1で走査しました。npm、pnpm、Yarnのlockfile対応、JSONのfinding、終了コード、壊れた入力や通信失敗も比較しています。

先に結論を書くと、選択の起点は次の3つです。

| 条件 | 選択候補 | 今回の実測に基づく理由 |
|---|---|---|
| npmの`package-lock.json`を使い、severity thresholdをCIの終了条件にしたい | `npm audit` | npmだけでJSONとthreshold別の終了コードを取得できた |
| `pnpm-lock.yaml`や`yarn.lock`も同じCLIで走査したい | OSV-Scanner | OSV-Scannerは試した3形式すべてでfindingを返した。npm auditはpnpm/Yarnだけのディレクトリで明示的に失敗した |
| advisory sourceの差も観測したい | 併用 | 別々の出力をpackageとadvisory aliasで正規化できる。ただし運用コストが増える |

ただし、今回の同一`package-lock.json`では正規化後の30件がすべて両者共通で、片方だけのfindingは0件でした。併用すれば常に追加の脆弱性が見つかる、という結果ではありません。

## 検証条件

実行日時は2026-11-20、環境はDarwin arm64です。使用したバージョンは次のとおりです。

| 項目 | バージョン |
|---|---|
| Node.js | v26.13.1 |
| npm | 12.2.3 |
| pnpm | 11.10.0 |
| Yarn | 1.22.22 |
| OSV-Scanner | 2.7.1 |

Node.jsの公式archive、npmのregistry tarball、OSV-Scannerの公式release assetは、それぞれ公式のchecksumまたはSRIと照合しました。依存のinstall scriptは無効にし、ツール、キャッシュ、設定、fixtureは隔離した作業ディレクトリへ置いています。

主なfixtureは次の2つです。

```json:脆弱版package.json
{
  "name": "vulnerable",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "lodash": "4.17.20",
    "minimist": "0.2.0",
    "axios": "0.21.1"
  }
}
```

```json:修正版候補package.json
{
  "name": "clean",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "lodash": "4.18.1",
    "minimist": "1.2.8",
    "axios": "1.21.1"
  }
}
```

後者を事前に「安全」と決めたのではなく、両scannerで0件かつ終了コード0になったことを確認して、この記事ではclean controlと呼んでいます。

`npm audit`はregistryへ依存情報を送り、既知の脆弱性レポートを得る仕組みです。また、`--audit-level`はレポートの表示内容を絞るのではなく、失敗させるseverityの下限を変えます。詳細は[npm audit公式ドキュメント](https://docs.npmjs.com/cli/audit/)にあります。

OSV-ScannerはOSV databaseを利用するscannerです。v2のlockfile指定は`scan -L ... --format json`で、対応形式には`package-lock.json`、`pnpm-lock.yaml`、`yarn.lock`などが明記されています。詳細は[OSV-Scannerのusage](https://google.github.io/osv-scanner/usage/)と[対応lockfile一覧](https://google.github.io/osv-scanner/supported-languages-and-lockfiles/)を参照してください。

## 同じpackage-lock.jsonでは両者のadvisoryが重なった

脆弱版の同じ`package-lock.json`に対し、次の2コマンドを実行しました。

```bash
npm audit --json
osv-scanner scan -L package-lock.json --format json
```

観測結果は次のとおりです。

| scanner | 終了コード | 生の集計単位 |
|---|---:|---:|
| npm audit | 1 | 脆弱なpackage 3件 |
| OSV-Scanner | 1 | vulnerability record 30件 |

この2つの件数は、そのまま比較できません。npm側はpackageを単位にした出力を含み、OSV側はvulnerability recordを返すためです。そこで、保存済みの両JSONと同じ`package-lock.json`を入力にし、packageごとにGHSA、CVE、OSVのalias集合を大文字へ正規化して照合しました。さらに、lockfileから解決したversionをnpm advisory rangeとOSVのnpm `affected` rangeへ個別に照合しました。

正規化後は次の結果でした。

| 分類 | 件数 |
|---|---:|
| 両者共通 | 30 |
| npmのみ | 0 |
| OSVのみ | 0 |
| npm range外 / 判定不能 | 0 / 0 |
| OSV range外 / 判定不能 | 0 / 0 |
| alias未解決 | 0 |

lockfileで解決されたversionはaxios `0.21.1`、lodash `4.17.20`、minimist `0.2.0`です。npm 12.2.3同梱の`semver@7.8.6`で、保存済みnpm advisory 30件のrangeと、対応するOSVのnpm `affected` 30件を評価したところ、両側とも30件すべてがrange内でした。`false`と`unknown`を分けて数え、どちらも0件です。

この値には訂正経緯があります。最初の比較結果にあった「range外0件」は、旧normalizerがversionとrangeを代入しておらず、測定値ではありませんでした。上表の0件は、その後に同じ保存済み入力をhash照合し、全30行へ`installedVersion`、`npmRange`、`osvAffectedIntervals`、両側の判定値を出した補足検証だけに基づきます。

実データのOSV rangeに現れたのは`introduced` / `fixed`です。`last_affected`、`limit`、open interval、複数interval、unsupported typeは11件の固定synthetic boundary caseで検証し、122件の実データ境界caseと合わせて133件がpassしました。synthetic caseはadvisory件数へ混ぜていません。

このsnapshotでは30件が完全に重なりました。ただし、advisory databaseは更新されます。今回の一致から、2つのdatabaseが恒常的に同じ、または一方が不要だとは判断できません。件数の多さも製品の優劣や安全性の順位には使えません。

## 保存済みsnapshotのrange・alias比較を再現する

補足検証はscannerを再実行せず、元の観測windowで保存したJSONとlockfileをhash照合して使いました。入力のSHA-256はnpm JSONが`c6f84dc3d1d6032c7ecd3d5ce36207187253d6bbc90d63f9eca17fcdb811de36`、OSV JSONが`2178badc1353051cf31b098f787379efe17814b71a6fcc9c3ba2c2eef808684d`、lockfileが`cb06593380cf3402cd08ad5397dc5ac42e46d3623afa15c03193f810ebc056c4`です。

実行時は、後掲のfull reproductionと同じ公式Node.js v26.13.1 archiveとnpm 12.2.3 tarballをchecksum/SRI照合して作業ディレクトリへ展開し、npm同梱の`semver@7.8.6`を絶対pathから読み込みました。保存済み入力を次のlayoutへ置き、出力先を指定します。

```text
input/
└── old-run/evidence/
    ├── raw/v1-npm-audit.json
    ├── raw/v1-osv.json
    └── fixtures/npm-vulnerable/package-lock.json
```

実際の呼び出しは次の形です。`<absolute-npm-root>`はchecksum確認済みnpm 12.2.3の展開rootです。

```bash
node inline-range-check.mjs input <absolute-npm-root> results
cat results/range-verification.json
```

以下は省略していない実行済みcheckerです。OSVはmatching npm entryだけを対象にし、explicit `versions`と全SEMVER intervalをOR結合します。不正・未対応・欠落は`false`ではなく`unknown`です。

```js:inline-range-check.mjs
#!/usr/bin/env node
// Complete invocation for this saved snapshot:
// node inline-range-check.mjs <input-dir> <absolute-npm-root> <output-dir>
// input-dir must contain old-run/evidence/raw/v1-{npm-audit,osv}.json and
// old-run/evidence/fixtures/npm-vulnerable/package-lock.json. npm-root must be
// the checksum-verified, extracted npm 12.2.3 tree; its bundled semver is used.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const [inputArgument, npmRootArgument, outputArgument] = process.argv.slice(2);
if (!inputArgument || !npmRootArgument || !outputArgument) {
  throw new Error('usage: node inline-range-check.mjs <input-dir> <absolute-npm-root> <output-dir>');
}
const inputDir = path.resolve(inputArgument);
const npmRoot = path.resolve(npmRootArgument);
const outputDir = path.resolve(outputArgument);
if (!path.isAbsolute(npmRootArgument)) throw new Error('npm-root must be absolute');

const semverEntry = path.join(npmRoot, 'node_modules', 'semver', 'index.js');
const semverPackagePath = path.join(npmRoot, 'node_modules', 'semver', 'package.json');
const require = createRequire(import.meta.url);
const semver = require(semverEntry);
const semverPackage = JSON.parse(fs.readFileSync(semverPackagePath, 'utf8'));
if (typeof semver.validRange !== 'function' || typeof semver.satisfies !== 'function') {
  throw new Error('bundled semver API unavailable');
}

const source = {
  npm: path.join(inputDir, 'old-run/evidence/raw/v1-npm-audit.json'),
  osv: path.join(inputDir, 'old-run/evidence/raw/v1-osv.json'),
  lock: path.join(inputDir, 'old-run/evidence/fixtures/npm-vulnerable/package-lock.json'),
};
for (const file of Object.values(source)) {
  if (!fs.statSync(file).isFile()) throw new Error(`missing input: ${file}`);
}
const npmAudit = JSON.parse(fs.readFileSync(source.npm, 'utf8'));
const osvScan = JSON.parse(fs.readFileSync(source.osv, 'utf8'));
const lockfile = JSON.parse(fs.readFileSync(source.lock, 'utf8'));

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function normalizeAlias(value) {
  const alias = String(value ?? '').trim().toUpperCase();
  return /^(GHSA|CVE|OSV)-[A-Z0-9-]+$/.test(alias) ? alias : null;
}

function aliasesFromNpmAdvisory(advisory) {
  const values = [];
  for (const candidate of [advisory.id, advisory.url, advisory.source]) {
    const text = String(candidate ?? '');
    const matches = text.match(/(?:GHSA|CVE|OSV)-[A-Za-z0-9-]+/gi) ?? [];
    values.push(...matches);
  }
  return [...new Set(values.map(normalizeAlias).filter(Boolean))].sort();
}

function triOr(values) {
  if (values.includes(true)) return true;
  if (values.includes('unknown')) return 'unknown';
  return false;
}

function parseOsvRange(range) {
  if (range?.type !== 'SEMVER') {
    return { status: 'unknown', reason: `unsupported range type: ${range?.type ?? 'missing'}`, intervals: [] };
  }
  if (!Array.isArray(range.events) || range.events.length === 0) {
    return { status: 'unknown', reason: 'missing SEMVER events', intervals: [] };
  }
  const intervals = [];
  let current = null;
  for (const event of range.events) {
    const keys = Object.keys(event);
    if (keys.length !== 1 || !['introduced', 'fixed', 'last_affected', 'limit'].includes(keys[0])) {
      return { status: 'unknown', reason: 'unsupported or ambiguous event', intervals: [] };
    }
    const kind = keys[0];
    const version = String(event[kind]);
    if (kind === 'introduced') {
      if (current !== null) return { status: 'unknown', reason: 'introduced before previous interval closed', intervals: [] };
      if (version !== '0' && !semver.valid(version)) {
        return { status: 'unknown', reason: `invalid introduced version: ${version}`, intervals: [] };
      }
      current = { introduced: version === '0' ? null : version, upper: null, upperKind: null, upperInclusive: null };
      continue;
    }
    if (current === null) return { status: 'unknown', reason: `${kind} without introduced`, intervals: [] };
    if (!semver.valid(version)) return { status: 'unknown', reason: `invalid ${kind} version: ${version}`, intervals: [] };
    current.upper = version;
    current.upperKind = kind;
    current.upperInclusive = kind === 'last_affected';
    intervals.push(current);
    current = null;
  }
  if (current !== null) intervals.push(current);
  return { status: 'ok', reason: null, intervals };
}

function evaluateInterval(version, interval) {
  if (!semver.valid(version)) return 'unknown';
  if (interval.introduced !== null && !semver.gte(version, interval.introduced)) return false;
  if (interval.upper === null) return true;
  return interval.upperInclusive ? semver.lte(version, interval.upper) : semver.lt(version, interval.upper);
}

function evaluateParsedRange(version, parsed) {
  if (parsed.status !== 'ok') return 'unknown';
  return triOr(parsed.intervals.map((interval) => evaluateInterval(version, interval)));
}

function evaluateAffected(version, affectedEntries, packageName) {
  const matching = affectedEntries.filter((entry) => entry?.package?.ecosystem === 'npm' && entry?.package?.name === packageName);
  if (matching.length === 0) {
    return { value: 'unknown', intervals: [], reasons: ['no matching npm affected entry'] };
  }
  const values = [];
  const intervals = [];
  const reasons = [];
  for (const affected of matching) {
    let hadSupportedData = false;
    if (Array.isArray(affected.versions) && affected.versions.length > 0) {
      hadSupportedData = true;
      const validVersions = affected.versions.filter((item) => semver.valid(item));
      if (validVersions.length !== affected.versions.length) {
        values.push('unknown');
        reasons.push('invalid explicit version');
      } else {
        values.push(validVersions.some((item) => semver.eq(version, item)));
      }
    }
    for (const range of affected.ranges ?? []) {
      hadSupportedData = true;
      const parsed = parseOsvRange(range);
      intervals.push(...parsed.intervals);
      values.push(evaluateParsedRange(version, parsed));
      if (parsed.reason) reasons.push(parsed.reason);
    }
    if (!hadSupportedData) {
      values.push('unknown');
      reasons.push('affected entry has neither versions nor ranges');
    }
  }
  return { value: triOr(values), intervals, reasons: [...new Set(reasons)] };
}

const directDependencies = lockfile.packages?.['']?.dependencies;
if (!directDependencies || Object.keys(directDependencies).length !== 3) {
  throw new Error('fixture must have exactly three direct dependencies');
}
const installedVersions = {};
for (const packageName of Object.keys(directDependencies).sort()) {
  const versions = new Set();
  for (const [packagePath, metadata] of Object.entries(lockfile.packages ?? {})) {
    if (!packagePath || !metadata?.version) continue;
    const inferredName = metadata.name ?? packagePath.split('node_modules/').at(-1);
    if (inferredName === packageName) versions.add(metadata.version);
  }
  if (versions.size !== 1) throw new Error(`missing or multiple lockfile versions for ${packageName}`);
  const [version] = versions;
  if (!semver.valid(version)) throw new Error(`invalid installed version for ${packageName}: ${version}`);
  installedVersions[packageName] = version;
}

const npmTransitions = [];
const npmRows = [];
for (const [packageName, vulnerability] of Object.entries(npmAudit.vulnerabilities ?? {})) {
  if (!(packageName in installedVersions)) throw new Error(`npm vulnerability is not a direct fixture dependency: ${packageName}`);
  for (const via of vulnerability.via ?? []) {
    if (typeof via === 'string') {
      npmTransitions.push({ package: packageName, viaPackage: via });
      continue;
    }
    const validRange = semver.validRange(via.range);
    if (validRange === null) throw new Error(`invalid npm advisory range for ${packageName}: ${via.range}`);
    npmRows.push({
      source: 'npm',
      package: packageName,
      id: aliasesFromNpmAdvisory(via)[0] ?? `NPM-SOURCE-${via.source}`,
      aliases: aliasesFromNpmAdvisory(via),
      npmRange: via.range,
      installedVersion: installedVersions[packageName],
      npmInRange: semver.satisfies(installedVersions[packageName], validRange),
      sourceNumber: via.source,
      title: via.title,
    });
  }
}

const osvRows = [];
for (const result of osvScan.results ?? []) {
  for (const packageRecord of result.packages ?? []) {
    const packageName = packageRecord?.package?.name;
    if (!(packageName in installedVersions)) throw new Error(`OSV package is not a direct fixture dependency: ${packageName}`);
    if (packageRecord.package.ecosystem !== 'npm') throw new Error(`OSV parent ecosystem mismatch for ${packageName}`);
    if (packageRecord.package.version !== installedVersions[packageName]) throw new Error(`OSV/lock version mismatch for ${packageName}`);
    for (const vulnerability of packageRecord.vulnerabilities ?? []) {
      const aliases = [...new Set([vulnerability.id, ...(vulnerability.aliases ?? [])].map(normalizeAlias).filter(Boolean))].sort();
      const evaluation = evaluateAffected(installedVersions[packageName], vulnerability.affected ?? [], packageName);
      osvRows.push({
        source: 'osv',
        package: packageName,
        id: normalizeAlias(vulnerability.id) ?? vulnerability.id,
        aliases,
        installedVersion: installedVersions[packageName],
        osvAffectedIntervals: evaluation.intervals,
        osvInRange: evaluation.value,
        osvRangeReasons: evaluation.reasons,
      });
    }
  }
}

const comparisonRows = [];
const consumedOsv = new Set();
for (const npmRow of npmRows) {
  if (npmRow.aliases.length === 0) {
    comparisonRows.push({ ...npmRow, classification: 'unresolved', osvAffectedIntervals: null, osvInRange: null, unresolvedReason: 'npm advisory has no normalized alias' });
    continue;
  }
  const candidates = osvRows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.package === npmRow.package && row.aliases.some((alias) => npmRow.aliases.includes(alias)));
  if (candidates.length === 1) {
    const { row: osvRow, index } = candidates[0];
    consumedOsv.add(index);
    comparisonRows.push({
      package: npmRow.package,
      canonicalId: npmRow.aliases.find((alias) => osvRow.aliases.includes(alias)),
      npmAliases: npmRow.aliases,
      osvAliases: osvRow.aliases,
      classification: 'common',
      npmRange: npmRow.npmRange,
      osvAffectedIntervals: osvRow.osvAffectedIntervals,
      installedVersion: npmRow.installedVersion,
      npmInRange: npmRow.npmInRange,
      osvInRange: osvRow.osvInRange,
      osvRangeReasons: osvRow.osvRangeReasons,
    });
  } else if (candidates.length === 0) {
    comparisonRows.push({
      package: npmRow.package,
      canonicalId: npmRow.id,
      npmAliases: npmRow.aliases,
      osvAliases: [],
      classification: 'npm-only',
      npmRange: npmRow.npmRange,
      osvAffectedIntervals: null,
      installedVersion: npmRow.installedVersion,
      npmInRange: npmRow.npmInRange,
      osvInRange: null,
    });
  } else {
    comparisonRows.push({ ...npmRow, classification: 'unresolved', osvAffectedIntervals: null, osvInRange: null, unresolvedReason: 'multiple OSV alias matches' });
  }
}
for (const [index, osvRow] of osvRows.entries()) {
  if (consumedOsv.has(index)) continue;
  comparisonRows.push({
    package: osvRow.package,
    canonicalId: osvRow.id,
    npmAliases: [],
    osvAliases: osvRow.aliases,
    classification: osvRow.aliases.length > 0 ? 'osv-only' : 'unresolved',
    npmRange: null,
    osvAffectedIntervals: osvRow.osvAffectedIntervals,
    installedVersion: osvRow.installedVersion,
    npmInRange: null,
    osvInRange: osvRow.osvInRange,
    osvRangeReasons: osvRow.osvRangeReasons,
  });
}
comparisonRows.sort((left, right) => `${left.package}:${left.canonicalId}`.localeCompare(`${right.package}:${right.canonicalId}`));

const actualOsvBoundaryTests = [];
for (const row of osvRows) {
  for (const [index, interval] of row.osvAffectedIntervals.entries()) {
    if (interval.introduced !== null) {
      actualOsvBoundaryTests.push({
        name: `${row.package}:${row.id}:interval-${index}:introduced-inclusive`,
        kind: 'actual-osv-introduced',
        input: interval.introduced,
        expected: true,
        actual: evaluateInterval(interval.introduced, interval),
      });
    }
    if (interval.upper !== null) {
      actualOsvBoundaryTests.push({
        name: `${row.package}:${row.id}:interval-${index}:${interval.upperKind}`,
        kind: `actual-osv-${interval.upperKind}`,
        input: interval.upper,
        expected: interval.upperInclusive,
        actual: evaluateInterval(interval.upper, interval),
      });
    } else {
      const probe = semver.inc(interval.introduced ?? '0.0.0', 'major');
      actualOsvBoundaryTests.push({
        name: `${row.package}:${row.id}:interval-${index}:open-upper`,
        kind: 'actual-osv-open-upper',
        input: probe,
        expected: true,
        actual: evaluateInterval(probe, interval),
      });
    }
  }
}

const actualNpmBoundaryTests = [];
for (const row of npmRows) {
  const parsedRange = new semver.Range(row.npmRange);
  for (const comparatorSet of parsedRange.set) {
    for (const comparator of comparatorSet) {
      if (!comparator.value) continue;
      const operator = comparator.operator || '=';
      const boundary = comparator.semver.version;
      const expected = operator === '>=' || operator === '<=' || operator === '=';
      actualNpmBoundaryTests.push({
        name: `${row.package}:${row.id}:${operator}${boundary}`,
        kind: 'actual-npm-comparator-boundary',
        sourceRange: row.npmRange,
        input: boundary,
        expected,
        actual: semver.satisfies(boundary, `${operator}${boundary}`),
      });
    }
  }
}

function evaluateSynthetic(events, version, type = 'SEMVER') {
  return evaluateParsedRange(version, parseOsvRange({ type, events }));
}
const fixedBoundaryTests = [
  { name: 'npm-lower-inclusive', expected: true, actual: semver.satisfies('1.0.0', '>=1.0.0 <2.0.0') },
  { name: 'npm-upper-exclusive', expected: false, actual: semver.satisfies('2.0.0', '>=1.0.0 <2.0.0') },
  { name: 'osv-introduced-zero-before-fixed', expected: true, actual: evaluateSynthetic([{ introduced: '0' }, { fixed: '1.0.0' }], '0.9.9') },
  { name: 'osv-fixed-exclusive', expected: false, actual: evaluateSynthetic([{ introduced: '0' }, { fixed: '1.0.0' }], '1.0.0') },
  { name: 'osv-last-affected-inclusive', expected: true, actual: evaluateSynthetic([{ introduced: '0' }, { last_affected: '1.0.0' }], '1.0.0') },
  { name: 'osv-limit-exclusive', expected: false, actual: evaluateSynthetic([{ introduced: '0' }, { limit: '1.0.0' }], '1.0.0') },
  { name: 'osv-open-interval', expected: true, actual: evaluateSynthetic([{ introduced: '1.0.0' }], '9.0.0') },
  { name: 'osv-multiple-interval-first', expected: true, actual: evaluateSynthetic([{ introduced: '0' }, { fixed: '1.0.0' }, { introduced: '2.0.0' }, { fixed: '3.0.0' }], '0.5.0') },
  { name: 'osv-multiple-interval-gap', expected: false, actual: evaluateSynthetic([{ introduced: '0' }, { fixed: '1.0.0' }, { introduced: '2.0.0' }, { fixed: '3.0.0' }], '1.5.0') },
  { name: 'osv-multiple-interval-second', expected: true, actual: evaluateSynthetic([{ introduced: '0' }, { fixed: '1.0.0' }, { introduced: '2.0.0' }, { fixed: '3.0.0' }], '2.5.0') },
  { name: 'osv-unsupported-type-unknown', expected: 'unknown', actual: evaluateSynthetic([{ introduced: '0' }], '1.0.0', 'ECOSYSTEM') },
];
const boundaryTests = [...fixedBoundaryTests, ...actualNpmBoundaryTests, ...actualOsvBoundaryTests];
for (const test of boundaryTests) {
  test.passed = test.actual === test.expected;
}

const counts = {
  common: comparisonRows.filter((row) => row.classification === 'common').length,
  npmOnly: comparisonRows.filter((row) => row.classification === 'npm-only').length,
  osvOnly: comparisonRows.filter((row) => row.classification === 'osv-only').length,
  unresolved: comparisonRows.filter((row) => row.classification === 'unresolved').length,
  npmOutOfRange: comparisonRows.filter((row) => row.npmInRange === false).length,
  osvOutOfRange: comparisonRows.filter((row) => row.osvInRange === false).length,
  npmUnknown: comparisonRows.filter((row) => row.npmInRange === 'unknown').length,
  osvUnknown: comparisonRows.filter((row) => row.osvInRange === 'unknown').length,
};
const verification = {
  schemaVersion: 1,
  sourceSnapshot: 'run-npm-audit-osv-scanner-20261120T001419Z',
  directDependencyCount: Object.keys(directDependencies).length,
  installedVersions,
  npmAdvisoryCount: npmRows.length,
  npmTransitionCount: npmTransitions.length,
  osvVulnerabilityCount: osvRows.length,
  comparisonRowCount: comparisonRows.length,
  counts,
  boundaryTestCount: boundaryTests.length,
  boundaryTestsPassed: boundaryTests.every((test) => test.passed),
  contractSatisfied:
    comparisonRows.length >= 3 &&
    counts.unresolved === 0 &&
    counts.npmUnknown === 0 &&
    counts.osvUnknown === 0 &&
    boundaryTests.every((test) => test.passed),
  correction: 'The old finding-matrix out-of-range=0 was an unimplemented placeholder; only this executed matrix supplies range evidence.',
  scope: 'Saved release-version fixture snapshot only; no guarantee for other versions or future advisory database states.',
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'comparison-matrix.json'), JSON.stringify(comparisonRows, null, 2) + '\n');
fs.writeFileSync(path.join(outputDir, 'range-verification.json'), JSON.stringify(verification, null, 2) + '\n');
fs.writeFileSync(path.join(outputDir, 'boundary-tests.json'), JSON.stringify(boundaryTests, null, 2) + '\n');
fs.writeFileSync(path.join(outputDir, 'npm-transition-via.json'), JSON.stringify(npmTransitions, null, 2) + '\n');
fs.writeFileSync(path.join(outputDir, 'input-tool-sha256.json'), JSON.stringify({
  inputs: Object.fromEntries(Object.entries(source).map(([name, file]) => [name, { path: file, sha256: sha256(file) }])),
  npmVersion: '12.2.3',
  semverVersion: semverPackage.version,
  semverEntry,
  semverPackageJsonSha256: sha256(semverPackagePath),
  scriptSha256: sha256(new URL(import.meta.url)),
}, null, 2) + '\n');
console.log(JSON.stringify(verification));
if (!verification.contractSatisfied) process.exitCode = 2;
```

このcheckerは同じ入力で再実行し、5つのJSON出力がbyte単位で一致しました。別validatorも固定11件と実データ由来122件の境界期待値を検査し、`contractSatisfied: true`になっています。なお、この再現は保存済みsnapshotのrange判定用です。現在のadvisory databaseへ再問い合わせする手順ではありません。


## pnpmとYarnのlockfileを扱うならOSV-Scannerが選択肢になる

同じdirect dependencyとして`lodash@4.17.20`を指定し、npm、pnpm、Yarnでそれぞれlockfileを生成しました。各ディレクトリに両scannerを実行した結果です。

| lockfile | npm audit | OSV-Scanner |
|---|---|---|
| `package-lock.json` | findingあり、exit 1 | 4 findings、exit 1 |
| `pnpm-lock.yaml` | 明示的失敗、exit 1 | 4 findings、exit 1 |
| `yarn.lock` | 明示的失敗、exit 1 | 4 findings、exit 1 |

pnpm/Yarnのディレクトリでnpm auditを実行しても、`package-lock.json`は新たに作られませんでした。

したがって、npmだけのrepositoryではnpm auditが短い経路になります。一方、pnpm/Yarnのlockfile自体を走査したい場合、今回の条件ではOSV-Scannerがそのまま使えました。monorepoなどでnpm lockfileも併存するなら、lockfileごとにどのscannerへ渡すかを明示する必要があります。

## findingと終了コードを別々に保存する

脆弱版とclean controlに対し、npmは`low`、`moderate`、`high`、`critical`の4 threshold、OSV-Scannerは既定条件で実行しました。

| fixture | tool / threshold | findings | exit |
|---|---|---:|---:|
| 脆弱版 | npm low | 3 package | 1 |
| 脆弱版 | npm moderate | 3 package | 1 |
| 脆弱版 | npm high | 3 package | 1 |
| 脆弱版 | npm critical | 3 package | 1 |
| 脆弱版 | OSV-Scanner | 30 records | 1 |
| clean control | npm low〜critical | 0 | 0 |
| clean control | OSV-Scanner | 0 | 0 |

今回の脆弱版はすべてのthresholdを超えたため、threshold間で終了コードが切り替わる境界は観測できませんでした。一方、npmのJSONに現れたfinding集合は4条件で同じでした。CIでは、JSONのfindingとプロセス終了コードを別フィールドとして保存すると、この2つを混同せずに済みます。

## 非0をすべて「脆弱性あり」にしない

CIで重要なのは、findingあり、clean、scan失敗の3状態を分けることです。入力異常と通信失敗も試しました。

| ケース | exit | 観測した診断 |
|---|---:|---|
| npmのschema-invalid lockfile | 1 | validなerror JSON |
| npmの途中で切れた`package-lock.json` | 1 | `ENOLOCK`。JSON parserの診断ではなかった |
| OSVの途中で切れた`package-lock.json` | 127 | extractor選択後に`unexpected end of JSON input` |
| OSVのunsupported text | 127 | suitable extractorなし |
| npmの閉じたlocalhost port | 1 | `ECONNREFUSED 127.0.0.1:9`とaudit endpoint error |

OSV-Scannerの2つの失敗は、どちらもexit 127でした。ただし、実行記録にはchecksum確認済み実行ファイルの絶対path、argv、cwd、開始・終了時刻、`launchError: null`があり、プロセスが起動したことを確認しています。したがって、127だけからcommand not foundとも入力原因とも推測せず、stderrと起動記録を組み合わせて`scan-error`へ分類しました。

npmのnetwork errorはvalid JSONを返しましたが、`error`を含みexit 1です。JSONとしてparseできることと、scan成功は同義ではありません。

最低限、CIの分類はscan errorを最初に判定します。今回、正常なfinding/cleanとして観測したのは、起動成功、期待するJSON schema、top-level errorなし、exit 0または1を満たす応答です。exitだけでは原因を決めません。

```text
起動失敗・timeout・JSON不正・schema不正・errorあり・exit 0/1以外 => scan-error
上記なし && finding > 0                                     => finding
上記なし && exit == 0 && finding == 0                        => clean
それ以外                                                     => scan-error
```

「errorを持ちながらfindingも持つ」などの合成応答はscannerの実測には含めていません。上の順序は、そのような部分応答をfindingへ誤分類しないためのfail-closedな運用規則です。

## 本文だけで再現する

以下は検証で実際に空ディレクトリから使った取得・実行手順です。Node.js、npm、OSV-Scannerを固定し、checksumも確認します。末尾のnormalizerだけはreview後にscan error優先へ修正しており、この修正版全体は再実行していません。後掲の結果は元の実行で観測した値であり、修正版normalizerの新しい実測とは扱いません。

前提はDarwin/Linuxの対応architecture、公開HTTPSへの接続、`curl`、`shasum`、`tar`、Python 3、および継承された`ASTRO_TELEMETRY_DISABLED=1`です。引数には**存在しないか、空である専用ディレクトリ**を指定してください。`HOME`と`CODEX_HOME`は変更しません。

```bash:inline-repro.sh
#!/bin/bash
set -Eeuo pipefail
TARGET=${1:?pass an empty target directory}
mkdir -p "$TARGET"
TARGET=$(cd "$TARGET" && pwd -P)
test -z "$(find "$TARGET" -mindepth 1 -maxdepth 1 -print -quit)"
test "${ASTRO_TELEMETRY_DISABLED:-}" = 1
ORIGINAL_HOME=${HOME:?}; ORIGINAL_CODEX_HOME=${CODEX_HOME-}
mkdir -p "$TARGET"/{bin,cache,config,data,downloads,fixtures/vulnerable,fixtures/clean,fixtures/malformed,fixtures/unsupported,raw,tmp,tools}
export npm_config_cache="$TARGET/cache/npm" npm_config_userconfig="$TARGET/config/npmrc" npm_config_update_notifier=false npm_config_fund=false NO_UPDATE_NOTIFIER=1
export XDG_CACHE_HOME="$TARGET/cache" XDG_CONFIG_HOME="$TARGET/config" XDG_DATA_HOME="$TARGET/data" TMPDIR="$TARGET/tmp"
case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) NODE_PLATFORM=darwin-arm64; OSV_PLATFORM=darwin_arm64;;
  Darwin-x86_64) NODE_PLATFORM=darwin-x64; OSV_PLATFORM=darwin_amd64;;
  Linux-x86_64) NODE_PLATFORM=linux-x64; OSV_PLATFORM=linux_amd64;;
  Linux-aarch64|Linux-arm64) NODE_PLATFORM=linux-arm64; OSV_PLATFORM=linux_arm64;;
  *) exit 20;;
esac
NODE_VERSION=v26.13.1; NODE_ARCHIVE="node-$NODE_VERSION-$NODE_PLATFORM.tar.gz"
curl --silent --show-error --fail --location --proto '=https' --tlsv1.2 "https://nodejs.org/dist/$NODE_VERSION/$NODE_ARCHIVE" -o "$TARGET/downloads/$NODE_ARCHIVE"
curl --silent --show-error --fail --location --proto '=https' --tlsv1.2 "https://nodejs.org/dist/$NODE_VERSION/SHASUMS256.txt" -o "$TARGET/downloads/SHASUMS256.txt"
grep "  $NODE_ARCHIVE\$" "$TARGET/downloads/SHASUMS256.txt" >"$TARGET/downloads/node-check.txt"
(cd "$TARGET/downloads" && shasum -a 256 -c node-check.txt) >"$TARGET/raw/node-checksum.txt"
mkdir -p "$TARGET/tools/node"; tar -xzf "$TARGET/downloads/$NODE_ARCHIVE" --strip-components=1 -C "$TARGET/tools/node"
NODE="$TARGET/tools/node/bin/node"; test "$("$NODE" --version)" = v26.13.1; export PATH="$TARGET/tools/node/bin:/usr/bin:/bin:/usr/sbin:/sbin"
curl --silent --show-error --fail --location --proto '=https' --tlsv1.2 https://registry.npmjs.org/npm/12.2.3 -o "$TARGET/downloads/npm.json"
curl --silent --show-error --fail --location --proto '=https' --tlsv1.2 https://registry.npmjs.org/npm/-/npm-12.2.3.tgz -o "$TARGET/downloads/npm.tgz"
"$NODE" --input-type=module - "$TARGET/downloads/npm.json" "$TARGET/downloads/npm.tgz" >"$TARGET/raw/npm-checksum.txt" <<'JS'
import fs from'node:fs';import crypto from'node:crypto';const[m,t]=process.argv.slice(2),j=JSON.parse(fs.readFileSync(m)),e='sha512-ovmNRRe76Jvcp1E6iOePQ6H9Zr4XMOrqgfaeGNhtRvP3XSl2Lo/a9C1N5/jRlLLrsqCem/omgGdZHpZ5a6yn1Q==',a='sha512-'+crypto.createHash('sha512').update(fs.readFileSync(t)).digest('base64');if(j.version!=='12.2.3'||j.dist.integrity!==e||a!==e)throw Error('npm integrity mismatch');console.log(a);
JS
mkdir -p "$TARGET/tools/npm"; tar -xzf "$TARGET/downloads/npm.tgz" --strip-components=1 -C "$TARGET/tools/npm"
printf '#!/bin/sh\nexec "%s" "%s" "$@"\n' "$NODE" "$TARGET/tools/npm/bin/npm-cli.js" >"$TARGET/bin/npm"; chmod 700 "$TARGET/bin/npm"; NPM="$TARGET/bin/npm"; test "$("$NPM" --version)" = 12.2.3
OSV_NAME="osv-scanner_$OSV_PLATFORM"; curl --silent --show-error --fail --location --proto '=https' --tlsv1.2 "https://github.com/google/osv-scanner/releases/download/v2.7.1/$OSV_NAME" -o "$TARGET/downloads/$OSV_NAME"
curl --silent --show-error --fail --location --proto '=https' --tlsv1.2 https://github.com/google/osv-scanner/releases/download/v2.7.1/osv-scanner_SHA256SUMS -o "$TARGET/downloads/osv-scanner_SHA256SUMS"
"$NODE" --input-type=module - "$TARGET/downloads/osv-scanner_SHA256SUMS" "$TARGET/downloads/$OSV_NAME" "$OSV_NAME" >"$TARGET/raw/osv-checksum.txt" <<'JS'
import fs from'node:fs';import crypto from'node:crypto';const[s,b,n]=process.argv.slice(2),h=fs.readFileSync(s,'utf8').split(/\r?\n/).map(x=>x.match(/^([a-fA-F0-9]{64})\s+\*?(.+)$/)).filter(x=>x&&x[2]===n),a=crypto.createHash('sha256').update(fs.readFileSync(b)).digest('hex');if(h.length!==1||a!==h[0][1].toLowerCase())throw Error('OSV checksum mismatch');console.log(a);
JS
mkdir -p "$TARGET/tools/osv"; cp "$TARGET/downloads/$OSV_NAME" "$TARGET/tools/osv/osv-scanner"; chmod 700 "$TARGET/tools/osv/osv-scanner"; OSV="$TARGET/tools/osv/osv-scanner"; "$OSV" --version >"$TARGET/raw/osv-version.txt"; grep -F 2.7.1 "$TARGET/raw/osv-version.txt" >/dev/null
printf '%s\n' '{"name":"vulnerable","version":"1.0.0","private":true,"dependencies":{"lodash":"4.17.20","minimist":"0.2.0","axios":"0.21.1"}}' >"$TARGET/fixtures/vulnerable/package.json"
printf '%s\n' '{"name":"clean","version":"1.0.0","private":true,"dependencies":{"lodash":"4.18.1","minimist":"1.2.8","axios":"1.21.1"}}' >"$TARGET/fixtures/clean/package.json"
printf '%s\n' '{"name":"malformed","version":"1.0.0","private":true}' >"$TARGET/fixtures/malformed/package.json"; printf '%s\n' '{"lockfileVersion":3,"packages":' >"$TARGET/fixtures/malformed/package-lock.json"
printf '%s\n' 'not a supported lockfile' >"$TARGET/fixtures/unsupported/unsupported.txt"
(cd "$TARGET/fixtures/vulnerable" && "$NPM" install --package-lock-only --ignore-scripts --no-audit --no-fund)
(cd "$TARGET/fixtures/clean" && "$NPM" install --package-lock-only --ignore-scripts --no-audit --no-fund)
"$NODE" --input-type=module - "$TARGET" <<'JS'
import fs from'node:fs';import path from'node:path';const r=process.argv[2];for(const [d,e]of [['vulnerable',{lodash:'4.17.20',minimist:'0.2.0',axios:'0.21.1'}],['clean',{lodash:'4.18.1',minimist:'1.2.8',axios:'1.21.1'}]]){const p=JSON.parse(fs.readFileSync(path.join(r,'fixtures',d,'package.json'))),l=JSON.parse(fs.readFileSync(path.join(r,'fixtures',d,'package-lock.json')));if(p.scripts)throw Error('scripts forbidden');for(const[n,v]of Object.entries(e))if(p.dependencies[n]!==v||l.packages[`node_modules/${n}`].version!==v)throw Error('version mismatch');}
JS
printf '%s\n' 'import datetime,json,pathlib,subprocess,sys' 'root=pathlib.Path(sys.argv[1]).resolve(strict=True);label=sys.argv[2];cwd=pathlib.Path(sys.argv[3]).resolve(strict=True);argv=sys.argv[4:];exe=pathlib.Path(argv[0]).resolve(strict=True)' 'assert cwd.is_relative_to(root) and exe.is_relative_to(root) and exe.is_file();argv[0]=str(exe);p=root/"raw"/label;now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat();r={"argv":argv,"cwd":str(cwd),"startedAt":now(),"launchError":None,"returncode":None}' 'with p.with_suffix(".json").open("wb") as o,p.with_suffix(".stderr").open("wb") as e:' ' try:r["returncode"]=subprocess.run(argv,cwd=cwd,stdout=o,stderr=e,timeout=90,check=False).returncode' ' except (OSError,subprocess.TimeoutExpired) as x:r["launchError"]=type(x).__name__+": "+str(x)' 'r["endedAt"]=now();p.with_suffix(".command.json").write_text(json.dumps(r,indent=2)+"\n");p.with_suffix(".exit").write_text(str(r["returncode"])+"\n")' 'if r["launchError"] or r["returncode"] is None or r["returncode"]<0 or r["returncode"]==126:raise SystemExit("runner failure")' >"$TARGET/capture.py"
capture(){ python3 "$TARGET/capture.py" "$TARGET" "$@"; }
capture vulnerable-npm "$TARGET/fixtures/vulnerable" "$NPM" audit --json
capture vulnerable-osv "$TARGET/fixtures/vulnerable" "$OSV" scan -L package-lock.json --format json
capture clean-npm "$TARGET/fixtures/clean" "$NPM" audit --json
capture clean-osv "$TARGET/fixtures/clean" "$OSV" scan -L package-lock.json --format json
capture malformed-osv "$TARGET/fixtures/malformed" "$OSV" scan -L package-lock.json --format json
capture unsupported-osv "$TARGET/fixtures/unsupported" "$OSV" scan -L unsupported.txt --format json
capture network-npm "$TARGET/fixtures/vulnerable" "$NPM" audit --json --fetch-timeout=1000 --fetch-retries=0 --registry=http://127.0.0.1:9
"$NODE" --input-type=module - "$TARGET" >"$TARGET/raw/normalized.json" <<'JS'
import fs from'node:fs';import path from'node:path';const r=process.argv[2],read=n=>fs.readFileSync(path.join(r,'raw',n),'utf8'),parse=n=>{try{return JSON.parse(read(n+'.json'))}catch{return null}},exit=n=>Number(read(n+'.exit').trim()),nc=o=>o?.metadata?.vulnerabilities?.total??Object.keys(o?.vulnerabilities??{}).length,oc=o=>(o?.results??[]).flatMap(x=>x.packages??[]).flatMap(x=>x.vulnerabilities??[]).length,shape=(o,t)=>t==='npm'?!!o&&o.metadata?.vulnerabilities&&o.vulnerabilities&&typeof o.vulnerabilities==='object':!!o&&Array.isArray(o.results);const out={};for(const[n,t]of[['vulnerable-npm','npm'],['vulnerable-osv','osv'],['clean-npm','npm'],['clean-osv','osv'],['malformed-osv','osv'],['unsupported-osv','osv'],['network-npm','npm']]){const j=parse(n),e=exit(n),c=t==='npm'?nc(j):oc(j),bad=!j||j.error||!shape(j,t)||![0,1].includes(e);out[n]={exit:e,jsonValid:!!j,findings:c,status:bad?'scan-error':c>0?'finding':e===0?'clean':'scan-error'};}console.log(JSON.stringify(out,null,2));if(out['clean-npm'].status!=='clean'||out['clean-osv'].status!=='clean'||out['malformed-osv'].status!=='scan-error'||out['unsupported-osv'].status!=='scan-error'||out['network-npm'].status!=='scan-error')process.exit(1);
JS
rm -rf "$TARGET/cache" "$TARGET/config" "$TARGET/data" "$TARGET/downloads" "$TARGET/tmp" "$TARGET/tools" "$TARGET/bin"
test "$HOME" = "$ORIGINAL_HOME"; test "${CODEX_HOME-}" = "$ORIGINAL_CODEX_HOME"; test "$ASTRO_TELEMETRY_DISABLED" = 1
printf 'inline reproduction completed; transient tools/downloads/caches removed; raw evidence retained\n' >"$TARGET/cleanup.txt"
```

例えば、保存名を`inline-repro.sh`とし、空の`./inline-check`を使う場合は次のように実行します。

```bash
bash inline-repro.sh ./inline-check
cat ./inline-check/raw/normalized.json
```

検証時の正規化結果は次のとおりでした。

```json
{
  "vulnerable-npm": { "exit": 1, "jsonValid": true, "findings": 3, "status": "finding" },
  "vulnerable-osv": { "exit": 1, "jsonValid": true, "findings": 30, "status": "finding" },
  "clean-npm": { "exit": 0, "jsonValid": true, "findings": 0, "status": "clean" },
  "clean-osv": { "exit": 0, "jsonValid": true, "findings": 0, "status": "clean" },
  "malformed-osv": { "exit": 127, "jsonValid": false, "findings": 0, "status": "scan-error" },
  "unsupported-osv": { "exit": 127, "jsonValid": false, "findings": 0, "status": "scan-error" },
  "network-npm": { "exit": 1, "jsonValid": true, "findings": 0, "status": "scan-error" }
}
```

この手順はtransientなツール、download、cache、設定、temp directoryを最後に削除し、raw evidenceは残します。検証では`HOME` / `CODEX_HOME`の値が変わっていないこと、列挙した外部cache/config pathのmetadataが前後で一致することも確認しました。ただし、列挙したpath以外も含めた外部書き込みの完全な不在を証明するものではありません。

## 選び方を運用へ落とす

### npm auditだけにする

次の条件なら、まずnpm auditだけで始める判断ができます。

- 入力はnpmの`package-lock.json`だけ
- npm組み込みのJSONとseverity gateを使いたい
- advisory aliasを突き合わせる運用コストを増やしたくない

ただし、CIではstdoutのJSON、stderr、終了コードを別々に保存し、network errorなどをcleanにしない分類が必要です。

### OSV-Scannerだけにする

pnpmやYarnのlockfileを直接走査したい場合、今回の実測ではOSV-Scannerが選びやすい結果でした。対応形式は将来変わり得るため、導入時には公式の[対応lockfile一覧](https://google.github.io/osv-scanner/supported-languages-and-lockfiles/)と、固定したCLI versionのhelpを確認します。

こちらも、非0をfindingと決め打ちしてはいけません。今回のexit 127はmalformedとunsupportedの両方で現れたため、stderrと起動記録が分類に必要でした。

### 併用する

併用は、advisory sourceの差を観測対象にしたい場合の選択肢です。ただし、今回のsnapshotでは正規化後の片側findingは0件でした。併用するなら、少なくとも次のコストを受け入れる必要があります。

- package名とadvisory alias集合による重複除去
- 2つのJSON schemaへの追従
- finding、clean、scan-errorを両方で分類する処理
- database更新により件数が変わることを前提にした記録

「2つ動かせば安全」ではなく、異なるsourceの差を継続観測する目的があるかで決めるのが現実的です。

## この検証で分からないこと

今回確認したのは、固定した少数の公開依存とlockfileを既知advisory databaseへ照合した結果です。次のことは確認していません。

- 未知の脆弱性やmalwareの検出
- 脆弱なコードへのruntime到達性
- application code自体の脆弱性
- npmとOSVの検出率やfalse-negative rate
- finding件数から見た製品の優劣
- npm thresholdを変えたときにexitが切り替わる境界

また、advisory databaseとregistry responseは時間で変わります。同じlockfileと同じtool versionでも、再実行時のadvisory件数やmetadataが一致するとは限りません。

## まとめ

固定lockfileでの結果から、選択基準は次のように整理できます。

- npmの`package-lock.json`とseverity gateを短く導入するなら`npm audit`
- pnpm/Yarnのlockfileを同じCLIで走査するならOSV-Scanner
- advisory sourceの差を観測し、正規化コストを負担できるなら併用

どの方式でも、finding数だけではなく終了コード、JSON parse結果、error field、stderr、起動成否を保存し、`finding`、`clean`、`scan-error`を分けることが重要です。0件という数字は、scanが成功したと確認できて初めてclean controlとして扱えます。

## 参考資料

- [npm audit公式ドキュメント](https://docs.npmjs.com/cli/audit/)
- [OSV-Scanner公式サイト](https://google.github.io/osv-scanner/)
- [OSV-Scanner usage](https://google.github.io/osv-scanner/usage/)
- [OSV-Scannerの対応言語・lockfile](https://google.github.io/osv-scanner/supported-languages-and-lockfiles/)
- [OSV-Scanner v2.7.1 release](https://github.com/google/osv-scanner/releases/tag/v2.7.1)
- [Node.js v26.13.1配布物](https://nodejs.org/dist/v26.13.1/)
- [npm 12.2.3 registry metadata](https://registry.npmjs.org/npm/12.2.3)
