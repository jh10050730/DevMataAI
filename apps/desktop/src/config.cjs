// 데스크톱 앱 설정 파일(%APPDATA%\DevMata AI\config.json): JWT 비밀값을 처음 실행 때 만들어 보관한다.
const { randomBytes } = require('node:crypto');
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

/** 개발 서버(3000/5173)와 겹치지 않는 데스크톱 전용 포트 */
const DEFAULT_PORT = 47390;

function loadConfig(dataDir) {
  mkdirSync(dataDir, { recursive: true });
  const file = join(dataDir, 'config.json');
  let config = {};
  if (existsSync(file)) {
    try { config = JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, '')); } catch { throw new Error(`설정 파일을 읽을 수 없습니다: ${file}`); }
  }
  let changed = false;
  if (typeof config.jwtSecret !== 'string' || config.jwtSecret.length < 32) { config.jwtSecret = randomBytes(48).toString('hex'); changed = true; }
  if (!Number.isInteger(config.port) || config.port < 1024 || config.port > 65535) { config.port = DEFAULT_PORT; changed = true; }
  // 비밀값이 들어 있으므로 현재 사용자만 읽을 수 있게 저장한다 (Windows 는 사용자 프로필 폴더 권한을 따른다).
  if (changed) writeFileSync(file, JSON.stringify(config, null, 2), { mode: 0o600 });
  return config;
}

module.exports = { DEFAULT_PORT, loadConfig };
