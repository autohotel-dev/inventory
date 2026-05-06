import { useState, useCallback, useEffect } from "react";

import { apiClient } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";
import { useSystemConfigRead } from "@/hooks/use-system-config";
import { Employee, ShiftDefinition, ShiftSession, EMPLOYEE_ROLES } from "@/components/employees/types";

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
      const { data } = await apiClient.get('/hr/manager/data') as any;
      
      const allShifts = data.shifts || [];
      setEmployees(data.employees || []);
      
      let allActiveSessions: ShiftSession[] = [];
      const role = data.user_role;
      const isAdminOrManager = role === 'admin' || role === 'manager' || role === 'supervisor';
      
      if (isAdminOrManager) {
        allActiveSessions = data.active_sessions || [];
      }
      
      const sessionRes = { data: data.active_sessions && data.active_sessions.length > 0 ? [data.active_sessions[0]] : [] };

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
  }, [onShiftChange, systemConfig]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

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
        try {
          const { data: activeSessions } = await apiClient.get('/hr/sessions', { params: { status: 'active' } });
          const activeCount = (activeSessions as any[])?.length || 0;

          if (activeCount >= roleLimit) {
            const activeNames = (activeSessions as any[])
              ?.map((s: any) => `${s.employee?.first_name || ''} ${s.employee?.last_name || ''}`)
              .join(", ");

            showError(
              "Límite de turnos alcanzado",
              `Ya hay ${activeCount} turno(s) activo(s) de ${roleLabel} (máximo permitido: ${roleLimit}). Empleado(s) activo(s): ${activeNames}. Primero debe(n) cerrar su turno para que puedas iniciar uno nuevo.`
            );
            setActionLoading(false);
            return;
          }
        } catch (e) {
          console.warn('Could not check active sessions limit:', e);
        }
      }

      const response = await apiClient.post('/hr/sessions/clock-in', {
          employee_id: selectedEmployeeId,
          shift_definition_id: currentShift.id,
          clock_in_at: new Date().toISOString(),
          status: "active",
      });
      const data = response.data;

      success("Entrada registrada", "Se ha registrado tu entrada al turno");
      setActiveSession(data);
      setIsClockInModalOpen(false);
      setSelectedEmployeeId("");
      await loadData();
    } catch (err: any) {
      console.error("Error clocking in:", err);
      let errorMessage = "";
      if (err?.response?.data?.detail) {
        if (Array.isArray(err.response.data.detail)) {
          errorMessage = JSON.stringify(err.response.data.detail);
        } else {
          errorMessage = err.response.data.detail;
        }
      } else {
        errorMessage = err.message || err.details || "";
      }

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
      await apiClient.post(`/hr/sessions/${activeSession.id}/clock-out`);

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
      await apiClient.post(`/hr/sessions/${targetSession.id}/clock-out`);

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
