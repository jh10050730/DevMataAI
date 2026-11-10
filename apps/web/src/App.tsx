import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import Layout from './components/Layout';
import { FullPageSpinner } from './components/ui';
import { useAuth } from './context/AuthContext';
import AuthPage from './pages/AuthPage';
import CalendarTasksPage from './pages/CalendarTasksPage';
import AssistantPage from './pages/AssistantPage';
import DashboardPage from './pages/DashboardPage';
import SettingsPage from './pages/SettingsPage';
import NewsPage from './pages/NewsPage';
import StudyPage from './pages/StudyPage';
import ProjectsPage from './pages/ProjectsPage';
import PasswordResetPage from './pages/PasswordResetPage';
import HelpPage from './pages/HelpPage';
import ClaudeSetup, { ClaudeOnboardingGate } from './components/ClaudeSetup';
import ConnectionBanner from './components/ConnectionBanner';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <>
      <ConnectionBanner />
      <AppRoutes />
    </>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <FullPageSpinner />;

  return (
    <Routes>
      <Route path="/forgot-password" element={<PasswordResetPage key="request" mode="request" />} />
      <Route path="/reset-password" element={<PasswordResetPage key="reset" mode="reset" />} />
      <Route path="/claude-setup" element={<RequireAuth><ClaudeSetup /></RequireAuth>} />
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <AuthPage mode="login" />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <AuthPage mode="register" />} />
      <Route
        element={
          <RequireAuth>
            <ClaudeOnboardingGate key={user?.id}><Layout /></ClaudeOnboardingGate>
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="calendar" element={<CalendarTasksPage />} />
        <Route
          path="assistant"
          element={<AssistantPage />}
        />
        <Route path="study" element={<StudyPage />} />
        <Route
          path="news"
          element={<NewsPage />}
        />
        <Route
          path="projects"
          element={<ProjectsPage />}
        />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="help" element={<HelpPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
