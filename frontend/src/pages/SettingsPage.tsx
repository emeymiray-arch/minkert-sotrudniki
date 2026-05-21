import * as React from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTheme } from '@/context/theme';
import { useAuth } from '@/context/auth';
import { cnRoleRu } from '@/lib/format';
import { apiJson, getApiBaseUrl } from '@/lib/http';
import type { ManagerKpiSummary } from '@/lib/types';
import { Input } from '@/components/ui/input';

export default function SettingsPage() {
  const { mode, setMode } = useTheme();
  const { user, setUserProfile } = useAuth();
  const [name, setName] = React.useState(user?.name ?? '');
  const [email, setEmail] = React.useState(user?.email ?? '');

  const apiHint = getApiBaseUrl();

  const managerKpi = useQuery({
    queryKey: ['analytics', 'manager-kpi'],
    queryFn: () => apiJson<ManagerKpiSummary>('/analytics/manager-kpi'),
    refetchOnWindowFocus: true,
  });

  React.useEffect(() => {
    if (!user) return;
    setName(user.name);
    setEmail(user.email);
  }, [user]);

  const updateProfile = useMutation({
    mutationFn: () =>
      apiJson<{ id: string; name: string; email: string; role: 'ADMIN' | 'MANAGER' | 'VIEWER'; linkedEmployeeId?: string | null }>(
        '/users/me',
        {
          method: 'PATCH',
          body: JSON.stringify({ name, email }),
        },
      ),
    onSuccess: (next) => {
      setUserProfile(next);
      toast.success('Профиль руководителя обновлён');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Не удалось обновить профиль'),
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <PageHeader
        title="Настройки"
        description="Тема и профиль. KPI руководителя считается автоматически из чек-листов команды."
      />

      <Card>
        <CardHeader title="Локальная персонализация" description="Выбор сохранён в браузере, без лишней нагрузки на вашу машину и бэкенд." />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-stroke bg-[hsl(var(--panel))] p-4 dark:border-white/[0.06]">
            <div className="text-xs uppercase tracking-[0.16em] text-muted dark:text-white/45">Тема</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant={mode === 'dark' ? 'primary' : 'outline'} onClick={() => setMode('dark')}>
                Тёмная
              </Button>
              <Button variant={mode === 'light' ? 'primary' : 'outline'} onClick={() => setMode('light')}>
                Светлая
              </Button>
              <Button variant={mode === 'system' ? 'primary' : 'outline'} onClick={() => setMode('system')}>
                Системная
              </Button>
            </div>
            <div className="mt-3 text-xs text-muted dark:text-white/48">По умолчанию — тёмный премиальный интерфейс с неоновыми акцентами.</div>
          </div>

          <div className="rounded-lg border border-stroke bg-[hsl(var(--panel))] p-4 dark:border-white/[0.06]">
            <div className="text-xs uppercase tracking-[0.16em] text-muted dark:text-white/45">Профиль</div>
            <div className="mt-3 space-y-3 text-sm">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ваше имя" />
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
              <Button onClick={() => updateProfile.mutate()} disabled={updateProfile.isPending}>
                Сохранить профиль руководителя
              </Button>
              <Badge tone="neutral" className="mt-2">
                {cnRoleRu(user?.role ?? '—')}
              </Badge>
              {user?.role === 'VIEWER' ?
                <p className="mt-3 text-xs leading-relaxed text-muted dark:text-white/50">
                  Аккаунт начальника: разделы «Обзор» и «Аналитика» показывают KPI команды из чек-листов без ручного ввода.
                </p>
              : null}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Мой KPI как руководителя"
          description="Считается из отметок сотрудников в чек-листах (0 → 0%, 1 → 100%, 2 → 115%). Даты выбирает система."
        />
        {managerKpi.isLoading ?
          <Skeleton className="h-[140px]" />
        : managerKpi.data ?
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-stroke bg-black/[0.02] p-4 dark:border-white/[0.08] dark:bg-white/[0.03]">
                <div className="text-xs uppercase tracking-wider text-muted dark:text-white/45">{managerKpi.data.daily.label}</div>
                <div className="mt-1 text-3xl font-semibold tabular-nums text-zinc-900 dark:text-white">{managerKpi.data.daily.kpi}%</div>
                <div className="mt-1 text-xs text-muted dark:text-white/50">
                  {managerKpi.data.daily.weekday}, {managerKpi.data.asOf}
                </div>
              </div>
              <div className="rounded-xl border border-stroke bg-black/[0.02] p-4 dark:border-white/[0.08] dark:bg-white/[0.03]">
                <div className="text-xs uppercase tracking-wider text-muted dark:text-white/45">{managerKpi.data.weekly.label}</div>
                <div className="mt-1 text-3xl font-semibold tabular-nums text-zinc-900 dark:text-white">{managerKpi.data.weekly.kpi}%</div>
                <div className="mt-1 text-xs text-muted dark:text-white/50">
                  WoW: {managerKpi.data.weekly.weekOverWeekTrend >= 0 ? '+' : ''}
                  {managerKpi.data.weekly.weekOverWeekTrend} п.п.
                </div>
              </div>
              <div className="rounded-xl border border-stroke bg-black/[0.02] p-4 dark:border-white/[0.08] dark:bg-white/[0.03]">
                <div className="text-xs uppercase tracking-wider text-muted dark:text-white/45">{managerKpi.data.monthly.label}</div>
                <div className="mt-1 text-3xl font-semibold tabular-nums text-zinc-900 dark:text-white">{managerKpi.data.monthly.kpi}%</div>
                <div className="mt-1 text-xs text-muted dark:text-white/50">{managerKpi.data.month}</div>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-muted dark:text-white/50">
              Активных сотрудников в расчёте: {managerKpi.data.activeEmployees}. Начальники с ролью «Наблюдатель» видят те же цифры в «Обзор» и «Аналитика».
            </p>
          </div>
        : <p className="text-sm text-muted">Нет данных — добавьте задачи и дождитесь отметок в чек-листах.</p>}
      </Card>

      <Card>
        <CardHeader title="Интеграция API" description="Для оперативности фронтенд ходит только в REST-бэкенд." />
        <div className="rounded-lg border border-dashed border-stroke bg-black/[0.02] p-4 text-[12px] font-mono text-zinc-800 dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-white/80">
          {apiHint}
        </div>
        <div className="mt-4 text-xs text-muted dark:text-white/55">
          В рабочем контуре вынесите JWT-секреты и строки подключения в менеджер секретов, а переменную `VITE_API_URL`
          передайте на этапе сборки фронта.
        </div>
      </Card>
    </div>
  );
}
