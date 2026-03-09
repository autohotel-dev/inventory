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
  Printer,
  ArrowDownCircle,
  Filter,
  ShoppingBag,
} from "lucide-react";
import {
  Employee,
  ShiftDefinition,
  ShiftSession,
  ShiftClosing,
  SHIFT_COLORS,
  CashBreakdown,
} from "./types";
import { usePrintClosing } from "@/hooks/use-print-closing";
import { ShiftExpense, EXPENSE_TYPE_LABELS, EXPENSE_TYPE_ICONS } from "@/types/expenses";
import { printHTML } from "@/lib/utils/print-helper";


interface ShiftClosingProps {
  session: ShiftSession;
  onClose: () => void;
  onComplete: () => void;
}

// Define EnrichedPayment type based on the structure created in loadPaymentSummary
interface EnrichedPayment {
  id: string;
  created_at: string;
  amount: number;
  payment_method: string;
  terminal_code?: string;
  payment_terminals?: { code: string; name: string } | null;
  sales_order_id?: string;
  sales_orders?: { id: string; total: number; status: string } | null;
  reference?: string | null;
  concept?: string | null;
  itemsDescription: string | null;
  itemsCount: number;
  itemsRaw: Array<{ name: string; qty: number; unitPrice: number; total: number }> | null;
}

interface PaymentSummary {
  total_cash: number;
  total_card_bbva: number;
  total_card_getnet: number;
  total_sales: number;
  total_transactions: number;
  payments: EnrichedPayment[];
  salesOrders: any[];
  expenses?: ShiftExpense[];
  total_expenses?: number;
  total_accrual_sales: number;
  accrual_items: any[];
}

