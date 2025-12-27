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
import { Employee, ShiftDefinition, ShiftSession, SHIFT_COLORS } from "./types";
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
          .in("role", ["receptionist", "manager"])
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
        const currentIndex = allShifts.findIndex((s) => s.id === current!.id);
        next = allShifts[(currentIndex + 1) % allShifts.length];
      }

      setCurrentShift(current);
      setNextShift(next);

      // Sesión activa
      const session = sessionRes.data?.[0] || null;
      setActiveSession(session);
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
      showError("Error", err.message || "No se pudo registrar la entrada");
    } finally {
      setActionLoading(false);
    }
  };

  // Clock Out - Mostrar opciones
  const handleClockOutClick = () => {
    setShowClockOutOptions(true);
  };

  // Clock Out con corte inmediato
  const handleClockOutWithClosing = async () => {
    if (!activeSession) return;

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
    if (!activeSession) return;

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
      <div className="border-t pt-4">
        {activeSession?.employees ? (
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
        )}
      </div>

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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogOut className="h-5 w-5" />
              Cerrar Turno
            </DialogTitle>
            <DialogDescription>
              ¿Cómo deseas proceder con el cierre de tu turno?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <div className="space-y-2">
              <Button
                className="w-full justify-start h-auto py-4"
                variant="outline"
                onClick={handleClockOutWithClosing}
                disabled={actionLoading}
              >
                <div className="flex items-start gap-3 text-left">
                  <Receipt className="h-5 w-5 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium">Hacer corte ahora</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Completar el corte de caja inmediatamente
                    </p>
                  </div>
                  <span className="text-xs bg-amber-500/10 text-amber-600 px-2 py-1 rounded">
                    ~5 min
                  </span>
                </div>
              </Button>

              <Button
                className="w-full justify-start h-auto py-4"
                variant="outline"
                onClick={handleClockOutDeferred}
                disabled={actionLoading}
              >
                <div className="flex items-start gap-3 text-left">
                  <Clock className="h-5 w-5 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium">Hacer corte después</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Libera la recepción y completa el corte cuando quieras
                    </p>
                  </div>
                  <span className="text-xs bg-green-500/10 text-green-600 px-2 py-1 rounded">
                    Recomendado
                  </span>
                </div>
              </Button>
            </div>

            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              <p className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>
                  Si eliges "Hacer corte después", podrás completarlo desde cualquier
                  computadora iniciando sesión en el sistema.
                </span>
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowClockOutOptions(false)}
              disabled={actionLoading}
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
