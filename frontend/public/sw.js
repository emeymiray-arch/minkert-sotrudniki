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
      if (list.length) {
        list[0].focus();
        return;
      }
      return clients.openWindow('/');
    }),
  );
});
