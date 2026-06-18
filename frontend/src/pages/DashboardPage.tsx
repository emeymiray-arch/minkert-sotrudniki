import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Briefcase, Heart, LineChart, Users2, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';

import { AiInsightCard, type AiInsight } from '@/components/insights/AiInsightCard';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiJson } from '@/lib/http';

type UnifiedDashboard = {
  asOf: string;
  business: {
    revenueToday: number;
    revenueWeek: number;
    revenueMonth: number;
    revenuePlan: number;
    clientPlan: number;
    planMonth: string;
    planCompletionRevenue: number;
    planCompletionClients: number;
    weekRevenueTrend: number;
    netMonth: number;
    expensesMonth: number;
  };
  clients: {
    crmTotal: number;
    newThisMonth: number;
    loyaltyTotal: number;
    loyaltyActive30d: number;
    repeatDue: number;
    crmRevenueMonth: number;
    noShows: number;
    arrived: number;
  };
  employees: {
    teamKpi: number;
    weekTrend: number;
    bestName: string;
    bestKpi: number;
    atRiskCount: number;
    managerKpi: number;
    activeCount: number;
  };
  control: {
    totalTasks: number;
    done: number;
    overdue: number;
    completionPercent: number;
    problemsOpen: number;
    needsAttention: number;
  };
  loyalty: {
    totalClients: number;
    active30d: number;
    index: number;
  };
  ai: {
    director: AiInsight;
    finance: AiInsight;
    hr: AiInsight;
    marketing: AiInsight;
    operations: AiInsight;
  };
};

function money(n: number) {
  return n.toLocaleString('ru-RU');
}

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'good' | 'warn' | 'bad';
}) {
  const toneClass =
    tone === 'good' ? 'text-emerald-600 dark:text-emerald-400'
    : tone === 'warn' ? 'text-amber-600 dark:text-amber-400'
    : tone === 'bad' ? 'text-rose-600 dark:text-rose-400'
    : 'text-zinc-900 dark:text-white';
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted dark:text-white/45">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted dark:text-white/50">{hint}</div> : null}
    </div>
  );
}

function SectionLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
      {label}
      <ArrowRight className="size-3" />
    </Link>
  );
}

