"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Room } from "@/components/sales/room-types";
import { getActiveStay } from "@/hooks/use-room-actions";
import { useRoomActions } from "@/hooks/use-room-actions";
import { PaymentEntry } from "@/components/sales/multi-payment-input";
import { RoomCheckoutModal } from "@/components/sales/room-checkout-modal";
import { ConsumptionTicketData } from "@/hooks/use-thermal-printer";

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
  const [checkoutAmount, setCheckoutAmount] = useState<number>(0);
  const [checkoutInfo, setCheckoutInfo] = useState<{
    salesOrderId: string;
    remainingAmount: number;
    pendingItems?: { concept_type: string; total: number; count: number }[];
    hasUndeliveredItems?: boolean;
  } | null>(null);

  useEffect(() => {
    if (isOpen && room) {
      loadCheckoutInfo(room);
    } else {
      setCheckoutInfo(null);
      setCheckoutAmount(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, room]);

  const loadCheckoutInfo = async (selectedRoom: Room) => {
    const info = await prepareCheckout(selectedRoom);
    if (!info) {
      onClose();
      return;
    }

    const supabase = createClient();
    const { data: itemsData } = await supabase
      .from("sales_order_items")
      .select("concept_type, total, is_paid, delivery_status")
      .eq("sales_order_id", info.salesOrderId);

    const pendingByType: Record<string, { total: number; count: number }> = {};
    let hasUndeliveredItems = false;

    if (itemsData) {
      itemsData.forEach((item: any) => {
        if (!item.is_paid) {
          const type = item.concept_type || "PRODUCT";
          if (!pendingByType[type]) {
            pendingByType[type] = { total: 0, count: 0 };
          }
          pendingByType[type].total += item.total || 0;
          pendingByType[type].count += 1;

          if (
            item.delivery_status &&
            item.delivery_status !== "DELIVERED" &&
            item.delivery_status !== "COMPLETED"
          ) {
            hasUndeliveredItems = true;
          }
        }
      });
    }

    const pendingItems = Object.entries(pendingByType).map(
      ([concept_type, data]) => ({
        concept_type,
        total: data.total,
        count: data.count,
      })
    );

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
      // Intento de impresión de ticket comentado por solicitud
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
        // printConsumptionTickets(printData);
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
      defaultValetId={
        room ? getActiveStay(room)?.checkout_valet_employee_id : null
      }
      vehiclePlate={room ? getActiveStay(room)?.vehicle_plate || null : null}
      checkoutPaymentData={(() => {
        const data = room ? getActiveStay(room)?.checkout_payment_data : undefined;
        return data || undefined;
      })()}
    />
  );
}
