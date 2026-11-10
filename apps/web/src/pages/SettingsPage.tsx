import { Moon, Sun, User as UserIcon } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import DemoDataCard from '../components/DemoDataCard';
import IntegrationsCard from '../components/IntegrationsCard';
import NotificationSettingsCard from '../components/NotificationSettingsCard';
import AppSettingsCard from '../components/AppSettingsCard';
import { Button, Card, Field, Input } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { api, errorMessage } from '../lib/api';
import type { User } from '../lib/types';

export default function SettingsPage() {
  const { user, setUser } = useAuth();
  const { theme, toggle } = useTheme();
  const [name, setName] = useState(user?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      setUser(await api.patch<User>('/users/me', { name }));
      setMsg({ ok: true, text: '저장했어요.' });
    } catch (err) {
      setMsg({ ok: false, text: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid max-w-3xl gap-6">
      <Card title="프로필" icon={UserIcon}>
        <form onSubmit={onSave} className="space-y-4">
          <Field label="이메일">
            <Input value={user?.email ?? ''} disabled />
          </Field>
          <Field label="이름">
            <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={50} />
          </Field>
          <div className="flex items-center gap-3">
            <Button type="submit" loading={saving} disabled={!name.trim() || name === user?.name}>
              저장
            </Button>
            {msg && <span className={msg.ok ? 'text-sm text-emerald-500' : 'text-sm text-red-500'}>{msg.text}</span>}
          </div>
        </form>
      </Card>

      <Card title="화면" icon={theme === 'dark' ? Moon : Sun}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm">테마</p>
            <p className="text-xs text-muted">현재: {theme === 'dark' ? '다크 모드' : '라이트 모드'}</p>
          </div>
          <Button variant="secondary" onClick={toggle}>
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {theme === 'dark' ? '라이트로 전환' : '다크로 전환'}
          </Button>
        </div>
      </Card>

      <AppSettingsCard />
      <IntegrationsCard />
      <NotificationSettingsCard />

      <DemoDataCard />
    </div>
  );
}
