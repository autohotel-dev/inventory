"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    AlertTriangle,
    AlertCircle,
    Package,
    TrendingDown,
    FileSpreadsheet
} from "lucide-react";
import { exportToExcel, formatDate } from "@/lib/export-utils";
import Link from "next/link";

interface StockAlert {
    product_id: string;
    product_name: string;
    product_sku: string;
    category_name: string;
    current_stock: number;
    min_stock: number;
    max_stock: number;
    status: 'critical' | 'low' | 'normal' | 'overstocked';
    deficit: number;
    days_until_stockout?: number;
    warehouses: Array<{
        warehouse_name: string;
        warehouse_code: string;
        qty: number;
    }>;
}

export function StockAlertsReport() {
    const [alerts, setAlerts] = useState<StockAlert[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'critical' | 'low'>('all');

    const fetchStockAlerts = async () => {
        const supabase = createClient();
        setLoading(true);

        try {
            // Obtener productos con su stock
            const { data: products } = await supabase
                .from("products")
                .select(`
          id,
          name,
          sku,
          min_stock,
          max_stock,
          category:categories(name),
          stock:stock(
            qty,
            warehouse:warehouses(name, code)
          )
        `)
                .eq("is_active", true);

            if (!products) {
                setLoading(false);
                return;
            }

            // Procesar alertas
            const stockAlerts: StockAlert[] = products.map(product => {
                const stockEntries = product.stock || [];
                const current_stock = stockEntries.reduce((sum, s: any) => sum + (s.qty || 0), 0);
                const min_stock = product.min_stock || 0;
                const max_stock = product.max_stock || 0;

                let status: 'critical' | 'low' | 'normal' | 'overstocked' = 'normal';
                if (current_stock === 0) {
                    status = 'critical';
                } else if (current_stock <= min_stock) {
                    status = 'low';
                } else if (max_stock > 0 && current_stock > max_stock) {
                    status = 'overstocked';
                }

                const deficit = Math.max(0, min_stock - current_stock);

                const warehouses = stockEntries.map((s: any) => ({
                    warehouse_name: s.warehouse?.name || 'Desconocido',
                    warehouse_code: s.warehouse?.code || '',
                    qty: s.qty || 0
                }));

                // Estimación de días hasta agotamiento (basado en ventas promedio)
                // Por ahora es un cálculo simplificado
                const days_until_stockout = current_stock > 0 ? Math.round(current_stock / 5) : 0;

                return {
                    product_id: product.id,
                    product_name: product.name,
                    product_sku: product.sku,
                    category_name: (product.category as any)?.name || 'Sin categoría',
                    current_stock,
                    min_stock,
                    max_stock,
                    status,
                    deficit,
                    days_until_stockout,
                    warehouses
                };
            });

            setAlerts(stockAlerts);

        } catch (error) {
            console.error("Error fetching stock alerts:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStockAlerts();
    }, []);

    const getFilteredAlerts = () => {
        switch (filter) {
            case 'critical':
                return alerts.filter(a => a.status === 'critical');
            case 'low':
                return alerts.filter(a => a.status === 'low');
            default:
                return alerts.filter(a => a.status === 'critical' || a.status === 'low');
        }
    };

    const handleExportExcel = () => {
        const filtered = getFilteredAlerts();

        exportToExcel({
            filename: `alertas-stock-${new Date().toISOString().split('T')[0]}`,
            sheetName: 'Alertas de Stock',
            columns: [
                { header: 'Producto', key: 'product_name', width: 30 },
                { header: 'SKU', key: 'product_sku', width: 15 },
                { header: 'Categoría', key: 'category_name', width: 20 },
                { header: 'Stock Actual', key: 'current_stock', width: 12 },
                { header: 'Stock Mínimo', key: 'min_stock', width: 12 },
                { header: 'Déficit', key: 'deficit', width: 12 },
                { header: 'Estado', key: 'status', width: 12 },
                { header: 'Días hasta Agotamiento', key: 'days_until_stockout', width: 20 }
            ],
            data: filtered
        });
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    const filteredAlerts = getFilteredAlerts();
    const criticalCount = alerts.filter(a => a.status === 'critical').length;
    const lowCount = alerts.filter(a => a.status === 'low').length;
    const overstockedCount = alerts.filter(a => a.status === 'overstocked').length;

    return (
        <div className="space-y-6">
            {/* Header con controles */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5" />
                            Alertas de Stock
                        </span>
                        <Button variant="outline" size="sm" onClick={handleExportExcel}>
                            <FileSpreadsheet className="h-4 w-4 mr-2" />
                            Exportar Excel
                        </Button>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-2">
                        <Button
                            variant={filter === 'all' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setFilter('all')}
                        >
                            Todas las Alertas ({criticalCount + lowCount})
                        </Button>
                        <Button
                            variant={filter === 'critical' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setFilter('critical')}
                        >
                            🔴 Crítico ({criticalCount})
                        </Button>
                        <Button
                            variant={filter === 'low' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setFilter('low')}
                        >
                            ⚠️ Bajo ({lowCount})
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Resumen de Alertas */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Stock Crítico</CardTitle>
                        <AlertCircle className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{criticalCount}</div>
                        <p className="text-xs text-muted-foreground">
                            Productos sin stock
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Stock Bajo</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">{lowCount}</div>
                        <p className="text-xs text-muted-foreground">
                            Por debajo del mínimo
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Sobrestock</CardTitle>
                        <TrendingDown className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">{overstockedCount}</div>
                        <p className="text-xs text-muted-foreground">
                            Por encima del máximo
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Productos</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{alerts.length}</div>
                        <p className="text-xs text-muted-foreground">
                            Productos activos
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Lista de Alertas */}
            <Card>
                <CardHeader>
                    <CardTitle>
                        {filter === 'critical' && 'Productos con Stock Crítico'}
                        {filter === 'low' && 'Productos con Stock Bajo'}
                        {filter === 'all' && 'Todas las Alertas de Stock'}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {filteredAlerts.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No hay alertas en esta categoría</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredAlerts.map((alert) => (
                                <div
                                    key={alert.product_id}
                                    className={`p-4 border rounded-lg ${alert.status === 'critical'
                                            ? 'border-red-300 bg-red-50 dark:bg-red-950/20'
                                            : 'border-orange-300 bg-orange-50 dark:bg-orange-950/20'
                                        }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                {alert.status === 'critical' ? (
                                                    <AlertCircle className="h-5 w-5 text-red-600" />
                                                ) : (
                                                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                                                )}
                                                <Link
                                                    href={`/products/${alert.product_id}`}
                                                    className="font-medium hover:underline"
                                                >
                                                    {alert.product_name}
                                                </Link>
                                                <Badge variant="outline">{alert.product_sku}</Badge>
                                                <Badge variant="secondary">{alert.category_name}</Badge>
                                            </div>

                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                                                <div>
                                                    <span className="text-muted-foreground">Stock Actual:</span>
                                                    <span className={`ml-2 font-bold ${alert.status === 'critical' ? 'text-red-600' : 'text-orange-600'
                                                        }`}>
                                                        {alert.current_stock}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground">Stock Mínimo:</span>
                                                    <span className="ml-2 font-medium">{alert.min_stock}</span>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground">Déficit:</span>
                                                    <span className="ml-2 font-bold text-red-600">{alert.deficit}</span>
                                                </div>
                                                {alert.days_until_stockout !== undefined && alert.days_until_stockout > 0 && (
                                                    <div>
                                                        <span className="text-muted-foreground">Días estimados:</span>
                                                        <span className="ml-2 font-medium">{alert.days_until_stockout}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Stock por almacén */}
                                            <div className="flex flex-wrap gap-2">
                                                <span className="text-sm text-muted-foreground">Por almacén:</span>
                                                {alert.warehouses.map((wh, idx) => (
                                                    <Badge key={idx} variant="outline" className="text-xs">
                                                        {wh.warehouse_code}: {wh.qty}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <Link href={`/purchases/new?product=${alert.product_id}`}>
                                                <Button size="sm" variant="outline">
                                                    Nueva Compra
                                                </Button>
                                            </Link>
                                            <Link href={`/movements/new?product=${alert.product_id}`}>
                                                <Button size="sm" variant="outline">
                                                    Ajuste de Stock
                                                </Button>
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Recomendaciones */}
            {filteredAlerts.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            💡 Recomendaciones
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-2 text-sm">
                            <li className="flex items-start gap-2">
                                <span>•</span>
                                <span>
                                    Hay <strong>{criticalCount}</strong> productos sin stock que requieren atención inmediata.
                                </span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span>•</span>
                                <span>
                                    Considera crear órdenes de compra para los {lowCount + criticalCount} productos con stock bajo o crítico.
                                </span>
                            </li>
                            {overstockedCount > 0 && (
                                <li className="flex items-start gap-2">
                                    <span>•</span>
                                    <span>
                                        Hay {overstockedCount} productos con sobrestock. Considera promociones o reducción de pedidos.
                                    </span>
                                </li>
                            )}
                            <li className="flex items-start gap-2">
                                <span>•</span>
                                <span>
                                    Revisa regularmente este reporte para mantener niveles óptimos de inventario.
                                </span>
                            </li>
                        </ul>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
