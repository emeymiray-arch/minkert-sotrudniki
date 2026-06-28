import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { isManagerPath, isMasterPath, isViewerPath } from '@/lib/role-home';
import { Skeleton } from '@/components/ui/skeleton';
import { AuthProvider, useAuth } from '@/context/auth';
import { ThemeProvider } from '@/context/theme';

const DashboardPage = React.lazy(() => import('@/pages/DashboardPage'));
const EmployeesPage = React.lazy(() => import('@/pages/EmployeesPage'));
const EmployeeDetailPage = React.lazy(() => import('@/pages/EmployeeDetailPage'));
const AnalyticsPage = React.lazy(() => import('@/pages/AnalyticsPage'));
const FinancePage = React.lazy(() => import('@/pages/FinancePage'));
const LoyaltyPage = React.lazy(() => import('@/pages/LoyaltyPage'));
const CrmPage = React.lazy(() => import('@/pages/CrmPage'));
const SettingsPage = React.lazy(() => import('@/pages/SettingsPage'));
const LoginPage = React.lazy(() => import('@/pages/LoginPage'));
const PublicDiaryPage = React.lazy(() => import('@/pages/PublicDiaryPage'));
const PublicEmployeeTasksPage = React.lazy(() => import('@/pages/PublicEmployeeTasksPage'));
const OpsLayout = React.lazy(() => import('@/operations/layout/OpsLayout').then((m) => ({ default: m.OpsLayout })));
const OpsSimpleTasksPage = React.lazy(() => import('@/operations/pages/OpsSimpleTasksPage'));
const OpsProblemsPage = React.lazy(() => import('@/operations/pages/OpsProblemsPage'));

function PageFallback() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-[280px] w-full" />
    </div>
  );
}

function Lazy({ children }: { children: React.ReactNode }) {
  return <React.Suspense fallback={<PageFallback />}>{children}</React.Suspense>;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 180_000,
      gcTime: 600_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedLayout() {
  const { booting, isAuthenticated, user } = useAuth();
  const { pathname } = useLocation();

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

  if (user?.role === 'LOYALTY' && pathname !== '/loyalty' && !pathname.startsWith('/crm')) {
    return <Navigate to="/crm" replace />;
  }

  if (user?.role === 'MASTER' && !isMasterPath(pathname)) {
    return <Navigate to="/crm" replace />;
  }

  if (user?.role === 'MANAGER' && !isManagerPath(pathname)) {
    return <Navigate to="/crm" replace />;
  }

  if (user?.role === 'VIEWER' && !isViewerPath(pathname)) {
    return <Navigate to="/crm" replace />;
  }

  return (
    <ErrorBoundary>
      <AppShell>
        <Outlet />
      </AppShell>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            <Route
              path="/login"
              element={
                <Lazy>
                  <LoginPage />
                </Lazy>
              }
            />
            <Route
              path="/d/:token"
              element={
                <Lazy>
                  <PublicDiaryPage />
                </Lazy>
              }
            />
            <Route
              path="/t/:token"
              element={
                <Lazy>
                  <PublicEmployeeTasksPage />
                </Lazy>
              }
            />

            <Route element={<ProtectedLayout />}>
              <Route
                index
                element={
                  <Lazy>
                    <DashboardPage />
                  </Lazy>
                }
              />
              <Route
                path="/employees"
                element={
                  <Lazy>
                    <EmployeesPage />
                  </Lazy>
                }
              />
              <Route
                path="/employees/:id"
                element={
                  <Lazy>
                    <EmployeeDetailPage />
                  </Lazy>
                }
              />
              <Route
                path="/analytics"
                element={
                  <Lazy>
                    <AnalyticsPage />
                  </Lazy>
                }
              />
              <Route
                path="/finansy"
                element={
                  <Lazy>
                    <FinancePage />
                  </Lazy>
                }
              />
              <Route
                path="/problemy"
                element={
                  <Lazy>
                    <OpsProblemsPage />
                  </Lazy>
                }
              />
              <Route
                path="/loyalty"
                element={
                  <Lazy>
                    <LoyaltyPage />
                  </Lazy>
                }
              />
              <Route
                path="/crm"
                element={
                  <Lazy>
                    <CrmPage />
                  </Lazy>
                }
              />
              <Route path="/upravlenie/finansy" element={<Navigate to="/finansy" replace />} />
              <Route path="/upravlenie/problemy" element={<Navigate to="/problemy" replace />} />
              <Route path="/upravlenie/utro" element={<Navigate to="/upravlenie" replace />} />
              <Route path="/upravlenie/den" element={<Navigate to="/upravlenie" replace />} />
              <Route path="/upravlenie/vecher" element={<Navigate to="/upravlenie" replace />} />
              <Route path="/upravlenie/sleduyushchiy-den" element={<Navigate to="/upravlenie" replace />} />
              <Route path="/upravlenie/nedelya" element={<Navigate to="/upravlenie" replace />} />
              <Route path="/upravlenie/sotrudniki" element={<Navigate to="/employees" replace />} />
              <Route path="/upravlenie/sotrudniki/:id" element={<Navigate to="/employees" replace />} />
              <Route path="/upravlenie/zhurnal" element={<Navigate to="/upravlenie" replace />} />
              <Route path="/upravlenie/narusheniya" element={<Navigate to="/upravlenie" replace />} />
              <Route path="/upravlenie/kontent" element={<Navigate to="/upravlenie" replace />} />
              <Route path="/upravlenie/analitika" element={<Navigate to="/upravlenie" replace />} />
              <Route path="/upravlenie/nastroyki" element={<Navigate to="/upravlenie" replace />} />
              <Route
                path="/settings"
                element={
                  <Lazy>
                    <SettingsPage />
                  </Lazy>
                }
              />

              <Route
                path="/upravlenie"
                element={
                  <Lazy>
                    <OpsLayout />
                  </Lazy>
                }
              >
                <Route
                  index
                  element={
                    <Lazy>
                      <OpsSimpleTasksPage />
                    </Lazy>
                  }
                />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
