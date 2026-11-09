import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { staticPath, contentType } from './server-http.mjs';
test('static server rejects encoded traversal and private files', () => {
  const root = resolve('apps/web/dist');
  for (const path of ['/%2e%2e/.env', '/.env', '/assets/../../secret', '/%00', '/a\\b', '/%zz']) assert.equal(staticPath(root, path), null);
  assert.equal(staticPath(root, '/assets/app.js'), resolve(root, 'assets/app.js'));
  assert.equal(contentType('app.js'), 'text/javascript; charset=utf-8');
});
