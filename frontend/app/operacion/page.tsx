"use client";

import { useState, useEffect } from "react";
import { useRealtimeOperations } from "@/hooks/use-realtime-operations";
import { FlowStatsBar } from "@/components/operations/flow-stats-bar";
import {
  EVENT_ICONS,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  formatFlowId,
  formatDuration,
  formatElapsedTime,
} from "@/hooks/use-flow-timeline";

// ─── Status config ───────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: "all", label: "Todos", icon: "📋" },
  { value: "ACTIVO", label: "Activos", icon: "⚡" },
  { value: "COMPLETADO", label: "Completados", icon: "✅" },
  { value: "CANCELADO", label: "Cancelados", icon: "❌" },
] as const;

const STATUS_BADGE: Record<string, string> = {
  ACTIVO: "bg-blue-500/15 text-blue-400 border-blue-500/30 shadow-blue-500/10 shadow-sm",
  COMPLETADO: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  CANCELADO: "bg-rose-500/15 text-rose-400 border-rose-500/30",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVO: "Activo",
  COMPLETADO: "Completado",
  CANCELADO: "Cancelado",
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default function OperacionPage() {
  const {
    flows,
    stats,
    filters,
    loading,
    hasMore,
    isConnected,
    expandedFlowIds,
    employees,
    shifts,
    toggleExpanded,
    expandAll,
    collapseAll,
    updateFilter,
    resetFilters,
    loadMore,
    refetch,
  } = useRealtimeOperations();

  const [liveTimer, setLiveTimer] = useState(0);

  // Tick every second to update elapsed times
  useEffect(() => {
    const timer = setInterval(() => setLiveTimer((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const activeFiltersCount = Object.entries(filters).filter(
    ([key, value]) => {
      if (key === "status" && value !== "all") return true;
      if (key === "roomNumber" && value) return true;
      if (key === "search" && value) return true;
      if (key === "dateTo" && value) return true;
      if (key === "employeeName" && value) return true;
      if (key === "shiftId" && value) return true;
      return false;
    }
  ).length;

  return (
    <div className="min-h-screen bg-background">
      {/* ─── Header ───────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 border-b border-white/[0.06] bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-blue-500/20 flex items-center justify-center">
                <span className="text-xl">⚡</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground tracking-tight">
                  Operación en Tiempo Real
                </h1>
                <p className="text-xs text-muted-foreground/50">
                  Seguimiento granular de flujos operativos
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Connection dot */}
              <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50 uppercase tracking-widest">
                <span className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isConnected ? "bg-emerald-400" : "bg-red-400"}`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? "bg-emerald-500" : "bg-red-500"}`}></span>
                </span>
                {isConnected ? "En vivo" : "Desconectado"}
              </span>

              <button type="button" onClick={refetch} className="p-2 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-white/[0.06] transition-colors" title="Actualizar">
                🔄
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-5">
        {/* ─── Stats ───────────────────────────────────────────────────── */}
        <FlowStatsBar stats={stats} isConnected={isConnected} />

        {/* ─── Filters ─────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
          {/* Row 1: Status tabs + search */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex gap-1 bg-white/[0.03] rounded-lg p-1">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateFilter("status", opt.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                    filters.status === opt.value
                      ? "bg-white/[0.1] text-foreground shadow-sm"
                      : "text-muted-foreground/50 hover:text-foreground hover:bg-white/[0.04]"
                  }`}
                >
                  <span>{opt.icon}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>

            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Buscar por ID (F0001) o habitación..."
                value={filters.search}
                onChange={(e) => updateFilter("search", e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/30 transition-all"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/30 text-sm">🔍</span>
            </div>
          </div>

          {/* Row 2: Granular filters */}
          <div className="flex flex-wrap gap-2">
            {/* Room */}
            <input
              type="text"
              placeholder="🏨 Habitación"
              value={filters.roomNumber}
              onChange={(e) => updateFilter("roomNumber", e.target.value)}
              className="w-28 h-8 px-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-blue-500/40 transition-all"
            />

            {/* Employee */}
            <select
              value={filters.employeeName}
              onChange={(e) => updateFilter("employeeName", e.target.value)}
              className="h-8 px-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/40 transition-all min-w-[160px]"
            >
              <option value="">👤 Todos los empleados</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.name}>
                  {emp.name} ({emp.role})
                </option>
              ))}
            </select>

            {/* Shift */}
            <select
              value={filters.shiftId}
              onChange={(e) => updateFilter("shiftId", e.target.value)}
              className="h-8 px-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/40 transition-all min-w-[200px]"
            >
              <option value="">🕐 Todos los turnos</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>

            {/* Date From */}
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => updateFilter("dateFrom", e.target.value)}
              className="h-8 px-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/40 transition-all"
            />

            {/* Date To */}
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => updateFilter("dateTo", e.target.value)}
              className="h-8 px-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/40 transition-all"
            />

            {/* Reset */}
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={resetFilters}
                className="h-8 px-3 rounded-lg text-[11px] text-muted-foreground/50 hover:text-foreground hover:bg-white/[0.04] transition-colors border border-white/[0.06]"
              >
                ✕ Limpiar ({activeFiltersCount})
              </button>
            )}
          </div>
        </div>

        {/* ─── Toolbar ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between text-xs text-muted-foreground/40 px-1">
          <span>
            {flows.length} flujo(s)
            {filters.status !== "all" && ` • ${filters.status}`}
          </span>
          <div className="flex items-center gap-3">
            <button type="button" onClick={expandAll} className="hover:text-foreground transition-colors">
              ▼ Expandir todos
            </button>
            <button type="button" onClick={collapseAll} className="hover:text-foreground transition-colors">
              ▲ Colapsar todos
            </button>
            <span className="tabular-nums" key={liveTimer}>
              {new Date().toLocaleTimeString("es-MX")}
            </span>
          </div>
        </div>

        {/* ─── Flow List ───────────────────────────────────────────────── */}
        {loading && flows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin mb-4" />
            <p className="text-sm text-muted-foreground/50">Cargando flujos operativos...</p>
          </div>
        ) : flows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border border-dashed border-white/[0.08] rounded-2xl">
            <span className="text-5xl mb-4">📭</span>
            <p className="text-base font-medium text-foreground/60 mb-1">No hay flujos registrados</p>
            <p className="text-xs text-muted-foreground/40 max-w-sm text-center">
              Los flujos se crean automáticamente cuando se asigna una habitación.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {flows.map((flow) => {
              const isExpanded = expandedFlowIds.has(flow.id);
              const isActive = flow.status === "ACTIVO";
              const eventCount = flow.events?.length || 0;

              return (
                <div
                  key={flow.id}
                  className={`rounded-xl border transition-all duration-300 ${
                    isExpanded
                      ? "border-white/[0.1] bg-white/[0.03]"
                      : "border-white/[0.06] bg-white/[0.01] hover:border-white/[0.1] hover:bg-white/[0.02]"
                  }`}
                >
                  {/* ─── Flow Header (collapsible) ───────────────────── */}
                  <button
                    type="button"
                    onClick={() => toggleExpanded(flow.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer group"
                  >
                    {/* Expand chevron */}
                    <span className={`text-muted-foreground/40 text-xs transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}>
                      ▶
                    </span>

                    {/* Flow ID */}
                    <span className="font-mono text-sm font-bold text-foreground/90 tracking-wider min-w-[60px]">
                      {formatFlowId(flow.flow_number)}
                    </span>

                    {/* Live pulse */}
                    {isActive && (
                      <span className="relative flex h-2 w-2 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                      </span>
                    )}

                    {/* Room number */}
                    <span className="text-sm font-semibold text-foreground/80">
                      Habitación {flow.room_number}
                    </span>

                    {/* Status badge */}
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider border ${STATUS_BADGE[flow.status] || STATUS_BADGE.ACTIVO}`}>
                      {STATUS_LABELS[flow.status] || flow.status}
                    </span>

                    {/* Event count */}
                    <span className="text-[11px] text-muted-foreground/40 tabular-nums">
                      {eventCount} evento{eventCount !== 1 ? "s" : ""}
                    </span>

                    {/* Spacer */}
                    <div className="flex-1" />

                    {/* Duration */}
                    <span className="text-[11px] text-muted-foreground/40 tabular-nums" key={liveTimer}>
                      ⏱️ {isActive ? formatElapsedTime(flow.started_at) : flow.completed_at ? formatDuration(new Date(flow.completed_at).getTime() - new Date(flow.started_at).getTime()) : "—"}
                    </span>

                    {/* Start time */}
                    <span className="text-[11px] text-muted-foreground/30 tabular-nums hidden sm:inline">
                      {new Date(flow.started_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </button>

                  {/* ─── Expanded Timeline ────────────────────────────── */}
                  {isExpanded && (
                    <div className="border-t border-white/[0.04] px-4 py-3 animate-in slide-in-from-top-1 duration-200">
                      {!flow.events || flow.events.length === 0 ? (
                        <div className="flex items-center gap-2 py-4 pl-8 text-xs text-muted-foreground/40">
                          <span>📭</span>
                          <span>Sin eventos registrados aún</span>
                        </div>
                      ) : (
                        <div className="space-y-0">
                          {flow.events.map((event, idx) => {
                            const icon = EVENT_ICONS[event.event_type] || "📌";
                            const catStyle = CATEGORY_COLORS[event.event_category] || CATEGORY_COLORS.SYSTEM;
                            const catLabel = CATEGORY_LABELS[event.event_category] || event.event_category;
                            const isFirst = idx === 0;
                            const isLast = idx === flow.events!.length - 1;
                            const time = new Date(event.created_at).toLocaleTimeString("es-MX", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            });

                            return (
                              <div key={event.id} className="flex gap-3 group">
                                {/* Timeline connector */}
                                <div className="flex flex-col items-center shrink-0 w-7">
                                  <div className={`w-px flex-1 ${isFirst ? "bg-transparent" : "bg-white/[0.06]"}`} />
                                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs border transition-all ${catStyle} group-hover:scale-110`}>
                                    {icon}
                                  </div>
                                  <div className={`w-px flex-1 ${isLast ? "bg-transparent" : "bg-white/[0.06]"}`} />
                                </div>

                                {/* Content */}
                                <div className="flex-1 pb-4 pt-0.5 min-w-0">
                                  <div className="flex items-start gap-2 flex-wrap">
                                    {/* Description */}
                                    <p className="text-[13px] font-medium text-foreground/85 leading-tight">
                                      {event.description}
                                    </p>

                                    {/* Duration from previous */}
                                    {event.duration_from_previous_ms > 0 && !isFirst && (
                                      <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded bg-white/[0.04] text-[9px] text-muted-foreground/30 tabular-nums border border-white/[0.04]">
                                        +{formatDuration(event.duration_from_previous_ms)}
                                      </span>
                                    )}
                                  </div>

                                  {/* Meta line */}
                                  <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-muted-foreground/45">
                                    {/* Actor */}
                                    {event.actor_name && (
                                      <span className="font-medium text-foreground/60">
                                        ({event.actor_name})
                                      </span>
                                    )}

                                    {/* Time */}
                                    <span className="tabular-nums">({time})</span>

                                    {/* Category badge */}
                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider border ${catStyle}`}>
                                      {catLabel}
                                    </span>

                                    {/* Sequence */}
                                    <span className="text-muted-foreground/20">#{event.sequence_number}</span>
                                  </div>

                                  {/* Metadata preview */}
                                  {event.metadata && Object.keys(event.metadata).filter(k => event.metadata[k] !== null && event.metadata[k] !== undefined && event.metadata[k] !== "").length > 0 && (
                                    <MetadataInline metadata={event.metadata} />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Active flow footer */}
                      {isActive && (
                        <div className="flex items-center gap-2 text-[10px] text-blue-400/60 pt-2 pl-10 border-t border-white/[0.03]">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"></span>
                          </span>
                          <span>Flujo en curso — los nuevos eventos aparecen automáticamente</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Load More */}
            {hasMore && (
              <div className="flex justify-center pt-4">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loading}
                  className="px-6 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.02] text-sm font-medium text-muted-foreground/60 hover:text-foreground hover:bg-white/[0.04] hover:border-white/[0.12] transition-all duration-300 disabled:opacity-50"
                >
                  {loading ? "Cargando..." : "Cargar más"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Metadata Inline Component ───────────────────────────────────────────────

function MetadataInline({ metadata }: { metadata: Record<string, any> }) {
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
    plate: "Placas",
    vehicle_brand: "Marca",
    brand: "Marca",
    vehicle_model: "Modelo",
    model: "Modelo",
    person_count: "Personas",
    reference: "Referencia",
    concept: "Concepto",
    description: "Descripción",
    reason: "Motivo",
    quantity: "Cantidad",
    product_name: "Producto",
    tip_amount: "Propina",
    hours: "Horas",
    new_status: "Nuevo Estado",
    renewal_hours: "Horas Renovación",
    remaining: "Restante",
    is_courtesy: "Cortesía",
    courtesy_reason: "Motivo Cortesía",
  };

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
        className="inline-flex items-center gap-1 text-[9px] text-muted-foreground/35 hover:text-muted-foreground/60 transition-colors"
      >
        <span>{expanded ? "▾" : "▸"}</span>
        <span>datos ({entries.length})</span>
      </button>

      {expanded && (
        <div className="mt-1 rounded-md bg-white/[0.02] border border-white/[0.04] px-2 py-1.5 space-y-0.5">
          {entries.map(([key, value]) => (
            <div key={key} className="flex items-start gap-2 text-[10px]">
              <span className="text-muted-foreground/40 min-w-[65px] shrink-0">
                {LABEL_MAP[key] || key}:
              </span>
              <span className="text-foreground/60 break-all">
                {typeof value === "object"
                  ? JSON.stringify(value)
                  : typeof value === "number" && (key.includes("amount") || key === "remaining")
                    ? `$${value.toFixed(2)}`
                    : typeof value === "boolean"
                      ? (value ? "Sí" : "No")
                      : String(value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
