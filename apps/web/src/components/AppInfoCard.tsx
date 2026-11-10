import { FolderOpen, Info } from 'lucide-react';
import { useState } from 'react';
import { api, errorMessage } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { Button } from './ui';

/** GET /api/desktop/info (docs/DESKTOP_PLAN.md 인터페이스 약속) */
export interface DesktopInfo {
  desktop: boolean;
  version: string;
  dataDir?: string;
  logDir?: string;
}

export type FolderTarget = 'data' | 'logs';

/** 화면에 보여 줄 폴더 줄. 데스크톱이 아니거나 경로가 없으면 빼고 보여 준다 */
export function folderRows(info: DesktopInfo): { target: FolderTarget; label: string; path: string }[] {
  if (!info.desktop) return [];
  const rows: { target: FolderTarget; label: string; path?: string }[] = [
    { target: 'data', label: '데이터 폴더 (DB·백업)', path: info.dataDir },
    { target: 'logs', label: '로그 폴더', path: info.logDir },
  ];
  return rows.filter((row): row is { target: FolderTarget; label: string; path: string } => !!row.path);
}

/** 도움말 → 앱 정보: 버전과 (데스크톱 앱이면) 데이터·로그 폴더 열기 */
export default function AppInfoCard() {
  const { data } = useAsync(() => api.get<DesktopInfo>('/desktop/info'), []);
  const [busy, setBusy] = useState<FolderTarget | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const open = async (target: FolderTarget) => {
    setBusy(target); setMessage(null);
    try { await api.post('/desktop/open', { target }); }
    catch (e) { setMessage(errorMessage(e)); }
    finally { setBusy(null); }
  };

  return (
    <section className="workspace-card rounded-[24px] bg-surface p-6 sm:p-7">
      <h3 className="mb-3 flex items-center gap-2.5 text-lg font-bold">
        <span className="flex size-9 items-center justify-center rounded-xl bg-accent-soft"><Info className="size-5 text-accent" strokeWidth={1.8} /></span>
        앱 정보
      </h3>
      <dl className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <dt className="w-40 shrink-0 text-muted">버전</dt>
          <dd className="font-semibold">{data ? `v${data.version}` : '…'}{data && !data.desktop && <span className="ml-2 font-normal text-muted">(개발용 웹 실행)</span>}</dd>
        </div>
        {data && folderRows(data).map(row => (
          <div key={row.target} className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <dt className="w-40 shrink-0 text-muted">{row.label}</dt>
            <dd className="min-w-0 flex-1 break-all font-mono text-xs">{row.path}</dd>
            <Button variant="secondary" className="px-3 py-1.5 text-xs" loading={busy === row.target} onClick={() => void open(row.target)}>
              <FolderOpen className="size-3.5" /> 열기
            </Button>
          </div>
        ))}
      </dl>
      {message && <p role="alert" className="mt-3 text-sm text-red-500">{message}</p>}
    </section>
  );
}
