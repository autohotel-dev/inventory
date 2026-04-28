"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Room } from "@/components/sales/room-types";
import { getActiveStay, useRoomActions } from "@/hooks/room-actions";
import { PaymentEntry } from "@/components/sales/multi-payment-input";
import { RoomCheckoutModal } from "@/components/sales/room-checkout-modal";
import { useThermalPrinter } from "@/hooks/use-thermal-printer";
import type { ConsumptionTicketData } from "@/hooks/use-thermal-printer";
import { summarizePendingItems, hasBlockingDeliveries } from "@/lib/utils/order-utils";

interface ConnectedCheckoutModalProps {
  room: Room | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ConnectedCheckoutModal({
  room,
  isOpen,
  onClose,
  onSuccess,
}: ConnectedCheckoutModalProps) {
  const { prepareCheckout, processCheckout, actionLoading, requestVehicle } = useRoomActions(async () => onSuccess());
  const { printConsumptionTickets } = useThermalPrinter();
  const [checkoutAmount, setCheckoutAmount] = useState<number>(0);
  const [checkoutInfo, setCheckoutInfo] = useState<{
    salesOrderId: string;
    remainingAmount: number;
    pendingItems?: { concept_type: string; total: number; count: number }[];
    hasUndeliveredItems?: boolean;
  } | null>(null);

  // Estado local para reflejar la confirmación del cochero en tiempo real
  const [confirmedValetId, setConfirmedValetId] = useState<string | null>(null);

  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (isOpen && room && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      // Inicializar con el valor actual del room
      const activeStay = getActiveStay(room);
      setConfirmedValetId(activeStay?.checkout_valet_employee_id || null);
      loadCheckoutInfo(room);
    } else if (!isOpen) {
      hasLoadedRef.current = false;
      setCheckoutInfo(null);
      setCheckoutAmount(0);
      setConfirmedValetId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Polling para detectar cuando el cochero confirma la revisión
  // Realtime de room_stays no funciona por RLS, así que consultamos directo cada 3s
  useEffect(() => {
    if (!isOpen || !room) return;
    
    const activeStay = getActiveStay(room);
    if (!activeStay) return;
    // Si ya tenemos confirmación, no necesitamos polling
    if (confirmedValetId) return;
    // Solo hacer polling si hay vehículo (necesita revisión de cochero)
    if (!activeStay.vehicle_plate) return;
    
    const supabase = createClient();
    
    const pollInterval = setInterval(async () => {
      const { data } = await supabase
        .from("room_stays")
        .select("checkout_valet_employee_id")
        .eq("id", activeStay.id)
        .single();
      
      if (data?.checkout_valet_employee_id && data.checkout_valet_employee_id !== confirmedValetId) {
        console.log("✅ [Checkout Modal] Cochero confirmó revisión:", data.checkout_valet_employee_id);
        setConfirmedValetId(data.checkout_valet_employee_id);
        // Refrescar el board para actualizar el ícono del cochecito
        onSuccess();
      }
    }, 3000);

    return () => clearInterval(pollInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, room?.id, confirmedValetId]);

  const loadCheckoutInfo = async (selectedRoom: Room) => {
    const info = await prepareCheckout(selectedRoom);
    if (!info) {
      onClose();
      return;
    }

    const supabase = createClient();
    const { data: itemsData } = await supabase
      .from("sales_order_items")
      .select("concept_type, total, is_paid, delivery_status, is_cancelled")
      .eq("sales_order_id", info.salesOrderId);

    const items = itemsData || [];
    const { pendingItems } = summarizePendingItems(items);
    const hasUndeliveredItems = hasBlockingDeliveries(items);

    setCheckoutInfo({ ...info, pendingItems, hasUndeliveredItems });
    setCheckoutAmount(info.remainingAmount);
  };

  const handleCheckout = async (data: {
    payments: PaymentEntry[];
    checkoutValetId?: string | null;
    checkoutValetName?: string;
  }) => {
    if (!checkoutInfo || !room) return;
    const success = await processCheckout(
      room,
      checkoutInfo,
      checkoutAmount,
      data.payments,
      data.checkoutValetId
    );

    if (success) {
      try {
        const activeStay = getActiveStay(room);
        const printData: ConsumptionTicketData = {
          roomNumber: room.number,
          folio: `${checkoutInfo.salesOrderId.slice(0, 8)}`,
          date: new Date(),
          items: checkoutInfo.pendingItems
            ? checkoutInfo.pendingItems.map((item) => ({
                name: `${item.concept_type} x${item.count}`,
                qty: item.count,
                price: item.total / item.count,
                total: item.total,
              }))
            : [],
          subtotal: checkoutAmount,
          total: checkoutAmount,
          entranceValet: activeStay?.vehicle_plate ? "Solicitado" : undefined,
          exitValet: data.checkoutValetName,
        };
        printConsumptionTickets(printData);
      } catch (e) {
        console.error("Error printing exit ticket", e);
      }

      toast.success("Checkout completado", {
        description: `Habitación ${room.number}`,
      });
      onSuccess();
      onClose();
    }
  };

  const RequestValetAction = async () => {
    if (room) {
      const activeStay = getActiveStay(room);
      if (activeStay) {
        await requestVehicle(activeStay.id);
        onClose();
        toast.success("Solicitud enviada al cochero");
      }
    }
  };

  // Usar confirmedValetId (estado local actualizado vía realtime) como fuente primaria
  const effectiveValetId = confirmedValetId 
    || (room ? getActiveStay(room)?.checkout_valet_employee_id : null) 
    || null;

  return (
    <RoomCheckoutModal
      isOpen={isOpen && !!room}
      roomNumber={room?.number || ""}
      roomTypeName={room?.room_types?.name || ""}
      remainingAmount={checkoutInfo?.remainingAmount || 0}
      checkoutAmount={checkoutAmount}
      actionLoading={actionLoading}
      pendingItems={checkoutInfo?.pendingItems}
      hasUndeliveredItems={checkoutInfo?.hasUndeliveredItems}
      onAmountChange={setCheckoutAmount}
      onClose={onClose}
      onRequestValet={RequestValetAction}
      onConfirm={handleCheckout}
      defaultValetId={effectiveValetId}
      vehiclePlate={room ? getActiveStay(room)?.vehicle_plate || null : null}
      checkoutPaymentData={(() => {
        const data = room ? getActiveStay(room)?.checkout_payment_data : undefined;
        return data || undefined;
      })()}
    />
  );
}
