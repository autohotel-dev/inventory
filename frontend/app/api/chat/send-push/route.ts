import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { apiClient } from '@/lib/api/client';

// Triggered by webhook for new chat messages

export async function POST(req: Request) {
    try {
        webpush.setVapidDetails(
            process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
            process.env.VAPID_PRIVATE_KEY!
        );

        // Authenticate the webhook source
        const secret = req.headers.get('x-webhook-secret');
        if (process.env.CHAT_WEBHOOK_SECRET && secret !== process.env.CHAT_WEBHOOK_SECRET) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payload = await req.json();

        // Only handle new messages
        if (payload.type !== 'INSERT' || payload.table !== 'messages') {
            return NextResponse.json({ message: 'Ignored event' });
        }

        const message = payload.record;
        const senderId = message.user_id;

        // Fetch all subscriptions except sender via backend
        const { data: subsData } = await apiClient.get('/system/crud/chat_subscriptions');
        const subscriptions = (Array.isArray(subsData) ? subsData : (subsData?.items || subsData?.results || []))
            .filter((s: any) => s.user_id !== senderId);

        const notificationPayload = JSON.stringify({
            title: `Nuevo mensaje de ${message.user_email?.split('@')[0] || 'Usuario'}`,
            body: message.content,
            icon: '/luxor-logo.png',
            data: {
                url: '/dashboard?chat=open',
                messageId: message.id
            }
        });

        // Send parallel notifications
        const sendPromises = subscriptions.map(async (sub: any) => {
            try {
                await webpush.sendNotification({
                    endpoint: sub.endpoint,
                    keys: { auth: sub.auth, p256dh: sub.p256dh }
                }, notificationPayload);
            } catch (err: any) {
                if (err.statusCode === 410 || err.statusCode === 404) {
                    // Subscription expired, remove from DB
                    try {
                        await apiClient.delete(`/system/crud/chat_subscriptions/${sub.id}`);
                    } catch {}
                } else {
                    console.error('Error sending push:', err);
                }
            }
        });

        await Promise.all(sendPromises);

        return NextResponse.json({ success: true, count: subscriptions.length });
    } catch (e) {
        console.error('Error in send-push:', e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
