/**
 * Payment and sales order helpers.
 * Handles order totals, pending payment reconciliation, and charge creation.
 */
import { apiClient } from "@/lib/api/client";
import { createClient } from "@/lib/supabase/client";
import { logger } from "@/lib/utils/logger";
import { PaymentEntry } from "@/components/sales/multi-payment-input";
import { generatePaymentReference } from "./room-action-helpers";
import { getReceptionShiftId, getReceptionEmployeeId } from "./shift-helpers";

// ─── Sales Order Totals ─────────────────────────────────────────────

export async function updateSalesOrderTotals(
  supabase: any,
  salesOrderId: string,
  additionalAmount: number
): Promise<{ success: boolean; newRemaining?: number }> {
  const { data: orderData, error: orderError } = await supabase
    .from("sales_orders")
    .select("subtotal, tax, paid_amount, remaining_amount")
    
    ;

  if (orderError || !orderData) {
    console.error("Error fetching sales order:", orderError);
    return { success: false };
  }

  const subtotal = Number(orderData.subtotal) || 0;
  const tax = Number(orderData.tax) || 0;
  const currentRemaining = Number(orderData.remaining_amount) || 0;

  const newSubtotal = subtotal + additionalAmount;
  const newTotal = newSubtotal + tax;
  const newRemaining = currentRemaining + additionalAmount;

  const { error: updateError } = await supabase
    .from("sales_orders")
    .update({
      subtotal: newSubtotal,
      total: newTotal,
      remaining_amount: newRemaining,
    })
    ;

  if (updateError) {
    console.error("Error updating sales order:", updateError);
    return { success: false };
  }

  return { success: true, newRemaining };
}

// ─── Create Pending Charge ──────────────────────────────────────────

/**
 * Creates a pending payment + updates sales order totals in one call.
 */
export async function createPendingCharge(
  supabase: any,
  salesOrderId: string,
  amount: number,
  concept: string,
  referencePrefix: string,
  shiftSessionId?: string | null,
  notes?: string
): Promise<{ success: boolean; newRemaining?: number }> {
  try {
    const res = await apiClient.post(`/sales/orders/${salesOrderId}/pending-charge`, {
      amount,
      concept,
      reference_prefix: referencePrefix,
      shift_session_id: shiftSessionId || undefined,
      notes
    });
    return res.data;
  } catch (e) {
    console.error(e);
    return { success: false };
  }
}

// ─── Pending Payments Reconciliation ────────────────────────────────

/**
 * Updates existing pending payments when a bulk payment is made.
 * Returns the remaining amount after applying to pending payments.
 */
export async function updatePendingPaymentsHelper(
  supabase: any,
  salesOrderId: string,
  payments: PaymentEntry[],
  totalPaid: number,
  referencePrefix: string = "PAG"
): Promise<number> {
  try {
    const currentShiftId = await getReceptionShiftId(supabase);
    const currentEmployeeId = await getReceptionEmployeeId(supabase);
    const res = await apiClient.post(`/sales/orders/${salesOrderId}/reconcile-pending`, {
      payments,
      total_paid: totalPaid,
      reference_prefix: referencePrefix,
      shift_session_id: currentShiftId || undefined,
      employee_id: currentEmployeeId || undefined
    });
    return res.data.remaining_to_pay;
  } catch (e) {
    console.error(e);
    return totalPaid;
  }
}
