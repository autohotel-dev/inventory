// Guest Notification Service Worker
// Handles push notifications specifically for hotel guests
// Works alongside the main PWA service worker

const GUEST_NOTIFICATION_CACHE = 'guest-notifications-v1';

// Listen for push notifications
self.addEventListener('push', (event) => {
    console.log('[Guest SW] Push notification received');

    if (!event.data) {
        console.log('[Guest SW] No data in push event');
        return;
    }

    let notificationData;
    try {
        notificationData = event.data.json();
    } catch (e) {
        console.error('[Guest SW] Error parsing notification:', e);
        notificationData = {
            title: 'Notificación del Hotel',
            body: event.data.text(),
        };
    }

    const {
        title = 'Hotel Notification',
        body = '',
        icon = '/icons/icon-192.png',
        badge = '/icons/icon-96x96.svg',
        tag = 'hotel-notification',
        data = {},
        vibrate = [200, 100, 200],
    } = notificationData;

    const options = {
        body,
        icon,
        badge,
        tag,
        data,
        vibrate,
        requireInteraction: false,
        actions: [
            { action: 'view', title: 'Ver' },
            { action: 'dismiss', title: 'Cerrar' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    console.log('[Guest SW] Notification clicked');

    const notification = event.notification;
    const action = event.action;
    const data = notification.data || {};

    notification.close();

    if (action === 'dismiss') {
        return;
    }

    // Open or focus the relevant page
    const urlToOpen = data.action_url || '/guest-portal';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((windowClients) => {
                // Check if already open
                for (let client of windowClients) {
                    if (client.url.includes('/guest-portal') && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Open new window
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
            .then(() => {
                // Mark as opened
                if (data.notification_id) {
                    return fetch('/api/guest/notification-status', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            notification_id: data.notification_id,
                            opened: true,
                        }),
                    });
                }
            })
            .catch((error) => {
                console.error('[Guest SW] Error handling click:', error);
            })
    );
});

console.log('[Guest SW] Guest notification worker loaded');
