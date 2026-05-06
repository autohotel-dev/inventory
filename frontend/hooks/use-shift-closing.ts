/**
 * Hook for shift closing: loads payment summary, saves closing, and prints reports.
 * Extracted from shift-closing.tsx (ShiftClosingModal).
 */
"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { apiClient } from "@/lib/api/client";
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

// ─── Build granular breakdowns from accrual items for thermal ticket ─────
function buildTicketBreakdowns(accrualItems: any[]) {
  const roomBreakdown: Record<string, { count: number; total: number }> = {};
  const extraBreakdown: Record<string, { count: number; total: number }> = {};
  const consumptionBreakdown: Record<string, { count: number; total: number }> = {};

  (accrualItems || []).forEach((item: any) => {
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
    } else if (["EXTRA_PERSON", "EXTRA_HOUR", "RENEWAL", "PROMO_4H"].includes(conceptType)) {
      const label = CONCEPT_LABELS[conceptType] || conceptType;
      if (!extraBreakdown[label]) extraBreakdown[label] = { count: 0, total: 0 };
      extraBreakdown[label].count += qty;
      extraBreakdown[label].total += amount;
    } else if (["CONSUMPTION", "PRODUCT", "RESTAURANT"].includes(conceptType)) {
      const product = Array.isArray(item.products) ? item.products[0] : item.products;
      const productName = product?.name || "Producto";
      if (!consumptionBreakdown[productName]) consumptionBreakdown[productName] = { count: 0, total: 0 };
      consumptionBreakdown[productName].count += qty;
      consumptionBreakdown[productName].total += amount;
    }
  });

  return { roomBreakdown, extraBreakdown, consumptionBreakdown };
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
      const response = await apiClient.get(`/hr/closings/${session.id}/summary`);
      setSummary(response.data);
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
    if (savingLockRef.current) return;
    savingLockRef.current = true;
    if (summary.total_transactions === 0) { showError("Error", "No hay transacciones en este turno para crear un corte"); savingLockRef.current = false; return; }

    setSaving(true);
    try {
      const payload = {
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
        counted_cash: summary.total_cash,
        cash_difference: 0,
        declared_card_bbva: summary.total_card_bbva,
        declared_card_getnet: summary.total_card_getnet,
        card_difference_bbva: 0,
        card_difference_getnet: 0,
        notes: notes.trim() || null,
        status: "pending",
        details: summary.payments.map((p: any) => ({
          payment_id: p.id,
          sales_order_id: p.sales_order_id,
          amount: p.amount,
          payment_method: p.payment_method,
          terminal_code: p.payment_terminals?.code || null
        }))
      };

      await apiClient.post('/hr/closings', payload);

      success("Corte completado", "El corte de caja se ha registrado correctamente");

      handlePrintClosing();
      handlePrintHP();

      onComplete();
    } catch (err: any) {
      console.error("Error saving closing:", err);
      showError("Error", err.response?.data?.detail || err.message || "No se pudo guardar el corte");
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
              ;
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

      // 1. Find all sales_order_ids linked to this shift session
      const [{ data: shiftItems }, { data: shiftPayments }] = await Promise.all([
        apiClient.get("/system/crud/sales_order_items").then(res => ({ data: res.data, error: null })),
        apiClient.get("/system/crud/payments").then(res => ({ data: res.data, error: null })),
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
        ;

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
