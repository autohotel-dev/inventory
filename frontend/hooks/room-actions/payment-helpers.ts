/**
 * Payment and sales order helpers.
 * Handles order totals, pending payment reconciliation, and charge creation.
 */
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/utils/logger";
import { PaymentEntry } from "@/components/sales/multi-payment-input";
import { generatePaymentReference } from "./room-action-helpers";
import { getReceptionShiftId, getReceptionEmployeeId } from "./shift-helpers";

// ─── Sales Order Totals ─────────────────────────────────────────────

export async function updateSalesOrderTotals(
  salesOrderId: string,
  additionalAmount: number
): Promise<{ success: boolean; newRemaining?: number }> {
  try {
    const { data: orderData } = await apiClient.get(`/system/crud/sales_orders/${salesOrderId}`) as any;

    if (!orderData) {
      console.error("Error fetching sales order");
      return { success: false };
    }

    const subtotal = Number(orderData.subtotal) || 0;
    const tax = Number(orderData.tax) || 0;
    const currentRemaining = Number(orderData.remaining_amount) || 0;

    const newSubtotal = subtotal + additionalAmount;
    const newTotal = newSubtotal + tax;
    const newRemaining = currentRemaining + additionalAmount;

    await apiClient.patch(`/system/crud/sales_orders/${salesOrderId}`, {
      subtotal: newSubtotal,
      total: newTotal,
      remaining_amount: newRemaining,
    });

    return { success: true, newRemaining };
  } catch (error) {
    console.error("Error updating sales order:", error);
    return { success: false };
  }
}

// ─── Create Pending Charge ──────────────────────────────────────────

/**
 * Creates a pending payment + updates sales order totals in one call.
 */
export async function createPendingCharge(
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
  salesOrderId: string,
  payments: PaymentEntry[],
  totalPaid: number,
  referencePrefix: string = "PAG"
): Promise<number> {
  try {
    const currentShiftId = await getReceptionShiftId();
    const currentEmployeeId = await getReceptionEmployeeId();
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
