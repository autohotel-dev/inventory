"use client";

import { useState, useEffect } from "react";
import { useRealtimeOperations } from "@/hooks/use-realtime-operations";
import { FlowStatsBar } from "@/components/operations/flow-stats-bar";
import { FlowCard } from "@/components/operations/flow-card";
import { FlowTimelineModal } from "@/components/operations/flow-timeline-modal";
import { formatFlowId } from "@/hooks/use-flow-timeline";

// ─── Status filter config ────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: "all", label: "Todos", icon: "📋" },
  { value: "ACTIVO", label: "Activos", icon: "⚡" },
  { value: "COMPLETADO", label: "Completados", icon: "✅" },
  { value: "CANCELADO", label: "Cancelados", icon: "❌" },
] as const;

// ─── Page ────────────────────────────────────────────────────────────────────

export default function OperacionPage() {
  const {
    flows,
    stats,
    filters,
    loading,
    hasMore,
    isConnected,
    selectedFlowId,
    setSelectedFlowId,
    updateFilter,
    resetFilters,
    loadMore,
    refetch,
  } = useRealtimeOperations();

  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [liveTimer, setLiveTimer] = useState(0);

  // Tick every second to update elapsed times
  useEffect(() => {
    const timer = setInterval(() => setLiveTimer((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSelectFlow = (flowId: string) => {
    setSelectedFlowId(flowId);
    setIsTimelineOpen(true);
  };

  const handleCloseTimeline = () => {
    setIsTimelineOpen(false);
    // Keep selectedFlowId so highlight remains briefly
    setTimeout(() => setSelectedFlowId(null), 300);
  };

  const activeFiltersCount = Object.entries(filters).filter(
    ([key, value]) => {
      if (key === "status" && value !== "all") return true;
      if (key === "roomNumber" && value) return true;
      if (key === "search" && value) return true;
      if (key === "dateTo" && value) return true;
      return false;
    }
  ).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-white/[0.06] bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">
          <div className="flex items-center justify-between mb-1">
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

            <button
              type="button"
              onClick={refetch}
              className="p-2 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-white/[0.06] transition-colors"
              title="Actualizar"
            >
              🔄
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-6">
        {/* Stats */}
        <FlowStatsBar stats={stats} isConnected={isConnected} />

        {/* Filters Bar */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Status Tabs */}
            <div className="flex gap-1 bg-white/[0.03] rounded-lg p-1">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateFilter("status", opt.value)}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200
                    ${
                      filters.status === opt.value
                        ? "bg-white/[0.1] text-foreground shadow-sm"
                        : "text-muted-foreground/50 hover:text-foreground hover:bg-white/[0.04]"
                    }
                  `}
                >
                  <span>{opt.icon}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Buscar por ID (F0001) o habitación..."
                value={filters.search}
                onChange={(e) => updateFilter("search", e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/30 transition-all"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/30 text-sm">
                🔍
              </span>
            </div>

            {/* Room Filter */}
            <input
              type="text"
              placeholder="Habitación"
              value={filters.roomNumber}
              onChange={(e) => updateFilter("roomNumber", e.target.value)}
              className="w-24 h-9 px-3 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-blue-500/40 transition-all"
            />

            {/* Date From */}
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => updateFilter("dateFrom", e.target.value)}
              className="h-9 px-3 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/40 transition-all"
            />

            {/* Date To */}
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => updateFilter("dateTo", e.target.value)}
              className="h-9 px-3 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/40 transition-all"
            />

            {/* Reset */}
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={resetFilters}
                className="h-9 px-3 rounded-lg text-xs text-muted-foreground/50 hover:text-foreground hover:bg-white/[0.04] transition-colors border border-white/[0.06]"
              >
                Limpiar ({activeFiltersCount})
              </button>
            )}
          </div>
        </div>

        {/* Flows Grid */}
        {loading && flows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin mb-4" />
            <p className="text-sm text-muted-foreground/50">
              Cargando flujos operativos...
            </p>
          </div>
        ) : flows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border border-dashed border-white/[0.08] rounded-2xl">
            <span className="text-5xl mb-4">📭</span>
            <p className="text-base font-medium text-foreground/60 mb-1">
              No hay flujos registrados
            </p>
            <p className="text-xs text-muted-foreground/40 max-w-sm text-center">
              Los flujos se crean automáticamente cuando se asigna una
              habitación. Cambia los filtros o espera a que inicie una nueva
              operación.
            </p>
          </div>
        ) : (
          <>
            {/* Results count */}
            <div className="flex items-center justify-between text-xs text-muted-foreground/40 px-1">
              <span>
                {flows.length} flujo(s) encontrado(s)
                {filters.status !== "all" && ` • Estado: ${filters.status}`}
              </span>
              <span className="tabular-nums" key={liveTimer}>
                {new Date().toLocaleTimeString("es-MX")}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {flows.map((flow) => (
                <FlowCard
                  key={flow.id}
                  flow={flow}
                  onSelect={handleSelectFlow}
                  isSelected={selectedFlowId === flow.id}
                />
              ))}
            </div>

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
          </>
        )}
      </div>

      {/* Timeline Modal */}
      <FlowTimelineModal
        flowId={selectedFlowId}
        isOpen={isTimelineOpen}
        onClose={handleCloseTimeline}
      />
    </div>
  );
}
