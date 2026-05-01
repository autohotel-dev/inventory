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

// --- MOCK INVENTORY PANEL (High Fidelity - Production Match) ---
// --- MOCK INVENTORY PANEL (High Fidelity - Production Match) ---
export function MockInventoryPanel({ completed, onComplete }: { completed: string[], onComplete?: (stepId: string) => void }) {
    const hasTransfer = completed.includes('transfer');
    const hasAdjustment = completed.includes('adjustments');
    const hasPurchase = completed.includes('new-purchase');

    // State for Tabs and Modal
    const [activeTab, setActiveTab] = useState("stock");
    const [selectedProduct, setSelectedProduct] = useState<any | null>(null);

    // Mock Data based on production columns
    const products = [
        {
            id: '1', sku: 'BEB-001', name: 'Coca Cola 600ml', category: 'Bebidas',
            unit: 'pza', price: 25.00, cost: 18.00, min_stock: 20,
            stock: 15, status: 'warning',
            warehouses: [{ code: 'BAR', name: 'Bar Principal', qty: 15 }]
        },
        {
            id: '2', sku: 'SNK-002', name: 'Sabritas Sal', category: 'Snacks',
            unit: 'g', price: 18.00, cost: 12.00, min_stock: 10,
            stock: 45, status: 'ok',
            warehouses: [{ code: 'REC', name: 'Recepción', qty: 45 }]
        },
        {
            id: '3', sku: 'BEB-003', name: 'Agua Mineral', category: 'Bebidas',
            unit: 'ml', price: 15.00, cost: 8.00, min_stock: 10,
            stock: hasTransfer ? 12 : 2, status: hasTransfer ? 'ok' : 'critical',
            warehouses: hasTransfer
                ? [{ code: 'BAR', name: 'Bar Principal', qty: 10 }, { code: 'BOD', name: 'Bodega', qty: 2 }]
                : [{ code: 'BOD', name: 'Bodega', qty: 2 }]
        },
        {
            id: '4', sku: 'ALC-004', name: 'Cerveza Corona', category: 'Alcohol',
            unit: 'botella', price: 45.00, cost: 38.00, min_stock: 24,
            stock: hasPurchase ? 50 : 5, status: hasPurchase ? 'ok' : 'critical',
            warehouses: hasPurchase
                ? [{ code: 'GEN', name: 'Almacén General', qty: 50 }]
                : [{ code: 'GEN', name: 'Almacén General', qty: 5 }]
        },
    ];

    // Stats calculations
    const totalProducts = products.length;
    const criticalStock = products.filter(p => p.status === 'critical').length;
    const lowStock = products.filter(p => p.status === 'warning').length;
    const totalValue = products.reduce((sum, p) => sum + (p.stock * p.price), 0);

    return (
        <div className="space-y-6">
            {/* Notifications (Mock Triggers - Kept subtle) */}
            {(hasPurchase || hasAdjustment || hasTransfer) && (
                <div className="grid gap-2 mb-4">
                    {hasPurchase && (
                        <div className="bg-green-500/10 border border-green-500/20 p-2 rounded text-xs text-green-700 flex items-center gap-2">
                            <Package className="h-3 w-3" /> Compra registrada: +45 Cerveza Corona
                        </div>
                    )}
                    {hasAdjustment && (
                        <div className="bg-amber-500/10 border border-amber-500/20 p-2 rounded text-xs text-amber-700 flex items-center gap-2">
                            <AlertTriangle className="h-3 w-3" /> Ajuste: -2 Sabritas Sal
                        </div>
                    )}
                    {hasTransfer && (
                        <div className="bg-blue-500/10 border border-blue-500/20 p-2 rounded text-xs text-blue-700 flex items-center gap-2">
                            <ArrowRightLeft className="h-3 w-3" /> Traspaso: +10 Agua Mineral
                        </div>
                    )}
                </div>
            )}

            {/* Tabs Header */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="stock">📦 Existencias</TabsTrigger>
                    <TabsTrigger value="movements">🔄 Movimientos</TabsTrigger>
                </TabsList>

                <TabsContent value="stock" className="space-y-6">
                    {/* Stats Cards (Stock) */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <div className="text-sm font-medium">Total Productos</div>
                                    <Package className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div className="text-2xl font-bold">{totalProducts}</div>
                                <p className="text-xs text-muted-foreground">Con stock registrado</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <div className="text-sm font-medium">Stock Crítico</div>
                                    <AlertTriangle className="h-4 w-4 text-red-500" />
                                </div>
                                <div className="text-2xl font-bold text-red-600">{criticalStock}</div>
                                <p className="text-xs text-muted-foreground">Sin stock disponible</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <div className="text-sm font-medium">Stock Bajo</div>
                                    <TrendingDown className="h-4 w-4 text-orange-500" />
                                </div>
                                <div className="text-2xl font-bold text-orange-600">{lowStock}</div>
                                <p className="text-xs text-muted-foreground">Por debajo del mínimo</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <div className="text-sm font-medium">Valor Total</div>
                                    <BarChart3 className="h-4 w-4 text-green-500" />
                                </div>
                                <div className="text-2xl font-bold text-green-600">${totalValue.toFixed(2)}</div>
                                <p className="text-xs text-muted-foreground">Valor del inventario</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Controls & Filters */}
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                            <div className="relative flex-1 max-w-sm">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                                <Input placeholder="Buscar productos..." className="pl-10" />
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => toast.success("Stock actualizado")}>
                                    <RefreshCw className="h-4 w-4 mr-2" /> Actualizar
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
                            <div>
                                <label className="block text-sm font-medium mb-2">Estado de Stock</label>
                                <select className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm">
                                    <option value="">Todos los estados</option>
                                    <option value="critical">🔴 Crítico</option>
                                    <option value="low">🟡 Bajo</option>
                                    <option value="normal">🟢 Normal</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Almacén</label>
                                <select className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm">
                                    <option value="">Todos los almacenes</option>
                                    <option value="GEN">Almacén General</option>
                                    <option value="BAR">Bar Principal</option>
                                </select>
                            </div>
                            <div className="flex items-end">
                                <Button variant="outline" className="w-full">
                                    <Filter className="h-4 w-4 mr-2" /> Limpiar Filtros
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Product Table */}
                    <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="p-4">Producto</TableHead>
                                    <TableHead className="text-center p-4">Stock Actual</TableHead>
                                    <TableHead className="text-center p-4">Estado</TableHead>
                                    <TableHead className="text-right p-4">Valor</TableHead>
                                    <TableHead className="text-center p-4">Almacenes</TableHead>
                                    <TableHead className="text-center p-4">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {products.map(product => (
                                    <TableRow key={product.id} className="hover:bg-muted/50 border-t">
                                        <TableCell className="p-4">
                                            <div className="font-medium">{product.name}</div>
                                            <div className="text-sm text-muted-foreground">
                                                SKU: {product.sku} • {product.category}
                                            </div>
                                        </TableCell>
                                        <TableCell className="p-4 text-center">
                                            <div className="font-medium text-lg">{product.stock} {product.unit}</div>
                                            <div className="text-xs text-muted-foreground">Mín: {product.min_stock} {product.unit}</div>
                                        </TableCell>
                                        <TableCell className="p-4 text-center">
                                            {product.status === 'warning' && <Badge variant="secondary" className="bg-yellow-500/15 text-yellow-700 border-yellow-200">🟡 Bajo</Badge>}
                                            {product.status === 'critical' && <Badge variant="destructive">🔴 Crítico</Badge>}
                                            {product.status === 'ok' && <Badge variant="outline" className="bg-green-500/15 text-green-700 border-green-200">🟢 Normal</Badge>}
                                        </TableCell>
                                        <TableCell className="p-4 text-right">
                                            <div className="font-medium">${(product.stock * product.price).toFixed(2)}</div>
                                            <div className="text-xs text-muted-foreground">${product.price.toFixed(2)} c/u</div>
                                        </TableCell>
                                        <TableCell className="p-4 text-center">
                                            <div className="text-sm">{product.warehouses.length} ubicaciones</div>
                                            <div className="text-xs text-muted-foreground">
                                                {product.warehouses.map(w => w.code).join(', ')}
                                            </div>
                                        </TableCell>
                                        <TableCell className="p-4 text-center">
                                            <Button variant="outline" size="sm" onClick={() => setSelectedProduct(product)}>
                                                <Eye className="h-4 w-4 mr-1" /> Ver Detalle
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>

                <TabsContent value="movements">
                    <MockMovementsView
                        hasTransfer={hasTransfer}
                        hasPurchase={hasPurchase}
                        hasAdjustment={hasAdjustment}
                        onComplete={onComplete}
                    />
                </TabsContent>
            </Tabs>

            {/* Kardex Modal */}
            <Dialog open={!!selectedProduct} onOpenChange={(open) => !open && setSelectedProduct(null)}>
                <DialogContent className="w-[95vw] sm:w-full sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Kardex de Producto - {selectedProduct?.name}</DialogTitle>
                    </DialogHeader>
                    {selectedProduct && <MockKardexView product={selectedProduct} hasTransfer={hasTransfer} hasPurchase={hasPurchase} hasAdjustment={hasAdjustment} />}
                </DialogContent>
            </Dialog>
        </div>
    );
}

function MockMovementsView({ hasTransfer, hasPurchase, hasAdjustment, onComplete }: { hasTransfer: boolean, hasPurchase: boolean, hasAdjustment: boolean, onComplete?: (stepId: string) => void }) {
    const [isNewMovementOpen, setIsNewMovementOpen] = useState(false);

    // Generate mock movements
    const movements: any[] = [];
    if (hasPurchase) movements.push({ id: '2', product: 'Ale', warehouse: 'General', type: 'IN', qty: 45, reason: 'Compra #1234', date: 'Hoy' });
    if (hasAdjustment) movements.push({ id: '3', product: 'Sabritas', warehouse: 'Recepcion', type: 'ADJUSTMENT', qty: -2, reason: 'Merma', date: 'Hoy' });
    if (hasTransfer) movements.push({ id: '4', product: 'Agua', warehouse: 'Bar', type: 'IN', qty: 10, reason: 'Traspaso Bodega', date: 'Hoy' });
    movements.push({ id: '1', product: 'Coca Cola', warehouse: 'Bar', type: 'OUT', qty: 5, reason: 'Venta', date: 'Ayer' });

    const total = movements.length;
    const ins = movements.filter(m => m.type === 'IN').length;
    const outs = movements.filter(m => m.type === 'OUT').length;
    const adjs = movements.filter(m => m.type === 'ADJUSTMENT').length;

    return (
        <div className="space-y-6">
            {/* Stats Header */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-card p-4 rounded-lg border flex items-center gap-3">
                    <Package className="h-8 w-8 text-blue-100 bg-blue-600 p-1.5 rounded" />
                    <div><div className="text-xl font-bold">{total}</div><div className="text-xs text-muted-foreground">Total Movs</div></div>
                </div>
                <div className="bg-card p-4 rounded-lg border flex items-center gap-3">
                    <TrendingUp className="h-8 w-8 text-green-100 bg-green-600 p-1.5 rounded" />
                    <div><div className="text-xl font-bold">{ins}</div><div className="text-xs text-muted-foreground">Entradas</div></div>
                </div>
                <div className="bg-card p-4 rounded-lg border flex items-center gap-3">
                    <TrendingDown className="h-8 w-8 text-red-100 bg-red-600 p-1.5 rounded" />
                    <div><div className="text-xl font-bold">{outs}</div><div className="text-xs text-muted-foreground">Salidas</div></div>
                </div>
                <div className="bg-card p-4 rounded-lg border flex items-center gap-3">
                    <RotateCcw className="h-8 w-8 text-orange-100 bg-orange-600 p-1.5 rounded" />
                    <div><div className="text-xl font-bold">{adjs}</div><div className="text-xs text-muted-foreground">Ajustes</div></div>
                </div>
            </div>

            {/* Controls */}
            <div className="flex justify-between items-center">
                <div className="relative max-w-sm w-full">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar movimientos..." className="pl-9" />
                </div>
                <Button onClick={() => setIsNewMovementOpen(true)} id="tutorial-btn-new-movement">
                    <Plus className="h-4 w-4 mr-2" /> Nuevo Movimiento
                </Button>
            </div>

            {/* Table */}
            <div className="border rounded-lg bg-card overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Producto</TableHead>
                            <TableHead>Almacén</TableHead>
                            <TableHead className="text-center">Tipo</TableHead>
                            <TableHead className="text-right">Cantidad</TableHead>
                            <TableHead>Razón</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {movements.map(m => (
                            <TableRow key={m.id}>
                                <TableCell>{m.date}</TableCell>
                                <TableCell className="font-medium">{m.product}</TableCell>
                                <TableCell>{m.warehouse}</TableCell>
                                <TableCell className="text-center">
                                    {m.type === 'IN' && <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Entrada</Badge>}
                                    {m.type === 'OUT' && <Badge variant="destructive">Salida</Badge>}
                                    {m.type === 'ADJUSTMENT' && <Badge variant="secondary" className="bg-orange-100 text-orange-800 hover:bg-orange-200">Ajuste</Badge>}
                                </TableCell>
                                <TableCell className={`text-right font-bold ${m.type === 'IN' ? 'text-green-600' : m.type === 'OUT' ? 'text-red-600' : 'text-orange-600'}`}>
                                    {m.type === 'OUT' ? '-' : '+'}{m.qty}
                                </TableCell>
                                <TableCell className="text-muted-foreground">{m.reason}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Mock Movement Modal */}
            <Dialog open={isNewMovementOpen} onOpenChange={setIsNewMovementOpen}>
                <DialogContent className="w-[95vw] sm:w-full sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Registrar Nuevo Movimiento</DialogTitle>
                    </DialogHeader>
                    <MockMovementForm
                        onClose={() => setIsNewMovementOpen(false)}
                        onComplete={(type) => {
                            if (onComplete) onComplete(type);
                            setIsNewMovementOpen(false);
                            toast.success(`Movimiento de ${type} registrado con éxito`);
                        }}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}

function MockMovementForm({ onClose, onComplete }: { onClose: () => void, onComplete: (type: string) => void }) {
    const [type, setType] = useState('transfer');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Determine which step ID to complete based on type
        // transfer -> 'transfer'
        // adjustment -> 'adjustments'
        // purchase -> 'new-purchase' (although typical purchase is done via button, user mentioned movement)

        let stepId = 'transfer';
        if (type === 'adjustment') stepId = 'adjustments';
        if (type === 'purchase') stepId = 'new-purchase';

        onComplete(stepId);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <label className="text-sm font-medium">Tipo de Movimiento</label>
                <select
                    className="w-full flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                >
                    <option value="transfer">🔀 Traspaso entre Almacenes</option>
                    <option value="adjustment">🔄 Ajuste de Inventario</option>
                    <option value="purchase">📥 Compra / Entrada</option>
                </select>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium">Almacén Origen</label>
                <select className="w-full flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                    <option>Almacén General</option>
                    <option>Bar Principal</option>
                    <option>Recepción</option>
                </select>
            </div>

            {type === 'transfer' && (
                <div className="space-y-2">
                    <label className="text-sm font-medium">Almacén Destino</label>
                    <select className="w-full flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                        <option>Bar Principal</option>
                        <option>Almacén General</option>
                        <option>Recepción</option>
                    </select>
                </div>
            )}

            <div className="space-y-2">
                <label className="text-sm font-medium">Producto</label>
                <select className="w-full flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                    <option>Coca Cola 600ml</option>
                    <option>Sabritas Sal</option>
                    <option>Agua Mineral</option>
                    <option>Cerveza Corona</option>
                </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium">Cantidad</label>
                    <Input type="number" placeholder="0" required min="1" />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">Costo Unitario</label>
                    <Input type="number" placeholder="0.00" disabled value="25.00" />
                </div>
            </div>

            <div className="pt-4 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                <Button type="submit">Registrar Movimiento</Button>
            </div>
        </form>
    );
}

function MockKardexView({ product, hasTransfer, hasPurchase, hasAdjustment }: { product: any, hasTransfer: boolean, hasPurchase: boolean, hasAdjustment: boolean }) {
    // Generate mock movements based on product and completed exercises
    const movements = [
        { id: '1', type: 'IN', qty: 20, reason: 'Inventario Inicial', date: '01/01/2026', balance: 20 },
    ];

    if (hasPurchase && product.name.includes('Corona')) {
        movements.push({ id: '2', type: 'IN', qty: 45, reason: 'Compra #1234', date: 'Hoy', balance: 50 });
    }
    if (hasAdjustment && product.name.includes('Sabritas')) {
        movements.push({ id: '3', type: 'ADJUSTMENT', qty: -2, reason: 'Merma Caducidad', date: 'Hoy', balance: 45 });
    }
    if (hasTransfer && product.name.includes('Agua')) {
        movements.push({ id: '4', type: 'IN', qty: 10, reason: 'Traspaso Bodega', date: 'Hoy', balance: 12 });
    }
    // Simulate sales
    if (!product.name.includes('Agua') || (product.name.includes('Agua') && !hasTransfer)) {
        movements.push({ id: '5', type: 'OUT', qty: 5, reason: 'Venta Mostrador', date: 'Ayer', balance: product.stock });
    }

    const inMovements = movements.filter(m => m.type === 'IN').length;
    const outMovements = movements.filter(m => m.type === 'OUT').length;
    const adjustments = movements.filter(m => m.type === 'ADJUSTMENT').length;

    return (
        <div className="space-y-6">
            {/* Kardex Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Movimientos</CardTitle>
                        <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{movements.length}</div>
                        <p className="text-xs text-muted-foreground">Historial completo</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Entradas</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{inMovements}</div>
                        <p className="text-xs text-muted-foreground">Incrementos</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Salidas</CardTitle>
                        <TrendingDown className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{outMovements}</div>
                        <p className="text-xs text-muted-foreground">Decrementos</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ajustes</CardTitle>
                        <RotateCcw className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">{adjustments}</div>
                        <p className="text-xs text-muted-foreground">Correcciones</p>
                    </CardContent>
                </Card>
            </div>

            {/* Kardex Table */}
            <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead className="text-center">Tipo</TableHead>
                            <TableHead className="text-right">Cantidad</TableHead>
                            <TableHead className="text-right">Balance</TableHead>
                            <TableHead>Razón</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {movements.map(m => (
                            <TableRow key={m.id}>
                                <TableCell>{m.date}</TableCell>
                                <TableCell className="text-center">
                                    {m.type === 'IN' && <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/25 border-green-200">Entrada</Badge>}
                                    {m.type === 'OUT' && <Badge variant="destructive">Salida</Badge>}
                                    {m.type === 'ADJUSTMENT' && <Badge variant="secondary" className="bg-orange-500/15 text-orange-700 border-orange-200">Ajuste</Badge>}
                                </TableCell>
                                <TableCell className={`text-right font-medium ${m.type === 'IN' ? 'text-green-600' : m.type === 'OUT' ? 'text-red-600' : 'text-orange-600'}`}>
                                    {m.type === 'OUT' || (m.type === 'ADJUSTMENT' && m.qty < 0) ? '' : '+'}{m.qty}
                                </TableCell>
                                <TableCell className="text-right font-bold">{m.balance}</TableCell>
                                <TableCell className="text-muted-foreground">{m.reason}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}