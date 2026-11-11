import { useEffect, useState } from 'react';
import { api, errorMessage } from '../lib/api';
import { Button, Select } from './ui';
export type ChatModel = { provider?: 'claude-cli' | 'chatgpt' | 'gemini'; model?: string };
export type ModelCatalog = { selection: string; groups: { provider: 'claude-cli' | 'chatgpt' | 'gemini'; label: string; models: { id: string; name: string }[]; message?: string }[] };
export function ChatModelOptions({ catalog, value, disabled, onChange }: { catalog: ModelCatalog; value: string; disabled: boolean; onChange: (value: string) => void }) {
  return <Select aria-label="채팅 모델 선택" className="sm:max-w-72" value={value} disabled={disabled} onChange={event => onChange(event.target.value)}>
    <option value="">{catalog.selection === 'claude-cli' ? '기본 모델 · Claude' : catalog.selection === 'chatgpt' ? '기본 모델 · ChatGPT' : catalog.selection === 'gemini' ? '기본 모델 · Gemini' : '기본 모델'}</option>
    {catalog.groups.map(group => <optgroup key={group.provider} label={group.label}>
      {group.models.length > 0 && <option value={JSON.stringify({ provider: group.provider })}>{group.label} · 기본 모델</option>}
      {group.models.map(model => <option key={model.id} value={JSON.stringify({ provider: group.provider, model: model.id })}>{group.label} · {model.name}</option>)}
    </optgroup>)}
  </Select>;
}
export default function ChatModelPicker({ busy, onChange }: { busy: boolean; onChange: (choice: ChatModel) => void }) {
  const [catalog, setCatalog] = useState<ModelCatalog>({ selection: '', groups: [] });
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    api.get<ModelCatalog>('/ai/models').then(result => { if (active) { setCatalog(result); setValue(''); onChange({}); } }).catch(e => { if (active) { setError(errorMessage(e)); setCatalog({ selection: '', groups: [] }); setValue(''); onChange({}); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);
  return <div className="mt-4 space-y-2">
    <div className="flex flex-wrap items-center gap-2"><label className="text-sm text-muted">사용할 모델</label><ChatModelOptions catalog={catalog} value={value} disabled={busy || loading || !catalog.groups.length} onChange={key => { setValue(key); onChange(key ? JSON.parse(key) as ChatModel : {}); }} /><Button variant="secondary" disabled={busy || loading} className="text-xs" onClick={() => setRevision(current => current + 1)}>모델 새로고침</Button></div>
    {error && <p role="status" className="text-xs text-red-500">{error}</p>}
    {!loading && !error && !catalog.groups.length && <p role="status" className="text-xs text-muted">설정에서 AI 계정을 연결하면 모델을 선택할 수 있습니다.</p>}
    {catalog.groups.filter(group => group.message).map(group => <p key={group.provider} role="status" className="text-xs text-muted">{group.message}</p>)}
    <p className="text-xs text-muted">연결된 AI 계정의 모델을 표시합니다. 여러 계정이 연결되면 각 서비스의 모델이 함께 나타납니다.</p>
  </div>;
}
