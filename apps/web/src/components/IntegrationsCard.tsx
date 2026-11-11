import { CheckCircle2, CircleDashed, Plug, XCircle } from 'lucide-react';
import { Link } from 'react-router';
import { getIntegrationStatus } from '../lib/study';
import { useAsync } from '../lib/useAsync';
import GoogleCalendarPanel from './GoogleCalendarPanel';
import { Badge, Card, ErrorState, Skeleton } from './ui';

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

/** AI 계정 선택은 AiAccountCard에서 관리한다. */
export default function IntegrationsCard() {
  const { data, error, loading, reload } = useAsync(getIntegrationStatus, []);

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
      <p className="mt-3 text-[11px] text-muted">연결 정보는 위 앱 연결 설정에서 관리할 수 있어요. 비밀값은 암호화해 저장하며 화면에 다시 표시하지 않습니다.</p>
      <Link to="/claude-setup" className="mt-4 inline-block text-sm font-semibold text-accent">Claude·ChatGPT·Gemini 계정 연결 안내 다시 보기 →</Link>
    </Card>
  );
}
