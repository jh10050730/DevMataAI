import { ArrowRight, BookOpen, Bot, CalendarCheck, ChevronDown, FolderGit2, House, Layers3, LifeBuoy, LogOut, Menu, Moon, Newspaper, Search, Settings, Sun, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { cn } from './ui';
import NotificationBell from './NotificationBell';
import AssistantPanel, { AssistantToggle } from './AssistantPanel';
import { AssistantChatProvider, useAssistantChat } from '../context/AssistantChatContext';

const NAV = [
  { to: '/', label: '홈', icon: House, group: '나의 하루' },
  { to: '/assistant', label: 'AI 비서', icon: Bot, group: '나의 하루' },
  { to: '/calendar', label: '일정과 할 일', icon: CalendarCheck, group: '나의 하루' },
  { to: '/study', label: '학습 노트', icon: BookOpen, group: '기록과 발견' },
  { to: '/news', label: '뉴스 브리핑', icon: Newspaper, group: '기록과 발견' },
  { to: '/projects', label: '프로젝트', icon: FolderGit2, group: '기록과 발견' },
  { to: '/settings', label: '설정', icon: Settings, group: '설정' },
  { to: '/help', label: '도움말', icon: LifeBuoy, group: '설정' },
];

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return <nav aria-label="주 메뉴" className="flex h-full flex-col overflow-y-auto px-4 pb-6 pt-8 text-sidebar-text">
    <NavLink to="/" onClick={onNavigate} className="mb-10 flex items-center gap-2.5 px-4" aria-label="DevMata AI 홈">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-strong"><Layers3 className="size-5 text-white" strokeWidth={2.2} /></div>
      {/* 사이드바 폭(232px)에 한 줄로 들어가게: "AI" 가 다음 줄로 내려가지 않도록 */}
      <span className="whitespace-nowrap text-[20px] font-bold tracking-tight text-fg">DevMata AI</span>
    </NavLink>
    <div className="space-y-7">
      {['나의 하루', '기록과 발견'].map(group => <div key={group}>
        <p className="mb-2 px-4 text-xs font-medium text-sidebar-muted">{group}</p>
        <div className="space-y-1">{NAV.filter(item => item.group === group).map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} onClick={onNavigate} className={({ isActive }) => cn('group flex min-h-[52px] items-center gap-3.5 rounded-2xl px-4 text-[15px] transition-colors', isActive ? 'bg-sidebar-active font-semibold text-accent' : 'font-medium text-sidebar-text hover:bg-surface-2 hover:text-fg')}>
          <Icon className="size-5 shrink-0" strokeWidth={2} /><span className="flex-1">{label}</span>
        </NavLink>)}</div>
      </div>)}
    </div>
    <div className="mt-auto pt-10">
      <NavLink to="/help" onClick={onNavigate} className={({ isActive }) => cn('mb-1 flex min-h-[48px] items-center gap-3.5 rounded-2xl px-4 text-[15px] font-medium', isActive ? 'bg-sidebar-active text-accent' : 'text-sidebar-muted hover:bg-surface-2 hover:text-fg')}><LifeBuoy className="size-5" strokeWidth={2} />도움말</NavLink>
      <NavLink to="/settings" onClick={onNavigate} className={({ isActive }) => cn('flex min-h-[52px] items-center gap-3.5 rounded-2xl px-4 text-[15px] font-medium', isActive ? 'bg-sidebar-active text-accent' : 'text-sidebar-muted hover:bg-surface-2 hover:text-fg')}><Settings className="size-5" strokeWidth={2} />설정</NavLink>
    </div>
  </nav>;
}

/** 로그인한 화면 전체. AI 대화는 여기서 한 번만 불러와 모든 화면(오른쪽 패널·AI 비서 화면)이 같이 쓴다 */
export default function Layout() {
  return <AssistantChatProvider><Shell /></AssistantChatProvider>;
}

