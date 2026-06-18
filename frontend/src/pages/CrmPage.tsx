import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import * as React from 'react';
import { toast } from 'sonner';

import { AppointmentBookingForm } from '@/components/crm/AppointmentBookingForm';
import {
  AppointmentEditDialog,
  type AppointmentEditPayload,
  type AppointmentEditSource,
} from '@/components/crm/AppointmentEditDialog';
import { ClientCard } from '@/components/crm/ClientCard';
import { ClientVisitCard, type VisitAppointment, type VisitClient } from '@/components/crm/ClientVisitCard';
import { ClientEditDialog, type ClientEditPayload } from '@/components/crm/ClientEditDialog';
import { CrmMastersManager } from '@/components/crm/CrmMastersManager';
import { CrmWorkspaceSettings } from '@/components/crm/CrmWorkspaceSettings';
import { MasterScheduleBoard } from '@/components/crm/MasterScheduleBoard';
import {
  type CrmClient,
  type CrmClientStatus,
  type CrmVisitStatus,
  type IntervalCompliance,
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
import { type Paginated, paginatedQuery } from '@/lib/pagination';
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
  durationMinutes: number;
  visitStatus: CrmVisitStatus;
  interval?: IntervalCompliance;
  master?: { id: string; name: string } | null;
  masterId?: string | null;
  client: {
    id: string;
    fullName: string;
    phone: string;
    note?: string;
    birthDate?: string | null;
    status: CrmClientStatus;
    visitsCount: number;
    discountPercent?: number;
    lastProcedureAt?: string | null;
    recommendedNextAt?: string | null;
  };
};

