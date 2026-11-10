// 개발 실행과 설치본에서 API·웹·마이그레이션 파일 위치를 찾는다.
// 설치본 구조(5단계 electron-builder 에서 만든다): resources/api/{dist,node_modules,prisma/migrations}, resources/web
const { join, resolve } = require('node:path');

function appPaths({ packaged, resourcesPath, sourceDir = __dirname }) {
  if (packaged) {
    const api = join(resourcesPath, 'api');
    return { apiRoot: api, apiMain: join(api, 'dist', 'main.js'), migrations: join(api, 'prisma', 'migrations'), web: join(resourcesPath, 'web') };
  }
  const repo = resolve(sourceDir, '..', '..', '..');
  const api = join(repo, 'apps', 'api');
  return { apiRoot: api, apiMain: join(api, 'dist', 'main.js'), migrations: join(api, 'prisma', 'migrations'), web: join(repo, 'apps', 'web', 'dist') };
}

/** API 프로세스에 넘길 환경변수. 개발용 .env 보다 우선한다. */
function apiEnv({ dataDir, config, paths, base = process.env }) {
  const origin = `http://localhost:${config.port}`;
  return {
    ...base,
    ELECTRON_RUN_AS_NODE: '1',
    NODE_ENV: 'production',
    HOST: '127.0.0.1',
    PORT: String(config.port),
    WEB_ORIGIN: origin,
    WEB_DIST: paths.web,
    DATABASE_URL: `file:${join(dataDir, 'devmata.db').replace(/\\/g, '/')}`,
    DB_AUTO_MIGRATE: 'true',
    DB_MIGRATIONS_DIR: paths.migrations,
    JWT_SECRET: config.jwtSecret,
    DEVMATA_DESKTOP: '1',
  };
}

/** 앱 창 안에서 열어도 되는 주소인지 (그 밖은 기본 브라우저로 연다) */
function isAppUrl(url, port) {
  try { const u = new URL(url); return u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname) && Number(u.port) === port; } catch { return false; }
}

/** 기본 브라우저로 열어도 되는 주소 (http/https 만) */
function isExternalUrl(url) {
  try { return ['http:', 'https:'].includes(new URL(url).protocol); } catch { return false; }
}

module.exports = { appPaths, apiEnv, isAppUrl, isExternalUrl };
