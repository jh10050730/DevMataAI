import { SlidersHorizontal } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, errorMessage } from '../lib/api';
import { Button, Card, Field, Input, Select, Spinner } from './ui';
type Setting = { key: string; label: string; group: string; secret: boolean; configured: boolean; source: string; value?: string };
export default function AppSettingsCard() {
  const [settings, setSettings] = useState<Setting[]>();
  const [draft, setDraft] = useState<Record<string, string | null>>({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { let active = true; api.get<{ settings: Setting[] }>('/app-settings').then(data => { if (active) setSettings(data.settings); }).catch(e => { if (active) setError(errorMessage(e)); }); return () => { active = false; }; }, []);
  function change(row: Setting, value: string) {
    setMessage(''); setDraft(current => { const next = { ...current }; if (row.secret && !value) delete next[row.key]; else next[row.key] = value; return next; });
  }
  async function save() {
    setBusy(true); setError(''); setMessage('');
    try { const data = await api.patch<{ settings: Setting[] }>('/app-settings', { values: draft }); setSettings(data.settings); setDraft({}); setMessage('설정을 저장했습니다. 새 요청부터 적용됩니다. Google 인증 정보를 바꿨다면 다시 연결해 주세요.'); }
    catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }
  return <Card title="앱 연결 설정" icon={SlidersHorizontal}>
    <p className="mb-5 text-sm leading-6 text-muted">처음 가입한 관리자 계정이 이 PC의 연결 정보를 관리합니다. 비밀번호와 토큰은 암호화해 저장하며 다시 표시하지 않습니다.</p>
    {!settings && !error && <Spinner />}
    {settings && <form onSubmit={e => { e.preventDefault(); void save(); }} className="space-y-6">
      {[...new Set(settings.map(row => row.group))].map(group => <fieldset key={group} disabled={busy} className="space-y-4 border-t border-border pt-4"><legend className="pr-3 text-sm font-semibold">{group}</legend>
        {settings.filter(row => row.group === group).map(row => <div key={row.key}>
          <Field label={row.label} hint={`${row.configured ? '설정됨' : '미설정'} · ${row.source === 'app' ? '앱에 저장한 값' : row.source === 'environment' ? '기본 설정' : '입력 필요'}${draft[row.key] === null ? ' · 기본값 복귀 예정' : draft[row.key] === '' ? ' · 비우기 예정' : ''}`}>
            {row.key === 'ai.provider' ? <Select value={draft[row.key] ?? row.value ?? 'claude-cli'} onChange={e => change(row, e.target.value)}><option value="claude-cli">내 Claude Code 계정</option><option value="demo">데모 모드</option></Select> : <Input type={row.secret ? 'password' : row.key === 'smtp.from' ? 'email' : 'text'} value={draft[row.key] ?? (row.secret ? '' : row.value ?? '')} maxLength={4096} autoComplete={row.secret ? 'new-password' : 'off'} placeholder={row.secret && row.configured ? '변경할 때만 새 값을 입력해 주세요' : ''} onChange={e => change(row, e.target.value)} />}
          </Field>
          <div className="mt-2 flex flex-wrap gap-4 text-xs"><button type="button" onClick={() => setDraft(current => ({ ...current, [row.key]: null }))} className="text-muted hover:text-accent">기본 설정으로 복귀</button>{row.key !== 'ai.provider' && row.key !== 'smtp.port' && <button type="button" onClick={() => setDraft(current => ({ ...current, [row.key]: '' }))} className="text-muted hover:text-red-500">저장값 비우기</button>}{Object.prototype.hasOwnProperty.call(draft, row.key) && <button type="button" onClick={() => setDraft(current => { const next = { ...current }; delete next[row.key]; return next; })} className="text-muted hover:text-accent">변경 취소</button>}</div>
        </div>)}
      </fieldset>)}
      <Button type="submit" loading={busy} disabled={!Object.keys(draft).length}>연결 설정 저장</Button>
    </form>}
    {error && <p role="alert" className="mt-4 text-sm text-red-500">{error}</p>}
    {message && <p role="status" className="mt-4 text-sm leading-6 text-accent">{message}</p>}
  </Card>;
}
