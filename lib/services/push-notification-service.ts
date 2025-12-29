'use client';

/**
 * Push Notification Service for Guest Portal
 * Handles web push notification subscriptions and management
 */

// VAPID public key - You'll need to generate this
// Run: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

/**
 * Convert VAPID key to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
}

/**
 * Check if push notifications are supported
 */
export function isPushNotificationSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window;
}

/**
 * Register service worker for push notifications
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!isPushNotificationSupported()) {
        console.warn('Push notifications are not supported');
        return null;
    }

    try {
        const registration = await navigator.serviceWorker.register('/guest-sw.js', {
            scope: '/'
        });

        console.log('Service Worker registered:', registration);
        return registration;
    } catch (error) {
        console.error('Service Worker registration failed:', error);
        return null;
    }
}

/**
 * Request notification permission from the user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
        console.warn('This browser does not support notifications');
        return 'denied';
    }

    const permission = await Notification.requestPermission();
    return permission;
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPushNotifications(
    roomStayId: string,
    roomNumber: string
): Promise<{ success: boolean; subscriptionId?: string; error?: string }> {
    try {
        // Check support
        if (!isPushNotificationSupported()) {
            return { success: false, error: 'Push notifications not supported' };
        }

        // Request permission
        const permission = await requestNotificationPermission();
        if (permission !== 'granted') {
            return { success: false, error: 'Notification permission denied' };
        }

        // Register service worker
        const registration = await registerServiceWorker();
        if (!registration) {
            return { success: false, error: 'Service worker registration failed' };
        }

        // Wait for service worker to be ready (active) to avoid "no active Service Worker" error
        await navigator.serviceWorker.ready;

        // Subscribe to push manager
        const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey as BufferSource
        });

        // Send subscription to backend
        const response = await fetch('/api/guest/subscribe', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                room_stay_id: roomStayId,
                room_number: roomNumber,
                subscription_data: subscription.toJSON(),
                user_agent: navigator.userAgent,
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to save subscription');
        }

        const data = await response.json();

        return {
            success: true,
            subscriptionId: data.subscription_id,
        };
    } catch (error) {
        console.error('Error subscribing to push notifications:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPushNotifications(
    subscriptionId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        // Get current subscription
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
            await subscription.unsubscribe();
        }

        // Notify backend
        const response = await fetch('/api/guest/unsubscribe', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ subscription_id: subscriptionId }),
        });

        if (!response.ok) {
            throw new Error('Failed to unsubscribe');
        }

        return { success: true };
    } catch (error) {
        console.error('Error unsubscribing:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Check current subscription status
 */
export async function getSubscriptionStatus(): Promise<{
    isSubscribed: boolean;
    subscription?: PushSubscription;
}> {
    try {
        if (!isPushNotificationSupported()) {
            return { isSubscribed: false };
        }

        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        return {
            isSubscribed: !!subscription,
            subscription: subscription || undefined,
        };
    } catch (error) {
        console.error('Error checking subscription status:', error);
        return { isSubscribed: false };
    }
}

/**
 * Test notification (for debugging)
 */
export async function sendTestNotification(): Promise<void> {
    if (!('Notification' in window)) {
        console.warn('Notifications not supported');
        return;
    }

    if (Notification.permission === 'granted') {
        new Notification('Prueba de Notificación', {
            body: 'Esta es una notificación de prueba del sistema de huéspedes.',
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-96x96.svg',
        });
    }
}
