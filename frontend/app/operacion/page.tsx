"use client";

import { useState, useEffect } from "react";
import { useRealtimeOperations } from "@/hooks/use-realtime-operations";
import {
  EVENT_ICONS,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  formatFlowId,
  formatDuration,
  formatElapsedTime,
} from "@/hooks/use-flow-timeline";
import type { FlowEvent } from "@/hooks/use-flow-timeline";

/* ═══════════════════════════════════════════════════════════════════════
   STATUS CONFIG
   ═══════════════════════════════════════════════════════════════════════ */

const STATUS_TABS = [
  { value: "all", label: "Todos", icon: "📋" },
  { value: "ACTIVO", label: "Activos", icon: "⚡" },
  { value: "COMPLETADO", label: "Completados", icon: "✅" },
  { value: "CANCELADO", label: "Cancelados", icon: "❌" },
] as const;

const STATUS_STYLE: Record<string, { badge: string; glow: string; dot: string }> = {
  ACTIVO: {
    badge: "bg-blue-500/15 text-blue-300 border-blue-500/25",
    glow: "shadow-[0_0_20px_rgba(59,130,246,0.15)]",
    dot: "bg-blue-500",
  },
  COMPLETADO: {
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
    glow: "",
    dot: "bg-emerald-500",
  },
  CANCELADO: {
    badge: "bg-rose-500/15 text-rose-300 border-rose-500/25",
    glow: "",
    dot: "bg-rose-500",
  },
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVO: "En curso",
  COMPLETADO: "Completado",
  CANCELADO: "Cancelado",
};

/* ═══════════════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════════════ */

