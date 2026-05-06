"use client";

import { apiClient } from "@/lib/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity, CreditCard, AlertTriangle, Users, TrendingUp, TrendingDown,
  ShoppingBag, XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";


interface MetricCard {
  title: string;
  value: number;
  icon: React.ReactNode;
  iconBg: string;
  trend?: number;
  trendLabel?: string;
  accentColor?: string;
}

export function AuditMetrics() {
  const [metrics, setMetrics] = useState({
    todayEvents: 0,
    receptionActions: 0,
    cancellations: 0,
    activeUsers: 0,
    eventTrend: 0,
  });

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const { data } = await apiClient.get("/system/logs/metrics-dashboard");
        
        const eventTrend = data.todayEvents && data.yesterdayEvents
          ? ((data.todayEvents - data.yesterdayEvents) / data.yesterdayEvents) * 100
          : 0;

        setMetrics({
          todayEvents: data.todayEvents || 0,
          receptionActions: data.receptionActions || 0,
          cancellations: data.cancellations || 0,
          activeUsers: data.activeUsers || 0,
          eventTrend,
        });
      } catch (error) {
        console.error("Error fetching audit metrics", error);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  const metricCards: MetricCard[] = [
    {
      title: "Eventos Hoy",
      value: metrics.todayEvents,
      icon: <Activity className="h-5 w-5" />,
      iconBg: "bg-primary/10 text-primary",
      trend: metrics.eventTrend,
      trendLabel: "vs ayer",
      accentColor: "from-primary/5",
    },
    {
      title: "Acciones Recepción",
      value: metrics.receptionActions,
      icon: <ShoppingBag className="h-5 w-5" />,
      iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      accentColor: "from-emerald-500/5",
    },
    {
      title: "Cancelaciones / Cortesías",
      value: metrics.cancellations,
      icon: <XCircle className="h-5 w-5" />,
      iconBg: metrics.cancellations > 0
        ? "bg-red-500/10 text-red-600 dark:text-red-400"
        : "bg-muted text-muted-foreground",
      accentColor: metrics.cancellations > 0 ? "from-red-500/5" : "from-muted/5",
    },
    {
      title: "Usuarios Activos",
      value: metrics.activeUsers,
      icon: <Users className="h-5 w-5" />,
      iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      accentColor: "from-blue-500/5",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {metricCards.map((card, index) => (
        <Card
          key={index}
          className="border-0 shadow-lg bg-background/80 backdrop-blur-xl overflow-hidden relative group hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5"
        >
          {/* Gradient accent */}
          <div className={`absolute inset-0 bg-gradient-to-br ${card.accentColor || "from-muted/5"} to-transparent opacity-50`} />

          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              {card.title}
            </CardTitle>
            <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${card.iconBg} transition-transform group-hover:scale-110`}>
              {card.icon}
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-black tracking-tighter font-mono">
              {card.value.toLocaleString()}
            </div>
            {card.trend !== undefined && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                {card.trend > 0 ? (
                  <TrendingUp className="h-3 w-3 text-emerald-500" />
                ) : card.trend < 0 ? (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                ) : null}
                <span className={card.trend > 0 ? "text-emerald-500 font-semibold" : card.trend < 0 ? "text-red-500 font-semibold" : ""}>
                  {card.trend !== 0 ? `${Math.abs(card.trend).toFixed(1)}%` : "—"}
                </span>
                <span className="opacity-60">{card.trendLabel}</span>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
