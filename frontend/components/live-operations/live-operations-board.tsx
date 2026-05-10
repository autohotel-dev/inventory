"use client";

export type ViewMode = 'forensic' | 'compact' | 'alerts' | 'grid';

import { RefreshCw, Activity, Search, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useLiveOperations, fetchRecentReceptionShifts, LiveOperationFilters } from "@/hooks/use-live-operations";
import { ProcessCard } from "@/components/live-operations/process-card";
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

  useEffect(() => {
    // Fetch shifts for dropdown
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

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
          <Activity className="h-10 w-10 text-primary animate-pulse relative z-10" />
        </div>
        <p className="text-muted-foreground font-medium animate-pulse">Sincronizando flujos de operación...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            Operación en Vivo
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Trazabilidad granular de flujos maestros e interacciones (Recepción - Cochero).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={filters.status} onValueChange={(val) => handleFilterChange('status', val)}>
              <SelectTrigger className="w-full sm:w-[150px] bg-background/50 backdrop-blur-sm">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los Estados</SelectItem>
                <SelectItem value="ACTIVA">Solo Activas</SelectItem>
                <SelectItem value="CERRADA">Cerradas</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.shiftId} onValueChange={(val) => handleFilterChange('shiftId', val)}>
              <SelectTrigger className="w-full sm:w-[220px] bg-background/50 backdrop-blur-sm">
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

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar folio, placa, hab..." 
                className="pl-9 bg-background/50 backdrop-blur-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="hidden sm:block">
            <Select value={viewMode} onValueChange={(val) => setViewMode(val as ViewMode)}>
              <SelectTrigger className="w-full sm:w-[170px] bg-background/50 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <LayoutGrid className="h-4 w-4" />
                  <SelectValue placeholder="Vista" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">⚡ Vista Operativa</SelectItem>
                <SelectItem value="forensic">🔍 Vista Forense</SelectItem>
                <SelectItem value="alerts">🚨 Solo Alertas</SelectItem>
                <SelectItem value="grid">🔲 Vista Cuadrícula</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Button
            variant="outline"
            onClick={() => refreshFlows()}
            disabled={refreshing}
            className="w-full sm:w-auto bg-background/50 backdrop-blur-sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Sincronizar
          </Button>
        </div>
      </div>

      <div className={cn("pb-12", viewMode === 'grid' ? "grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4" : "space-y-4")}>
        {filteredFlows.length === 0 ? (
          <div className="text-center py-24 bg-card/30 border border-border/50 rounded-2xl border-dashed">
            <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium">No se encontraron flujos</h3>
            <p className="text-muted-foreground mt-1">Intenta con otro término de búsqueda o asegúrate de que haya operaciones activas.</p>
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
