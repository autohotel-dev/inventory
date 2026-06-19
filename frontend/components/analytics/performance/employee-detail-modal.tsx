"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PerformanceScoreBar } from "./performance-score-bar";
import {
  CocheroKPIv2,
  ReceptionistKPIv2,
  CamaristaKPIv2,
  getScoreColor,
  SLA_TARGETS,
} from "./types";
import {
  X,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  BarChart3,
  Zap,
  Shield,
} from "lucide-react";

type EmployeeData = CocheroKPIv2 | ReceptionistKPIv2 | CamaristaKPIv2;

interface EmployeeDetailModalProps {
  employee: EmployeeData | null;
  department: "cocheros" | "recepcion" | "camaristas";
  teamAvg: {
    avgTime: number;
    avgScore: number;
    avgVolume: number;
  };
  onClose: () => void;
}

function StatRow({
  label,
  value,
  unit,
  comparison,
  comparisonLabel,
}: {
  label: string;
  value: string | number;
  unit?: string;
  comparison?: number;
  comparisonLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold tabular-nums">
          {value}
          {unit && <span className="text-muted-foreground font-normal"> {unit}</span>}
        </span>
        {comparison !== undefined && (
          <span
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
              comparison > 0
                ? "bg-emerald-500/10 text-emerald-600"
                : comparison < 0
                ? "bg-red-500/10 text-red-600"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {comparison > 0 ? "+" : ""}
            {comparison.toFixed(1)} {comparisonLabel || "vs equipo"}
          </span>
        )}
      </div>
    </div>
  );
}

