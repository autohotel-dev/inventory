/**
 * Shift and employee resolution helpers.
 * Resolves which shift session and employee to assign to operations.
 */

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

// ─── Reception Shift (prioritizes receptionist role) ─────────────────

export async function getReceptionShiftId(supabase: any): Promise<string | null> {
  try {
    const { data: receptionSessions } = await supabase
      .from("shift_sessions")
      .select(`
        id,
        employees!inner (
          role
        )
      `)
      .in("status", ["active", "open"])
      .or("role.eq.receptionist,role.eq.admin,role.eq.manager", { foreignTable: "employees" })
      .order("clock_in_at", { ascending: false })
      .limit(1);

    if (receptionSessions && receptionSessions.length > 0) {
      return receptionSessions[0].id;
    }
    return null;
  } catch (error) {
    console.error("Error getting reception shift:", error);
    return null;
  }
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

// ─── Reception Employee ID (with fallback) ──────────────────────────

export async function getReceptionEmployeeId(supabase: any): Promise<string | null> {
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

    if (receptionSessions && receptionSessions.length > 0) {
      return receptionSessions[0].employee_id;
    }
    return await getCurrentEmployeeId(supabase);
  } catch (err) {
    console.error("Error getting reception employee id:", err);
    return await getCurrentEmployeeId(supabase);
  }
}
