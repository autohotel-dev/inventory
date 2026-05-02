"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import {
  User, TrendingUp, Clock, Calendar, Star, Zap,
  Award, ArrowLeft, Loader2, BedDouble, DollarSign,
} from "lucide-react";
import { format, subDays } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";

interface EmployeeStats {
  name: string;
  role: string;
  totalShifts: number;
  totalStays: number;
  totalRevenue: number;
  avgPerShift: number;
  dailyData: { date: string; label: string; stays: number; revenue: number }[];
  badges: { icon: React.ReactNode; label: string; color: string }[];
}

export default function EmployeePerformancePage() {
  const [stats, setStats] = useState<EmployeeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get employee info
        const { data: employee } = await supabase
          .from("employees")
          .select("id, first_name, last_name, role, auth_user_id")
          .eq("auth_user_id", user.id)
          .single();

        if (!employee) return;

        const name = [employee.first_name, employee.last_name].filter(Boolean).join(" ") || user.email?.split("@")[0] || "Empleado";

        // Get shifts worked (last 30 days)
        const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
        const { data: shifts } = await supabase
          .from("shifts")
          .select("id, shift_type, start_time, end_time, created_at, closed_by")
          .gte("created_at", thirtyDaysAgo);

        // Filter shifts worked by this employee
        const myShifts = shifts?.filter((s: any) => s.closed_by === user.id) || [];

        // Get stays created by this user (reception activity)
        const { data: myStays } = await supabase
          .from("room_stays")
          .select("id, created_at, status")
          .eq("created_by", user.id)
          .gte("created_at", thirtyDaysAgo);

        // Get payments processed by this user
        const { data: myPayments } = await supabase
          .from("payments")
          .select("id, amount, created_at, status")
          .eq("created_by", user.id)
          .eq("status", "PAGADO")
          .gte("created_at", thirtyDaysAgo);

        const totalRevenue = myPayments?.reduce((s: number, p: any) => s + (p.amount || 0), 0) || 0;
        const totalStays = myStays?.length || 0;

        // Build daily data
        const dailyMap = new Map<string, { stays: number; revenue: number }>();
        for (let i = 0; i < 30; i++) {
          const d = subDays(new Date(), 29 - i);
          const key = format(d, "yyyy-MM-dd");
          dailyMap.set(key, { stays: 0, revenue: 0 });
        }

        myStays?.forEach((s: any) => {
          const key = s.created_at?.split("T")[0];
          if (key && dailyMap.has(key)) dailyMap.get(key)!.stays++;
        });

        myPayments?.forEach((p: any) => {
          const key = p.created_at?.split("T")[0];
          if (key && dailyMap.has(key)) dailyMap.get(key)!.revenue += p.amount || 0;
        });

        const dailyData = Array.from(dailyMap.entries()).map(([date, data]) => ({
          date,
          label: format(new Date(date + "T12:00:00"), "dd", { locale: es }),
          ...data,
        }));

        // Generate badges
        const badges: EmployeeStats["badges"] = [];
        if (myShifts.length >= 20) badges.push({ icon: <Star className="h-4 w-4" />, label: "Comprometido", color: "text-amber-500" });
        if (totalRevenue > 50000) badges.push({ icon: <DollarSign className="h-4 w-4" />, label: "Alta Producción", color: "text-emerald-500" });
        if (totalStays > 100) badges.push({ icon: <Zap className="h-4 w-4" />, label: "Speed Demon", color: "text-blue-500" });
        if (myShifts.length >= 25) badges.push({ icon: <Award className="h-4 w-4" />, label: "Empleado del Mes", color: "text-purple-500" });

        setStats({
          name,
          role: employee.role || "Empleado",
          totalShifts: myShifts.length,
          totalStays,
          totalRevenue: Math.round(totalRevenue),
          avgPerShift: myShifts.length > 0 ? Math.round(totalRevenue / myShifts.length) : 0,
          dailyData,
          badges,
        });
      } catch {
        // silently handle
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [supabase]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary/50" />
        <p className="text-muted-foreground text-sm">Cargando tu rendimiento...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        No se pudo cargar tu información de rendimiento.
      </div>
    );
  }

  const tooltipStyle = {
    backgroundColor: "hsl(var(--background))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "12px",
    padding: "10px 14px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
  };

  return (
    <div className="p-2 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-500/10 via-purple-500/5 to-transparent p-4 sm:p-6 border border-border/50">
        <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="flex items-center gap-4">
          <Link href="/account">
            <Button variant="ghost" size="icon" className="rounded-xl shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border border-primary/20">
            <User className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold capitalize">{stats.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs capitalize">{stats.role}</Badge>
              <span className="text-xs text-muted-foreground">Últimos 30 días</span>
            </div>
          </div>
        </div>
      </div>

      {/* Badges */}
      {stats.badges.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {stats.badges.map((b, i) => (
            <div key={i} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 border border-border/50 text-sm ${b.color}`}>
              {b.icon}
              <span className="font-medium text-xs">{b.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-0 bg-gradient-to-br from-emerald-500/10 to-transparent">
          <CardContent className="p-4">
            <DollarSign className="h-5 w-5 text-emerald-500 mb-2" />
            <p className="text-lg font-bold">${stats.totalRevenue.toLocaleString()}</p>
            <p className="text-[11px] text-muted-foreground">Ingresos generados</p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-gradient-to-br from-blue-500/10 to-transparent">
          <CardContent className="p-4">
            <BedDouble className="h-5 w-5 text-blue-500 mb-2" />
            <p className="text-lg font-bold">{stats.totalStays}</p>
            <p className="text-[11px] text-muted-foreground">Estancias procesadas</p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-gradient-to-br from-purple-500/10 to-transparent">
          <CardContent className="p-4">
            <Calendar className="h-5 w-5 text-purple-500 mb-2" />
            <p className="text-lg font-bold">{stats.totalShifts}</p>
            <p className="text-[11px] text-muted-foreground">Turnos trabajados</p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-gradient-to-br from-amber-500/10 to-transparent">
          <CardContent className="p-4">
            <TrendingUp className="h-5 w-5 text-amber-500 mb-2" />
            <p className="text-lg font-bold">${stats.avgPerShift.toLocaleString()}</p>
            <p className="text-[11px] text-muted-foreground">Promedio por turno</p>
          </CardContent>
        </Card>
      </div>

      {/* Activity Chart */}
      <Card className="border-0 bg-gradient-to-br from-muted/30 to-transparent">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Tu Actividad (30 días)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] sm:h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.dailyData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="empGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="label" fontSize={10} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                <YAxis fontSize={10} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: any, name: any) => [name === "stays" ? `${value} estancias` : `$${Number(value).toLocaleString()}`, name === "stays" ? "Estancias" : "Ingresos"]} />
                <Area type="monotone" dataKey="stays" stroke="#6366f1" strokeWidth={2} fill="url(#empGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
