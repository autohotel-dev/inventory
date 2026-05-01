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
  | "MAINTENANCE";

interface AuditOptions {
  tableName?: string;
  recordId?: string;
  description?: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
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
      p_severity: "INFO",
    });

    if (error) {
      console.error("[audit-logger] Error:", error.message);
    }
  } catch (err) {
    console.error("[audit-logger] Unexpected error:", err);
  }
}
