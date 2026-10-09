import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const args=process.argv.slice(2);
const preflight=args.length===3&&args[2]==='--preflight-only';
if((args.length!==2&&!preflight)||args[0]!=='--output')throw new Error('usage: node run-all.mjs --output <new-directory>');
const kit=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(args[1]);
if(fs.existsSync(out))throw new Error('refuse to overwrite existing output');
fs.mkdirSync(out,{recursive:true});
function execute(name,args,cwd,limit){
const p=spawnSync(process.execPath,[path.join(kit,name),...args],{cwd,stdio:'inherit',timeout:limit,env:preflight?{...process.env,AGENT_PRACTICE_PREFLIGHT:'1',REAL_CLAUDE_BIN:path.join(kit,'preflight-cli.mjs')}:process.env});
if(p.error||p.status!==0)throw new Error(name+' failed; partial evidence preserved');
}
for(const task of ['bug-fix','add-tests','refactor']){
const dir=path.join(out,task);fs.mkdirSync(dir);
execute('run.mjs',['--task',task],dir,1800000);
const evidence=JSON.parse(fs.readFileSync(path.join(dir,'case-result.json'),'utf8'));
if(evidence.fatal)throw new Error('invalid or incomplete evidence; stopped before later tasks: '+evidence.fatal);
execute('verify.mjs',[],dir,60000);
}
if(preflight){console.log('OFFLINE_KIT_PREFLIGHT_PASS; no live comparison');process.exit(0);}
execute('summarize.mjs',['bug-fix','add-tests','refactor'].map(t=>path.join(out,t,'case-result.json')).concat(['--output',path.join(out,'kit-summary')]),out,60000);
