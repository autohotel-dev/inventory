"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Room } from "@/components/sales/room-types";
import { ChangeRoomModal } from "@/components/sales/change-room-modal";
import { getActiveStay } from "@/hooks/room-actions";
import { notifyActiveValets } from "@/lib/services/valet-notification-service";
import { calculateExpectedCheckout } from "@/components/rooms/modals/connected-start-stay-modal";

interface ConnectedChangeRoomModalProps {
  room: Room | null;
  rooms: Room[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ConnectedChangeRoomModal({
  room,
  rooms,
  isOpen,
  onClose,
  onSuccess,
}: ConnectedChangeRoomModalProps) {
  const [loading, setLoading] = useState(false);

  const activeStay = room ? getActiveStay(room) : null;
  const availableRooms = rooms.filter((r) => r.status === "LIBRE");

  const currentStayMapped = activeStay ? {
    id: activeStay.id,
    check_in_at: activeStay.check_in_at || new Date().toISOString(),
    expected_check_out_at: activeStay.expected_check_out_at || new Date().toISOString(),
    current_people: activeStay.current_people || 2,
    vehicle_plate: activeStay.vehicle_plate,
    vehicle_brand: activeStay.vehicle_brand,
    vehicle_model: activeStay.vehicle_model,
    sales_order_id: activeStay.sales_order_id,
  } : null;

  const handleConfirm = async (data: { newRoomId: string; keepTime: boolean; reason: string }) => {
    if (!room || !activeStay) return;

    setLoading(true);
    const supabase = createClient();

    try {
      const newRoom = rooms.find((r) => r.id === data.newRoomId);
      if (!newRoom) throw new Error("Habitación no encontrada");
      
      const roomType = newRoom.room_types;
      if (!roomType) throw new Error("Tipo de habitación no encontrado");

      // Calcular nueva hora de salida
      let newExpectedCheckout: string;
      if (data.keepTime) {
        // Mantener la hora de salida original
        newExpectedCheckout = activeStay.expected_check_out_at || new Date().toISOString();
      } else {
        // Reiniciar tiempo desde ahora
        newExpectedCheckout = calculateExpectedCheckout(roomType).toISOString();
      }

      // 1. Actualizar la estancia con la nueva habitación
      const { error: stayError } = await supabase
        .from("room_stays")
        .update({
          room_id: data.newRoomId,
          expected_check_out_at: newExpectedCheckout,
          ...(data.keepTime ? {} : { check_in_at: new Date().toISOString() }),
        })
        .eq("id", activeStay.id);

      if (stayError) throw stayError;

      // 2. Marcar habitación original como SUCIA
      await supabase
        .from("rooms")
        .update({ status: "SUCIA" })
        .eq("id", room.id);

      // 3. Marcar nueva habitación como OCUPADA
      await supabase
        .from("rooms")
        .update({ status: "OCUPADA" })
        .eq("id", data.newRoomId);

      // 4. Calcular diferencia de precio (positivo = cobro, negativo = devolución)
      const oldPrice = room.room_types?.base_price || 0;
      const newPrice = newRoom.room_types?.base_price || 0;
      const priceDifference = newPrice - oldPrice; // Positivo = upgrade, Negativo = downgrade

      if (priceDifference !== 0) {
        // Buscar producto de servicio para el item
        const { data: svcProducts, error: svcError } = await supabase
          .from("products")
          .select("id")
          .eq("sku", "SVC-ROOM")
          .limit(1);

        const svcProductId = svcProducts?.[0]?.id;

        if (svcProductId) {
          const isRefund = priceDifference < 0;
          const absAmount = Math.abs(priceDifference);

          // Insertar Item de Diferencia con PENDING_VALET
          const { data: insertedItem, error: insertError } = await supabase.from("sales_order_items").insert({
            sales_order_id: activeStay.sales_order_id,
            product_id: svcProductId,
            qty: 1,
            unit_price: absAmount,
            concept_type: "ROOM_CHANGE_ADJUSTMENT",
            delivery_notes: isRefund
              ? `Devolución por cambio: Hab ${room.number} → ${newRoom.number}`
              : `Cargo por cambio: Hab ${room.number} → ${newRoom.number}`,
            is_paid: false,
            delivery_status: "PENDING_VALET",
            issue_description: JSON.stringify({
              oldRoomNumber: room.number,
              newRoomNumber: newRoom.number,
              oldRoomType: room.room_types?.name || "---",
              newRoomType: newRoom.room_types?.name || "---",
              isRefund: isRefund,
              amount: absAmount
            })
          }).select('id').single();

          if (insertError) {
            console.error("Error inserting ROOM_CHANGE_ADJUSTMENT:", insertError);
          }

          const roomChangeItemId = insertedItem?.id;

          // Actualizar totales de la orden solo si es un upgrade (cobro)
          if (!isRefund) {
            const { data: currentOrder } = await supabase
              .from("sales_orders")
              .select("subtotal, total, remaining_amount")
              .eq("id", activeStay.sales_order_id)
              .single();

            if (currentOrder) {
              await supabase
                .from("sales_orders")
                .update({
                  subtotal: (currentOrder.subtotal || 0) + absAmount,
                  total: (currentOrder.total || 0) + absAmount,
                  remaining_amount: (currentOrder.remaining_amount || 0) + absAmount
                })
                .eq("id", activeStay.sales_order_id);
            }
          }

          // Notificar al valet si hay diferencia
          if (roomChangeItemId && !isRefund) {
            await notifyActiveValets(
              supabase,
              '💰 Cambio de Habitación (Con Diferencia)',
              `Habitación ${room.number} ➡ ${newRoom.number}. Favor de acudir a realizar cobro de $${absAmount.toFixed(2)} extra y/o mover vehículo.`,
              {
                type: 'ROOM_CHANGE_PAYMENT',
                amount: absAmount,
                oldRoomNumber: room.number,
                newRoomNumber: newRoom.number,
                stayId: activeStay.id,
                consumptionId: roomChangeItemId,
                salesOrderId: activeStay.sales_order_id
              }
            );
          } else {
            await notifyActiveValets(
              supabase,
              '🔀 Cambio de Habitación',
              `Habitación ${room.number} ➡ ${newRoom.number}. Por favor mover vehículo.`,
              {
                type: 'ROOM_CHANGE',
                oldRoomNumber: room.number,
                newRoomNumber: newRoom.number,
                stayId: activeStay.id
              }
            );
          }
        }
      } else {
        // Sin diferencia de precio
        await notifyActiveValets(
          supabase,
          '🔀 Cambio de Habitación',
          `Habitación ${room.number} ➡ ${newRoom.number}. Por favor mover vehículo.`,
          {
            type: 'ROOM_CHANGE',
            oldRoomNumber: room.number,
            newRoomNumber: newRoom.number,
            stayId: activeStay.id
          }
        );
      }

      // Actualizar notas de la orden
      const { data: orderData } = await supabase
        .from("sales_orders")
        .select("notes")
        .eq("id", activeStay.sales_order_id)
        .single();

      const chargeNote = priceDifference !== 0
        ? (priceDifference > 0 ? ` (Cobro pendiente: $${priceDifference.toFixed(2)})` : ` (Devolución pendiente: $${Math.abs(priceDifference).toFixed(2)})`)
        : "";
      const newNotes = `${orderData?.notes || ""}\n📝 CAMBIO: Hab. ${room.number} → ${newRoom.number} (${data.keepTime ? "tiempo mantenido" : "tiempo reiniciado"}). Motivo: ${data.reason}${chargeNote}`;

      await supabase
        .from("sales_orders")
        .update({ notes: newNotes.trim() })
        .eq("id", activeStay.sales_order_id);

      toast.success("Habitación cambiada", {
        description: `${room.number} → ${newRoom.number} (${data.keepTime ? "tiempo mantenido" : "tiempo reiniciado"})`,
      });

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error changing room:", error);
      toast.error("Error al cambiar habitación");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ChangeRoomModal
      isOpen={isOpen && !!room}
      currentRoom={room}
      currentStay={currentStayMapped}
      availableRooms={availableRooms}
      actionLoading={loading}
      onClose={onClose}
      onConfirm={handleConfirm}
    />
  );
}
