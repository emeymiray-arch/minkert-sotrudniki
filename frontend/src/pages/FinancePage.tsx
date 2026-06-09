import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { ExpenseDayModal } from '@/components/finance/ExpenseDayModal';
import { FinanceMoneyInput } from '@/components/finance/FinanceMoneyInput';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMoneyDisplay } from '@/lib/finance-format';
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
    salary: number;
    discounts: number;
    expenses: number;
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

const AUTO_METRICS = new Set(['revenue', 'salary', 'discounts', 'net']);

const METRIC_TO_GRAND: Record<string, keyof FinanceTable['grandTotal']> = {
  revenue: 'revenue',
  salary: 'salary',
  discounts: 'discounts',
  expenses: 'expenses',
  net: 'net',
  clients: 'clientCount',
};

function periodRowLabel(period: Period): string {
  if (period === 'month') return 'День';
  if (period === 'week') return 'Дата';
  return 'Месяц';
}

function fmt(n: number): string {
  if (n === 0) return '—';
  return formatMoneyDisplay(n);
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

function patchFinanceCell(data: FinanceTable, date: string, field: string, value: number): FinanceTable {
  const colIdx = data.columns.findIndex((c) => c.date === date);
  if (colIdx < 0) return data;

  const rows = data.rows.map((row) => {
    if (row.key !== field) return row;
    const values = [...row.values];
    values[colIdx] = value;
    return { ...row, values, total: values.reduce((a, b) => a + b, 0) };
  });

  const grandKey = METRIC_TO_GRAND[field];
  const grandTotal = grandKey ? { ...data.grandTotal, [grandKey]: rows.find((r) => r.key === field)?.total ?? value } : data.grandTotal;

  return { ...data, rows, grandTotal };
}

export default function FinancePage() {
  const [period, setPeriod] = React.useState<Period>('month');
  const [anchor, setAnchor] = React.useState(() => {
    const t = todayIso();
    return t.slice(0, 8) + '01';
  });
  const [expenseDate, setExpenseDate] = React.useState<string | null>(null);
  const qc = useQueryClient();

  const tableQ = useQuery({
    queryKey: ['finance', period, anchor],
    queryFn: () => apiJson<FinanceTable>(`/finance/table?period=${period}&anchor=${anchor}`),
    staleTime: 120_000,
    placeholderData: (prev) => prev,
  });

  const saveMu = useMutation({
    mutationFn: (body: { date: string; field: string; value: number }) => {
      const payload: Record<string, string | number> = { date: body.date };
      if (body.field === 'clients') payload.clientCount = body.value;
      else payload[body.field] = body.value;
      return apiJson('/finance/day', { method: 'PATCH', body: JSON.stringify(payload) });
    },
    onMutate: async (vars) => {
      const key = ['finance', period, anchor] as const;
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<FinanceTable>(key);
      if (prev) qc.setQueryData(key, patchFinanceCell(prev, vars.date, vars.field, vars.value));
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      const key = ['finance', period, anchor] as const;
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      toast.error(err instanceof Error ? err.message : 'Не удалось сохранить');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance', period, anchor] }),
  });

  const data = tableQ.data;
  const canEditClients = period === 'month' || period === 'week';

  return (
    <div className="space-y-8">
      <PageHeader
        title="Финансы"
        description="Выручка, ЗП и скидки считаются из CRM-процедур. Расходы — список покупок по дню."
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

      {tableQ.isLoading && !data ?
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
                    const isExpense = metric.key === 'expenses';
                    const editableClients = canEditClients && metric.key === 'clients';
                    return (
                      <td
                        key={`${col.key}-${metric.key}`}
                        className={cn(
                          'border-l border-stroke/40 px-3 py-1.5 text-right dark:border-white/[0.05]',
                          isExpense && canEditClients && 'cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/[0.04]',
                        )}
                        onClick={isExpense && canEditClients ? () => setExpenseDate(col.date) : undefined}
                        title={isExpense && canEditClients ? 'Нажмите, чтобы открыть список покупок' : undefined}
                      >
                        {editableClients ?
                          <FinanceMoneyInput
                            value={val}
                            onCommit={(n) => {
                              if (n !== val) saveMu.mutate({ date: col.date, field: 'clients', value: n });
                            }}
                          />
                        : <span
                          className={cn(
                            'inline-block min-w-[5rem] tabular-nums',
                            metric.key === 'net' && 'font-semibold text-emerald-700 dark:text-emerald-400',
                            AUTO_METRICS.has(metric.key) && 'text-muted dark:text-white/70',
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
            Общая выручка: <strong className="text-zinc-900 dark:text-white">{fmt(data.grandTotal.revenue)}</strong>
          </span>
          <span>
            ЗП: <strong className="text-zinc-900 dark:text-white">{fmt(data.grandTotal.salary)}</strong>
          </span>
          <span>
            Скидки: <strong className="text-zinc-900 dark:text-white">{fmt(data.grandTotal.discounts)}</strong>
          </span>
          <span>
            Расходы: <strong className="text-zinc-900 dark:text-white">{fmt(data.grandTotal.expenses)}</strong>
          </span>
          <span>
            Без расходов: <strong className="text-emerald-700 dark:text-emerald-400">{fmt(data.grandTotal.net)}</strong>
          </span>
          <span>
            Клиентки: <strong className="text-zinc-900 dark:text-white">{fmt(data.grandTotal.clientCount)}</strong>
          </span>
        </div>
      : null}

      {expenseDate ?
        <ExpenseDayModal
          date={expenseDate}
          open={!!expenseDate}
          onOpenChange={(v) => !v && setExpenseDate(null)}
          onUpdated={() => qc.invalidateQueries({ queryKey: ['finance', period, anchor] })}
        />
      : null}
    </div>
  );
}
