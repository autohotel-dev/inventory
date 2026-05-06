import { apiClient } from '@/lib/api/client';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const subscription = await req.json();

        if (!subscription || !subscription.endpoint) {
            return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
        }

        // Upsert subscription via backend
        await apiClient.post('/system/crud/chat_subscriptions', {
            endpoint: subscription.endpoint,
            auth: subscription.keys.auth,
            p256dh: subscription.keys.p256dh,
            user_agent: req.headers.get('user-agent') || 'unknown',
            updated_at: new Date().toISOString()
        });

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error('Error in subscribe route:', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
