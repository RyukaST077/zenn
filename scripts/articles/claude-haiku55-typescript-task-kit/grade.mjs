import fs from 'node:fs';
import path from 'node:path';
import { compile, checkRows, tree, tsApi } from './public-support.mjs';

export const tasks = ['bug-fix', 'add-tests', 'refactor'];
export const callers = ['cart', 'quote', 'invoice', 'payment', 'refund', 'ledger'];
export const permitted = task => task === 'bug-fix' ? ['src/parse.ts'] : task === 'add-tests'
  ? ['tests/discount.test.json', 'src/discount.ts'] : [...callers.map(n => `src/${n}.ts`), 'src/money.ts'];
export function snapshot(root) { return tree(root); }
export function grade(task, root, baseline) {
  const files = tree(root);
  const changed = [...new Set([...Object.keys(baseline), ...Object.keys(files)])]
    .filter(p => baseline[p] !== files[p]).sort();
  if (changed.some(p => !permitted(task).includes(p))) throw new Error('SAFETY: changed path outside registered candidate boundary');
  const built = compile(root), gates = { typecheck: built.ok }, details = {};
  // Arithmetic utility candidates never need host APIs, dynamic imports, or prototype escape paths.
  const hostApi = /\b(?:process|require|globalThis|global|eval|Function|fetch|WebSocket|constructor|__proto__|prototype|setTimeout|setInterval)\b|\bimport\s*\(/;
  gates.offline_utility = Object.entries(files).filter(([p]) => p.startsWith('src/') && p.endsWith('.ts')).every(([,s]) => !hostApi.test(s));
  if (!gates.offline_utility) { built.close(); return { full_pass:false, marker:`${task.toUpperCase().replaceAll('-','_')}_COMPETING_FAILURE`,gates,details,changed }; }
  const accepts = (file, name, args, expected) => {
    const canonical = v => v && typeof v === 'object' && !Array.isArray(v)
      ? JSON.stringify(Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]]))) : JSON.stringify(v);
    try { return canonical(built.call(file, name, args)) === canonical(expected); }
    catch { return false; }
  };
  const rejects = (file, name, args, exactMessage = true) => {
    try { built.call(file, name, args); return false; } catch (e) { return e.name === 'RangeError' && (!exactMessage || e.message === 'amount'); }
  };
  try {
    if (task === 'bug-fix') {
      const good = [['0',0],['0.01',1],['1.1',110],['1.13',113],['2.03',203],['10.29',1029],['999.99',99999],['90071992547409.91',Number.MAX_SAFE_INTEGER]];
      const bad = ['', ' ', '1 ', '1\n', '1\r', '+1', '-0', '01', '.1', '1.', '1.001', '1e2', 'Infinity', '1abc', '90071992547409.92', '999999999999999999', null, 2];
      gates.runtime = built.ok && good.every(([v,n]) => accepts('parse','parseCents',[v],n)) && bad.every(v => rejects('parse','parseCents',[v],false));
      gates.scope = changed.every(p => p === 'src/parse.ts');
    } else if (task === 'add-tests') {
      gates.source_unchanged = files['src/discount.ts'] === baseline['src/discount.ts'];
      let rows; try { rows = JSON.parse(files['tests/discount.test.json']); } catch { rows = null; }
      const base = built.ok ? checkRows(rows, (...a) => built.call('discount','discount',a)) : { valid: false, pass: false, count: 0 };
      gates.baseline = base.valid && base.pass; details.test_count = base.count;
      // Non-equivalent, fixed mutations; no student executable tests enter the grader.
      const mutants = Array.from({ length: 6 }, (_, index) => (s,p,c) => {
        if (!Number.isSafeInteger(s) || s < 0 || s > 1000000 || !Number.isInteger(p) || p < 0
          || p > (index === 5 ? 101 : 100) || !Number.isSafeInteger(c) || c < 0) throw new RangeError('discount');
        if (index === 0) return Math.min(c, Math.round(s*p/100));
        if (index === 1) return Math.floor(s*p/100);
        if (index === 2 && p === 0 && s > 0) return Math.min(c,1);
        if (index === 3 && c === 0) return Math.floor(s*p/100);
        if (index === 4 && p === 100) p = 99;
        return Math.min(c, Math.floor(s*p/100));
      });
      details.mutation_killed = mutants.map(fn => base.valid && base.pass && !checkRows(rows, fn).pass);
      details.kill_count = details.mutation_killed.filter(Boolean).length;
      gates.mutations = details.kill_count === 6;
    } else {
      gates.runtime = built.ok && callers.every(n => [0,1,123,Number.MAX_SAFE_INTEGER].every(v => accepts(n,n+'Amount',[v],{kind:n,cents:v}))
        && [-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'1',null].every(v => rejects(n,n+'Amount',[v])));
      const ts = tsApi();
      const ast = (name) => ts.createSourceFile(name, files[name] || '', ts.ScriptTarget.Latest, true);
      let structure = typeof files['src/money.ts'] === 'string';
      for (const n of callers) {
        let imports = 0, calls = 0, duplicate = false, functions = 0;
        function visit(node) {
          if (ts.isImportDeclaration(node) && node.moduleSpecifier.text === './money'
            && node.importClause?.namedBindings?.elements?.some(x => x.name.text === 'validateCents' && !x.propertyName)) imports++;
          if (ts.isFunctionDeclaration(node)) functions++;
          if (ts.isCallExpression(node)) {
            if (node.expression.getText() === 'validateCents' && node.arguments.length === 1 && node.arguments[0].getText() === 'cents') calls++;
            if (node.expression.getText() === 'Number.isSafeInteger') duplicate = true;
          }
          if (ts.isIfStatement(node) || ts.isConditionalExpression(node) || ts.isThrowStatement(node)) duplicate = true;
          ts.forEachChild(node, visit);
        }
        visit(ast(`src/${n}.ts`)); structure &&= imports === 1 && calls === 1 && functions === 1 && !duplicate;
      }
      gates.structure = structure;
      gates.common_validation = built.ok && [0,123,Number.MAX_SAFE_INTEGER].every(v => {
        try { return built.call('money','validateCents',[v]) === undefined; } catch { return false; }
      }) && [-1,0.5,NaN,Infinity].every(v => rejects('money','validateCents',[v]));
      gates.scope = changed.length === 7 && permitted(task).every(p => changed.includes(p));
    }
  } catch (e) {
    if (/^(HARNESS|SAFETY):/.test(e.message)) throw e;
    gates.runtime = false;
  } finally { built.close(); }
  const full_pass = Object.values(gates).every(Boolean);
  return { full_pass, marker: full_pass ? `${task.toUpperCase().replaceAll('-','_')}_FULL_PASS` : `${task.toUpperCase().replaceAll('-','_')}_COMPETING_FAILURE`, gates, details, changed };
}
