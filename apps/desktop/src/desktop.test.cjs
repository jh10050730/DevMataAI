const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const net = require('node:net');
const { DEFAULT_PORT, loadConfig } = require('./config.cjs');
const { appPaths, apiEnv, isAppUrl, isExternalUrl } = require('./paths.cjs');
const { portFree } = require('./server.cjs');

test('config creates a secret once and keeps it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'devmata-desktop-'));
  try {
    const first = loadConfig(dir);
    assert.equal(first.port, DEFAULT_PORT);
    assert.match(first.jwtSecret, /^[0-9a-f]{96}$/);
    assert.equal(loadConfig(dir).jwtSecret, first.jwtSecret);
    writeFileSync(join(dir, 'config.json'), '\uFEFF{"jwtSecret":"short","port":80}');
    const fixed = loadConfig(dir);
    assert.notEqual(fixed.jwtSecret, 'short');
    assert.equal(fixed.port, DEFAULT_PORT);
    assert.equal(JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8')).jwtSecret, fixed.jwtSecret);
    writeFileSync(join(dir, 'config.json'), '{broken');
    assert.throws(() => loadConfig(dir), /설정 파일/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('paths and API environment for dev and installed layouts', () => {
  const dev = appPaths({ packaged: false, sourceDir: 'C:/repo/apps/desktop/src' });
  assert.match(dev.apiMain, /repo[\\/]apps[\\/]api[\\/]dist[\\/]main\.js$/);
  assert.match(dev.web, /repo[\\/]apps[\\/]web[\\/]dist$/);
  const installed = appPaths({ packaged: true, resourcesPath: 'C:/Program Files/DevMata AI/resources' });
  assert.match(installed.migrations, /resources[\\/]api[\\/]prisma[\\/]migrations$/);
  const env = apiEnv({ dataDir: 'C:\\Users\\me\\AppData\\Roaming\\DevMata AI', config: { port: 47390, jwtSecret: 's'.repeat(64) }, paths: installed, base: { PATH: 'x', DATABASE_URL: 'mysql://old' } });
  assert.equal(env.DATABASE_URL, 'file:C:/Users/me/AppData/Roaming/DevMata AI/devmata.db');
  assert.equal(env.HOST, '127.0.0.1');
  assert.equal(env.WEB_ORIGIN, 'http://localhost:47390');
  assert.equal(env.DB_AUTO_MIGRATE, 'true');
  assert.equal(env.ELECTRON_RUN_AS_NODE, '1');
  assert.equal(env.PATH, 'x');
});

test('only the local app origin stays inside the window', () => {
  assert.equal(isAppUrl('http://localhost:47390/calendar', 47390), true);
  assert.equal(isAppUrl('http://127.0.0.1:47390/', 47390), true);
  assert.equal(isAppUrl('http://localhost:3000/', 47390), false);
  assert.equal(isAppUrl('https://accounts.google.com/o/oauth2', 47390), false);
  assert.equal(isExternalUrl('https://github.com'), true);
  assert.equal(isExternalUrl('file:///C:/Windows'), false);
  assert.equal(isExternalUrl('javascript:alert(1)'), false);
});

test('port check detects a busy port', async () => {
  const server = net.createServer();
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  assert.equal(await portFree(port), false);
  await new Promise(r => server.close(r));
  assert.equal(await portFree(port), true);
});
