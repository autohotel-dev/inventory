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

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const currentShiftId = await getReceptionShiftId(supabase);
      const currentEmployeeId = await getReceptionEmployeeId(supabase);
      const guestToken = crypto.randomUUID();
      const paymentRef = generatePaymentReference("QCK");

      const { data: rpcResult, error: rpcError } = await supabase.rpc("process_quick_checkin", {
        p_room_id: selectedRoom.id,
        p_room_number: selectedRoom.number,
        p_room_type_name: roomType.name,
        p_entry_time: entryTime.toISOString(),
        p_expected_checkout: expectedCheckout.toISOString(),
        p_initial_people: data.initialPeople,
        p_duration_nights: durationNights,
        p_base_price: basePrice,
        p_extra_person_price: extraPersonPrice,
        p_extra_people_count: extraPeopleCount,
        p_total_price: totalPrice,
        p_is_hotel: roomType.is_hotel || false,
        p_user_id: user?.id || null,
        p_shift_session_id: currentShiftId,
        p_employee_id: currentEmployeeId,
        p_guest_token: guestToken,
        p_payment_reference: paymentRef,
      });

      if (rpcError || !rpcResult?.success) {
        console.error("RPC Error:", rpcError || rpcResult?.error);
        toast.error("Error al registrar la estancia");
        return;
      }

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
