/**
 * Hook for shift closing: loads payment summary, saves closing, and prints reports.
 * Extracted from shift-closing.tsx (ShiftClosingModal).
 */
"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { getShiftClosingSummary, getEmployeeCharges, closeSessionWithoutClosing, getExistingClosing, createClosing, insertClosingDetails, closeSession } from '@/lib/services/shift-service';
import { useToast } from "@/hooks/use-toast";
import { toast } from "sonner";
import { ShiftSession } from "@/components/employees/types";
import { usePrintClosing } from "@/hooks/use-print-closing";
import { ShiftExpense } from "@/types/expenses";
import { buildClosingBreakdowns, buildClosingTransactionsWithItems, sendPrintJob } from "@/lib/print";
import { formatCurrency } from "@/lib/utils/formatters";

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

export interface EmployeeChargeEntry {
  id: string;
  charge_type: string;
  description: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
  discount_type: string | null;
  discount_value: number;
  discount_amount: number;
  total: number;
  payment_method: string;
  notes: string | null;
  created_at: string;
  charged_employee?: { first_name: string; last_name: string; role: string } | null;
}

export interface PaymentSummary {
  total_cash: number;
  total_card_bbva: number;
  total_card_getnet: number;
  total_sales: number;
  total_transactions: number;
  payments: EnrichedPayment[];
  salesOrders: Array<{ id: string; total: number; status: string }>;
  expenses?: ShiftExpense[];
  total_expenses?: number;
  total_accrual_sales: number;
  accrual_items: Array<{
    id: string;
    concept_type: string;
    amount: number;
    room_stay_id?: string;
    room_stays?: { room_id: string; rooms?: { number: string } };
  }>;
  unassigned_card_payments: EnrichedPayment[];
  unhandled_payment_methods: Array<{payment: EnrichedPayment, method: string}>;
  // Employee Charges
  employee_charges: EmployeeChargeEntry[];
  total_employee_charges: number;
  total_employee_charges_cash: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────

export { formatCurrency };

// buildClosingBreakdowns and buildClosingTransactionsWithItems are imported from @/lib/print

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
      const employeeUuid = (session as any).employee_id || (session as any).employees?.id || (session as any).employeeId;

      // ─── Single RPC call replaces 6 queries + JS enrichment ────────
      const summaryResult = await getShiftClosingSummary(session.id, employeeUuid);
      if (!summaryResult.success) throw new Error(summaryResult.error);
      const rpcResult = summaryResult.data;

      // Fetch employee charges for this shift
      const chargesResult = await getEmployeeCharges(session.id);
      const chargesData = chargesResult.success ? chargesResult.data : [];

      const employeeCharges: EmployeeChargeEntry[] = (chargesData || []) as any[];
      const totalEmployeeCharges = employeeCharges.reduce((sum, c) => sum + Number(c.total), 0);
      const totalEmployeeChargesCash = employeeCharges
        .filter(c => c.payment_method === 'CASH')
        .reduce((sum, c) => sum + Number(c.total), 0);

