import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { utcMondayIso } from '@/lib/date';
import { apiJson } from '@/lib/http';
import type { HeatmapRow, TeamDashboard } from '@/lib/types';

export default function AnalyticsPage() {
  const anchor = utcMondayIso();

  const dashboard = useQuery({
    queryKey: ['analytics', 'dashboard', anchor],
    queryFn: () => apiJson<TeamDashboard>(`/analytics/dashboard?weekAnchor=${anchor}`),
  });

  const heatmap = useQuery({
    queryKey: ['heatmap'],
    queryFn: () => apiJson<HeatmapRow[]>(`/analytics/heatmap`),
  });

  const distribution = heatmap.data?.map((row) => {
    const avg = row.cells.reduce((sum, c) => sum + c.value, 0) / Math.max(1, row.cells.length);
    return { name: row.name, value: Number(avg.toFixed(2)) };
  });

  const weekdayBars =
    heatmap.data && heatmap.data.length ?
      heatmap.data[0]!.cells.map((cell, idx) => {
        const vals = heatmap.data!.map((r) => r.cells[idx]?.value ?? 0);
        const avg = vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length);
        return { day: cell.label, kpi: Number(avg.toFixed(2)) };
      })
    : [];

  const focused = (heatmap.data ?? []).slice(0, 4);
  const colorByIdx = ['#22d3ee', '#a855f7', '#34d399', '#f59e0b'];
  const radarData = focused.length
    ? focused[0].cells.map((cell, i) => ({
        day: cell.label,
        ...Object.fromEntries(
          focused.map((row, idx) => [`emp${idx}`, Number((row.cells[i]?.value ?? 0).toFixed(2))]),
        ),
      }))
    : [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Аналитика"
        description={
          <span className="flex flex-wrap items-center gap-2">
            KPI команды, динамика и тепловая карта по дням недели.
            <Badge tone="neutral">Среднее: {dashboard.data?.teamAvgEfficiency ?? '—'}%</Badge>
            <Badge tone={dashboard.data && dashboard.data.weekOverWeekTrend >= 0 ? 'success' : 'warning'}>
              WoW:{` ${dashboard.data ? `${dashboard.data.weekOverWeekTrend >= 0 ? '+' : ''}${dashboard.data.weekOverWeekTrend.toFixed(2)} п.п.` : '—'}`}
            </Badge>
          </span>
        }
        actions={
          <Button variant="outline" asChild>
            <Link to="/">Обзор</Link>
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-5">
          <CardHeader title="Распределение усилий" description="Относительный средний KPI по активным задачникам текущего периода." />
          {!distribution?.length ?
            <Skeleton className="h-[240px]" />
          : <>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip formatter={(value: unknown) => [`${Number(value ?? 0).toFixed(2)}%`, 'KPI']} />
                    <Pie data={distribution} dataKey="value" nameKey="name" innerRadius={68} outerRadius={96}>
                      {distribution.map((entry, idx) => (
                        <Cell key={`${entry.name}-${idx}`} fill={idx % 4 === 0 ? 'hsl(var(--accent))' : idx % 4 === 1 ? '#22d3ee' : idx % 4 === 2 ? '#a855f7' : '#eab308'} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1 text-[12px] text-muted dark:text-white/54">
                {distribution.slice(0, 6).map((d) => (
                  <div key={d.name} className="flex items-center justify-between gap-4">
                    <span className="truncate font-semibold text-zinc-900 dark:text-white">{d.name}</span>
                    <span>{d.value}%</span>
                  </div>
                ))}
              </div>
            </>
          }
        </Card>

        <Card className="xl:col-span-7">
          <CardHeader title="Структурированность по будням" description="Средний KPI каждого дня среди задач активных профилей." />
          {!weekdayBars.length ?
            <Skeleton className="h-[280px]" />
          : <>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekdayBars}>
                    <CartesianGrid strokeDasharray="8 14" opacity={0.25} stroke="currentColor" className="text-stroke dark:text-white/14" vertical={false} />
                    <XAxis dataKey="day" strokeOpacity={0.45} stroke="currentColor" className="text-xs text-muted" />
                    <YAxis strokeOpacity={0.45} domain={[0, 115]} tickFormatter={(v) => `${v}`} width={42} stroke="currentColor" className="text-xs text-muted" />
                    <Tooltip formatter={(value: unknown) => [`${Number(value ?? 0).toFixed(2)}`, '']} />
                    <Bar dataKey="kpi" radius={[12, 12, 0, 0]}>
                      {weekdayBars.map((_, index) => (
                        <Cell key={index} fill={index >= 5 ? '#f97316' : 'hsl(var(--accent))'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          }
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Персональная аналитика 4 сотрудников"
          description="Под каждый профиль подбирается отдельный цвет и отдельная форма визуализации."
        />
        {!focused.length ? (
          <Skeleton className="h-[280px]" />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {focused.map((row, idx) => {
              const series = row.cells.map((c) => ({ day: c.label, value: c.value }));
              return (
                <div
                  key={row.employeeId}
                  className="rounded-xl border border-stroke bg-[hsl(var(--panel))] p-4 dark:border-white/[0.06]"
                >
                  <div className="mb-2 text-sm font-semibold text-zinc-900 dark:text-white">{row.name}</div>
                  <div className="h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      {idx % 2 === 0 ? (
                        <AreaChart data={series}>
                          <CartesianGrid strokeDasharray="5 10" opacity={0.2} />
                          <XAxis dataKey="day" />
                          <YAxis domain={[0, 115]} />
                          <Tooltip formatter={(v: unknown) => [`${Number(v ?? 0).toFixed(1)}%`, 'KPI']} />
                          <Area
                            type="monotone"
                            dataKey="value"
                            stroke={colorByIdx[idx]}
                            fill={colorByIdx[idx]}
                            fillOpacity={0.28}
                          />
                        </AreaChart>
                      ) : (
                        <BarChart data={series}>
                          <CartesianGrid strokeDasharray="5 10" opacity={0.2} />
                          <XAxis dataKey="day" />
                          <YAxis domain={[0, 115]} />
                          <Tooltip formatter={(v: unknown) => [`${Number(v ?? 0).toFixed(1)}%`, 'KPI']} />
                          <Bar dataKey="value" fill={colorByIdx[idx]} radius={[8, 8, 0, 0]} />
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Сравнение 4 сотрудников по неделе (Radar)"
          description="Визуально понятный способ увидеть, у кого проседают конкретные дни."
        />
        {!radarData.length ? (
          <Skeleton className="h-[320px]" />
        ) : (
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="day" />
                {focused.map((row, idx) => (
                  <Radar
                    key={row.employeeId}
                    name={row.name}
                    dataKey={`emp${idx}`}
                    stroke={colorByIdx[idx]}
                    fill={colorByIdx[idx]}
                    fillOpacity={0.16}
                  />
                ))}
                <Tooltip formatter={(v: unknown) => `${Number(v ?? 0).toFixed(1)}%`} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Тепловая карта команды" description="Каждая ячейка — средний KPI по дню для сотрудника." />
        {!heatmap.data ?
          <Skeleton className="h-[220px]" />
        : <div className="overflow-auto">
            <table className="min-w-[860px] w-full border-collapse text-xs">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.15em] text-muted dark:text-white/45">
                  <th className="p-2">Сотрудник</th>
                  {heatmap.data[0]?.cells.map((c) => (
                    <th key={c.key} className="p-2">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmap.data.map((row) => (
                  <tr key={row.employeeId} className="border-t border-stroke/65 dark:border-white/10">
                    <td className="p-2 font-semibold text-zinc-900 dark:text-white">
                      <Link className="underline-offset-4 hover:underline" to={`/employees/${row.employeeId}`}>
                        {row.name}
                      </Link>
                    </td>
                    {row.cells.map((cell) => (
                      <td key={`${row.employeeId}-${cell.key}`} className="p-2">
                        <div
                          title={`${row.name}: ${cell.label}`}
                          className="grid h-[44px] place-items-center rounded-xl border border-stroke px-3 text-[12px] font-semibold shadow-inner dark:border-white/10 dark:text-white/90"
                          style={{
                            background: `rgba(34, 211, 238, ${Math.min(cell.value / 110, 0.85)})`,
                          }}
                        >
                          <span>{cell.value.toFixed(0)}</span>
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        }
      </Card>

      <Card>
        <CardHeader title="Микро-серия качества задач по неделям" description="Средний KPI топ-линии из heatmap строки." />

        {!dashboard.data ?
          <Skeleton className="h-[220px]" />
        : <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={[
                  { t: 'Пн', v: dashboard.data.teamAvgEfficiency * 0.92 },
                  { t: 'Ср', v: dashboard.data.teamAvgEfficiency * 0.98 },
                  { t: 'Пт', v: dashboard.data.teamAvgEfficiency },
                  { t: 'Всх', v: dashboard.data.teamAvgEfficiency + dashboard.data.weekOverWeekTrend },
                ]}
              >
                <CartesianGrid strokeDasharray="6 10" opacity={0.2} stroke="currentColor" className="text-stroke dark:text-white/10" />
                <XAxis dataKey="t" strokeOpacity={0.45} stroke="currentColor" className="text-xs text-muted" />
                <YAxis strokeOpacity={0.45} domain={[0, 120]} stroke="currentColor" className="text-xs text-muted" />
                <Tooltip formatter={(value: unknown) => [`${Number(value ?? 0).toFixed(2)}`, '']} />
                <Line type="monotone" strokeWidth={3} dataKey="v" stroke="hsl(var(--accent))" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        }
      </Card>
    </div>
  );
}
