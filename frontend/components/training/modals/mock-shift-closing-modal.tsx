"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DollarSign,
    Calculator,
    CheckCircle,
    TrendingUp,
    TrendingDown,
    Receipt,
    CreditCard,
    FileText,
    Loader2
} from "lucide-react";
import {
    CashBreakdown,
    CASH_DENOMINATIONS,
} from "@/components/employees/types";
import { toast } from "sonner";
import { EXPENSE_TYPE_LABELS } from "@/types/expenses";

interface MockShiftClosingModalProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    // Mock values
    initialFund?: number;
    totalSalesCash?: number;
    totalExpenses?: number;
}

export function MockShiftClosingModal({
    open,
    onClose,
    onConfirm,
    initialFund = 2000,
    totalSalesCash = 1250,
    totalExpenses = 0
}: MockShiftClosingModalProps) {

    const [loading, setLoading] = useState(false);
    const [cashBreakdown, setCashBreakdown] = useState<CashBreakdown>({});
    const [countedCash, setCountedCash] = useState(0);

    // Mock payments for high fidelity
    const mockPayments = [
        { id: '1', time: '09:15', method: 'EFECTIVO', amount: 450, concept: 'Renta Hab 102' },
        { id: '2', time: '10:30', method: 'TARJETA_BBVA', amount: 120, concept: 'Consumo Hab 105', terminal: 'BBVA' },
        { id: '3', time: '11:00', method: 'EFECTIVO', amount: 800, concept: 'Renta Hab 201' },
    ];

    const totalCardBBVA = 120;
    const totalCardGetnet = 0;
    const totalSales = totalSalesCash + totalCardBBVA + totalCardGetnet;
    const totalTransactions = mockPayments.length;

    // Calcular efectivo esperado (Solo ventas efectivo - gastos)
    // NOTA: El fondo inicial se suele manejar aparte, pero aquí simulamos el "Corte del Turno" (Earned cash)
    // Si queremos que cuadre con caja total incluyendo fondo: expected = initialFund + salesCash - expenses
    const expectedCash = initialFund + totalSalesCash - totalExpenses;
    const cashDifference = countedCash - expectedCash;

    // Calcular total contado basado en denominaciones
    useEffect(() => {
        let total = 0;
        Object.entries(cashBreakdown).forEach(([denom, count]: [string, any]) => {
            total += parseFloat(denom) * (count || 0);
        });
        setCountedCash(total);
    }, [cashBreakdown]);

    // Actualizar conteo de denominación
    const updateDenomination = (denomination: number, count: number) => {
        if (count < 0) return;
        setCashBreakdown((prev) => ({
            ...prev,
            [denomination.toString()]: count,
        }));
    };

    // Formatear moneda
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("es-MX", {
            style: "currency",
            currency: "MXN",
        }).format(amount);
    };

    const handleConfirm = async () => {
        if (countedCash === 0 && expectedCash > 0) {
            toast.warning("¿Seguro que cierras en $0.00? Deberías contar el dinero.");
        }

        setLoading(true);
        await new Promise(r => setTimeout(r, 1500)); // Simular guardado

        toast.info("🖨️ Imprimiendo reporte de cierre...", { duration: 2000 });

        // Simular window.open del reporte
        setTimeout(() => {
            onConfirm();
            onClose();
            setLoading(false);
        }, 1000);
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="w-[95vw] sm:w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Receipt className="h-5 w-5" />
                        Corte de Caja (Simulación)
                    </DialogTitle>
                    <DialogDescription>
                        Realiza el arqueo de tu turno de práctica
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto space-y-6 py-4">

                        {/* Resumen de ventas (Igual a Producción) */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-card border rounded-lg p-4">
                                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                    <DollarSign className="h-4 w-4" />
                                    <span className="text-sm">Efectivo</span>
                                </div>
                                <p className="text-xl font-bold text-green-500">
                                    {formatCurrency(totalSalesCash)}
                                </p>
                            </div>
                            <div className="bg-card border rounded-lg p-4">
                                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                    <CreditCard className="h-4 w-4" />
                                    <span className="text-sm">BBVA</span>
                                </div>
                                <p className="text-xl font-bold text-blue-500">
                                    {formatCurrency(totalCardBBVA)}
                                </p>
                            </div>
                            <div className="bg-card border rounded-lg p-4">
                                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                    <CreditCard className="h-4 w-4" />
                                    <span className="text-sm">GETNET</span>
                                </div>
                                <p className="text-xl font-bold text-red-500">
                                    {formatCurrency(totalCardGetnet)}
                                </p>
                            </div>
                            <div className="bg-card border rounded-lg p-4">
                                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                    <Receipt className="h-4 w-4" />
                                    <span className="text-sm">Total Ventas</span>
                                </div>
                                <p className="text-xl font-bold text-foreground">
                                    {formatCurrency(totalSales)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {totalTransactions} transacciones
                                </p>
                            </div>
                        </div>

                        {/* Gastos del Turno */}
                        {totalExpenses > 0 && (
                            <div className="border rounded-lg p-4 mt-4 bg-red-500/5 dark:bg-red-500/10">
                                <h4 className="font-semibold mb-3 flex items-center gap-2 text-red-600 dark:text-red-400">
                                    💸 Gastos del Turno (1)
                                </h4>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-start p-2 bg-white/50 rounded">
                                        <div className="flex-1">
                                            <p className="text-sm font-medium">Gasto Simulado</p>
                                            <p className="text-xs text-muted-foreground">
                                                Otros gastos
                                            </p>
                                        </div>
                                        <p className="text-sm font-bold text-red-600">-{formatCurrency(totalExpenses)}</p>
                                    </div>
                                    <div className="border-t pt-2 flex justify-between font-semibold text-red-600">
                                        <span>Total Gastos:</span>
                                        <span>-{formatCurrency(totalExpenses)}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Efectivo Esperado (Cálculo detallado) */}
                        <div className="border rounded-lg p-4 mt-4 bg-blue-500/5 dark:bg-blue-500/10">
                            <h4 className="font-semibold mb-2 text-sm">Cálculo del Efectivo</h4>
                            <div className="space-y-1 text-sm">
                                <div className="flex justify-between text-muted-foreground">
                                    <span>Fondo Inicial:</span>
                                    <span>{formatCurrency(initialFund)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Efectivo ventas:</span>
                                    <span>+{formatCurrency(totalSalesCash)}</span>
                                </div>
                                <div className="flex justify-between text-red-600">
                                    <span>(-) Gastos:</span>
                                    <span>-{formatCurrency(totalExpenses)}</span>
                                </div>
                                <div className="flex justify-between font-bold border-t pt-1">
                                    <span>Efectivo esperado:</span>
                                    <span className="text-green-600 dark:text-green-500">{formatCurrency(expectedCash)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Conteo de efectivo */}
                        <div className="border rounded-lg p-4 space-y-4">
                            <h3 className="font-semibold flex items-center gap-2">
                                <Calculator className="h-4 w-4" />
                                Conteo de Efectivo
                            </h3>

                            <div className="space-y-4">
                                <div>
                                    <Label className="text-sm font-medium text-muted-foreground mb-2 block">Billetes</Label>
                                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                                        {CASH_DENOMINATIONS.filter(d => d.value >= 20).map((denom) => (
                                            <div key={denom.value} className="space-y-1">
                                                <Label className="text-xs">{denom.label}</Label>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    value={cashBreakdown[denom.value.toString()] || ""}
                                                    onChange={(e) =>
                                                        updateDenomination(denom.value, parseInt(e.target.value) || 0)
                                                    }
                                                    className="h-9"
                                                    placeholder="0"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <Label className="text-sm font-medium text-muted-foreground mb-2 block">Monedas</Label>
                                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                                        {CASH_DENOMINATIONS.filter(d => d.value < 20).map((denom) => (
                                            <div key={denom.value} className="space-y-1">
                                                <Label className="text-xs">{denom.label}</Label>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    value={cashBreakdown[denom.value.toString()] || ""}
                                                    onChange={(e) =>
                                                        updateDenomination(denom.value, parseInt(e.target.value) || 0)
                                                    }
                                                    className="h-9"
                                                    placeholder="0"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Resultado del conteo */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                                <div className="bg-muted/50 rounded-lg p-3">
                                    <p className="text-sm text-muted-foreground">Efectivo esperado</p>
                                    <p className="text-lg font-bold">
                                        {formatCurrency(expectedCash)}
                                    </p>
                                </div>
                                <div className="bg-muted/50 rounded-lg p-3">
                                    <p className="text-sm text-muted-foreground">Efectivo contado</p>
                                    <p className="text-lg font-bold">{formatCurrency(countedCash)}</p>
                                </div>
                                <div
                                    className={`rounded-lg p-3 ${cashDifference === 0
                                        ? "bg-green-500/10"
                                        : cashDifference > 0
                                            ? "bg-blue-500/10"
                                            : "bg-red-500/10"
                                        }`}
                                >
                                    <p className="text-sm text-muted-foreground">Diferencia</p>
                                    <p
                                        className={`text-lg font-bold flex items-center gap-1 ${cashDifference === 0
                                            ? "text-green-600"
                                            : cashDifference > 0
                                                ? "text-blue-600"
                                                : "text-red-600"
                                            }`}
                                    >
                                        {cashDifference === 0 ? (
                                            <CheckCircle className="h-4 w-4" />
                                        ) : cashDifference > 0 ? (
                                            <TrendingUp className="h-4 w-4" />
                                        ) : (
                                            <TrendingDown className="h-4 w-4" />
                                        )}
                                        {formatCurrency(cashDifference)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Lista de transacciones (Mock Fiel) */}
                        <div className="border rounded-lg overflow-hidden">
                            <div className="p-3 bg-muted/50 border-b flex items-center justify-between">
                                <h3 className="font-semibold flex items-center gap-2">
                                    <FileText className="h-4 w-4" />
                                    Transacciones del turno ({totalTransactions})
                                </h3>
                                <Badge variant="outline" className="text-xs">
                                    Total: {formatCurrency(totalSales)}
                                </Badge>
                            </div>
                            <div className="max-h-[250px] overflow-y-auto">
                                <div className="divide-y">
                                    {mockPayments.map((payment, index) => (
                                        <div key={payment.id} className="p-3 hover:bg-muted/30 transition-colors">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-xs text-muted-foreground font-mono">
                                                            #{payment.id.padStart(2, '0')}
                                                        </span>
                                                        <span className="text-sm font-medium">
                                                            {payment.time}
                                                        </span>
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-2 text-xs">
                                                        <Badge variant={payment.method === "EFECTIVO" ? "default" : "secondary"}>
                                                            {payment.method === "EFECTIVO" ? "💵" : "💳"} {payment.method}
                                                        </Badge>
                                                        <span className="text-muted-foreground">{payment.concept}</span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-mono font-bold text-sm">
                                                        {formatCurrency(payment.amount)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
                    <Button onClick={handleConfirm} disabled={loading}>
                        {loading ? 'Cerrando...' : 'Confirmar Cierre y Arqueo'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
