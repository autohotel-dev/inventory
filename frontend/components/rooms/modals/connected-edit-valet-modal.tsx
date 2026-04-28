"use client";

import { Room } from "@/components/sales/room-types";
import { EditValetModal } from "@/components/sales/edit-valet-modal";
import { getActiveStay } from "@/hooks/room-actions";
import { toast } from "sonner";

interface ConnectedEditValetModalProps {
  room: Room | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ConnectedEditValetModal({
  room,
  isOpen,
  onClose,
  onSuccess,
}: ConnectedEditValetModalProps) {
  const activeStay = room ? getActiveStay(room) : null;

  const handleSuccess = () => {
    toast.success("Cochero actualizado");
    onSuccess();
    onClose();
  };

  return (
    <EditValetModal
      isOpen={isOpen && !!room}
      roomNumber={room?.number || ""}
      currentValetId={activeStay?.valet_employee_id || null}
      stayId={activeStay?.id || ""}
      onClose={onClose}
      onSuccess={handleSuccess}
    />
  );
}
