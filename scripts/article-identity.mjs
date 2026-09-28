#!/usr/bin/env node
// Bind an article to its preregistered contract across stages and resumptions.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { pathToFileURL } from 'node:url';

export const slugPattern = '^[a-z0-9-]{12,50}$';
export function assertSlug(slug) {
  if (typeof slug !== 'string' || !new RegExp(slugPattern).test(slug)) {
    throw new Error(`slug must be 12-50 lowercase letters, digits or hyphens: ${slug}`);
  }
}

export function contractFromResearch(source) {
  const sections = source.split(/^##\s+記事契約\s*$/m);
  if (sections.length !== 2) throw new Error('research must contain exactly one "## 記事契約" section');
  const section = sections[1].split(/^##\s/m)[0];
  const blocks = [...section.matchAll(/```json\s*\n([\s\S]*?)```/g)];
  if (blocks.length !== 1) throw new Error('article contract requires exactly one json block');
  return JSON.parse(blocks[0][1]);
}

// These are the fields preserved by register-article.mjs (titleDraft is mutable
// editorial input and registeredAt is added at registration, not at resumption).
export function registrationFields(contract) {
  return {
    slug: contract.slug, topics: contract.topics, primaryTopic: contract.primaryTopic,
    classification: {
      source: 'contract', valueArchetype: contract.valueArchetype,
      policyVersion: contract.policyVersion, experimentId: contract.experimentId, arm: contract.arm,
      contract: {
        targetReader: contract.targetReader, readerDecision: contract.readerDecision,
        takeaway: contract.takeaway, verificationItems: contract.verificationItems,
        quantifiedMetric: contract.quantifiedMetric ?? null, demandEvidence: contract.demandEvidence,
      },
    },
  };
}

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
function safeFile(root, relative, { missing = false } = {}) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative)
      || relative.includes('\\') || relative.split('/').some(p => !p || p === '.' || p === '..')) {
    throw new Error(`unsafe repository-relative path: ${relative}`);
  }
  let current = root;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    if (!fs.existsSync(current) && !fs.lstatSync(current, { throwIfNoEntry: false })) {
      if (missing) continue;
      throw new Error(`missing file: ${relative}`);
    }
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error(`symlink path: ${relative}`);
  }
  if (fs.existsSync(current) && !fs.statSync(current).isFile()) throw new Error(`not a regular file: ${relative}`);
  return current;
}
const read = (root, relative) => fs.readFileSync(safeFile(root, relative), 'utf8');
const json = (root, relative) => JSON.parse(read(root, relative));
function equal(actual, expected, label) {
  if (!isDeepStrictEqual(actual, expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, actual ${JSON.stringify(actual)}`);
  }
}
function save(root, relative, value) {
  const file = safeFile(root, relative, { missing: true });
  if (fs.existsSync(file)) {
    equal(JSON.parse(fs.readFileSync(file, 'utf8')), value, `saved identity ${relative}`);
  } else {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  }
}

export function registeredIdentity(root, report, allocation) {
  if (!/^research\/.+\.md$/.test(report)) throw new Error(`invalid research path: ${report}`);
  const reportText = read(root, report);
  const contract = contractFromResearch(reportText);
  assertSlug(contract.slug);
  if (typeof contract.arm !== 'string' || !contract.arm
      || !(contract.experimentId === null || typeof contract.experimentId === 'string')) {
    throw new Error('research requires explicit arm and experimentId');
  }
  const contractPath = `analytics/contracts/${contract.slug}.json`;
  const registeredText = read(root, contractPath);
  const registered = JSON.parse(registeredText);
  const { registeredAt, titleFeatures, ...classification } = registered.classification ?? {};
  if (!registeredAt || !Number.isFinite(Date.parse(registeredAt))) throw new Error(`missing registeredAt: ${contractPath}`);
  equal({ slug: registered.slug, topics: registered.topics, primaryTopic: registered.primaryTopic, classification },
    registrationFields(contract), `registered contract ${contractPath}`);
  if (allocation) {
    equal(contract.arm, allocation.arm, `arm in ${contractPath}`);
    equal(contract.experimentId, allocation.experimentId, `experimentId in ${contractPath}`);
  }
  return {
    version: 1, slug: contract.slug, article: `articles/${contract.slug}.md`, report,
    contract: contractPath, arm: contract.arm, experimentId: contract.experimentId,
    reportSha256: hash(reportText), contractSha256: hash(registeredText),
  };
}

export function verifyIdentity(root, identity, { article, result } = {}) {
  equal(registeredIdentity(root, identity.report), identity, `article identity (${identity.contract})`);
  if (article) {
    equal(article, identity.article, `article path (${identity.contract})`);
    safeFile(root, article);
  }
  if (result) {
    const stage = json(root, result);
    equal(stage.metadata?.slug, identity.slug, `metadata.slug (${identity.contract})`);
  }
}

function main() {
  const [command, ...args] = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!args[i].startsWith('--') || args[i + 1] === undefined) throw new Error('expected --option value');
    options[args[i].slice(2)] = args[i + 1];
  }
  const root = path.resolve(options.root || process.cwd());
  if (command === 'init') {
    const allocation = options.allocation ? json(root, options.allocation) : undefined;
    if (options['allocation-json']) equal(allocation, JSON.parse(options['allocation-json']), 'saved arm allocation');
    const identity = registeredIdentity(root, options.report, allocation);
    if (options['resume-log']) {
      const log = options['resume-log'];
      if (!/^logs\/agent\/run-[^/]+\/execution-log\.md$/.test(log)) throw new Error('invalid resume log');
      const manifestPath = read(root, log).match(/^- Manifest: `([^`]+)`$/m)?.[1];
      if (!/^practice\/agent\/[^/]+\.json$/.test(manifestPath ?? '')) throw new Error('invalid run manifest');
      equal(json(root, manifestPath).source_report, options.report, 'resume source_report');
      const sidecar = path.posix.join(path.posix.dirname(log), 'article-identity.json');
      if (fs.existsSync(safeFile(root, sidecar, { missing: true }))) {
        equal(json(root, sidecar), identity, `resume identity ${sidecar}`);
      }
      // An explicitly identified legacy run can be bound once, without
      // re-registering or consulting the current experiment allocation.
      save(root, sidecar, identity);
    } else {
      const snapshot = options.snapshot ? JSON.parse(fs.readFileSync(options.snapshot, 'utf8')) : {};
      if (fs.existsSync(safeFile(root, identity.article, { missing: true })) || Object.hasOwn(snapshot, identity.article)) {
        throw new Error(`article collision before drafting: ${identity.article}`);
      }
    }
    save(root, options.state, identity);
    process.stdout.write(JSON.stringify(identity));
  } else if (command === 'verify') {
    const identity = JSON.parse(options.identity);
    verifyIdentity(root, identity, options);
    if (options.state) equal(json(root, options.state), identity, `saved identity ${options.state}`);
    if (options.save) save(root, options.save, identity);
  } else if (command === 'publication') {
    // Also used by standalone enqueue calls that have no pipeline identity.
    const slug = path.posix.basename(options.article ?? '', '.md');
    assertSlug(slug);
    equal(options.article, `articles/${slug}.md`, 'publication article');
    const contractPath = `analytics/contracts/${slug}.json`;
    const registered = json(root, contractPath);
    equal(registered.slug, slug, `registered slug (${contractPath})`);
    if (options.state) {
      const identity = json(root, options.state);
      verifyIdentity(root, identity, { article: options.article });
    }
  } else throw new Error('expected init, verify or publication');
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { main(); } catch (error) { console.error(`article identity: ${error.message}`); process.exitCode = 2; }
}
