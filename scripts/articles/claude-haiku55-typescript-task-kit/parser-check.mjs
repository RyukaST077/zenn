import assert from 'node:assert/strict';
import { parse } from './run.mjs';
const model='claude-haiku-5-5';
const usage={[model]:{inputTokens:1,outputTokens:2,cacheReadInputTokens:3,cacheCreationInputTokens:4}};
const final={type:'result',subtype:'success',is_error:false,modelUsage:usage};
const tests=[
['permitted read',{type:'assistant',message:{content:[{type:'tool_use',name:'Read'}]}},null],
['forbidden shell',{type:'assistant',message:{content:[{type:'tool_use',name:'Bash',input:{command:'ls -la && cat SPEC.md'}}]}},'forbidden-tool'],
['hook',{type:'system',subtype:'hook_started'},'unexpected-hook-or-compaction'],
['mcp',{type:'system',subtype:'init',mcp_servers:[{}]},'unexpected-mcp']];
for(const [name,e,reason] of tests){
const o=parse({stdout:[e,final].map(x=>JSON.stringify(x)).join('\n'),stderr:'',code:0,error:false,timed_out:false},model,false);
assert.equal(o.invalid,reason,name);assert.equal(o.tokens.outputTokens,2);assert.ok(o.evidence_events.length);
}
console.log('PARSER_BOUNDARIES_AND_INVALID_EVIDENCE_PASS');
