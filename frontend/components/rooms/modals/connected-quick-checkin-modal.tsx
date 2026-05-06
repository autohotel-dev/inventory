import { apiClient } from "@/lib/api/client";
"use client";

import { useState } from "react";

import { toast } from "sonner";
import { QuickCheckinModal } from "@/components/sales/quick-checkin-modal";
import { Room } from "@/components/sales/room-types";
import {
  generatePaymentReference,
} from "@/hooks/room-actions";
import { getCurrentEmployeeId, getCurrentShiftId } from "@/hooks/room-actions/shift-helpers";
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
      const extraPeopleCount = Math.max(0, data.initialPeople - 2);
      const extraPeopleCost = extraPeopleCount * extraPersonPrice;
      const totalPrice =
        (basePrice + extraPeopleCost) * (roomType.is_hotel ? durationNights : 1);

      let defaultWarehouse = null;
      try {
        const { apiClient } = await import("@/lib/api/client");
        const res = await apiClient.get('/system/crud/warehouses?code=ALM002-R&is_active=true');
        defaultWarehouse = (res.data && res.data.length > 0) ? res.data[0] : null;
      } catch(e) {}
      
      const warehouseError = !defaultWarehouse;

      if (warehouseError || !defaultWarehouse) {
        toast.error("No se encontró el almacén de recepción");
        return;
      }

      const currentShiftId = await getCurrentShiftId();
      const currentEmployeeId = await getCurrentEmployeeId();

      const { apiClient } = await import("@/lib/api/client");

      // Crear orden de venta con pago PENDIENTE
      let salesOrder = null;
      try {
        const orderRes = await apiClient.post("/system/crud/sales_orders", {
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
          created_by: currentEmployeeId,
          shift_session_id: currentShiftId,
        });
        salesOrder = orderRes.data;
      } catch (orderError) {
        console.error("Error creating sales order:", orderError);
        toast.error("Error al iniciar la estancia");
        return;
      }

      let serviceProductId: string | null = null;
      try {
        const prodRes = await apiClient.get("/system/crud/products?limit=1");
        if (prodRes.data && prodRes.data.length > 0) {
          serviceProductId = prodRes.data[0].id;
        }
      } catch (e) {}

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

        // Items de personas extra
        if (extraPeopleCount > 0 && extraPersonPrice > 0) {
          const qtyPerPerson = roomType.is_hotel ? durationNights : 1;
          for (let i = 0; i < extraPeopleCount; i++) {
            orderItems.push({
              sales_order_id: salesOrder.id,
              product_id: serviceProductId,
              qty: qtyPerPerson,
              unit_price: extraPersonPrice,
              concept_type: "EXTRA_PERSON",
              is_paid: false,
              paid_at: null,
              payment_method: null,
            });
          }
        }

        const { error: itemsError } = await apiClient.post("/system/crud/sales_order_items", orderItems) as any;
        if (itemsError) {
           console.error("Error inserting order items:", itemsError);
           // Podríamos hacer rollback aquí, pero la orden de venta quedaría en OPEN con importe 0
        }
      }

      // Crear pago pendiente (para que aparezca en el cobro granular)
      try {
        await apiClient.post("/system/crud/payments", {
          sales_order_id: salesOrder.id,
          amount: totalPrice,
          payment_method: "PENDIENTE",
          reference: generatePaymentReference("QCK") as any,
          concept: "ESTANCIA",
          status: "PENDIENTE",
          payment_type: "COMPLETO",
          created_by: currentEmployeeId,
          shift_session_id: currentShiftId,
          employee_id: currentEmployeeId,
        });
      } catch (paymentError) {
         console.error("Error inserting payment:", paymentError);
      }

      // Generar token de acceso al portal de huéspedes
      const guestToken = crypto.randomUUID();

      // Registrar la estancia con la hora REAL de entrada
      let stayData = null;
      try {
        const stayRes = await apiClient.post("/system/crud/room_stays", {
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
        });
        stayData = stayRes.data;
      } catch (stayError) {
        console.error("Error creating room stay:", stayError);
        toast.error("Error al registrar la estancia");
        return;
      }

      // Actualizar estado de la habitación a OCUPADA
      try {
        await apiClient.patch(`/system/crud/rooms/${selectedRoom.id}`, { status: "OCUPADA" });
      } catch(e) {
        console.error("Error updating room status:", e);
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

      // Imprimir ticket QR del portal de huéspedes (silencioso via print-server)
      try {
        const portalURL = getGuestPortalURL(selectedRoom.number, guestToken);
        await printQRTicket({
          roomNumber: selectedRoom.number,
          url: portalURL,
        });
      } catch (qrErr) {
        console.error('Error printing QR portal ticket (non-blocking):', qrErr);
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
