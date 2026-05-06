"use client";

import { useState } from "react";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Database,
  Package,
  Warehouse,
  Users,
  Activity,
  Calendar,
  Filter
} from "lucide-react";

interface ExportOptions {
  format: 'excel' | 'csv' | 'pdf';
  dataType: 'products' | 'movements' | 'warehouses' | 'suppliers' | 'analytics';
  dateRange?: {
    from: string;
    to: string;
  };
  filters?: {
    category?: string;
    warehouse?: string;
    supplier?: string;
    status?: string;
  };
}

export function ExportManager() {
  const [loading, setLoading] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<ExportOptions>({
    format: 'excel',
    dataType: 'products'
  });
  const { success, error: showError } = useToast();

  const exportData = async (options: ExportOptions) => {
    setLoading(options.dataType);

    try {
      let data: any[] = [];
      let filename = '';

      const fetchList = async (endpoint: string, params: any = {}) => {
        const res = await apiClient.get(endpoint, { params: { ...params, limit: 100000 } });
        const raw = res.data;
        return Array.isArray(raw) ? raw : (raw?.items || raw?.results || []);
      };

      switch (options.dataType) {
        case 'products':
          const [productsData, stockData, categoriesData] = await Promise.all([
            fetchList("/products/"),
            fetchList("/stock/"),
            fetchList("/categories/"),
          ]);

          const categoryMap = new Map(categoriesData.map((c: any) => [c.id, c.name]));

          data = productsData.map((product: any) => {
            const productStock = stockData.filter((s: any) => s.product_id === product.id);
            const totalStock = productStock.reduce((sum: number, s: any) => sum + (s.qty || 0), 0);
            const stockByWarehouse = productStock.map((s: any) =>
              `${s.warehouse_name || s.warehouse_id || 'N/A'}: ${s.qty || 0}`
            ).join('; ') || 'Sin stock';

            return {
              'SKU': product.sku,
              'Nombre': product.name,
              'Descripci\u00f3n': product.description || '',
              'Categor\u00eda': categoryMap.get(product.category_id) || product.category?.name || 'Sin categor\u00eda',
              'Precio': product.price,
              'Costo': product.cost,
              'Stock Total': totalStock,
              'Stock M\u00ednimo': product.min_stock,
              'Unidad': product.unit,
              'Stock por Almac\u00e9n': stockByWarehouse,
              'C\u00f3digo de Barras': product.barcode || '',
              'Estado': product.is_active ? 'Activo' : 'Inactivo',
              'Valor Inventario': totalStock * product.price,
              'Margen (%)': product.cost > 0 ? (((product.price - product.cost) / product.cost) * 100).toFixed(2) : '0',
              'Fecha Creaci\u00f3n': new Date(product.created_at).toLocaleDateString()
            };
          });
          filename = `productos_${new Date().toISOString().split('T')[0]}`;
          break;

        case 'movements':
          const movementsData = await fetchList("/inventory/movements/");

          data = movementsData.map((movement: any) => ({
            'Fecha': new Date(movement.created_at).toLocaleDateString(),
            'Hora': new Date(movement.created_at).toLocaleTimeString(),
            'Producto': movement.product_name || movement.product?.name || 'Producto eliminado',
            'SKU': movement.product_sku || movement.product?.sku || 'N/A',
            'Almac\u00e9n': movement.warehouse_name || movement.warehouse?.name || 'Almac\u00e9n eliminado',
            'C\u00f3digo Almac\u00e9n': movement.warehouse_code || movement.warehouse?.code || 'N/A',
            'Tipo': movement.movement_type === 'IN' ? 'Entrada' :
              movement.movement_type === 'OUT' ? 'Salida' : 'Ajuste',
            'Cantidad': movement.quantity,
            'Raz\u00f3n': movement.reason,
            'Notas': movement.notes || ''
          }));
          filename = `movimientos_${new Date().toISOString().split('T')[0]}`;
          break;

        case 'warehouses':
          const [warehousesData, whStockData] = await Promise.all([
            fetchList("/warehouses/"),
            fetchList("/stock/"),
          ]);

          data = warehousesData.map((warehouse: any) => {
            const whStock = whStockData.filter((s: any) => s.warehouse_id === warehouse.id);
            const totalProducts = whStock.length;
            const totalStock = whStock.reduce((sum: number, s: any) => sum + (s.qty || 0), 0);
            const totalValue = whStock.reduce((sum: number, s: any) =>
              sum + ((s.qty || 0) * (s.product_price || 0)), 0
            );

            return {
              'C\u00f3digo': warehouse.code,
              'Nombre': warehouse.name,
              'Direcci\u00f3n': warehouse.address || '',
              'Estado': warehouse.is_active ? 'Activo' : 'Inactivo',
              'Productos \u00danicos': totalProducts,
              'Stock Total': totalStock,
              'Valor Total': totalValue.toFixed(2),
              'Utilizaci\u00f3n (%)': Math.min((totalProducts / 100) * 100, 100).toFixed(1),
              'Fecha Creaci\u00f3n': new Date(warehouse.created_at).toLocaleDateString()
            };
          });
          filename = `almacenes_${new Date().toISOString().split('T')[0]}`;
          break;

        case 'suppliers':
          const suppliersData = await fetchList("/suppliers/");

          data = suppliersData.map((supplier: any) => ({
            'Nombre': supplier.name,
            'Email': supplier.email || '',
            'Tel\u00e9fono': supplier.phone || '',
            'Direcci\u00f3n': supplier.address || '',
            'Estado': supplier.is_active ? 'Activo' : 'Inactivo',
            'Fecha Creaci\u00f3n': new Date(supplier.created_at).toLocaleDateString()
          }));
          filename = `proveedores_${new Date().toISOString().split('T')[0]}`;
          break;

        case 'analytics':
          const [analyticsProducts, analyticsStock, analyticsMovements] = await Promise.all([
            fetchList("/products/"),
            fetchList("/stock/"),
            fetchList("/inventory/movements/"),
          ]);

          // Filter recent movements (last 30 days)
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          const recentMovements = analyticsMovements.filter((m: any) => new Date(m.created_at) >= thirtyDaysAgo);

          const totalProducts = analyticsProducts.length;
          const totalValue = analyticsProducts.reduce((sum: number, p: any) => {
            const stock = analyticsStock.filter((s: any) => s.product_id === p.id).reduce((s: number, st: any) => s + (st.qty || 0), 0);
            return sum + (stock * p.price);
          }, 0);

          const movementsByType = {
            IN: recentMovements.filter((m: any) => m.movement_type === 'IN').length,
            OUT: recentMovements.filter((m: any) => m.movement_type === 'OUT').length,
            ADJUSTMENT: recentMovements.filter((m: any) => m.movement_type === 'ADJUSTMENT').length
          };

          data = [{
            'Fecha Reporte': new Date().toLocaleDateString(),
            'Total Productos': totalProducts,
            'Valor Total Inventario': totalValue.toFixed(2),
            'Movimientos \u00daltimos 30 d\u00edas': recentMovements.length,
            'Entradas (30 d\u00edas)': movementsByType.IN,
            'Salidas (30 d\u00edas)': movementsByType.OUT,
            'Ajustes (30 d\u00edas)': movementsByType.ADJUSTMENT,
            'Productos Activos': analyticsProducts.filter((p: any) => p.is_active).length,
            'Productos Inactivos': analyticsProducts.filter((p: any) => !p.is_active).length
          }];
          filename = `reporte_analytics_${new Date().toISOString().split('T')[0]}`;
          break;
      }

      // Generar archivo según formato
      if (options.format === 'csv') {
        downloadCSV(data, filename);
      } else if (options.format === 'excel') {
        downloadExcel(data, filename);
      } else if (options.format === 'pdf') {
        downloadPDF(data, filename, options.dataType);
      }

      success("Exportación completada", `Archivo ${filename}.${options.format} descargado`);

    } catch (error) {
      console.error("Error exporting data:", error);
      showError("Error", "No se pudo exportar los datos");
    } finally {
      setLoading(null);
    }
  };

  const downloadCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map((row: any) =>
        headers.map((header: any) => {
          const value = row[header];
          // Escapar comillas y envolver en comillas si contiene comas
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    link.click();
  };

  const downloadExcel = (data: any[], filename: string) => {
    // Simulación de Excel usando CSV con formato mejorado
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join('\t'), // Usar tabs para mejor compatibilidad con Excel
      ...data.map((row: any) =>
        headers.map((header: any) => row[header]).join('\t')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.xls`;
    link.click();
  };

  const downloadPDF = (data: any[], filename: string, dataType: string) => {
    // Crear contenido HTML para PDF
    const headers = data.length > 0 ? Object.keys(data[0]) : [];
    const title = {
      products: 'Reporte de Productos',
      movements: 'Reporte de Movimientos',
      warehouses: 'Reporte de Almacenes',
      suppliers: 'Reporte de Proveedores',
      analytics: 'Reporte de Analytics'
    }[dataType] || 'Reporte';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; text-align: center; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .header { text-align: center; margin-bottom: 20px; }
          .date { color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${title}</h1>
          <p class="date">Generado el: ${new Date().toLocaleDateString()}</p>
        </div>
        <table>
          <thead>
            <tr>
              ${headers.map((header: any) => `<th>${header}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${data.map((row: any) => `
              <tr>
                ${headers.map((header: any) => `<td>${row[header] || ''}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.html`;
    link.click();
  };

  const exportOptions = [
    {
      type: 'products' as const,
      title: 'Productos',
      description: 'Exportar inventario completo con stock y precios',
      icon: Package,
      color: 'text-blue-600'
    },
    {
      type: 'movements' as const,
      title: 'Movimientos',
      description: 'Historial de entradas, salidas y ajustes',
      icon: Activity,
      color: 'text-green-600'
    },
    {
      type: 'warehouses' as const,
      title: 'Almacenes',
      description: 'Información de almacenes y su utilización',
      icon: Warehouse,
      color: 'text-orange-600'
    },
    {
      type: 'suppliers' as const,
      title: 'Proveedores',
      description: 'Lista completa de proveedores y contactos',
      icon: Users,
      color: 'text-purple-600'
    },
    {
      type: 'analytics' as const,
      title: 'Reporte Analytics',
      description: 'Resumen ejecutivo con KPIs principales',
      icon: Database,
      color: 'text-red-600'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Centro de Exportación</h2>
        <p className="text-muted-foreground">
          Exporta tus datos en diferentes formatos para análisis externo
        </p>
      </div>

      {/* Formatos disponibles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Formatos Disponibles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <FileSpreadsheet className="h-8 w-8 text-green-600" />
              <div>
                <div className="font-medium">Excel (.xls)</div>
                <div className="text-sm text-muted-foreground">
                  Para análisis avanzado
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <FileText className="h-8 w-8 text-blue-600" />
              <div>
                <div className="font-medium">CSV (.csv)</div>
                <div className="text-sm text-muted-foreground">
                  Compatible universal
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <FileText className="h-8 w-8 text-red-600" />
              <div>
                <div className="font-medium">PDF (.html)</div>
                <div className="text-sm text-muted-foreground">
                  Para reportes visuales
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Opciones de exportación */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {exportOptions.map((option) => (
          <Card key={option.type} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <option.icon className={`h-5 w-5 ${option.color}`} />
                {option.title}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {option.description}
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => exportData({ format: 'excel', dataType: option.type })}
                    disabled={loading === option.type}
                    className="flex-1"
                  >
                    {loading === option.type ? (
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <FileSpreadsheet className="h-4 w-4" />
                    )}
                    Excel
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => exportData({ format: 'csv', dataType: option.type })}
                    disabled={loading === option.type}
                    className="flex-1"
                  >
                    {loading === option.type ? (
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                    CSV
                  </Button>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => exportData({ format: 'pdf', dataType: option.type })}
                  disabled={loading === option.type}
                  className="w-full"
                >
                  {loading === option.type ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                  Reporte HTML
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Información adicional */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Información de Exportación
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-2">Datos Incluidos:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <strong>Productos:</strong> Stock real, precios, categorías, almacenes</li>
                <li>• <strong>Movimientos:</strong> Historial completo con razones</li>
                <li>• <strong>Almacenes:</strong> Utilización y valor por ubicación</li>
                <li>• <strong>Proveedores:</strong> Contactos y información completa</li>
                <li>• <strong>Analytics:</strong> KPIs y métricas principales</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium mb-2">Formatos Recomendados:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <strong>Excel:</strong> Para análisis y gráficos avanzados</li>
                <li>• <strong>CSV:</strong> Para importar en otros sistemas</li>
                <li>• <strong>HTML:</strong> Para reportes visuales y presentaciones</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
