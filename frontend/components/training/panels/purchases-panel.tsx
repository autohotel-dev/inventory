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