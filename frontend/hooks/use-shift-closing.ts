/**
 * Hook for shift closing: loads payment summary, saves closing, and prints reports.
 * Extracted from shift-closing.tsx (ShiftClosingModal).
 */
"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { toast } from "sonner";
import { ShiftSession } from "@/components/employees/types";
import { usePrintClosing } from "@/hooks/use-print-closing";
import { ShiftExpense } from "@/types/expenses";

// ─── Types ───────────────────────────────────────────────────────────

export interface EnrichedPayment {
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

export interface PaymentSummary {
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
  unassigned_card_payments: EnrichedPayment[];
  unhandled_payment_methods: Array<{payment: EnrichedPayment, method: string}>;
}

// ─── Helpers ─────────────────────────────────────────────────────────

export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount);

const CONCEPT_LABELS: Record<string, string> = {
  ROOM_BASE: "Habitación", EXTRA_HOUR: "Hora Extra", EXTRA_PERSON: "Persona Extra",
  CONSUMPTION: "Consumo", PRODUCT: "Producto", RENEWAL: "Renovación", PROMO_4H: "Promo 4H",
};

// ─── Hook ────────────────────────────────────────────────────────────

interface UseShiftClosingProps {
  session: ShiftSession;
  onComplete: () => void;
}

export function useShiftClosing({ session, onComplete }: UseShiftClosingProps) {
  const supabase = createClient();
  const { success, error: showError } = useToast();
  const { printClosing, isPrinting: isPrintingClosing } = usePrintClosing();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const savingLockRef = useRef(false);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [notes, setNotes] = useState("");
  const [showExpenses, setShowExpenses] = useState(false);

  // ─── Load Payment Summary ──────────────────────────────────────────

  const loadPaymentSummary = async () => {
    setLoading(true);
    try {
      const periodEnd = session.clock_out_at || new Date().toISOString();
      const employeeUuid = (session as any).employee_id || (session as any).employees?.id || (session as any).employeeId || "null";

      let { data: initialPayments, error } = await supabase
        .from("payments")
        .select("*, payment_terminals(code, name), sales_orders(id, total, status), collected_by")
        .or(`shift_session_id.eq.${session.id},shift_session_id.eq.${employeeUuid},and(collected_by.eq.${employeeUuid},created_at.gte.${session.clock_in_at},created_at.lte.${periodEnd}),and(shift_session_id.is.null,created_at.gte.${session.clock_in_at},created_at.lte.${periodEnd})`)
        .order("created_at", { ascending: false });
      if (error) throw error;

      let payments = initialPayments || [];
      let salesOrders: any[] = [];
      const shiftSalesOrderIds = [...new Set(payments.filter((p: any) => p.sales_order_id).map((p: any) => p.sales_order_id))];

      if (shiftSalesOrderIds.length > 0) {
        const { data: ordersData } = await supabase
          .from("sales_orders")
          .select("id, created_at, total, paid_amount, remaining_amount, status, currency, room_stays(id, rooms(number, room_types(name))), sales_order_items(id, qty, unit_price, total, concept_type, is_paid, paid_at, payment_method, products(name, sku))")
          .in("id", shiftSalesOrderIds).order("created_at", { ascending: false });
        salesOrders = ordersData || [];
      }

      let total_cash = 0, total_card_bbva = 0, total_card_getnet = 0;
      const unassigned_card_payments: EnrichedPayment[] = [];
      const unhandled_payment_methods: Array<{payment: EnrichedPayment, method: string}> = [];

      (payments || []).forEach((payment: any) => {
        if (payment.status === "PENDIENTE" || payment.payment_method === "PENDIENTE" || payment.payment_method === "MIXTO") return;
        if (payment.amount < 0) return;

        if (payment.payment_method === "EFECTIVO") total_cash += payment.amount;
        else if (payment.payment_method === "TARJETA_BBVA") total_card_bbva += payment.amount;
        else if (payment.payment_method === "TARJETA_GETNET") total_card_getnet += payment.amount;
        else if (payment.payment_method === "TARJETA") {
          const terminalCode = payment.terminal_code || payment.payment_terminals?.code;
          if (terminalCode === "BBVA") total_card_bbva += payment.amount;
          else if (terminalCode === "GETNET") total_card_getnet += payment.amount;
          else {
            if (payment.collected_by) total_card_bbva += payment.amount;
            else { unassigned_card_payments.push(payment as EnrichedPayment); total_card_bbva += payment.amount; }
          }
        } else {
          unhandled_payment_methods.push({ payment: payment as EnrichedPayment, method: payment.payment_method });
        }
      });

      // Enrich payments with items
      const salesOrderIds = (payments || []).filter((p: any) => p.sales_order_id).map((p: any) => p.sales_order_id);
      let allItems: any[] = [];
      if (salesOrderIds.length > 0) {
        const { data } = await supabase
          .from("sales_order_items")
          .select("id, qty, unit_price, total, concept_type, is_paid, paid_at, sales_order_id, products(name, sku)")
          .in("sales_order_id", salesOrderIds).eq("is_paid", true).not("paid_at", "is", null);
        allItems = data || [];
      }

      const itemsBySalesOrder = allItems.reduce((acc: any, item: any) => {
        if (!acc[item.sales_order_id]) acc[item.sales_order_id] = [];
        acc[item.sales_order_id].push(item);
        return acc;
      }, {} as Record<string, any[]>);

      const enrichedPayments = (payments || []).map((payment: any) => {
        if (!payment.sales_order_id) return { ...payment, itemsDescription: null, itemsCount: 0, itemsRaw: null };
        const items = itemsBySalesOrder[payment.sales_order_id] || [];
        const paymentTime = new Date(payment.created_at).getTime();
        const relatedItems = items.filter((item: any) => {
          if (!item.paid_at) return false;
          return Math.abs(paymentTime - new Date(item.paid_at).getTime()) / 1000 / 60 <= 5;
        });
        if (relatedItems.length === 0) return { ...payment, itemsDescription: null, itemsCount: 0, itemsRaw: null };
        const itemsRawData = relatedItems.map((item: any) => {
          const product = Array.isArray(item.products) ? item.products[0] : item.products;
          return { name: product?.name || CONCEPT_LABELS[item.concept_type || "PRODUCT"] || "Item", qty: item.qty, unitPrice: item.unit_price, total: item.qty * item.unit_price };
        });
        return { ...payment, itemsDescription: itemsRawData.map((i: any) => i.qty > 1 ? `${i.qty}x ${i.name}` : i.name).join(", "), itemsCount: relatedItems.length, itemsRaw: itemsRawData };
      });

      // Expenses
      const { data: expenses } = await supabase.from("shift_expenses").select("*")
        .eq("shift_session_id", session.id).neq("status", "rejected").order("created_at", { ascending: false });
      const totalExpenses = expenses?.reduce((sum: number, e: any) => sum + Number(e.amount), 0) || 0;
      const total_sales = total_cash + total_card_bbva + total_card_getnet;

      // Accrual
      const { data: accrualItemsData } = await supabase
        .from("sales_order_items").select("*, products(name, sku), sales_orders(id, room_stays(rooms(number)))")
        .eq("shift_session_id", session.id);
      const accrual_items = accrualItemsData || [];
      const total_accrual_sales = accrual_items.reduce((sum: number, item: any) => sum + (item.total || 0), 0);

      setSummary({
        total_cash, total_card_bbva, total_card_getnet, total_sales,
        total_transactions: enrichedPayments.length, payments: enrichedPayments,
        salesOrders: salesOrders || [], expenses: expenses || [], total_expenses: totalExpenses,
        total_accrual_sales, accrual_items, unassigned_card_payments, unhandled_payment_methods
      });
    } catch (err) {
      console.error("Error loading payment summary:", err);
      showError("Error", "No se pudo cargar el resumen de pagos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPaymentSummary(); }, [session.id]);

  // ─── Computed ─────────────────────────────────────────────────────

  const netCash = summary ? summary.total_cash - (summary.total_expenses || 0) : 0;
  const shiftStart = new Date(session.clock_in_at);
  const shiftEnd = session.clock_out_at ? new Date(session.clock_out_at) : new Date();
  const durationMs = shiftEnd.getTime() - shiftStart.getTime();
  const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
  const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

  // ─── Save Closing ─────────────────────────────────────────────────

  const handleSaveClosing = async () => {
    if (!summary) return;
    if (savingLockRef.current) return; // Synchronous double-click guard
    savingLockRef.current = true;
    if (summary.total_transactions === 0) { showError("Error", "No hay transacciones en este turno para crear un corte"); savingLockRef.current = false; return; }

    setSaving(true);
    try {
      const { data: existingClosing } = await supabase.from("shift_closings").select("id")
        .eq("shift_session_id", session.id).maybeSingle();
      if (existingClosing) { showError("Error", "Ya existe un corte registrado para este turno"); setSaving(false); return; }

      const { data: closing, error: closingError } = await supabase.from("shift_closings")
        .insert({
          shift_session_id: session.id, employee_id: session.employee_id,
          shift_definition_id: session.shift_definition_id,
          period_start: session.clock_in_at, period_end: session.clock_out_at || new Date().toISOString(),
          total_cash: summary.total_cash, total_card_bbva: summary.total_card_bbva,
          total_card_getnet: summary.total_card_getnet, total_sales: summary.total_sales,
          total_transactions: summary.total_transactions, total_expenses: summary.total_expenses || 0,
          expenses_count: summary.expenses?.length || 0, counted_cash: summary.total_cash,
          cash_difference: 0, declared_card_bbva: summary.total_card_bbva,
          declared_card_getnet: summary.total_card_getnet, card_difference_bbva: 0,
          card_difference_getnet: 0, cash_breakdown: null, notes: notes.trim() || null, status: "pending",
        }).select().single();
      if (closingError) throw closingError;

      if (summary.payments.length > 0) {
        const details = summary.payments.map((payment: any) => ({
          shift_closing_id: closing.id, payment_id: payment.id, sales_order_id: payment.sales_order_id,
          amount: payment.amount, payment_method: payment.payment_method,
          terminal_code: payment.payment_terminals?.code || null,
        }));
        const { error: detailsError } = await supabase.from("shift_closing_details").insert(details);
        if (detailsError) throw detailsError;
      }

      const { error: sessionError } = await supabase.from("shift_sessions").update({ status: "closed" }).eq("id", session.id);
      if (sessionError) throw sessionError;

      success("Corte completado", "El corte de caja se ha registrado correctamente");

      // Print both reports (fire-and-forget, non-blocking)
      // 1. Thermal ticket (ESC/POS via print server)
      handlePrintClosing();

      // 2. HP letter-size report (PCL via print server)
      handlePrintHP();

      onComplete();
    } catch (err: any) {
      console.error("Error saving closing:", err);
      showError("Error", err.message || "No se pudo guardar el corte");
    } finally {
      setSaving(false);
      savingLockRef.current = false;
    }
  };

  // ─── Print ────────────────────────────────────────────────────────

  const handlePrintClosing = async () => {
    if (!summary) return;
    try {
      const printData = {
        employeeName: `${session.employees?.first_name} ${session.employees?.last_name}`,
        shiftName: session.shift_definitions?.name || 'Turno',
        periodStart: session.clock_in_at,
        periodEnd: session.clock_out_at || new Date().toISOString(),
        totalCash: summary.total_cash, totalCardBBVA: summary.total_card_bbva,
        totalCardGetnet: summary.total_card_getnet, totalSales: summary.total_sales,
        totalTransactions: summary.total_transactions, countedCash: summary.total_cash,
        cashDifference: 0, notes: notes.trim() || undefined,
        transactions: await Promise.all(summary.payments.map(async (payment: any) => {
          let items: any[] = [];
          if (payment.sales_order_id && payment.itemsCount && payment.itemsCount > 0) {
            const { data: orderItems } = await supabase
              .from("sales_order_items")
              .select("id, qty, unit_price, total, concept_type, is_paid, paid_at, products(name, sku)")
              .eq("sales_order_id", payment.sales_order_id).eq("is_paid", true).not("paid_at", "is", null);
            const paymentTime = new Date(payment.created_at).getTime();
            const relatedItems = (orderItems || []).filter((item: any) => {
              if (!item.paid_at) return false;
              return Math.abs(paymentTime - new Date(item.paid_at).getTime()) / 1000 / 60 <= 5;
            });
            items = relatedItems.map((item: any) => {
              const product = Array.isArray(item.products) ? item.products[0] : item.products;
              return { name: product?.name || CONCEPT_LABELS[item.concept_type || "PRODUCT"] || "Item", qty: item.qty, unitPrice: item.unit_price, total: item.qty * item.unit_price };
            });
          }
          return {
            time: new Date(payment.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
            amount: payment.amount, paymentMethod: payment.payment_method || 'N/A',
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

  // ─── Print HP (letter-size income report via browser print dialog) ──────────

  const handlePrintHP = async () => {
    try {
      const employeeName = `${session.employees?.first_name} ${session.employees?.last_name}`;
      const periodStart = session.clock_in_at;
      const periodEnd = session.clock_out_at || new Date().toISOString();

      // 1. Find all sales_order_ids linked to this shift session
      const [{ data: shiftItems }, { data: shiftPayments }] = await Promise.all([
        supabase.from("sales_order_items").select("sales_order_id").eq("shift_session_id", session.id),
        supabase.from("payments").select("sales_order_id").eq("shift_session_id", session.id),
      ]);

      const ids = new Set<string>();
      (shiftItems || []).forEach((i: any) => i.sales_order_id && ids.add(i.sales_order_id));
      (shiftPayments || []).forEach((p: any) => p.sales_order_id && ids.add(p.sales_order_id));
      const salesOrderIds = Array.from(ids);

      if (salesOrderIds.length === 0) {
        console.log('[HP] No sales orders for this shift — skipping income report');
        toast.warning('Sin registros para hoja de ingresos', {
          description: 'No hay órdenes de venta en este turno para generar el reporte',
          duration: 6000
        });
        return;
      }

      // 2. Fetch room_stays that match those sales orders
      const { data: staysData } = await supabase
        .from("room_stays")
        .select(`
          id, check_in_at, vehicle_plate, status,
          checkout_valet:employees!room_stays_checkout_valet_employee_id_fkey(first_name, last_name),
          rooms!inner(number),
          sales_orders!inner(
            id, total, payments(id, payment_method, card_type, card_last_4, terminal_code, amount, concept, status, shift_session_id),
            sales_order_items(concept_type, unit_price, qty, shift_session_id)
          )
        `)
        .in("sales_order_id", salesOrderIds)
        .in("status", ["ACTIVA", "FINALIZADA", "CANCELADA"])
        .order("check_in_at", { ascending: true });

      const filteredStays = (staysData || []).filter((stay: any) => {
        const roomNum = stay.rooms?.number;
        return roomNum !== '13' && roomNum !== '113';
      });

      // 3. Build income entries
      const entries = filteredStays.map((stay: any, idx: number) => {
        const order = stay.sales_orders;
        let items = Array.isArray(order) ? (order[0]?.sales_order_items || []) : (order?.sales_order_items || []);
        items = items.filter((item: any) => item.shift_session_id === session.id);

        const rawOrderData = order ? (Array.isArray(order) ? order : [order]) : [];
        let allPayments: any[] = [];
        rawOrderData.forEach((o: any) => {
          if (o?.payments) allPayments.push(...(Array.isArray(o.payments) ? o.payments : [o.payments]));
        });
        allPayments = allPayments.filter((p: any) =>
          p.shift_session_id === session.id &&
          p.status !== 'PENDIENTE' &&
          p.concept?.toUpperCase() !== 'CHECKOUT' &&
          p.payment_method !== 'PENDIENTE'
        );

        const roomPrice = items.filter((i: any) => i.concept_type === "ROOM_BASE")
          .reduce((s: number, i: any) => s + (i.unit_price * i.qty), 0);
        const extra = items.filter((i: any) => ["EXTRA_PERSON", "EXTRA_HOUR", "RENEWAL", "PROMO_4H"].includes(i.concept_type))
          .reduce((s: number, i: any) => s + (i.unit_price * i.qty), 0);
        const consumption = items.filter((i: any) => ["CONSUMPTION", "PRODUCT", "RESTAURANT"].includes(i.concept_type))
          .reduce((s: number, i: any) => s + (i.unit_price * i.qty), 0);

        let paymentMethod = "PENDIENTE";
        if (allPayments.length === 1) {
          const p = allPayments[0];
          paymentMethod = p.payment_method === "TARJETA"
            ? `TARJETA ${p.terminal_code || ""}`.trim()
            : p.payment_method;
        } else if (allPayments.length > 1) {
          const uniqueMethods = new Set(allPayments.map((p: any) => p.payment_method));
          if (uniqueMethods.size > 1) {
            paymentMethod = "MIXTO";
          } else if (allPayments[0].payment_method === "TARJETA") {
            const terminals = new Set(allPayments.map((p: any) => p.terminal_code).filter(Boolean));
            paymentMethod = terminals.size === 1
              ? `TARJETA ${[...terminals][0]}`
              : `TARJETA ${[...terminals].join('/')}`;
          } else {
            paymentMethod = allPayments[0].payment_method;
          }
        }

        const valetName = stay.checkout_valet
          ? `${stay.checkout_valet.first_name} ${stay.checkout_valet.last_name}`.trim()
          : "—";

        return {
          no: idx + 1,
          time: stay.check_in_at ? new Date(stay.check_in_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
          vehicle_plate: stay.vehicle_plate || '',
          room_number: stay.rooms?.number || '',
          checkout_valet_name: valetName,
          room_price: roomPrice,
          extra,
          consumption,
          total: roomPrice + extra + consumption,
          payment_method: paymentMethod,
          stay_status: stay.status,
        };
      });

      // 4. Build payment breakdown
      const paymentBreakdown: Record<string, number> = {};
      filteredStays.forEach((stay: any) => {
        const order = stay.sales_orders;
        const rawOrderData = order ? (Array.isArray(order) ? order : [order]) : [];
        rawOrderData.forEach((o: any) => {
          if (!o?.payments) return;
          const pList = Array.isArray(o.payments) ? o.payments : [o.payments];
          pList.filter((p: any) =>
            p.shift_session_id === session.id &&
            p.status !== 'PENDIENTE' &&
            p.payment_method !== 'PENDIENTE'
          ).forEach((p: any) => {
            const key = p.payment_method === "TARJETA"
              ? `TARJETA ${p.terminal_code || ""} ${p.card_type || ""}`.trim()
              : p.payment_method;
            paymentBreakdown[key] = (paymentBreakdown[key] || 0) + Number(p.amount);
          });
        });
      });

      // 5. Calculate totals
      const totals = entries.reduce((acc: any, e: any) => ({
        roomPrice: acc.roomPrice + e.room_price,
        extra: acc.extra + e.extra,
        consumption: acc.consumption + e.consumption,
        total: acc.total + e.total,
      }), { roomPrice: 0, extra: 0, consumption: 0, total: 0 });

      // 6. Build and open HTML print window
      const { dateStr: startDate, timeStr: startTime } = (() => {
        const d = new Date(periodStart);
        return {
          dateStr: d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }),
          timeStr: d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
        };
      })();
      const { dateStr: endDate, timeStr: endTime } = (() => {
        const d = new Date(periodEnd);
        return {
          dateStr: d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }),
          timeStr: d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
        };
      })();
      const periodLabel = `${startDate} ${startTime} — ${endDate} ${endTime}`;

      const tableRows = entries.map((e: any) => {
        return `<tr>
            <td style="text-align:center;font-weight:600;">${e.no}</td>
            <td style="text-align:center;">${e.time}</td>
            <td style="text-align:center;text-transform:uppercase;">${e.vehicle_plate || '—'}</td>
            <td style="text-align:center;font-weight:600;">${e.room_number}${e.stay_status === 'CANCELADA' ? ' <span style="color:#dc2626;font-size:7px;">(C)</span>' : e.stay_status === 'ACTIVA' ? ' <span style="color:#d97706;font-size:7px;">(A)</span>' : ''}</td>
            <td style="text-align:right;font-family:monospace;">$${Number(e.room_price).toFixed(2)}</td>
            <td style="text-align:right;font-family:monospace;">${e.extra > 0 ? '$' + Number(e.extra).toFixed(2) : '—'}</td>
            <td style="text-align:right;font-family:monospace;">${e.consumption > 0 ? '$' + Number(e.consumption).toFixed(2) : '—'}</td>
            <td style="text-align:right;font-weight:700;font-family:monospace;">$${Number(e.total).toFixed(2)}</td>
            <td style="text-align:center;">${e.payment_method}</td>
        </tr>`;
      }).join('');

      const breakdownRows = Object.entries(paymentBreakdown).map(([method, amount]) =>
        `<tr><td style="padding:1px 4px;border:none;border-bottom:1px solid #eee;">${method}</td><td style="padding:1px 4px;text-align:right;font-weight:600;font-family:monospace;border:none;border-bottom:1px solid #eee;">$${Number(amount).toFixed(2)}</td></tr>`
      ).join('');

      const printHtml = `<!DOCTYPE html>\n<html lang="es">\n<head>\n<meta charset="UTF-8">\n<title>Corte de Caja</title>\n<style>\n    @page { size: landscape; margin: 5mm; }\n    * { margin: 0; padding: 0; box-sizing: border-box; }\n    body { font-family: Arial, Helvetica, sans-serif; font-size: 8px; color: #111; background: #fff; line-height: 1.2; }\n    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #111; padding-bottom: 4px; margin-bottom: 4px; }\n    .header h1 { font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; }\n    .header .meta { font-size: 7px; color: #333; text-align: right; line-height: 1.4; }\n    table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }\n    th { background: #222; color: #fff; padding: 2px 3px; font-size: 7px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; border: 1px solid #222; white-space: nowrap; }\n    td { padding: 1px 3px; border: 1px solid #bbb; font-size: 8px; white-space: nowrap; }\n    tbody tr:nth-child(odd) { background: #f5f5f5; }\n    .totals-row td { background: #e5e5e5; font-weight: 700; border-top: 2px solid #111; font-size: 9px; }\n    .footer { display: flex; gap: 10px; margin-top: 6px; }\n    .footer-box { flex: 1; border: 1px solid #999; padding: 4px 6px; }\n    .footer-box h4 { font-size: 7px; text-transform: uppercase; letter-spacing: 1px; color: #555; margin-bottom: 3px; border-bottom: 1px solid #ccc; padding-bottom: 2px; }\n    .footer-box td { font-size: 8px; padding: 1px 4px; border: none; border-bottom: 1px solid #eee; }\n    .signature { margin-top: 20px; display: flex; justify-content: space-around; }\n    .sig-line { text-align: center; width: 180px; }\n    .sig-line .line { border-top: 1px solid #111; margin-bottom: 2px; }\n    .sig-line span { font-size: 7px; text-transform: uppercase; letter-spacing: 1px; color: #666; }\n</style>\n</head>\n<body onload="setTimeout(()=>window.print(),300)">\n<div class="header">\n    <h1>Luxor Auto Hotel &mdash; Corte de Caja</h1>\n    <div class="meta"><b>${employeeName}</b> &nbsp;|&nbsp; ${periodLabel} &nbsp;|&nbsp; ${entries.length} registros &nbsp;|&nbsp; Impreso: ${new Date().toLocaleString('es-MX')}</div>\n</div>\n<table>\n    <thead><tr><th>#</th><th>Hora</th><th>Placas</th><th>Hab</th><th>Precio</th><th>Extra</th><th>Consumo</th><th>Total</th><th>Forma de Pago</th></tr></thead>\n    <tbody>\n        ${tableRows}\n        <tr class="totals-row"><td colspan="4" style="text-align:right;letter-spacing:1px;">TOTAL</td><td style="text-align:right;font-family:monospace;">$${Number(totals.roomPrice).toFixed(2)}</td><td style="text-align:right;font-family:monospace;">$${Number(totals.extra).toFixed(2)}</td><td style="text-align:right;font-family:monospace;">$${Number(totals.consumption).toFixed(2)}</td><td style="text-align:right;font-family:monospace;font-size:10px;">$${Number(totals.total).toFixed(2)}</td><td></td></tr>\n    </tbody>\n</table>\n<div class="footer">\n    <div class="footer-box"><h4>Desglose por M&eacute;todo de Pago</h4><table style="margin:0;"><tbody>${breakdownRows}</tbody></table></div>\n    <div class="footer-box"><h4>Resumen</h4><table style="margin:0;"><tbody>\n        <tr><td>Habitaciones</td><td style="text-align:right;font-family:monospace;font-weight:600;">$${Number(totals.roomPrice).toFixed(2)}</td></tr>\n        <tr><td>Extras</td><td style="text-align:right;font-family:monospace;font-weight:600;">$${Number(totals.extra).toFixed(2)}</td></tr>\n        <tr><td>Consumo</td><td style="text-align:right;font-family:monospace;font-weight:600;">$${Number(totals.consumption).toFixed(2)}</td></tr>\n        <tr><td style="font-weight:700;border-top:2px solid #111;">TOTAL</td><td style="text-align:right;font-family:monospace;font-weight:700;font-size:10px;border-top:2px solid #111;">$${Number(totals.total).toFixed(2)}</td></tr>\n    </tbody></table></div>\n</div>\n<div class="signature"><div class="sig-line"><div class="line"></div><span>Recepcionista</span></div><div class="sig-line"><div class="line"></div><span>Supervisor / Gerente</span></div></div>\n</body>\n</html>`;



      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(printHtml);
        printWindow.document.close();
      } else {
        toast.error('No se pudo abrir ventana de impresión', {
          description: 'Permite las ventanas emergentes para este sitio',
          duration: 6000
        });
      }
    } catch (error) {
      console.error('Error preparing HP income report:', error);
      toast.error('Error al preparar reporte de ingresos', {
        description: 'No se pudieron cargar los datos del turno',
        duration: 6000
      });
    }
  };

  return {
    // State
    loading, saving, summary, notes, showExpenses, isPrintingClosing,
    // Setters
    setNotes, setShowExpenses,
    // Actions
    handleSaveClosing, handlePrintClosing, handlePrintHP,
    // Computed
    netCash, shiftStart, shiftEnd, durationHours, durationMinutes,
    // Helpers
    formatCurrency,
  };
}
