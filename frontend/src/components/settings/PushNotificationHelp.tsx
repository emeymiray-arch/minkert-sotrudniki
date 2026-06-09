import { Bell, Share } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';

function isIosDevice() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/i.test(navigator.userAgent);
}

function isStandaloneApp() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari iOS
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function PushNotificationHelp({ onEnable }: { onEnable: () => void }) {
  const [ios] = React.useState(isIosDevice);
  const [standalone] = React.useState(isStandaloneApp);
  const needHomeScreen = ios && !standalone;

  return (
    <Card>
      <CardHeader
        title="Уведомления на экран телефона"
        description="Чтобы приходили как от WhatsApp — на блокировке и в шторке сверху."
      />

      {needHomeScreen ?
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
          <strong className="font-semibold">Сейчас вы в Safari.</strong> На iPhone уведомления работают только если
          открыть Minkert <strong>с иконки на главном экране</strong>, а не из закладки браузера.
        </div>
      : null}

      {ios ?
        <ol className="mb-4 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-zinc-800 dark:text-white/85">
          <li>
            Откройте сайт Minkert в <strong>Safari</strong> (синий компас), войдите в аккаунт.
          </li>
          <li>
            Внизу экрана нажмите кнопку <strong>«Поделиться»</strong>
            <Share className="mx-1 inline size-4 align-text-bottom opacity-70" aria-hidden />
            — квадрат со стрелкой вверх.
          </li>
          <li>
            Пролистайте меню вниз и выберите <strong>«На экран Домой»</strong> (иконка с плюсом).
          </li>
          <li>
            Нажмите <strong>«Добавить»</strong> справа вверху.
          </li>
          <li>
            Закройте Safari. На главном экране iPhone появится иконка <strong>Minkert</strong> — откройте её.
          </li>
          <li>
            Зайдите в <strong>Настройки</strong> внутри приложения → нажмите кнопку ниже → выберите{' '}
            <strong>«Разрешить»</strong>.
          </li>
          <li>
            Если кнопка «Разрешить» не появилась: iPhone → <strong>Настройки</strong> → <strong>Уведомления</strong> →{' '}
            <strong>Minkert</strong> → включите «Допуск уведомлений».
          </li>
        </ol>
      : <ol className="mb-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-zinc-800 dark:text-white/85">
          <li>Откройте Minkert в Chrome и войдите в аккаунт.</li>
          <li>Нажмите кнопку ниже и выберите «Разрешить».</li>
          <li>
            Если не спросило: Настройки телефона → Приложения → Chrome → Уведомления → включить для Minkert.
          </li>
        </ol>
      }

      {needHomeScreen ?
        <p className="text-sm text-muted dark:text-white/50">
          Сначала выполните шаги 1–5, затем откройте Minkert с иконки на главном экране и снова зайдите в Настройки.
        </p>
      : <Button type="button" className="gap-2" onClick={onEnable}>
          <Bell className="size-4" aria-hidden />
          Включить уведомления
        </Button>
      }
    </Card>
  );
}

export function pushHintForIos(): string | null {
  if (!isIosDevice()) return null;
  if (isStandaloneApp()) return null;
  return 'На iPhone: Safari → Поделиться (□↑) → На экран Домой → откройте с иконки → снова «Включить уведомления».';
}
