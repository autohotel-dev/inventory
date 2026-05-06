"use client";

import { useState, useEffect, useCallback } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    TrendingUp,
    DollarSign,
    ShoppingCart,
    Calendar,
    FileSpreadsheet,
    FileText
} from "lucide-react";
import { exportToExcel, exportToPDF, formatCurrency, formatDate } from "@/lib/export-utils";

interface SalesReportData {
    totalSales: number;
    totalRevenue: number;
    averageTicket: number;
    topProducts: Array<{
        product_name: string;
        product_sku: string;
        quantity_sold: number;
        total_revenue: number;
    }>;
    salesByPeriod: Array<{
        date: string;
        sales_count: number;
        revenue: number;
    }>;
    salesByCustomer: Array<{
        customer_name: string;
        orders_count: number;
        total_spent: number;
    }>;
}


export function SalesReport() {
    const [data, setData] = useState<SalesReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<'month' | 'day' | 'week' | 'year'>('month');
    const [startDate, setStartDate] = useState<string>(() => {
        const date = new Date();
        date.setMonth(date.getMonth() - 1);
        return date.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState<string>(() => {
        return new Date().toISOString().split('T')[0];
    });

    const fetchSalesReport = useCallback(async () => {
        setLoading(true);
        try {
            const { apiClient } = await import("@/lib/api/client");
            
            const { data: salesOrders } = await apiClient.get('/analytics/sales-report', {
                params: {
                    start_date: startDate,
                    end_date: endDate
                }
            });

            if (!salesOrders) {
                setLoading(false);
                return;
            }

            // Calcular métricas
            const totalSales = salesOrders.length;
            const totalRevenue = salesOrders.reduce((sum: number, order: any) => sum + (order.total || 0), 0);
            const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

            // Top productos
            const productMap = new Map<string, any>();
            salesOrders.forEach((order: any) => {
                order.items?.forEach((item: any) => {
                    const key = item.product?.sku || 'Unknown';
                    if (!productMap.has(key)) {
                        productMap.set(key, {
                            product_name: item.product?.name || 'Producto eliminado',
                            product_sku: key,
                            quantity_sold: 0,
                            total_revenue: 0
                        });
                    }
                    const prod = productMap.get(key);
                    prod.quantity_sold += item.qty || 0;
                    // Usar el campo 'total' calculado del item, o calcularlo manualmente
                    prod.total_revenue += item.total || ((item.qty || 0) * (item.unit_price || 0));
                });
            });

            const topProducts = Array.from(productMap.values())
                .sort((a, b) => b.total_revenue - a.total_revenue)
                .slice(0, 10);

            // Ventas por período (agrupar por día)
            const salesByDay = new Map<string, any>();
            salesOrders.forEach((order: any) => {
                const dateKey = order.created_at.split('T')[0];
                if (!salesByDay.has(dateKey)) {
                    salesByDay.set(dateKey, {
                        date: dateKey,
                        sales_count: 0,
                        revenue: 0
                    });
                }
                const day = salesByDay.get(dateKey);
                day.sales_count++;
                day.revenue += order.total || 0;
            });

            const salesByPeriod = Array.from(salesByDay.values())
                .sort((a, b) => a.date.localeCompare(b.date));

            // Ventas por cliente
            const customerMap = new Map<string, any>();
            salesOrders.forEach((order: any) => {
                const customerName = (order.customer as any)?.name || 'Cliente general';
                if (!customerMap.has(customerName)) {
                    customerMap.set(customerName, {
                        customer_name: customerName,
                        orders_count: 0,
                        total_spent: 0
                    });
                }
                const cust = customerMap.get(customerName);
                cust.orders_count++;
                cust.total_spent += order.total || 0;
            });

            const salesByCustomer = Array.from(customerMap.values())
                .sort((a, b) => b.total_spent - a.total_spent)
                .slice(0, 10);

            setData({
                totalSales,
                totalRevenue,
                averageTicket,
                topProducts,
                salesByPeriod,
                salesByCustomer
            });

        } catch (_error) {
            console.error("Error fetching sales report:", _error);
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate]);

    useEffect(() => {
        fetchSalesReport();
    }, [fetchSalesReport]);

    const handleExportExcel = () => {
        if (!data) return;

        exportToExcel({
            filename: `reporte-ventas-${startDate}-${endDate}`,
            sheetName: 'Reporte de Ventas',
            columns: [
                { header: 'Producto', key: 'product_name', width: 30 },
                { header: 'SKU', key: 'product_sku', width: 15 },
                { header: 'Cantidad', key: 'quantity_sold', width: 12 },
                { header: 'Ingresos', key: 'total_revenue', width: 15 }
            ],
            data: data.topProducts
        });
    };

    const handleExportPDF = () => {
        if (!data) return;

        exportToPDF({
            filename: `reporte-ventas-${startDate}-${endDate}`,
            title: `Reporte de Ventas (${formatDate(startDate)} - ${formatDate(endDate)})`,
            columns: [
                { header: 'Producto', key: 'product_name' },
                { header: 'SKU', key: 'product_sku' },
                { header: 'Cant.', key: 'quantity_sold' },
                { header: 'Ingresos', key: 'total_revenue' }
            ],
            data: data.topProducts.map(p => ({
                ...p,
                total_revenue: formatCurrency(p.total_revenue)
            }))
        });
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="text-center py-12">
                <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <div className="text-lg font-medium text-muted-foreground">
                    No se pudieron cargar los datos
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Controles */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            <Calendar className="h-5 w-5" />
                            Período de Reporte
                        </span>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={handleExportExcel}>
                                <FileSpreadsheet className="h-4 w-4 mr-2" />
                                Excel
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleExportPDF}>
                                <FileText className="h-4 w-4 mr-2" />
                                PDF
                            </Button>
                        </div>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-4">
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium">Fecha Inicio</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="px-3 py-2 border rounded-md"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium">Fecha Fin</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="px-3 py-2 border rounded-md"
                            />
                        </div>
                        <div className="flex items-end">
                            <Button onClick={fetchSalesReport}>
                                Actualizar Reporte
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Ventas</CardTitle>
                        <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.totalSales}</div>
                        <p className="text-xs text-muted-foreground">
                            Órdenes completadas
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(data.totalRevenue)}</div>
                        <p className="text-xs text-muted-foreground">
                            En el período seleccionado
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ticket Promedio</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(data.averageTicket)}</div>
                        <p className="text-xs text-muted-foreground">
                            Por orden de venta
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Top Productos */}
            <Card>
                <CardHeader>
                    <CardTitle>Top 10 Productos Más Vendidos</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {data.topProducts.map((product, index) => (
                            <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                                <div className="flex items-center gap-3">
                                    <Badge variant="outline" className="font-bold">
                                        #{index + 1}
                                    </Badge>
                                    <div>
                                        <div className="font-medium">{product.product_name}</div>
                                        <div className="text-sm text-muted-foreground">
                                            SKU: {product.product_sku}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold">{formatCurrency(product.total_revenue)}</div>
                                    <div className="text-sm text-muted-foreground">
                                        {product.quantity_sold} unidades
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Ventas por Cliente */}
            <Card>
                <CardHeader>
                    <CardTitle>Top Clientes</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {data.salesByCustomer.map((customer, index) => (
                            <div key={index} className="flex items-center justify-between">
                                <div>
                                    <div className="font-medium">{customer.customer_name}</div>
                                    <div className="text-sm text-muted-foreground">
                                        {customer.orders_count} órdenes
                                    </div>
                                </div>
                                <div className="font-bold">
                                    {formatCurrency(customer.total_spent)}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>


            {/* Tendencia de Ventas */}
            <Card>
                <CardHeader>
                    <CardTitle>Tendencia de Ventas</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {data.salesByPeriod.map((day, index) => (
                            <div key={index} className="flex items-center justify-between">
                                <span className="text-sm">{formatDate(day.date)}</span>
                                <div className="flex items-center gap-4">
                                    <span className="text-sm text-muted-foreground">
                                        {day.sales_count} ventas
                                    </span>
                                    <span className="font-bold">
                                        {formatCurrency(day.revenue)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
