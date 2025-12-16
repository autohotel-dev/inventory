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
          sales_orders(id, total_amount, status)
        `)
        .gte("created_at", session.clock_in_at)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Calcular totales
      let total_cash = 0;
      let total_card_bbva = 0;
      let total_card_getnet = 0;

      (payments || []).forEach((payment) => {
        if (payment.payment_method === "EFECTIVO") {
          total_cash += payment.amount;
        } else if (payment.payment_method === "TARJETA") {
          if (payment.payment_terminals?.code === "BBVA") {
            total_card_bbva += payment.amount;
          } else if (payment.payment_terminals?.code === "GETNET") {
            total_card_getnet += payment.amount;
          }
        }
      });

      setSummary({
        total_cash,
        total_card_bbva,
        total_card_getnet,
        total_sales: total_cash + total_card_bbva + total_card_getnet,
        total_transactions: payments?.length || 0,
        payments: payments || [],
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

            {/* Lista de transacciones */}
            {summary && summary.payments.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="p-3 bg-muted/50 border-b">
                  <h3 className="font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Transacciones del turno ({summary.payments.length})
                  </h3>
                </div>
                <div className="max-h-[200px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Hora</TableHead>
                        <TableHead>Método</TableHead>
                        <TableHead>Terminal</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summary.payments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell className="text-sm">
                            {new Date(payment.created_at).toLocaleTimeString("es-MX", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                payment.payment_method === "EFECTIVO"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {payment.payment_method === "EFECTIVO" ? "💵" : "💳"}{" "}
                              {payment.payment_method}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {payment.payment_terminals?.code || "-"}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(payment.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
  const [closings, setClosings] = useState<ShiftClosing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadClosings = async () => {
      const { data, error } = await supabase
        .from("shift_closings")
        .select("*, employees(*), shift_definitions(*)")
        .order("created_at", { ascending: false })
        .limit(50);

      if (!error) {
        setClosings(data || []);
      }
      setLoading(false);
    };

    loadClosings();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(amount);
  };

  const getStatusBadge = (status: ShiftClosing["status"]) => {
    const config = {
      pending: { label: "Pendiente", variant: "secondary" as const },
      approved: { label: "Aprobado", variant: "default" as const },
      rejected: { label: "Rechazado", variant: "destructive" as const },
      reviewed: { label: "Revisado", variant: "outline" as const },
    };
    const { label, variant } = config[status] || config.pending;
    return <Badge variant={variant}>{label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Empleado</TableHead>
            <TableHead>Turno</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Diferencia</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {closings.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                No hay cortes registrados
              </TableCell>
            </TableRow>
          ) : (
            closings.map((closing) => (
              <TableRow key={closing.id}>
                <TableCell>
                  {new Date(closing.period_start).toLocaleDateString("es-MX")}
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
                <TableCell className="text-right font-medium">
                  {formatCurrency(closing.total_sales)}
                </TableCell>
                <TableCell className="text-right">
                  <span
                    className={
                      closing.cash_difference === 0
                        ? "text-green-600"
                        : (closing.cash_difference || 0) > 0
                        ? "text-blue-600"
                        : "text-red-600"
                    }
                  >
                    {formatCurrency(closing.cash_difference || 0)}
                  </span>
                </TableCell>
                <TableCell>{getStatusBadge(closing.status)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
