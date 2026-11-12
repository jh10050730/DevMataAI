import { Bell, CheckCheck, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { api, errorMessage } from '../lib/api';
import { Button, EmptyState, Spinner } from './ui';

type Notice = { id: string; title: string; body: string; href: string; readAt: string | null; createdAt: string };
type Notices = { notifications: Notice[]; unreadCount: number };
export default function NotificationBell() {
  const [data, setData] = useState<Notices>();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    const load = () => { void api.get<Notices>('/notifications').then(value => { if (active) { setData(value); setError(''); } }).catch(e => { if (active) setError(errorMessage(e)); }); };
    load(); const timer = setInterval(load, 60000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  useEffect(() => {
    if (!open) { setConfirmClear(false); return; }
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); root.current?.querySelector('button')?.focus(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', key); };
  }, [open]);
  async function refresh() { setData(await api.get<Notices>('/notifications')); setError(''); }
  async function read(notice?: Notice) {
    setBusy(true);
    try {
      if (notice) await api.patch(`/notifications/${notice.id}/read`, {});
      else await api.post('/notifications/read-all');
      await refresh();
      if (notice) { setOpen(false); navigate(notice.href); }
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }
  /** 알림 하나 또는 전부를 알림함에서 지운다 (같은 알림은 다시 오지 않고, 마감이 바뀌면 새로 온다) */
  async function dismiss(notice?: Notice) {
    setBusy(true);
    try {
      await api.delete(notice ? `/notifications/${notice.id}` : '/notifications');
      setConfirmClear(false);
      await refresh();
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }
  return <div ref={root} className="relative">
    <button className="relative rounded-xl p-2.5 text-muted hover:bg-surface-2 hover:text-accent" aria-label={`알림${data?.unreadCount ? ` ${data.unreadCount}개 읽지 않음` : ''}`} aria-expanded={open} onClick={() => { setOpen(value => !value); if (!open) void refresh().catch(e => setError(errorMessage(e))); }}>
      <Bell className="size-[18px]" />{(data?.unreadCount ?? 0) > 0 && <span className="absolute -right-1 -top-0.5 min-w-4 rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-4 text-white">{data!.unreadCount > 99 ? '99+' : data!.unreadCount}</span>}
    </button>
    {open && <section aria-label="마감 알림함" className="fixed right-4 top-[68px] z-40 w-[min(400px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-border bg-surface shadow-xl lg:absolute lg:right-0 lg:top-full lg:mt-3">
      <div className="flex items-center justify-between gap-2 border-b border-border p-4"><h2 className="font-bold">알림</h2><div className="flex items-center gap-1">
        <Button variant="ghost" className="text-xs" disabled={busy || !data?.unreadCount} onClick={() => void read()}><CheckCheck className="size-4" />모두 읽음</Button>
        <Button variant="ghost" className="text-xs" disabled={busy || !data?.notifications.length} onClick={() => setConfirmClear(true)}><Trash2 className="size-4" />모두 지우기</Button>
        <button aria-label="알림 닫기" className="rounded-lg p-2 text-muted" onClick={() => setOpen(false)}><X className="size-4" /></button>
      </div></div>
      {confirmClear && <div role="alertdialog" aria-label="알림 모두 지우기 확인" className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-2 px-4 py-3 text-sm">
        <p className="flex-1">알림 {data?.notifications.length ?? 0}개를 모두 지울까요?</p>
        <Button variant="danger" className="text-xs" loading={busy} onClick={() => void dismiss()}>지우기</Button>
        <Button variant="ghost" className="text-xs" disabled={busy} onClick={() => setConfirmClear(false)}>취소</Button>
      </div>}
      {error && <p role="alert" className="px-4 pt-3 text-sm text-red-500">{error}</p>}
      <div className="workspace-scroll max-h-[min(60vh,460px)] overflow-y-auto">{!data && !error ? <Spinner /> : !data?.notifications.length ? <EmptyState icon={Bell} title="아직 도착한 알림이 없어요" description="마감 한 달·3주·1주·하루 전에 알려드려요." /> : data.notifications.map(notice => <div key={notice.id} className={`group relative border-b border-border/60 transition-colors hover:bg-surface-2 ${notice.readAt ? '' : 'bg-accent-soft/40'}`}>
        <button disabled={busy} onClick={() => void read(notice)} className="block w-full p-4 pr-12 text-left">
          <p className="flex items-center gap-2 text-sm font-semibold">{!notice.readAt && <span className="size-1.5 shrink-0 rounded-full bg-accent" />}{notice.title}</p><p className="mt-2 break-words text-sm leading-6 text-muted">{notice.body}</p><p className="mt-2 text-xs text-muted">{new Date(notice.createdAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</p>
        </button>
        <button disabled={busy} onClick={() => void dismiss(notice)} aria-label={`알림 지우기: ${notice.title}`} title="지우기" className="absolute right-3 top-3 rounded-lg p-2 text-muted hover:bg-red-500/10 hover:text-red-500"><Trash2 className="size-4" /></button>
      </div>)}</div>
      <button className="w-full px-4 py-3 text-sm text-accent hover:bg-surface-2" onClick={() => { setOpen(false); navigate('/settings'); }}>알림 설정</button>
    </section>}
  </div>;
}
