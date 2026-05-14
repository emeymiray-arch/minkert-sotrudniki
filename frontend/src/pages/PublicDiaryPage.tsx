import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Circle, X } from 'lucide-react';
import * as React from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { apiJson } from '@/lib/http';
import type { DiaryLineDto, DiaryLineState } from '@/lib/types';
import { cn } from '@/lib/utils';

type Meta = { employeeName: string; today: string };
type DayPayload = { employeeName: string; date: string; lines: DiaryLineDto[] };

export default function PublicDiaryPage() {
  const { token } = useParams<{ token: string }>();
  const qc = useQueryClient();
  const [dayIso, setDayIso] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [lines, setLines] = React.useState<DiaryLineDto[]>([]);

  const meta = useQuery({
    queryKey: ['public-diary-meta', token],
    queryFn: () => apiJson<Meta>(`/public/diary/${encodeURIComponent(token!)}/meta`, { auth: false }),
    enabled: Boolean(token),
  });

  const dayQuery = useQuery({
    queryKey: ['public-diary-day', token, dayIso],
    queryFn: () =>
      apiJson<DayPayload>(`/public/diary/${encodeURIComponent(token!)}/days/${dayIso}`, { auth: false }),
    enabled: Boolean(token) && Boolean(dayIso),
  });

  React.useEffect(() => {
    if (dayQuery.data?.lines) {
      setLines(dayQuery.data.lines.map((l) => ({ ...l })));
    }
  }, [dayQuery.data]);

  const save = useMutation({
    mutationFn: () =>
      apiJson<DayPayload>(`/public/diary/${encodeURIComponent(token!)}/days/${dayIso}`, {
        method: 'PUT',
        auth: false,
        body: JSON.stringify({ lines: lines.map(({ label, state }) => ({ label, state })) }),
      }),
    onSuccess: async (data) => {
      toast.success('Сохранено');
      setLines(data.lines.map((l) => ({ ...l })));
      await qc.invalidateQueries({ queryKey: ['public-diary-day', token, dayIso] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Не сохранилось'),
  });

  if (!token) return null;

  const busy = meta.isLoading || dayQuery.isLoading;

  return (
    <div className="min-h-full bg-[hsl(var(--bg))] bg-ambient px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-lg space-y-4">
        <div className="text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted dark:text-white/45">Дневник</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            {meta.data?.employeeName ?? (meta.isLoading ? '…' : 'Сотрудник')}
          </h1>
          <p className="mt-1 text-[13px] text-muted dark:text-white/50">Без входа: отметьте строки за день и нажмите «Сохранить».</p>
        </div>

        <Card className="p-4 sm:p-5">
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid flex-1 gap-1 text-[12px] font-medium text-zinc-800 dark:text-white/85">
              Дата
              <Input type="date" value={dayIso} onChange={(e) => setDayIso(e.target.value)} className="max-w-[11rem]" />
            </label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDayIso(meta.data?.today ?? new Date().toISOString().slice(0, 10))}
            >
              Сегодня
            </Button>
          </div>

          {busy ?
            <div className="mt-4 space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          : dayQuery.isError ?
            <p className="mt-4 text-sm text-rose-600 dark:text-rose-200">Ссылка недействительна или устарела.</p>
          : (
            <div className="mt-4 space-y-2">
              {lines.map((line, idx) => (
                <div
                  key={line.id || idx}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-stroke/70 bg-black/[0.02] px-2 py-2 dark:border-white/[0.08] dark:bg-white/[0.03]"
                >
                  <Input
                    className="min-w-0 flex-1 border-0 bg-transparent px-2 py-1 text-sm shadow-none focus-visible:ring-0 dark:text-white"
                    placeholder={`Строка ${idx + 1}`}
                    value={line.label}
                    onChange={(e) => {
                      const v = e.target.value;
                      setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, label: v } : x)));
                    }}
                  />
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={cn(
                        'h-9 w-9 p-0',
                        line.state === 'EMPTY' && 'border-zinc-300 bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-700',
                      )}
                      title="Пусто"
                      aria-label="Пусто"
                      onClick={() => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, state: 'EMPTY' as DiaryLineState } : x)))}
                    >
                      <Circle className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={cn(
                        'h-9 w-9 p-0',
                        line.state === 'CHECK' && 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white',
                      )}
                      title="Сделано"
                      aria-label="Сделано"
                      onClick={() =>
                        setLines((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, state: x.state === 'CHECK' ? ('EMPTY' as const) : ('CHECK' as const) } : x)),
                        )
                      }
                    >
                      <Check className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={cn(
                        'h-9 w-9 p-0',
                        line.state === 'CROSS' && 'border-rose-600 bg-rose-600 text-white hover:bg-rose-700 hover:text-white',
                      )}
                      title="Не сделано"
                      aria-label="Не сделано"
                      onClick={() =>
                        setLines((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, state: x.state === 'CROSS' ? ('EMPTY' as const) : ('CROSS' as const) } : x)),
                        )
                      }
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button type="button" className="mt-2 w-full" disabled={save.isPending} onClick={() => save.mutate()}>
                {save.isPending ? 'Сохранение…' : 'Сохранить'}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
