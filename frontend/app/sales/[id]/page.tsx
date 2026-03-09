import { AdvancedSalesDetail } from "@/components/sales/advanced-sales-detail";

export const dynamic = "force-dynamic";

export default async function SalesDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  
  return <AdvancedSalesDetail orderId={resolvedParams.id} />;
}
