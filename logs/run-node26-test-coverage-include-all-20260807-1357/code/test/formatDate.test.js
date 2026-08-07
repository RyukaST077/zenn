import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDate } from '../src/formatDate.js';

test('formatDate', () => {
  assert.equal(formatDate(new Date('2026-08-07T00:00:00Z')), '2026-08-07');
});
