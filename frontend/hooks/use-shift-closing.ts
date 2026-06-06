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
  salesOrders: any[];
  expenses?: ShiftExpense[];
  total_expenses?: number;
  total_accrual_sales: number;
  accrual_items: any[];
  unassigned_card_payments: EnrichedPayment[];
  unhandled_payment_methods: Array<{payment: EnrichedPayment, method: string}>;
  // Employee Charges
  employee_charges: EmployeeChargeEntry[];
  total_employee_charges: number;
  total_employee_charges_cash: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────

export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount);

const CONCEPT_LABELS: Record<string, string> = {
  ROOM_BASE: "Habitación", EXTRA_HOUR: "Hora Extra", EXTRA_PERSON: "Persona Extra",
  CONSUMPTION: "Consumo", PRODUCT: "Producto", RENEWAL: "Renovación", PROMO_4H: "Promo 4H",
  ROOM_CHANGE_ADJUSTMENT: "Cambio de Habitación",
};

// ─── Build granular breakdowns from accrual items for thermal ticket ─────
function buildTicketBreakdowns(accrualItems: any[]) {
  const roomBreakdown: Record<string, { count: number; total: number }> = {};
  const extraBreakdown: Record<string, { count: number; total: number }> = {};
  const consumptionBreakdown: Record<string, { count: number; total: number }> = {};
  const damageBreakdown: Record<string, { count: number; total: number }> = {};

  // Filter out items belonging to cancelled stays or items that are cancelled
  const activeItems = (accrualItems || []).filter((item: any) => {
    if (item.is_cancelled) return false;
    const order = item.sales_orders;
    const roomStay = Array.isArray(order) ? order[0]?.room_stays : order?.room_stays;
    const stay = Array.isArray(roomStay) ? roomStay[0] : roomStay;
    return !stay || stay.status !== 'CANCELADA';
  });

  activeItems.forEach((item: any) => {
    const qty = item.qty || 1;
    const amount = (item.unit_price || 0) * qty;
    const conceptType = item.concept_type || "PRODUCT";

    if (conceptType === "ROOM_BASE") {
      // Get room type name from the nested join
      const order = item.sales_orders;
      const roomStay = Array.isArray(order) ? order[0]?.room_stays : order?.room_stays;
      const room = Array.isArray(roomStay) ? roomStay[0]?.rooms : roomStay?.rooms;
      const roomType = room?.room_types;
      const typeName = (Array.isArray(roomType) ? roomType[0]?.name : roomType?.name) || "Sin tipo";

      if (!roomBreakdown[typeName]) roomBreakdown[typeName] = { count: 0, total: 0 };
      roomBreakdown[typeName].count += qty;
      roomBreakdown[typeName].total += amount;
    } else if (["EXTRA_PERSON", "EXTRA_HOUR", "RENEWAL", "PROMO_4H", "ROOM_CHANGE_ADJUSTMENT"].includes(conceptType)) {
      const label = CONCEPT_LABELS[conceptType] || conceptType;
      if (!extraBreakdown[label]) extraBreakdown[label] = { count: 0, total: 0 };
      extraBreakdown[label].count += qty;
      extraBreakdown[label].total += amount;
    } else if (["CONSUMPTION", "PRODUCT", "RESTAURANT"].includes(conceptType)) {
      const product = Array.isArray(item.products) ? item.products[0] : item.products;
      const productName = product?.name || "Producto";
      let displayName = productName;
      if (item.is_courtesy) {
        displayName = `${productName} (${item.courtesy_reason || "Cortesía"})`;
      }
      if (!consumptionBreakdown[displayName]) consumptionBreakdown[displayName] = { count: 0, total: 0 };
      consumptionBreakdown[displayName].count += qty;
      consumptionBreakdown[displayName].total += amount;
    } else if (conceptType === "DAMAGE_CHARGE") {
      const description = item.courtesy_reason || "Cargo por Daño";
      if (!damageBreakdown[description]) damageBreakdown[description] = { count: 0, total: 0 };
      damageBreakdown[description].count += qty;
      damageBreakdown[description].total += amount;
    }
  });

  return { roomBreakdown, extraBreakdown, consumptionBreakdown, damageBreakdown };
}

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
      const { data: rpcResult, error } = await supabase.rpc('get_shift_closing_summary', {
        p_session_id: session.id,
        p_employee_id: employeeUuid,
      });

      if (error) throw error;
      if (rpcResult?.error) throw new Error(rpcResult.error);

      // Fetch employee charges for this shift
      const { data: chargesData } = await supabase
        .from('shift_employee_charges')
        .select(`
          id, charge_type, description, unit_price, quantity, subtotal,
          discount_type, discount_value, discount_amount, total,
          payment_method, notes, created_at,
          charged_employee:charged_to(first_name, last_name, role)
        `)
        .eq('shift_session_id', session.id)
        .neq('status', 'rejected')
        .order('created_at', { ascending: true });

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
        const { error: sessionError } = await supabase
          .from("shift_sessions")
          .update({ 
            status: "closed", 
            notes: (session.notes ? session.notes + '\n' : '') + "Turno cerrado sin transacciones." 
          })
          .eq("id", session.id);
        
        if (sessionError) throw sessionError;

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
          expenses_count: summary.expenses?.length || 0, counted_cash: netCash,
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
      const CONCEPT_DISPLAY: Record<string, string> = {
        ESTANCIA: "Estancia", CONSUMPTION: "Consumo", EXTRA_PERSON: "Pers. Extra",
        EXTRA_HOUR: "Hora Extra", RENEWAL: "Renovación", CHECKOUT: "Salida",
        ROOM_BASE: "Habitación", PROMO_4H: "Promo 4H",
        ROOM_CHANGE_ADJUSTMENT: "Cambio de Hab.",
      };

      // Load expenses for the shift
      const { data: expenseData } = await supabase
        .from('shift_expenses')
        .select('*')
        .eq('shift_session_id', session.id)
        .neq('status', 'rejected')
        .order('created_at', { ascending: true });

      const expenses = (expenseData || []).map((exp: any) => ({
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

          // Get room number from sales_order -> room_stays
          let roomNumber: string | undefined;
          if (payment.sales_order_id) {
            const { data: stayData } = await supabase
              .from("room_stays")
              .select("rooms(number)")
              .eq("sales_order_id", payment.sales_order_id)
              .limit(1)
              .maybeSingle();
            const rooms = stayData?.rooms;
            roomNumber = Array.isArray(rooms) ? rooms[0]?.number : rooms?.number;
          }

          const rawConcept = payment.concept || "";
          const conceptLabel = CONCEPT_DISPLAY[rawConcept] || payment.itemsDescription || rawConcept || undefined;

          return {
            time: new Date(payment.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
            amount: payment.amount, paymentMethod: payment.payment_method || 'N/A',
            terminalCode: payment.payment_terminals?.code || payment.terminal_code,
            reference: payment.reference || undefined,
            concept: conceptLabel,
            roomNumber,
            items: items.length > 0 ? items : undefined
          };
        })),
        // ─── Granular breakdowns for thermal ticket ───
        ...buildTicketBreakdowns(summary.accrual_items),
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

      // 1. Call RPC to get income report entries
      const { data: rpcResult, error } = await supabase.rpc('get_income_report', {
        p_report_type: 'shift',
        p_shift_id: session.id,
        p_payment_method_filter: 'all',
        p_room_filter: 'all',
        p_status_filter: 'all'
      });

      if (error) throw error;

      const entriesRaw = rpcResult?.entries || [];

      if (entriesRaw.length === 0) {
        console.log('[HP] No sales orders/entries for this shift — skipping income report');
        toast.warning('Sin registros para hoja de ingresos', {
          description: 'No hay registros de ingreso en este turno para generar el reporte',
          duration: 6000
        });
        return;
      }

      // 2. Map raw entries to structured layout
      const entries = entriesRaw.map((e: any) => {
        const buildCardLabel = (p: any) => {
          let label = 'TARJETA';
          if (p.terminal_code) label += ` ${p.terminal_code}`;
          if (p.card_type) {
            const ct = p.card_type.toUpperCase();
            label += ct === 'CREDITO' ? ' CRÉD' : ct === 'DEBITO' ? ' DÉB' : ` ${ct}`;
          }
          if (p.card_last_4) label += ` ****${p.card_last_4}`;
          return label;
        };

        let paymentMethod = e.payment_method || "PENDIENTE";
        if (e.payments && e.payments.length === 1) {
          const p = e.payments[0];
          paymentMethod = p.payment_method === "TARJETA" ? buildCardLabel(p) : p.payment_method;
        } else if (e.payments && e.payments.length > 1) {
          paymentMethod = e.payments.map((p: any) =>
            p.payment_method === "TARJETA" ? buildCardLabel(p) : p.payment_method
          ).join(' / ');
        }

        return {
          no: Number(e.no),
          time: e.time || '',
          vehicle_plate: e.vehicle_plate || '',
          room_number: e.room_number || '',
          checkout_valet_name: e.checkout_valet_name || '—',
          room_price: Number(e.room_price) || 0,
          extra: Number(e.extra) || 0,
          consumption: Number(e.consumption) || 0,
          damage: Number(e.damage) || 0,
          total: Number(e.total) || 0,
          payment_method: paymentMethod,
          stay_status: e.stay_status,
          isOwnRoom: Number(e.room_price) > 0,
        };
      });

      // Split entries: rooms checked-in THIS shift vs services for rooms from OTHER shifts
      const ownEntries = entries.filter((e: any) => e.isOwnRoom).map((e: any, i: number) => ({ ...e, no: i + 1 }));
      const otherEntries = entries.filter((e: any) => !e.isOwnRoom).map((e: any, i: number) => ({ ...e, no: i + 1 }));

      // 3. Build payment breakdown from all payments in the shift
      const paymentBreakdown: Record<string, number> = {};
      entriesRaw.forEach((e: any) => {
        (e.payments || []).forEach((p: any) => {
          let key = p.payment_method;
          if (p.payment_method === "TARJETA") {
            key = 'TARJETA';
            if (p.terminal_code) key += ` ${p.terminal_code}`;
            if (p.card_type) {
              const ct = p.card_type.toUpperCase();
              key += ct === 'CREDITO' ? ' CRÉD' : ct === 'DEBITO' ? ' DÉB' : ` ${ct}`;
            }
            if (p.card_last_4) key += ` ****${p.card_last_4}`;
          }
          paymentBreakdown[key] = (paymentBreakdown[key] || 0) + Number(p.amount);
        });
      });

      // 4. Calculate totals (all, own, other)
      const calcTotals = (list: any[]) => list.reduce((acc: any, e: any) => ({
        roomPrice: acc.roomPrice + e.room_price,
        extra: acc.extra + e.extra,
        consumption: acc.consumption + e.consumption,
        damage: acc.damage + e.damage,
        total: acc.total + e.total,
      }), { roomPrice: 0, extra: 0, consumption: 0, damage: 0, total: 0 });
      const totals = calcTotals(entries);
      const ownTotals = calcTotals(ownEntries);
      const otherTotals = calcTotals(otherEntries);

      // 5. Format period
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

      // 6. Fetch shift expenses
      const { data: expenseData } = await supabase
        .from('shift_expenses')
        .select('*')
        .eq('shift_session_id', session.id)
        .neq('status', 'rejected')
        .order('created_at', { ascending: true });

      const EXPENSE_LABELS: Record<string, string> = {
        UBER: '🚗 Uber / Transporte', MAINTENANCE: '🔧 Mantenimiento', REPAIR: '🛠️ Reparación',
        SUPPLIES: '📦 Insumos', PETTY_CASH: '💵 Caja Chica', OTHER: '📝 Otro Gasto',
      };

      const expenses = (expenseData || []).map((exp: any) => ({
        time: new Date(exp.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
        type: exp.expense_type,
        typeLabel: EXPENSE_LABELS[exp.expense_type] || exp.expense_type,
        description: exp.description,
        amount: Number(exp.amount),
        recipient: exp.recipient,
      }));
      const totalExpenses = expenses.reduce((s: number, e: any) => s + e.amount, 0);

      // 6b. Fetch employee charges
      const { data: chargesData } = await supabase
        .from('shift_employee_charges')
        .select(`
          id, charge_type, description, unit_price, quantity, subtotal,
          discount_type, discount_value, discount_amount, total,
          payment_method, notes, created_at,
          charged_employee:charged_to(first_name, last_name, role)
        `)
        .eq('shift_session_id', session.id)
        .neq('status', 'rejected')
        .order('created_at', { ascending: true });

      const CHARGE_TYPE_LABELS: Record<string, string> = {
        BREAKFAST: 'Desayuno', LUNCH: 'Comida', CONSUMPTION: 'Consumo',
        PRODUCT: 'Producto', OTHER: 'Otro',
      };
      const CHARGE_PAYMENT_LABELS: Record<string, string> = {
        CASH: 'Efectivo', DEDUCCION_NOMINA: 'Desc. Nómina', COURTESY: 'Cortesía',
      };

      const employeeCharges = (chargesData || []).map((c: any) => ({
        time: new Date(c.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
        employeeName: c.charged_employee ? `${c.charged_employee.first_name} ${c.charged_employee.last_name}` : '—',
        chargeType: CHARGE_TYPE_LABELS[c.charge_type] || c.charge_type,
        description: c.description,
        quantity: c.quantity,
        unitPrice: Number(c.unit_price),
        discountAmount: Number(c.discount_amount),
        total: Number(c.total),
        paymentMethod: CHARGE_PAYMENT_LABELS[c.payment_method] || c.payment_method,
      }));
      const totalEmployeeCharges = employeeCharges.reduce((s: number, c: any) => s + c.total, 0);
      const totalEmployeeChargesCash = (chargesData || []).filter((c: any) => c.payment_method === 'CASH').reduce((s: number, c: any) => s + Number(c.total), 0);

      // 7. Build HTML table rows helper
      const buildRow = (e: any) => {
        const isCancelled = e.stay_status === 'CANCELADA';
        const rowStyle = isCancelled ? 'color:#dc2626;text-decoration:line-through;' : '';
        const cancelTag = isCancelled ? ' <span style="color:#dc2626;font-size:7px;font-weight:700;text-decoration:none;display:inline-block;">(CANCELADO)</span>' : '';
        const activeTag = !isCancelled && e.stay_status === 'ACTIVA' ? ' <span style="color:#d97706;font-size:7px;">(A)</span>' : '';
        const formatAmt = (val: number) => {
          if (val === 0) return '—';
          if (val < 0) return `<span style="color:#dc2626;text-decoration:none;display:inline-block;">-$${Math.abs(val).toFixed(2)}</span>`;
          return `$${val.toFixed(2)}`;
        };
        return `<tr style="${rowStyle}">
            <td style="text-align:center;font-weight:600;">${e.no}</td>
            <td style="text-align:center;">${e.time}</td>
            <td style="text-align:center;text-transform:uppercase;">${e.vehicle_plate || '—'}</td>
            <td style="text-align:center;font-weight:600;text-decoration:none;">${e.room_number}${cancelTag}${activeTag}</td>
            <td style="text-align:right;font-family:monospace;">${formatAmt(e.room_price)}</td>
            <td style="text-align:right;font-family:monospace;">${e.extra !== 0 ? formatAmt(e.extra) : '—'}</td>
            <td style="text-align:right;font-family:monospace;">${e.consumption !== 0 ? formatAmt(e.consumption) : '—'}</td>
            <td style="text-align:right;font-family:monospace;">${e.damage !== 0 ? formatAmt(e.damage) : '—'}</td>
            <td style="text-align:right;font-weight:700;font-family:monospace;">${formatAmt(e.total)}</td>
            <td style="text-align:center;${isCancelled ? 'text-decoration:none;color:#dc2626;font-weight:700;' : ''}">${e.payment_method}</td>
        </tr>`;
      };
      const ownRows = ownEntries.map(buildRow).join('');
      const otherRows = otherEntries.map(buildRow).join('');

      const breakdownRows = Object.entries(paymentBreakdown).map(([method, amount]) =>
        `<tr><td style="padding:1px 4px;border:none;border-bottom:1px solid #eee;">${method}</td><td style="padding:1px 4px;text-align:right;font-weight:600;font-family:monospace;border:none;border-bottom:1px solid #eee;">$${Number(amount).toFixed(2)}</td></tr>`
      ).join('');

      const expenseRows = expenses.length > 0 ? expenses.map((exp: any) =>
        `<tr><td style="padding:1px 4px;border:none;border-bottom:1px solid #eee;font-size:7px;">${exp.time} — ${exp.typeLabel}</td><td style="padding:1px 4px;border:none;border-bottom:1px solid #eee;font-size:7px;color:#666;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${exp.description}${exp.recipient ? ' (' + exp.recipient + ')' : ''}</td><td style="padding:1px 4px;text-align:right;font-weight:600;font-family:monospace;border:none;border-bottom:1px solid #eee;color:#dc2626;">-$${exp.amount.toFixed(2)}</td></tr>`
      ).join('') + `<tr><td colspan="2" style="padding:1px 4px;font-weight:700;border-top:2px solid #111;border:none;">TOTAL GASTOS</td><td style="padding:1px 4px;text-align:right;font-family:monospace;font-weight:700;font-size:10px;border-top:2px solid #111;border:none;color:#dc2626;">-$${totalExpenses.toFixed(2)}</td></tr>` : '';

      const printHtml = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Corte de Caja — Luxor Auto Hotel</title>
<style>
    @page { size: landscape; margin: 5mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 8px; color: #111; background: #fff; line-height: 1.2; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #111; padding-bottom: 4px; margin-bottom: 4px; }
    .header h1 { font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; }
    .header .meta { font-size: 7px; color: #333; text-align: right; line-height: 1.4; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
    th { background: #222; color: #fff; padding: 2px 3px; font-size: 7px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; border: 1px solid #222; white-space: nowrap; }
    td { padding: 1px 3px; border: 1px solid #bbb; font-size: 8px; white-space: nowrap; }
    tbody tr:nth-child(odd) { background: #f5f5f5; }
    .totals-row td { background: #e5e5e5; font-weight: 700; border-top: 2px solid #111; font-size: 9px; }
    .footer { display: flex; gap: 10px; margin-top: 6px; }
    .footer-box { flex: 1; border: 1px solid #999; padding: 4px 6px; }
    .footer-box h4 { font-size: 7px; text-transform: uppercase; letter-spacing: 1px; color: #555; margin-bottom: 3px; border-bottom: 1px solid #ccc; padding-bottom: 2px; }
    .footer-box td { font-size: 8px; padding: 1px 4px; border: none; border-bottom: 1px solid #eee; }
    .signature { margin-top: 20px; display: flex; justify-content: space-around; }
    .sig-line { text-align: center; width: 180px; }
    .sig-line .line { border-top: 1px solid #111; margin-bottom: 2px; }
    .sig-line span { font-size: 7px; text-transform: uppercase; letter-spacing: 1px; color: #666; }
</style>
</head>
<body onload="setTimeout(()=>window.print(),300)">
<div class="header">
    <h1>Luxor Auto Hotel &mdash; Corte de Caja</h1>
    <div class="meta">
        <b>${employeeName}</b> &nbsp;|&nbsp; ${periodLabel} &nbsp;|&nbsp; ${entries.length} registros &nbsp;|&nbsp; Impreso: ${new Date().toLocaleString('es-MX')}
    </div>
</div>
<h2 style="font-size:10px;margin:6px 0 2px;padding:2px 4px;background:#1a5276;color:#fff;text-transform:uppercase;letter-spacing:1px;">&#x1F3E8; Habitaciones del Turno (${ownEntries.length})</h2>
<table>
    <thead>
        <tr>
            <th>#</th><th>Hora</th><th>Placas</th><th>Hab</th><th>Precio</th><th>Extra</th><th>Consumo</th><th>Daños</th><th>Total</th><th>Forma de Pago</th>
        </tr>
    </thead>
    <tbody>
        ${ownRows || '<tr><td colspan="10" style="text-align:center;color:#999;padding:4px;">Sin habitaciones en este turno</td></tr>'}
        <tr class="totals-row">
            <td colspan="4" style="text-align:right;letter-spacing:1px;">SUBTOTAL</td>
            <td style="text-align:right;font-family:monospace;">$${Number(ownTotals.roomPrice).toFixed(2)}</td>
            <td style="text-align:right;font-family:monospace;">$${Number(ownTotals.extra).toFixed(2)}</td>
            <td style="text-align:right;font-family:monospace;">$${Number(ownTotals.consumption).toFixed(2)}</td>
            <td style="text-align:right;font-family:monospace;">$${Number(ownTotals.damage).toFixed(2)}</td>
            <td style="text-align:right;font-family:monospace;font-size:10px;">$${Number(ownTotals.total).toFixed(2)}</td>
            <td></td>
        </tr>
    </tbody>
</table>
${otherEntries.length > 0 ? `
<h2 style="font-size:10px;margin:6px 0 2px;padding:2px 4px;background:#7d3c98;color:#fff;text-transform:uppercase;letter-spacing:1px;">&#x1F504; Servicios de Otros Turnos (${otherEntries.length}) &mdash; Renovaciones, Extras, Consumos</h2>
<table>
    <thead>
        <tr>
            <th>#</th><th>Hora</th><th>Placas</th><th>Hab</th><th>Precio</th><th>Extra</th><th>Consumo</th><th>Daños</th><th>Total</th><th>Forma de Pago</th>
        </tr>
    </thead>
    <tbody>
        ${otherRows}
        <tr class="totals-row">
            <td colspan="4" style="text-align:right;letter-spacing:1px;">SUBTOTAL</td>
            <td style="text-align:right;font-family:monospace;">$${Number(otherTotals.roomPrice).toFixed(2)}</td>
            <td style="text-align:right;font-family:monospace;">$${Number(otherTotals.extra).toFixed(2)}</td>
            <td style="text-align:right;font-family:monospace;">$${Number(otherTotals.consumption).toFixed(2)}</td>
            <td style="text-align:right;font-family:monospace;">$${Number(otherTotals.damage).toFixed(2)}</td>
            <td style="text-align:right;font-family:monospace;font-size:10px;">$${Number(otherTotals.total).toFixed(2)}</td>
            <td></td>
        </tr>
    </tbody>
</table>
` : ''}
<div style="margin-top:4px;padding:3px 6px;background:#222;color:#fff;font-size:9px;font-weight:700;display:flex;justify-content:space-between;">
    <span>TOTAL GENERAL (${entries.length} registros)</span>
    <span style="font-family:monospace;font-size:11px;">$${Number(totals.total).toFixed(2)}</span>
</div>
<div class="footer">
    <div class="footer-box">
        <h4>Desglose por M&eacute;todo de Pago</h4>
        <table style="margin:0;"><tbody>${breakdownRows}</tbody></table>
    </div>
    <div class="footer-box">
        <h4>Resumen</h4>
        <table style="margin:0;"><tbody>
            <tr><td>Habitaciones</td><td style="text-align:right;font-family:monospace;font-weight:600;">$${Number(totals.roomPrice).toFixed(2)}</td></tr>
            <tr><td>Extras</td><td style="text-align:right;font-family:monospace;font-weight:600;">$${Number(totals.extra).toFixed(2)}</td></tr>
            <tr><td>Consumo</td><td style="text-align:right;font-family:monospace;font-weight:600;">$${Number(totals.consumption).toFixed(2)}</td></tr>
            <tr><td>Daños</td><td style="text-align:right;font-family:monospace;font-weight:600;">$${Number(totals.damage).toFixed(2)}</td></tr>
            <tr><td style="font-weight:700;border-top:2px solid #111;">TOTAL VENTAS</td><td style="text-align:right;font-family:monospace;font-weight:700;font-size:10px;border-top:2px solid #111;">$${Number(totals.total).toFixed(2)}</td></tr>
            ${totalExpenses > 0 ? `<tr><td style="color:#dc2626;">Gastos del turno</td><td style="text-align:right;font-family:monospace;font-weight:600;color:#dc2626;">-$${totalExpenses.toFixed(2)}</td></tr>` : ''}
            ${totalEmployeeChargesCash > 0 ? `<tr><td style="color:#0891b2;">Cargos empleados (efectivo)</td><td style="text-align:right;font-family:monospace;font-weight:600;color:#0891b2;">+$${totalEmployeeChargesCash.toFixed(2)}</td></tr>` : ''}
            ${(totalExpenses > 0 || totalEmployeeChargesCash > 0) ? `<tr><td style="font-weight:700;border-top:2px solid #111;">EFECTIVO NETO</td><td style="text-align:right;font-family:monospace;font-weight:700;font-size:10px;border-top:2px solid #111;">$${(summary!.total_cash - totalExpenses + totalEmployeeChargesCash).toFixed(2)}</td></tr>` : ''}
        </tbody></table>
    </div>
</div>
${expenses.length > 0 ? `<div style="margin-top:6px;border:1px solid #999;padding:4px 6px;"><h4 style="font-size:7px;text-transform:uppercase;letter-spacing:1px;color:#555;margin-bottom:3px;border-bottom:1px solid #ccc;padding-bottom:2px;">Gastos del Turno</h4><table style="margin:0;width:100%;border-collapse:collapse;"><thead><tr><th style="background:#dc2626;color:#fff;padding:2px 3px;font-size:7px;text-align:left;">Hora — Tipo</th><th style="background:#dc2626;color:#fff;padding:2px 3px;font-size:7px;text-align:left;">Descripci&oacute;n</th><th style="background:#dc2626;color:#fff;padding:2px 3px;font-size:7px;text-align:right;">Monto</th></tr></thead><tbody>${expenseRows}</tbody></table></div>` : ''}
${employeeCharges.length > 0 ? (() => {
  const chargeRows = employeeCharges.map((c: any) =>
    `<tr><td style="padding:1px 4px;border:none;border-bottom:1px solid #eee;font-size:7px;">${c.time} — ${c.chargeType}</td><td style="padding:1px 4px;border:none;border-bottom:1px solid #eee;font-size:7px;">${c.employeeName}: ${c.description}</td><td style="padding:1px 4px;border:none;border-bottom:1px solid #eee;font-size:7px;">${c.paymentMethod}</td><td style="padding:1px 4px;text-align:right;font-weight:600;font-family:monospace;border:none;border-bottom:1px solid #eee;color:#0891b2;">$${c.total.toFixed(2)}</td></tr>`
  ).join('');
  return `<div style="margin-top:6px;border:1px solid #999;padding:4px 6px;"><h4 style="font-size:7px;text-transform:uppercase;letter-spacing:1px;color:#555;margin-bottom:3px;border-bottom:1px solid #ccc;padding-bottom:2px;">Cargos a Empleados</h4><table style="margin:0;width:100%;border-collapse:collapse;"><thead><tr><th style="background:#0891b2;color:#fff;padding:2px 3px;font-size:7px;text-align:left;">Hora — Tipo</th><th style="background:#0891b2;color:#fff;padding:2px 3px;font-size:7px;text-align:left;">Empleado / Desc.</th><th style="background:#0891b2;color:#fff;padding:2px 3px;font-size:7px;text-align:left;">Pago</th><th style="background:#0891b2;color:#fff;padding:2px 3px;font-size:7px;text-align:right;">Monto</th></tr></thead><tbody>${chargeRows}<tr><td colspan="3" style="padding:1px 4px;font-weight:700;border-top:2px solid #111;border:none;">TOTAL CARGOS</td><td style="padding:1px 4px;text-align:right;font-family:monospace;font-weight:700;font-size:10px;border-top:2px solid #111;border:none;color:#0891b2;">$${totalEmployeeCharges.toFixed(2)}</td></tr></tbody></table></div>`;
})() : ''}
<div class="signature">
    <div class="sig-line"><div class="line"></div><span>Recepcionista</span></div>
    <div class="sig-line"><div class="line"></div><span>Supervisor / Gerente</span></div>
</div>
</body>
</html>`;

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
