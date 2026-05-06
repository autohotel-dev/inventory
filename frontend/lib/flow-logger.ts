import { apiClient } from "@/lib/api/client";
import { createClient } from "./supabase/client";

// ─── Event Type Catalog ──────────────────────────────────────────────────────

export type FlowEventType =
  // Habitación
  | "ROOM_ASSIGNED"
  | "ROOM_STATUS_CHANGED"
  | "ROOM_CHANGED"
  // Cochero
  | "VALET_ENTRY_ACCEPTED"
  | "VALET_VEHICLE_REGISTERED"
  | "VALET_PAYMENT_COLLECTED"
  | "VALET_CHECKOUT_PROPOSED"
  | "VALET_CHECKOUT_CONFIRMED"
  // Cliente
  | "CLIENT_DATA_FILLED"
  | "VEHICLE_DATA_FILLED"
  | "PERSON_COUNT_UPDATED"
  // Pagos
  | "PAYMENT_PENDING_CREATED"
  | "PAYMENT_COLLECTED_VALET"
  | "PAYMENT_CORROBORATED"
  | "PAYMENT_CONFIRMED"
  | "PAYMENT_METHOD_CHANGED"
  | "PAYMENT_CANCELLED"
  | "PAYMENT_REFUNDED"
  // Consumos
  | "CONSUMPTION_ADDED"
  | "CONSUMPTION_ACCEPTED"
  | "CONSUMPTION_DELIVERED"
  | "CONSUMPTION_PAID"
  | "CONSUMPTION_CANCELLED"
  // Extras
  | "EXTRA_HOUR_ADDED"
  | "EXTRA_HOUR_PAID"
  | "EXTRA_PERSON_ADDED"
  | "EXTRA_PERSON_PAID"
  | "PERSON_ADDED"
  | "PERSON_REMOVED"
  | "DAMAGE_REPORTED"
  | "DAMAGE_CHARGED"
  // Checkout
  | "CHECKOUT_INITIATED"
  | "CHECKOUT_PAYMENT_PROCESSED"
  | "CHECKOUT_COMPLETED"
  | "TOLERANCE_STARTED"
  | "TOLERANCE_EXPIRED"
  // Cortesías
  | "COURTESY_APPLIED"
  | "DISCOUNT_APPLIED"
  // Renovación
  | "RENEWAL_APPLIED"
  // General
  | "NOTE_ADDED"
  | "CUSTOM_EVENT";

export type FlowEventCategory =
  | "ROOM"
  | "PAYMENT"
  | "VALET"
  | "CONSUMPTION"
  | "CHECKOUT"
  | "SYSTEM"
  | "EXTRAS"
  | "CLIENT";

// Map event types to their default categories
const EVENT_CATEGORY_MAP: Record<string, FlowEventCategory> = {
  ROOM_ASSIGNED: "ROOM",
  ROOM_STATUS_CHANGED: "ROOM",
  ROOM_CHANGED: "ROOM",
  VALET_ENTRY_ACCEPTED: "VALET",
  VALET_VEHICLE_REGISTERED: "VALET",
  VALET_PAYMENT_COLLECTED: "VALET",
  VALET_CHECKOUT_PROPOSED: "VALET",
  VALET_CHECKOUT_CONFIRMED: "VALET",
  CLIENT_DATA_FILLED: "CLIENT",
  VEHICLE_DATA_FILLED: "CLIENT",
  PERSON_COUNT_UPDATED: "CLIENT",
  PAYMENT_PENDING_CREATED: "PAYMENT",
  PAYMENT_COLLECTED_VALET: "PAYMENT",
  PAYMENT_CORROBORATED: "PAYMENT",
  PAYMENT_CONFIRMED: "PAYMENT",
  PAYMENT_METHOD_CHANGED: "PAYMENT",
  PAYMENT_CANCELLED: "PAYMENT",
  PAYMENT_REFUNDED: "PAYMENT",
  CONSUMPTION_ADDED: "CONSUMPTION",
  CONSUMPTION_ACCEPTED: "CONSUMPTION",
  CONSUMPTION_DELIVERED: "CONSUMPTION",
  CONSUMPTION_PAID: "CONSUMPTION",
  CONSUMPTION_CANCELLED: "CONSUMPTION",
  EXTRA_HOUR_ADDED: "EXTRAS",
  EXTRA_HOUR_PAID: "EXTRAS",
  EXTRA_PERSON_ADDED: "EXTRAS",
  EXTRA_PERSON_PAID: "EXTRAS",
  PERSON_ADDED: "EXTRAS",
  PERSON_REMOVED: "EXTRAS",
  DAMAGE_REPORTED: "EXTRAS",
  DAMAGE_CHARGED: "EXTRAS",
  CHECKOUT_INITIATED: "CHECKOUT",
  CHECKOUT_PAYMENT_PROCESSED: "CHECKOUT",
  CHECKOUT_COMPLETED: "CHECKOUT",
  TOLERANCE_STARTED: "CHECKOUT",
  TOLERANCE_EXPIRED: "CHECKOUT",
  COURTESY_APPLIED: "PAYMENT",
  DISCOUNT_APPLIED: "PAYMENT",
  RENEWAL_APPLIED: "ROOM",
  NOTE_ADDED: "SYSTEM",
  CUSTOM_EVENT: "SYSTEM",
};

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface FlowEventOptions {
  event_type: FlowEventType;
  description: string;
  event_category?: FlowEventCategory;
  actor_id?: string;
  actor_name?: string;
  actor_role?: string;
  metadata?: Record<string, unknown>;
}

