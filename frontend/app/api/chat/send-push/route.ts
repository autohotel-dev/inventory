import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// Triggered by Supabase Webhook: http://.../api/chat/send-push
// Payload: { type: 'INSERT', table: 'messages', record: { ... }, old_record: null, schema: 'public' }

export async function POST(req: Request) {
    try {
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        webpush.setVapidDetails(
            process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
            process.env.VAPID_PRIVATE_KEY!
        );

        // Authenticate the webhook source (optional, via a shared secret header)
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

        // Don't notify the sender
        const senderId = message.user_id;

        // Fetch all generic subscribers EXCEPT the sender
        // In a real app with "Rooms" or "teams", filter by that.
        // For global chat: fetch ALL subscriptions where user_id != senderId
        const { data: subscriptions, error } = await supabaseAdmin
            .from('chat_subscriptions')
            .select('*')
            .neq('user_id', senderId);

        if (error || !subscriptions) {
            console.error('Error fetching subscriptions:', error);
            return NextResponse.json({ error: 'Db error' }, { status: 500 });
        }

        const notificationPayload = JSON.stringify({
            title: `Nuevo mensaje de ${message.user_email?.split('@')[0] || 'Usuario'}`,
            body: message.content,
            icon: '/luxor-logo.png',
            data: {
                url: '/dashboard?chat=open', // Custom logic to open chat
                messageId: message.id
            }
        });

        // Send parallel notifications
        const sendPromises = subscriptions.map(async (sub) => {
            try {
                await webpush.sendNotification({
                    endpoint: sub.endpoint,
                    keys: {
                        auth: sub.auth,
                        p256dh: sub.p256dh
                    }
                }, notificationPayload);
            } catch (err: any) {
                if (err.statusCode === 410 || err.statusCode === 404) {
                    // Subscription expired/gone, remove from DB
                    await supabaseAdmin
                        .from('chat_subscriptions')
                        .delete()
                        .eq('id', sub.id);
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
