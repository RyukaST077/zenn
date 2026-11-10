#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { applyAnswer } from './self-check.mjs';

const credential = /TOKEN|SECRET|PASSWORD|PASSWD|API[_-]?KEY|AUTHORIZATION|CREDENTIAL|COOKIE/i;
const harmless = new Set(['PATH','TMPDIR','LANG','LC_ALL','TERM','NO_COLOR','CI','MallocNanoZone','__CF_USER_TEXT_ENCODING','NODE_DISABLE_COLORS']);
if (Object.keys(process.env).some(k => credential.test(k) || !harmless.has(k))) throw new Error('offline preflight environment rejected');
const args = process.argv.slice(2);
if (args.length !== 4 || args[0] !== '--fixture-task' || args[2] !== '--fixture-ordinal') throw new Error('offline preflight arguments rejected');
const task = args[1], ordinal = Number(args[3]);
if (!['bug-fix','add-tests','refactor'].includes(task) || !Number.isInteger(ordinal) || ordinal < 0 || ordinal > 5) throw new Error('offline fixture selector rejected');
// Synchronous artifact creation completes before this fake CLI exits; no background work.
if (task !== 'refactor' || [1,2,5].includes(ordinal)) applyAnswer(task, process.cwd());
if (task === 'add-tests' && ordinal === 3) fs.writeFileSync(path.join(process.cwd(),'tests/discount.test.json'), '[{"name":"weak","input":[100,50,100],"expected":50}]\n');
const events = [
  { type: 'system', subtype: 'init', fixture: true },
  { type: 'assistant', message: {content: [{type:'tool_use',name:'Read',input:{file_path:'SPEC.md'}},{type:'tool_use',name:'Write',input:{file_path:'src/example.ts'}}]} },
  { type: 'result', parent_tool_use_id: 'nested-fixture', subtype: 'success', result: 'nested result deliberately ignored' },
  { type: 'result', parent_tool_use_id: null, subtype: 'success', is_error: false, num_turns: 1, result: 'offline fixture complete',
    modelUsage: { 'offline-fixture': { inputTokens: 1, outputTokens: 2, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 } } },
];
for (const event of events) process.stdout.write(JSON.stringify(event) + '\n');
