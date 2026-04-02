"use client";

import { useState } from "react";
import { RoomStatusNoteModal } from "@/components/sales/room-status-note-modal";
import { Room } from "@/components/sales/room-types";

interface ConnectedStatusNoteModalProps {
  isOpen: boolean;
  selectedRoom: Room | null;
  actionType: "BLOCK" | "DIRTY" | null;
  onClose: () => void;
  updateRoomStatus: (
    room: Room,
    status: "LIBRE" | "OCUPADA" | "SUCIA" | "BLOQUEADA",
    historyAction: string,
    note?: string
  ) => Promise<void>;
}

export function ConnectedStatusNoteModal({
  isOpen,
  selectedRoom,
  actionType,
  onClose,
  updateRoomStatus,
}: ConnectedStatusNoteModalProps) {
  const [actionLoading, setActionLoading] = useState(false);

  const handleConfirmStatusChange = async (note: string) => {
    if (!selectedRoom || !actionType) return;

    setActionLoading(true);
    try {
      if (actionType === "BLOCK") {
        await updateRoomStatus(
          selectedRoom,
          "BLOQUEADA",
          "Habitación bloqueada",
          note
        );
      } else if (actionType === "DIRTY") {
        await updateRoomStatus(
          selectedRoom,
          "SUCIA",
          "Habitación marcada como sucia/mantenimiento",
          note
        );
      }
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <RoomStatusNoteModal
      isOpen={isOpen && !!selectedRoom}
      onClose={onClose}
      onConfirm={handleConfirmStatusChange}
      title={
        actionType === "BLOCK"
          ? "Bloquear Habitación"
          : "Marcar como Sucia / Mantenimiento"
      }
      description={
        actionType === "BLOCK"
          ? "Indica el motivo por el cual se bloqueará la habitación."
          : "Indica el motivo de mantenimiento o limpieza especial."
      }
      confirmLabel={actionType === "BLOCK" ? "Bloquear" : "Marcar Sucia"}
      loading={actionLoading}
      initialNote={selectedRoom?.notes || ""}
    />
  );
}
