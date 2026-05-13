import { Zap } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { utcMondayIso } from '@/lib/date';
import { apiJson } from '@/lib/http';
import type { EmployeeListItem, TeamDashboard } from '@/lib/types';

function NameList({ ids, items }: { ids: string[]; items: EmployeeListItem[] }) {
  const map = new Map(items.map((e) => [e.id, e.name]));

  return (
    <div className="divide-y divide-stroke overflow-hidden rounded-lg border border-stroke dark:divide-white/[0.06] dark:border-white/[0.06]">
      {ids.map((id) => (
        <div key={id} className="bg-[hsl(var(--panel))] px-3 py-2.5 text-[13px] font-medium text-zinc-900 dark:text-white">
          {map.get(id) ?? id.slice(0, 8)}
        </div>
      ))}
      {ids.length === 0 ?
        <div className="px-3 py-8 text-center text-[13px] text-muted dark:text-white/45">Нет записей</div>
      : null}
    </div>
  );
}

export default function DashboardPage() {
  const anchor = utcMondayIso();

  const dashboard = useQuery({
    queryKey: ['analytics', 'dashboard', anchor],
    queryFn: () => apiJson<TeamDashboard>(`/analytics/dashboard?weekAnchor=${anchor}`),
  });

  const employees = useQuery({
    queryKey: ['employees'],
    queryFn: async () => apiJson<{ items: EmployeeListItem[] }>(`/employees?sort=nameAsc&weekAnchor=${encodeURIComponent(anchor)}`),
  });

  const lineData =
    dashboard.data ?
      [
        { stage: 'Сегодня', kpi: dashboard.data.teamAvgEfficiency },
        { stage: '+ WoW модель', kpi: Math.max(0, dashboard.data.teamAvgEfficiency + dashboard.data.weekOverWeekTrend) },
      ]
    : [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Обзор"
        description={
          <span className="flex flex-wrap items-center gap-2">
            Недельный KPI команды и быстрая диагностика задач.
            <Badge tone="success">Якорь недели: {anchor}</Badge>
          </span>
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/employees">Сотрудники</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/analytics">Аналитика</Link>
            </Button>
            <Button asChild>
              <Link to="/employees">Задачи</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-4">
          <CardHeader title="Командное KPI" description="Средняя недельная эффективность активных участников." />
          {dashboard.isLoading ?
            <Skeleton className="h-[164px]" />
          : <>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-5xl font-semibold tracking-tight tabular-nums text-zinc-900 dark:text-white">
                    {(dashboard.data?.teamAvgEfficiency ?? 0).toFixed(1)}
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-[13px] text-muted dark:text-white/50">
                    <Zap className="size-4 text-accent" />
                    <span>
                      Неделя к неделе:{` `}
                      <strong className="font-semibold text-zinc-900 dark:text-white">
                        {(dashboard.data?.weekOverWeekTrend ?? 0) >= 0 ? '+' : ''}
                        {(dashboard.data?.weekOverWeekTrend ?? 0).toFixed(2)} п.п.
                      </strong>
                    </span>
                  </div>
                </div>

                <div className="h-[120px] w-full sm:w-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lineData}>
                      <CartesianGrid strokeDasharray="4 12" opacity={0.2} stroke="currentColor" className="text-stroke dark:text-white/10" />
                      <XAxis dataKey="stage" stroke="transparent" hide />
                      <YAxis stroke="transparent" hide domain={[0, 115]} />
                      <Tooltip formatter={(value: unknown) => [`${Number(value ?? 0).toFixed(2)}`, '']} />
                      <Line type="monotone" dataKey="kpi" strokeWidth={2.5} stroke="hsl(var(--accent))" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          }
        </Card>

        <Card className="xl:col-span-8">
          <CardHeader title="Команда по KPI" description="Лидеры, зоны внимания и задачи с наименьшей эффективностью." />
          {!dashboard.data || employees.isLoading ?
            <Skeleton className="h-[240px]" />
          : <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted dark:text-white/40">Лидируют</div>
                <NameList ids={dashboard.data.best.map((x) => x.employeeId)} items={employees.data?.items ?? []} />
              </div>
              <div>
                <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted dark:text-white/40">Нужно внимание</div>
                <NameList ids={dashboard.data.atRiskEmployees.map((x) => x.employeeId)} items={employees.data?.items ?? []} />
              </div>

              <div className="md:col-span-2">
                <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted dark:text-white/40">Слабые задачи</div>
                <div className="overflow-hidden rounded-lg border border-stroke dark:border-white/[0.06]">
                  {dashboard.data.lowPerformingTasks.length === 0 ?
                    <div className="bg-[hsl(var(--panel))] px-3 py-8 text-center text-[13px] text-muted dark:text-white/45">
                      Все задачи в норме.
                    </div>
                  : <div className="divide-y divide-stroke dark:divide-white/[0.06]">
                      {dashboard.data.lowPerformingTasks.slice(0, 14).map((t) => (
                        <Link
                          key={t.id}
                          className="block bg-[hsl(var(--panel))] px-3 py-2.5 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                          to="/employees"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="min-w-0">
                              <div className="truncate text-[13px] font-medium text-zinc-900 dark:text-white">{t.title}</div>
                              <div className="truncate text-xs text-muted dark:text-white/45">{t.employeeName}</div>
                            </div>
                            <Badge tone="warning">{`${t.weeklyEfficiency.toFixed(1)}%`}</Badge>
                          </div>
                        </Link>
                      ))}
                    </div>
                  }
                </div>
              </div>
            </div>
          }
        </Card>
      </div>
    </div>
  );
}
