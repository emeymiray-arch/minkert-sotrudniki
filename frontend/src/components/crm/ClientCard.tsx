import { Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { CrmClient, CrmClientStatus } from '@/components/crm/types';
import { STATUS_CLASS, STATUS_RU, money } from '@/components/crm/types';

function Stat({ label, value, accent }: { label: string; value: string; accent?: 'warn' | 'ok' | 'bad' }) {
  const valueClass =
    accent === 'warn' ? 'text-amber-700 dark:text-amber-300'
    : accent === 'bad' ? 'text-rose-700 dark:text-rose-300'
    : accent === 'ok' ? 'text-emerald-700 dark:text-emerald-300'
    : 'text-zinc-900 dark:text-white';
  return (
    <div className="rounded-lg border border-stroke/80 bg-zinc-50/80 px-3 py-2.5 dark:border-white/[0.08] dark:bg-white/[0.03]">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted dark:text-white/45">{label}</div>
      <div className={`mt-1 text-[15px] font-semibold tabular-nums ${valueClass}`}>{value}</div>
    </div>
  );
}

export function ClientCard({
  client,
  isAdmin,
  onStatus,
  onWarn,
  onDelete,
  deleting,
}: {
  client: CrmClient;
  isAdmin: boolean;
  onStatus: (id: string, status: CrmClientStatus) => void;
  onWarn: (id: string, warned: boolean) => void;
  onDelete: (id: string) => void;
  deleting?: boolean;
}) {
  const interval = client.interval;

  return (
    <div className="rounded-xl border border-stroke p-4 dark:border-white/[0.08]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-lg font-semibold text-zinc-900 dark:text-white">{client.fullName}</div>
          <div className="mt-0.5 text-sm text-muted dark:text-white/55">
            {client.phone || 'Телефон не указан'}
            {client.loyaltyStamps != null ? ` · Лояльность: ${client.loyaltyStamps} шт.` : ''}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={STATUS_CLASS[client.status]}>{STATUS_RU[client.status]}</Badge>
          {isAdmin ?
            <>
              <Button size="sm" variant="outline" onClick={() => onStatus(client.id, client.status)}>
                Статус
              </Button>
              <Button
                size="sm"
                variant={client.warned ? 'primary' : 'outline'}
                onClick={() => onWarn(client.id, !client.warned)}
              >
                {client.warned ? 'Обзвонен' : 'Обзвон'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-rose-600 hover:text-rose-700"
                disabled={deleting}
                onClick={() => {
                  if (window.confirm(`Удалить клиента «${client.fullName}»? Записи и процедуры тоже удалятся.`)) {
                    onDelete(client.id);
                  }
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </>
          : null}
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Процедур" value={String(client.visitsCount)} />
        <Stat label="Потрачено" value={`${money(client.totalSpent)} ₽`} />
        <Stat
          label="Последняя процедура"
          value={client.lastProcedureAt?.slice(0, 10) ?? '—'}
        />
        <Stat
          label="Следующая рекомендация"
          value={client.recommendedNextAt?.slice(0, 10) ?? '—'}
        />
      </div>

      {interval ?
        <div
          className={`mt-3 rounded-lg px-3 py-2.5 text-sm ${
            interval.intervalOk ?
              'bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
            : 'bg-amber-500/10 text-amber-900 dark:text-amber-100'
          }`}
        >
          <span className="font-medium">Интервал (процедура №{interval.nextSequenceNumber}): </span>
          {interval.message}
        </div>
      : null}

      {client.lastProcedure ?
        <div className="mt-2 text-xs text-muted dark:text-white/50">
          Последняя услуга: {client.lastProcedure.service} · интервал {client.lastProcedure.intervalDays} дн.
        </div>
      : null}
    </div>
  );
}
