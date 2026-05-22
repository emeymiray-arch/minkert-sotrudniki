import { useQuery } from '@tanstack/react-query';

import { Card, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiJson } from '@/lib/http';
import { todayIso } from '@/operations/constants';
import { OPS_STATUS_LABELS } from '@/operations/types';
import type { OpsTaskStatus } from '@/operations/types';

export default function OpsAnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['ops', 'analytics'],
    queryFn: () => apiJson<{
      forDate: string;
      monthTasks: number;
      byStatus: Array<{ status: OpsTaskStatus; count: number }>;
      violationsMonth: number;
      contentCheckedToday: number;
      reportsSubmitted: number;
      reportsMissed: number;
      placeholder: { note: string };
    }>(`/operations/analytics?date=${todayIso()}`),
  });

  if (isLoading) return <Skeleton className="h-[280px]" />;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader title="Задач в месяце" />
          <div className="text-3xl font-semibold tabular-nums">{data?.monthTasks ?? 0}</div>
        </Card>
        <Card>
          <CardHeader title="Нарушений (месяц)" />
          <div className="text-3xl font-semibold tabular-nums">{data?.violationsMonth ?? 0}</div>
        </Card>
        <Card>
          <CardHeader title="Отчёты сданы" />
          <div className="text-3xl font-semibold tabular-nums text-emerald-600">{data?.reportsSubmitted ?? 0}</div>
        </Card>
        <Card>
          <CardHeader title="Отчёты не сданы" />
          <div className="text-3xl font-semibold tabular-nums text-amber-600">{data?.reportsMissed ?? 0}</div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Статусы задач" description="За текущий месяц." />
        <ul className="grid gap-2 sm:grid-cols-2">
          {(data?.byStatus ?? []).map((row) => (
            <li key={row.status} className="flex justify-between rounded-lg bg-black/[0.03] px-3 py-2 text-sm dark:bg-white/[0.04]">
              <span>{OPS_STATUS_LABELS[row.status]}</span>
              <strong>{row.count}</strong>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader title="Записи и продажи" description={data?.placeholder.note} />
        <p className="text-sm text-muted dark:text-white/50">
          Блоки «записи», «продажи», «отмены» и «активность клиентов» подключаются при интеграции с кассой или CRM. Сейчас
          аналитика строится на операционных задачах, нарушениях и отчётах.
        </p>
      </Card>
    </div>
  );
}
