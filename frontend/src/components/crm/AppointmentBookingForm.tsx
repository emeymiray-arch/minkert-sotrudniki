import { useQuery } from '@tanstack/react-query';
import * as React from 'react';

import type { CrmClient, IntervalCompliance } from '@/components/crm/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { apiJson } from '@/lib/http';

export function AppointmentBookingForm({
  disabled,
  pending,
  onSubmit,
}: {
  disabled?: boolean;
  pending?: boolean;
  onSubmit: (payload: {
    clientId?: string;
    newClient?: { fullName: string; phone?: string };
    service: string;
    startsAt: string;
    sequenceNumber: number;
    forceInterval?: boolean;
  }) => void;
}) {
  const [mode, setMode] = React.useState<'search' | 'new'>('search');
  const [q, setQ] = React.useState('');
  const [selected, setSelected] = React.useState<CrmClient | null>(null);
  const [newName, setNewName] = React.useState('');
  const [newPhone, setNewPhone] = React.useState('');
  const [service, setService] = React.useState('');
  const [startsAt, setStartsAt] = React.useState('');
  const [sequenceNumber, setSequenceNumber] = React.useState('');
  const [forceInterval, setForceInterval] = React.useState(false);
  const dq = useDebouncedValue(q, 300);

  const searchQ = useQuery({
    queryKey: ['crm', 'picker', dq],
    queryFn: () => apiJson<CrmClient[]>(`/crm/clients?q=${encodeURIComponent(dq)}`),
    enabled: mode === 'search' && dq.trim().length >= 1 && !selected,
    staleTime: 20_000,
  });

  const clientId = selected?.id;
  const effectiveSeq = Number(sequenceNumber) || (selected ? selected.visitsCount + 1 : 1);

  const intervalQ = useQuery({
    queryKey: ['crm', 'interval-status', clientId, startsAt],
    queryFn: () =>
      apiJson<IntervalCompliance>(
        `/crm/clients/${clientId}/interval-status?plannedAt=${encodeURIComponent(new Date(startsAt).toISOString())}`,
      ),
    enabled: Boolean(clientId && startsAt),
    staleTime: 10_000,
  });

  React.useEffect(() => {
    if (selected && !sequenceNumber) {
      setSequenceNumber(String(selected.visitsCount + 1));
    }
  }, [selected?.id, selected?.visitsCount, sequenceNumber]);

  const canSubmit =
    !disabled &&
    service.trim() &&
    startsAt &&
    effectiveSeq >= 1 &&
    (mode === 'search' ? Boolean(selected) : newName.trim().length > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant={mode === 'search' ? 'primary' : 'outline'} onClick={() => setMode('search')}>
          Найти по ФИО
        </Button>
        <Button type="button" size="sm" variant={mode === 'new' ? 'primary' : 'outline'} onClick={() => { setMode('new'); setSelected(null); }}>
          Новый клиент
        </Button>
      </div>

      {mode === 'search' ?
        <div className="space-y-2">
          <Input
            placeholder="ФИО — начните вводить"
            value={q}
            disabled={disabled}
            onChange={(e) => {
              setQ(e.target.value);
              if (!e.target.value.trim()) setSelected(null);
            }}
          />
          {searchQ.isFetching ? <div className="text-sm text-muted">Поиск…</div> : null}
          {!selected && (searchQ.data ?? []).length > 0 ?
            <div className="max-h-52 overflow-y-auto rounded-lg border border-stroke dark:border-white/[0.08]">
              {(searchQ.data ?? []).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="flex w-full flex-col gap-0.5 border-b border-stroke px-3 py-3 text-left last:border-0 hover:bg-black/[0.03] dark:border-white/[0.06] dark:hover:bg-white/[0.04]"
                  onClick={() => {
                    setSelected(c);
                    setQ(c.fullName);
                    setSequenceNumber(String(c.visitsCount + 1));
                  }}
                >
                  <span className="font-semibold text-[15px]">{c.fullName}</span>
                  <span className="text-sm text-muted">
                    {c.phone || 'без телефона'} · {c.visitsCount} процедур
                    {c.visitsCount === 0 ? ' · первая → лояльность' : ''}
                  </span>
                </button>
              ))}
            </div>
          : null}
          {selected ?
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
              <div className="font-semibold">{selected.fullName}</div>
              <div className="text-sm text-muted">{selected.phone || 'Телефон не указан'}</div>
              <Button type="button" size="sm" variant="ghost" className="mt-1 h-8" onClick={() => { setSelected(null); setQ(''); setSequenceNumber(''); }}>
                Выбрать другого
              </Button>
            </div>
          : null}
        </div>
      : <div className="grid gap-2 sm:grid-cols-2">
          <Input placeholder="ФИО *" value={newName} disabled={disabled} onChange={(e) => setNewName(e.target.value)} />
          <Input placeholder="Телефон (для лояльности)" value={newPhone} disabled={disabled} onChange={(e) => setNewPhone(e.target.value)} />
        </div>}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">Услуга</label>
          <Input placeholder="Название процедуры" value={service} disabled={disabled} onChange={(e) => setService(e.target.value)} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">Дата и время</label>
          <Input type="datetime-local" value={startsAt} disabled={disabled} onChange={(e) => setStartsAt(e.target.value)} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">Процедура №</label>
          <Input
            type="number"
            min={1}
            placeholder="1"
            value={sequenceNumber}
            disabled={disabled}
            onChange={(e) => setSequenceNumber(e.target.value)}
          />
          <p className="mt-1 text-xs text-muted">
            {effectiveSeq <= 3 ? 'Интервал после: мин. 25 дн.' : 'С 4-й процедуры: мин. 35 дн.'}
          </p>
        </div>
      </div>

      {intervalQ.data ?
        <div
          className={`rounded-lg px-3 py-2.5 text-sm ${
            intervalQ.data.intervalOk ?
              'bg-emerald-500/10 text-emerald-900 dark:text-emerald-100'
            : 'bg-amber-500/10 text-amber-950 dark:text-amber-100'
          }`}
        >
          {intervalQ.data.message}
          {!intervalQ.data.intervalOk ?
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs font-medium">
              <input type="checkbox" checked={forceInterval} onChange={(e) => setForceInterval(e.target.checked)} />
              Записать несмотря на ранний срок
            </label>
          : null}
        </div>
      : selected && mode === 'search' && selected.visitsCount === 0 ?
        <div className="rounded-lg bg-sky-500/10 px-3 py-2 text-sm text-sky-900 dark:text-sky-100">
          Первая процедура — при записи клиент автоматически попадёт в программу лояльности (если указан телефон).
        </div>
      : null}

      <Button
        disabled={
          !canSubmit ||
          pending ||
          Boolean(clientId && startsAt && intervalQ.data && !intervalQ.data.intervalOk && !forceInterval)
        }
        onClick={() =>
          onSubmit({
            clientId: mode === 'search' ? selected?.id : undefined,
            newClient: mode === 'new' ? { fullName: newName.trim(), phone: newPhone.trim() || undefined } : undefined,
            service: service.trim(),
            startsAt,
            sequenceNumber: effectiveSeq,
            forceInterval: forceInterval || undefined,
          })
        }
      >
        {pending ? 'Сохранение…' : 'Создать запись'}
      </Button>
    </div>
  );
}
