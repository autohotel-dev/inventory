"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
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
    const supabase = createClient();
    setLoading(options.dataType);
    
    try {
      let data: any[] = [];
      let filename = '';
      
      switch (options.dataType) {
        case 'products':
          const { data: productsData } = await supabase
            .from("products")
            .select(`
              *,
              category:categories(name),
              stock:stock(qty, warehouse:warehouses(name, code))
            `);
          
          data = (productsData || []).map(product => {
            const totalStock = product.stock?.reduce((sum: number, s: any) => sum + (s.qty || 0), 0) || 0;
            const stockByWarehouse = product.stock?.map((s: any) => 
              `${s.warehouse?.name || 'N/A'}: ${s.qty || 0}`
            ).join('; ') || 'Sin stock';
            
            return {
              'SKU': product.sku,
              'Nombre': product.name,
              'Descripción': product.description || '',
              'Categoría': product.category?.name || 'Sin categoría',
              'Precio': product.price,
              'Costo': product.cost,
              'Stock Total': totalStock,
              'Stock Mínimo': product.min_stock,
              'Unidad': product.unit,
              'Stock por Almacén': stockByWarehouse,
              'Código de Barras': product.barcode || '',
              'Estado': product.is_active ? 'Activo' : 'Inactivo',
              'Valor Inventario': totalStock * product.price,
              'Margen (%)': product.cost > 0 ? (((product.price - product.cost) / product.cost) * 100).toFixed(2) : '0',
              'Fecha Creación': new Date(product.created_at).toLocaleDateString()
            };
          });
          filename = `productos_${new Date().toISOString().split('T')[0]}`;
          break;

        case 'movements':
          const { data: movementsData } = await supabase
            .from("inventory_movements")
            .select(`
              *,
              product:products(name, sku),
              warehouse:warehouses(name, code)
            `)
            .order("created_at", { ascending: false });
          
          data = (movementsData || []).map(movement => ({
            'Fecha': new Date(movement.created_at).toLocaleDateString(),
            'Hora': new Date(movement.created_at).toLocaleTimeString(),
            'Producto': movement.product?.name || 'Producto eliminado',
            'SKU': movement.product?.sku || 'N/A',
            'Almacén': movement.warehouse?.name || 'Almacén eliminado',
            'Código Almacén': movement.warehouse?.code || 'N/A',
            'Tipo': movement.movement_type === 'IN' ? 'Entrada' : 
                   movement.movement_type === 'OUT' ? 'Salida' : 'Ajuste',
            'Cantidad': movement.quantity,
            'Razón': movement.reason,
            'Notas': movement.notes || ''
          }));
          filename = `movimientos_${new Date().toISOString().split('T')[0]}`;
          break;

        case 'warehouses':
          const { data: warehousesData } = await supabase
            .from("warehouses")
            .select(`
              *,
              stock:stock(qty, product:products(name, price))
            `);
          
          data = (warehousesData || []).map(warehouse => {
            const totalProducts = warehouse.stock?.length || 0;
            const totalStock = warehouse.stock?.reduce((sum: number, s: any) => sum + (s.qty || 0), 0) || 0;
            const totalValue = warehouse.stock?.reduce((sum: number, s: any) => 
              sum + ((s.qty || 0) * (s.product?.price || 0)), 0
            ) || 0;
            
            return {
              'Código': warehouse.code,
              'Nombre': warehouse.name,
              'Dirección': warehouse.address || '',
              'Estado': warehouse.is_active ? 'Activo' : 'Inactivo',
              'Productos Únicos': totalProducts,
              'Stock Total': totalStock,
              'Valor Total': totalValue.toFixed(2),
              'Utilización (%)': Math.min((totalProducts / 100) * 100, 100).toFixed(1),
              'Fecha Creación': new Date(warehouse.created_at).toLocaleDateString()
            };
          });
          filename = `almacenes_${new Date().toISOString().split('T')[0]}`;
          break;

        case 'suppliers':
          const { data: suppliersData } = await supabase
            .from("suppliers")
            .select("*");
          
          data = (suppliersData || []).map(supplier => ({
            'Nombre': supplier.name,
            'Email': supplier.email || '',
            'Teléfono': supplier.phone || '',
            'Dirección': supplier.address || '',
            'Estado': supplier.is_active ? 'Activo' : 'Inactivo',
            'Fecha Creación': new Date(supplier.created_at).toLocaleDateString()
          }));
          filename = `proveedores_${new Date().toISOString().split('T')[0]}`;
          break;

        case 'analytics':
          // Crear reporte de analytics
          const { data: analyticsProducts } = await supabase
            .from("products")
            .select(`
              *,
              category:categories(name),
              stock:stock(qty)
            `);
          
          const { data: analyticsMovements } = await supabase
            .from("inventory_movements")
            .select("*")
            .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
          
          const totalProducts = analyticsProducts?.length || 0;
          const totalValue = analyticsProducts?.reduce((sum, p) => {
            const stock = p.stock?.reduce((s: number, st: any) => s + (st.qty || 0), 0) || 0;
            return sum + (stock * p.price);
          }, 0) || 0;
          
          const movementsByType = {
            IN: analyticsMovements?.filter(m => m.movement_type === 'IN').length || 0,
            OUT: analyticsMovements?.filter(m => m.movement_type === 'OUT').length || 0,
            ADJUSTMENT: analyticsMovements?.filter(m => m.movement_type === 'ADJUSTMENT').length || 0
          };
          
          data = [{
            'Fecha Reporte': new Date().toLocaleDateString(),
            'Total Productos': totalProducts,
            'Valor Total Inventario': totalValue.toFixed(2),
            'Movimientos Últimos 30 días': analyticsMovements?.length || 0,
            'Entradas (30 días)': movementsByType.IN,
            'Salidas (30 días)': movementsByType.OUT,
            'Ajustes (30 días)': movementsByType.ADJUSTMENT,
            'Productos Activos': analyticsProducts?.filter(p => p.is_active).length || 0,
            'Productos Inactivos': analyticsProducts?.filter(p => !p.is_active).length || 0
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
      ...data.map(row => 
        headers.map(header => {
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
      ...data.map(row => 
        headers.map(header => row[header]).join('\t')
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
              ${headers.map(header => `<th>${header}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${data.map(row => `
              <tr>
                ${headers.map(header => `<td>${row[header] || ''}</td>`).join('')}
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
