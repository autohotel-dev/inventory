import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/utils/logger";

/**
 * Notifica a los empleados con rol 'valet' o 'cochero' que tengan un turno activo.
 * 
 * Usa un RPC (notify_valets) con SECURITY DEFINER en Supabase para bypass RLS.
 * La recepcionista puede llamar esta función y la BD se encarga de encontrar
 * a los cocheros y crear las notificaciones internamente.
 * 
 * El webhook de la BD detectará los INSERTs en `notifications` y disparará
 * la Edge Function para enviar push notifications.
 */
export async function notifyActiveValets(
    title: string,
    message: string,
    data: any
) {
    try {
        const response = await apiClient.post("/system/notifications/valets", {
            title: title,
            message: message,
            data: data || {},
        });
        const result = response.data;
        const error = null;

        if (error) {
            logger.error("Error calling notify_valets RPC", error);
            return;
        }

        if (result?.sent > 0) {
            logger.info(`Notification sent to ${result.sent} valet(s)`, {
                title,
                activeSessionsFound: result.active_sessions,
                fallback: result.fallback
            });
        } else {
            logger.info("No valets found to notify", { title, result });
        }

    } catch (error) {
        logger.error("Error in notifyActiveValets helper", error);
    }
}

/**
 * Envía una notificación dirigida a un empleado específico.
 * 
 * Busca el auth_user_id del empleado e inserta directamente en la tabla `notifications`.
 * El canal Realtime de la app móvil detectará el INSERT y mostrará la alerta in-app.
 * Además, el trigger de la BD disparará la Edge Function para enviar push notification.
 */
export async function createAdminNotificationForEmployee(
    employeeId: string,
    title: string,
    message: string,
    data: any
) {
    try {
        // Send a post request to the FastAPI backend, which will handle auth_user_id resolution, 
        // Realtime insertions and Push notifications via Expo
        await apiClient.post(`/system/notifications/employee/${employeeId}`, {
            title,
            message,
            data: data || {},
            type: 'system_alert'
        });
        
        logger.info(`Notificación enviada a empleado ${employeeId}: ${title}`);
    } catch (error) {
        logger.error(`Error enviando notificación a empleado ${employeeId}:`, error);
    }
}
