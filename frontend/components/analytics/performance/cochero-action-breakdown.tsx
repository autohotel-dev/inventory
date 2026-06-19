'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CocheroActionMetrics, SLA_TARGETS } from './types';
import {
  Clock,
  ClipboardCheck,
  Truck,
  DollarSign,
  Eye,
  Tv,
  ArrowDown,
  ArrowUp,
  Timer,
  Package,
} from 'lucide-react';

interface CocheroActionBreakdownProps {
  data: CocheroActionMetrics[];
  loading?: boolean;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  unit = 'min',
  slaTarget,
  total,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  unit?: string;
  slaTarget?: number;
  total?: number;
  color: string;
}) {
  const isWithinSLA = slaTarget ? value <= slaTarget : true;
  const slaPercent = slaTarget && value > 0 ? Math.min(100, (value / slaTarget) * 100) : 0;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
      <div className={`p-2 rounded-md ${color}`}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg font-bold tabular-nums">
            {value > 0 ? value.toFixed(1) : '—'}
          </span>
          {value > 0 && (
            <span className="text-xs text-muted-foreground">{unit}</span>
          )}
          {total !== undefined && total > 0 && (
            <span className="text-xs text-muted-foreground ml-1">({total})</span>
          )}
        </div>
        {slaTarget && value > 0 && (
          <div className="mt-1">
            <div className="flex items-center gap-1.5">
              <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${isWithinSLA ? 'bg-emerald-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(100, slaPercent)}%` }}
                />
              </div>
              <span className={`text-[10px] font-medium ${isWithinSLA ? 'text-emerald-600' : 'text-red-600'}`}>
                {isWithinSLA ? '✓' : '✗'} {slaTarget}m
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function CocheroActionBreakdown({ data, loading }: CocheroActionBreakdownProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Timer className="h-5 w-5" />
            Métricas por Acción — Cocheros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-40 rounded-lg bg-muted/30 animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Timer className="h-5 w-5" />
            Métricas por Acción — Cocheros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No hay datos de acciones para este periodo.</p>
        </CardContent>
      </Card>
    );
  }

  // Only show employees with actual activity
  const activeEmployees = data.filter(
    (e) =>
      e.total_entries_accepted > 0 ||
      e.total_deliveries_accepted > 0 ||
      e.total_checkout_revisions > 0 ||
      e.total_inspections_assigned > 0
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Timer className="h-5 w-5" />
          Métricas por Acción — Cocheros
          <Badge variant="secondary" className="ml-auto text-xs">
            {activeEmployees.length} activos
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Tiempos promedio por cada tipo de acción. Barra indica cumplimiento de SLA.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {activeEmployees.map((emp) => (
            <div key={emp.employee_id} className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">{emp.employee_name}</h4>
                <div className="flex gap-1.5">
                  {emp.total_deliveries_completed > 0 && (
                    <Badge variant="outline" className="text-[10px]">
                      {emp.total_deliveries_completed} entregas
                    </Badge>
                  )}
                  {emp.total_checkout_revisions > 0 && (
                    <Badge variant="outline" className="text-[10px]">
                      {emp.total_checkout_revisions} revisiones
                    </Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {/* Entry Metrics */}
                <MetricCard
                  icon={Clock}
                  label="Aceptar Entrada"
                  value={emp.avg_entry_acceptance_minutes}
                  slaTarget={SLA_TARGETS.cochero.entry_accept}
                  total={emp.total_entries_accepted}
                  color="bg-blue-500"
                />
                <MetricCard
                  icon={ClipboardCheck}
                  label="Llenar Datos"
                  value={emp.avg_entry_data_fill_minutes}
                  slaTarget={SLA_TARGETS.cochero.data_fill}
                  color="bg-indigo-500"
                />

                {/* Delivery Metrics */}
                <MetricCard
                  icon={Package}
                  label="Aceptar Consumo"
                  value={emp.avg_delivery_acceptance_minutes}
                  slaTarget={SLA_TARGETS.cochero.delivery_accept}
                  total={emp.total_deliveries_accepted}
                  color="bg-amber-500"
                />
                <MetricCard
                  icon={Truck}
                  label="Ejecutar Entrega"
                  value={emp.avg_delivery_execution_minutes}
                  slaTarget={SLA_TARGETS.cochero.delivery_exec}
                  total={emp.total_deliveries_completed}
                  color="bg-orange-500"
                />

                {/* Payment collection */}
                <MetricCard
                  icon={DollarSign}
                  label="Recolección Dinero"
                  value={emp.avg_payment_collection_minutes}
                  color="bg-green-500"
                />

                {/* Checkout revision */}
                <MetricCard
                  icon={Eye}
                  label="Revisión Salida"
                  value={emp.avg_checkout_revision_minutes}
                  slaTarget={SLA_TARGETS.cochero.revision}
                  total={emp.total_checkout_revisions}
                  color="bg-purple-500"
                />

                {/* TV Inspection */}
                <MetricCard
                  icon={Tv}
                  label="Revisión TV"
                  value={emp.avg_inspection_acceptance_minutes}
                  total={emp.total_inspections_assigned}
                  color="bg-cyan-500"
                />
                <MetricCard
                  icon={Tv}
                  label="Completar Inspección"
                  value={emp.avg_inspection_completion_minutes}
                  total={emp.total_inspections_completed}
                  color="bg-teal-500"
                />
              </div>

              {/* Delivery breakdown */}
              {emp.total_deliveries_accepted > 0 && (
                <div className="flex gap-2 flex-wrap pt-1">
                  {emp.consumption_deliveries > 0 && (
                    <Badge variant="secondary" className="text-[10px]">
                      🍔 Consumos: {emp.consumption_deliveries}
                    </Badge>
                  )}
                  {emp.extra_person_deliveries > 0 && (
                    <Badge variant="secondary" className="text-[10px]">
                      👤 Persona Extra: {emp.extra_person_deliveries}
                    </Badge>
                  )}
                  {emp.extra_hour_deliveries > 0 && (
                    <Badge variant="secondary" className="text-[10px]">
                      ⏰ Hora Extra: {emp.extra_hour_deliveries}
                    </Badge>
                  )}
                  {emp.renewal_deliveries > 0 && (
                    <Badge variant="secondary" className="text-[10px]">
                      🔄 Renovaciones: {emp.renewal_deliveries}
                    </Badge>
                  )}
                </div>
              )}

              <div className="border-b border-border/40" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
