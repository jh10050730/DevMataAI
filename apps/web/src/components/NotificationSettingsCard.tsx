import { Bell, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, errorMessage } from '../lib/api';
import { Button, Card, Select, Spinner } from './ui';
type Settings = { notificationInApp: boolean; notificationEmail: boolean; briefingEnabled: boolean; briefingHour: number; emailConfigured: boolean; desktopEnabled?: boolean; notice: string };
/** 아침 브리핑은 오후 6시 전까지만 보내서, 시각은 0~17시 중에서 고른다 */
const HOURS = Array.from({ length: 18 }, (_, h) => h);
const hourLabel = (h: number) => (h < 12 ? `오전 ${h === 0 ? 12 : h}시` : `오후 ${h === 12 ? 12 : h - 12}시`);
export default function NotificationSettingsCard() {
  const [settings, setSettings] = useState<Settings>();
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<{ text: string; ai: boolean; toast: boolean }>();
  const [previewing, setPreviewing] = useState(false);
  useEffect(() => { let active = true; api.get<Settings>('/notifications/settings').then(value => { if (active) setSettings(value); }).catch(e => { if (active) setError(errorMessage(e)); }); return () => { active = false; }; }, []);
  const change = (patch: Partial<Settings>) => { if (settings) { setSettings({ ...settings, ...patch }); setStatus(''); } };
  async function save() {
    if (!settings) return;
    setSaving(true); setError(''); setStatus('');
    try { setSettings(await api.patch<Settings>('/notifications/settings', { notificationInApp: settings.notificationInApp, notificationEmail: settings.notificationEmail, briefingEnabled: settings.briefingEnabled, briefingHour: settings.briefingHour })); setStatus('알림 설정을 저장했습니다.'); }
    catch (e) { setError(errorMessage(e)); }
    finally { setSaving(false); }
  }
  async function tryBriefing() {
    setPreviewing(true); setError('');
    try { setPreview(await api.post('/briefing/preview')); }
    catch (e) { setError(errorMessage(e)); }
    finally { setPreviewing(false); }
  }
  return <Card title="알림" icon={Bell}>
    {error && <p role="alert" className="mb-3 text-sm text-red-500">{error}</p>}
    {!settings ? !error && <Spinner /> : <div className="space-y-4">
      <p className="text-sm leading-6 text-muted">{settings.notice}</p>
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="size-4 accent-accent-strong" checked={settings.notificationInApp} disabled={saving} onChange={e => change({ notificationInApp: e.target.checked })} />{settings.desktopEnabled ? '화면 알림(Windows 알림)과 앱 내 알림함으로 받기' : '앱 내 알림함으로 받기'}</label>
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="size-4 accent-accent-strong" checked={settings.notificationEmail} disabled={saving} onChange={e => change({ notificationEmail: e.target.checked })} />가입한 이메일로 받기</label>
      {settings.desktopEnabled && <p className="rounded-xl bg-surface-2 p-3 text-xs leading-5 text-muted">마감이 다가오면 이 PC 화면 구석에 알림이 떠요. 브라우저를 닫아 둬도 서버가 켜져 있으면 뜨고, 알림을 누르면 일정 화면이 열려요. Windows의 방해 금지 모드가 켜져 있으면 알림 센터에만 쌓여요.</p>}
      {!settings.emailConfigured && <p className="rounded-xl bg-surface-2 p-3 text-xs leading-5 text-muted">메일 발송 설정이 아직 없어 이메일 알림은 대기 중입니다. 앱 내 알림은 사용할 수 있습니다.</p>}

      <div className="space-y-3 border-t border-border pt-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Sun className="size-4 text-amber-500" />아침 브리핑</h3>
        <p className="text-xs leading-5 text-muted">매일 정한 시각 뒤 PC를 처음 켜거나 깨우면 오늘 일정·마감·복습할 노트를 AI가 3줄로 정리해 알려 드려요 (오후 6시 이후에 처음 켠 날은 건너뛰어요). AI가 연결되지 않았으면 간단한 요약으로 보내요. 보낸 뒤에는 어제 커밋이 있는 프로젝트의 개발일지도 자동으로 만들어 둬요.</p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="size-4 accent-accent-strong" checked={settings.briefingEnabled} disabled={saving} onChange={e => change({ briefingEnabled: e.target.checked })} />받기</label>
          <Select aria-label="아침 브리핑 시각" className="max-w-36" value={settings.briefingHour} disabled={saving || !settings.briefingEnabled} onChange={e => change({ briefingHour: Number(e.target.value) })}>
            {HOURS.map(h => <option key={h} value={h}>{hourLabel(h)}</option>)}
          </Select>
          <Button variant="secondary" loading={previewing} onClick={() => void tryBriefing()}>지금 받아 보기</Button>
        </div>
        {preview && <div role="status" className="rounded-xl bg-surface-2 p-3 text-sm leading-6"><p className="whitespace-pre-line">{preview.text}</p><p className="mt-1 text-xs text-muted">{preview.ai ? 'AI가 정리했어요' : 'AI 없이 정리했어요'}{preview.toast ? ' · Windows 알림으로도 보냈어요' : ''}</p></div>}
      </div>

      <Button loading={saving} onClick={() => void save()}>알림 설정 저장</Button>
      {status && <p role="status" className="text-sm text-accent">{status}</p>}
    </div>}
  </Card>;
}
