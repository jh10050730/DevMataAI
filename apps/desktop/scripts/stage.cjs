// 설치 파일에 넣을 API·웹 파일을 빌드 작업 폴더(build-paths.cjs, 기본 %LOCALAPPDATA%\DevMataAI-build)의 stage 에 모은다.
// (npm run desktop:dist 가 실행)
//
// 설치본 구조 (resources/ 아래):
//   api/dist, api/prisma/migrations, api/package.json, api/node_modules  ← apps/api/node_modules 중 필요한 것
//   node_modules                                                         ← 저장소 루트 node_modules 중 필요한 것 (+ .prisma/client)
//   web                                                                  ← apps/web/dist
// 저장소와 같은 두 층 구조라서 Node 의 패키지 찾기가 개발 환경과 똑같이 동작한다.
// 필요한 패키지는 apps/api 의 dependencies 에서 시작해 실제 설치된 위치를 따라가며 모은다 (네트워크 없음).
const { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { dirname, join, relative, resolve, sep } = require('node:path');
const { logoPng } = require('../src/brand.cjs');
const { buildPaths } = require('./build-paths.cjs');

const repo = resolve(__dirname, '..', '..', '..');
const apiDir = join(repo, 'apps', 'api');
const webDist = join(repo, 'apps', 'web', 'dist');
const { stage, icon } = buildPaths();
// 저장소의 node_modules 위치 → 설치본 위치
const ROOTS = [
  { from: join(apiDir, 'node_modules'), to: join(stage, 'api', 'node_modules') },
  { from: join(repo, 'node_modules'), to: join(stage, 'node_modules') },
];

/** pkgDir 에서 시작해 Node 처럼 위로 올라가며 name 패키지 폴더를 찾는다 (저장소 밖으로는 나가지 않음) */
function findPackage(name, fromDir) {
  for (let dir = fromDir; dir.startsWith(repo); dir = dirname(dir)) {
    const candidate = join(dir, 'node_modules', ...name.split('/'));
    if (existsSync(join(candidate, 'package.json'))) return candidate;
    if (dir === repo) break;
  }
  return null;
}

/** apps/api 가 실행 중에 쓰는 패키지 폴더 전체 */
function collectPackages() {
  const found = new Set();
  const missing = [];
  const queue = [{ dir: apiDir, required: true }];
  while (queue.length) {
    const { dir } = queue.shift();
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    const deps = [
      ...Object.keys(pkg.dependencies || {}).map(name => ({ name, required: true })),
      ...Object.keys(pkg.optionalDependencies || {}).map(name => ({ name, required: false })),
      // peerDependencies 는 따라가지 않는다: prisma CLI·typescript 같은 개발 도구가 딸려 온다.
      // Nest 의 peer(reflect-metadata, rxjs, class-validator 등)는 apps/api 가 직접 의존한다.
    ];
    for (const { name, required } of deps) {
      const found2 = findPackage(name, dir);
      if (!found2) { if (required && !(pkg.optionalDependencies || {})[name]) missing.push(`${name} (${relative(repo, dir) || '.'})`); continue; }
      if (found.has(found2)) continue;
      found.add(found2);
      queue.push({ dir: found2 });
    }
  }
  if (missing.length) throw new Error(`설치되지 않은 패키지: ${missing.join(', ')}`);
  return [...found];
}

function targetOf(pkgDir) {
  for (const { from, to } of ROOTS) if (pkgDir.startsWith(from + sep)) return join(to, relative(from, pkgDir));
  throw new Error(`알 수 없는 패키지 위치: ${pkgDir}`);
}

// 설치본에 필요 없는 파일 (폴더 단위로는 지우지 않는다: 실행 코드가 들어 있는 패키지가 있다)
const SKIP = /(^|[\\/])(\.cache|\.github)([\\/]|$)|\.(md|map|ts|mts|cts|tsbuildinfo)$|\.tmp\d*$/i;
// Prisma 는 Windows 네이티브 엔진(query_engine-windows.dll.node)을 쓴다. 엣지·WASM 용 DB별 엔진(약 54MB)은 필요 없다.
const PRISMA_WASM = /^runtime[\\/]query_(engine|compiler)_bg\.\w+\.wasm-base64\.m?js$/;

function copyPackage(src, dest) {
  const isPrismaClient = src.endsWith(join('@prisma', 'client'));
  // 중첩된 node_modules 는 따로 수집되므로 여기서는 건너뛴다
  cpSync(src, dest, {
    recursive: true,
    filter: file => {
      const rel = relative(src, file);
      if (!rel) return true;
      if (rel.split(sep)[0] === 'node_modules') return false;
      if (isPrismaClient && PRISMA_WASM.test(rel)) return false;
      return !SKIP.test(rel);
    },
  });
}

/** PNG 여러 장을 담은 Windows .ico */
function writeIco(file, sizes) {
  const images = sizes.map(size => ({ size, png: logoPng(size) }));
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, png }, i) => {
    const e = 6 + 16 * i;
    header[e] = size >= 256 ? 0 : size; header[e + 1] = size >= 256 ? 0 : size;
    header.writeUInt16LE(1, e + 4); header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(png.length, e + 8); header.writeUInt32LE(offset, e + 12);
    offset += png.length;
  });
  writeFileSync(file, Buffer.concat([header, ...images.map(i => i.png)]));
}

function main() {
  for (const need of [join(apiDir, 'dist', 'main.js'), join(webDist, 'index.html'), join(repo, 'node_modules', '.prisma', 'client', 'query_engine-windows.dll.node')]) {
    if (!existsSync(need)) throw new Error(`빌드 결과가 없습니다: ${relative(repo, need)}\nnpm run build 와 npm run setup 을 먼저 실행하세요.`);
  }
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(stage, { recursive: true });

  // API 코드·마이그레이션
  cpSync(join(apiDir, 'dist'), join(stage, 'api', 'dist'), { recursive: true, filter: f => !/\.(map|tsbuildinfo)$|\.d\.ts$/.test(f) });
  cpSync(join(apiDir, 'prisma', 'migrations'), join(stage, 'api', 'prisma', 'migrations'), { recursive: true });
  const apiPkg = JSON.parse(readFileSync(join(apiDir, 'package.json'), 'utf8'));
  writeFileSync(join(stage, 'api', 'package.json'), JSON.stringify({ name: apiPkg.name, version: apiPkg.version, private: true, dependencies: apiPkg.dependencies }, null, 2));

  // 패키지
  const packages = collectPackages();
  for (const dir of packages) copyPackage(dir, targetOf(dir));
  // Prisma 가 만든 클라이언트 (@prisma/client 가 node_modules/.prisma/client 를 찾는다). 다른 OS 엔진·임시 파일 제외
  cpSync(join(repo, 'node_modules', '.prisma', 'client'), join(stage, 'node_modules', '.prisma', 'client'), {
    recursive: true, filter: f => !/\.tmp\d*$/.test(f) && !/query_engine-(?!windows)/.test(f),
  });

  // 웹 화면
  cpSync(webDist, join(stage, 'web'), { recursive: true });

  // 설치 파일·실행 파일 아이콘
  writeIco(icon, [16, 24, 32, 48, 64, 128, 256]);

  // 개발용 비밀값이 섞이지 않았는지 확인
  for (const f of ['.env', join('api', '.env')]) if (existsSync(join(stage, f))) throw new Error(`설치본에 ${f} 가 들어갔습니다`);
  console.log(`설치본 파일 준비 완료: 패키지 ${packages.length}개 → ${stage}`);
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exit(1); }
}

module.exports = { collectPackages, findPackage, writeIco };
