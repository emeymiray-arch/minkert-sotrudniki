import { useQuery } from '@tanstack/react-query';
import * as React from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { apiJson } from '@/lib/http';
import { todayIso } from '@/operations/constants';
import { CHECK_TYPE_LABEL } from '@/operations/check-labels';
import type { OpsTaskCheckType } from '@/operations/types';

type JournalItem = {
  id: string;
  recordDate: string;
  comment: string;
  hasIssue: boolean;
  effectiveCheckType: OpsTaskCheckType;
  employee: { id: string; name: string };
  task: { id: string; title: string; block: string };
};

export default function OpsJournalPage() {
  const [searchParams] = useSearchParams();
  const [employeeId, setEmployeeId] = React.useState(() => searchParams.get('employeeId') ?? '');
  const [from, setFrom] = React.useState(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 14);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = React.useState(todayIso());
  const [checkType, setCheckType] = React.useState('');

  const staffQ = useQuery({
    queryKey: ['ops', 'staff'],
    queryFn: () => apiJson<{ items: Array<{ id: string; name: string }> }>('/operations/staff'),
  });

  const journalQ = useQuery({
    queryKey: ['ops', 'journal', employeeId, from, to, checkType],
    queryFn: () => {
      const q = new URLSearchParams({ from, to });
      if (employeeId) q.set('employeeId', employeeId);
      if (checkType) q.set('checkType', checkType);
      return apiJson<{ items: JournalItem[] }>(`/operations/check-journal?${q}`);
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Журнал фиксаций"
          description="История проверок по сотрудникам: явка, чек-листы, отчёты. Фильтруйте по дате и человеку."
        />
        <div className="flex flex-wrap gap-3">
          <select
            className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-white/10"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          >
            <option value="">Все сотрудники</option>
            {(staffQ.data?.items ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-white/10"
            value={checkType}
            onChange={(e) => setCheckType(e.target.value)}
          >
            <option value="">Все типы</option>
            {(Object.keys(CHECK_TYPE_LABEL) as OpsTaskCheckType[]).map((k) => (
              <option key={k} value={k}>
                {CHECK_TYPE_LABEL[k]}
              </option>
            ))}
          </select>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </Card>

      <Card>
        {journalQ.isLoading ?
          <Skeleton className="h-[200px]" />
        : <ul className="divide-y divide-stroke dark:divide-white/[0.08]">
            {(journalQ.data?.items ?? []).length === 0 ?
              <li className="py-8 text-center text-sm text-muted">Записей нет за выбранный период.</li>
            : journalQ.data!.items.map((item) => (
                <li key={item.id} className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm">
                  <div>
                    <div className="font-semibold text-zinc-900 dark:text-white">
                      {item.employee.name} · {item.recordDate}
                    </div>
                    <div className="text-muted dark:text-white/50">
                      {CHECK_TYPE_LABEL[item.effectiveCheckType]} — {item.task.title}
                    </div>
                    {item.comment ?
                      <div className="mt-1 text-xs">{item.comment}</div>
                    : null}
                  </div>
                  <div className="flex gap-2">
                    {item.hasIssue ?
                      <Badge tone="warning">Проблема</Badge>
                    : <Badge tone="success">Ок</Badge>}
                    <Link
                      to={`/upravlenie/sotrudniki/${item.employee.id}`}
                      className="text-xs text-accent underline-offset-2 hover:underline"
                    >
                      Карточка
                    </Link>
                  </div>
                </li>
              ))
            }
          </ul>
        }
      </Card>
    </div>
  );
}
