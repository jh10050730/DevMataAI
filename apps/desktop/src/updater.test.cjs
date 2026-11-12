const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');
const { CHECK_EVERY_MS, FIRST_CHECK_MS, createUpdater, shortError } = require('./updater.cjs');

function fakeAutoUpdater() {
  const u = new EventEmitter();
  u.checks = 0; u.installs = [];
  u.checkForUpdates = () => { u.checks++; return Promise.resolve(null); };
  u.quitAndInstall = (...args) => { u.installs.push(args); };
  return u;
}

test('업데이트 상태: 확인 → 받는 중 → 준비됨, 받는 동안 다시 확인하지 않음', () => {
  const u = fakeAutoUpdater(); const seen = [];
  const updater = createUpdater({ autoUpdater: u, onState: s => seen.push(s) });
  assert.equal(u.autoDownload, true);
  assert.equal(u.autoInstallOnAppQuit, true);
  assert.deepEqual(updater.state, { state: 'idle' });

  assert.equal(updater.check(), true);
  u.emit('checking-for-update');
  u.emit('update-available', { version: '0.2.0' });
  assert.equal(updater.check(), false);
  u.emit('download-progress', { percent: 41.6 });
  assert.deepEqual(updater.state, { state: 'downloading', version: '0.2.0', percent: 42 });
  u.emit('update-downloaded', { version: '0.2.0' });
  assert.deepEqual(updater.state, { state: 'ready', version: '0.2.0' });
  assert.equal(u.checks, 1);
  assert.deepEqual(seen.map(s => s.state), ['checking', 'available', 'downloading', 'ready']);

  // 준비된 뒤 생긴 오류는 받아 둔 업데이트를 가리지 않는다
  u.emit('error', new Error('net::ERR_INTERNET_DISCONNECTED'));
  assert.equal(updater.state.state, 'ready');
});

test('설치는 받아 둔 업데이트가 있을 때만, 종료 준비 후 조용히 설치·재시작', () => {
  const u = fakeAutoUpdater();
  const updater = createUpdater({ autoUpdater: u, onState: () => {} });
  let prepared = false;
  assert.equal(updater.install(() => { prepared = true; }), false);
  assert.equal(prepared, false);
  u.emit('update-downloaded', { version: '0.3.0' });
  assert.equal(updater.install(() => { prepared = true; }), true);
  assert.equal(prepared, true);
  assert.deepEqual(u.installs, [[true, true]]);
});

test('새 버전이 없으면 idle, 오류는 짧은 안내로', async () => {
  const u = fakeAutoUpdater();
  const updater = createUpdater({ autoUpdater: u, onState: () => {} });
  u.emit('checking-for-update'); u.emit('update-not-available', {});
  assert.deepEqual(updater.state, { state: 'idle' });
  u.emit('error', new Error('getaddrinfo ENOTFOUND github.com\n    at stack'));
  assert.deepEqual(updater.state, { state: 'error', error: '인터넷에 연결할 수 없어 업데이트를 확인하지 못했어요.' });

  u.checkForUpdates = () => Promise.reject(new Error('HttpError: 404 Not Found latest.yml'));
  assert.equal(updater.check(), true);
  await new Promise(r => setImmediate(r));
  assert.equal(updater.state.error, '아직 올라온 배포 버전이 없어요.');
  assert.equal(shortError(new Error('첫 줄\n둘째 줄')), '첫 줄');
});

test('시작 30초 뒤와 6시간마다 확인', () => {
  const u = fakeAutoUpdater(); const calls = [];
  const updater = createUpdater({ autoUpdater: u, onState: () => {} });
  const timer = kind => (fn, ms) => { calls.push([kind, ms]); fn(); return {}; };
  updater.schedule({ setTimeout: timer('once'), setInterval: timer('every') });
  assert.deepEqual(calls, [['once', FIRST_CHECK_MS], ['every', CHECK_EVERY_MS]]);
  assert.equal(FIRST_CHECK_MS, 30_000);
  assert.equal(CHECK_EVERY_MS, 6 * 60 * 60 * 1000);
});

test('update ready notice shows once per version', () => {
  const { readyToNotify } = require('./updater.cjs');
  assert.equal(readyToNotify({ state: 'ready', version: '0.3.0' }, null), true);
  assert.equal(readyToNotify({ state: 'ready', version: '0.3.0' }, '0.3.0'), false);
  assert.equal(readyToNotify({ state: 'ready', version: '0.3.1' }, '0.3.0'), true);
  assert.equal(readyToNotify({ state: 'downloading', version: '0.3.0', percent: 50 }, null), false);
  assert.equal(readyToNotify({ state: 'ready' }, null), false);
});
