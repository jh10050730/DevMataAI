// DevMata AI 데스크톱 앱: API 서버를 띄우고 앱 창에 화면을 연다. 창을 닫으면 트레이로 숨고, 트레이 메뉴에서 종료한다.
const { app, BrowserWindow, Menu, Tray, dialog, nativeImage, shell } = require('electron');
const { join } = require('node:path');
const { loadConfig } = require('./config.cjs');
const { appPaths, apiEnv, appRoute, findClaude, folderTarget, loadAppDefaults, isAppUrl, isExternalUrl, isFocusRequest, resetRoute, updateAction } = require('./paths.cjs');
const { startApi } = require('./server.cjs');
const { trayIcon, windowIcon } = require('./icon.cjs');
const { createUpdater } = require('./updater.cjs');

const APP_NAME = 'DevMata AI';
app.setName(APP_NAME);
// 개발 실행에서도 설치본과 같은 데이터 폴더(%APPDATA%\DevMata AI)를 쓴다.
app.setPath('userData', join(app.getPath('appData'), APP_NAME));
app.setAppUserModelId('ai.devmata.desktop');

let win = null;
let tray = null;
let api = null;
let quitting = false;
let updater = null;
let refreshTray = () => {};
const startHidden = process.argv.includes('--hidden');

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());
  app.whenReady().then(start).catch(fail);
}

function fail(error) {
  dialog.showErrorBox(`${APP_NAME} 시작 실패`, error instanceof Error ? error.message : String(error));
  quitting = true;
  api?.kill();
  app.quit();
}

async function start() {
  Menu.setApplicationMenu(null);
  const dataDir = app.getPath('userData');
  const config = loadConfig(dataDir);
  const paths = appPaths({ packaged: app.isPackaged, resourcesPath: process.resourcesPath });
  createTray();
  if (!startHidden) createWindow(loadingPage());
  const defaults = loadAppDefaults(paths.apiRoot);
  // 설치본: Claude Code 를 공식 설치 위치에서 찾아 넘긴다 (개발 실행은 apps/api/.env 설정을 그대로 쓴다)
  const claude = app.isPackaged ? findClaude() : null;
  if (claude) defaults.CLAUDE_CLI_PATH = claude;
  api = await startApi({ paths, env: apiEnv({ dataDir, config, paths, defaults, version: app.getVersion() }), port: config.port, logDir: join(dataDir, 'logs') });
  api.on('exit', code => { if (!quitting) fail(new Error(`API 서버가 예기치 않게 종료되었습니다 (코드 ${code}).\n로그: ${join(dataDir, 'logs', 'api.log')}`)); });
  // Google 로그인이 브라우저에서 끝나면 API 가 알려 준다 → 앱 창을 앞으로 가져와 설정 화면(결과 표시)을 연다.
  api.on('message', message => {
    if (isFocusRequest(message)) { bringToFront(); return; }
    const route = appRoute(message);
    if (route) { openInApp(route); return; }
    const reset = resetRoute(message);
    if (reset) { void confirmLocalReset(reset); return; }
    const folder = folderTarget(message);
    if (folder) { void shell.openPath(folder === 'logs' ? join(dataDir, 'logs') : dataDir); return; }
    const update = updateAction(message);
    if (update === 'check') updater?.check();
    if (update === 'install') installUpdate();
  });
  startUpdater();
  app.devmataUrl = `http://localhost:${config.port}/`;
  app.devmataPort = config.port;
  if (win) await win.loadURL(app.devmataUrl);
}

