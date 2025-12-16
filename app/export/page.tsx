"use client";

import { ExportManager } from "@/components/export/export-manager";
import { RoleGuard } from "@/components/auth/role-guard";

export default function ExportPage() {
  return (
    <RoleGuard requireAdmin>
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Exportación de Datos</h1>
          <p className="text-muted-foreground">
            Exporta tu información en diferentes formatos para análisis externo
          </p>
        </div>
      </div>

      <ExportManager />
    </div>
    </RoleGuard>
  );
}
