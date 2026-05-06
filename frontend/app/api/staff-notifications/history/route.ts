/**
 * Staff Notifications — History API
 * Returns the latest staff broadcast notifications for the admin panel history view.
 */

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        // 1. Verify authentication
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        // 2. Verify role
        const adminSupabase = createAdminClient();
        const { data: employee } = await adminSupabase
            .from('employees')
            .select('role')
            
            ;

        const senderRole = employee?.role || 'admin';
        if (!['admin', 'manager', 'supervisor'].includes(senderRole)) {
            return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
        }

        // 3. Fetch latest staff broadcast notifications (deduplicated by title+message+timestamp)
        // Since we insert one row per employee, we group by the notification content
        const { data: notifications, error } = await adminSupabase
            .from('notifications')
            .select('id, title, message, data, created_at, is_read')
            
            
            
            .limit(100);

        if (error) {
            console.error('[Staff Notifications] History fetch error:', error);
            return NextResponse.json({ error: 'Error al obtener historial' }, { status: 500 });
        }

        // Deduplicate: group by title + message + truncated timestamp (same second = same batch)
        const groupedMap = new Map<string, {
            title: string;
            message: string;
            data: any;
            created_at: string;
            recipientCount: number;
        }>();

        for (const notif of (notifications || [])) {
            // Use title + message + timestamp (truncated to second) as key
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
