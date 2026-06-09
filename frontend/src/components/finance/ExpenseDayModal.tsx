import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { formatMoneyDisplay } from '@/lib/finance-format';
import { apiJson } from '@/lib/http';

type ExpenseItem = { id: string; title: string; amount: number };

export function ExpenseDayModal({
  date,
  open,
  onOpenChange,
  onUpdated,
}: {
  date: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUpdated: () => void;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = React.useState('');
  const [amount, setAmount] = React.useState('');

  const listQ = useQuery({
    queryKey: ['finance', 'expenses', date],
    queryFn: () => apiJson<ExpenseItem[]>(`/finance/expenses?date=${date}`),
    enabled: open && !!date,
  });

  const addMu = useMutation({
    mutationFn: () =>
      apiJson('/finance/expenses', {
        method: 'POST',
        body: JSON.stringify({ date, title, amount: Number(amount || 0) }),
      }),
    onSuccess: async () => {
      setTitle('');
      setAmount('');
      await qc.invalidateQueries({ queryKey: ['finance', 'expenses', date] });
      onUpdated();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Ошибка'),
  });

  const delMu = useMutation({
    mutationFn: (id: string) => apiJson(`/finance/expenses/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['finance', 'expenses', date] });
      onUpdated();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Ошибка'),
  });

  const total = (listQ.data ?? []).reduce((s, e) => s + e.amount, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>Расходы · {date}</DialogTitle>
        <div className="mt-2 space-y-3">
          <div className="rounded-lg bg-zinc-100 px-3 py-2 text-sm dark:bg-white/[0.06]">
            Итого: <strong>{formatMoneyDisplay(total)}</strong>
          </div>
          {listQ.isLoading ?
            <div className="text-sm text-muted">Загрузка…</div>
          : <ul className="max-h-48 space-y-1 overflow-y-auto">
              {(listQ.data ?? []).map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
                  <span>{e.title}</span>
                  <span className="flex items-center gap-2 tabular-nums">
                    {formatMoneyDisplay(e.amount)}
                    <Button type="button" size="icon" variant="outline" className="size-7" onClick={() => delMu.mutate(e.id)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </span>
                </li>
              ))}
              {!listQ.data?.length ?
                <li className="text-sm text-muted">Покупок пока нет</li>
              : null}
            </ul>
          }
          <div className="grid gap-2 sm:grid-cols-[1fr_6rem_auto]">
            <Input placeholder="Покупка" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Input placeholder="Сумма" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Button
              type="button"
              disabled={!title.trim() || !amount || addMu.isPending}
              onClick={() => addMu.mutate()}
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
