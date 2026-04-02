"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users,
  TrendingUp,
  TrendingDown,
  Clock,
  DollarSign,
  Star,
  Award,
  AlertTriangle,
  CheckCircle,
  Calendar,
  Search,
  Filter,
  Download
} from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface EmployeePerformance {
  id: string;
  name: string;
  role: string;
  department: string;
  checkIns: number;
  checkOuts: number;
  revenue: number;
  avgStayTime: number;
  efficiency: number;
  rating: number;
  attendance: number;
  status: "active" | "on_break" | "off";
  lastActivity: string;
  trend: "up" | "down" | "stable";
  shiftHours: number;
}

export function EmployeePerformance() {
  const [employees, setEmployees] = useState<EmployeePerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [sortBy, setSortBy] = useState("efficiency");

  useEffect(() => {
    const fetchEmployeePerformance = async () => {
      setLoading(true);
      const supabase = createClient();

      try {
        const today = new Date().toISOString().split('T')[0];
        const todayStart = today + 'T00:00:00';
        const todayEnd = today + 'T23:59:59';

        console.log('🔍 EMPLOYEE PERFORMANCE DEBUG: Cargando desempeño para fecha:', today);
        console.log('🔍 DEBUG - Fecha inicio:', todayStart);
        console.log('🔍 DEBUG - Fecha fin:', todayEnd);

        // 🚀 DATOS REALES DE LA BASE DE DATOS

        // 1. Obtener todos los empleados activos
        const { data: employees } = await supabase
          .from('employees')
          .select(`
            id,
            first_name,
            last_name,
            role,
            deleted_at
          `)
          .is('deleted_at', null)
          .order('first_name');

        if (!employees || employees.length === 0) {
          setEmployees([]);
          return;
        }

        // 2. Para cada empleado, obtener sus métricas de desempeño
        console.log('🔍 EMPLOYEE PERFORMANCE DEBUG: Procesando', employees.length, 'empleados');

        const employeePerformance: EmployeePerformance[] = await Promise.all(
          employees.map(async (emp: any) => {
            const fullName = `${emp.first_name} ${emp.last_name}`;
            console.log(`🔍 Procesando empleado: ${fullName} (ID: ${emp.id}, Role: ${emp.role})`);

            let checkins = [];
            let checkouts = [];
            let revenue = 0;

            // Debug: Verificar si hay datos en las tablas originales
            const { data: todayRoomStays } = await supabase
              .from('room_stays')
              .select('*')
              .gte('check_in_at', today)
              .limit(5);

            const { data: todayPayments } = await supabase
              .from('payments')
              .select('*')
              .gte('created_at', today)
              .eq('status', 'PAGADO')
              .limit(5);

            console.log(`🔍 DEBUG - Room stays del día:`, todayRoomStays?.length || 0);
            console.log(`🔍 DEBUG - Pagos del día:`, todayPayments?.length || 0);

            if (todayRoomStays && todayRoomStays.length > 0) {
              console.log('🔍 DEBUG - Primer room_stay:', todayRoomStays[0]);
            }
            if (todayPayments && todayPayments.length > 0) {
              console.log('🔍 DEBUG - Primer payment:', todayPayments[0]);
            }

            // Debug: Verificar si la tabla de movimientos tiene datos
            // Probar diferentes formatos de fecha
            const { data: allMovements1 } = await supabase
              .from('employee_movements')
              .select('*')
              .gte('created_at', today)
              .limit(10);

            const { data: allMovements2 } = await supabase
              .from('employee_movements')
              .select('*')
              .gte('created_at', today + 'T00:00:00')
              .lte('created_at', today + 'T23:59:59')
              .limit(10);

            const { data: allMovements3 } = await supabase
              .from('employee_movements')
              .select('*')
              .gte('created_at', new Date().toISOString())
              .limit(10);

            console.log(`🔍 DEBUG - Movimientos (formato 1 - solo fecha):`, allMovements1?.length || 0);
            console.log(`🔍 DEBUG - Movimientos (formato 2 - rango completo):`, allMovements2?.length || 0);
            console.log(`🔍 DEBUG - Movimientos (formato 3 - timestamp actual):`, allMovements3?.length || 0);

            const allMovements = allMovements2; // Usar el formato 2

            console.log(`🔍 DEBUG - Todos los movimientos del día:`, allMovements?.length || 0);
            if (allMovements && allMovements.length > 0) {
              console.log('🔍 DEBUG - Primer movimiento:', allMovements[0]);
            }

            // Usar la nueva tabla de movimientos para obtener datos precisos
            const { data: employeeMovements } = await supabase
              .from('employee_movements')
              .select('movement_type, entity_type, entity_id, amount, quantity, created_at, metadata')
              .eq('employee_id', emp.id)
              .gte('created_at', today + 'T00:00:00')
              .lte('created_at', today + 'T23:59:59')
              .eq('status', 'completed');

            console.log(`  - Movimientos del día: ${employeeMovements?.length || 0}`);

            if (employeeMovements && employeeMovements.length > 0) {
              // Procesar movimientos por tipo
              checkins = employeeMovements.filter((m: any) => m.movement_type === 'check_in');
              checkouts = employeeMovements.filter((m: any) => m.movement_type === 'check_out');

              const paymentMovements = employeeMovements.filter((m: any) => m.movement_type === 'payment');
              revenue = paymentMovements.reduce((sum: number, m: any) => sum + (m.amount || 0), 0);

              console.log(`  - Check-ins (movimientos): ${checkins.length}`);
              console.log(`  - Check-outs (movimientos): ${checkouts.length}`);
              console.log(`  - Pagos (movimientos): ${paymentMovements.length}`);
              console.log(`  - Ingresos totales: $${revenue}`);

              // Contar otros tipos de movimientos
              const extraHours = employeeMovements.filter((m: any) => m.movement_type === 'extra_hour');
              const extraPersons = employeeMovements.filter((m: any) => m.movement_type === 'extra_person');
              const renewals = employeeMovements.filter((m: any) => m.movement_type === 'renewal');

              console.log(`  - Horas extra: ${extraHours.length}`);
              console.log(`  - Personas extra: ${extraPersons.length}`);
              console.log(`  - Renovaciones: ${renewals.length}`);

            } else {
              // Fallback si no hay movimientos registrados aún
              console.log(`  - Sin movimientos registrados, usando fallback...`);

              // Buscar turnos del día para este empleado
              const { data: employeeShifts } = await supabase
                .from('shift_sessions')
                .select('id, start_time, end_time, employee_id')
                .eq('employee_id', emp.id)
                .gte('start_time', today)
                .lte('start_time', `${today} 23:59:59`);

              const shiftIds = employeeShifts?.map((shift: any) => shift.id) || [];
              console.log(`  - Turnos del día: ${shiftIds.length}`);

              if (shiftIds.length > 0) {
                // Obtener room_stays asociados a los turnos de este empleado
                const { data: shiftStays } = await supabase
                  .from('room_stays')
                  .select('id, check_in_at, check_out_at, shift_session_id, valet_employee_id, checkout_valet_employee_id')
                  .in('shift_session_id', shiftIds);

                checkins = shiftStays?.filter((stay: any) => stay.check_in_at) || [];
                checkouts = shiftStays?.filter((stay: any) => stay.check_out_at) || [];

                // Obtener pagos asociados a los turnos de este empleado
                const { data: shiftPayments } = await supabase
                  .from('payments')
                  .select('amount, created_at, status, shift_session_id')
                  .in('shift_session_id', shiftIds)
                  .eq('status', 'PAGADO');

                revenue = shiftPayments?.reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0;

                console.log(`  - Fallback - Check-ins por turnos: ${checkins.length}`);
                console.log(`  - Fallback - Check-outs por turnos: ${checkouts.length}`);
                console.log(`  - Fallback - Pagos por turnos: ${shiftPayments?.length || 0}`);

              } else {
                // Último fallback - métodos directos
                if (emp.role === 'valet') {
                  const { data: valetCheckins } = await supabase
                    .from('room_stays')
                    .select('id, check_in_at, check_out_at, valet_employee_id')
                    .eq('valet_employee_id', emp.id)
                    .gte('check_in_at', today);

                  checkins = valetCheckins || [];

                  const { data: valetPayments } = await supabase
                    .from('payments')
                    .select('amount, created_at, status')
                    .gte('created_at', today)
                    .eq('status', 'PAGADO')
                    .eq('collected_by', emp.id);

                  revenue = valetPayments?.reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0;

                  console.log(`  - Ultimate fallback - Check-ins valet: ${checkins.length}`);
                  console.log(`  - Ultimate fallback - Pagos valet: ${valetPayments?.length || 0}`);

                } else if (emp.role === 'receptionist') {
                  const { data: receptionistPayments } = await supabase
                    .from('payments')
                    .select('amount, created_at, status')
                    .gte('created_at', today)
                    .eq('status', 'PAGADO');

                  revenue = receptionistPayments?.reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0;

                  console.log(`  - Ultimate fallback - Pagos recepcionista: ${receptionistPayments?.length || 0}`);
                }
              }
            }

            const todayStays = checkins;

            // Calcular tiempo promedio de estancia
            const completedStays = todayStays?.filter((stay: any) => stay.check_in_at && stay.check_out_at) || [];
            const avgStayTime = completedStays.length > 0
              ? completedStays.reduce((sum: number, stay: any) => {
                const hours = (new Date(stay.check_out_at).getTime() - new Date(stay.check_in_at).getTime()) / (1000 * 60 * 60);
                return sum + hours;
              }, 0) / completedStays.length
              : 0;

            // Calcular eficiencia (basado en check-ins completados vs totales)
            const efficiency = todayStays && todayStays.length > 0
              ? Math.round((completedStays.length / todayStays.length) * 100)
              : 0;

            // Determinar estado (activo si tuvo actividad reciente)
            const lastActivity = todayStays && todayStays.length > 0
              ? format(new Date(Math.max(...todayStays.map((s: any) => new Date(s.check_in_at).getTime()))), 'Hace X min', { locale: es })
              : "Sin actividad hoy";

            const status = todayStays && todayStays.length > 0
              ? (Date.now() - new Date(Math.max(...todayStays.map((s: any) => new Date(s.check_in_at).getTime()))).getTime() < 30 * 60 * 1000 ? "active" : "on_break")
              : "off";

            // Calcular rating (basado en eficiencia y volumen)
            const rating = efficiency >= 95 ? 4.9 :
              efficiency >= 90 ? 4.7 :
                efficiency >= 85 ? 4.5 :
                  efficiency >= 80 ? 4.3 : 4.0;

            // Asistencia (simulada - necesitaríamos tabla de asistencia)
            const attendance = 95 + Math.floor(Math.random() * 5);

            // Trend (simulado - necesitaríamos datos históricos)
            const trend = Math.random() > 0.5 ? "up" : Math.random() > 0.5 ? "stable" : "down";

            console.log(`  - Métricas finales: Check-ins: ${todayStays.length}, Revenue: $${revenue}, Efficiency: ${efficiency}%`);

            return {
              id: emp.id,
              name: fullName,
              role: emp.role,
              department: emp.role === 'receptionist' ? 'Front Desk' : emp.role === 'valet' ? 'Valet' : 'Management',
              checkIns: todayStays?.length || 0,
              checkOuts: checkouts?.length || 0,
              revenue: revenue,
              avgStayTime: avgStayTime,
              efficiency: efficiency,
              rating: rating,
              attendance: attendance,
              status: status,
              lastActivity: lastActivity,
              trend: trend
            };
          })
        );

        // Filtrar empleados que tuvieron actividad hoy
        const activeEmployees = employeePerformance.filter(emp => emp.checkIns > 0 || emp.revenue > 0);

        console.log('🔍 EMPLOYEE PERFORMANCE DEBUG: Resultados finales:');
        console.log('  - Total empleados procesados:', employeePerformance.length);
        console.log('  - Empleados con actividad:', activeEmployees.length);
        console.log('  - Mostrando:', activeEmployees.length > 0 ? 'activos' : 'todos');

        setEmployees(activeEmployees.length > 0 ? activeEmployees : employeePerformance);
      } catch (error) {
        console.error("Error fetching employee performance:", error);
        // En caso de error, mostrar mensaje
        setEmployees([]);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployeePerformance();
    const interval = setInterval(fetchEmployeePerformance, 30000); // Actualizar cada 30 segundos
    return () => clearInterval(interval);
  }, []);

  const filteredEmployees = useMemo(() => {
    return employees.filter(employee => {
      const matchesSearch = employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.role.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === "all" || employee.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [employees, searchTerm, roleFilter]);

  const sortedEmployees = useMemo(() => {
    return [...filteredEmployees].sort((a, b) => {
      switch (sortBy) {
        case "efficiency":
          return b.efficiency - a.efficiency;
        case "revenue":
          return b.revenue - a.revenue;
        case "rating":
          return b.rating - a.rating;
        case "checkIns":
          return b.checkIns - a.checkIns;
        default:
          return 0;
      }
    });
  }, [filteredEmployees, sortBy]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "on_break":
        return "bg-yellow-100 text-yellow-800";
      case "off":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case "down":
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      default:
        return <div className="h-4 w-4 bg-gray-400 rounded-full" />;
    }
  };

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 90) return "text-green-600";
    if (efficiency >= 80) return "text-yellow-600";
    return "text-red-600";
  };

  const getRatingStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${i < Math.floor(rating) ? "text-yellow-400 fill-current" : "text-gray-300"
          }`}
      />
    ));
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-muted/50"></div>
            <div>
              <div className="h-8 bg-muted/50 rounded w-48 mb-2"></div>
              <div className="h-4 bg-muted/50 rounded w-64"></div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-6 bg-muted/50 rounded w-20"></div>
            <div className="h-6 bg-muted/50 rounded w-24"></div>
          </div>
        </div>

        {/* Filtros Skeleton */}
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="h-12 bg-muted/50 rounded-xl"></div>
          </div>
          <div className="w-40 h-12 bg-muted/50 rounded-xl"></div>
          <div className="w-40 h-12 bg-muted/50 rounded-xl"></div>
        </div>

        {/* KPI Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="relative overflow-hidden border-0 bg-gradient-to-br from-muted/30 to-transparent rounded-xl p-6">
              <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 bg-muted/50 rounded w-3/4"></div>
                <div className="w-8 h-8 bg-muted/50 rounded-lg"></div>
              </div>
              <div className="h-8 bg-muted/50 rounded w-1/2"></div>
              <div className="h-4 bg-muted/50 rounded w-full mt-2"></div>
            </div>
          ))}
        </div>

        {/* Lista Empleados Skeleton */}
        <div className="border-0 bg-gradient-to-br from-muted/30 to-transparent rounded-xl">
          <div className="p-6 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-muted/50 rounded-lg"></div>
              <div>
                <div className="h-6 bg-muted/50 rounded w-32 mb-2"></div>
                <div className="h-4 bg-muted/50 rounded w-48"></div>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-background/50">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-muted/50 rounded-xl"></div>
                  <div>
                    <div className="h-5 bg-muted/50 rounded w-32 mb-2"></div>
                    <div className="h-4 bg-muted/50 rounded w-24"></div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="h-5 bg-muted/50 rounded w-8"></div>
                  <div className="h-5 bg-muted/50 rounded w-16"></div>
                  <div className="h-5 bg-muted/50 rounded w-12"></div>
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, j) => (
                      <div key={j} className="w-3 h-3 bg-muted/50 rounded-full"></div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 border border-purple-400/30 shadow-lg shadow-purple-500/25">
            <Users className="h-7 w-7 text-white" />
          </div>
          <div>
            <h3 className="text-2xl font-bold">Desempeño de Empleados</h3>
            <p className="text-sm text-muted-foreground mt-1">Seguimiento en tiempo real del rendimiento del equipo</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-purple-500/10 text-purple-600 border-0">
            <CheckCircle className="h-3 w-3 mr-1" />
            {employees.length} Activos
          </Badge>
          <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-0">
            <TrendingUp className="h-3 w-3 mr-1" />
            Monitoreo Activo
          </Badge>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar empleado..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-background/50 border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300"
            />
          </div>
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-40 bg-background/50 border border-border text-foreground hover:bg-background/70">
            <SelectValue placeholder="Rol" />
          </SelectTrigger>
          <SelectContent className="bg-background/95 border border-border">
            <SelectItem value="all">Todos los roles</SelectItem>
            <SelectItem value="receptionist">Recepcionista</SelectItem>
            <SelectItem value="valet">Valet</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-40 bg-background/50 border border-border text-foreground hover:bg-background/70">
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent className="bg-background/95 border border-border">
            <SelectItem value="efficiency">Eficiencia</SelectItem>
            <SelectItem value="revenue">Ingresos</SelectItem>
            <SelectItem value="checkins">Check-ins</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards con Gradientes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Empleados */}
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent hover:shadow-lg hover:shadow-purple-500/10 transition-all duration-300 group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Empleados</CardTitle>
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
                <Users className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{employees.length}</div>
              <p className="text-xs text-muted-foreground pt-2">
                Personal registrado
              </p>
            </CardContent>
          </Card>

          {/* Activos Hoy */}
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent hover:shadow-lg hover:shadow-green-500/10 transition-all duration-300 group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Activos Hoy</CardTitle>
              <div className="p-2 rounded-lg bg-green-500/10 text-green-500">
                <CheckCircle className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{employees.filter(e => e.status === 'active').length}</div>
              <p className="text-xs text-muted-foreground pt-2">
                Empleados en turno
              </p>
            </CardContent>
          </Card>

          {/* Total Ingresos */}
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Ingresos Hoy</CardTitle>
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                <DollarSign className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${employees.reduce((sum, e) => sum + e.revenue, 0).toLocaleString()}</div>
              <p className="text-xs text-muted-foreground pt-2">
                Generados por el equipo
              </p>
            </CardContent>
          </Card>

          {/* Rating Promedio */}
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent hover:shadow-lg hover:shadow-amber-500/10 transition-all duration-300 group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Rating Promedio</CardTitle>
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                <Star className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{employees.length > 0 ? (employees.reduce((sum, e) => sum + e.rating, 0) / employees.length).toFixed(1) : '0.0'}</div>
              <p className="text-xs text-muted-foreground pt-2">
                Calificación del equipo
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Empleados */}
        <Card className="border-0 bg-gradient-to-br from-muted/30 to-transparent">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-purple-400/20 to-indigo-400/20">
                <Users className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <CardTitle>Empleados</CardTitle>
                <p className="text-sm text-muted-foreground">Rendimiento del equipo</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sortedEmployees.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted/50 flex items-center justify-center">
                    <Users className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground font-medium">No hay empleados activos</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">Los empleados aparecerán aquí</p>
                </div>
              ) : (
                sortedEmployees.map((employee) => (
                  <div
                    key={employee.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-background/50 hover:bg-background/80 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-400/20 to-indigo-400/20 flex items-center justify-center text-purple-600 font-bold shadow-sm">
                        {employee.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <div className="font-medium group-hover:text-primary transition-colors">{employee.name}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <span className="capitalize">{employee.role}</span>
                          <span>•</span>
                          <Badge variant="secondary" className="text-xs">
                            {employee.status === "active" ? "Activo" :
                             employee.status === "on_break" ? "Pausa" : "Offline"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="font-bold">{employee.checkIns}</div>
                        <div className="text-xs text-muted-foreground">check-ins</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">${employee.revenue.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">ingresos</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{employee.efficiency}%</div>
                        <div className="text-xs text-muted-foreground">eficiencia</div>
                      </div>
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`h-3 w-3 ${i < Math.floor(employee.rating) ? "text-yellow-400 fill-current" : "text-gray-300"}`} />
                        ))}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
    </div>
  );
}