function createWindow(firstUrl) {
  win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 380, minHeight: 600,
    title: APP_NAME, icon: windowIcon(), backgroundColor: '#f2f4f6', show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.once('ready-to-show', () => win.show());
  // 앱 주소 밖(Google 로그인, 뉴스 원문, GitHub 등)은 기본 브라우저로 연다. Google 은 앱 안 로그인을 막는다.
  win.webContents.setWindowOpenHandler(({ url }) => { if (isExternalUrl(url)) void shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (event, url) => {
    if (app.devmataPort && isAppUrl(url, app.devmataPort)) return;
    event.preventDefault();
    if (isExternalUrl(url)) void shell.openExternal(url);
  });
  win.on('close', event => { if (!quitting) { event.preventDefault(); win.hide(); } });
  win.on('closed', () => { win = null; });
  void win.loadURL(firstUrl);
}

function showWindow() {
  if (!win) createWindow(app.devmataUrl || loadingPage());
  else { if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
}

/** 메일 없이 이 PC 에서 비밀번호 재설정: 확인 창에서 "재설정" 을 누르면 재설정 화면을 연다 */
async function confirmLocalReset({ email, path }) {
  const options = {
    type: 'question',
    buttons: ['재설정', '취소'],
    defaultId: 0,
    cancelId: 1,
    title: `${APP_NAME} 비밀번호 재설정`,
    message: `${email} 계정의 비밀번호를 이 PC에서 재설정할까요?`,
    detail: '메일 설정이 없어 이 PC에서 바로 재설정합니다. 직접 요청하지 않았다면 취소를 누르세요. (15분 동안 한 번만 쓸 수 있어요)',
  };
  const { response } = win ? await dialog.showMessageBox(win, options) : await dialog.showMessageBox(options);
  if (response === 0) openInApp(path);
}

/** 앱 창에서 경로를 열고 맨 앞으로 가져온다. Windows 는 다른 창(브라우저)이 앞에 있으면 포커스를 막으므로 잠깐 맨 위로 올린다. */
function openInApp(route) {
  const url = new URL(route.slice(1), app.devmataUrl).toString();
  if (!win) { createWindow(url); return; }
  void win.loadURL(url);
  bringToFront();
}

/** 다른 창(브라우저) 위로 앱 창을 가져온다. 화면은 그대로 둔다 */
function bringToFront() {
  if (!win) { showWindow(); return; }
  if (win.isMinimized()) win.restore();
  win.show();
  win.setAlwaysOnTop(true);
  win.focus();
  win.setAlwaysOnTop(false);
}

/** 설치본에서만 자동 업데이트. 상태가 바뀌면 API(화면)와 트레이 메뉴에 알린다 */
function startUpdater() {
  if (!app.isPackaged) return;
  const { autoUpdater } = require('electron-updater');
  updater = createUpdater({
    autoUpdater,
    onState: state => {
      if (api?.connected) api.send({ type: 'update-state', ...state });
      refreshTray();
    },
  });
  if (api?.connected) api.send({ type: 'update-state', ...updater.state });
  updater.schedule();
}

function installUpdate() {
  updater?.install(() => { quitting = true; });
}

function updateMenuItem() {
  const s = updater?.state;
  if (!s) return [];
  if (s.state === 'ready') return [{ label: `재시작해서 업데이트 (v${s.version})`, click: installUpdate }, { type: 'separator' }];
  const busy = ['checking', 'available', 'downloading'].includes(s.state);
  const label = s.state === 'downloading' ? `업데이트 받는 중… ${s.percent ?? 0}%` : busy ? '업데이트 확인 중…' : '업데이트 확인';
  return [{ label, enabled: !busy, click: () => updater.check() }, { type: 'separator' }];
}

function createTray() {
  tray = new Tray(trayIcon());
  tray.setToolTip(APP_NAME);
  tray.on('click', showWindow);
  const refresh = () => tray.setContextMenu(Menu.buildFromTemplate([
    { label: `${APP_NAME} 열기`, click: showWindow },
    { type: 'separator' },
    {
      label: 'Windows 시작 시 자동 실행', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin,
      // 설치본에서만 의미가 있다 (개발 실행은 electron.exe 를 등록하게 됨).
      enabled: app.isPackaged,
      click: item => { app.setLoginItemSettings({ openAtLogin: item.checked, args: ['--hidden'] }); refresh(); },
    },
    { type: 'separator' },
    ...updateMenuItem(),
    { label: '종료', click: () => { quitting = true; app.quit(); } },
  ]));
  refreshTray = refresh;
  refresh();
}

function loadingPage() {
  const html = `<!doctype html><meta charset="utf-8"><title>${APP_NAME}</title>
<body style="margin:0;height:100vh;display:grid;place-items:center;background:#f2f4f6;font-family:'Malgun Gothic',system-ui,sans-serif;color:#191f28">
<div style="text-align:center"><div style="font-size:28px;font-weight:700">${APP_NAME}</div><div style="margin-top:10px;color:#6b7684">시작하는 중…</div></div></body>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

// 창을 모두 닫아도 트레이에 남아 알림·뉴스 수집을 계속한다.
app.on('window-all-closed', () => {});
app.on('before-quit', () => { quitting = true; });
app.on('will-quit', () => { api?.kill(); });
