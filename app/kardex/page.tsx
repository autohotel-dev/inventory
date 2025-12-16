"use client";

import { AdvancedKardexView } from "@/components/kardex/advanced-kardex-view";
import { RoleGuard } from "@/components/auth/role-guard";

export default function KardexPage() {
  return (
    <RoleGuard requireAdmin>
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Kardex de Productos</h1>
          <p className="text-muted-foreground">
            Historial detallado de movimientos por producto con balance acumulado
          </p>
        </div>
      </div>

      <AdvancedKardexView />
    </div>
    </RoleGuard>
  );
}
