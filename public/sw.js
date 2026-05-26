// Service Worker for Web Push Notifications — MLPHoma Construction PM App

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = { title: 'MLPHoma', message: 'You have a new notification.', deepLink: '/' };

  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload.message = event.data.text();
    }
  }

  const { title, message, deepLink } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body: message,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      data: { deepLink: deepLink ?? '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.deepLink ?? '/';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url === targetUrl && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});
