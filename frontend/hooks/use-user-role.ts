"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export type UserRole = "admin" | "manager" | "supervisor" | "receptionist" | "cochero" | "camarista" | "mantenimiento" | null;

interface UserRoleData {
  role: UserRole;
  employeeId: string | null;
  employeeName: string | null;
  userId: string | null;
  userEmail: string | null;
  isLoading: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isSupervisor: boolean;
  isReceptionist: boolean;
  isValet: boolean;
  isHousekeeping: boolean;
  isMaintenance: boolean;
  canAccessAdmin: boolean;
  canAccessReports: boolean;
  canAccessEmployees: boolean;
  canAccessInventory: boolean;
  canAccessPOS: boolean;
  canAccessRooms: boolean;
  canAccessShiftClosing: boolean;
  hasActiveShift: boolean;
  linkEmployeeToUser: () => Promise<boolean>;
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
    const supabase = createClient();

    try {
      // Obtener usuario autenticado
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

      // PRIORIDAD 1: Buscar empleado vinculado por auth_user_id (más seguro)
      let { data: employee, error: employeeError } = await supabase
        .from("employees")
        .select("id, first_name, last_name, role, auth_user_id")
        .eq("auth_user_id", user.id)
        .eq("is_active", true)
        .single();

      // PRIORIDAD 2: Si no hay vinculación por auth_user_id, buscar por email
      if (employeeError || !employee) {
        const { data: employeeByEmail } = await supabase
          .from("employees")
          .select("id, first_name, last_name, role, auth_user_id")
          .eq("email", user.email)
          .eq("is_active", true)
          .single();

        if (employeeByEmail) {
          employee = employeeByEmail;

          // Auto-vincular si el empleado no tiene auth_user_id
          if (!employeeByEmail.auth_user_id) {
            await supabase
              .from("employees")
              .update({ auth_user_id: user.id })
              .eq("id", employeeByEmail.id);
            console.log("✅ Empleado vinculado automáticamente con auth_user_id");
          }
        }
      }

      if (!employee) {
        setRole("admin");
        setEmployeeId(null);
        setEmployeeName(user.email || "Admin");
        setHasActiveShift(false);
      } else {
        // Usar el rol del empleado
        setRole(employee.role as UserRole);
        setEmployeeId(employee.id);
        setEmployeeName(`${employee.first_name} ${employee.last_name}`);

        // Check for active shift
        const { data: session } = await supabase
          .from("shift_sessions")
          .select("id")
          .eq("employee_id", employee.id)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();
        
        setHasActiveShift(!!session);
      }
    } catch (err) {
      console.error("Error fetching user role:", err);
      setRole("admin"); // Fallback a admin si hay error
      setHasActiveShift(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Función para vincular manualmente el usuario actual con un empleado
  const linkEmployeeToUser = useCallback(async (): Promise<boolean> => {
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return false;

      // Buscar empleado por email que no tenga auth_user_id
      const { data: employee } = await supabase
        .from("employees")
        .select("id")
        .eq("email", user.email)
        .is("auth_user_id", null)
        .eq("is_active", true)
        .single();

      if (!employee) return false;

      // Vincular
      const { error } = await supabase
        .from("employees")
        .update({ auth_user_id: user.id })
        .eq("id", employee.id);

      if (error) return false;

      // Recargar datos
      await fetchUserRole();
      return true;
    } catch {
      return false;
    }
  }, [fetchUserRole]);

  useEffect(() => {
    fetchUserRole();

    // Escuchar cambios de autenticación
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchUserRole();
    });

    return () => subscription.unsubscribe();
  }, [fetchUserRole]);

  // Suscripción realtime para cambios en shift_sessions del empleado
  useEffect(() => {
    if (!employeeId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`web-shift-sync-${employeeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shift_sessions',
          filter: `employee_id=eq.${employeeId}`,
        },
        () => {
          console.log('[WEB SHIFT SYNC] Shift change detected for employee:', employeeId);
          fetchUserRole();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [employeeId, fetchUserRole]);

  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isSupervisor = role === "supervisor";
  const isReceptionist = role === "receptionist";
  const isValet = role === "cochero";
  const isHousekeeping = role === "camarista";
  const isMaintenance = role === "mantenimiento";
  const canAccessAdmin = isAdmin || isManager || isSupervisor;

  return {
    role,
    employeeId,
    employeeName,
    userId,
    userEmail,
    isLoading,
    isAdmin,
    isManager,
    isSupervisor,
    isReceptionist,
    isValet,
    isHousekeeping,
    isMaintenance,
    canAccessAdmin,
    canAccessReports: canAccessAdmin,
    canAccessEmployees: canAccessAdmin,
    canAccessInventory: canAccessAdmin,
    canAccessPOS: true,
    canAccessRooms: true,
    canAccessShiftClosing: !isValet && !isHousekeeping && !isMaintenance, // Solo recepción y admin hacen cortes
    hasActiveShift,
    linkEmployeeToUser,
  };
}
