import { FlaskConical } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, errorMessage } from '../lib/api';
import { Button, Card, DemoBadge } from './ui';

type Counts = { tasks: number; events: number; notes: number; total: number };

/** 샘플 할 일·일정·학습 노트를 넣고 빼는 카드. 데모 항목에는 DEMO 배지가 붙고 실제 데이터는 건드리지 않는다. */
export default function DemoDataCard() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    api.get<Counts>('/demo').then(setCounts, (e) => setMsg({ ok: false, text: errorMessage(e) }));
  }, []);

  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    setMsg(null);
    try {
      setMsg({ ok: true, text: await fn() });
    } catch (e) {
      setMsg({ ok: false, text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const add = () => run(async () => {
    const c = await api.post<Counts>('/demo');
    setCounts(c);
    return `할 일 ${c.tasks}개, 일정 ${c.events}개, 학습 노트 ${c.notes}개를 추가했어요.`;
  });
  const remove = () => {
    if (!window.confirm('DEMO 표시가 있는 할 일·일정·학습 노트를 모두 삭제할까요? 직접 만든 데이터는 지워지지 않습니다.')) return;
    void run(async () => {
      const c = await api.delete<Counts>('/demo');
      setCounts({ tasks: 0, events: 0, notes: 0, total: 0 });
      return `데모 데이터 ${c.total}개를 삭제했어요.`;
    });
  };

  const has = !!counts?.total;
  return (
    <Card title="데모 데이터" icon={FlaskConical}>
      <p className="text-sm">
        화면을 둘러볼 수 있도록 샘플 할 일·일정·학습 노트를 추가합니다. 추가된 항목에는 <DemoBadge /> 배지가 붙습니다.
      </p>
      <p className="mt-1 text-xs text-muted">
        {counts === null ? '불러오는 중…' : has ? `현재 데모 데이터: 할 일 ${counts.tasks} · 일정 ${counts.events} · 학습 노트 ${counts.notes}` : '현재 데모 데이터가 없습니다.'}
        {' '}삭제할 때는 데모 항목만 지우고, 직접 만든 데이터는 그대로 둡니다.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={() => void add()} loading={busy && !has} disabled={busy || counts === null || has}>
          데모 데이터 추가
        </Button>
        <Button variant="danger" onClick={remove} loading={busy && has} disabled={busy || !has}>
          데모 데이터 삭제
        </Button>
        {msg && <span className={msg.ok ? 'text-sm text-emerald-500' : 'text-sm text-red-500'}>{msg.text}</span>}
      </div>
    </Card>
  );
}
