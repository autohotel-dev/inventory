"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Card } from "@/components/ui/card";
import {
    Package,
    Warehouse,
    ArrowRight,
    FileText,
    TrendingUp,
    TrendingDown,
    RotateCcw,
    ArrowLeftRight,
    Hash
} from "lucide-react";

interface MovementReason {
    id: string;
    code: string;
    description: string;
    movement_type: 'IN' | 'OUT' | 'ADJUSTMENT';
}

interface IndividualMovementFormProps {
    products: Array<{ id: string; sku: string; name: string; barcode?: string }>;
    warehouses: Array<{ id: string; code: string; name: string }>;
    reasons: MovementReason[];
    onSubmit: (formData: FormData) => void;
}

export function IndividualMovementForm({
    products,
    warehouses,
    reasons,
    onSubmit
}: IndividualMovementFormProps) {
    const [movementType, setMovementType] = useState<'entry' | 'exit' | 'adjustment' | 'transfer'>('entry');

    const productOptions = products.map(p => ({
        value: p.id,
        label: `${p.sku} - ${p.name}`,
        sku: p.sku,
        barcode: p.barcode
    }));
    const warehouseOptions = warehouses.map(w => ({ value: w.id, label: `${w.code} - ${w.name}` }));

    // Filtrar razones según el tipo de movimiento
    const filteredReasons = reasons.filter(r => {
        if (movementType === 'entry') return r.movement_type === 'IN';
        if (movementType === 'exit') return r.movement_type === 'OUT';
        if (movementType === 'adjustment') return r.movement_type === 'ADJUSTMENT';
        if (movementType === 'transfer') return r.movement_type === 'IN' || r.movement_type === 'OUT';
        return true;
    });

    const typeConfig = {
        entry: {
            icon: TrendingUp,
            color: 'green',
            label: 'Entrada',
            desc: 'Agregar stock al inventario'
        },
        exit: {
            icon: TrendingDown,
            color: 'red',
            label: 'Salida',
            desc: 'Quitar stock del inventario'
        },
        adjustment: {
            icon: RotateCcw,
            color: 'orange',
            label: 'Ajuste',
            desc: 'Establecer cantidad exacta'
        },
        transfer: {
            icon: ArrowLeftRight,
            color: 'blue',
            label: 'Transferencia',
            desc: 'Mover entre almacenes'
        }
    };

    const currentType = typeConfig[movementType];
    const TypeIcon = currentType.icon;

    return (
        <div className="max-w-8xl mx-auto">
            <form action={onSubmit} className="space-y-6">
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
                    <input type="hidden" name="type" value={movementType} />
                </div>

                {/* Producto - Card destacada */}
                <Card className="p-5 border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/0">
                    <div className="flex items-start gap-4">
                        <div className="p-3 rounded-xl bg-primary/10">
                            <Package className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1 space-y-3">
                            <div>
                                <Label htmlFor="product_id" className="text-base font-semibold">Producto</Label>
                                <p className="text-xs text-muted-foreground">Escanea código de barras o busca por nombre/SKU</p>
                            </div>
                            <SearchableSelect
                                id="product_id"
                                name="product_id"
                                options={productOptions}
                                required
                                className="w-full"
                                placeholder="🔍 Escanear o buscar producto..."
                                scannerMode={true}
                            />
                        </div>
                    </div>
                </Card>

                {/* Almacenes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Almacén Origen/Principal */}
                    <Card className="p-4 border border-border/50 hover:border-primary/30 transition-colors">
                        <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                                <Warehouse className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                            </div>
                            <div className="flex-1 space-y-2">
                                <Label htmlFor="warehouse_id" className="font-medium">
                                    {movementType === 'transfer' ? 'Almacén Origen' : 'Almacén'}
                                </Label>
                                <SearchableSelect
                                    id="warehouse_id"
                                    name="warehouse_id"
                                    options={warehouseOptions}
                                    required
                                    className="w-[100%]"
                                    placeholder="Seleccionar almacén..."
                                />
                            </div>
                        </div>
                    </Card>

                    {/* Almacén Destino (Solo para transferencias) */}
                    <Card className={`p-4 border transition-all duration-300 ${movementType === 'transfer'
                        ? 'border-blue-500/30 bg-blue-500/5'
                        : 'border-dashed border-border/50 opacity-50'
                        }`}>
                        <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${movementType === 'transfer'
                                ? 'bg-blue-500/10'
                                : 'bg-slate-100 dark:bg-slate-800'
                                }`}>
                                <ArrowRight className={`h-5 w-5 ${movementType === 'transfer'
                                    ? 'text-blue-500'
                                    : 'text-slate-400'
                                    }`} />
                            </div>
                            <div className="flex-1 space-y-2">
                                <Label htmlFor="to_warehouse_id" className="font-medium">
                                    Almacén Destino
                                </Label>
                                <SearchableSelect
                                    id="to_warehouse_id"
                                    name="to_warehouse_id"
                                    options={warehouseOptions}
                                    className="w-full"
                                    placeholder={movementType === 'transfer' ? 'Seleccionar destino...' : 'Solo para transferencias'}
                                />
                                {movementType !== 'transfer' && (
                                    <p className="text-xs text-muted-foreground">Solo aplica para transferencias</p>
                                )}
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Cantidad y Razón */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Cantidad */}
                    <Card className="p-4 border border-border/50">
                        <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${movementType === 'entry' ? 'bg-green-500/10' :
                                movementType === 'exit' ? 'bg-red-500/10' :
                                    movementType === 'adjustment' ? 'bg-orange-500/10' :
                                        'bg-blue-500/10'
                                }`}>
                                <Hash className={`h-5 w-5 ${movementType === 'entry' ? 'text-green-500' :
                                    movementType === 'exit' ? 'text-red-500' :
                                        movementType === 'adjustment' ? 'text-orange-500' :
                                            'text-blue-500'
                                    }`} />
                            </div>
                            <div className="flex-1 space-y-2">
                                <Label htmlFor="qty" className="font-medium">Cantidad</Label>
                                <Input
                                    id="qty"
                                    name="qty"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0"
                                    className="text-2xl font-bold h-14 text-center"
                                    required
                                />
                            </div>
                        </div>
                    </Card>

                    {/* Razón */}
                    <Card className="p-4 border border-border/50">
                        <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-purple-500/10">
                                <FileText className="h-5 w-5 text-purple-500" />
                            </div>
                            <div className="flex-1 space-y-2">
                                <Label htmlFor="reason_code" className="font-medium">Razón</Label>
                                <select
                                    id="reason_code"
                                    name="reason_code"
                                    className="w-full h-14 px-4 border rounded-lg bg-background text-sm font-medium"
                                    required
                                >
                                    {filteredReasons.length === 0 ? (
                                        <option value="">No hay razones para este tipo</option>
                                    ) : (
                                        filteredReasons.map(r => (
                                            <option key={r.id} value={r.code}>{r.code} - {r.description}</option>
                                        ))
                                    )}
                                </select>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Nota */}
                <Card className="p-4 border border-border/50">
                    <div className="space-y-2">
                        <Label htmlFor="note" className="font-medium">Nota (Opcional)</Label>
                        <Input
                            id="note"
                            name="note"
                            placeholder="Agregar comentario o referencia..."
                            className="h-12"
                        />
                    </div>
                </Card>

                {/* Submit */}
                <div className="flex justify-end pt-4">
                    <SubmitButton
                        pendingText="Guardando..."
                        className="h-12 px-8 text-base font-semibold gap-2"
                    >
                        <TypeIcon className="h-5 w-5" />
                        Crear {currentType.label}
                    </SubmitButton>
                </div>
            </form>

            <p className="text-sm text-muted-foreground mt-6 text-center">
                💡 En transferencias se crearán automáticamente dos movimientos (salida y entrada).
            </p>
        </div>
    );
}
