import test from 'node:test';
import assert from 'node:assert/strict';
import { restoreSql, fingerprints } from './verify-backup.mjs';
const sql = "CREATE DATABASE /*!32312 IF NOT EXISTS*/ `devmate`;\nUSE `devmate`;\nCREATE TABLE `Note` (\n  `id` int\n) ENGINE=InnoDB;\nINSERT INTO `Note` VALUES (1);\n-- Dump completed on 2026-11-08\n";
test('restore redirects only schema selection and preserves record text', () => {
  const out = restoreSql(sql.replace('(1);', "('USE `devmate`;');"), 'devmate', 'devmate_restorecheck_a12');
  assert.match(out, /USE `devmate_restorecheck_a12`;/);
  assert.match(out, /VALUES \('USE `devmate`;'\)/);
  assert.doesNotMatch(out, /^CREATE DATABASE/m);
});
test('live target, incomplete dump and foreign database are rejected', () => {
  assert.throws(() => restoreSql(sql, 'devmate', 'devmate'));
  assert.throws(() => restoreSql(sql.replace('-- Dump completed on', ''), 'devmate', 'devmate_restorecheck_a12'));
  assert.throws(() => restoreSql(sql + '\nUSE `another`;\n', 'devmate', 'devmate_restorecheck_a12'));
});
test('record changes are detected while dump comments are ignored', () => {
  assert.deepEqual(fingerprints(sql), fingerprints(sql + '-- another timestamp\n'));
  assert.notEqual(fingerprints(sql).dataHash, fingerprints(sql.replace('(1);', '(2);')).dataHash);
});
