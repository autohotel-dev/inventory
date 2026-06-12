"use client";

import { AlertTriangle, ShieldAlert, Clock, DollarSign, Users, Zap, CheckCircle, UserX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useOperationAnomalies, OperationAnomaly } from "@/hooks/use-operation-anomalies";
import { cn } from "@/lib/utils";
import Link from "next/link";

const ANOMALY_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  PAYMENT_NOT_REGISTERED: {
    icon: <DollarSign className="h-4 w-4" />,
    label: "Pago no registrado",
    color: "text-red-500 bg-red-500/10 border-red-500/30",
  },
  PAYMENT_AMOUNT_MISMATCH: {
    icon: <DollarSign className="h-4 w-4" />,
    label: "Discrepancia en monto",
    color: "text-red-500 bg-red-500/10 border-red-500/30",
  },
  PERSON_COUNT_MISMATCH: {
    icon: <Users className="h-4 w-4" />,
    label: "Discrepancia de personas",
    color: "text-orange-500 bg-orange-500/10 border-orange-500/30",
  },
  NO_VALET_FORM: {
    icon: <Clock className="h-4 w-4" />,
    label: "Formulario pendiente",
    color: "text-yellow-500 bg-yellow-500/10 border-yellow-500/30",
  },
  REMINDER_IGNORED: {
    icon: <AlertTriangle className="h-4 w-4" />,
    label: "Recordatorio ignorado",
    color: "text-yellow-500 bg-yellow-500/10 border-yellow-500/30",
  },
  UNUSUALLY_FAST: {
    icon: <Zap className="h-4 w-4" />,
    label: "Proceso inusualmente rápido",
    color: "text-blue-500 bg-blue-500/10 border-blue-500/30",
  },
  // Colusión
  REPEATED_UNREGISTERED_PAYMENTS: {
    icon: <UserX className="h-4 w-4" />,
    label: "Colusión: Pagos sin registrar",
    color: "text-red-600 bg-red-600/10 border-red-600/40",
  },
  REPEATED_PERSON_MISMATCH: {
    icon: <UserX className="h-4 w-4" />,
    label: "Colusión: Personas manipuladas",
    color: "text-red-600 bg-red-600/10 border-red-600/40",
  },
  HIGH_COURTESY_WITH_UNREGISTERED: {
    icon: <UserX className="h-4 w-4" />,
    label: "Colusión: Cortesías sospechosas",
    color: "text-red-600 bg-red-600/10 border-red-600/40",
  },
};

const SEVERITY_CONFIG: Record<string, { label: string; color: string }> = {
  CRITICAL: { label: "CRÍTICO", color: "bg-red-500 text-white" },
  HIGH: { label: "ALTO", color: "bg-orange-500 text-white" },
  MEDIUM: { label: "MEDIO", color: "bg-yellow-500 text-black" },
  LOW: { label: "BAJO", color: "bg-blue-500 text-white" },
};

