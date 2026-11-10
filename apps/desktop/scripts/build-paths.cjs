// 설치 파일 빌드 작업 폴더. 저장소가 OneDrive 안에 있으면 동기화가 파일을 잠가 빌드가 실패하고
// 빌드 결과물이 업로드되므로, 기본값은 OneDrive 밖(%LOCALAPPDATA%\DevMataAI-build)이다.
// DEVMATA_BUILD_DIR 로 바꿀 수 있다.
const { join } = require('node:path');
const { homedir } = require('node:os');

function buildPaths(env = process.env) {
  const root = env.DEVMATA_BUILD_DIR || join(env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'DevMataAI-build');
  return { root, stage: join(root, 'stage'), icon: join(root, 'icon.ico'), release: join(root, 'release') };
}

module.exports = { buildPaths };
