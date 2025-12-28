"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { MultiPaymentInput, PaymentEntry, createInitialPayment } from "@/components/sales/multi-payment-input";
import { Input } from "@/components/ui/input";
import {
    Bed,
    Clock,
    Users,
    ShoppingBag,
    Package,
    MoreHorizontal,
    CheckCircle2,
    Loader2,
    Receipt,
    X,
    Percent,
    Tag
} from "lucide-react";

// Iconos por tipo de concepto
const CONCEPT_ICONS: Record<string, React.ReactNode> = {
    ROOM_BASE: <Bed className="h-4 w-4" />,
    EXTRA_HOUR: <Clock className="h-4 w-4" />,
    EXTRA_PERSON: <Users className="h-4 w-4" />,
    CONSUMPTION: <ShoppingBag className="h-4 w-4" />,
    PRODUCT: <Package className="h-4 w-4" />,
    OTHER: <MoreHorizontal className="h-4 w-4" />,
};

const CONCEPT_LABELS: Record<string, string> = {
    ROOM_BASE: "Habitación",
    EXTRA_HOUR: "Hora Extra",
    EXTRA_PERSON: "Persona Extra",
    CONSUMPTION: "Consumo",
    PRODUCT: "Producto",
    OTHER: "Otro",
};

const CONCEPT_COLORS: Record<string, string> = {
    ROOM_BASE: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    EXTRA_HOUR: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    EXTRA_PERSON: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    CONSUMPTION: "bg-green-500/20 text-green-400 border-green-500/30",
    PRODUCT: "bg-slate-500/20 text-slate-400 border-slate-500/30",
    OTHER: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

export interface MockOrderItem {
    id: string;
    product_id?: string;
    qty: number;
    unit_price: number;
    total: number;
    is_paid: boolean;
    concept_type: string;
    name: string;
}

interface MockGranularPaymentModalProps {
    isOpen: boolean;
    roomNumber?: string;
    items: MockOrderItem[];
    onClose: () => void;
    onConfirm: (paidItemIds: string[], payments: any[]) => Promise<void>;
}

export function MockGranularPaymentModal({
    isOpen,
    roomNumber,
    items,
    onClose,
    onConfirm,
}: MockGranularPaymentModalProps) {
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [processing, setProcessing] = useState(false);
    const [payments, setPayments] = useState<PaymentEntry[]>([]);
    const [step, setStep] = useState<"select" | "pay">("select");
    const [discounts, setDiscounts] = useState<Record<string, number>>({});
    const [showDiscountInput, setShowDiscountInput] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setSelectedItems(new Set());
            setDiscounts({});
            setShowDiscountInput(null);
            setStep("select");
        }
    }, [isOpen]);

    if (!isOpen) return null;

    // Calcular totales con descuentos
    const pendingItems = items.filter(item => !item.is_paid);
    const paidItems = items.filter(item => item.is_paid);

    const getItemTotal = (item: MockOrderItem) => {
        const discount = discounts[item.id] || 0;
        return Math.max(0, item.total - discount);
    };

    const selectedTotal = items
        .filter(item => selectedItems.has(item.id))
        .reduce((sum, item) => sum + getItemTotal(item), 0);
    const pendingTotal = pendingItems.reduce((sum, item) => sum + getItemTotal(item), 0);
    const totalDiscount = Object.values(discounts).reduce((sum, d) => sum + d, 0);

    const applyDiscount = (itemId: string, discountAmount: number) => {
        const item = items.find(i => i.id === itemId);
        if (!item) return;
        const maxDiscount = item.total;
        const validDiscount = Math.min(Math.max(0, discountAmount), maxDiscount);
        setDiscounts(prev => ({ ...prev, [itemId]: validDiscount }));
        setShowDiscountInput(null);
    };

    const removeDiscount = (itemId: string) => {
        setDiscounts(prev => {
            const newDiscounts = { ...prev };
            delete newDiscounts[itemId];
            return newDiscounts;
        });
    };

    const toggleItem = (itemId: string) => {
        const newSelected = new Set(selectedItems);
        if (newSelected.has(itemId)) {
            newSelected.delete(itemId);
        } else {
            newSelected.add(itemId);
        }
        setSelectedItems(newSelected);
    };

    const selectAllPending = () => {
        const allPendingIds = pendingItems.map(item => item.id);
        setSelectedItems(new Set(allPendingIds));
    };

    const deselectAll = () => {
        setSelectedItems(new Set());
    };

    const goToPayment = () => {
        if (selectedItems.size === 0) {
            toast.error("Selecciona al menos un concepto para pagar");
            return;
        }
        setPayments(createInitialPayment(selectedTotal));
        setStep("pay");
    };

    const processPayment = async () => {
        const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
        if (totalPaid < selectedTotal) {
            toast.error("El monto pagado es menor al total seleccionado");
            return;
        }

        setProcessing(true);
        try {
            await onConfirm(Array.from(selectedItems), payments);
            // onConfirm handles logic and updates state in parent
        } catch (error) {
            console.error("Error mock payment:", error);
        } finally {
            setProcessing(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("es-MX", {
            style: "currency",
            currency: "MXN",
        }).format(amount);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
                    <div>
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <Receipt className="h-5 w-5 text-primary" />
                            Cobro por Concepto (Simulado)
                        </h2>
                        {roomNumber && (
                            <p className="text-sm text-muted-foreground">Habitación {roomNumber}</p>
                        )}
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} disabled={processing}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {step === "select" ? (
                        <div className="p-6 space-y-4">
                            {/* Resumen */}
                            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border">
                                <div>
                                    <p className="text-sm text-muted-foreground">Total pendiente</p>
                                    <p className="text-xl font-bold text-amber-500">{formatCurrency(pendingTotal)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-muted-foreground">Seleccionado</p>
                                    <p className="text-xl font-bold text-primary">{formatCurrency(selectedTotal)}</p>
                                </div>
                            </div>

                            {/* Acciones rápidas */}
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={selectAllPending}>Seleccionar todo</Button>
                                <Button variant="outline" size="sm" onClick={deselectAll}>Deseleccionar</Button>
                            </div>

                            {/* Lista de conceptos pendientes */}
                            {pendingItems.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Conceptos Pendientes</h3>
                                        {totalDiscount > 0 && (
                                            <Badge variant="outline" className="text-xs bg-green-500/10 text-green-500 border-green-500/30">
                                                <Tag className="h-3 w-3 mr-1" /> -{formatCurrency(totalDiscount)}
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        {pendingItems.map((item) => {
                                            const itemDiscount = discounts[item.id] || 0;
                                            const finalTotal = getItemTotal(item);
                                            return (
                                                <div key={item.id} className={`p-3 border rounded-lg transition-all ${selectedItems.has(item.id) ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"}`}>
                                                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => toggleItem(item.id)}>
                                                        <Checkbox checked={selectedItems.has(item.id)} onCheckedChange={() => toggleItem(item.id)} />
                                                        <div className={`p-2 rounded-lg border ${CONCEPT_COLORS[item.concept_type || "PRODUCT"]}`}>
                                                            {CONCEPT_ICONS[item.concept_type || "PRODUCT"]}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-medium truncate">{item.name}</p>
                                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                                <Badge variant="outline" className={`text-xs border ${CONCEPT_COLORS[item.concept_type || "PRODUCT"]}`}>{CONCEPT_LABELS[item.concept_type || "PRODUCT"]}</Badge>
                                                                <span>×{item.qty}</span>
                                                                <span>@ {formatCurrency(item.unit_price)}</span>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            {itemDiscount > 0 ? (
                                                                <>
                                                                    <p className="text-sm line-through text-muted-foreground">{formatCurrency(item.total)}</p>
                                                                    <p className="font-bold text-green-500">{formatCurrency(finalTotal)}</p>
                                                                </>
                                                            ) : (
                                                                <p className="font-bold">{formatCurrency(item.total)}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {/* Descuentos UI simplificada for mock */}
                                                    <div className="mt-2 pt-2 border-t border-border/50 flex justify-end">
                                                        {showDiscountInput === item.id ? (
                                                            <div className="flex items-center gap-2">
                                                                <Input type="number" className="h-7 w-24 text-xs"
                                                                    placeholder="$$"
                                                                    autoFocus
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') applyDiscount(item.id, parseFloat((e.target as HTMLInputElement).value) || 0);
                                                                        if (e.key === 'Escape') setShowDiscountInput(null);
                                                                    }}
                                                                    onClick={e => e.stopPropagation()}
                                                                />
                                                            </div>
                                                        ) : (
                                                            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={(e) => { e.stopPropagation(); setShowDiscountInput(item.id); }}>
                                                                {itemDiscount > 0 ? `-${formatCurrency(itemDiscount)}` : "Descuento"}
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Lista de conceptos pagados */}
                            {paidItems.length > 0 && (
                                <div className="space-y-2 opacity-60">
                                    <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Ya Pagados</h3>
                                    {paidItems.map((item) => (
                                        <div key={item.id} className="flex items-center gap-3 p-3 border rounded-lg bg-green-500/10 border-green-500/30">
                                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                                            <div className="flex-1">
                                                <p className="font-medium text-green-400">{item.name}</p>
                                            </div>
                                            <p className="font-medium text-green-400">{formatCurrency(item.total)}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="p-6 space-y-4">
                            <div className="p-4 bg-muted/50 rounded-lg border border-border">
                                <p className="text-sm text-muted-foreground">Total a pagar</p>
                                <p className="text-2xl font-bold text-primary">{formatCurrency(selectedTotal)}</p>
                            </div>
                            <MultiPaymentInput totalAmount={selectedTotal} payments={payments} onPaymentsChange={setPayments} disabled={processing} />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-border flex justify-between gap-2 flex-shrink-0">
                    {step === "select" ? (
                        <>
                            <Button variant="outline" onClick={onClose} disabled={processing}>Cancelar</Button>
                            <Button onClick={goToPayment} disabled={selectedItems.size === 0 || processing}>Continuar al Pago ({formatCurrency(selectedTotal)})</Button>
                        </>
                    ) : (
                        <>
                            <Button variant="outline" onClick={() => setStep("select")} disabled={processing}>← Volver</Button>
                            <Button onClick={processPayment} disabled={processing || payments.reduce((s, p) => s + p.amount, 0) < selectedTotal}>
                                {processing ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Procesando...</> : "Confirmar Pago"}
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
