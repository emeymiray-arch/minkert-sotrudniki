import { useQuery } from '@tanstack/react-query';
import * as React from 'react';

import { type CrmVisitStatus } from '@/components/crm/types';
import { Card, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { apiJson } from '@/lib/http';
import { cn } from '@/lib/utils';

type ScheduleAppointment = {
  id: string;
  startsAt: string;
  service: string;
  clientName: string;
  visitStatus: CrmVisitStatus;
};

type ScheduleSlot = {
  time: string;
  label: string;
  status: 'free' | 'busy' | 'canceled' | 'occupied';
  appointment?: ScheduleAppointment;
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
  appointments: ScheduleAppointment[];
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function slotCellText(appt: ScheduleAppointment) {
  const canceled = appt.visitStatus === 'CANCELED';
  const line = `${formatClock(appt.startsAt)} · ${appt.clientName} · ${appt.service}`;
  return canceled ? `Отмена · ${line}` : line;
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
          description="Одна строка на запись: время · клиент · услуга. Зелёное — свободно, красное — занято, серое — отмена."
        />
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
          <p className="p-4 text-sm text-muted">Мастера не добавлены — расписание появится после настройки мастеров.</p>
        </Card>
      : <div className="overflow-x-auto rounded-xl border border-stroke dark:border-white/[0.08]">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-stroke bg-black/[0.02] dark:border-white/[0.08]">
                <th className="w-16 px-2 py-2 text-left font-semibold">Час</th>
                {data.masters.map((m) => (
                  <th key={m.id} className="border-l border-stroke px-2 py-2 text-left font-semibold dark:border-white/[0.08]">
                    {m.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data.masters[0]?.slots ?? []).map((_, rowIdx) => (
                <tr key={rowIdx} className="border-b border-stroke/50 dark:border-white/[0.05]">
                  <td className="px-2 py-1.5 font-medium tabular-nums text-muted">{data.masters[0]!.slots[rowIdx]!.label}</td>
                  {data.masters.map((m) => {
                    const slot = m.slots[rowIdx]!;
                    const appt = slot.appointment;
                    return (
                      <td
                        key={`${m.id}-${rowIdx}`}
                        className={cn(
                          'border-l border-stroke/40 px-2 py-1.5 text-xs leading-snug dark:border-white/[0.05]',
                          slot.status === 'busy' ?
                            'bg-rose-500/15 text-rose-950 dark:text-rose-100'
                          : slot.status === 'canceled' ?
                            'bg-zinc-400/15 text-zinc-700 line-through dark:text-zinc-300'
                          : slot.status === 'occupied' ?
                            'bg-rose-500/8'
                          : 'bg-emerald-500/10 text-emerald-900 dark:text-emerald-200',
                        )}
                      >
                        {appt ?
                          <span className="font-medium">{slotCellText(appt)}</span>
                        : slot.status === 'occupied' ?
                          null
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
    </div>
  );
}
