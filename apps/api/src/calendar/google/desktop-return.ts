/**
 * 데스크톱 앱(DEVMATA_DESKTOP=1)에서 Google 로그인이 끝났을 때:
 * 브라우저에는 "앱으로 돌아가세요" 안내 페이지를 보여 주고, 앱(Electron)에는 IPC 로 알려 창을 앞으로 가져온다.
 * 웹 실행(개발 서버)에서는 기존처럼 설정 화면으로 리디렉션한다.
 */

export const isDesktop = () => process.env.DEVMATA_DESKTOP === '1';

/** 앱 창이 열 경로. 데스크톱 앱(main.cjs)은 /settings 로 시작하는 경로만 받는다. */
export function settingsPath(result: string, reason?: string) {
  return `/settings?google=${encodeURIComponent(result)}${reason ? `&reason=${encodeURIComponent(reason)}` : ''}`;
}

/** Electron 에 창 열기 요청 (API 가 앱 안에서 실행될 때만 IPC 가 있다). 보냈으면 true */
export function notifyDesktop(path: string, send: ((m: unknown) => boolean) | null = process.send?.bind(process) ?? null) {
  if (!send) return false;
  try {
    return send({ type: 'open-app', path }) !== false;
  } catch {
    return false;
  }
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** 브라우저에 보여 줄 결과 페이지 */
export function returnPage(ok: boolean, reason?: string) {
  const title = ok ? 'Google 캘린더 연결 완료' : 'Google 캘린더 연결 실패';
  const body = ok
    ? 'DevMata AI 앱으로 돌아갔어요. 이 탭은 닫아도 됩니다.'
    : `${escapeHtml(reason || '알 수 없는 오류')}<br>DevMata AI 앱에서 다시 시도해 주세요. 이 탭은 닫아도 됩니다.`;
  return `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · DevMata AI</title>
<link rel="icon" href="/favicon.svg">
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#f2f4f6;font-family:'Malgun Gothic',system-ui,sans-serif;color:#191f28">
<main style="max-width:420px;margin:24px;padding:36px 32px;border-radius:28px;background:#fff;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.06)">
<img src="/favicon.svg" alt="" width="52" height="52">
<h1 style="margin:16px 0 8px;font-size:22px;color:${ok ? '#191f28' : '#e5484d'}">${title}</h1>
<p style="margin:0;line-height:1.6;color:#6b7684">${body}</p>
</main>
<script>setTimeout(function(){try{window.close()}catch(e){}},1500)</script>
</body></html>`;
}
