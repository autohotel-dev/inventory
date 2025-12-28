"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Receipt, Banknote, Package, DollarSign } from "lucide-react";

interface MockRoomDetailsModalProps {
    isOpen: boolean;
    roomNumber: string;
    roomType: string;
    status: string;
    checkInTime?: string;
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    onClose: () => void;
}

export function MockRoomDetailsModal({
    isOpen,
    roomNumber,
    roomType,
    status,
    checkInTime,
    totalAmount,
    paidAmount,
    remainingAmount,
    onClose,
}: MockRoomDetailsModalProps) {
    const [activeTab, setActiveTab] = useState<"payments" | "items">("payments");

    if (!isOpen) return null;

    // Datos simulados estáticos para visualización
    const mockPayments = [
        { id: '1', method: 'EFECTIVO', amount: paidAmount, date: checkInTime || new Date().toISOString(), concept: 'PAGO_INICIAL', status: 'PAGADO' }
    ];

    // Si no hay pagado, lista vacía
    const paymentsToShow = paidAmount > 0 ? mockPayments : [];

    const mockItems = [
        { id: '1', product: 'Habitación (Renta)', qty: 1, price: 250, total: 250 },
        { id: '2', product: 'Persona Extra', qty: 1, price: 50, total: 50 },
        { id: '3', product: 'Cerveza Modelo', qty: 2, price: 45, total: 90 },
    ];

    // Filtrar items para que coincidan aprox con el total (lógica dummy)
    // Simplemente mostraremos la lista completa como ejemplo de "lo que verías"

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col animate-in zoom-in-95 fade-in duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-sky-500/20 border border-sky-500/30 flex items-center justify-center">
                            <Receipt className="h-6 w-6 text-sky-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-white">Detalles de Venta (Simulado)</h2>
                            <p className="text-sm text-slate-400">
                                Hab. {roomNumber} – {roomType}
                            </p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-400 hover:text-white">
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Resumen */}
                <div className="px-6 py-3 border-b border-slate-700 bg-slate-800/50 flex-shrink-0">
                    <div className="grid grid-cols-4 gap-4 text-center">
                        <div>
                            <p className="text-xs text-slate-500">Total</p>
                            <p className="text-lg font-bold text-white">${totalAmount.toFixed(2)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500">Pagado</p>
                            <p className="text-lg font-bold text-emerald-400">${paidAmount.toFixed(2)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500">Pendiente</p>
                            <p className={`text-lg font-bold ${remainingAmount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                ${remainingAmount.toFixed(2)}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500">Estado</p>
                            <Badge variant="outline" className="mt-1 border-blue-500 text-blue-400">
                                {status}
                            </Badge>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="px-6 py-2 border-b border-slate-700 flex gap-2 flex-shrink-0">
                    <Button
                        variant={activeTab === "payments" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setActiveTab("payments")}
                        className={activeTab === "payments" ? "bg-sky-600" : "text-slate-400"}
                    >
                        <DollarSign className="h-4 w-4 mr-1" />
                        Pagos ({paymentsToShow.length})
                    </Button>
                    <Button
                        variant={activeTab === "items" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setActiveTab("items")}
                        className={activeTab === "items" ? "bg-sky-600" : "text-slate-400"}
                    >
                        <Package className="h-4 w-4 mr-1" />
                        Desglose (Ejemplo)
                    </Button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === "payments" ? (
                        <div className="space-y-2">
                            {paymentsToShow.length === 0 ? (
                                <div className="text-center py-8 text-slate-500">Sin pagos registrados</div>
                            ) : (
                                paymentsToShow.map((p) => (
                                    <div key={p.id} className="border border-slate-700 rounded-lg p-3 bg-slate-800/30 flex justify-between items-center">
                                        <div>
                                            <span className="text-emerald-400 font-bold">${p.amount.toFixed(2)}</span>
                                            <span className="text-xs text-slate-400 ml-2">{p.method}</span>
                                        </div>
                                        <Badge variant="outline" className="text-[10px] border-emerald-500 text-emerald-400">PAGADO</Badge>
                                    </div>
                                ))
                            )}
                        </div>
                    ) : (
                        /* Mock Items Table */
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 border-b border-slate-700">
                                <tr><th className="pb-2">Producto</th><th className="pb-2 text-right">Total</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {mockItems.map(item => (
                                    <tr key={item.id}>
                                        <td className="py-2 text-white">{item.product} x{item.qty}</td>
                                        <td className="py-2 text-right text-white">${item.total.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-slate-700 flex justify-end">
                    <Button variant="outline" onClick={onClose}>Cerrar</Button>
                </div>
            </div>
        </div>
    );
}
