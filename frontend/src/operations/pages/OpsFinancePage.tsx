import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiJson } from '@/lib/http';
import { todayIso } from '@/operations/constants';

type Period = 'month' | 'week' | 'halfyear' | 'year';

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
    salary: number;
    net: number;
    clientCount: number;
  }>;
  grandTotal: {
    revenue: number;
    expenses: number;
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

const EDITABLE_ROWS = new Set(['revenue', 'expenses', 'salary', 'clients']);

function fmt(n: number): string {
  if (n === 0) return '—';
  return n.toLocaleString('ru-RU');
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

export default function OpsFinancePage() {
  const [period, setPeriod] = React.useState<Period>('month');
  const [anchor, setAnchor] = React.useState(() => {
    const t = todayIso();
    return t.slice(0, 8) + '01';
  });
  const qc = useQueryClient();

  const tableQ = useQuery({
    queryKey: ['ops', 'finance', period, anchor],
    queryFn: () => apiJson<FinanceTable>(`/operations/finance/table?period=${period}&anchor=${anchor}`),
  });

  const saveMu = useMutation({
    mutationFn: (body: { date: string; field: string; value: number }) => {
      const payload: Record<string, string | number> = { date: body.date };
      if (body.field === 'clients') payload.clientCount = body.value;
      else payload[body.field] = body.value;
      return apiJson('/operations/finance/day', { method: 'PATCH', body: JSON.stringify(payload) });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['ops', 'finance', period, anchor] }),
  });

  const data = tableQ.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Финансы</h2>
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
      </div>

      <div className="flex items-center gap-2">
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
        <Skeleton className="h-[280px]" />
      : !data ?
        null
      : <div className="overflow-x-auto rounded-xl border border-stroke dark:border-white/[0.08]">
          <table className="w-full min-w-[720px] border-collapse text-xs">
            <thead>
              <tr className="bg-black/[0.03] dark:bg-white/[0.04]">
                <th className="sticky left-0 z-10 min-w-[10rem] border-b border-stroke bg-[hsl(var(--panel))] px-3 py-2 text-left font-bold uppercase tracking-wide dark:border-white/[0.08]">
                  {data.title}
                </th>
                {data.columns.map((col) => (
                  <th
                    key={col.key}
                    className="min-w-[3.25rem] border-b border-l border-stroke px-1 py-2 text-center font-bold tabular-nums dark:border-white/[0.08]"
                  >
                    {col.label}
                  </th>
                ))}
                <th className="min-w-[4.5rem] border-b border-l border-stroke bg-accent/10 px-2 py-2 text-center font-bold dark:border-white/[0.08]">
                  ИТОГО
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.key} className="border-b border-stroke/60 dark:border-white/[0.06]">
                  <td className="sticky left-0 z-10 border-r border-stroke bg-[hsl(var(--panel))] px-3 py-1.5 font-semibold text-zinc-800 dark:border-white/[0.08] dark:text-white/90">
                    {row.label}
                  </td>
                  {row.values.map((val, idx) => {
                    const col = data.columns[idx]!;
                    const editable = (period === 'month' || period === 'week') && EDITABLE_ROWS.has(row.key);
                    return (
                      <td key={col.key} className="border-l border-stroke/50 px-0.5 py-0.5 text-center dark:border-white/[0.06]">
                        {editable ?
                          <input
                            type="number"
                            className="h-7 w-full min-w-[3rem] border-0 bg-transparent text-center text-xs tabular-nums outline-none focus:bg-accent/10 dark:text-white"
                            defaultValue={val || ''}
                            onBlur={(e) => {
                              const n = Math.round(Number(e.target.value) || 0);
                              const field = row.key === 'clients' ? 'clients' : row.key;
                              if (n !== val) saveMu.mutate({ date: col.date, field, value: n });
                            }}
                          />
                        : <span className={`tabular-nums ${row.key === 'net' ? 'font-medium text-emerald-700 dark:text-emerald-400' : ''}`}>
                            {fmt(val)}
                          </span>
                        }
                      </td>
                    );
                  })}
                  <td className="border-l border-stroke bg-black/[0.02] px-2 py-1.5 text-center font-bold tabular-nums dark:border-white/[0.08] dark:bg-white/[0.03]">
                    {fmt(row.total)}
                  </td>
                </tr>
              ))}
              <tr className="bg-accent/5 font-bold dark:bg-accent/10">
                <td className="sticky left-0 z-10 border-r border-stroke bg-[hsl(var(--panel))] px-3 py-2 dark:border-white/[0.08]">
                  Итого по столбцу
                </td>
                {data.columnFooters.map((f) => (
                  <td key={f.date} className="border-l border-stroke/50 px-1 py-2 text-center text-[10px] leading-tight dark:border-white/[0.06]">
                    <div className="text-emerald-700 dark:text-emerald-400">{fmt(f.net)}</div>
                    <div className="text-muted dark:text-white/40">{f.clientCount} кл.</div>
                  </td>
                ))}
                <td className="border-l border-stroke px-2 py-2 text-center dark:border-white/[0.08]">
                  <div>{fmt(data.grandTotal.net)}</div>
                  <div className="text-[10px] font-normal text-muted">{data.grandTotal.clientCount} кл.</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      }

      {data ?
        <div className="flex flex-wrap gap-4 text-xs text-muted dark:text-white/50">
          <span>
            Выручка: <strong className="text-zinc-900 dark:text-white">{fmt(data.grandTotal.revenue)}</strong>
          </span>
          <span>
            Расходы: <strong className="text-zinc-900 dark:text-white">{fmt(data.grandTotal.expenses)}</strong>
          </span>
          <span>
            ЗП: <strong className="text-zinc-900 dark:text-white">{fmt(data.grandTotal.salary)}</strong>
          </span>
          <span>
            Чистая: <strong className="text-emerald-700 dark:text-emerald-400">{fmt(data.grandTotal.net)}</strong>
          </span>
        </div>
      : null}
    </div>
  );
}
