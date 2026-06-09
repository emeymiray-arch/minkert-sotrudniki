import { useQuery } from '@tanstack/react-query';
import * as React from 'react';

import { type CrmClientStatus } from '@/components/crm/types';
import { STATUS_CLASS, STATUS_RU } from '@/components/crm/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { apiJson } from '@/lib/http';
import { cn } from '@/lib/utils';

type ScheduleAppointment = {
  id: string;
  clientId?: string;
  startsAt: string;
  service: string;
  clientName: string;
  clientPhone?: string;
  clientStatus?: CrmClientStatus;
  clientVisitsCount?: number;
  clientDiscountPercent?: number;
  masterName?: string;
  masterSpecialty?: string;
  visitStatus: string;
  sequenceNumber?: number;
};

type ScheduleSlot = {
  time: string;
  label: string;
  status: 'free' | 'busy';
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

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}

function ScheduleClientCard({ appointment }: { appointment: ScheduleAppointment }) {
  const status = appointment.clientStatus;
  return (
    <div className="rounded-xl border border-stroke bg-white/50 p-4 dark:border-white/[0.08] dark:bg-white/[0.02]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-lg font-semibold text-zinc-900 dark:text-white">{appointment.clientName}</div>
          <div className="mt-0.5 text-sm text-muted">
            {appointment.clientPhone || 'Телефон не указан'}
            {appointment.clientVisitsCount != null ? ` · Визитов: ${appointment.clientVisitsCount}` : ''}
          </div>
        </div>
        {status ?
          <Badge className={STATUS_CLASS[status]}>{STATUS_RU[status]}</Badge>
        : null}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-stroke/80 bg-zinc-50/80 px-3 py-2.5 dark:border-white/[0.08] dark:bg-white/[0.03]">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">Время</div>
          <div className="mt-1 text-[15px] font-semibold tabular-nums">{formatTime(appointment.startsAt)}</div>
        </div>
        <div className="rounded-lg border border-stroke/80 bg-zinc-50/80 px-3 py-2.5 dark:border-white/[0.08] dark:bg-white/[0.03]">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">Мастер</div>
          <div className="mt-1 text-[15px] font-semibold">
            {appointment.masterName ?? '—'}
            {appointment.masterSpecialty ?
              <span className="block text-xs font-normal text-muted">{appointment.masterSpecialty}</span>
            : null}
          </div>
        </div>
        <div className="rounded-lg border border-stroke/80 bg-zinc-50/80 px-3 py-2.5 dark:border-white/[0.08] dark:bg-white/[0.03]">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">Услуга</div>
          <div className="mt-1 text-[15px] font-semibold">{appointment.service}</div>
        </div>
      </div>
    </div>
  );
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
        <CardHeader title="Расписание мастеров" description="Зелёное — свободно, красное — занято. Ниже карточки клиентов с временем, мастером и услугой." />
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
          <table className="w-full min-w-[720px] border-collapse text-sm">
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
                    const appt = slot.appointment;
                    return (
                      <td
                        key={`${m.id}-${rowIdx}`}
                        className={cn(
                          'border-l border-stroke/40 px-2 py-1.5 text-xs dark:border-white/[0.05]',
                          busy ?
                            'bg-rose-500/15 text-rose-900 dark:text-rose-200'
                          : 'bg-emerald-500/10 text-emerald-900 dark:text-emerald-200',
                        )}
                      >
                        {busy && appt ?
                          <>
                            <div className="font-semibold">{appt.clientName}</div>
                            <div className="tabular-nums">{formatTime(appt.startsAt)}</div>
                            <div>{appt.service}</div>
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
          <CardHeader title="Записи на день" description="Карточка клиента, время, мастер и услуга." />
          <div className="space-y-3">
            {data.appointments.map((a) => (
              <ScheduleClientCard key={a.id} appointment={a} />
            ))}
          </div>
        </Card>
      : data && !scheduleQ.isLoading ?
        <p className="text-sm text-muted">На выбранный день записей пока нет — все окна свободны.</p>
      : null}
    </div>
  );
}
