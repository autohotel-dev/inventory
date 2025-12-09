"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { BellRing, AlertTriangle } from "lucide-react";

export function RoomReminderDemo() {
  const [reminderAlert, setReminderAlert] = useState<{
    roomNumber: string;
    minutes: number;
    level: "20" | "5";
  } | null>(null);
  const playSound = () => {
    try {
      const audio = new Audio("/room-alert.mp3");
      audio.play().catch(() => {
        // Algunos navegadores requieren interacción previa; si falla, solo ignoramos
      });
    } catch (e) {
      console.error("Error reproduciendo sonido de prueba", e);
    }
  };

  const trigger20MinReminder = () => {
    toast.warning("Habitación próxima a vencer", {
      description: "La habitación 101 está por terminar su tiempo. Restante: 18 minutos",
    });
    playSound();
    setReminderAlert({ roomNumber: "101", minutes: 18, level: "20" });
  };

  const trigger5MinReminder = () => {
    toast.error("Habitación a punto de vencer", {
      description: "La habitación 101 está por terminar su tiempo. Restante: 5 minutos",
    });
    playSound();
    setReminderAlert({ roomNumber: "101", minutes: 5, level: "5" });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5" />
            Demo de Recordatorios de Habitaciones
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Usa estos botones para probar cómo se ven los avisos de 20 y 5 minutos, y verificar el
            sonido configurado en <code>/public/room-alert.mp3</code>.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={trigger20MinReminder}>
              <AlertTriangle className="h-4 w-4 mr-2 text-yellow-500" />
              Probar aviso 20 min
            </Button>
            <Button variant="destructive" onClick={trigger5MinReminder}>
              <BellRing className="h-4 w-4 mr-2" />
              Probar aviso 5 min (con sonido)
            </Button>
          </div>
        </CardContent>
      </Card>

      {reminderAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-background border rounded-lg shadow-lg w-full max-w-sm mx-4 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-center">
              {reminderAlert.level === "5"
                ? "Habitación a punto de vencer"
                : "Habitación próxima a vencer"}
            </h2>
            <p className="text-sm text-muted-foreground text-center">
              La habitación <span className="font-semibold">{reminderAlert.roomNumber}</span>{" "}
              está por terminar su tiempo.
              <br />
              Restante: {reminderAlert.minutes} minutos.
            </p>
            <div className="flex justify-center pt-2">
              <Button onClick={() => setReminderAlert(null)}>Aceptar</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
