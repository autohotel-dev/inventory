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
    supabase: ReturnType<typeof createClient>,
    title: string,
    message: string,
    data: any
) {
    try {
        const { data: result, error } = await supabase.rpc("send_valet_notification", {
            p_title: title,
            p_message: message,
            p_data: data || {},
        });

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
