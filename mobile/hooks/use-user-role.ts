import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

export type UserRole = "admin" | "manager" | "receptionist" | "cochero" | "camarista" | "mantenimiento" | null;

interface UserRoleData {
  role: UserRole;
  employeeId: string | null;
  employeeName: string | null;
  userId: string | null;
  userEmail: string | null;
  isLoading: boolean;
  isValet: boolean;
  hasActiveShift: boolean;
  refresh: () => Promise<void>;
}

export function useUserRole(): UserRoleData {
  const [role, setRole] = useState<UserRole>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [employeeName, setEmployeeName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [hasActiveShift, setHasActiveShift] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserRole = useCallback(async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        setRole(null);
        setUserId(null);
        setUserEmail(null);
        setHasActiveShift(false);
        setIsLoading(false);
        return;
      }

      setUserId(user.id);
      setUserEmail(user.email || null);

      // Search for linked employee
      let { data: employee, error: employeeError } = await supabase
        .from("employees")
        .select("id, first_name, last_name, role")
        .eq("auth_user_id", user.id)
        .eq("is_active", true)
        .single();

      if (employeeError || !employee) {
        console.log("[SHIFT DEBUG] No direct employee link, trying email fallback...");
        // Search by email as fallback
        const { data: employeeByEmail } = await supabase
          .from("employees")
          .select("id, first_name, last_name, role")
          .eq("email", user.email)
          .eq("is_active", true)
          .single();

        employee = employeeByEmail;
      }

      if (!employee) {
        console.log("[SHIFT DEBUG] Employee not found for user:", user.email);
        setRole(null); // Valet app only for linked employees
        setHasActiveShift(false);
      } else {
        console.log("[SHIFT DEBUG] Employee found:", employee.id, employee.role);
        setRole(employee.role as UserRole);
        setEmployeeId(employee.id);
        setEmployeeName(`${employee.first_name} ${employee.last_name}`);

        // Check for active shift
        const { data: session, error: shiftError } = await supabase
          .from("shift_sessions")
          .select("id, status")
          .eq("employee_id", employee.id)
          .in("status", ["active", "open"])
          .limit(1)
          .maybeSingle();

        if (shiftError) console.error("[SHIFT DEBUG] Error checking shift:", shiftError);
        console.log("[SHIFT DEBUG] Shift session result:", session);

        setHasActiveShift(!!session);
      }
    } catch (err) {
      console.error("Error fetching user role:", err);
      setHasActiveShift(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserRole();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchUserRole();
    });

    return () => subscription.unsubscribe();
  }, [fetchUserRole]);

  // Subscripción en tiempo real para cambios de turno
  useEffect(() => {
    if (!employeeId) return;

    console.log("[SHIFT SYNC] Subscribing to shift_sessions for employee:", employeeId);
    
    const channel = supabase
      .channel(`shift-sync-${employeeId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shift_sessions",
          filter: `employee_id=eq.${employeeId}`,
        },
        (payload) => {
          console.log("[SHIFT SYNC] Shift change detected:", payload.eventType);
          fetchUserRole();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [employeeId, fetchUserRole]);

  return {
    role,
    employeeId,
    employeeName,
    userId,
    userEmail,
    isLoading,
    isValet: role === "cochero",
    hasActiveShift,
    refresh: fetchUserRole,
  };
}
