"use client";

import { InventoryMovementsTable } from "@/components/movements/inventory-movements-table";
import { RoleGuard } from "@/components/auth/role-guard";

export default function MovementsPage() {
  return (
    <RoleGuard requireAdmin permissionId="movements">
      <div className="p-2 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-foreground">Movimientos de Inventario</h1>
            <p className="text-muted-foreground">
              Historial de entradas, salidas y ajustes de stock
            </p>
          </div>
        </div>

        <InventoryMovementsTable />
      </div>
    </RoleGuard>
  );
}
