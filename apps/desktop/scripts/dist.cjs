// Windows 설치 파일(NSIS)을 만든다. 기본 설정은 package.json 의 "build", 경로만 빌드 작업 폴더로 바꾼다.
// 사용: node scripts/dist.cjs            → 설치 파일만 만든다
//       node scripts/dist.cjs --publish  → GitHub Releases 에 올린다 (GH_TOKEN 필요)
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const { Arch, Platform, build } = require('electron-builder');
const { buildPaths } = require('./build-paths.cjs');

function distConfig(base, paths) {
  return {
    ...base,
    directories: { ...base.directories, output: paths.release },
    // electron-builder 는 폴더 안의 node_modules 를 빼고 복사하므로, node_modules 는 각각 따로 지정한다.
    extraResources: [
      { from: join(paths.stage, 'api'), to: 'api', filter: ['**/*'] },
      { from: join(paths.stage, 'api', 'node_modules'), to: join('api', 'node_modules'), filter: ['**/*'] },
      { from: join(paths.stage, 'node_modules'), to: 'node_modules', filter: ['**/*'] },
      { from: join(paths.stage, 'web'), to: 'web', filter: ['**/*'] },
    ],
    win: { ...base.win, icon: paths.icon },
    nsis: { ...base.nsis, installerIcon: paths.icon, uninstallerIcon: paths.icon },
  };
}

async function main() {
  const paths = buildPaths();
  if (!existsSync(join(paths.stage, 'api', 'dist', 'main.js')) || !existsSync(paths.icon)) {
    throw new Error(`설치본 파일이 없습니다: ${paths.stage}\nnpm run stage -w apps/desktop 를 먼저 실행하세요.`);
  }
  const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));
  const publish = process.argv.includes('--publish');
  if (publish && !process.env.GH_TOKEN) throw new Error('GitHub Releases 에 올리려면 GH_TOKEN 이 필요합니다.');
  const files = await build({
    projectDir: join(__dirname, '..'),
    targets: Platform.WINDOWS.createTarget('nsis', Arch.x64),
    publish: publish ? 'always' : 'never',
    config: distConfig(pkg.build, paths),
  });
  console.log(`\n설치 파일 완성:\n${files.filter(f => /\.exe$/i.test(f)).map(f => `  ${f}`).join('\n')}`);
}

if (require.main === module) {
  main().catch(error => { console.error(error.message || error); process.exit(1); });
}

module.exports = { distConfig };
