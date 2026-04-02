import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getActiveStay } from "@/hooks/use-room-actions";
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
          const supabase = createClient();

          // 1. Verificar pagos reportados en tabla payments
          const { data: paymentsData } = await supabase
            .from("payments")
            .select("id")
            .eq("sales_order_id", activeStay.sales_order_id)
            .eq("status", "COBRADO_POR_VALET")
            .is("confirmed_at", null)
            .limit(1);

          if (paymentsData && paymentsData.length > 0) {
            setHasPendingValetPayment(true);
            return;
          }

          // 2. Verificar items entregados/verificados por cochero pero no pagados
          const { data: itemsData } = await supabase
            .from("sales_order_items")
            .select("id")
            .eq("sales_order_id", activeStay.sales_order_id)
            .eq("delivery_status", "DELIVERED")
            .eq("is_paid", false)
            .limit(1);

          setHasPendingValetPayment(!!itemsData && itemsData.length > 0);
        };
        checkValetPayments();
      } else {
        setHasPendingValetPayment(false);
      }
    }
  }, [showActionsModal, selectedRoom]);

  return { hasPendingValetPayment };
}
