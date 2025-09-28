import { InventoryMovementsTable } from "@/components/movements/inventory-movements-table";

export const dynamic = "force-dynamic";

export default function MovementsPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Movimientos de Inventario</h1>
          <p className="text-muted-foreground">
            Historial de entradas, salidas y ajustes de stock
          </p>
        </div>
      </div>

      <InventoryMovementsTable />
    </div>
  );
}
