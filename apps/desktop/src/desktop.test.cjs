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
  assert.equal(env.DB_BACKUP_DIR, 'C:\\Users\\me\\AppData\\Roaming\\DevMata AI\\backups');
  assert.equal(env.ELECTRON_RUN_AS_NODE, '1');
  assert.equal(env.PATH, 'x');
  assert.equal(env.DEVMATA_DATA_DIR, 'C:\\Users\\me\\AppData\\Roaming\\DevMata AI');
  assert.equal(env.DEVMATA_LOG_DIR, 'C:\\Users\\me\\AppData\\Roaming\\DevMata AI\\logs');
  assert.equal(env.DEVMATA_VERSION, undefined);
  assert.equal(apiEnv({ dataDir: 'C:/d', config: { port: 1, jwtSecret: 's' }, paths: installed, base: {}, version: '1.2.3' }).DEVMATA_VERSION, '1.2.3');
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

test('logo matches the web favicon and renders a bitmap', () => {
  const { logoSvg, logoBitmap } = require('./brand.cjs');
  const favicon = readFileSync(join(__dirname, '..', '..', 'web', 'public', 'favicon.svg'), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(favicon, logoSvg(), 'favicon.svg 가 brand.cjs 와 다릅니다. logoSvg() 로 다시 만드세요.');
  const px = logoBitmap(32);
  assert.equal(px.length, 32 * 32 * 4);
  assert.equal(px[3], 0); // 둥근 모서리 바깥은 투명
  const left = (16 * 32 + 3) * 4;
  assert.deepEqual([...px.subarray(left, left + 4)], [0xeb, 0x72, 0x22, 255]); // 바탕은 #2272eb (BGRA)
  let white = 0;
  for (let i = 0; i < px.length; i += 4) if (px[i] === 255 && px[i + 1] === 255 && px[i + 2] === 255) white++;
  assert.ok(white > 30, '흰 레이어 아이콘이 그려져야 합니다');
});

test('app defaults fill in Google keys without overriding real settings', () => {
  const { apiEnv, loadAppDefaults } = require('./paths.cjs');
  const dir = mkdtempSync(join(tmpdir(), 'devmata-defaults-'));
  try {
    writeFileSync(join(dir, 'app-defaults.json'), JSON.stringify({ GOOGLE_CLIENT_ID: 'cid', GOOGLE_CLIENT_SECRET: 'cs', NOTION_TOKEN: 'leak' }));
    const defaults = loadAppDefaults(dir);
    assert.deepEqual(defaults, { GOOGLE_CLIENT_ID: 'cid', GOOGLE_CLIENT_SECRET: 'cs' }); // 허용된 키만
    const paths = { web: 'w', migrations: 'm' }; const config = { port: 47390, jwtSecret: 's'.repeat(64) };
    assert.equal(apiEnv({ dataDir: dir, config, paths, base: {}, defaults }).GOOGLE_CLIENT_ID, 'cid');
    assert.equal(apiEnv({ dataDir: dir, config, paths, base: { GOOGLE_CLIENT_ID: 'mine' }, defaults }).GOOGLE_CLIENT_ID, 'mine');
    assert.deepEqual(loadAppDefaults(join(dir, 'none')), {});
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('only settings routes from the API open in the app window', () => {
  const { appRoute } = require('./paths.cjs');
  assert.equal(appRoute({ type: 'open-app', path: '/settings?google=connected' }), '/settings?google=connected');
  assert.equal(appRoute({ type: 'open-app', path: '/settings' }), '/settings');
  assert.equal(appRoute({ type: 'open-app', path: 'https://evil.example/' }), null);
  assert.equal(appRoute({ type: 'open-app', path: '//evil.example/settings' }), null);
  assert.equal(appRoute({ type: 'open-app', path: '/calendar' }), null);
  assert.equal(appRoute({ type: 'ready', port: 1 }), null);
  assert.equal(appRoute(null), null);
});

test('log rotation keeps a few old files', () => {
  const { rotateLog } = require('./server.cjs');
  const { existsSync } = require('node:fs');
  const dir = mkdtempSync(join(tmpdir(), 'devmata-log-'));
  try {
    const file = join(dir, 'api.log');
    writeFileSync(file, 'small');
    assert.equal(rotateLog(file, 100), false);
    for (let i = 1; i <= 5; i++) { writeFileSync(file, `run${i}`.padEnd(200, '.')); assert.equal(rotateLog(file, 100, 3), true); }
    assert.equal(existsSync(file), false);
    assert.match(readFileSync(join(dir, 'api.1.log'), 'utf8'), /^run5/);
    assert.match(readFileSync(join(dir, 'api.3.log'), 'utf8'), /^run3/);
    assert.equal(existsSync(join(dir, 'api.4.log')), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('Claude Code is found on PATH or in the official install folders', () => {
  const { findClaude } = require('./paths.cjs');
  // 경로 구분자는 OS 마다 다르므로 / 로 맞춰 비교한다
  const norm = f => f.replace(/\\/g, '/');
  const files = new Set(['C:/Users/me/.local/bin/claude.exe', 'D:/tools/claude.exe']);
  const exists = f => files.has(norm(f));
  assert.equal(norm(findClaude({ PATH: 'D:/tools', USERPROFILE: 'C:/Users/me' }, exists)), 'D:/tools/claude.exe');
  assert.equal(norm(findClaude({ PATH: '', USERPROFILE: 'C:/Users/me' }, exists)), 'C:/Users/me/.local/bin/claude.exe');
  assert.equal(findClaude({ PATH: '', USERPROFILE: 'C:/Users/other' }, exists), null);
});

test('local password reset requests are checked before showing a dialog', () => {
  const { resetRoute } = require('./paths.cjs');
  const token = 'a'.repeat(64);
  assert.deepEqual(resetRoute({ type: 'reset-password', email: 'me@example.com', path: `/reset-password#token=${token}` }), { email: 'me@example.com', path: `/reset-password#token=${token}` });
  assert.equal(resetRoute({ type: 'reset-password', email: 'me@example.com', path: '/settings' }), null);
  assert.equal(resetRoute({ type: 'reset-password', email: 'me@example.com', path: `/reset-password#token=${token}&x=1` }), null);
  assert.equal(resetRoute({ type: 'reset-password', email: 'a\nb', path: `/reset-password#token=${token}` }), null);
  assert.equal(resetRoute({ type: 'open-app', path: '/settings' }), null);
});

test('folder open requests only name a known folder; the app decides the path', () => {
  const { folderTarget } = require('./paths.cjs');
  assert.equal(folderTarget({ type: 'open-folder', target: 'data' }), 'data');
  assert.equal(folderTarget({ type: 'open-folder', target: 'logs' }), 'logs');
  assert.equal(folderTarget({ type: 'open-folder', target: 'C:/Windows' }), null);
  assert.equal(folderTarget({ type: 'open-app', target: 'data' }), null);
  assert.equal(folderTarget(null), null);
});
