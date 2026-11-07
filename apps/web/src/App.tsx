import { Bot, FolderGit2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import Layout from './components/Layout';
import { FullPageSpinner } from './components/ui';
import { useAuth } from './context/AuthContext';
import AuthPage from './pages/AuthPage';
import CalendarTasksPage from './pages/CalendarTasksPage';
import ComingSoonPage from './pages/ComingSoonPage';
import DashboardPage from './pages/DashboardPage';
import SettingsPage from './pages/SettingsPage';
import NewsPage from './pages/NewsPage';
import StudyPage from './pages/StudyPage';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <FullPageSpinner />;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <AuthPage mode="login" />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <AuthPage mode="register" />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="calendar" element={<CalendarTasksPage />} />
        <Route
          path="assistant"
          element={<ComingSoonPage icon={Bot} title="AI Assistant" phase={5} description="일정·학습·뉴스·프로젝트 데이터를 종합해서 답하는 개인 비서 채팅" />}
        />
        <Route path="study" element={<StudyPage />} />
        <Route
          path="news"
          element={<NewsPage />}
        />
        <Route
          path="projects"
          element={<ComingSoonPage icon={FolderGit2} title="Projects" phase={4} description="GitHub 연동, 개발 작업 관리, AI 주간 개발 보고서" />}
        />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
