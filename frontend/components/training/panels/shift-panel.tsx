"use client";

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Package, AlertTriangle, ArrowRightLeft, Radio, Users, TrendingUp, DollarSign, Wallet, FileText, Calendar, Search, Filter, BarChart3, RefreshCw, Warehouse, Eye, TrendingDown, RotateCcw, Plus, Edit2 } from 'lucide-react';
import { toast } from 'sonner';

// --- MOCK SHIFT PANEL (Improved) ---
export function MockShiftPanel({ completed, mockExpense }: { completed: string[], mockExpense?: any }) {
    const isStarted = completed.includes('start-shift');
    const isClosed = completed.includes('close-shift');
    const hasExpense = completed.includes('expenses') || completed.includes('register-expense');

    // Mock calculations
    const initialFund = isStarted ? 2000 : 0;
    const salesCash = isStarted ? 5450 : 0;
    // const salesCard = isStarted ? 3200 : 0; // Unused
    const expenseAmount = hasExpense ? (mockExpense?.amount || 150) : 0;
    const totalCash = initialFund + salesCash - expenseAmount;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="font-bold flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-primary" />
                    Control de Turno
                </h3>
                <Badge variant={isClosed ? "destructive" : isStarted ? "default" : "secondary"}>
                    {isClosed ? "CERRADO" : isStarted ? "ABIERTO - Matutino" : "SIN INICIAR"}
                </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <Card className="bg-card">
                    <CardContent className="p-3">
                        <div className="text-xs text-muted-foreground">Fondo Inicial</div>
                        <div className="text-lg font-bold text-foreground">${initialFund.toFixed(2)}</div>
                    </CardContent>
                </Card>
                <Card className="bg-card">
                    <CardContent className="p-3">
                        <div className="text-xs text-muted-foreground">Ventas (Efec)</div>
                        <div className="text-lg font-bold text-green-500">+${salesCash.toFixed(2)}</div>
                    </CardContent>
                </Card>
                <Card className="bg-card">
                    <CardContent className="p-3">
                        <div className="text-xs text-muted-foreground">Gastos/Vales</div>
                        <div className="text-lg font-bold text-red-500">-${expenseAmount.toFixed(2)}</div>
                    </CardContent>
                </Card>
                <Card className="bg-secondary/30 border-secondary">
                    <CardContent className="p-3">
                        <div className="text-xs text-muted-foreground">Total en Caja</div>
                        <div className="text-xl font-bold text-blue-500">${totalCash.toFixed(2)}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="border rounded-lg overflow-hidden bg-card">
                <div className="bg-muted p-2 text-xs font-semibold flex items-center gap-2 text-foreground">
                    <FileText className="h-3 w-3" /> Movimientos Recientes
                </div>
                <div className="divide-y text-sm max-h-40 overflow-y-auto">
                    {isClosed && (
                        <div className="p-2 flex justify-between bg-red-500/10 text-red-500">
                            <span>Cierre de Turno (Arqueo)</span>
                            <span className="font-mono">{new Date().toLocaleTimeString()}</span>
                        </div>
                    )}
                    {hasExpense && (
                        <div className="p-2 flex justify-between">
                            <span className="text-red-500">Gasto: {mockExpense?.description || 'Material de Limpieza'}</span>
                            <span className="font-mono text-red-600">-${expenseAmount.toFixed(2)}</span>
                        </div>
                    )}
                    {isStarted ? (
                        <>
                            <div className="p-2 flex justify-between">
                                <span>Cobro Hab. 105 (Efe)</span>
                                <span className="font-mono text-green-500">+$650.00</span>
                            </div>
                            <div className="p-2 flex justify-between">
                                <span>Apertura de Turno</span>
                                <span className="font-mono text-blue-500">Fondo: $2000</span>
                            </div>
                        </>
                    ) : (
                        <div className="p-4 text-center text-muted-foreground text-xs italic">
                            Inicia turno para comenzar registros
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}