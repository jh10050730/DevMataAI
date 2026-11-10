import { spawn } from 'node:child_process';

/**
 * Windows 바탕화면 알림(토스트). 서버가 사용자 PC에서 돌기 때문에 브라우저를 닫아 둬도 화면 구석에 뜬다.
 * - Windows 가 아니거나 DESKTOP_NOTIFICATIONS=false 이면 아무것도 하지 않는다.
 * - 제목·본문은 명령줄이 아닌 환경변수(XML)로만 넘겨 PowerShell 명령에 섞이지 않게 한다.
 * - 알림을 누르면 기본 브라우저로 url 이 열린다.
 */
const POWERSHELL_APP_ID = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe';
const SCRIPT = [
  '$ErrorActionPreference = "Stop"',
  '[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null',
  '[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null',
  '$xml = New-Object Windows.Data.Xml.Dom.XmlDocument',
  '$xml.LoadXml($env:DEVMATA_TOAST_XML)',
  '$toast = New-Object Windows.UI.Notifications.ToastNotification $xml',
  '[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($env:DEVMATA_TOAST_APP).Show($toast)',
].join('; ');

const escapeXml = (value: string) =>
  value
    // XML 1.0 에 쓸 수 없는 제어 문자 제거
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export function toastXml(title: string, body: string, url?: string) {
  const launch = url ? ` activationType="protocol" launch="${escapeXml(url)}"` : '';
  return `<toast${launch}><visual><binding template="ToastGeneric"><text>${escapeXml(title.slice(0, 120))}</text><text>${escapeXml(body.slice(0, 300))}</text><text placement="attribution">DevMata</text></binding></visual></toast>`;
}

export function desktopToastEnabled(env: NodeJS.ProcessEnv = process.env, platform: string = process.platform) {
  return platform === 'win32' && env.NODE_ENV !== 'test' && String(env.DESKTOP_NOTIFICATIONS ?? 'true').toLowerCase() !== 'false';
}

/** 알림을 띄운다. 실패해도 예외를 던지지 않고 false 를 돌려준다. */
export function showDesktopToast(title: string, body: string, url?: string): Promise<boolean> {
  if (!desktopToastEnabled()) return Promise.resolve(false);
  return new Promise((resolve) => {
    try {
      const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-Command', SCRIPT], {
        env: { ...process.env, DEVMATA_TOAST_XML: toastXml(title, body, url), DEVMATA_TOAST_APP: POWERSHELL_APP_ID },
        stdio: 'ignore',
        windowsHide: true,
      });
      const timer = setTimeout(() => child.kill(), 15_000);
      child.on('error', () => { clearTimeout(timer); resolve(false); });
      child.on('exit', (code) => { clearTimeout(timer); resolve(code === 0); });
    } catch {
      resolve(false);
    }
  });
}
