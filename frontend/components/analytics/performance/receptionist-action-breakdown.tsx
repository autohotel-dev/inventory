'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SLA_TARGETS } from './types';
import {
  Clock,
  ClipboardCheck,
  DollarSign,
  Eye,
  Tv,
  Timer,
  CreditCard,
  Receipt,
  ShoppingCart,
} from 'lucide-react';

// Type for the new receptionist action metrics RPC
export interface ReceptionistActionMetrics {
  employee_id: string;
  employee_name: string;
  // Payment confirmation
  total_payments_confirmed: number;
  avg_entry_confirmation_minutes: number;
  avg_extra_confirmation_minutes: number;
  // Checkout processing
  total_checkouts_processed: number;
  avg_checkout_processing_minutes: number;
  // Consumption pipeline
  total_consumptions_created: number;
  avg_consumption_to_delivery_minutes: number;
  // Inspection assignment
  total_inspections_assigned: number;
  avg_inspection_turnaround_minutes: number;
  // Revenue & Volume
  total_revenue_confirmed: number;
  entry_confirmations: number;
  extra_confirmations: number;
  is_active: boolean;
}

interface ReceptionistActionBreakdownProps {
  data: ReceptionistActionMetrics[];
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
  isCurrency,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  unit?: string;
  slaTarget?: number;
  total?: number;
  color: string;
  isCurrency?: boolean;
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
            {isCurrency
              ? `$${value > 0 ? value.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '0'}`
              : value > 0
              ? value.toFixed(1)
              : '—'}
          </span>
          {!isCurrency && value > 0 && (
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

export function ReceptionistActionBreakdown({ data, loading }: ReceptionistActionBreakdownProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Timer className="h-5 w-5" />
            Métricas por Acción — Recepcionistas
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
            Métricas por Acción — Recepcionistas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No hay datos de acciones para este periodo.</p>
        </CardContent>
      </Card>
    );
  }

  // Only show employees with activity
  const activeEmployees = data.filter(
    (e) =>
      e.total_payments_confirmed > 0 ||
      e.total_checkouts_processed > 0 ||
      e.total_consumptions_created > 0
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Timer className="h-5 w-5" />
          Métricas por Acción — Recepcionistas
          <Badge variant="secondary" className="ml-auto text-xs">
            {activeEmployees.length} activos
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Tiempos promedio por cada tipo de acción de recepción. Barra indica cumplimiento de SLA.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {activeEmployees.map((emp) => (
            <div key={emp.employee_id} className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">{emp.employee_name}</h4>
                <div className="flex gap-1.5">
                  {emp.total_payments_confirmed > 0 && (
                    <Badge variant="outline" className="text-[10px]">
                      {emp.total_payments_confirmed} pagos
                    </Badge>
                  )}
                  {emp.total_revenue_confirmed > 0 && (
                    <Badge variant="outline" className="text-[10px] text-emerald-600">
                      ${emp.total_revenue_confirmed.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {/* Payment confirmation */}
                <MetricCard
                  icon={CreditCard}
                  label="Confirmar Entrada"
                  value={emp.avg_entry_confirmation_minutes}
                  slaTarget={SLA_TARGETS.receptionist.checkin}
                  total={emp.entry_confirmations}
                  color="bg-blue-500"
                />
                <MetricCard
                  icon={Receipt}
                  label="Confirmar Extras"
                  value={emp.avg_extra_confirmation_minutes}
                  slaTarget={SLA_TARGETS.receptionist.checkout}
                  total={emp.extra_confirmations}
                  color="bg-indigo-500"
                />

                {/* Checkout processing */}
                <MetricCard
                  icon={Eye}
                  label="Procesar Salida"
                  value={emp.avg_checkout_processing_minutes}
                  slaTarget={SLA_TARGETS.receptionist.checkout}
                  total={emp.total_checkouts_processed}
                  color="bg-purple-500"
                />

                {/* Consumption pipeline */}
                <MetricCard
                  icon={ShoppingCart}
                  label="Pipeline Consumo"
                  value={emp.avg_consumption_to_delivery_minutes}
                  total={emp.total_consumptions_created}
                  color="bg-amber-500"
                />

                {/* Revenue */}
                <MetricCard
                  icon={DollarSign}
                  label="Revenue Total"
                  value={emp.total_revenue_confirmed}
                  color="bg-green-500"
                  isCurrency
                />

                {/* Inspections */}
                <MetricCard
                  icon={Tv}
                  label="Inspecciones Asignadas"
                  value={emp.avg_inspection_turnaround_minutes}
                  total={emp.total_inspections_assigned}
                  color="bg-cyan-500"
                />
              </div>

              <div className="border-b border-border/40" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
