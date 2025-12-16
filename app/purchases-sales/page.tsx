"use client";

import { PurchasesSalesDashboard } from "@/components/purchases-sales/dashboard";
import { RoleGuard } from "@/components/auth/role-guard";

export default function PurchasesSalesPage() {
  return (
    <RoleGuard requireAdmin>
    <div className="p-6">
      <PurchasesSalesDashboard />
    </div>
    </RoleGuard>
  );
}
