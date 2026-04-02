"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect, Option } from "@/components/ui/searchable-select";
import {
    Plus,
    Trash2,
    Save,
    Package,
    Barcode,
    TrendingUp,
    TrendingDown,
    RotateCcw,
    Warehouse,
    FileText,
    Loader2,
    CheckCircle2,
    ArrowLeftRight,
    ArrowRight
} from "lucide-react";
import { toast } from "sonner";

interface Product {
    id: string;
    name: string;
    sku: string;
    barcode?: string;
}

interface WarehouseType {
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
    to_warehouse_id?: string;
    to_warehouse_name?: string;
    notes: string;
}

interface BatchMovementFormProps {
    products: Product[];
    warehouses: WarehouseType[];
    reasons: Reason[];
    onSubmit: (data: {
        movementType: string;
        reasonCode: string;
        items: BatchItem[];
        toWarehouseId?: string;
    }) => Promise<void>;
}

export function BatchMovementForm({
    products,
    warehouses,
    reasons,
    onSubmit
}: BatchMovementFormProps) {
    const [movementType, setMovementType] = useState<"IN" | "OUT" | "ADJUSTMENT" | "TRANSFER">("IN");
    const [reasonCode, setReasonCode] = useState(reasons[0]?.code || "ADJUSTMENT");
    const [items, setItems] = useState<BatchItem[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [globalToWarehouse, setGlobalToWarehouse] = useState<string>("");

    // Default warehouse (first one)
    const defaultWarehouse = warehouses[0];

    const productOptions = products.map(p => ({
        value: p.id,
        label: `${p.sku} - ${p.name}`,
        sku: p.sku,
        barcode: p.barcode
    }));

    const warehouseOptions = warehouses.map(w => ({
        value: w.id,
        label: `${w.code} - ${w.name}`
    }));

    const typeConfig = {
        IN: {
            icon: TrendingUp,
            color: 'green',
            label: 'Entrada',
            desc: 'Agregar stock'
        },
        OUT: {
            icon: TrendingDown,
            color: 'red',
            label: 'Salida',
            desc: 'Descontar stock'
        },
        ADJUSTMENT: {
            icon: RotateCcw,
            color: 'orange',
            label: 'Ajuste',
            desc: 'Cantidad exacta'
        },
        TRANSFER: {
            icon: ArrowLeftRight,
            color: 'blue',
            label: 'Transferencia',
            desc: 'Mover entre almacenes'
        }
    };

    const currentType = typeConfig[movementType];
    const TypeIcon = currentType.icon;

    const addNewItem = () => {
        if (!defaultWarehouse) {
            toast.error("No hay almacenes disponibles");
            return;
        }

        const newItem: BatchItem = {
            tempId: `temp-${Date.now()}`,
            product_id: "",
            product_name: "",
            quantity: 0,
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

    // Manejar escaneo rápido - agrega producto automáticamente a la lista
    const handleQuickScan = (option: Option) => {
        if (!defaultWarehouse) {
            toast.error("No hay almacenes disponibles");
            return;
        }

        // Verificar si el producto ya está en la lista
        const existingItem = items.find(item => item.product_id === option.value);
        if (existingItem) {
            // Incrementar cantidad si ya existe
            updateItem(existingItem.tempId, {
                quantity: existingItem.quantity + 1
            });
            toast.success(`${option.label}`, {
                description: `Cantidad actualizada: ${existingItem.quantity + 1}`
            });
        } else {
            // Agregar nuevo item
            const product = products.find(p => p.id === option.value);
            const newItem: BatchItem = {
                tempId: `temp-${Date.now()}`,
                product_id: option.value,
                product_name: product ? `${product.sku} - ${product.name}` : option.label,
                quantity: 1,
                warehouse_id: defaultWarehouse.id,
                warehouse_name: `${defaultWarehouse.code} - ${defaultWarehouse.name}`,
                notes: ""
            };
            setItems(prev => [...prev, newItem]);
            toast.success(`${option.label}`, {
                description: "Agregado a la lista"
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

        // Validación específica para transferencias
        if (movementType === 'TRANSFER') {
            if (!globalToWarehouse) {
                toast.error("Debes seleccionar un almacén destino para la transferencia");
                return;
            }
            // Verificar que ningún item tenga el mismo almacén origen y destino
            for (const item of items) {
                if (item.warehouse_id === globalToWarehouse) {
                    toast.error("El almacén origen y destino no pueden ser el mismo");
                    return;
                }
            }
        }

        setIsSubmitting(true);
        try {
            await onSubmit({
                movementType,
                reasonCode,
                items,
                toWarehouseId: movementType === 'TRANSFER' ? globalToWarehouse : undefined
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

    const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);

    return (
        <div className="space-y-6 max-w-8xl mx-auto">
            {/* Tipo de Movimiento - Cards seleccionables */}
            <div className="space-y-3">
                <Label className="text-base font-semibold">Tipo de Movimiento</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {(Object.entries(typeConfig) as [typeof movementType, typeof currentType][]).map(([type, config]) => {
                        const Icon = config.icon;
                        const isSelected = movementType === type;
                        const colorClasses: Record<string, string> = {
                            green: isSelected
                                ? 'border-green-500 bg-gradient-to-br from-green-500/20 to-green-600/10 shadow-[0_0_20px_rgba(34,197,94,0.3)]'
                                : 'hover:border-green-500/50 hover:bg-green-500/5',
                            red: isSelected
                                ? 'border-red-500 bg-gradient-to-br from-red-500/20 to-red-600/10 shadow-[0_0_20px_rgba(239,68,68,0.3)]'
                                : 'hover:border-red-500/50 hover:bg-red-500/5',
                            orange: isSelected
                                ? 'border-orange-500 bg-gradient-to-br from-orange-500/20 to-orange-600/10 shadow-[0_0_20px_rgba(249,115,22,0.3)]'
                                : 'hover:border-orange-500/50 hover:bg-orange-500/5',
                            blue: isSelected
                                ? 'border-blue-500 bg-gradient-to-br from-blue-500/20 to-blue-600/10 shadow-[0_0_20px_rgba(59,130,246,0.3)]'
                                : 'hover:border-blue-500/50 hover:bg-blue-500/5',
                        };
                        const iconColors: Record<string, string> = {
                            green: isSelected ? 'bg-green-500 text-white' : 'bg-green-500/10 text-green-500',
                            red: isSelected ? 'bg-red-500 text-white' : 'bg-red-500/10 text-red-500',
                            orange: isSelected ? 'bg-orange-500 text-white' : 'bg-orange-500/10 text-orange-500',
                            blue: isSelected ? 'bg-blue-500 text-white' : 'bg-blue-500/10 text-blue-500',
                        };

                        return (
                            <Card
                                key={type}
                                className={`p-4 cursor-pointer transition-all duration-300 border-2 ${colorClasses[config.color]}`}
                                onClick={() => setMovementType(type)}
                            >
                                <div className="flex flex-col items-center text-center gap-2">
                                    <div className={`p-3 rounded-xl transition-colors ${iconColors[config.color]}`}>
                                        <Icon className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <p className="font-semibold">{config.label}</p>
                                        <p className="text-xs text-muted-foreground hidden md:block">{config.desc}</p>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            </div>

            {/* Razón */}
            <Card className="p-4 border border-border/50">
                <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/10">
                        <FileText className="h-5 w-5 text-purple-500" />
                    </div>
                    <div className="flex-1 space-y-2">
                        <Label htmlFor="reasonCode" className="font-medium">Razón del Movimiento</Label>
                        <select
                            id="reasonCode"
                            value={reasonCode}
                            onChange={(e) => setReasonCode(e.target.value)}
                            className="w-full h-11 px-4 border rounded-lg bg-background text-sm font-medium"
                        >
                            {reasons.map(r => (
                                <option key={r.id} value={r.code}>
                                    {r.code} - {r.description}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </Card>

            {/* Almacén Destino - Solo para Transferencias */}
            {movementType === 'TRANSFER' && (
                <Card className="p-4 border-2 border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-blue-600/5">
                    <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-blue-500 text-white">
                            <ArrowRight className="h-5 w-5" />
                        </div>
                        <div className="flex-1 space-y-2">
                            <Label className="font-medium text-blue-400">Almacén Destino (Global)</Label>
                            <p className="text-xs text-muted-foreground mb-2">
                                Todos los productos se transferirán a este almacén
                            </p>
                            <SearchableSelect
                                id="globalToWarehouse"
                                name="globalToWarehouse"
                                options={warehouseOptions}
                                defaultValue={globalToWarehouse}
                                onChange={(value) => setGlobalToWarehouse(value)}
                                placeholder="Seleccionar almacén destino..."
                                className="w-full"
                            />
                        </div>
                    </div>
                </Card>
            )}

            {/* Escaneo Rápido - Destacado */}
            <Card className="p-5 border-2 border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5">
                <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-primary text-white">
                        <Barcode className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                        <Label className="text-base font-semibold">Escaneo Rápido</Label>
                        <p className="text-sm text-muted-foreground mb-3">
                            Escanea códigos de barras para agregar productos automáticamente.
                            Si el producto ya existe, se incrementa la cantidad.
                        </p>
                        <SearchableSelect
                            id="quick-scan"
                            name="quick-scan"
                            options={productOptions}
                            placeholder="🔍 Escanear o buscar producto..."
                            scannerMode={true}
                            continuousScan={true}
                            onScan={handleQuickScan}
                            className="max-w-[100%]"
                        />
                    </div>
                </div>
            </Card>

            {/* Lista de Productos */}
            <Card className="overflow-hidden border-2">
                <div className="bg-muted/50 px-5 py-4 border-b flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-background">
                            <Package className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="font-semibold">Productos</h3>
                            <p className="text-xs text-muted-foreground">
                                {items.length > 0
                                    ? `${items.length} producto(s) • ${totalUnits} unidades`
                                    : 'Sin productos agregados'}
                            </p>
                        </div>
                    </div>
                    <Button
                        type="button"
                        onClick={addNewItem}
                        size="sm"
                        className="gap-2"
                    >
                        <Plus className="h-4 w-4" />
                        Agregar
                    </Button>
                </div>

                {items.length === 0 ? (
                    <div className="p-12 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                            <Package className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <p className="text-muted-foreground font-medium">No hay productos agregados</p>
                        <p className="text-sm text-muted-foreground mt-1">
                            Escanea un código de barras o click en &quot;Agregar&quot;
                        </p>
                    </div>
                ) : (
                    <div className="divide-y">
                        {items.map((item, index) => (
                            <div key={item.tempId} className="p-4 hover:bg-muted/30 transition-colors">
                                <div className="flex items-start gap-4">
                                    {/* Número de item */}
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                        <span className="text-sm font-bold text-primary">{index + 1}</span>
                                    </div>

                                    {/* Contenido principal */}
                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3">
                                        {/* Producto */}
                                        <div className="md:col-span-1">
                                            <Label className="text-xs text-muted-foreground mb-1 block">Producto</Label>
                                            <SearchableSelect
                                                id={`product-${item.tempId}`}
                                                name={`product-${item.tempId}`}
                                                options={productOptions}
                                                defaultValue={item.product_id}
                                                onChange={(value) => handleProductChange(item.tempId, value)}
                                                placeholder="Buscar..."
                                                scannerMode={true}
                                            />
                                        </div>

                                        {/* Cantidad */}
                                        <div>
                                            <Label className="text-xs text-muted-foreground mb-1 block">Cantidad</Label>
                                            <Input
                                                type="number"
                                                min="0"
                                                step="1"
                                                value={item.quantity || ""}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === '') updateItem(item.tempId, { quantity: 0 });
                                                    else updateItem(item.tempId, { quantity: parseInt(val) || 0 });
                                                }}
                                                placeholder="0"
                                                className="text-lg font-bold text-center h-10"
                                            />
                                        </div>

                                        {/* Almacén */}
                                        <div>
                                            <Label className="text-xs text-muted-foreground mb-1 block">Almacén</Label>
                                            <SearchableSelect
                                                id={`warehouse-${item.tempId}`}
                                                name={`warehouse-${item.tempId}`}
                                                options={warehouseOptions}
                                                defaultValue={item.warehouse_id}
                                                onChange={(value) => handleWarehouseChange(item.tempId, value)}
                                                placeholder="Almacén..."
                                            />
                                        </div>

                                        {/* Notas */}
                                        <div>
                                            <Label className="text-xs text-muted-foreground mb-1 block">Nota</Label>
                                            <Input
                                                value={item.notes}
                                                onChange={(e) => updateItem(item.tempId, { notes: e.target.value })}
                                                placeholder="Opcional..."
                                                className="h-10"
                                            />
                                        </div>
                                    </div>

                                    {/* Botón eliminar */}
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeItem(item.tempId)}
                                        className="text-red-500 hover:text-red-600 hover:bg-red-500/10 flex-shrink-0"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            {/* Botón de agregar inferior para listas largas */}
            {items.length > 3 && (
                <Button
                    type="button"
                    variant="outline"
                    onClick={addNewItem}
                    className="w-full border-dashed border-2 py-8 text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-primary/5 transition-all gap-2"
                >
                    <Plus className="h-5 w-5" />
                    Agregar otro producto
                </Button>
            )}

            {/* Footer con resumen y botones */}
            <Card className="p-4 border-2 bg-muted/30">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Badge variant="outline" className="text-base px-4 py-2 gap-2">
                            <Package className="h-4 w-4" />
                            {items.length} producto(s)
                        </Badge>
                        <Badge variant="outline" className={`text-base px-4 py-2 gap-2 ${movementType === 'IN' ? 'border-green-500 text-green-600' :
                            movementType === 'OUT' ? 'border-red-500 text-red-600' :
                                'border-orange-500 text-orange-600'
                            }`}>
                            <TypeIcon className="h-4 w-4" />
                            {totalUnits} unidades
                        </Badge>
                    </div>

                    <div className="flex gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setItems([])}
                            disabled={items.length === 0 || isSubmitting}
                        >
                            Limpiar
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSubmit}
                            disabled={items.length === 0 || isSubmitting}
                            className={`gap-2 min-w-[140px] ${movementType === 'IN' ? 'bg-green-600 hover:bg-green-700' :
                                movementType === 'OUT' ? 'bg-red-600 hover:bg-red-700' :
                                    'bg-orange-600 hover:bg-orange-700'
                                }`}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Guardando...
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4" />
                                    Guardar {items.length > 0 && `(${items.length})`}
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
