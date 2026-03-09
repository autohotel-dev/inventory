'use client';

import { useEffect, Suspense } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

function NotificationListenerContent() {
    const { info } = useToast();
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        // 1. Check for URL parameters (Cold start / New Window)
        const showNotif = searchParams.get('show_notification');

        if (showNotif === 'true') {
            const title = searchParams.get('notif_title') || 'Notificación';
            const body = searchParams.get('notif_body') || '';

            // Show toast
            console.log("Showing notification from URL params:", title);
            info(title, body);

            // Clean URL after delay to ensure toast renders and isn't cleared by obscure rerenders
            const timer = setTimeout(() => {
                const newParams = new URLSearchParams(searchParams.toString());
                newParams.delete('show_notification');
                newParams.delete('notif_title');
                newParams.delete('notif_body');

                router.replace(`${pathname}?${newParams.toString()}`);
            }, 5000); // 5 second delay to be safe

            return () => clearTimeout(timer);
        }

        // 2. Listen for Service Worker messages (Existing Tab / Focus)
        const handleMessage = (event: MessageEvent) => {
            if (event.data && event.data.type === 'NOTIFICATION_CLICK') {
                const { title, body } = event.data.payload;
                console.log("Showing notification from SW message:", title);
                info(title, body);
            }
        };

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', handleMessage);
        }

        return () => {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.removeEventListener('message', handleMessage);
            }
        };
    }, [info, searchParams, router, pathname]);

    return null;
}

export function NotificationListener() {
    return (
        <Suspense fallback={null}>
            <NotificationListenerContent />
        </Suspense>
    );
}
