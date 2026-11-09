import { AlertCircle, CalendarDays, CheckCircle2, Clock, FolderGit2, ListTodo, Newspaper, Sparkles, TrendingUp, type LucideIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import DueReviewCard from '../components/DueReviewCard';
import TaskItem from '../components/TaskItem';
import { Card, EmptyState, ErrorState, ProgressBar, Skeleton, cn } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { api, errorMessage } from '../lib/api';
import { addDays, fmtDate, fmtFullDate, fmtTime, startOfDay } from '../lib/date';
import { CATEGORY_COLOR, CATEGORY_LABEL, type CalendarEvent, type DashboardToday, type Task } from '../lib/types';
import { useAsync } from '../lib/useAsync';

function Stat({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string | number; tone: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2 text-xs text-muted">
        <Icon className={cn('size-4', tone)} />
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function EventRow({ e }: { e: CalendarEvent }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <span className="h-8 w-1 rounded-full" style={{ background: e.color ?? CATEGORY_COLOR[e.category] }} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{e.title}</p>
        <p className="text-xs text-muted">{e.allDay ? '종일' : `${fmtTime(e.startAt)} – ${fmtTime(e.endAt)}`}</p>
      </div>
    </li>
  );
}

/** 이후 Phase 에서 채워질 영역 */
function Shortcut({ icon: Icon, title, text, to }: { icon: LucideIcon; title: string; text: string; to: string }) {
  return (
    <Card title={title} icon={Icon} action={<Link to={to} className="text-xs text-blue-500 hover:underline">열기 →</Link>}>
      <p className="text-sm text-muted">{text}</p>
    </Card>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const today = useMemo(() => startOfDay(new Date()), []);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, error, loading, reload } = useAsync(
    () => api.get<DashboardToday>(`/dashboard/today?from=${today.toISOString()}&to=${addDays(today, 1).toISOString()}`),
    [today.getTime()],
  );

  const onToggle = async (t: Task) => {
    setActionError(null);
    try {
      await api.patch(`/tasks/${t.id}`, { completed: !t.completed });
      await reload();
    } catch (e) {
      setActionError(errorMessage(e));
    }
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? '좋은 아침이에요' : hour < 18 ? '좋은 오후예요' : '좋은 저녁이에요';

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-gradient-to-br from-blue-600/15 via-surface to-violet-600/15 p-6">
        <p className="text-sm text-muted">{fmtFullDate(today)}</p>
        <h2 className="mt-1 text-xl font-semibold sm:text-2xl">
          {greeting}, {user?.name}님 👋
        </h2>
        {data && (
          <p className="mt-2 text-sm text-muted">
            오늘 일정 {data.todayEvents.length}개, 오늘 마감 {data.tasks.dueToday.length}개
            {data.tasks.overdue.length > 0 && <span className="text-red-500">, 지난 마감 {data.tasks.overdue.length}개</span>}가 있어요.
          </p>
        )}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat icon={CalendarDays} label="오늘 일정" value={data?.todayEvents.length ?? '–'} tone="text-blue-500" />
            <Stat icon={Clock} label="오늘 마감" value={data?.tasks.dueToday.length ?? '–'} tone="text-amber-500" />
            <Stat icon={AlertCircle} label="지난 마감" value={data?.tasks.overdue.length ?? '–'} tone="text-red-500" />
            <Stat icon={CheckCircle2} label="전체 진행률" value={data ? `${data.stats.rate}%` : '–'} tone="text-emerald-500" />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card title="오늘의 일정" icon={CalendarDays} action={<Link to="/calendar" className="text-xs text-blue-500 hover:underline">캘린더</Link>}>
              {loading && !data ? (
                <Skeleton lines={3} />
              ) : !data?.todayEvents.length ? (
                <EmptyState icon={CalendarDays} title="오늘 일정이 없어요" />
              ) : (
                <ul className="divide-y divide-border">
                  {data.todayEvents.map((e) => (
                    <EventRow key={e.id} e={e} />
                  ))}
                </ul>
              )}
            </Card>

            <Card title="해야 할 일" icon={ListTodo} className="lg:col-span-2" action={<Link to="/calendar" className="text-xs text-blue-500 hover:underline">전체 보기</Link>}>
              {actionError && <p className="mb-2 text-xs text-red-500">{actionError}</p>}
              {loading && !data ? (
                <Skeleton lines={4} />
              ) : data && data.tasks.overdue.length + data.tasks.dueToday.length + data.tasks.dueSoon.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="급한 할 일이 없어요"
                  description={data.tasks.openCount > 0 ? `마감일이 여유 있는 할 일 ${data.tasks.openCount}개가 남아 있어요.` : '할 일을 추가해서 관리를 시작해보세요.'}
                />
              ) : (
                data && (
                  <div className="space-y-4">
                    {(
                      [
                        ['지난 마감', data.tasks.overdue, 'text-red-500'],
                        ['오늘 마감', data.tasks.dueToday, 'text-amber-500'],
                        ['마감 임박 (2일 이내)', data.tasks.dueSoon, 'text-muted'],
                      ] as const
                    ).map(
                      ([label, list, tone]) =>
                        list.length > 0 && (
                          <div key={label}>
                            <p className={cn('mb-1 text-xs font-medium', tone)}>
                              {label} · {list.length}
                            </p>
                            <ul className="-mx-2">
                              {list.map((t) => (
                                <TaskItem key={t.id} task={t} onToggle={onToggle} />
                              ))}
                            </ul>
                          </div>
                        ),
                    )}
                  </div>
                )
              )}
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card title="카테고리별 진행률" icon={TrendingUp}>
              {loading && !data ? (
                <Skeleton lines={3} />
              ) : !data?.stats.total ? (
                <EmptyState icon={TrendingUp} title="아직 기록이 없어요" description="할 일을 등록하고 완료하면 진행률이 표시돼요." />
              ) : (
                <ul className="space-y-3">
                  {data.stats.byCategory
                    .filter((c) => c.total > 0)
                    .map((c) => (
                      <li key={c.category}>
                        <div className="mb-1 flex justify-between text-xs">
                          <span>{CATEGORY_LABEL[c.category]}</span>
                          <span className="text-muted">
                            {c.done}/{c.total} · {c.rate}%
                          </span>
                        </div>
                        <ProgressBar value={c.rate} />
                      </li>
                    ))}
                </ul>
              )}
            </Card>

            <Card title="다가오는 일정 (7일)" icon={Clock}>
              {loading && !data ? (
                <Skeleton lines={3} />
              ) : !data?.upcomingEvents.length ? (
                <EmptyState icon={Clock} title="예정된 일정이 없어요" />
              ) : (
                <ul className="divide-y divide-border">
                  {data.upcomingEvents.map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <span className="truncate">{e.title}</span>
                      <span className="shrink-0 text-xs text-muted">
                        {fmtDate(e.startAt)} {!e.allDay && fmtTime(e.startAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Shortcut icon={Sparkles} title="AI 비서 · 아침 브리핑" to="/assistant" text="일정·할 일·복습·프로젝트·뉴스를 모아 오늘의 우선순위를 보여주고, 채팅으로 정리를 도와줘요." />
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <DueReviewCard />
            <Shortcut icon={Newspaper} title="오늘의 뉴스" to="/news" text="매일 아침 7시에 모은 IT·경제 뉴스와 분야별 브리핑을 확인하세요." />
            <Shortcut icon={FolderGit2} title="프로젝트 현황" to="/projects" text="작업 완료율과 AI 추정 진행률, GitHub 최근 활동, 주간 보고서를 확인하세요." />
          </div>
        </>
      )}
    </div>
  );
}
