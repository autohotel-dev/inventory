"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    Percent,
    FileSpreadsheet,
    FileText
} from "lucide-react";
import { exportToExcel, exportToPDF, formatCurrency } from "@/lib/export-utils";

interface ProfitabilityData {
    totalProfit: number;
    totalCost: number;
    totalRevenue: number;
    profitMargin: number;
    productProfitability: Array<{
        product_name: string;
        product_sku: string;
        cost_price: number;
        sell_price: number;
        quantity_sold: number;
        total_cost: number;
        total_revenue: number;
        profit: number;
        margin_percentage: number;
        roi: number;
    }>;
    categoryProfitability: Array<{
        category_name: string;
        total_cost: number;
        total_revenue: number;
        profit: number;
        margin: number;
    }>;
}

export function ProfitabilityReport() {
    const [data, setData] = useState<ProfitabilityData | null>(null);
    const [loading, setLoading] = useState(true);
    const [sortBy, setSortBy] = useState<'profit' | 'margin' | 'roi'>('profit');

    const fetchProfitabilityReport = async () => {
        const supabase = createClient();
        setLoading(true);

        try {
            // Obtener productos con ventas
            const { data: products } = await supabase
                .from("products")
                .select(`
          *,
          category:categories(name),
          sales_items:sales_order_items(
            qty,
            unit_price,
            sales_order:sales_orders!inner(status)
          )
        `)
                .eq("is_active", true);

            if (!products) {
                setLoading(false);
                return;
            }

            // Calcular rentabilidad por producto
            const productProfitability = products
                .map(product => {
                    // Filtrar solo items de órdenes cerradas
                    const soldItems = (product.sales_items || []).filter(
                        (item: any) => item.sales_order?.status === 'CLOSED'
                    );

                    const quantity_sold = soldItems.reduce(
                        (sum: number, item: any) => sum + (item.qty || 0),
                        0
                    );

                    const total_revenue = soldItems.reduce(
                        (sum: number, item: any) => sum + ((item.qty || 0) * (item.unit_price || 0)),
                        0
                    );

                    // Asumimos que el costo es el precio de compra del producto
                    const cost_price = product.price * 0.6; // 60% del precio de venta como costo estimado
                    const total_cost = quantity_sold * cost_price;
                    const profit = total_revenue - total_cost;
                    const margin_percentage = total_revenue > 0 ? (profit / total_revenue) * 100 : 0;
                    const roi = total_cost > 0 ? (profit / total_cost) * 100 : 0;

                    return {
                        product_name: product.name,
                        product_sku: product.sku,
                        cost_price,
                        sell_price: product.price,
                        quantity_sold,
                        total_cost,
                        total_revenue,
                        profit,
                        margin_percentage,
                        roi,
                        category_name: (product.category as any)?.name || 'Sin categoría'
                    };
                })
                .filter(p => p.quantity_sold > 0); // Solo productos vendidos

            // Calcular totales
            const totalCost = productProfitability.reduce((sum, p) => sum + p.total_cost, 0);
            const totalRevenue = productProfitability.reduce((sum, p) => sum + p.total_revenue, 0);
            const totalProfit = totalRevenue - totalCost;
            const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

            // Rentabilidad por categoría
            const categoryMap = new Map<string, any>();
            productProfitability.forEach(product => {
                const catName = product.category_name;
                if (!categoryMap.has(catName)) {
                    categoryMap.set(catName, {
                        category_name: catName,
                        total_cost: 0,
                        total_revenue: 0,
                        profit: 0
                    });
                }
                const cat = categoryMap.get(catName);
                cat.total_cost += product.total_cost;
                cat.total_revenue += product.total_revenue;
                cat.profit += product.profit;
            });

            const categoryProfitability = Array.from(categoryMap.values())
                .map(cat => ({
                    ...cat,
                    margin: cat.total_revenue > 0 ? (cat.profit / cat.total_revenue) * 100 : 0
                }))
                .sort((a, b) => b.profit - a.profit);

            setData({
                totalProfit,
                totalCost,
                totalRevenue,
                profitMargin,
                productProfitability,
                categoryProfitability
            });

        } catch (error) {
            console.error("Error fetching profitability report:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProfitabilityReport();
    }, []);

    const getSortedProducts = () => {
        if (!data) return [];

        const sorted = [...data.productProfitability];

        switch (sortBy) {
            case 'profit':
                return sorted.sort((a, b) => b.profit - a.profit);
            case 'margin':
                return sorted.sort((a, b) => b.margin_percentage - a.margin_percentage);
            case 'roi':
                return sorted.sort((a, b) => b.roi - a.roi);
            default:
                return sorted;
        }
    };

    const handleExportExcel = () => {
        if (!data) return;

        exportToExcel({
            filename: `rentabilidad-productos-${new Date().toISOString().split('T')[0]}`,
            sheetName: 'Rentabilidad',
            columns: [
                { header: 'Producto', key: 'product_name', width: 30 },
                { header: 'SKU', key: 'product_sku', width: 15 },
                { header: 'Cant. Vendida', key: 'quantity_sold', width: 12 },
                { header: 'Costo Total', key: 'total_cost', width: 15 },
                { header: 'Ingresos', key: 'total_revenue', width: 15 },
                { header: 'Ganancia', key: 'profit', width: 15 },
                { header: 'Margen %', key: 'margin_percentage', width: 12 },
                { header: 'ROI %', key: 'roi', width: 12 }
            ],
            data: getSortedProducts()
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
                <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <div className="text-lg font-medium text-muted-foreground">
                    No se pudieron cargar los datos
                </div>
            </div>
        );
    }

    const sortedProducts = getSortedProducts();

    return (
        <div className="space-y-6">
            {/* Header con controles */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span>Análisis de Rentabilidad</span>
                        <Button variant="outline" size="sm" onClick={handleExportExcel}>
                            <FileSpreadsheet className="h-4 w-4 mr-2" />
                            Exportar Excel
                        </Button>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-2">
                        <Button
                            variant={sortBy === 'profit' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSortBy('profit')}
                        >
                            Por Ganancia
                        </Button>
                        <Button
                            variant={sortBy === 'margin' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSortBy('margin')}
                        >
                            Por Margen %
                        </Button>
                        <Button
                            variant={sortBy === 'roi' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSortBy('roi')}
                        >
                            Por ROI
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(data.totalRevenue)}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Costos Totales</CardTitle>
                        <TrendingDown className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(data.totalCost)}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ganancia Total</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {formatCurrency(data.totalProfit)}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Margen Promedio</CardTitle>
                        <Percent className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {data.profitMargin.toFixed(1)}%
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Rentabilidad por Categoría */}
            <Card>
                <CardHeader>
                    <CardTitle>Rentabilidad por Categoría</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {data.categoryProfitability.map((category, index) => (
                            <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                                <div>
                                    <div className="font-medium">{category.category_name}</div>
                                    <div className="text-sm text-muted-foreground">
                                        Costo: {formatCurrency(category.total_cost)} • Ingresos: {formatCurrency(category.total_revenue)}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-green-600">
                                        {formatCurrency(category.profit)}
                                    </div>
                                    <Badge variant={category.margin >= 30 ? 'default' : category.margin >= 15 ? 'secondary' : 'destructive'}>
                                        {category.margin.toFixed(1)}% margen
                                    </Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Top Productos por Rentabilidad */}
            <Card>
                <CardHeader>
                    <CardTitle>
                        {sortBy === 'profit' && 'Productos por Ganancia'}
                        {sortBy === 'margin' && 'Productos por Margen de Ganancia'}
                        {sortBy === 'roi' && 'Productos por Retorno de Inversión (ROI)'}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        <div className="grid grid-cols-6 gap-2 text-sm font-medium text-muted-foreground pb-2 border-b">
                            <div className="col-span-2">Producto</div>
                            <div className="text-right">Cant.</div>
                            <div className="text-right">Ganancia</div>
                            <div className="text-right">Margen %</div>
                            <div className="text-right">ROI %</div>
                        </div>
                        {sortedProducts.slice(0, 20).map((product, index) => (
                            <div key={index} className="grid grid-cols-6 gap-2 items-center py-2 border-b last:border-0">
                                <div className="col-span-2">
                                    <div className="font-medium text-sm">{product.product_name}</div>
                                    <div className="text-xs text-muted-foreground">{product.product_sku}</div>
                                </div>
                                <div className="text-right text-sm">{product.quantity_sold}</div>
                                <div className="text-right font-bold text-sm">
                                    <span className={product.profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                                        {formatCurrency(product.profit)}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <Badge variant={product.margin_percentage >= 30 ? 'default' : product.margin_percentage >= 15 ? 'secondary' : 'destructive'}>
                                        {product.margin_percentage.toFixed(1)}%
                                    </Badge>
                                </div>
                                <div className="text-right">
                                    <Badge variant="outline">
                                        {product.roi.toFixed(1)}%
                                    </Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Clasificación de Productos */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">
                            🌟 Alto Rendimiento
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">
                            {sortedProducts.filter(p => p.margin_percentage >= 30).length}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Productos con margen ≥ 30%
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">
                            ⚠️ Rendimiento Medio
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">
                            {sortedProducts.filter(p => p.margin_percentage >= 15 && p.margin_percentage < 30).length}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Productos con margen 15-30%
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">
                            🔴 Bajo Rendimiento
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-red-600">
                            {sortedProducts.filter(p => p.margin_percentage < 15).length}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Productos con margen &lt; 15%
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
