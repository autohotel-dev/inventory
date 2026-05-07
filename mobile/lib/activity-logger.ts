import { apiClient } from './api/client';

export async function logActivity({
    action,
    room_number,
    employee_id,
    recipient_id,
    details,
    reason,
    valet_id,
}: {
    action: string;
    room_number?: string;
    employee_id?: string;
    recipient_id?: string;
    details?: string;
    reason?: string;
    valet_id?: string;
}) {
    try {
        await apiClient.post('/system/crud/audit_logs', [{
            event_type: 'MOBILE_ACTION',
            entity_type: 'mobile_app',
            entity_id: '00000000-0000-0000-0000-000000000000',
            action,
            room_number,
            employee_id,
            description: details || 'Activity from mobile app',
            metadata: {
                reason,
                recipient_id,
                valet_id
            },
            created_at: new Date().toISOString()
        }]);
    } catch (err) {
        console.error("Critical error in logActivity:", err);
    }
}
