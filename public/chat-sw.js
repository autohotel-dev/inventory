// Public Service Worker for Chat Push

self.addEventListener('install', (event) => {
    // Force active immediately
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
    if (!event.data) return;

    try {
        const payload = event.data.json();

        const notificationTitle = payload.title || 'Nuevo Mensaje';
        const notificationOptions = {
            body: payload.body,
            icon: payload.icon || '/luxor-logo.png', // Fallback icon
            badge: '/icons/icon-96x96.svg', // Android badge
            data: payload.data, // Contains URL or messageId
            requireInteraction: false, // Auto dismiss
            vibrate: [100, 50, 100],
        };

        // Don't show if window is focused (optional, logic might be in hook for in-app toast)
        // But SW runs always. We can check clients.matchAll to see if focused.
        event.waitUntil(
            self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
                const client = clients.find(c => c.visibilityState === 'visible');
                // If app is currently visible, we might SKIP showing system notification
                // because the in-app toast handles it.
                if (client) {
                    // Send message to client to trigger toast or sound if needed?
                    // Already handled by Supabase Realtime in app.
                    // So we skip system notification strictly when app is open.
                    return;
                }

                return self.registration.showNotification(notificationTitle, notificationOptions);
            })
        );
    } catch (e) {
        console.error('Error handling push:', e);
    }
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const data = event.notification.data;
    const urlToOpen = (data && data.url) ? data.url : '/dashboard?chat=open';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
            // If tab exists, focus it
            for (const client of clients) {
                if (client.url.includes('/dashboard') && 'focus' in client) {
                    // Optionally navigate/postMessage
                    return client.focus().then(() => {
                        client.postMessage({ type: 'OPEN_CHAT', messageId: data?.messageId });
                    });
                }
            }
            // Otherwise open new
            if (self.clients.openWindow) {
                return self.clients.openWindow(urlToOpen);
            }
        })
    );
});
