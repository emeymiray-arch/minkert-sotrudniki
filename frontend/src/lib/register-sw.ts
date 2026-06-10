/** Регистрация SW: после деплоя приложение обновляется при открытии, без новых ссылок и переустановки. */
export function registerAppServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  let reloaded = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });

  void navigator.serviceWorker
    .register('/sw.js')
    .then((reg) => {
      void reg.update();
      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            installing.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
    })
    .catch(() => undefined);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void navigator.serviceWorker.getRegistration().then((r) => r?.update());
    }
  });
}
