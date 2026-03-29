import { AdvancedPurchaseDetail } from "@/components/purchases/advanced-purchase-detail";

export const dynamic = "force-dynamic";

export default async function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  
  return <AdvancedPurchaseDetail orderId={resolvedParams.id} />;
}
