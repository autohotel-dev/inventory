/**
 * Checkout validation and payment pipeline.
 * Each step is independent and testable. Adding a new validation = adding 1 function.
 */
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Room } from "@/components/sales/room-types";
import { PaymentEntry } from "@/components/sales/multi-payment-input";
import { logger } from "@/lib/utils/logger";
import { isToleranceExpired, generatePaymentReference } from "./room-action-helpers";
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

// ─── Step 1: Validate Stay State ────────────────────────────────────

/**
 * Validates that the stay is in a checkable-out state:
 * - Exists and is active
 * - Tolerance is not expired
 * - Vehicle checkout is verified (if applicable)
 */
export async function validateStayForCheckout(
  supabase: ReturnType<typeof createClient>,
  checkoutInfo: CheckoutInfo
): Promise<ValidationResult> {
  const { data: freshStay, error } = await supabase
    .from("room_stays")
    .select("tolerance_started_at, tolerance_type, id, vehicle_plate, checkout_valet_employee_id")
    .eq("sales_order_id", checkoutInfo.salesOrderId)
    .eq("status", "ACTIVA")
    .single();

  if (error || !freshStay) {
    toast.error("No se encontró la estancia activa o ya fue finalizada.");
    return { ok: false };
  }

  // Check tolerance
  if (freshStay.tolerance_started_at && freshStay.tolerance_type) {
    if (isToleranceExpired(freshStay.tolerance_started_at)) {
      toast.error("La tolerancia ha expirado", {
        description: "Se requiere cobrar hora extra. Por favor, cierre y vuelva a abrir el checkout.",
        duration: 6000
      });
      return { ok: false };
    }
  }

  // Check vehicle
  if (freshStay.vehicle_plate && !freshStay.checkout_valet_employee_id) {
    toast.error("Salida de vehículo no verificada", {
      description: "El cochero debe verificar la salida del vehículo antes de finalizar.",
      duration: 6000
    });
    return { ok: false };
  }

  return { ok: true, stayId: freshStay.id };
}

// ─── Step 2: Validate Pending Deliveries ────────────────────────────

/**
 * Checks that no active consumption items are still undelivered.
 */
export async function validateNoBlockingDeliveries(
  supabase: ReturnType<typeof createClient>,
  salesOrderId: string
): Promise<boolean> {
  const { data: pendingDeliveries } = await supabase
    .from("sales_order_items")
    .select("id")
    .eq("sales_order_id", salesOrderId)
    .eq("concept_type", "CONSUMPTION")
    .neq("is_cancelled", true)
    .not("delivery_status", "is", null)
    .neq("delivery_status", "DELIVERED")
    .neq("delivery_status", "COMPLETED")
    .neq("delivery_status", "CANCELLED");

  if (pendingDeliveries && pendingDeliveries.length > 0) {
    toast.error("Entregas pendientes", {
      description: "No se puede finalizar. Hay productos sin entregar por el valet.",
      duration: 5000
    });
    return false;
  }

  return true;
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
  supabase: ReturnType<typeof createClient>,
  checkoutInfo: CheckoutInfo,
  payments: PaymentEntry[] | undefined,
  totalPaid: number
): Promise<any[]> {
  // Reconcile pending payments first
  let remainingAfterPending = totalPaid;
  if (payments && payments.length > 0) {
    const validPayments = payments.filter(p => p.amount > 0);
    remainingAfterPending = await updatePendingPaymentsHelper(
      supabase, checkoutInfo.salesOrderId, validPayments, totalPaid, "CHK"
    );
  }

  // Check if we already have confirmed non-checkout payments
  if (remainingAfterPending <= 0 || !payments || payments.length === 0) {
    return [];
  }

  let hasExistingConfirmedPayments = false;
  const { count } = await supabase
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("sales_order_id", checkoutInfo.salesOrderId)
    .eq("status", "PAGADO")
    .neq("concept", "CHECKOUT");
  hasExistingConfirmedPayments = (count || 0) > 0;

  if (hasExistingConfirmedPayments) return [];

  // Build new payment records
  const validPayments = payments.filter(p => p.amount > 0);
  const currentShiftId = await getReceptionShiftId(supabase);
  const currentEmployeeId = await getReceptionEmployeeId(supabase);
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
