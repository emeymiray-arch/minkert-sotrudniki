import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { Skeleton } from '@/components/ui/skeleton';
import { AuthProvider, useAuth } from '@/context/auth';
import { ThemeProvider } from '@/context/theme';
import AnalyticsPage from '@/pages/AnalyticsPage';
import DashboardPage from '@/pages/DashboardPage';
import EmployeeDetailPage from '@/pages/EmployeeDetailPage';
import EmployeesPage from '@/pages/EmployeesPage';
import LoginPage from '@/pages/LoginPage';
import LoyaltyPage from '@/pages/LoyaltyPage';
import PublicDiaryPage from '@/pages/PublicDiaryPage';
import PublicEmployeeTasksPage from '@/pages/PublicEmployeeTasksPage';
import SettingsPage from '@/pages/SettingsPage';
import { OpsLayout } from '@/operations/layout/OpsLayout';
import OpsAnalyticsPage from '@/operations/pages/OpsAnalyticsPage';
import FinancePage from '@/pages/FinancePage';
import OpsBlockPage from '@/operations/pages/OpsBlockPage';
import OpsContentPage from '@/operations/pages/OpsContentPage';
import OpsSettingsPage from '@/operations/pages/OpsSettingsPage';
import OpsStaffDetailPage from '@/operations/pages/OpsStaffDetailPage';
import OpsStaffPage from '@/operations/pages/OpsStaffPage';
import OpsJournalPage from '@/operations/pages/OpsJournalPage';
import OpsViolationsPage from '@/operations/pages/OpsViolationsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 45_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedLayout() {
  const { booting, isAuthenticated } = useAuth();

  if (booting) {
    return (
      <div className="mx-auto grid min-h-full max-w-3xl place-items-center px-6 py-20">
        <div className="w-full space-y-3">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-[220px] w-full" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/d/:token" element={<PublicDiaryPage />} />
            <Route path="/t/:token" element={<PublicEmployeeTasksPage />} />

            <Route element={<ProtectedLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="/employees" element={<EmployeesPage />} />
              <Route path="/employees/:id" element={<EmployeeDetailPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/finansy" element={<FinancePage />} />
              <Route path="/loyalty" element={<LoyaltyPage />} />
              <Route path="/upravlenie/finansy" element={<Navigate to="/finansy" replace />} />
              <Route path="/settings" element={<SettingsPage />} />

              <Route path="/upravlenie" element={<OpsLayout />}>
                <Route index element={<Navigate to="/upravlenie/utro" replace />} />
                <Route path="utro" element={<OpsBlockPage />} />
                <Route path="den" element={<OpsBlockPage />} />
                <Route path="vecher" element={<OpsBlockPage />} />
                <Route path="sleduyushchiy-den" element={<OpsBlockPage />} />
                <Route path="nedelya" element={<OpsBlockPage />} />
                <Route path="sotrudniki" element={<OpsStaffPage />} />
                <Route path="sotrudniki/:id" element={<OpsStaffDetailPage />} />
                <Route path="zhurnal" element={<OpsJournalPage />} />
                <Route path="narusheniya" element={<OpsViolationsPage />} />
                <Route path="kontent" element={<OpsContentPage />} />
                <Route path="analitika" element={<OpsAnalyticsPage />} />
                <Route path="nastroyki" element={<OpsSettingsPage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
