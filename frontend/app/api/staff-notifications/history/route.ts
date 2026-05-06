/**
 * Staff Notifications — History API
 * Returns the latest staff broadcast notifications for the admin panel history view.
 */

import { apiClient } from '@/lib/api/client';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const userRes = await apiClient.get('/system/auth/me', {
            headers: { Authorization: authHeader }
        }).catch((e: any) => ({ data: null }));
        const user = userRes.data;

        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const { data: employees } = await apiClient.get('/system/crud/employees', {
            params: { user_id: user.id }
        });
        const employee = Array.isArray(employees) ? employees[0] : (employees?.items?.[0] || employees?.results?.[0]);

        const senderRole = employee?.role || 'admin';
        if (!['admin', 'manager', 'supervisor'].includes(senderRole)) {
            return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
        }

        const { data: notificationsData } = await apiClient.get('/system/crud/notifications', {
            params: {
                limit: 100,
                order_by: '-created_at'
            }
        });
        
        const notifications = Array.isArray(notificationsData) ? notificationsData : (notificationsData?.items || notificationsData?.results || []);

        const groupedMap = new Map<string, {
            title: string;
            message: string;
            data: any;
            created_at: string;
            recipientCount: number;
        }>();

        for (const notif of notifications) {
            const tsKey = notif.created_at?.substring(0, 19) || '';
            const key = `${notif.title}|${notif.message}|${tsKey}`;

            if (groupedMap.has(key)) {
                groupedMap.get(key)!.recipientCount++;
            } else {
                groupedMap.set(key, {
                    title: notif.title,
                    message: notif.message,
                    data: notif.data,
                    created_at: notif.created_at,
                    recipientCount: 1,
                });
            }
        }

        const grouped = Array.from(groupedMap.values()).slice(0, 20);

        return NextResponse.json({ notifications: grouped });

    } catch (e) {
        console.error('[Staff Notifications] History exception:', e);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
