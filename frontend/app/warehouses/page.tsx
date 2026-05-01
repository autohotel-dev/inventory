"use client";

import { SimpleWarehousesTable } from "@/components/warehouses/simple-warehouses-table";
import { RoleGuard } from "@/components/auth/role-guard";

export default function WarehousesPage() {
  return (
    <RoleGuard requireAdmin permissionId="warehouses">
      <div className="p-2 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-foreground">Almacenes</h1>
            <p className="text-muted-foreground">
              Gestiona tus almacenes y el stock por ubicación
            </p>
          </div>
        </div>

        <SimpleWarehousesTable />
      </div>
    </RoleGuard>
  );
}
