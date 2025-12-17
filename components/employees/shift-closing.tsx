"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  DollarSign,
  CreditCard,
  Receipt,
  Calculator,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  FileText,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  History,
} from "lucide-react";
import {
  Employee,
  ShiftDefinition,
  ShiftSession,
  ShiftClosing,
  CashBreakdown,
  CASH_DENOMINATIONS,
  SHIFT_COLORS,
} from "./types";

interface ShiftClosingProps {
  session: ShiftSession;
  onClose: () => void;
  onComplete: () => void;
}

interface PaymentSummary {
  total_cash: number;
  total_card_bbva: number;
  total_card_getnet: number;
  total_sales: number;
  total_transactions: number;
  payments: any[];
  salesOrders: any[];
}

export function ShiftClosingModal({ session, onClose, onComplete }: ShiftClosingProps) {
  const supabase = createClient();
  const { success, error: showError } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);

  // Conteo de efectivo
  const [cashBreakdown, setCashBreakdown] = useState<CashBreakdown>({});
  const [countedCash, setCountedCash] = useState(0);
  const [notes, setNotes] = useState("");

  // Cargar resumen de pagos del turno
  const loadPaymentSummary = async () => {
    setLoading(true);
    try {
      // Obtener pagos del período del turno
      const { data: payments, error } = await supabase
        .from("payments")
        .select(`
          *,
          payment_terminals(code, name),
          sales_orders(id, total, status)
        `)
        .gte("created_at", session.clock_in_at)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Obtener órdenes de venta del turno con sus items desglosados
      const { data: salesOrders } = await supabase
        .from("sales_orders")
        .select(`
          id, created_at, total, paid_amount, remaining_amount, status, currency,
          room_stays(
            id,
            rooms(number, room_types(name))
          ),
          sales_order_items(
            id, qty, unit_price, total, concept_type, is_paid, paid_at, payment_method,
            products(name, sku)
          )
        `)
        .gte("created_at", session.clock_in_at)
        .order("created_at", { ascending: false });

      // Calcular totales
      let total_cash = 0;
      let total_card_bbva = 0;
      let total_card_getnet = 0;

      (payments || []).forEach((payment) => {
        if (payment.payment_method === "EFECTIVO") {
          total_cash += payment.amount;
        } else if (payment.payment_method === "TARJETA") {
          const terminalCode = payment.terminal_code || payment.payment_terminals?.code;
          if (terminalCode === "BBVA") {
            total_card_bbva += payment.amount;
          } else if (terminalCode === "GETNET") {
            total_card_getnet += payment.amount;
          }
        } else if (payment.payment_method === "TARJETA_BBVA") {
          total_card_bbva += payment.amount;
        } else if (payment.payment_method === "TARJETA_GETNET") {
          total_card_getnet += payment.amount;
        }
      });

      setSummary({
        total_cash,
        total_card_bbva,
        total_card_getnet,
        total_sales: total_cash + total_card_bbva + total_card_getnet,
        total_transactions: payments?.length || 0,
        payments: payments || [],
        salesOrders: salesOrders || [],
      });
    } catch (err) {
      console.error("Error loading payment summary:", err);
      showError("Error", "No se pudo cargar el resumen de pagos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPaymentSummary();
  }, [session]);

  // Calcular total contado basado en denominaciones
  useEffect(() => {
    let total = 0;
    Object.entries(cashBreakdown).forEach(([denom, count]) => {
      total += parseFloat(denom) * (count || 0);
    });
    setCountedCash(total);
  }, [cashBreakdown]);

  // Actualizar conteo de denominación
  const updateDenomination = (denomination: number, count: number) => {
    setCashBreakdown((prev) => ({
      ...prev,
      [denomination.toString()]: count,
    }));
  };

  // Calcular diferencia
  const cashDifference = summary ? countedCash - summary.total_cash : 0;

  // Guardar corte
  const handleSaveClosing = async () => {
    if (!summary) return;

    setSaving(true);
    try {
      // Crear registro de corte
      const { data: closing, error: closingError } = await supabase
        .from("shift_closings")
        .insert({
          shift_session_id: session.id,
          employee_id: session.employee_id,
          shift_definition_id: session.shift_definition_id,
          period_start: session.clock_in_at,
          period_end: new Date().toISOString(),
          total_cash: summary.total_cash,
          total_card_bbva: summary.total_card_bbva,
          total_card_getnet: summary.total_card_getnet,
          total_sales: summary.total_sales,
          total_transactions: summary.total_transactions,
          counted_cash: countedCash,
          cash_difference: cashDifference,
          cash_breakdown: cashBreakdown,
          notes: notes.trim() || null,
          status: "pending",
        })
        .select()
        .single();

      if (closingError) throw closingError;

      // Crear detalles del corte
      if (summary.payments.length > 0) {
        const details = summary.payments.map((payment) => ({
          shift_closing_id: closing.id,
          payment_id: payment.id,
          sales_order_id: payment.sales_order_id,
          amount: payment.amount,
          payment_method: payment.payment_method,
          terminal_code: payment.payment_terminals?.code || null,
        }));

        const { error: detailsError } = await supabase
          .from("shift_closing_details")
          .insert(details);

        if (detailsError) throw detailsError;
      }

      // Cerrar sesión de turno
      const { error: sessionError } = await supabase
        .from("shift_sessions")
        .update({
          clock_out_at: new Date().toISOString(),
          status: "closed",
        })
        .eq("id", session.id);

      if (sessionError) throw sessionError;

      success("Corte completado", "El corte de caja se ha registrado correctamente");
      onComplete();
    } catch (err: any) {
      console.error("Error saving closing:", err);
      showError("Error", err.message || "No se pudo guardar el corte");
    } finally {
      setSaving(false);
    }
  };

  // Formatear moneda
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(amount);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Corte de Caja
          </DialogTitle>
          <DialogDescription>
            Turno de{" "}
            <strong>
              {session.employees?.first_name} {session.employees?.last_name}
            </strong>{" "}
            - {session.shift_definitions?.name}
            <br />
            <span className="text-xs">
              Inicio: {new Date(session.clock_in_at).toLocaleString("es-MX")}
            </span>
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-6 py-4">
            {/* Resumen de ventas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-sm">Efectivo</span>
                </div>
                <p className="text-xl font-bold text-green-600">
                  {formatCurrency(summary?.total_cash || 0)}
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <CreditCard className="h-4 w-4" />
                  <span className="text-sm">BBVA</span>
                </div>
                <p className="text-xl font-bold text-blue-600">
                  {formatCurrency(summary?.total_card_bbva || 0)}
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <CreditCard className="h-4 w-4" />
                  <span className="text-sm">GETNET</span>
                </div>
                <p className="text-xl font-bold text-red-600">
                  {formatCurrency(summary?.total_card_getnet || 0)}
                </p>
              </div>
              <div className="bg-primary/10 rounded-lg p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Receipt className="h-4 w-4" />
                  <span className="text-sm">Total Ventas</span>
                </div>
                <p className="text-xl font-bold">
                  {formatCurrency(summary?.total_sales || 0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {summary?.total_transactions || 0} transacciones
                </p>
              </div>
            </div>

            {/* Conteo de efectivo */}
            <div className="border rounded-lg p-4 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Conteo de Efectivo
              </h3>

              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {CASH_DENOMINATIONS.map((denom) => (
                  <div key={denom.value} className="space-y-1">
                    <Label className="text-xs">{denom.label}</Label>
                    <Input
                      type="number"
                      min="0"
                      value={cashBreakdown[denom.value.toString()] || ""}
                      onChange={(e) =>
                        updateDenomination(denom.value, parseInt(e.target.value) || 0)
                      }
                      className="h-9"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>

              {/* Resultado del conteo */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-sm text-muted-foreground">Efectivo esperado</p>
                  <p className="text-lg font-bold">
                    {formatCurrency(summary?.total_cash || 0)}
                  </p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-sm text-muted-foreground">Efectivo contado</p>
                  <p className="text-lg font-bold">{formatCurrency(countedCash)}</p>
                </div>
                <div
                  className={`rounded-lg p-3 ${
                    cashDifference === 0
                      ? "bg-green-500/10"
                      : cashDifference > 0
                      ? "bg-blue-500/10"
                      : "bg-red-500/10"
                  }`}
                >
                  <p className="text-sm text-muted-foreground">Diferencia</p>
                  <p
                    className={`text-lg font-bold flex items-center gap-1 ${
                      cashDifference === 0
                        ? "text-green-600"
                        : cashDifference > 0
                        ? "text-blue-600"
                        : "text-red-600"
                    }`}
                  >
                    {cashDifference === 0 ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : cashDifference > 0 ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                    {formatCurrency(cashDifference)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {cashDifference === 0
                      ? "Cuadra perfectamente"
                      : cashDifference > 0
                      ? "Sobrante"
                      : "Faltante"}
                  </p>
                </div>
              </div>
            </div>

            {/* Lista de transacciones detalladas */}
            {summary && summary.payments.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="p-3 bg-muted/50 border-b flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Transacciones del turno ({summary.payments.length})
                  </h3>
                  <Badge variant="outline" className="text-xs">
                    Total: {formatCurrency(summary.total_sales)}
                  </Badge>
                </div>
                <div className="max-h-[250px] overflow-y-auto">
                  <div className="divide-y">
                    {summary.payments.map((payment, index) => {
                      const salesOrder = payment.sales_orders;
                      const paymentMethod = payment.payment_method === "TARJETA_BBVA" 
                        ? "TARJETA" 
                        : payment.payment_method === "TARJETA_GETNET" 
                          ? "TARJETA" 
                          : payment.payment_method;
                      
                      const terminalCode = payment.payment_method === "TARJETA_BBVA" 
                        ? "BBVA" 
                        : payment.payment_method === "TARJETA_GETNET" 
                          ? "GETNET" 
                          : payment.terminal_code || payment.payment_terminals?.code;

                      const conceptLabels: Record<string, string> = {
                        CHECKOUT: "Checkout",
                        PAGO_GRANULAR: "Pago por Concepto",
                        ABONO: "Abono",
                        ANTICIPO: "Anticipo",
                      };
                      const conceptLabel = payment.concept 
                        ? (conceptLabels[payment.concept] || payment.concept.replace(/_/g, " "))
                        : "Pago";

                      return (
                        <div key={payment.id} className="p-3 hover:bg-muted/30 transition-colors">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs text-muted-foreground font-mono">
                                  #{(index + 1).toString().padStart(2, '0')}
                                </span>
                                <span className="text-sm font-medium">
                                  {new Date(payment.created_at).toLocaleTimeString("es-MX", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    second: "2-digit",
                                  })}
                                </span>
                              </div>
                              
                              <div className="flex flex-wrap items-center gap-2 text-xs">
                                <Badge variant={paymentMethod === "EFECTIVO" ? "default" : "secondary"}>
                                  {paymentMethod === "EFECTIVO" ? "💵" : "💳"} {paymentMethod}
                                </Badge>
                                {terminalCode && (
                                  <Badge variant="outline" className="text-xs">
                                    {terminalCode}
                                  </Badge>
                                )}
                                <span className="text-muted-foreground">{conceptLabel}</span>
                              </div>

                              <div className="mt-1 text-xs text-muted-foreground">
                                {payment.reference && (
                                  <span className="mr-3">Ref: {payment.reference}</span>
                                )}
                                {salesOrder && (
                                  <span>Orden: #{salesOrder.id?.slice(0, 8).toUpperCase()}</span>
                                )}
                              </div>
                            </div>

                            <div className="text-right flex-shrink-0">
                              <p className="text-lg font-bold text-primary">
                                {formatCurrency(payment.amount)}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Desglose de Ventas por Orden */}
            {summary && summary.salesOrders.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="p-3 bg-muted/50 border-b flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Receipt className="h-4 w-4" />
                    Desglose de Ventas ({summary.salesOrders.length} órdenes)
                  </h3>
                  <Badge variant="outline" className="text-xs">
                    Total: {formatCurrency(summary.salesOrders.reduce((sum, o) => sum + (o.total || 0), 0))}
                  </Badge>
                </div>
                <div className="max-h-[400px] overflow-y-auto">
                  <div className="divide-y">
                    {summary.salesOrders.map((order, orderIndex) => {
                      const roomStay = order.room_stays?.[0];
                      const room = roomStay?.rooms;
                      const roomType = room?.room_types;
                      const items = order.sales_order_items || [];
                      
                      // Agrupar items por concepto
                      const conceptLabels: Record<string, string> = {
                        ROOM_BASE: "Habitación",
                        EXTRA_HOUR: "Hora Extra",
                        EXTRA_PERSON: "Persona Extra",
                        CONSUMPTION: "Consumo",
                        PRODUCT: "Producto",
                      };

                      return (
                        <div key={order.id} className="p-3">
                          {/* Header de la orden */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground font-mono">
                                #{(orderIndex + 1).toString().padStart(2, '0')}
                              </span>
                              <span className="text-sm font-medium">
                                {new Date(order.created_at).toLocaleTimeString("es-MX", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              {room && (
                                <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-500 border-blue-500/30">
                                  🏨 Hab. {room.number}
                                </Badge>
                              )}
                              {roomType && (
                                <span className="text-xs text-muted-foreground">({roomType.name})</span>
                              )}
                              <Badge 
                                variant={order.status === "COMPLETED" || order.status === "ENDED" ? "default" : "secondary"}
                                className="text-xs"
                              >
                                {order.status}
                              </Badge>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-primary">{formatCurrency(order.total)}</p>
                              {order.remaining_amount > 0 && (
                                <p className="text-xs text-amber-500">Pend: {formatCurrency(order.remaining_amount)}</p>
                              )}
                            </div>
                          </div>

                          {/* Items de la orden */}
                          {items.length > 0 && (
                            <div className="ml-4 pl-3 border-l-2 border-muted space-y-1">
                              {items.map((item: any, itemIndex: number) => {
                                const product = Array.isArray(item.products) ? item.products[0] : item.products;
                                const conceptType = item.concept_type || "PRODUCT";
                                const itemName = conceptType !== "PRODUCT" && conceptLabels[conceptType]
                                  ? conceptLabels[conceptType]
                                  : product?.name || "Producto";

                                return (
                                  <div key={item.id} className="flex items-center justify-between text-sm py-1">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <span className="text-xs text-muted-foreground w-5">
                                        {itemIndex + 1}.
                                      </span>
                                      <Badge 
                                        variant="outline" 
                                        className={`text-[10px] px-1.5 ${
                                          conceptType === "ROOM_BASE" ? "bg-blue-500/10 text-blue-400 border-blue-500/30" :
                                          conceptType === "EXTRA_HOUR" ? "bg-amber-500/10 text-amber-400 border-amber-500/30" :
                                          conceptType === "EXTRA_PERSON" ? "bg-purple-500/10 text-purple-400 border-purple-500/30" :
                                          conceptType === "CONSUMPTION" ? "bg-green-500/10 text-green-400 border-green-500/30" :
                                          "bg-slate-500/10 text-slate-400 border-slate-500/30"
                                        }`}
                                      >
                                        {conceptLabels[conceptType] || "Prod"}
                                      </Badge>
                                      <span className="truncate">{itemName}</span>
                                      <span className="text-muted-foreground text-xs">
                                        ×{item.qty} @ {formatCurrency(item.unit_price)}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      <span className="font-medium">{formatCurrency(item.total)}</span>
                                      {item.is_paid ? (
                                        <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                                      ) : (
                                        <Clock className="h-3.5 w-3.5 text-amber-500" />
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Resumen de la orden */}
                          <div className="mt-2 pt-2 border-t border-dashed flex items-center justify-between text-xs text-muted-foreground">
                            <span>Orden: #{order.id.slice(0, 8).toUpperCase()}</span>
                            <span>
                              {items.filter((i: any) => i.is_paid).length}/{items.length} items pagados
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Notas */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notas (opcional)</Label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observaciones del turno..."
                className="w-full h-20 px-3 py-2 border rounded-md bg-background resize-none"
              />
            </div>
          </div>
        )}

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSaveClosing} disabled={loading || saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Completar Corte
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Componente para ver historial de cortes
export function ShiftClosingHistory() {
  const supabase = createClient();
  const { success, error: showError } = useToast();
  const [closings, setClosings] = useState<ShiftClosing[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentEmployeeId, setCurrentEmployeeId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedClosing, setSelectedClosing] = useState<ShiftClosing | null>(null);
  const [closingDetails, setClosingDetails] = useState<any[]>([]);
  const [closingSalesOrders, setClosingSalesOrders] = useState<any[]>([]);
  const [closingReviews, setClosingReviews] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [processingAction, setProcessingAction] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionClosing, setCorrectionClosing] = useState<ShiftClosing | null>(null);
  const [correctionCashBreakdown, setCorrectionCashBreakdown] = useState<CashBreakdown>({});
  const [correctionNotes, setCorrectionNotes] = useState("");
  const [savingCorrection, setSavingCorrection] = useState(false);

  const loadClosings = async () => {
    setLoading(true);
    // Obtener usuario actual
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      setLoading(false);
      return;
    }

    // Obtener empleado y rol del usuario
    const { data: employee } = await supabase
      .from("employees")
      .select("id, role")
      .eq("auth_user_id", user.id)
      .limit(1);

    const employeeData = employee?.[0];
    const employeeId = employeeData?.id;
    const userIsAdmin = employeeData?.role === "admin" || employeeData?.role === "manager";
    
    // Debug: mostrar en consola el rol del usuario
    console.log("Usuario actual:", { employeeId, role: employeeData?.role, isAdmin: userIsAdmin });
    
    setCurrentEmployeeId(employeeId);
    setIsAdmin(userIsAdmin);

    // Construir query - admin ve todos, empleado solo los suyos
    let query = supabase
      .from("shift_closings")
      .select("*, employees!shift_closings_employee_id_fkey(*), shift_definitions(*)")
      .order("created_at", { ascending: false })
      .limit(50);

    // Si no es admin, filtrar por su employee_id
    if (!userIsAdmin && employeeId) {
      query = query.eq("employee_id", employeeId);
    }

    // Filtrar por estado si no es "all"
    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;

    if (!error) {
      setClosings(data || []);
    } else {
      console.error("Error loading closings:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadClosings();
  }, [statusFilter]);

  // Cargar detalles del corte seleccionado
  const loadClosingDetails = async (closingId: string, periodStart: string, periodEnd: string) => {
    setLoadingDetails(true);
    
    // Obtener detalles con información completa de pagos y órdenes
    const { data, error } = await supabase
      .from("shift_closing_details")
      .select(`
        *,
        payments(
          id, amount, payment_method, reference, concept, status, payment_type, 
          terminal_code, created_at,
          sales_orders(
            id, total, remaining_amount, status,
            room_stays(
              id,
              rooms(number, room_types(name))
            )
          )
        )
      `)
      .eq("shift_closing_id", closingId)
      .order("created_at", { ascending: false });

    if (!error) {
      setClosingDetails(data || []);
    }

    // Obtener órdenes de venta del período del corte con sus items desglosados
    const { data: salesOrders } = await supabase
      .from("sales_orders")
      .select(`
        id, created_at, total, paid_amount, remaining_amount, status, currency,
        room_stays(
          id,
          rooms(number, room_types(name))
        ),
        sales_order_items(
          id, qty, unit_price, total, concept_type, is_paid, paid_at, payment_method,
          products(name, sku)
        )
      `)
      .gte("created_at", periodStart)
      .lte("created_at", periodEnd)
      .order("created_at", { ascending: false });

    setClosingSalesOrders(salesOrders || []);
    setLoadingDetails(false);
  };

  // Cargar historial de revisiones
  const loadClosingReviews = async (closingId: string) => {
    const { data } = await supabase
      .from("shift_closing_reviews")
      .select("*, employees(first_name, last_name)")
      .eq("shift_closing_id", closingId)
      .order("created_at", { ascending: false });
    
    setClosingReviews(data || []);
  };

  // Abrir modal de detalle
  const openDetail = async (closing: ShiftClosing) => {
    console.log("Abriendo detalle:", { closingId: closing.id, status: closing.status, isAdmin });
    setSelectedClosing(closing);
    await Promise.all([
      loadClosingDetails(closing.id, closing.period_start, closing.period_end),
      loadClosingReviews(closing.id)
    ]);
  };

  // Registrar revisión en el historial
  const recordReview = async (closingId: string, action: string, reason?: string) => {
    await supabase
      .from("shift_closing_reviews")
      .insert({
        shift_closing_id: closingId,
        reviewer_id: currentEmployeeId,
        action,
        reason
      });
  };

  // Aprobar corte
  const approveClosing = async (closingId: string) => {
    setProcessingAction(true);
    
    // Actualizar estado del corte
    const { error } = await supabase
      .from("shift_closings")
      .update({ 
        status: "approved",
        reviewed_by: currentEmployeeId,
        reviewed_at: new Date().toISOString()
      })
      .eq("id", closingId);

    if (error) {
      showError("Error", "No se pudo aprobar el corte");
    } else {
      // Registrar en historial de revisiones
      await recordReview(closingId, "approved");
      success("Corte aprobado", "El corte ha sido aprobado exitosamente");
      setSelectedClosing(null);
      loadClosings();
    }
    setProcessingAction(false);
  };

  // Abrir modal de rechazo
  const openRejectModal = () => {
    setRejectionReason("");
    setShowRejectModal(true);
  };

  // Confirmar rechazo con motivo
  const confirmRejectClosing = async () => {
    if (!selectedClosing || !rejectionReason.trim()) {
      showError("Error", "Debe proporcionar un motivo de rechazo");
      return;
    }

    setProcessingAction(true);
    
    // Actualizar estado del corte con motivo
    const { error } = await supabase
      .from("shift_closings")
      .update({ 
        status: "rejected",
        reviewed_by: currentEmployeeId,
        reviewed_at: new Date().toISOString(),
        rejection_reason: rejectionReason.trim()
      })
      .eq("id", selectedClosing.id);

    if (error) {
      showError("Error", "No se pudo rechazar el corte");
    } else {
      // Registrar en historial de revisiones
      await recordReview(selectedClosing.id, "rejected", rejectionReason.trim());
      success("Corte rechazado", "El corte ha sido marcado como rechazado");
      setShowRejectModal(false);
      setSelectedClosing(null);
      loadClosings();
    }
    setProcessingAction(false);
  };

  // Abrir modal de corrección
  const openCorrectionModal = (closing: ShiftClosing) => {
    setCorrectionClosing(closing);
    setCorrectionCashBreakdown({});
    setCorrectionNotes(`Corrección del corte del ${new Date(closing.period_start).toLocaleDateString("es-MX")}`);
    setShowCorrectionModal(true);
    setSelectedClosing(null); // Cerrar el modal de detalle
  };

  // Calcular total del arqueo de corrección
  const calculateCorrectionCashTotal = () => {
    return Object.entries(correctionCashBreakdown).reduce((total, [denom, qty]) => {
      return total + (parseFloat(denom) * (qty || 0));
    }, 0);
  };

  // Guardar corte corregido
  const saveCorrectionClosing = async () => {
    if (!correctionClosing || !currentEmployeeId) return;

    setSavingCorrection(true);
    try {
      const correctionCashTotal = calculateCorrectionCashTotal();
      const expectedCash = correctionClosing.total_cash || 0;
      const cashDifference = correctionCashTotal - expectedCash;

      // Crear el corte corregido
      const { data: newClosing, error } = await supabase
        .from("shift_closings")
        .insert({
          employee_id: currentEmployeeId,
          shift_definition_id: correctionClosing.shift_definition_id,
          period_start: correctionClosing.period_start,
          period_end: correctionClosing.period_end,
          total_cash: correctionClosing.total_cash,
          total_card_bbva: correctionClosing.total_card_bbva,
          total_card_getnet: correctionClosing.total_card_getnet,
          total_sales: correctionClosing.total_sales,
          counted_cash: correctionCashTotal,
          cash_difference: cashDifference,
          cash_breakdown: correctionCashBreakdown,
          notes: correctionNotes.trim() || null,
          status: "pending",
          is_correction: true,
          original_closing_id: correctionClosing.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Copiar los detalles del corte original al nuevo
      const { data: originalDetails } = await supabase
        .from("shift_closing_details")
        .select("*")
        .eq("shift_closing_id", correctionClosing.id);

      if (originalDetails && originalDetails.length > 0) {
        const newDetails = originalDetails.map(d => ({
          shift_closing_id: newClosing.id,
          payment_id: d.payment_id,
          payment_method: d.payment_method,
          terminal_code: d.terminal_code,
          amount: d.amount,
        }));

        await supabase.from("shift_closing_details").insert(newDetails);
      }

      success("Corrección creada", "El corte corregido ha sido creado y está pendiente de aprobación");
      setShowCorrectionModal(false);
      setCorrectionClosing(null);
      loadClosings();
    } catch (err) {
      console.error("Error creating correction:", err);
      showError("Error", "No se pudo crear el corte corregido");
    } finally {
      setSavingCorrection(false);
    }
  };

  // Exportar corte a PDF/Imprimir
  const exportClosing = (closing: ShiftClosing) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Corte de Caja - ${new Date(closing.period_start).toLocaleDateString("es-MX")}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; font-size: 12px; padding: 20px; max-width: 400px; margin: 0 auto; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
          .header h1 { font-size: 18px; margin-bottom: 5px; }
          .info { margin-bottom: 15px; }
          .info-row { display: flex; justify-content: space-between; margin-bottom: 5px; padding: 3px 0; }
          .info-row.border { border-bottom: 1px dashed #ccc; }
          .section { margin: 15px 0; padding: 10px 0; border-top: 1px solid #000; }
          .section h3 { font-size: 14px; margin-bottom: 10px; }
          .total-row { font-size: 14px; font-weight: bold; background: #f0f0f0; padding: 8px; margin: 5px 0; }
          .status { text-align: center; padding: 10px; margin: 15px 0; font-weight: bold; border: 2px solid; }
          .status.ok { border-color: green; color: green; }
          .status.over { border-color: blue; color: blue; }
          .status.under { border-color: red; color: red; }
          .footer { text-align: center; margin-top: 20px; font-size: 10px; color: #666; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📋 CORTE DE CAJA</h1>
          <p>${closing.shift_definitions?.name || "Turno"}</p>
          <p>${new Date(closing.period_start).toLocaleDateString("es-MX", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>

        <div class="info">
          <div class="info-row border">
            <span>Empleado:</span>
            <span><strong>${closing.employees?.first_name} ${closing.employees?.last_name}</strong></span>
          </div>
          <div class="info-row border">
            <span>Hora inicio:</span>
            <span>${new Date(closing.period_start).toLocaleTimeString("es-MX", { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div class="info-row border">
            <span>Hora fin:</span>
            <span>${new Date(closing.period_end).toLocaleTimeString("es-MX", { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div class="info-row border">
            <span>Transacciones:</span>
            <span>${closing.total_transactions}</span>
          </div>
        </div>

        <div class="section">
          <h3>💰 Resumen de Ventas</h3>
          <div class="info-row">
            <span>Efectivo:</span>
            <span>$${(closing.total_cash || 0).toFixed(2)}</span>
          </div>
          <div class="info-row">
            <span>Tarjeta BBVA:</span>
            <span>$${(closing.total_card_bbva || 0).toFixed(2)}</span>
          </div>
          <div class="info-row">
            <span>Tarjeta Getnet:</span>
            <span>$${(closing.total_card_getnet || 0).toFixed(2)}</span>
          </div>
          <div class="total-row">
            <div class="info-row" style="margin:0">
              <span>TOTAL VENTAS:</span>
              <span>$${(closing.total_sales || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div class="section">
          <h3>🧮 Arqueo de Caja</h3>
          <div class="info-row">
            <span>Efectivo esperado:</span>
            <span>$${(closing.total_cash || 0).toFixed(2)}</span>
          </div>
          <div class="info-row">
            <span>Efectivo contado:</span>
            <span>$${(closing.counted_cash || 0).toFixed(2)}</span>
          </div>
          <div class="total-row">
            <div class="info-row" style="margin:0">
              <span>DIFERENCIA:</span>
              <span>$${(closing.cash_difference || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div class="status ${closing.cash_difference === 0 ? 'ok' : (closing.cash_difference || 0) > 0 ? 'over' : 'under'}">
          ${closing.cash_difference === 0 
            ? '✓ CAJA CUADRADA' 
            : (closing.cash_difference || 0) > 0 
              ? '↑ SOBRANTE: $' + Math.abs(closing.cash_difference || 0).toFixed(2)
              : '↓ FALTANTE: $' + Math.abs(closing.cash_difference || 0).toFixed(2)
          }
        </div>

        ${closing.notes ? `
          <div class="section">
            <h3>📝 Notas</h3>
            <p>${closing.notes}</p>
          </div>
        ` : ''}

        <div class="footer">
          <p>Generado: ${new Date().toLocaleString("es-MX")}</p>
          <p>ID: ${closing.id.slice(0, 8).toUpperCase()}</p>
        </div>

        <div class="no-print" style="text-align: center; margin-top: 20px;">
          <button onclick="window.print()" style="padding: 10px 20px; font-size: 14px; cursor: pointer;">
            🖨️ Imprimir
          </button>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(amount);
  };

  const getStatusBadge = (status: ShiftClosing["status"]) => {
    const config = {
      pending: { label: "Pendiente", variant: "secondary" as const, icon: "⏳" },
      approved: { label: "Aprobado", variant: "default" as const, icon: "✓" },
      rejected: { label: "Rechazado", variant: "destructive" as const, icon: "✕" },
      reviewed: { label: "Revisado", variant: "outline" as const, icon: "👁" },
    };
    const { label, variant, icon } = config[status] || config.pending;
    return <Badge variant={variant}>{icon} {label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  // Contar cortes rechazados del empleado actual
  const rejectedClosings = closings.filter(c => 
    c.status?.toLowerCase() === "rejected" && 
    c.employee_id === currentEmployeeId
  );

  return (
    <div className="space-y-4">
      {/* Alerta de cortes rechazados */}
      {rejectedClosings.length > 0 && !isAdmin && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-red-500 mb-1">
                Tienes {rejectedClosings.length} corte(s) rechazado(s)
              </h4>
              <p className="text-sm text-muted-foreground">
                Por favor revisa los motivos de rechazo y realiza las correcciones necesarias.
                Haz clic en "Ver" para ver los detalles de cada corte rechazado.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {rejectedClosings.slice(0, 3).map((closing) => (
                  <Button
                    key={closing.id}
                    variant="outline"
                    size="sm"
                    className="text-xs border-red-500/30 hover:bg-red-500/10"
                    onClick={() => openDetail(closing)}
                  >
                    {new Date(closing.created_at).toLocaleDateString("es-MX")} - Ver detalles
                  </Button>
                ))}
                {rejectedClosings.length > 3 && (
                  <span className="text-xs text-muted-foreground self-center">
                    y {rejectedClosings.length - 3} más...
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Estado:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded-md px-3 py-1.5 text-sm bg-background"
          >
            <option value="all">Todos</option>
            <option value="pending">Pendientes</option>
            <option value="approved">Aprobados</option>
            <option value="rejected">Rechazados</option>
          </select>
        </div>
        <div className="flex-1" />
        <Badge variant="outline" className="text-xs">
          {closings.length} corte(s)
        </Badge>
      </div>

      {/* Tabla */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Empleado</TableHead>
              <TableHead>Turno</TableHead>
              <TableHead className="text-right">Efectivo</TableHead>
              <TableHead className="text-right">Tarjetas</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Diferencia</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-center">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {closings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No hay cortes registrados
                </TableCell>
              </TableRow>
            ) : (
              closings.map((closing) => (
                <TableRow key={closing.id} className="hover:bg-muted/50">
                  <TableCell>
                    <div>
                      <p className="font-medium">{new Date(closing.period_start).toLocaleDateString("es-MX")}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(closing.period_start).toLocaleTimeString("es-MX", { hour: '2-digit', minute: '2-digit' })}
                        {" - "}
                        {new Date(closing.period_end).toLocaleTimeString("es-MX", { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {closing.employees?.first_name} {closing.employees?.last_name}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={`${
                        SHIFT_COLORS[closing.shift_definitions?.code || ""] || "bg-gray-500"
                      } text-white`}
                    >
                      {closing.shift_definitions?.name}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(closing.total_cash || 0)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatCurrency((closing.total_card_bbva || 0) + (closing.total_card_getnet || 0))}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(closing.total_sales)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={`font-medium ${
                        closing.cash_difference === 0
                          ? "text-green-600"
                          : (closing.cash_difference || 0) > 0
                          ? "text-blue-600"
                          : "text-red-600"
                      }`}
                    >
                      {closing.cash_difference === 0 ? "✓" : (closing.cash_difference || 0) > 0 ? "+" : ""}
                      {formatCurrency(closing.cash_difference || 0)}
                    </span>
                  </TableCell>
                  <TableCell>{getStatusBadge(closing.status)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDetail(closing)}
                        title="Ver detalle"
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => exportClosing(closing)}
                        title="Imprimir"
                      >
                        <Receipt className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal de detalle */}
      <Dialog open={!!selectedClosing} onOpenChange={() => setSelectedClosing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Detalle del Corte
            </DialogTitle>
            <DialogDescription>
              {selectedClosing && (
                <>
                  {new Date(selectedClosing.period_start).toLocaleDateString("es-MX", { 
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
                  })}
                  {" • "}
                  {selectedClosing.employees?.first_name} {selectedClosing.employees?.last_name}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedClosing && (
            <div className="space-y-4">
              {/* Resumen */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <p className="text-xs text-green-600">Efectivo</p>
                  <p className="text-lg font-bold text-green-600">{formatCurrency(selectedClosing.total_cash || 0)}</p>
                </div>
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <p className="text-xs text-blue-600">BBVA</p>
                  <p className="text-lg font-bold text-blue-600">{formatCurrency(selectedClosing.total_card_bbva || 0)}</p>
                </div>
                <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                  <p className="text-xs text-orange-600">Getnet</p>
                  <p className="text-lg font-bold text-orange-600">{formatCurrency(selectedClosing.total_card_getnet || 0)}</p>
                </div>
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-xs text-primary">Total</p>
                  <p className="text-lg font-bold text-primary">{formatCurrency(selectedClosing.total_sales || 0)}</p>
                </div>
              </div>

              {/* Arqueo */}
              <div className={`p-4 rounded-lg border ${
                selectedClosing.cash_difference === 0 
                  ? "bg-green-500/10 border-green-500/30" 
                  : (selectedClosing.cash_difference || 0) > 0 
                    ? "bg-blue-500/10 border-blue-500/30"
                    : "bg-red-500/10 border-red-500/30"
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Arqueo de Caja</p>
                    <p className="text-xs text-muted-foreground">
                      Esperado: {formatCurrency(selectedClosing.total_cash || 0)} • 
                      Contado: {formatCurrency(selectedClosing.counted_cash || 0)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${
                      selectedClosing.cash_difference === 0 
                        ? "text-green-600" 
                        : (selectedClosing.cash_difference || 0) > 0 
                          ? "text-blue-600"
                          : "text-red-600"
                    }`}>
                      {selectedClosing.cash_difference === 0 
                        ? "✓ Cuadra" 
                        : (selectedClosing.cash_difference || 0) > 0 
                          ? `+${formatCurrency(selectedClosing.cash_difference || 0)}`
                          : formatCurrency(selectedClosing.cash_difference || 0)
                      }
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedClosing.cash_difference === 0 
                        ? "Sin diferencia" 
                        : (selectedClosing.cash_difference || 0) > 0 
                          ? "Sobrante"
                          : "Faltante"
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Notas */}
              {selectedClosing.notes && (
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="text-xs text-muted-foreground mb-1">Notas:</p>
                  <p className="text-sm">{selectedClosing.notes}</p>
                </div>
              )}

              {/* Transacciones Detalladas */}
              {loadingDetails ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : closingDetails.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="p-3 bg-muted/50 border-b flex items-center justify-between">
                    <h4 className="font-medium text-sm">Transacciones Detalladas ({closingDetails.length})</h4>
                    <Badge variant="outline" className="text-xs">
                      Total: {formatCurrency(closingDetails.reduce((sum, d) => sum + (d.amount || 0), 0))}
                    </Badge>
                  </div>
                  <div className="max-h-[350px] overflow-y-auto">
                    <div className="divide-y">
                      {closingDetails.map((detail, index) => {
                        const payment = detail.payments;
                        const salesOrder = payment?.sales_orders;
                        const roomStay = salesOrder?.room_stays?.[0];
                        const room = roomStay?.rooms;
                        const roomType = room?.room_types;
                        
                        // Determinar el método de pago para mostrar
                        const paymentMethod = detail.payment_method === "TARJETA_BBVA" 
                          ? "TARJETA" 
                          : detail.payment_method === "TARJETA_GETNET" 
                            ? "TARJETA" 
                            : detail.payment_method;
                        
                        const terminalCode = detail.payment_method === "TARJETA_BBVA" 
                          ? "BBVA" 
                          : detail.payment_method === "TARJETA_GETNET" 
                            ? "GETNET" 
                            : detail.terminal_code || payment?.terminal_code;

                        // Concepto legible
                        const conceptLabels: Record<string, string> = {
                          CHECKOUT: "Checkout",
                          PAGO_GRANULAR: "Pago por Concepto",
                          ABONO: "Abono",
                          ANTICIPO: "Anticipo",
                        };
                        const conceptLabel = payment?.concept 
                          ? (conceptLabels[payment.concept] || payment.concept.replace(/_/g, " "))
                          : "Pago";

                        return (
                          <div key={detail.id} className="p-3 hover:bg-muted/30 transition-colors">
                            <div className="flex items-start justify-between gap-3">
                              {/* Columna izquierda: Info principal */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs text-muted-foreground font-mono">
                                    #{(index + 1).toString().padStart(2, '0')}
                                  </span>
                                  <span className="text-sm font-medium">
                                    {payment?.created_at 
                                      ? new Date(payment.created_at).toLocaleTimeString("es-MX", { 
                                          hour: '2-digit', 
                                          minute: '2-digit',
                                          second: '2-digit'
                                        })
                                      : "-"
                                    }
                                  </span>
                                  {room && (
                                    <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-500 border-blue-500/30">
                                      🏨 Hab. {room.number}
                                    </Badge>
                                  )}
                                </div>
                                
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                  <Badge variant={paymentMethod === "EFECTIVO" ? "default" : "secondary"}>
                                    {paymentMethod === "EFECTIVO" ? "💵" : "💳"} {paymentMethod}
                                  </Badge>
                                  {terminalCode && (
                                    <Badge variant="outline" className="text-xs">
                                      Terminal: {terminalCode}
                                    </Badge>
                                  )}
                                  <span className="text-muted-foreground">
                                    {conceptLabel}
                                  </span>
                                </div>

                                {/* Detalles adicionales */}
                                <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                                  {payment?.reference && (
                                    <p>
                                      <span className="font-medium">Ref:</span> {payment.reference}
                                    </p>
                                  )}
                                  {roomType && (
                                    <p>
                                      <span className="font-medium">Tipo:</span> {roomType.name}
                                    </p>
                                  )}
                                  {salesOrder && (
                                    <p>
                                      <span className="font-medium">Orden:</span> #{salesOrder.id.slice(0, 8).toUpperCase()}
                                      {salesOrder.status && (
                                        <span className={`ml-2 ${
                                          salesOrder.status === "COMPLETED" || salesOrder.status === "ENDED" 
                                            ? "text-green-500" 
                                            : "text-amber-500"
                                        }`}>
                                          ({salesOrder.status})
                                        </span>
                                      )}
                                    </p>
                                  )}
                                  {payment?.payment_type && payment.payment_type !== "COMPLETO" && (
                                    <p>
                                      <span className="font-medium">Tipo pago:</span> {payment.payment_type}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Columna derecha: Monto */}
                              <div className="text-right flex-shrink-0">
                                <p className="text-lg font-bold text-primary">
                                  {formatCurrency(detail.amount)}
                                </p>
                                <p className={`text-xs ${
                                  payment?.status === "PAGADO" ? "text-green-500" : "text-amber-500"
                                }`}>
                                  {payment?.status || "PAGADO"}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Desglose de Ventas por Orden */}
              {closingSalesOrders.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="p-3 bg-muted/50 border-b flex items-center justify-between">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <Receipt className="h-4 w-4" />
                      Desglose de Ventas ({closingSalesOrders.length} órdenes)
                    </h4>
                    <Badge variant="outline" className="text-xs">
                      Total: {formatCurrency(closingSalesOrders.reduce((sum, o) => sum + (o.total || 0), 0))}
                    </Badge>
                  </div>
                  <div className="max-h-[350px] overflow-y-auto">
                    <div className="divide-y">
                      {closingSalesOrders.map((order, orderIndex) => {
                        const roomStay = order.room_stays?.[0];
                        const room = roomStay?.rooms;
                        const roomType = room?.room_types;
                        const items = order.sales_order_items || [];
                        
                        const conceptLabels: Record<string, string> = {
                          ROOM_BASE: "Habitación",
                          EXTRA_HOUR: "Hora Extra",
                          EXTRA_PERSON: "Persona Extra",
                          CONSUMPTION: "Consumo",
                          PRODUCT: "Producto",
                        };

                        return (
                          <div key={order.id} className="p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground font-mono">
                                  #{(orderIndex + 1).toString().padStart(2, '0')}
                                </span>
                                <span className="text-sm font-medium">
                                  {new Date(order.created_at).toLocaleTimeString("es-MX", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                                {room && (
                                  <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-500 border-blue-500/30">
                                    🏨 Hab. {room.number}
                                  </Badge>
                                )}
                                {roomType && (
                                  <span className="text-xs text-muted-foreground">({roomType.name})</span>
                                )}
                                <Badge 
                                  variant={order.status === "COMPLETED" || order.status === "ENDED" ? "default" : "secondary"}
                                  className="text-xs"
                                >
                                  {order.status}
                                </Badge>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-primary">{formatCurrency(order.total)}</p>
                                {order.remaining_amount > 0 && (
                                  <p className="text-xs text-amber-500">Pend: {formatCurrency(order.remaining_amount)}</p>
                                )}
                              </div>
                            </div>

                            {items.length > 0 && (
                              <div className="ml-4 pl-3 border-l-2 border-muted space-y-1">
                                {items.map((item: any, itemIndex: number) => {
                                  const product = Array.isArray(item.products) ? item.products[0] : item.products;
                                  const conceptType = item.concept_type || "PRODUCT";
                                  const itemName = conceptType !== "PRODUCT" && conceptLabels[conceptType]
                                    ? conceptLabels[conceptType]
                                    : product?.name || "Producto";

                                  return (
                                    <div key={item.id} className="flex items-center justify-between text-sm py-1">
                                      <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <span className="text-xs text-muted-foreground w-5">
                                          {itemIndex + 1}.
                                        </span>
                                        <Badge 
                                          variant="outline" 
                                          className={`text-[10px] px-1.5 ${
                                            conceptType === "ROOM_BASE" ? "bg-blue-500/10 text-blue-400 border-blue-500/30" :
                                            conceptType === "EXTRA_HOUR" ? "bg-amber-500/10 text-amber-400 border-amber-500/30" :
                                            conceptType === "EXTRA_PERSON" ? "bg-purple-500/10 text-purple-400 border-purple-500/30" :
                                            conceptType === "CONSUMPTION" ? "bg-green-500/10 text-green-400 border-green-500/30" :
                                            "bg-slate-500/10 text-slate-400 border-slate-500/30"
                                          }`}
                                        >
                                          {conceptLabels[conceptType] || "Prod"}
                                        </Badge>
                                        <span className="truncate">{itemName}</span>
                                        <span className="text-muted-foreground text-xs">
                                          ×{item.qty} @ {formatCurrency(item.unit_price)}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className="font-medium">{formatCurrency(item.total)}</span>
                                        {item.is_paid ? (
                                          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                                        ) : (
                                          <Clock className="h-3.5 w-3.5 text-amber-500" />
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            <div className="mt-2 pt-2 border-t border-dashed flex items-center justify-between text-xs text-muted-foreground">
                              <span>Orden: #{order.id.slice(0, 8).toUpperCase()}</span>
                              <span>
                                {items.filter((i: any) => i.is_paid).length}/{items.length} items pagados
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Estado actual */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border">
                <div className="flex items-center gap-2">
                  <span className="text-sm">Estado actual:</span>
                  {getStatusBadge(selectedClosing.status)}
                </div>
                {selectedClosing.reviewed_at && (
                  <span className="text-xs text-muted-foreground">
                    Revisado: {new Date(selectedClosing.reviewed_at).toLocaleString("es-MX")}
                  </span>
                )}
              </div>

              {/* Motivo de rechazo (si fue rechazado) */}
              {selectedClosing.status?.toLowerCase() === "rejected" && (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium text-red-500 mb-1">Motivo del Rechazo</h4>
                      <p className="text-sm">{(selectedClosing as any).rejection_reason || "No se especificó motivo"}</p>
                      
                      {/* Verificar si ya existe una corrección */}
                      {!(selectedClosing as any).is_correction && selectedClosing.employee_id === currentEmployeeId && (
                        <div className="mt-3 pt-3 border-t border-red-500/20">
                          <p className="text-xs text-muted-foreground mb-2">
                            Puedes crear un nuevo corte corregido con el arqueo de caja correcto.
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-500/30 hover:bg-red-500/10 text-red-500"
                            onClick={() => openCorrectionModal(selectedClosing)}
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            Crear Corte Corregido
                          </Button>
                        </div>
                      )}
                      
                      {(selectedClosing as any).has_correction && (
                        <p className="text-xs text-green-500 mt-2">
                          ✓ Ya existe un corte corregido para este período.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Historial de revisiones */}
              {closingReviews.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="p-3 bg-muted/50 border-b">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <History className="h-4 w-4" />
                      Historial de Revisiones ({closingReviews.length})
                    </h4>
                  </div>
                  <div className="max-h-[150px] overflow-y-auto">
                    <div className="divide-y">
                      {closingReviews.map((review) => (
                        <div key={review.id} className="p-3 text-sm">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant={review.action === "approved" ? "default" : review.action === "rejected" ? "destructive" : "secondary"}
                                className="text-xs"
                              >
                                {review.action === "approved" ? "✓ Aprobado" : review.action === "rejected" ? "✗ Rechazado" : "⏳ Pendiente"}
                              </Badge>
                              <span className="text-muted-foreground">
                                por {review.employees?.first_name} {review.employees?.last_name}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(review.created_at).toLocaleString("es-MX")}
                            </span>
                          </div>
                          {review.reason && (
                            <p className="text-xs text-muted-foreground mt-1 pl-2 border-l-2 border-muted">
                              {review.reason}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setSelectedClosing(null)}>
              Cerrar
            </Button>
            {selectedClosing && (
              <Button variant="outline" onClick={() => exportClosing(selectedClosing)}>
                <Receipt className="h-4 w-4 mr-2" />
                Imprimir
              </Button>
            )}
            {/* Botones de aprobar/rechazar solo para admin y si está pendiente */}
            {isAdmin && selectedClosing?.status?.toLowerCase() === "pending" && (
              <>
                <Button 
                  variant="destructive" 
                  onClick={openRejectModal}
                  disabled={processingAction}
                >
                  {processingAction ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                  Rechazar
                </Button>
                <Button 
                  onClick={() => approveClosing(selectedClosing.id)}
                  disabled={processingAction}
                >
                  {processingAction ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  Aprobar
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de rechazo con motivo */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              Rechazar Corte de Caja
            </DialogTitle>
            <DialogDescription>
              Por favor, proporcione el motivo del rechazo. Esta información será visible para el empleado.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">Motivo del rechazo *</Label>
              <textarea
                id="rejection-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Ej: Diferencia de $50 en efectivo no justificada, falta comprobante de pago con tarjeta..."
                className="w-full h-32 px-3 py-2 border rounded-md bg-background resize-none text-sm"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Sea específico para que el empleado pueda corregir el problema.
              </p>
            </div>

            {selectedClosing && (
              <div className="p-3 rounded-lg bg-muted/50 border text-sm">
                <p className="font-medium mb-1">Resumen del corte:</p>
                <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                  <span>Empleado:</span>
                  <span>{selectedClosing.employees?.first_name} {selectedClosing.employees?.last_name}</span>
                  <span>Fecha:</span>
                  <span>{new Date(selectedClosing.created_at).toLocaleDateString("es-MX")}</span>
                  <span>Diferencia:</span>
                  <span className={(selectedClosing.cash_difference || 0) !== 0 ? "text-red-500 font-medium" : "text-green-500"}>
                    {formatCurrency(selectedClosing.cash_difference || 0)}
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowRejectModal(false)}
              disabled={processingAction}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive"
              onClick={confirmRejectClosing}
              disabled={processingAction || !rejectionReason.trim()}
            >
              {processingAction ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Confirmar Rechazo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de corrección de corte */}
      <Dialog open={showCorrectionModal} onOpenChange={setShowCorrectionModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Crear Corte Corregido
            </DialogTitle>
            <DialogDescription>
              Ingresa el arqueo de caja correcto para crear una corrección del corte rechazado.
            </DialogDescription>
          </DialogHeader>

          {correctionClosing && (
            <div className="space-y-4 py-4">
              {/* Info del corte original */}
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <p className="text-sm font-medium text-amber-500 mb-2">Corte Original Rechazado</p>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <span className="text-muted-foreground">Fecha:</span>
                  <span>{new Date(correctionClosing.period_start).toLocaleDateString("es-MX")}</span>
                  <span className="text-muted-foreground">Efectivo esperado:</span>
                  <span className="font-medium">{formatCurrency(correctionClosing.total_cash || 0)}</span>
                  <span className="text-muted-foreground">Arqueo anterior:</span>
                  <span>{formatCurrency(correctionClosing.counted_cash || 0)}</span>
                  <span className="text-muted-foreground">Diferencia anterior:</span>
                  <span className={(correctionClosing.cash_difference || 0) !== 0 ? "text-red-500" : "text-green-500"}>
                    {formatCurrency(correctionClosing.cash_difference || 0)}
                  </span>
                </div>
              </div>

              {/* Arqueo de caja corregido */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Arqueo de Caja Corregido</Label>
                <div className="grid grid-cols-2 gap-2">
                  {CASH_DENOMINATIONS.map((denom) => (
                    <div key={denom.value} className="flex items-center gap-2">
                      <span className="text-xs w-16 text-muted-foreground">{denom.label}</span>
                      <Input
                        type="number"
                        min="0"
                        value={correctionCashBreakdown[denom.value] || ""}
                        onChange={(e) => setCorrectionCashBreakdown({
                          ...correctionCashBreakdown,
                          [denom.value]: parseInt(e.target.value) || 0
                        })}
                        className="h-8 text-sm"
                        placeholder="0"
                      />
                      <span className="text-xs text-muted-foreground w-20 text-right">
                        {formatCurrency((correctionCashBreakdown[denom.value] || 0) * denom.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Resumen del nuevo arqueo */}
              <div className="p-3 rounded-lg bg-muted/50 border">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Efectivo esperado:</span>
                  <span className="text-right font-medium">{formatCurrency(correctionClosing.total_cash || 0)}</span>
                  <span className="text-muted-foreground">Nuevo arqueo:</span>
                  <span className="text-right font-medium">{formatCurrency(calculateCorrectionCashTotal())}</span>
                  <span className="text-muted-foreground">Nueva diferencia:</span>
                  <span className={`text-right font-bold ${
                    calculateCorrectionCashTotal() - (correctionClosing.total_cash || 0) === 0 
                      ? "text-green-500" 
                      : calculateCorrectionCashTotal() - (correctionClosing.total_cash || 0) > 0 
                        ? "text-blue-500" 
                        : "text-red-500"
                  }`}>
                    {formatCurrency(calculateCorrectionCashTotal() - (correctionClosing.total_cash || 0))}
                    {calculateCorrectionCashTotal() - (correctionClosing.total_cash || 0) === 0 && " ✓"}
                  </span>
                </div>
              </div>

              {/* Notas */}
              <div className="space-y-2">
                <Label htmlFor="correction-notes">Notas de la corrección</Label>
                <textarea
                  id="correction-notes"
                  value={correctionNotes}
                  onChange={(e) => setCorrectionNotes(e.target.value)}
                  placeholder="Explica la corrección realizada..."
                  className="w-full h-20 px-3 py-2 border rounded-md bg-background resize-none text-sm"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCorrectionModal(false);
                setCorrectionClosing(null);
              }}
              disabled={savingCorrection}
            >
              Cancelar
            </Button>
            <Button
              onClick={saveCorrectionClosing}
              disabled={savingCorrection || calculateCorrectionCashTotal() === 0}
            >
              {savingCorrection ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Crear Corrección
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
