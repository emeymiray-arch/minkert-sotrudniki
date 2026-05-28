import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart, Gift, X } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { apiJson } from '@/lib/http';
import { cn } from '@/lib/utils';

type LoyaltyStamp = {
  slot: number;
  masterName: string;
};

type LoyaltyClient = {
  id: string;
  name: string;
  phone: string;
  stamps: LoyaltyStamp[];
  giftAvailable: boolean;
  giftClaimed: boolean;
};

export default function LoyaltyPage() {
  const [q, setQ] = React.useState('');
  const [newName, setNewName] = React.useState('');
  const [newPhone, setNewPhone] = React.useState('');
  const qc = useQueryClient();

  const clientsQ = useQuery({
    queryKey: ['loyalty', q],
    queryFn: () => apiJson<LoyaltyClient[]>(`/loyalty/clients${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`),
  });

  const createMu = useMutation({
    mutationFn: () =>
      apiJson<LoyaltyClient>('/loyalty/clients', {
        method: 'POST',
        body: JSON.stringify({ name: newName, phone: newPhone }),
      }),
    onSuccess: () => {
      setNewName('');
      setNewPhone('');
      void qc.invalidateQueries({ queryKey: ['loyalty'] });
      toast.success('Клиент добавлен');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Программа лояльности"
        description="Мини-CRM: клиент, поиск по номеру, 10 сердечек. После 9 процедур доступен подарок 5000 ₽."
      />

      <Card>
        <CardHeader title="Новый клиент" />
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Имя клиента" />
          <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="Телефон" />
          <Button
            type="button"
            disabled={!newName.trim() || !newPhone.trim() || createMu.isPending}
            onClick={() => createMu.mutate()}
          >
            Добавить
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Клиенты" description="Поиск по номеру телефона или имени." />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск: +7..., 8707..., Айгерим..." />
      </Card>

      {clientsQ.isLoading ?
        <Skeleton className="h-[240px]" />
      : clientsQ.data?.length ?
        <div className="space-y-4">
          {clientsQ.data.map((client) => (
            <LoyaltyClientCard key={client.id} client={client} />
          ))}
        </div>
      : <Card>
          <p className="text-sm text-muted dark:text-white/50">Клиенты не найдены.</p>
        </Card>
      }
    </div>
  );
}

function LoyaltyClientCard({ client }: { client: LoyaltyClient }) {
  const qc = useQueryClient();
  const stampMap = React.useMemo(() => new Map(client.stamps.map((s) => [s.slot, s])), [client.stamps]);

  const patchMu = useMutation({
    mutationFn: ({ slot, masterName }: { slot: number; masterName: string }) =>
      apiJson<LoyaltyClient>(`/loyalty/clients/${client.id}/stamps/${slot}`, {
        method: 'PATCH',
        body: JSON.stringify({ masterName }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['loyalty'] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-base font-semibold text-zinc-900 dark:text-white">{client.name}</div>
          <div className="text-xs text-muted dark:text-white/50">{client.phone}</div>
        </div>
        <div className={cn('inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold', client.giftClaimed ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : client.giftAvailable ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400' : 'bg-black/5 text-zinc-700 dark:bg-white/10 dark:text-white/70')}>
          <Gift className="size-3.5" />
          {client.giftClaimed ? 'Подарок выдан' : client.giftAvailable ? 'Подарок 5000 ₽ доступен' : 'Собирает сердечки'}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5 lg:grid-cols-10">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((slot) => {
          const stamp = stampMap.get(slot);
          const isGift = slot === 10;
          const lockedGift = isGift && !client.giftAvailable;
          return (
            <button
              key={slot}
              type="button"
              disabled={lockedGift || patchMu.isPending}
              onClick={() => {
                const current = stamp?.masterName ?? '';
                const next = window.prompt(
                  isGift ? 'Имя мастера для подарка (10-е сердечко)' : `Имя мастера для процедуры #${slot}`,
                  current,
                );
                if (next == null) return;
                patchMu.mutate({ slot, masterName: next.trim() });
              }}
              className={cn(
                'relative flex h-16 flex-col items-center justify-center rounded-xl border px-1 text-center transition',
                stamp ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300' : 'border-stroke bg-[hsl(var(--panel))] text-muted dark:border-white/[0.08] dark:text-white/55',
                lockedGift && 'opacity-50',
              )}
            >
              {stamp ?
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    patchMu.mutate({ slot, masterName: '' });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      patchMu.mutate({ slot, masterName: '' });
                    }
                  }}
                  className="absolute right-1 top-1 rounded-full bg-black/10 p-0.5 text-zinc-700 hover:bg-black/20 dark:bg-white/10 dark:text-white/80 dark:hover:bg-white/20"
                  title="Убрать сердечко"
                >
                  <X className="size-3" />
                </span>
              : null}
              <div className="flex items-center gap-1">
                <Heart className={cn('size-4', stamp && 'fill-current')} />
                <span className="text-[11px] font-semibold">{slot}</span>
              </div>
              <div className="mt-1 line-clamp-2 text-[10px] leading-tight">{stamp?.masterName || (isGift ? '5000 ₽' : '—')}</div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
