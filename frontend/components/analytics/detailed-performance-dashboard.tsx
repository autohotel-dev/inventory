"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { InefficiencyAlerts } from "./inefficiency-alerts";
import { 
  Users, 
  Car, 
  MonitorCheck, 
  Sparkles, 
  Clock, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Briefcase
} from "lucide-react";
import { format, subDays } from "date-fns";
import { es } from "date-fns/locale";

interface CocheroKPI {
  employee_id: string;
  employee_name: string;
  total_checkins: number;
  avg_checkin_time_minutes: number;
  total_checkouts: number;
  avg_checkout_time_minutes: number;
  total_services: number;
  is_active?: boolean;
}

interface ReceptionistKPI {
  employee_id: string;
  employee_name: string;
  total_entries_processed: number;
  total_exits_processed: number;
  total_extras_charged: number;
  total_revenue: number;
  anomalies_detected: number;
  is_active?: boolean;
}

interface CamaristaKPI {
  employee_id: string;
  employee_name: string;
  total_rooms_cleaned: number;
  avg_cleaning_time_minutes: number;
  currently_cleaning: number;
  is_active?: boolean;
}

export function DetailedPerformanceDashboard() {
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });

  const [cocheros, setCocheros] = useState<CocheroKPI[]>([]);
  const [receptionists, setReceptionists] = useState<ReceptionistKPI[]>([]);
  const [camaristas, setCamaristas] = useState<CamaristaKPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');

  const filteredCocheros = cocheros.filter(c => statusFilter === 'all' ? true : statusFilter === 'active' ? (c.is_active !== false) : (c.is_active === false));
  const filteredReceptionists = receptionists.filter(r => statusFilter === 'all' ? true : statusFilter === 'active' ? (r.is_active !== false) : (r.is_active === false));
  const filteredCamaristas = camaristas.filter(c => statusFilter === 'all' ? true : statusFilter === 'active' ? (c.is_active !== false) : (c.is_active === false));

  useEffect(() => {
    const fetchKPIs = async () => {
      setLoading(true);
            
      try {
        const [cocherosRes, receptionistsRes, camaristasRes] = await Promise.allSettled([
          apiClient.get("/analytics/employee-performance", { params: { role: "cochero", start_date: dateRange.start, end_date: dateRange.end } }),
          apiClient.get("/analytics/employee-performance", { params: { role: "receptionist", start_date: dateRange.start, end_date: dateRange.end } }),
          apiClient.get("/analytics/employee-performance", { params: { role: "camarista", start_date: dateRange.start, end_date: dateRange.end } }),
        ]);

        if (cocherosRes.status === 'fulfilled') {
          const d = cocherosRes.value.data;
          const items = Array.isArray(d) ? d : (d?.items || d?.results || []);
          setCocheros(items.filter((i: any) => i.role === 'cochero' || i.role === 'valet').map((i: any) => ({
            employee_id: i.id || i.employee_id,
            employee_name: i.name || i.employee_name,
            total_checkins: i.checkIns ?? i.total_checkins ?? 0,
            avg_checkin_time_minutes: i.avgStayTime ?? i.avg_checkin_time_minutes ?? 0,
            total_checkouts: i.checkOuts ?? i.total_checkouts ?? 0,
            avg_checkout_time_minutes: i.avgStayTime ?? i.avg_checkout_time_minutes ?? 0,
            total_services: (i.checkIns ?? 0) + (i.checkOuts ?? 0) + (i.total_services ?? 0),
            is_active: i.status !== 'inactive'
          })));
        }
        if (receptionistsRes.status === 'fulfilled') {
          const d = receptionistsRes.value.data;
          const items = Array.isArray(d) ? d : (d?.items || d?.results || []);
          setReceptionists(items.filter((i: any) => i.role === 'receptionist').map((i: any) => ({
            employee_id: i.id || i.employee_id,
            employee_name: i.name || i.employee_name,
            total_entries_processed: i.checkIns ?? i.total_entries_processed ?? 0,
            total_exits_processed: i.checkOuts ?? i.total_exits_processed ?? 0,
            total_extras_charged: i.total_extras_charged ?? 0,
            total_revenue: i.revenue ?? i.total_revenue ?? 0,
            anomalies_detected: i.anomalies_detected ?? 0,
            is_active: i.status !== 'inactive'
          })));
        }
        if (camaristasRes.status === 'fulfilled') {
          const d = camaristasRes.value.data;
          const items = Array.isArray(d) ? d : (d?.items || d?.results || []);
          setCamaristas(items.filter((i: any) => i.role === 'camarista' || i.role === 'cleaner').map((i: any) => ({
            employee_id: i.id || i.employee_id,
            employee_name: i.name || i.employee_name,
            total_rooms_cleaned: i.checkIns ?? i.total_rooms_cleaned ?? 0,
            avg_cleaning_time_minutes: i.avgStayTime ?? i.avg_cleaning_time_minutes ?? 0,
            currently_cleaning: i.currently_cleaning ?? 0,
            is_active: i.status !== 'inactive'
          })));
        }
      } catch (error) {
        console.error("Error fetching detailed KPIs:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchKPIs();
  }, [dateRange.start, dateRange.end]);

  return (
    <div className="space-y-4 md:space-y-8 animate-in fade-in duration-500">
      {/* Header section */}
      <div className="flex flex-col gap-3 md:gap-4 md:flex-row md:items-center md:justify-between bg-gradient-to-r from-background to-muted p-4 md:p-6 rounded-xl md:rounded-2xl border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20 flex-shrink-0">
            <Activity className="h-5 w-5 md:h-8 md:w-8 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
              Tiempos y Rendimiento
            </h1>
            <p className="text-muted-foreground text-xs md:text-sm font-medium hidden sm:block">
              Análisis detallado de eficiencia por departamento
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 bg-background border rounded-lg text-sm font-medium focus:ring-2 focus:ring-primary h-9"
          >
            <option value="active">Personal Activo</option>
            <option value="inactive">Personal Inactivo</option>
            <option value="all">Todos</option>
          </select>
          <div className="flex items-center gap-2">
            <input 
              type="date" 
              value={dateRange.start} 
              onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="px-2 py-2 bg-background border rounded-lg text-xs md:text-sm font-medium focus:ring-2 focus:ring-primary h-9 flex-1 min-w-0"
            />
            <span className="text-muted-foreground text-xs">a</span>
            <input 
              type="date" 
              value={dateRange.end} 
              onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="px-2 py-2 bg-background border rounded-lg text-xs md:text-sm font-medium focus:ring-2 focus:ring-primary h-9 flex-1 min-w-0"
            />
          </div>
        </div>
      </div>

      {/* Alertas Críticas */}
      <InefficiencyAlerts />

      <Tabs defaultValue="cocheros" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4 md:mb-8 h-10 md:h-14 bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="cocheros" className="rounded-lg text-xs md:text-base font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm gap-1 md:gap-2 px-1 md:px-3">
            <Car className="h-3.5 w-3.5 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Cocheros</span>
            <span className="sm:hidden">Valet</span>
          </TabsTrigger>
          <TabsTrigger value="recepcion" className="rounded-lg text-xs md:text-base font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm gap-1 md:gap-2 px-1 md:px-3">
            <MonitorCheck className="h-3.5 w-3.5 md:h-4 md:w-4" />
            Recepción
          </TabsTrigger>
          <TabsTrigger value="camaristas" className="rounded-lg text-xs md:text-base font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm gap-1 md:gap-2 px-1 md:px-3">
            <Sparkles className="h-3.5 w-3.5 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Camaristas</span>
            <span className="sm:hidden">Limpieza</span>
          </TabsTrigger>
        </TabsList>

        {/* ======================= COCHEROS ======================= */}
        <TabsContent value="cocheros" className="space-y-6">
          <div className="grid grid-cols-3 gap-2 md:gap-6">
            <Card className="bg-gradient-to-br from-blue-500/10 to-transparent border-0 shadow-sm">
              <CardContent className="p-3 md:p-6">
                <div className="p-2 md:p-3 bg-blue-500/20 rounded-lg md:rounded-xl text-blue-600 w-fit mb-2 md:mb-4">
                  <Clock className="h-4 w-4 md:h-5 md:w-5" />
                </div>
                <h4 className="text-[10px] md:text-sm font-medium text-muted-foreground mb-1">Entrada Prom.</h4>
                <div className="text-lg md:text-3xl font-bold">
                  {filteredCocheros.length > 0 ? Math.round(filteredCocheros.reduce((a, b) => a + Number(b.avg_checkin_time_minutes), 0) / filteredCocheros.length) : 0}<span className="text-xs md:text-base"> min</span>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-indigo-500/10 to-transparent border-0 shadow-sm">
              <CardContent className="p-3 md:p-6">
                <div className="p-2 md:p-3 bg-indigo-500/20 rounded-lg md:rounded-xl text-indigo-600 w-fit mb-2 md:mb-4">
                  <Clock className="h-4 w-4 md:h-5 md:w-5" />
                </div>
                <h4 className="text-[10px] md:text-sm font-medium text-muted-foreground mb-1">Salida Prom.</h4>
                <div className="text-lg md:text-3xl font-bold">
                  {filteredCocheros.length > 0 ? Math.round(filteredCocheros.reduce((a, b) => a + Number(b.avg_checkout_time_minutes), 0) / filteredCocheros.length) : 0}<span className="text-xs md:text-base"> min</span>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-emerald-500/10 to-transparent border-0 shadow-sm">
              <CardContent className="p-3 md:p-6">
                <div className="p-2 md:p-3 bg-emerald-500/20 rounded-lg md:rounded-xl text-emerald-600 w-fit mb-2 md:mb-4">
                  <Briefcase className="h-4 w-4 md:h-5 md:w-5" />
                </div>
                <h4 className="text-[10px] md:text-sm font-medium text-muted-foreground mb-1">Servicios</h4>
                <div className="text-lg md:text-3xl font-bold text-emerald-700 dark:text-emerald-400">
                  {filteredCocheros.reduce((a, b) => a + Number(b.total_services), 0)}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs md:text-sm text-left">
                <thead className="text-[10px] md:text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                  <tr>
                    <th className="px-3 md:px-6 py-3 md:py-4 font-bold">Cochero</th>
                    <th className="px-3 md:px-6 py-3 md:py-4 font-bold"><span className="hidden md:inline">Vehículos </span>Recibidos</th>
                    <th className="px-3 md:px-6 py-3 md:py-4 font-bold"><span className="hidden md:inline">Tiempo Prom. </span>Entrada</th>
                    <th className="px-3 md:px-6 py-3 md:py-4 font-bold hidden md:table-cell">Entregados</th>
                    <th className="px-3 md:px-6 py-3 md:py-4 font-bold"><span className="hidden md:inline">Tiempo Prom. </span>Salida</th>
                    <th className="px-3 md:px-6 py-3 md:py-4 font-bold hidden md:table-cell">Servicios</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Cargando...</td></tr>
                  ) : filteredCocheros.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No hay datos en este periodo</td></tr>
                  ) : filteredCocheros.map(c => (
                    <tr key={c.employee_id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-3 md:px-6 py-3 md:py-4 font-semibold">{c.employee_name}</td>
                      <td className="px-3 md:px-6 py-3 md:py-4">{c.total_checkins}</td>
                      <td className="px-3 md:px-6 py-3 md:py-4">
                        <span className={`font-semibold ${Number(c.avg_checkin_time_minutes) > 5 ? 'text-red-500' : 'text-green-500'}`}>
                          {c.avg_checkin_time_minutes || 0} min
                        </span>
                      </td>
                      <td className="px-3 md:px-6 py-3 md:py-4 hidden md:table-cell">{c.total_checkouts}</td>
                      <td className="px-3 md:px-6 py-3 md:py-4">
                        <span className={`font-semibold ${Number(c.avg_checkout_time_minutes) > 10 ? 'text-red-500' : 'text-green-500'}`}>
                          {c.avg_checkout_time_minutes || 0} min
                        </span>
                      </td>
                      <td className="px-3 md:px-6 py-3 md:py-4 hidden md:table-cell">{c.total_services}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ======================= RECEPCION ======================= */}
        <TabsContent value="recepcion" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-6">
            <Card className="bg-gradient-to-br from-indigo-500/10 to-transparent border-0 shadow-sm">
              <CardContent className="p-3 md:p-6">
                <h4 className="text-[10px] md:text-sm font-medium text-muted-foreground mb-1 md:mb-2">Entradas</h4>
                <div className="text-lg md:text-3xl font-bold">{filteredReceptionists.reduce((a, b) => a + Number(b.total_entries_processed), 0)}</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-purple-500/10 to-transparent border-0 shadow-sm">
              <CardContent className="p-3 md:p-6">
                <h4 className="text-[10px] md:text-sm font-medium text-muted-foreground mb-1 md:mb-2">Salidas</h4>
                <div className="text-lg md:text-3xl font-bold">{filteredReceptionists.reduce((a, b) => a + Number(b.total_exits_processed), 0)}</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-emerald-500/10 to-transparent border-0 shadow-sm">
              <CardContent className="p-3 md:p-6">
                <h4 className="text-[10px] md:text-sm font-medium text-muted-foreground mb-1 md:mb-2">Extras</h4>
                <div className="text-lg md:text-3xl font-bold text-emerald-600">{filteredReceptionists.reduce((a, b) => a + Number(b.total_extras_charged), 0)}</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-amber-500/10 to-transparent border-0 shadow-sm">
              <CardContent className="p-3 md:p-6">
                <h4 className="text-[10px] md:text-sm font-medium text-muted-foreground mb-1 md:mb-2">Anomalías</h4>
                <div className="text-lg md:text-3xl font-bold text-amber-600">{filteredReceptionists.reduce((a, b) => a + Number(b.anomalies_detected), 0)}</div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs md:text-sm text-left">
                <thead className="text-[10px] md:text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                  <tr>
                    <th className="px-3 md:px-6 py-3 md:py-4 font-bold">Nombre</th>
                    <th className="px-3 md:px-6 py-3 md:py-4 font-bold">Entradas</th>
                    <th className="px-3 md:px-6 py-3 md:py-4 font-bold">Salidas</th>
                    <th className="px-3 md:px-6 py-3 md:py-4 font-bold hidden md:table-cell">Extras</th>
                    <th className="px-3 md:px-6 py-3 md:py-4 font-bold">Ingresos</th>
                    <th className="px-3 md:px-6 py-3 md:py-4 font-bold hidden md:table-cell">Anomalías</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Cargando...</td></tr>
                  ) : filteredReceptionists.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No hay datos en este periodo</td></tr>
                  ) : filteredReceptionists.map(r => (
                    <tr key={r.employee_id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-3 md:px-6 py-3 md:py-4 font-semibold">{r.employee_name}</td>
                      <td className="px-3 md:px-6 py-3 md:py-4">{r.total_entries_processed}</td>
                      <td className="px-3 md:px-6 py-3 md:py-4">{r.total_exits_processed}</td>
                      <td className="px-3 md:px-6 py-3 md:py-4 hidden md:table-cell">{r.total_extras_charged}</td>
                      <td className="px-3 md:px-6 py-3 md:py-4 font-medium text-green-600 dark:text-green-400">
                        ${Number(r.total_revenue).toLocaleString('es-MX', { minimumFractionDigits: 0 })}
                      </td>
                      <td className="px-3 md:px-6 py-3 md:py-4 hidden md:table-cell">
                        {Number(r.anomalies_detected) > 0 ? (
                          <Badge variant="destructive">{r.anomalies_detected}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ======================= CAMARISTAS ======================= */}
        <TabsContent value="camaristas" className="space-y-6">
          <div className="grid grid-cols-3 gap-2 md:gap-6">
            <Card className="bg-gradient-to-br from-cyan-500/10 to-transparent border-0 shadow-sm">
              <CardContent className="p-3 md:p-6">
                <div className="p-2 md:p-3 bg-cyan-500/20 rounded-lg md:rounded-xl text-cyan-600 w-fit mb-2 md:mb-4">
                  <Sparkles className="h-4 w-4 md:h-5 md:w-5" />
                </div>
                <h4 className="text-[10px] md:text-sm font-medium text-muted-foreground mb-1">Limpiadas</h4>
                <div className="text-lg md:text-3xl font-bold">
                  {filteredCamaristas.reduce((a, b) => a + Number(b.total_rooms_cleaned), 0)}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-amber-500/10 to-transparent border-0 shadow-sm">
              <CardContent className="p-3 md:p-6">
                <div className="p-2 md:p-3 bg-amber-500/20 rounded-lg md:rounded-xl text-amber-600 w-fit mb-2 md:mb-4">
                  <Clock className="h-4 w-4 md:h-5 md:w-5" />
                </div>
                <h4 className="text-[10px] md:text-sm font-medium text-muted-foreground mb-1">Prom. Limpieza</h4>
                <div className="text-lg md:text-3xl font-bold">
                  {filteredCamaristas.length > 0 ? Math.round(filteredCamaristas.reduce((a, b) => a + Number(b.avg_cleaning_time_minutes), 0) / filteredCamaristas.length) : 0}<span className="text-xs md:text-base"> min</span>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-blue-500/10 to-transparent border-0 shadow-sm">
              <CardContent className="p-3 md:p-6">
                <div className="p-2 md:p-3 bg-blue-500/20 rounded-lg md:rounded-xl text-blue-600 w-fit mb-2 md:mb-4">
                  <Activity className="h-4 w-4 md:h-5 md:w-5" />
                </div>
                <h4 className="text-[10px] md:text-sm font-medium text-muted-foreground mb-1">En Limpieza</h4>
                <div className="text-lg md:text-3xl font-bold text-blue-600">
                  {filteredCamaristas.reduce((a, b) => a + Number(b.currently_cleaning), 0)}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs md:text-sm text-left">
                <thead className="text-[10px] md:text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                  <tr>
                    <th className="px-3 md:px-6 py-3 md:py-4 font-bold">Nombre</th>
                    <th className="px-3 md:px-6 py-3 md:py-4 font-bold"><span className="hidden md:inline">Hab. </span>Limp.</th>
                    <th className="px-3 md:px-6 py-3 md:py-4 font-bold">Tiempo</th>
                    <th className="px-3 md:px-6 py-3 md:py-4 font-bold hidden md:table-cell">Eficiencia</th>
                    <th className="px-3 md:px-6 py-3 md:py-4 font-bold">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Cargando...</td></tr>
                  ) : filteredCamaristas.length === 0 ? (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No hay datos en este periodo</td></tr>
                  ) : filteredCamaristas.map(c => {
                    const avgTime = Number(c.avg_cleaning_time_minutes) || 0;
                    return (
                      <tr key={c.employee_id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-3 md:px-6 py-3 md:py-4 font-semibold">{c.employee_name}</td>
                        <td className="px-3 md:px-6 py-3 md:py-4">{c.total_rooms_cleaned}</td>
                        <td className="px-3 md:px-6 py-3 md:py-4">
                          <span className={`font-semibold ${avgTime > 25 ? 'text-red-500' : avgTime > 20 ? 'text-amber-500' : 'text-green-500'}`}>
                            {avgTime} min
                          </span>
                        </td>
                        <td className="px-3 md:px-6 py-3 md:py-4 hidden md:table-cell">
                          {avgTime === 0 ? (
                            <span className="text-muted-foreground">N/A</span>
                          ) : avgTime <= 20 ? (
                            <Badge className="bg-green-500 hover:bg-green-600">Excelente</Badge>
                          ) : avgTime <= 25 ? (
                            <Badge variant="secondary" className="bg-amber-500/20 text-amber-600">Normal</Badge>
                          ) : (
                            <Badge variant="destructive">Lento</Badge>
                          )}
                        </td>
                        <td className="px-3 md:px-6 py-3 md:py-4">
                          {Number(c.currently_cleaning) > 0 ? (
                            <span className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400 font-medium text-xs">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                              </span>
                              <span className="hidden md:inline">Limpiando</span> {c.currently_cleaning}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">Libre</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Re-export Activity icon inside component to avoid import issues
function Activity(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}
