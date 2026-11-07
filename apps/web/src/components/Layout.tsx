import {
  Bot,
  BookOpen,
  CalendarCheck,
  FolderGit2,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Newspaper,
  Search,
  Settings,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { cn } from './ui';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/assistant', label: 'AI Assistant', icon: Bot },
  { to: '/calendar', label: 'Calendar & Tasks', icon: CalendarCheck },
  { to: '/study', label: 'Study', icon: BookOpen },
  { to: '/news', label: 'News', icon: Newspaper },
  { to: '/projects', label: 'Projects', icon: FolderGit2 },
  { to: '/settings', label: 'Settings', icon: Settings },
];

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex h-full flex-col gap-1 p-3">
      <div className="mb-4 flex items-center gap-2 px-2 py-1.5">
        <div className="rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 p-1.5">
          <Sparkles className="size-4 text-white" />
        </div>
        <span className="font-semibold tracking-tight">DevMate AI</span>
      </div>
      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
              isActive ? 'bg-blue-500/10 font-medium text-blue-600 dark:text-blue-400' : 'text-muted hover:bg-surface-2 hover:text-fg',
            )
          }
        >
          <Icon className="size-4 shrink-0" />
          <span className="flex-1">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [q, setQ] = useState('');

  const title = NAV.find((n) => (n.to === '/' ? location.pathname === '/' : location.pathname.startsWith(n.to)))?.label ?? 'DevMate AI';

  useEffect(() => setMenuOpen(false), [location.pathname]);

  // 통합 검색: Phase 1 에서는 할 일 제목 검색 (Phase 5 에서 전체 데이터로 확장)
  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    navigate(`/assistant?q=${encodeURIComponent(q.trim().slice(0, 100))}`);
  };

  const initials = user?.name.slice(0, 1).toUpperCase() ?? '?';

  return (
    <div className="flex h-full">
      <aside className="hidden w-60 shrink-0 border-r border-border bg-surface lg:block">
        <Sidebar />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-border bg-surface">
            <button className="absolute right-3 top-4 rounded-md p-1 text-muted" onClick={() => setMobileOpen(false)} aria-label="메뉴 닫기">
              <X className="size-4" />
            </button>
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-bg/80 px-4 backdrop-blur sm:px-6">
          <button className="rounded-md p-1.5 text-muted hover:bg-surface-2 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="메뉴 열기">
            <Menu className="size-5" />
          </button>
          <h1 className="truncate text-base font-semibold">{title}</h1>

          <form onSubmit={onSearch} className="ml-auto hidden max-w-xs flex-1 md:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="통합 검색…"
                className="w-full rounded-lg border border-border bg-surface py-1.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500"
              />
            </div>
          </form>

          <button onClick={toggle} className="ml-auto rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg md:ml-0" aria-label="테마 전환">
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>

          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-violet-600 text-sm font-semibold text-white"
              aria-label="사용자 메뉴"
            >
              {initials}
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-surface p-1.5 shadow-lg">
                <div className="px-3 py-2">
                  <p className="truncate text-sm font-medium">{user?.name}</p>
                  <p className="truncate text-xs text-muted">{user?.email}</p>
                </div>
                <div className="my-1 border-t border-border" />
                <button
                  onClick={() => navigate('/settings')}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-fg"
                >
                  <Settings className="size-4" /> 설정
                </button>
                <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-500 hover:bg-red-500/10">
                  <LogOut className="size-4" /> 로그아웃
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
