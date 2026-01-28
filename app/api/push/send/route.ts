import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import webpush from 'web-push';

interface SendNotificationRequest {
    title: string;
    body: string;
    url?: string;
    tag?: string;
    roles: string[];
}

export async function POST(req: Request) {
    try {
        // Verify user is authenticated
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payload: SendNotificationRequest = await req.json();

        if (!payload.title || !payload.body || !payload.roles?.length) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        const vapidPrivate = process.env.VAPID_PRIVATE_KEY;

        if (!vapidPublic || !vapidPrivate) {
            console.error('VAPID keys missing in environment');
            return NextResponse.json({ error: 'Configuration missing' }, { status: 500 });
        }

        webpush.setVapidDetails(
            'mailto:admin@luxormanager.com',
            vapidPublic,
            vapidPrivate
        );

        // Fetch employees by role
        const adminSupabase = createAdminClient();
        const { data: employees } = await adminSupabase
            .from('employees')
            .select('id')
            .in('role', payload.roles);

        if (!employees?.length) {
            return NextResponse.json({ message: 'No target employees', sentCount: 0 });
        }

        const employeeIds = employees.map(e => e.id);
        const { data: subs } = await adminSupabase
            .from('push_subscriptions')
            .select('*')
            .in('employee_id', employeeIds);

        if (!subs?.length) {
            return NextResponse.json({ message: 'No active subscriptions', sentCount: 0 });
        }

        // Send notifications
        const notificationPayload = JSON.stringify({
            title: payload.title,
            body: payload.body,
            data: { url: payload.url || '/valet', ...(payload as any).data },
            tag: payload.tag || `notif-${Date.now()}`
        });

        // 1. Web Push Delivery
        const webPushResults = await Promise.allSettled(subs.map(sub => {
            const pushSub = {
                endpoint: sub.subscription.endpoint,
                keys: {
                    auth: sub.subscription.keys.auth,
                    p256dh: sub.subscription.keys.p256dh
                }
            };
            return webpush.sendNotification(pushSub, notificationPayload);
        }));

        const webSuccessCount = webPushResults.filter(r => r.status === 'fulfilled').length;

        // 2. Expo Push Delivery (Mobile App)
        let expoSuccessCount = 0;
        const { data: employeesWithTokens } = await adminSupabase
            .from('employees')
            .select('id, push_token')
            .in('role', payload.roles)
            .not('push_token', 'is', null);

        if (employeesWithTokens?.length) {
            const expoMessages = employeesWithTokens
                .filter(e => e.push_token && e.push_token.startsWith('ExponentPushToken['))
                .map(e => ({
                    to: e.push_token,
                    sound: 'default',
                    title: payload.title,
                    body: payload.body,
                    data: { url: payload.url || '/valet', ...(payload as any).data },
                }));

            if (expoMessages.length > 0) {
                try {
                    const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
                        method: 'POST',
                        headers: {
                            'Accept': 'application/json',
                            'Accept-encoding': 'gzip, deflate',
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(expoMessages),
                    });

                    if (expoResponse.ok) {
                        expoSuccessCount = expoMessages.length;
                    }
                } catch (expoErr) {
                    console.error('[Expo Push] Error:', expoErr);
                }
            }
        }

        console.log(`[Push Send] Sent: Web(${webSuccessCount}/${subs.length}), Expo(${expoSuccessCount}) for: ${payload.title}`);

        return NextResponse.json({
            success: true,
            sentCount: webSuccessCount + expoSuccessCount,
            webCount: webSuccessCount,
            expoCount: expoSuccessCount
        });

    } catch (e) {
        console.error('Push Send Error:', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
