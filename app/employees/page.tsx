"use client";

import { EmployeesTable } from "@/components/employees/employees-table";
import { RoleGuard } from "@/components/auth/role-guard";

export default function EmployeesPage() {
  return (
    <RoleGuard requireAdmin>
      <div className="container mx-auto py-6 px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Empleados</h1>
          <p className="text-muted-foreground">
            Gestiona los empleados y recepcionistas del sistema
          </p>
        </div>
        <EmployeesTable />
      </div>
    </RoleGuard>
  );
}