export function ShiftClosingModal({ session, onClose, onComplete }: ShiftClosingProps) {
  const supabase = createClient();
  const { success, error: showError } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);



  const [countedCash, setCountedCash] = useState(0);
  const [declaredBBVA, setDeclaredBBVA] = useState("");
  const [declaredGetnet, setDeclaredGetnet] = useState("");
  const [notes, setNotes] = useState("");
  const { printClosing, isPrinting: isPrintingClosing } = usePrintClosing();

  // Cargar resumen de pagos del turno
  const loadPaymentSummary = async () => {
    setLoading(true);
    try {
      // Calcular el fin del período (clock_out o ahora)
      const periodEnd = session.clock_out_at || new Date().toISOString();

      // Obtener pagos del período del turno
      // Filtrar por shift_session_id si existe, o por rango de tiempo si es NULL
      const { data: payments, error } = await supabase
        .from("payments")
        .select(`
          *,
          payment_terminals(code, name),
          sales_orders(id, total, status)
        `)
        .or(`shift_session_id.eq.${session.id},and(shift_session_id.is.null,created_at.gte.${session.clock_in_at},created_at.lte.${periodEnd})`)
        .in("status", ["PAGADO", "PENDIENTE"]) // Solo pagos válidos
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Obtener órdenes de venta vinculadas a los pagos del turno (no por rango de tiempo)
      // Esto asegura que renovaciones cobradas en este turno aparezcan correctamente
      const shiftSalesOrderIds = [...new Set(
        (payments || [])
          .filter((p: any) => p.sales_order_id)
          .map((p: any) => p.sales_order_id)
      )];

      let salesOrders: any[] = [];
      if (shiftSalesOrderIds.length > 0) {
        const { data: ordersData } = await supabase
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
          .in("id", shiftSalesOrderIds)
          .order("created_at", { ascending: false });

        salesOrders = ordersData || [];
      }

      // Calcular totales
      let total_cash = 0;
      let total_card_bbva = 0;
      let total_card_getnet = 0;

      (payments || []).forEach((payment: any) => {
        // Skip parent payments (multipago) to avoid double-counting
        if (payment.parent_payment_id) return;

        // Skip payments with PENDIENTE or MIXTO at leaf level
        if (payment.payment_method === "PENDIENTE" || payment.payment_method === "MIXTO") {
          console.warn(`Skipping payment ${payment.id} with method ${payment.payment_method}`);
          return;
        }

        // Validate amount is positive
        if (payment.amount < 0) {
          console.warn(`Negative payment amount detected: ${payment.id} = ${payment.amount}`);
          return;
        }

        if (payment.payment_method === "EFECTIVO") {
          total_cash += payment.amount;
        } else if (payment.payment_method === "TARJETA_BBVA") {
          total_card_bbva += payment.amount;
        } else if (payment.payment_method === "TARJETA_GETNET") {
          total_card_getnet += payment.amount;
        } else if (payment.payment_method === "TARJETA") {
          // Para pagos con método TARJETA, revisar terminal_code
          const terminalCode = payment.terminal_code || payment.payment_terminals?.code;
          if (terminalCode === "BBVA") {
            total_card_bbva += payment.amount;
          } else if (terminalCode === "GETNET") {
            total_card_getnet += payment.amount;
          } else {
            // Fallback: Si no tiene terminal, asignar a BBVA y registrar advertencia
            console.warn(`Payment ${payment.id} has TARJETA but no terminal_code, defaulting to BBVA`);
            total_card_bbva += payment.amount;
          }
        } else {
          // Log unhandled payment methods
          console.warn(`Unhandled payment method: ${payment.payment_method} for payment ${payment.id}`);
        }
      });

      // Enriquecer pagos con detalles de items
      // Optimized: Get all sales_order_ids first, then fetch all items in ONE query
      const salesOrderIds = (payments || [])
        .filter((p: any) => p.sales_order_id)
        .map((p: any) => p.sales_order_id);

      let allItems: any[] = [];
      if (salesOrderIds.length > 0) {
        const { data } = await supabase
          .from("sales_order_items")
          .select(`
            id, qty, unit_price, total, concept_type, is_paid, paid_at, sales_order_id,
            products(name, sku)
          `)
          .in("sales_order_id", salesOrderIds)
          .eq("is_paid", true)
          .not("paid_at", "is", null);

        allItems = data || [];
      }

      // Group items by sales_order_id
      const itemsBySalesOrder = allItems.reduce((acc: any, item: any) => {
        if (!acc[item.sales_order_id]) {
          acc[item.sales_order_id] = [];
        }
        acc[item.sales_order_id].push(item);
        return acc;
      }, {} as Record<string, any[]>);

      // Enrich payments with their items
      const enrichedPayments = (payments || []).map((payment: any) => {
        if (!payment.sales_order_id) {
          return {
            ...payment,
            itemsDescription: null,
            itemsCount: 0,
            itemsRaw: null
          };
        }

        const items = itemsBySalesOrder[payment.sales_order_id] || [];

        // Filter items paid around the same time (±5 minutes)
        const paymentTime = new Date(payment.created_at).getTime();
        const relatedItems = items.filter((item: any) => {
          if (!item.paid_at) return false;
          const itemPaidTime = new Date(item.paid_at).getTime();
          const diffMinutes = Math.abs(paymentTime - itemPaidTime) / 1000 / 60;
          return diffMinutes <= 5; // Items paid within 5 minutes
        });

        if (relatedItems.length === 0) {
          return {
            ...payment,
            itemsDescription: null,
            itemsCount: 0,
            itemsRaw: null
          };
        }

        // Create items description
        const conceptLabels: Record<string, string> = {
          ROOM_BASE: "Habitación",
          EXTRA_HOUR: "Hora Extra",
          EXTRA_PERSON: "Persona Extra",
          CONSUMPTION: "Consumo",
          PRODUCT: "Producto",
          RENEWAL: "Renovación",
          PROMO_4H: "Promo 4H",
        };

        const itemsRawData = relatedItems.map((item: any) => {
          const product = Array.isArray(item.products) ? item.products[0] : item.products;
          const name = product?.name || conceptLabels[item.concept_type || "PRODUCT"] || "Item";
          return {
            name,
            qty: item.qty,
            unitPrice: item.unit_price,
            total: item.qty * item.unit_price
          };
        });

        const itemDescriptions = itemsRawData.map((item: any) =>
          item.qty > 1 ? `${item.qty}x ${item.name}` : item.name
        );

        return {
          ...payment,
          itemsDescription: itemDescriptions.join(", "),
          itemsCount: relatedItems.length,
          itemsRaw: itemsRawData
        };
      });

      // Obtener gastos del turno
      const { data: expenses, error: expensesError } = await supabase
        .from("shift_expenses")
        .select("*")
        .eq("shift_session_id", session.id)
        .neq("status", "rejected")
        .order("created_at", { ascending: false });

      if (expensesError) {
        console.error("Error fetching expenses:", expensesError);
      }

      const totalExpenses = expenses?.reduce((sum: number, e: any) => sum + Number(e.amount), 0) || 0;
      const total_sales = total_cash + total_card_bbva + total_card_getnet;

      // Obtener ventas Devengadas (Accrual) - Todos los items creados en este rango de tiempo
      const { data: accrualItemsData } = await supabase
        .from("sales_order_items")
        .select(`
          *,
          products(name, sku),
          sales_orders(id, room_stays(rooms(number)))
        `)
        .gte("created_at", session.clock_in_at)
        .lte("created_at", periodEnd);

      const accrual_items = accrualItemsData || [];
      const total_accrual_sales = accrual_items.reduce((sum: number, item: any) => sum + (item.total || 0), 0);

      setSummary({
        total_cash,
        total_card_bbva,
        total_card_getnet,
        total_sales,
        total_transactions: enrichedPayments.length,
        payments: enrichedPayments,
        salesOrders: salesOrders || [],
        expenses: expenses || [],
        total_expenses: totalExpenses,
        total_accrual_sales,
        accrual_items
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]); // Solo recargar cuando cambia la sesión

  // No longer need denomination-based calculation
  // countedCash is now set directly from user input



  // Calcular efectivo esperado (ventas en efectivo - gastos)
  const expectedCash = summary ? summary.total_cash - (summary.total_expenses || 0) : 0;
  const cashDifference = summary ? countedCash - expectedCash : 0;

  // Calcular diferencias de tarjeta
  const bbvaAmount = parseFloat(declaredBBVA) || 0;
  const getnetAmount = parseFloat(declaredGetnet) || 0;

  const diffBBVA = summary ? bbvaAmount - summary.total_card_bbva : 0;
  const diffGetnet = summary ? getnetAmount - summary.total_card_getnet : 0;

  // Guardar corte
  const handleSaveClosing = async () => {
    if (!summary) return;

    // Validación: No permitir cortes sin transacciones
    if (summary.total_transactions === 0) {
      showError("Error", "No hay transacciones en este turno para crear un corte");
      return;
    }

    setSaving(true);
    try {
      // Validación: Verificar que no exista ya un corte para esta sesión
      const { data: existingClosing } = await supabase
        .from("shift_closings")
        .select("id")
        .eq("shift_session_id", session.id)
        .maybeSingle();

      if (existingClosing) {
        showError("Error", "Ya existe un corte registrado para este turno");
        setSaving(false);
        return;
      }

      // Crear registro de corte
      const { data: closing, error: closingError } = await supabase
        .from("shift_closings")
        .insert({
          shift_session_id: session.id,
          employee_id: session.employee_id,
          shift_definition_id: session.shift_definition_id,
          period_start: session.clock_in_at,
          period_end: session.clock_out_at || new Date().toISOString(),
          total_cash: summary.total_cash,
          total_card_bbva: summary.total_card_bbva,
          total_card_getnet: summary.total_card_getnet,
          total_sales: summary.total_sales,
          total_transactions: summary.total_transactions,
          total_expenses: summary.total_expenses || 0,
          expenses_count: summary.expenses?.length || 0,
          counted_cash: countedCash,
          cash_difference: cashDifference,

          // Declaraciones de tarjeta
          declared_card_bbva: bbvaAmount,
          declared_card_getnet: getnetAmount,
          card_difference_bbva: diffBBVA,
          card_difference_getnet: diffGetnet,



          cash_breakdown: null,
          notes: notes.trim() || null,
          status: "pending",
        })
        .select()
        .single();

      if (closingError) throw closingError;

      // Crear detalles del corte
      if (summary.payments.length > 0) {
        const details = summary.payments.map((payment: any) => ({
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

      // Cerrar sesión de turno (solo cambiar estado, clock_out_at ya está establecido)
      const { error: sessionError } = await supabase
        .from("shift_sessions")
        .update({
          status: "closed",
        })
        .eq("id", session.id);

      if (sessionError) throw sessionError;

      success("Corte completado", "El corte de caja se ha registrado correctamente");

      // Abrir ticket térmico para imprimir automáticamente (80mm)
      const reportUrl = `/reports/closing/thermal?shiftId=${closing.id}`;
      window.open(reportUrl, '_blank');

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

  // Imprimir ticket de corte
  const handlePrintClosing = async () => {
    if (!summary) return;

    try {
      const printData = {
        employeeName: `${session.employees?.first_name} ${session.employees?.last_name}`,
        shiftName: session.shift_definitions?.name || 'Turno',
        periodStart: session.clock_in_at,
        periodEnd: session.clock_out_at || new Date().toISOString(),
        totalCash: summary.total_cash,
        totalCardBBVA: summary.total_card_bbva,
        totalCardGetnet: summary.total_card_getnet,
        totalSales: summary.total_sales,
        totalTransactions: summary.total_transactions,
        countedCash,
        cashDifference,
        notes: notes.trim() || undefined,
        transactions: await Promise.all(summary.payments.map(async (payment: any) => {
          // Si el pago tiene sales_order_id, buscar items
          let items: any[] = [];
          if (payment.sales_order_id && payment.itemsCount && payment.itemsCount > 0) {
            const { data: orderItems } = await supabase
              .from("sales_order_items")
              .select(`
                id, qty, unit_price, total, concept_type, is_paid, paid_at,
                products(name, sku)
              `)
              .eq("sales_order_id", payment.sales_order_id)
              .eq("is_paid", true)
              .not("paid_at", "is", null);

            const paymentTime = new Date(payment.created_at).getTime();
            const relatedItems = (orderItems || []).filter((item: any) => {
              if (!item.paid_at) return false;
              const itemPaidTime = new Date(item.paid_at).getTime();
              const diffMinutes = Math.abs(paymentTime - itemPaidTime) / 1000 / 60;
              return diffMinutes <= 5;
            });

            const conceptLabels: Record<string, string> = {
              ROOM_BASE: "Habitación",
              EXTRA_HOUR: "Hora Extra",
              EXTRA_PERSON: "Persona Extra",
              CONSUMPTION: "Consumo",
              PRODUCT: "Producto",
            };

            items = relatedItems.map((item: any) => {
              const product = Array.isArray(item.products) ? item.products[0] : item.products;
              const name = product?.name || conceptLabels[item.concept_type || "PRODUCT"] || "Item";
              return {
                name,
                qty: item.qty,
                unitPrice: item.unit_price,
                total: item.qty * item.unit_price
              };
            });
          }

          return {
            time: new Date(payment.created_at).toLocaleTimeString('es-MX', {
              hour: '2-digit',
              minute: '2-digit'
            }),
            amount: payment.amount,
            paymentMethod: payment.payment_method || 'N/A',
            terminalCode: payment.payment_terminals?.code || payment.terminal_code,
            reference: payment.reference || undefined,
            concept: payment.itemsDescription || payment.concept || undefined,
            items: items.length > 0 ? items : undefined
          };
        }))
      };

      await printClosing(printData);
    } catch (error) {
      console.error('Error preparing print data:', error);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl w-full h-[90vh] flex flex-col p-0 overflow-hidden bg-muted/10">
        <DialogHeader className="px-6 py-4 border-b bg-background z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Receipt className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl">Corte de Caja</DialogTitle>
                <DialogDescription className="text-sm mt-0.5">
                  Turno de <span className="font-medium text-foreground">{session.employees?.first_name} {session.employees?.last_name}</span> • {session.shift_definitions?.name}
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
              <Clock className="h-3.5 w-3.5" />
              <span>Inicio: {new Date(session.clock_in_at).toLocaleString("es-MX", { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground text-sm">Cargando datos del turno...</p>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            <div className="h-full grid grid-cols-1 md:grid-cols-12">

              {/* LEFT PANEL: SYSTEM CONTEXT (35%) */}
              <div className="hidden md:flex md:col-span-4 lg:col-span-3 flex-col border-r bg-background/50 overflow-y-auto">
                <div className="p-6 space-y-6">

                  {/* Collected (Cash-basis) Card */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Cobranza Total</h3>
                      <Badge variant="outline" className="text-[10px] uppercase font-bold text-green-600 bg-green-500/5">Caja</Badge>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold tracking-tight">{formatCurrency(summary?.total_sales || 0)}</span>
                      <span className="text-sm text-muted-foreground">({summary?.total_transactions || 0} pagos)</span>
                    </div>
                  </div>

                  {/* Accrual (Sales-basis) Card */}
                  <div className="space-y-1 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Ventas del Turno</h3>
                      <Badge variant="outline" className="text-[10px] uppercase font-bold text-amber-600 bg-amber-500/5 border-amber-500/20">Registros</Badge>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold tracking-tight text-amber-700">{formatCurrency(summary?.total_accrual_sales || 0)}</span>
                      <span className="text-xs text-muted-foreground">({summary?.accrual_items?.length || 0} conceptos)</span>
                    </div>
                    <p className="text-[10px] text-amber-600/70 italic leading-tight mt-1">
                      Habitaciones y consumos ingresados en este turno.
                    </p>
                  </div>

                  {/* Payment Breakdown */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/5 border border-green-500/10">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
                          <DollarSign className="h-4 w-4 text-green-600" />
                        </div>
                        <span className="font-medium text-sm">Efectivo</span>
                      </div>
                      <span className="font-bold text-green-700">{formatCurrency(summary?.total_cash || 0)}</span>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                          <CreditCard className="h-4 w-4 text-blue-600" />
                        </div>
                        <span className="font-medium text-sm">BBVA</span>
                      </div>
                      <span className="font-bold text-blue-700">{formatCurrency(summary?.total_card_bbva || 0)}</span>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-red-500/10 flex items-center justify-center">
                          <CreditCard className="h-4 w-4 text-red-600" />
                        </div>
                        <span className="font-medium text-sm">GETNET</span>
                      </div>
                      <span className="font-bold text-red-700">{formatCurrency(summary?.total_card_getnet || 0)}</span>
                    </div>
                  </div>

                  {/* Expenses */}
                  <div className="space-y-3 pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Gastos ({summary?.expenses?.length || 0})</h3>
                      <span className="text-sm font-bold text-red-600">-{formatCurrency(summary?.total_expenses || 0)}</span>
                    </div>
                    {summary?.expenses && summary.expenses.length > 0 ? (
                      <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                        {summary.expenses.map((expense) => (
                          <div key={expense.id} className="text-xs flex justify-between p-2 rounded bg-muted/50">
                            <span className="truncate flex-1 pr-2">{expense.description}</span>
                            <span className="font-medium text-red-500">-${expense.amount.toFixed(0)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No hay gastos registrados</p>
                    )}
                  </div>

                  {/* EXPECTED CASH HIGHLIGHT */}
                  <div className="mt-auto pt-6 border-t">
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center space-y-1">
                      <p className="text-xs font-semibold text-primary uppercase tracking-wider">Efectivo Esperado en Caja</p>
                      <p className="text-2xl font-black text-foreground">{formatCurrency(expectedCash)}</p>
                      <p className="text-[10px] text-muted-foreground">Ventas Efectivo - Gastos</p>
                    </div>
                  </div>

                </div>
              </div>

              {/* RIGHT PANEL: COUNTING AREA (65%) */}
              <div className="col-span-1 md:col-span-8 lg:col-span-9 overflow-y-auto bg-background p-6">
                <div className="max-w-4xl mx-auto space-y-8">

                  {/* CASH COUNTING - Simplified */}
                  <section className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="flex items-center gap-2 text-lg font-semibold">
                        <Calculator className="h-5 w-5 text-primary" />
                        Conteo de Efectivo
                      </h3>
                    </div>

                    <div className="border rounded-xl p-6 bg-muted/10 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Efectivo esperado según sistema</p>
                          <p className="text-xs text-muted-foreground">Ventas en efectivo menos gastos del turno</p>
                        </div>
                        <span className="text-2xl font-bold text-primary">{formatCurrency(expectedCash)}</span>
                      </div>

                      <div className="border-t pt-4">
                        <Label className="text-base font-semibold">¿Cuánto efectivo tienes en caja?</Label>
                        <p className="text-xs text-muted-foreground mb-2">Ingresa el total en efectivo que contaste</p>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={countedCash || ""}
                          onChange={(e) => setCountedCash(parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          className="text-right text-2xl font-mono h-14"
                        />
                      </div>

                      <div className={`flex justify-between items-center text-sm font-medium rounded-lg px-4 py-3 ${cashDifference === 0
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : Math.abs(cashDifference) <= 10
                          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                        <div className="flex items-center gap-2">
                          {cashDifference === 0 && <CheckCircle className="h-5 w-5" />}
                          {cashDifference !== 0 && <AlertTriangle className="h-5 w-5" />}
                          <span>
                            {cashDifference === 0 ? 'Cuadra perfecto' : cashDifference > 0 ? 'Sobrante' : 'Faltante'}
                          </span>
                        </div>
                        <span className="text-lg font-bold">
                          {cashDifference > 0 ? '+' : ''}{formatCurrency(cashDifference)}
                        </span>
                      </div>
                    </div>
                  </section>

                  {/* VOUCHER COUNTING */}
                  <section className="space-y-4 pt-4 border-t">
                    <h3 className="flex items-center gap-2 text-lg font-semibold">
                      <Receipt className="h-5 w-5 text-primary" />
                      Declaración de Vouchers
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* BBVA Card */}
                      <div className="border rounded-xl p-4 space-y-4 bg-muted/10 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 opacity-10">
                          <CreditCard className="h-24 w-24" />
                        </div>
                        <div className="relative">
                          <div className="flex justify-between items-center mb-2">
                            <Label className="text-base font-semibold">BBVA</Label>
                            <Badge variant="outline" className="bg-background">Sistema: {formatCurrency(summary?.total_card_bbva || 0)}</Badge>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                              <span>Suma de vouchers físicos</span>
                            </div>
                            <Input
                              type="number"
                              value={declaredBBVA}
                              onChange={(e) => setDeclaredBBVA(e.target.value)}
                              placeholder="0.00"
                              className="text-right text-lg font-mono"
                            />
                          </div>
                          <div className={`mt-3 flex justify-between items-center text-sm font-medium rounded px-2 py-1 ${diffBBVA === 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                            <span>Diferencia</span>
                            <span>{diffBBVA > 0 ? '+' : ''}{formatCurrency(diffBBVA)}</span>
                          </div>
                        </div>
                      </div>

                      {/* GETNET Card */}
                      <div className="border rounded-xl p-4 space-y-4 bg-muted/10 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 opacity-10">
                          <CreditCard className="h-24 w-24" />
                        </div>
                        <div className="relative">
                          <div className="flex justify-between items-center mb-2">
                            <Label className="text-base font-semibold">GETNET</Label>
                            <Badge variant="outline" className="bg-background">Sistema: {formatCurrency(summary?.total_card_getnet || 0)}</Badge>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                              <span>Suma de vouchers físicos</span>
                            </div>
                            <Input
                              type="number"
                              value={declaredGetnet}
                              onChange={(e) => setDeclaredGetnet(e.target.value)}
                              placeholder="0.00"
                              className="text-right text-lg font-mono"
                            />
                          </div>
                          <div className={`mt-3 flex justify-between items-center text-sm font-medium rounded px-2 py-1 ${diffGetnet === 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                            <span>Diferencia</span>
                            <span>{diffGetnet > 0 ? '+' : ''}{formatCurrency(diffGetnet)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* DETALLE DE ITEMS REGISTRADOS (Accrual) */}
                  <section className="space-y-4 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <h3 className="flex items-center gap-2 text-lg font-semibold text-amber-700">
                        <ShoppingBag className="h-5 w-5" />
                        Ventas Registradas en el Turno
                      </h3>
                      <p className="text-sm text-muted-foreground">Lo que se ingresó al sistema</p>
                    </div>

                    <div className="border rounded-xl overflow-hidden bg-muted/5">
                      <Table>
                        <TableHeader className="bg-muted/30">
                          <TableRow>
                            <TableHead className="w-[100px]">Hora</TableHead>
                            <TableHead className="w-[80px]">Hab.</TableHead>
                            <TableHead>Concepto</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                            <TableHead className="w-[100px] text-center">Estado</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {summary?.accrual_items && summary.accrual_items.length > 0 ? (
                            summary.accrual_items.map((item: any) => {
                              const conceptLabels: Record<string, string> = {
                                ROOM_BASE: "Habitación",
                                EXTRA_HOUR: "Hora Extra",
                                EXTRA_PERSON: "Persona Extra",
                                CONSUMPTION: "Consumo",
                                PRODUCT: "Producto",
                                RENEWAL: "Renovación",
                                PROMO_4H: "Promo 4H",
                              };
                              const productName = item.products?.name || conceptLabels[item.concept_type] || "Item";
                              const roomNumber = item.sales_orders?.room_stays?.[0]?.rooms?.number || "-";

                              return (
                                <TableRow key={item.id} className="text-sm">
                                  <TableCell className="text-muted-foreground font-mono">
                                    {new Date(item.created_at).toLocaleTimeString("es-MX", { hour: '2-digit', minute: '2-digit' })}
                                  </TableCell>
                                  <TableCell className="font-medium">{roomNumber}</TableCell>
                                  <TableCell>
                                    <div className="flex flex-col">
                                      <span>{productName}</span>
                                      {item.qty > 1 && <span className="text-[10px] text-muted-foreground">{item.qty} x {formatCurrency(item.unit_price)}</span>}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right font-semibold">
                                    {formatCurrency(item.total)}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {item.is_paid ? (
                                      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px]">PAGADO</Badge>
                                    ) : (
                                      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">PENDIENTE</Badge>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          ) : (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground italic">
                                No se registraron consumos ni servicios en este turno.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </section>

                  {/* NOTES & FINAL RESULT highlight */}
                  <section className="bg-muted/30 rounded-xl p-6 border flex flex-col md:flex-row gap-6">
                    <div className="flex-1 space-y-2">
                      <Label>Observaciones (Opcional)</Label>
                      <Input
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Ej: Sobrante justificado por propinas..."
                        className="bg-background"
                      />
                    </div>
                  </section>

                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="mr-6 md:mr-0 p-4 border-t bg-background z-10 flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="outline" onClick={handlePrintClosing} disabled={loading || !summary}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir Pre-Corte
          </Button>
          <Button
            onClick={handleSaveClosing}
            disabled={saving || loading || !summary}
            className="bg-green-600 hover:bg-green-700 text-white min-w-[150px]"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Finalizar Turno
              </>
            )}
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
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionClosing, setCorrectionClosing] = useState<ShiftClosing | null>(null);
  const [correctionCountedCash, setCorrectionCountedCash] = useState(0);
  const [correctionDeclaredBBVA, setCorrectionDeclaredBBVA] = useState("");
  const [correctionDeclaredGetnet, setCorrectionDeclaredGetnet] = useState("");
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
    // Primero obtener el conteo total
    let countQuery = supabase
      .from("shift_closings")
      .select("id", { count: 'exact', head: true });

    // Si no es admin, filtrar por su employee_id
    if (!userIsAdmin && employeeId) {
      countQuery = countQuery.eq("employee_id", employeeId);
    }

    // Filtrar por estado si no es "all"
    if (statusFilter !== "all") {
      countQuery = countQuery.eq("status", statusFilter);
    }

    const { count } = await countQuery;
    setTotalCount(count || 0);

    // Calcular offset para paginación
    const offset = (currentPage - 1) * pageSize;

    let query = supabase
      .from("shift_closings")
      .select("*, employees!shift_closings_employee_id_fkey(*), shift_definitions(*)")
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    // Si no es admin, filtrar por su employee_id
    if (!userIsAdmin && employeeId) {
      query = query.eq("employee_id", employeeId);
    }

    // Ya no necesitamos filtrar aquí porque lo hicimos en countQuery
    // Aplicar los mismos filtros a la query principal

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, currentPage, pageSize]); // Recargar cuando cambia filtro, página o tamaño

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
          terminal_code, created_at, sales_order_id,
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

    // Obtener órdenes de venta vinculadas a los pagos del corte (no por rango de tiempo)
    // Esto asegura que renovaciones cobradas en esta sesión aparezcan correctamente
    const detailSalesOrderIds = [...new Set(
      (data || [])
        .filter((d: any) => d.sales_order_id)
        .map((d: any) => d.sales_order_id)
    )];

    let salesOrders: any[] = [];
    if (detailSalesOrderIds.length > 0) {
      const { data: ordersData } = await supabase
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
        .in("id", detailSalesOrderIds)
        .order("created_at", { ascending: false });

      salesOrders = ordersData || [];
    }

    setClosingSalesOrders(salesOrders);
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

    try {
      // Actualizar estado del corte
      const { error } = await supabase
        .from("shift_closings")
        .update({
          status: "approved",
          reviewed_by: currentEmployeeId,
          reviewed_at: new Date().toISOString()
        })
        .eq("id", closingId);

      if (error) throw error;

      // Registrar en historial de revisiones
      await recordReview(closingId, "approved");

      // Recargar datos antes de cerrar modal
      await loadClosings();

      success("Corte aprobado", "El corte ha sido aprobado exitosamente");
      setSelectedClosing(null);
    } catch (err) {
      console.error("Error approving closing:", err);
      showError("Error", "No se pudo aprobar el corte");
    } finally {
      setProcessingAction(false);
    }
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

    try {
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

      if (error) throw error;

      // Registrar en historial de revisiones
      await recordReview(selectedClosing.id, "rejected", rejectionReason.trim());

      // Recargar datos antes de cerrar modal
      await loadClosings();

      success("Corte rechazado", "El corte ha sido marcado como rechazado");
      setShowRejectModal(false);
      setSelectedClosing(null);
    } catch (err) {
      console.error("Error rejecting closing:", err);
      showError("Error", "No se pudo rechazar el corte");
    } finally {
      setProcessingAction(false);
    }
  };

  // Abrir modal de corrección
  const openCorrectionModal = (closing: ShiftClosing) => {
    setCorrectionClosing(closing);
    setCorrectionCountedCash(closing.counted_cash || 0);
    setCorrectionDeclaredBBVA("");
    setCorrectionDeclaredGetnet("");
    setCorrectionNotes(`Corrección del corte del ${new Date(closing.period_start).toLocaleDateString("es-MX")}`);
    setShowCorrectionModal(true);
    setSelectedClosing(null); // Cerrar el modal de detalle
  };

  // Calcular total del arqueo de corrección
  const calculateCorrectionCashTotal = () => {
    return correctionCountedCash;
  };

  // Guardar corte corregido
  const saveCorrectionClosing = async () => {
    if (!correctionClosing || !currentEmployeeId) return;

    setSavingCorrection(true);
    try {
      // Update existing closing


      const correctionCashTotal = calculateCorrectionCashTotal();
      const expectedCash = correctionClosing.total_cash || 0;
      const cashDifference = correctionCashTotal - expectedCash;

      // Calcular diferencias de tarjeta
      const bbvaAmount = parseFloat(correctionDeclaredBBVA) || 0;
      const getnetAmount = parseFloat(correctionDeclaredGetnet) || 0;

      const diffBBVA = bbvaAmount - (correctionClosing.total_card_bbva || 0);
      const diffGetnet = getnetAmount - (correctionClosing.total_card_getnet || 0);

      // Crear el corte corregido
      // Actualizar el corte existente en lugar de crear uno nuevo
      const { data: newClosing, error } = await supabase
        .from("shift_closings")
        .update({
          // Campos actualizables
          counted_cash: correctionCashTotal,
          cash_difference: cashDifference,
          cash_breakdown: null,
          notes: correctionNotes.trim() || null,

          // Campos de tarjeta
          declared_card_bbva: bbvaAmount,
          declared_card_getnet: getnetAmount,
          card_difference_bbva: diffBBVA,
          card_difference_getnet: diffGetnet,

          // Resetear estado para nueva revisión
          status: "pending",
          rejection_reason: null, // Limpiar razón de rechazo anterior
          reviewed_by: null,
          reviewed_at: null,

          // Metadata de corrección
          is_correction: true, // Marcar como corregido si no lo estaba
        })
        .eq("id", correctionClosing.id) // Actualizar EL MISMO ID
        .select()
        .single();

      if (error) throw error;

      // Copiar los detalles del corte original al nuevo
      // No necesitamos copiar detalles porque estamos actualizando el mismo registro
      // y los detalles (pagos) siguen siendo válidos para este corte.

      success("Corrección enviada", "El corte ha sido actualizado y enviado para revisión");
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

  // Exportar corte a PDF/Imprimir (Silent Print)
  const exportClosing = async (closing: ShiftClosing) => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Corte de Caja - ${new Date(closing.period_start).toLocaleDateString("es-MX")}</title>
        <style>
            @page {
                size: 80mm auto;
                margin: 0;
            }
            body { 
                font-family: system-ui, -apple-system, sans-serif; 
                font-size: 12px; 
                margin: 0;
                padding: 10px 0;
                width: 80mm;
                max-width: 100%;
                color: #000;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .large { font-size: 16px; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .line { display: flex; justify-content: space-between; margin: 2px 0; }
            .separator { 
                border-top: 2px solid #000; 
                border-bottom: 2px solid #000;
                text-align: center;
                padding: 4px 0;
                margin: 8px 0;
            }
            .section-title { font-weight: bold; margin-top: 10px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="center bold large">CORTE DE CAJA</div>
        <div class="center bold">${closing.shift_definitions?.name || "Turno"}</div>
        <div class="separator">================================</div>

        <div class="line">
          <span>Empleado:</span>
          <span class="bold">${closing.employees?.first_name} ${closing.employees?.last_name}</span>
        </div>
        <div class="line">
          <span>Inicio:</span>
          <span>${new Date(closing.period_start).toLocaleTimeString("es-MX", { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div class="line">
          <span>Fin:</span>
          <span>${new Date(closing.period_end).toLocaleTimeString("es-MX", { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div class="line">
            <span>Fecha:</span>
            <span>${new Date(closing.period_start).toLocaleDateString("es-MX")}</span>
        </div>
        
        <div class="separator">================================</div>

        <div class="center bold">RESUMEN DE VENTAS</div>
        <div class="divider"></div>

        <div class="line">
          <span>Efectivo:</span>
          <span>$${(closing.total_cash || 0).toFixed(2)}</span>
        </div>
        <div class="line">
          <span>Tarjeta BBVA:</span>
          <span>$${(closing.total_card_bbva || 0).toFixed(2)}</span>
        </div>
        <div class="line">
          <span>Tarjeta Getnet:</span>
          <span>$${(closing.total_card_getnet || 0).toFixed(2)}</span>
        </div>

        <div class="separator">================================</div>
        
        <div class="line large bold">
          <span>TOTAL:</span>
          <span>$${(closing.total_sales || 0).toFixed(2)}</span>
        </div>
        
        <div class="separator">================================</div>

        <div class="center bold">ARQUEO DE CAJA</div>
        <div class="divider"></div>



        <div class="line">
          <span>Esperado:</span>
          <span>$${(closing.total_cash || 0).toFixed(2)}</span>
        </div>
        <div class="line">
          <span>Contado:</span>
          <span>$${(closing.counted_cash || 0).toFixed(2)}</span>
        </div>
        
         <div class="line bold" style="margin-top: 5px;">
          <span>DIFERENCIA:</span>
          <span>${(closing.cash_difference || 0) >= 0 ? '+' : ''}${(closing.cash_difference || 0).toFixed(2)}</span>
        </div>

        <div class="separator">================================</div>

        <div class="center bold">
        ${closing.cash_difference === 0
        ? '✓ CAJA CUADRADA'
        : (closing.cash_difference || 0) > 0
          ? 'SOBRANTE'
          : 'FALTANTE'
      }
        </div>

        <div class="separator">================================</div>

        ${closing.notes ? `
          <div class="center bold">NOTAS</div>
          <div style="margin: 5px 0;">${closing.notes}</div>
          <div class="separator">================================</div>
        ` : ''}

        <div class="center" style="margin-top: 15px;">
          <div style="font-size: 10px;">ID: ${closing.id.slice(0, 8).toUpperCase()}</div>
          <div style="font-size: 10px;">${new Date().toLocaleString("es-MX")}</div>
        </div>
      </body>
      </html>
    `;

    try {
      const printResult = await printHTML(html);
      if (printResult) {
        success("Impresión iniciada", "Ticket enviado a imprimir");
      }
    } catch (err) {
      console.error("Error al imprimir:", err);
      showError("Error", "No se pudo iniciar la impresión");
    }
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
                Haz clic en &quot;Ver&quot; para ver los detalles de cada corte rechazado.
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

      {/* Filtros con diseño premium */}
      <div className="flex items-center gap-4 flex-wrap justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Estado */}
          <div className={`relative p-3 rounded-xl border transition-all duration-300 ${statusFilter !== 'all' ? 'bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/30 shadow-lg shadow-blue-500/5' : 'bg-muted/30 border-border/50 hover:border-blue-500/30 hover:bg-blue-500/5'}`}>
            <label className="flex items-center gap-2 text-xs font-medium mb-2">
              <div className={`p-1 rounded-md ${statusFilter !== 'all' ? 'bg-blue-500 text-white' : 'bg-blue-500/10 text-blue-500'}`}>
                <Filter className="h-3 w-3" />
              </div>
              <span className={statusFilter !== 'all' ? 'text-blue-400' : 'text-muted-foreground'}>Estado</span>
            </label>
            <div className="relative group">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-3 pr-8 py-2 border-0 rounded-lg bg-background/90 backdrop-blur-sm text-sm font-medium appearance-none cursor-pointer transition-all duration-200 focus:ring-2 focus:ring-blue-500/30 focus:outline-none hover:bg-background shadow-sm min-w-[130px]"
              >
                <option value="all">✨ Todos</option>
                <option value="pending">⏳ Pendientes</option>
                <option value="approved">✅ Aprobados</option>
                <option value="rejected">❌ Rechazados</option>
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                <ArrowDownCircle className={`h-3.5 w-3.5 ${statusFilter !== 'all' ? 'text-blue-500' : 'text-muted-foreground'}`} />
              </div>
            </div>
          </div>

          {/* Mostrar */}
          <div className={`relative p-3 rounded-xl border transition-all duration-300 bg-muted/30 border-border/50 hover:border-purple-500/30 hover:bg-purple-500/5`}>
            <label className="flex items-center gap-2 text-xs font-medium mb-2">
              <div className={`p-1 rounded-md bg-purple-500/10 text-purple-500`}>
                <Receipt className="h-3 w-3" />
              </div>
              <span className="text-muted-foreground">Mostrar</span>
            </label>
            <div className="relative group">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="pl-3 pr-8 py-2 border-0 rounded-lg bg-background/90 backdrop-blur-sm text-sm font-medium appearance-none cursor-pointer transition-all duration-200 focus:ring-2 focus:ring-purple-500/30 focus:outline-none hover:bg-background shadow-sm min-w-[80px]"
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                <ArrowDownCircle className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-xs">
            {totalCount} corte(s) total
          </Badge>
          {totalCount > 0 && (
            <span className="text-xs text-muted-foreground">
              Página {currentPage} de {Math.ceil(totalCount / pageSize)}
            </span>
          )}
        </div>
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
                      className={`${SHIFT_COLORS[closing.shift_definitions?.code || ""] || "bg-gray-500"
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
                      className={`font-medium ${closing.cash_difference === 0
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

      {/* Controles de paginación */}
      {totalCount > pageSize && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-muted-foreground">
            Mostrando {Math.min((currentPage - 1) * pageSize + 1, totalCount)} - {Math.min(currentPage * pageSize, totalCount)} de {totalCount}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              Primera
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Anterior
            </Button>
            <span className="text-sm px-3">
              Página {currentPage} de {Math.ceil(totalCount / pageSize)}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalCount / pageSize), prev + 1))}
              disabled={currentPage >= Math.ceil(totalCount / pageSize)}
            >
              Siguiente
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.ceil(totalCount / pageSize))}
              disabled={currentPage >= Math.ceil(totalCount / pageSize)}
            >
              Última
            </Button>
          </div>
        </div>
      )}

      {/* Modal de detalle */}
      <Dialog open={!!selectedClosing} onOpenChange={() => setSelectedClosing(null)}>
        <DialogContent className="max-w-[90%] max-h-[90vh] overflow-y-auto">
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
              <div className={`p-4 rounded-lg border ${selectedClosing.cash_difference === 0
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
                    <p className={`text-2xl font-bold ${selectedClosing.cash_difference === 0
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
                                        <span className={`ml-2 ${salesOrder.status === "COMPLETED" || salesOrder.status === "ENDED"
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
                                <p className={`text-xs ${payment?.status === "PAGADO" ? "text-green-500" : "text-amber-500"
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
                                          className={`text-[10px] px-1.5 ${conceptType === "ROOM_BASE" ? "bg-blue-500/10 text-blue-400 border-blue-500/30" :
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
                      <p className="text-sm">{selectedClosing.rejection_reason || "No se especificó motivo"}</p>

                      {/* Verificar si ya existe una corrección */}
                      {!selectedClosing.is_correction && selectedClosing.employee_id === currentEmployeeId && (
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

                      {selectedClosing.has_correction && (
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
        <DialogContent className="max-w-[90%] w-full h-[90vh] flex flex-col p-0 overflow-hidden bg-background">
          <DialogHeader className="px-6 py-4 border-b bg-background z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <DialogTitle className="text-xl">Corregir Corte de Caja</DialogTitle>
                  <DialogDescription className="text-sm mt-0.5">
                    Realiza un nuevo arqueo para el corte RECHAZADO del {correctionClosing && new Date(correctionClosing.period_start).toLocaleDateString("es-MX")}
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>

          {correctionClosing && (
            <div className="flex-1 overflow-hidden">
              <div className="h-full grid grid-cols-1 md:grid-cols-12">

                {/* LEFT PANEL: CONTEXT (35%) - Same as ShiftClosingModal */}
                <div className="hidden md:flex md:col-span-4 lg:col-span-3 flex-col border-r bg-muted/30 overflow-y-auto">
                  <div className="p-6 space-y-6">

                    {/* Info Original (Rejection Reason) */}
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 space-y-2">
                      <h4 className="text-sm font-bold text-amber-700 uppercase tracking-wider flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Corte Rechazado
                      </h4>
                      {correctionClosing.rejection_reason && (
                        <p className="text-xs text-amber-800 italic">
                          &quot; {correctionClosing.rejection_reason} &quot;
                        </p>
                      )}
                    </div>

                    {/* Sales Summary (Equivalent to Total Sales) */}
                    <div className="space-y-1">
                      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Ventas Registradas</h3>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold tracking-tight">{formatCurrency(correctionClosing.total_sales || 0)}</span>
                        <span className="text-sm text-muted-foreground">({correctionClosing.total_transactions || 0} ops)</span>
                      </div>
                    </div>

                    {/* Payment Breakdown (Read Only) */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/5 border border-green-500/10">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
                            <DollarSign className="h-4 w-4 text-green-600" />
                          </div>
                          <span className="font-medium text-sm">Efectivo</span>
                        </div>
                        <span className="font-bold text-green-700">{formatCurrency(correctionClosing.total_cash || 0)}</span>
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                            <CreditCard className="h-4 w-4 text-blue-600" />
                          </div>
                          <span className="font-medium text-sm">BBVA</span>
                        </div>
                        <span className="font-bold text-blue-700">{formatCurrency(correctionClosing.total_card_bbva || 0)}</span>
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-red-500/10 flex items-center justify-center">
                            <CreditCard className="h-4 w-4 text-red-600" />
                          </div>
                          <span className="font-medium text-sm">GETNET</span>
                        </div>
                        <span className="font-bold text-red-700">{formatCurrency(correctionClosing.total_card_getnet || 0)}</span>
                      </div>
                    </div>

                    {/* Expenses (Read Only Context) */}
                    <div className="space-y-3 pt-2 border-t">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Gastos</h3>
                        <span className="text-sm font-bold text-red-600">-{formatCurrency(correctionClosing.total_expenses || 0)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground italic">Gastos registrados en el turno original</p>
                    </div>

                    {/* EXPECTED CASH HIGHLIGHT */}
                    <div className="mt-auto pt-6 border-t">
                      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center space-y-1">
                        <p className="text-xs font-semibold text-primary uppercase tracking-wider">Efectivo Esperado en Caja</p>
                        <p className="text-2xl font-black text-foreground">{formatCurrency(correctionClosing.total_cash || 0)}</p>
                        <p className="text-[10px] text-muted-foreground">Ventas Efectivo - Gastos</p>
                      </div>
                    </div>

                  </div>
                </div>

                {/* RIGHT PANEL: COUNTING (65%) - Same as ShiftClosingModal */}
                <div className="col-span-1 md:col-span-8 lg:col-span-9 overflow-y-auto bg-background p-6">
                  <div className="max-w-4xl mx-auto space-y-8">

                    {/* CASH COUNTING - Simplified for Correction */}
                    <section className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="flex items-center gap-2 text-lg font-semibold">
                          <Calculator className="h-5 w-5 text-primary" />
                          Nuevo Conteo de Efectivo
                        </h3>
                      </div>

                      <div className="border rounded-xl p-6 bg-muted/10 space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">Efectivo esperado</p>
                          </div>
                          <span className="text-xl font-bold">{formatCurrency(correctionClosing.total_cash || 0)}</span>
                        </div>

                        <div className="border-t pt-4">
                          <Label className="text-base font-semibold">Nuevo total en efectivo</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={correctionCountedCash || ""}
                            onChange={(e) => setCorrectionCountedCash(parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                            className="text-right text-2xl font-mono h-14"
                          />
                        </div>
                      </div>
                    </section>

                    {/* VOUCHER COUNTING */}
                    <section className="space-y-4 pt-6 border-t">
                      <h3 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground/80">
                        <Receipt className="h-5 w-5 text-primary" />
                        Declaración de Vouchers
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* BBVA Card */}
                        <div className="group bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-950/10 border rounded-2xl shadow-sm hover:shadow-md transition-all duration-300">
                          <div className="p-5 space-y-5">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-blue-600 shadow-lg shadow-blue-600/20 flex items-center justify-center text-white">
                                  <CreditCard className="h-5 w-5" />
                                </div>
                                <div>
                                  <span className="block font-bold text-base text-foreground">BBVA</span>
                                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Terminal</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] text-muted-foreground uppercase block mb-0.5">Sistema</span>
                                <Badge variant="outline" className="font-mono text-sm bg-background/50 backdrop-blur-sm border-blue-200 dark:border-blue-900">
                                  {formatCurrency(correctionClosing.total_card_bbva || 0)}
                                </Badge>
                              </div>
                            </div>

                            <div className="bg-background/60 dark:bg-black/20 rounded-xl p-1.5 border border-border/50">
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">Físico:</span>
                                <Input
                                  type="number"
                                  value={correctionDeclaredBBVA}
                                  onChange={(e) => setCorrectionDeclaredBBVA(e.target.value)}
                                  placeholder="0.00"
                                  className="border-0 bg-transparent text-right text-lg font-mono font-bold h-10 focus-visible:ring-0 px-3 pl-16 shadow-none"
                                />
                              </div>
                            </div>
                          </div>
                          <div className={`px-5 py-3 flex justify-between items-center text-sm font-medium border-t border-border/50 ${(parseFloat(correctionDeclaredBBVA) || 0) - (correctionClosing.total_card_bbva || 0) === 0 ? 'bg-green-100/30 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-100/30 text-red-700 dark:bg-red-900/20 dark:text-red-400'}`}>
                            <span className="flex items-center gap-2">
                              {(parseFloat(correctionDeclaredBBVA) || 0) - (correctionClosing.total_card_bbva || 0) === 0 ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                              Diferencia
                            </span>
                            <span className="font-mono font-bold tracking-tight text-base">
                              {(parseFloat(correctionDeclaredBBVA) || 0) - (correctionClosing.total_card_bbva || 0) > 0 ? '+' : ''}
                              {formatCurrency((parseFloat(correctionDeclaredBBVA) || 0) - (correctionClosing.total_card_bbva || 0))}
                            </span>
                          </div>
                        </div>

                        {/* GETNET Card */}
                        <div className="group bg-gradient-to-br from-red-50/50 to-transparent dark:from-red-950/10 border rounded-2xl shadow-sm hover:shadow-md transition-all duration-300">
                          <div className="p-5 space-y-5">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-red-600 shadow-lg shadow-red-600/20 flex items-center justify-center text-white">
                                  <CreditCard className="h-5 w-5" />
                                </div>
                                <div>
                                  <span className="block font-bold text-base text-foreground">GETNET</span>
                                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Terminal</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] text-muted-foreground uppercase block mb-0.5">Sistema</span>
                                <Badge variant="outline" className="font-mono text-sm bg-background/50 backdrop-blur-sm border-red-200 dark:border-red-900">
                                  {formatCurrency(correctionClosing.total_card_getnet || 0)}
                                </Badge>
                              </div>
                            </div>

                            <div className="bg-background/60 dark:bg-black/20 rounded-xl p-1.5 border border-border/50">
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">Físico:</span>
                                <Input
                                  type="number"
                                  value={correctionDeclaredGetnet}
                                  onChange={(e) => setCorrectionDeclaredGetnet(e.target.value)}
                                  placeholder="0.00"
                                  className="border-0 bg-transparent text-right text-lg font-mono font-bold h-10 focus-visible:ring-0 px-3 pl-16 shadow-none"
                                />
                              </div>
                            </div>
                          </div>
                          <div className={`px-5 py-3 flex justify-between items-center text-sm font-medium border-t border-border/50 ${(parseFloat(correctionDeclaredGetnet) || 0) - (correctionClosing.total_card_getnet || 0) === 0 ? 'bg-green-100/30 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-100/30 text-red-700 dark:bg-red-900/20 dark:text-red-400'}`}>
                            <span className="flex items-center gap-2">
                              {(parseFloat(correctionDeclaredGetnet) || 0) - (correctionClosing.total_card_getnet || 0) === 0 ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                              Diferencia
                            </span>
                            <span className="font-mono font-bold tracking-tight text-base">
                              {(parseFloat(correctionDeclaredGetnet) || 0) - (correctionClosing.total_card_getnet || 0) > 0 ? '+' : ''}
                              {formatCurrency((parseFloat(correctionDeclaredGetnet) || 0) - (correctionClosing.total_card_getnet || 0))}
                            </span>
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* NOTES & FINAL RESULT highlight */}
                    <section className="bg-muted/30 rounded-2xl p-6 border flex flex-col lg:flex-row gap-8 items-stretch pt-8 mt-6">
                      <div className="flex-1 space-y-3">
                        <Label className="text-base font-semibold flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          Observaciones
                        </Label>
                        <textarea
                          value={correctionNotes}
                          onChange={(e) => setCorrectionNotes(e.target.value)}
                          placeholder="Describe brevemente la causa de la corrección..."
                          className="w-full bg-background border rounded-xl p-4 text-sm shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none h-[120px]"
                        />
                        <p className="text-xs text-muted-foreground ml-1">
                          * Esta nota quedará registrada permanentemente en el historial.
                        </p>
                      </div>

                      <div className="flex flex-col gap-4">
                        {/* Global Difference Card (Reference) */}
                        <div className="min-w-[320px] rounded-xl border bg-muted/20 p-4 flex items-center justify-between gap-4">
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Diferencia Global</Label>
                            <p className="text-[10px] text-muted-foreground">(Efectivo + Tarjetas)</p>
                          </div>
                          <div className={`text-xl font-bold font-mono tracking-tight ${(calculateCorrectionCashTotal() - (correctionClosing.total_cash || 0) + ((parseFloat(correctionDeclaredBBVA) || 0) - (correctionClosing.total_card_bbva || 0)) + ((parseFloat(correctionDeclaredGetnet) || 0) - (correctionClosing.total_card_getnet || 0))) === 0 ? 'text-green-600' : (calculateCorrectionCashTotal() - (correctionClosing.total_cash || 0) + ((parseFloat(correctionDeclaredBBVA) || 0) - (correctionClosing.total_card_bbva || 0)) + ((parseFloat(correctionDeclaredGetnet) || 0) - (correctionClosing.total_card_getnet || 0))) > 0 ? 'text-blue-600' : 'text-red-500'}`}>
                            {(calculateCorrectionCashTotal() - (correctionClosing.total_cash || 0) + ((parseFloat(correctionDeclaredBBVA) || 0) - (correctionClosing.total_card_bbva || 0)) + ((parseFloat(correctionDeclaredGetnet) || 0) - (correctionClosing.total_card_getnet || 0))) > 0 ? '+' : ''}
                            {formatCurrency(calculateCorrectionCashTotal() - (correctionClosing.total_cash || 0) + ((parseFloat(correctionDeclaredBBVA) || 0) - (correctionClosing.total_card_bbva || 0)) + ((parseFloat(correctionDeclaredGetnet) || 0) - (correctionClosing.total_card_getnet || 0)))}
                          </div>
                        </div>

                        {/* Cash Result Card (Main) */}
                        <div className={`min-w-[320px] rounded-2xl p-1 shadow-lg bg-gradient-to-br ${(calculateCorrectionCashTotal() - (correctionClosing.total_cash || 0)) === 0 ? 'from-green-500 to-emerald-700' : 'from-red-500 to-rose-700'}`}>
                          <div className="h-full bg-white dark:bg-slate-950 rounded-xl p-6 flex flex-col justify-center items-center relative overflow-hidden">
                            {/* Background Glow */}
                            <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${(calculateCorrectionCashTotal() - (correctionClosing.total_cash || 0)) === 0 ? 'from-green-400 to-emerald-500' : 'from-red-400 to-rose-500'}`}></div>

                            <Label className="text-xs text-muted-foreground uppercase tracking-widest text-center mb-4 font-bold">Resultado Final (Efectivo)</Label>

                            <div className={`text-5xl font-black text-center mb-2 tracking-tighter ${(calculateCorrectionCashTotal() - (correctionClosing.total_cash || 0)) === 0 ? 'text-green-600 dark:text-green-400' : (calculateCorrectionCashTotal() - (correctionClosing.total_cash || 0)) > 0 ? 'text-blue-600' : 'text-red-600 dark:text-red-500'}`}>
                              {formatCurrency(calculateCorrectionCashTotal() - (correctionClosing.total_cash || 0))}
                            </div>

                            <div className={`mt-2 px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-2 ${(calculateCorrectionCashTotal() - (correctionClosing.total_cash || 0)) === 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                              {(calculateCorrectionCashTotal() - (correctionClosing.total_cash || 0)) === 0 ? (
                                <>
                                  <CheckCircle className="h-4 w-4" />
                                  <span>CORTE PERFECTO</span>
                                </>
                              ) : (
                                <>
                                  <AlertTriangle className="h-4 w-4" />
                                  <span>{(calculateCorrectionCashTotal() - (correctionClosing.total_cash || 0)) > 0 ? 'SOBRANTE' : 'FALTANTE'}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </section>

                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="p-4 border-t bg-background z-10 flex gap-2 justify-end">
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
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {savingCorrection ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Confirmar Corrección
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
