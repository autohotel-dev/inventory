import { apiClient } from "@/lib/api/client";
import { createClient } from "@/lib/supabase/client";
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
    supabase: any,
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
    supabase: ReturnType<typeof createClient>,
    employeeId: string,
    title: string,
    message: string,
    data: any
) {
    try {
        // Obtener auth_user_id y push_token del empleado
        const { data: emp, error: empError } = await supabase
            .from('employees')
            .select('auth_user_id, push_token')
            
            ;

        if (empError || !emp?.auth_user_id) {
            logger.error("No se encontró auth_user_id para el empleado", { employeeId, empError });
            return;
        }

        // 1. Insertar notificación en la tabla (esto dispara Realtime in-app)
        const { error: notifError } = await supabase
            .from('notifications')
            .insert({
                user_id: emp.auth_user_id,
                type: 'system_alert',
                title,
                message,
                data: data || {},
                is_read: false,
            });

        if (notifError) {
            logger.error("Error insertando notificación para empleado", notifError);
        } else {
            logger.info(`Notificación Realtime enviada a empleado ${employeeId}: ${title}`);
        }

        // 2. Enviar push notification directa vía Expo (para cuando la app está en segundo plano)
        if (emp.push_token && emp.push_token.startsWith('ExponentPushToken[')) {
            try {
                await fetch('https://exp.host/--/api/v2/push/send', {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Accept-encoding': 'gzip, deflate',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        to: emp.push_token,
                        sound: 'default',
                        title,
                        body: message,
                        data: data || {},
                    }),
                });
                logger.info(`Push notification enviada a ${employeeId} via Expo`);
            } catch (pushError) {
                logger.error("Error enviando push notification via Expo", pushError);
            }
        }
    } catch (error) {
        logger.error("Error en createAdminNotificationForEmployee", error);
    }
}
