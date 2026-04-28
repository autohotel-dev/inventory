/**
 * Hook for shift closing: loads payment summary, saves closing, and prints reports.
 * Extracted from shift-closing.tsx (ShiftClosingModal).
 */
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
    if (summary.total_transactions === 0) { showError("Error", "No hay transacciones en este turno para crear un corte"); return; }

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

  // ─── Print HP (letter-size via print server) ───────────────────────

  const handlePrintHP = async () => {
    if (!summary) return;
    try {
      const printData = {
        employeeName: `${session.employees?.first_name} ${session.employees?.last_name}`,
        shiftName: session.shift_definitions?.name || 'Turno',
        periodStart: session.clock_in_at,
        periodEnd: session.clock_out_at || new Date().toISOString(),
        totalCash: summary.total_cash, totalCardBBVA: summary.total_card_bbva,
        totalCardGetnet: summary.total_card_getnet, totalSales: summary.total_sales,
        totalTransactions: summary.total_transactions,
        totalExpenses: summary.total_expenses || 0,
        expenses: summary.expenses || [],
        notes: notes.trim() || undefined,
        transactions: summary.payments.map((payment: any) => ({
          time: new Date(payment.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
          amount: payment.amount, paymentMethod: payment.payment_method || 'N/A',
          terminalCode: payment.payment_terminals?.code || payment.terminal_code,
          concept: payment.itemsDescription || payment.concept || undefined,
          items: payment.itemsRaw || undefined
        }))
      };

      const PRINT_SERVER_URL = process.env.NEXT_PUBLIC_PRINT_SERVER_URL || 'http://localhost:3001';
      const response = await fetch(`${PRINT_SERVER_URL}/print/hp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'closing', data: printData })
      });

      if (!response.ok) {
        const err = await response.json();
        console.error('HP print error:', err);
      }
    } catch (error) {
      console.error('Error printing to HP:', error);
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
