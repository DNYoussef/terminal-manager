/**
 * Service Worker for Push Notifications
 * Handles background push notifications and click events
 */

/* eslint-disable no-restricted-globals */

// Listen for push events
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);

  let notificationData = {
    title: 'Notification',
    body: 'You have a new notification',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    timestamp: Date.now(),
    requireInteraction: false,
    data: {},
    actions: []
  };

  // Parse notification data
  if (event.data) {
    try {
      const payload = event.data.json();
      notificationData = { ...notificationData, ...payload };
    } catch (e) {
      console.error('Failed to parse push payload:', e);
    }
  }

  // Show notification
  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      timestamp: notificationData.timestamp,
      requireInteraction: notificationData.requireInteraction,
      data: notificationData.data,
      actions: notificationData.actions,
      tag: notificationData.data.type || 'general',
      renotify: true,
      vibrate: [200, 100, 200],
    })
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event.notification);

  event.notification.close();

  const data = event.notification.data || {};
  const action = event.action;

  // Handle action button clicks
  if (action === 'view' && data.url) {
    event.waitUntil(
      clients.openWindow(data.url)
    );
    return;
  }

  if (action === 'restart' && data.agent_id) {
    // Send restart request
    event.waitUntil(
      fetch(`/api/agents/${data.agent_id}/restart`, {
        method: 'POST',
        credentials: 'include',
      }).then(() => {
        clients.openWindow(`/agents/${data.agent_id}`);
      })
    );
    return;
  }

  if (action === 'dismiss') {
    return;
  }

  // Default action: open relevant page or dashboard
  const urlToOpen = data.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Check if there's already a window open
        for (let client of windowClients) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }

        // Otherwise, open a new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Handle push subscription changes
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('Push subscription changed');

  event.waitUntil(
    fetch('/api/notifications/push/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        old_endpoint: event.oldSubscription?.endpoint,
        new_subscription: event.newSubscription?.toJSON()
      })
    })
  );
});

// Service worker activation
self.addEventListener('activate', (event) => {
  console.log('Service worker activated');
  event.waitUntil(self.clients.claim());
});

// Service worker installation
self.addEventListener('install', (event) => {
  console.log('Service worker installed');
  self.skipWaiting();
});
