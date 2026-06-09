import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { AccountsManager } from '@/components/settings/AccountsManager';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Input } from '@/components/ui/input';

export default function SettingsPage() {
  const { mode, setMode } = useTheme();
  const { user, setUserProfile } = useAuth();
  const qc = useQueryClient();
  const { subscribe: enablePush } = usePushNotifications();
  const [name, setName] = React.useState(user?.name ?? '');
  const [email, setEmail] = React.useState(user?.email ?? '');
  const [accName, setAccName] = React.useState('');
  const [accEmail, setAccEmail] = React.useState('');
  const [accPassword, setAccPassword] = React.useState('');
  const [accRole, setAccRole] = React.useState<'ADMIN' | 'MANAGER' | 'MASTER' | 'VIEWER' | 'LOYALTY'>('LOYALTY');
  const [accLinkedEmployeeId, setAccLinkedEmployeeId] = React.useState('');
  const [revenuePlan, setRevenuePlan] = React.useState('');
  const [clientPlan, setClientPlan] = React.useState('');

  const apiHint = getApiBaseUrl();
  const planMonth = React.useMemo(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const businessPlan = useQuery({
    queryKey: ['insights', 'plan', planMonth],
    queryFn: () => apiJson<{ month: string; revenuePlan?: number; clientPlan?: number }>(`/insights/plan?month=${planMonth}`),
    enabled: user?.role === 'ADMIN',
  });

  React.useEffect(() => {
    if (!businessPlan.data) return;
    setRevenuePlan(businessPlan.data.revenuePlan ? String(businessPlan.data.revenuePlan) : '');
    setClientPlan(businessPlan.data.clientPlan ? String(businessPlan.data.clientPlan) : '');
  }, [businessPlan.data]);

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
      apiJson<{ id: string; name: string; email: string; role: 'ADMIN' | 'MANAGER' | 'MASTER' | 'VIEWER' | 'LOYALTY'; linkedEmployeeId?: string | null }>(
        '/users/me',
        {
          method: 'PATCH',
          body: JSON.stringify({ name, email }),
        },
      ),
    onSuccess: (next) => {
      setUserProfile(next);
      toast.success('Профиль управляющего обновлён');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Не удалось обновить профиль'),
  });

  const savePlan = useMutation({
    mutationFn: () =>
      apiJson('/insights/plan', {
        method: 'PATCH',
        body: JSON.stringify({
          month: planMonth,
          revenuePlan: revenuePlan ? Number(revenuePlan) : 0,
          clientPlan: clientPlan ? Number(clientPlan) : 0,
        }),
      }),
    onSuccess: () => toast.success('План на месяц сохранён'),
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Не удалось сохранить план'),
  });

  const createAccount = useMutation({
    mutationFn: () =>
      apiJson<{ id: string; email: string; name: string; role: 'ADMIN' | 'MANAGER' | 'MASTER' | 'VIEWER' | 'LOYALTY' }>(
        '/auth/accounts',
        {
          method: 'POST',
          body: JSON.stringify({
            name: accName.trim(),
            email: accEmail.trim(),
            password: accPassword,
            role: accRole,
            linkedEmployeeId:
              accRole === 'VIEWER' || accRole === 'MASTER' ? (accLinkedEmployeeId.trim() || undefined) : undefined,
          }),
        },
      ),
    onSuccess: async (next) => {
      toast.success(`Аккаунт создан: ${next.email} (${cnRoleRu(next.role)})`);
      await qc.invalidateQueries({ queryKey: ['users', 'list'] });
      setAccName('');
      setAccEmail('');
      setAccPassword('');
      setAccRole('LOYALTY');
      setAccLinkedEmployeeId('');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Не удалось создать аккаунт'),
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <PageHeader
        title="Настройки"
        description="Тема и профиль. KPI управляющего: личные задачи в Контроле + результаты команды."
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
                Сохранить профиль управляющего
              </Button>
              <Badge tone="neutral" className="mt-2">
                {cnRoleRu(user?.role ?? '—')}
              </Badge>
              {user?.role === 'VIEWER' ?
                <p className="mt-3 text-xs leading-relaxed text-muted dark:text-white/50">
                  Аккаунт управляющего: разделы «Обзор» и «Аналитика» показывают KPI команды из чек-листов без ручного ввода.
                </p>
              : null}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="KPI управляющего"
          description="Два блока: задачи управляющего в Контроле и результаты команды по KPI."
        />
        {managerKpi.isLoading ?
          <Skeleton className="h-[140px]" />
        : managerKpi.data ?
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-stroke bg-black/[0.02] p-4 dark:border-white/[0.08] dark:bg-white/[0.03]">
                <div className="text-xs uppercase tracking-wider text-muted dark:text-white/45">Задачи управляющего</div>
                <div className="mt-1 text-3xl font-semibold tabular-nums text-zinc-900 dark:text-white">
                  {managerKpi.data.managerTasks?.kpi ?? 0}%
                </div>
                <div className="mt-1 text-xs text-muted dark:text-white/50">
                  Решено: {managerKpi.data.managerTasks?.solved ?? 0} из {managerKpi.data.managerTasks?.total ?? 0}
                </div>
              </div>
              <div className="rounded-xl border border-stroke bg-black/[0.02] p-4 dark:border-white/[0.08] dark:bg-white/[0.03]">
                <div className="text-xs uppercase tracking-wider text-muted dark:text-white/45">Результаты команды</div>
                <div className="mt-1 text-3xl font-semibold tabular-nums text-zinc-900 dark:text-white">
                  {managerKpi.data.teamResults?.kpi ?? managerKpi.data.weekly.kpi}%
                </div>
                <div className="mt-1 text-xs text-muted dark:text-white/50">Неделя с {managerKpi.data.weekAnchor}</div>
              </div>
            </div>
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
              Активных сотрудников в расчёте: {managerKpi.data.activeEmployees}. Управляющий с ролью «Наблюдатель» видит те же цифры в «Обзор» и «Аналитика».
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

      {user?.role === 'ADMIN' ?
        <Card>
          <CardHeader
            title="План / факт"
            description={`Ручные цели на ${planMonth} — отображаются на главном экране «Обзор».`}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              type="number"
              value={revenuePlan}
              onChange={(e) => setRevenuePlan(e.target.value)}
              placeholder="План выручки (₽)"
            />
            <Input
              type="number"
              value={clientPlan}
              onChange={(e) => setClientPlan(e.target.value)}
              placeholder="План клиенток"
            />
          </div>
          <Button className="mt-3" disabled={savePlan.isPending} onClick={() => savePlan.mutate()}>
            Сохранить план
          </Button>
        </Card>
      : null}

      {user && ['ADMIN', 'MANAGER', 'MASTER'].includes(user.role) ?
        <Card>
          <CardHeader
            title="Уведомления на телефон"
            description="Как в WhatsApp: на экране блокировки и в шторке. На iPhone: «Поделиться» → «На экран Домой», затем включите уведомления."
          />
          <Button type="button" variant="outline" onClick={() => void enablePush()}>
            Включить push-уведомления
          </Button>
        </Card>
      : null}

      {user?.role === 'ADMIN' ?
        <AccountsManager />
      : null}

      {user?.role === 'ADMIN' ?
        <Card>
          <CardHeader
            title="Создать аккаунт"
            description="Для роли «Лояльность» сотрудник видит только вкладку программы лояльности."
          />
          <div className="grid gap-3 md:grid-cols-2">
            <Input value={accName} onChange={(e) => setAccName(e.target.value)} placeholder="Имя пользователя" />
            <Input value={accEmail} onChange={(e) => setAccEmail(e.target.value)} placeholder="email@company.com" />
            <Input
              type="password"
              value={accPassword}
              onChange={(e) => setAccPassword(e.target.value)}
              placeholder="Пароль (минимум 6 символов)"
            />
            <select
              className="h-10 rounded-lg border border-stroke bg-[hsl(var(--panel))] px-3 text-sm outline-none dark:border-white/[0.08]"
              value={accRole}
              onChange={(e) => setAccRole(e.target.value as 'ADMIN' | 'MANAGER' | 'MASTER' | 'VIEWER' | 'LOYALTY')}
            >
              <option value="LOYALTY">Лояльность</option>
              <option value="MANAGER">Менеджер салона</option>
              <option value="MASTER">Мастер (CRM просмотр)</option>
              <option value="VIEWER">Только просмотр</option>
              <option value="ADMIN">Администратор</option>
            </select>
            {accRole === 'VIEWER' || accRole === 'MASTER' ?
              <Input
                value={accLinkedEmployeeId}
                onChange={(e) => setAccLinkedEmployeeId(e.target.value)}
                placeholder="linkedEmployeeId (опционально)"
              />
            : null}
          </div>
          <Button
            className="mt-3"
            disabled={!accName.trim() || !accEmail.trim() || accPassword.length < 6 || createAccount.isPending}
            onClick={() => createAccount.mutate()}
          >
            {createAccount.isPending ? 'Создание…' : 'Создать аккаунт'}
          </Button>
        </Card>
      : null}
    </div>
  );
}
