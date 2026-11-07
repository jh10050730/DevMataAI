import { Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { api, errorMessage } from '../lib/api';
import { addDays, startOfDay, toDateInput, toLocalInput } from '../lib/date';
import { CATEGORIES, CATEGORY_COLOR, CATEGORY_LABEL, type CalendarEvent, type Category } from '../lib/types';
import { Button, Field, Input, Modal, Select, Textarea } from './ui';

/** 일정 생성/수정/삭제 모달. event 가 있으면 수정 모드 */
export default function EventModal({
  open,
  event,
  defaultDate,
  onClose,
  onSaved,
}: {
  open: boolean;
  event?: CalendarEvent | null;
  defaultDate?: Date;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState<Category>('GENERAL');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (event) {
      const s = new Date(event.startAt);
      const e = new Date(event.endAt);
      setTitle(event.title);
      setAllDay(event.allDay);
      setStart(event.allDay ? toDateInput(s) : toLocalInput(s));
      // 종일 일정의 종료는 "다음 날 0시"로 저장 → 화면에는 마지막 날로 표시
      setEnd(event.allDay ? toDateInput(addDays(e, -1)) : toLocalInput(e));
      setLocation(event.location ?? '');
      setCategory(event.category);
      setDescription(event.description ?? '');
    } else {
      const base = defaultDate ?? new Date();
      const s = new Date(base.getFullYear(), base.getMonth(), base.getDate(), Math.min(new Date().getHours() + 1, 23));
      setTitle('');
      setAllDay(false);
      setStart(toLocalInput(s));
      setEnd(toLocalInput(new Date(s.getTime() + 3_600_000)));
      setLocation('');
      setCategory('GENERAL');
      setDescription('');
    }
    setError(null);
    setConfirmDelete(false);
  }, [open, event, defaultDate]);

  const toggleAllDay = (checked: boolean) => {
    setAllDay(checked);
    setStart((v) => (checked ? v.slice(0, 10) : `${v.slice(0, 10)}T09:00`));
    setEnd((v) => (checked ? v.slice(0, 10) : `${v.slice(0, 10)}T10:00`));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const startAt = allDay ? startOfDay(new Date(`${start}T00:00`)) : new Date(start);
    const endAt = allDay ? addDays(startOfDay(new Date(`${end}T00:00`)), 1) : new Date(end);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) return setError('시간을 입력해주세요.');
    if (endAt < startAt) return setError('종료 시간은 시작 시간보다 뒤여야 합니다.');

    const body = {
      title,
      allDay,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      location: location.trim() ? location : event ? null : undefined,
      description: description.trim() ? description : event ? null : undefined,
      category,
      color: CATEGORY_COLOR[category],
    };
    setSaving(true);
    try {
      if (event) await api.patch(`/events/${event.id}`, body);
      else await api.post('/events', body);
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!event) return;
    setSaving(true);
    try {
      await api.delete(`/events/${event.id}`);
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const inputType = allDay ? 'date' : 'datetime-local';
  // Google Calendar 에서 가져온 일정은 읽기 전용 (서버도 수정·삭제를 거부)
  const readOnly = !!event && event.source !== 'LOCAL';

  return (
    <Modal open={open} onClose={onClose} title={readOnly ? 'Google Calendar 일정' : event ? '일정 수정' : '새 일정'}>
      <form onSubmit={onSubmit} className="space-y-4">
        {readOnly && (
          <p className="rounded-lg bg-blue-500/10 px-3 py-2 text-xs text-blue-600 dark:text-blue-400">
            Google Calendar 에서 가져온 일정이라 여기서는 볼 수만 있어요. 수정·삭제는 Google Calendar 에서 한 뒤 설정 화면에서 동기화하세요.
          </p>
        )}
        <fieldset disabled={readOnly} className="space-y-4 disabled:opacity-80">
        <Field label="제목">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} autoFocus />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={allDay} onChange={(e) => toggleAllDay(e.target.checked)} className="size-4 accent-blue-600" />
          종일
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="시작">
            <Input type={inputType} value={start} onChange={(e) => setStart(e.target.value)} required />
          </Field>
          <Field label="종료">
            <Input type={inputType} value={end} onChange={(e) => setEnd(e.target.value)} required />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="카테고리">
            <Select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="장소 (선택)">
            <Input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} />
          </Field>
        </div>
        <Field label="메모 (선택)">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} />
        </Field>
        </fieldset>
        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex items-center justify-between gap-2">
          {event && !readOnly ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">삭제할까요?</span>
                <Button type="button" variant="danger" onClick={onDelete} loading={saving}>
                  삭제
                </Button>
                <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
                  아니요
                </Button>
              </div>
            ) : (
              <Button type="button" variant="ghost" onClick={() => setConfirmDelete(true)} className="text-red-500">
                <Trash2 className="size-4" /> 삭제
              </Button>
            )
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant={readOnly ? 'secondary' : 'ghost'} onClick={onClose}>
              {readOnly ? '닫기' : '취소'}
            </Button>
            {!readOnly && (
              <Button type="submit" loading={saving}>
                저장
              </Button>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
}
