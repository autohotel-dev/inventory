"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
  DollarSign,
  ShoppingBag,
  RefreshCw,
  X,
  Clock,
  CheckCircle,
  AlertTriangle,
  Archive,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Users
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useUserRole } from "@/hooks/use-user-role";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SalesOrder {
  id: string;
  created_at: string;
  status: string;
  currency: string;
  subtotal: number;
  tax: number;
  total: number;
  created_by: string | null;
  customers: { name: string } | null;
  warehouses: { code: string; name: string } | null;
  employees: { first_name: string; last_name: string } | null;
  notes?: string;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  auth_user_id?: string | null;
}

interface Filters {
  search: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  minAmount: string;
  maxAmount: string;
  employeeId: string;
}

export function AdvancedSalesTable() {
  const [sales, setSales] = useState<SalesOrder[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const { canAccessAdmin, userId, employeeId } = useUserRole();
  const [filters, setFilters] = useState<Filters>({
    search: '',
    status: 'ALL',
    dateFrom: '',
    dateTo: '',
    minAmount: '',
    maxAmount: '',
    employeeId: 'ALL'
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

  // Cargar lista de empleados (para mostrar nombres y filtrar)
  const fetchEmployees = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("employees")
      .select("id, first_name, last_name, auth_user_id")
      .eq("is_active", true)
      .order("first_name");
    
    setEmployees(data || []);
  };

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
          created_by,
          customers!customer_id(name),
          warehouses!warehouse_id(code, name)
        `)
        .order("created_at", { ascending: false });

      // FILTRO POR ROL: Recepcionistas solo ven sus propias ventas
      if (!canAccessAdmin && userId) {
        query = query.eq('created_by', userId);
      }

      // Filtro por empleado específico (solo para admins)
      if (canAccessAdmin && filters.employeeId !== 'ALL') {
        // Buscar el auth_user_id del empleado seleccionado
        const selectedEmployee = employees.find(e => e.id === filters.employeeId);
        if (selectedEmployee?.auth_user_id) {
          query = query.eq('created_by', selectedEmployee.auth_user_id);
        }
      }

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
      const transformedData: SalesOrder[] = (data as any || []).map((item: any) => {
        // Buscar empleado por auth_user_id
        const employee = employees.find(e => e.auth_user_id === item.created_by);
        return {
          ...item,
          customers: item.customers || null,
          warehouses: item.warehouses || null,
          employees: employee ? { first_name: employee.first_name, last_name: employee.last_name } : null
        };
      });
      
      let filteredData = transformedData;
      
      // Filtro de búsqueda
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredData = filteredData.filter(sale => 
          sale.customers?.name?.toLowerCase().includes(searchLower) ||
          sale.id.toLowerCase().includes(searchLower) ||
          sale.notes?.toLowerCase().includes(searchLower) ||
          sale.employees?.first_name?.toLowerCase().includes(searchLower) ||
          sale.employees?.last_name?.toLowerCase().includes(searchLower)
        );
      }
      
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
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (employees.length > 0 || !canAccessAdmin) {
      fetchSales();
    }
  }, [filters, userId, canAccessAdmin, employees]);

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
      maxAmount: '',
      employeeId: 'ALL'
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

  const hasActiveFilters = Object.entries(filters).some(([key, value]) => 
    key !== 'status' ? value !== '' : value !== 'ALL'
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Órdenes de Venta</h1>
          <p className="text-sm text-muted-foreground">Gestiona todas las ventas de tu inventario</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button size="sm" asChild>
            <Link href="/sales/new">
              <Plus className="h-4 w-4 mr-2" />
              Nueva Venta
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards - Diseño compacto en una fila */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <StatCard 
          icon={<ShoppingBag className="h-4 w-4" />}
          label="Total"
          value={stats.total}
          color="blue"
        />
        <StatCard 
          icon={<DollarSign className="h-4 w-4" />}
          label="Ingresos"
          value={formatCurrency(stats.totalAmount)}
          color="emerald"
          isLarge
        />
        <StatCard 
          icon={<TrendingUp className="h-4 w-4" />}
          label="Abiertas"
          value={stats.open}
          color="blue"
        />
        <StatCard 
          icon={<Clock className="h-4 w-4" />}
          label="En Pagos"
          value={stats.pending}
          color="amber"
        />
        <StatCard 
          icon={<CheckCircle className="h-4 w-4" />}
          label="Completadas"
          value={stats.completed}
          color="emerald"
        />
        <StatCard 
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Canceladas"
          value={stats.cancelled}
          color="red"
        />
        <StatCard 
          icon={<Archive className="h-4 w-4" />}
          label="Finalizadas"
          value={stats.ended}
          color="slate"
        />
      </div>

      {/* Search & Filters */}
      <Card className="overflow-hidden">
        <CardContent className="p-4 space-y-4">
          {/* Search Bar con botones */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente, ID o notas..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={showFilters ? "secondary" : "outline"}
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="whitespace-nowrap"
              >
                <Filter className="h-4 w-4 mr-2" />
                Filtros
                {showFilters ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
              </Button>
              <Button variant="outline" size="icon" onClick={fetchSales} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Filtros activos como badges */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2">
              {filters.search && (
                <Badge variant="secondary" className="gap-1 pr-1">
                  Búsqueda: {filters.search}
                  <button onClick={() => handleFilterChange('search', '')} className="ml-1 hover:bg-muted rounded">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {filters.status !== 'ALL' && (
                <Badge variant="secondary" className="gap-1 pr-1">
                  Estado: {filters.status}
                  <button onClick={() => handleFilterChange('status', 'ALL')} className="ml-1 hover:bg-muted rounded">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {filters.dateFrom && (
                <Badge variant="secondary" className="gap-1 pr-1">
                  Desde: {filters.dateFrom}
                  <button onClick={() => handleFilterChange('dateFrom', '')} className="ml-1 hover:bg-muted rounded">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {filters.dateTo && (
                <Badge variant="secondary" className="gap-1 pr-1">
                  Hasta: {filters.dateTo}
                  <button onClick={() => handleFilterChange('dateTo', '')} className="ml-1 hover:bg-muted rounded">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {filters.employeeId !== 'ALL' && (
                <Badge variant="secondary" className="gap-1 pr-1">
                  Empleado: {employees.find(e => e.id === filters.employeeId)?.first_name || filters.employeeId}
                  <button onClick={() => handleFilterChange('employeeId', 'ALL')} className="ml-1 hover:bg-muted rounded">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 text-xs">
                Limpiar todo
              </Button>
            </div>
          )}

          {/* Advanced Filters - Expandible */}
          {showFilters && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-3 border-t animate-in slide-in-from-top-2 duration-200">
              <div className="space-y-1.5">
                <Label className="text-xs">Estado</Label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="w-full h-9 border rounded-md px-3 text-sm bg-background"
                >
                  <option value="ALL">Todos</option>
                  <option value="OPEN">Abierta</option>
                  <option value="PARTIAL">En Pagos</option>
                  <option value="COMPLETED">Completada</option>
                  <option value="ENDED">Finalizada</option>
                  <option value="CANCELLED">Cancelada</option>
                </select>
              </div>

              {/* Filtro por empleado - solo visible para admins */}
              {canAccessAdmin && (
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    Empleado
                  </Label>
                  <select
                    value={filters.employeeId}
                    onChange={(e) => handleFilterChange('employeeId', e.target.value)}
                    className="w-full h-9 border rounded-md px-3 text-sm bg-background"
                  >
                    <option value="ALL">Todos</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">Fecha Desde</Label>
                <Input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha Hasta</Label>
                <Input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Monto Mín.</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={filters.minAmount}
                  onChange={(e) => handleFilterChange('minAmount', e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Monto Máx.</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={filters.maxAmount}
                  onChange={(e) => handleFilterChange('maxAmount', e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sales Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Cargando órdenes...</p>
            </div>
          ) : sales.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="max-w-sm mx-auto">
                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <ShoppingBag className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <h3 className="text-lg font-medium mb-2">
                  {hasActiveFilters ? 'Sin resultados' : 'No hay ventas'}
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  {hasActiveFilters
                    ? 'Intenta ajustar los filtros'
                    : 'Crea tu primera orden de venta'
                  }
                </p>
                {!hasActiveFilters && (
                  <Button asChild size="sm">
                    <Link href="/sales/new">
                      <Plus className="h-4 w-4 mr-2" />
                      Nueva Venta
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/30 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Fecha</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Cliente</th>
                    {canAccessAdmin && (
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Vendedor</th>
                    )}
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Almacén</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Estado</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Total</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sales.map((sale) => (
                    <tr
                      key={sale.id}
                      className="hover:bg-muted/30 transition-colors group"
                    >
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium">{formatDate(sale.created_at)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium">{sale.customers?.name || 'Cliente general'}</div>
                        {sale.notes && (
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]">{sale.notes}</div>
                        )}
                      </td>
                      {canAccessAdmin && (
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <div className="text-sm text-muted-foreground">
                            {sale.employees 
                              ? `${sale.employees.first_name} ${sale.employees.last_name}`
                              : '-'
                            }
                          </div>
                        </td>
                      )}
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="text-sm text-muted-foreground">
                          {sale.warehouses ? `${sale.warehouses.code}` : '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getStatusBadge(sale.status)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-sm font-semibold">{formatCurrency(sale.total || 0, sale.currency)}</div>
                        {sale.subtotal !== sale.total && (
                          <div className="text-xs text-muted-foreground">Sub: {formatCurrency(sale.subtotal || 0, sale.currency)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          className="h-8 w-8 opacity-50 group-hover:opacity-100"
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

// Componente de stat card compacto
function StatCard({ 
  icon, 
  label, 
  value, 
  color,
  isLarge = false 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string | number;
  color: "blue" | "emerald" | "amber" | "red" | "slate";
  isLarge?: boolean;
}) {
  const colors = {
    blue: "text-blue-500 bg-blue-500/10",
    emerald: "text-emerald-500 bg-emerald-500/10",
    amber: "text-amber-500 bg-amber-500/10",
    red: "text-red-500 bg-red-500/10",
    slate: "text-slate-500 bg-slate-500/10",
  };

  return (
    <Card className={isLarge ? "col-span-2 sm:col-span-1" : ""}>
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-md ${colors[color]}`}>
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">{label}</p>
            <p className={`font-bold truncate ${isLarge ? 'text-lg' : 'text-base'}`}>{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
