"use client";

import { useState } from "react";
import {
  useFlowTimeline,
  FlowEvent,
  EVENT_ICONS,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  formatFlowId,
  formatDuration,
  formatElapsedTime,
} from "@/hooks/use-flow-timeline";

// ─── Sub-components ──────────────────────────────────────────────────────────

function MetadataBadge({ metadata }: { metadata: Record<string, any> }) {
  const [expanded, setExpanded] = useState(false);
  const entries = Object.entries(metadata).filter(
    ([, v]) => v !== null && v !== undefined && v !== ""
  );

  if (entries.length === 0) return null;

  const LABEL_MAP: Record<string, string> = {
    amount: "Monto",
    payment_method: "Método",
    room_number: "Habitación",
    vehicle_plate: "Placas",
    vehicle_brand: "Marca",
    vehicle_model: "Modelo",
    person_count: "Personas",
    terminal_code: "Terminal",
    card_last_4: "Últimos 4",
    card_type: "Tipo Tarjeta",
    reference: "Referencia",
    concept: "Concepto",
    description: "Descripción",
    reason: "Motivo",
    quantity: "Cantidad",
    product_name: "Producto",
    tip_amount: "Propina",
    stay_id: "Estancia",
    sales_order_id: "Orden",
  };

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-muted-foreground/80 transition-colors"
      >
        <span>{expanded ? "▾" : "▸"}</span>
        <span>{entries.length} campo(s)</span>
      </button>

      {expanded && (
        <div className="mt-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] p-2.5 space-y-1 animate-in slide-in-from-top-1 duration-200">
          {entries.map(([key, value]) => (
            <div key={key} className="flex items-start gap-2 text-[11px]">
              <span className="text-muted-foreground/50 min-w-[80px] shrink-0">
                {LABEL_MAP[key] || key}:
              </span>
              <span className="text-foreground/70 break-all">
                {typeof value === "object"
                  ? JSON.stringify(value, null, 2)
                  : typeof value === "number" && key.includes("amount")
                    ? `$${value.toFixed(2)}`
                    : String(value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TimelineEvent({
  event,
  isFirst,
  isLast,
}: {
  event: FlowEvent;
  isFirst: boolean;
  isLast: boolean;
}) {
  const icon = EVENT_ICONS[event.event_type] || "📌";
  const categoryStyle =
    CATEGORY_COLORS[event.event_category] || CATEGORY_COLORS.SYSTEM;
  const categoryLabel =
    CATEGORY_LABELS[event.event_category] || event.event_category;

  const time = new Date(event.created_at).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="flex gap-3 group">
      {/* Timeline connector */}
      <div className="flex flex-col items-center shrink-0 w-8">
        {/* Top line */}
        <div
          className={`w-px flex-1 ${isFirst ? "bg-transparent" : "bg-white/[0.08]"}`}
        />

        {/* Node */}
        <div
          className={`
            w-8 h-8 rounded-full flex items-center justify-center text-sm
            border transition-all duration-300
            ${categoryStyle}
            group-hover:scale-110
          `}
        >
          {icon}
        </div>

        {/* Bottom line */}
        <div
          className={`w-px flex-1 ${isLast ? "bg-transparent" : "bg-white/[0.08]"}`}
        />
      </div>

      {/* Content */}
      <div className="flex-1 pb-6 pt-1">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground/90 leading-tight">
              {event.description}
            </p>
          </div>

          {/* Duration badge */}
          {event.duration_from_previous_ms > 0 && !isFirst && (
            <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/[0.04] text-[10px] text-muted-foreground/40 tabular-nums border border-white/[0.04]">
              +{formatDuration(event.duration_from_previous_ms)}
            </span>
          )}
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground/50">
          <span className="tabular-nums">{time}</span>
          <span className="text-white/[0.1]">•</span>
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider border ${categoryStyle}`}
          >
            {categoryLabel}
          </span>

          {event.actor_name && (
            <>
              <span className="text-white/[0.1]">•</span>
              <span className="flex items-center gap-1">
                <span>👤</span>
                <span>{event.actor_name}</span>
                {event.actor_role && (
                  <span className="text-muted-foreground/30">
                    ({event.actor_role})
                  </span>
                )}
              </span>
            </>
          )}

          <span className="text-white/[0.1]">•</span>
          <span className="text-muted-foreground/30">
            #{event.sequence_number}
          </span>
        </div>

        {/* Metadata */}
        {event.metadata && Object.keys(event.metadata).length > 0 && (
          <MetadataBadge metadata={event.metadata} />
        )}
      </div>
    </div>
  );
}

// ─── Main Modal ──────────────────────────────────────────────────────────────

interface FlowTimelineModalProps {
  flowId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function FlowTimelineModal({
  flowId,
  isOpen,
  onClose,
}: FlowTimelineModalProps) {
  const {
    events,
    flowDetail,
    loading,
    categoryFilter,
    setCategoryFilter,
    categories,
    eventsByCategory,
    totalDurationMs,
    totalEvents,
  } = useFlowTimeline(isOpen ? flowId : null);

  if (!isOpen) return null;

  const STATUS_BADGE: Record<string, string> = {
    ACTIVO: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    COMPLETADO: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    CANCELADO: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] m-4 rounded-2xl border border-white/[0.08] bg-zinc-950/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        {/* Header */}
        <div className="shrink-0 border-b border-white/[0.06] p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              {flowDetail && (
                <span className="font-mono text-lg font-bold text-foreground tracking-wider">
                  {formatFlowId(flowDetail.flow_number)}
                </span>
              )}
              {flowDetail && (
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${
                    STATUS_BADGE[flowDetail.status] || STATUS_BADGE.ACTIVO
                  }`}
                >
                  {flowDetail.status}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-white/[0.06] transition-colors"
            >
              ✕
            </button>
          </div>

          {flowDetail && (
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground/60">
              <span className="flex items-center gap-1">
                🏨 Hab. {flowDetail.room_number}
              </span>
              <span className="text-white/[0.08]">|</span>
              <span className="flex items-center gap-1">
                📊 {totalEvents} eventos
              </span>
              <span className="text-white/[0.08]">|</span>
              <span className="flex items-center gap-1">
                ⏱️{" "}
                {flowDetail.status === "ACTIVO"
                  ? formatElapsedTime(flowDetail.started_at)
                  : formatDuration(totalDurationMs)}
              </span>
              <span className="text-white/[0.08]">|</span>
              <span className="tabular-nums">
                Inicio:{" "}
                {new Date(flowDetail.started_at).toLocaleString("es-MX", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          )}
        </div>

        {/* Category filters */}
        <div className="shrink-0 border-b border-white/[0.04] px-5 py-3">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setCategoryFilter("all")}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-200 ${
                categoryFilter === "all"
                  ? "bg-white/[0.1] text-foreground"
                  : "text-muted-foreground/50 hover:text-foreground hover:bg-white/[0.04]"
              }`}
            >
              Todos ({totalEvents})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-200 ${
                  categoryFilter === cat
                    ? `border ${CATEGORY_COLORS[cat] || ""}`
                    : "text-muted-foreground/50 hover:text-foreground hover:bg-white/[0.04]"
                }`}
              >
                {CATEGORY_LABELS[cat] || cat} ({eventsByCategory[cat] || 0})
              </button>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-hide">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
                <span className="text-sm text-muted-foreground/50">
                  Cargando timeline...
                </span>
              </div>
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/40">
              <span className="text-4xl mb-3">📭</span>
              <p className="text-sm">No hay eventos registrados</p>
              {categoryFilter !== "all" && (
                <p className="text-xs mt-1">
                  Intenta cambiar el filtro de categoría
                </p>
              )}
            </div>
          ) : (
            <div>
              {events.map((event, idx) => (
                <TimelineEvent
                  key={event.id}
                  event={event}
                  isFirst={idx === 0}
                  isLast={idx === events.length - 1}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {flowDetail?.status === "ACTIVO" && (
          <div className="shrink-0 border-t border-white/[0.06] px-5 py-3 bg-blue-500/[0.03]">
            <div className="flex items-center gap-2 text-[11px] text-blue-400/70">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              <span>
                Flujo en curso — los nuevos eventos aparecen automáticamente
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
