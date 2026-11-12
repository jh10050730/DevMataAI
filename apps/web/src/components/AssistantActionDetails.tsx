const fields: Record<string, string> = { title: '제목', name: '이름', goal: '목표', description: '설명', status: '상태', kind: '종류', notes: '메모', startAt: '시작', endAt: '종료', allDay: '종일 일정', location: '장소', priority: '우선순위', category: '분류', dueDate: '마감', completed: '완료', content: '본문', appendContent: '본문에 덧붙일 내용', tags: '태그' };
const values: Record<string, string> = { ACTIVE: '진행 중', PAUSED: '일시 중지', COMPLETED: '완료', TODO: '예정', IN_PROGRESS: '진행 중', BLOCKED: '문제 있음', DONE: '완료', TASK: '작업', FEATURE: '기능', LOW: '낮음', MEDIUM: '보통', HIGH: '높음', URGENT: '긴급', GENERAL: '일반', STUDY: '학습', DEV: '개발', SCHOOL: '학교', PERSONAL: '개인', true: '예', false: '아니오' };
const DATE_KEYS = ['startAt', 'endAt', 'dueDate'];
const LONG_KEYS = ['content', 'appendContent', 'description'];
const date = (value: string, dateOnly = false) => {
  const parsed = new Date(value);
  if (!Number.isFinite(+parsed)) return value;
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric', ...(!dateOnly ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' as const } : {}) }).format(parsed);
};
const tagList = (value: string) => { try { const tags = JSON.parse(value); return Array.isArray(tags) ? tags.join(', ') || '(없음)' : value; } catch { return value; } };
function show(key: string, value: string) {
  if (DATE_KEYS.includes(key)) return `${date(value)} (한국 시간)`;
  if (key === 'tags') return tagList(value);
  if (LONG_KEYS.includes(key) && value.length > 600) return `${value.slice(0, 600)}… (${value.length.toLocaleString('ko-KR')}자)`;
  return values[value] ?? value;
}
export default function AssistantActionDetails({ payload }: { payload: string }) {
  let data: Record<string, string> = {};
  try { const value = JSON.parse(payload); if (value && typeof value === 'object') data = value; } catch { /* Malformed optional details do not block the conversation. */ }
  const allDay = data.allDay === 'true' && Number.isFinite(+new Date(data.startAt)) && Number.isFinite(+new Date(data.endAt)) && new Date(data.endAt) > new Date(data.startAt);
  // 빈 마감은 "마감 지우기"라서 보여 준다
  const rows = Object.entries(data).filter(([key, value]) => typeof value === 'string' && (value || key === 'dueDate') && !(allDay && ['startAt', 'endAt'].includes(key)));
  return rows.length ? <ul className="mt-1 space-y-0.5 text-sm">
    {allDay && <li><span className="text-muted">기간:</span> {date(data.startAt, true)} ~ {date(new Date(+new Date(data.endAt) - 1).toISOString(), true)} (한국 시간, 마지막 날 포함)</li>}
    {rows.map(([key, value]) => <li key={key}><span className="text-muted">{fields[key] ?? key}:</span> <span className="whitespace-pre-wrap break-words">{key === 'dueDate' && !value ? '마감 지우기' : show(key, value)}</span></li>)}
  </ul> : null;
}
