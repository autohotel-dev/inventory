
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, Package, AlertTriangle, DollarSign, BarChart3, TrendingUp } from "lucide-react";
import Link from "next/link";


async function getProduct(id: string) {
    const { apiClient } = await import("@/lib/api/client");
    try {
        const { data } = await apiClient.get(`/system/crud/products/${id}`);
        return data;
    } catch (e) {
        return null;
    }
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = await params;
    const product = await getProduct(resolvedParams.id);

    if (!product) return notFound();

    // Calculations and formatting
    const currentStock = product.qty || 0; // Using 'qty' as per schema (from previous knowledge/migrations)
    const minStock = product.min_stock || 0;
    const price = product.price || 0;
    const totalValue = currentStock * price;

    // Stock Status Logic
    let stockStatus: 'good' | 'low' | 'critical' = 'good';
    let stockColor = "text-emerald-500";
    let stockBorder = "border-emerald-500/20";
    let StockIcon = Package;

    if (currentStock === 0) {
        stockStatus = 'critical';
        stockColor = "text-red-500";
        stockColor = "text-red-500";
        stockBorder = "border-red-500/20";
        StockIcon = AlertTriangle;
    } else if (currentStock <= minStock) {
        stockStatus = 'low';
        stockColor = "text-orange-500";
        stockColor = "text-orange-500";
        stockBorder = "border-orange-500/20";
        StockIcon = AlertTriangle;
    }

    return (
        <div className="container mx-auto py-8 max-w-5xl space-y-8 animate-in fade-in duration-500">
            {/* Navigation */}
            <div>
                <Link href="/products" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver al inventario
                </Link>
            </div>

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b pb-6">
                <div className="space-y-1.5">
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
                        {product.is_active ? (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Activo</Badge>
                        ) : (
                            <Badge variant="outline" className="bg-zinc-500/10 text-zinc-500 border-zinc-500/20">Inactivo</Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                            <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">SKU: {product.sku || 'N/A'}</span>
                        </span>
                        {product.subcategory && (
                            <span className="flex items-center gap-1.5">
                                <span className="w-1 h-1 rounded-full bg-zinc-600"></span>
                                {product.category} / {product.subcategory}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Link href={`/products/${product.id}/edit`}>
                        <Button>
                            <Edit className="mr-2 h-4 w-4" />
                            Editar Producto
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Stock Card */}
                <Card className={`border shadow-sm ${stockBorder} relative overflow-hidden`}>
                    <div className={`absolute top-0 right-0 p-3 opacity-20 ${stockColor}`}>
                        <StockIcon className="h-16 w-16 -mr-4 -mt-4 transform rotate-12" />
                    </div>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Stock Actual</CardTitle>
                        <StockIcon className={`h-4 w-4 ${stockColor}`} />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${stockColor}`}>{currentStock}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {stockStatus === 'critical' && "Agotado - Requiere reposición inmediata"}
                            {stockStatus === 'low' && `Bajo stock (Mínimo: ${minStock})`}
                            {stockStatus === 'good' && "Nivel de stock saludable"}
                        </p>
                    </CardContent>
                </Card>

                {/* Price Card */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Precio Unitario</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${price.toFixed(2)}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Precio de venta al público
                        </p>
                    </CardContent>
                </Card>

                {/* Total Value Card */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Valor del Inventario</CardTitle>
                        <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${totalValue.toFixed(2)}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Valor total estimado actual
                        </p>
                    </CardContent>
                </Card>

                {/* Min Stock Config Card */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Punto de Reorden</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{minStock}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Alerta de stock bajo
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Additional Details / Placeholder for future history */}
            <div className="grid grid-cols-1 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Detalles del Producto</CardTitle>
                    </CardHeader>
                    <CardContent className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <span className="text-sm font-medium text-muted-foreground">ID del Sistema</span>
                            <p className="text-sm font-mono bg-muted/50 p-2 rounded">{product.id}</p>
                        </div>
                        <div className="space-y-1">
                            <span className="text-sm font-medium text-muted-foreground">Fecha de Creación</span>
                            <p className="text-sm">{new Date(product.created_at).toLocaleDateString('es-ES', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}</p>
                        </div>
                        {/* Add more details here if available in the future */}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