type ClientEditTarget = {
  id: string;
  fullName: string;
  phone?: string;
  note?: string;
  birthDate?: string | null;
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

function PaginationBar({
  page,
  pages,
  total,
  onPage,
}: {
  page: number;
  pages: number;
  total: number;
  onPage: (p: number) => void;
}) {
  if (pages <= 1) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-3 text-sm text-muted">
      <span>
        Страница {page} из {pages} · всего {total}
      </span>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Назад
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Далее
        </Button>
      </div>
    </div>
  );
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
  const [editingClient, setEditingClient] = React.useState<ClientEditTarget | null>(null);
  const [editingAppointment, setEditingAppointment] = React.useState<AppointmentEditSource | null>(null);

  const [clientsPage, setClientsPage] = React.useState(1);
  const [appointmentsPage, setAppointmentsPage] = React.useState(1);
  const [intervalsPage, setIntervalsPage] = React.useState(1);
  const [repeatPage, setRepeatPage] = React.useState(1);
  const [lostPage, setLostPage] = React.useState(1);
  const [unifiedPage, setUnifiedPage] = React.useState(1);

  React.useEffect(() => {
    setClientsPage(1);
  }, [dq]);
  React.useEffect(() => {
    setIntervalsPage(1);
  }, [dIntervalQ]);

  const clientsQ = useQuery({
    queryKey: ['crm', 'clients', dq, clientsPage],
    queryFn: () =>
      apiJson<Paginated<CrmClient>>(
        `/crm/clients?q=${encodeURIComponent(dq)}&${paginatedQuery(clientsPage, 50)}`,
      ),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    enabled: !isMaster && !isViewer && tab === 'clients',
  });

  const appointmentsQ = useQuery({
    queryKey: ['crm', 'appointments', appointmentsPage],
    queryFn: () =>
      apiJson<Paginated<CrmAppointment>>(`/crm/appointments?${paginatedQuery(appointmentsPage, 50)}`),
    staleTime: 20_000,
    placeholderData: keepPreviousData,
    enabled: isMaster || tab === 'appointments',
  });

  const appointmentItems = appointmentsQ.data?.items ?? [];

  const expectedAppointments = React.useMemo(() => {
    const now = Date.now();
    return appointmentItems.filter((a) => new Date(a.startsAt).getTime() >= now);
  }, [appointmentItems]);

  const intervalsQ = useQuery({
    queryKey: ['crm', 'intervals', dIntervalQ, intervalsPage],
    queryFn: () =>
      apiJson<Paginated<CrmIntervalRow>>(
        `/crm/intervals?q=${encodeURIComponent(dIntervalQ)}&${paginatedQuery(intervalsPage, 50)}`,
      ),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    enabled: !isMaster && tab === 'intervals',
  });

  const repeatQ = useQuery({
    queryKey: ['crm', 'repeat-needed', repeatPage],
    queryFn: () =>
      apiJson<Paginated<CrmIntervalRow>>(`/crm/repeat-needed?${paginatedQuery(repeatPage, 50)}`),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    enabled: !isMaster && tab === 'repeat',
  });

  const lostQ = useQuery({
    queryKey: ['crm', 'lost', lostPage],
    queryFn: () =>
      apiJson<Paginated<CrmClient>>(`/crm/lost?days=90&${paginatedQuery(lostPage, 50)}`),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    enabled: !isMaster && tab === 'lost',
  });

  const unifiedClientsQ = useQuery({
    queryKey: ['insights', 'clients-unified', unifiedSearch, unifiedPage],
    queryFn: () =>
      apiJson<
        Paginated<{
          id: string;
          fullName: string;
          phone: string;
          crmStatus: CrmClientStatus | null;
          visitsCount: number;
          loyalty: { id: string; stamps: number; giftAvailable: boolean } | null;
        }>
      >(`/insights/clients/unified?q=${encodeURIComponent(unifiedSearch)}&${paginatedQuery(unifiedPage, 50)}`),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    enabled: !isMaster && tab === 'unified',
  });

  const analyticsQ = useQuery({
    queryKey: ['crm', 'analytics'],
    queryFn: () => apiJson<CrmAnalytics>('/crm/analytics'),
    staleTime: 60_000,
    enabled: !isMaster && tab === 'analytics',
  });

  const invalidateCrmLists = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['crm', 'clients'] }),
      qc.invalidateQueries({ queryKey: ['crm', 'appointments'] }),
      qc.invalidateQueries({ queryKey: ['crm', 'intervals'] }),
      qc.invalidateQueries({ queryKey: ['crm', 'repeat-needed'] }),
      qc.invalidateQueries({ queryKey: ['crm', 'lost'] }),
      qc.invalidateQueries({ queryKey: ['crm', 'schedule'] }),
      qc.invalidateQueries({ queryKey: ['insights', 'clients-unified'] }),
    ]);

  const createClientMu = useMutation({
    mutationFn: () => apiJson('/crm/clients', { method: 'POST', body: JSON.stringify({ fullName, phone }) }),
    onSuccess: async () => {
      setFullName('');
      setPhone('');
      await invalidateCrmLists();
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
      fullName,
      phone,
      note,
      birthDate,
    }: {
      id: string;
      status?: CrmClientStatus;
      warned?: boolean;
      discountPercent?: number;
      fullName?: string;
      phone?: string;
      note?: string;
      birthDate?: string | null;
    }) =>
      apiJson(`/crm/clients/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          warned,
          discountPercent,
          fullName,
          phone,
          note,
          birthDate: birthDate === '' ? null : birthDate,
        }),
      }),
    onSuccess: invalidateCrmLists,
  });

  const deleteClientMu = useMutation({
    mutationFn: (id: string) => apiJson(`/crm/clients/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await invalidateCrmLists();
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
      await invalidateCrmLists();
      toast.success(res.loyaltyCreated ? 'Запись создана · клиент добавлен в лояльность' : 'Запись создана');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Ошибка'),
  });

  const setVisitStatusMu = useMutation({
    mutationFn: ({ id, visitStatus }: { id: string; visitStatus: CrmVisitStatus }) =>
      apiJson(`/crm/appointments/${id}/status`, { method: 'PATCH', body: JSON.stringify({ visitStatus }) }),
    onSuccess: invalidateCrmLists,
  });

  const patchAppointmentMu = useMutation({
    mutationFn: (payload: AppointmentEditPayload) =>
      apiJson(`/crm/appointments/${payload.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          service: payload.service,
          startsAt: payload.startsAt,
          durationMinutes: payload.durationMinutes,
          masterId: payload.masterId,
          salonId: payload.salonId,
          sequenceNumber: payload.sequenceNumber,
        }),
      }),
    onSuccess: async () => {
      await invalidateCrmLists();
      setEditingAppointment(null);
      toast.success('Запись обновлена');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Ошибка'),
  });

  const deleteAppointmentMu = useMutation({
    mutationFn: (id: string) => apiJson(`/crm/appointments/${id}/delete`, { method: 'POST' }),
    onSuccess: async () => {
      await invalidateCrmLists();
      toast.success('Запись удалена');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Ошибка'),
  });

  const addProcedureMu = useMutation({
    mutationFn: ({
      clientId,
      procedureDate,
      service,
      basePrice,
      cost,
      discountPercent,
      discountAmount,
      finalMainPrice,
      extraService,
      extraCost,
      intervalDays,
    }: {
      clientId: string;
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
    }) =>
      apiJson(`/crm/clients/${clientId}/procedures`, {
        method: 'POST',
        body: JSON.stringify({
          procedureDate,
          service,
          basePrice,
          cost,
          discountPercent,
          discountAmount,
          finalMainPrice,
          extraService,
          extraCost,
          intervalDays,
        }),
      }),
    onSuccess: async () => {
      await invalidateCrmLists();
      toast.success('Процедура добавлена');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Ошибка'),
  });

  const clientVisitGroups = React.useMemo(() => {
    const map = new Map<string, { client: VisitClient; appointments: VisitAppointment[] }>();
    for (const a of appointmentItems) {
      const client: VisitClient = {
        id: a.client.id,
        fullName: a.client.fullName,
        phone: a.client.phone,
        note: a.client.note,
        birthDate: a.client.birthDate,
        status: a.client.status,
        visitsCount: a.client.visitsCount,
        discountPercent: a.client.discountPercent,
      };
      const row: VisitAppointment = {
        id: a.id,
        service: a.service,
        sequenceNumber: a.sequenceNumber,
        salonId: a.salonId,
        salonName: a.salonName,
        salonAddress: a.salonAddress,
        startsAt: a.startsAt,
        durationMinutes: a.durationMinutes ?? 60,
        visitStatus: a.visitStatus,
        interval: a.interval,
        master: a.master,
        masterId: a.masterId,
      };
      const group = map.get(client.id);
      if (group) group.appointments.push(row);
      else map.set(client.id, { client, appointments: [row] });
    }
    return Array.from(map.values())
      .map((g) => ({
        ...g,
        appointments: [...g.appointments].sort(
          (x, y) => new Date(x.startsAt).getTime() - new Date(y.startsAt).getTime(),
        ),
      }))
      .sort(
        (a, b) =>
          new Date(a.appointments[0]?.startsAt ?? 0).getTime() -
          new Date(b.appointments[0]?.startsAt ?? 0).getTime(),
      );
  }, [appointmentItems]);

  const saveClientProfile = (payload: ClientEditPayload) => {
    patchClientMu.mutate(
      {
        id: payload.id,
        fullName: payload.fullName,
        phone: payload.phone,
        note: payload.note,
        birthDate: payload.birthDate || null,
      },
      {
        onSuccess: () => {
          setEditingClient(null);
          toast.success('Данные клиента сохранены');
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Ошибка'),
      },
    );
  };

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
      <ClientEditDialog
        client={editingClient}
        open={Boolean(editingClient)}
        pending={patchClientMu.isPending}
        onOpenChange={(open) => {
          if (!open) setEditingClient(null);
        }}
        onSave={saveClientProfile}
      />
      <AppointmentEditDialog
        appointment={editingAppointment}
        open={Boolean(editingAppointment)}
        pending={patchAppointmentMu.isPending}
        onOpenChange={(open) => {
          if (!open) setEditingAppointment(null);
        }}
        onSave={(payload) => patchAppointmentMu.mutate(payload)}
      />
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
                  {a.client.phone?.trim() ?
                    <a
                      href={`tel:${a.client.phone.replace(/[^\d+]/g, '')}`}
                      className="mt-1 inline-block text-sm font-medium text-sky-700 underline-offset-2 hover:underline dark:text-sky-300"
                    >
                      {a.client.phone}
                    </a>
                  : <div className="mt-1 text-sm text-muted">Телефон не указан</div>}
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
                : (clientsQ.data?.items ?? []).map((c) => (
                    <ClientCard
                      key={c.id}
                      client={c}
                      isAdmin={isAdmin}
                      canEdit={canWrite}
                      canEditDiscount={canWrite}
                      onEdit={setEditingClient}
                      deleting={deleteClientMu.isPending}
                      onStatus={(id, status) => patchClientMu.mutate({ id, status: nextStatus(status) })}
                      onWarn={(id, warned) => patchClientMu.mutate({ id, warned })}
                      onDiscount={(id, discountPercent) => patchClientMu.mutate({ id, discountPercent })}
                      onDelete={(id) => deleteClientMu.mutate(id)}
                    />
                  ))}
              </div>
              {clientsQ.data ?
                <PaginationBar
                  page={clientsQ.data.page}
                  pages={clientsQ.data.pages}
                  total={clientsQ.data.total}
                  onPage={setClientsPage}
                />
              : null}
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
                description="Найдите клиента или создайте нового — после сохранения появится карточка с записью и завершением процедуры."
              />
              <AppointmentBookingForm
                disabled={!canWrite}
                pending={createAppointmentMu.isPending}
                onSubmit={(payload) => createAppointmentMu.mutateAsync(payload)}
              />
            </Card>

            <Card>
              <CardHeader title="Клиенты и записи" description="Одна карточка на клиента: записи, статусы и завершение процедуры." />
              <div className="space-y-4">
                {appointmentsQ.isLoading ?
                  <Skeleton className="h-44" />
                : !clientVisitGroups.length ?
                  <p className="text-sm text-muted">Записей пока нет — создайте первую выше.</p>
                : clientVisitGroups.map((group) => (
                    <ClientVisitCard
                      key={group.client.id}
                      client={group.client}
                      appointments={group.appointments}
                      canWrite={canWrite}
                      addProcedurePending={addProcedureMu.isPending}
                      createAppointmentPending={createAppointmentMu.isPending}
                      onEditClient={(c) =>
                        setEditingClient({
                          id: c.id,
                          fullName: c.fullName,
                          phone: c.phone,
                          note: c.note,
                          birthDate: c.birthDate,
                        })
                      }
                      onEditAppointment={(a) =>
                        setEditingAppointment({
                          id: a.id,
                          service: a.service,
                          sequenceNumber: a.sequenceNumber,
                          startsAt: a.startsAt,
                          durationMinutes: a.durationMinutes,
                          masterId: a.masterId,
                          salonId: a.salonId,
                        })
                      }
                      onVisitStatus={(id, visitStatus) => setVisitStatusMu.mutate({ id, visitStatus })}
                      onDeleteAppointment={(id) => deleteAppointmentMu.mutate(id)}
                      onAddProcedure={(clientId, payload) => addProcedureMu.mutateAsync({ clientId, ...payload })}
                      onCreateAppointment={(payload) => createAppointmentMu.mutateAsync(payload)}
                    />
                  ))}
              </div>
              {appointmentsQ.data ?
                <PaginationBar
                  page={appointmentsQ.data.page}
                  pages={appointmentsQ.data.pages}
                  total={appointmentsQ.data.total}
                  onPage={setAppointmentsPage}
                />
              : null}
            </Card>
          </TabsContent>

          <TabsContent value="unified" className="space-y-4">
            <Card>
              <CardHeader title="CRM + Лояльность" />
              <Input placeholder="Поиск по ФИО" value={unifiedSearch} onChange={(e) => setUnifiedSearch(e.target.value)} />
              <div className="mt-3 space-y-2">
                {(unifiedClientsQ.data?.items ?? []).map((c) => (
                  <div key={c.id} className="rounded-xl border p-4">
                    <div className="font-semibold">{c.fullName}</div>
                    <div className="mt-1 text-sm text-muted">
                      {c.phone || '—'} · визитов {c.visitsCount}
                      {c.loyalty ? ` · ${c.loyalty.stamps} штампов` : ''}
                    </div>
                  </div>
                ))}
              </div>
              {unifiedClientsQ.data ?
                <PaginationBar
                  page={unifiedClientsQ.data.page}
                  pages={unifiedClientsQ.data.pages}
                  total={unifiedClientsQ.data.total}
                  onPage={setUnifiedPage}
                />
              : null}
            </Card>
          </TabsContent>

          <TabsContent value="intervals" className="space-y-4">
            <Card>
              <CardHeader title="Контроль интервалов" description="Мин. 25 дн. (1–3 процедура), мин. 35 дн. (с 4-й)." />
              <Input placeholder="ФИО" value={intervalQ} onChange={(e) => setIntervalQ(e.target.value)} />
              <div className="mt-3 space-y-3">
                {(intervalsQ.data?.items ?? []).map((row) => (
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
              {intervalsQ.data ?
                <PaginationBar
                  page={intervalsQ.data.page}
                  pages={intervalsQ.data.pages}
                  total={intervalsQ.data.total}
                  onPage={setIntervalsPage}
                />
              : null}
            </Card>
          </TabsContent>

          <TabsContent value="repeat">
            <Card>
              <CardHeader title="Повторный контакт" />
              <div className="space-y-2">
                {(repeatQ.data?.items ?? []).map((c) => (
                  <div key={c.id} className="rounded-xl border p-3">
                    <div className="font-semibold">{c.fullName}</div>
                    <div className="text-sm text-muted">{c.recommendedNextAt ?? '—'}</div>
                  </div>
                ))}
              </div>
              {repeatQ.data ?
                <PaginationBar
                  page={repeatQ.data.page}
                  pages={repeatQ.data.pages}
                  total={repeatQ.data.total}
                  onPage={setRepeatPage}
                />
              : null}
            </Card>
          </TabsContent>

          <TabsContent value="lost">
            <Card>
              <CardHeader title="Потерянные" />
              <div className="space-y-2">
                {(lostQ.data?.items ?? []).map((c) => (
                  <div key={c.id} className="rounded-xl border p-3">
                    <div className="font-semibold">{c.fullName}</div>
                    <div className="text-sm text-muted">Последняя: {c.lastProcedureAt?.slice(0, 10) ?? '—'}</div>
                  </div>
                ))}
              </div>
              {lostQ.data ?
                <PaginationBar
                  page={lostQ.data.page}
                  pages={lostQ.data.pages}
                  total={lostQ.data.total}
                  onPage={setLostPage}
                />
              : null}
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
