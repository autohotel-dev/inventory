import { SimpleWarehousesTable } from "@/components/warehouses/simple-warehouses-table";

export const dynamic = "force-dynamic";

export default function WarehousesPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Almacenes</h1>
          <p className="text-muted-foreground">
            Gestiona tus almacenes y el stock por ubicación
          </p>
        </div>
      </div>

      <SimpleWarehousesTable />
    </div>
  );
}
