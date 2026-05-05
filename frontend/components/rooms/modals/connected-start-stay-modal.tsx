"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Room, RoomType } from "@/components/sales/room-types";
import { PaymentEntry } from "@/components/sales/multi-payment-input";
import {
  VehicleInfo,
  RoomStartStayModal,
} from "@/components/sales/room-start-stay-modal";
import { useThermalPrinter } from "@/hooks/use-thermal-printer";
import {
  useRoomActions,
  getActiveStay,
} from "@/hooks/room-actions";
import { startFlowWithEvent } from "@/lib/flow-logger";

export const calculateExpectedCheckout = (
  roomType: RoomType,
  durationNights: number = 1
) => {
  const now = new Date();

  if (roomType.is_hotel) {
    // Hotel (Torre): check-out siempre a las 12 pm según las noches seleccionadas
    const checkout = new Date(now);
    checkout.setDate(checkout.getDate() + durationNights);
    checkout.setHours(12, 0, 0, 0);
    return checkout;
  }

  // Motel: Determinar si estamos en período de fin de semana o entre semana
  // Fin de semana: Viernes 6:00 AM - Domingo 6:00 AM (8 horas)
  // Entre semana: Domingo 6:00 AM - Viernes 6:00 AM (12 horas)
  const day = now.getDay(); // 0=Domingo, 1=Lunes, ..., 5=Viernes, 6=Sábado
  const hour = now.getHours(); // 0-23

  let isWeekendPeriod = false;

  if (day === 5 && hour >= 6) {
    // Viernes desde las 6:00 AM en adelante
    isWeekendPeriod = true;
  } else if (day === 6) {
    // Todo el sábado
    isWeekendPeriod = true;
  } else if (day === 0 && hour < 6) {
    // Domingo antes de las 6:00 AM
    isWeekendPeriod = true;
  }

  const hours = isWeekendPeriod
    ? roomType.weekend_hours ?? 8
    : roomType.weekday_hours ?? 12;

  const checkout = new Date(now);
  checkout.setHours(checkout.getHours() + hours);
  return checkout;
};

