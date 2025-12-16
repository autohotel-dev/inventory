"use client";

import { AdvancedPurchasesTable } from "@/components/purchases/advanced-purchases-table";
import { RoleGuard } from "@/components/auth/role-guard";

export default function PurchasesPage() {
  return (
    <RoleGuard requireAdmin>
    <div className="p-6">
      <AdvancedPurchasesTable />
    </div>
    </RoleGuard>
  );
}
