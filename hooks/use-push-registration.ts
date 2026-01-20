"use client";

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

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

export function usePushRegistration(employeeId?: string) {
    const [isSupported, setIsSupported] = useState(false);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        console.log('Push Hook: Checking support...', {
            sw: 'serviceWorker' in navigator,
            pm: 'PushManager' in window
        });
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
            setIsSupported(true);
            checkSubscription();
        } else {
            console.log('Push Hook: Not supported');
            setLoading(false);
        }
    }, []);

    const checkSubscription = async () => {
        try {
            console.log('Push Hook: Waiting for Service Worker...');
            const registration = await navigator.serviceWorker.ready;
            console.log('Push Hook: Service Worker Ready');
            const subscription = await registration.pushManager.getSubscription();
            console.log('Push Hook: Current Subscription:', !!subscription);
            setIsSubscribed(!!subscription);
        } catch (error) {
            console.error('Push Hook: Error checking subscription:', error);
        } finally {
            setLoading(false);
        }
    };

    const subscribe = async () => {
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) {
            console.error('VAPID public key is missing');
            return;
        }

        try {
            setLoading(true);
            const registration = await navigator.serviceWorker.ready;
            
            // Request permission
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                toast.error('Permiso de notificaciones denegado');
                return;
            }

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
            });

            // Save to server
            const response = await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscription, employeeId })
            });

            if (response.ok) {
                setIsSubscribed(true);
                toast.success('Notificaciones push activadas correctamente');
            } else {
                throw new Error('Failed to save subscription on server');
            }
        } catch (error) {
            console.error('Error subscribing to push:', error);
            toast.error('Error al activar las notificaciones');
        } finally {
            setLoading(false);
        }
    };

    const unsubscribe = async () => {
        try {
            setLoading(true);
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            if (subscription) {
                await subscription.unsubscribe();
                setIsSubscribed(false);
                toast.info('Notificaciones desactivadas');
            }
        } catch (error) {
            console.error('Error unsubscribing from push:', error);
        } finally {
            setLoading(false);
        }
    };

    return {
        isSupported,
        isSubscribed,
        loading,
        subscribe,
        unsubscribe
    };
}
