"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, Filter } from "lucide-react";
import { AuditMetrics } from "@/components/auditoria/audit-metrics";
import { AuditTimeline } from "@/components/auditoria/audit-timeline";
import { AnomalyDetector } from "@/components/auditoria/anomaly-detector";
import { AuditFilters } from "@/components/auditoria/audit-filters";
import { PaymentFlowTracer } from "@/components/auditoria/payment-flow-tracer";

export default function AuditoriaPage() {
  const handleFiltersChange = (filters: any) => {
    console.log('Filters changed:', filters);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Centro de Auditoría</h1>
          <p className="text-muted-foreground">
            Monitoreo completo de flujos de pago y actividad del sistema
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4" />
            Filtros
          </Button>
          <Button variant="outline" size="sm">
            <Clock className="h-4 w-4" />
            Tiempo Real
          </Button>
        </div>
      </div>

      {/* Métricas principales */}
      <AuditMetrics />

      {/* Contenido principal */}
      <Tabs defaultValue="timeline" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="timeline">Línea de Tiempo</TabsTrigger>
          <TabsTrigger value="payments">Flujo de Pagos</TabsTrigger>
          <TabsTrigger value="anomalies">Anomalías</TabsTrigger>
          <TabsTrigger value="employees">Empleados</TabsTrigger>
          <TabsTrigger value="sessions">Sesiones</TabsTrigger>
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
          <Card>
            <CardHeader>
              <CardTitle>Actividad por Empleado</CardTitle>
              <CardDescription>
                Monitoreo de acciones y rendimiento por empleado
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Componente de actividad por empleado en desarrollo...
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sesiones de Trabajo</CardTitle>
              <CardDescription>
                Análisis de sesiones y migraciones de turnos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Componente de sesiones en desarrollo...
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
