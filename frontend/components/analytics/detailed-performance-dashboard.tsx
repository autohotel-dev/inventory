"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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
}

interface ReceptionistKPI {
  employee_id: string;
  employee_name: string;
  total_entries_processed: number;
  total_exits_processed: number;
  total_extras_charged: number;
  total_revenue: number;
  anomalies_detected: number;
}

interface CamaristaKPI {
  employee_id: string;
  employee_name: string;
  total_rooms_cleaned: number;
  avg_cleaning_time_minutes: number;
  currently_cleaning: number;
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

  useEffect(() => {
    const fetchKPIs = async () => {
      setLoading(true);
      const supabase = createClient();
      
      try {
        const [cocherosRes, receptionistsRes, camaristasRes] = await Promise.all([
          supabase.rpc('get_cochero_performance_kpis', { p_start_date: dateRange.start, p_end_date: dateRange.end }),
          supabase.rpc('get_receptionist_performance_kpis', { p_start_date: dateRange.start, p_end_date: dateRange.end }),
          supabase.rpc('get_camarista_performance_kpis', { p_start_date: dateRange.start, p_end_date: dateRange.end })
        ]);

        if (cocherosRes.data) setCocheros(cocherosRes.data);
        if (receptionistsRes.data) setReceptionists(receptionistsRes.data);
        if (camaristasRes.data) setCamaristas(camaristasRes.data);
      } catch (error) {
        console.error("Error fetching detailed KPIs:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchKPIs();
  }, [dateRange.start, dateRange.end]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-gradient-to-r from-background to-muted p-6 rounded-2xl border shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20">
            <Activity className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
              Tiempos y Rendimiento
            </h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">
              Análisis detallado de eficiencia por departamento
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input 
            type="date" 
            value={dateRange.start} 
            onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            className="px-4 py-2 bg-background border rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary"
          />
          <span className="text-muted-foreground">a</span>
          <input 
            type="date" 
            value={dateRange.end} 
            onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            className="px-4 py-2 bg-background border rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Alertas Críticas */}
      <InefficiencyAlerts />

      <Tabs defaultValue="cocheros" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8 h-14 bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="cocheros" className="rounded-lg text-base font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Car className="h-4 w-4 mr-2" />
            Cocheros (Valet)
          </TabsTrigger>
          <TabsTrigger value="recepcion" className="rounded-lg text-base font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <MonitorCheck className="h-4 w-4 mr-2" />
            Recepción
          </TabsTrigger>
          <TabsTrigger value="camaristas" className="rounded-lg text-base font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Sparkles className="h-4 w-4 mr-2" />
            Camaristas
          </TabsTrigger>
        </TabsList>

        {/* ======================= COCHEROS ======================= */}
        <TabsContent value="cocheros" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-gradient-to-br from-blue-500/10 to-transparent border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-blue-500/20 rounded-xl text-blue-600">
                    <Clock className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="bg-background">Promedio Global</Badge>
                </div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Tiempo de Entrada</h4>
                <div className="text-3xl font-bold">
                  {cocheros.length > 0 ? Math.round(cocheros.reduce((a, b) => a + Number(b.avg_checkin_time_minutes), 0) / cocheros.length) : 0} min
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-indigo-500/10 to-transparent border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-indigo-500/20 rounded-xl text-indigo-600">
                    <Clock className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="bg-background">Promedio Global</Badge>
                </div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Tiempo de Salida</h4>
                <div className="text-3xl font-bold">
                  {cocheros.length > 0 ? Math.round(cocheros.reduce((a, b) => a + Number(b.avg_checkout_time_minutes), 0) / cocheros.length) : 0} min
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-emerald-500/10 to-transparent border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-emerald-500/20 rounded-xl text-emerald-600">
                    <Briefcase className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="bg-background">Total</Badge>
                </div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Servicios Extras Atendidos</h4>
                <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">
                  {cocheros.reduce((a, b) => a + Number(b.total_services), 0)}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                  <tr>
                    <th className="px-6 py-4 font-bold">Cochero</th>
                    <th className="px-6 py-4 font-bold">Vehículos Recibidos</th>
                    <th className="px-6 py-4 font-bold">Tiempo Prom. Entrada</th>
                    <th className="px-6 py-4 font-bold">Vehículos Entregados</th>
                    <th className="px-6 py-4 font-bold">Tiempo Prom. Salida</th>
                    <th className="px-6 py-4 font-bold">Servicios Extras</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">Cargando...</td></tr>
                  ) : cocheros.length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">No hay datos en este periodo</td></tr>
                  ) : cocheros.map(c => (
                    <tr key={c.employee_id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 font-semibold">{c.employee_name}</td>
                      <td className="px-6 py-4">{c.total_checkins}</td>
                      <td className="px-6 py-4">
                        <span className={`font-semibold ${Number(c.avg_checkin_time_minutes) > 15 ? 'text-red-500' : 'text-green-500'}`}>
                          {c.avg_checkin_time_minutes || 0} min
                        </span>
                      </td>
                      <td className="px-6 py-4">{c.total_checkouts}</td>
                      <td className="px-6 py-4">
                        <span className={`font-semibold ${Number(c.avg_checkout_time_minutes) > 20 ? 'text-red-500' : 'text-green-500'}`}>
                          {c.avg_checkout_time_minutes || 0} min
                        </span>
                      </td>
                      <td className="px-6 py-4">{c.total_services}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ======================= RECEPCION ======================= */}
        <TabsContent value="recepcion" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="bg-gradient-to-br from-indigo-500/10 to-transparent border-0 shadow-sm">
              <CardContent className="p-6">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Entradas Procesadas</h4>
                <div className="text-3xl font-bold">{receptionists.reduce((a, b) => a + Number(b.total_entries_processed), 0)}</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-purple-500/10 to-transparent border-0 shadow-sm">
              <CardContent className="p-6">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Salidas Procesadas</h4>
                <div className="text-3xl font-bold">{receptionists.reduce((a, b) => a + Number(b.total_exits_processed), 0)}</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-emerald-500/10 to-transparent border-0 shadow-sm">
              <CardContent className="p-6">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Cobros de Extras</h4>
                <div className="text-3xl font-bold text-emerald-600">{receptionists.reduce((a, b) => a + Number(b.total_extras_charged), 0)}</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-amber-500/10 to-transparent border-0 shadow-sm">
              <CardContent className="p-6">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Anomalías Detectadas</h4>
                <div className="text-3xl font-bold text-amber-600">{receptionists.reduce((a, b) => a + Number(b.anomalies_detected), 0)}</div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                  <tr>
                    <th className="px-6 py-4 font-bold">Recepcionista</th>
                    <th className="px-6 py-4 font-bold">Entradas</th>
                    <th className="px-6 py-4 font-bold">Salidas</th>
                    <th className="px-6 py-4 font-bold">Extras Cobrados</th>
                    <th className="px-6 py-4 font-bold">Ingresos Totales</th>
                    <th className="px-6 py-4 font-bold">Anomalías</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">Cargando...</td></tr>
                  ) : receptionists.length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">No hay datos en este periodo</td></tr>
                  ) : receptionists.map(r => (
                    <tr key={r.employee_id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 font-semibold">{r.employee_name}</td>
                      <td className="px-6 py-4">{r.total_entries_processed}</td>
                      <td className="px-6 py-4">{r.total_exits_processed}</td>
                      <td className="px-6 py-4">{r.total_extras_charged}</td>
                      <td className="px-6 py-4 font-medium text-green-600 dark:text-green-400">
                        ${Number(r.total_revenue).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4">
                        {Number(r.anomalies_detected) > 0 ? (
                          <Badge variant="destructive">{r.anomalies_detected} Alertas</Badge>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-gradient-to-br from-cyan-500/10 to-transparent border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-cyan-500/20 rounded-xl text-cyan-600">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="bg-background">Total</Badge>
                </div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Habitaciones Limpiadas</h4>
                <div className="text-3xl font-bold">
                  {camaristas.reduce((a, b) => a + Number(b.total_rooms_cleaned), 0)}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-amber-500/10 to-transparent border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-amber-500/20 rounded-xl text-amber-600">
                    <Clock className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="bg-background">Promedio Global</Badge>
                </div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Tiempo de Limpieza</h4>
                <div className="text-3xl font-bold">
                  {camaristas.length > 0 ? Math.round(camaristas.reduce((a, b) => a + Number(b.avg_cleaning_time_minutes), 0) / camaristas.length) : 0} min
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-blue-500/10 to-transparent border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-blue-500/20 rounded-xl text-blue-600">
                    <Activity className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="bg-background">En Vivo</Badge>
                </div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Limpiando Actualmente</h4>
                <div className="text-3xl font-bold text-blue-600">
                  {camaristas.reduce((a, b) => a + Number(b.currently_cleaning), 0)}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                  <tr>
                    <th className="px-6 py-4 font-bold">Camarista</th>
                    <th className="px-6 py-4 font-bold">Habitaciones Limpiadas</th>
                    <th className="px-6 py-4 font-bold">Tiempo Promedio</th>
                    <th className="px-6 py-4 font-bold">Eficiencia</th>
                    <th className="px-6 py-4 font-bold">Estado Actual</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">Cargando...</td></tr>
                  ) : camaristas.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No hay datos en este periodo</td></tr>
                  ) : camaristas.map(c => {
                    const avgTime = Number(c.avg_cleaning_time_minutes) || 0;
                    return (
                      <tr key={c.employee_id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4 font-semibold">{c.employee_name}</td>
                        <td className="px-6 py-4">{c.total_rooms_cleaned}</td>
                        <td className="px-6 py-4">
                          <span className={`font-semibold ${avgTime > 45 ? 'text-red-500' : 'text-green-500'}`}>
                            {avgTime} min
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {avgTime === 0 ? (
                            <span className="text-muted-foreground">N/A</span>
                          ) : avgTime <= 30 ? (
                            <Badge className="bg-green-500 hover:bg-green-600">Excelente</Badge>
                          ) : avgTime <= 45 ? (
                            <Badge variant="secondary" className="bg-amber-500/20 text-amber-600">Normal</Badge>
                          ) : (
                            <Badge variant="destructive">Lento</Badge>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {Number(c.currently_cleaning) > 0 ? (
                            <span className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 font-medium">
                              <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
                              </span>
                              Limpiando {c.currently_cleaning} hab
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Libre</span>
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
