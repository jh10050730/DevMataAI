// API 서버(NestJS)를 Electron 의 Node 로 별도 프로세스에서 실행하고, 준비될 때까지 기다린다.
const { fork } = require('node:child_process');
const { createWriteStream, existsSync, mkdirSync, renameSync, rmSync, statSync } = require('node:fs');
const net = require('node:net');
const { join } = require('node:path');

/**
 * 로그가 maxBytes 를 넘으면 api.log → api.1.log → api.2.log … 로 밀어내고 keep 개만 남긴다.
 * 앱을 켤 때마다 확인하므로, 한 번 실행 중에는 그보다 조금 커질 수 있다.
 */
function rotateLog(file, maxBytes = 5 * 1024 * 1024, keep = 3) {
  try {
    if (!existsSync(file) || statSync(file).size < maxBytes) return false;
    const old = i => file.replace(/\.log$/, `.${i}.log`);
    rmSync(old(keep), { force: true });
    for (let i = keep - 1; i >= 1; i--) if (existsSync(old(i))) renameSync(old(i), old(i + 1));
    renameSync(file, old(1));
    return true;
  } catch { return false; } // 로그 정리 실패로 앱이 멈추면 안 된다
}

/** 포트가 비어 있는지 (127.0.0.1) */
function portFree(port) {
  return new Promise(resolve => {
    const probe = net.createServer().once('error', () => resolve(false)).once('listening', () => probe.close(() => resolve(true)));
    probe.listen(port, '127.0.0.1');
  });
}

async function healthy(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(1500) });
    return res.ok && (await res.json()).status === 'ok';
  } catch { return false; }
}

/**
 * API 프로세스를 시작한다. 준비되면 resolve, 시작 전에 종료되거나 시간이 지나면 reject.
 * 돌려준 child 는 앱 종료 때 kill 한다.
 */
async function startApi({ paths, env, port, logDir, timeoutMs = 90000 }) {
  if (!existsSync(paths.apiMain)) throw new Error(`API 빌드가 없습니다: ${paths.apiMain}\nnpm run build 를 먼저 실행하세요.`);
  if (!(await portFree(port))) throw new Error(`포트 ${port} 를 다른 프로그램이 쓰고 있습니다.\nDevMata AI 가 이미 실행 중인지 확인하세요.`);
  mkdirSync(logDir, { recursive: true });
  rotateLog(join(logDir, 'api.log'));
  const log = createWriteStream(join(logDir, 'api.log'), { flags: 'a' });
  log.write(`\n[${new Date().toISOString()}] API 시작 (port ${port})\n`);
  const child = fork(paths.apiMain, [], { cwd: paths.apiRoot, env, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], windowsHide: true });
  child.stdout.pipe(log, { end: false });
  child.stderr.pipe(log, { end: false });
  await new Promise((resolve, reject) => {
    let done = false;
    const finish = (error) => { if (done) return; done = true; clearTimeout(timer); clearInterval(poll); error ? reject(error) : resolve(); };
    const timer = setTimeout(() => finish(new Error(`API 가 ${Math.round(timeoutMs / 1000)}초 안에 시작되지 않았습니다. 로그: ${join(logDir, 'api.log')}`)), timeoutMs);
    // main.ts 가 보내는 ready 신호, 또는 health 응답 중 먼저 오는 것
    child.on('message', m => { if (m && m.type === 'ready') finish(); });
    const poll = setInterval(async () => { if (await healthy(port)) finish(); }, 1000);
    child.once('exit', code => finish(new Error(`API 가 시작 중에 종료되었습니다 (코드 ${code}). 로그: ${join(logDir, 'api.log')}`)));
  });
  child.on('exit', code => log.write(`[${new Date().toISOString()}] API 종료 (${code})\n`));
  return child;
}

module.exports = { portFree, healthy, rotateLog, startApi };
