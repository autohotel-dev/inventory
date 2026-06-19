"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Printer, DoorOpen, ShoppingBag, LogOut, CreditCard, Clock,
  FileText, Loader2, Search, Filter, Eye, ChevronDown, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createClient } from "@/lib/supabase/client";
import { buildClosingBreakdowns, buildClosingTransactions } from "@/lib/print";
import {
  useReprintCenter,
  type ReprintableTicket,
  type TicketType,
} from "@/hooks/use-reprint-center";
import { TicketPreviewModal } from "./ticket-preview-modal";

// ─── Props ───────────────────────────────────────────────────────────

interface PrintHistoryTableProps {
  /** Limitar cantidad de tickets mostrados (para modo compacto) */
  limit?: number;
  /** Mostrar filtros de búsqueda (fechas, tipo, habitación) */
  showFilters?: boolean;
  /** Mostrar stats por tipo de ticket */
  showStats?: boolean;
  /** Habilitar selección múltiple y reimpresión batch */
  showSelection?: boolean;
  /** Mostrar botón de vista previa por ticket */
  showPreview?: boolean;
  /** Callback para quick reprint — expone la función al padre */
  onQuickReprint?: (fn: (type: "entry" | "checkout" | "consumption") => Promise<void>) => void;
}

// ─── Icon Map ────────────────────────────────────────────────────────

const TICKET_ICONS: Record<TicketType, React.ReactNode> = {
  entry: <DoorOpen className="w-3.5 h-3.5 text-emerald-400" />,
  checkout: <LogOut className="w-3.5 h-3.5 text-blue-400" />,
  consumption: <ShoppingBag className="w-3.5 h-3.5 text-amber-400" />,
  payment: <CreditCard className="w-3.5 h-3.5 text-purple-400" />,
  closing: <FileText className="w-3.5 h-3.5 text-rose-400" />,
  tolerance: <Clock className="w-3.5 h-3.5 text-cyan-400" />,
};

// ─── Component ───────────────────────────────────────────────────────

