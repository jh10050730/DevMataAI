import { NotebookPen, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, errorMessage } from '../lib/api';
import { toDateInput } from '../lib/date';
import Markdown from './Markdown';
import { Button, Card, EmptyState, ErrorState, Input } from './ui';

type DevLog = { id: string; day: string; content: string; commitCount: number; provider: string; demo: boolean; updatedAt: string };
const dayLabel = (day: string) => new Date(`${day}T00:00:00+09:00`).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short' });

/** 개발일지: 하루 커밋(PC 폴더 git · GitHub)을 모아 AI가 "오늘 한 일"로 정리한 기록 */
export default function DevLogCard({ projectId, hasSource }: { projectId: string; hasSource: boolean }) {
  const today = toDateInput(new Date());
  const [day, setDay] = useState(today);
  const [logs, setLogs] = useState<DevLog[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setLogs([]); setError('');
    api.get<DevLog[]>(`/projects/${projectId}/devlogs`).then(rows => { if (active) setLogs(rows); }).catch(e => { if (active) setError(errorMessage(e)); });
    return () => { active = false; };
  }, [projectId]);
  async function run(action: () => Promise<void>) {
    setBusy(true); setError('');
    try { await action(); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  const make = () => run(async () => {
    const log = await api.post<DevLog>(`/projects/${projectId}/devlogs`, { day });
    setLogs(rows => [log, ...rows.filter(r => r.day !== log.day)].sort((a, b) => b.day.localeCompare(a.day)));
  });
  const remove = (log: DevLog) => run(async () => { await api.delete(`/projects/${projectId}/devlogs/${log.id}`); setLogs(rows => rows.filter(r => r.id !== log.id)); });
  return <Card title="개발일지" icon={NotebookPen} action={<div className="flex items-center gap-2"><Input type="date" aria-label="개발일지 날짜" className="w-40" max={today} value={day} onChange={e => setDay(e.target.value)} /><Button loading={busy} disabled={!hasSource || !day} onClick={() => void make()}>만들기</Button></div>}>
    <p className="mb-4 text-xs leading-5 text-muted">{hasSource ? '고른 날의 커밋을 PC 폴더(git)와 GitHub에서 모아 AI가 한 일·바뀐 곳·다음에 할 일로 정리해요. 같은 날을 다시 만들면 새로 정리해요. 아침 브리핑을 켜 두면 어제 일지는 자동으로 만들어져요.' : '프로젝트 수정에서 PC 폴더 경로나 GitHub 저장소를 등록하면 커밋으로 개발일지를 만들 수 있어요.'}</p>
    {error && <div className="mb-3"><ErrorState message={error} /></div>}
    {!logs.length ? <EmptyState title="아직 개발일지가 없어요" /> : logs.map((log, i) => <details key={log.id} open={i === 0} className="mb-3 rounded-xl border border-border p-4">
      <summary className="flex cursor-pointer items-center gap-2 text-sm"><span className="flex-1 font-medium">{dayLabel(log.day)} · 커밋 {log.commitCount}개</span><span className="text-xs text-muted">{log.provider === 'none' ? 'AI 없이' : log.demo ? 'DEMO' : log.provider}</span><button type="button" aria-label={`${log.day} 개발일지 삭제`} disabled={busy} onClick={e => { e.preventDefault(); if (window.confirm('이 개발일지를 삭제할까요?')) void remove(log); }} className="rounded-md p-1 text-muted hover:text-red-500"><Trash2 className="size-3.5" /></button></summary>
      <Markdown className="mt-4" source={log.content} />
    </details>)}
  </Card>;
}
