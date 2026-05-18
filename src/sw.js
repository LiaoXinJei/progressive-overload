import { precacheAndRoute } from 'workbox-precaching';

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));

    await self.clients.claim();

    const clientsList = await self.clients.matchAll({ type: 'window' });
    for (const client of clientsList) {
      try { client.navigate(client.url); } catch (_) {}
    }
  })());
});

let notificationTimer = null;
let resolveTimer = null;

self.addEventListener('message', (event) => {
  const { type, delay, title, body } = event.data || {};

  if (type === 'SCHEDULE_NOTIFICATION') {
    if (notificationTimer) {
      clearTimeout(notificationTimer);
      notificationTimer = null;
      if (resolveTimer) { resolveTimer(); resolveTimer = null; }
    }

    // event.waitUntil keeps SW alive until notification fires or is cancelled
    const promise = new Promise((resolve) => {
      resolveTimer = resolve;
      notificationTimer = setTimeout(async () => {
        try {
          await self.registration.showNotification(title || '休息結束！', {
            body: body || '該做下一組了，回來繼續訓練吧！',
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-192.png',
            tag: 'rest-timer',
            renotify: true,
            vibrate: [200, 100, 200],
            requireInteraction: false,
          });
        } catch (_) {}
        notificationTimer = null;
        resolveTimer = null;
        resolve();
      }, delay);
    });

    event.waitUntil(promise);
  }

  if (type === 'CANCEL_NOTIFICATION') {
    if (notificationTimer) {
      clearTimeout(notificationTimer);
      notificationTimer = null;
    }
    if (resolveTimer) {
      resolveTimer();
      resolveTimer = null;
    }
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
