"use client";

import { ExecutiveCharts } from "@/components/analytics/executive-charts";
import { RoleGuard } from "@/components/auth/role-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart3, CalendarDays, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function ExecutiveDashboardPage() {
  const today = format(new Date(), "EEEE, d 'de' MMMM yyyy", { locale: es });

  return (
    <RoleGuard requireAdmin permissionId="analytics">
      <div className="p-2 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-violet-500/10 via-purple-500/5 to-transparent p-4 sm:p-6 border border-border/50">
          <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-1/2 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl" />

          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link href="/analytics">
                <Button variant="ghost" size="icon" className="rounded-xl shrink-0 hidden sm:flex">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-400/20">
                <BarChart3 className="h-6 w-6 text-violet-400" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold">Dashboard Ejecutivo</h1>
                <p className="text-sm text-muted-foreground mt-0.5 hidden sm:block">
                  Métricas de rendimiento y análisis de ingresos
                </p>
              </div>
            </div>

            <Badge variant="outline" className="self-start sm:self-center flex items-center gap-2 px-3 py-1.5 bg-background/80 backdrop-blur-sm text-xs">
              <CalendarDays className="h-3.5 w-3.5 text-violet-400" />
              <span className="capitalize">{today}</span>
            </Badge>
          </div>
        </div>

        <ExecutiveCharts />
      </div>
    </RoleGuard>
  );
}
