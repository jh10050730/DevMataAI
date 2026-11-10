// 개발 실행과 설치본에서 API·웹·마이그레이션 파일 위치를 찾는다.
// 설치본 구조(5단계 electron-builder 에서 만든다): resources/api/{dist,node_modules,prisma/migrations}, resources/web
const { readFileSync } = require('node:fs');
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

// 설치 파일에 함께 넣는 앱 기본값 (resources/api/app-defaults.json). 앱 자체의 식별 정보만 허용한다.
// 개인 토큰(Notion·GitHub 등)은 절대 넣지 않는다.
const APP_DEFAULT_KEYS = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];

/** app-defaults.json 을 읽는다. 없거나 깨졌으면 빈 값 (Google 연동만 안 될 뿐 앱은 동작) */
function loadAppDefaults(apiRoot) {
  try {
    const raw = JSON.parse(readFileSync(join(apiRoot, 'app-defaults.json'), 'utf8'));
    return Object.fromEntries(APP_DEFAULT_KEYS.filter(k => typeof raw[k] === 'string' && raw[k]).map(k => [k, raw[k]]));
  } catch { return {}; }
}

/** API 프로세스에 넘길 환경변수. 개발용 .env 보다 우선한다. 앱 기본값은 이미 있는 환경변수를 덮어쓰지 않는다. */
function apiEnv({ dataDir, config, paths, base = process.env, defaults = {} }) {
  const origin = `http://localhost:${config.port}`;
  return {
    ...defaults,
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

/** API 가 보낸 "앱 창에서 열기" 요청의 경로. 설정 화면만 허용, 아니면 null (Google 로그인 후 앱으로 돌아오기) */
function appRoute(message) {
  if (!message || message.type !== 'open-app' || typeof message.path !== 'string') return null;
  return /^\/settings(\?[^\s#]*)?$/.test(message.path) ? message.path : null;
}

/** 기본 브라우저로 열어도 되는 주소 (http/https 만) */
function isExternalUrl(url) {
  try { return ['http:', 'https:'].includes(new URL(url).protocol); } catch { return false; }
}

module.exports = { APP_DEFAULT_KEYS, appPaths, apiEnv, appRoute, loadAppDefaults, isAppUrl, isExternalUrl };
