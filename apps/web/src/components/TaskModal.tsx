import { useEffect, useState, type FormEvent } from 'react';
import { api, errorMessage } from '../lib/api';
import { toLocalInput } from '../lib/date';
import { CATEGORIES, CATEGORY_LABEL, PRIORITIES, PRIORITY_LABEL, REPEATS, REPEAT_LABEL, type Category, type Priority, type Repeat, type Task } from '../lib/types';
import { Button, Field, Input, Modal, Select, Textarea } from './ui';

/** 할 일 생성/수정 모달. task 가 있으면 수정 모드 */
export default function TaskModal({
  open,
  task,
  defaultDue,
  onClose,
  onSaved,
}: {
  open: boolean;
  task?: Task | null;
  defaultDue?: Date;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [category, setCategory] = useState<Category>('GENERAL');
  const [due, setDue] = useState('');
  const [repeat, setRepeat] = useState<Repeat | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? '');
    setDescription(task?.description ?? '');
    setPriority(task?.priority ?? 'MEDIUM');
    setCategory(task?.category ?? 'GENERAL');
    setDue(task?.dueDate ? toLocalInput(new Date(task.dueDate)) : defaultDue ? toLocalInput(defaultDue) : '');
    setRepeat(task?.repeat ?? '');
    setError(null);
  }, [open, task, defaultDue]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (repeat && !due) return setError('반복하려면 마감일을 정해 주세요.');
    setSaving(true);
    setError(null);
    const body = {
      title,
      description: description.trim() ? description : task ? null : undefined,
      priority,
      category,
      dueDate: due ? new Date(due).toISOString() : task ? null : undefined,
      repeat: repeat || (task ? null : undefined),
    };
    try {
      if (task) await api.patch(`/tasks/${task.id}`, body);
      else await api.post('/tasks', body);
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={task ? '할 일 수정' : '새 할 일'}>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="제목">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="중요도">
            <Select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="카테고리">
            <Select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_9rem]">
          <Field label="마감일 (선택)">
            <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
          <Field label="반복" hint={repeat ? '끝내면 다음 마감일로 새로 생겨요' : undefined}>
            <Select value={repeat} onChange={(e) => setRepeat(e.target.value as Repeat | '')}>
              <option value="">안 함</option>
              {REPEATS.map((r) => (
                <option key={r} value={r}>
                  {REPEAT_LABEL[r]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="메모 (선택)">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} />
        </Field>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" loading={saving}>
            저장
          </Button>
        </div>
      </form>
    </Modal>
  );
}
