"use client";

import { OperationStats } from "@/hooks/use-realtime-operations";

interface FlowStatsBarProps {
  stats: OperationStats;
  isConnected: boolean;
}

export function FlowStatsBar({ stats, isConnected }: FlowStatsBarProps) {
  const statCards = [
    {
      label: "Flujos Activos",
      value: stats.activeFlows,
      icon: "⚡",
      color: "from-blue-500/20 to-blue-600/10 border-blue-500/30",
      textColor: "text-blue-400",
      pulse: stats.activeFlows > 0,
    },
    {
      label: "Completados Hoy",
      value: stats.completedToday,
      icon: "✅",
      color: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30",
      textColor: "text-emerald-400",
    },
    {
      label: "Cancelados Hoy",
      value: stats.cancelledToday,
      icon: "❌",
      color: "from-rose-500/20 to-rose-600/10 border-rose-500/30",
      textColor: "text-rose-400",
    },
    {
      label: "Tiempo Promedio",
      value: stats.avgDurationMinutes > 0 ? `${stats.avgDurationMinutes}m` : "—",
      icon: "⏱️",
      color: "from-amber-500/20 to-amber-600/10 border-amber-500/30",
      textColor: "text-amber-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {statCards.map((card) => (
        <div
          key={card.label}
          className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${card.color} p-4 transition-all duration-300 hover:scale-[1.02]`}
        >
          {/* Pulse effect for active */}
          {card.pulse && (
            <div className="absolute top-2 right-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{card.icon}</span>
            <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
              {card.label}
            </span>
          </div>

          <div className={`text-2xl font-bold ${card.textColor} tabular-nums`}>
            {card.value}
          </div>
        </div>
      ))}

      {/* Connection indicator */}
      <div className="col-span-2 md:col-span-4 flex items-center justify-end gap-2 px-1">
        <span className="relative flex h-2 w-2">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              isConnected ? "bg-emerald-400" : "bg-red-400"
            }`}
          ></span>
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${
              isConnected ? "bg-emerald-500" : "bg-red-500"
            }`}
          ></span>
        </span>
        <span className="text-[10px] text-muted-foreground/50 uppercase tracking-widest">
          {isConnected ? "En vivo" : "Desconectado"}
        </span>
      </div>
    </div>
  );
}
