"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Room } from "@/components/sales/room-types";
import { CancelStayModal } from "@/components/sales/cancel-stay-modal";
import { getActiveStay } from "@/hooks/use-room-actions";

interface ConnectedCancelStayModalProps {
  room: Room | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ConnectedCancelStayModal({
  room,
  isOpen,
  onClose,
  onSuccess,
}: ConnectedCancelStayModalProps) {
  const [loading, setLoading] = useState(false);

  const activeStay = room ? getActiveStay(room) : null;
  const salesOrderId = activeStay?.sales_order_id || "";

  const elapsedMinutes = (() => {
    if (!activeStay?.check_in_at) return 0;
    const checkIn = new Date(activeStay.check_in_at);
    return Math.floor((new Date().getTime() - checkIn.getTime()) / 60000);
  })();

  const handleConfirm = async (data: { reason: string; refundType?: "none" | "partial" | "full"; refundAmount?: number }) => {
    if (!room || !activeStay) return;

    setLoading(true);
    const supabase = createClient();

    try {
      // 1. Finalizar la estancia como CANCELADA
      const { error: stayError } = await supabase
        .from("room_stays")
        .update({
          status: "CANCELADA",
          actual_check_out_at: new Date().toISOString(),
        })
        .eq("id", activeStay.id);
      
      if (stayError) throw stayError;

      // 2. Marcar habitación como SUCIA
      const { error: roomError } = await supabase
        .from("rooms")
        .update({ status: "SUCIA" })
        .eq("id", room.id);
      
      if (roomError) throw roomError;

      // 3. Calcular monto retenido y actualizar orden
      const { data: currentOrder } = await supabase
        .from("sales_orders")
        .select("paid_amount")
        .eq("id", activeStay.sales_order_id)
        .single();

      const totalPaid = currentOrder?.paid_amount || 0;
      let retainedAmount = 0;
      const refundType = data.refundType || "none";
      const refundAmount = data.refundAmount || 0;

      if (refundType === "none") {
        retainedAmount = totalPaid;
      } else if (refundType === "full") {
        retainedAmount = 0;
      } else if (refundType === "partial") {
        retainedAmount = Math.max(0, totalPaid - refundAmount);
      }

      const orderUpdateNote = `❌ CANCELADA: ${data.reason}. Reembolso: ${refundType === "full" ? "Total" : refundType === "partial" ? `Parcial $${refundAmount}` : "Sin reembolso"} (Retenido: $${retainedAmount})`;

      const { error: orderError } = await supabase
        .from("sales_orders")
        .update({ 
          status: "CANCELLED",
          subtotal: retainedAmount,
          total: retainedAmount,
          paid_amount: retainedAmount,
          remaining_amount: 0,
          notes: orderUpdateNote
        })
        .eq("id", activeStay.sales_order_id);
      
      if (orderError) throw orderError;

      // 4. Borrar historial de habitación para esta orden
      const { error: historyError } = await supabase
        .from("room_status_history")
        .delete()
        .eq("sales_order_id", activeStay.sales_order_id);

      if (historyError) throw historyError;

      // 5. Agregar nota final si existían previas (opcional, ya lo sobreescribimos pero concatenamos mejor)
      const { data: orderData } = await supabase
        .from("sales_orders")
        .select("notes")
        .eq("id", activeStay.sales_order_id)
        .single();

      // Ensure the old notes stay, append the new cancel note
      const oldNotes = orderData?.notes ? orderData.notes.replace(orderUpdateNote, "").trim() : "";
      const newNotes = `${oldNotes}\n${orderUpdateNote}`.trim();
      
      await supabase
        .from("sales_orders")
        .update({ notes: newNotes })
        .eq("id", activeStay.sales_order_id);

      toast.success("Estancia cancelada", {
        description: `Hab. ${room.number} - ${refundType !== "none" ? `Reembolso: $${refundAmount.toFixed(2)}` : "Sin reembolso"}`,
      });

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error al cancelar estancia:", error);
      toast.error("Error al cancelar la estancia", {
        description: "Ocurrió un error inesperado al procesar la cancelación.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <CancelStayModal
      isOpen={isOpen && !!room}
      salesOrderId={salesOrderId}
      roomNumber={room?.number || ""}
      roomTypeName={room?.room_types?.name || ""}
      elapsedMinutes={elapsedMinutes}
      actionLoading={loading}
      onClose={onClose}
      onConfirm={handleConfirm}
    />
  );
}
