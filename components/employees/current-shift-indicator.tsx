"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Sun,
  Sunset,
  Moon,
  Clock,
  User,
  LogIn,
  LogOut,
  Loader2,
  AlertCircle,
  ChevronRight,
  Receipt,
} from "lucide-react";
import { Employee, ShiftDefinition, ShiftSession, SHIFT_COLORS, SHIFT_LIMITS_BY_ROLE, EMPLOYEE_ROLES } from "./types";
import { ShiftClosingModal } from "./shift-closing";

// Iconos por turno
const SHIFT_ICONS: Record<string, React.ReactNode> = {
  MORNING: <Sun className="h-5 w-5" />,
  AFTERNOON: <Sunset className="h-5 w-5" />,
  NIGHT: <Moon className="h-5 w-5" />,
};

interface CurrentShiftIndicatorProps {
  compact?: boolean;
  showClockInOut?: boolean;
  onShiftChange?: (session: ShiftSession | null) => void;
  userRole?: string | null; // Optional user role to override permission check
}

export function CurrentShiftIndicator({
  compact = false,
  showClockInOut = true,
  onShiftChange,
}: CurrentShiftIndicatorProps) {
  const supabase = createClient();
  const { success, error: showError } = useToast();

  const [currentShift, setCurrentShift] = useState<ShiftDefinition | null>(null);
  const [nextShift, setNextShift] = useState<ShiftDefinition | null>(null);
  const [activeSession, setActiveSession] = useState<ShiftSession | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<ShiftDefinition[]>([]);
  const [activeSessionsList, setActiveSessionsList] = useState<ShiftSession[]>([]); // Lista de todas las sesiones activas (para admins)
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Modal de clock in
  const [isClockInModalOpen, setIsClockInModalOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");

  // Modal de clock out con opciones
  const [showClockOutOptions, setShowClockOutOptions] = useState(false);

  // Modal de corte de caja
  const [showClosingModal, setShowClosingModal] = useState(false);
  const [sessionToClose, setSessionToClose] = useState<ShiftSession | null>(null);

  // Cargar datos
  const loadData = async () => {
    try {
      // Cargar turnos, empleados y sesión activa
      const [shiftsRes, employeesRes, sessionRes] = await Promise.all([
        supabase
          .from("shift_definitions")
          .select("*")
          .eq("is_active", true)
          .order("start_time"),
        supabase
          .from("employees")
          .select("*")
          .eq("is_active", true)
          .in("role", ["receptionist", "manager", "cochero", "camarista", "mantenimiento"])
          .order("first_name"),
        supabase
          .from("shift_sessions")
          .select("*, employees(*), shift_definitions(*)")
          .eq("status", "active")
          .is("clock_out_at", null)
          .order("clock_in_at", { ascending: false })
          .limit(1),
      ]);

      if (shiftsRes.error) throw shiftsRes.error;
      if (employeesRes.error) throw employeesRes.error;
      if (sessionRes.error) throw sessionRes.error;

      // Si es admin/manager/supervisor, cargar TODAS las sesiones activas
      const { data: { user } } = await supabase.auth.getUser();
      let allActiveSessions: ShiftSession[] = [];

      if (user) {
        // Verificar rol del usuario actual
        const { data: roleData } = await supabase
          .from("employees")
          .select("role")
          .eq("auth_user_id", user.id)
          .single();

        const role = roleData?.role;
        const isAdminOrManager = role === 'admin' || role === 'manager' || role === 'supervisor';

        if (isAdminOrManager) {
          const { data: allSessions } = await supabase
            .from("shift_sessions")
            .select("*, employees(*), shift_definitions(*)")
            .eq("status", "active")
            .is("clock_out_at", null)
            .order("clock_in_at", { ascending: false });

          if (allSessions) allActiveSessions = allSessions;
        }
      }

      const allShifts = shiftsRes.data || [];
      setShifts(allShifts);
      setEmployees(employeesRes.data || []);

      // Determinar turno actual basado en la hora
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 8);

      let current: ShiftDefinition | null = null;
      let next: ShiftDefinition | null = null;

      for (const shift of allShifts) {
        const start = shift.start_time;
        const end = shift.end_time;

        if (shift.crosses_midnight) {
          // Turno nocturno (22:00 - 06:00)
          if (currentTime >= start || currentTime < end) {
            current = shift;
          }
        } else {
          // Turno normal
          if (currentTime >= start && currentTime < end) {
            current = shift;
          }
        }
      }

      // Determinar siguiente turno
      if (current) {
        const currentIndex = allShifts.findIndex((s: any) => s.id === current!.id);
        next = allShifts[(currentIndex + 1) % allShifts.length];
      }

      setCurrentShift(current);
      setNextShift(next);

      // Sesión activa
      const session = sessionRes.data?.[0] || null;
      setActiveSession(session);
      setActiveSessionsList(allActiveSessions); // Guardar lista completa
      onShiftChange?.(session);
    } catch (err: any) {
      console.error("Error loading shift data:", err);
      // Silenciar error si las tablas no existen
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Actualizar cada minuto
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, []);

  // Clock In
  const handleClockIn = async () => {
    if (!selectedEmployeeId || !currentShift) return;

    setActionLoading(true);
    try {
      // Obtener información del empleado seleccionado
      const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);
      if (!selectedEmployee) {
        showError("Error", "No se encontró el empleado seleccionado");
        setActionLoading(false);
        return;
      }

      const employeeRole = selectedEmployee.role;
      const roleLimit = SHIFT_LIMITS_BY_ROLE[employeeRole];
      const roleLabel = EMPLOYEE_ROLES.find(r => r.value === employeeRole)?.label || employeeRole;

      // 🔒 VALIDACIÓN POR ROL: Verificar límite de turnos activos para este rol
      // EXCEPCIÓN: Si el empleado mismo es admin o manager, podría tener un tratamiento especial, pero por consistencia
      // aplicamos la regla. Los admins que inician turno para OTROS deben respetar la regla del OTRO.
      if (roleLimit !== undefined) {
        const { data: activeSessions, error: checkError } = await supabase
          .from("shift_sessions")
          .select("*, employees!inner(*)")
          .eq("status", "active")
          .eq("employees.role", employeeRole)
          .is("clock_out_at", null);

        if (checkError) throw checkError;

        const activeCount = activeSessions?.length || 0;

        // Si se ha alcanzado el límite para este rol, mostrar error
        if (activeCount >= roleLimit) {
          const activeNames = activeSessions
            ?.map((s: any) => `${s.employees.first_name} ${s.employees.last_name}`)
            .join(", ");

          showError(
            "Límite de turnos alcanzado",
            `Ya hay ${activeCount} turno(s) activo(s) de ${roleLabel} (máximo permitido: ${roleLimit}). ` +
            `Empleado(s) activo(s): ${activeNames}. ` +
            `Primero debe(n) cerrar su turno para que puedas iniciar uno nuevo.`
          );
          setActionLoading(false);
          return;
        }
      }

      // Proceder con el registro del turno
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
      onShiftChange?.(data);
      setIsClockInModalOpen(false);
      setSelectedEmployeeId("");
    } catch (err: any) {
      console.error("Error clocking in:", err);
      console.log("Error details:", {
        message: err.message,
        code: err.code,
        details: err.details,
        hint: err.hint,
        fullError: err
      });

      // Detectar error del trigger de límite por rol
      const errorMessage = err.message || err.details || "";

      if (errorMessage.includes("ROLE_SHIFT_LIMIT_EXCEEDED")) {
        // Parsear el mensaje del trigger: ROLE_SHIFT_LIMIT_EXCEEDED::RoleName::count::max
        const parts = errorMessage.split("::");
        const roleName = parts[1] || "este rol";
        const currentCount = parts[2] || "?";
        const maxAllowed = parts[3] || "?";

        showError(
          "Límite de turnos alcanzado",
          `Ya hay ${currentCount} turno(s) activo(s) de ${roleName} (máximo permitido: ${maxAllowed}). Cierra un turno existente antes de iniciar uno nuevo.`
        );
      } else if (
        errorMessage.includes("idx_single_active_shift_session") ||
        errorMessage.includes("duplicate key") ||
        errorMessage.includes("unique constraint") ||
        err.code === "23505"
      ) {
        showError(
          "No se puede iniciar turno",
          "Ya existe un turno activo en el sistema. Por favor, cierra el turno anterior antes de iniciar uno nuevo."
        );
      } else {
        showError("Error", err.message || "No se pudo registrar la entrada");
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Clock Out - Mostrar opciones
  const handleClockOutClick = () => {
    if (!activeSession) {
      showError("Error", "No hay un turno activo");
      return;
    }
    setShowClockOutOptions(true);
  };

  // Clock Out con corte inmediato
  const handleClockOutWithClosing = async () => {
    if (!activeSession || actionLoading) return; // Prevent race conditions

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

      // Actualizar sesión local
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

  // Clock Out diferido (sin corte inmediato)
  const handleClockOutDeferred = async () => {
    if (!activeSession || actionLoading) return; // Prevent race conditions

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

      success(
        "Turno cerrado",
        "Puedes completar tu corte de caja cuando quieras desde cualquier dispositivo"
      );
      setActiveSession(null);
      onShiftChange?.(null);
      setShowClockOutOptions(false);
    } catch (err: any) {
      console.error("Error clocking out:", err);
      showError("Error", err.message || "No se pudo registrar la salida");
    } finally {
      setActionLoading(false);
    }
  };

  // Callback cuando se completa el corte
  const handleClosingComplete = () => {
    setShowClosingModal(false);
    setSessionToClose(null);
    setActiveSession(null);
    onShiftChange?.(null);
    setActionLoading(false);
    loadData(); // Recargar datos
  };

  // Formatear hora
  const formatTime = (time: string) => time.slice(0, 5);

  // Calcular tiempo restante del turno
  const getTimeRemaining = () => {
    if (!currentShift) return null;

    const now = new Date();
    const [endHour, endMin] = currentShift.end_time.split(":").map(Number);
    let endDate = new Date(now);
    endDate.setHours(endHour, endMin, 0, 0);

    // Si el turno cruza medianoche y estamos antes de medianoche
    if (currentShift.crosses_midnight && now.getHours() >= 22) {
      endDate.setDate(endDate.getDate() + 1);
    }

    const diff = endDate.getTime() - now.getTime();
    if (diff < 0) return null;

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Cargando turno...</span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        {currentShift && (
          <Badge className={`${SHIFT_COLORS[currentShift.code]} text-white`}>
            {SHIFT_ICONS[currentShift.code]}
            <span className="ml-1">{currentShift.name}</span>
          </Badge>
        )}
        {activeSession?.employees && (
          <span className="text-sm text-muted-foreground">
            <User className="h-3 w-3 inline mr-1" />
            {activeSession.employees.first_name}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="bg-card border rounded-lg p-4 space-y-4">
      {/* Turno actual */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {currentShift ? (
            <>
              <div
                className={`p-3 rounded-full ${SHIFT_COLORS[currentShift.code]} text-white`}
              >
                {SHIFT_ICONS[currentShift.code]}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Turno actual</p>
                <p className="text-lg font-semibold">{currentShift.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatTime(currentShift.start_time)} - {formatTime(currentShift.end_time)}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="p-3 rounded-full bg-gray-500 text-white">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Turno actual</p>
                <p className="text-lg font-semibold">Sin turno definido</p>
              </div>
            </>
          )}
        </div>

        {currentShift && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Tiempo restante</p>
            <p className="text-lg font-mono font-semibold">
              <Clock className="h-4 w-4 inline mr-1" />
              {getTimeRemaining() || "--:--"}
            </p>
          </div>
        )}
      </div>

      {/* Siguiente turno */}
      {nextShift && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ChevronRight className="h-4 w-4" />
          <span>Siguiente:</span>
          <Badge variant="outline" className="font-normal">
            {SHIFT_ICONS[nextShift.code]}
            <span className="ml-1">{nextShift.name}</span>
            <span className="ml-1 opacity-70">
              ({formatTime(nextShift.start_time)})
            </span>
          </Badge>
        </div>
      )}

      {/* Recepcionista en turno */}
      <div>
        {/* Solo mostrar la sección individual si NO es vista de admin (sin lista expandida) */}
        {activeSessionsList.length === 0 ? (
          activeSession?.employees ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-medium">
                    {activeSession.employees.first_name[0]}
                    {activeSession.employees.last_name[0]}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">En turno</p>
                  <p className="font-medium">
                    {activeSession.employees.first_name} {activeSession.employees.last_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Desde {new Date(activeSession.clock_in_at).toLocaleTimeString("es-MX", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>

              {showClockInOut && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClockOutClick}
                  disabled={actionLoading}
                  className="text-red-500 border-red-500 hover:bg-red-500/10"
                >
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <LogOut className="h-4 w-4 mr-2" />
                      Salir
                    </>
                  )}
                </Button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-muted-foreground">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm">Sin recepcionista</p>
                  <p className="text-xs">Nadie ha registrado entrada</p>
                </div>
              </div>

              {showClockInOut && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setIsClockInModalOpen(true)}
                  disabled={!currentShift}
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  Entrar
                </Button>
              )}
            </div>
          )
        ) : null}
      </div>

      {/* SECCIÓN ADMIN: Listado de todas las sesiones activas */}
      {activeSessionsList.length > 0 && (
        <div className="border-t pt-5 mt-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <div className="bg-primary/10 p-1.5 rounded-full">
                <User className="h-4 w-4 text-primary" />
              </div>
              Staff Activo
              <Badge variant="secondary" className="ml-1 text-xs font-normal h-5 px-1.5">
                {activeSessionsList.length}
              </Badge>
            </h3>

            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setIsClockInModalOpen(true)}
            >
              <LogIn className="h-3.5 w-3.5" />
              Registrar entrada
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-1">
            {activeSessionsList.map((session) => {
              const roleInfo = EMPLOYEE_ROLES.find(r => r.value === session.employees?.role);
              const roleLabel = roleInfo?.label || session.employees?.role;
              const roleColor = roleInfo?.color || "bg-gray-500";
              const initials = `${session.employees?.first_name?.[0] || ""}${session.employees?.last_name?.[0] || ""}`;

              return (
                <div
                  key={session.id}
                  className="group flex items-center justify-between p-3 bg-card border rounded-xl shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-200"
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar con iniciales y color de rol */}
                    <div className={`h-10 w-10 rounded-full ${roleColor} flex items-center justify-center text-white shadow-sm ring-2 ring-white dark:ring-slate-900`}>
                      <span className="text-xs font-bold tracking-wider">{initials}</span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-sm font-semibold leading-none mb-1">
                        {session.employees?.first_name} {session.employees?.last_name}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 h-4 border-muted-foreground/30 font-normal text-muted-foreground bg-muted/30"
                        >
                          {roleLabel}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          • <Clock className="h-3 w-3" /> {new Date(session.clock_in_at).toLocaleTimeString("es-MX", { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Acciones */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-70 group-hover:opacity-100 transition-all"
                    title="Cerrar turno de este empleado"
                    onClick={() => {
                      setActiveSession(session);
                      setSessionToClose(session);
                      setShowClockOutOptions(true);
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal de Clock In */}
      <Dialog open={isClockInModalOpen} onOpenChange={setIsClockInModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar Entrada</DialogTitle>
            <DialogDescription>
              Selecciona tu nombre para registrar tu entrada al turno de{" "}
              <strong>{currentShift?.name}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona tu nombre" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsClockInModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleClockIn} disabled={!selectedEmployeeId || actionLoading}>
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Registrar Entrada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Opciones de Clock Out */}
      <Dialog open={showClockOutOptions} onOpenChange={setShowClockOutOptions}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader className="text-center pb-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center mb-3">
              <LogOut className="h-6 w-6 text-white" />
            </div>
            <DialogTitle className="text-xl">Cerrar Turno</DialogTitle>
            <DialogDescription>
              Selecciona cómo deseas proceder
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-3">
            <button
              className="w-full p-3 rounded-lg border-2 border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 hover:border-amber-400 dark:hover:border-amber-600 transition-all flex items-center justify-between group disabled:opacity-50"
              onClick={handleClockOutWithClosing}
              disabled={actionLoading}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Receipt className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <span className="font-medium text-amber-700 dark:text-amber-300">Hacer corte ahora</span>
              </div>
              <span className="text-xs bg-amber-200 dark:bg-amber-800 text-amber-700 dark:text-amber-200 px-2 py-1 rounded-full">
                ~5 min
              </span>
            </button>

            <button
              className="w-full p-3 rounded-lg border-2 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 hover:border-emerald-400 dark:hover:border-emerald-600 transition-all flex items-center justify-between group disabled:opacity-50"
              onClick={handleClockOutDeferred}
              disabled={actionLoading}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="font-medium text-emerald-700 dark:text-emerald-300">Hacer corte después</span>
              </div>
              <span className="text-xs bg-emerald-200 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-200 px-2 py-1 rounded-full">
                ✓ Rápido
              </span>
            </button>
          </div>

          <p className="text-xs text-muted-foreground text-center pb-2">
            Si eliges "después", podrás completar el corte desde cualquier dispositivo.
          </p>

          <DialogFooter className="sm:justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowClockOutOptions(false)}
              disabled={actionLoading}
              className="text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Corte de Caja */}
      {showClosingModal && sessionToClose && (
        <ShiftClosingModal
          session={sessionToClose}
          onClose={() => {
            setShowClosingModal(false);
            setSessionToClose(null);
            setActionLoading(false);
          }}
          onComplete={handleClosingComplete}
        />
      )}
    </div>
  );
}
