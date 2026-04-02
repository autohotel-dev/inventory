import { useState, useEffect } from "react";
import { toast } from "sonner";
import { getActiveStay } from "@/hooks/use-room-actions";
import type { Room } from "@/components/sales/room-types";

interface ReminderAlert {
  roomNumber: string;
  minutes: number;
  level: "20" | "5";
}

/**
 * Hook dedicado a la gestión de recordatorios (CronJob local).
 * Evalúa los tiempos de expiración y emite alertas (sonoras y visuales)
 * para los recepcionistas a los 20 y 5 minutos antes del vencimiento.
 */
export function useCheckoutReminders(rooms: Room[], playAlert: () => void) {
  const [reminderNotifiedStayIds20, setReminderNotifiedStayIds20] = useState<string[]>([]);
  const [reminderNotifiedStayIds5, setReminderNotifiedStayIds5] = useState<string[]>([]);

  const [reminderAlert, setReminderAlert] = useState<ReminderAlert | null>(null);

  // Exponer método para dispensar la alerta visual en el board
  const dismissReminder = () => setReminderAlert(null);

  useEffect(() => {
    const interval = setInterval(() => {
      try {
        rooms.forEach((room) => {
          if (room.status !== "OCUPADA") return;
          const activeStay = getActiveStay(room);
          if (!activeStay || !activeStay.expected_check_out_at) return;

          const checkout = new Date(activeStay.expected_check_out_at);
          const now = new Date();
          const diffMs = checkout.getTime() - now.getTime();
          const diffMinutes = Math.floor(diffMs / 60000);

          // Aviso 20 minutos antes
          if (
            diffMinutes <= 20 &&
            diffMinutes > 5 &&
            !reminderNotifiedStayIds20.includes(activeStay.id)
          ) {
            setReminderNotifiedStayIds20((prev) => [...prev, activeStay.id]);
            toast.warning("Habitación próxima a vencer", {
              description: `La habitación ${room.number} está por terminar su tiempo. Restante: ${diffMinutes} minutos`,
            });
            setReminderAlert({ roomNumber: room.number, minutes: diffMinutes, level: "20" });
          }

          // Aviso 5 minutos antes, con sonido opcional
          if (
            diffMinutes <= 5 &&
            diffMinutes > 0 &&
            !reminderNotifiedStayIds5.includes(activeStay.id)
          ) {
            setReminderNotifiedStayIds5((prev) => [...prev, activeStay.id]);
            toast.error("Habitación a punto de vencer", {
              description: `La habitación ${room.number} está por terminar su tiempo. Restante: ${diffMinutes} minutos`,
            });

            // Usar sonido centralizado
            playAlert();

            setReminderAlert({ roomNumber: room.number, minutes: diffMinutes, level: "5" });
          }
        });
      } catch (e) {
        console.error("Error checking room reminders", e);
      }
    }, 60000); // Revisar cada minuto

    return () => clearInterval(interval);
  }, [rooms, reminderNotifiedStayIds20, reminderNotifiedStayIds5, playAlert]);

  return { reminderAlert, dismissReminder };
}
