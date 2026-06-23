// Service worker push handler — receives and displays notifications from the server
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch { data = { title: 'Octal Event', body: event.data.text() }; }

  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Octal Event', {
      body: data.body ?? '',
      icon: '/icons/icon-192.svg',
      badge: '/icons/icon-192.svg',
      vibrate: [200, 100, 200],
      data: { url: data.url ?? '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url ?? '/'));
});
