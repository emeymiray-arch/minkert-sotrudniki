import * as React from 'react';

import { AppointmentBookingForm } from '@/components/crm/AppointmentBookingForm';
import {
  type CrmClientStatus,
  type CrmVisitStatus,
  STATUS_CLASS,
  STATUS_RU,
} from '@/components/crm/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { calcProcedurePricing, type ProcedureDiscountInput } from '@/lib/crm-pricing';
import { cn } from '@/lib/utils';

export type VisitAppointment = {
  id: string;
  service: string;
  sequenceNumber: number;
  salonId?: string;
  salonName?: string;
  salonAddress?: string;
  startsAt: string;
  durationMinutes: number;
  visitStatus: CrmVisitStatus;
  interval?: { intervalOk: boolean; message: string };
  master?: { id: string; name: string } | null;
  masterId?: string | null;
};

export type VisitClient = {
  id: string;
  fullName: string;
  phone: string;
  note?: string;
  birthDate?: string | null;
  status: CrmClientStatus;
  visitsCount: number;
  discountPercent?: number;
};

type DiscountMode = ProcedureDiscountInput['mode'];

type ProcedurePayload = {
  procedureDate: string;
  service: string;
  basePrice: number;
  cost: number;
  discountPercent?: number;
  discountAmount?: number;
  finalMainPrice?: number;
  extraService?: string;
  extraCost?: number;
  intervalDays: number;
};

