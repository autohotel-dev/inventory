"use client";

import { AdvancedCustomersTable } from "@/components/customers/advanced-customers-table";
import { RoleGuard } from "@/components/auth/role-guard";

export default function CustomersPage() {
  return (
    <RoleGuard requireAdmin>
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestión de Clientes</h1>
          <p className="text-muted-foreground">
            Administra tu cartera de clientes y sus estadísticas de compra
          </p>
        </div>
      </div>

      <AdvancedCustomersTable />
    </div>
    </RoleGuard>
  );
}
