#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { MODELS, PROMPT, ORDER, TRIAL_SECONDS, TURNS, VERSION } from './contract.mjs';
import { compiler, tsApi } from './public-support.mjs';
import { grade, snapshot, tasks } from './grade.mjs';
import { fixture, prepare, selfCheck } from './self-check.mjs';

const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const hashFiles = files => Object.fromEntries(Object.entries(files).map(([p,s]) => [p,sha(s)]));
const credential = /TOKEN|SECRET|PASSWORD|PASSWD|API[_-]?KEY|AUTHORIZATION|CREDENTIAL|COOKIE/i;
const override = /^(?:ANTHROPIC_|AWS_|AZURE_|GOOGLE_|OPENAI_|HTTP_PROXY$|HTTPS_PROXY$|ALL_PROXY$|NO_PROXY$|CLAUDE_CONFIG_DIR$|CLAUDE_MODEL$|CLAUDE_CODE_(?:USE_|SUBAGENT_MODEL|EFFORT_LEVEL|MAX_OUTPUT_TOKENS)|NODE_OPTIONS$|NODE_PATH$|CLAUDE_BIN$|REAL_CLAUDE_BIN$|AGENT_PRACTICE_)/i;
function environment(preflight) {
  if (preflight) return { PATH: process.env.PATH || '/usr/bin:/bin', TMPDIR: os.tmpdir(), LANG: 'C', LC_ALL: 'C', TERM: 'dumb', NO_COLOR: '1', CI: '1' };
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !credential.test(k) && !override.test(k)));
  if (!env.HOME || !env.USER || !env.LOGNAME) throw new Error('AUTH: existing HOME/USER/LOGNAME missing');
  return { ...env, CI:'1', DISABLE_AUTOUPDATER:'1', DISABLE_TELEMETRY:'1', DISABLE_ERROR_REPORTING:'1',
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC:'1', CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY:'1', NO_COLOR:'1' };
}
function binary() {
  const selected = process.env.REAL_CLAUDE_BIN || String(process.env.PATH || '').split(path.delimiter)
    .map(p => path.join(p,'claude')).find(p => fs.existsSync(p));
  if (!selected) throw new Error('AUTH: existing Claude CLI unavailable');
  return fs.realpathSync(selected);
}
function invoke(bin,args,env,cwd,seconds) {
  const start = performance.now();
  const p = spawnSync(bin,args,{env,cwd,encoding:'utf8',timeout:seconds*1000,maxBuffer:16*1024*1024});
  return { code:p.status, timed_out:p.error?.code === 'ETIMEDOUT', error:!!p.error, signal:p.signal,
    elapsed_ms:performance.now()-start, stdout:p.stdout || '', stderr:p.stderr || '' };
}
function parse(p, model, preflight) {
  let events;
  try { events=p.stdout.split(/\r?\n/).filter(x=>x.trim()).map(x=>JSON.parse(x)); }
  catch { return {invalid:'malformed-stream',censored:false,evidence_events:[]}; }
  const top=events.filter(e=>e.parent_tool_use_id == null);
  const final=top.filter(e=>e.type==='result').at(-1);
  const init=top.find(e=>e.type==='system'&&e.subtype==='init');
  const calls=top.filter(e=>e.type==='assistant').flatMap(e=>e.message?.content||[]).filter(x=>x.type==='tool_use');
  const usage=final?.modelUsage;
  const ids=[...new Set([...(usage&&typeof usage==='object'?Object.keys(usage):[]),...top.filter(e=>e.type==='assistant').map(e=>e.message?.model).filter(Boolean),...(init?.model?[init.model]:[])])];
  const names=['inputTokens','outputTokens','cacheReadInputTokens','cacheCreationInputTokens'];
  const tokens=Object.fromEntries(names.map(n=>[n,usage&&Object.keys(usage).length&&Object.values(usage).every(u=>Number.isFinite(u?.[n])&&u[n]>=0)?Object.values(usage).reduce((a,u)=>a+u[n],0):null]));
  const missing=names.filter(n=>tokens[n]===null);
  const observedEffort=init?.effort??init?.reasoning_effort??null;
  const messages=new Map();
  for(const e of top.filter(e=>e.type==='assistant'&&e.message?.id))messages.set(e.message.id,e.message.usage);
  const prompts=[...messages.values()].map(u=>['input_tokens','cache_read_input_tokens','cache_creation_input_tokens'].every(k=>Number.isFinite(u?.[k]))?u.input_tokens+u.cache_read_input_tokens+u.cache_creation_input_tokens:null).filter(v=>v!==null);
  const observation={invalid:null,censored:false,tokens,missing,model_usage:usage??null,parent_usage:final?.usage??null,model_ids:ids,effort_observed:observedEffort,
    maximum_prompt_tokens:prompts.length?Math.max(...prompts):null,total_cost_usd:typeof final?.total_cost_usd==='number'?final.total_cost_usd:null,
    cli_duration_ms:final?.duration_ms??null,cli_duration_api_ms:final?.duration_api_ms??null,result_subtype:final?.subtype??null,
    top_level_result_events:top.filter(e=>e.type==='result').length,observed_turns:final?.num_turns??null,
    evidence_events:top.map(e=>({type:e.type,subtype:e.subtype??null,model:e.message?.model??e.model??null,effort:e.effort??e.reasoning_effort??null,
      usage:e.message?.usage??null,mcp_count:e.type==='system'&&e.subtype==='init'?(e.mcp_servers?.length||0):null,
      tool_calls:(e.message?.content||[]).filter(x=>x.type==='tool_use').map(x=>({name:x.name,allowed:['Read','Edit','Write'].includes(x.name)}))}))};
  const reject=(invalid,censored=false)=>({...observation,invalid,censored});
  const errorText=p.stderr+'\n'+top.filter(e=>e.type==='result').map(e=>String(e.result||'')).join('\n');
  if(/auth(?:entication)? (?:failed|required)|not logged in|please log in|API key|extra usage|additional credits|billing|rate.?limit|usage limit|overloaded|service unavailable|network error|permission denied|permission prompt/i.test(errorText))return reject('auth-service-permission-or-billing');
  if(p.timed_out||final?.subtype==='error_max_turns')return reject(null,true);
  if(p.error||p.code!==0||!final||final.is_error||final.subtype!=='success')return reject('incomplete-cli-result');
  if(calls.some(x=>!['Read','Edit','Write'].includes(x.name)))return reject('forbidden-tool');
  if(top.some(e=>/compact|hook/.test(String(e.subtype||''))))return reject('unexpected-hook-or-compaction');
  if(init?.mcp_servers?.length)return reject('unexpected-mcp');
  if(observedEffort!==null&&observedEffort!=='medium')return reject('effective-effort-mismatch');
  if(!preflight&&(ids.length===0||ids.some(id=>id!==model&&!id.startsWith(model+'-'))))return reject('model-fallback-or-mismatch');
  if(missing.length)return reject('token-schema-missing');
  return observation;
}
export { parse };
export async function run(task,{adapter=false}={}) {
  if (!tasks.includes(task)) throw new Error('HARNESS: unsupported task');
  const root = fs.realpathSync(process.cwd());
  if (fs.existsSync(path.join(root,'case-result.json'))) throw new Error('HARNESS: refuse to overwrite evidence');
  const preflight = process.env.AGENT_PRACTICE_PREFLIGHT === '1', bin = binary(), env = environment(preflight);
  if (preflight && bin !== fs.realpathSync(path.join(fixture,'preflight-cli.mjs'))) throw new Error('SAFETY: preflight did not select offline fake CLI');
  const stopPath = adapter ? path.join(path.dirname(root),'.haiku55-kit-stop.json') : null;
  const result = { version:1, task, preflight, calibration:null, authentication:null, records:[],
    compiler:{version:tsApi().version,sha256:sha(fs.readFileSync(compiler()))},
    cli_sha256:sha(fs.readFileSync(bin)), launch:{turns:TURNS,trial_timeout_seconds:TRIAL_SECONDS,requested_effort:'medium',
      models:MODELS,order:ORDER,network_isolated:false,existing_home_preserved:!preflight,subscription_only:true,tools:['Read','Edit','Write'],model_can_run_tests:false}, fatal:null };
  let temp;
  function fatal(code) {
    result.fatal = code;
    if (stopPath && !preflight && !fs.existsSync(stopPath)) fs.writeFileSync(stopPath,JSON.stringify({blocked:true,reason:code}),{flag:'wx',mode:0o600});
  }
  try {
    if (stopPath && fs.existsSync(stopPath) && !preflight) throw new Error('COHORT: previous case stopped the cohort');
    if (result.compiler.version !== '5.9.2') throw new Error('HARNESS: compiler version changed');
    result.calibration = selfCheck(task);
    if (!preflight) {
      const a = invoke(bin,['auth','status','--json'],env,root,30);
      let auth; try { auth = JSON.parse(a.stdout); } catch { throw new Error('AUTH: auth status schema unavailable'); }
      result.authentication = {loggedIn:auth.loggedIn,authMethod:auth.authMethod,apiProvider:auth.apiProvider,subscriptionType:auth.subscriptionType};
      if (a.code !== 0 || a.error || auth.loggedIn !== true || auth.authMethod !== 'claude.ai' || auth.apiProvider !== 'firstParty'
        || !['team','max','pro','enterprise'].includes(String(auth.subscriptionType).toLowerCase())) throw new Error('AUTH: existing subscription authentication not retained');
      const v = invoke(bin,['--version'],env,root,30);
      if (v.code !== 0 || !v.stdout.startsWith(VERSION+' ')) throw new Error('HARNESS: Claude version changed from recorded version');
    }
    temp = fs.mkdtempSync(path.join(os.tmpdir(),'haiku55-task-attempts-'));
    const repeats = [0,0];
    for (let ordinal=0; ordinal<6; ordinal++) {
      const modelIndex=ORDER[ordinal], model=MODELS[modelIndex], repeat=++repeats[modelIndex];
      const work=path.join(temp,String(ordinal)); prepare(task,work);
      const before=snapshot(work);
      const permissions={permissions:{allow:['Read(./**)','Edit(./src/**)','Write(./src/**)','Edit(./tests/**)','Write(./tests/**)']}};
      const args=preflight ? ['--fixture-task',task,'--fixture-ordinal',String(ordinal)] : [
        '-p',PROMPT,'--output-format','stream-json','--verbose','--no-session-persistence','--safe-mode',
        '--setting-sources','project','--permission-mode','dontAsk','--tools','Read,Edit,Write',
        '--settings',JSON.stringify(permissions),'--max-turns',String(TURNS),'--model',model,'--effort','medium',
      ];
      const p=invoke(bin,args,env,work,TRIAL_SECONDS), observation=parse(p,model,preflight);
      const entry={task,model,repeat,ordinal,status:observation.censored ? 'censored' : observation.invalid ? 'invalid' : 'valid',
        elapsed_ms:p.elapsed_ms,verified_elapsed_ms:null,process:{exit_code:p.code,timed_out:p.timed_out,signal:p.signal},observation,
        initial_hashes:hashFiles(before),candidate:null,grade:null};
      try {
        const gradingStart=performance.now();
        entry.candidate=snapshot(work);
        entry.final_hashes=hashFiles(entry.candidate);
        entry.grade=grade(task,work,before);
        entry.verified_elapsed_ms=p.elapsed_ms+performance.now()-gradingStart;
      } catch(e) { entry.status='invalid'; entry.observation.invalid=/^SAFETY:/.test(e.message) ? 'candidate-safety-boundary' : 'grading-harness'; }
      result.records.push(entry);
      // Emit only structured, non-secret observations; raw stdout/stderr are never persisted.
      process.stdout.write(JSON.stringify({type:'fixture_trial',task,model,repeat,status:entry.status,marker:entry.grade?.marker || null})+'\n');
      if (entry.status !== 'valid') { fatal(entry.observation.invalid || 'censored-at-bound'); break; }
    }
  } catch(e) { fatal(/^COHORT:/.test(e.message) ? 'cohort-stopped-before-case' : /^AUTH:/.test(e.message) ? 'subscription-authentication-unavailable' : /^SAFETY:/.test(e.message) ? 'safety-boundary' : 'harness-calibration-version-or-cohort'); }
  finally {
    if (temp) fs.rmSync(temp,{recursive:true});
    fs.writeFileSync(path.join(root,'case-result.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
  }
  process.stdout.write(JSON.stringify({type:'result',subtype:'success',is_error:false,result:'Independent trial evidence captured; see case-result.json, not this synthetic adapter result.'})+'\n');
}
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--task') throw new Error('usage: node run.mjs --task bug-fix|add-tests|refactor (fresh output directory)');
  await run(args[1]);
}