function AnomalyCard({ anomaly }: { anomaly: OperationAnomaly }) {
  const config = ANOMALY_CONFIG[anomaly.anomaly_type] || {
    icon: <AlertTriangle className="h-4 w-4" />,
    label: anomaly.anomaly_type,
    color: "text-gray-500 bg-gray-500/10 border-gray-500/30",
  };
  const severity = SEVERITY_CONFIG[anomaly.severity] || SEVERITY_CONFIG.MEDIUM;
  const isCollusion = anomaly.anomaly_type.startsWith("REPEATED_") || anomaly.anomaly_type === "HIGH_COURTESY_WITH_UNREGISTERED";

  return (
    <Link href={anomaly.flow_id ? `/operacion-en-vivo/${anomaly.flow_id}` : '#'}>
      <div className={cn(
        "p-3 rounded-xl border transition-all hover:scale-[1.01] cursor-pointer",
        config.color
      )}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5">{config.icon}</div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">{config.label}</span>
                <Badge className={cn("text-[10px] px-1.5 py-0", severity.color)}>
                  {severity.label}
                </Badge>
                {isCollusion && (
                  <Badge className="text-[10px] px-1.5 py-0 bg-red-700 text-white animate-pulse">
                    COLUSIÓN
                  </Badge>
                )}
              </div>
              <p className="text-xs mt-1 opacity-80">{anomaly.description}</p>
              {anomaly.pair_key && (
                <p className="text-[10px] mt-1 font-mono opacity-60">
                  Par: {anomaly.pair_key}
                </p>
              )}
              <p className="text-[10px] mt-1 opacity-50">
                {anomaly.room_number ? `Hab. ${anomaly.room_number}` : 'Patrón'} · {new Date(anomaly.detected_at).toLocaleTimeString("es-MX")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function AnomalyAlertsPanel() {
  const { anomalies, collusionPatterns, loading, criticalCount, highCount, collusionCount, totalAnomalies, refresh } = useOperationAnomalies();

  if (loading) {
    return (
      <Card className="border-amber-500/30">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="animate-spin h-4 w-4 border-2 border-amber-500 rounded-full border-t-transparent" />
            <span className="text-sm">Verificando anomalías...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (totalAnomalies === 0) {
    return (
      <Card className="border-emerald-500/30">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-emerald-500">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Sin anomalías detectadas — todo en orden</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border-amber-500/30", collusionCount > 0 && "border-red-500/50")}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ShieldAlert className="h-4 w-4 text-amber-500" />
            Alertas de Anomalías y Colusión
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={refresh} className="h-7 text-xs">
            Actualizar
          </Button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {collusionCount > 0 && (
            <Badge className="bg-red-700 text-white text-[10px] animate-pulse">{collusionCount} Colusión</Badge>
          )}
          {criticalCount > 0 && (
            <Badge className="bg-red-500 text-white text-[10px]">{criticalCount} Críticas</Badge>
          )}
          {highCount > 0 && (
            <Badge className="bg-orange-500 text-white text-[10px]">{highCount} Altas</Badge>
          )}
          <Badge variant="secondary" className="text-[10px]">{totalAnomalies} Total</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 max-h-80 overflow-y-auto">
        {collusionPatterns.map((anomaly, i) => (
          <AnomalyCard key={`collusion-${i}`} anomaly={anomaly} />
        ))}
        {collusionPatterns.length > 0 && anomalies.length > 0 && (
          <div className="border-t border-border/50 pt-2 mt-2">
            <p className="text-xs text-muted-foreground font-medium mb-2">Anomalías individuales:</p>
          </div>
        )}
        {anomalies.slice(0, 8).map((anomaly, i) => (
          <AnomalyCard key={`${anomaly.flow_id || 'flow'}-${anomaly.anomaly_type}-${i}`} anomaly={anomaly} />
        ))}
        {(anomalies.length + collusionPatterns.length) > 10 && (
          <p className="text-xs text-muted-foreground text-center py-2">
            +{(anomalies.length + collusionPatterns.length) - 10} anomalías más
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function AnomalyAlertsPanel() {
  const { anomalies, loading, criticalCount, highCount, totalAnomalies, refresh } = useOperationAnomalies();

  if (loading) {
    return (
      <Card className="border-amber-500/30">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="animate-spin h-4 w-4 border-2 border-amber-500 rounded-full border-t-transparent" />
            <span className="text-sm">Verificando anomalías...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (totalAnomalies === 0) {
    return (
      <Card className="border-emerald-500/30">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-emerald-500">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Sin anomalías detectadas</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-500/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ShieldAlert className="h-4 w-4 text-amber-500" />
            Alertas de Anomalías
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={refresh} className="h-7 text-xs">
            Actualizar
          </Button>
        </div>
        <div className="flex gap-2">
          {criticalCount > 0 && (
            <Badge className="bg-red-500 text-white text-[10px]">{criticalCount} Críticas</Badge>
          )}
          {highCount > 0 && (
            <Badge className="bg-orange-500 text-white text-[10px]">{highCount} Altas</Badge>
          )}
          <Badge variant="secondary" className="text-[10px]">{totalAnomalies} Total</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 max-h-80 overflow-y-auto">
        {anomalies.slice(0, 10).map((anomaly, i) => (
          <AnomalyCard key={`${anomaly.flow_id}-${anomaly.anomaly_type}-${i}`} anomaly={anomaly} />
        ))}
        {anomalies.length > 10 && (
          <p className="text-xs text-muted-foreground text-center py-2">
            +{anomalies.length - 10} anomalías más
          </p>
        )}
      </CardContent>
    </Card>
  );
}
