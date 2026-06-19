import { useState, useCallback, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSystemConfigRead } from "@/hooks/use-system-config";
import { Employee, ShiftDefinition, ShiftSession, EMPLOYEE_ROLES } from "@/components/employees/types";
import { getActiveShiftDefinitions, getActiveSession, getAllActiveSessions, clockIn } from "@/lib/services/shift-service";
import { getActiveEmployees, getEmployeeRole, SHIFT_ROLES } from "@/lib/services/employee-service";

export type ShiftStatus = 'normal' | 'expired' | 'auto_closed';

/** Calculate the correct shift end time for a session */
function calculateShiftEnd(clockIn: Date, shiftDef: ShiftDefinition): Date {
  const endTimeParts = shiftDef.end_time.split(':').map(Number);
  const endDate = new Date(clockIn);
  endDate.setHours(endTimeParts[0], endTimeParts[1], endTimeParts[2] || 0, 0);
  // If end time is before or equal to clock_in time, it's next day
  if (endDate <= clockIn) {
    endDate.setDate(endDate.getDate() + 1);
  }
  return endDate;
}

export function useShiftManager(onShiftChange?: (session: ShiftSession | null) => void) {
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
  const [shiftStatus, setShiftStatus] = useState<ShiftStatus>('normal');
  const [minutesPastEnd, setMinutesPastEnd] = useState(0);
  const autoCloseTriggeredRef = useRef(false);

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
    const supabase = createClient();
    try {
      const [shiftsResult, employeesResult, sessionResult] = await Promise.all([
        getActiveShiftDefinitions(),
        getActiveEmployees(SHIFT_ROLES),
        getActiveSession(),
      ]);

      if (!shiftsResult.success) throw new Error(shiftsResult.error);
      if (!employeesResult.success) throw new Error(employeesResult.error);
      if (!sessionResult.success) throw new Error(sessionResult.error);

      const { data: { user } } = await supabase.auth.getUser();
      let allActiveSessions: ShiftSession[] = [];

      if (user) {
        const roleResult = await getEmployeeRole(user.id);
        const role = roleResult.success ? roleResult.data : null;
        const isAdminOrManager = role === 'admin' || role === 'manager' || role === 'supervisor';

        if (isAdminOrManager) {
          const allSessionsResult = await getAllActiveSessions();
          if (allSessionsResult.success && allSessionsResult.data) allActiveSessions = allSessionsResult.data as ShiftSession[];
        }
      }

      const allShifts = (shiftsResult.data || []) as ShiftDefinition[];
      setEmployees((employeesResult.data || []) as Employee[]);

      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 8);

      let current: ShiftDefinition | null = null;
      let next: ShiftDefinition | null = null;

      const mainShifts = allShifts.filter((s: any) => s.code !== 'COMODIN');

      for (const shift of mainShifts) {
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
        const currentIndex = mainShifts.findIndex((s: any) => s.id === current!.id);
        next = mainShifts[(currentIndex + 1) % mainShifts.length];
      }

      setCurrentShift(current);
      setNextShift(next);

      const session = (sessionResult.data as ShiftSession) || null;

      // ─── Auto-close check for receptionist sessions past shift end ──────
      if (session && session.shift_definitions && session.employees?.role === 'receptionist') {
        const clockIn = new Date(session.clock_in_at);
        const shiftEnd = calculateShiftEnd(clockIn, session.shift_definitions as ShiftDefinition);
        const now = new Date();

        if (now > shiftEnd) {
          const diffMs = now.getTime() - shiftEnd.getTime();
          const diffMin = Math.floor(diffMs / (1000 * 60));
          setMinutesPastEnd(diffMin);

          // Auto-close: set clock_out_at to the shift end time
          if (!autoCloseTriggeredRef.current) {
            autoCloseTriggeredRef.current = true;
            console.log(`[SHIFT] Auto-closing session ${session.id} — shift ended ${diffMin} min ago`);

            const { error: closeError } = await supabase
              .from('shift_sessions')
              .update({
                clock_out_at: shiftEnd.toISOString(),
                status: 'pending_closing',
                auto_closed: true,
                notes: (session.notes ? session.notes + '\n' : '') +
                  `⚠️ Auto-cerrado: turno ${session.shift_definitions?.name || ''} terminó a las ${shiftEnd.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`,
              })
              .eq('id', session.id);

            if (!closeError) {
              setShiftStatus('auto_closed');
              const updatedSession = {
                ...session,
                clock_out_at: shiftEnd.toISOString(),
                status: 'pending_closing' as const,
                auto_closed: true,
              };
              setSessionToClose(updatedSession);
              setShowClosingModal(true);
              success('Turno finalizado', `Tu turno ${session.shift_definitions?.name || ''} terminó. Se abrió el corte de caja.`);
              // Don't set active session since it's now closed
              setActiveSession(null);
              setActiveSessionsList(allActiveSessions.filter(s => s.id !== session.id));
              onShiftChange?.(null);
              return; // Skip the normal session setting
            } else {
              console.error('[SHIFT] Error auto-closing session:', closeError);
              setShiftStatus('expired');
            }
          } else {
            setShiftStatus('expired');
          }
        } else {
          setShiftStatus('normal');
          setMinutesPastEnd(0);
          autoCloseTriggeredRef.current = false;
        }
      } else {
        setShiftStatus('normal');
        setMinutesPastEnd(0);
        autoCloseTriggeredRef.current = false;
      }

      setActiveSession(session);
      setActiveSessionsList(allActiveSessions);
      onShiftChange?.(session);
    } catch (err: any) {
      console.error("Error loading shift data:", err);
    } finally {
      setLoading(false);
    }
  }, [onShiftChange, systemConfig]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);

    const supabase = createClient();
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
  }, [loadData]);

  const handleClockIn = async () => {
    if (!selectedEmployeeId || !currentShift) return;

    setActionLoading(true);
    const supabase = createClient();
    try {
      // Safety net: auto-close any expired sessions before allowing new clock-in
      try {
        const { data: autoCloseResult } = await supabase.rpc('auto_close_expired_sessions');
        if (autoCloseResult?.closed > 0) {
          console.log(`[SHIFT] Auto-closed ${autoCloseResult.closed} expired sessions before clock-in`);
        }
      } catch (e) {
        console.warn('[SHIFT] auto_close_expired_sessions failed (non-blocking):', e);
      }

      const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);
      if (!selectedEmployee) {
        showError("Error", "No se encontró el empleado seleccionado");
        setActionLoading(false);
        return;
      }

      // Validar si el empleado tiene turnos pendientes de corte
      const { data: pendingSessions, error: pendingError } = await supabase
        .from("shift_sessions")
        .select("id, clock_out_at, shift_definitions(name)")
        .eq("employee_id", selectedEmployeeId)
        .eq("status", "pending_closing");

      if (pendingError) {
        console.error("[SHIFT] Error checking pending sessions:", pendingError);
      }

      if (pendingSessions && pendingSessions.length > 0) {
        const pendingShiftsInfo = pendingSessions
          .map((s: any) => {
            const shiftName = s.shift_definitions?.name || "Turno";
            const dateStr = s.clock_out_at 
              ? new Date(s.clock_out_at).toLocaleDateString("es-MX", { day: '2-digit', month: '2-digit' })
              : "";
            return `${shiftName} (${dateStr})`;
          })
          .join(", ");

        showError(
          "Cortes pendientes",
          `No puedes iniciar un nuevo turno porque tienes cortes de caja pendientes por completar: ${pendingShiftsInfo}. Por favor, completa tus cortes pendientes primero.`
        );
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

      const clockInResult = await clockIn(selectedEmployeeId, currentShift.id);

      if (!clockInResult.success) throw new Error(clockInResult.error);

      success("Entrada registrada", "Se ha registrado tu entrada al turno");
      setActiveSession(clockInResult.data as ShiftSession);
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
      const supabase = createClient();
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
      const supabase = createClient();
      const role = targetSession.employees?.role;
      let statusToSet = 'pending_closing';
      
      if (role === 'cochero') {
        statusToSet = 'closed';
      } else if (!role) {
        // Fallback de seguridad: consultar rol en base de datos si no viene pre-cargado
        const { data: empData } = await supabase
          .from("employees")
          .select("role")
          .eq("id", targetSession.employee_id)
          .maybeSingle();
        if (empData?.role === 'cochero') {
          statusToSet = 'closed';
        }
      }

      const { error } = await supabase
        .from("shift_sessions")
        .update({
          clock_out_at: new Date().toISOString(),
          status: statusToSet,
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
    // Auto-close state
    shiftStatus, minutesPastEnd,
    
    handleClockIn, handleClockOutClick, handleClockOutWithClosing,
    handleClockOutDeferred, handleClosingComplete
  };
}
