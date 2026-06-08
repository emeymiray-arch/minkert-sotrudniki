import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
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
const OpsAnalyticsPage = React.lazy(() => import('@/operations/pages/OpsAnalyticsPage'));
const OpsBlockPage = React.lazy(() => import('@/operations/pages/OpsBlockPage'));
const OpsContentPage = React.lazy(() => import('@/operations/pages/OpsContentPage'));
const OpsSettingsPage = React.lazy(() => import('@/operations/pages/OpsSettingsPage'));
const OpsStaffDetailPage = React.lazy(() => import('@/operations/pages/OpsStaffDetailPage'));
const OpsStaffPage = React.lazy(() => import('@/operations/pages/OpsStaffPage'));
const OpsJournalPage = React.lazy(() => import('@/operations/pages/OpsJournalPage'));
const OpsProblemsPage = React.lazy(() => import('@/operations/pages/OpsProblemsPage'));
const OpsViolationsPage = React.lazy(() => import('@/operations/pages/OpsViolationsPage'));

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
      staleTime: 120_000,
      gcTime: 300_000,
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
                <Route index element={<Navigate to="/upravlenie/utro" replace />} />
                <Route
                  path="utro"
                  element={
                    <Lazy>
                      <OpsBlockPage />
                    </Lazy>
                  }
                />
                <Route
                  path="den"
                  element={
                    <Lazy>
                      <OpsBlockPage />
                    </Lazy>
                  }
                />
                <Route
                  path="vecher"
                  element={
                    <Lazy>
                      <OpsBlockPage />
                    </Lazy>
                  }
                />
                <Route
                  path="sleduyushchiy-den"
                  element={
                    <Lazy>
                      <OpsBlockPage />
                    </Lazy>
                  }
                />
                <Route
                  path="nedelya"
                  element={
                    <Lazy>
                      <OpsBlockPage />
                    </Lazy>
                  }
                />
                <Route
                  path="sotrudniki"
                  element={
                    <Lazy>
                      <OpsStaffPage />
                    </Lazy>
                  }
                />
                <Route
                  path="sotrudniki/:id"
                  element={
                    <Lazy>
                      <OpsStaffDetailPage />
                    </Lazy>
                  }
                />
                <Route
                  path="zhurnal"
                  element={
                    <Lazy>
                      <OpsJournalPage />
                    </Lazy>
                  }
                />
                <Route
                  path="narusheniya"
                  element={
                    <Lazy>
                      <OpsViolationsPage />
                    </Lazy>
                  }
                />
                <Route
                  path="kontent"
                  element={
                    <Lazy>
                      <OpsContentPage />
                    </Lazy>
                  }
                />
                <Route
                  path="analitika"
                  element={
                    <Lazy>
                      <OpsAnalyticsPage />
                    </Lazy>
                  }
                />
                <Route
                  path="nastroyki"
                  element={
                    <Lazy>
                      <OpsSettingsPage />
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
