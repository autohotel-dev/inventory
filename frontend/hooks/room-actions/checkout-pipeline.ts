/**
 * Checkout validation and payment pipeline.
 * Each step is independent and testable. Adding a new validation = adding 1 function.
 */
import { apiClient } from "@/lib/api/client";
import { toast } from "sonner";
import { Room } from "@/components/sales/room-types";
import { PaymentEntry } from "@/components/sales/multi-payment-input";
import { logger } from "@/lib/utils/logger";
import { generatePaymentReference } from "./room-action-helpers";
import { getReceptionShiftId, getReceptionEmployeeId } from "./shift-helpers";
import { updatePendingPaymentsHelper } from "./payment-helpers";

// ─── Types ───────────────────────────────────────────────────────────

interface CheckoutInfo {
  salesOrderId: string;
  remainingAmount: number;
}

interface ValidationResult {
  ok: boolean;
  stayId?: string;
}

interface CheckoutPaymentData {
  stayId: string;
  salesOrderId: string;
  newPayments: any[];
  checkoutValetId: string | null;
}



// ─── Step 3: Unsubscribe Guest Notifications ────────────────────────

export async function unsubscribeGuestNotifications(roomNumber: string): Promise<void> {
  try {
    await fetch('/api/guest/unsubscribe-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room_number: roomNumber }),
    });
  } catch (error) {
    // Non-blocking — log and continue
    console.error("Error disabling guest notifications:", error);
  }
}

// ─── Step 4: Build Payment Data for RPC ─────────────────────────────

/**
 * Reconciles pending payments and builds the payment array for the checkout RPC.
 */
export async function buildCheckoutPayments(
  checkoutInfo: CheckoutInfo,
  payments: PaymentEntry[] | undefined,
  totalPaid: number
): Promise<any[]> {
  // Reconcile pending payments first
  let remainingAfterPending = totalPaid;
  if (payments && payments.length > 0) {
    const validPayments = payments.filter(p => p.amount > 0);
    remainingAfterPending = await updatePendingPaymentsHelper(
      checkoutInfo.salesOrderId, validPayments, totalPaid, "CHK"
    );
  }

  // Check if we already have confirmed non-checkout payments
  if (remainingAfterPending <= 0 || !payments || payments.length === 0) {
    return [];
  }

  let hasExistingConfirmedPayments = false;
  try {
    const { data: payments_list } = await apiClient.get(`/system/crud/payments?sales_order_id=${checkoutInfo.salesOrderId}`) as any;
    hasExistingConfirmedPayments = (payments_list || []).some((p: any) => p.concept !== "CHECKOUT");
  } catch (e) {
    hasExistingConfirmedPayments = false;
  }

  if (hasExistingConfirmedPayments) return [];

  // Build new payment records
  const validPayments = payments.filter(p => p.amount > 0);
  const currentShiftId = await getReceptionShiftId();
  const currentEmployeeId = await getReceptionEmployeeId();
  const isMultipago = validPayments.length > 1;

  if (isMultipago) {
    const proportion = remainingAfterPending / totalPaid;
    return validPayments.map(p => ({
      sales_order_id: checkoutInfo.salesOrderId,
      amount: Number((p.amount * proportion).toFixed(2)),
      payment_method: p.method,
      reference: p.reference || generatePaymentReference("CHK"),
      concept: "CHECKOUT",
      status: "PAGADO",
      payment_type: "PARCIAL",
      shift_session_id: currentShiftId,
      collected_by: currentEmployeeId,
      terminal_code: p.terminal,
      card_last_4: p.cardLast4,
      card_type: p.cardType
    }));
  }

  const p = validPayments[0];
  return [{
    sales_order_id: checkoutInfo.salesOrderId,
    amount: remainingAfterPending,
    payment_method: p.method,
    reference: p.reference || generatePaymentReference("CHK"),
    concept: "CHECKOUT",
    status: "PAGADO",
    payment_type: "COMPLETO",
    shift_session_id: currentShiftId,
    collected_by: currentEmployeeId,
    terminal_code: p.terminal,
    card_last_4: p.cardLast4,
    card_type: p.cardType
  }];
}


export async function validateCheckoutPipeline(roomId: string): Promise<any> {
  const { data } = await apiClient.get(`/rooms/${roomId}/checkout-validation`) as any;
  if (!data.ok) {
    if (data.tolerance_expired) {
      toast.error("La tolerancia ha expirado", { description: "Se requiere cobrar hora extra. Por favor, cierre y vuelva a abrir el checkout.", duration: 6000 });
    } else if (data.missing_valet) {
      toast.error("Salida de vehículo no verificada", { description: "El cochero debe verificar la salida del vehículo antes de finalizar.", duration: 6000 });
    } else if (data.pending_deliveries) {
      toast.error("Entregas pendientes", { description: "No se puede finalizar. Hay productos sin entregar por el valet.", duration: 5000 });
    } else {
      toast.error("Error validando checkout o estancia no activa.");
    }
  }
  return data;
}
