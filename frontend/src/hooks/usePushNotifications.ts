import * as React from 'react';
import { toast } from 'sonner';

import { pushHintForIos } from '@/components/settings/PushNotificationHelp';
import { useAuth } from '@/context/auth';
import { apiJson } from '@/lib/http';

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function pushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    typeof Notification !== 'undefined'
  );
}

export function usePushNotifications() {
  const { user, isAuthenticated } = useAuth();

  const subscribe = React.useCallback(async () => {
    if (!isAuthenticated || !user) return false;
    const iosHint = pushHintForIos();
    if (iosHint) {
      toast.message(iosHint, { duration: 12_000 });
      return false;
    }
    if (!pushSupported()) {
      toast.message('Push недоступен в этом браузере');
      return false;
    }
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        toast.message('Разрешите уведомления в настройках браузера');
        return false;
      }
      const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register('/sw.js'));
      await navigator.serviceWorker.ready;
      const { publicKey } = await apiJson<{ publicKey: string | null }>('/notifications/vapid-key');
      if (!publicKey) {
        toast.message('Push ещё не настроен на сервере (VAPID ключи)');
        return false;
      }
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }
      const json = sub.toJSON();
      await apiJson('/notifications/push-subscribe', {
        method: 'POST',
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
        }),
      });
      toast.success('Уведомления на экран телефона включены');
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось подключить уведомления');
      return false;
    }
  }, [isAuthenticated, user]);

  React.useEffect(() => {
    if (!isAuthenticated || !user) return;
    if (!['ADMIN', 'MANAGER', 'MASTER', 'VIEWER'].includes(user.role)) return;
    if (!pushSupported()) return;
    if (Notification.permission === 'granted') {
      void subscribe().catch(() => undefined);
    }
  }, [isAuthenticated, user?.id, subscribe]);

  return { subscribe };
}
