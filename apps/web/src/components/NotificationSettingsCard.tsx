import { Bell } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, errorMessage } from '../lib/api';
import { Button, Card, Spinner } from './ui';
type Settings = { notificationInApp: boolean; notificationEmail: boolean; emailConfigured: boolean; desktopEnabled?: boolean; notice: string };
export default function NotificationSettingsCard() {
  const [settings, setSettings] = useState<Settings>();
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { let active = true; api.get<Settings>('/notifications/settings').then(value => { if (active) setSettings(value); }).catch(e => { if (active) setError(errorMessage(e)); }); return () => { active = false; }; }, []);
  async function save() {
    if (!settings) return;
    setSaving(true); setError(''); setStatus('');
    try { setSettings(await api.patch<Settings>('/notifications/settings', { notificationInApp: settings.notificationInApp, notificationEmail: settings.notificationEmail })); setStatus('알림 설정을 저장했습니다.'); }
    catch (e) { setError(errorMessage(e)); }
    finally { setSaving(false); }
  }
  return <Card title="마감 알림" icon={Bell}>
    {error && <p role="alert" className="mb-3 text-sm text-red-500">{error}</p>}
    {!settings ? !error && <Spinner /> : <div className="space-y-4">
      <p className="text-sm leading-6 text-muted">{settings.notice}</p>
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="size-4 accent-accent-strong" checked={settings.notificationInApp} disabled={saving} onChange={e => { setSettings({ ...settings, notificationInApp: e.target.checked }); setStatus(''); }} />{settings.desktopEnabled ? '화면 알림(Windows 알림)과 앱 내 알림함으로 받기' : '앱 내 알림함으로 받기'}</label>
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="size-4 accent-accent-strong" checked={settings.notificationEmail} disabled={saving} onChange={e => { setSettings({ ...settings, notificationEmail: e.target.checked }); setStatus(''); }} />가입한 이메일로 받기</label>
      {settings.desktopEnabled && <p className="rounded-xl bg-surface-2 p-3 text-xs leading-5 text-muted">마감이 다가오면 이 PC 화면 구석에 알림이 떠요. 브라우저를 닫아 둬도 서버가 켜져 있으면 뜨고, 알림을 누르면 일정 화면이 열려요. Windows의 방해 금지 모드가 켜져 있으면 알림 센터에만 쌓여요.</p>}
      {!settings.emailConfigured && <p className="rounded-xl bg-surface-2 p-3 text-xs leading-5 text-muted">메일 발송 설정이 아직 없어 이메일 알림은 대기 중입니다. 앱 내 알림은 사용할 수 있습니다.</p>}
      <Button loading={saving} onClick={() => void save()}>알림 설정 저장</Button>
      {status && <p role="status" className="text-sm text-accent">{status}</p>}
    </div>}
  </Card>;
}
