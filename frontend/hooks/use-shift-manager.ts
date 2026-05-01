import { useState, useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSystemConfigRead } from "@/hooks/use-system-config";
import { Employee, ShiftDefinition, ShiftSession, EMPLOYEE_ROLES } from "@/components/employees/types";

export function useShiftManager(onShiftChange?: (session: ShiftSession | null) => void) {
  const supabase = createClient();
  const { success, error: showError } = useToast();
  const systemConfig = useSystemConfigRead();

  // Estados
  const [currentShift, setCurrentShift] = useState<ShiftDefinition | null>(null);
  const [nextShift, setNextShift] = useState<ShiftDefinition | null>(null);
  const [activeSession, setActiveSession] = useState<ShiftSession | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activeSessionsList, setActiveSessionsList] = useState<ShiftSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Modales
  const [isClockInModalOpen, setIsClockInModalOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [showClockOutOptions, setShowClockOutOptions] = useState(false);
  const [showClosingModal, setShowClosingModal] = useState(false);
  const [sessionToClose, setSessionToClose] = useState<ShiftSession | null>(null);

  const getRoleLimit = (role: string): number | undefined => {
    switch (role) {
      case 'receptionist': return systemConfig.maxShiftsReceptionist;
      case 'cochero': return systemConfig.maxShiftsValet;
      case 'admin':
      case 'manager': return systemConfig.maxShiftsAdmin;
      default: return undefined;
    }
  };

  const loadData = useCallback(async () => {
    try {
      const [shiftsRes, employeesRes, sessionRes] = await Promise.all([
        supabase.from("shift_definitions").select("*").eq("is_active", true).order("start_time"),
        supabase.from("employees").select("*").eq("is_active", true).in("role", ["receptionist", "manager", "cochero", "camarista", "mantenimiento"]).order("first_name"),
        supabase.from("shift_sessions").select("*, employees(*), shift_definitions(*)").eq("status", "active").is("clock_out_at", null).order("clock_in_at", { ascending: false }).limit(1),
      ]);

      if (shiftsRes.error) throw shiftsRes.error;
      if (employeesRes.error) throw employeesRes.error;
      if (sessionRes.error) throw sessionRes.error;

      const { data: { user } } = await supabase.auth.getUser();
      let allActiveSessions: ShiftSession[] = [];

      if (user) {
        const { data: roleData } = await supabase.from("employees").select("role").eq("auth_user_id", user.id).single();
        const role = roleData?.role;
        const isAdminOrManager = role === 'admin' || role === 'manager' || role === 'supervisor';

        if (isAdminOrManager) {
          const { data: allSessions } = await supabase.from("shift_sessions").select("*, employees(*), shift_definitions(*)").eq("status", "active").is("clock_out_at", null).order("clock_in_at", { ascending: false });
          if (allSessions) allActiveSessions = allSessions;
        }
      }

      const allShifts = shiftsRes.data || [];
      setEmployees(employeesRes.data || []);

      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 8);

      let current: ShiftDefinition | null = null;
      let next: ShiftDefinition | null = null;

      for (const shift of allShifts) {
        const start = shift.start_time;
        const end = shift.end_time;

        if (shift.crosses_midnight) {
          if (currentTime >= start || currentTime < end) {
            current = shift;
          }
        } else {
          if (currentTime >= start && currentTime < end) {
            current = shift;
          }
        }
      }

      if (current) {
        const currentIndex = allShifts.findIndex((s: any) => s.id === current!.id);
        next = allShifts[(currentIndex + 1) % allShifts.length];
      }

      setCurrentShift(current);
      setNextShift(next);

      const session = sessionRes.data?.[0] || null;
      setActiveSession(session);
      setActiveSessionsList(allActiveSessions);
      onShiftChange?.(session);
    } catch (err: any) {
      console.error("Error loading shift data:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase, onShiftChange, systemConfig]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);

    const channel = supabase
      .channel('shift-indicator-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shift_sessions' },
        () => {
          console.log('[SHIFT INDICATOR] Shift session change detected, refreshing...');
          loadData();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [loadData, supabase]);

  const handleClockIn = async () => {
    if (!selectedEmployeeId || !currentShift) return;

    setActionLoading(true);
    try {
      const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);
      if (!selectedEmployee) {
        showError("Error", "No se encontró el empleado seleccionado");
        setActionLoading(false);
        return;
      }

      const employeeRole = selectedEmployee.role;
      const roleLimit = getRoleLimit(employeeRole);
      const roleLabel = EMPLOYEE_ROLES.find(r => r.value === employeeRole)?.label || employeeRole;

      if (roleLimit !== undefined) {
        const { data: activeSessions, error: checkError } = await supabase
          .from("shift_sessions")
          .select("*, employees!inner(*)")
          .eq("status", "active")
          .eq("employees.role", employeeRole)
          .is("clock_out_at", null);

        if (checkError) throw checkError;

        const activeCount = activeSessions?.length || 0;

        if (activeCount >= roleLimit) {
          const activeNames = activeSessions
            ?.map((s: any) => `${s.employees.first_name} ${s.employees.last_name}`)
            .join(", ");

          showError(
            "Límite de turnos alcanzado",
            `Ya hay ${activeCount} turno(s) activo(s) de ${roleLabel} (máximo permitido: ${roleLimit}). Empleado(s) activo(s): ${activeNames}. Primero debe(n) cerrar su turno para que puedas iniciar uno nuevo.`
          );
          setActionLoading(false);
          return;
        }
      }

      const { data, error } = await supabase
        .from("shift_sessions")
        .insert({
          employee_id: selectedEmployeeId,
          shift_definition_id: currentShift.id,
          clock_in_at: new Date().toISOString(),
          status: "active",
        })
        .select("*, employees(*), shift_definitions(*)")
        .single();

      if (error) throw error;

      success("Entrada registrada", "Se ha registrado tu entrada al turno");
      setActiveSession(data);
      setIsClockInModalOpen(false);
      setSelectedEmployeeId("");
      await loadData();
    } catch (err: any) {
      console.error("Error clocking in:", err);
      const errorMessage = err.message || err.details || "";

      if (errorMessage.includes("ROLE_SHIFT_LIMIT_EXCEEDED")) {
        const parts = errorMessage.split("::");
        const roleName = parts[1] || "tu puesto";
        showError("⚠️ Turno en curso", `Ya hay un turno de ${roleName} activo en este momento. Debes cerrar el turno anterior antes de poder iniciar uno nuevo.`);
      } else if (
        errorMessage.includes("idx_single_active_shift_session") ||
        errorMessage.includes("duplicate key") ||
        errorMessage.includes("unique constraint") ||
        err.code === "23505"
      ) {
        showError("⚠️ Turno en curso", "Otro empleado ya tiene un turno activo. Pídele que cierre su turno o contacta a un supervisor para continuar.");
      } else {
        showError("No se pudo iniciar el turno", "Ocurrió un problema al registrar tu entrada. Intenta de nuevo o contacta a un supervisor si el problema persiste.");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleClockOutClick = () => {
    if (!activeSession) {
      showError("Error", "No hay un turno activo");
      return;
    }

    const role = activeSession.employees?.role;
    if (role === 'cochero') {
      handleClockOutDeferred();
      return;
    }

    setShowClockOutOptions(true);
  };

  const handleClockOutWithClosing = async () => {
    if (!activeSession || actionLoading) return;

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("shift_sessions")
        .update({
          clock_out_at: new Date().toISOString(),
          status: "pending_closing",
        })
        .eq("id", activeSession.id);

      if (error) throw error;

      const updatedSession = {
        ...activeSession,
        clock_out_at: new Date().toISOString(),
        status: "pending_closing" as const,
      };

      setSessionToClose(updatedSession);
      setShowClockOutOptions(false);
      setShowClosingModal(true);
    } catch (err: any) {
      console.error("Error clocking out:", err);
      showError("Error", err.message || "No se pudo registrar la salida");
      setActionLoading(false);
    }
  };

  const handleClockOutDeferred = async (targetSession: ShiftSession | null = activeSession) => {
    if (!targetSession || actionLoading) return;

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("shift_sessions")
        .update({
          clock_out_at: new Date().toISOString(),
          status: "pending_closing",
        })
        .eq("id", targetSession.id);

      if (error) throw error;

      success("Turno cerrado", "El turno se ha cerrado correctamente.");

      if (activeSession?.id === targetSession.id) {
        setActiveSession(null);
        onShiftChange?.(null);
      }

      setShowClockOutOptions(false);
      loadData();
    } catch (err: any) {
      console.error("Error clocking out:", err);
      showError("Error", err.message || "No se pudo registrar la salida");
    } finally {
      setActionLoading(false);
    }
  };

  const handleClosingComplete = () => {
    setShowClosingModal(false);
    setSessionToClose(null);
    setActiveSession(null);
    onShiftChange?.(null);
    setActionLoading(false);
    loadData();
  };

  return {
    currentShift, nextShift, activeSession, employees, activeSessionsList,
    loading, actionLoading,
    isClockInModalOpen, setIsClockInModalOpen,
    selectedEmployeeId, setSelectedEmployeeId,
    showClockOutOptions, setShowClockOutOptions,
    showClosingModal, setShowClosingModal,
    sessionToClose, setSessionToClose, setActiveSession,
    
    handleClockIn, handleClockOutClick, handleClockOutWithClosing,
    handleClockOutDeferred, handleClosingComplete
  };
}