export default function DashboardPage() {
  const dash = useQuery({
    queryKey: ['insights', 'dashboard'],
    queryFn: () => apiJson<UnifiedDashboard>('/insights/dashboard'),
    staleTime: 120_000,
  });

  const d = dash.data;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Центр управления"
        description={
          <span className="flex flex-wrap items-center gap-2">
            Состояние бизнеса за 10–15 секунд: финансы, клиенты, команда, контроль и лояльность.
            {d ? <Badge tone="neutral">На {d.asOf}</Badge> : null}
          </span>
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/finansy">Финансы</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/crm">CRM</Link>
            </Button>
            <Button asChild>
              <Link to="/upravlenie">Контроль</Link>
            </Button>
          </>
        }
      />

      {dash.isLoading ?
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-36" />
            ))}
          </div>
          <div>
            <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">AI-анализ</h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
          </div>
        </>
      : !d ?
        <Card>
          <CardHeader title="Нет данных" description="Не удалось загрузить сводку." />
        </Card>
      : <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Card>
              <div className="mb-4 flex items-start justify-between gap-2">
                <CardHeader title="Бизнес" description="Выручка и план/факт" />
                <SectionLink to="/finansy" label="Финансы" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Metric label="Сегодня" value={`${money(d.business.revenueToday)} ₽`} />
                <Metric label="Неделя" value={`${money(d.business.revenueWeek)} ₽`} hint={`${d.business.weekRevenueTrend >= 0 ? '+' : ''}${d.business.weekRevenueTrend}% к прошлой`} />
                <Metric label="Месяц" value={`${money(d.business.revenueMonth)} ₽`} />
                <Metric
                  label="План / факт"
                  value={d.business.revenuePlan ? `${d.business.planCompletionRevenue}%` : '—'}
                  hint={d.business.revenuePlan ? `план ${money(d.business.revenuePlan)} ₽` : 'задайте план в настройках'}
                  tone={d.business.planCompletionRevenue >= 100 ? 'good' : d.business.planCompletionRevenue >= 70 ? 'warn' : undefined}
                />
              </div>
            </Card>

            <Card>
              <div className="mb-4 flex items-start justify-between gap-2">
                <CardHeader title="Клиенты" description="CRM и повторные записи" />
                <SectionLink to="/crm" label="CRM" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Metric label="В CRM" value={String(d.clients.crmTotal)} />
                <Metric label="Новые / месяц" value={String(d.clients.newThisMonth)} />
                <Metric label="Повторный контакт" value={String(d.clients.repeatDue)} tone={d.clients.repeatDue > 0 ? 'warn' : 'good'} />
                <Metric label="Неявки" value={String(d.clients.noShows)} tone={d.clients.noShows > 5 ? 'bad' : undefined} />
              </div>
            </Card>

            <Card>
              <div className="mb-4 flex items-start justify-between gap-2">
                <CardHeader title="Сотрудники" description="KPI команды" />
                <SectionLink to="/employees" label="Команда" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Metric label="KPI недели" value={`${d.employees.teamKpi.toFixed(1)}%`} hint={`${d.employees.weekTrend >= 0 ? '+' : ''}${d.employees.weekTrend.toFixed(1)} п.п.`} />
                <Metric label="Лучший" value={d.employees.bestName} hint={`${d.employees.bestKpi.toFixed(1)}%`} />
                <Metric label="В зоне риска" value={String(d.employees.atRiskCount)} tone={d.employees.atRiskCount > 0 ? 'warn' : 'good'} />
                <Metric label="Активных" value={String(d.employees.activeCount)} />
              </div>
            </Card>

            <Card>
              <div className="mb-4 flex items-start justify-between gap-2">
                <CardHeader title="Контроль" description="Задачи управляющего" />
                <SectionLink to="/upravlenie" label="Контроль" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Metric label="Всего задач" value={String(d.control.totalTasks)} />
                <Metric label="Выполнено" value={`${d.control.completionPercent}%`} tone={d.control.completionPercent >= 80 ? 'good' : 'warn'} />
                <Metric label="Просрочено" value={String(d.control.overdue)} tone={d.control.overdue > 0 ? 'bad' : 'good'} />
                <Metric label="Проблемы" value={String(d.control.problemsOpen)} tone={d.control.problemsOpen > 0 ? 'warn' : undefined} />
              </div>
            </Card>

            <Card>
              <div className="mb-4 flex items-start justify-between gap-2">
                <CardHeader title="Лояльность" description="Активность программы" />
                <SectionLink to="/loyalty" label="Лояльность" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Metric label="Клиентов" value={String(d.loyalty.totalClients)} />
                <Metric label="Активны 30 дн." value={String(d.loyalty.active30d)} />
                <Metric label="Индекс" value={`${d.loyalty.index}%`} hint="доля активных за месяц" />
                <Metric label="CRM выручка" value={`${money(d.clients.crmRevenueMonth)} ₽`} hint="по процедурам" />
              </div>
            </Card>

            <Card>
              <CardHeader title="Быстрые разделы" description="Глубже в детали" />
              <div className="grid grid-cols-2 gap-2">
                {[
                  { to: '/finansy', label: 'Финансы', icon: Wallet },
                  { to: '/crm', label: 'CRM', icon: Users2 },
                  { to: '/upravlenie', label: 'Контроль', icon: Briefcase },
                  { to: '/analytics', label: 'Аналитика KPI', icon: LineChart },
                  { to: '/loyalty', label: 'Лояльность', icon: Heart },
                  { to: '/problemy', label: 'Проблемы', icon: Briefcase },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className="flex items-center gap-2 rounded-lg border border-stroke px-3 py-2 text-[13px] font-medium transition-colors hover:bg-black/[0.03] dark:border-white/[0.08] dark:hover:bg-white/[0.04]"
                    >
                      <Icon className="size-4 opacity-70" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </Card>
          </div>

          <div>
            <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">AI-анализ</h2>
            <div className="grid gap-4 lg:grid-cols-2">
              <AiInsightCard title="AI-Директор" data={d.ai.director} description="Сводные выводы по всем направлениям" />
              <AiInsightCard title="AI Финансист" data={d.ai.finance} />
              <AiInsightCard title="AI HR" data={d.ai.hr} />
              <AiInsightCard title="AI Маркетолог" data={d.ai.marketing} />
              <div className="lg:col-span-2">
                <AiInsightCard title="AI Операционный" data={d.ai.operations} />
              </div>
            </div>
          </div>
        </>
      }
    </div>
  );
}
