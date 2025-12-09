"use client";

import { Button } from "@/components/ui/button";

interface RoomReminderAlertProps {
  isOpen: boolean;
  roomNumber: string;
  minutes: number;
  level: "20" | "5";
  onClose: () => void;
}

export function RoomReminderAlert({
  isOpen,
  roomNumber,
  minutes,
  level,
  onClose,
}: RoomReminderAlertProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-background border rounded-lg shadow-lg w-full max-w-sm mx-4 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-center">
          {level === "5"
            ? "Habitación a punto de vencer"
            : "Habitación próxima a vencer"}
        </h2>
        <p className="text-sm text-muted-foreground text-center">
          La habitación <span className="font-semibold">{roomNumber}</span>{" "}
          está por terminar su tiempo.
          <br />
          Restante: {minutes} minutos.
        </p>
        <div className="flex justify-center pt-2">
          <Button onClick={onClose}>Aceptar</Button>
        </div>
      </div>
    </div>
  );
}
