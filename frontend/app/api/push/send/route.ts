import { apiClient } from '@/lib/api/client';
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
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const userRes = await apiClient.get('/system/auth/me', {
            headers: { Authorization: authHeader }
        }).catch((e: any) => ({ data: null }));
        const user = userRes.data;

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
        const { data: empData } = await apiClient.get('/system/crud/employees', {
            params: { is_active: true }
        });
        const allEmployees = Array.isArray(empData) ? empData : (empData?.items || empData?.results || []);
        const employees = allEmployees.filter((e: any) => payload.roles.includes(e.role));

        if (!employees?.length) {
            return NextResponse.json({ message: 'No target employees', sentCount: 0 });
        }

        const employeeIds = employees.map((e: any) => e.id);
        
        // Fetch push subscriptions for those employees
        const { data: subsData } = await apiClient.get('/system/crud/push_subscriptions');
        const allSubs = Array.isArray(subsData) ? subsData : (subsData?.items || subsData?.results || []);
        const subs = allSubs.filter((s: any) => employeeIds.includes(s.employee_id));

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
        const webPushResults = await Promise.allSettled(subs.map((sub: any) => {
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
        // DESACTIVADO: La responsabilidad de enviar notificaciones móviles ahora recae en 
        // los Triggers de Supabase y la Edge Function 'send-push-notification' para evitar duplicados.

        const expoSuccessCount = 0;

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