export function ClientVisitCard({
  client,
  appointments,
  canWrite,
  addProcedurePending,
  createAppointmentPending,
  onEditClient,
  onEditAppointment,
  onVisitStatus,
  onDeleteAppointment,
  onAddProcedure,
  onCreateAppointment,
}: {
  client: VisitClient;
  appointments: VisitAppointment[];
  canWrite: boolean;
  addProcedurePending?: boolean;
  createAppointmentPending?: boolean;
  onEditClient: (client: VisitClient) => void;
  onEditAppointment: (appointment: VisitAppointment) => void;
  onVisitStatus: (appointmentId: string, visitStatus: CrmVisitStatus) => void;
  onDeleteAppointment: (appointmentId: string) => void;
  onAddProcedure: (clientId: string, payload: ProcedurePayload) => Promise<unknown>;
  onCreateAppointment: (payload: Parameters<NonNullable<React.ComponentProps<typeof AppointmentBookingForm>['onSubmit']>>[0]) => Promise<unknown>;
}) {
  const [showBooking, setShowBooking] = React.useState(false);
  const [procedureDate, setProcedureDate] = React.useState('');
  const [procedureService, setProcedureService] = React.useState('');
  const [procedureCost, setProcedureCost] = React.useState('');
  const [discountMode, setDiscountMode] = React.useState<DiscountMode>('percent');
  const [discountValue, setDiscountValue] = React.useState(
    client.discountPercent ? String(client.discountPercent) : '',
  );
  const [extraService, setExtraService] = React.useState('');
  const [extraCost, setExtraCost] = React.useState('');
  const [intervalDays, setIntervalDays] = React.useState(() => {
    const next = client.visitsCount + 1;
    return String(next <= 3 ? 25 : 35);
  });

  React.useEffect(() => {
    const next = client.visitsCount + 1;
    setIntervalDays(String(next <= 3 ? 25 : 35));
    if (!discountValue && client.discountPercent) {
      setDiscountValue(String(client.discountPercent));
      setDiscountMode('percent');
    }
  }, [client.visitsCount, client.discountPercent, discountValue]);

  const nextSeq = client.visitsCount + 1;
  const discountInput: ProcedureDiscountInput = (() => {
    const raw = Number(discountValue || 0);
    if (discountMode === 'amount') return { mode: 'amount', discountAmount: raw };
    if (discountMode === 'final') return { mode: 'final', finalMainPrice: raw };
    return { mode: 'percent', discountPercent: raw || client.discountPercent || 0 };
  })();
  const preview = calcProcedurePricing(Number(procedureCost || 0), discountInput, Number(extraCost || 0));

  const resetProcedureForm = () => {
    setProcedureDate('');
    setProcedureService('');
    setProcedureCost('');
    setDiscountMode('percent');
    setDiscountValue(client.discountPercent ? String(client.discountPercent) : '');
    setExtraService('');
    setExtraCost('');
    const next = client.visitsCount + 1;
    setIntervalDays(String(next <= 3 ? 25 : 35));
  };

  const lockedClient = {
    id: client.id,
    fullName: client.fullName,
    phone: client.phone,
    note: client.note ?? '',
    status: client.status,
    warned: false,
    visitsCount: client.visitsCount,
    totalSpent: 0,
    discountPercent: client.discountPercent,
  };

  return (
    <div className="rounded-xl border border-stroke p-4 dark:border-white/[0.08]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">{client.fullName}</div>
          <div className="mt-1 text-sm text-muted">{client.phone || 'Телефон не указан'}</div>
          <div className="mt-1 text-xs text-muted">
            Процедур: {client.visitsCount} · следующая №{nextSeq}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={STATUS_CLASS[client.status]}>{STATUS_RU[client.status]}</Badge>
          {canWrite ?
            <Button size="sm" variant="outline" onClick={() => onEditClient(client)}>
              Изменить клиента
            </Button>
          : null}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted">Записи</div>
        {!appointments.length ?
          <p className="text-sm text-muted">Нет активных записей.</p>
        : appointments.map((a) => (
            <div key={a.id} className="rounded-lg border border-stroke/80 bg-black/[0.02] p-3 dark:border-white/[0.06] dark:bg-white/[0.02]">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase text-muted">Дата и время</div>
                  <div className="font-medium">{new Date(a.startsAt).toLocaleString('ru-RU')}</div>
                  <div className="text-xs text-muted">{a.durationMinutes} мин</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase text-muted">Мастер</div>
                  <div className="font-medium">{a.master?.name ?? '—'}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase text-muted">Процедура №</div>
                  <div className="font-medium">{a.sequenceNumber}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase text-muted">Услуга</div>
                  <div className="font-medium">{a.service}</div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-[10px] font-semibold uppercase text-muted">Салон</div>
                  <div className="font-medium">
                    {a.salonName ?? '—'}
                    {a.salonAddress ? ` · ${a.salonAddress}` : ''}
                  </div>
                </div>
              </div>
              {a.interval && !a.interval.intervalOk ?
                <div className="mt-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">{a.interval.message}</div>
              : null}
              <div className="mt-3 flex flex-wrap gap-1">
                {canWrite ?
                  <Button size="sm" variant="outline" onClick={() => onEditAppointment(a)}>
                    Изменить запись
                  </Button>
                : null}
                <Button size="sm" variant="outline" disabled={!canWrite} onClick={() => onVisitStatus(a.id, 'ARRIVED')}>Пришла</Button>
                <Button size="sm" variant="outline" disabled={!canWrite} onClick={() => onVisitStatus(a.id, 'NO_SHOW')}>Не пришла</Button>
                <Button size="sm" variant="outline" disabled={!canWrite} onClick={() => onVisitStatus(a.id, 'RESCHEDULED')}>Перенесла</Button>
                <Button size="sm" variant="outline" disabled={!canWrite} onClick={() => onVisitStatus(a.id, 'CANCELED')}>Отменила</Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-rose-600 hover:text-rose-700 dark:text-rose-400"
                  disabled={!canWrite}
                  onClick={() => {
                    if (!window.confirm(`Удалить запись на ${new Date(a.startsAt).toLocaleString('ru-RU')}?`)) return;
                    onDeleteAppointment(a.id);
                  }}
                >
                  Удалить
                </Button>
              </div>
            </div>
          ))}
        {canWrite ?
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowBooking((v) => !v)}
          >
            {showBooking ? 'Скрыть форму записи' : appointments.length ? 'Ещё запись' : 'Добавить запись'}
          </Button>
        : null}
        {showBooking && canWrite ?
          <div className="rounded-lg border border-dashed border-stroke p-3 dark:border-white/[0.1]">
            <AppointmentBookingForm
              lockedClient={lockedClient}
              disabled={!canWrite}
              pending={createAppointmentPending}
              onSubmit={async (payload) => {
                await onCreateAppointment(payload);
                setShowBooking(false);
              }}
            />
          </div>
        : null}
      </div>

      <div className={cn('mt-5 border-t border-stroke pt-4 dark:border-white/[0.08]', !canWrite && 'opacity-80')}>
        <div className="text-xs font-semibold uppercase tracking-wider text-muted">Завершить процедуру №{nextSeq}</div>
        <p className="mt-1 text-xs text-muted">Мин. интервал: {nextSeq <= 3 ? '25' : '35'} дн.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Input type="date" value={procedureDate} disabled={!canWrite} onChange={(e) => setProcedureDate(e.target.value)} />
          <Input placeholder="Услуга" value={procedureService} disabled={!canWrite} onChange={(e) => setProcedureService(e.target.value)} />
          <Input placeholder="Цена основной услуги" type="number" value={procedureCost} disabled={!canWrite} onChange={(e) => setProcedureCost(e.target.value)} />
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">Скидка или итог</label>
            <div className="flex flex-wrap gap-2">
              <select
                className="h-10 rounded-md border border-stroke bg-transparent px-3 text-sm"
                value={discountMode}
                disabled={!canWrite}
                onChange={(e) => {
                  setDiscountMode(e.target.value as DiscountMode);
                  setDiscountValue('');
                }}
              >
                <option value="percent">Скидка %</option>
                <option value="amount">Минус ₽</option>
                <option value="final">Итоговая цена</option>
              </select>
              <Input
                className="min-w-[8rem] flex-1"
                type="number"
                min={0}
                placeholder={
                  discountMode === 'percent' ?
                    client.discountPercent ? `напр. ${client.discountPercent}` : '10'
                  : discountMode === 'amount' ?
                    'напр. 500'
                  : 'цена после скидки'
                }
                value={discountValue}
                disabled={!canWrite}
                onChange={(e) => setDiscountValue(e.target.value)}
              />
            </div>
          </div>
          <Input placeholder="Доп. услуга" value={extraService} disabled={!canWrite} onChange={(e) => setExtraService(e.target.value)} />
          <Input placeholder="Цена доп. услуги" type="number" value={extraCost} disabled={!canWrite} onChange={(e) => setExtraCost(e.target.value)} />
          <Input placeholder="Интервал (дни) *" type="number" value={intervalDays} disabled={!canWrite} onChange={(e) => setIntervalDays(e.target.value)} />
        </div>
        {procedureCost ?
          <div className="mt-2 rounded-lg border px-3 py-2 text-sm">
            <span className="text-rose-600 line-through dark:text-rose-400">{preview.basePrice.toLocaleString('ru-RU')} ₽</span>
            {' → '}
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">{preview.finalPrice.toLocaleString('ru-RU')} ₽</span>
            {preview.discountAmount > 0 ?
              <span className="ml-2 text-muted">
                (скидка −{preview.discountAmount.toLocaleString('ru-RU')} ₽
                {preview.discountPercent > 0 ? ` · ${preview.discountPercent}%` : ''})
              </span>
            : null}
            <span className="ml-2 text-muted">· ЗП мастера: {preview.masterSalary.toLocaleString('ru-RU')} ₽</span>
          </div>
        : null}
        <Button
          className="mt-3"
          disabled={!canWrite || !procedureDate || !procedureService.trim() || !intervalDays || addProcedurePending}
          onClick={() => {
            void onAddProcedure(client.id, {
              procedureDate,
              service: procedureService.trim(),
              basePrice: Number(procedureCost || 0),
              cost: Number(procedureCost || 0),
              ...(discountMode === 'percent' && discountValue ?
                { discountPercent: Number(discountValue) }
              : discountMode === 'amount' && discountValue ?
                { discountAmount: Number(discountValue) }
              : discountMode === 'final' && discountValue ?
                { finalMainPrice: Number(discountValue) }
              : {}),
              extraService: extraService.trim() || undefined,
              extraCost: extraCost ? Number(extraCost) : undefined,
              intervalDays: Number(intervalDays || 0),
            }).then(() => resetProcedureForm());
          }}
        >
          {addProcedurePending ? 'Сохранение…' : 'Добавить процедуру'}
        </Button>
      </div>
    </div>
  );
}
