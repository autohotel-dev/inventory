"use client";

import { useEffect, useMemo, useState } from "react";
import { useReprintCenter, type TicketType, type ReprintableTicket } from "@/hooks/use-reprint-center";
import { TicketPreviewModal } from "@/components/print-center/ticket-preview-modal";
import { createClient } from "@/lib/supabase/client";

export default function ReprintPage() {
  const {
    tickets,
    allTickets,
    loading,
    printing,
    dateRange,
    typeFilter,
    roomFilter,
    selectedIds,
    isPrinting,
    setDateRange,
    setTypeFilter,
    setRoomFilter,
    fetchTickets,
    reprintTicket,
    reprintHPOnly,
    reprintSelected,
    toggleSelection,
    toggleSelectAll,
    formatCurrency,
    typeLabels,
  } = useReprintCenter();

  // Preview modal state
  const [previewTicket, setPreviewTicket] = useState<ReprintableTicket | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  const openPreview = async (ticket: ReprintableTicket) => {
    // For closing tickets, load full transaction details + breakdowns from DB
    if (ticket.type === "closing" && ticket.rawData.closingId) {
      setPreviewTicket(ticket);
      setPreviewOpen(true);
      setPreviewLoading(true);

      try {
        const supabase = createClient();

        // 1. Load transaction details with concept & room info
        const { data: details } = await supabase
          .from("shift_closing_details")
          .select("*, payments(id, amount, payment_method, reference, concept, terminal_code, created_at, sales_order_id, payment_terminals(code, name), sales_orders(id, room_stays(rooms(number))))")
          .eq("shift_closing_id", ticket.rawData.closingId)
          .order("created_at", { ascending: true });

        const transactions = (details || []).map((detail: any) => {
          const payment = detail.payments;
          if (!payment) return null;

          // Extract room number from payment -> sales_orders -> room_stays -> rooms
          const order = Array.isArray(payment.sales_orders) ? payment.sales_orders[0] : payment.sales_orders;
          const roomStay = order?.room_stays?.[0] || (Array.isArray(order?.room_stays) ? order.room_stays[0] : order?.room_stays);
          const room = roomStay?.rooms;
          const roomNumber = Array.isArray(room) ? room[0]?.number : room?.number;

          // Map concept labels
          const CONCEPT_DISPLAY: Record<string, string> = {
            ESTANCIA: "Estancia",
            CONSUMPTION: "Consumo",
            EXTRA_PERSON: "Pers. Extra",
            EXTRA_HOUR: "Hora Extra",
            RENEWAL: "Renovación",
            CHECKOUT: "Salida",
            ROOM_BASE: "Habitación",
            PROMO_4H: "Promo 4H",
          };

          const rawConcept = payment.concept || "";
          const conceptLabel = CONCEPT_DISPLAY[rawConcept] || rawConcept || undefined;

          return {
            time: new Date(payment.created_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
            amount: payment.amount,
            paymentMethod: detail.payment_method || payment.payment_method || "N/A",
            terminalCode: detail.terminal_code || payment.payment_terminals?.code || payment.terminal_code,
            reference: payment.reference || undefined,
            concept: conceptLabel,
            roomNumber: roomNumber || undefined,
          };
        }).filter(Boolean);

        // 2. Load shift expenses
        const shiftSessionId = ticket.rawData.shiftSessionId;
        let expenses: any[] = [];
        let totalExpenses = 0;

        if (shiftSessionId) {
          const { data: expenseData } = await supabase
            .from("shift_expenses")
            .select("*")
            .eq("shift_session_id", shiftSessionId)
            .neq("status", "rejected")
            .order("created_at", { ascending: true });

          expenses = (expenseData || []).map((exp: any) => ({
            time: new Date(exp.created_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
            type: exp.expense_type,
            description: exp.description,
            amount: Number(exp.amount),
            recipient: exp.recipient,
          }));
          totalExpenses = expenses.reduce((sum: number, e: any) => sum + e.amount, 0);
        }

        // 3. Load accrual items to build breakdowns (room types, extras, consumptions)
        let roomBreakdown: Record<string, { count: number; total: number }> = {};
        let extraBreakdown: Record<string, { count: number; total: number }> = {};
        let consumptionBreakdown: Record<string, { count: number; total: number }> = {};

        if (shiftSessionId) {
          const { data: accrualItems } = await supabase
            .from("sales_order_items")
            .select("id, qty, unit_price, concept_type, products(name), sales_orders(id, room_stays(status, rooms(number, room_types(name))))")
            .eq("shift_session_id", shiftSessionId);

          const CONCEPT_LABELS: Record<string, string> = {
            ROOM_BASE: "Habitación", EXTRA_HOUR: "Hora Extra", EXTRA_PERSON: "Persona Extra",
            CONSUMPTION: "Consumo", PRODUCT: "Producto", RENEWAL: "Renovación", PROMO_4H: "Promo 4H",
          };

          // Filter out cancelled stays
          const activeItems = (accrualItems || []).filter((item: any) => {
            const order = Array.isArray(item.sales_orders) ? item.sales_orders[0] : item.sales_orders;
            const roomStay = Array.isArray(order?.room_stays) ? order.room_stays[0] : order?.room_stays;
            return !roomStay || roomStay.status !== "CANCELADA";
          });

          activeItems.forEach((item: any) => {
            const qty = item.qty || 1;
            const amount = (item.unit_price || 0) * qty;
            const conceptType = item.concept_type || "PRODUCT";

            if (conceptType === "ROOM_BASE") {
              const order = Array.isArray(item.sales_orders) ? item.sales_orders[0] : item.sales_orders;
              const roomStay = Array.isArray(order?.room_stays) ? order.room_stays[0] : order?.room_stays;
              const room = roomStay?.rooms;
              const roomType = Array.isArray(room?.room_types) ? room.room_types[0] : room?.room_types;
              const typeName = roomType?.name || "Sin tipo";

              if (!roomBreakdown[typeName]) roomBreakdown[typeName] = { count: 0, total: 0 };
              roomBreakdown[typeName].count += qty;
              roomBreakdown[typeName].total += amount;
            } else if (["EXTRA_PERSON", "EXTRA_HOUR", "RENEWAL", "PROMO_4H"].includes(conceptType)) {
              const label = CONCEPT_LABELS[conceptType] || conceptType;
              // Extract room number for extras
              const orderEx = Array.isArray(item.sales_orders) ? item.sales_orders[0] : item.sales_orders;
              const roomStayEx = Array.isArray(orderEx?.room_stays) ? orderEx.room_stays[0] : orderEx?.room_stays;
              const roomEx = roomStayEx?.rooms;
              const roomNumEx = Array.isArray(roomEx) ? roomEx[0]?.number : roomEx?.number;
              const extraLabel = roomNumEx ? `${label} · Hab ${roomNumEx}` : label;
              if (!extraBreakdown[extraLabel]) extraBreakdown[extraLabel] = { count: 0, total: 0 };
              extraBreakdown[extraLabel].count += qty;
              extraBreakdown[extraLabel].total += amount;
            } else if (["CONSUMPTION", "PRODUCT", "RESTAURANT"].includes(conceptType)) {
              const product = Array.isArray(item.products) ? item.products[0] : item.products;
              const productName = product?.name || "Producto";
              if (!consumptionBreakdown[productName]) consumptionBreakdown[productName] = { count: 0, total: 0 };
              consumptionBreakdown[productName].count += qty;
              consumptionBreakdown[productName].total += amount;
            }
          });
        }

        // Update the preview ticket with all loaded data
        setPreviewTicket({
          ...ticket,
          rawData: {
            ...ticket.rawData,
            transactions,
            roomBreakdown,
            extraBreakdown,
            consumptionBreakdown,
            expenses,
            totalExpenses,
          },
        });
      } catch (err) {
        console.error("[Preview] Error loading closing details:", err);
      } finally {
        setPreviewLoading(false);
      }
    } else {
      setPreviewTicket(ticket);
      setPreviewOpen(true);
    }
  };

  const closePreview = () => {
    setPreviewOpen(false);
    setTimeout(() => setPreviewTicket(null), 200);
  };

  // Auto-fetch on mount and filter changes
  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Stats
  const stats = useMemo(() => {
    const byType: Record<string, number> = {};
    allTickets.forEach((t) => {
      byType[t.type] = (byType[t.type] || 0) + 1;
    });
    return byType;
  }, [allTickets]);

  const allSelected = tickets.length > 0 && selectedIds.size === tickets.length;

  return (
    <div className="container mx-auto px-2 sm:px-4 md:py-6 py-4 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect width="12" height="8" x="6" y="14" />
              </svg>
            </div>
            Centro de Reimpresión
          </h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Reimprimir tickets de entradas, salidas, consumos, pagos y cortes
          </p>
        </div>

        {/* Batch reprint button */}
        {selectedIds.size > 0 && (
          <button
            onClick={reprintSelected}
            disabled={isPrinting}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium text-sm shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect width="12" height="8" x="6" y="14" />
            </svg>
            Reimprimir {selectedIds.size} ticket{selectedIds.size > 1 ? "s" : ""}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-white/[0.06] bg-card/50 backdrop-blur-sm p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Filtros</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Date From */}
          <div className="relative p-3 rounded-xl border bg-muted/30 border-border/50 transition-all focus-within:ring-2 focus-within:ring-amber-500/20">
            <label className="flex items-center gap-2 text-xs font-medium mb-2 text-muted-foreground">
              <div className="p-1 rounded-md bg-amber-500/10 text-amber-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                  <line x1="16" x2="16" y1="2" y2="6" />
                  <line x1="8" x2="8" y1="2" y2="6" />
                  <line x1="3" x2="21" y1="10" y2="10" />
                </svg>
              </div>
              Desde
            </label>
            <input
              type="date"
              value={dateRange.from.toISOString().split("T")[0]}
              onChange={(e) => {
                if (e.target.value) {
                  const d = new Date(e.target.value + "T00:00:00");
                  setDateRange((prev) => ({ ...prev, from: d }));
                }
              }}
              className="w-full rounded-lg border-0 bg-background/90 px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500/30 focus:outline-none"
            />
          </div>

          {/* Date To */}
          <div className="relative p-3 rounded-xl border bg-muted/30 border-border/50 transition-all focus-within:ring-2 focus-within:ring-amber-500/20">
            <label className="flex items-center gap-2 text-xs font-medium mb-2 text-muted-foreground">
              <div className="p-1 rounded-md bg-amber-500/10 text-amber-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                  <line x1="16" x2="16" y1="2" y2="6" />
                  <line x1="8" x2="8" y1="2" y2="6" />
                  <line x1="3" x2="21" y1="10" y2="10" />
                </svg>
              </div>
              Hasta
            </label>
            <input
              type="date"
              value={dateRange.to.toISOString().split("T")[0]}
              onChange={(e) => {
                if (e.target.value) {
                  const d = new Date(e.target.value + "T23:59:59");
                  setDateRange((prev) => ({ ...prev, to: d }));
                }
              }}
              className="w-full rounded-lg border-0 bg-background/90 px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500/30 focus:outline-none"
            />
          </div>

          {/* Type Filter */}
          <div className="relative p-3 rounded-xl border bg-muted/30 border-border/50 transition-all focus-within:ring-2 focus-within:ring-amber-500/20">
            <label className="flex items-center gap-2 text-xs font-medium mb-2 text-muted-foreground">
              <div className="p-1 rounded-md bg-purple-500/10 text-purple-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              Tipo de Ticket
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TicketType | "all")}
              className="w-full rounded-lg border-0 bg-background/90 px-3 py-2 text-sm appearance-none cursor-pointer focus:ring-2 focus:ring-purple-500/30 focus:outline-none"
            >
              <option value="all">Todos los tipos</option>
              <option value="entry">🚪 Entradas</option>
              <option value="checkout">🚶 Salidas</option>
              <option value="consumption">🛒 Consumos</option>
              <option value="payment">💰 Pagos</option>
              <option value="closing">📋 Cortes de Caja</option>
            </select>
          </div>

          {/* Room Filter */}
          <div className="relative p-3 rounded-xl border bg-muted/30 border-border/50 transition-all focus-within:ring-2 focus-within:ring-amber-500/20">
            <label className="flex items-center gap-2 text-xs font-medium mb-2 text-muted-foreground">
              <div className="p-1 rounded-md bg-cyan-500/10 text-cyan-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 4h3a2 2 0 0 1 2 2v14" />
                  <path d="M2 20h3" />
                  <path d="M13 20h9" />
                  <path d="M10 12v.01" />
                  <path d="M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4-1A2 2 0 0 1 13 4.561Z" />
                </svg>
              </div>
              Habitación
            </label>
            <input
              type="text"
              value={roomFilter}
              onChange={(e) => setRoomFilter(e.target.value)}
              placeholder="Ej: 101"
              className="w-full rounded-lg border-0 bg-background/90 px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500/30 focus:outline-none"
            />
          </div>
        </div>

        {/* Search Button */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" x2="12" y1="16" y2="12" />
              <line x1="12" x2="12.01" y1="8" y2="8" />
            </svg>
            {allTickets.length > 0 ? (
              <span>{allTickets.length} ticket(s) encontrados</span>
            ) : (
              <span>Presiona Buscar para cargar los tickets</span>
            )}
          </div>
          <button
            onClick={fetchTickets}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-medium text-sm shadow-lg shadow-blue-500/20 hover:shadow-blue-500/35 transition-all duration-200 disabled:opacity-50"
          >
            {loading ? (
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            )}
            {loading ? "Buscando..." : "Buscar"}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {allTickets.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          {(Object.entries(typeLabels) as [TicketType, { label: string; emoji: string; color: string }][]).map(([type, info]) => (
            <button
              key={type}
              onClick={() => setTypeFilter(typeFilter === type ? "all" : type)}
              className={`relative rounded-xl border p-3 transition-all duration-200 text-left ${
                typeFilter === type
                  ? `${info.color} border-current shadow-lg`
                  : "bg-card/30 border-white/[0.06] hover:bg-card/60"
              }`}
            >
              <div className="text-lg mb-0.5">{info.emoji}</div>
              <div className="text-xs font-medium text-muted-foreground">{info.label}</div>
              <div className="text-lg font-bold">{stats[type] || 0}</div>
            </button>
          ))}
        </div>
      )}

      {/* Results Table */}
      <div className="rounded-2xl border border-white/[0.06] bg-card/50 backdrop-blur-sm overflow-hidden">
        {/* Table Header */}
        <div className="px-4 py-3 border-b border-white/[0.06] bg-white/[0.02] flex items-center justify-between">
          <div className="flex items-center gap-3">
            {tickets.length > 0 && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 text-amber-500 focus:ring-amber-500/30 cursor-pointer"
                />
                <span className="text-xs text-muted-foreground">Seleccionar todos</span>
              </label>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {tickets.length} resultado{tickets.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <svg className="animate-spin h-8 w-8 text-amber-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm text-muted-foreground">Buscando tickets...</p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && tickets.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="p-4 rounded-2xl bg-muted/30 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-muted-foreground/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect width="12" height="8" x="6" y="14" />
              </svg>
            </div>
            <p className="text-muted-foreground font-medium">No se encontraron tickets</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Ajusta los filtros o el rango de fechas
            </p>
          </div>
        )}

        {/* Ticket Rows */}
        {!loading && tickets.length > 0 && (
          <div className="divide-y divide-white/[0.04]">
            {tickets.map((ticket) => {
              const info = typeLabels[ticket.type];
              const isSelected = selectedIds.has(ticket.id);
              const isPrintingThis = printing === ticket.id;
              const date = new Date(ticket.date);

              return (
                <div
                  key={ticket.id}
                  className={`flex items-center gap-3 px-4 py-3 transition-all duration-150 ${
                    isSelected
                      ? "bg-amber-500/[0.06]"
                      : "hover:bg-white/[0.02]"
                  }`}
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelection(ticket.id)}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-amber-500 focus:ring-amber-500/30 cursor-pointer shrink-0"
                  />

                  {/* Type Badge */}
                  <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium border shrink-0 ${info.color}`}>
                    <span>{info.emoji}</span>
                    <span className="hidden sm:inline">{info.label}</span>
                  </div>

                  {/* Time */}
                  <div className="shrink-0 text-xs text-muted-foreground font-mono w-[90px]">
                    <div>{date.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit" })}</div>
                    <div>{date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</div>
                  </div>

                  {/* Room */}
                  {ticket.roomNumber ? (
                    <div className="shrink-0 px-2 py-0.5 rounded-md bg-white/[0.06] text-xs font-bold w-12 text-center">
                      {ticket.roomNumber}
                    </div>
                  ) : (
                    <div className="shrink-0 w-12 text-center text-xs text-muted-foreground/40">—</div>
                  )}

                  {/* Description */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{ticket.description}</p>
                  </div>

                  {/* Amount */}
                  <div className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatCurrency(ticket.amount)}
                  </div>

                  {/* Preview + Reprint Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Preview Button — always visible */}
                    <button
                      onClick={() => openPreview(ticket)}
                      title="Vista previa del ticket"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 bg-white/[0.06] hover:bg-violet-500/20 hover:text-violet-400 text-muted-foreground"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      <span className="hidden sm:inline">Ver</span>
                    </button>

                    {ticket.type === "closing" ? (
                      <>
                        {/* Thermal ticket button */}
                        <button
                          onClick={() => reprintTicket(ticket)}
                          disabled={isPrintingThis || isPrinting}
                          title="Reimprimir ticket térmico del corte"
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                            isPrintingThis
                              ? "bg-amber-500/20 text-amber-400 cursor-wait"
                              : "bg-white/[0.06] hover:bg-amber-500/20 hover:text-amber-400 text-muted-foreground"
                          } disabled:opacity-40`}
                        >
                          {isPrintingThis ? (
                            <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="2" y="6" width="20" height="12" rx="2" />
                              <path d="M12 12h.01" />
                              <path d="M17 12h.01" />
                              <path d="M7 12h.01" />
                            </svg>
                          )}
                          <span className="hidden sm:inline">Ticket</span>
                        </button>
                        {/* HP sheet button */}
                        <button
                          onClick={() => reprintHPOnly(ticket)}
                          disabled={isPrintingThis || isPrinting}
                          title="Reimprimir hoja de ingresos en impresora HP"
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                            isPrintingThis
                              ? "bg-blue-500/20 text-blue-400 cursor-wait"
                              : "bg-white/[0.06] hover:bg-blue-500/20 hover:text-blue-400 text-muted-foreground"
                          } disabled:opacity-40`}
                        >
                          {isPrintingThis ? (
                            <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                              <line x1="8" y1="13" x2="16" y2="13" />
                              <line x1="8" y1="17" x2="16" y2="17" />
                            </svg>
                          )}
                          <span className="hidden sm:inline">Hoja</span>
                        </button>
                      </>
                    ) : (
                      /* Standard reprint button for other ticket types */
                      <button
                        onClick={() => reprintTicket(ticket)}
                        disabled={isPrintingThis || isPrinting}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                          isPrintingThis
                            ? "bg-amber-500/20 text-amber-400 cursor-wait"
                            : "bg-white/[0.06] hover:bg-amber-500/20 hover:text-amber-400 text-muted-foreground"
                        } disabled:opacity-40`}
                      >
                        {isPrintingThis ? (
                          <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 6 2 18 2 18 9" />
                            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                            <rect width="12" height="8" x="6" y="14" />
                          </svg>
                        )}
                        <span className="hidden sm:inline">{isPrintingThis ? "Imprimiendo..." : "Reimprimir"}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Ticket Preview Modal */}
      <TicketPreviewModal
        ticket={previewTicket}
        open={previewOpen}
        onClose={closePreview}
        onReprint={reprintTicket}
        onReprintHP={reprintHPOnly}
        isPrinting={isPrinting}
        loadingDetails={previewLoading}
      />
    </div>
  );
}
