import { BookOpen, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router';
import { fmtDate } from '../lib/date';
import { studyApi } from '../lib/study';
import { useAsync } from '../lib/useAsync';
import { Card, EmptyState, ErrorState, Skeleton } from './ui';

/** 대시보드: 지금 복습해야 하는 학습 노트 */
export default function DueReviewCard() {
  const { data, error, loading, reload } = useAsync(() => studyApi.notes({ due: true }), []);
  const list = (data ?? []).slice(0, 5);

  return (
    <Card title="복습할 학습 내용" icon={BookOpen} action={<Link to="/study" className="text-xs text-blue-500 hover:underline">학습</Link>}>
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading && !data ? (
        <Skeleton lines={3} />
      ) : list.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="지금 복습할 노트가 없어요" />
      ) : (
        <ul className="divide-y divide-border">
          {list.map((n) => (
            <li key={n.id}>
              <Link to={`/study?note=${n.id}`} className="flex items-center gap-2 py-2 text-sm hover:text-blue-500">
                <span className="size-2 shrink-0 rounded-full" style={{ background: n.subject?.color ?? '#64748b' }} />
                <span className="flex-1 truncate">{n.title}</span>
                <span className="shrink-0 text-[11px] text-muted">{n.lastStudiedAt ? `마지막 ${fmtDate(n.lastStudiedAt)}` : '처음 학습'}</span>
              </Link>
            </li>
          ))}
          {(data?.length ?? 0) > 5 && <li className="pt-2 text-xs text-muted">외 {data!.length - 5}개</li>}
        </ul>
      )}
    </Card>
  );
}
