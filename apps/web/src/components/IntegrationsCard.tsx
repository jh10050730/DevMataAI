import { Bot, CheckCircle2, CircleDashed, Plug, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { api, errorMessage } from '../lib/api';
import { getIntegrationStatus } from '../lib/study';
import { useAsync } from '../lib/useAsync';
import GoogleCalendarPanel from './GoogleCalendarPanel';
import { Badge, Button, Card, ErrorState, Skeleton } from './ui';

type Tone = 'live' | 'demo' | 'off' | 'error';
const TONE: Record<Tone, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  live: { label: '실제 연결', cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', icon: CheckCircle2 },
  demo: { label: '데모 모드', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', icon: CircleDashed },
  off: { label: '미설정', cls: 'bg-surface-2 text-muted', icon: CircleDashed },
  error: { label: '연결 오류', cls: 'bg-red-500/15 text-red-600 dark:text-red-400', icon: XCircle },
};

function Row({ name, desc, tone, children }: { name: string; desc: string; tone: Tone; children?: React.ReactNode }) {
  const t = TONE[tone];
  return (
    <li className="py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm">{name}</p>
          <p className="text-xs text-muted">{desc}</p>
        </div>
        <Badge className={t.cls}>
          <t.icon className="mr-1 size-3" />
          {t.label}
        </Badge>
      </div>
      {children}
    </li>
  );
}

/** 설정: 외부 서비스 연결 상태 (실제 / 데모 / 미설정 구분) + AI 연결 테스트 */
export default function IntegrationsCard() {
  const { data, error, loading, reload } = useAsync(getIntegrationStatus, []);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; text: string } | null>(null);

  const runTest = async () => {
    setTesting(true);
    setTest(null);
    try {
      const r = await api.post<{ text: string; demo: boolean; model?: string; latencyMs: number }>('/ai/test');
      setTest({ ok: true, text: `${r.demo ? '데모 응답' : r.model ?? 'Claude'} · ${(r.latencyMs / 1000).toFixed(1)}초 — ${r.text.split('\n')[0].slice(0, 80)}` });
      void reload();
    } catch (e) {
      setTest({ ok: false, text: errorMessage(e) });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card title="외부 연동" icon={Plug} action={<button onClick={reload} className="text-xs text-accent hover:underline">새로고침</button>}>
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading && !data ? (
        <Skeleton lines={4} />
      ) : (
        data && (
          <ul className="divide-y divide-border">
            <Row
              name="Claude (AI)"
              desc={`${data.ai.provider === 'claude-cli' ? '이 PC의 Claude Code · API 키 불필요' : data.ai.provider} — ${data.ai.detail} · 최근 24시간 ${data.ai.last24h.calls}회 호출${data.ai.last24h.failures ? `, 실패 ${data.ai.last24h.failures}회` : ''}`}
              tone={data.ai.demo ? 'demo' : data.ai.ok ? 'live' : 'error'}
            >
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button variant="secondary" onClick={runTest} loading={testing} className="px-2.5 py-1 text-xs">
                  <Bot className="size-3.5" /> 연결 테스트
                </Button>
                {test && <span className={test.ok ? 'text-xs text-emerald-500' : 'text-xs text-red-500'}>{test.text}</span>}
              </div>
            </Row>
            <Row
              name="Notion"
              desc={`${data.notion.detail}${data.notion.ok && !data.notion.canExport ? ' · 저장하려면 NOTION_PARENT_PAGE_ID 설정 필요' : ''}`}
              tone={!data.notion.configured ? 'off' : data.notion.ok ? 'live' : 'error'}
            />
            <Row name="GitHub" desc={data.github.detail} tone={data.github.configured ? 'live' : 'off'} />
            <Row name="Google Calendar" desc={data.googleCalendar.detail} tone={data.googleCalendar.configured ? 'live' : 'off'}>
              <GoogleCalendarPanel />
            </Row>
          </ul>
        )
      )}
      <p className="mt-3 text-[11px] text-muted">토큰과 키는 서버의 apps/api/.env 에만 저장되고 화면에는 표시되지 않아요. 변경 후에는 API 서버를 재시작하세요.</p>
      <Link to="/claude-setup" className="mt-4 inline-block text-sm font-semibold text-accent">Claude Code 설치·로그인 안내 다시 보기 →</Link>
    </Card>
  );
}
