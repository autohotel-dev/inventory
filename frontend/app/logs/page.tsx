"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Shield, Clock, CreditCard, AlertTriangle, User, Home,
  Activity, Download, RotateCw, Search, Filter, ChevronDown, X,
  CalendarDays, Fingerprint,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLogCenter, type LogFilters } from "@/hooks/use-log-center";
import { LogRow, MiniSparkline, ActiveFilters, ACTION_TITLES } from "./log-components";
import { RoomCaseView } from "./room-case-view";

type LogCategory = "all" | "reception" | "payments" | "auth" | "alerts";

const CATEGORY_CONFIGS: { key: LogCategory; label: string; icon: React.ReactNode; statKey: string }[] = [
  { key: "all", label: "Todos", icon: <Activity className="h-3.5 w-3.5" />, statKey: "total" },
  { key: "reception", label: "Recepción", icon: <Home className="h-3.5 w-3.5" />, statKey: "reception" },
  { key: "payments", label: "Pagos", icon: <CreditCard className="h-3.5 w-3.5" />, statKey: "payments" },
  { key: "auth", label: "Sesiones", icon: <User className="h-3.5 w-3.5" />, statKey: "auth" },
  { key: "alerts", label: "Alertas", icon: <AlertTriangle className="h-3.5 w-3.5" />, statKey: "alerts" },
];

const TIME_PRESETS = [
  { key: "today", label: "Hoy" },
  { key: "yesterday", label: "Ayer" },
  { key: "week", label: "7 días" },
  { key: "month", label: "30 días" },
];

const SEVERITY_OPTIONS = [
  { value: "all", label: "Todas", dot: "bg-gradient-to-r from-blue-400 to-emerald-400" },
  { value: "CRITICAL", label: "Crítico", dot: "bg-red-500" },
  { value: "WARNING", label: "Alerta", dot: "bg-amber-400" },
  { value: "INFO", label: "Info", dot: "bg-blue-400" },
];

const ALL_ACTIONS = [
  "CHECKOUT", "CHECKOUT_REVIEW", "UPDATE", "CONSUMPTION_ADDED", "LOGIN", "LOGIN_FAILED", "LOGOUT",
  "ADD_PERSON", "REMOVE_PERSON", "EXTRA_PERSON", "EXTRA_HOUR", "RENEWAL", "PROMO_4H",
  "CANCEL_ITEM", "CANCEL_CHARGE", "TOLERANCE", "DAMAGE_CHARGE", "PURGE_SYSTEM",
];

