/**
 * Payment and sales order helpers.
 * Handles order totals, pending payment reconciliation, and charge creation.
 */
import { createClient } from "@/lib/supabase/client";
import { logger } from "@/lib/utils/logger";
import { PaymentEntry } from "@/components/sales/multi-payment-input";
import { generatePaymentReference } from "./room-action-helpers";
import { getReceptionShiftId, getReceptionEmployeeId } from "./shift-helpers";

// ─── Sales Order Totals ─────────────────────────────────────────────

export async function updateSalesOrderTotals(
  supabase: ReturnType<typeof createClient>,
  salesOrderId: string,
  additionalAmount: number
): Promise<{ success: boolean; newRemaining?: number }> {
  const { data: orderData, error: orderError } = await supabase
    .from("sales_orders")
    .select("subtotal, tax, paid_amount, remaining_amount")
    .eq("id", salesOrderId)
    .single();

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
    .eq("id", salesOrderId);

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
  supabase: ReturnType<typeof createClient>,
  salesOrderId: string,
  amount: number,
  concept: string,
  referencePrefix: string,
  shiftSessionId?: string | null,
  notes?: string
): Promise<{ success: boolean; newRemaining?: number }> {
  const { error: paymentError } = await supabase.from("payments").insert({
    sales_order_id: salesOrderId,
    amount,
    payment_method: "PENDIENTE",
    reference: generatePaymentReference(referencePrefix),
    concept,
    status: "PENDIENTE",
    payment_type: "COMPLETO",
    shift_session_id: shiftSessionId || null,
    ...(notes ? { notes } : {}),
  });

  if (paymentError) {
    logger.error(`Error creating pending payment for ${concept}`, paymentError);
    return { success: false };
  }

  return updateSalesOrderTotals(supabase, salesOrderId, amount);
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
  const { data: pendingPayments, error: pendingError } = await supabase
    .from("payments")
    .select("id, amount, concept")
    .eq("sales_order_id", salesOrderId)
    .eq("status", "PENDIENTE")
    .is("parent_payment_id", null)
    .order("created_at", { ascending: true });

  if (pendingError) {
    logger.error("Error fetching pending payments", pendingError);
    return totalPaid;
  }

  if (!pendingPayments || pendingPayments.length === 0) {
    logger.info("No pending payments found", { salesOrderId });
    return totalPaid;
  }

  logger.info("Found pending payments to update", {
    count: pendingPayments.length,
    payments: pendingPayments,
    totalPaid
  });

  const validPayments = payments.filter(p => p.amount > 0);
  const isMultipago = validPayments.length > 1;
  let remainingToPay = totalPaid;

  for (const pending of pendingPayments) {
    if (remainingToPay <= 0) break;

    const amountForThis = Math.min(pending.amount, remainingToPay);
    remainingToPay -= amountForThis;

    if (isMultipago) {
      await supabase
        .from("payments")
        .update({ status: "PAGADO", payment_method: "PENDIENTE" })
        .eq("id", pending.id);

      const proportion = amountForThis / totalPaid;
      const currentShiftId = await getReceptionShiftId(supabase);
      const currentEmployeeId = await getReceptionEmployeeId(supabase);

      const subpayments = validPayments.map(p => ({
        sales_order_id: salesOrderId,
        amount: Math.round(p.amount * proportion * 100) / 100,
        payment_method: p.method,
        reference: p.reference || generatePaymentReference("SUB"),
        concept: pending.concept,
        status: "PAGADO",
        payment_type: "PARCIAL",
        parent_payment_id: pending.id,
        shift_session_id: currentShiftId,
        collected_by: currentEmployeeId,
        ...(p.method === "TARJETA" && p.terminal ? { terminal_code: p.terminal } : {}),
        ...(p.method === "TARJETA" && p.cardLast4 ? { card_last_4: p.cardLast4 } : {}),
        ...(p.method === "TARJETA" && p.cardType ? { card_type: p.cardType } : {}),
      }));

      const { error: subError } = await supabase
        .from("payments")
        .insert(subpayments);

      if (subError) {
        logger.error("Error inserting subpayments for pending payment", subError);
      }
    } else {
      const p = validPayments[0];
      const currentShiftId = await getReceptionShiftId(supabase);
      const currentEmployeeId = await getReceptionEmployeeId(supabase);

      const updateData: any = {
        status: "PAGADO",
        payment_method: p.method,
        reference: p.reference || generatePaymentReference(referencePrefix),
        ...(p.method === "TARJETA" && p.terminal ? { terminal_code: p.terminal } : {}),
        ...(p.method === "TARJETA" && p.cardLast4 ? { card_last_4: p.cardLast4 } : {}),
        ...(p.method === "TARJETA" && p.cardType ? { card_type: p.cardType } : {}),
      };

      if (currentShiftId) updateData.shift_session_id = currentShiftId;
      if (currentEmployeeId) updateData.collected_by = currentEmployeeId;

      await supabase
        .from("payments")
        .update(updateData)
        .eq("id", pending.id);

      logger.info("Updated pending payment (single payment)", {
        paymentId: pending.id,
        updates: { status: "PAGADO", payment_method: p.method }
      });
    }

    logger.info("Updated pending payment to PAGADO", {
      paymentId: pending.id,
      concept: pending.concept,
      amount: pending.amount,
    });
  }

  // Update remaining_amount in sales_orders
  const paidAmountApplied = totalPaid - remainingToPay;
  if (paidAmountApplied > 0) {
    const { data: currentOrder } = await supabase
      .from("sales_orders")
      .select("remaining_amount, paid_amount")
      .eq("id", salesOrderId)
      .single();

    if (currentOrder) {
      const newRemaining = Math.max(0, (Number(currentOrder.remaining_amount) || 0) - paidAmountApplied);
      await supabase
        .from("sales_orders")
        .update({ remaining_amount: newRemaining })
        .eq("id", salesOrderId);

      logger.info("Updated sales_order totals after pending payment", {
        salesOrderId,
        paidAmountApplied,
        newRemaining,
      });
    }
  }

  return remainingToPay;
}
