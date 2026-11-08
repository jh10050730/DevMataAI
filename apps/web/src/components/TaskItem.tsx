import { Check, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { dueLabel } from '../lib/date';
import { CATEGORY_COLOR, CATEGORY_LABEL, PRIORITY_LABEL, PRIORITY_STYLE, type Task } from '../lib/types';
import { Badge, DemoBadge, cn } from './ui';

const DUE_TONE = {
  overdue: 'text-red-500',
  today: 'text-amber-500',
  soon: 'text-amber-500',
  normal: 'text-muted',
};

export default function TaskItem({
  task,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: Task;
  onToggle: (t: Task) => void;
  onEdit?: (t: Task) => void;
  onDelete?: (t: Task) => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const due = task.dueDate && !task.completed ? dueLabel(task.dueDate) : null;

  return (
    <li className="group flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-surface-2">
      <button
        onClick={() => onToggle(task)}
        className={cn(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors',
          task.completed ? 'border-blue-600 bg-blue-600 text-white' : 'border-border hover:border-blue-500',
        )}
        aria-label={task.completed ? '완료 취소' : '완료로 표시'}
      >
        {task.completed && <Check className="size-3.5" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm', task.completed && 'text-muted line-through')}>{task.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {task.isDemo && <DemoBadge />}
          <Badge className={PRIORITY_STYLE[task.priority]}>{PRIORITY_LABEL[task.priority]}</Badge>
          <span className="flex items-center gap-1 text-[11px] text-muted">
            <span className="size-1.5 rounded-full" style={{ background: CATEGORY_COLOR[task.category] }} />
            {CATEGORY_LABEL[task.category]}
          </span>
          {due && <span className={cn('text-[11px] font-medium', DUE_TONE[due.tone])}>· {due.text}</span>}
        </div>
      </div>
      {(onEdit || onDelete) && (
        <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
          {confirm ? (
            <>
              <button onClick={() => onDelete?.(task)} className="rounded-md px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-500/10">
                삭제
              </button>
              <button onClick={() => setConfirm(false)} className="rounded-md px-2 py-1 text-xs text-muted hover:bg-surface">
                취소
              </button>
            </>
          ) : (
            <>
              {onEdit && (
                <button onClick={() => onEdit(task)} className="rounded-md p-1.5 text-muted hover:bg-surface hover:text-fg" aria-label="수정">
                  <Pencil className="size-3.5" />
                </button>
              )}
              {onDelete && (
                <button onClick={() => setConfirm(true)} className="rounded-md p-1.5 text-muted hover:bg-surface hover:text-red-500" aria-label="삭제">
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </>
          )}
        </div>
      )}
    </li>
  );
}
