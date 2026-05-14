import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { apiJson } from '@/lib/http';
import { cn } from '@/lib/utils';

type WeekPayload = {
  employeeName: string;
  date: string;
  weekStart: string;
  dayKey: string;
  dayLabelRu: string;
  tasks: { id: string; title: string; description: string; score: number }[];
};

export default function PublicEmployeeTasksPage() {
  const { token } = useParams<{ token: string }>();
  const qc = useQueryClient();
  const [dayIso, setDayIso] = React.useState(() => new Date().toISOString().slice(0, 10));

  const week = useQuery({
    queryKey: ['public-employee-tasks', token, dayIso],
    queryFn: () =>
      apiJson<WeekPayload>(`/public/employee-tasks/${encodeURIComponent(token!)}?date=${encodeURIComponent(dayIso)}`, {
        auth: false,
      }),
    enabled: Boolean(token),
  });

  const patchDay = useMutation({
    mutationFn: async (args: { taskId: string; score: number }) =>
      apiJson(`/public/employee-tasks/${encodeURIComponent(token!)}/tasks/${encodeURIComponent(args.taskId)}`, {
        method: 'PATCH',
        auth: false,
        body: JSON.stringify({ date: dayIso, score: args.score }),
      }),
    onSuccess: async () => {
      toast.success('Сохранено');
      await qc.invalidateQueries({ queryKey: ['public-employee-tasks', token, dayIso] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Не сохранилось'),
  });

  if (!token) return null;

  const busy = week.isLoading;
  const items = week.data?.tasks ?? [];

  return (
    <div className="min-h-full bg-[hsl(var(--bg))] bg-ambient px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-lg space-y-4">
        <div className="text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted dark:text-white/45">Задачи</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            {week.data?.employeeName ?? (week.isLoading ? '…' : 'Сотрудник')}
          </h1>
          <p className="mt-1 text-[13px] text-muted dark:text-white/50">
            Задачи за неделю задал руководитель. Выберите дату и отметьте за этот день: не сделано (0), частично (1), сделано (2).
          </p>
        </div>

        <Card className="p-4 sm:p-5">
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid flex-1 gap-1 text-[12px] font-medium text-zinc-800 dark:text-white/85">
              Дата
              <Input type="date" value={dayIso} onChange={(e) => setDayIso(e.target.value)} className="max-w-[11rem]" />
            </label>
            <Button type="button" variant="outline" size="sm" onClick={() => setDayIso(new Date().toISOString().slice(0, 10))}>
              Сегодня
            </Button>
          </div>

          {week.data ?
            <p className="mt-3 text-[11px] uppercase tracking-[0.12em] text-muted dark:text-white/45">
              Неделя с {week.data.weekStart} · день {week.data.dayLabelRu}
            </p>
          : null}

          {busy ?
            <div className="mt-4 space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          : week.isError ?
            <p className="mt-4 text-sm text-rose-600 dark:text-rose-200">Ссылка недействительна или устарела.</p>
          : items.length === 0 ?
            <p className="mt-4 text-sm text-muted dark:text-white/55">
              На эту неделю руководитель ещё не добавил задач. Когда появятся — они отобразятся здесь автоматически.
            </p>
          : (
            <ul className="mt-4 space-y-3">
              {items.map((t) => (
                <li key={t.id} className="rounded-xl border border-stroke/70 bg-black/[0.02] p-3 dark:border-white/[0.08] dark:bg-white/[0.03]">
                  <div className="text-[15px] font-semibold text-zinc-900 dark:text-white">{t.title}</div>
                  {t.description?.trim() ?
                    <div className="mt-1 text-[13px] leading-relaxed text-muted dark:text-white/50">{t.description}</div>
                  : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {([0, 1, 2] as const).map((s) => (
                      <Button
                        key={s}
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={patchDay.isPending}
                        className={cn(
                          'min-w-[5.5rem]',
                          Number(t.score) === s && 'border-accent bg-accent/15 text-accent dark:bg-accent/20',
                        )}
                        onClick={() => {
                          if (Number(t.score) === s) return;
                          patchDay.mutate({ taskId: t.id, score: s });
                        }}
                      >
                        {s === 0 ? 'Нет' : s === 1 ? 'Частично' : 'Сделано'}
                      </Button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
