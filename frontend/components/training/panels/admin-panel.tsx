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
                <DialogContent className="w-[95vw] sm:w-full sm:max-w-[500px]">
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