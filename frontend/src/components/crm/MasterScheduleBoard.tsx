import { useQuery } from '@tanstack/react-query';
import * as React from 'react';

import { type CrmVisitStatus } from '@/components/crm/types';
import { Card, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { apiJson } from '@/lib/http';
import { cn } from '@/lib/utils';

type ScheduleItem = {
  id: string;
  startsAt: string;
  endsAt: string;
  timeLabel: string;
  durationMinutes: number;
  service: string;
  clientName: string;
  clientPhone?: string;
  visitStatus: CrmVisitStatus;
  canceled: boolean;
};

type ScheduleMaster = {
  id: string;
  name: string;
  specialty: string;
  items: ScheduleItem[];
};

type ScheduleResponse = {
  date: string;
  dayStart: string;
  dayEnd: string;
  masters: ScheduleMaster[];
};

function phoneHref(phone: string) {
  const digits = phone.replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : undefined;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function MasterScheduleBoard() {
  const [date, setDate] = React.useState(todayIso);

  const scheduleQ = useQuery({
    queryKey: ['crm', 'schedule', date],
    queryFn: () => apiJson<ScheduleResponse>(`/crm/schedule?date=${date}`),
    staleTime: 20_000,
  });

  const data = scheduleQ.data;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Расписание мастеров"
          description="Гибкие окна с 9:00: каждая процедура — своё время начала и длительность (например 09:00–09:40 или 09:45–11:00)."
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-muted">
            Дата
            <Input type="date" className="mt-1 w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          {data ?
            <span className="text-sm text-muted">
              Рабочий день: {data.dayStart}–{data.dayEnd}
            </span>
          : null}
        </div>
      </Card>

      {scheduleQ.isLoading && !data ?
        <Skeleton className="h-48" />
      : !data?.masters.length ?
        <Card>
          <p className="p-4 text-sm text-muted">Мастера не добавлены.</p>
        </Card>
      : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {data.masters.map((m) => (
            <Card key={m.id} className="overflow-hidden">
              <div className="border-b border-stroke bg-black/[0.02] px-3 py-2 dark:border-white/[0.08]">
                <div className="font-semibold">{m.name}</div>
                {m.specialty ?
                  <div className="text-xs text-muted">{m.specialty}</div>
                : null}
              </div>
              <div className="space-y-1.5 p-2">
                {!m.items.length ?
                  <p className="px-1 py-4 text-center text-sm text-emerald-700 dark:text-emerald-300">Свободен</p>
                : m.items.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        'rounded-lg px-2.5 py-2 text-sm leading-snug',
                        item.canceled ?
                          'bg-zinc-400/15 text-zinc-700 line-through dark:text-zinc-300'
                        : 'bg-rose-500/12 text-rose-950 dark:text-rose-100',
                      )}
                    >
                      <div className="font-semibold tabular-nums">
                        {item.canceled ? 'Отмена · ' : ''}
                        {item.timeLabel}
                      </div>
                      <div className={cn('font-medium', item.canceled && 'no-underline')}>{item.clientName}</div>
                      {item.clientPhone?.trim() ?
                        <a
                          href={phoneHref(item.clientPhone)}
                          className={cn(
                            'text-xs font-medium tabular-nums underline-offset-2 hover:underline',
                            item.canceled ? 'text-zinc-600 dark:text-zinc-400' : 'text-sky-800 dark:text-sky-200',
                          )}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {item.clientPhone}
                        </a>
                      : <div className="text-xs opacity-70">Телефон не указан</div>}
                      <div className="text-xs opacity-90">{item.service}</div>
                    </div>
                  ))}
              </div>
            </Card>
          ))}
        </div>
      }
    </div>
  );
}
