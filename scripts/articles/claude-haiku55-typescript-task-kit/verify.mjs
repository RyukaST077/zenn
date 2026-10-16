#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { grade, snapshot, permitted, tasks } from './grade.mjs';
import { prepare } from './self-check.mjs';
import { summarize } from './summarize.mjs';
import { MODELS, ORDER, MARKER, TURNS, TRIAL_SECONDS } from './contract.mjs';

const invariant=(condition,message) => { if (!condition) throw new Error('inconclusive verification: '+message); };
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const hashFiles=files=>Object.fromEntries(Object.entries(files).map(([p,s])=>[p,sha(s)]));
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const result=JSON.parse(fs.readFileSync('case-result.json','utf8'));
const task=result.task;
invariant(result.version===1 && tasks.includes(task),'result/task schema');
invariant(!result.fatal && result.records?.length===6,'harness/auth/service/censor or incomplete evidence');
invariant(result.calibration?.marker==='ORACLE_CALIBRATED' && !result.calibration.baseline.full_pass && result.calibration.answer.full_pass,'oracle calibration');
invariant(result.compiler?.version==='5.9.2' && /^[a-f0-9]{64}$/.test(result.compiler.sha256),'compiler evidence');
invariant(result.launch.turns===TURNS && result.launch.trial_timeout_seconds===TRIAL_SECONDS
  && equal(result.launch.models,MODELS) && equal(result.launch.order,ORDER),'bounded launch contract');
invariant(result.preflight || (result.authentication?.loggedIn===true && result.authentication.authMethod==='claude.ai'
  && result.authentication.apiProvider==='firstParty' && result.launch.existing_home_preserved),'subscription credentials retained');
invariant(equal(result.launch.tools,['Read','Edit','Write']) && result.launch.model_can_run_tests===false,'no shell provided to model');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'haiku55-evidence-verify-'));
const counts=[0,0], repeats=[0,0];
try {
  for (let ordinal=0;ordinal<6;ordinal++) {
    const r=result.records[ordinal], modelIndex=ORDER[ordinal];
    invariant(r.ordinal===ordinal && r.task===task && r.model===MODELS[modelIndex] && r.repeat===++repeats[modelIndex],'unique task/model/trial identity');
    invariant(r.status==='valid' && !r.observation.invalid && !r.observation.censored,'invalid or censored evidence');
    invariant(r.process.exit_code===0 && !r.process.timed_out && Number.isFinite(r.elapsed_ms) && r.elapsed_ms>=0
      && Number.isFinite(r.verified_elapsed_ms) && r.verified_elapsed_ms>=r.elapsed_ms,'external clocks/process status');
    const work=path.join(temp,String(ordinal));prepare(task,work);
    const before=snapshot(work);
    invariant(equal(hashFiles(before),r.initial_hashes),'initial-state hash mismatch');
    invariant(r.candidate && equal(hashFiles(r.candidate),r.final_hashes),'candidate hash mismatch');
    const changes=[...new Set([...Object.keys(before),...Object.keys(r.candidate)])].filter(p=>before[p]!==r.candidate[p]);
    invariant(changes.every(p=>permitted(task).includes(p)),'protected or unexpected candidate path');
    for (const p of changes) {
      const target=path.join(work,p);
      if (!Object.hasOwn(r.candidate,p)) { fs.rmSync(target); continue; }
      invariant(typeof r.candidate[p]==='string' && r.candidate[p].length<=65536,'oversize candidate');
      fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,r.candidate[p]);
    }
    const independent=grade(task,work,before);
    invariant(equal(independent,r.grade),'independent regrading disagrees');
    for (const k of ['inputTokens','outputTokens','cacheReadInputTokens','cacheCreationInputTokens']) {
      const usage=r.observation.model_usage;
      invariant(usage && Object.keys(usage).length>0 && Object.values(usage).every(u=>Number.isFinite(u[k]) && u[k]>=0),'missing token field');
      invariant(r.observation.tokens[k]===Object.values(usage).reduce((a,u)=>a+u[k],0),'token parser integrity');
    }
    if (independent.full_pass) counts[modelIndex]++;
    process.stdout.write(`${r.model}/trial-${r.repeat}: ${independent.marker}\n`);
  }
} finally { fs.rmSync(temp,{recursive:true}); }
const outcome=task==='bug-fix' ? (counts.every(n=>n===3) ? 'C1_EQUAL_3_OF_3' : 'C1_COMPETING_NOT_EQUAL_3_OF_3')
  : task==='add-tests' ? (counts[0]===3 ? 'C2_HAIKU_FULL_3_OF_3' : 'C2_COMPETING_TESTS_INSUFFICIENT')
  : counts[0]<counts[1] ? 'C3_HAIKU_FEWER_PASSES' : counts[0]===counts[1] ? 'C3_COMPETING_TIED_PASSES' : 'C3_COMPETING_HAIKU_MORE_PASSES';
process.stdout.write((result.preflight ? 'OFFLINE_PREFLIGHT_' : '')+outcome+'\n');
const summary=summarize(result.records);
for (const [name,value] of [['trials.csv',summary.csv],['comparison.md',summary.table],['checklist.md',summary.checklist],['verification.txt',MARKER+'\n']]) {
  fs.writeFileSync(name,value,{flag:'wx',mode:0o600});
}
process.stdout.write('C4_COMPLETE_SIX_TRIAL_ROWS\n'+MARKER+'\n');
