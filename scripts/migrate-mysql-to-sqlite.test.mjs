import test from 'node:test';
import assert from 'node:assert/strict';
import { convertValue, rowsHash } from './migrate-mysql-to-sqlite.mjs';

test('MySQL JSON values are converted to Prisma types', () => {
  assert.equal(convertValue('DateTime', '2026-11-09 03:12:45.123000').toISOString(), '2026-11-09T03:12:45.123Z');
  assert.equal(convertValue('Boolean', 1), true);
  assert.equal(convertValue('Boolean', 0), false);
  assert.equal(convertValue('Int', '42'), 42);
  assert.equal(convertValue('String', '한글\n줄바꿈'), '한글\n줄바꿈');
  assert.equal(convertValue('DateTime', null), null);
  assert.throws(() => convertValue('DateTime', 'not a date'));
});

test('row hash ignores order but detects any value change', () => {
  const a = [{ id: '1', t: new Date('2026-01-01T00:00:00Z') }, { id: '2', t: null }];
  assert.equal(rowsHash(a, ['id', 't']), rowsHash([...a].reverse(), ['id', 't']));
  assert.notEqual(rowsHash(a, ['id', 't']), rowsHash([{ ...a[0], id: '3' }, a[1]], ['id', 't']));
});
