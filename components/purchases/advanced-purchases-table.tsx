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
  Package,
  Truck,
  RefreshCw,
  X
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface PurchaseOrder {
  id: string;
  created_at: string;
  status: string;
  currency: string;
  subtotal: number;
  tax: number;
  total: number;
  suppliers: { name: string } | null;
  warehouses: { code: string; name: string } | null;
  notes?: string;
}

interface SupabasePurchaseOrder {
  id: string;
  created_at: string;
  status: string;
  currency: string;
  subtotal: number;
  tax: number;
  total: number;
  suppliers: { name: string }[] | null;
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

export function AdvancedPurchasesTable() {
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
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
    received: 0
  });

  const fetchPurchases = async () => {
    setLoading(true);
    const supabase = createClient();
    
    try {
      let query = supabase
        .from("purchase_orders")
        .select(`
          id,
          created_at,
          status,
          currency,
          subtotal,
          tax,
          total,
          notes,
          suppliers!supplier_id(name),
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
      const transformedData: PurchaseOrder[] = (data as SupabasePurchaseOrder[] || []).map(item => ({
        ...item,
        suppliers: item.suppliers && item.suppliers.length > 0 ? item.suppliers[0] : null,
        warehouses: item.warehouses && item.warehouses.length > 0 ? item.warehouses[0] : null
      }));
      
      let filteredData = transformedData;
      
      // Filtro de búsqueda (cliente)
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredData = filteredData.filter(purchase => 
          purchase.suppliers?.name?.toLowerCase().includes(searchLower) ||
          purchase.id.toLowerCase().includes(searchLower) ||
          purchase.notes?.toLowerCase().includes(searchLower)
        );
      }
      
      setPurchases(filteredData);
      
      // Calcular estadísticas
      const totalAmount = filteredData.reduce((sum, p) => sum + (p.total || 0), 0);
      const pending = filteredData.filter(p => p.status === 'OPEN').length;
      const received = filteredData.filter(p => p.status === 'RECEIVED').length;
      
      setStats({
        total: filteredData.length,
        totalAmount,
        pending,
        received
      });
      
    } catch (error) {
      console.error('Error fetching purchases:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
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
      'RECEIVED': 'secondary',
      'CANCELLED': 'destructive'
    } as const;
    
    const labels = {
      'OPEN': 'Abierta',
      'RECEIVED': 'Recibida',
      'CANCELLED': 'Cancelada'
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
    const headers = ['ID', 'Fecha', 'Proveedor', 'Almacén', 'Estado', 'Subtotal', 'Impuesto', 'Total', 'Moneda'];
    const csvContent = [
      headers.join(','),
      ...purchases.map(p => [
        p.id,
        formatDate(p.created_at),
        p.suppliers?.name || 'N/A',
        `${p.warehouses?.code} - ${p.warehouses?.name}` || 'N/A',
        p.status,
        p.subtotal || 0,
        p.tax || 0,
        p.total || 0,
        p.currency
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compras_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Órdenes de Compra</h1>
          <p className="text-muted-foreground">Gestiona todas las compras de tu inventario</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button asChild>
            <Link href="/purchases/new">
              <Plus className="h-4 w-4 mr-2" />
              Nueva Compra
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-600" />
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
                <p className="text-sm text-muted-foreground">Monto Total</p>
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
              <Truck className="h-4 w-4 text-purple-600" />
              <div>
                <p className="text-sm text-muted-foreground">Recibidas</p>
                <p className="text-2xl font-bold">{stats.received}</p>
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
              <Button variant="outline" size="sm" onClick={fetchPurchases}>
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
              placeholder="Buscar por proveedor, ID o notas..."
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
                  <option value="RECEIVED">Recibida</option>
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

      {/* Purchases Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>Cargando órdenes de compra...</p>
            </div>
          ) : purchases.length === 0 ? (
            <div className="p-8 text-center">
              <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No hay órdenes de compra</h3>
              <p className="text-muted-foreground mb-4">
                {Object.values(filters).some(f => f !== '' && f !== 'ALL') 
                  ? 'No se encontraron órdenes con los filtros aplicados'
                  : 'Comienza creando tu primera orden de compra'
                }
              </p>
              <Button asChild>
                <Link href="/purchases/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Nueva Compra
                </Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="text-left p-4 font-medium">Fecha</th>
                    <th className="text-left p-4 font-medium">Proveedor</th>
                    <th className="text-left p-4 font-medium">Almacén</th>
                    <th className="text-left p-4 font-medium">Estado</th>
                    <th className="text-right p-4 font-medium">Subtotal</th>
                    <th className="text-right p-4 font-medium">Impuesto</th>
                    <th className="text-right p-4 font-medium">Total</th>
                    <th className="text-center p-4 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((purchase) => (
                    <tr key={purchase.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="p-4">
                        <div className="text-sm">
                          {formatDate(purchase.created_at)}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-medium">
                          {purchase.suppliers?.name || 'Sin proveedor'}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm">
                          {purchase.warehouses ? 
                            `${purchase.warehouses.code} - ${purchase.warehouses.name}` : 
                            'Sin almacén'
                          }
                        </div>
                      </td>
                      <td className="p-4">
                        {getStatusBadge(purchase.status)}
                      </td>
                      <td className="p-4 text-right">
                        {formatCurrency(purchase.subtotal || 0, purchase.currency)}
                      </td>
                      <td className="p-4 text-right">
                        {formatCurrency(purchase.tax || 0, purchase.currency)}
                      </td>
                      <td className="p-4 text-right font-medium">
                        {formatCurrency(purchase.total || 0, purchase.currency)}
                      </td>
                      <td className="p-4 text-center">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/purchases/${purchase.id}`}>
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
