"use client";

export type ViewMode = 'forensic' | 'compact' | 'alerts' | 'grid';

import { RefreshCw, Activity, Search, LayoutGrid, Shield, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLiveOperations, fetchRecentReceptionShifts, LiveOperationFilters } from "@/hooks/use-live-operations";
import { ProcessCard } from "@/components/live-operations/process-card";
import { AnomalyAlertsPanel } from "@/components/live-operations/anomaly-alerts-panel";
import Link from "next/link";
import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export function LiveOperationsBoard() {
  const { flows, loading, refreshing, filters, setFilters, fetchFlows, refreshFlows } = useLiveOperations();
  const [searchTerm, setSearchTerm] = useState("");
  const [recentShifts, setRecentShifts] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('compact');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchRecentReceptionShifts().then(setRecentShifts);
  }, []);

  const handleFilterChange = (key: keyof LiveOperationFilters, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    fetchFlows(newFilters);
  };

  const filteredFlows = flows.filter(flow => {
    const term = searchTerm.toLowerCase();
    return (
      flow.visualId.toLowerCase().includes(term) ||
      flow.roomNumber.toLowerCase().includes(term) ||
      (flow.vehiclePlate && flow.vehiclePlate.toLowerCase().includes(term)) ||
      flow.status.toLowerCase().includes(term)
    );
  });

  const activeCount = flows.filter(f => f.status === 'ACTIVA').length;
  const completedCount = flows.filter(f => f.status === 'COMPLETADO').length;

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
          <div className="relative h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center">
            <Activity className="h-8 w-8 text-primary animate-pulse" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <p className="text-lg font-medium text-foreground">Sincronizando operaciones</p>
          <p className="text-sm text-muted-foreground">Conectando con la base de datos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header mejorado */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20">
              <Activity className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Operación en Vivo</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Monitoreo de flujos operativos en tiempo real</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/operacion-en-vivo/auditoria-empleados">
              <Button variant="outline" size="sm" className="gap-2">
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">Auditoría</span>
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshFlows()}
              disabled={refreshing}
              className="gap-2"
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
              <span className="hidden sm:inline">Sincronizar</span>
            </Button>
          </div>
        </div>

        {/* Stats rápidos */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-muted-foreground">{activeCount} activa{activeCount !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-slate-400" />
            <span className="text-muted-foreground">{completedCount} completada{completedCount !== 1 ? 's' : ''}</span>
          </div>
          <div className="text-muted-foreground">•</div>
          <span className="text-muted-foreground">{filteredFlows.length} total</span>
        </div>
      </div>

      {/* Barra de búsqueda y filtros */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por folio, habitación, placa..." 
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowFilters(!showFilters)}
            className={cn("gap-2", showFilters && "bg-primary/10 border-primary/30")}
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filtros</span>
          </Button>
          <Select value={viewMode} onValueChange={(val) => setViewMode(val as ViewMode)}>
            <SelectTrigger className="w-[140px]">
              <div className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="compact">⚡ Compacta</SelectItem>
              <SelectItem value="forensic">🔍 Forense</SelectItem>
              <SelectItem value="alerts">🚨 Alertas</SelectItem>
              <SelectItem value="grid">🔲 Cuadrícula</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Filtros expandibles */}
        {showFilters && (
          <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50 animate-in fade-in slide-in-from-top-2 duration-200">
            <Select value={filters.status} onValueChange={(val) => handleFilterChange('status', val)}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los estados</SelectItem>
                <SelectItem value="ACTIVA">🟢 Activas</SelectItem>
                <SelectItem value="CERRADA">⚫ Cerradas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.shiftId} onValueChange={(val) => handleFilterChange('shiftId', val)}>
              <SelectTrigger className="w-[240px] h-9">
                <SelectValue placeholder="Turno" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Últimas 50 operaciones</SelectItem>
                {recentShifts.map(shift => (
                  <SelectItem key={shift.id} value={shift.id}>
                    {shift.employees?.first_name} ({format(new Date(shift.clock_in_at), "d MMM, HH:mm", { locale: es })})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filters.status !== 'ALL' || filters.shiftId !== 'ALL' ? (
              <Button variant="ghost" size="sm" onClick={() => { setFilters({ status: 'ALL', shiftId: 'ALL' }); fetchFlows({ status: 'ALL', shiftId: 'ALL' }); }} className="text-xs gap-1">
                <X className="h-3 w-3" /> Limpiar filtros
              </Button>
            ) : null}
          </div>
        )}
      </div>

      {/* Panel de anomalías */}
      <AnomalyAlertsPanel />

      {/* Lista de operaciones */}
      <div className={cn(
        "pb-12",
        viewMode === 'grid' ? "grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4" : "space-y-3"
      )}>
        {filteredFlows.length === 0 ? (
          <div className="text-center py-20 bg-card/30 border border-border/50 rounded-2xl border-dashed">
            <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Activity className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-medium text-foreground">Sin operaciones</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
              {searchTerm 
                ? `No se encontraron resultados para "${searchTerm}"`
                : "No hay flujos de operación registrados aún."
              }
            </p>
          </div>
        ) : (
          filteredFlows.map(flow => (
            <ProcessCard key={flow.id} flow={flow} viewMode={viewMode} />
          ))
        )}
      </div>
    </div>
  );
}
