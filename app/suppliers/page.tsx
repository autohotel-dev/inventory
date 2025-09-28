import { SimpleSuppliersTable } from "@/components/suppliers/simple-suppliers-table";

export const dynamic = "force-dynamic";

export default function SuppliersPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Proveedores</h1>
          <p className="text-muted-foreground">
            Gestiona tus proveedores y sus productos
          </p>
        </div>
      </div>

      <SimpleSuppliersTable />
    </div>
  );
}
