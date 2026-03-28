"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Room } from "@/components/sales/room-types";
import { formatCurrency } from "@/lib/utils/formatters";
import { toast } from "sonner";
import { Car, CreditCard, Banknote, Building2, AlertCircle, Search } from "lucide-react";
import { getBrandOptions, getModelsForBrand, searchVehicles } from "@/lib/constants/vehicle-catalog";
import { MultiPaymentInput } from "@/components/sales/multi-payment-input";

interface ValetCheckInModalProps {
    room: Room | null;
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (vehicleData: any, paymentData: any, personCount: number) => Promise<void>;
    loading: boolean;
}

export function ValetCheckInModal({
    room,
    isOpen,
    onClose,
    onConfirm,
    loading
}: ValetCheckInModalProps) {
    const [plate, setPlate] = useState("");
    const [brand, setBrand] = useState("");
    const [model, setModel] = useState("");
    const [vehicleSearch, setVehicleSearch] = useState("");
    const [showSearchResults, setShowSearchResults] = useState(false);
    const [payments, setPayments] = useState<any[]>([]);
    const [personCount, setPersonCount] = useState(2);

    // Reset form cuando el modal se abre
    useEffect(() => {
        if (isOpen && room) {
            setPlate("");
            setBrand("");
            setModel("");
            setVehicleSearch("");
            setShowSearchResults(false);
            setPersonCount(2);
            
            // Inicializar pago basado en el precio total
            const baseAmount = room.room_types?.base_price ?? 0;
            const extraPersonPrice = room.room_types?.extra_person_price ?? 0;
            const totalAmount = baseAmount + (Math.max(0, 2 - 2) * extraPersonPrice); // Initial 2 people
            
            setPayments([{
                id: crypto.randomUUID(),
                amount: totalAmount,
                method: 'EFECTIVO',
                reference: ""
            }]);
        }
    }, [isOpen, room]);

    const baseAmount = room?.room_types?.base_price ?? 0;
    const extraPersonPrice = room?.room_types?.extra_person_price ?? 0;
    const extraPeopleCount = Math.max(0, personCount - 2);
    const totalAmount = baseAmount + (extraPeopleCount * extraPersonPrice);

    // Sincronizar monto total de pagos si cambia personCount
    useEffect(() => {
        if (payments.length === 1) {
            setPayments(prev => [{ ...prev[0], amount: totalAmount }]);
        }
    }, [payments.length, totalAmount]);

    if (!room) return null;

    const handleSubmit = async () => {
        // Validaciones
        if (!plate.trim()) {
            toast.error("Ingresa la placa del vehículo");
            return;
        }

        const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
        if (Math.abs(totalPaid - totalAmount) > 0.01) {
            toast.error(`El monto pagado (${formatCurrency(totalPaid)}) no coincide con el total (${formatCurrency(totalAmount)})`);
            return;
        }

        const vehicleData = {
            plate: plate.trim().toUpperCase(),
            brand: brand.trim(),
            model: model.trim()
        };

        await onConfirm(vehicleData, payments, personCount);

        // Reset form
        setPlate("");
        setBrand("");
        setModel("");
        setPayments([]);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl">
                        Entrada - Hab. {room.number}
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground">
                        {room.room_types?.name}
                    </p>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Datos del vehículo */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Car className="h-5 w-5 text-blue-500" />
                            <h3 className="text-base font-semibold">Datos del Vehículo</h3>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <Label htmlFor="plate" className="text-base">
                                    Placa <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="plate"
                                    value={plate}
                                    onChange={(e) => setPlate(e.target.value)}
                                    placeholder="ABC-123"
                                    maxLength={20}
                                    className="text-lg h-12 uppercase"
                                    autoFocus
                                />
                            </div>

                            {/* Búsqueda rápida por modelo */}
                            <div className="relative">
                                <div className="flex items-center gap-2 border rounded px-3 py-2 bg-background">
                                    <Search className="h-4 w-4 text-muted-foreground" />
                                    <input
                                        className="outline-none flex-1 bg-transparent text-base"
                                        placeholder="Buscar por modelo (ej: Corolla, Versa)..."
                                        value={vehicleSearch}
                                        onChange={(e) => {
                                            setVehicleSearch(e.target.value);
                                            setShowSearchResults(e.target.value.length >= 2);
                                        }}
                                        onFocus={() => vehicleSearch.length >= 2 && setShowSearchResults(true)}
                                    />
                                </div>

                                {showSearchResults && vehicleSearch.length >= 2 && (
                                    <div className="absolute z-10 w-full mt-1 border rounded bg-background max-h-48 overflow-auto shadow-lg">
                                        {searchVehicles(vehicleSearch).map((result, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2"
                                                onClick={() => {
                                                    setBrand(result.brand.value);
                                                    setModel(result.model);
                                                    setVehicleSearch(`${result.brand.label} ${result.model}`);
                                                    setShowSearchResults(false);
                                                }}
                                            >
                                                <span className="font-medium text-blue-500">{result.brand.label}</span>
                                                <span className="text-muted-foreground">{result.model}</span>
                                            </button>
                                        ))}
                                        {searchVehicles(vehicleSearch).length === 0 && (
                                            <div className="px-3 py-2 text-sm text-muted-foreground text-center">
                                                No se encontraron resultados
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label className="text-base">Marca</Label>
                                    <SearchableSelect
                                        id="vehicle-brand"
                                        name="vehicle-brand"
                                        options={getBrandOptions()}
                                        defaultValue={brand}
                                        onChange={(value) => {
                                            setBrand(value);
                                            setModel("");
                                        }}
                                        placeholder="Selecciona marca..."
                                        className="w-full h-11"
                                    />
                                </div>
                                <div>
                                    <Label className="text-base">Modelo</Label>
                                    {brand ? (
                                        <SearchableSelect
                                            id="vehicle-model"
                                            name="vehicle-model"
                                            options={getModelsForBrand(brand).map(m => ({ value: m, label: m }))}
                                            defaultValue={model}
                                            onChange={(value) => setModel(value)}
                                            placeholder="Seleccionar modelo..."
                                            className="w-full h-11"
                                        />
                                    ) : (
                                        <Input
                                            placeholder="Primero selecciona marca"
                                            disabled
                                            className="bg-muted h-11"
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Cobro */}
                    <div className="space-y-3 border-t pt-4">
                        <div className="flex items-center gap-2">
                            <h3 className="text-base font-semibold">Cobro al Cliente</h3>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="people" className="text-sm text-muted-foreground uppercase font-bold tracking-wider">
                                    Personas
                                </Label>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-10 w-10 shrink-0"
                                        onClick={() => setPersonCount(prev => Math.max(1, prev - 1))}
                                    >
                                        -
                                    </Button>
                                    <div className="flex-1 bg-muted h-10 rounded-md flex items-center justify-center font-bold text-lg">
                                        {personCount}
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-10 w-10 shrink-0"
                                        onClick={() => setPersonCount(prev => prev + 1)}
                                    >
                                        +
                                    </Button>
                                </div>
                            </div>

                            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                                <p className="text-xs text-muted-foreground mb-1">Monto a cobrar</p>
                                <p className="text-2xl font-bold text-green-500">{formatCurrency(totalAmount)}</p>
                            </div>
                        </div>

                        {extraPeopleCount > 0 && (
                            <div className="text-xs text-green-500/80 bg-green-500/5 px-2 py-1 rounded border border-green-500/10">
                                Incluye {extraPeopleCount} {extraPeopleCount === 1 ? 'persona extra' : 'personas extras'} ({formatCurrency(extraPeopleCount * extraPersonPrice)})
                            </div>
                        )}

                        <div className="space-y-3">
                            <Label className="text-base">Método de pago</Label>
                            <MultiPaymentInput
                                totalAmount={totalAmount}
                                payments={payments}
                                onPaymentsChange={setPayments}
                                showReference={true}
                            />
                        </div>
                    </div>

                    {/* Warning importante */}
                    <div className="bg-amber-500/10 border-2 border-amber-500/50 rounded-lg p-4 space-y-2">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="h-6 w-6 text-amber-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-semibold text-amber-200 mb-1">¡IMPORTANTE!</p>
                                <p className="text-sm text-amber-100">
                                    Lleva el dinero o los comprobantes a recepción para confirmar el pago.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Acciones */}
                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            disabled={loading}
                            className="h-12 text-base"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="h-12 text-base bg-green-600 hover:bg-green-700"
                        >
                            {loading ? "Registrando..." : "Enviar Info a Recepción"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
