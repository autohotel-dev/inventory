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
                <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
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
                <DialogContent className="sm:max-w-lg">
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

// --- MOCK SENSORS PANEL (High Fidelity) ---
// --- MOCK SENSORS PANEL (High Fidelity) ---
export function MockSensorsPanel({ completed, onComplete }: { completed: string[], onComplete?: (stepId: string) => void }) {
    const discrepancySolved = completed.includes('discrepancies');
    const checkedStates = completed.includes('sensor-states');

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
                <Card className={`bg-card ${checkedStates ? "border-green-500/50" : ""}`}>
                    <CardContent className="p-4 flex flex-col items-center gap-2">
                        <div className="font-bold">Hab. 101</div>
                        <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center border-2 border-green-500">
                            <Radio className="h-6 w-6 text-green-500" />
                        </div>
                        <div className="text-xs font-semibold text-green-500">LIBRE / VACÍO</div>

                        {!checkedStates && (
                            <Button
                                size="sm"
                                variant="secondary"
                                className="w-full text-xs mt-2 h-7"
                                onClick={() => {
                                    if (onComplete) onComplete('sensor-states');
                                    toast.success("Has verificado los estados del sensor");
                                }}
                            >
                                Monitor Detallado
                            </Button>
                        )}
                        {checkedStates && <div className="text-[10px] text-green-600 font-medium mt-2">✔️ Monitoreado</div>}
                    </CardContent>
                </Card>
                <Card className={`bg-card ${discrepancySolved ? "" : "border-red-500 shadow-sm"}`}>
                    <CardContent className="p-4 flex flex-col items-center gap-2">
                        <div className="font-bold text-foreground">Hab. 104</div>
                        <div className={`h-12 w-12 rounded-full flex items-center justify-center border-2 ${discrepancySolved ? 'bg-green-500/10 border-green-500' : 'bg-red-500/10 border-red-500 animate-pulse'}`}>
                            <Radio className={`h-6 w-6 ${discrepancySolved ? 'text-green-500' : 'text-red-500'}`} />
                        </div>
                        <div className="text-xs font-semibold text-center mt-1">
                            {discrepancySolved ? (
                                <span className="text-green-500">VERIFICADO<br />(Limpieza)</span>
                            ) : (
                                <span className="text-red-500">ALERTA:<br />PRESENCIA SIN RENTA</span>
                            )}
                        </div>

                        {!discrepancySolved && (
                            <Button
                                size="sm"
                                variant="destructive"
                                className="w-full text-xs mt-2 h-7"
                                id="tutorial-btn-verify-alert"
                                onClick={() => {
                                    if (onComplete) onComplete('discrepancies');
                                    toast.success("Discrepancia resuelta: Era personal de limpieza");
                                }}
                            >
                                Verificar Alerta
                            </Button>
                        )}
                    </CardContent>
                </Card>
            </div>
            <div className="bg-muted p-3 rounded text-xs text-muted-foreground border">
                <p><strong className="text-foreground">Leyenda:</strong></p>
                <ul className="list-disc ml-4 space-y-1 mt-1">
                    <li><span className="text-green-500 font-medium">Verde:</span> Sensor coincide con estado del sistema.</li>
                    <li><span className="text-red-500 font-medium">Rojo:</span> Sensor detecta presencia pero habitación está Libre.</li>
                </ul>
            </div>
        </div>
    );
}

