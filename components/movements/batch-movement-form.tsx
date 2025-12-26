"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Plus, Trash2, Save, Package } from "lucide-react";
import { toast } from "sonner";

interface Product {
    id: string;
    name: string;
    sku: string;
}

interface Warehouse {
    id: string;
    name: string;
    code: string;
}

interface Reason {
    id: string;
    code: string;
    description: string;
}

interface BatchItem {
    tempId: string;
    product_id: string;
    product_name: string;
    quantity: number;
    warehouse_id: string;
    warehouse_name: string;
    notes: string;
}

interface BatchMovementFormProps {
    products: Product[];
    warehouses: Warehouse[];
    reasons: Reason[];
    onSubmit: (data: {
        movementType: string;
        reasonCode: string;
        items: BatchItem[];
    }) => Promise<void>;
}

export function BatchMovementForm({
    products,
    warehouses,
    reasons,
    onSubmit
}: BatchMovementFormProps) {
    const [movementType, setMovementType] = useState<"IN" | "OUT" | "ADJUSTMENT">("IN");
    const [reasonCode, setReasonCode] = useState(reasons[0]?.code || "ADJUSTMENT");
    const [items, setItems] = useState<BatchItem[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Default warehouse (first one)
    const defaultWarehouse = warehouses[0];

    const productOptions = products.map(p => ({
        value: p.id,
        label: `${p.sku} - ${p.name}`
    }));

    const warehouseOptions = warehouses.map(w => ({
        value: w.id,
        label: `${w.code} - ${w.name}`
    }));

    const addNewItem = () => {
        if (!defaultWarehouse) {
            toast.error("No hay almacenes disponibles");
            return;
        }

        const newItem: BatchItem = {
            tempId: `temp-${Date.now()}`,
            product_id: "",
            product_name: "",
            quantity: 1,
            warehouse_id: defaultWarehouse.id,
            warehouse_name: `${defaultWarehouse.code} - ${defaultWarehouse.name}`,
            notes: ""
        };

        setItems([...items, newItem]);
    };

    const removeItem = (tempId: string) => {
        setItems(items.filter(item => item.tempId !== tempId));
    };

    const updateItem = (tempId: string, updates: Partial<BatchItem>) => {
        setItems(items.map(item =>
            item.tempId === tempId ? { ...item, ...updates } : item
        ));
    };

    const handleProductChange = (tempId: string, productId: string) => {
        const product = products.find(p => p.id === productId);
        if (product) {
            updateItem(tempId, {
                product_id: productId,
                product_name: `${product.sku} - ${product.name}`
            });
        }
    };

    const handleWarehouseChange = (tempId: string, warehouseId: string) => {
        const warehouse = warehouses.find(w => w.id === warehouseId);
        if (warehouse) {
            updateItem(tempId, {
                warehouse_id: warehouseId,
                warehouse_name: `${warehouse.code} - ${warehouse.name}`
            });
        }
    };

    const handleSubmit = async () => {
        // Validaciones
        if (items.length === 0) {
            toast.error("Agrega al menos un producto");
            return;
        }

        for (const item of items) {
            if (!item.product_id) {
                toast.error("Todos los productos deben estar seleccionados");
                return;
            }
            if (item.quantity <= 0) {
                toast.error("Todas las cantidades deben ser mayores a 0");
                return;
            }
            if (!item.warehouse_id) {
                toast.error("Todos los almacenes deben estar seleccionados");
                return;
            }
        }

        // Verificar duplicados
        const productIds = items.map(i => i.product_id);
        const duplicates = productIds.filter((id, index) => productIds.indexOf(id) !== index);
        if (duplicates.length > 0) {
            toast.error("Hay productos duplicados en la lista");
            return;
        }

        setIsSubmitting(true);
        try {
            await onSubmit({
                movementType,
                reasonCode,
                items
            });



            // Limpiar formulario
            setItems([]);
        } catch (error: any) {
            // Next.js redirect() lanza una excepción - ignorarla
            if (error?.digest?.startsWith('NEXT_REDIRECT')) {
                return; // Es un redirect exitoso
            }
            console.error("Error al crear movimientos:", error);
            toast.error("Error al guardar los movimientos");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Configuración general */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg border">
                <div className="space-y-2">
                    <Label htmlFor="movementType">Tipo de Movimiento</Label>
                    <select
                        id="movementType"
                        value={movementType}
                        onChange={(e) => setMovementType(e.target.value as "IN" | "OUT" | "ADJUSTMENT")}
                        className="border rounded-lg px-3 py-2 w-full bg-background"
                    >
                        <option value="IN">📈 Entrada (Agregar Stock)</option>
                        <option value="OUT">📉 Salida (Descontar Stock)</option>
                        <option value="ADJUSTMENT">🔄 Ajuste (Establecer Cantidad Exacta)</option>
                    </select>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="reasonCode">Razón</Label>
                    <select
                        id="reasonCode"
                        value={reasonCode}
                        onChange={(e) => setReasonCode(e.target.value)}
                        className="border rounded-lg px-3 py-2 w-full bg-background"
                    >
                        {reasons.map(r => (
                            <option key={r.id} value={r.code}>
                                {r.code} - {r.description}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Tabla de productos */}
            <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted px-4 py-3 border-b">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold flex items-center gap-2">
                            <Package className="h-5 w-5" />
                            Productos ({items.length})
                        </h3>
                        <Button
                            type="button"
                            onClick={addNewItem}
                            size="sm"
                            variant="outline"
                            className="gap-2"
                        >
                            <Plus className="h-4 w-4" />
                            Agregar Producto
                        </Button>
                    </div>
                </div>

                {items.length === 0 ? (
                    <div className="p-12 text-center text-muted-foreground">
                        <Package className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p>No hay productos agregados</p>
                        <p className="text-sm mt-1">Click en "Agregar Producto" para comenzar</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted/50 border-b">
                                <tr>
                                    <th className="text-left px-4 py-3 text-sm font-medium">Producto</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium w-32">Cantidad</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium">Almacén</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium">Notas</th>
                                    <th className="text-center px-4 py-3 text-sm font-medium w-20"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {items.map(item => (
                                    <tr key={item.tempId} className="hover:bg-muted/30">
                                        <td className="px-4 py-3">
                                            <SearchableSelect
                                                id={`product-${item.tempId}`}
                                                name={`product-${item.tempId}`}
                                                options={productOptions}
                                                defaultValue={item.product_id}
                                                onChange={(value) => handleProductChange(item.tempId, value)}
                                                placeholder="Buscar producto..."
                                                className="min-w-[250px]"
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <Input
                                                type="number"
                                                min="0.01"
                                                step="0.01"
                                                value={item.quantity}
                                                onChange={(e) => updateItem(item.tempId, { quantity: Number(e.target.value) })}
                                                className="w-full"
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <SearchableSelect
                                                id={`warehouse-${item.tempId}`}
                                                name={`warehouse-${item.tempId}`}
                                                options={warehouseOptions}
                                                defaultValue={item.warehouse_id}
                                                onChange={(value) => handleWarehouseChange(item.tempId, value)}
                                                placeholder="Almacén..."
                                                className="min-w-[200px]"
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <Input
                                                value={item.notes}
                                                onChange={(e) => updateItem(item.tempId, { notes: e.target.value })}
                                                placeholder="Nota opcional..."
                                                className="w-full"
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeItem(item.tempId)}
                                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Footer con resumen y botones */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
                <div className="text-sm text-muted-foreground">
                    {items.length > 0 ? (
                        <>
                            <strong className="text-foreground">{items.length}</strong> producto(s) •
                            <strong className="text-foreground ml-1">
                                {items.reduce((sum, item) => sum + item.quantity, 0).toFixed(2)}
                            </strong> unidades totales
                        </>
                    ) : (
                        "Sin productos agregados"
                    )}
                </div>

                <div className="flex gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setItems([])}
                        disabled={items.length === 0 || isSubmitting}
                    >
                        Limpiar Todo
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSubmit}
                        disabled={items.length === 0 || isSubmitting}
                        className="gap-2"
                    >
                        {isSubmitting ? (
                            <>Guardando...</>
                        ) : (
                            <>
                                <Save className="h-4 w-4" />
                                Guardar {items.length > 0 && `(${items.length})`}
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