export function PrintHistoryTable({
  limit,
  showFilters = false,
  showStats = false,
  showSelection = false,
  showPreview = false,
  onQuickReprint,
}: PrintHistoryTableProps) {
  const {
    tickets,
    allTickets,
    loading,
    printing,
    isPrinting,
    dateRange,
    typeFilter,
    roomFilter,
    selectedIds,
    setDateRange,
    setTypeFilter,
    setRoomFilter,
    fetchTickets,
    reprintTicket,
    reprintHPOnly,
    reprintSelected,
    toggleSelection,
    toggleSelectAll,
    typeLabels,
    formatCurrency,
  } = useReprintCenter();

  // ─── Preview state ─────────────────────────────────────────────────
  const [previewTicket, setPreviewTicket] = useState<ReprintableTicket | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  const openPreview = useCallback(async (ticket: ReprintableTicket) => {
    if (ticket.type === "closing" && ticket.rawData.closingId) {
      setPreviewTicket(ticket);
      setPreviewOpen(true);
      setPreviewLoading(true);
      try {
        const supabase = createClient();
        const { data: details } = await supabase
          .from("shift_closing_details")
          .select("*, payments(id, amount, payment_method, reference, concept, terminal_code, created_at, sales_order_id, payment_terminals(code, name), sales_orders(id, room_stays(rooms(number))))")
          .eq("shift_closing_id", ticket.rawData.closingId)
          .order("created_at", { ascending: true });

        const transactions = buildClosingTransactions(details || []);

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

        let roomBreakdown: Record<string, { count: number; total: number }> = {};
        let extraBreakdown: Record<string, { count: number; total: number }> = {};
        let consumptionBreakdown: Record<string, { count: number; total: number }> = {};
        let damageBreakdown: Record<string, { count: number; total: number }> = {};

        if (shiftSessionId) {
          const { data: accrualItems } = await supabase
            .from("sales_order_items")
            .select("id, qty, unit_price, concept_type, is_courtesy, courtesy_reason, is_cancelled, products(name), sales_orders(id, room_stays(status, rooms(number, room_types(name))))")
            .eq("shift_session_id", shiftSessionId);

          ({ roomBreakdown, extraBreakdown, consumptionBreakdown, damageBreakdown } = buildClosingBreakdowns(accrualItems || []));
        }

        setPreviewTicket({
          ...ticket,
          rawData: {
            ...ticket.rawData,
            transactions, roomBreakdown, extraBreakdown,
            consumptionBreakdown, damageBreakdown, expenses, totalExpenses,
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
  }, []);

  const closePreview = useCallback(() => {
    setPreviewOpen(false);
    setTimeout(() => setPreviewTicket(null), 200);
  }, []);

  // ─── Auto-fetch + expose quick reprint ──────────────────────────────
  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  useEffect(() => {
    if (onQuickReprint) {
      onQuickReprint(async (type) => {
        const ticket = tickets.find(t => t.type === type);
        if (ticket) await reprintTicket(ticket);
      });
    }
  }, [onQuickReprint, tickets, reprintTicket]);

  // ─── Stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const byType: Record<string, number> = {};
    allTickets.forEach((t) => { byType[t.type] = (byType[t.type] || 0) + 1; });
    return byType;
  }, [allTickets]);

  // ─── Display ────────────────────────────────────────────────────────
  const displayedTickets = limit ? tickets.slice(0, limit) : tickets;
  const allSelected = tickets.length > 0 && selectedIds.size === tickets.length;

  // ─── Render: Loading ───────────────────────────────────────────────
  if (loading && allTickets.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[200px]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
          <span className="text-xs text-zinc-500">Cargando tickets...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {/* ─── Filters ──────────────────────────────────────────────── */}
        {showFilters && (
          <div className="flex flex-wrap items-end gap-2 p-3 rounded-xl bg-zinc-900/30 border border-zinc-800/50">
            <div className="flex-1 min-w-[120px]">
              <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1 block">Desde</label>
              <input
                type="date"
                value={dateRange.from.toISOString().split("T")[0]}
                onChange={(e) => {
                  if (e.target.value) {
                    const d = new Date(e.target.value + "T00:00:00");
                    setDateRange((prev) => ({ ...prev, from: d }));
                  }
                }}
                className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-200 focus:ring-1 focus:ring-blue-500/30 focus:outline-none"
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1 block">Hasta</label>
              <input
                type="date"
                value={dateRange.to.toISOString().split("T")[0]}
                onChange={(e) => {
                  if (e.target.value) {
                    const d = new Date(e.target.value + "T23:59:59");
                    setDateRange((prev) => ({ ...prev, to: d }));
                  }
                }}
                className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-200 focus:ring-1 focus:ring-blue-500/30 focus:outline-none"
              />
            </div>
            <div className="w-20">
              <label className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1 block">Hab.</label>
              <input
                type="text"
                value={roomFilter}
                onChange={(e) => setRoomFilter(e.target.value)}
                placeholder="101"
                className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-200 focus:ring-1 focus:ring-blue-500/30 focus:outline-none placeholder:text-zinc-600"
              />
            </div>
            <Button
              size="sm"
              onClick={fetchTickets}
              disabled={loading}
              className="h-[30px] gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
              Buscar
            </Button>
          </div>
        )}

        {/* ─── Stats Badges ─────────────────────────────────────────── */}
        {showStats && allTickets.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setTypeFilter("all")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                typeFilter === "all"
                  ? "bg-zinc-700/50 border-zinc-600 text-zinc-200"
                  : "bg-zinc-900/30 border-zinc-800/50 text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Todos <span className="font-bold">{allTickets.length}</span>
            </button>
            {(Object.entries(typeLabels) as [TicketType, { label: string; emoji: string; color: string }][]).map(([type, info]) => (
              stats[type] ? (
                <button
                  key={type}
                  onClick={() => setTypeFilter(typeFilter === type ? "all" : type)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                    typeFilter === type
                      ? `${info.color} border-current`
                      : "bg-zinc-900/30 border-zinc-800/50 text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {info.emoji} {info.label} <span className="font-bold">{stats[type]}</span>
                </button>
              ) : null
            ))}
          </div>
        )}

        {/* ─── Selection Toolbar ─────────────────────────────────────── */}
        {showSelection && tickets.length > 0 && (
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                className="w-3.5 h-3.5 rounded border-zinc-600 bg-zinc-900 text-amber-500 focus:ring-amber-500/30 cursor-pointer"
              />
              <span className="text-[11px] text-zinc-500">Seleccionar todos</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-zinc-500">
                {tickets.length} ticket{tickets.length !== 1 ? "s" : ""}
              </span>
              {selectedIds.size > 0 && (
                <Button
                  size="sm"
                  onClick={reprintSelected}
                  disabled={isPrinting}
                  className="h-7 gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[11px] px-2.5"
                >
                  <Printer className="w-3 h-3" />
                  Reimprimir {selectedIds.size}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ─── Empty State ──────────────────────────────────────────── */}
        {!loading && displayedTickets.length === 0 && (
          <div className="text-center py-10">
            <Printer className="w-10 h-10 text-zinc-800 mx-auto mb-2" />
            <p className="text-zinc-500 font-medium text-sm">No hay tickets</p>
            <p className="text-xs text-zinc-600 mt-1">
              {showFilters ? "Ajusta los filtros o el rango de fechas" : "Los tickets del día aparecerán aquí"}
            </p>
          </div>
        )}

        {/* ─── Ticket List ──────────────────────────────────────────── */}
        {displayedTickets.length > 0 && (
          <ScrollArea className="flex-1 -mx-1 px-1" style={{ maxHeight: limit ? "420px" : undefined }}>
            <div className="space-y-1.5 pb-2">
              {displayedTickets.map((ticket) => {
                const meta = typeLabels[ticket.type];
                const isThisPrinting = printing === ticket.id;
                const isSelected = selectedIds.has(ticket.id);

                return (
                  <div
                    key={ticket.id}
                    className={`group flex items-center gap-2.5 p-2.5 rounded-xl border transition-all ${
                      isSelected
                        ? "bg-amber-500/[0.06] border-amber-500/20"
                        : "bg-zinc-900/30 hover:bg-zinc-800/50 border-zinc-800/50"
                    }`}
                  >
                    {/* Checkbox */}
                    {showSelection && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelection(ticket.id)}
                        className="w-3.5 h-3.5 rounded border-zinc-600 bg-zinc-900 text-amber-500 focus:ring-amber-500/30 cursor-pointer shrink-0"
                      />
                    )}

                    {/* Icon */}
                    <div className="p-1.5 rounded-lg bg-zinc-950 border border-zinc-800 shrink-0">
                      {TICKET_ICONS[ticket.type]}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-medium text-zinc-200 truncate">
                          {ticket.description}
                        </span>
                        {ticket.roomNumber && (
                          <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-zinc-950 border-zinc-800 text-zinc-400 shrink-0">
                            {ticket.roomNumber}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant="outline" className={`text-[9px] h-3.5 px-1 leading-none ${meta.color}`}>
                          {meta.emoji} {meta.label}
                        </Badge>
                        <span className="text-[10px] text-zinc-600 font-mono">
                          {format(new Date(ticket.date), "dd MMM, HH:mm", { locale: es })}
                        </span>
                      </div>
                    </div>

                    {/* Amount */}
                    {ticket.amount > 0 && (
                      <span className="text-xs font-mono text-zinc-300 font-medium shrink-0 hidden sm:inline-block">
                        {formatCurrency(ticket.amount)}
                      </span>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      {/* Preview */}
                      {showPreview && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openPreview(ticket)}
                          className="h-7 w-7 p-0 text-zinc-500 hover:text-violet-400 hover:bg-violet-500/10"
                          title="Vista previa"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      )}

                      {/* Closing: two buttons (thermal + HP) */}
                      {ticket.type === "closing" ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isThisPrinting || isPrinting}
                            onClick={() => reprintTicket(ticket)}
                            className="h-7 px-2 gap-1 text-[11px] text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10"
                            title="Ticket térmico"
                          >
                            {isThisPrinting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Printer className="w-3 h-3" />}
                            <span className="hidden lg:inline">Ticket</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isThisPrinting || isPrinting}
                            onClick={() => reprintHPOnly(ticket)}
                            className="h-7 px-2 gap-1 text-[11px] text-zinc-500 hover:text-blue-400 hover:bg-blue-500/10"
                            title="Hoja HP"
                          >
                            <FileText className="w-3 h-3" />
                            <span className="hidden lg:inline">Hoja</span>
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isThisPrinting || isPrinting}
                          onClick={() => reprintTicket(ticket)}
                          className="h-7 px-2 gap-1 text-[11px] text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10"
                        >
                          {isThisPrinting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Printer className="w-3 h-3" />}
                          <span className="hidden sm:inline">{isThisPrinting ? "Enviando..." : "Reimprimir"}</span>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* ─── Preview Modal ────────────────────────────────────────────── */}
      {showPreview && (
        <TicketPreviewModal
          ticket={previewTicket}
          open={previewOpen}
          onClose={closePreview}
          onReprint={reprintTicket}
          onReprintHP={reprintHPOnly}
          isPrinting={isPrinting}
          loadingDetails={previewLoading}
        />
      )}
    </>
  );
}
