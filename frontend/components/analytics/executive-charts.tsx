"use client";
import { apiClient } from "@/lib/api/client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import {
  DollarSign, BedDouble, TrendingUp, TrendingDown,
  Users, Clock, CalendarDays, ArrowUpRight, ArrowDownRight,
  Sun, Sunset, Moon, Loader2
} from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";

interface DailyMetric {
  date: string;
  label: string;
  revenue: number;
  stays: number;
  occupancyRate: number;
  avgTicket: number;
}

interface ShiftMetric {
  shift: string;
  icon: React.ReactNode;
  color: string;
  revenue: number;
  stays: number;
  avgTicket: number;
  avgDuration: number;
}

type Period = "7d" | "30d" | "90d";

export function ExecutiveCharts() {
  const [period, setPeriod] = useState<Period>("30d");
  const [dailyData, setDailyData] = useState<DailyMetric[]>([]);
  const [shiftData, setShiftData] = useState<ShiftMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalRooms, setTotalRooms] = useState(0);
    const periodDays = period === "7d" ? 7 : period === "30d" ? 30 : 90;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const supabase = createClient();
      try {
        const from = subDays(new Date(), periodDays).toISOString();

        // Parallel queries
        const [roomsRes, rawDataRes] = await Promise.all([
          apiClient.get("/system/crud/rooms").then(res => ({ data: res.data, error: null })),
          apiClient.get(`/system/analytics/executive-raw?days=${periodDays}`).then(res => ({ data: res.data, error: null }))
        ]);

        const rooms = roomsRes.data || [];
        const stays = rawDataRes.data?.room_stays || [];
        const payments = rawDataRes.data?.payments || [];
        const shifts = rawDataRes.data?.shifts || [];

        
        setTotalRooms(rooms.length || 1);

        // === DAILY METRICS ===
        const dailyMap = new Map<string, { revenue: number; stays: number; payments: number }>();
        
        for (let i = 0; i < periodDays; i++) {
          const d = subDays(new Date(), periodDays - 1 - i);
          const key = format(d, "yyyy-MM-dd");
          dailyMap.set(key, { revenue: 0, stays: 0, payments: 0 });
        }

        stays.forEach((s: any) => {
          const key = s.created_at?.split("T")[0];
          if (key && dailyMap.has(key)) {
            dailyMap.get(key)!.stays++;
          }
        });

        payments.forEach((p: any) => {
          const key = p.created_at?.split("T")[0];
          if (key && dailyMap.has(key)) {
            dailyMap.get(key)!.revenue += p.amount || 0;
            dailyMap.get(key)!.payments++;
          }
        });

        const daily: DailyMetric[] = [];
        dailyMap.forEach((val, key) => {
          daily.push({
            date: key,
            label: format(new Date(key + "T12:00:00"), periodDays <= 7 ? "EEE" : "dd MMM", { locale: es }),
            revenue: Math.round(val.revenue),
            stays: val.stays,
            occupancyRate: Math.round((val.stays / (rooms.length || 1)) * 100),
            avgTicket: val.payments > 0 ? Math.round(val.revenue / val.payments) : 0,
          });
        });
        setDailyData(daily);

        // === SHIFT METRICS ===
        const shiftMap: Record<string, { revenue: number; stays: number; count: number; totalMinutes: number }> = {
          Mañana: { revenue: 0, stays: 0, count: 0, totalMinutes: 0 },
          Tarde: { revenue: 0, stays: 0, count: 0, totalMinutes: 0 },
          Noche: { revenue: 0, stays: 0, count: 0, totalMinutes: 0 },
        };

        // Map payments/stays to shifts by time of day
        payments.forEach((p: any) => {
          const hour = new Date(p.created_at).getHours();
          const shift = hour >= 6 && hour < 14 ? "Mañana" : hour >= 14 && hour < 22 ? "Tarde" : "Noche";
          shiftMap[shift].revenue += p.amount || 0;
          shiftMap[shift].count++;
        });

        stays.forEach((s: any) => {
          const hour = new Date(s.created_at).getHours();
          const shift = hour >= 6 && hour < 14 ? "Mañana" : hour >= 14 && hour < 22 ? "Tarde" : "Noche";
          shiftMap[shift].stays++;
          if (s.check_in_at && s.check_out_at) {
            const dur = (new Date(s.check_out_at).getTime() - new Date(s.check_in_at).getTime()) / 60000;
            if (dur > 0 && dur < 1440) shiftMap[shift].totalMinutes += dur;
          }
        });

        const shiftIcons: Record<string, React.ReactNode> = {
          Mañana: <Sun className="h-5 w-5" />,
          Tarde: <Sunset className="h-5 w-5" />,
          Noche: <Moon className="h-5 w-5" />,
        };
        const shiftColors: Record<string, string> = {
          Mañana: "#f59e0b",
          Tarde: "#f97316",
          Noche: "#6366f1",
        };

        const shiftMetrics: ShiftMetric[] = Object.entries(shiftMap).map(([name, data]) => ({
          shift: name,
          icon: shiftIcons[name],
          color: shiftColors[name],
          revenue: Math.round(data.revenue),
          stays: data.stays,
          avgTicket: data.count > 0 ? Math.round(data.revenue / data.count) : 0,
          avgDuration: data.stays > 0 ? Math.round(data.totalMinutes / data.stays) : 0,
        }));
        setShiftData(shiftMetrics);
      } catch {
        // silently handle
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [period, periodDays]);

  // Summary KPIs
  const totalRevenue = dailyData.reduce((s, d) => s + d.revenue, 0);
  const totalStays = dailyData.reduce((s, d) => s + d.stays, 0);
  const avgOccupancy = dailyData.length > 0 ? Math.round(dailyData.reduce((s, d) => s + d.occupancyRate, 0) / dailyData.length) : 0;
  const avgTicket = totalStays > 0 ? Math.round(totalRevenue / totalStays) : 0;

  // Trend (compare first half vs second half)
  const mid = Math.floor(dailyData.length / 2);
  const firstHalf = dailyData.slice(0, mid);
  const secondHalf = dailyData.slice(mid);
  const firstRevenue = firstHalf.reduce((s, d) => s + d.revenue, 0);
  const secondRevenue = secondHalf.reduce((s, d) => s + d.revenue, 0);
  const revenueTrend = firstRevenue > 0 ? Math.round(((secondRevenue - firstRevenue) / firstRevenue) * 100) : 0;

  const bestShift = shiftData.reduce((best, s) => s.revenue > best.revenue ? s : best, shiftData[0] || { shift: "-", revenue: 0 });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary/50" />
        <p className="text-muted-foreground text-sm">Cargando métricas ejecutivas...</p>
      </div>
    );
  }

  const customTooltipStyle = {
    backgroundColor: "hsl(var(--background))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "12px",
    padding: "12px 16px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
  };

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-xl">
          {(["7d", "30d", "90d"] as Period[]).map((p) => (
            <Button
              key={p}
              variant={period === p ? "default" : "ghost"}
              size="sm"
              className={period === p ? "rounded-lg shadow-sm" : "rounded-lg"}
              onClick={() => setPeriod(p)}
            >
              {p === "7d" ? "7 Días" : p === "30d" ? "30 Días" : "90 Días"}
            </Button>
          ))}
        </div>
        <Badge variant="outline" className="text-xs">
          <CalendarDays className="h-3 w-3 mr-1" />
          {format(subDays(new Date(), periodDays), "dd MMM", { locale: es })} — {format(new Date(), "dd MMM yyyy", { locale: es })}
        </Badge>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5">
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/10 rounded-full blur-2xl" />
          <CardContent className="p-4 sm:p-5 relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">Ingresos Totales</span>
              <div className="p-1.5 rounded-lg bg-emerald-500/10">
                <DollarSign className="h-4 w-4 text-emerald-500" />
              </div>
            </div>
            <p className="text-lg sm:text-2xl font-bold">${totalRevenue.toLocaleString()}</p>
            <div className={`flex items-center gap-1 text-xs mt-1 ${revenueTrend >= 0 ? "text-emerald-500" : "text-red-500"}`}>
              {revenueTrend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(revenueTrend)}% vs periodo anterior
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-500/10 to-blue-600/5">
          <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full blur-2xl" />
          <CardContent className="p-4 sm:p-5 relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">Estancias</span>
              <div className="p-1.5 rounded-lg bg-blue-500/10">
                <BedDouble className="h-4 w-4 text-blue-500" />
              </div>
            </div>
            <p className="text-lg sm:text-2xl font-bold">{totalStays.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">
              ~{Math.round(totalStays / periodDays)} por día
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-purple-500/10 to-purple-600/5">
          <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/10 rounded-full blur-2xl" />
          <CardContent className="p-4 sm:p-5 relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">Ocupación Prom.</span>
              <div className="p-1.5 rounded-lg bg-purple-500/10">
                <Users className="h-4 w-4 text-purple-500" />
              </div>
            </div>
            <p className="text-lg sm:text-2xl font-bold">{avgOccupancy}%</p>
            <p className="text-xs text-muted-foreground mt-1">
              de {totalRooms} habitaciones
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-amber-500/10 to-amber-600/5">
          <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/10 rounded-full blur-2xl" />
          <CardContent className="p-4 sm:p-5 relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">Ticket Promedio</span>
              <div className="p-1.5 rounded-lg bg-amber-500/10">
                <TrendingUp className="h-4 w-4 text-amber-500" />
              </div>
            </div>
            <p className="text-lg sm:text-2xl font-bold">${avgTicket.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">
              por estancia
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card className="border-0 bg-gradient-to-br from-muted/30 to-transparent">
        <CardHeader className="pb-2">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-500" />
            Ingresos Diarios
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="label" fontSize={11} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={customTooltipStyle} formatter={(value: any) => [`$${Number(value).toLocaleString()}`, "Ingresos"]} />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2.5} fill="url(#revenueGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Two Column: Occupancy + Shift Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Occupancy */}
        <Card className="border-0 bg-gradient-to-br from-muted/30 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <BedDouble className="h-5 w-5 text-blue-500" />
              Ocupación Diaria (%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px] sm:h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="label" fontSize={10} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                  <YAxis fontSize={10} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={customTooltipStyle} formatter={(value: any) => [`${value}%`, "Ocupación"]} />
                  <Line type="monotone" dataKey="occupancyRate" stroke="#6366f1" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Shift Comparison */}
        <Card className="border-0 bg-gradient-to-br from-muted/30 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-purple-500" />
              Comparativa por Turno
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {shiftData.map((s) => {
                const maxRevenue = Math.max(...shiftData.map((x) => x.revenue), 1);
                const pct = Math.round((s.revenue / maxRevenue) * 100);
                const isBest = s.shift === bestShift?.shift;
                return (
                  <div key={s.shift} className={`p-3 sm:p-4 rounded-xl border transition-all ${isBest ? "border-primary/30 bg-primary/5" : "border-border/30 bg-muted/20"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${s.color}20`, color: s.color }}>
                          {s.icon}
                        </div>
                        <span className="font-semibold text-sm">{s.shift}</span>
                        {isBest && <Badge className="text-[10px] h-5 bg-primary/10 text-primary border-primary/20">Mejor</Badge>}
                      </div>
                      <span className="font-bold text-sm">${s.revenue.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-muted/30 rounded-full h-2 mb-2">
                      <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: s.color }} />
                    </div>
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>{s.stays} estancias</span>
                      <span>Ticket: ${s.avgTicket}</span>
                      <span>{s.avgDuration > 0 ? `~${Math.round(s.avgDuration / 60)}h` : "-"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Avg Ticket Chart */}
      <Card className="border-0 bg-gradient-to-br from-muted/30 to-transparent">
        <CardHeader className="pb-2">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-amber-500" />
            Ticket Promedio por Día
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[220px] sm:h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="label" fontSize={10} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                <YAxis fontSize={10} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip contentStyle={customTooltipStyle} formatter={(value: any) => [`$${Number(value).toLocaleString()}`, "Ticket"]} />
                <Bar dataKey="avgTicket" fill="#f59e0b" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