      setSummary({
        total_cash: Number(rpcResult.total_cash) || 0,
        total_card_bbva: Number(rpcResult.total_card_bbva) || 0,
        total_card_getnet: Number(rpcResult.total_card_getnet) || 0,
        total_sales: Number(rpcResult.total_sales) || 0,
        total_transactions: Number(rpcResult.total_transactions) || 0,
        payments: rpcResult.payments || [],
        salesOrders: rpcResult.salesOrders || [],
        expenses: rpcResult.expenses || [],
        total_expenses: Number(rpcResult.total_expenses) || 0,
        total_accrual_sales: Number(rpcResult.total_accrual_sales) || 0,
        accrual_items: rpcResult.accrual_items || [],
        unassigned_card_payments: rpcResult.unassigned_card_payments || [],
        unhandled_payment_methods: rpcResult.unhandled_payment_methods || [],
        employee_charges: employeeCharges,
        total_employee_charges: totalEmployeeCharges,
        total_employee_charges_cash: totalEmployeeChargesCash,
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

  const netCash = summary ? summary.total_cash - (summary.total_expenses || 0) + (summary.total_employee_charges_cash || 0) : 0;
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
    if (summary.total_transactions === 0) {
      setSaving(true);
      try {
        const closeResult = await closeSessionWithoutClosing(session.id, 'Turno cerrado sin transacciones.');
        if (!closeResult.success) throw new Error(closeResult.error);

        success("Turno cerrado", "El turno vacío se ha cerrado correctamente sin generar corte.");
        onComplete();
      } catch (err: any) {
        console.error("Error closing empty shift:", err);
        showError("Error", err.message || "No se pudo cerrar el turno vacío");
      } finally {
        setSaving(false);
        savingLockRef.current = false;
      }
      return;
    }


    setSaving(true);
    try {
      const existingResult = await getExistingClosing(session.id);
      if (existingResult.success && existingResult.data) { showError("Error", "Ya existe un corte registrado para este turno"); setSaving(false); savingLockRef.current = false; return; }
      if (!existingResult.success) throw new Error(existingResult.error);

      const closingResult = await createClosing({
          shift_session_id: session.id, employee_id: session.employee_id,
          shift_definition_id: session.shift_definition_id,
          period_start: session.clock_in_at, period_end: session.clock_out_at || new Date().toISOString(),
          total_cash: summary.total_cash, total_card_bbva: summary.total_card_bbva,
          total_card_getnet: summary.total_card_getnet, total_sales: summary.total_sales,
          total_transactions: summary.total_transactions, total_expenses: summary.total_expenses || 0,
          expenses_count: summary.expenses?.length || 0, counted_cash: netCash,
          cash_difference: 0, declared_card_bbva: summary.total_card_bbva,
          declared_card_getnet: summary.total_card_getnet, card_difference_bbva: 0,
          card_difference_getnet: 0, cash_breakdown: null, notes: notes.trim() || null, status: "pending",
      });
      if (!closingResult.success) throw new Error(closingResult.error);
      const closing = closingResult.data;

      if (summary.payments.length > 0) {
        const details = summary.payments.map((payment: any) => ({
          shift_closing_id: closing.id, payment_id: payment.id, sales_order_id: payment.sales_order_id,
          amount: payment.amount, payment_method: payment.payment_method,
          terminal_code: payment.payment_terminals?.code || null,
        }));
        const detailsResult = await insertClosingDetails(details);
        if (!detailsResult.success) throw new Error(detailsResult.error);
      }

      const sessionCloseResult = await closeSession(session.id);
      if (!sessionCloseResult.success) throw new Error(sessionCloseResult.error);

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
      // CONCEPT_DISPLAY imported from @/lib/print

      // Reuse expenses from summary (already loaded by loadPaymentSummary)
      const expenses = (summary.expenses || []).map((exp: any) => ({
        time: new Date(exp.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
        type: exp.expense_type,
        description: exp.description,
        amount: Number(exp.amount),
        recipient: exp.recipient,
      }));

      const printData = {
        employeeName: `${session.employees?.first_name} ${session.employees?.last_name}`,
        shiftName: session.shift_definitions?.name || 'Turno',
        periodStart: session.clock_in_at,
        periodEnd: session.clock_out_at || new Date().toISOString(),
        totalCash: summary.total_cash, totalCardBBVA: summary.total_card_bbva,
        totalCardGetnet: summary.total_card_getnet, totalSales: summary.total_sales,
        totalTransactions: summary.total_transactions, countedCash: netCash,
        cashDifference: 0, notes: notes.trim() || undefined,
        expenses,
        totalExpenses: summary.total_expenses || 0,
        employeeCharges: (summary.employee_charges || []).map(c => ({
          time: new Date(c.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
          employeeName: c.charged_employee ? `${c.charged_employee.first_name} ${c.charged_employee.last_name}` : '—',
          chargeType: c.charge_type,
          description: c.description,
          total: Number(c.total),
          discountAmount: Number(c.discount_amount),
          paymentMethod: c.payment_method,
        })),
        totalEmployeeCharges: summary.total_employee_charges || 0,
        transactions: await buildClosingTransactionsWithItems(summary.payments, supabase),
        // ─── Granular breakdowns for thermal ticket ───
        ...buildClosingBreakdowns(summary.accrual_items),
      };
      await printClosing(printData);
    } catch (error) {
      console.error('Error preparing print data:', error);
    }
  };

  // ─── Print HP (direct PCL via print server — no browser prompt) ──────────

  const handlePrintHP = async () => {
    if (!summary) return;
    try {
      const employeeName = `${session.employees?.first_name} ${session.employees?.last_name}`;
      const periodStart = session.clock_in_at;
      const periodEnd = session.clock_out_at || new Date().toISOString();

      // Build closing data with all breakdowns for HP PCL report
      const expenses = (summary.expenses || []).map((exp: any) => ({
        time: new Date(exp.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
        type: exp.expense_type,
        description: exp.description,
        amount: Number(exp.amount),
        recipient: exp.recipient,
        created_at: exp.created_at,
        createdAt: exp.created_at,
      }));
      const totalExpenses = expenses.reduce((s: number, e: any) => s + e.amount, 0);

      const employeeCharges = (summary.employee_charges || []).map((c: any) => ({
        time: new Date(c.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
        employeeName: c.charged_employee ? `${c.charged_employee.first_name} ${c.charged_employee.last_name}` : '—',
        chargeType: c.charge_type,
        description: c.description,
        total: Number(c.total),
        paymentMethod: c.payment_method,
      }));
      const totalEmployeeCharges = employeeCharges.reduce((s: number, c: any) => s + c.total, 0);

      const closingData = {
        employeeName,
        shiftName: session.shift_definitions?.name || 'Turno',
        periodStart,
        periodEnd,
        totalCash: summary.total_cash,
        totalCardBBVA: summary.total_card_bbva,
        totalCardGetnet: summary.total_card_getnet,
        totalSales: summary.total_sales,
        totalTransactions: summary.total_transactions,
        countedCash: netCash,
        cashDifference: 0,
        notes: notes.trim() || undefined,
        transactions: await buildClosingTransactionsWithItems(summary.payments, supabase),
        ...buildClosingBreakdowns(summary.accrual_items),
        expenses,
        totalExpenses,
        employeeCharges,
        totalEmployeeCharges,
      };

      await sendPrintJob('closing', closingData, {
        endpoint: '/print/hp',
        successMsg: 'Reporte HP impreso',
        successDesc: 'Enviado directo a impresora HP',
      });
    } catch (error) {
      console.error('Error preparing HP closing report:', error);
      toast.error('Error al imprimir reporte HP', {
        description: 'No se pudieron enviar los datos a la impresora HP',
        duration: 6000,
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
