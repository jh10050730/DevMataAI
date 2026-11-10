import { RefreshCw, WifiOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { OFFLINE_EVENT, serverAlive } from '../lib/api';

/**
 * 서버(DevMata AI 앱의 API)와 연결이 끊기면 화면 위에 띠를 보여 주고, 3초마다 다시 확인한다.
 * 다시 연결되면 "새로고침" 을 권한다 (끊긴 동안 실패한 화면을 다시 불러오기 위해).
 */
export default function ConnectionBanner({ intervalMs = 3000 }: { intervalMs?: number }) {
  const [state, setState] = useState<'online' | 'offline' | 'back'>('online');
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const stop = () => { if (timer.current) clearInterval(timer.current); timer.current = null; };
    const onOffline = () => {
      setState('offline');
      if (timer.current) return;
      timer.current = setInterval(async () => {
        if (await serverAlive()) { stop(); setState('back'); }
      }, intervalMs);
    };
    window.addEventListener(OFFLINE_EVENT, onOffline);
    return () => { window.removeEventListener(OFFLINE_EVENT, onOffline); stop(); };
  }, [intervalMs]);

  if (state === 'online') return null;
  const offline = state === 'offline';
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-x-0 top-0 z-[100] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-sm font-medium text-white ${offline ? 'bg-red-500' : 'bg-emerald-600'}`}
    >
      {offline ? (
        <>
          <WifiOff className="size-4 shrink-0" />
          <span>DevMata AI 서버와 연결이 끊겼어요. 다시 연결하는 중…</span>
        </>
      ) : (
        <>
          <span>다시 연결됐어요.</span>
          <button type="button" onClick={() => window.location.reload()} className="inline-flex items-center gap-1 rounded-lg bg-white/20 px-2.5 py-1 hover:bg-white/30">
            <RefreshCw className="size-3.5" /> 새로고침
          </button>
          <button type="button" onClick={() => setState('online')} className="rounded-lg px-2 py-1 hover:bg-white/20">닫기</button>
        </>
      )}
    </div>
  );
}