interface CreateFlowOptions {
  room_stay_id: string;
  sales_order_id?: string;
  room_id?: string;
  room_number: string;
  shift_session_id?: string;
}

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * Create or retrieve an existing operation flow for a room stay.
 * Returns the flow_id for subsequent event logging.
 */
export async function getOrCreateFlow(options: CreateFlowOptions): Promise<string | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("create_or_get_flow", {
      p_room_stay_id: options.room_stay_id,
      p_sales_order_id: options.sales_order_id || null,
      p_room_id: options.room_id || null,
      p_room_number: options.room_number,
      p_shift_session_id: options.shift_session_id || null,
    });

    if (error) {
      console.error("[flow-logger] Error creating/getting flow:", error.message);
      return null;
    }

    return data as string;
  } catch (err) {
    console.error("[flow-logger] Unexpected error in getOrCreateFlow:", err);
    return null;
  }
}

/**
 * Log a granular event to an operation flow.
 * Fire-and-forget: errors are only logged to console, never thrown.
 *
 * The sequence_number and duration_from_previous_ms are auto-calculated
 * by the database trigger `trg_flow_event_sequence`.
 */
export async function logFlowEvent(flowId: string, options: FlowEventOptions): Promise<void> {
  try {
    const supabase = createClient();

    const category = options.event_category || EVENT_CATEGORY_MAP[options.event_type] || "SYSTEM";

    const { error } = await apiClient.post("/system/crud/flow_events", {
      flow_id: flowId,
      event_type: options.event_type,
      event_category: category,
      description: options.description,
      actor_id: options.actor_id || null,
      actor_name: options.actor_name || null,
      actor_role: options.actor_role || null,
      metadata: options.metadata || {},
    }) as any;

    if (error) {
      console.error("[flow-logger] Error logging event:", error.message);
    }
  } catch (err) {
    console.error("[flow-logger] Unexpected error in logFlowEvent:", err);
  }
}

/**
 * Complete a flow (mark as COMPLETADO).
 * Fire-and-forget.
 */
export async function completeFlow(flowId: string): Promise<void> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from("operation_flows")
      .update({ status: "COMPLETADO", completed_at: new Date().toISOString() })
      ;

    if (error) {
      console.error("[flow-logger] Error completing flow:", error.message);
    }
  } catch (err) {
    console.error("[flow-logger] Unexpected error in completeFlow:", err);
  }
}

/**
 * Cancel a flow (mark as CANCELADO).
 * Fire-and-forget.
 */
export async function cancelFlow(flowId: string): Promise<void> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from("operation_flows")
      .update({ status: "CANCELADO", completed_at: new Date().toISOString() })
      ;

    if (error) {
      console.error("[flow-logger] Error cancelling flow:", error.message);
    }
  } catch (err) {
    console.error("[flow-logger] Unexpected error in cancelFlow:", err);
  }
}

/**
 * Convenience: Create a flow AND log its first event in one call.
 * Returns the flow_id or null on error.
 */
export async function startFlowWithEvent(
  flowOptions: CreateFlowOptions,
  eventOptions: FlowEventOptions
): Promise<string | null> {
  const flowId = await getOrCreateFlow(flowOptions);
  if (flowId) {
    // Fire-and-forget the first event
    logFlowEvent(flowId, eventOptions);
  }
  return flowId;
}

/**
 * Find the active flow for a room stay (useful when you don't have the flow_id cached).
 */
export async function findActiveFlow(roomStayId: string): Promise<string | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("operation_flows")
      .select("id")
      
      
      
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[flow-logger] Error finding flow:", error.message);
      return null;
    }

    return data?.id || null;
  } catch (err) {
    console.error("[flow-logger] Unexpected error in findActiveFlow:", err);
    return null;
  }
}
