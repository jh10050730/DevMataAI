import { Download, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, errorMessage } from '../lib/api';
import type { DesktopInfo } from './AppInfoCard';
import { Button } from './ui';

const CHECK_EVERY_MS = 10 * 60_000;

/** 데스크톱 앱이 새 버전을 다 받아 두었으면 그 버전, 아니면 null */
export function readyVersion(info: DesktopInfo | undefined) {
  return info?.desktop && info.update?.state === 'ready' ? info.update.version ?? '' : null;
}

/** 새 버전을 다 받으면 화면 위쪽에 알려 주고, 누르면 재시작해서 설치한다 ("나중에" 를 누르면 이번 실행 동안 숨김) */
export default function UpdateBanner() {
  const [version, setVersion] = useState<string | null>(null);
  const [hidden, setHidden] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const check = () => { api.get<DesktopInfo>('/desktop/info').then(info => { if (active) setVersion(readyVersion(info)); }).catch(() => undefined); };
    check();
    const timer = window.setInterval(check, CHECK_EVERY_MS);
    window.addEventListener('focus', check);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', check); };
  }, []);

  if (version === null || hidden === version) return null;
  const install = async () => {
    setBusy(true); setError('');
    try { await api.post('/desktop/update', { action: 'install' }); }
    catch (e) { setError(errorMessage(e)); setBusy(false); }
  };
  return <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-accent/20 bg-accent-soft px-4 py-2.5 text-sm sm:px-7 lg:px-10">
    <Download className="size-4 shrink-0 text-accent" />
    <p className="min-w-0 flex-1"><b>{version ? `v${version}` : '새 버전'}</b>이 준비됐어요. 재시작하면 바로 설치돼요. {busy ? '재시작하는 중…' : ''}{error && <span className="ml-1 text-red-500">{error}</span>}</p>
    <Button className="text-xs" loading={busy} onClick={() => void install()}>지금 재시작</Button>
    <button disabled={busy} onClick={() => setHidden(version)} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted hover:bg-surface-2" aria-label="업데이트 안내 숨기기"><X className="size-3.5" />나중에</button>
  </div>;
}
