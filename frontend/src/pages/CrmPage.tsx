import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { toast } from 'sonner';

import { AppointmentBookingForm } from '@/components/crm/AppointmentBookingForm';
import { ClientCard } from '@/components/crm/ClientCard';
import { CrmMastersManager } from '@/components/crm/CrmMastersManager';
import { CrmWorkspaceSettings } from '@/components/crm/CrmWorkspaceSettings';
import { MasterScheduleBoard } from '@/components/crm/MasterScheduleBoard';
import {
  type CrmClient,
  type CrmClientStatus,
  type CrmVisitStatus,
  type IntervalCompliance,
  STATUS_CLASS,
  STATUS_RU,
  money,
  nextStatus,
} from '@/components/crm/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { apiJson } from '@/lib/http';
import { useAuth } from '@/context/auth';

type CrmIntervalRow = {
  id: string;
  fullName: string;
  phone: string;
  status: CrmClientStatus;
  warned: boolean;
  lastProcedureAt?: string | null;
  recommendedNextAt?: string | null;
  intervalDays: number | null;
  lastService: string | null;
  daysUntilNext: number | null;
  minIntervalDays: number | null;
  daysSinceLast: number | null;
  urgency: 'overdue' | 'due_soon' | 'ok' | 'unknown';
};

type CrmAppointment = {
  id: string;
  clientId: string;
  service: string;
  sequenceNumber: number;
  salonId: string;
  salonName?: string;
  salonAddress?: string;
  startsAt: string;
  visitStatus: CrmVisitStatus;
  interval?: IntervalCompliance;
  master?: { id: string; name: string } | null;
  client: {
    id: string;
    fullName: string;
    phone: string;
    status: CrmClientStatus;
    visitsCount: number;
    lastProcedureAt?: string | null;
    recommendedNextAt?: string | null;
  };
};

type CrmAnalytics = {
  clientsTotal: number;
  newClients: number;
  appointmentsTotal: number;
  arrived: number;
  canceled: number;
  noShows: number;
  revenue: { day: number; week: number; month: number; year: number };
};

const URGENCY_CLASS_LOCAL: Record<CrmIntervalRow['urgency'], string> = {
  overdue: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  due_soon: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  ok: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  unknown: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300',
};

function intervalLabelLocal(row: { daysUntilNext: number | null }) {
  if (row.daysUntilNext === null) return 'Интервал не задан';
  if (row.daysUntilNext < 0) return `Просрочено на ${Math.abs(row.daysUntilNext)} дн.`;
  if (row.daysUntilNext === 0) return 'Сегодня';
  return `Через ${row.daysUntilNext} дн.`;
}

