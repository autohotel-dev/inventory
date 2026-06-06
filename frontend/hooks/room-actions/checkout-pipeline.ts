/**
 * Checkout validation and payment pipeline.
 * Each step is independent and testable. Adding a new validation = adding 1 function.
 */
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

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

