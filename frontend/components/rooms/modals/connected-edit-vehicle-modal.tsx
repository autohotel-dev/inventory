"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Room } from "@/components/sales/room-types";
import { EditVehicleModal } from "@/components/sales/edit-vehicle-modal";
import { getActiveStay } from "@/hooks/room-actions";

interface ConnectedEditVehicleModalProps {
  room: Room | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ConnectedEditVehicleModal({
  room,
  isOpen,
  onClose,
  onSuccess,
}: ConnectedEditVehicleModalProps) {
  const [loading, setLoading] = useState(false);

  const activeStay = room ? getActiveStay(room) : null;

  const currentVehicle = {
    plate: activeStay?.vehicle_plate || null,
    brand: activeStay?.vehicle_brand || null,
    model: activeStay?.vehicle_model || null,
  };

  const handleSave = async (vehicle: { plate: string; brand: string; model: string }) => {
    if (!room) return;
    if (!activeStay) {
      toast.error("No se encontró una estancia activa");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    
    try {
      const { error } = await supabase
        .from("room_stays")
        .update({
          vehicle_plate: vehicle.plate.trim() || null,
          vehicle_brand: vehicle.brand.trim() || null,
          vehicle_model: vehicle.model.trim() || null,
        })
        .eq("id", activeStay.id);

      if (error) {
        console.error("Error updating vehicle:", error);
        toast.error("Error al actualizar datos del vehículo");
        return;
      }

      toast.success("Vehículo actualizado", {
        description: vehicle.plate ? `Placas: ${vehicle.plate}` : "Datos guardados",
      });
      
      onSuccess();
      onClose();
    } catch (err) {
      console.error("Unexpected error updating vehicle:", err);
      toast.error("Ocurrió un error inesperado al actualizar el vehículo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <EditVehicleModal
      isOpen={isOpen && !!room}
      roomNumber={room?.number || ""}
      currentVehicle={currentVehicle}
      actionLoading={loading}
      onClose={onClose}
      onSave={handleSave}
    />
  );
}
