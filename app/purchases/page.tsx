import { AdvancedPurchasesTable } from "@/components/purchases/advanced-purchases-table";

export const dynamic = "force-dynamic";

export default function PurchasesPage() {
  return (
    <div className="p-6">
      <AdvancedPurchasesTable />
    </div>
  );
}
