import { useEffect, useState } from "react";
import { getActiveStay } from "@/hooks/room-actions";
import type { Room } from "@/components/sales/room-types";

/**
 * Monitor dedicado de la deuda con el Valet Parking.
 * Mantiene encapsulada la validación para impedir la liberación
 * del cuarto si el Valet no ha cobrado o reportado los ítems.
 */
export function useValetPaymentMonitor(
  selectedRoom: Room | null,
  showActionsModal: boolean
) {
  const [hasPendingValetPayment, setHasPendingValetPayment] = useState(false);

  useEffect(() => {
    if (showActionsModal && selectedRoom) {
      const activeStay = getActiveStay(selectedRoom);
      if (activeStay?.sales_order_id) {
        const checkValetPayments = async () => {
          try {
            const { apiClient } = await import("@/lib/api/client");
            const { data } = await apiClient.get(`/sales/orders/${activeStay.sales_order_id}/has-pending-valet-payments`);
            setHasPendingValetPayment(data?.hasPendingValetPayment || false);
          } catch (error) {
            console.error("Error checking valet payments:", error);
            setHasPendingValetPayment(false);
          }
        };
        checkValetPayments();
      } else {
        setHasPendingValetPayment(false);
      }
    }
  }, [showActionsModal, selectedRoom]);

  return { hasPendingValetPayment };
}
