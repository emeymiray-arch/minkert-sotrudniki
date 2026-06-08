import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { toast } from 'sonner';

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

type CrmClientStatus = 'RED' | 'YELLOW' | 'GREEN' | 'BLUE' | 'BLACK';
type CrmVisitStatus = 'SCHEDULED' | 'ARRIVED' | 'NO_SHOW' | 'RESCHEDULED' | 'CANCELED';

type CrmClient = {
  id: string;
  fullName: string;
  phone: string;
  note: string;
  status: CrmClientStatus;
  warned: boolean;
  totalSpent: number;
  visitsCount: number;
  lastProcedureAt?: string | null;
  recommendedNextAt?: string | null;
  procedures?: Array<{ intervalDays: number; procedureDate: string; service: string }>;
};

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
  urgency: 'overdue' | 'due_soon' | 'ok' | 'unknown';
  requiresRepeatContact: boolean;
};

type CrmAppointment = {
  id: string;
  clientId: string;
  service: string;
  startsAt: string;
  visitStatus: CrmVisitStatus;
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
  byMasters: Array<{ masterId: string | null; masterName: string; procedures: number; revenue: number }>;
};

const STATUS_CYCLE: CrmClientStatus[] = ['RED', 'YELLOW', 'GREEN', 'BLUE', 'BLACK'];
const STATUS_RU: Record<CrmClientStatus, string> = {
  RED: 'Не уведомлена',
  YELLOW: 'Уведомлена',
  GREEN: 'Записана',
  BLUE: 'Пришла',
  BLACK: 'Не пришла',
};
const STATUS_CLASS: Record<CrmClientStatus, string> = {
  RED: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  YELLOW: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  GREEN: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  BLUE: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  BLACK: 'bg-zinc-700/20 text-zinc-700 dark:text-zinc-200',
};

function nextStatus(status: CrmClientStatus): CrmClientStatus {
  const idx = STATUS_CYCLE.indexOf(status);
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]!;
}

function money(n: number) {
  return n.toLocaleString('en-US');
}

function intervalLabel(row: CrmIntervalRow) {
  if (row.daysUntilNext === null) return 'Интервал не задан';
  if (row.daysUntilNext < 0) return `Просрочено на ${Math.abs(row.daysUntilNext)} дн.`;
  if (row.daysUntilNext === 0) return 'Сегодня';
  return `Через ${row.daysUntilNext} дн.`;
}

const URGENCY_CLASS: Record<CrmIntervalRow['urgency'], string> = {
  overdue: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  due_soon: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  ok: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  unknown: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300',
};

