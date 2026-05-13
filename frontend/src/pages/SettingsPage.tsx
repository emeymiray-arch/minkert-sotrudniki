import * as React from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { useTheme } from '@/context/theme';
import { useAuth } from '@/context/auth';
import { cnRoleRu } from '@/lib/format';
import { apiJson, getApiBaseUrl } from '@/lib/http';
import { DAY_KEYS, DAY_LABEL_RU, nextStatus } from '@/lib/task-days';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type ManagerTracker = {
  title: string;
  note: string;
  days: Record<(typeof DAY_KEYS)[number], number>;
};

const TRACKER_KEY = 'minkert.manager.tracker.v1';

function readTracker(): ManagerTracker {
  try {
    const raw = localStorage.getItem(TRACKER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ManagerTracker;
      if (parsed && parsed.days) return parsed;
    }
  } catch {
    /* ignore */
  }
  return {
    title: 'Моя управленческая неделя',
    note: 'Контроль команды, планирование, разбор рисков.',
    days: { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 },
  };
}

export default function SettingsPage() {
  const { mode, setMode } = useTheme();
  const { user, setUserProfile } = useAuth();
  const [name, setName] = React.useState(user?.name ?? '');
  const [email, setEmail] = React.useState(user?.email ?? '');
  const [tracker, setTracker] = React.useState<ManagerTracker>(() => readTracker());

  const apiHint = getApiBaseUrl();

  React.useEffect(() => {
    if (!user) return;
    setName(user.name);
    setEmail(user.email);
  }, [user]);

  React.useEffect(() => {
    localStorage.setItem(TRACKER_KEY, JSON.stringify(tracker));
  }, [tracker]);

  const updateProfile = useMutation({
    mutationFn: () =>
      apiJson<{ id: string; name: string; email: string; role: 'ADMIN' | 'MANAGER' | 'VIEWER'; linkedEmployeeId?: string | null }>(
        '/users/me',
        {
          method: 'PATCH',
          body: JSON.stringify({ name, email }),
        },
      ),
    onSuccess: (next) => {
      setUserProfile(next);
      toast.success('Профиль руководителя обновлён');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Не удалось обновить профиль'),
  });

  const trackerScore =
    DAY_KEYS.reduce((sum, day) => sum + tracker.days[day], 0) / (DAY_KEYS.length * 2);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <PageHeader
        title="Настройки"
        description="Тема и профиль хранятся локально в браузере; API остаётся на бэкенде."
      />

      <Card>
        <CardHeader title="Локальная персонализация" description="Выбор сохранён в браузере, без лишней нагрузки на вашу машину и бэкенд." />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-stroke bg-[hsl(var(--panel))] p-4 dark:border-white/[0.06]">
            <div className="text-xs uppercase tracking-[0.16em] text-muted dark:text-white/45">Тема</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant={mode === 'dark' ? 'primary' : 'outline'} onClick={() => setMode('dark')}>
                Тёмная
              </Button>
              <Button variant={mode === 'light' ? 'primary' : 'outline'} onClick={() => setMode('light')}>
                Светлая
              </Button>
              <Button variant={mode === 'system' ? 'primary' : 'outline'} onClick={() => setMode('system')}>
                Системная
              </Button>
            </div>
            <div className="mt-3 text-xs text-muted dark:text-white/48">По умолчанию — тёмный премиальный интерфейс с неоновыми акцентами.</div>
          </div>

          <div className="rounded-lg border border-stroke bg-[hsl(var(--panel))] p-4 dark:border-white/[0.06]">
            <div className="text-xs uppercase tracking-[0.16em] text-muted dark:text-white/45">Профиль</div>
            <div className="mt-3 space-y-3 text-sm">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ваше имя" />
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
              <Button onClick={() => updateProfile.mutate()} disabled={updateProfile.isPending}>
                Сохранить профиль руководителя
              </Button>
              <Badge tone="neutral" className="mt-2">
                {cnRoleRu(user?.role ?? '—')}
              </Badge>
              {user?.role === 'VIEWER' ?
                <p className="mt-3 text-xs leading-relaxed text-muted dark:text-white/50">
                  Отметки по дням в <strong>рабочих</strong> задачах доступны только для карточки сотрудника, привязанной к вашему
                  аккаунту. Попросите администратора указать привязку (или выполните повторный вход после её настройки).
                </p>
              : null}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Мой KPI как руководителя"
          description="Личный недельный трекер: 0 не сделано, 1 выполнено, 2 перевыполнено."
        />
        <div className="space-y-4">
          <Input
            value={tracker.title}
            onChange={(e) => setTracker((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Название вашего личного управленческого фокуса"
          />
          <Textarea
            value={tracker.note}
            onChange={(e) => setTracker((prev) => ({ ...prev, note: e.target.value }))}
            placeholder="Что вы как руководитель контролируете и улучшаете"
          />

          <div className="grid grid-cols-7 gap-2">
            {DAY_KEYS.map((day, idx) => {
              const val = tracker.days[day];
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() =>
                    setTracker((prev) => ({
                      ...prev,
                      days: { ...prev.days, [day]: nextStatus(prev.days[day]) },
                    }))
                  }
                  className={`rounded-xl border px-2 py-3 text-xs font-semibold transition ${
                    val === 0
                      ? 'border-stroke bg-black/10 text-muted dark:bg-white/5'
                      : val === 1
                        ? 'border-emerald-400/40 bg-emerald-400/20 text-zinc-900 dark:text-white'
                        : 'border-accent/40 bg-accent/25 text-zinc-900 dark:text-white'
                  }`}
                >
                  <div>{DAY_LABEL_RU[idx]}</div>
                  <div className="mt-1 text-lg">{val}</div>
                </button>
              );
            })}
          </div>
          <div className="text-sm text-muted dark:text-white/55">
            Ваш управленческий прогресс недели: <strong>{Math.round(trackerScore * 100)}%</strong>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Интеграция API" description="Для оперативности фронтенд ходит только в REST-бэкенд." />
        <div className="rounded-lg border border-dashed border-stroke bg-black/[0.02] p-4 text-[12px] font-mono text-zinc-800 dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-white/80">
          {apiHint}
        </div>
        <div className="mt-4 text-xs text-muted dark:text-white/55">
          В рабочем контуре вынесите JWT-секреты и строки подключения в менеджер секретов, а переменную `VITE_API_URL`
          передайте на этапе сборки фронта.
        </div>
      </Card>
    </div>
  );
}
