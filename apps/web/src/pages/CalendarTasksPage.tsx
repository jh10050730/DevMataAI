import { CalendarDays, ChevronLeft, ChevronRight, ListTodo, MapPin, Plus, Search, X } from 'lucide-react';
import { useCallback, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import EventModal from '../components/EventModal';
import TaskItem from '../components/TaskItem';
import TaskModal from '../components/TaskModal';
import { Button, Card, DemoBadge, EmptyState, ErrorState, Input, ProgressBar, Select, Skeleton, cn } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { addDays, addMonths, fmtDate, fmtTime, isSameDay, monthGrid, overlapsDay, startOfDay, weekDays } from '../lib/date';
import { CATEGORIES, CATEGORY_COLOR, CATEGORY_LABEL, type CalendarEvent, type Category, type Task, type TaskStats } from '../lib/types';
import { useAsync } from '../lib/useAsync';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export default function CalendarTasksPage() {
  const [view, setView] = useState<'month' | 'week'>('month');
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState(() => startOfDay(new Date()));
  const [eventModal, setEventModal] = useState<{ open: boolean; event?: CalendarEvent | null }>({ open: false });

  const days = useMemo(() => (view === 'month' ? monthGrid(cursor) : weekDays(cursor)), [view, cursor]);
  const from = days[0];
  const to = addDays(days[days.length - 1], 1);

  const events = useAsync(
    () => api.get<CalendarEvent[]>(`/events?from=${from.toISOString()}&to=${to.toISOString()}`),
    [from.getTime(), to.getTime()],
  );
  const tasks = useAsync(() => api.get<Task[]>('/tasks'), []);

  const move = (dir: number) => setCursor((c) => (view === 'month' ? addMonths(c, dir) : addDays(c, dir * 7)));
  const goToday = () => {
    setCursor(new Date());
    setSelected(startOfDay(new Date()));
  };

  const eventsOn = (d: Date) => (events.data ?? []).filter((e) => overlapsDay(e.startAt, e.endAt, d));
  const dueOn = (d: Date) => (tasks.data ?? []).filter((t) => t.dueDate && !t.completed && isSameDay(new Date(t.dueDate), d));

  const title =
    view === 'month'
      ? cursor.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })
      : `${fmtDate(days[0])} – ${fmtDate(days[6])}`;

  const selectedEvents = eventsOn(selected);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <Card>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h2 className="mr-auto text-base font-semibold">{title}</h2>
            <div className="flex rounded-lg border border-border p-0.5 text-xs">
              {(['month', 'week'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn('rounded-md px-2.5 py-1', view === v ? 'bg-blue-600 text-white' : 'text-muted hover:text-fg')}
                >
                  {v === 'month' ? '월간' : '주간'}
                </button>
              ))}
            </div>
            <Button variant="secondary" onClick={goToday} className="px-2.5 py-1 text-xs">
              오늘
            </Button>
            <button onClick={() => move(-1)} className="rounded-md p-1.5 text-muted hover:bg-surface-2" aria-label="이전">
              <ChevronLeft className="size-4" />
            </button>
            <button onClick={() => move(1)} className="rounded-md p-1.5 text-muted hover:bg-surface-2" aria-label="다음">
              <ChevronRight className="size-4" />
            </button>
          </div>

          {events.error ? (
            <ErrorState message={events.error} onRetry={events.reload} />
          ) : (
            <div className={cn('transition-opacity', events.loading && 'opacity-60')}>
              <div className="grid grid-cols-7 border-b border-border pb-2 text-center text-xs text-muted">
                {WEEKDAYS.map((w, i) => (
                  <span key={w} className={cn(i === 0 && 'text-red-400', i === 6 && 'text-blue-400')}>
                    {w}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {days.map((d) => {
                  const dayEvents = eventsOn(d);
                  const due = dueOn(d);
                  const inMonth = view === 'week' || d.getMonth() === cursor.getMonth();
                  const isToday = isSameDay(d, new Date());
                  const isSel = isSameDay(d, selected);
                  const max = view === 'month' ? 2 : 8;
                  return (
                    <button
                      key={d.toISOString()}
                      onClick={() => setSelected(startOfDay(d))}
                      onDoubleClick={() => setEventModal({ open: true })}
                      className={cn(
                        'flex flex-col gap-1 border-b border-r border-border p-1 text-left transition-colors hover:bg-surface-2 [&:nth-child(7n)]:border-r-0',
                        view === 'month' ? 'min-h-16 sm:min-h-24' : 'min-h-48',
                        isSel && 'bg-blue-500/5 ring-1 ring-inset ring-blue-500/50',
                      )}
                    >
                      <span className="flex items-center gap-1">
                        <span
                          className={cn(
                            'flex size-6 items-center justify-center rounded-full text-xs',
                            isToday && 'bg-blue-600 font-semibold text-white',
                            !inMonth && 'text-muted/50',
                          )}
                        >
                          {d.getDate()}
                        </span>
                        {due.length > 0 && <span className="size-1.5 rounded-full bg-amber-500" title={`마감 ${due.length}건`} />}
                      </span>
                      {dayEvents.slice(0, max).map((e) => (
                        <span
                          key={e.id}
                          className="hidden truncate rounded px-1 py-0.5 text-[11px] sm:block"
                          style={{ background: `${e.color ?? CATEGORY_COLOR[e.category]}22`, color: e.color ?? CATEGORY_COLOR[e.category] }}
                        >
                          {!e.allDay && view === 'week' && `${fmtTime(e.startAt)} `}
                          {e.title}
                        </span>
                      ))}
                      {dayEvents.length > 0 && (
                        <span className="text-[10px] text-muted sm:hidden">● {dayEvents.length}</span>
                      )}
                      {dayEvents.length > max && <span className="hidden text-[10px] text-muted sm:block">+{dayEvents.length - max}개</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </Card>

        <Card
          title={`${fmtDate(selected)} 일정`}
          icon={CalendarDays}
          action={
            <Button onClick={() => setEventModal({ open: true })} className="px-2.5 py-1 text-xs">
              <Plus className="size-3.5" /> 일정 추가
            </Button>
          }
        >
          {events.loading && !events.data ? (
            <Skeleton lines={2} />
          ) : selectedEvents.length === 0 ? (
            <EmptyState icon={CalendarDays} title="일정이 없어요" description="날짜를 더블클릭하거나 ‘일정 추가’로 등록하세요." />
          ) : (
            <ul className="space-y-2">
              {selectedEvents.map((e) => (
                <li key={e.id}>
                  <button
                    onClick={() => setEventModal({ open: true, event: e })}
                    className="flex w-full items-start gap-3 rounded-lg border border-border p-3 text-left hover:border-blue-500/50"
                  >
                    <span className="mt-1 h-8 w-1 shrink-0 rounded-full" style={{ background: e.color ?? CATEGORY_COLOR[e.category] }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{e.title}</span>
                      <span className="block text-xs text-muted">
                        {e.allDay ? '종일' : `${fmtTime(e.startAt)} – ${fmtTime(e.endAt)}`}
                        {e.location && (
                          <span className="ml-2 inline-flex items-center gap-0.5">
                            <MapPin className="size-3" />
                            {e.location}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-muted">
                      {e.isDemo && <DemoBadge />}
                      {e.source === 'GOOGLE' ? 'Google' : CATEGORY_LABEL[e.category]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <TasksPanel tasks={tasks} selected={selected} />

      <EventModal
        open={eventModal.open}
        event={eventModal.event}
        defaultDate={selected}
        onClose={() => setEventModal({ open: false })}
        onSaved={events.reload}
      />
    </div>
  );
}

function TasksPanel({ tasks, selected }: { tasks: ReturnType<typeof useAsync<Task[]>>; selected: Date }) {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const [status, setStatus] = useState<'all' | 'active' | 'completed'>('active');
  const [category, setCategory] = useState<Category | ''>('');
  const [quickTitle, setQuickTitle] = useState('');
  const [modal, setModal] = useState<{ open: boolean; task?: Task | null }>({ open: false });
  const [actionError, setActionError] = useState<string | null>(null);

  const stats = useAsync(() => api.get<TaskStats>('/tasks/stats'), []);
  const refresh = useCallback(() => {
    void tasks.reload();
    void stats.reload();
  }, [tasks, stats]);

  const visible = (tasks.data ?? []).filter(
    (t) =>
      (status === 'all' || (status === 'active' ? !t.completed : t.completed)) &&
      (!category || t.category === category) &&
      (!q || t.title.toLowerCase().includes(q.toLowerCase())),
  );

  const run = async (fn: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await fn();
      refresh();
    } catch (e) {
      setActionError(errorMessage(e));
    }
  };

  const onToggle = (t: Task) => {
    // 즉시 반영 후 서버 저장 (실패 시 다시 불러옴)
    tasks.setData((list) => list?.map((x) => (x.id === t.id ? { ...x, completed: !x.completed } : x)) ?? null);
    void run(() => api.patch(`/tasks/${t.id}`, { completed: !t.completed }));
  };

  const onQuickAdd = (e: FormEvent) => {
    e.preventDefault();
    const title = quickTitle.trim();
    if (!title) return;
    setQuickTitle('');
    void run(() => api.post('/tasks', { title }));
  };

  return (
    <Card
      title="할 일"
      icon={ListTodo}
      className="h-fit"
      action={
        <Button onClick={() => setModal({ open: true })} className="px-2.5 py-1 text-xs">
          <Plus className="size-3.5" /> 상세 추가
        </Button>
      }
    >
      {stats.data && (
        <div className="mb-4 space-y-1.5">
          <div className="flex justify-between text-xs text-muted">
            <span>진행률</span>
            <span>
              {stats.data.done}/{stats.data.total} 완료 · {stats.data.rate}%
            </span>
          </div>
          <ProgressBar value={stats.data.rate} />
        </div>
      )}

      <form onSubmit={onQuickAdd} className="mb-3">
        <Input value={quickTitle} onChange={(e) => setQuickTitle(e.target.value)} placeholder="할 일 입력 후 Enter" maxLength={200} />
      </form>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-border p-0.5 text-xs">
          {(['active', 'completed', 'all'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={cn('rounded-md px-2 py-1', status === s ? 'bg-surface-2 font-medium text-fg' : 'text-muted')}
            >
              {s === 'active' ? '진행 중' : s === 'completed' ? '완료' : '전체'}
            </button>
          ))}
        </div>
        <Select value={category} onChange={(e) => setCategory(e.target.value as Category | '')} className="w-auto py-1 text-xs">
          <option value="">모든 카테고리</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </Select>
      </div>

      {q && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-blue-500/10 px-3 py-1.5 text-xs text-blue-600 dark:text-blue-400">
          <Search className="size-3.5" /> “{q}” 검색 결과
          <button onClick={() => setParams({})} className="ml-auto" aria-label="검색 해제">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {actionError && <p className="mb-2 text-xs text-red-500">{actionError}</p>}

      {tasks.error ? (
        <ErrorState message={tasks.error} onRetry={refresh} />
      ) : tasks.loading && !tasks.data ? (
        <Skeleton lines={4} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title={q ? '검색 결과가 없어요' : status === 'completed' ? '완료한 할 일이 없어요' : '할 일이 없어요'}
          description={q || status === 'completed' ? undefined : '위 입력창에 할 일을 적고 Enter를 눌러보세요.'}
        />
      ) : (
        <ul className="-mx-2 space-y-0.5">
          {visible.map((t) => (
            <TaskItem
              key={t.id}
              task={t}
              onToggle={onToggle}
              onEdit={(task) => setModal({ open: true, task })}
              onDelete={(task) => void run(() => api.delete(`/tasks/${task.id}`))}
            />
          ))}
        </ul>
      )}

      <TaskModal
        open={modal.open}
        task={modal.task}
        defaultDue={new Date(selected.getFullYear(), selected.getMonth(), selected.getDate(), 23, 59)}
        onClose={() => setModal({ open: false })}
        onSaved={refresh}
      />
    </Card>
  );
}
