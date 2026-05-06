/**
 * Shift and employee resolution helpers.
 * Resolves which shift session and employee to assign to operations.
 * 
 * Migrated from Supabase direct queries to FastAPI apiClient.
 */

import { apiClient } from "@/lib/api/client";

// ─── Cached Reception Context ───────────────────────────────────────

interface ReceptionContext {
  shiftId: string | null;
  employeeId: string | null;
  ts: number;
}

let _cachedReceptionCtx: ReceptionContext | null = null;
const RECEPTION_CACHE_TTL = 30_000; // 30 seconds

/**
 * Returns { shiftId, employeeId } for the active reception shift.
 * Caches the result for 30s to avoid repeated API queries during
 * multi-step operations like checkout.
 */
export async function getReceptionContext(_supabase?: any): Promise<{ shiftId: string | null; employeeId: string | null }> {
  if (_cachedReceptionCtx && Date.now() - _cachedReceptionCtx.ts < RECEPTION_CACHE_TTL) {
    return { shiftId: _cachedReceptionCtx.shiftId, employeeId: _cachedReceptionCtx.employeeId };
  }

  try {
    const { data } = await apiClient.get("/hr/manager/data") as any;
    const activeSessions = data?.active_sessions || [];
    
    const result: ReceptionContext = {
      shiftId: activeSessions[0]?.id || null,
      employeeId: activeSessions[0]?.employee_id || null,
      ts: Date.now(),
    };

    if (result.shiftId) {
      _cachedReceptionCtx = result;
    }

    // Fallback: if no reception session, try current user via /auth/me
    if (!result.employeeId) {
      result.employeeId = await getCurrentEmployeeId();
    }

    return { shiftId: result.shiftId, employeeId: result.employeeId };
  } catch (error) {
    console.error("Error getting reception context:", error);
    return { shiftId: null, employeeId: null };
  }
}

/** Invalidate the cached reception context (call on shift change) */
export function invalidateReceptionCache(): void {
  _cachedReceptionCtx = null;
}

// ─── Current User's Shift ────────────────────────────────────────────

export async function getCurrentShiftId(_supabase?: any): Promise<string | null> {
  try {
    const { data } = await apiClient.get("/system/auth/me") as any;
    if (!data?.employeeId) return null;
    
    // Use manager data to find active session for this employee
    const { data: managerData } = await apiClient.get("/hr/manager/data") as any;
    const sessions = managerData?.active_sessions || [];
    const mySession = sessions.find((s: any) => s.employee_id === data.employeeId);
    return mySession?.id || null;
  } catch (error) {
    console.error("Error getting current shift:", error);
    return null;
  }
}

// ─── Reception Shift (uses cached context) ───────────────────────────

export async function getReceptionShiftId(_supabase?: any): Promise<string | null> {
  const ctx = await getReceptionContext();
  return ctx.shiftId;
}

// ─── Current Employee ID ─────────────────────────────────────────────

export async function getCurrentEmployeeId(_supabase?: any): Promise<string | null> {
  try {
    const { data } = await apiClient.get("/system/auth/me") as any;
    return data?.employeeId || null;
  } catch (err) {
    console.error("Error getting current employee id:", err);
    return null;
  }
}

// ─── Reception Employee ID (uses cached context) ────────────────────

export async function getReceptionEmployeeId(_supabase?: any): Promise<string | null> {
  const ctx = await getReceptionContext();
  return ctx.employeeId;
}
