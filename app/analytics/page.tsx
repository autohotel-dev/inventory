"use client";

import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { RoleGuard } from "@/components/auth/role-guard";

export default function AnalyticsPage() {
  return (
    <RoleGuard requireAdmin>
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Analytics & Reportes</h1>
          <p className="text-muted-foreground">
            Análisis avanzado de tu inventario y operaciones
          </p>
        </div>
      </div>

      <AnalyticsDashboard />
    </div>
    </RoleGuard>
  );
}
