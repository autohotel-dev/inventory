
import { AdvancedCustomersSalesTable } from "@/components/customers-sales/advanced-customers-sales-table";

export const dynamic = "force-dynamic";

interface Props {
    params: Promise<{ id: string }>;
}

export default function OwnSales({ params }: Props) {
    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Ventas del Cliente</h1>
                    <p className="text-muted-foreground">
                        Administra las ventas del cliente
                    </p>
                </div>
            </div>

            <AdvancedCustomersSalesTable params={params} />
        </div>
    );
}