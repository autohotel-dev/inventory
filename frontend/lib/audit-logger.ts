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
    const { error } = await supabase.rpc("log_audit", {
      p_action: action,
      p_table_name: options.tableName ?? null,
      p_record_id: options.recordId ?? null,
      p_description: options.description ?? null,
      p_old_data: options.oldData ?? null,
      p_new_data: options.newData ?? null,
      p_metadata: options.metadata ?? {},
    });

    if (error) {
      console.error("[audit-logger] Error:", error.message);
    }
  } catch (err) {
    console.error("[audit-logger] Unexpected error:", err);
  }
}
