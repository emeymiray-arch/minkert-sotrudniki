/* eslint-disable no-restricted-globals */
/** Версия SW — при деплое браузер подхватывает обновление без переустановки на экран. */
const SW_VERSION = 'minkert-20260612';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('push', (event) => {
  let data = { title: 'Minkert', body: '' };
  try {
    data = event.data ? event.data.json() : data;
  } catch {
    data.body = event.data?.text() ?? '';
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Minkert', {
      body: data.body || '',
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      vibrate: [180, 90, 180, 90, 320],
      tag: data.tag || 'minkert',
      renotify: true,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const url = new URL('/', self.location.origin).href;
      const open = list.find((c) => c.url.startsWith(self.location.origin));
      if (open) {
        open.focus();
        return;
      }
      return clients.openWindow(url);
    }),
  );
});
