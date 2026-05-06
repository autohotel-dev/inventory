import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { EmployeePerformanceData } from "@/components/analytics/employee-performance/types";

export function useEmployeePerformance() {
  const [employees, setEmployees] = useState<EmployeePerformanceData[]>([]);
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
        
        // 1. Obtener todos los empleados activos
        const { data: employeesData } = await supabase
          .from('employees')
          .select(`
            id,
            first_name,
            last_name,
            role,
            deleted_at
          `)
          .is('deleted_at', null)
          ;

        if (!employeesData || employeesData.length === 0) {
          setEmployees([]);
          return;
        }

        const employeePerformance: EmployeePerformanceData[] = await Promise.all(
          employeesData.map(async (emp: any) => {
            const fullName = `${emp.first_name} ${emp.last_name}`;

            let checkins: any[] = [];
            let checkouts: any[] = [];
            let revenue = 0;

            const { data: employeeMovements } = await supabase
              .from('employee_movements')
              .select('movement_type, amount')
              
              .gte('created_at', today + 'T00:00:00')
              .lte('created_at', today + 'T23:59:59')
              ;

            if (employeeMovements && employeeMovements.length > 0) {
              checkins = employeeMovements.filter((m: any) => m.movement_type === 'check_in');
              checkouts = employeeMovements.filter((m: any) => m.movement_type === 'check_out');

              const paymentMovements = employeeMovements.filter((m: any) => m.movement_type === 'payment');
              revenue = paymentMovements.reduce((sum: number, m: any) => sum + (m.amount || 0), 0);
            } else {
              // Fallback si no hay movimientos registrados aún
              const { data: employeeShifts } = await supabase
                .from('shift_sessions')
                .select('id')
                
                .gte('start_time', today)
                .lte('start_time', `${today} 23:59:59`);

              const shiftIds = employeeShifts?.map((shift: any) => shift.id) || [];

              if (shiftIds.length > 0) {
                const { data: shiftStays } = await supabase
                  .from('room_stays')
                  .select('id, check_in_at, check_out_at')
                  .in('shift_session_id', shiftIds);

                checkins = shiftStays?.filter((stay: any) => stay.check_in_at) || [];
                checkouts = shiftStays?.filter((stay: any) => stay.check_out_at) || [];

                const { data: shiftPayments } = await supabase
                  .from('payments')
                  .select('amount')
                  .in('shift_session_id', shiftIds)
                  ;

                revenue = shiftPayments?.reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0;
              } else {
                // Último fallback - métodos directos
                if (emp.role === 'valet') {
                  const { data: valetCheckins } = await supabase
                    .from('room_stays')
                    .select('id, check_in_at, check_out_at')
                    
                    .gte('check_in_at', today);

                  checkins = valetCheckins || [];

                  const { data: valetPayments } = await supabase
                    .from('payments')
                    .select('amount')
                    .gte('created_at', today)
                    
                    ;

                  revenue = valetPayments?.reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0;
                } else if (emp.role === 'receptionist') {
                  const { data: receptionistPayments } = await supabase
                    .from('payments')
                    .select('amount')
                    .gte('created_at', today)
                    ;

                  revenue = receptionistPayments?.reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0;
                }
              }
            }

            const todayStays = checkins;
            const completedStays = todayStays?.filter((stay: any) => stay.check_in_at && stay.check_out_at) || [];
            const avgStayTime = completedStays.length > 0
              ? completedStays.reduce((sum: number, stay: any) => {
                const hours = (new Date(stay.check_out_at).getTime() - new Date(stay.check_in_at).getTime()) / (1000 * 60 * 60);
                return sum + hours;
              }, 0) / completedStays.length
              : 0;

            const efficiency = todayStays && todayStays.length > 0
              ? Math.round((completedStays.length / todayStays.length) * 100)
              : 0;

            const lastActivity = todayStays && todayStays.length > 0
              ? format(new Date(Math.max(...todayStays.map((s: any) => new Date(s.check_in_at).getTime()))), 'Hace X min', { locale: es })
              : "Sin actividad hoy";

            const status = todayStays && todayStays.length > 0
              ? (Date.now() - new Date(Math.max(...todayStays.map((s: any) => new Date(s.check_in_at).getTime()))).getTime() < 30 * 60 * 1000 ? "active" : "on_break")
              : "off";

            const rating = efficiency >= 95 ? 4.9 :
              efficiency >= 90 ? 4.7 :
                efficiency >= 85 ? 4.5 :
                  efficiency >= 80 ? 4.3 : 4.0;

            const attendance = 95 + Math.floor(Math.random() * 5);
            const trend = Math.random() > 0.5 ? "up" : Math.random() > 0.5 ? "stable" : "down";

            return {
              id: emp.id,
              name: fullName,
              role: emp.role,
              department: emp.role === 'receptionist' ? 'Recepción' : emp.role === 'valet' ? 'Cochero' : 'Gerencia',
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

        const activeEmployees = employeePerformance.filter(emp => emp.checkIns > 0 || emp.revenue > 0);
        setEmployees(activeEmployees.length > 0 ? activeEmployees : employeePerformance);
      } catch (error) {
        console.error("Error fetching employee performance:", error);
        setEmployees([]);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployeePerformance();
    const interval = setInterval(fetchEmployeePerformance, 30000);
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

  return {
    employees,
    sortedEmployees,
    loading,
    searchTerm,
    setSearchTerm,
    roleFilter,
    setRoleFilter,
    sortBy,
    setSortBy
  };
}
