"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, CreditCard, AlertTriangle, Users, TrendingUp, TrendingDown } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface MetricCard {
  title: string;
  value: number;
  icon: React.ReactNode;
  trend?: number;
  trendLabel?: string;
  variant?: "default" | "destructive" | "warning";
}

export function AuditMetrics() {
  const [metrics, setMetrics] = useState({
    todayEvents: 0,
    paymentsProcessed: 0,
    anomalies: 0,
    activeUsers: 0,
    eventTrend: 0,
    paymentTrend: 0
  });

  useEffect(() => {
    const fetchMetrics = async () => {
      const supabase = createClient();
      
      // Eventos de hoy
      const { count: todayEvents } = await supabase
        .from("audit_logs")
        .select("*", { count: "exact", head: true })
        .gte("created_at", new Date().toISOString().split("T")[0]);

      // Pagos procesados hoy
      const { count: paymentsProcessed } = await supabase
        .from("audit_logs")
        .select("*", { count: "exact", head: true })
        .eq("event_type", "PAYMENT_PROCESSED")
        .gte("created_at", new Date().toISOString().split("T")[0]);

      // Anomalías detectadas
      const { count: anomalies } = await supabase
        .from("audit_logs")
        .select("*", { count: "exact", head: true })
        .eq("severity", "ERROR")
        .gte("created_at", new Date().toISOString().split("T")[0]);

      // Usuarios activos (empleados distintos hoy)
      const { data: activeUsersData } = await supabase
        .from("audit_logs")
        .select("employee_id")
        .not("employee_id", "is", null)
        .gte("created_at", new Date().toISOString().split("T")[0]);

      const activeUsers = new Set(activeUsersData?.map((u: any) => u.employee_id)).size;

      // Trend comparando con ayer (simplificado)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const { count: yesterdayEvents } = await supabase
        .from("audit_logs")
        .select("*", { count: "exact", head: true })
        .gte("created_at", yesterday.toISOString().split("T")[0])
        .lt("created_at", new Date().toISOString().split("T")[0]);

      const eventTrend = todayEvents && yesterdayEvents 
        ? ((todayEvents - yesterdayEvents) / yesterdayEvents) * 100 
        : 0;

      setMetrics({
        todayEvents: todayEvents || 0,
        paymentsProcessed: paymentsProcessed || 0,
        anomalies: anomalies || 0,
        activeUsers,
        eventTrend,
        paymentTrend: 12.5 // Placeholder
      });
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Actualizar cada 30 segundos
    return () => clearInterval(interval);
  }, []);

  const metricCards: MetricCard[] = [
    {
      title: "Eventos Hoy",
      value: metrics.todayEvents,
      icon: <Activity className="h-5 w-5" />,
      trend: metrics.eventTrend,
      trendLabel: "vs ayer"
    },
    {
      title: "Pagos Procesados",
      value: metrics.paymentsProcessed,
      icon: <CreditCard className="h-5 w-5" />,
      trend: metrics.paymentTrend,
      trendLabel: "vs ayer"
    },
    {
      title: "Anomalías Detectadas",
      value: metrics.anomalies,
      icon: <AlertTriangle className="h-5 w-5" />,
      variant: metrics.anomalies > 0 ? "destructive" : "default"
    },
    {
      title: "Usuarios Activos",
      value: metrics.activeUsers,
      icon: <Users className="h-5 w-5" />
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {metricCards.map((card, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {card.title}
            </CardTitle>
            {card.icon}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value.toLocaleString()}</div>
            {card.trend !== undefined && (
              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                {card.trend > 0 ? (
                  <TrendingUp className="h-3 w-3 text-green-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                <span className={card.trend > 0 ? "text-green-500" : "text-red-500"}>
                  {Math.abs(card.trend).toFixed(1)}%
                </span>
                <span>{card.trendLabel}</span>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
