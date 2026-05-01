/**
 * Shift and employee resolution helpers.
 * Resolves which shift session and employee to assign to operations.
 *
 * Performance: getReceptionContext() unifies shift + employee resolution
 * into a single cached query, avoiding redundant DB calls during checkout.
 */

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
 * Caches the result for 30s to avoid repeated DB queries during
 * multi-step operations like checkout (which calls this 4-8 times).
 */
export async function getReceptionContext(supabase: any): Promise<{ shiftId: string | null; employeeId: string | null }> {
  if (_cachedReceptionCtx && Date.now() - _cachedReceptionCtx.ts < RECEPTION_CACHE_TTL) {
    return { shiftId: _cachedReceptionCtx.shiftId, employeeId: _cachedReceptionCtx.employeeId };
  }

  try {
    const { data: receptionSessions } = await supabase
      .from("shift_sessions")
      .select(`
        id,
        employee_id,
        employees!inner (
          role
        )
      `)
      .in("status", ["active", "open"])
      .or("role.eq.receptionist,role.eq.admin,role.eq.manager", { foreignTable: "employees" })
      .order("clock_in_at", { ascending: false })
      .limit(1);

    const result: ReceptionContext = {
      shiftId: receptionSessions?.[0]?.id || null,
      employeeId: receptionSessions?.[0]?.employee_id || null,
      ts: Date.now(),
    };

    // If reception session found, cache it
    if (result.shiftId) {
      _cachedReceptionCtx = result;
    }

    // Fallback: if no reception session, try current user
    if (!result.employeeId) {
      result.employeeId = await getCurrentEmployeeId(supabase);
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

export async function getCurrentShiftId(supabase: any): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: employee } = await supabase
      .from("employees")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (!employee) return null;

    const { data: session } = await supabase
      .from("shift_sessions")
      .select("id")
      .eq("employee_id", employee.id)
      .in("status", ["active", "open"])
      .maybeSingle();

    return session?.id || null;
  } catch (error) {
    console.error("Error getting current shift:", error);
    return null;
  }
}

// ─── Reception Shift (uses cached context) ───────────────────────────

export async function getReceptionShiftId(supabase: any): Promise<string | null> {
  const ctx = await getReceptionContext(supabase);
  return ctx.shiftId;
}

// ─── Current Employee ID ─────────────────────────────────────────────

export async function getCurrentEmployeeId(supabase: any): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: employee } = await supabase
      .from("employees")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    return employee?.id || null;
  } catch (err) {
    console.error("Error getting current employee id:", err);
    return null;
  }
}

// ─── Reception Employee ID (uses cached context) ────────────────────

export async function getReceptionEmployeeId(supabase: any): Promise<string | null> {
  const ctx = await getReceptionContext(supabase);
  return ctx.employeeId;
}
