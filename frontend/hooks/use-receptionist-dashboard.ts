/**
 * Hook for receptionist dashboard: shift management, summary data, and clock in/out.
 * Extracted from receptionist-dashboard.tsx for separation of concerns.
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUserRole } from "@/hooks/use-user-role";
import { ShiftSession, ShiftDefinition } from "@/components/employees/types";
import { useToast } from "@/hooks/use-toast";
import { useShiftExpenses } from "@/hooks/use-shift-expenses";
import { useSystemConfigRead } from "@/hooks/use-system-config";
import { invalidateReceptionCache } from "@/hooks/room-actions/shift-helpers";

// ─── Types ───────────────────────────────────────────────────────────

export interface ShiftSummary {
  totalSales: number;
  totalAmount: number;
  cashAmount: number;
  cardBBVA: number;
  cardGetnet: number;
  openRooms: number;
  completedCheckouts: number;
  conceptBreakdown: {
    ROOM_BASE: number;
    EXTRA_HOUR: number;
    EXTRA_PERSON: number;
    CONSUMPTION: number;
    PRODUCT: number;
  };
}

const INITIAL_SUMMARY: ShiftSummary = {
  totalSales: 0, totalAmount: 0, cashAmount: 0, cardBBVA: 0, cardGetnet: 0,
  openRooms: 0, completedCheckouts: 0,
  conceptBreakdown: { ROOM_BASE: 0, EXTRA_HOUR: 0, EXTRA_PERSON: 0, CONSUMPTION: 0, PRODUCT: 0 }
};

// ─── Formatters ──────────────────────────────────────────────────────

export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount);

export const formatTime = (date: Date) =>
  date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export const formatDate = (date: Date) =>
  date.toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

// ─── Hook ────────────────────────────────────────────────────────────

export function useReceptionistDashboard() {
  const {
    employeeName, userId, employeeId, role, isLoading: roleLoading,
    isValet, isHousekeeping, isMaintenance, isAdmin, isManager, isSupervisor
  } = useUserRole();
  const { success, error: showError } = useToast();
  const posConfig = useSystemConfigRead();

  const isRestrictedRole = isValet || isHousekeeping || isMaintenance;
  const canAdjustCash = isAdmin || isManager || isSupervisor;

  // Core state
  const [summary, setSummary] = useState<ShiftSummary>(INITIAL_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeSession, setActiveSession] = useState<ShiftSession | null>(null);
  const [systemActiveSession, setSystemActiveSession] = useState<ShiftSession | null>(null);
  const [showClosingModal, setShowClosingModal] = useState(false);
  const [showClockOutOptions, setShowClockOutOptions] = useState(false);
  const [sessionToClose, setSessionToClose] = useState<ShiftSession | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [activeValetCount, setActiveValetCount] = useState(0);
  const [showCashAdjustModal, setShowCashAdjustModal] = useState(false);
  const [cashAdjustmentInput, setCashAdjustmentInput] = useState("");

  // Shift start state
  const [currentShift, setCurrentShift] = useState<ShiftDefinition | null>(null);
  const [pinCode, setPinCode] = useState("");
  const [showPinInput, setShowPinInput] = useState(false);
  const [startingShift, setStartingShift] = useState(false);
  const [employeePin, setEmployeePin] = useState<string | null>(null);

  const effectiveSession = activeSession || systemActiveSession;
  const { expenses, totalExpenses, loading: expensesLoading, refetch: refetchExpenses } = useShiftExpenses(effectiveSession?.id || null);

  // ─── Clock ────────────────────────────────────────────────────────

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ─── Shift Detection ──────────────────────────────────────────────

  const fetchCurrentShift = async () => {
    const supabase = createClient();
    const { data: shifts } = await supabase
      .from("shift_definitions").select("*").eq("is_active", true).order("start_time");
    if (!shifts?.length) return;

    const now = new Date();
    const ct = now.toTimeString().slice(0, 8);
    // Filtrar comodin para que no sobreescriba los turnos principales
    const mainShifts = shifts.filter(s => s.code !== 'COMODIN');
    
    for (const shift of mainShifts) {
      if (shift.crosses_midnight) {
        if (ct >= shift.start_time || ct < shift.end_time) { setCurrentShift(shift); return; }
      } else {
        if (ct >= shift.start_time && ct < shift.end_time) { setCurrentShift(shift); return; }
      }
    }
  };

  const fetchEmployeePin = useCallback(async () => {
    if (!employeeId) return;
    const supabase = createClient();
    const { data } = await supabase.from("employees").select("pin_code").eq("id", employeeId).single();
    setEmployeePin(data?.pin_code || null);
  }, [employeeId]);

  const fetchActiveSession = useCallback(async () => {
    if (!employeeId) return;
    const supabase = createClient();
    const { data: sessions } = await supabase
      .from("shift_sessions").select("*, employees(*), shift_definitions(*)")
      .eq("employee_id", employeeId).eq("status", "active")
      .order("clock_in_at", { ascending: false }).limit(1);
    setActiveSession(sessions?.[0] || null);
  }, [employeeId]);

  const fetchActiveValetCount = useCallback(async () => {
    const supabase = createClient();
    const { count } = await supabase
      .from("shift_sessions").select("*, employees!inner(*)", { count: "exact", head: true })
      .eq("status", "active").eq("employees.role", "cochero").is("clock_out_at", null);
    setActiveValetCount(count || 0);
  }, []);

  const fetchSystemActiveSession = useCallback(async () => {
    if (!canAdjustCash) return;
    const supabase = createClient();
    const { data: sessions } = await supabase
      .from("shift_sessions").select("*, employees(*), shift_definitions(*)")
      .eq("status", "active").order("clock_in_at", { ascending: false }).limit(1);
    const found = sessions?.[0];
    if (found && found.employee_id !== employeeId) setSystemActiveSession(found);
  }, [canAdjustCash, employeeId]);

  // ─── Start Shift ──────────────────────────────────────────────────

  const handleStartShift = async () => {
    if (!employeeId || !currentShift) return;
    if (employeePin && pinCode !== employeePin) {
      showError("PIN incorrecto", "El PIN ingresado no es válido");
      setPinCode(""); return;
    }

    setStartingShift(true);
    try {
      const supabase = createClient();

      const getRoleLimitForDashboard = (r: string | null): number | undefined => {
        switch (r) {
          case 'receptionist': return posConfig.maxShiftsReceptionist;
          case 'cochero': return posConfig.maxShiftsValet;
          case 'admin': case 'manager': return posConfig.maxShiftsAdmin;
          default: return undefined;
        }
      };

      const roleLimit = getRoleLimitForDashboard(role);
      if (roleLimit !== undefined && role) {
        const { data: activeSessions, error: checkError } = await supabase
          .from("shift_sessions").select("*, employees!inner(*)")
          .eq("status", "active").eq("employees.role", role).is("clock_out_at", null);

        if (!checkError) {
          const activeCount = activeSessions?.length || 0;
          if (activeCount >= roleLimit) {
            const roleLabels: Record<string, string> = { receptionist: 'recepcionista', cochero: 'cochero', admin: 'administrador', manager: 'gerente' };
            const activeNames = activeSessions?.map((s: any) => `${s.employees.first_name} ${s.employees.last_name}`).join(", ");
            showError("Límite de turnos alcanzado",
              `Ya hay ${activeCount} turno(s) activo(s) de ${roleLabels[role] || role} (máximo permitido: ${roleLimit}). Empleado(s) activo(s): ${activeNames}. Primero debe(n) cerrar su turno para que puedas iniciar uno nuevo.`);
            setStartingShift(false); return;
          }
        }
      }

      const { data, error } = await supabase.from("shift_sessions")
        .insert({ employee_id: employeeId, shift_definition_id: currentShift.id, clock_in_at: new Date().toISOString(), status: "active" })
        .select("*, employees(*), shift_definitions(*)").single();
      if (error) throw error;

      success("¡Turno iniciado!", `Bienvenido al turno de ${currentShift.name}`);
      invalidateReceptionCache();
      setActiveSession(data);
      setShowPinInput(false);
      setPinCode("");
    } catch (err: any) {
      console.error("Error starting shift:", err);
      if (err.code === "23505") { showError("⚠️ Turno en curso", "Otro empleado ya tiene un turno activo. Pídele que cierre su turno o contacta a un supervisor para continuar."); return; }
      const errorMessage = String(err.message || err.details || "");
      if (errorMessage.includes("ROLE_SHIFT_LIMIT_EXCEEDED")) {
        const parts = errorMessage.split("::"); const roleName = parts[1] || "tu puesto";
        showError("⚠️ Turno en curso", `Ya hay un turno de ${roleName} activo en este momento. Debes cerrar el turno anterior antes de poder iniciar uno nuevo.`); return;
      }
      if (errorMessage.includes("idx_single_active_shift_session") || errorMessage.includes("duplicate key") || errorMessage.includes("unique constraint")) {
        showError("⚠️ Turno en curso", "Otro empleado ya tiene un turno activo. Pídele que cierre su turno o contacta a un supervisor para continuar."); return;
      }
      showError("No se pudo iniciar el turno", "Ocurrió un problema al iniciar el turno. Intenta de nuevo o contacta a un supervisor si el problema persiste.");
    } finally {
      setStartingShift(false);
    }
  };

  // ─── Clock Out ────────────────────────────────────────────────────

  const handleClockOutClick = () => {
    if (!activeSession) { showError("Error", "No hay un turno activo"); return; }
    setShowClockOutOptions(true);
  };

  const handleClockOutWithClosing = async () => {
    if (!activeSession || actionLoading) return;
    setActionLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("shift_sessions")
        .update({ clock_out_at: new Date().toISOString(), status: "pending_closing" })
        .eq("id", activeSession.id);
      if (error) throw error;

      const updatedSession = { ...activeSession, clock_out_at: new Date().toISOString(), status: "pending_closing" as const };
      setSessionToClose(updatedSession);
      setShowClockOutOptions(false);
      setShowClosingModal(true);
    } catch (err: any) {
      console.error("Error clocking out:", err);
      showError("Error", err.message || "No se pudo registrar la salida");
      setActionLoading(false);
    }
  };

  const handleClockOutDeferred = async () => {
    if (!activeSession || actionLoading) return;
    setActionLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("shift_sessions")
        .update({ clock_out_at: new Date().toISOString(), status: "pending_closing" })
        .eq("id", activeSession.id);
      if (error) throw error;
      success("Turno cerrado", "Puedes completar tu corte de caja cuando quieras desde cualquier dispositivo");
      invalidateReceptionCache();
      setActiveSession(null);
      setShowClockOutOptions(false);
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
    setActionLoading(false);
    fetchShiftSummary();
  };

  // ─── Shift Summary ────────────────────────────────────────────────

  const fetchShiftSummary = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const supabase = createClient();

    try {
      // ─── Single RPC call replaces 4 queries + JS aggregation ────────
      const { data: rpcResult, error } = await supabase.rpc('get_shift_dashboard_summary', {
        p_user_id: userId,
        p_session_id: activeSession?.id || null,
        p_include_global: posConfig.includeGlobalSalesInShift || false,
      });

      if (error) throw error;

      setSummary({
        totalSales: Number(rpcResult.totalSales) || 0,
        totalAmount: Number(rpcResult.totalAmount) || 0,
        cashAmount: Number(rpcResult.cashAmount) || 0,
        cardBBVA: Number(rpcResult.cardBBVA) || 0,
        cardGetnet: Number(rpcResult.cardGetnet) || 0,
        openRooms: Number(rpcResult.openRooms) || 0,
        completedCheckouts: Number(rpcResult.completedCheckouts) || 0,
        conceptBreakdown: {
          ROOM_BASE: Number(rpcResult.conceptBreakdown?.ROOM_BASE) || 0,
          EXTRA_HOUR: Number(rpcResult.conceptBreakdown?.EXTRA_HOUR) || 0,
          EXTRA_PERSON: Number(rpcResult.conceptBreakdown?.EXTRA_PERSON) || 0,
          CONSUMPTION: Number(rpcResult.conceptBreakdown?.CONSUMPTION) || 0,
          PRODUCT: Number(rpcResult.conceptBreakdown?.PRODUCT) || 0,
        },
      });
    } catch (error) {
      console.error("Error fetching shift summary:", error);
    } finally {
      setLoading(false);
    }
  }, [userId, activeSession, posConfig]);

  // ─── Time Remaining ───────────────────────────────────────────────

  const getTimeRemaining = () => {
    if (!activeSession?.shift_definitions?.end_time) return null;
    const now = currentTime;
    const endTime = activeSession.shift_definitions.end_time;
    const crossesMidnight = activeSession.shift_definitions.crosses_midnight;
    const [endHours, endMinutes] = endTime.split(":").map(Number);
    const endDate = new Date(now);
    endDate.setHours(endHours, endMinutes, 0, 0);
    if (crossesMidnight) { if (now.getHours() >= 12) endDate.setDate(endDate.getDate() + 1); }
    const diff = endDate.getTime() - now.getTime();
    if (diff <= 0) return { hours: 0, minutes: 0, seconds: 0, isOvertime: true };
    return {
      hours: Math.floor(diff / (1000 * 60 * 60)),
      minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
      seconds: Math.floor((diff % (1000 * 60)) / 1000),
      isOvertime: false
    };
  };

  // ─── Init Effects ─────────────────────────────────────────────────

  useEffect(() => { fetchCurrentShift(); }, []);

  useEffect(() => {
    if (employeeId) { fetchActiveSession(); fetchEmployeePin(); }
  }, [employeeId, fetchActiveSession, fetchEmployeePin]);

  useEffect(() => {
    if (canAdjustCash && !activeSession) fetchSystemActiveSession();
  }, [canAdjustCash, activeSession, fetchSystemActiveSession]);

  useEffect(() => {
    if (userId) { fetchShiftSummary(); fetchActiveValetCount(); }
  }, [userId, activeSession, fetchActiveValetCount, fetchShiftSummary]);

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient();
    let debounceTimeout: NodeJS.Timeout;
    const channel = supabase.channel('receptionist-dashboard-shifts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shift_sessions' }, () => {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
          fetchActiveSession();
          fetchActiveValetCount();
          if (canAdjustCash && !activeSession) fetchSystemActiveSession();
        }, 500);
      }).subscribe();
    return () => { clearTimeout(debounceTimeout); supabase.removeChannel(channel); };
  }, [fetchActiveSession, fetchActiveValetCount, fetchSystemActiveSession, canAdjustCash, activeSession]);

  // ─── Cash Adjustment ──────────────────────────────────────────────

  const handleCashAdjustment = async () => {
    const amount = parseFloat(cashAdjustmentInput);
    if (isNaN(amount) || amount === 0) { showError("Error", "Ingresa un monto válido"); return; }

    const supabase = createClient();
    const { error } = await supabase.from("shift_expenses").insert({
      shift_session_id: activeSession?.id, employee_id: employeeId,
      expense_type: "CASH_ADJUSTMENT",
      description: amount > 0 ? "Ajuste: Ingreso de efectivo" : "Ajuste: Retiro de efectivo",
      amount: Math.abs(amount) * (amount > 0 ? -1 : 1),
      status: "approved"
    });
    if (error) { showError("Error", "No se pudo registrar el ajuste"); console.error(error); return; }
    success(amount > 0 ? "Efectivo agregado" : "Efectivo retirado",
      `Se ${amount > 0 ? "agregaron" : "retiraron"} ${formatCurrency(Math.abs(amount))}`);
    refetchExpenses();
    setShowCashAdjustModal(false);
    setCashAdjustmentInput("");
  };

  return {
    // User info
    employeeName, userId, employeeId, role, roleLoading,
    isRestrictedRole, isAdmin, isManager, isSupervisor, canAdjustCash,
    // State
    summary, loading, currentTime, activeSession, systemActiveSession,
    showClosingModal, showClockOutOptions, sessionToClose, actionLoading,
    showExpenseModal, activeValetCount, showCashAdjustModal, cashAdjustmentInput,
    currentShift, pinCode, showPinInput, startingShift, employeePin,
    effectiveSession,
    // Expenses
    expenses, totalExpenses, expensesLoading, refetchExpenses,
    // Setters
    setShowClosingModal, setShowClockOutOptions, setSessionToClose, setActionLoading,
    setShowExpenseModal, setShowCashAdjustModal, setCashAdjustmentInput,
    setPinCode, setShowPinInput,
    // Actions
    handleStartShift, handleClockOutClick, handleClockOutWithClosing,
    handleClockOutDeferred, handleClosingComplete, fetchShiftSummary, showError, success,
    handleCashAdjustment,
    // Computed
    timeRemaining: getTimeRemaining(),
    posConfig,
    // Formatters
    formatCurrency, formatTime, formatDate,
  };
}
