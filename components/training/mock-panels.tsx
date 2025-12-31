"use client";

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Package, AlertTriangle, ArrowRightLeft, Radio, Users, TrendingUp, DollarSign, Wallet, FileText, Calendar } from 'lucide-react';

// --- MOCK INVENTORY PANEL ---
export function MockInventoryPanel({ completed }: { completed: string[] }) {
    const hasTransfer = completed.includes('transfer');
    const hasAdjustment = completed.includes('adjustments');
    const hasPurchase = completed.includes('new-purchase');

    const products = [
        { id: '1', name: 'Coca Cola 600ml', stock: 15, min: 20, status: 'warning' },
        { id: '2', name: 'Sabritas Sal', stock: 45, min: 10, status: 'ok' },
        { id: '3', name: 'Agua Mineral', stock: hasTransfer ? 12 : 2, min: 10, status: hasTransfer ? 'ok' : 'critical' },
        { id: '4', name: 'Cerveza Corona', stock: hasPurchase ? 50 : 5, min: 24, status: hasPurchase ? 'ok' : 'critical' },
    ];

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="font-bold flex items-center gap-2">
                    <Package className="h-5 w-5 text-blue-500" />
                    Inventario Actual
                </h3>
                <div className="text-sm text-muted-foreground">Almacén: Principal</div>
            </div>
            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Producto</TableHead>
                            <TableHead className="text-right">Stock</TableHead>
                            <TableHead className="text-center">Estado</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {products.map(product => (
                            <TableRow key={product.id}>
                                <TableCell>{product.name}</TableCell>
                                <TableCell className="text-right font-mono">{product.stock}</TableCell>
                                <TableCell className="text-center">
                                    {product.status === 'warning' && <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Bajo</Badge>}
                                    {product.status === 'critical' && <Badge variant="destructive" className="animate-pulse">Crítico</Badge>}
                                    {product.status === 'ok' && <Badge className="bg-green-100 text-green-800">OK</Badge>}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            {hasAdjustment && (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-sm text-amber-800 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Ajuste registrado: -2 Sabritas Sal (Merma)</span>
                </div>
            )}
            {hasTransfer && (
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg text-sm text-blue-800 flex items-center gap-2">
                    <ArrowRightLeft className="h-4 w-4" />
                    <span>Traspaso recibido: +10 Agua Mineral</span>
                </div>
            )}
        </div>
    );
}

// --- MOCK SENSORS PANEL ---
export function MockSensorsPanel({ completed }: { completed: string[] }) {
    const discrepancySolved = completed.includes('discrepancies');

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
                <Card>
                    <CardContent className="p-4 flex flex-col items-center gap-2">
                        <div className="font-bold">Hab. 101</div>
                        <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center border-2 border-green-500">
                            <Radio className="h-6 w-6 text-green-600" />
                        </div>
                        <div className="text-xs font-semibold text-green-700">LIBRE / VACÍO</div>
                    </CardContent>
                </Card>
                <Card className={discrepancySolved ? "" : "border-red-500 shadow-red-100"}>
                    <CardContent className="p-4 flex flex-col items-center gap-2">
                        <div className="font-bold text-red-600">Hab. 104</div>
                        <div className={`h-12 w-12 rounded-full flex items-center justify-center border-2 ${discrepancySolved ? 'bg-green-100 border-green-500' : 'bg-red-100 border-red-500 animate-pulse'}`}>
                            <Radio className={`h-6 w-6 ${discrepancySolved ? 'text-green-600' : 'text-red-600'}`} />
                        </div>
                        <div className="text-xs font-semibold text-center">
                            {discrepancySolved ? (
                                <span className="text-green-700">VERIFICADO<br />(Limpieza)</span>
                            ) : (
                                <span className="text-red-700">ALERTA:<br />PRESENCIA SIN RENTA</span>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
            <div className="bg-slate-100 p-3 rounded text-xs text-muted-foreground">
                <p><strong>Leyenda:</strong></p>
                <ul className="list-disc ml-4 space-y-1 mt-1">
                    <li>Verde: Sensor coincide con estado del sistema.</li>
                    <li>Rojo: Sensor detecta presencia pero habitación está Libre.</li>
                </ul>
            </div>
        </div>
    );
}

// --- MOCK ADMIN PANEL ---
export function MockAdminPanel({ completed }: { completed: string[] }) {
    const hasNewCustomer = completed.includes('register-customer');

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-white rounded-lg shadow-sm border">
                    <div className="text-xs text-muted-foreground mb-1">Ocupación Hoy</div>
                    <div className="text-2xl font-bold flex items-end gap-2">
                        85%
                        <TrendingUp className="h-4 w-4 text-green-500 mb-1" />
                    </div>
                </div>
                <div className="p-4 bg-white rounded-lg shadow-sm border">
                    <div className="text-xs text-muted-foreground mb-1">Rentabilidad</div>
                    <div className="text-2xl font-bold text-blue-600">$12.5k</div>
                </div>
            </div>
            <div className="border rounded-lg overflow-hidden bg-card">
                <div className="bg-muted p-2 text-xs font-semibold flex justify-between items-center">
                    <span>Últimos Clientes Registrados</span>
                    <Users className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="divide-y relative">
                    {hasNewCustomer && (
                        <div className="p-3 bg-green-50 animate-in slide-in-from-left">
                            <div className="font-semibold text-sm">Juan Pérez (Nuevo)</div>
                            <div className="text-xs text-muted-foreground">RFC: PEJU800101 • VIP</div>
                        </div>
                    )}
                    <div className="p-3">
                        <div className="font-semibold text-sm">Empresa S.A. de C.V.</div>
                        <div className="text-xs text-muted-foreground">RFC: EMP101010 • Crédito</div>
                    </div>
                    <div className="p-3">
                        <div className="font-semibold text-sm">Maria González</div>
                        <div className="text-xs text-muted-foreground">RFC: GOMA900202 • Frecuente</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- MOCK SHIFT PANEL (Improved) ---
export function MockShiftPanel({ completed, mockExpense }: { completed: string[], mockExpense?: any }) {
    const isStarted = completed.includes('start-shift');
    const isClosed = completed.includes('close-shift');
    const hasExpense = completed.includes('expenses'); // Updated ID to match training-data 'expenses' vs 'register-expense'

    // Mock calculations
    const initialFund = isStarted ? 2000 : 0;
    const salesCash = isStarted ? 5450 : 0;
    const salesCard = isStarted ? 3200 : 0;
    const expenseAmount = (hasExpense || completed.includes('register-expense')) ? (mockExpense?.amount || 150) : 0;
    const totalCash = initialFund + salesCash - expenseAmount;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="font-bold flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-orange-500" />
                    Control de Turno
                </h3>
                <Badge variant={isClosed ? "destructive" : isStarted ? "default" : "secondary"}>
                    {isClosed ? "CERRADO" : isStarted ? "ABIERTO - Matutino" : "SIN INICIAR"}
                </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <Card>
                    <CardContent className="p-3">
                        <div className="text-xs text-muted-foreground">Fondo Inicial</div>
                        <div className="text-lg font-bold">${initialFund.toFixed(2)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-3">
                        <div className="text-xs text-muted-foreground">Ventas (Efec)</div>
                        <div className="text-lg font-bold text-green-600">+${salesCash.toFixed(2)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-3">
                        <div className="text-xs text-muted-foreground">Gastos/Vales</div>
                        <div className="text-lg font-bold text-red-600">-${expenseAmount.toFixed(2)}</div>
                    </CardContent>
                </Card>
                <Card className="bg-slate-50 border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                    <CardContent className="p-3">
                        <div className="text-xs text-muted-foreground">Total en Caja</div>
                        <div className="text-xl font-bold text-blue-600">${totalCash.toFixed(2)}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="border rounded-lg overflow-hidden bg-white dark:bg-slate-950">
                <div className="bg-muted p-2 text-xs font-semibold flex items-center gap-2">
                    <FileText className="h-3 w-3" /> Movimientos Recientes
                </div>
                <div className="divide-y text-sm max-h-40 overflow-y-auto">
                    {isClosed && (
                        <div className="p-2 flex justify-between bg-red-50 text-red-900">
                            <span>Cierre de Turno (Arqueo)</span>
                            <span className="font-mono">{new Date().toLocaleTimeString()}</span>
                        </div>
                    )}
                    {(hasExpense || completed.includes('register-expense')) && (
                        <div className="p-2 flex justify-between">
                            <span className="text-red-600">Gasto: {mockExpense?.description || 'Material de Limpieza'}</span>
                            <span className="font-mono text-red-600">-${expenseAmount.toFixed(2)}</span>
                        </div>
                    )}
                    {isStarted ? (
                        <>
                            <div className="p-2 flex justify-between">
                                <span>Cobro Hab. 105 (Efe)</span>
                                <span className="font-mono text-green-600">+$650.00</span>
                            </div>
                            <div className="p-2 flex justify-between">
                                <span>Apertura de Turno</span>
                                <span className="font-mono text-blue-600">Fondo: $2000</span>
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

// --- MOCK REPORT PANEL (Improved) ---
export function MockReportPanel({ completed }: { completed: string[] }) {
    const hasReport = completed.includes('income-report');

    if (!hasReport) return (
        <div className="h-full flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 text-muted-foreground bg-muted/20">
            <DollarSign className="h-12 w-12 mb-4 text-muted-foreground/50" />
            <div className="text-center font-medium">Genera el reporte para visualizar datos</div>
        </div>
    );

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="font-bold flex items-center gap-2">
                    <FileText className="h-5 w-5 text-purple-500" />
                    Reporte de Ingresos
                </h3>
                <div className="flex items-center gap-1 text-xs bg-slate-100 px-2 py-1 rounded">
                    <Calendar className="h-3 w-3" /> Hoy
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[100px]">Hora</TableHead>
                                <TableHead>Concepto</TableHead>
                                <TableHead>Método</TableHead>
                                <TableHead className="text-right">Monto</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                <TableCell className="font-mono text-xs">09:15 AM</TableCell>
                                <TableCell>Renta Hab 102</TableCell>
                                <TableCell><Badge variant="outline">EFECTIVO</Badge></TableCell>
                                <TableCell className="text-right font-bold text-green-600">$450.00</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-mono text-xs">10:30 AM</TableCell>
                                <TableCell>Consumo Hab 105</TableCell>
                                <TableCell><Badge variant="outline" className="text-blue-600 border-blue-200">TARJETA</Badge></TableCell>
                                <TableCell className="text-right font-bold">$120.00</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-mono text-xs">11:00 AM</TableCell>
                                <TableCell>Renta Hab 201</TableCell>
                                <TableCell><Badge variant="outline">EFECTIVO</Badge></TableCell>
                                <TableCell className="text-right font-bold text-green-600">$800.00</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <div className="flex justify-end gap-4 text-sm font-bold">
                <div className="flex flex-col items-end">
                    <span className="text-muted-foreground text-xs">Total Efectivo</span>
                    <span className="text-green-600">$1,250.00</span>
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-muted-foreground text-xs">Total Tarjeta</span>
                    <span className="text-blue-600">$120.00</span>
                </div>
                <div className="flex flex-col items-end border-l pl-4">
                    <span className="text-muted-foreground text-xs">GRAN TOTAL</span>
                    <span>$1,370.00</span>
                </div>
            </div>
        </div>
    );
}

// --- MOCK CONFIG PANEL (Simple, reusing generic structure but can be expanded) ---
export function MockConfigPanel({ completed }: { completed: string[] }) {
    // Keeping simple for now, but exporting it here to centralize
    return (
        <div className="border rounded-lg overflow-hidden bg-card">
            <div className="bg-muted p-2 text-xs font-semibold">Configuración del Sistema</div>
            <div className="divide-y">
                <div className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Users className="h-8 w-8 text-blue-500 bg-blue-100 p-1 rounded-full" />
                        <div className="text-sm">
                            <div className="font-medium">Usuarios y Permisos</div>
                            <div className="text-xs text-muted-foreground">3 Operadores activos</div>
                        </div>
                    </div>
                </div>
                <div className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Radio className="h-8 w-8 text-orange-500 bg-orange-100 p-1 rounded-full" />
                        <div className="text-sm">
                            <div className="font-medium">Impresoras</div>
                            <div className="text-xs text-muted-foreground">XP-80C (Red) - Online</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
