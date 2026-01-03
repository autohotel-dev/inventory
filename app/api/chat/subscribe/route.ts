import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const subscription = await req.json();

        if (!subscription || !subscription.endpoint) {
            return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
        }

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Upsert subscription
        const { error } = await supabase
            .from('chat_subscriptions')
            .upsert({
                user_id: user.id,
                endpoint: subscription.endpoint,
                auth: subscription.keys.auth,
                p256dh: subscription.keys.p256dh,
                user_agent: req.headers.get('user-agent') || 'unknown',
                updated_at: new Date().toISOString()
            }, { onConflict: 'endpoint' });

        if (error) {
            console.error('Error saving subscription:', error);
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error('Error in subscribe route:', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
