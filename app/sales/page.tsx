import { AdvancedSalesTable } from "@/components/sales/advanced-sales-table";

export const dynamic = "force-dynamic";

export default function SalesPage() {
  return (
    <div className="p-6">
      <AdvancedSalesTable />
    </div>
  );
}
