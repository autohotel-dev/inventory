import { createClient } from "@/lib/supabase/client";
import { logger } from "@/lib/utils/logger";

/**
 * Notifica a los empleados con rol 'valet' o 'cochero' que tengan un turno activo.
 * 
 * @param supabase Cliente de Supabase
 * @param title Título de la notificación
 * @param message Mensaje de la notificación
 * @param data Datos adicionales para la notificación (navegación, IDs, etc.)
 */
export async function notifyActiveValets(
    supabase: ReturnType<typeof createClient>,
    title: string,
    message: string,
    data: any
) {
    try {
        // 1. Buscar sesiones activas de valets/cocheros
        const { data: activeSessions } = await supabase
            .from("shift_sessions")
            .select(`
        employees!inner (
          auth_user_id,
          role
        )
      `)
            .eq("status", "active")
            .in("employees.role", ["valet", "cochero", "Cochero"])
            .not("employees.auth_user_id", "is", null);

        if (!activeSessions || activeSessions.length === 0) {
            logger.info("No active valets found to notify", { title });
            return;
        }

        // 2. Extraer IDs únicos (para evitar duplicados)
        const uniqueUserIds = new Set<string>();
        activeSessions.forEach((session: any) => {
            if (session.employees?.auth_user_id) {
                uniqueUserIds.add(session.employees.auth_user_id);
            }
        });

        if (uniqueUserIds.size === 0) return;

        // 3. Insertar notificación para CADA usuario activo
        const notificationsToInsert = Array.from(uniqueUserIds).map((userId) => ({
            user_id: userId,
            type: "system_alert",
            title: title,
            message: message,
            data: data,
            is_read: false,
        }));

        const { error } = await supabase.from("notifications").insert(notificationsToInsert);

        if (error) {
            logger.error("Error inserting notifications for active valets", error);
        } else {
            logger.info(`Notification sent to ${uniqueUserIds.size} active valets`, { title });
        }

    } catch (error) {
        logger.error("Error in notifyActiveValets helper", error);
    }
}