export default function OperacionPage() {
  const {
    flows, stats, filters, loading, hasMore, isConnected,
    expandedFlowIds, employees, shifts,
    toggleExpanded, expandAll, collapseAll,
    updateFilter, resetFilters, loadMore, refetch,
  } = useRealtimeOperations();

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const activeFilterCount = [
    filters.status !== "all",
    !!filters.roomNumber,
    !!filters.search,
    !!filters.dateTo,
    !!filters.employeeName,
    !!filters.shiftId,
  ].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* ──── HEADER ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-white/[0.04] bg-[#0a0a0f]/80 backdrop-blur-2xl">
        <div className="max-w-[1400px] mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600/30 via-violet-500/30 to-fuchsia-500/20 border border-white/[0.08] flex items-center justify-center overflow-hidden">
              <span className="text-lg relative z-10">⚡</span>
              <div className="absolute inset-0 bg-gradient-to-t from-blue-500/10 to-transparent animate-pulse" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-white/90 to-white/70 bg-clip-text text-transparent">
                Operación en Tiempo Real
              </h1>
              <p className="text-[10px] text-white/25 tracking-widest uppercase">
                Seguimiento granular de flujos
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ConnectionBadge connected={isConnected} />
            <button onClick={refetch} className="w-8 h-8 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.1] transition-all flex items-center justify-center text-sm" title="Actualizar">
              🔄
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-5 py-6 space-y-5">
        {/* ──── STATS ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon="⚡" label="Flujos Activos" value={stats.activeFlows} gradient="from-blue-600/20 to-blue-900/10" border="border-blue-500/15" accent="text-blue-400" pulse={stats.activeFlows > 0} />
          <StatCard icon="✅" label="Completados Hoy" value={stats.completedToday} gradient="from-emerald-600/20 to-emerald-900/10" border="border-emerald-500/15" accent="text-emerald-400" />
          <StatCard icon="❌" label="Cancelados Hoy" value={stats.cancelledToday} gradient="from-rose-600/20 to-rose-900/10" border="border-rose-500/15" accent="text-rose-400" />
          <StatCard icon="⏱️" label="Tiempo Promedio" value={stats.avgDurationMinutes > 0 ? `${stats.avgDurationMinutes}m` : "—"} gradient="from-violet-600/20 to-violet-900/10" border="border-violet-500/15" accent="text-violet-400" />
        </div>

        {/* ──── FILTERS ───────────────────────────────────────────── */}
        <div className="rounded-2xl border border-white/[0.04] bg-white/[0.015] backdrop-blur-sm p-4 space-y-3">
          <div className="flex flex-col lg:flex-row gap-3">
            {/* Status tabs */}
            <div className="flex gap-0.5 bg-white/[0.02] rounded-xl p-0.5 border border-white/[0.04]">
              {STATUS_TABS.map((t) => (
                <button key={t.value} onClick={() => updateFilter("status", t.value)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] text-xs font-medium transition-all duration-300 ${
                    filters.status === t.value
                      ? "bg-gradient-to-b from-white/[0.08] to-white/[0.04] text-white shadow-sm border border-white/[0.06]"
                      : "text-white/30 hover:text-white/60 hover:bg-white/[0.03]"
                  }`}>
                  <span className="text-[11px]">{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
            {/* Search */}
            <div className="flex-1 relative">
              <input type="text" placeholder="Buscar por ID (F0001) o habitación..."
                value={filters.search} onChange={(e) => updateFilter("search", e.target.value)}
                className="w-full h-10 pl-9 pr-3 rounded-xl bg-white/[0.03] border border-white/[0.05] text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500/20 transition-all" />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 text-sm">🔍</span>
            </div>
          </div>
          {/* Granular filters */}
          <div className="flex flex-wrap gap-2">
            <FilterInput placeholder="🏨 Habitación" value={filters.roomNumber} onChange={(v) => updateFilter("roomNumber", v)} width="w-28" />
            <FilterSelect value={filters.employeeName} onChange={(v) => updateFilter("employeeName", v)} placeholder="👤 Todos los empleados"
              options={employees.map((e) => ({ value: e.name, label: `${e.name} (${e.role})` }))} width="min-w-[170px]" />
            <FilterSelect value={filters.shiftId} onChange={(v) => updateFilter("shiftId", v)} placeholder="🕐 Todos los turnos"
              options={shifts.map((s) => ({ value: s.id, label: s.label }))} width="min-w-[210px]" />
            <FilterInput type="date" value={filters.dateFrom} onChange={(v) => updateFilter("dateFrom", v)} />
            <FilterInput type="date" value={filters.dateTo} onChange={(v) => updateFilter("dateTo", v)} />
            {activeFilterCount > 0 && (
              <button onClick={resetFilters} className="h-8 px-3 rounded-lg text-[10px] font-medium text-white/30 hover:text-white hover:bg-white/[0.04] border border-white/[0.06] transition-all">
                ✕ Limpiar ({activeFilterCount})
              </button>
            )}
          </div>
        </div>

        {/* ──── TOOLBAR ───────────────────────────────────────────── */}
        <div className="flex items-center justify-between text-[11px] text-white/25 px-1">
          <span>{flows.length} flujo{flows.length !== 1 ? "s" : ""}{filters.status !== "all" ? ` • ${filters.status}` : ""}</span>
          <div className="flex items-center gap-4">
            <button onClick={expandAll} className="hover:text-white/60 transition-colors">▼ Expandir todos</button>
            <button onClick={collapseAll} className="hover:text-white/60 transition-colors">▲ Colapsar todos</button>
            <span className="tabular-nums font-mono" key={tick}>{new Date().toLocaleTimeString("es-MX")}</span>
          </div>
        </div>

        {/* ──── FLOW LIST ─────────────────────────────────────────── */}
        {loading && flows.length === 0 ? (
          <LoadingState />
        ) : flows.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-2">
            {flows.map((flow) => {
              const expanded = expandedFlowIds.has(flow.id);
              const isActive = flow.status === "ACTIVO";
              const st = STATUS_STYLE[flow.status] || STATUS_STYLE.ACTIVO;
              const evtCount = flow.events?.length || 0;
              const elapsed = isActive
                ? formatElapsedTime(flow.started_at)
                : flow.completed_at
                  ? formatDuration(new Date(flow.completed_at).getTime() - new Date(flow.started_at).getTime())
                  : "—";

              return (
                <div key={flow.id} className={`rounded-2xl border transition-all duration-500 ${expanded ? `border-white/[0.08] bg-white/[0.02] ${st.glow}` : "border-white/[0.04] bg-white/[0.01] hover:border-white/[0.07] hover:bg-white/[0.015]"}`}>
                  {/* ── Header ──────────────────────────────── */}
                  <button onClick={() => toggleExpanded(flow.id)}
                    className="w-full flex items-center gap-3 px-5 py-3.5 text-left cursor-pointer group">
                    <span className={`text-white/25 text-[10px] transition-transform duration-300 ${expanded ? "rotate-90" : ""}`}>▶</span>
                    <span className="font-mono text-sm font-bold tracking-widest text-white/80 min-w-[58px]">{formatFlowId(flow.flow_number)}</span>
                    {isActive && <PulseDot />}
                    <span className="text-sm font-semibold text-white/75">Habitación {flow.room_number}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-[0.1em] border ${st.badge}`}>
                      {STATUS_LABEL[flow.status]}
                    </span>
                    <span className="text-[10px] text-white/20 tabular-nums">{evtCount} evento{evtCount !== 1 ? "s" : ""}</span>
                    <div className="flex-1" />
                    <span className="text-[11px] text-white/25 tabular-nums font-mono" key={tick}>⏱ {elapsed}</span>
                    <span className="text-[10px] text-white/15 tabular-nums hidden sm:inline">
                      {new Date(flow.started_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </button>

                  {/* ── Timeline ────────────────────────────── */}
                  {expanded && (
                    <div className="border-t border-white/[0.03] px-5 pt-3 pb-4">
                      {!flow.events?.length ? (
                        <p className="text-xs text-white/20 pl-10 py-4">📭 Sin eventos registrados aún</p>
                      ) : (
                        <div className="space-y-0">
                          {flow.events.map((evt, i) => (
                            <TimelineRow key={evt.id} event={evt} isFirst={i === 0} isLast={i === flow.events!.length - 1} />
                          ))}
                        </div>
                      )}
                      {isActive && (
                        <div className="flex items-center gap-2 text-[10px] text-blue-400/50 pt-3 pl-10 border-t border-white/[0.02] mt-1">
                          <PulseDot size="sm" /> Flujo en curso — eventos en tiempo real
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {hasMore && (
              <div className="flex justify-center pt-6">
                <button onClick={loadMore} disabled={loading}
                  className="px-8 py-2.5 rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-transparent text-sm font-medium text-white/40 hover:text-white/70 hover:border-white/[0.1] transition-all duration-300 disabled:opacity-40">
                  {loading ? "Cargando..." : "Cargar más flujos"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════════════ */

function StatCard({ icon, label, value, gradient, border, accent, pulse }: {
  icon: string; label: string; value: number | string; gradient: string; border: string; accent: string; pulse?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border ${border} bg-gradient-to-br ${gradient} p-4`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-medium text-white/30 uppercase tracking-widest mb-1">{icon} {label}</p>
          <p className={`text-2xl font-bold tabular-nums ${accent}`}>{value}</p>
        </div>
        {pulse && <PulseDot />}
      </div>
      <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-white/[0.02]" />
    </div>
  );
}

function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.15em] font-medium px-2.5 py-1 rounded-full border border-white/[0.04] bg-white/[0.02]"
      style={{ color: connected ? "#34d399" : "#f87171" }}>
      <span className="relative flex h-1.5 w-1.5">
        {connected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${connected ? "bg-emerald-400" : "bg-red-400"}`} />
      </span>
      {connected ? "En vivo" : "Desconectado"}
    </span>
  );
}

function PulseDot({ size = "md" }: { size?: "sm" | "md" }) {
  const s = size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2";
  return (
    <span className={`relative flex ${s} shrink-0`}>
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75`} />
      <span className={`relative inline-flex rounded-full ${s} bg-blue-500`} />
    </span>
  );
}

function TimelineRow({ event, isFirst, isLast }: { event: FlowEvent; isFirst: boolean; isLast: boolean }) {
  const [showMeta, setShowMeta] = useState(false);
  const icon = EVENT_ICONS[event.event_type] || "📌";
  const catStyle = CATEGORY_COLORS[event.event_category] || CATEGORY_COLORS.SYSTEM;
  const catLabel = CATEGORY_LABELS[event.event_category] || event.event_category;
  const time = new Date(event.created_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const metaEntries = event.metadata ? Object.entries(event.metadata).filter(([, v]) => v != null && v !== "") : [];

  return (
    <div className="flex gap-3 group">
      {/* Connector */}
      <div className="flex flex-col items-center shrink-0 w-8">
        <div className={`w-px flex-1 ${isFirst ? "bg-transparent" : "bg-gradient-to-b from-white/[0.06] to-white/[0.03]"}`} />
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs border transition-all duration-200 group-hover:scale-110 group-hover:shadow-lg ${catStyle}`}>
          {icon}
        </div>
        <div className={`w-px flex-1 ${isLast ? "bg-transparent" : "bg-gradient-to-b from-white/[0.03] to-white/[0.06]"}`} />
      </div>
      {/* Content */}
      <div className="flex-1 pb-4 pt-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <p className="text-[13px] font-medium text-white/80 leading-snug">{event.description}</p>
          {event.duration_from_previous_ms > 0 && !isFirst && (
            <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-white/[0.03] text-[8px] text-white/20 tabular-nums border border-white/[0.03] font-mono">
              +{formatDuration(event.duration_from_previous_ms)}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-white/30">
          {event.actor_name && <span className="font-semibold text-white/50">({event.actor_name})</span>}
          <span className="tabular-nums font-mono">({time})</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[7px] font-bold uppercase tracking-[0.12em] border ${catStyle}`}>{catLabel}</span>
          <span className="text-white/10">#{event.sequence_number}</span>
        </div>
        {metaEntries.length > 0 && (
          <button onClick={(e) => { e.stopPropagation(); setShowMeta(!showMeta); }}
            className="mt-1 inline-flex items-center gap-1 text-[9px] text-white/20 hover:text-white/40 transition-colors">
            <span>{showMeta ? "▾" : "▸"}</span> datos ({metaEntries.length})
          </button>
        )}
        {showMeta && <MetaBlock entries={metaEntries} />}
      </div>
    </div>
  );
}

const META_LABELS: Record<string, string> = {
  amount: "Monto", payment_method: "Método", room_number: "Habitación",
  plate: "Placas", brand: "Marca", model: "Modelo", person_count: "Personas",
  description: "Descripción", reason: "Motivo", hours: "Horas", tip_amount: "Propina",
  new_status: "Nuevo Estado", renewal_hours: "Horas Ren.", remaining: "Restante",
  is_courtesy: "Cortesía", courtesy_reason: "Motivo Cortesía", concept: "Concepto",
  product_name: "Producto", quantity: "Cantidad", reference: "Referencia",
};

function MetaBlock({ entries }: { entries: [string, any][] }) {
  return (
    <div className="mt-1.5 rounded-xl bg-white/[0.015] border border-white/[0.03] px-3 py-2 space-y-0.5">
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-start gap-2 text-[10px]">
          <span className="text-white/25 min-w-[70px] shrink-0">{META_LABELS[k] || k}:</span>
          <span className="text-white/50 break-all">
            {typeof v === "object" ? JSON.stringify(v) : typeof v === "number" && (k.includes("amount") || k === "remaining") ? `$${v.toFixed(2)}` : typeof v === "boolean" ? (v ? "Sí" : "No") : String(v)}
          </span>
        </div>
      ))}
    </div>
  );
}

function FilterInput({ placeholder, value, onChange, width, type = "text" }: {
  placeholder?: string; value: string; onChange: (v: string) => void; width?: string; type?: string;
}) {
  return (
    <input type={type} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)}
      style={{ backgroundColor: '#141420', color: '#e2e2e8', colorScheme: 'dark' }}
      className={`h-8 px-2.5 rounded-lg border border-white/[0.08] text-xs placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-blue-500/30 transition-all ${width || ""}`} />
  );
}

function FilterSelect({ value, onChange, placeholder, options, width }: {
  value: string; onChange: (v: string) => void; placeholder: string; options: { value: string; label: string }[]; width?: string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      style={{ backgroundColor: '#141420', color: '#e2e2e8' }}
      className={`h-8 px-2.5 rounded-lg border border-white/[0.08] text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/30 transition-all appearance-none cursor-pointer ${width || ""}`}>
      <option value="" style={{ backgroundColor: '#141420', color: '#888' }}>{placeholder}</option>
      {options.map((o) => <option key={o.value} value={o.value} style={{ backgroundColor: '#141420', color: '#e2e2e8' }}>{o.label}</option>)}
    </select>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <div className="relative w-12 h-12 mb-5">
        <div className="absolute inset-0 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin" />
        <div className="absolute inset-2 rounded-full border-2 border-violet-500/20 border-b-violet-500 animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
      </div>
      <p className="text-sm text-white/30">Cargando flujos operativos...</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 border border-dashed border-white/[0.06] rounded-3xl bg-gradient-to-b from-white/[0.01] to-transparent">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-white/[0.04] to-transparent border border-white/[0.04] flex items-center justify-center mb-4">
        <span className="text-3xl">📭</span>
      </div>
      <p className="text-base font-semibold text-white/40 mb-1">No hay flujos registrados</p>
      <p className="text-xs text-white/20 max-w-sm text-center leading-relaxed">
        Los flujos se crean automáticamente cuando se asigna una habitación. Cambia los filtros o espera a que inicie una nueva operación.
      </p>
    </div>
  );
}
