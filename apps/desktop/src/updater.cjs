// 자동 업데이트: GitHub Releases 의 latest.yml 을 보고 새 버전을 내려받아 두었다가, 사용자가 누르면 재시작해서 설치한다.
// 상태는 docs/DESKTOP_PLAN.md 의 약속(idle·checking·available·downloading·ready·error)을 따른다.
// electron-updater 는 설치본에서만 쓴다 (개발 실행에는 app-update.yml 이 없다).

const FIRST_CHECK_MS = 30_000;
const CHECK_EVERY_MS = 6 * 60 * 60_000;

/** 화면·API 에 보여 줄 짧은 오류 문구 (경로·스택은 빼고 첫 줄만) */
function shortError(error) {
  const text = String(error && error.message ? error.message : error || '알 수 없는 오류').split('\n')[0];
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|net::/i.test(text)) return '인터넷에 연결할 수 없어 업데이트를 확인하지 못했어요.';
  if (/404|latest\.yml/i.test(text)) return '아직 올라온 배포 버전이 없어요.';
  return text.slice(0, 200);
}

/**
 * @param {{ autoUpdater: import('electron-updater').AppUpdater, onState: (state: object) => void }} options
 */
function createUpdater({ autoUpdater, onState }) {
  let state = { state: 'idle' };
  const set = next => { state = next; onState(state); };
  const busy = () => ['checking', 'available', 'downloading', 'ready'].includes(state.state);

  autoUpdater.autoDownload = true;
  // 사용자가 버튼을 누르지 않아도, 앱을 끝낼 때 받아 둔 업데이트를 설치한다.
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => set({ state: 'checking' }));
  autoUpdater.on('update-not-available', () => set({ state: 'idle' }));
  autoUpdater.on('update-available', info => set({ state: 'available', version: info.version }));
  autoUpdater.on('download-progress', progress => set({ state: 'downloading', version: state.version, percent: Math.round(progress.percent || 0) }));
  autoUpdater.on('update-downloaded', info => set({ state: 'ready', version: info.version }));
  autoUpdater.on('error', error => {
    // 이미 받아 둔 업데이트가 있으면 그 상태를 지킨다.
    if (state.state !== 'ready') set({ state: 'error', error: shortError(error) });
  });

  return {
    get state() { return state; },
    /** 새 버전 확인. 이미 확인·다운로드 중이거나 받아 두었으면 아무것도 하지 않는다 */
    check() {
      if (busy()) return false;
      Promise.resolve(autoUpdater.checkForUpdates()).catch(error => set({ state: 'error', error: shortError(error) }));
      return true;
    },
    /** 받아 둔 업데이트를 설치하며 재시작. 받아 둔 것이 없으면 false */
    install(beforeQuit = () => {}) {
      if (state.state !== 'ready') return false;
      beforeQuit();
      autoUpdater.quitAndInstall(true, true);
      return true;
    },
    /** 시작 30초 뒤와 6시간마다 확인 */
    schedule(timers = { setTimeout, setInterval }) {
      const first = timers.setTimeout(() => this.check(), FIRST_CHECK_MS);
      const every = timers.setInterval(() => this.check(), CHECK_EVERY_MS);
      first.unref?.(); every.unref?.();
    },
  };
}

/** 업데이트를 다 받았을 때 Windows 알림을 띄울지: 같은 버전은 한 번만 */
function readyToNotify(state, lastNotified) {
  return !!state && state.state === 'ready' && typeof state.version === 'string' && state.version !== lastNotified;
}

module.exports = { CHECK_EVERY_MS, FIRST_CHECK_MS, createUpdater, readyToNotify, shortError };
