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
} from "../types";
import { usePrintClosing } from "@/hooks/use-print-closing";
import { ShiftExpense, EXPENSE_TYPE_LABELS, EXPENSE_TYPE_ICONS } from "@/types/expenses";
import { printHTML } from "@/lib/utils/print-helper";
import { ShiftClosingProps, EnrichedPayment, PaymentSummary } from "./types";

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
          sales_orders(id, total, status),
          collected_by
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

      // Arrays para tracking de pagos problemáticos
      const unassigned_card_payments: EnrichedPayment[] = [];
      const unhandled_payment_methods: Array<{payment: EnrichedPayment, method: string}> = [];

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
            // Debug: Verificar si tiene collected_by
            console.log('🔍 SHIFT CLOSING DEBUG: Pago tarjeta sin terminal', {
              id: payment.id?.slice(0, 8),
              amount: payment.amount,
              terminal_code: payment.terminal_code,
              collected_by: payment.collected_by,
              payment_method: payment.payment_method
            });

            // Si tiene collected_by, no es "mal asignado", solo falta terminal
            if (payment.collected_by) {
              console.log('  ✅ Tiene collected_by, asignando a BBVA sin advertencia');
              total_card_bbva += payment.amount;
            } else {
              // Fallback: Si no tiene terminal NI collected_by, registrar advertencia
              console.log('  ❌ Sin collected_by, marcando como mal asignado');
              unassigned_card_payments.push(payment as EnrichedPayment);
              total_card_bbva += payment.amount;
            }
          }
        } else {
          // Log unhandled payment methods
          unhandled_payment_methods.push({
            payment: payment as EnrichedPayment,
            method: payment.payment_method
          });
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

      // Debug logging para pagos mal asignados
      console.log('=== DEBUG PAGOS MAL ASIGNADOS ===');
      console.log('Turno:', session.id);
      console.log('Total pagos procesados:', payments?.length || 0);

      if (unassigned_card_payments.length > 0) {
        console.log(`❌ PAGOS CON TARJETA SIN TERMINAL (${unassigned_card_payments.length}):`);
        unassigned_card_payments.forEach(p => {
          console.log(`  - ID: ${p.id}, Monto: $${p.amount}, Método: ${p.payment_method}, Terminal: ${p.terminal_code || 'NONE'}`);
        });
      }

      if (unhandled_payment_methods.length > 0) {
        console.log(`❌ MÉTODOS DE PAGO NO MANEJADOS (${unhandled_payment_methods.length}):`);
        unhandled_payment_methods.forEach(({payment, method}) => {
          console.log(`  - ID: ${payment.id}, Monto: $${payment.amount}, Método: ${method}`);
        });
      }

      console.log('=====================================');

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
        accrual_items,
        unassigned_card_payments,
        unhandled_payment_methods
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

              {/* PAYMENT ISSUES WARNING */}
              {summary && (summary.unassigned_card_payments.length > 0 || summary.unhandled_payment_methods.length > 0) && (
                <div className="col-span-full">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 dark:bg-amber-500/10 dark:border-amber-500/30">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 space-y-2">
                        <h4 className="font-semibold text-amber-800 dark:text-amber-400">Pagos con Problemas de Asignación</h4>

                        {summary.unassigned_card_payments.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-sm text-amber-700 dark:text-amber-300">
                              <strong>Tarjetas sin terminal asignado:</strong> {summary.unassigned_card_payments.length} pago(s)
                            </p>
                            <details className="text-xs text-amber-600 dark:text-amber-400">
                              <summary className="cursor-pointer hover:underline">Ver detalles</summary>
                              <div className="mt-2 space-y-1 pl-4 border-l-2 border-amber-300 dark:border-amber-600">
                                {summary.unassigned_card_payments.map(p => (
                                  <div key={p.id} className="flex justify-between">
                                    <span>ID: {p.id.slice(0, 8)}...</span>
                                    <span>${p.amount.toFixed(2)} - {p.payment_method}</span>
                                  </div>
                                ))}
                              </div>
                            </details>
                          </div>
                        )}

                        {summary.unhandled_payment_methods.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-sm text-amber-700 dark:text-amber-300">
                              <strong>Métodos de pago no reconocidos:</strong> {summary.unhandled_payment_methods.length} pago(s)
                            </p>
                            <details className="text-xs text-amber-600 dark:text-amber-400">
                              <summary className="cursor-pointer hover:underline">Ver detalles</summary>
                              <div className="mt-2 space-y-1 pl-4 border-l-2 border-amber-300 dark:border-amber-600">
                                {summary.unhandled_payment_methods.map(({payment, method}, idx) => (
                                  <div key={idx} className="flex justify-between">
                                    <span>ID: {payment.id.slice(0, 8)}...</span>
                                    <span>${payment.amount.toFixed(2)} - {method}</span>
                                  </div>
                                ))}
                              </div>
                            </details>
                          </div>
                        )}

                        <p className="text-xs text-amber-600 dark:text-amber-400 italic">
                          Estos pagos fueron asignados por defecto. Revisa la consola para más detalles.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

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
