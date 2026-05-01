"use client";

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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { ShiftSession, SHIFT_COLORS, EMPLOYEE_ROLES } from "./types";
import { ShiftClosingModal } from "./shift-closing";
import { useShiftManager } from "@/hooks/use-shift-manager";

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
  userRole?: string | null;
}

export function CurrentShiftIndicator({
  compact = false,
  showClockInOut = true,
  onShiftChange,
}: CurrentShiftIndicatorProps) {
  const {
    currentShift, nextShift, activeSession, employees, activeSessionsList,
    loading, actionLoading,
    isClockInModalOpen, setIsClockInModalOpen,
    selectedEmployeeId, setSelectedEmployeeId,
    showClockOutOptions, setShowClockOutOptions,
    showClosingModal, setShowClosingModal,
    sessionToClose, setSessionToClose, setActiveSession,
    handleClockIn, handleClockOutClick, handleClockOutWithClosing,
    handleClockOutDeferred, handleClosingComplete
  } = useShiftManager(onShiftChange);

  // Formatear hora
  const formatTime = (time: string) => time.slice(0, 5);

  // Calcular tiempo restante del turno
  const getTimeRemaining = () => {
    if (!currentShift) return null;

    const now = new Date();
    const [endHour, endMin] = currentShift.end_time.split(":").map(Number);
    const endDate = new Date(now);
    endDate.setHours(endHour, endMin, 0, 0);

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
      <div className="flex items-center gap-3 backdrop-blur-md bg-white/5 border border-white/10 rounded-full px-3 py-1 shadow-sm">
        {currentShift && (
          <Badge className={`${SHIFT_COLORS[currentShift.code]} text-white shadow-sm border-white/20`}>
            {SHIFT_ICONS[currentShift.code]}
            <span className="ml-1 tracking-tight">{currentShift.name}</span>
          </Badge>
        )}
        {activeSession?.employees && (
          <span className="text-sm text-foreground/80 font-medium">
            <User className="h-3 w-3 inline mr-1 text-primary" />
            {activeSession.employees.first_name}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden bg-white/5 dark:bg-[#0a0a0a]/60 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl p-5 space-y-5 shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)] transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.16)] dark:hover:border-white/20">
      {/* Decorative gradient blob */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 rounded-full blur-[60px] pointer-events-none" />

      {/* Turno actual */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
        <div className="flex items-center gap-4">
          {currentShift ? (
            <>
              <div
                className={`p-3.5 rounded-xl shadow-lg border border-white/20 ${SHIFT_COLORS[currentShift.code]} text-white`}
              >
                {SHIFT_ICONS[currentShift.code]}
              </div>
              <div>
                <p className="text-xs text-muted-foreground/80 font-medium uppercase tracking-wider mb-0.5">Turno en curso</p>
                <p className="text-xl font-bold tracking-tight text-foreground">{currentShift.name}</p>
                <p className="text-xs font-medium text-muted-foreground bg-black/5 dark:bg-white/5 w-fit px-2 py-0.5 rounded-full mt-1 border border-white/10">
                  {formatTime(currentShift.start_time)} - {formatTime(currentShift.end_time)}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="p-3.5 rounded-xl shadow-lg border border-white/20 bg-slate-500/80 text-white">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground/80 font-medium uppercase tracking-wider mb-0.5">Turno en curso</p>
                <p className="text-xl font-bold tracking-tight text-foreground">Sin turno definido</p>
              </div>
            </>
          )}
        </div>

        {currentShift && (
          <div className="bg-black/5 dark:bg-white/5 px-4 py-2.5 rounded-xl border border-white/10 sm:text-right">
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-1">Tiempo restante</p>
            <p className="text-xl font-mono font-bold text-foreground">
              <Clock className="h-4 w-4 inline mr-1.5 text-primary" />
              {getTimeRemaining() || "--:--"}
            </p>
          </div>
        )}
      </div>

      {/* Siguiente turno */}
      {nextShift && (
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground relative z-10 px-1">
          <ChevronRight className="h-3.5 w-3.5 text-primary" />
          <span>Siguiente:</span>
          <Badge variant="secondary" className="font-medium bg-background/50 border-white/10">
            <span className="scale-75 mr-1 origin-left">{SHIFT_ICONS[nextShift.code]}</span>
            <span>{nextShift.name}</span>
            <span className="ml-1 opacity-70">
              ({formatTime(nextShift.start_time)})
            </span>
          </Badge>
        </div>
      )}

      {/* Recepcionista en turno */}
      <div className="relative z-10">
        {activeSessionsList.length === 0 ? (
          activeSession?.employees ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-gradient-to-r from-primary/5 to-transparent border border-primary/10 gap-4">
              <div className="flex items-center gap-3.5">
                <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30 shadow-inner">
                  <span className="text-lg font-bold text-primary">
                    {activeSession.employees.first_name[0]}
                    {activeSession.employees.last_name[0]}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] text-primary/80 font-bold uppercase tracking-wider mb-0.5">Operador Activo</p>
                  <p className="font-bold text-base text-foreground leading-none mb-1">
                    {activeSession.employees.first_name} {activeSession.employees.last_name}
                  </p>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    En línea desde {new Date(activeSession.clock_in_at).toLocaleTimeString("es-MX", {
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
                  className="text-red-500 border-red-500/50 hover:bg-red-500 hover:text-white transition-all shadow-sm rounded-lg"
                >
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <LogOut className="h-4 w-4 mr-2" />
                      Terminar Turno
                    </>
                  )}
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-muted/30 border border-border/50 border-dashed gap-4">
              <div className="flex items-center gap-3.5 text-muted-foreground">
                <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center border border-white/5">
                  <User className="h-6 w-6 opacity-50" />
                </div>
                <div>
                  <p className="font-semibold text-foreground/70">Caja Cerrada</p>
                  <p className="text-xs">Inicia sesión para comenzar a operar</p>
                </div>
              </div>

              {showClockInOut && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setIsClockInModalOpen(true)}
                  disabled={!currentShift}
                  className="rounded-lg shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all"
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  Iniciar Operación
                </Button>
              )}
            </div>
          )
        ) : null}
      </div>

      {/* SECCIÓN ADMIN: Listado de todas las sesiones activas */}
      {activeSessionsList.length > 0 && (
        <div className="border-t border-white/10 pt-5 mt-2 relative z-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
              <div className="bg-primary/20 p-1.5 rounded-lg border border-primary/30">
                <User className="h-4 w-4 text-primary" />
              </div>
              Personal en Turno
              <Badge variant="default" className="ml-1 text-xs font-bold h-5 px-1.5 rounded-md shadow-sm">
                {activeSessionsList.length}
              </Badge>
            </h3>

            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5 rounded-lg border-white/20 bg-white/5 hover:bg-white/10 transition-colors"
              onClick={() => setIsClockInModalOpen(true)}
            >
              <LogIn className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Nueva Entrada</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10">
            {activeSessionsList.map((session) => {
              const roleInfo = EMPLOYEE_ROLES.find(r => r.value === session.employees?.role);
              const roleLabel = roleInfo?.label || session.employees?.role;
              const roleColor = roleInfo?.color || "bg-gray-500";
              const initials = `${session.employees?.first_name?.[0] || ""}${session.employees?.last_name?.[0] || ""}`;

              return (
                <div
                  key={session.id}
                  className="group flex items-center justify-between p-3 bg-white/5 dark:bg-[#0a0a0a]/40 border border-white/10 rounded-xl shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-300"
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg ${roleColor} flex items-center justify-center text-white shadow-inner border border-white/20`}>
                      <span className="text-sm font-bold tracking-wider">{initials}</span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-sm font-bold leading-none mb-1 text-foreground">
                        {session.employees?.first_name} {session.employees?.last_name}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1.5 py-0 h-4 border-white/10 font-bold uppercase tracking-wider text-muted-foreground bg-black/20"
                        >
                          {roleLabel}
                        </Badge>
                        <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                          • <Clock className="h-2.5 w-2.5" /> {new Date(session.clock_in_at).toLocaleTimeString("es-MX", { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-red-400 hover:bg-red-400/10 opacity-50 group-hover:opacity-100 transition-all rounded-lg"
                    title="Cerrar turno"
                    onClick={() => {
                      if (session.employees?.role === 'cochero') {
                        if (confirm(`¿Cerrar turno de ${session.employees.first_name} ${session.employees.last_name}?`)) {
                          handleClockOutDeferred(session);
                        }
                        return;
                      }

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
        <DialogContent className="sm:max-w-md bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl border-white/10">
          <DialogHeader>
            <DialogTitle className="text-2xl">Registrar Entrada</DialogTitle>
            <DialogDescription>
              Selecciona tu nombre para registrar tu entrada al turno de{" "}
              <strong className="text-foreground">{currentShift?.name}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="py-6">
            <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
              <SelectTrigger className="h-12 rounded-xl bg-white/5 border-white/10">
                <SelectValue placeholder="Selecciona tu perfil" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-white/10">
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id} className="rounded-lg">
                    {emp.first_name} {emp.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsClockInModalOpen(false)} className="rounded-xl">
              Cancelar
            </Button>
            <Button onClick={handleClockIn} disabled={!selectedEmployeeId || actionLoading} className="rounded-xl px-6">
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Comenzar Turno
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Opciones de Clock Out */}
      <Dialog open={showClockOutOptions} onOpenChange={setShowClockOutOptions}>
        <DialogContent className="sm:max-w-sm bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl border-white/10">
          <DialogHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center mb-4 shadow-lg shadow-orange-500/20">
              <LogOut className="h-7 w-7 text-white" />
            </div>
            <DialogTitle className="text-2xl font-bold">Cerrar Turno</DialogTitle>
            <DialogDescription>
              Selecciona cómo deseas proceder con tu caja
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <button
              className="w-full p-4 rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-amber-600/5 hover:border-amber-500 hover:from-amber-500/20 hover:to-amber-600/10 transition-all flex items-center justify-between group disabled:opacity-50"
              onClick={handleClockOutWithClosing}
              disabled={actionLoading}
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Receipt className="h-5 w-5 text-amber-500" />
                </div>
                <div className="flex flex-col items-start">
                  <span className="font-bold text-amber-600 dark:text-amber-400">Hacer Corte Ahora</span>
                  <span className="text-[10px] font-medium text-amber-600/70 dark:text-amber-400/70">Recomendado</span>
                </div>
              </div>
              <span className="text-xs bg-amber-500/20 border border-amber-500/30 text-amber-700 dark:text-amber-300 px-2.5 py-1 rounded-md font-bold">
                ~5 min
              </span>
            </button>

            <button
              className="w-full p-4 rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 hover:border-emerald-500 hover:from-emerald-500/20 hover:to-emerald-600/10 transition-all flex items-center justify-between group disabled:opacity-50"
              onClick={() => handleClockOutDeferred()}
              disabled={actionLoading}
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Clock className="h-5 w-5 text-emerald-500" />
                </div>
                <div className="flex flex-col items-start">
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">Corte Diferido</span>
                  <span className="text-[10px] font-medium text-emerald-600/70 dark:text-emerald-400/70">Hacerlo más tarde</span>
                </div>
              </div>
              <span className="text-xs bg-emerald-500/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-md font-bold">
                Rápido
              </span>
            </button>
          </div>

          <p className="text-xs font-medium text-muted-foreground text-center pb-2">
            Si eliges "diferido", podrás completar el corte desde tu móvil.
          </p>

          <DialogFooter className="sm:justify-center">
            <Button
              variant="ghost"
              onClick={() => setShowClockOutOptions(false)}
              disabled={actionLoading}
              className="rounded-xl w-full"
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
          }}
          onComplete={handleClosingComplete}
        />
      )}
    </div>
  );
}
