"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { QuickCheckinModal } from "@/components/sales/quick-checkin-modal";
import { Room } from "@/components/sales/room-types";
import {
  getReceptionShiftId,
  getReceptionEmployeeId,
  generatePaymentReference,
} from "@/hooks/room-actions";
import { useSystemConfigRead } from "@/hooks/use-system-config";
import { useThermalPrinter } from "@/hooks/use-thermal-printer";
import { getGuestPortalURL } from "@/lib/utils/guest-portal-qr";

interface ConnectedQuickCheckinModalProps {
  isOpen: boolean;
  selectedRoom: Room | null;
  pendingBacklogCount: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function ConnectedQuickCheckinModal({
  isOpen,
  selectedRoom,
  pendingBacklogCount,
  onClose,
  onSuccess,
}: ConnectedQuickCheckinModalProps) {
  const [actionLoading, setActionLoading] = useState(false);
  const systemConfig = useSystemConfigRead();
  const { printEntryTicket, printQRTicket } = useThermalPrinter();
  const MAX_PENDING_QUICK_CHECKINS = systemConfig.maxPendingQuickCheckins;

  const handleQuickCheckin = async (data: {
    initialPeople: number;
    actualEntryTime: Date;
    durationNights: number;
  }) => {
    if (!selectedRoom || !selectedRoom.room_types) return;

    if (pendingBacklogCount >= MAX_PENDING_QUICK_CHECKINS) {
      toast.error("No se puede registrar Entrada Rápida", {
        description: `Hay ${pendingBacklogCount} habitaciones con cobro pendiente. Cobra alguna para liberar al cochero.`,
      });
      return;
    }

    setActionLoading(true);
    const supabase = createClient();

    try {
      const roomType = selectedRoom.room_types;
      const entryTime = data.actualEntryTime;
      const durationNights = data.durationNights || 1;

      // Calcular hora de salida basada en la hora REAL de entrada
      let expectedCheckout: Date;
      if (roomType.is_hotel) {
        expectedCheckout = new Date(entryTime);
        expectedCheckout.setDate(expectedCheckout.getDate() + durationNights);
        expectedCheckout.setHours(12, 0, 0, 0);
      } else {
        // Determinar si estamos en período de fin de semana (Viernes 6am - Domingo 6am)
        const day = entryTime.getDay();
        const hour = entryTime.getHours();
        let isWeekendPeriod = false;

        if (day === 5 && hour >= 6) {
          isWeekendPeriod = true;
        } else if (day === 6) {
          isWeekendPeriod = true;
        } else if (day === 0 && hour < 6) {
          isWeekendPeriod = true;
        }

        const hours = isWeekendPeriod
          ? roomType.weekend_hours ?? 4
          : roomType.weekday_hours ?? 4;
        expectedCheckout = new Date(entryTime);
        expectedCheckout.setHours(expectedCheckout.getHours() + hours);
      }

      const basePrice = roomType.base_price ?? 0;
      const extraPersonPrice = roomType.extra_person_price ?? 0;
      const baseCapacity = roomType.base_capacity ?? 2; // Personas incluidas en precio base
      const extraPeopleCount = Math.max(0, data.initialPeople - baseCapacity);
      const extraPeopleCost = extraPeopleCount * extraPersonPrice;
      const totalPrice =
        (basePrice + extraPeopleCost) * (roomType.is_hotel ? durationNights : 1);

      // Obtener almacén de recepción
      const { data: defaultWarehouse, error: warehouseError } = await supabase
        .from("warehouses")
        .select("id, code, is_active")
        .eq("code", "ALM002-R")
        .eq("is_active", true)
        .single();

      if (warehouseError || !defaultWarehouse) {
        toast.error("No se encontró el almacén de recepción");
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Obtener turno actual y employee_id de Recepción
      const currentShiftId = await getReceptionShiftId(supabase);
      const currentEmployeeId = await getReceptionEmployeeId(supabase);

      // Crear orden de venta con pago PENDIENTE
      const { data: salesOrder, error: orderError } = await supabase
        .from("sales_orders")
        .insert({
          customer_id: null,
          warehouse_id: defaultWarehouse.id,
          currency: "MXN",
          notes: `⚡ ENTRADA RÁPIDA - Hab. ${selectedRoom.number} ${
            roomType.name
          }${extraPeopleCount > 0 ? ` (+${extraPeopleCount} extra)` : ""} - PAGO PENDIENTE`,
          subtotal: totalPrice,
          tax: 0,
          total: totalPrice,
          status: "OPEN",
          remaining_amount: totalPrice, // Todo pendiente
          paid_amount: 0,
          created_by: user?.id ?? null,
          shift_session_id: currentShiftId,
        })
        .select("id")
        .single();

      if (orderError) {
        console.error("Error creating sales order:", orderError);
        toast.error("Error al iniciar la estancia");
        return;
      }

      // Buscar o crear producto de servicio
      let serviceProductId: string | null = null;
      const { data: serviceProducts } = await supabase
        .from("products")
        .select("id")
        .eq("sku", "SVC-ROOM")
        .limit(1);

      if (serviceProducts && serviceProducts.length > 0) {
        serviceProductId = serviceProducts[0].id;
      }

      // Insertar items de la orden (todos sin pagar)
      if (serviceProductId) {
        const orderItems = [];

        // Item de habitación base
        orderItems.push({
          sales_order_id: salesOrder.id,
          product_id: serviceProductId,
          qty: roomType.is_hotel ? durationNights : 1,
          unit_price: basePrice,
          concept_type: "ROOM_BASE",
          is_paid: false,
          paid_at: null,
          payment_method: null,
        });

        // Items de personas extra (un solo item con qty = cantidad de extras)
        if (extraPeopleCount > 0 && extraPersonPrice > 0) {
          const qtyMultiplier = roomType.is_hotel ? durationNights : 1;
          orderItems.push({
            sales_order_id: salesOrder.id,
            product_id: serviceProductId,
            qty: extraPeopleCount * qtyMultiplier,
            unit_price: extraPersonPrice,
            concept_type: "EXTRA_PERSON",
            is_paid: false,
            paid_at: null,
            payment_method: null,
          });
        }

        const { error: itemsError } = await supabase.from("sales_order_items").insert(orderItems);
        if (itemsError) {
           console.error("Error inserting order items:", itemsError);
           // Podríamos hacer rollback aquí, pero la orden de venta quedaría en OPEN con importe 0
        }
      }

      // Crear pago pendiente (para que aparezca en el cobro granular)
      const { error: paymentError } = await supabase.from("payments").insert({
        sales_order_id: salesOrder.id,
        amount: totalPrice,
        payment_method: "PENDIENTE",
        reference: generatePaymentReference("QCK"),
        concept: "ESTANCIA",
        status: "PENDIENTE",
        payment_type: "COMPLETO",
        created_by: user?.id ?? null,
        shift_session_id: currentShiftId,
        employee_id: currentEmployeeId,
      });

      if (paymentError) {
         console.error("Error inserting payment:", paymentError);
      }

      // Generar token de acceso al portal de huéspedes
      const guestToken = crypto.randomUUID();

      // Registrar la estancia con la hora REAL de entrada
      const { data: stayData, error: stayError } = await supabase
        .from("room_stays")
        .insert({
          room_id: selectedRoom.id,
          sales_order_id: salesOrder.id,
          check_in_at: entryTime.toISOString(), // Hora real de entrada
          expected_check_out_at: expectedCheckout.toISOString(),
          current_people: data.initialPeople,
          total_people: data.initialPeople,
          vehicle_plate: null,
          vehicle_brand: null,
          vehicle_model: null,
          valet_employee_id: null,
          shift_session_id: currentShiftId,
          guest_access_token: guestToken,
        })
        .select()
        .single();

      if (stayError || !stayData) {
        console.error("Error creating room stay:", stayError);
        toast.error("Error al registrar la estancia");
        return;
      }

      // Actualizar estado de la habitación a OCUPADA
      await supabase
        .from("rooms")
        .update({ status: "OCUPADA" })
        .eq("id", selectedRoom.id);

      const timeDiff = Math.round(
        (new Date().getTime() - entryTime.getTime()) / 60000
      );

      toast.success("⚡ Entrada rápida registrada", {
        description: `Hab. ${selectedRoom.number} - Entrada: ${entryTime.toLocaleTimeString(
          "es-MX",
          { hour: "2-digit", minute: "2-digit" }
        )}${timeDiff > 0 ? ` (hace ${timeDiff} min)` : ""} - PAGO PENDIENTE: $${totalPrice.toFixed(
          2
        )}`,
      });

      // Imprimir ticket de entrada (fire-and-forget)
      try {
        await printEntryTicket({
          roomNumber: selectedRoom.number,
          roomTypeName: roomType.name,
          date: entryTime,
          people: data.initialPeople,
          basePrice,
          extraPeopleCount: extraPeopleCount > 0 ? extraPeopleCount : undefined,
          extraPeopleCost: extraPeopleCost > 0 ? extraPeopleCost : undefined,
          totalPrice,
          paymentMethod: 'PENDIENTE',
          expectedCheckout,
        });
      } catch (printErr) {
        console.error('Error printing entry ticket (non-blocking):', printErr);
      }

      // Imprimir ticket QR del portal de huéspedes (solo si está habilitado en configuración)
      if (systemConfig.printQROnCheckin) {
        try {
          const portalURL = getGuestPortalURL(selectedRoom.number, guestToken);
          await printQRTicket({
            roomNumber: selectedRoom.number,
            url: portalURL,
          });
        } catch (qrErr) {
          console.error('Error printing QR portal ticket (non-blocking):', qrErr);
        }
      }

      onClose();
      onSuccess();
    } catch (error) {
      console.error("Error in quick checkin:", error);
      toast.error("Error al registrar la entrada rápida");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <QuickCheckinModal
      isOpen={isOpen && !!selectedRoom}
      roomNumber={selectedRoom?.number || ""}
      roomType={selectedRoom?.room_types || { id: "", name: "", base_price: 0 }}
      actionLoading={actionLoading}
      onClose={onClose}
      onConfirm={handleQuickCheckin}
    />
  );
}
