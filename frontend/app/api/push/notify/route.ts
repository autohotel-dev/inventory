
import { NextResponse } from 'next/server';
import webpush from 'web-push';

// Webhook payload from Supabase
interface WebhookPayload {
    type: 'INSERT' | 'UPDATE' | 'DELETE';
    table: string;
    record: any;
    old_record?: any;
    schema: string;
}

export async function POST(req: Request) {
    try {
        // Simple authentication check - recommend using a secret header
        const authHeader = req.headers.get('Authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            // Optional: return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            // For now, let's just log and continue or add a safer check later
        }

        const payload: WebhookPayload = await req.json();
        

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

        let notificationContent = {
            title: '',
            body: '',
            url: '/valet',
            tag: '',
            roles: [] as string[]
        };

        // 1. Determine notification content based on the event
        if (payload.table === 'room_stays') {
            
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            const roomRes = await fetch(`${apiUrl}/system/crud/rooms/${payload.record.room_id}`);
            const roomData = roomRes.ok ? await roomRes.json() : null;
            const room = { number: roomData?.number };
        
            const roomNum = room?.number || '??';

            if (payload.type === 'INSERT') {
                notificationContent = {
                    title: '🚗 Nueva Entrada',
                    body: `Habitación ${roomNum}`,
                    url: '/valet',
                    tag: `entry-${payload.record.id}`,
                    roles: ['valet']
                };
            } else if (payload.type === 'UPDATE') {
                // Vehicle requested
                if (!payload.old_record?.vehicle_requested_at && payload.record.vehicle_requested_at) {
                    notificationContent = {
                        title: '🚨 SOLICITUD DE AUTO',
                        body: `Habitación ${roomNum}`,
                        url: '/valet',
                        tag: `req-${payload.record.id}`,
                        roles: ['valet']
                    };
                }
                // Valet checkout requested
                if (!payload.old_record?.valet_checkout_requested_at && payload.record.valet_checkout_requested_at) {
                    notificationContent = {
                        title: '🔔 SOLICITUD DE SALIDA',
                        body: `Habitación ${roomNum}`,
                        url: '/sales/pos',
                        tag: `checkout-${payload.record.id}`,
                        roles: ['receptionist']
                    };
                }
            }
        } else if (payload.table === 'sales_order_items' && payload.type === 'INSERT') {
            // CONSUMPTIONS: Skip here — already handled by notifyActiveValets() in add-consumption-modal.tsx
            // which sends a single, detailed push notification with all product names.
            // This webhook fires per-item, causing N duplicate "Nuevo Consumo" notifications.
            if (payload.record.concept_type === 'CONSUMPTION') {
                return NextResponse.json({ message: 'Consumption notification handled by RPC' });
            }
        }

        if (!notificationContent.title) {
            return NextResponse.json({ message: 'No notification needed' });
        }

        // 2. Fetch subscribers based on roles
        
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const empRes = await fetch(`${apiUrl}/system/crud/employees`);
        const allEmps = empRes.ok ? await empRes.json() : [];
        const employees = allEmps.filter((e:any) => notificationContent.roles.includes(e.role));
        

        if (!employees?.length) {
            return NextResponse.json({ message: 'No target employees' });
        }

        const employeeIds = employees.map((e: any) => e.id);
        
        const subsRes = await fetch(`${apiUrl}/system/crud/push_subscriptions`);
        const allSubs = subsRes.ok ? await subsRes.json() : [];
        const subs = allSubs.filter((s:any) => employeeIds.includes(s.employee_id));
        

        if (!subs?.length) {
            return NextResponse.json({ message: 'No active subscriptions' });
        }

        // 3. Send notifications
        const notificationPayload = JSON.stringify({
            title: notificationContent.title,
            body: notificationContent.body,
            data: { url: notificationContent.url },
            tag: notificationContent.tag
        });

        const results = await Promise.allSettled(subs.map((sub: any) => {
            const pushSub = {
                endpoint: sub.subscription.endpoint,
                keys: {
                    auth: sub.subscription.keys.auth,
                    p256dh: sub.subscription.keys.p256dh
                }
            };
            return webpush.sendNotification(pushSub, notificationPayload);
        }));

        console.log(`Sent ${results.filter(r => r.status === 'fulfilled').length} push notifications.`);

        return NextResponse.json({ 
            success: true, 
            sentCount: results.filter(r => r.status === 'fulfilled').length 
        });

    } catch (e) {
        console.error('Push Notification Error:', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
