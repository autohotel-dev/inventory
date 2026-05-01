import { createClient } from "./supabase/client";

export type AuditAction =
  | "INSERT"
  | "UPDATE"
  | "DELETE"
  | "LOGIN"
  | "LOGOUT"
  | "LOGIN_FAILED"
  | "PERMISSION_CHANGE"
  | "PURGE_SYSTEM"
  | "MAINTENANCE"
  // ─── Granular Reception Actions ─────────────────────────────────
  | "CANCEL_ITEM"
  | "CANCEL_CHARGE"
  | "COURTESY"
  | "RENEWAL"
  | "EXTRA_HOUR"
  | "EXTRA_PERSON"
  | "PROMO_4H"
  | "DAMAGE_CHARGE"
  | "CHECKOUT"
  | "ADD_PERSON"
  | "REMOVE_PERSON"
  | "TOLERANCE"
  | "CONSUMPTION_ADDED"
  | "PAYMENT_METHOD_CHANGE";

interface AuditOptions {
  tableName?: string;
  recordId?: string;
  description?: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  severity?: "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";
}

/**
 * Log an audit event via the log_audit RPC function in Supabase.
 * Fire-and-forget: errors are only logged to console, never thrown.
 */
export async function logAudit(action: AuditAction, options: AuditOptions = {}) {
  try {
    const supabase = createClient();

    let eventType = "SYSTEM_EVENT";
    let entityType = options.tableName ?? "system";
    
    if (["LOGIN", "LOGOUT", "LOGIN_FAILED"].includes(action)) {
      eventType = "AUTH_EVENT";
      entityType = "auth";
    } else if (["INSERT", "UPDATE", "DELETE"].includes(action)) {
      eventType = "DATA_CHANGE";
    } else if ([
      "CANCEL_ITEM", "CANCEL_CHARGE", "COURTESY", "RENEWAL",
      "EXTRA_HOUR", "EXTRA_PERSON", "PROMO_4H", "DAMAGE_CHARGE",
      "CHECKOUT", "ADD_PERSON", "REMOVE_PERSON", "TOLERANCE",
      "CONSUMPTION_ADDED", "PAYMENT_METHOD_CHANGE"
    ].includes(action)) {
      eventType = "RECEPTION_ACTION";
    }

    // `entity_id` is NOT NULL in the database, so we must provide a valid UUID
    let entityId = options.recordId;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!entityId || !uuidRegex.test(entityId)) {
      entityId = crypto.randomUUID();
    }

    const { error } = await supabase.rpc("log_audit", {
      p_event_type: eventType,
      p_entity_type: entityType,
      p_entity_id: entityId,
      p_action: action,
      p_description: options.description ?? null,
      p_old_data: options.oldData ?? null,
      p_new_data: options.newData ?? null,
      p_metadata: options.metadata ?? {},
      p_severity: options.severity ?? "INFO",
    });

    if (error) {
      console.error("[audit-logger] Error:", error.message);
    }
  } catch (err) {
    console.error("[audit-logger] Unexpected error:", err);
  }
}

// ─── Financial Action Helper ──────────────────────────────────────────
// Convenience wrapper for financial/reception events that auto-populates
// room_number, amount, session_id, and payment_method in metadata.

interface FinancialAuditOptions {
  roomNumber: string;
  amount?: number;
  sessionId?: string | null;
  paymentMethod?: string;
  stayId?: string;
  salesOrderId?: string;
  itemId?: string;
  description: string;
  extra?: Record<string, unknown>;
  severity?: "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";
}

/**
 * Log a financial/reception audit event with standardized metadata.
 * Fire-and-forget — never blocks the calling operation.
 */
export function logFinancialAction(action: AuditAction, opts: FinancialAuditOptions) {
  const metadata: Record<string, unknown> = {
    room_number: opts.roomNumber,
    ...(opts.amount != null && { amount: opts.amount }),
    ...(opts.sessionId && { session_id: opts.sessionId }),
    ...(opts.paymentMethod && { payment_method: opts.paymentMethod }),
    ...(opts.stayId && { stay_id: opts.stayId }),
    ...(opts.salesOrderId && { sales_order_id: opts.salesOrderId }),
    ...(opts.itemId && { item_id: opts.itemId }),
    ...opts.extra,
  };

  // Fire-and-forget — intentionally no await
  logAudit(action, {
    tableName: "room_stays",
    recordId: opts.stayId || opts.salesOrderId || opts.itemId,
    description: opts.description,
    metadata,
    severity: opts.severity,
  });
}
