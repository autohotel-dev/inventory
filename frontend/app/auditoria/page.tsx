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
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="relative h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20 shadow-inner">
            <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-md" />
            <Shield className="h-7 w-7 text-primary relative z-10" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Centro de Auditoría
            </h1>
            <p className="text-sm text-muted-foreground">
              Monitoreo completo de acciones, pagos y actividad del sistema
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-[10px] uppercase tracking-widest font-bold bg-emerald-500/5 text-emerald-600 border-emerald-500/20 px-3 py-1">
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
        <TabsList className="grid w-full grid-cols-5 h-11 bg-muted/50 backdrop-blur-sm">
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