export default function CrmPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const isManager = user?.role === 'MANAGER';
  const isMaster = user?.role === 'MASTER';
  const isViewer = user?.role === 'VIEWER';
  const canWrite = isAdmin || isManager;
  const qc = useQueryClient();
  const [tab, setTab] = React.useState('clients');
  const [q, setQ] = React.useState('');
  const [intervalQ, setIntervalQ] = React.useState('');
  const [unifiedSearch, setUnifiedSearch] = React.useState('');
  const dq = useDebouncedValue(q, 350);
  const dIntervalQ = useDebouncedValue(intervalQ, 350);
  const [fullName, setFullName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [procedureClientId, setProcedureClientId] = React.useState('');
  const [procedureDate, setProcedureDate] = React.useState('');
  const [procedureService, setProcedureService] = React.useState('');
  const [procedureCost, setProcedureCost] = React.useState('');
  const [procedureDiscount, setProcedureDiscount] = React.useState('');
  const [extraService, setExtraService] = React.useState('');
  const [extraCost, setExtraCost] = React.useState('');
  const [intervalDays, setIntervalDays] = React.useState('');
  const [procedureSearch, setProcedureSearch] = React.useState('');
  const dProcedureSearch = useDebouncedValue(procedureSearch, 300);

  const clientsQ = useQuery({
    queryKey: ['crm', 'clients', dq],
    queryFn: () => apiJson<CrmClient[]>(`/crm/clients?q=${encodeURIComponent(dq)}`),
    staleTime: 30_000,
    enabled: !isMaster && (tab === 'clients' || tab === 'appointments'),
  });

  const procedureClientsQ = useQuery({
    queryKey: ['crm', 'procedure-picker', dProcedureSearch],
    queryFn: () => apiJson<CrmClient[]>(`/crm/clients?q=${encodeURIComponent(dProcedureSearch)}`),
    enabled: !isMaster && tab === 'appointments' && dProcedureSearch.trim().length > 0,
    staleTime: 20_000,
  });

  const appointmentsQ = useQuery({
    queryKey: ['crm', 'appointments'],
    queryFn: () => apiJson<CrmAppointment[]>('/crm/appointments'),
    staleTime: 20_000,
    enabled: isMaster || tab === 'appointments',
  });

  const expectedAppointments = React.useMemo(() => {
    const now = Date.now();
    return (appointmentsQ.data ?? []).filter((a) => new Date(a.startsAt).getTime() >= now);
  }, [appointmentsQ.data]);

  const intervalsQ = useQuery({
    queryKey: ['crm', 'intervals', dIntervalQ],
    queryFn: () => apiJson<CrmIntervalRow[]>(`/crm/intervals?q=${encodeURIComponent(dIntervalQ)}`),
    staleTime: 60_000,
    enabled: !isMaster && tab === 'intervals',
  });

  const repeatQ = useQuery({
    queryKey: ['crm', 'repeat-needed'],
    queryFn: () => apiJson<CrmIntervalRow[]>('/crm/repeat-needed'),
    staleTime: 60_000,
    enabled: !isMaster && tab === 'repeat',
  });

  const lostQ = useQuery({
    queryKey: ['crm', 'lost'],
    queryFn: () => apiJson<CrmClient[]>('/crm/lost?days=90'),
    staleTime: 60_000,
    enabled: !isMaster && tab === 'lost',
  });

  const unifiedClientsQ = useQuery({
    queryKey: ['insights', 'clients-unified', unifiedSearch],
    queryFn: () =>
      apiJson<Array<{
        id: string;
        fullName: string;
        phone: string;
        crmStatus: CrmClientStatus | null;
        visitsCount: number;
        loyalty: { id: string; stamps: number; giftAvailable: boolean } | null;
      }>>(`/insights/clients/unified?q=${encodeURIComponent(unifiedSearch)}`),
    staleTime: 60_000,
    enabled: !isMaster && tab === 'unified',
  });

  const analyticsQ = useQuery({
    queryKey: ['crm', 'analytics'],
    queryFn: () => apiJson<CrmAnalytics>('/crm/analytics'),
    staleTime: 60_000,
    enabled: !isMaster && tab === 'analytics',
  });

  const invalidateCrm = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['crm'] }),
      qc.invalidateQueries({ queryKey: ['insights', 'clients-unified'] }),
    ]);

  const createClientMu = useMutation({
    mutationFn: () => apiJson('/crm/clients', { method: 'POST', body: JSON.stringify({ fullName, phone }) }),
    onSuccess: async () => {
      setFullName('');
      setPhone('');
      await invalidateCrm();
      toast.success('Клиент добавлен');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Ошибка'),
  });

  const patchClientMu = useMutation({
    mutationFn: ({
      id,
      status,
      warned,
      discountPercent,
    }: {
      id: string;
      status?: CrmClientStatus;
      warned?: boolean;
      discountPercent?: number;
    }) => apiJson(`/crm/clients/${id}`, { method: 'PATCH', body: JSON.stringify({ status, warned, discountPercent }) }),
    onSuccess: invalidateCrm,
  });

  const deleteClientMu = useMutation({
    mutationFn: (id: string) => apiJson(`/crm/clients/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await invalidateCrm();
      toast.success('Клиент удалён');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Ошибка'),
  });

  const createAppointmentMu = useMutation({
    mutationFn: (payload: {
      clientId?: string;
      newClient?: { fullName: string; phone?: string };
      masterId: string;
      salonId: string;
      service: string;
      startsAt: string;
      durationMinutes: number;
      sequenceNumber: number;
      forceInterval?: boolean;
    }) => apiJson<{ loyaltyCreated?: boolean }>('/crm/appointments', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: async (res) => {
      await invalidateCrm();
      toast.success(res.loyaltyCreated ? 'Запись создана · клиент добавлен в лояльность' : 'Запись создана');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Ошибка'),
  });

  const setVisitStatusMu = useMutation({
    mutationFn: ({ id, visitStatus }: { id: string; visitStatus: CrmVisitStatus }) =>
      apiJson(`/crm/appointments/${id}/status`, { method: 'PATCH', body: JSON.stringify({ visitStatus }) }),
    onSuccess: invalidateCrm,
  });

  const addProcedureMu = useMutation({
    mutationFn: () =>
      apiJson(`/crm/clients/${procedureClientId}/procedures`, {
        method: 'POST',
        body: JSON.stringify({
          procedureDate,
          service: procedureService,
          basePrice: Number(procedureCost || 0),
          cost: Number(procedureCost || 0),
          discountPercent: procedureDiscount ? Number(procedureDiscount) : undefined,
          extraService: extraService.trim() || undefined,
          extraCost: extraCost ? Number(extraCost) : undefined,
          intervalDays: Number(intervalDays || 0),
        }),
      }),
    onSuccess: async () => {
      setProcedureDate('');
      setProcedureService('');
      setProcedureCost('');
      setProcedureDiscount('');
      setExtraService('');
      setExtraCost('');
      setIntervalDays('');
      setProcedureClientId('');
      setProcedureSearch('');
      await invalidateCrm();
      toast.success('Процедура добавлена');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Ошибка'),
  });

  const selectedProcedureClient = (procedureClientsQ.data ?? []).find((c) => c.id === procedureClientId);

  const procedurePreview = React.useMemo(() => {
    const base = Number(procedureCost || 0);
    const pct = Math.min(100, Math.max(0, Number(procedureDiscount || selectedProcedureClient?.discountPercent || 0)));
    const extra = Number(extraCost || 0);
    const discountAmount = Math.round((base * pct) / 100);
    const finalMain = base - discountAmount;
    const finalPrice = finalMain + extra;
    const masterSalary = Math.round(base * 0.18) + extra;
    return { base, pct, discountAmount, finalPrice, masterSalary };
  }, [procedureCost, procedureDiscount, extraCost, selectedProcedureClient?.discountPercent]);

  if (isViewer) {
    return (
      <div className="space-y-6">
        <PageHeader title="Расписание" description="Записи на день: карточка клиента, время, мастер и услуга." />
        <MasterScheduleBoard />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM"
        description={
          isMaster ?
            'Ожидаемые клиенты — только просмотр.'
          : 'Клиенты, записи с поиском по ФИО, контроль интервалов 25/35 дней.'
        }
      />

      {isMaster ?
        <Card>
          <CardHeader title="Ожидаемые клиенты" />
          <div className="space-y-3">
            {appointmentsQ.isLoading ?
              <Skeleton className="h-40" />
            : !expectedAppointments.length ?
              <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted">Ожидаемых записей нет.</div>
            : expectedAppointments.map((a) => (
                <div key={a.id} className="rounded-xl border border-stroke p-4 dark:border-white/[0.08]">
                  <div className="text-lg font-semibold">{a.client.fullName}</div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div><span className="text-xs uppercase text-muted">Время</span><div className="font-medium">{new Date(a.startsAt).toLocaleString('ru-RU')}</div></div>
                    <div><span className="text-xs uppercase text-muted">Мастер</span><div className="font-medium">{a.master?.name ?? '—'}</div></div>
                    <div><span className="text-xs uppercase text-muted">Процедура №</span><div className="font-medium">{a.sequenceNumber}</div></div>
                    <div><span className="text-xs uppercase text-muted">Услуга</span><div className="font-medium">{a.service}</div></div>
                    <div className="sm:col-span-2"><span className="text-xs uppercase text-muted">Салон</span><div className="font-medium">{a.salonName ?? '—'}{a.salonAddress ? ` · ${a.salonAddress}` : ''}</div></div>
                  </div>
                </div>
              ))}
          </div>
        </Card>
      : null}

      {!isMaster ?
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="clients">Клиенты</TabsTrigger>
            <TabsTrigger value="appointments">Записи</TabsTrigger>
            {canWrite ?
              <>
                <TabsTrigger value="schedule">Расписание</TabsTrigger>
                <TabsTrigger value="masters">Мастера</TabsTrigger>
              </>
            : null}
            <TabsTrigger value="unified">Все клиенты</TabsTrigger>
            <TabsTrigger value="intervals">Интервалы</TabsTrigger>
            <TabsTrigger value="repeat">Повтор</TabsTrigger>
            <TabsTrigger value="lost">Потерянные</TabsTrigger>
            <TabsTrigger value="analytics">Аналитика</TabsTrigger>
          </TabsList>

          <TabsContent value="clients" className="space-y-4">
            <Card>
              <CardHeader title="Новый клиент" description="ФИО обязательно." />
              <div className="grid gap-2 sm:grid-cols-3">
                <Input placeholder="ФИО" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                <Input placeholder="Телефон" value={phone} onChange={(e) => setPhone(e.target.value)} />
                <Button onClick={() => createClientMu.mutate()} disabled={!canWrite || !fullName.trim() || createClientMu.isPending}>
                  Добавить
                </Button>
              </div>
            </Card>
            <Card>
              <CardHeader title="Клиентская база" />
              <Input placeholder="Поиск по ФИО" value={q} onChange={(e) => setQ(e.target.value)} />
              <div className="mt-3 space-y-3">
                {clientsQ.isLoading ?
                  <Skeleton className="h-40" />
                : (clientsQ.data ?? []).map((c) => (
                    <ClientCard
                      key={c.id}
                      client={c}
                      isAdmin={isAdmin}
                      canEditDiscount={canWrite}
                      deleting={deleteClientMu.isPending}
                      onStatus={(id, status) => patchClientMu.mutate({ id, status: nextStatus(status) })}
                      onWarn={(id, warned) => patchClientMu.mutate({ id, warned })}
                      onDiscount={(id, discountPercent) => patchClientMu.mutate({ id, discountPercent })}
                      onDelete={(id) => deleteClientMu.mutate(id)}
                    />
                  ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="schedule" className="space-y-4">
            {canWrite ? <MasterScheduleBoard /> : null}
          </TabsContent>

          <TabsContent value="masters" className="space-y-4">
            {canWrite ?
              <>
                {isAdmin ? <CrmWorkspaceSettings disabled={!isAdmin} /> : null}
                <CrmMastersManager disabled={!canWrite} />
              </>
            : null}
          </TabsContent>

          <TabsContent value="appointments" className="space-y-4">

            <Card>
              <CardHeader
                title="Новая запись"
                description="Поиск по ФИО или новый клиент. Укажите номер процедуры — система проверит интервал 25/35 дней."
              />
              <AppointmentBookingForm
                disabled={!canWrite}
                pending={createAppointmentMu.isPending}
                onSubmit={(payload) => createAppointmentMu.mutate(payload)}
              />
            </Card>

            <Card>
              <CardHeader title="Завершить процедуру" description="Интервал вручную: мин. 25 дн. (1–3), мин. 35 дн. (с 4-й)." />
              <div className="space-y-3">
                <Input
                  placeholder="Найти клиента по ФИО"
                  value={procedureSearch}
                  onChange={(e) => setProcedureSearch(e.target.value)}
                />
                {(procedureClientsQ.data ?? []).length > 0 && !procedureClientId ?
                  <div className="max-h-40 overflow-y-auto rounded-lg border">
                    {(procedureClientsQ.data ?? []).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="block w-full border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-black/[0.03]"
                        onClick={() => {
                          setProcedureClientId(c.id);
                          setProcedureSearch(c.fullName);
                          const next = c.visitsCount + 1;
                          setIntervalDays(String(next <= 3 ? 25 : 35));
                          setProcedureDiscount(c.discountPercent ? String(c.discountPercent) : '');
                        }}
                      >
                        <span className="font-medium">{c.fullName}</span>
                        <span className="ml-2 text-muted">№{c.visitsCount + 1} · {c.phone || 'без тел.'}</span>
                      </button>
                    ))}
                  </div>
                : null}
                {selectedProcedureClient ?
                  <div className="rounded-lg bg-zinc-100 px-3 py-2 text-sm dark:bg-white/[0.06]">
                    {selectedProcedureClient.fullName} — процедура №{selectedProcedureClient.visitsCount + 1}
                  </div>
                : null}
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <Input type="date" value={procedureDate} onChange={(e) => setProcedureDate(e.target.value)} />
                  <Input placeholder="Услуга" value={procedureService} onChange={(e) => setProcedureService(e.target.value)} />
                  <Input placeholder="Цена основной услуги" type="number" value={procedureCost} onChange={(e) => setProcedureCost(e.target.value)} />
                  <Input
                    placeholder={`Скидка %${selectedProcedureClient?.discountPercent ? ` (клиент ${selectedProcedureClient.discountPercent}%)` : ''}`}
                    type="number"
                    value={procedureDiscount}
                    onChange={(e) => setProcedureDiscount(e.target.value)}
                  />
                  <Input placeholder="Доп. услуга" value={extraService} onChange={(e) => setExtraService(e.target.value)} />
                  <Input placeholder="Цена доп. услуги" type="number" value={extraCost} onChange={(e) => setExtraCost(e.target.value)} />
                  <Input placeholder="Интервал (дни) *" type="number" value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} />
                </div>
                {procedureCost ?
                  <div className="rounded-lg border px-3 py-2 text-sm">
                    <span className="text-rose-600 line-through dark:text-rose-400">{procedurePreview.base.toLocaleString('ru-RU')} ₽</span>
                    {' → '}
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                      {procedurePreview.finalPrice.toLocaleString('ru-RU')} ₽
                    </span>
                    {procedurePreview.pct > 0 ?
                      <span className="ml-2 text-muted">(скидка {procedurePreview.pct}% = −{procedurePreview.discountAmount} ₽)</span>
                    : null}
                    <span className="ml-2 text-muted">· ЗП мастера: {procedurePreview.masterSalary.toLocaleString('ru-RU')} ₽</span>
                  </div>
                : null}
                <Button
                  disabled={!canWrite || !procedureClientId || !procedureDate || !procedureService.trim() || !intervalDays || addProcedureMu.isPending}
                  onClick={() => addProcedureMu.mutate()}
                >
                  Добавить процедуру
                </Button>
              </div>
            </Card>

            <Card>
              <CardHeader title="Расписание" />
              <div className="space-y-3">
                {appointmentsQ.isLoading ?
                  <Skeleton className="h-44" />
                : (appointmentsQ.data ?? []).map((a) => (
                    <div key={a.id} className="rounded-xl border border-stroke p-4 dark:border-white/[0.08]">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-lg font-semibold">{a.client.fullName}</div>
                          <div className="mt-1 text-sm text-muted">{a.client.phone || 'Телефон не указан'}</div>
                        </div>
                        <Badge className={STATUS_CLASS[a.client.status]}>{STATUS_RU[a.client.status]}</Badge>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        <div><div className="text-[10px] font-semibold uppercase text-muted">Дата</div><div className="font-medium">{new Date(a.startsAt).toLocaleString('ru-RU')}</div></div>
                        <div><div className="text-[10px] font-semibold uppercase text-muted">Мастер</div><div className="font-medium">{a.master?.name ?? '—'}</div></div>
                        <div><div className="text-[10px] font-semibold uppercase text-muted">Процедура №</div><div className="font-medium">{a.sequenceNumber}</div></div>
                        <div><div className="text-[10px] font-semibold uppercase text-muted">Услуга</div><div className="font-medium">{a.service}</div></div>
                        <div className="sm:col-span-2"><div className="text-[10px] font-semibold uppercase text-muted">Салон</div><div className="font-medium">{a.salonName ?? '—'}{a.salonAddress ? ` · ${a.salonAddress}` : ''}</div></div>
                      </div>
                      {a.interval && !a.interval.intervalOk ?
                        <div className="mt-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">{a.interval.message}</div>
                      : null}
                      <div className="mt-3 flex flex-wrap gap-1">
                        <Button size="sm" variant="outline" disabled={!canWrite} onClick={() => setVisitStatusMu.mutate({ id: a.id, visitStatus: 'ARRIVED' })}>Пришла</Button>
                        <Button size="sm" variant="outline" disabled={!canWrite} onClick={() => setVisitStatusMu.mutate({ id: a.id, visitStatus: 'NO_SHOW' })}>Не пришла</Button>
                        <Button size="sm" variant="outline" disabled={!canWrite} onClick={() => setVisitStatusMu.mutate({ id: a.id, visitStatus: 'RESCHEDULED' })}>Перенесла</Button>
                        <Button size="sm" variant="outline" disabled={!canWrite} onClick={() => setVisitStatusMu.mutate({ id: a.id, visitStatus: 'CANCELED' })}>Отменила</Button>
                      </div>
                    </div>
                  ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="unified" className="space-y-4">
            <Card>
              <CardHeader title="CRM + Лояльность" />
              <Input placeholder="Поиск по ФИО" value={unifiedSearch} onChange={(e) => setUnifiedSearch(e.target.value)} />
              <div className="mt-3 space-y-2">
                {(unifiedClientsQ.data ?? []).map((c) => (
                  <div key={c.id} className="rounded-xl border p-4">
                    <div className="font-semibold">{c.fullName}</div>
                    <div className="mt-1 text-sm text-muted">
                      {c.phone || '—'} · визитов {c.visitsCount}
                      {c.loyalty ? ` · ${c.loyalty.stamps} штампов` : ''}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="intervals" className="space-y-4">
            <Card>
              <CardHeader title="Контроль интервалов" description="Мин. 25 дн. (1–3 процедура), мин. 35 дн. (с 4-й)." />
              <Input placeholder="ФИО" value={intervalQ} onChange={(e) => setIntervalQ(e.target.value)} />
              <div className="mt-3 space-y-3">
                {(intervalsQ.data ?? []).map((row) => (
                  <div key={row.id} className="rounded-xl border p-4">
                    <div className="flex justify-between gap-2">
                      <div className="font-semibold">{row.fullName}</div>
                      <Badge className={URGENCY_CLASS_LOCAL[row.urgency]}>{intervalLabelLocal(row)}</Badge>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3 text-sm">
                      <div>Последняя: {row.lastProcedureAt ?? '—'}</div>
                      <div>Следующая: {row.recommendedNextAt ?? '—'}</div>
                      <div>Мин. интервал: {row.minIntervalDays ?? '—'} дн.</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="repeat">
            <Card>
              <CardHeader title="Повторный контакт" />
              <div className="space-y-2">
                {(repeatQ.data ?? []).map((c) => (
                  <div key={c.id} className="rounded-xl border p-3">
                    <div className="font-semibold">{c.fullName}</div>
                    <div className="text-sm text-muted">{c.recommendedNextAt ?? '—'}</div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="lost">
            <Card>
              <CardHeader title="Потерянные" />
              <div className="space-y-2">
                {(lostQ.data ?? []).map((c) => (
                  <div key={c.id} className="rounded-xl border p-3">
                    <div className="font-semibold">{c.fullName}</div>
                    <div className="text-sm text-muted">Последняя: {c.lastProcedureAt?.slice(0, 10) ?? '—'}</div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="analytics">
            <Card>
              <CardHeader title="Аналитика" />
              {analyticsQ.data ?
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border p-3">Клиенты: <strong>{analyticsQ.data.clientsTotal}</strong></div>
                  <div className="rounded-xl border p-3">Новые: <strong>{analyticsQ.data.newClients}</strong></div>
                  <div className="rounded-xl border p-3">Записи: <strong>{analyticsQ.data.appointmentsTotal}</strong></div>
                  <div className="rounded-xl border p-3">Выручка/мес: <strong>{money(analyticsQ.data.revenue.month)}</strong></div>
                </div>
              : <Skeleton className="h-48" />}
            </Card>
          </TabsContent>
        </Tabs>
      : null}
    </div>
  );
}
