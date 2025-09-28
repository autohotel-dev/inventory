import { SimpleProductsTable } from "@/components/products/simple-products-table";

export const dynamic = "force-dynamic";

export default function ProductsPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Productos</h1>
          <p className="text-muted-foreground">
            Gestiona tu inventario de productos
          </p>
        </div>
      </div>

      <SimpleProductsTable />
    </div>
  );
}
