/**
 * Staff Notifications — Send API
 * Sends personalized notifications to employees via the existing
 * notifications table → Edge Function → Expo Push pipeline.
 */

import { apiClient } from '@/lib/api/client';
import { NextResponse } from 'next/server';

type NotificationType = 'comunicado' | 'warning' | 'urgent' | 'instruction' | 'recognition';
type TargetType = 'employee' | 'role' | 'all';

interface SendStaffNotificationRequest {
    notificationType: NotificationType;
    targetType: TargetType;
    targetEmployeeId?: string;
    targetRoles?: string[];
    title: string;
    message: string;
}

const NOTIFICATION_META: Record<NotificationType, { emoji: string; label: string }> = {
    comunicado: { emoji: '📢', label: 'Comunicado' },
    warning: { emoji: '⚠️', label: 'Llamada de Atención' },
    urgent: { emoji: '🚨', label: 'Urgente' },
    instruction: { emoji: '📋', label: 'Instrucción' },
    recognition: { emoji: '🎉', label: 'Reconocimiento' },
};

export async function POST(req: Request) {
    try {
        const authHeader = req.headers.get('Authorization');
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

        const { data: senderEmpData } = await apiClient.get('/system/crud/employees', {
            params: { user_id: user.id }
        });
        const senderEmployees = Array.isArray(senderEmpData) ? senderEmpData : (senderEmpData?.items || senderEmpData?.results || []);
        const senderEmployee = senderEmployees[0];

        const senderRole = senderEmployee?.role || 'admin';
        const senderName = senderEmployee
            ? `${senderEmployee.first_name || ''} ${senderEmployee.last_name || ''}`.trim() || 'Administración'
            : user.email || 'Administración';

        if (!['admin', 'manager', 'supervisor'].includes(senderRole)) {
            return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
        }

        const payload: SendStaffNotificationRequest = await req.json();

        if (!payload.title?.trim() || !payload.message?.trim()) {
            return NextResponse.json({ error: 'Título y mensaje son requeridos' }, { status: 400 });
        }

        if (!payload.notificationType || !NOTIFICATION_META[payload.notificationType]) {
            return NextResponse.json({ error: 'Tipo de notificación inválido' }, { status: 400 });
        }

        let targetAuthUserIds: string[] = [];

        if (payload.targetType === 'employee') {
            if (!payload.targetEmployeeId) {
                return NextResponse.json({ error: 'Empleado destino requerido' }, { status: 400 });
            }
            const { data: empData } = await apiClient.get(`/system/crud/employees/${payload.targetEmployeeId}`);
            if (empData?.auth_user_id) {
                targetAuthUserIds = [empData.auth_user_id];
            }
        } else if (payload.targetType === 'role') {
            if (!payload.targetRoles?.length) {
                return NextResponse.json({ error: 'Roles destino requeridos' }, { status: 400 });
            }
            const { data: empsData } = await apiClient.get('/system/crud/employees', {
                params: { is_active: true }
            });
            const emps = Array.isArray(empsData) ? empsData : (empsData?.items || empsData?.results || []);
            targetAuthUserIds = emps
                .filter((e: any) => payload.targetRoles?.includes(e.role))
                .map((e: any) => e.auth_user_id)
                .filter(Boolean);
        } else if (payload.targetType === 'all') {
            const { data: empsData } = await apiClient.get('/system/crud/employees', {
                params: { is_active: true }
            });
            const emps = Array.isArray(empsData) ? empsData : (empsData?.items || empsData?.results || []);
            targetAuthUserIds = emps.map((e: any) => e.auth_user_id).filter(Boolean);
        }

        targetAuthUserIds = [...new Set(targetAuthUserIds)];

        if (targetAuthUserIds.length === 0) {
            return NextResponse.json({
                error: 'No se encontraron empleados activos con ese criterio',
                sentCount: 0,
            }, { status: 404 });
        }

        const meta = NOTIFICATION_META[payload.notificationType];
        const notificationTitle = `${meta.emoji} ${payload.title}`;
        const notificationData = {
            type: 'STAFF_BROADCAST',
            notificationType: payload.notificationType,
            senderName,
            senderId: senderEmployee?.id || user.id,
        };

        const rows = targetAuthUserIds.map(uid => ({
            user_id: uid,
            type: 'system_alert',
            title: notificationTitle,
            message: payload.message,
            data: notificationData,
            is_read: false,
        }));

        await apiClient.post('/system/crud/notifications', rows);

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
