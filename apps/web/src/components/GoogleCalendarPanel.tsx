import { CalendarSync, Link2, Unlink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { errorMessage } from '../lib/api';
import { googleApi, type GoogleStatus } from '../lib/google';
import { Button, Modal } from './ui';

const fmt = (iso: string) => new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

/** 설정 → 외부 연동 → Google Calendar: 연결 / 동기화 / 연결 해제 (읽기 전용) */
export default function GoogleCalendarPanel({ onChange }: { onChange?: () => void }) {
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [busy, setBusy] = useState<'connect' | 'sync' | 'disconnect' | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmOff, setConfirmOff] = useState(false);
  const [removeEvents, setRemoveEvents] = useState(false);

  const load = () =>
    googleApi
      .status()
      .then(setStatus)
      .catch((e) => setMessage({ ok: false, text: errorMessage(e) }));

  useEffect(() => {
    void load();
    // Google 로그인 후 돌아온 결과 (?google=connected|error&reason=...)
    const result = params.get('google');
    if (result) {
      setMessage(result === 'connected' ? { ok: true, text: 'Google Calendar 를 연결했어요. 동기화를 눌러 일정을 가져오세요.' } : { ok: false, text: params.get('reason') || 'Google 연결에 실패했어요.' });
      const next = new URLSearchParams(params);
      next.delete('google');
      next.delete('reason');
      setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (kind: 'connect' | 'sync' | 'disconnect') => {
    setBusy(kind);
    setMessage(null);
    try {
      if (kind === 'connect') {
        const { url } = await googleApi.connect();
        window.location.assign(url); // Google 로그인 화면으로 이동
        return;
      }
      if (kind === 'sync') {
        const r = await googleApi.sync();
        setMessage({ ok: true, text: `동기화 완료 · 새 일정 ${r.created}개, 갱신 ${r.updated}개, 정리 ${r.removed}개 (최근 30일 ~ 앞으로 180일)` });
      } else {
        const r = await googleApi.disconnect(removeEvents);
        setConfirmOff(false);
        setMessage({
          ok: true,
          text: `연결을 해제했어요${r.removedEvents ? ` · 가져온 일정 ${r.removedEvents}개 삭제` : ''}${r.revoked ? '' : ' · Google 계정의 권한 철회는 확인하지 못했어요 (myaccount.google.com → 보안 → 타사 앱에서 직접 해제 가능)'}`,
        });
      }
      await load();
      onChange?.();
    } catch (e) {
      setMessage({ ok: false, text: errorMessage(e) });
      void load();
    } finally {
      setBusy(null);
    }
  };

  if (!status) return message ? <p className="mt-2 text-xs text-red-500">{message.text}</p> : null;

  return (
    <div className="mt-2 space-y-2">
      {!status.configured ? (
        <p className="text-xs text-muted">
          Google Cloud 콘솔에서 OAuth 클라이언트(웹 애플리케이션)를 만들고, 승인된 리디렉션 URI 에 <code className="rounded bg-surface-2 px-1">{status.redirectUri}</code> 를 등록한 뒤
          apps/api/.env 에 GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET 을 넣고 API 서버를 재시작하세요.
        </p>
      ) : status.connected ? (
        <>
          <p className="text-xs text-muted">
            {status.email ?? 'Google 계정'} 연결됨 · 가져온 일정 {status.syncedEvents}개{status.lastSyncAt ? ` · 마지막 동기화 ${fmt(status.lastSyncAt)}` : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => run('sync')} loading={busy === 'sync'} disabled={!!busy} className="px-2.5 py-1 text-xs">
              <CalendarSync className="size-3.5" /> 지금 동기화
            </Button>
            <Button variant="ghost" onClick={() => setConfirmOff(true)} disabled={!!busy} className="px-2.5 py-1 text-xs text-red-500">
              <Unlink className="size-3.5" /> 연결 해제
            </Button>
          </div>
        </>
      ) : (
        <>
          {status.needsReconnect && <p className="text-xs text-red-500">Google 연결이 만료되었어요. 다시 연결해주세요.</p>}
          <Button variant="secondary" onClick={() => run('connect')} loading={busy === 'connect'} disabled={!!busy} className="px-2.5 py-1 text-xs">
            <Link2 className="size-3.5" /> Google 계정 연결
          </Button>
        </>
      )}
      {status.configured && (
        <p className="text-[11px] text-muted">읽기 전용이에요. DevMata AI는 Google 일정을 만들거나 수정·삭제하지 않고, 기본 캘린더의 일정을 가져오기만 해요.</p>
      )}
      {message && <p className={message.ok ? 'text-xs text-emerald-500' : 'text-xs text-red-500'}>{message.text}</p>}

      <Modal open={confirmOff} onClose={() => setConfirmOff(false)} title="Google Calendar 연결을 해제할까요?">
        <p className="text-sm text-muted">저장된 토큰을 지우고 Google 계정에서 DevMata AI의 접근 권한을 철회해요. Google Calendar 의 원래 일정은 그대로예요.</p>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={removeEvents} onChange={(e) => setRemoveEvents(e.target.checked)} className="size-4 accent-accent" />
          DevMata AI로 가져온 일정 {status.syncedEvents}개도 삭제
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmOff(false)}>
            취소
          </Button>
          <Button variant="danger" onClick={() => run('disconnect')} loading={busy === 'disconnect'}>
            연결 해제
          </Button>
        </div>
      </Modal>
    </div>
  );
}
