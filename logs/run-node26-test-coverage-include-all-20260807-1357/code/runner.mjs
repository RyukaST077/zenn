// run() API 版: coverageIncludeAll: true が CLI フラグと同じ結果になるか確かめる
import { run } from 'node:test';
import { spec } from 'node:test/reporters';

const stream = run({
  files: [
    './test/add.test.js',
    './test/slugify.test.js',
    './test/formatDate.test.js',
  ],
  coverage: true,
  coverageIncludeAll: true,
});

stream.compose(new spec()).pipe(process.stdout);
