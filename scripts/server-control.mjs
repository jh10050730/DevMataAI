import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { root } from './db-tools.mjs';
// Windows PowerShell 5.1의 Set-Content -Encoding UTF8은 BOM을 붙이므로 제거하고 읽는다.
const read = path => { try { return JSON.parse(readFileSync(path, 'utf8').replace(/^﻿/, '')); } catch { return null; } };
const control = read(join(root, '.runtime/control.json'));
if (process.argv[2] === 'stop') {
  if (!control) console.log('관리 중인 서버가 없습니다.');
  else {
    try {
      const res = await fetch(`http://127.0.0.1:${control.port}/__devmate/stop`, { method: 'POST', headers: { 'x-devmate-control': control.token }, signal: AbortSignal.timeout(3000) });
      if (!res.ok) throw new Error(); console.log('서버 종료 요청 완료');
    } catch { console.error('서버 종료 요청에 실패했습니다. .runtime/server.log를 확인하세요.'); process.exitCode = 1; }
  }
} else {
  let runtime = { running: false };
  try { const response = await fetch('http://127.0.0.1:5173/__devmate/status', { signal: AbortSignal.timeout(2500) }); const body = await response.json(); if (body.app === 'devmate-runtime') runtime = { running: true, ...body }; } catch {}
  const startup = read(join(root, '.runtime/autostart.json'));
  const backups = join(root, 'backups');
  const latest = existsSync(backups) ? readdirSync(backups).filter(n => /^devmata-\d{8}-\d{6}\.db$/.test(n)).sort().at(-1) ?? null : null;
  console.log(JSON.stringify({ ...runtime, autostart: !!startup && existsSync(startup.shortcut), latestBackup: latest, verification: read(join(backups, 'last-verification.json')), log: '.runtime/server.log' }, null, 2));
}
