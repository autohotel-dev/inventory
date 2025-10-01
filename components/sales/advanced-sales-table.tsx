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
  X,
  Clock,
  CheckCircle,
  AlertTriangle,
  Archive,
  TrendingUp
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
  customers: { name: string } | null;
  warehouses: { code: string; name: string } | null;
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
    completed: 0,
    cancelled: 0,
    open: 0,
    ended: 0
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
      const transformedData: SalesOrder[] = (data as any || []).map((item: any) => ({
        ...item,
        customers: item.customers || null,
        warehouses: item.warehouses || null
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
      
      console.log("Data filtrada: ", filteredData);
      
      setSales(filteredData);
      
      // Calcular estadísticas
      const totalAmount = filteredData.reduce((sum, s) => sum + (s.total || 0), 0);
      const pending = filteredData.filter(s => s.status === 'PARTIAL').length;
      const completed = filteredData.filter(s => s.status === 'COMPLETED').length;
      const cancelled = filteredData.filter(s => s.status === 'CANCELLED').length;
      const open = filteredData.filter(s => s.status === 'OPEN').length;
      const ended = filteredData.filter(s => s.status === 'ENDED').length;
      
      setStats({
        total: filteredData.length,
        totalAmount,
        pending,
        completed,
        cancelled,
        open,
        ended
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
      'PARTIAL': 'outline',
      'CANCELLED': 'destructive',
      'ENDED': 'outline',
      'SHIPPED': 'default'
    } as const;

    const colors = {
      'OPEN': 'bg-primary/10 text-primary border-primary/20',
      'COMPLETED': 'bg-green-100 text-green-800 border-green-300',
      'PARTIAL': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'CANCELLED': 'bg-destructive/10 text-destructive border-destructive/20',
      'ENDED': 'bg-muted text-muted-foreground border-border',
      'SHIPPED': 'bg-blue-100 text-blue-800 border-blue-300'
    } as const;

    const labels = {
      'OPEN': 'Abierta',
      'COMPLETED': 'Completada',
      'PARTIAL': 'En Pagos',
      'CANCELLED': 'Cancelada',
      'ENDED': 'Finalizada',
      'SHIPPED': 'Enviada'
    };

    return (
      <Badge
        variant={variants[status as keyof typeof variants] || 'outline'}
        className={`font-medium text-xs ${colors[status as keyof typeof colors] || 'bg-muted text-muted-foreground border-border'}`}
      >
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
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Activas</p>
                <p className="text-2xl font-bold">{stats.open}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600" />
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
              <CheckCircle className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Completadas</p>
                <p className="text-2xl font-bold">{stats.completed}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
            <CardContent className="p-4">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <div>
                        <p className="text-sm text-muted-foreground">Canceladas</p>
                        <p className="text-2xl font-bold">{stats.cancelled}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Archive className="h-4 w-4 text-slate-600" />
              <div>
                <p className="text-sm text-muted-foreground">Finalizadas</p>
                <p className="text-2xl font-bold">{stats.ended}</p>
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
            <div className="text-center py-16 px-4">
              <div className="max-w-sm mx-auto">
                <ShoppingBag className="h-16 w-16 mx-auto mb-6 text-muted-foreground/50" />
                <h3 className="text-xl font-semibold text-muted-foreground mb-3">
                  {Object.values(filters).some(f => f !== '' && f !== 'ALL')
                    ? 'No se encontraron órdenes'
                    : 'No hay órdenes de venta'
                  }
                </h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  {Object.values(filters).some(f => f !== '' && f !== 'ALL')
                    ? 'Intenta ajustar los filtros o crear una nueva búsqueda'
                    : 'Comienza creando tu primera orden de venta para ver los datos aquí'
                  }
                </p>
                <Button asChild className="shadow-sm">
                  <Link href="/sales/new">
                    <Plus className="h-4 w-4 mr-2" />
                    Nueva Venta
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
              <table className="w-full">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left p-4 font-semibold text-muted-foreground">Fecha</th>
                    <th className="text-center p-4 font-semibold text-muted-foreground">Cliente</th>
                    <th className="text-center p-4 font-semibold text-muted-foreground">Almacén</th>
                    <th className="text-center p-4 font-semibold text-muted-foreground">Estado</th>
                    <th className="text-center p-4 font-semibold text-muted-foreground">Subtotal</th>
                    <th className="text-center p-4 font-semibold text-muted-foreground">Impuesto</th>
                    <th className="text-center p-4 font-semibold text-muted-foreground">Total</th>
                    <th className="text-center p-4 font-semibold text-muted-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale, index) => (
                    <tr
                      key={sale.id}
                      className="border-b hover:bg-muted/30 transition-all duration-200 hover:shadow-sm group"
                      style={{
                        backgroundColor: index % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)'
                      }}
                    >
                      <td className="p-4">
                        <div className="text-sm font-medium text-foreground">
                          {formatDate(sale.created_at)}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-center text-foreground">
                          {sale.customers?.name || 'Cliente general'}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-center text-muted-foreground">
                          {sale.warehouses ?
                            `${sale.warehouses.code} - ${sale.warehouses.name}` :
                            'Sin almacén'
                          }
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex justify-center">
                          {getStatusBadge(sale.status)}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <Badge variant="secondary" className="font-mono text-xs bg-muted/50 text-muted-foreground border-border">
                          {formatCurrency(sale.subtotal || 0, sale.currency)}
                        </Badge>
                      </td>
                      <td className="p-4 text-center">
                        <Badge variant="outline" className="font-mono text-xs bg-muted/30 text-muted-foreground border-border">
                          {formatCurrency(sale.tax || 0, sale.currency)}
                        </Badge>
                      </td>
                      <td className="p-4 text-center">
                        <Badge variant="default" className="font-mono text-xs bg-primary text-primary-foreground border-primary/20">
                          {formatCurrency(sale.total || 0, sale.currency)}
                        </Badge>
                      </td>
                      <td className="p-4 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="opacity-70 group-hover:opacity-100 transition-opacity"
                        >
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
