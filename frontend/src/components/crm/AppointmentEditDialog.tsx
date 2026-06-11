import { useQuery } from '@tanstack/react-query';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { apiJson } from '@/lib/http';

export type AppointmentEditSource = {
  id: string;
  service: string;
  sequenceNumber: number;
  startsAt: string;
  durationMinutes: number;
  masterId?: string | null;
  salonId?: string;
};

export type AppointmentEditPayload = {
  id: string;
  service: string;
  sequenceNumber: number;
  startsAt: string;
  durationMinutes: number;
  masterId: string;
  salonId: string;
};

type CrmSalon = { id: string; name: string; address: string };
type Master = { id: string; name: string; specialty?: string };

function toDatetimeLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AppointmentEditDialog({
  appointment,
  open,
  pending,
  onOpenChange,
  onSave,
}: {
  appointment: AppointmentEditSource | null;
  open: boolean;
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: AppointmentEditPayload) => void;
}) {
  const [service, setService] = React.useState('');
  const [startsAt, setStartsAt] = React.useState('');
  const [durationMinutes, setDurationMinutes] = React.useState('60');
  const [sequenceNumber, setSequenceNumber] = React.useState('1');
  const [masterId, setMasterId] = React.useState('');
  const [salonId, setSalonId] = React.useState('');

  const workspaceQ = useQuery({
    queryKey: ['crm', 'workspace'],
    queryFn: () => apiJson<{ salons: CrmSalon[]; masters: Master[] }>('/crm/workspace'),
    staleTime: 60_000,
    enabled: open,
  });

  React.useEffect(() => {
    if (!appointment) return;
    setService(appointment.service);
    setStartsAt(toDatetimeLocal(appointment.startsAt));
    setDurationMinutes(String(appointment.durationMinutes || 60));
    setSequenceNumber(String(appointment.sequenceNumber));
    setMasterId(appointment.masterId ?? '');
    setSalonId(appointment.salonId ?? '');
  }, [appointment]);

  React.useEffect(() => {
    if (!workspaceQ.data || !appointment) return;
    if (!salonId && workspaceQ.data.salons[0]) setSalonId(workspaceQ.data.salons[0].id);
    if (!masterId && workspaceQ.data.masters[0]) setMasterId(workspaceQ.data.masters[0].id);
  }, [workspaceQ.data, appointment, salonId, masterId]);

  const durationNum = (() => {
    const n = Math.round(Number(durationMinutes));
    if (!Number.isFinite(n)) return 60;
    return Math.min(480, Math.max(5, n));
  })();

  const slotQ = useQuery({
    queryKey: ['crm', 'slot-edit', appointment?.id, masterId, startsAt, durationNum],
    queryFn: () =>
      apiJson<{ available: boolean; conflictClient: string | null }>(
        `/crm/masters/slot?masterId=${encodeURIComponent(masterId)}&startsAt=${encodeURIComponent(new Date(startsAt).toISOString())}&durationMinutes=${durationNum}&excludeAppointmentId=${encodeURIComponent(appointment!.id)}`,
      ),
    enabled: open && Boolean(masterId && startsAt),
    staleTime: 5_000,
  });

  const slotBlocked = Boolean(slotQ.data && !slotQ.data.available);

  const handleSave = () => {
    if (!appointment || !service.trim() || !startsAt || !masterId || !salonId) return;
    onSave({
      id: appointment.id,
      service: service.trim(),
      sequenceNumber: Math.max(1, Math.round(Number(sequenceNumber) || 1)),
      startsAt: new Date(startsAt).toISOString(),
      durationMinutes: durationNum,
      masterId,
      salonId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogTitle>Изменить запись</DialogTitle>
        <p className="mt-1 text-sm text-muted">Исправьте дату, время, мастера или услугу, если допустили ошибку.</p>
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">Услуга</label>
            <Input value={service} onChange={(e) => setService(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">Начало</label>
              <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">Длительность (мин)</label>
              <Input type="number" min={5} max={480} step={5} value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">Мастер</label>
              <select
                className="h-10 w-full rounded-md border border-stroke bg-transparent px-3 text-sm"
                value={masterId}
                onChange={(e) => setMasterId(e.target.value)}
              >
                {(workspaceQ.data?.masters ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">Салон</label>
              <select
                className="h-10 w-full rounded-md border border-stroke bg-transparent px-3 text-sm"
                value={salonId}
                onChange={(e) => setSalonId(e.target.value)}
              >
                {(workspaceQ.data?.salons ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">Процедура №</label>
            <Input type="number" min={1} value={sequenceNumber} onChange={(e) => setSequenceNumber(e.target.value)} />
          </div>
          {slotBlocked ?
            <div className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-900 dark:text-rose-100">
              Мастер занят в это время{slotQ.data?.conflictClient ? ` (клиент: ${slotQ.data.conflictClient})` : ''}.
            </div>
          : null}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button type="button" disabled={pending || !service.trim() || slotBlocked} onClick={handleSave}>
            Сохранить
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
