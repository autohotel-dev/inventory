"use client";

import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DollarSign, ShoppingBag, Clock, CreditCard, Banknote, TrendingUp,
  User, RefreshCw, Building2, LogOut, AlertCircle, LogIn, Sun, Sunset,
  Moon, KeyRound, Loader2, CheckCircle2, Receipt, Wallet, Edit3, Plus, Minus, Users
} from "lucide-react";
import Link from "next/link";
import { useReceptionistDashboard, formatCurrency, formatTime, formatDate } from "@/hooks/use-receptionist-dashboard";

// Dynamic imports para reducir bundle inicial
const ShiftClosingModal = dynamic(
  () => import("@/components/employees/shift-closing").then(mod => ({ default: mod.ShiftClosingModal })),
  { ssr: false, loading: () => <div className="animate-pulse bg-muted h-96 rounded-lg" /> }
);

const ExpenseModal = dynamic(
  () => import("@/components/expenses/expense-modal").then(mod => ({ default: mod.ExpenseModal })),
  { ssr: false }
);

const ExpensesList = dynamic(
  () => import("@/components/expenses/expenses-list").then(mod => ({ default: mod.ExpensesList })),
  { ssr: false, loading: () => <div className="animate-pulse bg-muted h-24 rounded-lg" /> }
);

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
  const {
    employeeName, employeeId, roleLoading, isRestrictedRole, isAdmin, isManager, canAdjustCash,
    summary, loading, currentTime, activeSession, showClosingModal,
    showClockOutOptions, sessionToClose, actionLoading, showExpenseModal,
    activeValetCount, showCashAdjustModal, cashAdjustmentInput,
    currentShift, pinCode, showPinInput, startingShift, employeePin,
    effectiveSession,
    expenses, totalExpenses, expensesLoading, refetchExpenses,
    setShowClosingModal, setShowClockOutOptions, setSessionToClose, setActionLoading,
    setShowExpenseModal, setShowCashAdjustModal, setCashAdjustmentInput,
    setPinCode, setShowPinInput,
    handleStartShift, handleClockOutClick, handleClockOutWithClosing,
    handleClockOutDeferred, handleClosingComplete, fetchShiftSummary, showError,
    handleCashAdjustment,
    timeRemaining,
    posConfig,
  } = useReceptionistDashboard();

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

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

      {/* Card de Efectivo en Caja - Siempre visible cuando hay turno activo */}
      {activeSession && !isRestrictedRole && (
        <Card className="border-emerald-500/30 bg-gradient-to-r from-emerald-500/5 to-teal-500/5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Wallet className="h-5 w-5 text-emerald-500" />
                Efectivo en Caja
              </CardTitle>
              {canAdjustCash && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCashAdjustModal(true)}
                  className="h-8 text-xs gap-1"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Ajustar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {/* Fondo Inicial */}
              <div className="p-3 rounded-lg bg-slate-500/10 border border-slate-500/20">
                <div className="flex items-center gap-1.5 mb-1">
                  <Wallet className="h-3.5 w-3.5 text-slate-500" />
                  <span className="text-[10px] text-slate-500 uppercase font-medium">Fondo Inicial</span>
                </div>
                <p className="text-lg font-bold">{formatCurrency(posConfig.initialCashFund)}</p>
              </div>

              {/* Cobros */}
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="flex items-center gap-1.5 mb-1">
                  <Plus className="h-3.5 w-3.5 text-green-500" />
                  <span className="text-[10px] text-green-500 uppercase font-medium">Cobros</span>
                </div>
                <p className="text-lg font-bold text-green-600">+{formatCurrency(summary.cashAmount)}</p>
              </div>

              {/* Gastos */}
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="flex items-center gap-1.5 mb-1">
                  <Minus className="h-3.5 w-3.5 text-red-500" />
                  <span className="text-[10px] text-red-500 uppercase font-medium">Gastos</span>
                </div>
                <p className="text-lg font-bold text-red-600">-{formatCurrency(totalExpenses)}</p>
              </div>

              {/* Adelantos Cocheros */}
              <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <div className="flex items-center gap-1.5 mb-1">
                  <Users className="h-3.5 w-3.5 text-orange-500" />
                  <span className="text-[10px] text-orange-500 uppercase font-medium">Cocheros ({activeValetCount})</span>
                </div>
                <p className="text-lg font-bold text-orange-600">-{formatCurrency(activeValetCount * posConfig.valetAdvanceAmount)}</p>
              </div>

              {/* Total Disponible */}
              <div className="p-3 rounded-lg bg-emerald-500/20 border-2 border-emerald-500/40">
                <div className="flex items-center gap-1.5 mb-1">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-[10px] text-emerald-600 uppercase font-medium">Disponible</span>
                </div>
                <p className="text-xl font-bold text-emerald-600">
                  {formatCurrency(posConfig.initialCashFund + summary.cashAmount - totalExpenses - (activeValetCount * posConfig.valetAdvanceAmount))}
                </p>
              </div>
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

      {/* Resumen del turno - Solo mostrar si hay sesión activa y NO es un rol restringido */}
      {activeSession && !isRestrictedRole && (
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

      {/* Desglose de pagos - Solo mostrar si hay sesión activa y NO es un rol restringido */}
      {activeSession && !isRestrictedRole && (
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

      {/* Desglose por Concepto - Solo mostrar si hay sesión activa y NO es un rol restringido */}
      {activeSession && !isRestrictedRole && (
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

      {/* Gastos del Turno - Solo mostrar si NO es un rol restringido */}
      {effectiveSession && !isRestrictedRole && (
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
            {activeSession ? (
              <Link
                href="/sales/pos"
                className="flex flex-col items-center gap-2 p-4 border rounded-lg hover:bg-muted transition-colors text-center"
              >
                <span className="text-3xl">🏨</span>
                <span className="text-sm font-medium">Habitaciones</span>
              </Link>
            ) : (
              <button
                onClick={() => showError("Acceso Restringido", "Para entrar al POS de habitaciones debes iniciar turno primero")}
                className="flex flex-col items-center gap-2 p-4 border rounded-lg opacity-60 bg-muted/40 cursor-not-allowed text-center transition-all hover:bg-red-50 hover:border-red-200 dark:hover:bg-red-900/10 dark:hover:border-red-800"
              >
                <div className="relative">
                  <span className="text-3xl grayscale opacity-70">🏨</span>
                  <div className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5">
                    <LogOut className="h-3 w-3 text-white" />
                  </div>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-sm font-medium text-muted-foreground">Habitaciones</span>
                  <span className="text-[10px] text-red-500 font-medium">Requiere Turno</span>
                </div>
              </button>
            )}



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

            {!isRestrictedRole && (
              <button
                onClick={() => effectiveSession && setShowExpenseModal(true)}
                disabled={!effectiveSession}
                className={`flex flex-col items-center gap-2 p-4 border rounded-lg transition-colors text-center ${effectiveSession
                  ? "hover:bg-muted cursor-pointer"
                  : "opacity-50 cursor-not-allowed"
                  }`}
              >
                <span className="text-3xl">💸</span>
                <span className="text-sm font-medium">Registrar Gasto</span>
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal de opciones de cierre de turno */}
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
            Si eliges &quot;después&quot;, podrás completar el corte desde cualquier dispositivo.
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
      {effectiveSession && (
        <ExpenseModal
          open={showExpenseModal}
          onClose={() => setShowExpenseModal(false)}
          sessionId={effectiveSession.id}
          employeeId={employeeId || ''}
          availableCash={posConfig.initialCashFund + summary.cashAmount - totalExpenses - (activeValetCount * posConfig.valetAdvanceAmount)}
          onSuccess={() => {
            refetchExpenses();
            fetchShiftSummary();
          }}
        />
      )}

      {/* Modal de Ajuste de Caja (solo admin/manager) */}
      <Dialog open={showCashAdjustModal} onOpenChange={setShowCashAdjustModal}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader className="text-center pb-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mb-3">
              <Wallet className="h-6 w-6 text-white" />
            </div>
            <DialogTitle className="text-xl">Ajustar Efectivo en Caja</DialogTitle>
            <DialogDescription>
              Ingresa el monto a agregar o retirar del fondo
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Efectivo actual</p>
              <p className="text-2xl font-bold text-emerald-600">
                {formatCurrency(posConfig.initialCashFund + summary.cashAmount - totalExpenses - (activeValetCount * posConfig.valetAdvanceAmount))}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Monto a ajustar</label>
              <div className="flex items-center gap-2">
                <span className="text-lg font-medium text-muted-foreground">$</span>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={cashAdjustmentInput}
                  onChange={(e) => setCashAdjustmentInput(e.target.value)}
                  className="text-lg text-center"
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Ingresa un número positivo para agregar o negativo para retirar
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowCashAdjustModal(false);
                setCashAdjustmentInput("");
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCashAdjustment}
              disabled={!cashAdjustmentInput}
            >
              Aplicar Ajuste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
