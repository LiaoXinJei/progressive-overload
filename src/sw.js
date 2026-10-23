import { precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

// registerType: 'autoUpdate' 搭配 injectManifest 時、plugin 不會自動補這兩行；
// 沒有的話新版 SW 會一直 waiting、直到 PWA 完全關閉才生效
self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);

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
