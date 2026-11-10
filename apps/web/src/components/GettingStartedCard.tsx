import { CheckCircle2, Circle, Rocket, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';

export interface GettingStarted {
  ai: boolean;
  task: boolean;
  event: boolean;
  note: boolean;
  project: boolean;
  google: boolean;
}

/** 처음 해 볼 일 목록. optional 항목은 안 해도 "모두 완료" 로 본다. */
export const STEPS: { key: keyof GettingStarted; title: string; text: string; to: string; optional?: boolean }[] = [
  { key: 'ai', title: 'AI 연결하기', text: '설정 → 외부 연동에서 연결 테스트를 눌러 내 AI 계정이 동작하는지 확인해요.', to: '/settings' },
  { key: 'task', title: '할 일 하나 등록하기', text: '오늘 할 일을 적어 두면 홈에서 마감과 진행률을 챙겨 줘요.', to: '/calendar' },
  { key: 'event', title: '일정 하나 추가하기', text: '달력에서 날짜를 더블클릭하면 바로 추가돼요.', to: '/calendar' },
  { key: 'note', title: '학습 노트 써 보기', text: '배운 내용을 적으면 AI가 요약하고 복습 시기를 알려 줘요.', to: '/study' },
  { key: 'project', title: '프로젝트 만들기', text: '목표와 작업을 등록하면 진행률과 주간 보고서를 만들어 줘요.', to: '/projects' },
  { key: 'google', title: 'Google 캘린더 연결 (선택)', text: 'Google 일정을 읽기 전용으로 가져와 한곳에서 봐요.', to: '/settings', optional: true },
];

const hiddenKey = (userId: string) => `devmate-getting-started-hidden:${userId}`;
const readHidden = (userId: string) => { try { return localStorage.getItem(hiddenKey(userId)) === '1'; } catch { return false; } };

export const allDone = (p: GettingStarted) => STEPS.every(s => s.optional || p[s.key]);

/** 홈: 새로 설치한 사람을 위한 "처음 해 볼 일". 필수 항목을 모두 하거나 닫으면 숨긴다. */
export default function GettingStartedCard({ userId }: { userId: string }) {
  const [hidden, setHidden] = useState(() => readHidden(userId));
  const { data } = useAsync(() => api.get<GettingStarted>('/dashboard/getting-started'), [userId]);
  if (hidden || !data || allDone(data)) return null;

  const done = STEPS.filter(s => data[s.key]).length;
  const close = () => { try { localStorage.setItem(hiddenKey(userId), '1'); } catch { /* 저장 못 해도 이번엔 숨김 */ } setHidden(true); };

  return (
    <section className="workspace-card rounded-[24px] bg-surface p-6 sm:p-7" aria-labelledby="getting-started-title">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-accent-soft"><Rocket className="size-5 text-accent" strokeWidth={1.8} /></span>
          <div>
            <h2 id="getting-started-title" className="text-lg font-bold">처음 해 볼 일</h2>
            <p className="text-sm text-muted">{STEPS.length}개 중 {done}개 완료 · 다 하면 이 카드는 사라져요</p>
          </div>
        </div>
        <button type="button" onClick={close} className="rounded-xl p-2 text-muted hover:bg-surface-2 hover:text-fg" aria-label="처음 해 볼 일 닫기">
          <X className="size-4" />
        </button>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {STEPS.map(step => {
          const ok = data[step.key];
          return (
            <li key={step.key}>
              <Link to={step.to} className={`flex h-full gap-3 rounded-2xl border border-border p-3.5 transition-colors ${ok ? 'opacity-60' : 'hover:bg-accent-soft/50'}`}>
                {ok ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-500" /> : <Circle className="mt-0.5 size-5 shrink-0 text-muted" />}
                <span className="min-w-0">
                  <span className={`block text-sm font-semibold ${ok ? 'line-through' : ''}`}>{step.title}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-muted">{step.text}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
