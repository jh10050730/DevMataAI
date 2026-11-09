import { spawn } from 'node:child_process';
import { existsSync, readFileSync, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export function databaseConfig() {
  const line = readFileSync(join(root, 'apps/api/.env'), 'utf8').split(/\r?\n/).find(l => /^\s*DATABASE_URL\s*=/.test(l));
  const raw = process.env.DATABASE_URL || line?.replace(/^\s*DATABASE_URL\s*=\s*/, '').trim().replace(/^(['"])(.*)\1$/, '$2');
  if (!raw) throw new Error('DATABASE_URL 설정을 확인하세요.');
  let url; try { url = new URL(raw); } catch { throw new Error('DATABASE_URL 형식이 올바르지 않습니다.'); }
  const name = decodeURIComponent(url.pathname.slice(1));
  if (url.protocol !== 'mysql:' || !/^[A-Za-z0-9_]{1,64}$/.test(name)) throw new Error('MySQL DB 이름을 확인하세요.');
  return { name, args: [`--host=${url.hostname}`, `--port=${url.port || 3306}`, `--user=${decodeURIComponent(url.username)}`, '--default-character-set=utf8mb4'], env: { ...process.env, MYSQL_PWD: decodeURIComponent(url.password) } };
}
export function mysqlTool(name) {
  const override = process.env[name === 'mysql' ? 'MYSQL' : 'MYSQLDUMP'];
  return override || ['8.4', '9.0', '8.0'].map(v => `C:/Program Files/MySQL/MySQL Server ${v}/bin/${name}.exe`).find(existsSync) || name;
}
export async function mysql(config, args, input = '') {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(mysqlTool('mysql'), [...config.args, '--batch', '--skip-column-names', ...args], { env: config.env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = ''; let error = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { error += chunk; });
    child.on('error', () => reject(new Error('mysql 실행 파일을 찾을 수 없습니다. MYSQL 환경변수를 확인하세요.')));
    child.on('close', code => code === 0 ? resolvePromise(output) : reject(new Error(`MySQL 명령 실패 (${code}). 서버 상태와 DB 권한을 확인하세요. ${error.match(/ERROR \d+/)?.[0] ?? ''}`)));
    child.stdin.on('error', () => {}); child.stdin.end(input);
  });
}
export async function dump(config, database, file) {
  const child = spawn(mysqlTool('mysqldump'), [...config.args, '--single-transaction', '--routines', '--triggers', '--no-tablespaces', '--set-gtid-purged=OFF', '--databases', database], { env: config.env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stderr.resume();
  const exited = new Promise((resolvePromise, reject) => {
    child.on('error', () => reject(new Error('mysqldump 실행 파일을 확인하세요.')));
    child.on('close', code => code === 0 ? resolvePromise() : reject(new Error(`백업 생성 실패 (${code}). MySQL 상태와 권한을 확인하세요.`)));
  });
  await Promise.all([exited, pipeline(child.stdout, createWriteStream(file, { flags: 'wx' }))]);
}
