import { createServer, request } from 'node:http';
import { spawn } from 'node:child_process';
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync, statSync, unlinkSync } from 'node:fs';
import { join, extname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { root } from './db-tools.mjs';
import { contentType, staticPath } from './server-http.mjs';

const runtime = join(root, '.runtime'); mkdirSync(runtime, { recursive: true });
const logs = createWriteStream(join(runtime, 'server.log'), { flags: 'a' });
const log = message => logs.write(`[${new Date().toISOString()}] ${message}\n`);
const webRoot = join(root, 'apps/web/dist');
const apiRoot = join(root, 'apps/api');
const env = existsSync(join(apiRoot, '.env')) ? readFileSync(join(apiRoot, '.env'), 'utf8') : '';
const apiPort = Number(process.env.PORT || env.match(/^PORT\s*=\s*['"]?(\d+)/m)?.[1] || 3000);
const port = 5173;
if (!existsSync(join(webRoot, 'index.html')) || !existsSync(join(apiRoot, 'dist/main.js')) || !env) {
  log('실행 준비 실패: .env와 빌드 결과를 확인하세요. npm run build가 필요합니다.'); logs.end(); process.exitCode = 1;
} else {
  const token = randomBytes(32).toString('hex');
  let child; let stopping = false; let retry; let attempts = 0; let ownsApi = false;
  const controlFile = join(runtime, 'control.json');
  const healthy = async () => { try { const r = await fetch(`http://127.0.0.1:${apiPort}/api/health`, { signal: AbortSignal.timeout(1500) }); return r.ok && (await r.json()).status === 'ok'; } catch { return false; } };
  function startApi() {
    if (stopping) return;
    ownsApi = true; attempts++;
    child = spawn(process.execPath, ['dist/main.js'], { cwd: apiRoot, windowsHide: true, env: { ...process.env, HOST: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'pipe'] });
    const started = Date.now();
    child.stdout.on('data', data => logs.write(data)); child.stderr.on('data', data => logs.write(data));
    child.on('error', () => log('API 프로세스 실행 실패'));
    child.on('close', code => {
      log(`API 종료 (${code})`); child = undefined;
      if (Date.now() - started > 60000) attempts = 0;
      if (!stopping && attempts < 10) retry = setTimeout(startApi, 10000);
      else if (!stopping) log('API 자동 재시도 중단. MySQL 및 .env 확인 후 서버를 재시작하세요.');
    });
  }
  const server = createServer(async (req, res) => {
    const path = (req.url || '/').split('?')[0];
    if (path === '/__devmate/status') {
      res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
      return res.end(JSON.stringify({ app: 'devmate-runtime', pid: process.pid, apiHealthy: await healthy(), ownsApi, apiPort, webPort: port }));
    }
    if (path === '/__devmate/stop') {
      if (req.method !== 'POST' || req.headers['x-devmate-control'] !== token) { res.writeHead(403); return res.end('Forbidden'); }
      res.end('Stopping'); setImmediate(stop); return;
    }
    if (path === '/api' || path.startsWith('/api/')) {
      const proxy = request({ hostname: '127.0.0.1', port: apiPort, path: req.url, method: req.method, headers: { ...req.headers, host: `127.0.0.1:${apiPort}` } }, upstream => { res.writeHead(upstream.statusCode || 502, upstream.headers); upstream.pipe(res); });
      proxy.setTimeout(150000, () => proxy.destroy());
      proxy.on('error', () => { if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ message: 'API 서버 시작 중이거나 연결할 수 없습니다.' })); });
      req.pipe(proxy); return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
    let file = staticPath(webRoot, path);
    if (!file) { res.writeHead(400); return res.end('Bad path'); }
    if (!existsSync(file) || !statSync(file).isFile()) {
      if (extname(path)) { res.writeHead(404); return res.end('Not found'); }
      file = join(webRoot, 'index.html');
    }
    res.setHeader('Content-Type', contentType(file)); res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', extname(file) === '.html' ? 'no-store' : 'public, max-age=3600');
    if (req.method === 'HEAD') return res.end();
    createReadStream(file).on('error', () => { res.destroy(); }).pipe(res);
  });
  function stop() {
    if (stopping) return; stopping = true; clearTimeout(retry); child?.kill();
    try { if (JSON.parse(readFileSync(controlFile, 'utf8')).token === token) unlinkSync(controlFile); } catch {}
    server.close(() => { log('서버 종료'); logs.end(); }); server.closeIdleConnections();
    setTimeout(() => process.exit(0), 5000).unref();
  }
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  server.on('error', error => { log(error.code === 'EADDRINUSE' ? '5173 포트가 사용 중입니다. 중복 서버를 시작하지 않습니다.' : `웹 서버 시작 실패: ${error.code}`); logs.end(); process.exitCode = error.code === 'EADDRINUSE' ? 0 : 1; });
  server.listen(port, '127.0.0.1', async () => {
    writeFileSync(controlFile, JSON.stringify({ port, token, pid: process.pid, startedAt: new Date().toISOString() }));
    log(`웹 서버 시작 http://localhost:${port}`);
    if (await healthy()) log('기존 API 서버를 사용합니다. 이 실행기는 기존 API를 종료하지 않습니다.');
    else startApi();
  });
}
