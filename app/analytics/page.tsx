"use client";

import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { RoleGuard } from "@/components/auth/role-guard";
import { BarChart3, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function AnalyticsPage() {
  const today = new Date().toLocaleDateString("es-MX", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <RoleGuard requireAdmin permissionId="analytics">
      <div className="p-6 space-y-6">
        {/* Header Mejorado */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 border border-border/50">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-1/2 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl" />

          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 border border-primary/20">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                  Analytics & Reportes
                </h1>
                <p className="text-muted-foreground mt-1">
                  Análisis avanzado de tu inventario y operaciones
                </p>
              </div>
            </div>

            <Badge variant="outline" className="self-start sm:self-center flex items-center gap-2 px-4 py-2 bg-background/80 backdrop-blur-sm">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="capitalize">{today}</span>
            </Badge>
          </div>
        </div>

        <AnalyticsDashboard />
      </div>
    </RoleGuard>
  );
}