export const formatDateTime = (date: Date) => {
  return date.toLocaleString("es-MX", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

interface ConnectedStartStayModalProps {
  room: Room | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ConnectedStartStayModal({
  room,
  isOpen,
  onClose,
  onSuccess,
}: ConnectedStartStayModalProps) {
  const [startStayLoading, setStartStayLoading] = useState(false);
  const { printEntryTicket } = useThermalPrinter();

  const handleStartStay = async (
    initialPeople: number,
    payments: PaymentEntry[],
    vehicle: VehicleInfo,
    durationNights: number = 1
  ) => {
    if (!room || !room.room_types) return;



    setStartStayLoading(true);
    const supabase = createClient();
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const methodsSummary = payments.map((p) => p.method).join(", ");

    try {
      const roomType = room.room_types;
      const now = new Date();

      let expectedCheckout = calculateExpectedCheckout(roomType);
      if (roomType.is_hotel) {
        expectedCheckout = new Date();
        expectedCheckout.setDate(expectedCheckout.getDate() + durationNights);
        expectedCheckout.setHours(12, 0, 0, 0);
      }

      const basePrice = roomType.base_price ?? 0;
      const extraPersonPrice = roomType.extra_person_price ?? 0;

      // Calcular costo extra por personas adicionales (más de 2)
      const extraPeopleCount = Math.max(0, initialPeople - 2);
      const extraPeopleCost = extraPeopleCount * extraPersonPrice;
      const totalPrice =
        (basePrice + extraPeopleCost) * (roomType.is_hotel ? durationNights : 1);
      const totalPaidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
      const methodsSummary = payments.map((p) => p.method).join(", ");

      // Obtener almacén específico para ventas de recepción (ALM002-R)
      const { data: defaultWarehouse, error: warehouseError } = await supabase
        .from("warehouses")
        .select("id, code, is_active")
        .eq("code", "ALM002-R")
        .eq("is_active", true)
        .single();

      if (warehouseError || !defaultWarehouse) {
        toast.error("No se encontró el almacén de recepción", {
          description:
            "Verifica que exista el almacén con código ALM002-R y esté activo.",
        });
        return;
      }

      // Preparar datos de pago para el RPC
      const paymentData = payments.filter(p => p.amount > 0).map(p => ({
        amount: p.amount,
        method: p.method,
        reference: p.reference || null,
        terminal: p.method === "TARJETA" ? p.terminal : null,
        cardLast4: p.method === "TARJETA" ? p.cardLast4 : null,
        cardType: p.method === "TARJETA" ? p.cardType : null,
      }));

      // ═══ RPC ATÓMICO: Todo-o-Nada ═══
      const { apiClient } = await import("@/lib/api/client");
      let rpcResult;
      
      try {
        const response = await apiClient.post(`/rooms/${room.id}/checkin`, {
          warehouse_id: defaultWarehouse.id,
          room_type_name: roomType.name,
          room_number: room.number,
          base_price: basePrice,
          extra_person_price: extraPersonPrice,
          total_price: totalPrice,
          total_paid: totalPaidAmount,
          initial_people: initialPeople,
          extra_people_count: extraPeopleCount,
          check_in_at: now.toISOString(),
          expected_checkout_at: expectedCheckout.toISOString(),
          vehicle_plate: vehicle.plate || null,
          vehicle_brand: vehicle.brand || null,
          vehicle_model: vehicle.model || null,
          is_hotel: roomType.is_hotel ?? false,
          duration_nights: durationNights,
          notes: `Estancia ${roomType.name} Hab. ${room.number}${extraPeopleCount > 0 ? ` (+${extraPeopleCount} extra)` : ""} - Pago: ${methodsSummary}`,
          payment_data: paymentData,
          employee_id: (await supabase.auth.getUser()).data.user?.id
        });
        rpcResult = response.data;
      } catch (err: any) {
        toast.error("Error al iniciar la estancia", {
          description: err.response?.data?.detail || err.message || "Error desconocido",
        });
        return;
      }

      if (rpcResult && (rpcResult as any).success === false) {
        toast.error("Habitación no disponible", {
          description: (rpcResult as any).error,
        });
        return;
      }

      toast.success("Estancia iniciada", {
        description: `Hab. ${room.number} - ${roomType.name} (${initialPeople} persona${
          initialPeople > 1 ? "s" : ""
        }) hasta ${formatDateTime(expectedCheckout)}${
          extraPeopleCost > 0 ? ` - Total: $${totalPrice.toFixed(2)}` : ""
        }`,
      });

      // ─── Crear flujo operativo ─────────────────────────────────────
      // El RPC ya creó la estancia; obtenerla para enlazar el flujo
      try {
        const { data: freshRoom } = await supabase
          .from("rooms")
          .select("*, room_stays(id, sales_order_id, status)")
          .eq("id", room.id)
          .single();

        const activeStay = freshRoom?.room_stays?.find(
          (s: any) => s.status === "ACTIVA"
        );

        if (activeStay) {
          // Obtener shift_session_id del recepcionista actual
          const { data: { user } } = await supabase.auth.getUser();
          let shiftSessionId: string | undefined;
          if (user) {
            const { data: session } = await supabase
              .from("shift_sessions")
              .select("id")
              .eq("auth_user_id", user.id)
              .eq("status", "active")
              .is("clock_out_at", null)
              .order("clock_in_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            shiftSessionId = session?.id;
          }

          startFlowWithEvent(
            {
              room_stay_id: activeStay.id,
              sales_order_id: activeStay.sales_order_id,
              room_id: room.id,
              room_number: room.number,
              shift_session_id: shiftSessionId,
            },
            {
              event_type: "ROOM_ASSIGNED",
              description: `Habitación ${room.number} asignada — ${roomType.name} (${initialPeople} persona${initialPeople > 1 ? "s" : ""})`,
              metadata: {
                room_number: room.number,
                room_type: roomType.name,
                initial_people: initialPeople,
                base_price: basePrice,
                total_price: totalPrice,
                payment_methods: methodsSummary,
                expected_checkout: expectedCheckout.toISOString(),
              },
            }
          );
        }
      } catch (flowErr) {
        console.error("[flow-logger] Error creating flow at checkin:", flowErr);
      }

      // Imprimir ticket de entrada
      try {
        await printEntryTicket({
          roomNumber: room.number,
          roomTypeName: roomType.name,
          date: now,
          people: initialPeople,
          vehiclePlate: vehicle.plate || undefined,
          vehicleBrand: vehicle.brand || undefined,
          vehicleModel: vehicle.model || undefined,
          basePrice: basePrice,
          extraPeopleCount: extraPeopleCount > 0 ? extraPeopleCount : undefined,
          extraPeopleCost: extraPeopleCost > 0 ? extraPeopleCost : undefined,
          totalPrice: totalPrice,
          paymentMethod: methodsSummary || 'EFECTIVO',
          expectedCheckout: expectedCheckout,
        });
      } catch (printError) {
        console.error("Error printing entry ticket:", printError);
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error starting stay:", error);
      toast.error("Error al iniciar la estancia", {
        description: "Ocurrió un error inesperado. Intenta nuevamente.",
      });
    } finally {
      setStartStayLoading(false);
    }
  };

  return (
    <RoomStartStayModal
      isOpen={isOpen && !!room}
      roomNumber={room?.number || ""}
      roomType={room?.room_types as RoomType}
      expectedCheckout={room?.room_types ? calculateExpectedCheckout(room.room_types) : new Date()}
      actionLoading={startStayLoading}
      onClose={onClose}
      onConfirm={handleStartStay}
    />
  );
}