export function EmployeeDetailModal({
  employee,
  department,
  teamAvg,
  onClose,
}: EmployeeDetailModalProps) {
  if (!employee) return null;

  const score = Number(employee.performance_score) || 0;
  const slaPct = Number(employee.sla_compliance_pct) || 0;

  function renderCocheroDetail(emp: CocheroKPIv2) {
    const avgCheckin = Number(emp.avg_checkin_time_minutes) || 0;
    const avgCheckout = Number(emp.avg_checkout_time_minutes) || 0;

    return (
      <>
        {/* Speed Metrics */}
        <div className="space-y-1">
          <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-blue-500" />
            Velocidad
          </h4>
          <StatRow
            label="Tiempo prom. entrada"
            value={avgCheckin.toFixed(1)}
            unit="min"
            comparison={teamAvg.avgTime > 0 ? teamAvg.avgTime - avgCheckin : undefined}
            comparisonLabel="vs equipo"
          />
          <StatRow
            label="Entrada más rápida"
            value={Number(emp.min_checkin_time_minutes || 0).toFixed(1)}
            unit="min"
          />
          <StatRow
            label="Entrada más lenta"
            value={Number(emp.max_checkin_time_minutes || 0).toFixed(1)}
            unit="min"
          />
          <StatRow
            label="Tiempo prom. salida"
            value={avgCheckout.toFixed(1)}
            unit="min"
          />
          <StatRow
            label="Salida más rápida"
            value={Number(emp.min_checkout_time_minutes || 0).toFixed(1)}
            unit="min"
          />
          <StatRow
            label="Salida más lenta"
            value={Number(emp.max_checkout_time_minutes || 0).toFixed(1)}
            unit="min"
          />
        </div>

        {/* Volume */}
        <div className="space-y-1">
          <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <BarChart3 className="h-4 w-4 text-indigo-500" />
            Volumen
          </h4>
          <StatRow label="Vehículos recibidos" value={emp.total_checkins} />
          <StatRow label="Vehículos entregados" value={emp.total_checkouts} />
          <StatRow label="Servicios extra" value={emp.total_services} />
        </div>

        {/* Consistency */}
        <div className="space-y-1">
          <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Shield className="h-4 w-4 text-purple-500" />
            Consistencia
          </h4>
          <StatRow
            label="Desviación entrada"
            value={Number(emp.stddev_checkin_minutes || 0).toFixed(1)}
            unit="min"
          />
          <StatRow
            label="Desviación salida"
            value={Number(emp.stddev_checkout_minutes || 0).toFixed(1)}
            unit="min"
          />
          <StatRow
            label={`Entradas ≤ ${SLA_TARGETS.cochero.checkin} min`}
            value={emp.checkins_under_sla}
          />
          <StatRow
            label={`Salidas ≤ ${SLA_TARGETS.cochero.checkout} min`}
            value={emp.checkouts_under_sla}
          />
        </div>
      </>
    );
  }

  function renderReceptionistDetail(emp: ReceptionistKPIv2) {
    return (
      <>
        <div className="space-y-1">
          <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-blue-500" />
            Velocidad de Procesamiento
          </h4>
          <StatRow
            label="Tiempo prom. entrada"
            value={Number(emp.avg_checkin_processing_minutes || 0).toFixed(1)}
            unit="min"
            comparison={
              teamAvg.avgTime > 0
                ? teamAvg.avgTime - Number(emp.avg_checkin_processing_minutes || 0)
                : undefined
            }
          />
          <StatRow
            label="Entrada más rápida"
            value={Number(emp.min_checkin_processing_minutes || 0).toFixed(1)}
            unit="min"
          />
          <StatRow
            label="Entrada más lenta"
            value={Number(emp.max_checkin_processing_minutes || 0).toFixed(1)}
            unit="min"
          />
          <StatRow
            label="Tiempo prom. salida"
            value={Number(emp.avg_checkout_processing_minutes || 0).toFixed(1)}
            unit="min"
          />
          <StatRow
            label="Salida más rápida"
            value={Number(emp.min_checkout_processing_minutes || 0).toFixed(1)}
            unit="min"
          />
          <StatRow
            label="Salida más lenta"
            value={Number(emp.max_checkout_processing_minutes || 0).toFixed(1)}
            unit="min"
          />
        </div>

        <div className="space-y-1">
          <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <BarChart3 className="h-4 w-4 text-indigo-500" />
            Volumen y Revenue
          </h4>
          <StatRow label="Entradas procesadas" value={emp.total_entries_processed} />
          <StatRow label="Salidas procesadas" value={emp.total_exits_processed} />
          <StatRow label="Extras cobrados" value={emp.total_extras_charged} />
          <StatRow label="Renovaciones" value={emp.total_renewals} />
          <StatRow
            label="Ingresos totales"
            value={`$${Number(emp.total_revenue || 0).toLocaleString("es-MX")}`}
          />
          <StatRow
            label="Ingreso por estancia"
            value={`$${Number(emp.revenue_per_stay || 0).toLocaleString("es-MX", {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}`}
          />
        </div>

        <div className="space-y-1">
          <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Shield className="h-4 w-4 text-purple-500" />
            Consistencia
          </h4>
          <StatRow
            label="Desviación entrada"
            value={Number(emp.stddev_entry_minutes || 0).toFixed(1)}
            unit="min"
          />
          <StatRow
            label="Desviación salida"
            value={Number(emp.stddev_exit_minutes || 0).toFixed(1)}
            unit="min"
          />
          <StatRow
            label={`Entradas ≤ ${SLA_TARGETS.receptionist.checkin} min`}
            value={emp.entries_under_sla}
          />
          <StatRow
            label={`Salidas ≤ ${SLA_TARGETS.receptionist.checkout} min`}
            value={emp.exits_under_sla}
          />
        </div>
      </>
    );
  }

  function renderCamaristaDetail(emp: CamaristaKPIv2) {
    return (
      <>
        <div className="space-y-1">
          <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-blue-500" />
            Velocidad de Limpieza
          </h4>
          <StatRow
            label="Tiempo promedio"
            value={Number(emp.avg_cleaning_time_minutes || 0).toFixed(1)}
            unit="min"
            comparison={
              teamAvg.avgTime > 0
                ? teamAvg.avgTime - Number(emp.avg_cleaning_time_minutes || 0)
                : undefined
            }
          />
          <StatRow
            label="Limpieza más rápida"
            value={Number(emp.min_cleaning_time_minutes || 0).toFixed(1)}
            unit="min"
          />
          <StatRow
            label="Limpieza más lenta"
            value={Number(emp.max_cleaning_time_minutes || 0).toFixed(1)}
            unit="min"
          />
        </div>

        <div className="space-y-1">
          <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <BarChart3 className="h-4 w-4 text-indigo-500" />
            Volumen y Calidad
          </h4>
          <StatRow label="Habitaciones limpiadas" value={emp.total_rooms_cleaned} />
          <StatRow label="Limpiando ahora" value={emp.currently_cleaning} />
          <StatRow
            label="Re-limpiezas"
            value={emp.recleanings_count}
          />
        </div>

        <div className="space-y-1">
          <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Shield className="h-4 w-4 text-purple-500" />
            Consistencia
          </h4>
          <StatRow
            label="Desviación estándar"
            value={Number(emp.stddev_cleaning_minutes || 0).toFixed(1)}
            unit="min"
          />
          <StatRow
            label={`Limpiezas ≤ ${SLA_TARGETS.camarista.cleaning} min`}
            value={emp.cleanings_under_sla}
          />
        </div>
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-background rounded-2xl shadow-2xl border animate-in fade-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b px-6 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-500/20">
                {employee.employee_name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)}
              </div>
              <div>
                <h2 className="text-lg font-bold">{employee.employee_name}</h2>
                <p className="text-sm text-muted-foreground capitalize">{department}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Score Summary */}
        <div className="px-6 py-4 border-b bg-muted/30">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Performance Score</p>
              <PerformanceScoreBar score={score} size="lg" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">SLA Compliance</p>
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span className={`text-2xl font-bold ${getScoreColor(slaPct)}`}>
                  {slaPct.toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Detail Sections */}
        <div className="px-6 py-4 space-y-6">
          {department === "cocheros" && renderCocheroDetail(employee as CocheroKPIv2)}
          {department === "recepcion" && renderReceptionistDetail(employee as ReceptionistKPIv2)}
          {department === "camaristas" && renderCamaristaDetail(employee as CamaristaKPIv2)}
        </div>
      </div>
    </div>
  );
}
