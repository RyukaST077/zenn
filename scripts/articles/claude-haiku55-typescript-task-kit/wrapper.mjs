#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { PROMPT } from './contract.mjs';
import { run } from './run.mjs';

const expected = ['-p',PROMPT,'--output-format','stream-json','--verbose','--no-session-persistence',
  '--setting-sources','project','--permission-mode','bypassPermissions','--tools','Read,Edit,Write,Bash','--effort','medium'];
if (JSON.stringify(process.argv.slice(2)) !== JSON.stringify(expected)) throw new Error('HARNESS: buildAgentArgs contract mismatch');
const task = /^<!-- task: (bug-fix|add-tests|refactor) -->/m.exec(fs.readFileSync('CLAUDE.md','utf8'))?.[1];
if (!task || path.basename(process.cwd()) !== task) throw new Error('HARNESS: guidance/case selector mismatch');
await run(task, { adapter: true });
