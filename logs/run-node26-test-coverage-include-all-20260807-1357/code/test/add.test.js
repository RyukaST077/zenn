import test from 'node:test';
import assert from 'node:assert/strict';
import { add, sub } from '../src/add.js';

test('add', () => {
  assert.equal(add(1, 2), 3);
});

test('sub', () => {
  assert.equal(sub(5, 2), 3);
});
