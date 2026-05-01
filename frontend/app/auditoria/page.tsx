"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Shield, Clock, CreditCard, AlertTriangle, Users, CalendarClock,
} from "lucide-react";
import { AuditMetrics } from "@/components/auditoria/audit-metrics";
import { AuditTimeline } from "@/components/auditoria/audit-timeline";
import { AnomalyDetector } from "@/components/auditoria/anomaly-detector";
import { AuditFilters } from "@/components/auditoria/audit-filters";
import { PaymentFlowTracer } from "@/components/auditoria/payment-flow-tracer";
import { EmployeeActivityPanel } from "@/components/auditoria/employee-activity-panel";
import { SessionTrackerPanel } from "@/components/auditoria/session-tracker-panel";

export default function AuditoriaPage() {
  const handleFiltersChange = (filters: any) => {
    console.log('Filters changed:', filters);
  };

  return (
    <div className="container mx-auto px-2 sm:px-4 md:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 sm:h-14 sm:w-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20 shadow-inner shrink-0">
            <div className="absolute inset-0 bg-primary/20 rounded-xl sm:rounded-2xl blur-md" />
            <Shield className="h-5 w-5 sm:h-7 sm:w-7 text-primary relative z-10" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-black tracking-tighter bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Centro de Auditoría
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">
              Monitoreo de acciones, pagos y actividad
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-[10px] uppercase tracking-widest font-bold bg-emerald-500/5 text-emerald-600 border-emerald-500/20 px-3 py-1 self-start sm:self-auto hidden sm:flex">
          <span className="relative flex h-2 w-2 mr-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          Tiempo Real
        </Badge>
      </div>

      {/* Métricas principales */}
      <AuditMetrics />

      {/* Contenido principal */}
      <Tabs defaultValue="timeline" className="space-y-4">
        <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0">
        <TabsList className="grid w-full min-w-[500px] sm:min-w-0 grid-cols-5 h-11 bg-muted/50 backdrop-blur-sm">
          <TabsTrigger value="timeline" className="flex items-center gap-1.5 text-xs font-semibold">
            <Clock className="h-3.5 w-3.5" />
            Línea de Tiempo
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex items-center gap-1.5 text-xs font-semibold">
            <CreditCard className="h-3.5 w-3.5" />
            Flujo de Pagos
          </TabsTrigger>
          <TabsTrigger value="anomalies" className="flex items-center gap-1.5 text-xs font-semibold">
            <AlertTriangle className="h-3.5 w-3.5" />
            Anomalías
          </TabsTrigger>
          <TabsTrigger value="employees" className="flex items-center gap-1.5 text-xs font-semibold">
            <Users className="h-3.5 w-3.5" />
            Empleados
          </TabsTrigger>
          <TabsTrigger value="sessions" className="flex items-center gap-1.5 text-xs font-semibold">
            <CalendarClock className="h-3.5 w-3.5" />
            Sesiones
          </TabsTrigger>
        </TabsList>
        </div>

        <TabsContent value="timeline" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-3">
              <AuditTimeline />
            </div>
            <div>
              <AuditFilters onFiltersChange={handleFiltersChange} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <PaymentFlowTracer />
        </TabsContent>

        <TabsContent value="anomalies" className="space-y-4">
          <AnomalyDetector />
        </TabsContent>

        <TabsContent value="employees" className="space-y-4">
          <EmployeeActivityPanel />
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4">
          <SessionTrackerPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
