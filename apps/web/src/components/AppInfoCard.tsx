import { Info } from 'lucide-react';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';

/** GET /api/desktop/info (docs/DESKTOP_PLAN.md 인터페이스 약속) */
export interface UpdateState {
  state: 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error';
  version?: string;
  percent?: number;
  error?: string;
}

export interface DesktopInfo {
  desktop: boolean;
  version: string;
  dataDir?: string;
  logDir?: string;
  update?: UpdateState;
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

/** 업데이트 상태 문구와 누를 수 있는 동작. 진행 중이면 동작 없음(화면이 잠깐마다 다시 확인) */
export function updateView(update: UpdateState): { text: string; action: 'check' | 'install' | null; working: boolean } {
  const v = update.version ? `v${update.version}` : '새 버전';
  switch (update.state) {
    case 'checking': return { text: '새 버전을 확인하는 중…', action: null, working: true };
    case 'available': return { text: `${v}을 받기 시작했어요…`, action: null, working: true };
    case 'downloading': return { text: `${v} 받는 중… ${update.percent ?? 0}%`, action: null, working: true };
    case 'ready': return { text: `${v} 준비 완료. 재시작하면 바로 설치돼요 (앱을 끌 때도 설치돼요).`, action: 'install', working: false };
    case 'error': return { text: update.error || '업데이트를 확인하지 못했어요.', action: 'check', working: false };
    default: return { text: '최신 버전이에요. 새 버전은 6시간마다 자동으로 확인해요.', action: 'check', working: false };
  }
}

/** 일반 앱 정보에는 버전만 표시한다. 관리 기능은 추후 관리자 화면에서 제공한다. */
export default function AppInfoCard() {
  const { data, error } = useAsync(() => api.get<DesktopInfo>('/desktop/info'), []);

  return (
    <section className="workspace-card rounded-[24px] bg-surface p-6 sm:p-7">
      <h3 className="mb-3 flex items-center gap-2.5 text-lg font-bold">
        <span className="flex size-9 items-center justify-center rounded-xl bg-accent-soft"><Info className="size-5 text-accent" strokeWidth={1.8} /></span>
        앱 정보
      </h3>
      <dl className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <dt className="w-40 shrink-0 text-muted">버전</dt>
          <dd className="font-semibold">{data ? `v${data.version}` : error ? '버전 정보를 불러오지 못했어요.' : '…'}</dd>
        </div>
      </dl>
    </section>
  );
}
