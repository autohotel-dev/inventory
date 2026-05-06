/**
 * Staff Notifications — Send API
 * Sends personalized notifications to employees via the existing
 * notifications table → Edge Function → Expo Push pipeline.
 */

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

type NotificationType = 'comunicado' | 'warning' | 'urgent' | 'instruction' | 'recognition';
type TargetType = 'employee' | 'role' | 'all';

interface SendStaffNotificationRequest {
    notificationType: NotificationType;
    targetType: TargetType;
    targetEmployeeId?: string;   // when targetType === 'employee'
    targetRoles?: string[];      // when targetType === 'role'
    title: string;
    message: string;
}

// Map notification types to display metadata
const NOTIFICATION_META: Record<NotificationType, { emoji: string; label: string }> = {
    comunicado: { emoji: '📢', label: 'Comunicado' },
    warning: { emoji: '⚠️', label: 'Llamada de Atención' },
    urgent: { emoji: '🚨', label: 'Urgente' },
    instruction: { emoji: '📋', label: 'Instrucción' },
    recognition: { emoji: '🎉', label: 'Reconocimiento' },
};

export async function POST(req: Request) {
    try {
        // 1. Verify authentication
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        // 2. Verify role is admin, manager, or supervisor
        const adminSupabase = createAdminClient();
        const { data: senderEmployee } = await adminSupabase
            .from('employees')
            .select('id, first_name, last_name, role')
            
            ;

        // If no employee record found, the user might be a direct admin (fallback in use-user-role.ts)
        // Allow them to proceed as admin
        const senderRole = senderEmployee?.role || 'admin';
        const senderName = senderEmployee
            ? `${senderEmployee.first_name || ''} ${senderEmployee.last_name || ''}`.trim() || 'Administración'
            : user.email || 'Administración';

        if (!['admin', 'manager', 'supervisor'].includes(senderRole)) {
            return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
        }

        // 3. Parse and validate payload
        const payload: SendStaffNotificationRequest = await req.json();

        if (!payload.title?.trim() || !payload.message?.trim()) {
            return NextResponse.json({ error: 'Título y mensaje son requeridos' }, { status: 400 });
        }

        if (!payload.notificationType || !NOTIFICATION_META[payload.notificationType]) {
            return NextResponse.json({ error: 'Tipo de notificación inválido' }, { status: 400 });
        }

        // 4. Resolve target auth_user_ids
        let targetAuthUserIds: string[] = [];

        if (payload.targetType === 'employee') {
            if (!payload.targetEmployeeId) {
                return NextResponse.json({ error: 'Empleado destino requerido' }, { status: 400 });
            }
            const { data: emp } = await adminSupabase
                .from('employees')
                .select('auth_user_id')
                
                
                
                ;

            if (emp?.auth_user_id) {
                targetAuthUserIds = [emp.auth_user_id];
            }
        } else if (payload.targetType === 'role') {
            if (!payload.targetRoles?.length) {
                return NextResponse.json({ error: 'Roles destino requeridos' }, { status: 400 });
            }
            const { data: emps } = await adminSupabase
                .from('employees')
                .select('auth_user_id')
                .in('role', payload.targetRoles)
                
                ;

            targetAuthUserIds = (emps || []).map(e => e.auth_user_id).filter(Boolean) as string[];
        } else if (payload.targetType === 'all') {
            const { data: emps } = await adminSupabase
                .from('employees')
                .select('auth_user_id')
                
                ;

            targetAuthUserIds = (emps || []).map(e => e.auth_user_id).filter(Boolean) as string[];
        }

        // Deduplicate
        targetAuthUserIds = [...new Set(targetAuthUserIds)];

        if (targetAuthUserIds.length === 0) {
            return NextResponse.json({
                error: 'No se encontraron empleados activos con ese criterio',
                sentCount: 0,
            }, { status: 404 });
        }

        // 5. Build notification data
        const meta = NOTIFICATION_META[payload.notificationType];
        const notificationTitle = `${meta.emoji} ${payload.title}`;
        const notificationData = {
            type: 'STAFF_BROADCAST',
            notificationType: payload.notificationType,
            senderName,
            senderId: senderEmployee?.id || user.id,
        };

        // 6. Insert into notifications table (this triggers the Edge Function webhook)
        const rows = targetAuthUserIds.map(uid => ({
            user_id: uid,
            type: 'system_alert',
            title: notificationTitle,
            message: payload.message,
            data: notificationData,
            is_read: false,
        }));

        const { error: insertError, count } = await adminSupabase
            .from('notifications')
            .insert(rows);

        if (insertError) {
            console.error('[Staff Notifications] Insert error:', insertError);
            return NextResponse.json({ error: 'Error al enviar notificaciones' }, { status: 500 });
        }

        console.log(`[Staff Notifications] Sent ${targetAuthUserIds.length} notifications of type "${payload.notificationType}" by ${senderName}`);

        return NextResponse.json({
            success: true,
            sentCount: targetAuthUserIds.length,
            notificationType: payload.notificationType,
        });

    } catch (e) {
        console.error('[Staff Notifications] Exception:', e);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
