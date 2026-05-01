"use client";

import { SimpleCategoriesTable } from "@/components/categories/simple-categories-table";
import { RoleGuard } from "@/components/auth/role-guard";

export default function CategoriesPage() {
  return (
    <RoleGuard requireAdmin permissionId="categories">
      <div className="p-2 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-foreground">Categorías</h1>
            <p className="text-muted-foreground">
              Organiza y gestiona las categorías de tus productos
            </p>
          </div>
        </div>

        <SimpleCategoriesTable />
      </div>
    </RoleGuard>
  );
}
