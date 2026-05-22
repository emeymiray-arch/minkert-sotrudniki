import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiJson } from '@/lib/http';
import { todayIso } from '@/operations/constants';
import type { OpsDashboard } from '@/operations/types';
import { OPS_STATUS_LABELS } from '@/operations/types';

export default function OpsDashboardPage() {
  const date = todayIso();
  const { data, isLoading } = useQuery({
    queryKey: ['ops', 'dashboard', date],
    queryFn: () => apiJson<OpsDashboard>(`/operations/dashboard?date=${date}`),
    refetchInterval: 60_000,
  });

  if (isLoading) return <Skeleton className="h-[320px]" />;

  const s = data?.stats;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader title="Выполнено за день" description={`${data?.forDate ?? date}`} />
          <div className="flex items-end gap-2">
            <span className="text-4xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              {s?.completionPercent ?? 0}%
            </span>
            <CheckCircle2 className="mb-1 size-5 text-emerald-500" />
          </div>
          <p className="mt-1 text-xs text-muted">
            {s?.done ?? 0} из {s?.total ?? 0} задач
          </p>
        </Card>
        <Card>
          <CardHeader title="Просрочено" />
          <div className="text-4xl font-semibold tabular-nums text-amber-600">{s?.overdue ?? 0}</div>
        </Card>
        <Card>
          <CardHeader title="Не выполнено" />
          <div className="text-4xl font-semibold tabular-nums">{s?.notDone ?? 0}</div>
        </Card>
        <Card>
          <CardHeader title="Требует внимания" />
          <div className="flex items-end gap-2">
            <span className="text-4xl font-semibold tabular-nums">{s?.needsAttention ?? 0}</span>
            <AlertTriangle className="mb-1 size-5 text-amber-500" />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Срочные задачи" description="Закреплённые, просроченные и критичные." />
          {(data?.urgentTasks ?? []).length === 0 ?
            <p className="text-sm text-muted">Всё под контролем.</p>
          : <ul className="space-y-2">
              {data!.urgentTasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 rounded-lg border border-stroke px-3 py-2 text-sm dark:border-white/[0.08]">
                  <span className="font-medium">{t.title}</span>
                  <Badge tone="warning">{OPS_STATUS_LABELS[t.status]}</Badge>
                </li>
              ))}
            </ul>
          }
        </Card>

        <Card>
          <CardHeader title="Нарушения сегодня" />
          {(data?.violationsToday ?? []).length === 0 ?
            <p className="text-sm text-muted">Нарушений не зафиксировано.</p>
          : <ul className="space-y-2 text-sm">
              {data!.violationsToday.map((v) => (
                <li key={v.id}>
                  <strong>{v.employee.name}</strong> — {v.description || 'без описания'}
                </li>
              ))}
            </ul>
          }
          <Link to="/upravlenie/narusheniya" className="mt-3 inline-block text-xs font-medium text-accent underline-offset-2 hover:underline">
            Все нарушения →
          </Link>
        </Card>

        <Card>
          <CardHeader title="Отчёты не сданы" description="Google Forms — вечерний сбор." />
          {(data?.missedReports ?? []).length === 0 ?
            <p className="text-sm text-muted">Все отчёты в норме или ещё не ожидаются.</p>
          : <ul className="space-y-1 text-sm">
              {data!.missedReports.map((r) => (
                <li key={r.id}>
                  {r.employee?.name ?? '—'} · {r.formKey}
                </li>
              ))}
            </ul>
          }
        </Card>

        <Card>
          <CardHeader title="Повторные нарушители" description="За 30 дней более 3 нарушений." />
          {(data?.repeatViolators ?? []).length === 0 ?
            <p className="text-sm text-muted">Нет повторяющихся паттернов.</p>
          : <div className="flex flex-wrap gap-2">
              {data!.repeatViolators.map((e) => (
                <Badge key={e.id} tone="warning">
                  {e.name}
                </Badge>
              ))}
            </div>
          }
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Последние комментарии" />
          <ul className="space-y-2 text-sm">
            {(data?.recentComments ?? []).map((c) => (
              <li key={c.id} className="rounded-lg bg-black/[0.02] px-3 py-2 dark:bg-white/[0.03]">
                <span className="font-medium">{c.authorName}</span> к «{c.task.title}»: {c.body}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Активность" description="История изменений в системе." />
          <ul className="max-h-[220px] space-y-1 overflow-y-auto text-xs text-muted dark:text-white/50">
            {(data?.recentActivity ?? []).map((a) => (
              <li key={a.id} className="flex gap-2">
                <Clock className="mt-0.5 size-3 shrink-0" />
                <span>
                  {a.userName || 'Система'} · {a.action} · {a.entityType} · {new Date(a.createdAt).toLocaleString('ru-RU')}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
