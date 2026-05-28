import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import * as React from 'react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiJson } from '@/lib/http';
import { cn } from '@/lib/utils';

type Period = 'month' | 'week' | 'halfyear' | 'year';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

type FinanceTable = {
  period: Period;
  title: string;
  anchor: string;
  columns: Array<{ key: string; date: string; label: string }>;
  rows: Array<{ key: string; label: string; values: number[]; total: number }>;
  columnFooters: Array<{
    date: string;
    revenue: number;
    expenses: number;
    discounts: number;
    salary: number;
    net: number;
    clientCount: number;
  }>;
  grandTotal: {
    revenue: number;
    expenses: number;
    discounts: number;
    salary: number;
    net: number;
    clientCount: number;
  };
};

const PERIODS: { id: Period; label: string }[] = [
  { id: 'month', label: 'Месяц' },
  { id: 'week', label: '7 дней' },
  { id: 'halfyear', label: 'Полгода' },
  { id: 'year', label: 'Год' },
];

const EDITABLE_METRICS = new Set(['revenue', 'expenses', 'discounts', 'salary', 'clients']);

function periodRowLabel(period: Period): string {
  if (period === 'month') return 'День';
  if (period === 'week') return 'Дата';
  return 'Месяц';
}

function fmt(n: number): string {
  if (n === 0) return '—';
  return n.toLocaleString('en-US');
}

function shiftAnchor(anchor: string, period: Period, dir: -1 | 1): string {
  const d = new Date(anchor + 'T12:00:00Z');
  if (period === 'month' || period === 'week') {
    d.setUTCMonth(d.getUTCMonth() + dir);
  } else if (period === 'halfyear') {
    d.setUTCMonth(d.getUTCMonth() + dir * 6);
  } else {
    d.setUTCFullYear(d.getUTCFullYear() + dir);
  }
  return d.toISOString().slice(0, 10);
}

