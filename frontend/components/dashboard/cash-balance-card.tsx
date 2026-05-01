"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/use-user-role";
import { useSystemConfigRead } from "@/hooks/use-system-config";
import { useShiftExpenses } from "@/hooks/use-shift-expenses";
import {
    Wallet,
    DollarSign,
    Plus,
    Minus,
    Users,
    Edit3,
} from "lucide-react";

// Formato de moneda
const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
};

interface ShiftSession {
    id: string;
    employee_id: string;
    clock_in_at: string;
    status: string;
}

export function CashBalanceCard() {
    const { employeeId, isAdmin, isManager } = useUserRole();
    const { success, error: showError } = useToast();
    const posConfig = useSystemConfigRead();

    const [activeSession, setActiveSession] = useState<ShiftSession | null>(null);
    const [cashAmount, setCashAmount] = useState(0);
    const [activeValetCount, setActiveValetCount] = useState(0);
    const [showCashAdjustModal, setShowCashAdjustModal] = useState(false);
    const [cashAdjustmentInput, setCashAdjustmentInput] = useState("");
    const [loading, setLoading] = useState(true);

    // Permiso para ajustar caja
    const canAdjustCash = isAdmin || isManager;

    // Hook para gastos
    const { totalExpenses, refetch: refetchExpenses } = useShiftExpenses(activeSession?.id || null);

    // Cargar datos
    useEffect(() => {
        const fetchData = async () => {
            const supabase = createClient();
            let foundSession: ShiftSession | null = null;
            let sessionUserId: string | null = null;

            // 1. Buscar sesión propia del empleado actual
            if (employeeId) {
                const { data: sessions } = await supabase
                    .from("shift_sessions")
                    .select("id, employee_id, clock_in_at, status")
                    .eq("employee_id", employeeId)
                    .eq("status", "active")
                    .order("clock_in_at", { ascending: false })
                    .limit(1);

                if (sessions?.[0]) {
                    foundSession = sessions[0];
                }
            }

            // 2. Si es admin/manager y no tiene sesión propia, buscar CUALQUIER sesión activa de recepcionista
            if (!foundSession && (isAdmin || isManager)) {
                const { data: anySessions } = await supabase
                    .from("shift_sessions")
                    .select("id, employee_id, clock_in_at, status, employees!inner(role, auth_user_id)")
                    .eq("status", "active")
                    .eq("employees.role", "receptionist")
                    .is("clock_out_at", null)
                    .order("clock_in_at", { ascending: false })
                    .limit(1);

                if (anySessions?.[0]) {
                    foundSession = {
                        id: anySessions[0].id,
                        employee_id: anySessions[0].employee_id,
                        clock_in_at: anySessions[0].clock_in_at,
                        status: anySessions[0].status
                    };
                    sessionUserId = (anySessions[0].employees as any)?.auth_user_id;
                }
            }

            if (foundSession) {
                setActiveSession(foundSession);

                // Obtener cobros en efectivo de esta sesión
                const { data: { user } } = await supabase.auth.getUser();
                const userIdForPayments = sessionUserId || user?.id;

                if (userIdForPayments) {
                    const sessionStart = foundSession.clock_in_at;
                    const { data: payments } = await supabase
                        .from("payments")
                        .select("amount, payment_method")
                        .eq("created_by", userIdForPayments)
                        .gte("created_at", sessionStart)
                        .eq("status", "PAGADO");

                    const cash = (payments || [])
                        .filter((p: any) => p.payment_method === "CASH" || p.payment_method === "EFECTIVO")
                        .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

                    setCashAmount(cash);
                }
            }

            // Contar cocheros activos
            const { count } = await supabase
                .from("shift_sessions")
                .select("*, employees!inner(*)", { count: "exact", head: true })
                .eq("status", "active")
                .eq("employees.role", "cochero")
                .is("clock_out_at", null);

            setActiveValetCount(count || 0);
            setLoading(false);
        };

        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [employeeId, isAdmin, isManager]);

    // No mostrar si no hay sesión activa
    if (loading || !activeSession) {
        return null;
    }

    const availableCash = posConfig.initialCashFund + cashAmount - totalExpenses - (activeValetCount * posConfig.valetAdvanceAmount);

    return (
        <>
            <Card className="border-emerald-500/30 bg-gradient-to-r from-emerald-500/5 to-teal-500/5">
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Wallet className="h-5 w-5 text-emerald-500" />
                            Efectivo en Caja
                        </CardTitle>
                        {canAdjustCash && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowCashAdjustModal(true)}
                                className="h-8 text-xs gap-1"
                            >
                                <Edit3 className="h-3.5 w-3.5" />
                                Ajustar
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {/* Fondo Inicial */}
                        <div className="p-3 rounded-lg bg-slate-500/10 border border-slate-500/20">
                            <div className="flex items-center gap-1.5 mb-1">
                                <Wallet className="h-3.5 w-3.5 text-slate-500" />
                                <span className="text-[10px] text-slate-500 uppercase font-medium">Fondo Inicial</span>
                            </div>
                            <p className="text-lg font-bold">{formatCurrency(posConfig.initialCashFund)}</p>
                        </div>

                        {/* Cobros */}
                        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                            <div className="flex items-center gap-1.5 mb-1">
                                <Plus className="h-3.5 w-3.5 text-green-500" />
                                <span className="text-[10px] text-green-500 uppercase font-medium">Cobros</span>
                            </div>
                            <p className="text-lg font-bold text-green-600">+{formatCurrency(cashAmount)}</p>
                        </div>

                        {/* Gastos */}
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                            <div className="flex items-center gap-1.5 mb-1">
                                <Minus className="h-3.5 w-3.5 text-red-500" />
                                <span className="text-[10px] text-red-500 uppercase font-medium">Gastos</span>
                            </div>
                            <p className="text-lg font-bold text-red-600">-{formatCurrency(totalExpenses)}</p>
                        </div>

                        {/* Adelantos Cocheros */}
                        <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                            <div className="flex items-center gap-1.5 mb-1">
                                <Users className="h-3.5 w-3.5 text-orange-500" />
                                <span className="text-[10px] text-orange-500 uppercase font-medium">Cocheros ({activeValetCount})</span>
                            </div>
                            <p className="text-lg font-bold text-orange-600">-{formatCurrency(activeValetCount * posConfig.valetAdvanceAmount)}</p>
                        </div>

                        {/* Total Disponible */}
                        <div className="p-3 rounded-lg bg-emerald-500/20 border-2 border-emerald-500/40">
                            <div className="flex items-center gap-1.5 mb-1">
                                <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                                <span className="text-[10px] text-emerald-600 uppercase font-medium">Disponible</span>
                            </div>
                            <p className="text-xl font-bold text-emerald-600">{formatCurrency(availableCash)}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Modal de Ajuste de Caja */}
            <Dialog open={showCashAdjustModal} onOpenChange={setShowCashAdjustModal}>
                <DialogContent className="w-[95vw] sm:w-full sm:max-w-sm">
                    <DialogHeader className="text-center pb-2">
                        <div className="mx-auto w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mb-3">
                            <Wallet className="h-6 w-6 text-white" />
                        </div>
                        <DialogTitle className="text-xl">Ajustar Efectivo en Caja</DialogTitle>
                        <DialogDescription>
                            Ingresa el monto a agregar o retirar del fondo
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-4">
                        <div className="text-center">
                            <p className="text-sm text-muted-foreground mb-1">Efectivo actual</p>
                            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(availableCash)}</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Monto a ajustar</label>
                            <div className="flex items-center gap-2">
                                <span className="text-lg font-medium text-muted-foreground">$</span>
                                <Input
                                    type="number"
                                    placeholder="0.00"
                                    value={cashAdjustmentInput}
                                    onChange={(e) => setCashAdjustmentInput(e.target.value)}
                                    className="text-lg text-center"
                                />
                            </div>
                            <p className="text-xs text-muted-foreground text-center">
                                Ingresa un número positivo para agregar o negativo para retirar
                            </p>
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowCashAdjustModal(false);
                                setCashAdjustmentInput("");
                            }}
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={async () => {
                                const amount = parseFloat(cashAdjustmentInput);
                                if (isNaN(amount) || amount === 0) {
                                    showError("Error", "Ingresa un monto válido");
                                    return;
                                }

                                const supabase = createClient();
                                const { error } = await supabase
                                    .from("shift_expenses")
                                    .insert({
                                        shift_session_id: activeSession?.id,
                                        employee_id: employeeId,
                                        expense_type: "CASH_ADJUSTMENT",
                                        description: amount > 0 ? "Ajuste: Ingreso de efectivo" : "Ajuste: Retiro de efectivo",
                                        amount: Math.abs(amount) * (amount > 0 ? -1 : 1),
                                        status: "approved"
                                    });

                                if (error) {
                                    showError("Error", "No se pudo registrar el ajuste");
                                    console.error(error);
                                    return;
                                }

                                success(
                                    amount > 0 ? "Efectivo agregado" : "Efectivo retirado",
                                    `Se ${amount > 0 ? "agregaron" : "retiraron"} ${formatCurrency(Math.abs(amount))}`
                                );

                                refetchExpenses();
                                setShowCashAdjustModal(false);
                                setCashAdjustmentInput("");
                            }}
                            disabled={!cashAdjustmentInput}
                        >
                            Aplicar Ajuste
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
