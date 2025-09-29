"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Search, 
  Filter, 
  Download, 
  Plus, 
  Eye, 
  Calendar,
  DollarSign,
  ShoppingBag,
  Users,
  RefreshCw,
  X
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface SalesOrder {
  id: string;
  created_at: string;
  status: string;
  currency: string;
  subtotal: number;
  tax: number;
  total: number;
  customers: { name: string } | null;
  warehouses: { code: string; name: string } | null;
  notes?: string;
}

interface SupabaseSalesOrder {
  id: string;
  created_at: string;
  status: string;
  currency: string;
  subtotal: number;
  tax: number;
  total: number;
  customers: { name: string }[] | null;
  warehouses: { code: string; name: string }[] | null;
  notes?: string;
}

interface Filters {
  search: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  minAmount: string;
  maxAmount: string;
}

export function AdvancedSalesTable() {
  const [sales, setSales] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    search: '',
    status: 'ALL',
    dateFrom: '',
    dateTo: '',
    minAmount: '',
    maxAmount: ''
  });
  const [stats, setStats] = useState({
    total: 0,
    totalAmount: 0,
    pending: 0,
    completed: 0
  });

  const fetchSales = async () => {
    setLoading(true);
    const supabase = createClient();
    
    try {
      let query = supabase
        .from("sales_orders")
        .select(`
          id,
          created_at,
          status,
          currency,
          subtotal,
          tax,
          total,
          notes,
          customers!customer_id(name),
          warehouses!warehouse_id(code, name)
        `)
        .order("created_at", { ascending: false });

      // Aplicar filtros
      if (filters.status !== 'ALL') {
        query = query.eq('status', filters.status);
      }
      
      if (filters.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }
      
      if (filters.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }
      
      if (filters.minAmount) {
        query = query.gte('total', parseFloat(filters.minAmount));
      }
      
      if (filters.maxAmount) {
        query = query.lte('total', parseFloat(filters.maxAmount));
      }

      const { data, error } = await query;
      
      if (error) throw error;
      
      // Transformar datos de Supabase al formato esperado
      const transformedData: SalesOrder[] = (data as SupabaseSalesOrder[] || []).map(item => ({
        ...item,
        customers: item.customers && item.customers.length > 0 ? item.customers[0] : null,
        warehouses: item.warehouses && item.warehouses.length > 0 ? item.warehouses[0] : null
      }));
      
      let filteredData = transformedData;
      
      // Filtro de búsqueda
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredData = filteredData.filter(sale => 
          sale.customers?.name?.toLowerCase().includes(searchLower) ||
          sale.id.toLowerCase().includes(searchLower) ||
          sale.notes?.toLowerCase().includes(searchLower)
        );
      }
      
      setSales(filteredData);
      
      // Calcular estadísticas
      const totalAmount = filteredData.reduce((sum, s) => sum + (s.total || 0), 0);
      const pending = filteredData.filter(s => s.status === 'OPEN').length;
      const completed = filteredData.filter(s => s.status === 'COMPLETED').length;
      
      setStats({
        total: filteredData.length,
        totalAmount,
        pending,
        completed
      });
      
    } catch (error) {
      console.error('Error fetching sales:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, [filters]);

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      status: 'ALL',
      dateFrom: '',
      dateTo: '',
      minAmount: '',
      maxAmount: ''
    });
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      'OPEN': 'default',
      'COMPLETED': 'secondary',
      'CANCELLED': 'destructive',
      'SHIPPED': 'outline'
    } as const;
    
    const labels = {
      'OPEN': 'Abierta',
      'COMPLETED': 'Completada',
      'CANCELLED': 'Cancelada',
      'SHIPPED': 'Enviada'
    };
    
    return (
      <Badge variant={variants[status as keyof typeof variants] || 'outline'}>
        {labels[status as keyof typeof labels] || status}
      </Badge>
    );
  };

  const formatCurrency = (amount: number, currency: string = 'MXN') => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const exportToCSV = () => {
    const headers = ['ID', 'Fecha', 'Cliente', 'Almacén', 'Estado', 'Subtotal', 'Impuesto', 'Total', 'Moneda'];
    const csvContent = [
      headers.join(','),
      ...sales.map(s => [
        s.id,
        formatDate(s.created_at),
        s.customers?.name || 'Cliente general',
        `${s.warehouses?.code} - ${s.warehouses?.name}` || 'N/A',
        s.status,
        s.subtotal || 0,
        s.tax || 0,
        s.total || 0,
        s.currency
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ventas_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Órdenes de Venta</h1>
          <p className="text-muted-foreground">Gestiona todas las ventas de tu inventario</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button asChild>
            <Link href="/sales/new">
              <Plus className="h-4 w-4 mr-2" />
              Nueva Venta
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total Órdenes</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Ingresos Total</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-orange-600" />
              <div>
                <p className="text-sm text-muted-foreground">Pendientes</p>
                <p className="text-2xl font-bold">{stats.pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-600" />
              <div>
                <p className="text-sm text-muted-foreground">Completadas</p>
                <p className="text-2xl font-bold">{stats.completed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Filtros</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 mr-2" />
                {showFilters ? 'Ocultar' : 'Mostrar'} Filtros
              </Button>
              <Button variant="outline" size="sm" onClick={fetchSales}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente, ID o notas..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 pt-4 border-t">
              <div className="space-y-2">
                <Label>Estado</Label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm"
                >
                  <option value="ALL">Todos</option>
                  <option value="OPEN">Abierta</option>
                  <option value="COMPLETED">Completada</option>
                  <option value="SHIPPED">Enviada</option>
                  <option value="CANCELLED">Cancelada</option>
                </select>
              </div>
              
              <div className="space-y-2">
                <Label>Fecha Desde</Label>
                <Input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Fecha Hasta</Label>
                <Input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Monto Mín.</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={filters.minAmount}
                  onChange={(e) => handleFilterChange('minAmount', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Monto Máx.</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={filters.maxAmount}
                  onChange={(e) => handleFilterChange('maxAmount', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>&nbsp;</Label>
                <Button variant="outline" onClick={clearFilters} className="w-full">
                  <X className="h-4 w-4 mr-2" />
                  Limpiar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sales Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>Cargando órdenes de venta...</p>
            </div>
          ) : sales.length === 0 ? (
            <div className="p-8 text-center">
              <ShoppingBag className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No hay órdenes de venta</h3>
              <p className="text-muted-foreground mb-4">
                {Object.values(filters).some(f => f !== '' && f !== 'ALL') 
                  ? 'No se encontraron órdenes con los filtros aplicados'
                  : 'Comienza creando tu primera orden de venta'
                }
              </p>
              <Button asChild>
                <Link href="/sales/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Nueva Venta
                </Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="text-left p-4 font-medium">Fecha</th>
                    <th className="text-left p-4 font-medium">Cliente</th>
                    <th className="text-left p-4 font-medium">Almacén</th>
                    <th className="text-left p-4 font-medium">Estado</th>
                    <th className="text-right p-4 font-medium">Subtotal</th>
                    <th className="text-right p-4 font-medium">Impuesto</th>
                    <th className="text-right p-4 font-medium">Total</th>
                    <th className="text-center p-4 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr key={sale.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="p-4">
                        <div className="text-sm">
                          {formatDate(sale.created_at)}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-medium">
                          {sale.customers?.name || 'Cliente general'}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm">
                          {sale.warehouses ? 
                            `${sale.warehouses.code} - ${sale.warehouses.name}` : 
                            'Sin almacén'
                          }
                        </div>
                      </td>
                      <td className="p-4">
                        {getStatusBadge(sale.status)}
                      </td>
                      <td className="p-4 text-right">
                        {formatCurrency(sale.subtotal || 0, sale.currency)}
                      </td>
                      <td className="p-4 text-right">
                        {formatCurrency(sale.tax || 0, sale.currency)}
                      </td>
                      <td className="p-4 text-right font-medium">
                        {formatCurrency(sale.total || 0, sale.currency)}
                      </td>
                      <td className="p-4 text-center">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/sales/${sale.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
