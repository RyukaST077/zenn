import { debounce } from 'node:util';

const mode = process.argv[2];
const fn = debounce(() => console.log('CALLBACK'), 300);
if (mode === 'unref') fn.unref();
if (mode === 'reref') fn.unref().ref();
fn('A').catch(() => {});
console.log(`START:${mode}`);
