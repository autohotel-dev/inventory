import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { getActiveStay } from "@/hooks/room-actions";
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
 *
 * Uses refs for mutable state (notified IDs, rooms, playAlert) so that
 * the setInterval is created ONCE and never torn down by dependency changes.
 * The check also runs immediately on mount and whenever rooms change.
 *
 * Additionally sends Browser Notifications (native OS alerts) when the tab
 * is hidden so the receptionist gets alerted even if they're in another tab.
 */
export function useCheckoutReminders(rooms: Room[], playAlert: () => void) {
  // Use refs to avoid restarting the interval on every change
  const notified20Ref = useRef<Set<string>>(new Set());
  const notified5Ref = useRef<Set<string>>(new Set());
  const roomsRef = useRef<Room[]>(rooms);
  const playAlertRef = useRef(playAlert);

  const [reminderAlert, setReminderAlert] = useState<ReminderAlert | null>(null);

  // Keep refs in sync without restarting any effects
  useEffect(() => { roomsRef.current = rooms; }, [rooms]);
  useEffect(() => { playAlertRef.current = playAlert; }, [playAlert]);

  // Request browser notification permission on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {
        // Ignore — permission denied or not supported
      });
    }
  }, []);

  // Exponer método para dispensar la alerta visual en el board
  const dismissReminder = useCallback(() => setReminderAlert(null), []);

  /**
   * Send a native browser notification when the tab is in the background.
   * Falls back silently if permission is not granted.
   */
  const sendBrowserNotification = useCallback((title: string, body: string, tag: string) => {
    try {
      if (
        typeof document !== "undefined" &&
        document.hidden &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        new Notification(title, {
          body,
          tag, // prevents duplicates for the same stay
          icon: "/icons/icon-192.png",
          requireInteraction: true,
        });
      }
    } catch {
      // Notification API may throw in restricted contexts — ignore
    }
  }, []);

  // Core check function – reads from refs, so it's always up to date
  const checkReminders = useCallback(() => {
    try {
      const currentRooms = roomsRef.current;
      currentRooms.forEach((room) => {
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
          !notified20Ref.current.has(activeStay.id)
        ) {
          notified20Ref.current.add(activeStay.id);
          toast.warning("Habitación próxima a vencer", {
            description: `La habitación ${room.number} está por terminar su tiempo. Restante: ${diffMinutes} minutos`,
          });
          setReminderAlert({ roomNumber: room.number, minutes: diffMinutes, level: "20" });

          // Browser notification for background tabs
          sendBrowserNotification(
            `⏰ Hab. ${room.number} — ${diffMinutes} min`,
            "El tiempo de estancia está por terminar. Prepárate para el cobro.",
            `room-20-${activeStay.id}`
          );
        }

        // Aviso 5 minutos antes, con sonido
        if (
          diffMinutes <= 5 &&
          diffMinutes > 0 &&
          !notified5Ref.current.has(activeStay.id)
        ) {
          notified5Ref.current.add(activeStay.id);
          toast.error("Habitación a punto de vencer", {
            description: `La habitación ${room.number} está por terminar su tiempo. Restante: ${diffMinutes} minutos`,
          });

          // Usar sonido centralizado
          playAlertRef.current();

          setReminderAlert({ roomNumber: room.number, minutes: diffMinutes, level: "5" });

          // Urgent browser notification for background tabs
          sendBrowserNotification(
            `🚨 ¡Hab. ${room.number} — ${diffMinutes} min!`,
            "¡La estancia está por terminar! Cobra o extiende el tiempo.",
            `room-5-${activeStay.id}`
          );
        }
      });
    } catch (e) {
      console.error("Error checking room reminders", e);
    }
  }, [sendBrowserNotification]); // sendBrowserNotification is stable (useCallback with [])

  // Run check immediately when rooms change (e.g. new stay data arrives)
  useEffect(() => {
    checkReminders();
  }, [rooms, checkReminders]);

  // Stable interval — created once, never restarted
  useEffect(() => {
    const interval = setInterval(checkReminders, 60000); // Revisar cada minuto
    return () => clearInterval(interval);
  }, [checkReminders]);

  // Cleanup stale stay IDs when stays end (prevent memory leak)
  useEffect(() => {
    const activeStayIds = new Set(
      rooms
        .filter((r) => r.status === "OCUPADA")
        .map((r) => getActiveStay(r)?.id)
        .filter(Boolean) as string[]
    );

    // Remove notified IDs for stays that no longer exist
    for (const id of notified20Ref.current) {
      if (!activeStayIds.has(id)) notified20Ref.current.delete(id);
    }
    for (const id of notified5Ref.current) {
      if (!activeStayIds.has(id)) notified5Ref.current.delete(id);
    }
  }, [rooms]);

  return { reminderAlert, dismissReminder };
}

