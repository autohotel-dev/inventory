// Service Worker for Valet/Reception Push Notifications

self.addEventListener('push', (event) => {
    if (!event.data) return;

    try {
        const payload = event.data.json();
        const notificationTitle = payload.title || 'Alerta de Valet';

        const notificationOptions = {
            body: payload.body,
            icon: '/luxor-logo.png',
            badge: '/icons/icon-96x96.svg',
            data: payload.data, // Should include url, etc.'
            vibrate: [200, 100, 200, 100, 200], // Stronger vibration for alerts
            tag: payload.tag || 'valet-alert', // Avoid stack if needed
            renotify: true,
            actions: [
                { action: 'open', title: 'Ver Detalles' },
                { action: 'close', title: 'Cerrar' }
            ]
        };

        event.waitUntil(
            self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
                const isAppVisible = clients.some(c => c.visibilityState === 'visible');

                // Even if visible, we might want a system notification if it's URGENT
                // But generally, Realtime handles in-app. 
                // Let's show it if it's not visible or if the tag is 'urgent'
                if (isAppVisible && payload.priority !== 'high') {
                    return;
                }

                return self.registration.showNotification(notificationTitle, notificationOptions);
            })
        );
    } catch (e) {
        console.error('Error in valet-push-sw:', e);
    }
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'close') return;

    const data = event.notification.data;
    const urlToOpen = data && data.url ? data.url : '/valet';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
            for (const client of clients) {
                if (client.url.includes(urlToOpen) && 'focus' in client) {
                    return client.focus();
                }
            }
            if (self.clients.openWindow) {
                return self.clients.openWindow(urlToOpen);
            }
        })
    );
});