// --- MOCK ADMIN PANEL ---
export function MockAdminPanel({ completed, onComplete }: { completed: string[], onComplete?: (stepId: string) => void }) {
    const hasNewCustomer = completed.includes('register-customer');
    const hasBillingData = completed.includes('billing-data');
    const [activeTab, setActiveTab] = useState("customers");
    const [isNewCustomerOpen, setIsNewCustomerOpen] = useState(false);

    // Mock Customers Data
    const customers = [
        { id: '1', name: 'Empresa S.A. de C.V.', email: 'facturacion@empresa.com', phone: '555-0101', type: 'CORPORATE', rfc: 'EMP101010ABC', classification: 'VIP' },
        { id: '2', name: 'Maria González', email: 'maria.gonzalez@email.com', phone: '555-0202', type: 'INDIVIDUAL', rfc: 'GOMA900202XYZ', classification: 'REGULAR' },
        { id: '3', name: 'Pedro Sánchez', email: 'pedro@email.com', phone: '555-0303', type: 'INDIVIDUAL', rfc: null, classification: 'NEW' },
    ];

    if (hasNewCustomer) {
        customers.unshift({
            id: '99',
            name: 'Juan Pérez',
            email: 'juan.perez@email.com',
            phone: '555-9090',
            type: 'INDIVIDUAL',
            rfc: hasBillingData ? 'PEJU800101HGR' : null,
            classification: 'NEW'
        });
    }

    return (
        <div className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="dashboard">📊 Dashboard Gerencial</TabsTrigger>
                    <TabsTrigger value="customers">👥 Directorio de Clientes</TabsTrigger>
                </TabsList>

                <TabsContent value="dashboard" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-card rounded-lg shadow-sm border">
                            <div className="text-xs text-muted-foreground mb-1">Ocupación Hoy</div>
                            <div className="text-2xl font-bold flex items-end gap-2 text-foreground">
                                85%
                                <TrendingUp className="h-4 w-4 text-green-500 mb-1" />
                            </div>
                        </div>
                        <div className="p-4 bg-card rounded-lg shadow-sm border">
                            <div className="text-xs text-muted-foreground mb-1">Rentabilidad</div>
                            <div className="text-2xl font-bold text-blue-500">$12.5k</div>
                        </div>
                    </div>

                    {/* Sales Analysis Section */}
                    <div className={`p-4 border rounded-lg bg-card ${completed.includes('sales-analysis') ? 'border-green-500/50' : ''}`}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                                Tendencias de Venta (Semanal)
                            </h3>
                            {!completed.includes('sales-analysis') && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    id="tutorial-btn-analyze-sales"
                                    onClick={() => {
                                        if (onComplete) onComplete('sales-analysis');
                                        toast.success("Análisis de tendencias completado");
                                    }}
                                >
                                    Analizar Tendencia
                                </Button>
                            )}
                            {completed.includes('sales-analysis') && <Badge variant="outline" className="text-green-600 border-green-200">Analizado</Badge>}
                        </div>
                        {/* Mock Bar Chart */}
                        <div className="h-32 flex items-end justify-between gap-2 px-2">
                            {[40, 65, 45, 80, 55, 90, 75].map((h, i) => (
                                <div key={i} className="w-full bg-primary/10 rounded-t hover:bg-primary/20 transition-all group relative" style={{ height: `${h}%` }}>
                                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
                                        ${h}k
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-between text-[10px] text-muted-foreground mt-2 px-2">
                            <span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span>
                        </div>
                    </div>

                    {/* Profitability Section */}
                    <div className={`p-4 border rounded-lg bg-card ${completed.includes('profitability') ? 'border-green-500/50' : ''}`}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                Rentabilidad por Producto
                            </h3>
                            {!completed.includes('profitability') && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    id="tutorial-btn-view-margins"
                                    onClick={() => {
                                        if (onComplete) onComplete('profitability');
                                        toast.success("Revisión de márgenes completada");
                                    }}
                                >
                                    Ver Márgenes
                                </Button>
                            )}
                            {completed.includes('profitability') && <Badge variant="outline" className="text-green-600 border-green-200">Revisado</Badge>}
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between text-xs p-2 bg-muted/50 rounded">
                                <span className="font-medium">Coca Cola 600ml</span>
                                <div className="flex items-center gap-4">
                                    <span className="text-muted-foreground">Ventas: 150</span>
                                    <span className="text-green-600 font-bold">Margen: 45%</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between text-xs p-2 bg-muted/50 rounded">
                                <span className="font-medium">Cerveza Corona</span>
                                <div className="flex items-center gap-4">
                                    <span className="text-muted-foreground">Ventas: 80</span>
                                    <span className="text-green-600 font-bold">Margen: 35%</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between text-xs p-2 bg-muted/50 rounded">
                                <span className="font-medium">Habitación Sencilla</span>
                                <div className="flex items-center gap-4">
                                    <span className="text-muted-foreground">Rentas: 45</span>
                                    <span className="text-green-600 font-bold">Margen: 85%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="customers" className="space-y-4">
                    <div className="flex justify-between items-center gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Buscar por nombre, RFC o teléfono..." className="pl-9" />
                        </div>
                        <Button onClick={() => setIsNewCustomerOpen(true)} id="tutorial-btn-new-customer">
                            <Plus className="h-4 w-4 mr-2" /> Nuevo Cliente
                        </Button>
                    </div>

                    <div className="rounded-md border bg-card">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Contacto</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>RFC / Facturación</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {customers.map((customer) => (
                                    <TableRow key={customer.id}>
                                        <TableCell>
                                            <div className="font-medium">{customer.name}</div>
                                            <div className="text-xs text-muted-foreground">ID: {customer.id}</div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm">{customer.email}</div>
                                            <div className="text-xs text-muted-foreground">{customer.phone}</div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={customer.type === 'CORPORATE' ? 'default' : 'secondary'} className="text-[10px]">
                                                {customer.type === 'CORPORATE' ? 'EMPRESA' : 'PARTICULAR'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {customer.rfc ? (
                                                <div className="flex items-center gap-1 text-green-600 text-xs font-medium">
                                                    <FileText className="h-3 w-3" /> {customer.rfc}
                                                </div>
                                            ) : (
                                                <div className="text-xs text-muted-foreground italic">Sin datos fiscales</div>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    // Simulate adding billing data if missing
                                                    if (!customer.rfc && onComplete) {
                                                        onComplete('billing-data');
                                                        toast.success(`Datos fiscales actualizados para ${customer.name}`);
                                                    }
                                                }}
                                            >
                                                <Edit2 className="h-4 w-4 text-muted-foreground" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>
            </Tabs>

            <Dialog open={isNewCustomerOpen} onOpenChange={setIsNewCustomerOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Registrar Nuevo Cliente</DialogTitle>
                    </DialogHeader>
                    <MockCustomerForm
                        onClose={() => setIsNewCustomerOpen(false)}
                        onComplete={(withBilling) => {
                            if (onComplete) {
                                onComplete('register-customer');
                                if (withBilling) onComplete('billing-data');
                            }
                            setIsNewCustomerOpen(false);
                            toast.success("Cliente registrado correctamente");
                        }}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}

function MockCustomerForm({ onClose, onComplete }: { onClose: () => void, onComplete: (withBilling: boolean) => void }) {
    const [wantsBilling, setWantsBilling] = useState(false);

    return (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onComplete(wantsBilling); }}>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium">Nombre Completo / Razón Social</label>
                    <Input placeholder="Ej. Juan Pérez" required />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">Tipo</label>
                    <select className="w-full h-10 px-3 py-2 border rounded-md text-sm bg-background">
                        <option value="individual">Persona Física</option>
                        <option value="corporate">Persona Moral</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium">Teléfono</label>
                    <Input placeholder="555-000-0000" type="tel" />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">Correo Electrónico</label>
                    <Input placeholder="cliente@email.com" type="email" />
                </div>
            </div>

            <div className="py-2">
                <div className="flex items-center space-x-2">
                    <input
                        type="checkbox"
                        id="billing"
                        checked={wantsBilling}
                        onChange={(e) => setWantsBilling(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300"
                    />
                    <label htmlFor="billing" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        Habilitar Datos de Facturación (RFC)
                    </label>
                </div>
            </div>

            {wantsBilling && (
                <div className="p-4 bg-muted/30 rounded-lg space-y-4 border">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">RFC</label>
                        <Input placeholder="XAXX010101000" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Régimen Fiscal</label>
                        <select className="w-full h-10 px-3 py-2 border rounded-md text-sm bg-background">
                            <option>601 - General de Ley Personas Morales</option>
                            <option>626 - Régimen Simplificado de Confianza</option>
                            <option>605 - Sueldos y Salarios</option>
                        </select>
                    </div>
                </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                <Button type="submit">Guardar Cliente</Button>
            </div>
        </form>
    );
}

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
                Utiliza los filtros y presiona "Generar Reporte" para visualizar la data financiera.
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

// --- MOCK CONFIG PANEL (Simple, reusing generic structure but can be expanded) ---
export function MockConfigPanel({ completed }: { completed: string[] }) {
    // Keeping simple for now, but exporting it here to centralize
    return (
        <div className="border rounded-lg overflow-hidden bg-card">
            <div className="bg-muted p-2 text-xs font-semibold text-foreground">Configuración del Sistema</div>
            <div className="divide-y">
                <div className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Users className="h-8 w-8 text-blue-500 bg-blue-100 p-1 rounded-full dark:bg-blue-900" />
                        <div className="text-sm">
                            <div className="font-medium">Usuarios y Permisos</div>
                            <div className="text-xs text-muted-foreground">3 Operadores activos</div>
                        </div>
                    </div>
                </div>
                <div className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Radio className="h-8 w-8 text-orange-500 bg-orange-100 p-1 rounded-full dark:bg-orange-900" />
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

// --- MOCK PURCHASES PANEL ---
export function MockPurchasesPanel({ completed, onComplete }: { completed: string[], onComplete?: (stepId: string) => void }) {
    const [activeTab, setActiveTab] = useState("purchases");
    const [isNewPurchaseOpen, setIsNewPurchaseOpen] = useState(false);
    const [isNewSupplierOpen, setIsNewSupplierOpen] = useState(false);

    const hasNewPurchase = completed.includes('new-purchase');
    const hasSupplier = completed.includes('suppliers');

    // Mock Suppliers
    const suppliers = [
        { id: '1', name: 'Distribuidora de Bebidas S.A.', contact: 'Juan Pérez', phone: '555-123-4567', email: 'ventas@bebidas.com', credit: 15000 },
        { id: '2', name: 'Limpieza Total', contact: 'Maria Lopez', phone: '555-987-6543', email: 'contacto@limpiezatotal.mx', credit: 5000 },
    ];
    if (hasSupplier) {
        suppliers.push({ id: '3', name: 'Proveedor Nuevo', contact: 'Gerente Ventas', phone: '555-000-1111', email: 'nuevo@proveedor.com', credit: 20000 });
    }

    // Mock Purchases
    const purchases = [
        { id: '101', date: '01/01/2026', supplier: 'Distribuidora de Bebidas S.A.', total: 2500.00, status: 'RECEIVED', invoice: 'F-90210' },
        { id: '102', date: '05/01/2026', supplier: 'Limpieza Total', total: 850.50, status: 'RECEIVED', invoice: 'A-123' },
    ];
    if (hasNewPurchase) {
        purchases.unshift({ id: '103', date: 'Hoy', supplier: 'Distribuidora de Bebidas S.A.', total: 4500.00, status: 'PENDING', invoice: 'F-90300' });
    }

    return (
        <div className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="purchases" id="tutorial-tab-purchases">🛒 Compras</TabsTrigger>
                    <TabsTrigger value="suppliers" id="tutorial-tab-suppliers">🚚 Proveedores</TabsTrigger>
                </TabsList>

                <TabsContent value="purchases" className="space-y-4">
                    <div className="flex justify-between items-center">
                        <div className="relative max-w-sm w-full">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Buscar compra..." className="pl-9" />
                        </div>
                        <Button onClick={() => setIsNewPurchaseOpen(true)} id="tutorial-btn-new-purchase">
                            <Plus className="h-4 w-4 mr-2" /> Registrar Compra
                        </Button>
                    </div>

                    <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Proveedor</TableHead>
                                    <TableHead>Factura</TableHead>
                                    <TableHead className="text-center">Estado</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                    <TableHead className="text-center">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {purchases.map(p => (
                                    <TableRow key={p.id}>
                                        <TableCell>{p.date}</TableCell>
                                        <TableCell className="font-medium">{p.supplier}</TableCell>
                                        <TableCell>{p.invoice}</TableCell>
                                        <TableCell className="text-center">
                                            {p.status === 'RECEIVED' ? (
                                                <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Recibido</Badge>
                                            ) : (
                                                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">Pendiente</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right font-bold">${p.total.toFixed(2)}</TableCell>
                                        <TableCell className="text-center">
                                            <Button variant="ghost" size="sm" onClick={() => toast.info("Detalle de compra solo lectura")}>
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>

                <TabsContent value="suppliers" className="space-y-4">
                    <div className="flex justify-between items-center">
                        <div className="relative max-w-sm w-full">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Buscar proveedor..." className="pl-9" />
                        </div>
                        <Button onClick={() => setIsNewSupplierOpen(true)} id="tutorial-btn-new-supplier">
                            <Plus className="h-4 w-4 mr-2" /> Nuevo Proveedor
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                        {suppliers.map(s => (
                            <Card key={s.id}>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <div className="font-bold text-lg">{s.name}</div>
                                    <Badge variant="outline">Crédito: ${s.credit.toLocaleString()}</Badge>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-sm space-y-2 mt-2">
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Users className="h-4 w-4" /> {s.contact}
                                        </div>
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <div className="h-4 w-4 flex items-center justify-center">📞</div> {s.phone}
                                        </div>
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <div className="h-4 w-4 flex items-center justify-center">📧</div> {s.email}
                                        </div>
                                    </div>
                                    <Button variant="outline" size="sm" className="w-full mt-4">
                                        Editar Detalles
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>
            </Tabs>

            {/* Modals */}
            <Dialog open={isNewSupplierOpen} onOpenChange={setIsNewSupplierOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Registrar Nuevo Proveedor</DialogTitle>
                    </DialogHeader>
                    <MockSupplierForm
                        onClose={() => setIsNewSupplierOpen(false)}
                        onComplete={() => {
                            if (onComplete) onComplete('suppliers');
                            setIsNewSupplierOpen(false);
                            toast.success("Proveedor registrado correctamente");
                        }}
                    />
                </DialogContent>
            </Dialog>

            <Dialog open={isNewPurchaseOpen} onOpenChange={setIsNewPurchaseOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Registrar Compra</DialogTitle>
                    </DialogHeader>
                    <MockPurchaseForm
                        onClose={() => setIsNewPurchaseOpen(false)}
                        onComplete={() => {
                            if (onComplete) onComplete('new-purchase');
                            setIsNewPurchaseOpen(false);
                            toast.success("Compra registrada correctamente");
                        }}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}

function MockSupplierForm({ onClose, onComplete }: { onClose: () => void, onComplete: () => void }) {
    return (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onComplete(); }}>
            <div className="space-y-2">
                <label className="text-sm font-medium">Nombre de la Empresa</label>
                <Input placeholder="Ej. Distribuidora del Norte" required />
            </div>
            <div className="space-y-2">
                <label className="text-sm font-medium">Contacto Principal</label>
                <Input placeholder="Nombre del agente de ventas" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium">Teléfono</label>
                    <Input placeholder="555-0000-000" />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">Límite de Crédito</label>
                    <Input type="number" placeholder="5000" />
                </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                <Button type="submit">Guardar Proveedor</Button>
            </div>
        </form>
    );
}

function MockPurchaseForm({ onClose, onComplete }: { onClose: () => void, onComplete: () => void }) {
    return (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onComplete(); }}>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium">Proveedor</label>
                    <select className="w-full flex h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                        <option>Distribuidora de Bebidas S.A.</option>
                        <option>Limpieza Total</option>
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">Fecha Factura</label>
                    <Input type="date" defaultValue={new Date().toISOString().split('T')[0]} />
                </div>
            </div>
            <div className="space-y-2">
                <label className="text-sm font-medium">No. Factura / Folio</label>
                <Input placeholder="A-0000" required />
            </div>

            <div className="p-4 border rounded-md bg-muted/20">
                <p className="text-xs font-medium text-muted-foreground mb-2">Detalle de Compra (Simulado)</p>
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span>10x Cajas Cerveza Corona</span>
                        <span>$3,500.00</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span>5x Cajas Refresco Cola</span>
                        <span>$1,000.00</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-bold">
                        <span>Total</span>
                        <span>$4,500.00</span>
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                <Button type="submit">Registrar Compra</Button>
            </div>
        </form>
    );
}
