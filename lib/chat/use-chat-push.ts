"use client";

import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

// Helper to convert VAPID key
function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export function useChatPush() {
    const [isSubscribed, setIsSubscribed] = useState(false);
    const { info, error } = useToast();

    useEffect(() => {
        if ('serviceWorker' in navigator && 'PushManager' in window) {

            // Check current subscription
            navigator.serviceWorker.ready.then(async (registration) => {
                const subscription = await registration.pushManager.getSubscription();
                setIsSubscribed(!!subscription);

                // Register chat-sw if not registered (or rely on next-pwa)
                // We'll rely on next-pwa OR initiate manual reg for this feature.
                // Assuming next-pwa handles the main SW. 

                // If we want a separate SW scope or logic, it's tricky with Next PWA as it owns /sw.js
                // Best approach: Add importScripts to next.config.js (as planned), 
                // so the MAIN sw includes our logic.
                // THEN we just use the main registration.
            });
        }
    }, []);

    const subscribeToPush = async () => {
        if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
            console.error("Missing VAPID Key");
            return;
        }

        try {
            const registration = await navigator.serviceWorker.ready;

            const sub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
            });

            // Send to backend
            const res = await fetch('/api/chat/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sub)
            });

            if (res.ok) {
                setIsSubscribed(true);
                info("Notificaciones activadas", "Recibirás mensajes incluso con la app cerrada.");
            } else {
                throw new Error('Server returned error');
            }

        } catch (e) {
            console.error('Push Subscription Error:', e);
            error("Error", "No se pudieron activar las notificaciones push.");
        }
    };

    return { isSubscribed, subscribeToPush };
}
