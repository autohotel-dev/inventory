"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { SearchableSelect } from "@/components/ui/searchable-select";

interface MovementReason {
    id: string;
    code: string;
    description: string;
    movement_type: 'IN' | 'OUT' | 'ADJUSTMENT';
}

interface IndividualMovementFormProps {
    products: Array<{ id: string; sku: string; name: string }>;
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

    const productOptions = products.map(p => ({ value: p.id, label: `${p.sku} - ${p.name}` }));
    const warehouseOptions = warehouses.map(w => ({ value: w.id, label: `${w.code} - ${w.name}` }));

    // Filtrar razones según el tipo de movimiento
    const filteredReasons = reasons.filter(r => {
        if (movementType === 'entry') return r.movement_type === 'IN';
        if (movementType === 'exit') return r.movement_type === 'OUT';
        if (movementType === 'adjustment') return r.movement_type === 'ADJUSTMENT';
        if (movementType === 'transfer') return r.movement_type === 'IN' || r.movement_type === 'OUT';
        return true;
    });

    return (
        <div className="max-w-2xl">
            <form action={onSubmit} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="type">Tipo</Label>
                    <select
                        id="type"
                        name="type"
                        className="border rounded-lg px-3 py-2 w-full"
                        value={movementType}
                        onChange={(e) => setMovementType(e.target.value as any)}
                    >
                        <option value="entry">📈 Entrada (Agregar stock)</option>
                        <option value="exit">📉 Salida (Quitar stock)</option>
                        <option value="adjustment">🔄 Ajuste (Establecer cantidad exacta)</option>
                        <option value="transfer">🔀 Transferencia</option>
                    </select>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="product_id">Producto</Label>
                    <SearchableSelect
                        id="product_id"
                        name="product_id"
                        options={productOptions}
                        required
                        className="w-full"
                        placeholder="Buscar producto..."
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="warehouse_id">Almacén</Label>
                        <SearchableSelect
                            id="warehouse_id"
                            name="warehouse_id"
                            options={warehouseOptions}
                            required
                            className="w-full"
                            placeholder="Buscar almacén..."
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="to_warehouse_id">A Almacén (Transferencia)</Label>
                        <SearchableSelect
                            id="to_warehouse_id"
                            name="to_warehouse_id"
                            options={warehouseOptions}
                            className="w-full"
                            placeholder="Buscar destino..."
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="qty">Cantidad</Label>
                        <Input
                            id="qty"
                            name="qty"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Ingresa cantidad"
                            className="w-full text-lg"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="reason_code">Razón</Label>
                        <select id="reason_code" name="reason_code" className="border rounded-lg px-3 py-2 w-full" required>
                            {filteredReasons.length === 0 ? (
                                <option value="">No hay razones para este tipo</option>
                            ) : (
                                filteredReasons.map(r => (
                                    <option key={r.id} value={r.code}>{r.code} - {r.description}</option>
                                ))
                            )}
                        </select>
                        <p className="text-xs text-muted-foreground">
                            {movementType === 'entry' && 'Solo razones de entrada (IN)'}
                            {movementType === 'exit' && 'Solo razones de salida (OUT)'}
                            {movementType === 'adjustment' && 'Solo razones de ajuste'}
                            {movementType === 'transfer' && 'Solo razones válidas para transferencia'}
                        </p>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="note">Nota</Label>
                    <Input id="note" name="note" />
                </div>

                <div className="flex gap-3">
                    <SubmitButton pendingText="Guardando...">Crear Movimiento</SubmitButton>
                </div>
            </form>

            <p className="text-sm text-muted-foreground mt-4">
                En transferencias se crearán automáticamente dos movimientos (salida y entrada).
            </p>
        </div>
    );
}
