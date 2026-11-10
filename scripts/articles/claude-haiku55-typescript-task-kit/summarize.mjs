#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODELS } from './contract.mjs';
import { tasks } from './grade.mjs';

export function summarize(records) {
  const fields=['task','model','repeat','status','full_pass','mutation_kills','elapsed_ms','verified_elapsed_ms',
    'inputTokens','outputTokens','cacheReadInputTokens','cacheCreationInputTokens','cache_read_fraction','cache_creation_fraction','maximum_prompt_tokens','effort_observed','invalid_reason'];
  const fraction=(r,key) => {
    const u=r.observation?.tokens;
    const values=['inputTokens','cacheReadInputTokens','cacheCreationInputTokens'].map(k=>u?.[k]);
    const denominator=values.every(Number.isFinite) ? values.reduce((a,b)=>a+b,0) : null;
    return denominator>0 ? u[key]/denominator : null;
  };
  const escape=v => v === null || v === undefined ? '' : JSON.stringify(String(v));
  const csv=[fields.join(','),...records.map(r => [r.task,r.model,r.repeat,r.status,r.grade?.full_pass,r.grade?.details?.kill_count,
    r.elapsed_ms,r.verified_elapsed_ms,...['inputTokens','outputTokens','cacheReadInputTokens','cacheCreationInputTokens'].map(k => r.observation?.tokens?.[k]),
    fraction(r,'cacheReadInputTokens'),fraction(r,'cacheCreationInputTokens'),r.observation?.maximum_prompt_tokens,r.observation?.effort_observed,r.observation?.invalid].map(escape).join(','))].join('\n')+'\n';
  const range=values => {
    values=values.filter(Number.isFinite).sort((a,b)=>a-b);
    if (!values.length) return 'missing (n=0)';
    const n=values.length, mid=n%2 ? values[(n-1)/2] : (values[n/2-1]+values[n/2])/2;
    return `${mid.toFixed(1)} [${values[0].toFixed(1)}, ${values[n-1].toFixed(1)}] (n=${n})`;
  };
  const table=['| Task | Model | Full pass / all trials | Valid / invalid / censored | Elapsed ms median [range], all observed | Four token fields summed, median [range] | Cache read / creation fraction median [range] |',
    '|---|---|---|---|---|---|---|'];
  const checklist=['# Task delegation checklist','',
    'Re-run in a fresh directory with the same compiler, CLI, published specification and independent oracle. Replace tasks and mutants before drawing conclusions about your tickets.',
    'Recorded effort is requested medium; when the CLI does not expose effective effort, do not assert managed-policy parity. Fresh sessions do not imply cold cache. Token totals are cumulative processing, not prompt size or subscription charges.',''];
  for (const task of tasks) {
    const both=MODELS.map(model => records.filter(r => r.task===task && r.model===model));
    if (!both.some(rows => rows.length)) continue;
    for (let i=0;i<2;i++) {
      const rows=both[i], totals=rows.map(r => {
        const values=Object.values(r.observation?.tokens || {});
        return values.length===4 && values.every(Number.isFinite) ? values.reduce((a,b)=>a+b,0) : null;
      });
      table.push(`| ${task} | ${MODELS[i]} | ${rows.filter(r=>r.status==='valid' && r.grade?.full_pass).length}/${rows.length} | ${['valid','invalid','censored'].map(s=>rows.filter(r=>r.status===s).length).join(' / ')} | ${range(rows.map(r=>r.elapsed_ms))} | ${range(totals)} | ${range(rows.map(r=>fraction(r,'cacheReadInputTokens')))} / ${range(rows.map(r=>fraction(r,'cacheCreationInputTokens')))} |`);
    }
    const pass=both.map(rows=>rows.filter(r=>r.status==='valid' && r.grade?.full_pass).length);
    let decision='Evidence incomplete: fix the harness or service condition before assigning a model.';
    if (both.every(rows=>rows.length===3 && rows.every(r=>r.status==='valid'))) {
      decision=pass[0]===3 ? 'Haiku candidate under this public specification, independent oracle and changed-path boundary; three passes are not a general reliability guarantee.'
        : pass[1]>pass[0] ? 'Prefer Sonnet initially for this fixture condition; retain the independent oracle and inspect failed gates.'
        : 'No evidence that switching to Sonnet solves this task; split the task or improve its specification/oracle and retry in a separately registered experiment.';
    }
    checklist.push(`- ${task}: Haiku ${pass[0]}/3, Sonnet ${pass[1]}/3. ${decision}`);
  }
  table.push('','All observed trial durations include valid failures; censored durations are bounds, not time to correctness. Missing token fields stay blank in CSV. Grading failures remain visible. No API-price-to-subscription conversion.');
  return {csv,table:table.join('\n')+'\n',checklist:checklist.join('\n')+'\n'};
}
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2), index=args.indexOf('--output');
  if (index!==3 || args.length!==5) throw new Error('usage: node summarize.mjs <bug case-result.json> <tests case-result.json> <refactor case-result.json> --output <new-directory>');
  const cases=args.slice(0,3).map(p=>JSON.parse(fs.readFileSync(p,'utf8')));
  const rows=cases.flatMap(c=>c.records);
  const keys=new Set(rows.map(r=>`${r.task}/${r.model}/${r.repeat}`));
  if (cases.some(c=>c.preflight) || rows.length!==18 || keys.size!==18
    || !tasks.every(t=>MODELS.every(m=>[1,2,3].every(n=>keys.has(`${t}/${m}/${n}`))))) throw new Error('EVIDENCE: all 18 real trial rows required; no fabricated missing rows');
  const out=args[4]; if (fs.existsSync(out)) throw new Error('refuse to overwrite summary directory');
  fs.mkdirSync(out,{recursive:true});
  const summary=summarize(rows);
  for (const [name,value] of [['trials.csv',summary.csv],['comparison.md',summary.table],['checklist.md',summary.checklist]]) fs.writeFileSync(path.join(out,name),value,{flag:'wx'});
  process.stdout.write('18_TRIAL_COMPARISON_REGENERATED\n');
}
