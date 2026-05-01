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

// --- MOCK REPORT PANEL (High Fidelity) ---
export function MockReportPanel({ completed }: { completed: string[] }) {
    const hasReport = completed.includes('income-report');

    if (!hasReport) return (
        <div className="h-full flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-12 text-muted-foreground bg-muted/20">
            <div className="bg-background p-4 rounded-full mb-4 shadow-sm">
                <FileText className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-medium mb-1">Reporte no generado</h3>
            <p className="text-sm text-center max-w-xs">
                Utiliza los filtros y presiona &quot;Generar Reporte&quot; para visualizar la data financiera.
            </p>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header / Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        Reporte de Ingresos
                    </h3>
                    <p className="text-xs text-muted-foreground">Desglose detallado de transacciones por turno</p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="flex items-center border rounded-md px-3 py-1.5 bg-background text-sm text-muted-foreground shadow-sm w-full sm:w-auto justify-between">
                        <span className="flex items-center gap-2"><Calendar className="h-4 w-4" /> Hoy</span>
                    </div>
                    <Button variant="outline" size="sm" className="hidden sm:flex" onClick={() => toast.success("PDF descargado")}>
                        Exportar PDF
                    </Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="bg-card">
                    <CardContent className="p-4">
                        <p className="text-xs font-medium text-muted-foreground">Total Efectivo</p>
                        <div className="text-2xl font-bold text-green-500 mt-1">$1,250.00</div>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <TrendingUp className="h-3 w-3 text-green-500" />
                            +12% vs ayer
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-card">
                    <CardContent className="p-4">
                        <p className="text-xs font-medium text-muted-foreground">Total Tarjeta</p>
                        <div className="text-2xl font-bold text-blue-500 mt-1">$120.00</div>
                        <p className="text-xs text-muted-foreground mt-1 text-center sm:text-left">
                            1 transacción
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-primary/5 border-primary/20">
                    <CardContent className="p-4">
                        <p className="text-xs font-medium text-primary">Ingreso Total</p>
                        <div className="text-2xl font-bold text-foreground mt-1">$1,370.00</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            3 operaciones
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Detailed Table */}
            <div className="border rounded-lg overflow-hidden bg-card shadow-sm">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="w-[100px]">Hora</TableHead>
                            <TableHead>Concepto</TableHead>
                            <TableHead>Método</TableHead>
                            <TableHead>Usuario</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow className="hover:bg-muted/50">
                            <TableCell className="font-mono text-xs text-muted-foreground">09:15 AM</TableCell>
                            <TableCell>
                                <span className="font-medium">Renta Hab 102</span>
                                <div className="text-xs text-muted-foreground">Hospedaje - 4 hrs</div>
                            </TableCell>
                            <TableCell><Badge variant="outline" className="font-normal">EFECTIVO</Badge></TableCell>
                            <TableCell className="text-xs text-muted-foreground">Recepción</TableCell>
                            <TableCell className="text-right font-bold text-green-500">$450.00</TableCell>
                        </TableRow>
                        <TableRow className="hover:bg-muted/50">
                            <TableCell className="font-mono text-xs text-muted-foreground">10:30 AM</TableCell>
                            <TableCell>
                                <span className="font-medium">Consumo Hab 105</span>
                                <div className="text-xs text-muted-foreground">2x Coca Cola, 1x Sabritas</div>
                            </TableCell>
                            <TableCell><Badge variant="secondary" className="font-normal bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200">TARJETA</Badge></TableCell>
                            <TableCell className="text-xs text-muted-foreground">Barra</TableCell>
                            <TableCell className="text-right font-bold">$120.00</TableCell>
                        </TableRow>
                        <TableRow className="hover:bg-muted/50">
                            <TableCell className="font-mono text-xs text-muted-foreground">11:00 AM</TableCell>
                            <TableCell>
                                <span className="font-medium">Renta Hab 201</span>
                                <div className="text-xs text-muted-foreground">Hospedaje - Noche</div>
                            </TableCell>
                            <TableCell><Badge variant="outline" className="font-normal">EFECTIVO</Badge></TableCell>
                            <TableCell className="text-xs text-muted-foreground">Recepción</TableCell>
                            <TableCell className="text-right font-bold text-green-500">$800.00</TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}