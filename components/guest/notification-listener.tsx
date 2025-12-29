'use client';

import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export function NotificationListener() {
    const { info } = useToast();

    useEffect(() => {
        // Function to handle messages from Service Worker
        const handleMessage = (event: MessageEvent) => {
            if (event.data && event.data.type === 'NOTIFICATION_CLICK') {
                const { title, body } = event.data.payload;

                console.log("Notification Click data received:", event.data.payload);

                // Use the 'info' method from the custom useToast hook (wraps sonner)
                info(title, body);
            }
        };

        // Add listener
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', handleMessage);
        }

        return () => {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.removeEventListener('message', handleMessage);
            }
        };
    }, [info]);

    return null; // Renderless component
}
