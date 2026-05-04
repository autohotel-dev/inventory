"use client";

import { useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
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

// ─── HP Income Report Helper ─────────────────────────────────────────

async function printHPIncomeReport(
  supabase: any,
  shiftSessionId: string,
  employeeName: string,
  periodStart: string,
  periodEnd: string
) {
  // 1. Find all sales_order_ids linked to this shift session
  const [{ data: shiftItems }, { data: shiftPayments }] = await Promise.all([
    supabase.from("sales_order_items").select("sales_order_id").eq("shift_session_id", shiftSessionId),
    supabase.from("payments").select("sales_order_id").eq("shift_session_id", shiftSessionId),
  ]);

  const ids = new Set<string>();
  (shiftItems || []).forEach((i: any) => i.sales_order_id && ids.add(i.sales_order_id));
  (shiftPayments || []).forEach((p: any) => p.sales_order_id && ids.add(p.sales_order_id));
  const salesOrderIds = Array.from(ids);

  if (salesOrderIds.length === 0) {
    console.log('[HP Reprint] No sales orders for this shift — skipping income report');
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
  const entries = filteredStays.map((stay: any) => {
    const order = stay.sales_orders;
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
      time: stay.check_in_at ? new Date(stay.check_in_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
      vehicle_plate: stay.vehicle_plate || '',
      room_number: stay.rooms?.number || '',
      checkout_valet_name: valetName,
      room_price: roomPrice,
      extra,
      consumption,
      total: roomPrice + extra + consumption,
      payment_method: paymentMethod,
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

  // 5. Send PDF to HP printer via print server (silent print)
  const PRINT_SERVER_URL = process.env.NEXT_PUBLIC_PRINT_SERVER_URL || 'http://localhost:3001';
  const response = await fetch(`${PRINT_SERVER_URL}/print/hp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'income',
      data: { employeeName, periodStart, periodEnd, entries, paymentBreakdown },
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    console.error('[HP Reprint] Error:', err);
  } else {
    console.log('[HP Reprint] Income report PDF sent to HP printer');
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
    const supabase = createClient();
    const allTickets: ReprintableTicket[] = [];

    const fromISO = dateRange.from.toISOString();
    const toISO = dateRange.to.toISOString();

    try {
      // 1. ENTRIES (Check-ins)
      {
        let query = supabase
          .from("room_stays")
          .select("id, check_in_at, expected_check_out_at, current_people, total_people, vehicle_plate, vehicle_brand, vehicle_model, tolerance_started_at, tolerance_type, rooms!inner(number, room_types(name, base_price, extra_person_price)), sales_orders(id, total, remaining_amount, payments(id, amount, payment_method))")
          .gte("check_in_at", fromISO)
          .lte("check_in_at", toISO)
          .in("status", ["ACTIVA", "FINALIZADA"])
          .order("check_in_at", { ascending: false });

        if (roomFilter.trim()) {
          query = query.eq("rooms.number", roomFilter.trim());
        }

        const { data, error } = await query;
        if (error) console.error("[Reprint] Error fetching entries:", error);

        (data || []).forEach((stay: any) => {
          const room = Array.isArray(stay.rooms) ? stay.rooms[0] : stay.rooms;
          const roomType = room?.room_types;
          const order = Array.isArray(stay.sales_orders) ? stay.sales_orders[0] : stay.sales_orders;
          const firstPayment = order?.payments?.[0];
          const basePrice = roomType?.base_price || 0;
          const extraPeople = Math.max(0, (stay.total_people || 1) - 1);
          const extraCost = extraPeople * (roomType?.extra_person_price || 0);
          const totalPrice = basePrice + extraCost;

          allTickets.push({
            id: `entry-${stay.id}`,
            type: "entry",
            date: stay.check_in_at,
            roomNumber: room?.number || null,
            description: `Entrada - ${roomType?.name || "N/A"} - ${stay.total_people || 1} persona(s)`,
            amount: totalPrice,
            rawData: {
              roomNumber: room?.number || "N/A",
              roomTypeName: roomType?.name || "N/A",
              date: new Date(stay.check_in_at),
              people: stay.total_people || 1,
              vehiclePlate: stay.vehicle_plate || undefined,
              vehicleBrand: stay.vehicle_brand || undefined,
              vehicleModel: stay.vehicle_model || undefined,
              basePrice,
              extraPeopleCount: extraPeople,
              extraPeopleCost: extraCost,
              totalPrice,
              paymentMethod: firstPayment?.payment_method || "EFECTIVO",
              expectedCheckout: stay.expected_check_out_at ? new Date(stay.expected_check_out_at) : new Date(),
            },
          });
        });
      }

      // 2. CHECKOUTS
      {
        let query = supabase
          .from("room_stays")
          .select("id, check_in_at, actual_check_out_at, total_people, vehicle_plate, sales_order_id, rooms!inner(number, room_types(name)), sales_orders(id, total, remaining_amount, payments(id, amount, payment_method, created_at)), checkout_valet_employee_id, valet_employee_id")
          .not("actual_check_out_at", "is", null)
          .gte("actual_check_out_at", fromISO)
          .lte("actual_check_out_at", toISO)
          .eq("status", "FINALIZADA")
          .order("actual_check_out_at", { ascending: false });

        if (roomFilter.trim()) {
          query = query.eq("rooms.number", roomFilter.trim());
        }

        const { data, error } = await query;
        if (error) console.error("[Reprint] Error fetching checkouts:", error);

        (data || []).forEach((stay: any) => {
          const room = Array.isArray(stay.rooms) ? stay.rooms[0] : stay.rooms;
          const order = Array.isArray(stay.sales_orders) ? stay.sales_orders[0] : stay.sales_orders;
          const totalPaid = order?.payments?.reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0;

          allTickets.push({
            id: `checkout-${stay.id}`,
            type: "checkout",
            date: stay.actual_check_out_at,
            roomNumber: room?.number || null,
            description: `Salida - ${room?.room_types?.name || "N/A"}`,
            amount: totalPaid,
            rawData: {
              roomNumber: room?.number || "N/A",
              folio: stay.sales_order_id?.substring(0, 8) || "",
              date: new Date(stay.actual_check_out_at),
              items: [],
              subtotal: totalPaid,
              total: totalPaid,
            },
          });
        });
      }

      // 3. CONSUMPTIONS
      {
        const { data, error } = await supabase
          .from("sales_order_items")
          .select("id, qty, unit_price, total, created_at, concept_type, is_courtesy, products(name), sales_orders!inner(id, room_stays(rooms(number)))")
          .eq("concept_type", "CONSUMPTION")
          .gte("created_at", fromISO)
          .lte("created_at", toISO)
          .order("created_at", { ascending: false });

        if (error) console.error("[Reprint] Error fetching consumptions:", error);

        // Group consumptions by sales_order_id + approximate time (within 2 minutes)
        const grouped = new Map<string, any[]>();
        (data || []).forEach((item: any) => {
          const order = Array.isArray(item.sales_orders) ? item.sales_orders[0] : item.sales_orders;
          const orderId = order?.id || "unknown";
          const timestamp = new Date(item.created_at).getTime();
          const bucketKey = `${orderId}-${Math.floor(timestamp / 120000)}`; // 2-min buckets

          if (!grouped.has(bucketKey)) grouped.set(bucketKey, []);
          grouped.get(bucketKey)!.push(item);
        });

        grouped.forEach((items, bucketKey) => {
          const first = items[0];
          const order = Array.isArray(first.sales_orders) ? first.sales_orders[0] : first.sales_orders;
          const roomStay = order?.room_stays?.[0];
          const room = roomStay?.rooms;
          const roomNum = Array.isArray(room) ? room[0]?.number : room?.number;

          // Filter by room if needed
          if (roomFilter.trim() && roomNum !== roomFilter.trim()) return;

          const totalAmount = items.reduce((sum: number, i: any) => sum + (i.total || i.qty * i.unit_price || 0), 0);
          const itemNames = items.map((i: any) => {
            const prod = Array.isArray(i.products) ? i.products[0] : i.products;
            return `${i.qty}x ${prod?.name || "Producto"}`;
          }).join(", ");

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
              items: items.map((i: any) => {
                const prod = Array.isArray(i.products) ? i.products[0] : i.products;
                return {
                  name: prod?.name || "Producto",
                  qty: i.qty,
                  price: i.unit_price,
                  total: i.total || i.qty * i.unit_price,
                };
              }),
              subtotal: totalAmount,
              total: totalAmount,
            },
          });
        });
      }

      // 4. PAYMENTS
      {
        const { data, error } = await supabase
          .from("payments")
          .select("id, amount, payment_method, concept, created_at, status, sales_order_id, sales_orders(id, room_stays(rooms(number)), sales_order_items(id, qty, unit_price, concept_type, products(name)))")
          .eq("status", "confirmed")
          .gte("created_at", fromISO)
          .lte("created_at", toISO)
          .order("created_at", { ascending: false });

        if (error) console.error("[Reprint] Error fetching payments:", error);

        (data || []).forEach((payment: any) => {
          const order = Array.isArray(payment.sales_orders) ? payment.sales_orders[0] : payment.sales_orders;
          const roomStay = order?.room_stays?.[0];
          const room = roomStay?.rooms;
          const roomNum = Array.isArray(room) ? room[0]?.number : room?.number;

          // Filter by room if needed
          if (roomFilter.trim() && roomNum !== roomFilter.trim()) return;

          const items = order?.sales_order_items || [];
          const paymentItems = items.map((i: any) => {
            const prod = Array.isArray(i.products) ? i.products[0] : i.products;
            return {
              name: prod?.name || i.concept_type || "Servicio",
              qty: i.qty || 1,
              total: i.qty * i.unit_price || 0,
            };
          });

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
              items: paymentItems,
              total: payment.amount,
              paymentMethod: payment.payment_method || "EFECTIVO",
              remainingAmount: undefined,
            },
          });
        });
      }

      // 5. SHIFT CLOSINGS
      {
        const { data, error } = await supabase
          .from("shift_closings")
          .select("id, period_start, period_end, total_cash, total_card_bbva, total_card_getnet, total_sales, total_transactions, counted_cash, cash_difference, notes, status, employee_id, shift_session_id, employees(first_name, last_name), shift_definitions(name)")
          .in("status", ["pending", "approved", "rejected"])
          .gte("period_end", fromISO)
          .lte("period_end", toISO)
          .order("period_end", { ascending: false });

        if (error) console.error("[Reprint] Error fetching closings:", error);

        (data || []).forEach((closing: any) => {
          const empName = `${closing.employees?.first_name || ""} ${closing.employees?.last_name || ""}`.trim();
          const shiftName = closing.shift_definitions?.name || "Turno";

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
              transactions: [], // Will be loaded on demand
            },
          });
        });
      }

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
          const supabase = createClient();
          const closingId = ticket.rawData.closingId;
          const { data: details } = await supabase
            .from("shift_closing_details")
            .select("*, payments(id, amount, payment_method, reference, concept, terminal_code, created_at, payment_terminals(code, name))")
            .eq("shift_closing_id", closingId)
            .order("created_at", { ascending: true });

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
      const supabase = createClient();
      await printHPIncomeReport(
        supabase,
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
