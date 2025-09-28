import { AdvancedStockView } from "@/components/stock/advanced-stock-view";

export const dynamic = "force-dynamic";

export default function StockPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Control de Stock</h1>
          <p className="text-muted-foreground">
            Vista detallada del inventario en tiempo real por almacén
          </p>
        </div>
      </div>

      <AdvancedStockView />
    </div>
  );
}
