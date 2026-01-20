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
            console.log('Push Hook: Checking registration...');
            
            // Timeout to avoid infinite waiting if SW is broken/hanging
            const registrationPromise = navigator.serviceWorker.getRegistration();
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout waiting for SW')), 5000)
            );

            let registration = await Promise.race([registrationPromise, timeoutPromise]) as ServiceWorkerRegistration;
            
            if (!registration) {
                console.log('Push Hook: No registration found, checking .ready with timeout...');
                const readyPromise = navigator.serviceWorker.ready;
                registration = await Promise.race([readyPromise, timeoutPromise]) as ServiceWorkerRegistration;
            }

            console.log('Push Hook: Service Worker State:', {
                active: !!registration.active,
                waiting: !!registration.waiting,
                installing: !!registration.installing,
                scope: registration.scope
            });

            if (!registration.active && !registration.waiting && !registration.installing) {
                console.warn('Push Hook: Service Worker registration exists but no worker is active/installing.');
            }

            const subscription = await registration.pushManager.getSubscription();
            console.log('Push Hook: Current Subscription:', !!subscription);
            setIsSubscribed(!!subscription);
        } catch (error: any) {
            console.error('Push Hook: Registration/Ready Error:', error?.message || 'Unknown error');
            // Don't set isSupported(false) yet, just log it.
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
