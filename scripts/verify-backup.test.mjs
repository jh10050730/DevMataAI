import test from 'node:test';
import assert from 'node:assert/strict';
import { restoreSql, fingerprints } from './verify-backup.mjs';
const sql = "CREATE DATABASE /*!32312 IF NOT EXISTS*/ `devmate`;\nUSE `devmate`;\nCREATE TABLE `Note` (\n  `id` int\n) ENGINE=InnoDB;\nINSERT INTO `Note` VALUES (1);\n-- Dump completed on 2026-11-08\n";
test('restore redirects only schema selection and preserves record text', () => {
  const out = restoreSql(sql.replace('(1);', "('USE `devmate`;');"), 'devmate', 'devmate_restorecheck_a12');
  assert.match(out, /^USE `devmate_restorecheck_a12`;\n/);
  assert.match(out, /USE `devmate_restorecheck_a12`;/);
  assert.match(out, /VALUES \('USE `devmate`;'\)/);
  assert.doesNotMatch(out, /^CREATE DATABASE/m);
});
test('table lock statements are removed but record text mentioning them is kept', () => {
  const locked = sql.replace('INSERT INTO `Note` VALUES (1);', "LOCK TABLES `Note` WRITE;\nINSERT INTO `Note` VALUES ('LOCK TABLES `Note` WRITE;');\nUNLOCK TABLES;");
  const out = restoreSql(locked, 'devmate', 'devmate_restorecheck_a12');
  assert.doesNotMatch(out, /^LOCK TABLES/m);
  assert.doesNotMatch(out, /^UNLOCK TABLES/m);
  assert.match(out, /VALUES \('LOCK TABLES `Note` WRITE;'\)/);
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
test('implied column character set does not change the schema hash, a different collation does', () => {
  const col = c => sql.replace('`id` int', '`name` varchar(9) ' + c + ' NOT NULL');
  const base = fingerprints(col('COLLATE utf8mb4_unicode_ci')).schemaHash;
  assert.equal(fingerprints(col('CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci')).schemaHash, base);
  assert.notEqual(fingerprints(col('COLLATE utf8mb4_bin')).schemaHash, base);
  assert.equal(fingerprints(sql.replace('(1);', "('CHARACTER SET utf8mb4 COLLATE utf8mb4_bin');")).dataHash, fingerprints(sql.replace('(1);', "('CHARACTER SET utf8mb4 COLLATE utf8mb4_bin');")).dataHash);
});
