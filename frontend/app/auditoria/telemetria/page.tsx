"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { 
  Activity, Search, Clock, ShieldAlert, MousePointerClick, 
  Server, Globe, ChevronDown, CheckCircle2, XCircle
} from "lucide-react";
import { useTelemetry, TelemetryRecord } from "@/hooks/use-telemetry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

const getDurationColor = (ms: number | null) => {
  if (ms === null) return "text-muted-foreground";
  if (ms < 300) return "text-emerald-500 bg-emerald-500/10";
  if (ms < 1000) return "text-amber-500 bg-amber-500/10";
  return "text-red-500 bg-red-500/10";
};

const getActionIcon = (type: string) => {
  switch (type) {
    case 'UI_CLICK': return <MousePointerClick className="h-4 w-4" />;
    case 'API_REQUEST': return <Server className="h-4 w-4" />;
    case 'PAGE_VIEW': return <Globe className="h-4 w-4" />;
    default: return <Activity className="h-4 w-4" />;
  }
};

const getActionColor = (type: string) => {
  switch (type) {
    case 'UI_CLICK': return "bg-blue-500/10 text-blue-500";
    case 'API_REQUEST': return "bg-purple-500/10 text-purple-500";
    case 'PAGE_VIEW': return "bg-emerald-500/10 text-emerald-500";
    default: return "bg-gray-500/10 text-gray-500";
  }
};

function TelemetryRow({ record }: { record: TelemetryRecord }) {
  const [expanded, setExpanded] = useState(false);
  const iconColor = getActionColor(record.action_type);
  const durationStyle = getDurationColor(record.duration_ms);

  return (
    <div className="border-b border-border/10 last:border-0 hover:bg-muted/30 transition-colors">
      <div 
        className="flex items-center gap-3 px-4 py-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${iconColor}`}>
          {getActionIcon(record.action_type)}
        </div>
        
        <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-[13px] truncate max-w-[200px] sm:max-w-[300px]">
                {record.action_name || 'Acción Desconocida'}
              </span>
              {record.action_type === 'API_REQUEST' && record.is_success !== null && (
                record.is_success ? 
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> : 
                  <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
              )}
            </div>
            
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground truncate">
              {record.module && <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">{record.module}</Badge>}
              <span className="truncate">{record.endpoint || record.page}</span>
              <span className="hidden sm:inline">•</span>
              <span className="hidden sm:inline">{record.employee_name || 'Usuario Anónimo'}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {record.duration_ms !== null && (
              <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border border-transparent ${durationStyle} border-current/20`}>
                {record.duration_ms}ms
              </span>
            )}
            <div className="text-right">
              <div className="text-[10px] text-muted-foreground font-mono">
                {format(new Date(record.created_at), "HH:mm:ss", { locale: es })}
              </div>
              <div className="text-[9px] text-muted-foreground/60">
                {format(new Date(record.created_at), "dd MMM yy", { locale: es })}
              </div>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-1 ml-11 border-l-2 border-primary/20 pl-4 space-y-3">
          {/* Payload Viewer */}
          {record.payload && (
            <div className="space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Payload / Datos Enviados</div>
              <div className="bg-background/50 border border-border/30 rounded-lg p-2.5 overflow-x-auto">
                <pre className="text-[11px] font-mono text-emerald-400/90 m-0">
                  {JSON.stringify(record.payload, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Error Details */}
          {record.error_details && (
            <div className="space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-red-400">Detalles de Error</div>
              <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-2.5 overflow-x-auto">
                <pre className="text-[11px] font-mono text-red-400 m-0 whitespace-pre-wrap">
                  {typeof record.error_details === 'string' 
                    ? record.error_details 
                    : JSON.stringify(record.error_details, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Fallback if no details */}
          {!record.payload && !record.error_details && (
            <div className="text-xs text-muted-foreground italic bg-muted/20 p-2 rounded">
              No hay datos adicionales (payload) registrados para esta interacción.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TelemetryDashboard() {
  const { data, loading, hasMore, filters, stats, updateFilter, loadMore, refresh } = useTelemetry();

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Telemetría y Rendimiento
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitoreo global de interacciones de usuario y peticiones API.
          </p>
        </div>
        <Button onClick={refresh} variant="outline" size="sm" className="gap-2">
          <Clock className="h-4 w-4" /> Actualizar
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-background to-muted/20 border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Activity className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-black">{stats.total}</div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Eventos Listados</div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-background to-muted/20 border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Clock className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <div className="text-2xl font-black font-mono">{stats.avgDuration}ms</div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tiempo Promedio (API)</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-background to-muted/20 border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-red-500/10 flex items-center justify-center">
              <ShieldAlert className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <div className="text-2xl font-black">{stats.errors}</div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Errores Detectados</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card className="border-border/40 shadow-xl overflow-hidden">
        <CardHeader className="bg-muted/10 border-b border-border/20 p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por acción o endpoint..." 
                className="pl-9 h-9"
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
              />
            </div>
            
            <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
              <Button 
                size="sm" 
                variant={filters.action_type === 'ALL' ? 'default' : 'secondary'}
                onClick={() => updateFilter('action_type', 'ALL')}
                className="h-9 whitespace-nowrap"
              >
                Todos
              </Button>
              <Button 
                size="sm" 
                variant={filters.action_type === 'API_REQUEST' ? 'default' : 'secondary'}
                onClick={() => updateFilter('action_type', 'API_REQUEST')}
                className="h-9 whitespace-nowrap gap-1.5"
              >
                <Server className="h-3.5 w-3.5" /> API
              </Button>
              <Button 
                size="sm" 
                variant={filters.action_type === 'UI_CLICK' ? 'default' : 'secondary'}
                onClick={() => updateFilter('action_type', 'UI_CLICK')}
                className="h-9 whitespace-nowrap gap-1.5"
              >
                <MousePointerClick className="h-3.5 w-3.5" /> Clicks
              </Button>
              
              <div className="w-px h-9 bg-border/50 mx-1" />
              
              <Button 
                size="sm" 
                variant={filters.status === 'ERROR' ? 'destructive' : 'outline'}
                onClick={() => updateFilter('status', filters.status === 'ERROR' ? 'ALL' : 'ERROR')}
                className="h-9 whitespace-nowrap gap-1.5 border-red-500/20"
              >
                <XCircle className="h-3.5 w-3.5" /> Fallos
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <ScrollArea className="h-[60vh] min-h-[500px]">
            {loading && data.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Activity className="h-8 w-8 animate-pulse mb-3 opacity-50" />
                <p className="text-sm">Recopilando telemetría...</p>
              </div>
            ) : data.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <div className="bg-muted/30 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Search className="h-6 w-6 opacity-40" />
                </div>
                <p className="font-medium">No se encontraron eventos</p>
                <p className="text-xs opacity-70 mt-1">Intenta con otros filtros de búsqueda.</p>
              </div>
            ) : (
              <div className="divide-y divide-transparent">
                {data.map(record => (
                  <TelemetryRow key={record.id} record={record} />
                ))}
              </div>
            )}
            
            {hasMore && (
              <div className="p-4 text-center border-t border-border/10 bg-muted/5">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={loadMore} 
                  disabled={loading}
                  className="text-xs"
                >
                  {loading ? 'Cargando...' : 'Cargar más registros'}
                </Button>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
