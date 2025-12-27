"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { useUserRole } from "@/hooks/use-user-role";
import { ShiftClosingModal } from "@/components/employees/shift-closing";
import { ShiftSession, ShiftDefinition } from "@/components/employees/types";
import { useToast } from "@/hooks/use-toast";
import {
  DollarSign,
  ShoppingBag,
  Clock,
  CreditCard,
  Banknote,
  TrendingUp,
  User,
  RefreshCw,
  Building2,
  LogOut,
  AlertCircle,
  LogIn,
  Sun,
  Sunset,
  Moon,
  KeyRound,
  Loader2,
  CheckCircle2,
  Receipt,
  Wallet
} from "lucide-react";
import Link from "next/link";
import { ExpenseModal } from "@/components/expenses/expense-modal";
import { ExpensesList } from "@/components/expenses/expenses-list";
import { useShiftExpenses } from "@/hooks/use-shift-expenses";

interface ShiftSummary {
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

// Iconos por turno
const SHIFT_ICONS: Record<string, React.ReactNode> = {
  MORNING: <Sun className="h-8 w-8" />,
  AFTERNOON: <Sunset className="h-8 w-8" />,
  NIGHT: <Moon className="h-8 w-8" />,
};

const SHIFT_COLORS: Record<string, string> = {
  MORNING: "from-amber-500 to-orange-500",
  AFTERNOON: "from-blue-500 to-indigo-500",
  NIGHT: "from-purple-500 to-violet-600",
};

export function ReceptionistDashboard() {
  const { employeeName, userId, employeeId, isLoading: roleLoading } = useUserRole();
  const { success, error: showError } = useToast();
  const [summary, setSummary] = useState<ShiftSummary>({
    totalSales: 0,
    totalAmount: 0,
    cashAmount: 0,
    cardBBVA: 0,
    cardGetnet: 0,
    openRooms: 0,
    completedCheckouts: 0,
    conceptBreakdown: {
      ROOM_BASE: 0,
      EXTRA_HOUR: 0,
      EXTRA_PERSON: 0,
      CONSUMPTION: 0,
      PRODUCT: 0,
    }
  });
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeSession, setActiveSession] = useState<ShiftSession | null>(null);
  const [showClosingModal, setShowClosingModal] = useState(false);
  const [showClockOutOptions, setShowClockOutOptions] = useState(false);
  const [sessionToClose, setSessionToClose] = useState<ShiftSession | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);

  // Estados para inicio de turno
  const [currentShift, setCurrentShift] = useState<ShiftDefinition | null>(null);
  const [pinCode, setPinCode] = useState("");
  const [showPinInput, setShowPinInput] = useState(false);
  const [startingShift, setStartingShift] = useState(false);
  const [employeePin, setEmployeePin] = useState<string | null>(null);

  // Hook para gastos
  const { expenses, totalExpenses, loading: expensesLoading, refetch: refetchExpenses } = useShiftExpenses(activeSession?.id || null);

  // Actualizar reloj cada segundo
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Cargar turno actual según la hora
  const fetchCurrentShift = async () => {
    const supabase = createClient();
    const { data: shifts } = await supabase
      .from("shift_definitions")
      .select("*")
      .eq("is_active", true)
      .order("start_time");

    if (!shifts?.length) return;

    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 8);

    for (const shift of shifts) {
      const start = shift.start_time;
      const end = shift.end_time;

      if (shift.crosses_midnight) {
        if (currentTime >= start || currentTime < end) {
          setCurrentShift(shift);
          return;
        }
      } else {
        if (currentTime >= start && currentTime < end) {
          setCurrentShift(shift);
          return;
        }
      }
    }
  };

  // Cargar PIN del empleado
  const fetchEmployeePin = async () => {
    if (!employeeId) return;

    const supabase = createClient();
    const { data } = await supabase
      .from("employees")
      .select("pin_code")
      .eq("id", employeeId)
      .single();

    setEmployeePin(data?.pin_code || null);
  };

  // Cargar sesión de turno activa
  const fetchActiveSession = async () => {
    if (!employeeId) return;

    const supabase = createClient();
    const { data: sessions } = await supabase
      .from("shift_sessions")
      .select(`
        *,
        employees(*),
        shift_definitions(*)
      `)
      .eq("employee_id", employeeId)
      .eq("status", "active")
      .order("clock_in_at", { ascending: false })
      .limit(1);

    setActiveSession(sessions?.[0] || null);
  };

  // Iniciar turno
  const handleStartShift = async () => {
    if (!employeeId || !currentShift) return;

    // Si tiene PIN configurado, verificar
    if (employeePin && pinCode !== employeePin) {
      showError("PIN incorrecto", "El PIN ingresado no es válido");
      setPinCode("");
      return;
    }

    setStartingShift(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("shift_sessions")
        .insert({
          employee_id: employeeId,
          shift_definition_id: currentShift.id,
          clock_in_at: new Date().toISOString(),
          status: "active",
        })
        .select("*, employees(*), shift_definitions(*)")
        .single();

      if (error) throw error;

      success("¡Turno iniciado!", `Bienvenido al turno de ${currentShift.name}`);
      setActiveSession(data);
      setShowPinInput(false);
      setPinCode("");
    } catch (err: any) {
      console.error("Error starting shift:", err);
      showError("Error", err.message || "No se pudo iniciar el turno");
    } finally {
      setStartingShift(false);
    }
  };

  // Cargar resumen del turno
  const fetchShiftSummary = async () => {
    if (!userId) return;

    setLoading(true);
    const supabase = createClient();

    try {
      // Obtener inicio del día actual (o del turno si hay sesión activa)
      let startDate: string;
      if (activeSession) {
        startDate = activeSession.clock_in_at;
      } else {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        startDate = today.toISOString();
      }

      // Ventas del usuario desde inicio del turno
      const { data: sales } = await supabase
        .from("sales_orders")
        .select("id, total, status")
        .eq("created_by", userId)
        .gte("created_at", startDate);

      // Pagos del usuario desde inicio del turno
      const { data: payments } = await supabase
        .from("payments")
        .select("amount, payment_method")
        .eq("created_by", userId)
        .gte("created_at", startDate)
        .eq("status", "PAGADO");

      // Habitaciones ocupadas actualmente
      const { count: openRooms } = await supabase
        .from("rooms")
        .select("id", { count: "exact", head: true })
        .eq("status", "OCUPADA");

      // Calcular totales
      const totalSales = sales?.length || 0;
      const totalAmount = sales?.reduce((sum, s) => sum + (s.total || 0), 0) || 0;

      let cashAmount = 0;
      let cardBBVA = 0;
      let cardGetnet = 0;

      payments?.forEach(p => {
        if (p.payment_method === "EFECTIVO") {
          cashAmount += p.amount || 0;
        } else if (p.payment_method === "TARJETA_BBVA") {
          cardBBVA += p.amount || 0;
        } else if (p.payment_method === "TARJETA_GETNET") {
          cardGetnet += p.amount || 0;
        }
      });

      const completedCheckouts = sales?.filter(s => s.status === "COMPLETED" || s.status === "ENDED").length || 0;

      // Obtener desglose por concepto de items pagados
      const salesIds = sales?.map(s => s.id) || [];
      let conceptBreakdown = {
        ROOM_BASE: 0,
        EXTRA_HOUR: 0,
        EXTRA_PERSON: 0,
        CONSUMPTION: 0,
        PRODUCT: 0,
      };

      if (salesIds.length > 0) {
        const { data: paidItems } = await supabase
          .from("sales_order_items")
          .select("concept_type, total")
          .in("sales_order_id", salesIds)
          .eq("is_paid", true);

        paidItems?.forEach((item: any) => {
          const type = item.concept_type || "PRODUCT";
          if (type in conceptBreakdown) {
            conceptBreakdown[type as keyof typeof conceptBreakdown] += item.total || 0;
          }
        });
      }

      setSummary({
        totalSales,
        totalAmount,
        cashAmount,
        cardBBVA,
        cardGetnet,
        openRooms: openRooms || 0,
        completedCheckouts,
        conceptBreakdown
      });
    } catch (error) {
      console.error("Error fetching shift summary:", error);
    } finally {
      setLoading(false);
    }
  };

  // Mostrar opciones de clock out
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
      const supabase = createClient();
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
      const supabase = createClient();
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
      setShowClockOutOptions(false);
    } catch (err: any) {
      console.error("Error clocking out:", err);
      showError("Error", err.message || "No se pudo registrar la salida");
    } finally {
      setActionLoading(false);
    }
  };

  // Manejar cierre de turno completado
  const handleClosingComplete = () => {
    setShowClosingModal(false);
    setSessionToClose(null);
    setActiveSession(null);
    setActionLoading(false);
    fetchShiftSummary();
  };

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      await fetchCurrentShift();
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    if (employeeId) {
      const loadData = async () => {
        await fetchActiveSession();
        await fetchEmployeePin();
      };

      loadData();
    }

    return () => {
      isMounted = false;
    };
  }, [employeeId]);

  useEffect(() => {
    if (userId) {
      fetchShiftSummary();
    }
  }, [userId, activeSession]);

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN"
    }).format(amount);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("es-MX", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  };

  // Calcular tiempo restante del turno
  const getTimeRemaining = () => {
    if (!activeSession?.shift_definitions?.end_time) return null;

    const now = currentTime;
    const endTime = activeSession.shift_definitions.end_time; // formato "HH:MM:SS"
    const crossesMidnight = activeSession.shift_definitions.crosses_midnight;

    // Crear fecha de fin del turno
    const [endHours, endMinutes] = endTime.split(":").map(Number);
    const endDate = new Date(now);
    endDate.setHours(endHours, endMinutes, 0, 0);

    // Si cruza medianoche y la hora actual es después de medianoche, el fin es hoy
    // Si cruza medianoche y la hora actual es antes de medianoche, el fin es mañana
    if (crossesMidnight) {
      if (now.getHours() < 12) {
        // Estamos en la madrugada, el turno termina hoy
      } else {
        // Estamos en la noche, el turno termina mañana
        endDate.setDate(endDate.getDate() + 1);
      }
    }

    const diff = endDate.getTime() - now.getTime();

    if (diff <= 0) {
      return { hours: 0, minutes: 0, seconds: 0, isOvertime: true };
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return { hours, minutes, seconds, isOvertime: false };
  };

  const timeRemaining = getTimeRemaining();

  return (
    <div className="space-y-6 p-6">
      {/* Header con saludo */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <User className="h-6 w-6" />
            ¡Hola, {employeeName || "Recepcionista"}!
          </h1>
          <p className="text-muted-foreground capitalize">
            {formatDate(currentTime)} • {formatTime(currentTime)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchShiftSummary} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          {activeSession && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleClockOutClick}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4 mr-2" />
              )}
              Cerrar Turno
            </Button>
          )}
        </div>
      </div>

      {/* Indicador de turno activo con tiempo restante llamativo */}
      {activeSession && (
        <Card className={`overflow-hidden ${timeRemaining?.isOvertime ? 'border-red-500 bg-gradient-to-r from-red-500/10 to-red-600/5' : 'border-emerald-500 bg-gradient-to-r from-emerald-500/10 to-teal-500/5'}`}>
          <CardContent className="p-0">
            <div className="flex flex-col md:flex-row">
              {/* Info del turno */}
              <div className="flex-1 p-4 flex items-center gap-4">
                <div className={`h-12 w-12 rounded-full flex items-center justify-center ${timeRemaining?.isOvertime ? 'bg-red-500/20' : 'bg-emerald-500/20'}`}>
                  <div className={`h-4 w-4 rounded-full animate-pulse ${timeRemaining?.isOvertime ? 'bg-red-500' : 'bg-emerald-500'}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className={`text-lg font-semibold ${timeRemaining?.isOvertime ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                      {activeSession.shift_definitions?.name}
                    </p>
                    <Badge className={`${timeRemaining?.isOvertime ? 'bg-red-500' : 'bg-emerald-500'} text-white`}>
                      {timeRemaining?.isOvertime ? '⚠️ Extendido' : '✓ Activo'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Iniciado: {new Date(activeSession.clock_in_at).toLocaleString("es-MX")}
                  </p>
                </div>
              </div>

              {/* Tiempo restante - Sección llamativa */}
              {timeRemaining && (
                <div className={`px-6 py-4 flex flex-col items-center justify-center min-w-[200px] ${timeRemaining.isOvertime
                  ? 'bg-gradient-to-br from-red-500 to-red-600'
                  : 'bg-gradient-to-br from-emerald-500 to-teal-600'
                  }`}>
                  {timeRemaining.isOvertime ? (
                    <div className="text-center text-white">
                      <p className="text-xs font-medium opacity-90 uppercase tracking-wider">Tiempo excedido</p>
                      <p className="text-2xl font-bold mt-1">¡Cerrar turno!</p>
                    </div>
                  ) : (
                    <div className="text-center text-white">
                      <p className="text-xs font-medium opacity-90 uppercase tracking-wider">Tiempo restante</p>
                      <div className="flex items-center gap-1 mt-1">
                        <div className="flex flex-col items-center">
                          <span className="text-3xl font-bold font-mono tabular-nums leading-none">
                            {String(timeRemaining.hours).padStart(2, '0')}
                          </span>
                          <span className="text-[10px] opacity-75 uppercase">hrs</span>
                        </div>
                        <span className="text-3xl font-bold animate-pulse">:</span>
                        <div className="flex flex-col items-center">
                          <span className="text-3xl font-bold font-mono tabular-nums leading-none">
                            {String(timeRemaining.minutes).padStart(2, '0')}
                          </span>
                          <span className="text-[10px] opacity-75 uppercase">min</span>
                        </div>
                        <span className="text-3xl font-bold animate-pulse">:</span>
                        <div className="flex flex-col items-center">
                          <span className="text-3xl font-bold font-mono tabular-nums leading-none">
                            {String(timeRemaining.seconds).padStart(2, '0')}
                          </span>
                          <span className="text-[10px] opacity-75 uppercase">seg</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pantalla de inicio de turno si no hay sesión activa */}
      {!activeSession && !loading && currentShift && (
        <Card className={`overflow-hidden border-2 ${SHIFT_COLORS[currentShift.code] ? 'border-primary' : 'border-muted'}`}>
          <div className={`bg-gradient-to-r ${SHIFT_COLORS[currentShift.code] || 'from-gray-500 to-gray-600'} p-6 text-white`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center">
                  {SHIFT_ICONS[currentShift.code] || <Clock className="h-8 w-8" />}
                </div>
                <div>
                  <p className="text-sm opacity-90">Turno disponible</p>
                  <h2 className="text-2xl font-bold">{currentShift.name}</h2>
                  <p className="text-sm opacity-90">
                    {currentShift.start_time.slice(0, 5)} - {currentShift.end_time.slice(0, 5)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm opacity-90">Hora actual</p>
                <p className="text-3xl font-bold font-mono">{formatTime(currentTime)}</p>
              </div>
            </div>
          </div>

          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <User className="h-5 w-5" />
                <span className="text-lg">{employeeName}</span>
              </div>

              {!showPinInput ? (
                <div className="space-y-3">
                  <p className="text-muted-foreground">
                    ¿Listo para comenzar tu turno?
                  </p>
                  <Button
                    size="lg"
                    className={`w-full max-w-xs bg-gradient-to-r ${SHIFT_COLORS[currentShift.code] || 'from-primary to-primary'} hover:opacity-90 text-white`}
                    onClick={() => employeePin ? setShowPinInput(true) : handleStartShift()}
                    disabled={startingShift}
                  >
                    {startingShift ? (
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    ) : (
                      <LogIn className="h-5 w-5 mr-2" />
                    )}
                    Iniciar Turno
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 max-w-xs mx-auto">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <KeyRound className="h-5 w-5" />
                    <span>Ingresa tu PIN de seguridad</span>
                  </div>
                  <Input
                    type="password"
                    placeholder="••••"
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value)}
                    className="text-center text-2xl tracking-widest"
                    maxLength={6}
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleStartShift()}
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setShowPinInput(false);
                        setPinCode("");
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      className={`flex-1 bg-gradient-to-r ${SHIFT_COLORS[currentShift.code] || 'from-primary to-primary'}`}
                      onClick={handleStartShift}
                      disabled={startingShift || !pinCode}
                    >
                      {startingShift ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                      )}
                      Confirmar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alerta si no hay turno definido para esta hora */}
      {!activeSession && !loading && !currentShift && (
        <Card className="border-amber-500/50 bg-amber-500/10">
          <CardContent className="py-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-amber-500/20 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <p className="font-medium text-amber-700 dark:text-amber-400">
                  No hay turno definido para esta hora
                </p>
                <p className="text-sm text-muted-foreground">
                  Contacta a tu supervisor si crees que esto es un error
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumen del turno - Solo mostrar si hay sesión activa */}
      {activeSession && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Resumen de tu Turno
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-background rounded-lg border">
                <ShoppingBag className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                <p className="text-2xl font-bold">{summary.totalSales}</p>
                <p className="text-xs text-muted-foreground">Ventas Realizadas</p>
              </div>
              <div className="text-center p-4 bg-background rounded-lg border">
                <DollarSign className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                <p className="text-2xl font-bold">{formatCurrency(summary.totalAmount)}</p>
                <p className="text-xs text-muted-foreground">Total Vendido</p>
              </div>
              <div className="text-center p-4 bg-background rounded-lg border">
                <Building2 className="h-8 w-8 mx-auto mb-2 text-amber-500" />
                <p className="text-2xl font-bold">{summary.openRooms}</p>
                <p className="text-xs text-muted-foreground">Habitaciones Ocupadas</p>
              </div>
              <div className="text-center p-4 bg-background rounded-lg border">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 text-purple-500" />
                <p className="text-2xl font-bold">{summary.completedCheckouts}</p>
                <p className="text-xs text-muted-foreground">Checkouts Completados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Desglose de pagos - Solo mostrar si hay sesión activa */}
      {activeSession && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Efectivo</CardTitle>
              <Banknote className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(summary.cashAmount)}</div>
              <p className="text-xs text-muted-foreground">Cobrado en efectivo</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tarjeta BBVA</CardTitle>
              <CreditCard className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{formatCurrency(summary.cardBBVA)}</div>
              <p className="text-xs text-muted-foreground">Terminal BBVA</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tarjeta Getnet</CardTitle>
              <CreditCard className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{formatCurrency(summary.cardGetnet)}</div>
              <p className="text-xs text-muted-foreground">Terminal Getnet</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Desglose por Concepto - Solo mostrar si hay sesión activa */}
      {activeSession && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              Cobrado por Concepto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="h-4 w-4 text-blue-500" />
                  <span className="text-xs text-blue-400">Habitación</span>
                </div>
                <p className="text-lg font-bold text-blue-600">{formatCurrency(summary.conceptBreakdown.ROOM_BASE)}</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-amber-500" />
                  <span className="text-xs text-amber-400">Horas Extra</span>
                </div>
                <p className="text-lg font-bold text-amber-600">{formatCurrency(summary.conceptBreakdown.EXTRA_HOUR)}</p>
              </div>
              <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <User className="h-4 w-4 text-purple-500" />
                  <span className="text-xs text-purple-400">Personas Extra</span>
                </div>
                <p className="text-lg font-bold text-purple-600">{formatCurrency(summary.conceptBreakdown.EXTRA_PERSON)}</p>
              </div>
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <ShoppingBag className="h-4 w-4 text-green-500" />
                  <span className="text-xs text-green-400">Consumos</span>
                </div>
                <p className="text-lg font-bold text-green-600">{formatCurrency(summary.conceptBreakdown.CONSUMPTION)}</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-500/10 border border-slate-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <ShoppingBag className="h-4 w-4 text-slate-500" />
                  <span className="text-xs text-slate-400">Productos</span>
                </div>
                <p className="text-lg font-bold text-slate-600">{formatCurrency(summary.conceptBreakdown.PRODUCT)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gastos del Turno */}
      {activeSession && (
        <ExpensesList
          expenses={expenses}
          totalExpenses={totalExpenses}
          loading={expensesLoading}
        />
      )}

      {/* Acciones rápidas para recepcionista */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Acciones Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Link
              href="/sales/pos"
              className="flex flex-col items-center gap-2 p-4 border rounded-lg hover:bg-muted transition-colors text-center"
            >
              <span className="text-3xl">🏨</span>
              <span className="text-sm font-medium">Habitaciones</span>
            </Link>
            <Link
              href="/sales"
              className="flex flex-col items-center gap-2 p-4 border rounded-lg hover:bg-muted transition-colors text-center"
            >
              <span className="text-3xl">📋</span>
              <span className="text-sm font-medium">Mis Ventas</span>
            </Link>
            <Link
              href="/sales/new"
              className="flex flex-col items-center gap-2 p-4 border rounded-lg hover:bg-muted transition-colors text-center"
            >
              <span className="text-3xl">💰</span>
              <span className="text-sm font-medium">Nueva Venta</span>
            </Link>
            <button
              onClick={() => activeSession ? handleClockOutClick() : null}
              disabled={!activeSession}
              className={`flex flex-col items-center gap-2 p-4 border rounded-lg transition-colors text-center ${activeSession
                ? "hover:bg-muted cursor-pointer"
                : "opacity-50 cursor-not-allowed"
                }`}
            >
              <span className="text-3xl">🧾</span>
              <span className="text-sm font-medium">Cerrar Turno</span>
            </button>
            <button
              onClick={() => activeSession && setShowExpenseModal(true)}
              disabled={!activeSession}
              className={`flex flex-col items-center gap-2 p-4 border rounded-lg transition-colors text-center ${activeSession
                ? "hover:bg-muted cursor-pointer"
                : "opacity-50 cursor-not-allowed"
                }`}
            >
              <span className="text-3xl">💸</span>
              <span className="text-sm font-medium">Registrar Gasto</span>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Modal de opciones de cierre de turno */}
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

          <div className="space-y-2 py-2">
            <Button
              className="w-full text-left h-auto py-3"
              variant="outline"
              onClick={handleClockOutWithClosing}
              disabled={actionLoading}
            >
              <div className="flex items-start gap-3 w-full">
                <Receipt className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium">Hacer corte ahora</p>
                  <p className="text-xs text-muted-foreground">
                    Completar el corte de caja inmediatamente
                  </p>
                  <span className="inline-block text-xs bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded mt-1">
                    ~5 min
                  </span>
                </div>
              </div>
            </Button>

            <Button
              className="w-full text-left h-auto py-3"
              variant="outline"
              onClick={handleClockOutDeferred}
              disabled={actionLoading}
            >
              <div className="flex items-start gap-3 w-full">
                <Clock className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium">Hacer corte después</p>
                  <p className="text-xs text-muted-foreground">
                    Libera la recepción y completa el corte cuando quieras
                  </p>
                  <span className="inline-block text-xs bg-green-500/10 text-green-600 px-2 py-0.5 rounded mt-1">
                    Recomendado
                  </span>
                </div>
              </div>
            </Button>
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

      {/* Modal de cierre de turno */}
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

      {/* Modal de gastos */}
      {activeSession && (
        <ExpenseModal
          open={showExpenseModal}
          onClose={() => setShowExpenseModal(false)}
          sessionId={activeSession.id}
          employeeId={employeeId || ''}
          availableCash={summary.cashAmount - totalExpenses}
          onSuccess={() => {
            refetchExpenses();
            fetchShiftSummary();
          }}
        />
      )}
    </div>
  );
}