function Shell() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [q, setQ] = useState('');
  const mobilePanel = useRef<HTMLElement>(null);
  const userMenu = useRef<HTMLDivElement>(null);
  const { setPanelOpen } = useAssistantChat();
  const onAssistantPage = location.pathname.startsWith('/assistant');
  const page = NAV.find(n => n.to === '/' ? location.pathname === '/' : location.pathname.startsWith(n.to)) ?? NAV[0];

  useEffect(() => { setMenuOpen(false); setMobileOpen(false); }, [location.pathname]);
  // AI 비서 화면에는 같은 대화가 이미 크게 있으므로 패널을 닫는다
  useEffect(() => { if (onAssistantPage) setPanelOpen(false); }, [onAssistantPage, setPanelOpen]);
  useEffect(() => {
    const wideScreen = window.matchMedia('(min-width: 1024px)');
    const close = () => { if (wideScreen.matches) setMobileOpen(false); };
    wideScreen.addEventListener('change', close);
    return () => wideScreen.removeEventListener('change', close);
  }, []);
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = mobilePanel.current;
    panel?.querySelector<HTMLElement>('button, a')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
      if (event.key !== 'Tab') return;
      const focusable = panel?.querySelectorAll<HTMLElement>('button, a[href]');
      if (!focusable?.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus(); };
  }, [mobileOpen]);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: PointerEvent) => { if (!userMenu.current?.contains(event.target as Node)) setMenuOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMenuOpen(false); userMenu.current?.querySelector('button')?.focus(); } };
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', key); };
  }, [menuOpen]);

  const onSearch = (event: FormEvent) => { event.preventDefault(); navigate('/assistant?q=' + encodeURIComponent(q.trim().slice(0, 100))); };
  return <div className="flex h-full bg-bg">
    <aside className="hidden w-[232px] shrink-0 border-r border-border bg-sidebar lg:block"><Sidebar /></aside>
    {mobileOpen && <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
      <aside ref={mobilePanel} role="dialog" aria-modal="true" aria-label="메뉴" className="absolute inset-y-0 left-0 w-[min(288px,85vw)] bg-sidebar shadow-2xl">
        <button className="absolute right-3 top-3 rounded-lg p-2 text-sidebar-text hover:bg-surface-2" onClick={() => setMobileOpen(false)} aria-label="메뉴 닫기"><X className="size-4" /></button>
        <Sidebar onNavigate={() => setMobileOpen(false)} />
      </aside>
    </div>}
    <div className="flex min-w-0 flex-1 flex-col" inert={mobileOpen}>
      <header className="@container z-30 flex h-[72px] shrink-0 items-center gap-3 bg-surface px-4 sm:px-7 lg:px-10">
        <button className="rounded-xl p-2 text-muted hover:bg-surface-2 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="메뉴 열기" aria-expanded={mobileOpen}><Menu className="size-5" /></button>
        <h1 className="truncate text-base font-semibold">{page.label}</h1>
        <form onSubmit={onSearch} role="search" className="ml-auto hidden w-full max-w-[280px] @2xl:block">
          <div className="flex items-center rounded-xl border border-transparent bg-surface-2 focus-within:border-accent">
            <Search className="ml-3 size-4 shrink-0 text-muted" />
            <input aria-label="워크스페이스 통합 검색" value={q} maxLength={100} onChange={e => setQ(e.target.value)} placeholder="무엇을 찾고 있나요?" className="min-w-0 flex-1 bg-transparent py-2.5 pl-2.5 pr-1 text-xs outline-none" />
            <button type="submit" aria-label="검색" className="m-1 rounded-lg p-1.5 text-muted hover:bg-surface-2"><ArrowRight className="size-3.5" /></button>
          </div>
        </form>
        <button onClick={() => navigate('/assistant')} aria-label="통합 검색으로 이동" className="ml-auto rounded-xl p-2.5 text-muted hover:bg-surface-2 @2xl:hidden"><Search className="size-[18px]" /></button>
        {!onAssistantPage && <AssistantToggle />}
        <NotificationBell />
        <button onClick={toggle} className="rounded-xl p-2.5 text-muted hover:bg-surface-2 hover:text-accent" aria-label={theme === 'dark' ? '밝은 테마로 전환' : '어두운 테마로 전환'} title={theme === 'dark' ? '밝은 테마' : '어두운 테마'}>{theme === 'dark' ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}</button>
        <div ref={userMenu} className="relative ml-1">
          <button onClick={() => setMenuOpen(open => !open)} className="flex items-center gap-2 rounded-xl p-1 text-sm" aria-label="사용자 메뉴" aria-expanded={menuOpen}>
            <span className="flex size-9 items-center justify-center rounded-full bg-surface-2 font-semibold text-muted">{user?.name.slice(0, 1).toUpperCase() ?? '?'}</span><ChevronDown className="hidden size-3.5 text-muted sm:block" />
          </button>
          {menuOpen && <div className="absolute right-0 mt-3 w-60 rounded-2xl border border-border bg-surface p-2 shadow-xl">
            <div className="px-3 py-3"><p className="truncate text-sm font-semibold">{user?.name}</p><p className="mt-1 truncate text-xs text-muted">{user?.email}</p></div>
            <div className="my-1 border-t border-border" />
            <button onClick={() => navigate('/settings')} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-muted hover:bg-surface-2"><Settings className="size-4" />설정</button>
            <button onClick={logout} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-red-500 hover:bg-red-500/10"><LogOut className="size-4" />로그아웃</button>
          </div>}
        </div>
      </header>
      <main id="main-content" className="workspace-scroll flex-1 overflow-y-auto overscroll-contain px-4 py-7 sm:px-7 sm:py-10 lg:px-10">
        {/* @container: 화면 안쪽 칸 나누기는 창이 아니라 이 본문 폭을 기준으로 한다 (오른쪽 AI 패널이 열리면 아래로 내려간다) */}
        <div key={location.pathname} className="workspace-page @container mx-auto max-w-[1120px]"><Outlet /></div>
      </main>
    </div>
    <AssistantPanel />
  </div>;
}