export default function CrmPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const isMaster = user?.role === 'MANAGER';
  const qc = useQueryClient();
  const [tab, setTab] = React.useState('clients');
  const [q, setQ] = React.useState('');
  const [intervalQ, setIntervalQ] = React.useState('');
  const [unifiedSearch, setUnifiedSearch] = React.useState('');
  const dq = useDebouncedValue(q, 350);
  const dIntervalQ = useDebouncedValue(intervalQ, 350);
  const [fullName, setFullName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [service, setService] = React.useState('');
  const [startsAt, setStartsAt] = React.useState('');
  const [clientId, setClientId] = React.useState('');
  const [procedureClientId, setProcedureClientId] = React.useState('');
  const [procedureDate, setProcedureDate] = React.useState('');
  const [procedureService, setProcedureService] = React.useState('');
  const [procedureCost, setProcedureCost] = React.useState('');
  const [intervalDays, setIntervalDays] = React.useState('');

  const clientsQ = useQuery({
    queryKey: ['crm', 'clients', dq],
    queryFn: () => apiJson<CrmClient[]>(`/crm/clients?q=${encodeURIComponent(dq)}`),
    staleTime: 30_000,
    enabled: !isMaster && (tab === 'clients' || tab === 'appointments'),
  });

  const appointmentsQ = useQuery({
    queryKey: ['crm', 'appointments'],
    queryFn: () => apiJson<CrmAppointment[]>('/crm/appointments'),
    staleTime: 20_000,
    enabled: isMaster || tab === 'appointments',
  });

  const expectedAppointments = React.useMemo(() => {
    const now = new Date().getTime();
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
    queryFn: () => apiJson<Array<{
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

  const createClientMu = useMutation({
    mutationFn: () =>
      apiJson('/crm/clients', {
        method: 'POST',
        body: JSON.stringify({ fullName, phone }),
      }),
    onSuccess: async () => {
      setFullName('');
      setPhone('');
      await qc.invalidateQueries({ queryKey: ['crm', 'clients'] });
      toast.success('Клиент добавлен');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Ошибка'),
  });

  const patchClientMu = useMutation({
    mutationFn: ({ id, status, warned }: { id: string; status?: CrmClientStatus; warned?: boolean }) =>
      apiJson(`/crm/clients/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, warned }),
      }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['crm', 'clients'] }),
        qc.invalidateQueries({ queryKey: ['crm', 'repeat-needed'] }),
        qc.invalidateQueries({ queryKey: ['crm', 'lost'] }),
      ]);
    },
  });

  const createAppointmentMu = useMutation({
    mutationFn: () =>
      apiJson('/crm/appointments', {
        method: 'POST',
        body: JSON.stringify({ clientId, service, startsAt }),
      }),
    onSuccess: async () => {
      setService('');
      setStartsAt('');
      await qc.invalidateQueries({ queryKey: ['crm', 'appointments'] });
      toast.success('Запись создана');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Ошибка'),
  });

  const setVisitStatusMu = useMutation({
    mutationFn: ({ id, visitStatus }: { id: string; visitStatus: CrmVisitStatus }) =>
      apiJson(`/crm/appointments/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ visitStatus }),
      }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['crm', 'appointments'] }),
        qc.invalidateQueries({ queryKey: ['crm', 'clients'] }),
        qc.invalidateQueries({ queryKey: ['crm', 'analytics'] }),
      ]);
    },
  });

  const addProcedureMu = useMutation({
    mutationFn: () =>
      apiJson(`/crm/clients/${procedureClientId}/procedures`, {
        method: 'POST',
        body: JSON.stringify({
          procedureDate,
          service: procedureService,
          cost: Number(procedureCost || 0),
          intervalDays: Number(intervalDays || 0),
        }),
      }),
    onSuccess: async () => {
      setProcedureDate('');
      setProcedureService('');
      setProcedureCost('');
      setIntervalDays('');
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['crm', 'clients'] }),
        qc.invalidateQueries({ queryKey: ['crm', 'intervals'] }),
        qc.invalidateQueries({ queryKey: ['crm', 'repeat-needed'] }),
        qc.invalidateQueries({ queryKey: ['crm', 'lost'] }),
        qc.invalidateQueries({ queryKey: ['crm', 'analytics'] }),
      ]);
      toast.success('Процедура добавлена');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Ошибка'),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM"
        description={
          isMaster ?
            'Страница мастера: только ожидаемые клиентки и карточка записи без редактирования.'
          : 'Клиенты, записи, повторы, потерянные клиенты и аналитика. Основной поиск по ФИО.'
        }
      />

      {isMaster ?
        <Card>
          <CardHeader
            title="Ожидаемые клиенты"
            description="Мастер видит время, услугу и информацию, заполненную администратором. Редактирование отключено."
          />
          <div className="space-y-2">
            {appointmentsQ.isLoading ?
              <Skeleton className="h-40" />
            : !expectedAppointments.length ?
              <div className="rounded-xl border border-dashed border-stroke px-4 py-8 text-center text-sm text-muted dark:border-white/[0.08]">
                Ожидаемых записей нет.
              </div>
            : expectedAppointments.map((a) => (
                <div key={a.id} className="rounded-xl border border-stroke p-3 dark:border-white/[0.08]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold">{a.client.fullName}</div>
                      <div className="text-xs text-muted">{a.client.phone || 'Телефон не указан'}</div>
                    </div>
                    <Badge className={STATUS_CLASS[a.client.status]}>{STATUS_RU[a.client.status]}</Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted sm:grid-cols-4">
                    <div>Время: {new Date(a.startsAt).toLocaleString('ru-RU')}</div>
                    <div>Процедура: {a.service}</div>
                    <div>№ процедуры: {a.client.visitsCount + 1}</div>
                    <div>Последняя: {a.client.lastProcedureAt?.slice(0, 10) ?? '—'}</div>
                  </div>
                </div>
              ))}
          </div>
        </Card>
      : null}

      {!isMaster ?

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="clients">Клиенты</TabsTrigger>
          <TabsTrigger value="unified">Все клиенты</TabsTrigger>
          <TabsTrigger value="intervals">Интервалы</TabsTrigger>
          <TabsTrigger value="appointments">Записи</TabsTrigger>
          <TabsTrigger value="repeat">Повторный контакт</TabsTrigger>
          <TabsTrigger value="lost">Потерянные</TabsTrigger>
          <TabsTrigger value="analytics">Аналитика</TabsTrigger>
        </TabsList>

        <TabsContent value="clients" className="space-y-4">
          <Card>
            <CardHeader title="Новый клиент" description="ФИО обязательно, номер можно изменить позже." />
            <div className="grid gap-2 sm:grid-cols-3">
              <Input placeholder="ФИО" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              <Input placeholder="Телефон" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <Button
                onClick={() => createClientMu.mutate()}
                disabled={!isAdmin || !fullName.trim() || createClientMu.isPending}
              >
                Добавить
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader title="Клиентская база" description="Поиск приоритетно по ФИО." />
            <Input
              placeholder="Поиск по ФИО (можно несколько слов)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <div className="mt-3 space-y-2">
              {clientsQ.isLoading ?
                <Skeleton className="h-40" />
              : (clientsQ.data ?? []).map((c) => (
                  <div key={c.id} className="rounded-xl border border-stroke p-3 dark:border-white/[0.08]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold">{c.fullName}</div>
                        <div className="text-xs text-muted">{c.phone || 'Телефон не указан'}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={STATUS_CLASS[c.status]}>{STATUS_RU[c.status]}</Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!isAdmin}
                          onClick={() => patchClientMu.mutate({ id: c.id, status: nextStatus(c.status) })}
                        >
                          Сменить статус
                        </Button>
                        <Button
                          size="sm"
                          variant={c.warned ? 'primary' : 'outline'}
                          disabled={!isAdmin}
                          onClick={() => patchClientMu.mutate({ id: c.id, warned: !c.warned })}
                        >
                          {c.warned ? 'Предупреждён' : 'Отметить обзвон'}
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted sm:grid-cols-5">
                      <div>Посещений: {c.visitsCount}</div>
                      <div>Потрачено: {money(c.totalSpent)}</div>
                      <div>Последняя: {c.lastProcedureAt?.slice(0, 10) ?? '—'}</div>
                      <div>Интервал: {c.procedures?.[0]?.intervalDays ? `${c.procedures[0].intervalDays} дн.` : '—'}</div>
                      <div>Следующая: {c.recommendedNextAt?.slice(0, 10) ?? '—'}</div>
                    </div>
                  </div>
                ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="unified" className="space-y-4">
          <Card>
            <CardHeader
              title="CRM + Лояльность"
              description="Объединённый список по телефону. Поиск по ФИО."
            />
            <Input placeholder="Поиск по ФИО" value={unifiedSearch} onChange={(e) => setUnifiedSearch(e.target.value)} />
            <div className="mt-3 space-y-2">
              {unifiedClientsQ.isLoading ?
                <Skeleton className="h-40" />
              : !(unifiedClientsQ.data ?? []).length ?
                <div className="rounded-xl border border-dashed border-stroke px-4 py-8 text-center text-sm text-muted dark:border-white/[0.08]">
                  Клиенты не найдены.
                </div>
              : (unifiedClientsQ.data ?? []).map((c) => (
                  <div key={c.id} className="rounded-xl border border-stroke p-3 dark:border-white/[0.08]">
                    <div className="font-semibold">{c.fullName}</div>
                    <div className="mt-1 text-xs text-muted">
                      {c.phone || 'Телефон не указан'} · визитов: {c.visitsCount}
                      {c.loyalty ? ` · лояльность: ${c.loyalty.stamps} штампов` : ''}
                      {c.crmStatus ? ` · CRM: ${STATUS_RU[c.crmStatus]}` : ' · только лояльность'}
                    </div>
                  </div>
                ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="intervals" className="space-y-4">
          <Card>
            <CardHeader
              title="Контроль интервалов"
              description="Дата следующего визита считается автоматически: дата процедуры + интервал (дни), который задаёт администратор."
            />
            <Input
              placeholder="Найти клиента по ФИО"
              value={intervalQ}
              onChange={(e) => setIntervalQ(e.target.value)}
            />
            <div className="mt-3 space-y-2">
              {intervalsQ.isLoading ?
                <Skeleton className="h-40" />
              : !(intervalsQ.data ?? []).length ?
                <div className="rounded-xl border border-dashed border-stroke px-4 py-8 text-center text-sm text-muted dark:border-white/[0.08]">
                  Клиенты с процедурами не найдены.
                </div>
              : (intervalsQ.data ?? []).map((row) => (
                  <div key={row.id} className="rounded-xl border border-stroke p-3 dark:border-white/[0.08]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold">{row.fullName}</div>
                        <div className="text-xs text-muted">
                          {row.lastService ?? 'Услуга не указана'} · интервал {row.intervalDays ?? '—'} дн.
                        </div>
                      </div>
                      <Badge className={URGENCY_CLASS[row.urgency]}>{intervalLabel(row)}</Badge>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted sm:grid-cols-4">
                      <div>Последняя: {row.lastProcedureAt ?? '—'}</div>
                      <div>Следующая: {row.recommendedNextAt ?? '—'}</div>
                      <div>Телефон: {row.phone || '—'}</div>
                      <div>Статус: {STATUS_RU[row.status]}</div>
                    </div>
                  </div>
                ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="appointments" className="space-y-4">
          <Card>
            <CardHeader title="Создать запись" description="Администратор создаёт запись, мастер видит её в расписании." />
            <div className="grid gap-2 sm:grid-cols-4">
              <select
                className="h-10 rounded-md border border-stroke bg-transparent px-3 text-sm"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              >
                <option value="">Клиент</option>
                {(clientsQ.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.fullName}</option>
                ))}
              </select>
              <Input placeholder="Услуга" value={service} onChange={(e) => setService(e.target.value)} />
              <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
              <Button
                disabled={!isAdmin || !clientId || !service.trim() || !startsAt || createAppointmentMu.isPending}
                onClick={() => createAppointmentMu.mutate()}
              >
                Создать
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader title="Завершить процедуру" description="Администратор обязан вручную указать интервал в днях." />
            <div className="grid gap-2 sm:grid-cols-5">
              <select
                className="h-10 rounded-md border border-stroke bg-transparent px-3 text-sm"
                value={procedureClientId}
                onChange={(e) => setProcedureClientId(e.target.value)}
              >
                <option value="">Клиент</option>
                {(clientsQ.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.fullName}</option>
                ))}
              </select>
              <Input type="date" value={procedureDate} onChange={(e) => setProcedureDate(e.target.value)} />
              <Input placeholder="Услуга" value={procedureService} onChange={(e) => setProcedureService(e.target.value)} />
              <Input placeholder="Стоимость" type="number" value={procedureCost} onChange={(e) => setProcedureCost(e.target.value)} />
              <Input placeholder="Интервал (дни) *" type="number" value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} />
            </div>
            <div className="mt-2">
              <Button
                disabled={
                  !isAdmin ||
                  !procedureClientId ||
                  !procedureDate ||
                  !procedureService.trim() ||
                  !intervalDays ||
                  addProcedureMu.isPending
                }
                onClick={() => addProcedureMu.mutate()}
              >
                Добавить процедуру
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader title="Расписание и посещаемость" description="Отметки: пришла / не пришла / перенесла / отменила." />
            <div className="space-y-2">
              {appointmentsQ.isLoading ?
                <Skeleton className="h-44" />
              : (appointmentsQ.data ?? []).map((a) => (
                  <div key={a.id} className="rounded-xl border border-stroke p-3 dark:border-white/[0.08]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold">{a.client.fullName}</div>
                        <div className="text-xs text-muted">
                          {a.service} · {new Date(a.startsAt).toLocaleString('ru-RU')}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <Button size="sm" variant="outline" disabled={!isAdmin} onClick={() => setVisitStatusMu.mutate({ id: a.id, visitStatus: 'ARRIVED' })}>Пришла</Button>
                        <Button size="sm" variant="outline" disabled={!isAdmin} onClick={() => setVisitStatusMu.mutate({ id: a.id, visitStatus: 'NO_SHOW' })}>Не пришла</Button>
                        <Button size="sm" variant="outline" disabled={!isAdmin} onClick={() => setVisitStatusMu.mutate({ id: a.id, visitStatus: 'RESCHEDULED' })}>Перенесла</Button>
                        <Button size="sm" variant="outline" disabled={!isAdmin} onClick={() => setVisitStatusMu.mutate({ id: a.id, visitStatus: 'CANCELED' })}>Отменила</Button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="repeat">
          <Card>
            <CardHeader
              title="Требуют повторного контакта"
              description="Клиенты с просроченным интервалом или сроком в ближайшие 7 дней."
            />
            <div className="space-y-2">
              {repeatQ.isLoading ?
                <Skeleton className="h-32" />
              : !(repeatQ.data ?? []).length ?
                <div className="rounded-xl border border-dashed border-stroke px-4 py-8 text-center text-sm text-muted dark:border-white/[0.08]">
                  Сейчас никто не требует контакта.
                </div>
              : (repeatQ.data ?? []).map((c) => (
                  <div key={c.id} className="rounded-xl border border-stroke p-3 dark:border-white/[0.08]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-semibold">{c.fullName}</div>
                      <Badge className={URGENCY_CLASS[c.urgency]}>{intervalLabel(c)}</Badge>
                    </div>
                    <div className="text-xs text-muted">
                      Рекомендовано: {c.recommendedNextAt ?? '—'} · интервал {c.intervalDays ?? '—'} дн.
                    </div>
                  </div>
                ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="lost">
          <Card>
            <CardHeader title="Потерянные клиенты" description="Нет посещений >90 дней и нет активной записи." />
            <div className="space-y-2">
              {lostQ.isLoading ?
                <Skeleton className="h-32" />
              : (lostQ.data ?? []).map((c) => (
                  <div key={c.id} className="rounded-xl border border-stroke p-3 dark:border-white/[0.08]">
                    <div className="font-semibold">{c.fullName}</div>
                    <div className="text-xs text-muted">Последняя процедура: {c.lastProcedureAt?.slice(0, 10) ?? '—'}</div>
                  </div>
                ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader title="CRM-аналитика" description="Клиенты, записи, посещаемость, отмены, выручка." />
            {analyticsQ.isLoading || !analyticsQ.data ?
              <Skeleton className="h-48" />
            : <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-stroke p-3">Клиенты: <strong>{analyticsQ.data.clientsTotal}</strong></div>
                <div className="rounded-xl border border-stroke p-3">Новые: <strong>{analyticsQ.data.newClients}</strong></div>
                <div className="rounded-xl border border-stroke p-3">Записи: <strong>{analyticsQ.data.appointmentsTotal}</strong></div>
                <div className="rounded-xl border border-stroke p-3">Посещения: <strong>{analyticsQ.data.arrived}</strong></div>
                <div className="rounded-xl border border-stroke p-3">Отмены: <strong>{analyticsQ.data.canceled}</strong></div>
                <div className="rounded-xl border border-stroke p-3">Неявки: <strong>{analyticsQ.data.noShows}</strong></div>
                <div className="rounded-xl border border-stroke p-3">Выручка/день: <strong>{money(analyticsQ.data.revenue.day)}</strong></div>
                <div className="rounded-xl border border-stroke p-3">Выручка/месяц: <strong>{money(analyticsQ.data.revenue.month)}</strong></div>
              </div>}
          </Card>
        </TabsContent>
      </Tabs>
      : null}
    </div>
  );
}
