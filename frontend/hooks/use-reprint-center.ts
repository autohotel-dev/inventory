"use client";
import { apiClient } from "@/lib/api/client";

import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { useThermalPrinter } from "@/hooks/use-thermal-printer";
import { usePrintClosing } from "@/hooks/use-print-closing";

// ─── Types ───────────────────────────────────────────────────────────

export type TicketType = "entry" | "checkout" | "consumption" | "payment" | "closing" | "tolerance";

export interface ReprintableTicket {
  id: string;
  type: TicketType;
  date: string;               // ISO string
  roomNumber: string | null;
  description: string;
  amount: number;
  rawData: any;               // Datos originales para reconstruir el ticket
}

interface DateRange {
  from: Date;
  to: Date;
}

// ─── HP Income Report Helper (browser print dialog) ─────────────────

async function printHPIncomeReport(
  shiftSessionId: string,
  employeeName: string,
  periodStart: string,
  periodEnd: string
) {
  // 1. Find all sales_order_ids linked to this shift session
  const { data } = await apiClient.get(`/system/analytics/hp-income-report/${shiftSessionId}`) as any;
  const filteredStays = data?.stays || [];
  if (filteredStays.length === 0) {
    console.log('[HP Reprint] No sales orders for this shift — skipping income report');
    return;
  }
  
  const entries = filteredStays.map((stay: any, idx: number) => {
    const order = stay.sales_orders?.[0];
    let items = Array.isArray(order) ? (order[0]?.sales_order_items || []) : (order?.sales_order_items || []);
    items = items.filter((item: any) => item.shift_session_id === shiftSessionId);

    const rawOrderData = order ? (Array.isArray(order) ? order : [order]) : [];
    let allPayments: any[] = [];
    rawOrderData.forEach((o: any) => {
      if (o?.payments) allPayments.push(...(Array.isArray(o.payments) ? o.payments : [o.payments]));
    });
    allPayments = allPayments.filter((p: any) =>
      p.shift_session_id === shiftSessionId &&
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
        p.shift_session_id === shiftSessionId &&
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
  const totals = entries.reduce((acc: { roomPrice: number; extra: number; consumption: number; total: number }, e: typeof entries[0]) => ({
    roomPrice: acc.roomPrice + e.room_price,
    extra: acc.extra + e.extra,
    consumption: acc.consumption + e.consumption,
    total: acc.total + e.total,
  }), { roomPrice: 0, extra: 0, consumption: 0, total: 0 });

  // 6. Format period
  const fmtDate = (d: string) => {
    const dt = new Date(d);
    return {
      dateStr: dt.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      timeStr: dt.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
    };
  };
  const { dateStr: startDate, timeStr: startTime } = fmtDate(periodStart);
  const { dateStr: endDate, timeStr: endTime } = fmtDate(periodEnd);
  const periodLabel = `${startDate} ${startTime} — ${endDate} ${endTime}`;

  // 7. Build HTML table rows
  const tableRows = entries.map((e: typeof entries[0]) => {
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

  // 8. Open browser print window
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
<table>
    <thead>
        <tr>
            <th>#</th>
            <th>Hora</th>
            <th>Placas</th>
            <th>Hab</th>
            <th>Precio</th>
            <th>Extra</th>
            <th>Consumo</th>
            <th>Total</th>
            <th>Forma de Pago</th>
        </tr>
    </thead>
    <tbody>
        ${tableRows}
        <tr class="totals-row">
            <td colspan="4" style="text-align:right;letter-spacing:1px;">TOTAL</td>
            <td style="text-align:right;font-family:monospace;">$${Number(totals.roomPrice).toFixed(2)}</td>
            <td style="text-align:right;font-family:monospace;">$${Number(totals.extra).toFixed(2)}</td>
            <td style="text-align:right;font-family:monospace;">$${Number(totals.consumption).toFixed(2)}</td>
            <td style="text-align:right;font-family:monospace;font-size:10px;">$${Number(totals.total).toFixed(2)}</td>
            <td></td>
        </tr>
    </tbody>
</table>
<div class="footer">
    <div class="footer-box">
        <h4>Desglose por Método de Pago</h4>
        <table style="margin:0;"><tbody>${breakdownRows}</tbody></table>
    </div>
    <div class="footer-box">
        <h4>Resumen</h4>
        <table style="margin:0;"><tbody>
            <tr><td>Habitaciones</td><td style="text-align:right;font-family:monospace;font-weight:600;">$${Number(totals.roomPrice).toFixed(2)}</td></tr>
            <tr><td>Extras</td><td style="text-align:right;font-family:monospace;font-weight:600;">$${Number(totals.extra).toFixed(2)}</td></tr>
            <tr><td>Consumo</td><td style="text-align:right;font-family:monospace;font-weight:600;">$${Number(totals.consumption).toFixed(2)}</td></tr>
            <tr><td style="font-weight:700;border-top:2px solid #111;">TOTAL</td><td style="text-align:right;font-family:monospace;font-weight:700;font-size:10px;border-top:2px solid #111;">$${Number(totals.total).toFixed(2)}</td></tr>
        </tbody></table>
    </div>
</div>
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
  }
}

// ─── Hook ────────────────────────────────────────────────────────────

export function useReprintCenter() {
  const [tickets, setTickets] = useState<ReprintableTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState<string | null>(null); // ID del ticket que se está imprimiendo
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const now = new Date();
    const from = new Date(now);
    from.setHours(0, 0, 0, 0);
    const to = new Date(now);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  });
  const [typeFilter, setTypeFilter] = useState<TicketType | "all">("all");
  const [roomFilter, setRoomFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const {
    printEntryTicket,
    printCheckoutTicket,
    printConsumptionTickets,
    printPaymentTicket,
    printToleranceTicket,
    isPrinting,
  } = useThermalPrinter();
  const { printClosing } = usePrintClosing();

  // ─── Fetch All Tickets ──────────────────────────────────────────────

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get(`/system/analytics/reprint-tickets`, {
        params: { from_date: fromISO, to_date: toISO }
      }) as any;

      // Map backend data to old format to avoid breaking UI logic
      const mapRoom = (r: any) => ({ number: r.room_number, room_types: { name: r.room_type_name, base_price: r.base_price, extra_person_price: r.extra_person_price } });
      const mapOrder = (r: any, isCheck = false) => ({ 
        id: r.so_id, total: r.total, remaining_amount: r.remaining_amount,
        payments: data.extra_payments?.filter((p:any) => p.sales_order_id === r.so_id),
        sales_order_items: data.extra_items?.filter((i:any) => i.sales_order_id === r.so_id)
      });

      // 1. ENTRIES
      (data.entries || []).forEach((stay: any) => {
        const roomType = { name: stay.room_type_name, base_price: stay.base_price, extra_person_price: stay.extra_person_price };
        const order = mapOrder(stay);
        const firstPayment = order?.payments?.[0];
        const basePrice = roomType?.base_price || 0;
        const items = order?.sales_order_items || [];
        const extraPersonItems = items.filter((i: any) => i.concept_type === 'EXTRA_PERSON');
        const extraPeople = extraPersonItems.reduce((sum: number, i: any) => sum + (i.qty || 1), 0);
        const extraCost = extraPersonItems.reduce((sum: number, i: any) => sum + ((i.unit_price || 0) * (i.qty || 1)), 0);
        const totalPrice = basePrice + extraCost;

        if (roomFilter.trim() && stay.room_number !== roomFilter.trim()) return;

        allTickets.push({
          id: `entry-${stay.id}`,
          type: "entry",
          date: stay.check_in_at,
          roomNumber: stay.room_number || null,
          description: `Entrada - ${roomType?.name || "N/A"} - ${stay.total_people || 1} persona(s)`,
          amount: totalPrice,
          rawData: {
            roomNumber: stay.room_number || "N/A",
            roomTypeName: roomType?.name || "N/A",
            date: new Date(stay.check_in_at),
            people: stay.total_people || 1,
            vehiclePlate: stay.vehicle_plate || undefined,
            basePrice,
            extraPeopleCount: extraPeople,
            extraPeopleCost: extraCost,
            totalPrice,
            paymentMethod: firstPayment?.payment_method || "EFECTIVO",
            expectedCheckout: stay.expected_check_out_at ? new Date(stay.expected_check_out_at) : new Date(),
          },
        });
      });

      // 2. CHECKOUTS
      (data.checkouts || []).forEach((stay: any) => {
        if (roomFilter.trim() && stay.room_number !== roomFilter.trim()) return;
        const order = mapOrder(stay);
        const totalPaid = order?.payments?.reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0;

        allTickets.push({
          id: `checkout-${stay.id}`,
          type: "checkout",
          date: stay.actual_check_out_at,
          roomNumber: stay.room_number || null,
          description: `Salida - ${stay.room_type_name || "N/A"}`,
          amount: totalPaid,
          rawData: {
            roomNumber: stay.room_number || "N/A",
            folio: stay.sales_order_id?.substring(0, 8) || "",
            date: new Date(stay.actual_check_out_at),
            items: [],
            subtotal: totalPaid,
            total: totalPaid,
          },
        });
      });

      // 3. CONSUMPTIONS
      const grouped = new Map<string, any[]>();
      (data.consumptions || []).forEach((item: any) => {
        const orderId = item.so_id || "unknown";
        const timestamp = new Date(item.created_at).getTime();
        const bucketKey = `${orderId}-${Math.floor(timestamp / 120000)}`;
        if (!grouped.has(bucketKey)) grouped.set(bucketKey, []);
        grouped.get(bucketKey)!.push(item);
      });

      grouped.forEach((items, bucketKey) => {
        const first = items[0];
        const roomNum = first.room_number;
        if (roomFilter.trim() && roomNum !== roomFilter.trim()) return;

        const totalAmount = items.reduce((sum: number, i: any) => sum + (i.total || i.qty * i.unit_price || 0), 0);
        const itemNames = items.map((i: any) => `${i.qty}x ${i.product_name || "Producto"}`).join(", ");
        const folio = `COM-${new Date(first.created_at).getFullYear().toString().slice(-2)}${(new Date(first.created_at).getMonth() + 1).toString().padStart(2, "0")}${new Date(first.created_at).getDate().toString().padStart(2, "0")}-${bucketKey.substring(bucketKey.length - 4)}`;

        allTickets.push({
          id: `consumption-${bucketKey}`,
          type: "consumption",
          date: first.created_at,
          roomNumber: roomNum || null,
          description: `Consumo - ${itemNames}`,
          amount: totalAmount,
          rawData: {
            roomNumber: roomNum || "N/A",
            folio,
            date: new Date(first.created_at),
            items: items.map((i: any) => ({ name: i.product_name || "Producto", qty: i.qty, price: i.unit_price, total: i.total || i.qty * i.unit_price })),
            subtotal: totalAmount,
            total: totalAmount,
          },
        });
      });

      // 4. PAYMENTS
      (data.payments || []).forEach((payment: any) => {
        const roomNum = payment.room_number;
        if (roomFilter.trim() && roomNum !== roomFilter.trim()) return;

        allTickets.push({
          id: `payment-${payment.id}`,
          type: "payment",
          date: payment.created_at,
          roomNumber: roomNum || null,
          description: `Pago ${payment.payment_method} - ${payment.concept || "N/A"}`,
          amount: payment.amount,
          rawData: {
            roomNumber: roomNum || undefined,
            date: new Date(payment.created_at),
            items: [{ name: payment.product_name || payment.concept_type || "Servicio", qty: payment.qty || 1, total: (payment.qty || 1) * (payment.unit_price || 0) }],
            total: payment.amount,
            paymentMethod: payment.payment_method || "EFECTIVO",
          },
        });
      });

      // 5. CLOSINGS
      (data.closings || []).forEach((closing: any) => {
        const empName = `${closing.first_name || ""} ${closing.last_name || ""}`.trim();
        const shiftName = closing.shift_name || "Turno";

        allTickets.push({
          id: `closing-${closing.id}`,
          type: "closing",
          date: closing.period_end,
          roomNumber: null,
          description: `Corte de Caja - ${shiftName} - ${empName}`,
          amount: closing.total_sales || 0,
          rawData: {
            closingId: closing.id,
            shiftSessionId: closing.shift_session_id,
            employeeName: empName,
            shiftName,
            periodStart: closing.period_start,
            periodEnd: closing.period_end,
            totalCash: closing.total_cash || 0,
            totalCardBBVA: closing.total_card_bbva || 0,
            totalCardGetnet: closing.total_card_getnet || 0,
            totalSales: closing.total_sales || 0,
            totalTransactions: closing.total_transactions || 0,
            countedCash: closing.counted_cash || 0,
            cashDifference: closing.cash_difference || 0,
            notes: closing.notes || undefined,
            transactions: [],
          },
        });
      });

      // Sort all by date descending
      allTickets.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTickets(allTickets);
      setSelectedIds(new Set());

    } catch (err) {
      console.error("[Reprint] Error general:", err);
      toast.error("Error al cargar tickets", { description: "Intente de nuevo" });
    } finally {
      setLoading(false);
    }
  }, [dateRange, roomFilter]);

  // ─── Filtered Tickets ───────────────────────────────────────────────

  const filteredTickets = useMemo(() => {
    if (typeFilter === "all") return tickets;
    return tickets.filter(t => t.type === typeFilter);
  }, [tickets, typeFilter]);

  // ─── Reprint Single Ticket ──────────────────────────────────────────

  const reprintTicket = useCallback(async (ticket: ReprintableTicket): Promise<boolean> => {
    setPrinting(ticket.id);
    try {
      switch (ticket.type) {
        case "entry":
          return await printEntryTicket(ticket.rawData);

        case "checkout":
          return await printCheckoutTicket(ticket.rawData);

        case "consumption":
          return await printConsumptionTickets(ticket.rawData);

        case "payment":
          return await printPaymentTicket(ticket.rawData);

        case "tolerance":
          return await printToleranceTicket(ticket.rawData);

        case "closing": {
          // For closings, we need to load transactions on demand
          const closingId = ticket.rawData.closingId;
          const { data } = await apiClient.get(`/hr/shift-closings/${closingId}/details`) as any;
          const details = data?.details;

          const transactions = (details || []).map((detail: any) => {
            const payment = detail.payments;
            if (!payment) return null;
            return {
              time: new Date(payment.created_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
              amount: payment.amount,
              paymentMethod: detail.payment_method || payment.payment_method || "N/A",
              terminalCode: detail.terminal_code || payment.payment_terminals?.code || payment.terminal_code,
              reference: payment.reference || undefined,
              concept: payment.concept || undefined,
            };
          }).filter(Boolean);

          // 1. Print thermal ticket only
          return await printClosing({
            ...ticket.rawData,
            transactions,
          });
        }

        default:
          toast.error("Tipo de ticket no soportado");
          return false;
      }
    } catch (err) {
      console.error("[Reprint] Error:", err);
      toast.error("Error al reimprimir ticket");
      return false;
    } finally {
      setPrinting(null);
    }
  }, [printEntryTicket, printCheckoutTicket, printConsumptionTickets, printPaymentTicket, printToleranceTicket, printClosing]);

  // ─── Reprint HP Income Report Only (for closing tickets) ────────────

  const reprintHPOnly = useCallback(async (ticket: ReprintableTicket): Promise<boolean> => {
    if (ticket.type !== "closing" || !ticket.rawData.shiftSessionId) {
      toast.error("Solo disponible para cortes de caja");
      return false;
    }
    setPrinting(ticket.id);
    try {
      await printHPIncomeReport(
        ticket.rawData.shiftSessionId,
        ticket.rawData.employeeName,
        ticket.rawData.periodStart,
        ticket.rawData.periodEnd
      );
      toast.success("Reporte de ingresos enviado a impresora HP");
      return true;
    } catch (err) {
      console.error("[Reprint HP] Error:", err);
      toast.error("Error al reimprimir en HP");
      return false;
    } finally {
      setPrinting(null);
    }
  }, []);

  // ─── Reprint Selected ──────────────────────────────────────────────

  const reprintSelected = useCallback(async () => {
    if (selectedIds.size === 0) {
      toast.warning("Selecciona al menos un ticket");
      return;
    }

    const selected = filteredTickets.filter(t => selectedIds.has(t.id));
    let successCount = 0;
    let failCount = 0;

    for (const ticket of selected) {
      const ok = await reprintTicket(ticket);
      if (ok) successCount++;
      else failCount++;
      // Small delay between prints
      await new Promise(r => setTimeout(r, 1500));
    }

    if (failCount === 0) {
      toast.success(`${successCount} ticket(s) reimpresos`);
    } else {
      toast.warning(`${successCount} impresos, ${failCount} con errores`);
    }
  }, [selectedIds, filteredTickets, reprintTicket]);

  // ─── Selection ─────────────────────────────────────────────────────

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredTickets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTickets.map(t => t.id)));
    }
  }, [selectedIds, filteredTickets]);

  // ─── Helpers ───────────────────────────────────────────────────────

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount);

  const typeLabels: Record<TicketType, { label: string; emoji: string; color: string }> = {
    entry: { label: "Entrada", emoji: "🚪", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    checkout: { label: "Salida", emoji: "🚶", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
    consumption: { label: "Consumo", emoji: "🛒", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
    payment: { label: "Pago", emoji: "💰", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
    closing: { label: "Corte", emoji: "📋", color: "bg-rose-500/20 text-rose-400 border-rose-500/30" },
    tolerance: { label: "Tolerancia", emoji: "⏳", color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
  };

  return {
    // State
    tickets: filteredTickets,
    allTickets: tickets,
    loading,
    printing,
    dateRange,
    typeFilter,
    roomFilter,
    selectedIds,
    isPrinting,
    // Setters
    setDateRange,
    setTypeFilter,
    setRoomFilter,
    // Actions
    fetchTickets,
    reprintTicket,
    reprintHPOnly,
    reprintSelected,
    toggleSelection,
    toggleSelectAll,
    // Helpers
    formatCurrency,
    typeLabels,
  };
}
