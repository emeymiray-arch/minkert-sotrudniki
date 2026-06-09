import { useQuery } from '@tanstack/react-query';
import * as React from 'react';

import { Card, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { apiJson } from '@/lib/http';
import { cn } from '@/lib/utils';

type ScheduleSlot = {
  time: string;
  label: string;
  status: 'free' | 'busy';
  appointment?: {
    id: string;
    startsAt: string;
    service: string;
    clientName: string;
    visitStatus: string;
  };
};

type ScheduleMaster = {
  id: string;
  name: string;
  specialty: string;
  slots: ScheduleSlot[];
};

type ScheduleResponse = {
  date: string;
  dayStart: string;
  dayEnd: string;
  masters: ScheduleMaster[];
  appointments: Array<{
    id: string;
    masterName: string;
    startsAt: string;
    service: string;
    clientName: string;
    clientPhone: string;
    visitStatus: string;
  }>;
};

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
        <CardHeader title="Расписание мастеров" description="Зелёное — свободно, красное — занято. Внизу список всех записей на день." />
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-muted">
            Дата
            <Input type="date" className="mt-1 w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          {data ?
            <span className="text-sm text-muted">
              Окна: {data.dayStart}–{data.dayEnd}
            </span>
          : null}
        </div>
      </Card>

      {scheduleQ.isLoading && !data ?
        <Skeleton className="h-64" />
      : !data?.masters.length ?
        <Card>
          <p className="p-4 text-sm text-muted">Добавьте мастеров в разделе «Мастера», чтобы видеть расписание.</p>
        </Card>
      : <div className="overflow-x-auto rounded-xl border border-stroke dark:border-white/[0.08]">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-stroke bg-black/[0.02] dark:border-white/[0.08]">
                <th className="px-3 py-2 text-left font-semibold">Время</th>
                {data.masters.map((m) => (
                  <th key={m.id} className="border-l border-stroke px-3 py-2 text-left font-semibold dark:border-white/[0.08]">
                    <div>{m.name}</div>
                    {m.specialty ?
                      <div className="text-xs font-normal text-muted">{m.specialty}</div>
                    : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data.masters[0]?.slots ?? []).map((_, rowIdx) => (
                <tr key={rowIdx} className="border-b border-stroke/50 dark:border-white/[0.05]">
                  <td className="px-3 py-2 font-medium tabular-nums">{data.masters[0]!.slots[rowIdx]!.label}</td>
                  {data.masters.map((m) => {
                    const slot = m.slots[rowIdx]!;
                    const busy = slot.status === 'busy';
                    return (
                      <td
                        key={`${m.id}-${rowIdx}`}
                        className={cn(
                          'border-l border-stroke/40 px-2 py-1.5 text-xs dark:border-white/[0.05]',
                          busy ?
                            'bg-rose-500/15 text-rose-900 dark:text-rose-200'
                          : 'bg-emerald-500/10 text-emerald-900 dark:text-emerald-200',
                        )}
                        title={busy ? slot.appointment?.clientName : 'Свободно'}
                      >
                        {busy ?
                          <>
                            <div className="font-semibold">{slot.appointment?.clientName}</div>
                            <div>{slot.appointment?.service}</div>
                          </>
                        : 'Свободно'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }

      {data?.appointments.length ?
        <Card>
          <CardHeader title="Записи на день" description="Время и услуга по каждому мастеру." />
          <div className="space-y-2">
            {data.appointments.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stroke px-3 py-2 dark:border-white/[0.08]"
              >
                <div>
                  <div className="font-medium">{a.clientName}</div>
                  <div className="text-xs text-muted">{a.clientPhone || 'без тел.'}</div>
                </div>
                <div className="text-sm">
                  <span className="font-medium">{a.masterName}</span>
                  <span className="mx-2 text-muted">·</span>
                  {new Date(a.startsAt).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                </div>
                <div className="text-sm font-medium">{a.service}</div>
              </div>
            ))}
          </div>
        </Card>
      : data && !scheduleQ.isLoading ?
        <p className="text-sm text-muted">На выбранный день записей пока нет — все окна свободны.</p>
      : null}
    </div>
  );
}
