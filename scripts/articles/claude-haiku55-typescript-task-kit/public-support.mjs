import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

export function compiler() {
  const candidate = String(process.env.PATH || '').split(path.delimiter)
    .map(p => path.join(p, 'tsc')).find(p => fs.existsSync(p));
  if (!candidate) throw new Error('HARNESS: existing tsc unavailable; no installation permitted');
  return fs.realpathSync(candidate);
}
export function tsApi() { return createRequire(compiler())('../lib/typescript.js'); }
export function tree(root, base = root, result = {}) {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const file = path.join(root, entry.name), relative = path.relative(base, file);
    if (entry.isSymbolicLink()) throw new Error('SAFETY: symlink in candidate');
    if (entry.isDirectory()) tree(file, base, result);
    else {
      if (!entry.isFile() || fs.statSync(file).size > 65536) throw new Error('SAFETY: nonregular/oversize candidate');
      result[relative] = fs.readFileSync(file, 'utf8');
      if (Object.keys(result).length > 40) throw new Error('SAFETY: too many candidate files');
    }
  }
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
}
export function compile(root) {
  const build = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-task-grade-'));
  const tsc = spawnSync(process.execPath, [compiler(), '-p', path.join(root, 'tsconfig.json'), '--outDir', build], {
    cwd: root, encoding: 'utf8', timeout: 5000, maxBuffer: 1024 * 1024,
    env: { PATH: process.env.PATH || '', TMPDIR: os.tmpdir() },
  });
  if (tsc.error) { fs.rmSync(build, { recursive: true }); throw new Error('HARNESS: compiler failed or timed out'); }
  const cache = new Map();
  function load(file) {
    file = path.resolve(file);
    if (!file.startsWith(build + path.sep) || !file.endsWith('.js')) throw new Error('unsupported module');
    if (cache.has(file)) return cache.get(file);
    if (cache.size > 12) throw new Error('module limit');
    const module = { exports: {} }; cache.set(file, module.exports);
    const context = vm.createContext({ module, exports: module.exports, require: name => {
      if (!/^\.\/[a-z]+$/.test(name)) throw new Error('only local utility imports allowed');
      return load(path.resolve(path.dirname(file), name + '.js'));
    } }, { codeGeneration: { strings: false, wasm: false } });
    new vm.Script(fs.readFileSync(file, 'utf8')).runInContext(context, { timeout: 50 });
    cache.set(file, module.exports); return module.exports;
  }
  return {
    ok: tsc.status === 0,
    diagnostic: tsc.status === 0 ? null : 'typecheck-failed',
    call(file, name, args) {
      const flat = path.join(build, file + '.js'), nested = path.join(build, 'src', file + '.js');
      const subject = load(fs.existsSync(flat) ? flat : nested)[name];
      const context = vm.createContext({ subject, args }, { codeGeneration: { strings: false, wasm: false } });
      const encoded = new vm.Script('const value = subject(...args); value === undefined ? undefined : JSON.stringify(value)').runInContext(context, { timeout: 20 });
      return encoded === undefined ? undefined : JSON.parse(encoded);
    },
    close() { fs.rmSync(build, { recursive: true }); },
  };
}
export function checkRows(rows, fn) {
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 100) return { valid: false, pass: false, count: 0 };
  let pass = true;
  for (const r of rows) {
    if (!r || typeof r.name !== 'string' || !Array.isArray(r.input) || r.input.length !== 3
      || r.input.some(x => typeof x !== 'number' || !Number.isFinite(x))
      || (r.throws !== 'RangeError' && !Number.isSafeInteger(r.expected))
      || (r.throws === 'RangeError' && Object.hasOwn(r, 'expected'))) return { valid: false, pass: false, count: rows.length };
    try { const actual = fn(...r.input); if (r.throws || actual !== r.expected) pass = false; }
    catch (e) { if (r.throws !== 'RangeError' || e.name !== 'RangeError') pass = false; }
  }
  return { valid: true, pass, count: rows.length };
}
export function publicCheck() {
  const root = process.cwd(), built = compile(root);
  test('published examples and submitted regression cases', () => {
    try {
      assert.equal(built.ok, true);
      if (fs.existsSync('src/parse.ts')) {
        assert.equal(built.call('parse', 'parseCents', ['1.13']), 113);
        assert.equal(built.call('parse', 'parseCents', ['0']), 0);
      } else if (fs.existsSync('src/discount.ts')) {
        const rows = JSON.parse(fs.readFileSync('tests/discount.test.json', 'utf8'));
        const result = checkRows(rows, (...args) => built.call('discount', 'discount', args));
        assert.equal(result.valid && result.pass, true);
      } else for (const name of ['cart','quote','invoice','payment','refund','ledger']) {
        assert.deepEqual(built.call(name, name + 'Amount', [123]), { kind: name, cents: 123 });
      }
    } finally { built.close(); }
  });
}