export default function FinancePage() {
  const [period, setPeriod] = React.useState<Period>('month');
  const [anchor, setAnchor] = React.useState(() => {
    const t = todayIso();
    return t.slice(0, 8) + '01';
  });
  const qc = useQueryClient();

  const tableQ = useQuery({
    queryKey: ['finance', period, anchor],
    queryFn: () => apiJson<FinanceTable>(`/operations/finance/table?period=${period}&anchor=${anchor}`),
  });

  const saveMu = useMutation({
    mutationFn: (body: { date: string; field: string; value: number }) => {
      const payload: Record<string, string | number> = { date: body.date };
      if (body.field === 'clients') payload.clientCount = body.value;
      else payload[body.field] = body.value;
      return apiJson('/operations/finance/day', { method: 'PATCH', body: JSON.stringify(payload) });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['finance', period, anchor] }),
  });

  const data = tableQ.data;
  const canEdit = period === 'month' || period === 'week';

  return (
    <div className="space-y-8">
      <PageHeader
        title="Финансы"
        description="Показатели в столбцах, дни и месяцы — строками. Удобно листать вниз."
        actions={
          <div className="flex flex-wrap gap-1">
            {PERIODS.map((p) => (
              <Button
                key={p.id}
                type="button"
                size="sm"
                variant={period === p.id ? 'primary' : 'outline'}
                onClick={() => setPeriod(p.id)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        }
      />

      <div className="flex items-center justify-center gap-2">
        <Button type="button" variant="outline" size="icon" onClick={() => setAnchor((a) => shiftAnchor(a, period, -1))}>
          <ChevronLeft className="size-4" />
        </Button>
        <span className="min-w-[12rem] text-center text-sm font-bold uppercase tracking-wide text-zinc-900 dark:text-white">
          {data?.title ?? '…'}
        </span>
        <Button type="button" variant="outline" size="icon" onClick={() => setAnchor((a) => shiftAnchor(a, period, 1))}>
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {tableQ.isLoading ?
        <Skeleton className="h-[320px]" />
      : !data ?
        null
      : <div className="overflow-y-auto rounded-xl border border-stroke dark:border-white/[0.08]">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-20 bg-[hsl(var(--panel))] shadow-[0_1px_0_0_hsl(var(--stroke))] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.08)]">
              <tr>
                <th className="w-[5.5rem] border-b border-stroke px-4 py-3 text-left font-bold text-zinc-900 dark:border-white/[0.08] dark:text-white">
                  {periodRowLabel(period)}
                </th>
                {data.rows.map((metric) => (
                  <th
                    key={metric.key}
                    className={cn(
                      'border-b border-l border-stroke px-3 py-3 text-right font-bold dark:border-white/[0.08]',
                      metric.key === 'net' && 'text-emerald-800 dark:text-emerald-400',
                    )}
                  >
                    <span className="block max-w-[9rem] leading-snug">{metric.label}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.columns.map((col, rowIdx) => (
                <tr
                  key={col.key}
                  className={cn(
                    'border-b border-stroke/50 dark:border-white/[0.05]',
                    rowIdx % 2 === 0 ? 'bg-transparent' : 'bg-black/[0.02] dark:bg-white/[0.02]',
                  )}
                >
                  <td className="sticky left-0 z-10 border-r border-stroke/60 bg-[hsl(var(--panel))] px-4 py-2 font-bold tabular-nums text-zinc-900 dark:border-white/[0.06] dark:text-white">
                    {col.label}
                  </td>
                  {data.rows.map((metric) => {
                    const val = metric.values[rowIdx] ?? 0;
                    const editable = canEdit && EDITABLE_METRICS.has(metric.key);
                    return (
                      <td
                        key={`${col.key}-${metric.key}`}
                        className="border-l border-stroke/40 px-3 py-1.5 text-right dark:border-white/[0.05]"
                      >
                        {editable ?
                          <input
                            type="number"
                            className="h-9 w-full min-w-[5rem] max-w-[8rem] ml-auto border-0 bg-transparent text-right text-sm tabular-nums outline-none focus:bg-accent/10 dark:text-white"
                            defaultValue={val || ''}
                            onBlur={(e) => {
                              const n = Math.round(Number(e.target.value) || 0);
                              const field = metric.key === 'clients' ? 'clients' : metric.key;
                              if (n !== val) saveMu.mutate({ date: col.date, field, value: n });
                            }}
                          />
                        : <span
                          className={cn(
                            'inline-block min-w-[5rem] tabular-nums',
                            metric.key === 'net' && 'font-semibold text-emerald-700 dark:text-emerald-400',
                          )}
                        >
                          {fmt(val)}
                        </span>
                        }
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="bg-accent/10 font-bold dark:bg-accent/15">
                <td className="sticky left-0 z-10 border-r border-stroke bg-accent/10 px-4 py-3 dark:border-white/[0.08] dark:bg-accent/15">
                  ИТОГО
                </td>
                {data.rows.map((metric) => (
                  <td
                    key={`total-${metric.key}`}
                    className={cn(
                      'border-l border-stroke/50 px-3 py-3 text-right tabular-nums dark:border-white/[0.06]',
                      metric.key === 'net' && 'text-emerald-700 dark:text-emerald-400',
                    )}
                  >
                    {fmt(metric.total)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      }

      {data ?
        <div className="flex flex-wrap gap-6 text-sm text-muted dark:text-white/50">
          <span>
            Выручка: <strong className="text-zinc-900 dark:text-white">{fmt(data.grandTotal.revenue)}</strong>
          </span>
          <span>
            Расходы: <strong className="text-zinc-900 dark:text-white">{fmt(data.grandTotal.expenses)}</strong>
          </span>
          <span>
            Скидки: <strong className="text-zinc-900 dark:text-white">{fmt(data.grandTotal.discounts)}</strong>
          </span>
          <span>
            ЗП: <strong className="text-zinc-900 dark:text-white">{fmt(data.grandTotal.salary)}</strong>
          </span>
          <span>
            Чистая: <strong className="text-emerald-700 dark:text-emerald-400">{fmt(data.grandTotal.net)}</strong>
          </span>
          <span>
            Клиентки: <strong className="text-zinc-900 dark:text-white">{fmt(data.grandTotal.clientCount)}</strong>
          </span>
        </div>
      : null}
    </div>
  );
}