export default function LogsPage() {
  const {
    logs, stats, filters, loading, hasMore, nameMap, activeFilterCount,
    updateFilter, resetFilters, loadMore, refetch, exportCSV,
  } = useLogCenter();

  const [caseRoom, setCaseRoom] = useState<string | null>(null);

  return (
    <>
    {caseRoom && (
      <RoomCaseView roomNumber={caseRoom} onClose={() => setCaseRoom(null)} nameMap={nameMap} />
    )}
    <div className="container mx-auto px-2 sm:px-4 md:px-6 py-4 space-y-4">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="relative h-11 w-11 rounded-2xl bg-gradient-to-br from-indigo-500/20 via-primary/15 to-violet-500/20 flex items-center justify-center border border-primary/10 shadow-inner shrink-0">
            <Fingerprint className="h-6 w-6 text-primary relative z-10" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tighter">Centro de Investigación</h1>
            <p className="text-xs text-muted-foreground/60">Auditoría forense y trazabilidad operativa</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5 h-8 rounded-xl text-xs">
            <Download className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Exportar CSV</span>
          </Button>
          <Button variant="outline" size="sm" onClick={refetch} className="gap-1.5 h-8 rounded-xl text-xs">
            <RotateCw className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Actualizar</span>
          </Button>
        </div>
      </div>

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: "Total", value: stats.total, icon: <Activity className="h-4 w-4" />, color: "text-primary", bg: "from-primary/10" },
          { label: "Recepción", value: stats.reception, icon: <Home className="h-4 w-4" />, color: "text-blue-400", bg: "from-blue-500/10" },
          { label: "Pagos", value: stats.payments, icon: <CreditCard className="h-4 w-4" />, color: "text-emerald-400", bg: "from-emerald-500/10" },
          { label: "Alertas", value: stats.alerts, icon: <AlertTriangle className="h-4 w-4" />, color: "text-amber-400", bg: "from-amber-500/10" },
        ].map(kpi => (
          <Card key={kpi.label} className="border-0 shadow-md bg-gradient-to-br ${kpi.bg} to-transparent ring-1 ring-border/10 overflow-hidden">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between mb-1">
                <span className={`${kpi.color}`}>{kpi.icon}</span>
                <span className="text-lg sm:text-2xl font-black tabular-nums">{kpi.value.toLocaleString()}</span>
              </div>
              <p className="text-[10px] text-muted-foreground/50 font-medium uppercase tracking-wider">{kpi.label}</p>
              <div className="mt-2">
                <MiniSparkline data={stats.byHour} maxHeight={16} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ─── Category Tabs ─── */}
      <div className="flex gap-1.5 p-1 bg-muted/20 rounded-xl border border-border/20 overflow-x-auto">
        {CATEGORY_CONFIGS.map(cat => {
          const count = (stats as any)[cat.statKey] || 0;
          const isActive = filters.category === cat.key;
          return (
            <Button
              key={cat.key} variant={isActive ? "default" : "ghost"} size="sm"
              onClick={() => updateFilter("category", cat.key)}
              className={`gap-1.5 h-8 rounded-lg text-xs font-semibold whitespace-nowrap ${isActive ? "shadow-lg shadow-primary/25" : "text-muted-foreground"}`}
            >
              {cat.icon} {cat.label}
              <span className={`text-[9px] tabular-nums font-mono px-1.5 py-0.5 rounded-md ${isActive ? "bg-primary-foreground/20" : "bg-muted"}`}>{count}</span>
            </Button>
          );
        })}
      </div>

      {/* ─── Filters Toolbar ─── */}
      <Card className="border-0 shadow-md ring-1 ring-border/10 overflow-hidden">
        <CardContent className="p-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            {/* Search */}
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground/40" />
              <Input
                placeholder="Buscar acción, empleado, descripción..."
                value={filters.search}
                onChange={e => updateFilter("search", e.target.value)}
                className="pl-9 h-9 text-xs rounded-lg border-border/20 bg-muted/20"
              />
              {filters.search && (
                <button onClick={() => updateFilter("search", "")} className="absolute right-2.5 top-2.5 text-muted-foreground/40 hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {/* Employee */}
            <select
              value={filters.employeeId}
              onChange={e => updateFilter("employeeId", e.target.value)}
              className="h-9 text-xs rounded-lg border border-border/20 bg-muted/20 px-3 text-foreground appearance-none cursor-pointer"
            >
              <option value="">👤 Todos los empleados</option>
              {stats.byEmployee.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name} ({emp.count})</option>
              ))}
            </select>
            {/* Action Type */}
            <select
              value={filters.actionType}
              onChange={e => updateFilter("actionType", e.target.value)}
              className="h-9 text-xs rounded-lg border border-border/20 bg-muted/20 px-3 text-foreground appearance-none cursor-pointer"
            >
              <option value="">⚡ Todas las acciones</option>
              {ALL_ACTIONS.map(action => (
                <option key={action} value={action}>{ACTION_TITLES[action] || action}</option>
              ))}
            </select>
            {/* Room */}
            <Input
              placeholder="🏠 Habitación"
              value={filters.roomNumber}
              onChange={e => updateFilter("roomNumber", e.target.value)}
              className="h-9 text-xs rounded-lg border-border/20 bg-muted/20"
            />
          </div>

          {/* Time presets + Severity + Date */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-muted/20 rounded-lg p-0.5 border border-border/10">
              {TIME_PRESETS.map(tp => (
                <button
                  key={tp.key}
                  onClick={() => updateFilter("timePreset", tp.key)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
                    filters.timePreset === tp.key
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tp.label}
                </button>
              ))}
            </div>
            <div className="h-5 w-px bg-border/20" />
            <div className="flex items-center gap-1">
              {SEVERITY_OPTIONS.map(sev => (
                <button
                  key={sev.value}
                  onClick={() => updateFilter("severity", sev.value)}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
                    filters.severity === sev.value
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground/60 hover:text-foreground"
                  }`}
                >
                  <div className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} />
                  {sev.label}
                </button>
              ))}
            </div>
            <div className="h-5 w-px bg-border/20" />
            <div className="flex items-center gap-1.5">
              <CalendarDays className="h-3 w-3 text-muted-foreground/40" />
              <input type="date" value={filters.dateFrom} onChange={e => updateFilter("dateFrom", e.target.value)} className="h-7 text-[10px] rounded-md border border-border/20 bg-muted/20 px-2 text-foreground" />
              <span className="text-[10px] text-muted-foreground/30">→</span>
              <input type="date" value={filters.dateTo} onChange={e => updateFilter("dateTo", e.target.value)} className="h-7 text-[10px] rounded-md border border-border/20 bg-muted/20 px-2 text-foreground" />
            </div>
          </div>

          {/* Active filter chips */}
          <ActiveFilters filters={filters} updateFilter={updateFilter} resetFilters={resetFilters} stats={stats} />
        </CardContent>
      </Card>

      {/* ─── Main Content ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Log List */}
        <div className="lg:col-span-3">
          <Card className="border-0 shadow-xl ring-1 ring-border/20 overflow-hidden">
            <CardHeader className="py-3 px-4 border-b border-border/10 bg-muted/5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  Timeline
                  <span className="text-[10px] font-mono text-muted-foreground/50 bg-muted px-2 py-0.5 rounded-md tabular-nums">
                    {logs.length} registros
                  </span>
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-3">
                  <div className="relative">
                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-muted" />
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-primary absolute inset-0" />
                  </div>
                  <p className="text-xs text-muted-foreground animate-pulse">Cargando registros...</p>
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-24 text-muted-foreground">
                  <Fingerprint className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="font-semibold text-sm">Sin registros</p>
                  <p className="text-xs mt-1 text-muted-foreground/60">No hay logs que coincidan con los filtros</p>
                  <Button variant="outline" size="sm" onClick={resetFilters} className="mt-4 text-xs">Limpiar filtros</Button>
                </div>
              ) : (
                <ScrollArea className="h-[55vh] sm:h-[60vh] lg:h-[640px]">
                  <div>
                    {logs.map(log => (
                      <LogRow
                        key={log.id}
                        log={log}
                        nameMap={nameMap}
                        onFilterEmployee={(id) => updateFilter("employeeId", id)}
                        onFilterRoom={(room) => setCaseRoom(room)}
                      />
                    ))}
                  </div>
                  {hasMore && (
                    <div className="p-4 text-center border-t border-border/10">
                      <Button variant="outline" size="sm" onClick={loadMore} className="text-xs gap-1.5 rounded-xl h-8 px-6">
                        <ChevronDown className="h-3.5 w-3.5" /> Cargar más
                      </Button>
                    </div>
                  )}
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Top Actions */}
          <Card className="border-0 shadow-lg ring-1 ring-border/10">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-xs flex items-center gap-2 text-muted-foreground">
                <Activity className="h-3.5 w-3.5 text-primary" />
                Top Acciones
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-1 pb-3 px-4 space-y-1.5">
              {stats.byAction.slice(0, 8).map((action, i) => {
                const maxCount = stats.byAction[0]?.count || 1;
                const pct = Math.round((action.count / maxCount) * 100);
                const isFiltered = filters.actionType === action.action;
                return (
                  <button
                    key={i}
                    onClick={() => updateFilter("actionType", isFiltered ? "" : action.action)}
                    className={`w-full text-left space-y-0.5 p-1.5 rounded-lg transition-all ${isFiltered ? "bg-primary/10 ring-1 ring-primary/20" : "hover:bg-muted/30"}`}
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-medium truncate">{ACTION_TITLES[action.action] || action.action}</span>
                      <span className="text-[10px] font-bold tabular-nums text-primary ml-2">{action.count}</span>
                    </div>
                    <div className="h-1 bg-muted/30 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-primary/60 to-primary/30 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* Top Employees */}
          {stats.byEmployee.length > 0 && (
            <Card className="border-0 shadow-lg ring-1 ring-border/10">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-xs flex items-center gap-2 text-muted-foreground">
                  <User className="h-3.5 w-3.5 text-violet-500" />
                  Actividad por Empleado
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-1 pb-3 px-4 space-y-1.5">
                {stats.byEmployee.map((emp, i) => {
                  const maxCount = stats.byEmployee[0]?.count || 1;
                  const pct = Math.round((emp.count / maxCount) * 100);
                  const isFiltered = filters.employeeId === emp.id;
                  return (
                    <button
                      key={i}
                      onClick={() => updateFilter("employeeId", isFiltered ? "" : emp.id)}
                      className={`w-full text-left space-y-0.5 p-1.5 rounded-lg transition-all ${isFiltered ? "bg-violet-500/10 ring-1 ring-violet-500/20" : "hover:bg-muted/30"}`}
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-medium truncate">{emp.name}</span>
                        <span className="text-[10px] font-bold tabular-nums text-violet-400 ml-2">{emp.count}</span>
                      </div>
                      <div className="h-1 bg-muted/30 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-violet-500/60 to-violet-500/30 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Hourly Activity */}
          <Card className="border-0 shadow-lg ring-1 ring-border/10">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-xs flex items-center gap-2 text-muted-foreground">
                <Clock className="h-3.5 w-3.5 text-amber-500" />
                Actividad por Hora
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-1 pb-3 px-4">
              <MiniSparkline data={stats.byHour} maxHeight={40} />
              <div className="flex justify-between mt-1">
                <span className="text-[9px] text-muted-foreground/30">00:00</span>
                <span className="text-[9px] text-muted-foreground/30">12:00</span>
                <span className="text-[9px] text-muted-foreground/30">23:00</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </>
  );
}
